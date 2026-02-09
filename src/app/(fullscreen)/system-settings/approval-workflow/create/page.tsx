"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { useCreateApprovalWorkflowMutation } from "@/lib/api/system-settings/api";

type StatusType = "Active" | "Inactive";

type Entry = {
  id: string;
  menuAction?: string;
  level1Role?: string;
  level2Role?: string;
  level3Role?: string;
  level4Role?: string;
  status?: StatusType;
  created: boolean;
};

const MENU_ACTION_OPTIONS = [
  { label: "Update Budget for PO", value: "Update Budget for PO" },
  { label: "Approve Work Order", value: "Approve Work Order" },
] as const;

const ROLE_OPTIONS = [
  { label: "Procurement Manager", value: "Procurement Manager" },
  { label: "Finance Manager", value: "Finance Manager" },
  { label: "Director", value: "Director" },
  { label: "CEO", value: "CEO" },
  { label: "Finance", value: "Finance" },
  { label: "PPIC", value: "PPIC" },
  { label: "IT", value: "IT" },
  { label: "N/A", value: "N/A" },
] as const;

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
] as const;

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    menuAction: idx === 1 ? undefined : undefined,
    level1Role: idx === 1 ? "Procurement Manager" : undefined,
    level2Role: idx === 1 ? "Finance Manager" : undefined,
    level3Role: idx === 1 ? "Director" : undefined,
    level4Role: idx === 1 ? "CEO" : undefined,
    status: idx === 1 ? "Active" : undefined,
    created: false,
  };
}

export default function ApprovalWorkflowCreatePage() {
  const router = useRouter();

  const apiEnabled = Boolean(apiBaseUrl);
  const [createApprovalWorkflow, { isLoading: isSaving }] =
    useCreateApprovalWorkflowMutation();

  const [entries, setEntries] = useState<Entry[]>([makeEntry(1)]);

  const completeCount = useMemo(
    () => entries.filter((e) => e.created).length,
    [entries]
  );

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const validateEntry = (e: Entry) => {
    if (!e.menuAction) return "Menu/Action is required";
    if (!e.level1Role) return "Level 1 Role is required";
    if (!e.level2Role) return "Level 2 Role is required";
    if (!e.level3Role) return "Level 3 Role is required";
    if (!e.level4Role) return "Level 4 Role is required";
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
      message.success("Approval workflow saved");
      router.push("/system-settings");
      return;
    }

    try {
      for (const e of entries) {
        await createApprovalWorkflow({
          menu_action: e.menuAction!,
          level_1_role: e.level1Role!,
          level_2_role: e.level2Role!,
          level_3_role: e.level3Role!,
          level_4_role: e.level4Role!,
          status: e.status!,
        }).unwrap();
        updateEntry(e.id, { created: true });
      }

      message.success("Approval workflow saved");
      router.push("/system-settings");
    } catch (err: any) {
      message.error(err?.data?.message ?? err?.error ?? "Failed to save approval workflow");
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
            <div className="text-xl font-semibold text-gray-900">Add Approval Workflow</div>
            <div className="text-sm text-gray-500">
              Create approval workflow for actions <span className="mx-2">•</span> {entries.length} entry
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
                  <div className="text-sm text-gray-500">
                    Configure Parameter for approval workflow for actions
                  </div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  Entry {idx + 1}
                </Tag>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Menu/Action</div>
                  <Select
                    value={e.menuAction}
                    onChange={(v) => updateEntry(e.id, { menuAction: v, created: false })}
                    placeholder="Pilih menu"
                    options={MENU_ACTION_OPTIONS as unknown as { label: string; value: string }[]}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Level 1 Role</div>
                    <Select
                      value={e.level1Role}
                      onChange={(v) => updateEntry(e.id, { level1Role: v, created: false })}
                      placeholder="Level 1 Role"
                      options={ROLE_OPTIONS as unknown as { label: string; value: string }[]}
                    />
                  </div>

                  <div>
                    <div className="text-sm text-gray-700 mb-2">Level 2 Role</div>
                    <Select
                      value={e.level2Role}
                      onChange={(v) => updateEntry(e.id, { level2Role: v, created: false })}
                      placeholder="Level 2 Role"
                      options={ROLE_OPTIONS as unknown as { label: string; value: string }[]}
                    />
                  </div>

                  <div>
                    <div className="text-sm text-gray-700 mb-2">Level 3 Role</div>
                    <Select
                      value={e.level3Role}
                      onChange={(v) => updateEntry(e.id, { level3Role: v, created: false })}
                      placeholder="Level 3 Role"
                      options={ROLE_OPTIONS as unknown as { label: string; value: string }[]}
                    />
                  </div>

                  <div>
                    <div className="text-sm text-gray-700 mb-2">Level 4 Role</div>
                    <Select
                      value={e.level4Role}
                      onChange={(v) => updateEntry(e.id, { level4Role: v, created: false })}
                      placeholder="Level 4 Role"
                      options={ROLE_OPTIONS as unknown as { label: string; value: string }[]}
                    />
                  </div>
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
