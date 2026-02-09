"use client";

import React, { Suspense, useMemo, useState } from "react";
import { Button, Card, Checkbox, Input, Switch, message } from "antd";
import { LeftOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { useCreateRoleMutation } from "@/lib/api/system-settings/api";
import { getApiErrorMessage } from "@/lib/api/error";

type FeatureGroup = {
  title: string;
  actions: string[];
};

const ROLE_PERMISSION_ROWS: FeatureGroup[][] = [
  [
    {
      title: "Dashboard",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"],
    },
    {
      title: "Shop Floor",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
    {
      title: "System Settings",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"],
    },
    {
      title: "PRL Management",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"],
    },
  ],
  [
    {
      title: "PO Budget",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"],
    },
    {
      title: "Customer PO & DN",
      actions: [
        "View",
        "Create",
        "Edit",
        "Delete",
        "Download Report",
        "Approval",
        "Action UI",
      ],
    },
    {
      title: "Supplier - Raw Material",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"],
    },
    {
      title: "Supplier Sub Con",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
  ],
  [
    {
      title: "Supplier Indirect",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
    {
      title: "Bill of Material",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"],
    },
    {
      title: "Work Orders",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"],
    },
    {
      title: "Machine Master Data",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
  ],
  [
    {
      title: "Machine Pattern",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
    {
      title: "Production Dashboard",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Action UI"],
    },
    {
      title: "QC Dashboard",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Action UI"],
    },
    {
      title: "Finished Goods",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
  ],
  [
    {
      title: "Work in Progress",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
    {
      title: "Scrap Stock",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
    {
      title: "Raw Materials",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Action UI"],
    },
    {
      title: "Indirect Raw Material",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
  ],
  [
    {
      title: "Sub Con Raw Materials",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"],
    },
    {
      title: "Stock Opname",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Action UI", "Approval"],
    },
    {
      title: "PO - Raw Materials",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Action UI"],
    },
    {
      title: "PO - Indirect",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
  ],
  [
    {
      title: "PO - Sub Con",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
    {
      title: "DN - Raw Material",
      actions: ["View", "Create", "Edit", "Delete", "Download Report", "Action UI"],
    },
    {
      title: "DN - Indirect",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
    {
      title: "DN - Sub Con",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
  ],
  [
    {
      title: "Delivery Scheduling",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
    {
      title: "Employee & Dept",
      actions: ["View", "Create", "Edit", "Delete", "Download Report"],
    },
    {
      title: "Robot",
      actions: ["View Running Robot", "Start/Stop", "Control Room", "Download Report"],
    },
  ],
];

function buildKeys(groups: FeatureGroup[]) {
  const keys: string[] = [];
  groups.forEach((g) => {
    g.actions.forEach((a) => keys.push(`${g.title}::${a}`));
  });
  return keys;
}

function buildDefaultChecked(): Record<string, boolean> {
  // Defaults based on the screenshot (mostly View, with a few extra toggles).
  return {
    "Dashboard::View": true,
    "Shop Floor::View": true,
    "System Settings::View": true,
    "System Settings::Approval": true,
    "PRL Management::View": true,
    "PRL Management::Approval": true,
    "PO Budget::View": true,
    "Customer PO & DN::View": true,
    "Customer PO & DN::Approval": true,
    "Customer PO & DN::Action UI": true,
    "Supplier - Raw Material::View": true,
    "Supplier Sub Con::View": true,
    "Supplier Indirect::View": true,
    "Bill of Material::View": true,
    "Bill of Material::Approval": true,
    "Work Orders::View": true,
    "Work Orders::Approval": true,
    "Machine Master Data::View": true,
    "Machine Pattern::View": true,
    "Production Dashboard::View": true,
    "Production Dashboard::Action UI": true,
    "QC Dashboard::View": true,
    "QC Dashboard::Action UI": true,
    "Finished Goods::View": true,
    "Work in Progress::View": true,
    "Scrap Stock::View": true,
    "Raw Materials::View": true,
    "Raw Materials::Action UI": true,
    "Indirect Raw Material::View": true,
    "Sub Con Raw Materials::View": true,
    "Stock Opname::View": true,
    "Stock Opname::Action UI": true,
    "Stock Opname::Approval": true,
    "PO - Raw Materials::View": true,
    "PO - Raw Materials::Action UI": true,
    "PO - Indirect::View": true,
    "PO - Sub Con::View": true,
    "DN - Raw Material::View": true,
    "DN - Raw Material::Action UI": true,
    "DN - Indirect::View": true,
    "DN - Sub Con::View": true,
    "Delivery Scheduling::View": true,
    "Employee & Dept::View": true,
    "Robot::View Running Robot": true,
  };
}

export default function CreateRolePage() {
  return (
    <Suspense fallback={null}>
      <CreateRolePageContent />
    </Suspense>
  );
}

function CreateRolePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apiEnabled = Boolean(apiBaseUrl);
  const [createRole, { isLoading: isSaving }] = useCreateRoleMutation();

  const mode = searchParams.get("mode") ?? "create";
  const isDetail = mode === "detail";
  const isEdit = mode === "edit";
  const initialName = searchParams.get("name") ?? "";

  const [roleName, setRoleName] = useState(initialName);

  const allKeys = useMemo(() => buildKeys(ROLE_PERMISSION_ROWS.flat()), []);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    allKeys.forEach((k) => (initial[k] = false));
    const defaults = buildDefaultChecked();
    Object.keys(defaults).forEach((k) => {
      if (k in initial) initial[k] = defaults[k];
    });
    return initial;
  });

  const roleNameCount = roleName.length;

  const setAll = (val: boolean) => {
    setChecked((prev) => {
      const next: Record<string, boolean> = { ...prev };
      allKeys.forEach((k) => (next[k] = val));
      return next;
    });
  };

  const onToggle = (key: string, val: boolean) => {
    setChecked((prev) => {
      const next = { ...prev, [key]: val };
      const allOn = allKeys.every((k) => next[k]);
      void allOn;
      return next;
    });
  };

  const allowAllDerived = useMemo(() => allKeys.length > 0 && allKeys.every((k) => checked[k]), [allKeys, checked]);

  const onSubmit = async () => {
    if (isDetail) {
      router.push("/system-settings");
      return;
    }
    if (!roleName.trim()) {
      message.error("Role Name is required");
      return;
    }

    if (!apiEnabled) {
      message.success(isEdit ? "Role updated" : "Role created");
      router.push("/system-settings");
      return;
    }

    try {
      await createRole({ name: roleName.trim(), permissions: checked }).unwrap();
      message.success(isEdit ? "Role updated" : "Role created");
      router.push("/system-settings");
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Failed to save role"));
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
              <span>Back to System Settings</span>
            </button>

            <div className="flex items-center gap-2">
              <Button onClick={() => router.push("/system-settings")}>Cancel</Button>
              {!isDetail && (
                <Button type="primary" onClick={onSubmit} loading={isSaving}>
                  {isEdit ? "Save Role" : "Create Role"}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">
              {isDetail ? "Role Details" : "Create New Role"}
            </div>
            <div className="text-sm text-gray-500">{isDetail ? "Role" : "Create Role"}</div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          <Card className="rounded-2xl" bodyStyle={{ padding: 20 }}>
            <div className="text-base font-semibold text-gray-900">Role Name</div>
            <div className="text-sm text-gray-500 mt-1">
              Enter a unique role name. Do not use existing name.
            </div>

            <div className="mt-4 relative">
              <Input
                value={roleName}
                onChange={(e) => setRoleName(e.target.value.slice(0, 30))}
                placeholder="Administrator"
                maxLength={30}
                disabled={isDetail}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {roleNameCount}/30
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl" bodyStyle={{ padding: 0 }}>
            <div className="px-5 py-4">
              <div className="text-base font-semibold text-gray-900">Access Permission</div>
            </div>

            <div className="mx-5 mb-5 border rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">Feature</div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-500">Allow All access</div>
                  <Switch checked={allowAllDerived} onChange={setAll} disabled={isDetail} />
                </div>
              </div>

              <div className="px-5 py-4">
                {ROLE_PERMISSION_ROWS.map((rowGroups, rowIdx) => (
                  <div key={`row-${rowIdx}`}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                      {rowGroups.map((group) => (
                        <div key={group.title}>
                          <div className="text-sm font-semibold text-gray-900">{group.title}</div>
                          <div className="mt-3 space-y-2">
                            {group.actions.map((action) => {
                              const key = `${group.title}::${action}`;
                              return (
                                <div key={key} className="flex items-center gap-2">
                                  <Checkbox
                                    checked={!!checked[key]}
                                    onChange={(e) => onToggle(key, e.target.checked)}
                                    disabled={isDetail}
                                  />
                                  <div className="text-sm text-gray-700">{action}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {rowIdx < ROLE_PERMISSION_ROWS.length - 1 && (
                      <div className="my-8 border-t border-gray-200" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
