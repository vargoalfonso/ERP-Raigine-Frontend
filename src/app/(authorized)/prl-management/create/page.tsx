"use client";

import React, { useMemo, useState } from "react";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Tag, Upload, message, DatePicker } from "antd";
import {
  ArrowLeftOutlined,
  FileExcelOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useListCustomersQuery } from "@/lib/api/customers/api";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { useGetGlobalWorkingDaysQuery } from "@/lib/api/system-settings/api";
import {
  useCreatePrlMutation,
  useImportPrlsMutation,
} from "@/lib/api/prl/api";

type ForecastEntry = {
  id: string;
  customerUuid?: string;
  customerName?: string;
  forecastPeriod?: string;
  uniqCode: string;
  productModel: string;
  partName: string;
  partNumber: string;
  quantity: string; // keep as string for input UX
  remarks?: string;
};

function newEntry(seed?: Partial<ForecastEntry>): ForecastEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    customerUuid: seed?.customerUuid,
    customerName: seed?.customerName,
    forecastPeriod: seed?.forecastPeriod,
    uniqCode: seed?.uniqCode ?? "",
    productModel: seed?.productModel ?? "",
    partName: seed?.partName ?? "",
    partNumber: seed?.partNumber ?? "",
    quantity: seed?.quantity ?? "",
    remarks: seed?.remarks ?? "",
  };
}

function isComplete(entry: ForecastEntry): boolean {
  const quantityValue = Number(entry.quantity);
  return (
    !!entry.customerUuid &&
    !!entry.forecastPeriod &&
    entry.uniqCode.trim().length > 0 &&
    entry.partName.trim().length > 0 &&
    entry.partNumber.trim().length > 0 &&
    Number.isFinite(quantityValue) &&
    quantityValue > 0
  );
}

