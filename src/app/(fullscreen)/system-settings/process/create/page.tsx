"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Input, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { useCreateProcessMutation } from "@/lib/api/system-settings/api";

type StatusType = "Active" | "Inactive";

type Entry = {
  id: string;
  processCode: string;
  category?: string;
  processName?: string;
  sequence?: number;
  status?: StatusType;
  created: boolean;
};

const CATEGORY_OPTIONS = [
  { label: "Metal Forming", value: "Metal Forming" },
  { label: "Joining", value: "Joining" },
  { label: "Assembly", value: "Assembly" },
  { label: "Finishing", value: "Finishing" },
] as const;

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
] as const;

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    processCode: "Auto Generated",
    category: undefined,
    processName: undefined,
    sequence: undefined,
    status: undefined,
    created: false,
  };
}

export default function ProcessCreatePage() {
  const router = useRouter();

  const apiEnabled = Boolean(apiBaseUrl);
  const [createProcess, { isLoading: isSaving }] = useCreateProcessMutation();

  const [entries, setEntries] = useState<Entry[]>([makeEntry(1)]);

  const completeCount = useMemo(
    () => entries.filter((e) => e.created).length,
    [entries]
  );

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const validateEntry = (e: Entry) => {
    if (!e.category) return "Category is required";
    if (!e.processName) return "Process Name is required";
    if (e.sequence === undefined || e.sequence === null) return "Sequence is required";
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
      message.success("Process saved");
      router.push("/system-settings");
      return;
    }

    try {
      for (const e of entries) {
        await createProcess({
          category: e.category!,
          process_name: e.processName!,
          sequence: e.sequence!,
          status: e.status!,
        }).unwrap();
        updateEntry(e.id, { created: true });
      }

      message.success("Process saved");
      router.push("/system-settings");
    } catch (err: any) {
      message.error(err?.data?.message ?? err?.error ?? "Failed to save process");
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
            <div className="text-xl font-semibold text-gray-900">Add Process</div>
            <div className="text-sm text-gray-500">
              Create process for Work In Progress <span className="mx-2">•</span> {entries.length} entry
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
                  <div className="text-sm text-gray-500">Configure Parameter for process for Work In Progress</div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">Entry {idx + 1}</Tag>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Process Code</div>
                    <Input value={e.processCode} disabled />
                  </div>

                  <div>
                    <div className="text-sm text-gray-700 mb-2">Category</div>
                    <Select
                      value={e.category}
                      onChange={(v) => updateEntry(e.id, { category: v, created: false })}
                      placeholder="Select Category"
                      options={CATEGORY_OPTIONS as unknown as { label: string; value: string }[]}
                      className="w-full"
                      showSearch
                      optionFilterProp="label"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-gray-700 mb-2">Process Name</div>
                    <Input
                      value={e.processName}
                      onChange={(ev) => updateEntry(e.id, { processName: ev.target.value, created: false })}
                      placeholder="Input Process Name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Sequence</div>
                    <InputNumber
                      value={e.sequence}
                      onChange={(v) => updateEntry(e.id, { sequence: v ?? undefined, created: false })}
                      className="w-full"
                      min={1}
                      placeholder="Input Sequence"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-gray-700 mb-2">Status</div>
                    <Select
                      value={e.status}
                      onChange={(v) => updateEntry(e.id, { status: v as StatusType, created: false })}
                      placeholder="Select Status"
                      options={STATUS_OPTIONS as unknown as { label: string; value: string }[]}
                      className="w-full"
                    />
                  </div>

                  <div />
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
