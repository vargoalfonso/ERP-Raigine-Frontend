"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, InputNumber, Select, Tag, message } from "antd";
import {
  InfoCircleOutlined,
  LeftOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";

type Entry = {
  id: string;
  uniq?: string;
  calculationType?: string;
  constanta?: number;
  created: boolean;
};

const TYPE_OPTIONS = [
  {
    label: "Stockdays - PRL = Stock / (PRL/Working days)",
    value: "Stockdays - PRL = Stock / (PRL/Working days)",
  },
  {
    label: "Stockdays - DailyUsage = Stock / Daily Usage (Data history)",
    value: "Stockdays - DailyUsage = Stock / Daily Usage (Data history)",
  },
];

const UNIQ_OPTIONS = TYPE_OPTIONS;

const CALCULATION_OPTIONS = [
  {
    label: "Type | (PRL / Working Days * Parameter)",
    value: "Type | (PRL / Working Days * Parameter)",
  },
];

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    uniq: undefined,
    calculationType: CALCULATION_OPTIONS[0]?.value,
    constanta: undefined,
    created: false,
  };
}

export default function StockdaysCreatePage() {
  const router = useRouter();

  const [type, setType] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<Entry[]>([makeEntry(1)]);

  const completeCount = useMemo(() => entries.filter((e) => e.created).length, [entries]);

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const validateEntry = (e: Entry) => {
    if (!e.uniq) return "Uniq is required";
    if (!e.calculationType) return "Calculation Type is required";
    if (e.constanta === undefined || e.constanta === null) return "Constanta is required";
    return null;
  };

  const onCreateStockDays = (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    const err = validateEntry(entry);
    if (err) {
      message.error(err);
      return;
    }

    updateEntry(id, { created: true });
    message.success("Entry saved");
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, makeEntry(prev.length + 1)]);
  };

  const onSave = () => {
    if (!type) {
      message.error("Type is required");
      return;
    }

    for (const e of entries) {
      const err = validateEntry(e);
      if (err) {
        message.error(`Entry ${entries.indexOf(e) + 1}: ${err}`);
        return;
      }
    }

    message.success("Stockdays parameter saved");
    router.push("/system-settings");
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
            <div className="text-xl font-semibold text-gray-900">
              Add Parameter for Stockdays Option
            </div>
            <div className="text-sm text-gray-500">
              Create Stockdays <span className="mx-2">•</span> {entries.length} entry
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-gray-900">Step 1: Select Type</div>
                <div className="text-sm text-gray-500">Select Type before create Stockdays</div>
              </div>
              <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Required
              </Tag>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="w-20 text-sm text-gray-700">Type</div>
              <div className="w-[280px]">
                <Select
                  value={type}
                  onChange={setType}
                  placeholder="Select Type"
                  options={TYPE_OPTIONS}
                />
              </div>
              <InfoCircleOutlined className="text-blue-600" />
            </div>
          </Card>

          <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-gray-900">Step 2: Input Data</div>
                <div className="text-sm text-gray-500">Input Data for each Items</div>
              </div>
              <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Entry 1
              </Tag>
            </div>

            <div className="mt-5 space-y-4">
              {entries.map((e, idx) => (
                <div key={e.id}>
                  {idx > 0 && (
                    <div className="flex items-center justify-end mb-2">
                      <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        Entry {idx + 1}
                      </Tag>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                    <div className="lg:col-span-3">
                      <div className="text-sm text-gray-700 mb-2">Uniq</div>
                      <Select
                        value={e.uniq}
                        onChange={(v) => updateEntry(e.id, { uniq: v, created: false })}
                        placeholder="Select Uniq"
                        options={UNIQ_OPTIONS}
                      />
                    </div>

                    <div className="lg:col-span-4">
                      <div className="text-sm text-gray-700 mb-2">Calculation Type</div>
                      <Select
                        value={e.calculationType}
                        onChange={(v) => updateEntry(e.id, { calculationType: v, created: false })}
                        options={CALCULATION_OPTIONS}
                      />
                    </div>

                    <div className="lg:col-span-3">
                      <div className="text-sm text-gray-700 mb-2">Constanta</div>
                      <InputNumber
                        className="w-full"
                        value={e.constanta}
                        onChange={(v) => updateEntry(e.id, { constanta: v ?? undefined, created: false })}
                        placeholder="Input Constanta"
                        min={0}
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <Button
                        type="primary"
                        className="w-full"
                        icon={<PlusOutlined />}
                        onClick={() => onCreateStockDays(e.id)}
                      >
                        Create Stock days
                      </Button>
                    </div>
                  </div>

                  {idx < entries.length - 1 && <div className="mt-6 border-t border-gray-200" />}
                </div>
              ))}
            </div>
          </Card>

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
