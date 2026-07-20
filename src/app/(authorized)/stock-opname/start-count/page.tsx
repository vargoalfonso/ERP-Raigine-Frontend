"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Table,
  Tag,
  Upload,
  message,
} from "antd";
import type { UploadProps } from "antd";
import dayjs, { Dayjs } from "dayjs";
import * as XLSX from "xlsx";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftOutlined,
  FileAddOutlined,
  InboxOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type StockInventoryType,
  type StockOpnameUniqOption,
  useCreateStockOpnameSessionMutation,
  useLazyGetStockOpnameUniqOptionsQuery,
} from "@/lib/api/stock-opname/api";
import { getCurrentUserDisplayName } from "@/lib/utils/currentUser";
import { useGetEmployeesQuery } from "@/lib/api/system-settings/api";
import { useListWarehousesQuery } from "@/lib/api/warehouse/api";

type Method = "manual" | "bulk";

type Entry = {
  id: string;
  uniq?: string;
  partNumber?: string;
  partName?: string;
  systemStock: number;
  countedQty?: number;
  userCounter?: string;
  uom?: string;
  weightKg?: number | null;
  // Raw material type (only Raw Materials have it, e.g. "wire").
  // Drives the conditional Weight field.
  rawMaterialType?: string;
};

// A Raw Material uniq is weight-tracked (needs a Weight input) when its
// raw_material_type is "wire".
const isWireType = (t?: string | null) => (t ?? "").trim().toLowerCase() === "wire";

const TAB_TO_INVENTORY_TYPE: Record<string, StockInventoryType> = {
  finished: "FG",
  raw: "RM",
  indirect: "IDR",
  wip: "WIP",
  subcon: "SUBCON",
};

type BulkRow = {
  key: string;
  uniq: string;
  partNumber: string;
  partName: string;
  model: string;
  countedQty: number;
  userCounted: string;
  warehouseLocation: string;
};

function difference(systemStock: number, countedQty?: number) {
  const counted = typeof countedQty === "number" ? countedQty : 0;
  return counted - systemStock;
}

function toId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Bulk Upload template definition. Part Number / Part Name (and Model) are
// auto-filled from the Uniq, so the template only asks for the fields a
// counter actually needs to enter.
const BULK_TEMPLATE_SHEET = "Template";
const BULK_TEMPLATE_HEADERS = [
  "Uniq",
  "Counted Qty",
  "User Counted",
  "Warehouse Location",
] as const;