export default function AddForecastPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ForecastEntry[]>([newEntry()]);
  const [entryMode, setEntryMode] = useState<"manual" | "bulk">("manual");

  const apiEnabled = Boolean(apiBaseUrl);
  const [createPrl, createPrlState] = useCreatePrlMutation();
  const [importPrls, importPrlsState] = useImportPrlsMutation();
  const { data: customers = [] } = useListCustomersQuery(undefined, { skip: !apiEnabled });
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: globalParameters = [] } = useGetGlobalWorkingDaysQuery(undefined, {
    skip: !apiEnabled,
  });

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data]
  );
  const topLevelUniqOptions = useMemo(() => {
    const nodes = Array.isArray(bomTreeRes?.data) ? bomTreeRes?.data : [];
    const opts: { label: string; value: string }[] = [];
    for (const n of nodes) {
      const uniq = typeof (n as any)?.uniq === "string" && (n as any).uniq.trim()
        ? (n as any).uniq.trim()
        : typeof (n as any)?.uniq_code === "string"
          ? (n as any).uniq_code.trim()
          : "";
      if (uniq) opts.push({ label: uniq, value: uniq });
    }
    if (opts.length) return opts;
    return [
      { label: "LV-001", value: "LV-001" },
      { label: "LV-002", value: "LV-002" },
      { label: "LV-003", value: "LV-003" },
    ];
  }, [bomTreeRes?.data]);

  const uniqOptions = topLevelUniqOptions;

  const customerOptions = useMemo(
    () =>
      customers
        .map((customer) => {
          const value = String(customer.id ?? customer.customer_id ?? "").trim();
          const label = String(customer.customer_name ?? "").trim();
          if (!value || !label) return null;
          return { label, value };
        })
        .filter((item): item is { label: string; value: string } => Boolean(item)),
    [customers]
  );

  const periodOptions = useMemo(() => {
    const activePlanningPeriods = globalParameters
      .filter((item) => String(item.status ?? "active").trim().toLowerCase() === "active")
      .filter((item) => {
        const group = String(item.parameter_group ?? "").trim().toLowerCase();
        return group === "planning";
      })
      .map((item) => String(item.period ?? "").trim())
      .filter(Boolean);

    const periods = (activePlanningPeriods.length ? activePlanningPeriods : globalParameters
      .filter((item) => String(item.status ?? "active").trim().toLowerCase() === "active")
      .map((item) => String(item.period ?? "").trim())
      .filter(Boolean))
      .filter((value, index, array) => array.indexOf(value) === index);

    if (periods.length > 0) {
      return periods.map((value) => ({ label: value, value }));
    }

    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1, currentYear + 2];
    return years.flatMap((year) =>
      [1, 2, 3, 4].map((quarter) => ({
        label: `${year}-Q${quarter}`,
        value: `${year}-Q${quarter}`,
      }))
    );
  }, [globalParameters]);

  const completeCount = useMemo(() => entries.filter((e) => isComplete(e)).length, [entries]);

  const updateEntry = (id: string, patch: Partial<ForecastEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const handleCustomerChange = (id: string, customerUuid?: string) => {
    const selected = customerOptions.find((customer) => customer.value === customerUuid);
    updateEntry(id, {
      customerUuid,
      customerName: selected?.label ?? "",
    });
  };

  const handleUniqChange = (id: string, uniqCode?: string) => {
    const nextUniq = String(uniqCode ?? "").trim();
    const partName = bomIndex.partNameByUniq[nextUniq] ?? "";
    const partNumber = bomIndex.partNumberByUniq[nextUniq] ?? "";
    const productModel = bomIndex.modelByUniq[nextUniq] ?? bomIndex.assemblyCodeByUniq[nextUniq] ?? "";

    updateEntry(id, {
      uniqCode: nextUniq,
      productModel,
      partName,
      partNumber,
    });
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, newEntry()]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => (prev.length > 1 ? prev.filter((entry) => entry.id !== id) : prev));
  };

  const saveAll = async () => {
    if (completeCount !== entries.length) {
      message.error("Please complete all PRL entries before saving");
      return;
    }

    if (!apiEnabled) {
      message.success(`Saved ${entries.length} PRL entr${entries.length > 1 ? "ies" : "y"}`);
      router.push("/prl-management");
      return;
    }

    try {
      await Promise.all(
        entries.map((entry) => {
          const payload: any = {
            customer_uuid: String(entry.customerUuid ?? "").trim(),
            uniq_code: entry.uniqCode.trim(),
            product_model: entry.productModel.trim(),
            part_name: entry.partName.trim(),
            part_number: entry.partNumber.trim(),
            forecast_period: String(entry.forecastPeriod ?? ""),
            quantity: Number(entry.quantity),
          };
          const r = String(entry.remarks ?? "").trim();
          if (r) payload.remarks = r;
          return createPrl(payload as any).unwrap();
        })
      );

      message.success(`Saved ${entries.length} PRL entr${entries.length > 1 ? "ies" : "y"}`);
      router.push("/prl-management");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save PRL data"));
    }
  };

  const handleUploadExcel = async (file: File) => {
    const isExcel =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.name.toLowerCase().endsWith(".xls");

    if (!isExcel) {
      message.error("Please upload an Excel file (.xlsx/.xls)");
      return Upload.LIST_IGNORE;
    }

    if (!apiEnabled) {
      message.success(`Imported ${file.name}`);
      return false;
    }

    try {
      await importPrls(file).unwrap();
      message.success(`Imported ${file.name}`);
      router.push("/prl-management");
    } catch (err) {
      message.error(getApiErrorMessage(err, "PRL import failed"));
    }

    return false;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/prl-management"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftOutlined />
              Back to PRL Management
            </Link>
            <div className="mt-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {entryMode === "manual" ? "Add PRL Forecast" : "Import PRL Forecast"}
              </h1>
              <div className="text-sm text-gray-500">
                {entryMode === "manual" ? (
                  <>
                    Create PRL forecasts using customer and BOM data <span className="mx-2">•</span> {entries.length} entr{entries.length > 1 ? "ies" : "y"}
                  </>
                ) : (
                  <>Upload Excel forecast file through <span className="mx-2">•</span> /import/prls</>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button className="!rounded-lg" onClick={() => router.push("/prl-management")}>Cancel</Button>
            {entryMode === "manual" ? (
              <Button
                type="primary"
                className="!rounded-lg"
                icon={<SaveOutlined />}
                onClick={saveAll}
                loading={createPrlState.isLoading}
              >
                Save PRL
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="inline-flex rounded-lg bg-gray-50 p-1 border border-gray-100">
            <button
              type="button"
              onClick={() => setEntryMode("manual")}
              className={
                "px-4 py-2 text-sm font-medium rounded-md transition-colors " +
                (entryMode === "manual"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-600 hover:text-gray-900")
              }
            >
              Manual Entry
            </button>
            <button
              type="button"
              onClick={() => setEntryMode("bulk")}
              className={
                "px-4 py-2 text-sm font-medium rounded-md transition-colors " +
                (entryMode === "bulk"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-600 hover:text-gray-900")
              }
            >
              Bulk Operation
            </button>
          </div>
        </div>

        {entryMode === "bulk" ? (
          <div className="space-y-6">
            <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
              <div className="flex items-start gap-3">
                <FileExcelOutlined className="mt-0.5 text-blue-700" />
                <div>
                  <div className="text-sm font-semibold text-blue-800">Bulk PRL Import</div>
                  <div className="text-xs text-blue-700 mt-1">
                    Use Excel upload for bulk operation. File will be sent to `POST /import/prls`.
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="text-base font-semibold text-gray-900">Upload Excel File</div>
              <div className="text-sm text-gray-500 mt-1">
                Upload PRL data in one go using the backend import endpoint.
              </div>

              <div className="mt-4">
                <Upload.Dragger
                  name="file"
                  multiple={false}
                  showUploadList={false}
                  beforeUpload={(file) => handleUploadExcel(file as File)}
                  disabled={importPrlsState.isLoading}
                >
                  <div className="py-8">
                    <UploadOutlined className="text-3xl text-gray-400 mb-3" />
                    <div className="text-sm font-semibold text-gray-900">Upload PRL Excel File</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Drag and drop your Excel file here, or click to browse.
                    </div>
                    <Button
                      className="!rounded-lg mt-4"
                      type="primary"
                      loading={importPrlsState.isLoading}
                    >
                      Choose File
                    </Button>
                  </div>
                </Upload.Dragger>
              </div>
            </div>
          </div>
        ) : (
          <>
        {/* Info card */}
        <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-blue-700">↗</div>
            <div>
              <div className="text-sm font-semibold text-blue-800">PRL Entry Rules</div>
              <div className="text-xs text-blue-700 mt-1">
                Customer comes from Master Customer, UNIQ comes from BOM, and part name, part number, plus product model are auto-filled from BOM data.
              </div>
            </div>
          </div>
        </div>

        {/* Entry cards */}
        <div className="space-y-6">
          {entries.map((entry, idx) => (
            <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="text-base font-semibold text-gray-900">PRL Entry #{idx + 1}</div>
                  <div className="text-sm text-gray-500">Configure forecast details for production planning</div>
                </div>
                <div className="flex items-center gap-2">
                  <Tag className="!rounded-lg !px-3 !py-1" color="default">
                    Entry {idx + 1}
                  </Tag>
                  {entries.length > 1 ? (
                    <Button danger className="!rounded-lg" onClick={() => removeEntry(entry.id)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Customer Name</div>
                  <Select
                    value={entry.customerUuid}
                    onChange={(value) => handleCustomerChange(entry.id, value)}
                    options={customerOptions}
                    placeholder="Select customer"
                    className="w-full"
                    showSearch
                    allowClear
                    filterOption={(input, option) =>
                      String(option?.label ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Forecast Period</div>
                  <DatePicker
                    picker="month"
                    value={entry.forecastPeriod ? dayjs(entry.forecastPeriod, "MMMM-YYYY") : undefined}
                    onChange={(date) => updateEntry(entry.id, { forecastPeriod: date ? dayjs(date).format("MMMM-YYYY") : "" })}
                    className="w-full"
                    format={(value) => (value ? dayjs(value).format("MMMM-YYYY") : "")}
                    allowClear
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">UNIQ Code</div>
                  <Select
                    value={entry.uniqCode}
                    onChange={(value) => handleUniqChange(entry.id, value)}
                    options={uniqOptions}
                    placeholder="Select UNIQ from BOM"
                    className="w-full"
                    showSearch
                    allowClear
                    filterOption={(input, option) =>
                      String(option?.label ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Product Model</div>
                  <Input
                    value={entry.productModel}
                    placeholder="Auto-filled from BOM model"
                    className="!rounded-lg"
                    readOnly
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Part Name</div>
                  <Input
                    value={entry.partName}
                    placeholder="Auto-filled from uniq"
                    className="!rounded-lg"
                    readOnly
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Part Number</div>
                  <Input
                    value={entry.partNumber}
                    placeholder="Auto-filled from uniq"
                    className="!rounded-lg"
                    readOnly
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Quantity</div>
                  <Input
                    value={entry.quantity}
                    onChange={(e) => updateEntry(entry.id, { quantity: e.target.value.replace(/[^0-9]/g, "") })}
                    placeholder="e.g., 2500"
                    className="!rounded-lg"
                    inputMode="numeric"
                  />
                </div>

                <div className="lg:col-span-2">
                  <div className="text-xs font-semibold text-gray-700 mb-1">Remarks (optional)</div>
                  <Input
                    value={entry.remarks}
                    onChange={(e) => updateEntry(entry.id, { remarks: e.target.value })}
                    placeholder="Optional remarks or note"
                    className="!rounded-lg"
                  />
                </div>

                <div className="flex items-end">
                  <div className="text-xs text-gray-500">
                    {isComplete(entry) ? (
                      <span className="text-green-700 font-semibold">Ready to save</span>
                    ) : (
                      <span>Fill all fields to mark complete</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-center">
            <Button className="!rounded-lg" icon={<PlusOutlined />} onClick={addAnother}>
              Add Another PRL Entry
            </Button>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Summary</div>
              <div className="text-xs text-gray-500 mt-1">
                {completeCount} PRL entr{completeCount === 1 ? "y" : "ies"} ready to be saved
              </div>
            </div>

            <div className="flex items-center gap-10">
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">{entries.length}</div>
                <div className="text-xs text-gray-500">Entries</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">{completeCount}</div>
                <div className="text-xs text-gray-500">Complete</div>
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
