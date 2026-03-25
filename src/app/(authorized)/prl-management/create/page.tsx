"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Tag, message } from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";

type ForecastEntry = {
  id: string;
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
  return (
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

  const addAnother = () => {
    setEntries((prev) => [...prev, newEntry()]);
  };

  const saveAll = () => {
    if (completeCount !== entries.length) {
      message.error("Please complete all entries before saving");
      return;
    }
    message.success(`Saved ${entries.length} forecast entries`);
    router.push("/prl-management");
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
              <h1 className="text-2xl font-bold text-gray-900">Add Multiple Forecasts</h1>
              <div className="text-sm text-gray-500">
                Create multiple forecast entries in bulk <span className="mx-2">•</span> {entries.length} entry
+                {entries.length > 1 ? "ies" : ""}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button className="!rounded-lg" onClick={() => router.push("/prl-management")}>Cancel</Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<SaveOutlined />}
              onClick={saveAll}
            >
              Save All Forecasts
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
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
                  <Input
                    value={entry.uniq}
                    onChange={(e) => updateEntry(entry.id, { uniq: e.target.value })}
                    placeholder="e.g., LV7-001"
                    className="!rounded-lg"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Product Model</div>
                  <Input
                    value={entry.productModel}
                    onChange={(e) => updateEntry(entry.id, { productModel: e.target.value })}
                    placeholder="e.g., Camry 2024"
                    className="!rounded-lg"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Part Name</div>
                  <Input
                    value={entry.partName}
                    onChange={(e) => updateEntry(entry.id, { partName: e.target.value })}
                    placeholder="e.g., Engine Mount Bracket"
                    className="!rounded-lg"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Part Number</div>
                  <Input
                    value={entry.partNumber}
                    onChange={(e) => updateEntry(entry.id, { partNumber: e.target.value })}
                    placeholder="e.g., EM-001-LV7"
                    className="!rounded-lg"
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
      </div>
    </div>
  );
}