// Reads the first non-empty value among the provided header aliases so the
// parser tolerates minor header differences (spaces, casing, snake_case).
function pickCell(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number {
  const raw = pickCell(row, keys);
  if (!raw) return 0;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Maps a parsed Excel row (flexible header names) into a BulkRow.
function mapExcelRow(row: Record<string, unknown>, index: number): BulkRow {
  return {
    key: `bulk-${index}-${Math.floor(Math.random() * 1e6)}`,
    uniq: pickCell(row, ["Uniq", "uniq", "Uniq Code", "uniq_code", "UniqCode"]),
    partNumber: pickCell(row, ["Part Number", "part_number", "partNumber", "Part No"]),
    partName: pickCell(row, ["Part Name", "part_name", "partName"]),
    model: pickCell(row, ["Model", "model"]),
    countedQty: pickNumber(row, ["Counted Qty", "Counted Quantity", "counted_qty", "countedQty", "Qty"]),
    userCounted: pickCell(row, ["User Counted", "user_counted", "userCounted", "User Counter", "user_counter"]),
    warehouseLocation: pickCell(row, ["Warehouse Location", "warehouse_location", "warehouseLocation", "WRH Location", "Warehouse"]),
  };
}

// Reads an uploaded Excel file into BulkRow[] fully client-side (the file is
// never uploaded to the server; only the parsed rows are submitted on Save).
function readExcelFile(file: File): Promise<BulkRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve([]);
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        resolve(json.map((row, index) => mapExcelRow(row, index)).filter((row) => row.uniq));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export default function StockOpnameStartCountPage() {
  return (
    <Suspense fallback={null}>
      <StockOpnameStartCountPageContent />
    </Suspense>
  );
}

function StockOpnameStartCountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiEnabled = Boolean(apiBaseUrl);

  const tab = (searchParams.get("tab") ?? "finished").toLowerCase();
  const inventoryType = TAB_TO_INVENTORY_TYPE[tab] ?? "FG";
  const backLabel = useMemo(() => {
    if (tab === "raw") return "Back to Raw Materials";
    if (tab === "indirect") return "Back to Indirect Stock";
    if (tab === "wip") return "Back to Work In-Progress";
    if (tab === "subcon") return "Back to Subcon Materials";
    return "Back to Finished Goods";
  }, [tab]);

  const [form] = Form.useForm();
  const uniqSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [method, setMethod] = useState<Method>("manual");
  const [period, setPeriod] = useState<Dayjs>(dayjs("2024-01-01"));
  const [scheduleDate, setScheduleDate] = useState<Dayjs>(dayjs());
  const [countedDate, setCountedDate] = useState<Dayjs>(dayjs());

  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);

  const [getUniqOptions, { data: uniqSearchResults = [], isFetching: uniqLoading }] =
    useLazyGetStockOpnameUniqOptionsQuery();
  const [createStockOpnameSession, { isLoading: saving }] = useCreateStockOpnameSessionMutation();
  const [warehouseLocation, setWarehouseLocation] = useState<string>();
  const { data: warehouseList = [] } = useListWarehousesQuery(undefined, { skip: !apiEnabled });
  const warehouseOptions = useMemo(
    () =>
      warehouseList
        .map((w) => ({
          value: w.warehouse_name ?? w.id ?? "",
          label: w.type_warehouse ? `${w.warehouse_name ?? w.id ?? "-"} — ${w.type_warehouse}` : w.warehouse_name ?? w.id ?? "-",
        }))
        .filter((o) => Boolean(o.value)),
    [warehouseList]
  );
  const fallbackUniqOptions = useMemo(
    () => [
      { label: "FG-001", value: "FG-001" },
      { label: "FG-002", value: "FG-002" },
      { label: "FG-003", value: "FG-003" },
      { label: "RM-010", value: "RM-010" },
      { label: "WIP-007", value: "WIP-007" },
    ],
    []
  );

  const systemStockByUniq = useMemo<Record<string, number>>(
    () => ({
      "FG-001": 250,
      "FG-002": 180,
      "FG-003": 95,
      "RM-010": 1200,
      "WIP-007": 32,
    }),
    []
  );

  const employeesQuery = useGetEmployeesQuery(undefined, { skip: !apiEnabled });
  const liveUserCounterOptions = useMemo(() => {
    return (employeesQuery.data ?? []).map((e) => ({
      label: e.full_name ?? e.email ?? String(e.id),
      value: e.full_name ?? e.employee_id ?? e.id,
    }));
  }, [employeesQuery.data]);

  // User Counter is not selectable — it auto-fills from the logged-in user.
  const currentUserName = useMemo(() => getCurrentUserDisplayName() ?? "", []);

  const [entries, setEntries] = useState<Entry[]>(() =>
    apiEnabled
      ? [{ id: toId("entry"), systemStock: 0 }]
      : [{ id: toId("entry"), uniq: "FG-001", systemStock: 250, countedQty: 245, userCounter: "John Meijer" }]
  );

  // Keep every entry's counter in sync with the current user (also covers newly added rows).
  useEffect(() => {
    if (!currentUserName) return;
    setEntries((prev) => {
      let changed = false;
      const next = prev.map((entry) => {
        if (entry.userCounter === currentUserName) return entry;
        changed = true;
        return { ...entry, userCounter: currentUserName };
      });
      return changed ? next : prev;
    });
  }, [currentUserName, entries.length]);

  const uniqOptions = useMemo(
    () =>
      apiEnabled
        ? uniqSearchResults.map((item) => ({
          label: `${item.uniq_code} - ${item.part_number} - ${item.part_name} `,
          value: item.uniq_code,
        }))
        : fallbackUniqOptions,
    [apiEnabled, fallbackUniqOptions, uniqSearchResults]
  );

  const uniqLookup = useMemo(
    () => new Map(uniqSearchResults.map((item) => [item.uniq_code, item])),
    [uniqSearchResults]
  );

  useEffect(() => {
    if (!apiEnabled) return;
    void getUniqOptions({ type: inventoryType, q: "", limit: 10 });
  }, [apiEnabled, getUniqOptions, inventoryType]);

  useEffect(() => {
    return () => {
      if (uniqSearchTimeoutRef.current) {
        clearTimeout(uniqSearchTimeoutRef.current);
      }
    };
  }, []);

  const entryCountLabel = useMemo(() => {
    if (method === "bulk") return `${bulkRows.length || 0} entry`;
    return `${entries.length} entry`;
  }, [bulkRows.length, entries.length, method]);

  // Generates and downloads a ready-to-fill .xlsx template with an example row.
  function handleDownloadTemplate() {
    const exampleRow: Record<string, string | number> = {
      Uniq: uniqOptions[0]?.value ?? "FG-001",
      "Counted Qty": 0,
      "User Counted": currentUserName,
      "Warehouse Location": warehouseOptions[0]?.value ?? "",
    };
    const worksheet = XLSX.utils.json_to_sheet([exampleRow], {
      header: [...BULK_TEMPLATE_HEADERS],
    });
    worksheet["!cols"] = BULK_TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, BULK_TEMPLATE_SHEET);

    // Second sheet: master warehouse data so counters can copy exact names.
    const masterHeaders = ["Warehouse Name", "Type", "Plant"];
    const masterRows =
      warehouseList.length > 0
        ? warehouseList.map((w) => ({
            "Warehouse Name": w.warehouse_name ?? "",
            Type: w.type_warehouse ?? "",
            Plant: w.plant_name ?? w.plant_id ?? "",
          }))
        : [{ "Warehouse Name": "", Type: "", Plant: "" }];
    const masterSheet = XLSX.utils.json_to_sheet(masterRows, { header: masterHeaders });
    masterSheet["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, masterSheet, "Master Warehouse");

    XLSX.writeFile(workbook, `stock-opname-template-${tab}.xlsx`);
    message.success("Template downloaded");
  }

  // Auto-fills Part Number / Part Name from the Uniq for each row, resolving
  // any codes not already cached via the uniq options endpoint.
  async function enrichBulkRows(rows: BulkRow[]): Promise<BulkRow[]> {
    const details = new Map<string, StockOpnameUniqOption>();
    if (apiEnabled) {
      const uniqueCodes = Array.from(new Set(rows.map((row) => row.uniq).filter(Boolean)));
      await Promise.all(
        uniqueCodes.map(async (code) => {
          const cached = uniqLookup.get(code);
          if (cached) {
            details.set(code, cached);
            return;
          }
          try {
            const results = await getUniqOptions({ type: inventoryType, q: code, limit: 5 }).unwrap();
            const match = results.find((item) => item.uniq_code === code) ?? results[0];
            if (match) details.set(code, match);
          } catch {
            // Leave autofill empty if the code cannot be resolved.
          }
        })
      );
    }
    return rows.map((row) => {
      const detail = details.get(row.uniq);
      return {
        ...row,
        partNumber: detail?.part_number || row.partNumber || "",
        partName: detail?.part_name || row.partName || "",
        userCounted: row.userCounted || currentUserName,
      };
    });
  }

  const bulkUploadProps: UploadProps = {
    multiple: false,
    beforeUpload: (file) => {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      if (!isExcel) {
        message.error("File harus berformat .xlsx atau .xls");
        return Upload.LIST_IGNORE;
      }
      setBulkFileName(file.name);
      setBulkRows([]);
      readExcelFile(file)
        .then(async (rows) => {
          if (rows.length === 0) {
            message.warning("Tidak ada baris valid. Pastikan kolom Uniq terisi.");
            return;
          }
          // Part Number / Part Name auto-fill from the Uniq; User Counted falls
          // back to the logged-in user when the sheet omits it.
          const enriched = await enrichBulkRows(rows);
          setBulkRows(enriched);
          message.success(`${enriched.length} baris dimuat dari ${file.name}`);
        })
        .catch(() => message.error("Gagal membaca file Excel"));
      return false;
    },
    onRemove: () => {
      setBulkFileName(null);
      setBulkRows([]);
    },
  };

  function setEntry(id: string, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function addEntry() {
    setEntries((prev) => [...prev, { id: toId("entry"), systemStock: 0 }]);
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    message.success("Entry removed");
  }

  function validateManual() {
    for (const e of entries) {
      if (!e.uniq) return "Uniq is required";
      if (typeof e.countedQty !== "number") return "Counted Quantity is required";
      if (!e.userCounter) return "User Counter is required";
    }
    return null;
  }

  async function onSave() {
    if (!period) {
      message.warning("Period is required");
      return;
    }
    if (!scheduleDate) {
      message.warning("Schedule Date is required");
      return;
    }
    if (!countedDate) {
      message.warning("Counted Date is required");
      return;
    }

    if (method === "manual") {
      const err = validateManual();
      if (err) {
        message.warning(err);
        return;
      }
    }

    if (method === "bulk") {
      if (!bulkFileName) {
        message.warning("Upload Excel file first");
        return;
      }
      if (bulkRows.length === 0) {
        message.warning("No data to review");
        return;
      }
    }

    if (!apiEnabled) {
      message.success("Stock Opname saved (mock)");
      router.push(`/stock-opname?tab=${tab}`);
      return;
    }

    try {
      const items =
        method === "manual"
          ? entries.map((entry) => ({
            uniq_code: entry.uniq ?? "",
            counted_qty: entry.countedQty ?? 0,
            user_counter: entry.userCounter ?? "",
            weight_kg: entry.weightKg ?? uniqLookup.get(entry.uniq ?? "")?.weight_kg ?? null,
          }))
          : bulkRows.map((row) => ({
            uniq_code: row.uniq,
            counted_qty: row.countedQty,
            user_counter: row.userCounted || "",
            weight_kg: null,
          }));

      await createStockOpnameSession({
        inventory_type: inventoryType,
        method,
        period_month: period.month() + 1,
        period_year: period.year(),
        schedule_date: scheduleDate.format("YYYY-MM-DD"),
        counted_date: countedDate.format("YYYY-MM-DD"),
        remarks: "",
        items,
        warehouse_location:
          method === "bulk"
            ? bulkRows.find((row) => row.warehouseLocation)?.warehouseLocation ?? warehouseLocation ?? null
            : warehouseLocation ?? null,
      }).unwrap();

      message.success("Stock Opname saved successfully");
      router.push(`/stock-opname?tab=${tab}`);
    } catch {
      message.error("Failed to save stock opname");
    }
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          onClick={() => router.push(`/stock-opname?tab=${tab}`)}
        >
          <ArrowLeftOutlined />
          {backLabel}
        </button>

        <div className="flex items-center gap-2">
          <Button className="!rounded-lg" onClick={() => router.push(`/stock-opname?tab=${tab}`)}>
            Cancel
          </Button>
          <Button type="primary" className="!rounded-lg" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
            Save Stock Opname
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="mb-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Stock Opname</h1>
            <div className="text-sm text-gray-500">
              Initialize new stock opname session for physical inventory counting
              <span className="mx-2">•</span>
              <span className="text-gray-400">{entryCountLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <Form form={form} layout="vertical" requiredMark={false}>
        {/* Step 1 */}
        <Card
          className="!rounded-xl !border-gray-100 !shadow-sm"
          title={
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Step 1: Select Method & Period</div>
                <div className="text-xs text-gray-500">Choose Period to start Stock Opname</div>
              </div>
              <Tag color="blue" className="!rounded-full !text-xs !px-3 !py-0.5">
                Required
              </Tag>
            </div>
          }
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <Radio.Group value={method} onChange={(e) => setMethod(e.target.value)}>
              <Radio value="manual">Manual Input</Radio>
              <Radio value="bulk">Bulk Upload</Radio>
            </Radio.Group>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Period:</div>
                <DatePicker
                  picker="month"
                  format="MM/YYYY"
                  value={period}
                  onChange={(v) => setPeriod(v ?? dayjs())}
                  className="min-w-[160px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Schedule:</div>
                <DatePicker
                  format="YYYY-MM-DD"
                  value={scheduleDate}
                  onChange={(v) => setScheduleDate(v ?? dayjs())}
                  className="min-w-[160px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Counted:</div>
                <DatePicker
                  format="YYYY-MM-DD"
                  value={countedDate}
                  onChange={(v) => setCountedDate(v ?? dayjs())}
                  className="min-w-[160px]"
                />
              </div>
            </div>
          </div>

          {method === "bulk" && (
            <div className="mt-4">
              <Alert
                type="info"
                showIcon
                message="Bulk Upload selected"
                description="Upload a template file to create stock opname entries in bulk."
              />
            </div>
          )}
        </Card>

        <div className="h-4" />

        {/* Step 2 */}
        <Card
          className="!rounded-xl !border-gray-100 !shadow-sm"
          title={
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Step 2: Input Data</div>
                <div className="text-xs text-gray-500">
                  {method === "manual" ? "Manual Input selected. You've chosen to enter data manually." : "Bulk Upload selected."}
                </div>
              </div>
              {method === "manual" ? (
                <Tag className="!rounded-full !text-xs !px-3 !py-0.5">Entry 1</Tag>
              ) : (
                <Button
                  type="primary"
                  className="!rounded-lg"
                  icon={<PlusOutlined />}
                  onClick={handleDownloadTemplate}
                >
                  Download Template
                </Button>
              )}
            </div>
          }
        >
          {method === "manual" && (
            <div className="flex items-center justify-end mb-3">
              <Button className="!rounded-lg" icon={<FileAddOutlined />} onClick={addEntry}>
                Add Entry
              </Button>
            </div>
          )}

          {method === "manual" && (
            <div className="flex flex-col gap-4">
              {entries.map((e, idx) => {
                const diff = difference(e.systemStock, e.countedQty);
                const diffText = `${diff > 0 ? "+" : ""}${diff}`;
                return (
                  <div key={e.id} className="rounded-xl border border-gray-100 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-gray-500">Entry {idx + 1}</div>
                      {entries.length > 1 && (
                        <Button
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          onClick={() => removeEntry(e.id)}
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

                      {/* Uniq */}
                      <div className="xl:col-span-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-2">
                          Uniq
                          <InfoCircleOutlined className="text-blue-500" />
                        </label>

                        <Select
                          placeholder="Select Uniq"
                          className="!w-full"
                          value={e.uniq}
                          options={uniqOptions}
                          showSearch
                          filterOption={false}
                          loading={uniqLoading}
                          onSearch={(value) => {
                            if (!apiEnabled) return;

                            if (uniqSearchTimeoutRef.current) {
                              clearTimeout(uniqSearchTimeoutRef.current);
                            }

                            const normalizedValue = value.trim();

                            if (normalizedValue.length > 0 && normalizedValue.length < 2) {
                              return;
                            }

                            uniqSearchTimeoutRef.current = setTimeout(() => {
                              void getUniqOptions({
                                type: inventoryType,
                                q: normalizedValue,
                                limit: 10,
                              });
                            }, 300);
                          }}
                          onChange={(v) => {
                            if (apiEnabled) {
                              const selected = uniqLookup.get(v);

                              setEntry(e.id, {
                                uniq: v,
                                partNumber: selected?.part_number,
                                partName: selected?.part_name,
                                systemStock: selected?.system_qty ?? 0,
                                uom: selected?.uom,
                                weightKg: selected?.weight_kg ?? null,
                                rawMaterialType: selected?.raw_material_type ?? "",
                              });

                              return;
                            }

                            setEntry(e.id, {
                              uniq: v,
                              systemStock: systemStockByUniq[v] ?? 0,
                            });
                          }}
                        />
                      </div>

                      {/* System Stock */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Counted Quantity</div>
                        <InputNumber
                          className="!w-full"
                          value={e.countedQty}
                          min={0}
                          onChange={(v) =>
                            setEntry(e.id, {
                              countedQty: typeof v === "number" ? v : undefined,
                            })
                          }
                        />
                      </div>

                      {/* User */}
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-2">
                          User Counter
                          <InfoCircleOutlined className="text-blue-500" />
                        </label>

                        <Input
                          size="large"
                          readOnly
                          value={e.userCounter ?? currentUserName}
                          placeholder="Auto-filled from your account"
                          title="Auto-filled from the logged-in user"
                          className="!rounded-lg bg-gray-50 !w-full"
                        />
                      </div>

                      {/* UOM */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-2 block">
                          Unit of Measurement
                        </label>

                        <Input
                          size="large"
                          readOnly
                          className="bg-gray-50"
                          value={e.uom}
                        />
                      </div>

                      {/* WAREHOUSE */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-2 block">
                          Warehouse Location
                        </label>

                        <Select
                          size="large"
                          className="w-full"
                          placeholder="Select Warehouse"
                          value={warehouseLocation}
                          options={warehouseOptions}
                          showSearch
                          optionFilterProp="label"
                          onChange={setWarehouseLocation}
                        />
                      </div>

                      {isWireType(e.rawMaterialType) && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs text-gray-500">Weight (Kg)</div>
                            <InfoCircleOutlined className="text-blue-600" />
                          </div>
                          <InputNumber
                            className="w-full"
                            value={e.weightKg ?? undefined}
                            min={0}
                            step={0.0001}
                            placeholder="Enter weight in kg"
                            onChange={(v) =>
                              setEntry(e.id, { weightKg: typeof v === "number" ? v : null })
                            }
                          />
                        </div>
                      )}
                    </div>

                    {/* <div className="mt-3">
                      <Alert
                        type="error"
                        showIcon={false}
                        message={
                          <div className="text-sm text-red-600">
                            <span className="font-semibold">Difference:</span> {diffText}{" "}
                            <span className="italic text-red-500">(Auto Calculated. Current System Stock - Counted Quantity)</span>
                          </div>
                        }
                      />
                    </div> */}
                  </div>
                );
              })}
            </div>
          )
          }

          {method === "bulk" && (
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-3">
                Bulk Upload. You&apos;ve chosen to upload data directly from excel sheets.
              </div>

              <Upload.Dragger
                {...bulkUploadProps}
                className="!rounded-xl"
                accept=".xlsx,.xls"
                showUploadList={{ showRemoveIcon: true }}
              >
                <div className="py-6">
                  <InboxOutlined className="text-3xl text-slate-400" />
                  <div className="mt-2 text-sm font-semibold text-slate-700">Upload Excel File</div>
                  <div className="text-xs text-slate-500">Drag and drop your Excel file here, or click to browse</div>
                  <div className="mt-3">
                    <Button type="primary" className="!rounded-lg" icon={<UploadOutlined />}>
                      Choose File
                    </Button>
                  </div>
                  {bulkFileName && (
                    <div className="mt-2 text-xs text-slate-500">Selected: {bulkFileName}</div>
                  )}
                </div>
              </Upload.Dragger>
            </div>
          )}
        </Card>

        {method === "bulk" && (
          <>
            <div className="h-4" />
            <Card
              className="!rounded-xl !border-gray-100 !shadow-sm"
              title={
                <div>
                  <div className="text-sm font-semibold text-gray-900">Step 3: Review Uploaded Data</div>
                  <div className="text-xs text-gray-500">
                    Please validate the data from your Excel upload before proceeding. Ensure all entries are correct and complete.
                  </div>
                </div>
              }
            >
              <Alert
                type="info"
                showIcon={false}
                message={
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold">Note:</span> You can edit stock quantity for each item.
                  </div>
                }
                className="!rounded-xl"
              />

              <div className="mt-3 overflow-hidden rounded-xl border border-gray-100">
                <Table<BulkRow>
                  dataSource={bulkRows}
                  rowKey="key"
                  pagination={false}
                  size="middle"
                  columns={[
                    { title: "Uniq", dataIndex: "uniq", key: "uniq", width: 110 },
                    { title: "Part Number", dataIndex: "partNumber", key: "partNumber", width: 160 },
                    { title: "Part Name", dataIndex: "partName", key: "partName" },
                    {
                      title: "Model",
                      dataIndex: "model",
                      key: "model",
                      render: (v: string) => <span className="text-sm text-slate-500">{v}</span>,
                    },
                    {
                      title: "Counted Qty",
                      dataIndex: "countedQty",
                      key: "countedQty",
                      width: 140,
                      render: (_: number, r: BulkRow) => (
                        <InputNumber
                          className="w-full"
                          value={r.countedQty}
                          min={0}
                          onChange={(v) => {
                            const next = typeof v === "number" ? v : 0;
                            setBulkRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, countedQty: next } : x)));
                          }}
                        />
                      ),
                    },
                    { title: "User Counted", dataIndex: "userCounted", key: "userCounted", width: 140 },
                    {
                      title: "Warehouse Location",
                      dataIndex: "warehouseLocation",
                      key: "warehouseLocation",
                      width: 200,
                      render: (_: string, r: BulkRow) => (
                        <Select
                          className="w-full"
                          placeholder="Select Warehouse"
                          value={r.warehouseLocation || undefined}
                          options={warehouseOptions}
                          showSearch
                          optionFilterProp="label"
                          onChange={(next) => {
                            setBulkRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, warehouseLocation: next } : x)));
                          }}
                        />
                      ),
                    },
                  ]}
                  locale={{ emptyText: bulkFileName ? "No rows loaded" : "Upload an Excel file to preview rows" }}
                />
              </div>
            </Card>
          </>
        )}
      </Form>
    </div>
  );
}
