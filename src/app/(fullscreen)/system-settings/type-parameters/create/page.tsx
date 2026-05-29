"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCreateTypeParameterMutation,
  useGetTypeParameterByIdQuery,
  useUpdateTypeParameterMutation,
} from "@/lib/api/system-settings/api";
import { apiBaseUrl } from "@/lib/api/instance";

type StatusType = "Active" | "Inactive";

type Entry = {
  id: string;
  typeCode?: string;
  typeName?: string;
  description?: string;
  status?: StatusType;
  readonlyCode?: boolean;
  created: boolean;
};

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
] as const;

function makeEntry(idx: number, code: string, readonlyCode = true): Entry {
  return {
    id: `entry-${idx}`,
    typeCode: code, // ✅ WAJIB
    typeName: undefined,
    description: undefined,
    status: idx === 1 ? "Active" : undefined,
    readonlyCode,
    created: false,
  };
}

const computeNextWipCode = (existing: Array<string | undefined>): string => {
  const nums = existing
    .map((code) => {
      if (!code) return null;

      const match = code
        .trim()
        .toUpperCase()
        .match(/^WIP-(\d{1,})$/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((n): n is number => n !== null);

  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;

  return `WI-${String(next).padStart(3, "0")}`;
};

export default function TypeParametersCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawMode = String(searchParams.get("mode") ?? "create").toLowerCase();
  const mode = rawMode === "edit" ? "edit" : "create";
  const isEditing = mode === "edit";
  const typeParameterId = String(searchParams.get("id") ?? "").trim();

  const [entries, setEntries] = useState<Entry[]>([
    makeEntry(1, computeNextWipCode([]), true),
  ]);

  const completeCount = useMemo(
    () => entries.filter((e) => e.created).length,
    [entries],
  );

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  };

  const validateEntry = (e: Entry) => {
    if (!e.typeCode) return "Type Code is required";
    if (!e.typeName) return "Type Name is required";
    if (!e.description) return "Description is required";
    if (!e.status) return "Status is required";
    return null;
  };

  const addAnother = () => {
    setEntries((prev) => {
      const existingCodes = prev.map((p) => p.typeCode);
      const nextCode = computeNextWipCode(existingCodes);
      return [...prev, makeEntry(prev.length + 1, nextCode, true)];
    });
  };

  const [createTypeParameter, createState] = useCreateTypeParameterMutation();
  const [updateTypeParameter, updateState] = useUpdateTypeParameterMutation();

  const apiEnabled = Boolean(apiBaseUrl);
  const { data: typeParameterDetail, isLoading: detailLoading } = useGetTypeParameterByIdQuery(
    typeParameterId,
    { skip: !apiEnabled || !isEditing || !typeParameterId },
  );

  useEffect(() => {
    if (!isEditing || !typeParameterDetail) return;

    setEntries([
      {
        id: typeParameterId || "entry-1",
        typeCode: String(typeParameterDetail.type_code ?? "").trim(),
        typeName: String(typeParameterDetail.type_name ?? "").trim(),
        description: String(typeParameterDetail.description ?? "").trim(),
        status:
          String(typeParameterDetail.status ?? "active").toLowerCase() === "inactive"
            ? "Inactive"
            : "Active",
        readonlyCode: true,
        created: false,
      },
    ]);
  }, [isEditing, typeParameterDetail, typeParameterId]);

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
      if (isEditing) {
        const entry = entries[0];
        if (!entry || !typeParameterId) {
          message.error("Type Parameter ID is missing");
          return;
        }

        await updateTypeParameter({
          id: typeParameterId,
          body: {
            type_code: String(entry.typeCode ?? "").trim(),
            type_name: String(entry.typeName ?? "").trim(),
            description: String(entry.description ?? "").trim(),
            status: entry.status === "Active" ? "active" : "inactive",
          },
        }).unwrap();
      } else {
        for (const e of entries) {
          await createTypeParameter({
            type_code: String(e.typeCode ?? "").trim(),
            type_name: String(e.typeName ?? "").trim(),
            description: String(e.description ?? "").trim(),
            status: e.status === "Active" ? "active" : "inactive",
          }).unwrap();
        }
      }

      message.success(isEditing ? "Type Parameter updated" : "Type Parameter(s) saved");
      router.push("/system-settings");
    } catch (err) {
      console.error(err);
      message.error(isEditing ? "Failed to update Type Parameter" : "Failed to save Type Parameter(s)");
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
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={onSave}
                loading={createState.isLoading || updateState.isLoading}
              >
                {isEditing ? "Update Parameter" : "Save Parameter"}
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">
              {isEditing ? "Edit WIP Type" : "Add WIP Type"}
            </div>
            <div className="text-sm text-gray-500">
              {isEditing ? "Update WIP Type" : "Create WIP Type"} <span className="mx-2">•</span> {entries.length}{" "}
              entry
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {isEditing && detailLoading ? (
            <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
              <div className="text-sm text-gray-500">Loading type parameter...</div>
            </Card>
          ) : null}

          {entries.map((e, idx) => (
            <Card
              key={e.id}
              className="rounded-2xl"
              bodyStyle={{ padding: 24 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-gray-900">
                    Add New Parameter #{idx + 1}
                  </div>
                  <div className="text-sm text-gray-500">
                    Configure Parameter for WIP Types
                  </div>
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
                    onChange={(ev) =>
                      updateEntry(e.id, {
                        typeCode: ev.target.value,
                        created: false,
                      })
                    }
                    placeholder="auto-generated"
                    disabled
                    title={
                      e.readonlyCode
                        ? "Auto-generated code (not editable)"
                        : undefined
                    }
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Type Name</div>
                  <Input
                    value={e.typeName}
                    onChange={(ev) =>
                      updateEntry(e.id, {
                        typeCode: ev.target.value,
                        typeName: ev.target.value,
                        created: false,
                      })
                    }
                    placeholder="Semi-Finished Product A"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Description</div>
                  <Input
                    value={e.description}
                    onChange={(ev) =>
                      updateEntry(e.id, {
                        description: ev.target.value,
                        created: false,
                      })
                    }
                    placeholder="After pressing process"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Status</div>
                  <Select
                    value={e.status}
                    onChange={(v) =>
                      updateEntry(e.id, {
                        status: v as StatusType,
                        created: false,
                      })
                    }
                    placeholder="Select Status"
                    options={
                      STATUS_OPTIONS as unknown as {
                        label: string;
                        value: string;
                      }[]
                    }
                  />
                </div>
              </div>
            </Card>
          ))}

          <div className="flex items-center justify-center">
            {!isEditing ? (
              <Button icon={<PlusOutlined />} onClick={addAnother}>
                Add Another Parameter
              </Button>
            ) : null}
          </div>

          <Card className="rounded-2xl" bodyStyle={{ padding: 18 }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-gray-900">
                  Summary
                </div>
                <div className="text-sm text-gray-500">
                  {entries.length} Parameter ready to be saved
                </div>
              </div>
              <div className="flex items-center gap-10">
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {entries.length}
                  </div>
                  <div className="text-xs text-gray-500">Entries</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {completeCount}
                  </div>
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
