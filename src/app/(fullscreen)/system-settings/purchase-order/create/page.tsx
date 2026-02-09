"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { useCreatePoSplitMutation } from "@/lib/api/system-settings/api";
import { getApiErrorMessage } from "@/lib/api/error";

type StatusType = "Active" | "Inactive";

type Entry = {
  id: string;
  materialType?: string;
  minOrderQty?: number;
  maxSplitLines?: number;
  splitRule?: string;
  status?: StatusType;
  created: boolean;
};

const MATERIAL_TYPE_OPTIONS = [
  { label: "Raw Material", value: "Raw Material" },
  { label: "Indirect Raw Material", value: "Indirect Raw Material" },
  { label: "Finished Goods", value: "Finished Goods" },
  { label: "Work In Process", value: "Work In Process" },
  { label: "SubCon", value: "SubCon" },
] as const;

const SPLIT_RULE_OPTIONS = [
  { label: "By Supplier Capacity", value: "By Supplier Capacity" },
  { label: "Equal Split", value: "Equal Split" },
  { label: "Manual", value: "Manual" },
] as const;

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
] as const;

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    materialType: idx === 1 ? "Raw Material" : undefined,
    minOrderQty: idx === 1 ? 1000 : undefined,
    maxSplitLines: idx === 1 ? 3 : undefined,
    splitRule: idx === 1 ? "By Supplier Capacity" : undefined,
    status: idx === 1 ? "Active" : undefined,
    created: false,
  };
}

export default function PurchaseOrderCreatePage() {
  const router = useRouter();

  const apiEnabled = Boolean(apiBaseUrl);
  const [createPoSplit, { isLoading: isSaving }] = useCreatePoSplitMutation();

  const [entries, setEntries] = useState<Entry[]>([makeEntry(1)]);

  const completeCount = useMemo(
    () => entries.filter((e) => e.created).length,
    [entries]
  );

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const validateEntry = (e: Entry) => {
    if (!e.materialType) return "Material Type is required";
    if (e.minOrderQty === undefined || e.minOrderQty === null) return "Min Order Qty is required";
    if (e.maxSplitLines === undefined || e.maxSplitLines === null) return "Max Split Lines is required";
    if (!e.splitRule) return "Split Rule is required";
    if (!e.status) return "Status is required";
    return null;
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, makeEntry(prev.length + 1)]);
  };

  const onSave = async () => {
    for (const e of entries) {
      const err = validateEntry(e);
      if (err) {
        message.error(`Entry ${entries.indexOf(e) + 1}: ${err}`);
        return;
      }
    }

    if (!apiEnabled) {
      message.success("PO split setting saved");
      router.push("/system-settings");
      return;
    }

    try {
      for (const e of entries) {
        await createPoSplit({
          material_type: e.materialType!,
          min_order_qty: e.minOrderQty!,
          max_split_lines: e.maxSplitLines!,
          split_rule: e.splitRule!,
        }).unwrap();
        updateEntry(e.id, { created: true });
      }

      message.success("PO split setting saved");
      router.push("/system-settings");
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Failed to save PO split settings"));
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              onClick={() => router.push("/system-settings")}
            >
              <LeftOutlined />
              <span>Back to System Parameters</span>
            </button>

            <div className="flex items-center gap-2">
              <Button onClick={() => router.push("/system-settings")}>Cancel</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={isSaving}>
                Save Parameter
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">Add PO - Split Settings</div>
            <div className="text-sm text-gray-500">
              Create Split Settings <span className="mx-2">•</span> {entries.length} entry
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {entries.map((e, idx) => (
            <Card key={e.id} className="rounded-2xl" bodyStyle={{ padding: 24 }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-gray-900">
                    Add New Parameter #{idx + 1}
                  </div>
                  <div className="text-sm text-gray-500">
                    Configure Parameter for Purchase Order Split Settings
                  </div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  Entry {idx + 1}
                </Tag>
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Material Type</div>
                  <Select
                    value={e.materialType}
                    onChange={(v) => updateEntry(e.id, { materialType: v, created: false })}
                    placeholder="Select Material Type"
                    options={MATERIAL_TYPE_OPTIONS as unknown as { label: string; value: string }[]}
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Min Order Qty</div>
                  <InputNumber
                    className="w-full"
                    value={e.minOrderQty}
                    onChange={(v) => updateEntry(e.id, { minOrderQty: v ?? undefined, created: false })}
                    placeholder="1000"
                    min={0}
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Max Split Lines</div>
                  <InputNumber
                    className="w-full"
                    value={e.maxSplitLines}
                    onChange={(v) =>
                      updateEntry(e.id, { maxSplitLines: v ?? undefined, created: false })
                    }
                    placeholder="3"
                    min={1}
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Split Rule</div>
                  <Select
                    value={e.splitRule}
                    onChange={(v) => updateEntry(e.id, { splitRule: v, created: false })}
                    placeholder="Select Split Rule"
                    options={SPLIT_RULE_OPTIONS as unknown as { label: string; value: string }[]}
                  />
                </div>

                <div className="lg:col-span-2">
                  <div className="text-sm text-gray-700 mb-2">Status</div>
                  <Select
                    value={e.status}
                    onChange={(v) => updateEntry(e.id, { status: v as StatusType, created: false })}
                    placeholder="Select Status"
                    options={STATUS_OPTIONS as unknown as { label: string; value: string }[]}
                  />
                </div>
              </div>
            </Card>
          ))}

          <div className="flex items-center justify-center">
            <Button icon={<PlusOutlined />} onClick={addAnother}>
              Add Another Parameter
            </Button>
          </div>

          <Card className="rounded-2xl" bodyStyle={{ padding: 18 }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-gray-900">Summary</div>
                <div className="text-sm text-gray-500">
                  {entries.length} Parameter ready to be saved
                </div>
              </div>
              <div className="flex items-center gap-10">
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">{entries.length}</div>
                  <div className="text-xs text-gray-500">Entries</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">{completeCount}</div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
