"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Tag, Upload, message } from "antd";
import {
  ArrowLeftOutlined,
  FileExcelOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import {
  useBulkCreatePrlForecastsMutation,
  useUploadPrlExcelMutation,
} from "@/lib/api/prl/api";

type ForecastEntry = {
  id: string;
  customerId?: string;
  customer?: string;
  period?: string;
  uniq: string;
  productModel: string;
  partName: string;
  partNumber: string;
  quantity: string; // keep as string for input UX
};

function newEntry(seed?: Partial<ForecastEntry>): ForecastEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    customerId: seed?.customerId,
    customer: seed?.customer,
    period: seed?.period,
    uniq: seed?.uniq ?? "",
    productModel: seed?.productModel ?? "",
    partName: seed?.partName ?? "",
    partNumber: seed?.partNumber ?? "",
    quantity: seed?.quantity ?? "",
  };
}

function isComplete(entry: ForecastEntry): boolean {
  const quantityValue = Number(entry.quantity);
  const customerIdValue = Number(entry.customerId);
  return (
    Number.isFinite(customerIdValue) &&
    customerIdValue > 0 &&
    !!entry.customer &&
    !!entry.period &&
    entry.uniq.trim().length > 0 &&
    entry.productModel.trim().length > 0 &&
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
  const [bulkCreate, bulkCreateState] = useBulkCreatePrlForecastsMutation();
  const [uploadExcel, uploadExcelState] = useUploadPrlExcelMutation();
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data]
  );

  const uniqOptions = useMemo(
    () =>
      bomIndex.options.length
        ? bomIndex.options
        : [
            { label: "LV-001", value: "LV-001" },
            { label: "LV-002", value: "LV-002" },
            { label: "LV-003", value: "LV-003" },
          ],
    [bomIndex.options]
  );

  const periodOptions = useMemo(
    () => [
      { label: "2024-Q1", value: "2024-Q1" },
      { label: "2024-Q2", value: "2024-Q2" },
      { label: "2024-Q3", value: "2024-Q3" },
      { label: "2024-Q4", value: "2024-Q4" },
    ],
    []
  );

  const completeCount = useMemo(
    () => entries.filter((e) => isComplete(e)).length,
    [entries]
  );

  const updateEntry = (id: string, patch: Partial<ForecastEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const handleUniqChange = (id: string, uniq?: string) => {
    const nextUniq = String(uniq ?? "");
    const partName = bomIndex.partNameByUniq[nextUniq] ?? "";
    const partNumber = bomIndex.partNumberByUniq[nextUniq] ?? "";
    const productModel = bomIndex.assemblyCodeByUniq[nextUniq] ?? "";

    updateEntry(id, {
      uniq: nextUniq,
      productModel,
      partName,
      partNumber,
    });
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, newEntry()]);
  };

  const saveAll = async () => {
    if (completeCount !== entries.length) {
      message.error("Please complete all entries before saving");
      return;
    }

    if (!apiEnabled) {
      message.success(`Saved ${entries.length} forecast entries`);
      router.push("/prl-management");
      return;
    }

    try {
      await bulkCreate(
        entries.map((e) => ({
          customer_id: Number(e.customerId),
          item_uniq_code: e.uniq.trim(),
          quantity: Number(e.quantity),
          period: String(e.period),
          full_name: e.customer,
        }))
      ).unwrap();

      message.success(`Saved ${entries.length} forecast entries`);
      router.push("/prl-management");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save forecasts"));
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
      message.success(`Uploaded ${file.name}`);
      return false;
    }

    try {
      await uploadExcel(file).unwrap();
      message.success(`Uploaded ${file.name}`);
      router.push("/prl-management");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Excel upload failed"));
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
                {entryMode === "manual" ? "Add Multiple Forecasts" : "Bulk Forecast Operation"}
              </h1>
              <div className="text-sm text-gray-500">
                {entryMode === "manual" ? (
                  <>
                    Create multiple forecast entries in bulk <span className="mx-2">•</span> {entries.length} entr{entries.length > 1 ? "ies" : "y"}
                  </>
                ) : (
                  <>Upload Excel forecast file through <span className="mx-2">•</span> /api/prl/upload-excel</>
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
                loading={bulkCreateState.isLoading}
              >
                Save All Forecasts
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
                  <div className="text-sm font-semibold text-blue-800">Bulk Forecast Upload</div>
                  <div className="text-xs text-blue-700 mt-1">
                    Use Excel upload for bulk operation. File will be sent to `POST /api/prl/upload-excel`.
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="text-base font-semibold text-gray-900">Upload Excel File</div>
              <div className="text-sm text-gray-500 mt-1">
                Upload forecast data in one go using Excel template.
              </div>

              <div className="mt-4">
                <Upload.Dragger
                  name="file"
                  multiple={false}
                  showUploadList={false}
                  beforeUpload={(file) => handleUploadExcel(file as File)}
                  disabled={uploadExcelState.isLoading}
                >
                  <div className="py-8">
                    <UploadOutlined className="text-3xl text-gray-400 mb-3" />
                    <div className="text-sm font-semibold text-gray-900">Upload Excel File</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Drag and drop your Excel file here, or click to browse.
                    </div>
                    <Button
                      className="!rounded-lg mt-4"
                      type="primary"
                      loading={uploadExcelState.isLoading}
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
              <div className="text-sm font-semibold text-blue-800">Multiple Forecast Entry</div>
              <div className="text-xs text-blue-700 mt-1">
                Add multiple forecast entries in one go. Each entry will be saved as a separate forecast record.
                You can add more entries using the “Add Another Forecast Entry” button.
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
                  <div className="text-base font-semibold text-gray-900">Forecast Entry #{idx + 1}</div>
                  <div className="text-sm text-gray-500">Configure forecast details for production planning</div>
                </div>
                <Tag className="!rounded-lg !px-3 !py-1" color="default">
                  Entry {idx + 1}
                </Tag>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Customer ID</div>
                  <Input
                    value={entry.customerId ?? ""}
                    onChange={(e) => updateEntry(entry.id, { customerId: e.target.value.replace(/[^0-9]/g, "") })}
                    placeholder="Input customer ID (number)"
                    className="!rounded-lg"
                    inputMode="numeric"
                    allowClear
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Customer Name</div>
                  <Input
                    value={entry.customer ?? ""}
                    onChange={(e) => updateEntry(entry.id, { customer: e.target.value })}
                    placeholder="Input customer name"
                    className="!rounded-lg"
                    allowClear
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Forecast Period</div>
                  <Select
                    value={entry.period}
                    onChange={(v) => updateEntry(entry.id, { period: v })}
                    options={periodOptions}
                    placeholder="Select period"
                    className="w-full"
                    allowClear
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Uniq (Product Code)</div>
                  <Select
                    value={entry.uniq}
                    onChange={(value) => handleUniqChange(entry.id, value)}
                    options={uniqOptions}
                    placeholder="Select uniq from BOM"
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
                    placeholder="Auto-filled from uniq"
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
              Add Another Forecast Entry
            </Button>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Summary</div>
              <div className="text-xs text-gray-500 mt-1">
                {completeCount} forecast entr{completeCount === 1 ? "y" : "ies"} ready to be saved
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
