"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Input, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useCreateProcessMutation, useGetProcessesQuery } from "@/lib/api/system-settings/api";

type Entry = {
  id: string;
  processName?: string;
  processCode?: string;
  category?: string;
  sequence?: number | string;
  status?: string;
  created?: boolean;
};

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    processName: undefined,
    processCode: undefined,
    category: undefined,
    sequence: undefined,
    status: "Active",
    created: false,
  };
}

const CATEGORY_OPTIONS = [
   { label: "Metal Forming", value: "Metal Forming" },
  { label: "Joining", value: "Joining" },
  { label: "Assembly", value: "Assembly" },
  { label: "Finishing", value: "Finishing" },
];

export default function ProcessCreateFullscreenPage() {
  const router = useRouter();
  const [createProcess] = useCreateProcessMutation();
  const { data: processesData } = useGetProcessesQuery(undefined);

  const [entries, setEntries] = useState<Entry[]>([makeEntry(1)]);

  const completeCount = useMemo(() => entries.filter((e) => e.created).length, [entries]);

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const normalizePrefix = (name: string) =>
    String(name || "")
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 5);

  const computeNextCode = (prefix: string) => {
    if (!prefix) return "";
    const existing = (processesData ?? []).map((p: any) => String(p.process_code ?? ""));
    // Find numbers for codes that start with prefix plus separator
    let max = 0;
    const re = new RegExp(`^${prefix}[-_]?0*?(\\d+)$`, "i");
    for (const code of existing) {
      const m = code.match(re);
      if (m && m[1]) {
        const n = Number(m[1]);
        if (!Number.isNaN(n) && n > max) max = n;
      }
    }
    const next = max + 1;
    return `${prefix}-${String(next).padStart(3, "0")}`;
  };

  const onProcessNameChange = (id: string, name: string) => {
    const prefix = normalizePrefix(name);
    const code = prefix ? computeNextCode(prefix) : undefined;
    updateEntry(id, { processName: name, processCode: code, created: false });
  };

  const addAnother = () => setEntries((p) => [...p, makeEntry(p.length + 1)]);

  const validateEntry = (e: Entry) => {
    if (!e.processName || !String(e.processName).trim()) return "Process Name is required";
    if (!e.processCode || !String(e.processCode).trim()) return "Process Code is missing";
    if (e.sequence === undefined || e.sequence === null || String(e.sequence).trim() === "") return "Sequence is required";
    return null;
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
        await createProcess({
          process_code: String(e.processCode ?? ""),
          category: String(e.category ?? ""),
          process_name: String(e.processName ?? ""),
          sequence: Number(e.sequence ?? 0),
          status: String(e.status ?? "active").toLowerCase(),
        }).unwrap();
      }
      message.success("Processes saved");
      router.push("/system-settings");
    } catch (err: any) {
      message.error(err?.data?.message ?? err?.message ?? "Failed to save processes");
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
              <Button onClick={() => router.push("/system-settings")}>
                Cancel
              </Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>
                Save Parameter
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">Add Process</div>
            <div className="text-sm text-gray-500">Create process for Work In Progress <span className="mx-2">•</span> {entries.length} entry</div>
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
                  <div className="text-sm text-gray-500">Configure Parameter for approval workflow for actions</div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">Entry {idx + 1}</Tag>
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Process Code</div>
                  <Input value={e.processCode ?? ""} placeholder="Auto Generated" disabled />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Category</div>
                  <Select
                    value={e.category}
                    onChange={(v) => updateEntry(e.id, { category: String(v) })}
                    options={CATEGORY_OPTIONS}
                    placeholder="Select Category"
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Process Name</div>
                  <Input
                    value={e.processName ?? ""}
                     onChange={(ev) => updateEntry(e.id, { processName: ev.target.value, processCode: ev.target.value, created: false })}
                    placeholder="Input Process Name"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Sequence</div>
                  <Input
                    value={e.sequence ?? ""}
                    onChange={(ev) => updateEntry(e.id, { sequence: ev.target.value })}
                    placeholder="Input Sequence"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Status</div>
                  <Select
                    value={e.status}
                    onChange={(v) => updateEntry(e.id, { status: String(v) })}
                    options={[{ label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }]}
                    placeholder="Select Status"
                    className="w-full"
                  />
                </div>
              </div>
            </Card>
          ))}

          <div className="flex items-center justify-center">
            <Button icon={<PlusOutlined />} onClick={addAnother}>Add Another Parameter</Button>
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
