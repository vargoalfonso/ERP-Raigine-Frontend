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
  useCreateStockOpnameSessionMutation,
  useLazyGetStockOpnameUniqOptionsQuery,
} from "@/lib/api/stock-opname/api";
import { useGetEmployeesQuery } from "@/lib/api/system-settings/api";

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
};

const TAB_TO_INVENTORY_TYPE: Record<string, StockInventoryType> = {
  finished: "FG",
  raw: "RM",
  indirect: "IDR",
  wip: "WIP",
};

type BulkRow = {
  key: string;
  uniq: string;
  partNumber: string;
  partName: string;
  model: string;
  countedQty: number;
  userCounted: string;
  deliveryCycle: string;
};

function difference(systemStock: number, countedQty?: number) {
  const counted = typeof countedQty === "number" ? countedQty : 0;
  return counted - systemStock;
}

function toId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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

  const uniqOptions = useMemo(
    () =>
      apiEnabled
        ? uniqSearchResults.map((item) => ({
            label: `${item.uniq_code} — ${item.part_name} (${item.system_qty} ${item.uom})`,
            value: item.uniq_code,
          }))
        : fallbackUniqOptions,
    [apiEnabled, fallbackUniqOptions, uniqSearchResults]
  );

  const uniqLookup = useMemo(
    () => new Map(uniqSearchResults.map((item) => [item.uniq_code, item])),
    [uniqSearchResults]
  );

  const [entries, setEntries] = useState<Entry[]>(() =>
    apiEnabled
      ? [{ id: toId("entry"), systemStock: 0 }]
      : [{ id: toId("entry"), uniq: "FG-001", systemStock: 250, countedQty: 245, userCounter: "John Meijer" }]
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

  function mockLoadBulkRows() {
    setBulkRows([
      {
        key: "b1",
        uniq: "FG-001",
        partNumber: "SP-001-A",
        partName: "Steel Plate",
        model: "Camry 2024",
        countedQty: 250,
        userCounted: "WO-2024-001",
        deliveryCycle: "XXX",
      },
      {
        key: "b2",
        uniq: "FG-001",
        partNumber: "SP-001-A",
        partName: "Steel Plate",
        model: "Camry 2024",
        countedQty: 250,
        userCounted: "WO-2024-001",
        deliveryCycle: "XXX",
      },
      {
        key: "b3",
        uniq: "FG-001",
        partNumber: "SP-001-A",
        partName: "Steel Plate",
        model: "Camry 2024",
        countedQty: 250,
        userCounted: "WO-2024-001",
        deliveryCycle: "XXX",
      },
    ]);
  }

  const bulkUploadProps: UploadProps = {
    multiple: false,
    beforeUpload: (file) => {
      setBulkFileName(file.name);
      mockLoadBulkRows();
      message.success("Excel uploaded (mock)");
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
                  onClick={() => message.info("Download Template (mock)")}
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

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                      <div className="lg:col-span-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-xs text-gray-500">Uniq</div>
                          <InfoCircleOutlined className="text-blue-600" />
                        </div>
                        <Select
                          placeholder="Select Uniq"
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
                              void getUniqOptions({ type: inventoryType, q: normalizedValue, limit: 10 });
                            }, 300);
                          }}
                          onChange={(v) => {
                            if (apiEnabled) {
                              const selected = uniqLookup.get(v);
                              setEntry(e.id, {
                                uniq: v,
                                partNumber: selected?.part_number ?? undefined,
                                partName: selected?.part_name ?? undefined,
                                systemStock: selected?.system_qty ?? 0,
                                uom: selected?.uom ?? undefined,
                                weightKg: selected?.weight_kg ?? null,
                              });
                              return;
                            }

                            const sys = systemStockByUniq[v] ?? 0;
                            setEntry(e.id, { uniq: v, systemStock: sys });
                          }}
                        />
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-1">Current System Stock</div>
                        <InputNumber
                          className="w-full"
                          value={e.systemStock}
                          readOnly
                          controls={false}
                        />
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-1">Counted Quantity</div>
                        <InputNumber
                          className="w-full"
                          value={e.countedQty}
                          min={0}
                          onChange={(v) => setEntry(e.id, { countedQty: typeof v === "number" ? v : undefined })}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-xs text-gray-500">User Counter</div>
                          <InfoCircleOutlined className="text-blue-600" />
                        </div>
                        <Select
                          placeholder="Select Counter"
                          value={e.userCounter}
                          options={liveUserCounterOptions.length ? liveUserCounterOptions : [
                            { label: "John Meijer", value: "John Meijer" },
                            { label: "Sarah Tan", value: "Sarah Tan" },
                            { label: "Mike Johnson", value: "Mike Johnson" },
                          ]}
                          onChange={(v) => setEntry(e.id, { userCounter: v })}
                        />
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-1">Unit of Measurement</div>
                        <Input placeholder="-" value={e.uom} readOnly />
                      </div>
                    </div>

                    <div className="mt-3">
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
                    { title: "Delivery Cycle", dataIndex: "deliveryCycle", key: "deliveryCycle", width: 130 },
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
