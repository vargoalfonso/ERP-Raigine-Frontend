"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

type StatusType = "Active" | "Inactive";

type Entry = {
  id: string;
  productName?: string;
  productCode?: string;
  kanbanQty?: number;
  minStock?: number;
  maxStock?: number;
  status?: StatusType;
  created: boolean;
};

const PRODUCT_MASTER = [
  { name: "Bracket Assembly", code: "FG-001" },
] as const;

const PRODUCT_NAME_OPTIONS = PRODUCT_MASTER.map((p) => ({
  label: p.name,
  value: p.name,
}));

const PRODUCT_CODE_OPTIONS = PRODUCT_MASTER.map((p) => ({
  label: p.code,
  value: p.code,
}));

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
] as const;

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    productName: idx === 1 ? "Bracket Assembly" : undefined,
    productCode: idx === 1 ? "FG-001" : undefined,
    kanbanQty: idx === 1 ? 50 : undefined,
    minStock: idx === 1 ? 100 : undefined,
    maxStock: idx === 1 ? 500 : undefined,
    status: idx === 1 ? "Active" : undefined,
    created: false,
  };
}

export default function KanbanFgStandardsCreatePage() {
  const router = useRouter();

  const [entries, setEntries] = useState<Entry[]>([makeEntry(1)]);

  const completeCount = useMemo(
    () => entries.filter((e) => e.created).length,
    [entries]
  );

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const validateEntry = (e: Entry) => {
    if (!e.productName) return "Product Name/Uniq is required";
    if (!e.productCode) return "Product/Uniq Code is required";
    if (e.kanbanQty === undefined || e.kanbanQty === null) return "Kanban Qty is required";
    if (e.minStock === undefined || e.minStock === null) return "Min Stock is required";
    if (e.maxStock === undefined || e.maxStock === null) return "Max Stock is required";
    if (!e.status) return "Status is required";
    return null;
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, makeEntry(prev.length + 1)]);
  };

  const onSave = () => {
    for (const e of entries) {
      const err = validateEntry(e);
      if (err) {
        message.error(`Entry ${entries.indexOf(e) + 1}: ${err}`);
        return;
      }
    }

    message.success("Kanban standard saved");
    router.push("/system-settings");
  };

  const onPickProductName = (entryId: string, productName: string) => {
    const found = PRODUCT_MASTER.find((p) => p.name === productName);
    updateEntry(entryId, {
      productName,
      productCode: found?.code,
      created: false,
    });
  };

  const onPickProductCode = (entryId: string, productCode: string) => {
    const found = PRODUCT_MASTER.find((p) => p.code === productCode);
    updateEntry(entryId, {
      productCode,
      productName: found?.name,
      created: false,
    });
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
              <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>
                Save Parameter
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">Add Kanban - FG Standards</div>
            <div className="text-sm text-gray-500">
              Create kanban standards for finished goods <span className="mx-2">•</span> {entries.length} entry
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
                  <div className="text-base font-semibold text-gray-900">Add New Parameter #{idx + 1}</div>
                  <div className="text-sm text-gray-500">
                    Configure Parameter for kanban standards for finished goods
                  </div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  Entry {idx + 1}
                </Tag>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Product Name/Uniq</div>
                    <Select
                      value={e.productName}
                      onChange={(v) => onPickProductName(e.id, v)}
                      placeholder="Select product"
                      options={PRODUCT_NAME_OPTIONS as unknown as { label: string; value: string }[]}
                      className="w-full"
                      showSearch
                      optionFilterProp="label"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-gray-700 mb-2">Product/Uniq Code</div>
                    <Select
                      value={e.productCode}
                      onChange={(v) => onPickProductCode(e.id, v)}
                      placeholder="Select code"
                      options={PRODUCT_CODE_OPTIONS as unknown as { label: string; value: string }[]}
                      className="w-full"
                      showSearch
                      optionFilterProp="label"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Kanban Qty</div>
                    <InputNumber
                      value={e.kanbanQty}
                      onChange={(v) => updateEntry(e.id, { kanbanQty: v ?? undefined, created: false })}
                      className="w-full"
                      min={0}
                      placeholder="50"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-gray-700 mb-2">Min Stock</div>
                    <InputNumber
                      value={e.minStock}
                      onChange={(v) => updateEntry(e.id, { minStock: v ?? undefined, created: false })}
                      className="w-full"
                      min={0}
                      placeholder="100"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-gray-700 mb-2">Max Stock</div>
                    <InputNumber
                      value={e.maxStock}
                      onChange={(v) => updateEntry(e.id, { maxStock: v ?? undefined, created: false })}
                      className="w-full"
                      min={0}
                      placeholder="500"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-gray-700 mb-2">Status</div>
                    <Select
                      value={e.status}
                      onChange={(v) => updateEntry(e.id, { status: v as StatusType, created: false })}
                      placeholder="Active"
                      options={STATUS_OPTIONS as unknown as { label: string; value: string }[]}
                      className="w-full"
                    />
                  </div>
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
                <div className="text-sm text-gray-500">{entries.length} Parameter ready to be saved</div>
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
