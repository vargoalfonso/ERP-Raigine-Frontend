"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Button, Card, Input, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

type StatusType = "Active" | "Inactive";

type ScrapTypeEntry = {
  id: string;
  typeCode?: string;
  typeName?: string;
  description?: string;
  status?: StatusType;
  created?: boolean;
};

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
] as const;

function nextScrCode(existing: ScrapTypeEntry[]) {
  const nums = existing
    .map((d) => d.typeCode)
    .filter((c): c is string => Boolean(c))
    .map((code) => {
      const m = code.match(/(\d+)$/);
      return m ? Number(m[1]) : null;
    })
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SCR-${String(next).padStart(3, "0")}`;
}

function makeEntry(idx: number, existing: ScrapTypeEntry[]) {
  return {
    id: `entry-${idx}`,
    typeCode: idx === 1 ? nextScrCode(existing) : undefined,
    typeName: undefined,
    description: undefined,
    status: "Active" as StatusType,
    created: false,
  } as ScrapTypeEntry;
}

export default function ScrapTypeCreatePage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ScrapTypeEntry[]>(() => [ { id: "entry-1", typeCode: "SCR-001", status: "Active", created: false } ]);

  useEffect(() => {
    // ensure first entry has auto-generated code based on current entries
    setEntries((prev) => {
      if (!prev[0]?.typeCode) {
        const copy = [...prev];
        copy[0] = { ...copy[0], typeCode: nextScrCode(copy) };
        return copy;
      }
      return prev;
    });
  }, []);

  const completeCount = useMemo(() => entries.filter((e) => e.created).length, [entries]);

  const updateEntry = (id: string, patch: Partial<ScrapTypeEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const validateEntry = (e: ScrapTypeEntry) => {
    if (!e.typeCode) return "Type Code is required";
    if (!e.typeName) return "Type Name is required";
    if (!e.description) return "Description is required";
    if (!e.status) return "Status is required";
    return null;
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, makeEntry(prev.length + 1, prev)]);
  };

  const onSave = () => {
    for (const e of entries) {
      const err = validateEntry(e);
      if (err) {
        message.error(`Entry ${entries.indexOf(e) + 1}: ${err}`);
        return;
      }
    }

    // No API: save locally / navigate back
    message.success("Scrap Type saved");
    router.push("/system-settings");
  };

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" onClick={() => router.push("/system-settings")}>
              <LeftOutlined />
              <span>Back to System Parameters</span>
            </button>

            <div>
              <div className="text-xl font-semibold text-gray-900">Add Scrap Type</div>
              <div className="text-sm text-gray-500">Create Scrap Type <span className="mx-2">•</span> {entries.length} entry</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => router.push("/system-settings")}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={onSave}>Save Parameter</Button>
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
                  <div className="text-sm text-gray-500">Configure Parameter for Scrap Types</div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">Entry {idx + 1}</Tag>
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Type Code</div>
                  <Input
                    value={e.typeCode}
                    onChange={(ev) => updateEntry(e.id, { typeCode: ev.target.value, created: false })}
                    placeholder="auto-generated"
                    disabled
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Type Name</div>
                  <Input
                    value={e.typeName}
                    onChange={(ev) => updateEntry(e.id, { typeName: ev.target.value, created: false })}
                    placeholder="NG Parts"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Description</div>
                  <Input
                    value={e.description}
                    onChange={(ev) => updateEntry(e.id, { description: ev.target.value, created: false })}
                    placeholder="Non-conforming parts"
                  />
                </div>

                <div>
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
