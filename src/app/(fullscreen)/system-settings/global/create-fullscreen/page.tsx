"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Input, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useCreateGlobalWorkingDaysMutation } from "@/lib/api/system-settings/api";

type Entry = {
  id: string;
  period?: string;
  workingDays?: string | number;
  created: boolean;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CURRENT_YEAR = new Date().getFullYear();

const PERIOD_OPTIONS = MONTH_NAMES.map((m) => ({ label: `${m} ${CURRENT_YEAR}`, value: `${m} ${CURRENT_YEAR}` }));

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    period: idx === 1 ? `${MONTH_NAMES[0]} ${CURRENT_YEAR}` : undefined,
    workingDays: idx === 1 ? String(22) : undefined,
    created: false,
  };
}

export default function GlobalWorkingDaysCreateFullscreenPage() {
  const router = useRouter();
  const [createGlobalWorkingDays, { isLoading }] = useCreateGlobalWorkingDaysMutation();

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
    if (e.workingDays === undefined || e.workingDays === null || String(e.workingDays).trim() === "") return "Working Days is required";
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

    try {
      for (const e of entries) {
        await createGlobalWorkingDays({
          parameter_group: "planning",
          period: String(e.period ?? ""),
          working_days: Number(e.workingDays ?? 0),
          status: "active",
        }).unwrap();
      }
      message.success("Working days saved");
      router.push("/system-settings");
    } catch (err: any) {
      message.error(err?.data?.message ?? err?.message ?? "Failed to save working days");
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
                  <Input
                    value={e.workingDays ?? ""}
                    onChange={(ev) => updateEntry(e.id, { workingDays: ev.target.value, created: false })}
                    className="w-full"
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
