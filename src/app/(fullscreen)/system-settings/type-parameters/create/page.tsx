"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Input, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useCreateTypeParameterMutation } from "@/lib/api/system-settings/api";
import { apiBaseUrl } from "@/lib/api/instance";

type StatusType = "Active" | "Inactive";

type Entry = {
  id: string;
  typeCode?: string;
  typeName?: string;
  description?: string;
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
    typeCode: idx === 1 ? "WIP-A" : undefined,
    typeName: idx === 1 ? "Semi-Finished Product A" : undefined,
    description: idx === 1 ? "After pressing process" : undefined,
    status: idx === 1 ? "Active" : undefined,
    created: false,
  };
}

export default function TypeParametersCreatePage() {
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
    if (!e.typeCode) return "Type Code is required";
    if (!e.typeName) return "Type Name is required";
    if (!e.description) return "Description is required";
    if (!e.status) return "Status is required";
    return null;
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, makeEntry(prev.length + 1)]);
  };

  const [createTypeParameter, createState] = useCreateTypeParameterMutation();

  const apiEnabled = Boolean(apiBaseUrl);

  const onSave = async () => {
    for (const e of entries) {
      const err = validateEntry(e);
      if (err) {
        message.error(`Entry ${entries.indexOf(e) + 1}: ${err}`);
        return;
      }
    }

    if (!apiEnabled) {
      message.success("WIP Type saved (local)");
      router.push("/system-settings");
      return;
    }

    try {
      for (const e of entries) {
        await createTypeParameter({
          type_code: String(e.typeCode ?? "").trim(),
          type_name: String(e.typeName ?? "").trim(),
          description: String(e.description ?? "").trim(),
          status: e.status === "Active" ? "active" : "inactive",
        }).unwrap();
      }

      message.success("Type Parameter(s) saved");
      router.push("/system-settings");
    } catch (err) {
      console.error(err);
      message.error("Failed to save Type Parameter(s)");
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
            <div className="text-xl font-semibold text-gray-900">Add WIP Type</div>
            <div className="text-sm text-gray-500">
              Create WIP Type <span className="mx-2">•</span> {entries.length} entry
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
                  <div className="text-sm text-gray-500">Configure Parameter for WIP Types</div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  Entry {idx + 1}
                </Tag>
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Type Code</div>
                  <Input
                    value={e.typeCode}
                    onChange={(ev) => updateEntry(e.id, { typeCode: ev.target.value, created: false })}
                    placeholder="WIP-A"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Type Name</div>
                  <Input
                    value={e.typeName}
                    onChange={(ev) => updateEntry(e.id, { typeName: ev.target.value, created: false })}
                    placeholder="Semi-Finished Product A"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Description</div>
                  <Input
                    value={e.description}
                    onChange={(ev) =>
                      updateEntry(e.id, { description: ev.target.value, created: false })
                    }
                    placeholder="After pressing process"
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
