"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

type Entry = {
  id: string;
  period?: string;
  workingDays?: number;
  created: boolean;
};

const PERIOD_OPTIONS = [
  { label: "January 2024", value: "January 2024" },
  { label: "February 2024", value: "February 2024" },
  { label: "March 2024", value: "March 2024" },
  { label: "April 2024", value: "April 2024" },
  { label: "May 2024", value: "May 2024" },
  { label: "June 2024", value: "June 2024" },
  { label: "July 2024", value: "July 2024" },
  { label: "August 2024", value: "August 2024" },
  { label: "September 2024", value: "September 2024" },
  { label: "October 2024", value: "October 2024" },
  { label: "November 2024", value: "November 2024" },
  { label: "December 2024", value: "December 2024" },
] as const;

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    period: idx === 1 ? "January 2024" : undefined,
    workingDays: idx === 1 ? 22 : undefined,
    created: false,
  };
}

export default function GlobalWorkingDaysCreatePage() {
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
    if (!e.period) return "Period is required";
    if (e.workingDays === undefined || e.workingDays === null) return "Working Days is required";
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

    message.success("Working days saved");
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
            <div className="text-xl font-semibold text-gray-900">Add Global - Working Days</div>
            <div className="text-sm text-gray-500">
              Create working days per month <span className="mx-2">•</span> {entries.length} entry
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
                  <div className="text-sm text-gray-500">Configure Parameter for working days per month</div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  Entry {idx + 1}
                </Tag>
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Period</div>
                  <Select
                    value={e.period}
                    onChange={(v) => updateEntry(e.id, { period: v, created: false })}
                    placeholder="Select period"
                    options={PERIOD_OPTIONS as unknown as { label: string; value: string }[]}
                    className="w-full"
                    showSearch
                    optionFilterProp="label"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Working Days</div>
                  <InputNumber
                    value={e.workingDays}
                    onChange={(v) => updateEntry(e.id, { workingDays: v ?? undefined, created: false })}
                    className="w-full"
                    min={0}
                    placeholder="22"
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
