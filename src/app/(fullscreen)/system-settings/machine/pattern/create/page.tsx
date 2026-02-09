"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Input, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { useCreateMachinePatternMutation } from "@/lib/api/system-settings/api";

type StatusType = "Active" | "Inactive";

type Entry = {
  id: string;
  machineName?: string;
  machineCount?: number;
  operatingHours?: number;
  status?: StatusType;
  created: boolean;
};

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
] as const;

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    machineName: idx === 1 ? "Standard Production" : undefined,
    machineCount: idx === 1 ? 10 : undefined,
    operatingHours: idx === 1 ? 8 : undefined,
    status: idx === 1 ? "Active" : undefined,
    created: false,
  };
}

export default function MachinePatternCreatePage() {
  const router = useRouter();

  const apiEnabled = Boolean(apiBaseUrl);
  const [createMachinePattern, { isLoading: isSaving }] =
    useCreateMachinePatternMutation();

  const [entries, setEntries] = useState<Entry[]>([makeEntry(1)]);

  const completeCount = useMemo(
    () => entries.filter((e) => e.created).length,
    [entries]
  );

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const validateEntry = (e: Entry) => {
    if (!e.machineName) return "Machine Name is required";
    if (e.machineCount === undefined || e.machineCount === null) return "Machine Count is required";
    if (e.operatingHours === undefined || e.operatingHours === null) return "Operating Hours is required";
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
      message.success("Machine pattern saved");
      router.push("/system-settings");
      return;
    }

    try {
      for (const e of entries) {
        await createMachinePattern({
          machine_name: e.machineName!,
          machine_count: e.machineCount!,
          operating_hours: e.operatingHours!,
          status: e.status!,
        }).unwrap();
        updateEntry(e.id, { created: true });
      }

      message.success("Machine pattern saved");
      router.push("/system-settings");
    } catch (err: any) {
      message.error(err?.data?.message ?? err?.error ?? "Failed to save machine pattern");
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
            <div className="text-xl font-semibold text-gray-900">Add Machine Pattern</div>
            <div className="text-sm text-gray-500">
              Create Machine Pattern Configurations <span className="mx-2">•</span> {entries.length} entry
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
                  <div className="text-sm text-gray-500">Configure Parameter for Machine Pattern Configurations</div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">Entry {idx + 1}</Tag>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Machine Name</div>
                    <Input
                      value={e.machineName}
                      onChange={(ev) => updateEntry(e.id, { machineName: ev.target.value, created: false })}
                      placeholder="Standard Production"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-gray-700 mb-2">Machine Count</div>
                    <InputNumber
                      value={e.machineCount}
                      onChange={(v) => updateEntry(e.id, { machineCount: v ?? undefined, created: false })}
                      className="w-full"
                      min={0}
                      placeholder="10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Operating Hours</div>
                    <InputNumber
                      value={e.operatingHours}
                      onChange={(v) => updateEntry(e.id, { operatingHours: v ?? undefined, created: false })}
                      className="w-full"
                      min={0}
                      placeholder="8"
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
