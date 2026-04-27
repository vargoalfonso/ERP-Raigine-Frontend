"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Form, Input, Typography, message, Switch, Table, Checkbox, Divider } from "antd";

import {
  type RolePermissions,
  useCreateRoleMutation,
  useGetRoleByIdQuery,
  useUpdateRoleMutation,
} from "@/lib/api/system-settings/api";
import { getApiErrorMessage } from "@/lib/api/error";

type Mode = "create" | "edit" | "detail";

type FormValues = {
  name: string;
  description?: string;
  permissionsJson: string;
};

const { Text } = Typography;

const stringifyPretty = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
};

const parsePermissions = (raw: string): RolePermissions => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Permissions must be valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Permissions must be a JSON object");
  }

  for (const [moduleKey, moduleVal] of Object.entries(parsed as Record<string, unknown>)) {
    if (!moduleVal || typeof moduleVal !== "object" || Array.isArray(moduleVal)) {
      throw new Error(`Permissions.${moduleKey} must be a JSON object`);
    }
    for (const [actionKey, actionVal] of Object.entries(moduleVal as Record<string, unknown>)) {
      if (typeof actionVal !== "boolean") {
        throw new Error(`Permissions.${moduleKey}.${actionKey} must be boolean`);
      }
    }
  }

  return parsed as RolePermissions;
};

const buildDefaultPermissions = (
  features: { key: string; actions: string[] }[],
  checked = false
) => {
  const next: Record<string, Record<string, boolean>> = {};
  for (const feature of features) {
    next[feature.key] = {};
    for (const action of feature.actions) {
      next[feature.key][action] = checked ? true : action === "View";
    }
  }
  return next;
};

function RoleCreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form] = Form.useForm<FormValues>();
  const [allAccess, setAllAccess] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [roleName, setRoleName] = useState("");

  const mode = (searchParams.get("mode") ?? "create") as Mode;
  const id = searchParams.get("id") ?? "";
  const readOnly = mode === "detail";

  const { data: role, isFetching } = useGetRoleByIdQuery(id, {
    skip: !id,
  });

  const [createRole, createState] = useCreateRoleMutation();
  const [updateRole, updateState] = useUpdateRoleMutation();

  const title = useMemo(() => {
    if (mode === "detail") return "Role Detail";
    if (mode === "edit") return "Edit Role";
    return "Create Role";
  }, [mode]);

  // Feature/action matrix definition
  const FEATURES = [
    { key: "Dashboard", actions: ["View"] },
    { key: "Shop Floor", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "System Settings", actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"] },
    { key: "PRL Management", actions: ["View", "Download Report", "Approval"] },
    { key: "PO Budget", actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"] },
    { key: "Customer PO & DN", actions: ["View", "Create", "Edit", "Delete", "Download Report", "Action UI"] },
    { key: "Supplier - Raw Material", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "Supplier Sub Con", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "Supplier Indirect", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "Bill of Material", actions: ["View", "Create", "Edit", "Delete", "Approval"] },
    { key: "Work Orders", actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"] },
    { key: "Machine Master Data", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "Machine Pattern", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "Production Dashboard", actions: ["View", "Download Report", "Action UI"] },
    { key: "QC Dashboard", actions: ["View", "Download Report"] },
    { key: "Finished Goods", actions: ["View", "Download Report"] },
    { key: "Work In Progress", actions: ["View"] },
    { key: "Scrap Stock", actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"] },
    { key: "Raw Materials", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "Indirect Raw Material", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "Sub Con Raw Materials", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "Stock Opname", actions: ["View", "Create", "Edit", "Delete", "Download Report", "Approval"] },
    { key: "PO - Raw Materials", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "PO - Indirect", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "PO - Sub Con", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "DN - Raw Material", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "DN - Indirect", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "DN - Sub Con", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "Delivery Scheduling", actions: ["View", "Create", "Edit", "Delete", "Download Report"] },
    { key: "Employee & Dept", actions: ["View"] },
    { key: "Robot", actions: ["View Running Robot", "Startup/Stop", "Control Room", "Download Report"] },
  ];

  useEffect(() => {
    if (!id) {
      setPermissions(buildDefaultPermissions(FEATURES));
      return;
    }
    if (!role) return;
    setPermissions(role.permissions ?? role.Permissions ?? {});
  }, [id, role]);

  useEffect(() => {
    if (!id || !role) {
      form.setFieldsValue({
        name: "",
        description: "",
      });
      setRoleName("");
      return;
    }

    const nextName = String(role.name ?? "");
    form.setFieldsValue({
      name: nextName,
      description: role.description ?? "",
    });
    setRoleName(nextName);
  }, [form, id, role]);

  useEffect(() => {
    const allEnabled = FEATURES.every((feature) =>
      feature.actions.every((action) => Boolean(permissions[feature.key]?.[action]))
    );
    setAllAccess(allEnabled);
  }, [FEATURES, permissions]);

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      const normalizedName = String(values.name ?? "").trim();
      const normalizedDescription = String(values.description ?? "").trim();

      if (!normalizedName) {
        form.setFields([
          {
            name: "name",
            errors: ["Role name is required"],
          },
        ]);
        return;
      }

      if (mode === "edit") {
        if (!id) throw new Error("Missing role id");
        await updateRole({
          id,
          body: {
            name: normalizedName,
            description: normalizedDescription || "",
            permissions,
          },
        }).unwrap();
        message.success("Role updated");
        router.push("/system-settings");
        return;
      }

      await createRole({
        name: normalizedName,
        description: normalizedDescription || "",
        permissions,
        status: "Active",
      }).unwrap();

      message.success("Role created");
      router.push("/system-settings");
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to save role"));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-4">
        <Card className="rounded-2xl shadow-sm" styles={{ body: { padding: 20 } }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-2xl font-bold text-gray-900">{title}</div>
              <div className="text-sm text-gray-500">
                {readOnly
                  ? "View role info and permissions"
                  : "Define role name, description, and permissions"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button className="!rounded-lg" onClick={() => router.push("/system-settings")}
              >
                Back
              </Button>
              {mode === "detail" && id ? (
                <Button
                  type="primary"
                  className="!rounded-lg"
                  onClick={() =>
                    router.push(
                      `/system-settings/roles/create?mode=edit&id=${encodeURIComponent(id)}`
                    )
                  }
                >
                  Edit
                </Button>
              ) : (
                <Button
                  type="primary"
                  className="!rounded-lg"
                  onClick={onSubmit}
                  loading={createState.isLoading || updateState.isLoading}
                  disabled={readOnly}
                >
                  Save
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl shadow-sm" styles={{ body: { padding: 20 } }}>
          <Form<FormValues>
            form={form}
            layout="vertical"
            disabled={readOnly}
            initialValues={{
              name: "",
              description: "",
            }}
          >
            <div className="mb-6">
              <Form.Item
                name="name"
                label="Role Name"
                rules={[
                  { required: true, message: "Role name is required" },
                  {
                    validator: async (_, value) => {
                      if (!String(value ?? "").trim()) {
                        throw new Error("Role name is required");
                      }
                    },
                  },
                ]}
              >
                <Input
                  maxLength={30}
                  value={roleName}
                  onChange={e => {
                    const nextValue = e.target.value;
                    setRoleName(nextValue);
                    form.setFieldValue("name", nextValue);
                  }}
                  placeholder="e.g. PPC Division"
                  className="!rounded-lg !h-10"
                />
              </Form.Item>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Enter a unique role name. Do not use existing name.</span>
                <span>{roleName.length}/30</span>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-5 mb-6 sticky top-0 z-10 flex items-center justify-between">
              <div className="font-semibold text-blue-700">Access Permission</div>
              <div className="flex items-center gap-2">
                <span className="text-blue-700 font-medium">Allow All Access</span>
                <Switch checked={allAccess} onChange={(checked) => {
                  setAllAccess(checked);
                  const newPerms: typeof permissions = {};
                  for (const f of FEATURES) {
                    newPerms[f.key] = {};
                    for (const a of f.actions) {
                      newPerms[f.key][a] = checked;
                    }
                  }
                  setPermissions(newPerms);
                }} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {FEATURES.map((feature) => (
                <div key={feature.key} className="bg-white rounded-xl border p-4 flex flex-col gap-2">
                  <div className="font-semibold mb-1">{feature.key}</div>
                  <div className="flex flex-col gap-2 pl-2">
                    {feature.actions.map((action) => (
                      <label key={action} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={permissions[feature.key]?.[action] || false}
                          onChange={e => {
                            const checked = e.target.checked;
                            setPermissions(prev => {
                              const next = { ...prev };
                              next[feature.key] = { ...next[feature.key] };
                              next[feature.key][action] = checked;
                              return next;
                            });
                          }}
                        />
                        {action}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}

export default function RoleCreatePage() {
  return (
    <Suspense fallback={null}>
      <RoleCreatePageContent />
    </Suspense>
  );
}
