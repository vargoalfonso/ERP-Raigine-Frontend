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

type UiPermissions = Record<string, Record<string, boolean>>;

type FeatureConfig = {
  key: string;
  actions: string[];
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

const FEATURES: FeatureConfig[] = [
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

const SYSTEM_SETTINGS_BACKEND_KEYS = [
  "role",
  "users",
  "kanban",
  "process",
  "safety-stock",
  "type-parameter",
  "global_parameter",
  "po_split_setting",
  "unit_measurement",
  "approval_workflow",
] as const;

const getUiPermission = (
  permissions: UiPermissions,
  featureKey: string,
  action: string,
) => Boolean(permissions[featureKey]?.[action]);

const setPermission = (
  target: RolePermissions,
  moduleKey: string,
  actionKey: string,
  value: boolean,
) => {
  if (!target[moduleKey] || typeof target[moduleKey] !== "object") {
    target[moduleKey] = {};
  }

  (target[moduleKey] as Record<string, boolean>)[actionKey] = value;
};

const anyBackendPermission = (
  permissions: RolePermissions,
  moduleKeys: string[],
  actionKeys: string[],
) =>
  moduleKeys.some((moduleKey) => {
    const modulePermissions = permissions[moduleKey];
    if (!modulePermissions || typeof modulePermissions !== "object") return false;
    return actionKeys.some((actionKey) => Boolean((modulePermissions as Record<string, boolean>)[actionKey]));
  });

const toBackendPermissions = (permissions: UiPermissions): RolePermissions => {
  const next: RolePermissions = {};

  setPermission(next, "dashboard", "view", getUiPermission(permissions, "Dashboard", "View"));
  setPermission(next, "dashboard", "filter", false);
  setPermission(next, "dashboard", "download", false);

  setPermission(next, "bom", "view", getUiPermission(permissions, "Bill of Material", "View"));
  setPermission(next, "bom", "create", getUiPermission(permissions, "Bill of Material", "Create"));
  setPermission(next, "bom", "update", getUiPermission(permissions, "Bill of Material", "Edit"));
  setPermission(next, "bom", "delete", getUiPermission(permissions, "Bill of Material", "Delete"));

  setPermission(next, "qc", "view", getUiPermission(permissions, "QC Dashboard", "View"));
  setPermission(next, "qc", "create", false);
  setPermission(next, "qc", "update", false);
  setPermission(next, "qc", "delete", false);

  setPermission(next, "po_budget", "view", getUiPermission(permissions, "PO Budget", "View"));
  setPermission(next, "po_budget", "create", getUiPermission(permissions, "PO Budget", "Create"));
  setPermission(next, "po_budget", "update", getUiPermission(permissions, "PO Budget", "Edit"));
  setPermission(next, "po_budget", "delete", getUiPermission(permissions, "PO Budget", "Delete"));
  setPermission(next, "po_budget", "approve", getUiPermission(permissions, "PO Budget", "Approval"));

  setPermission(next, "work_order", "view", getUiPermission(permissions, "Work Orders", "View"));
  setPermission(next, "work_order", "create", getUiPermission(permissions, "Work Orders", "Create"));
  setPermission(next, "work_order", "update", getUiPermission(permissions, "Work Orders", "Edit"));
  setPermission(next, "work_order", "delete", getUiPermission(permissions, "Work Orders", "Delete"));
  setPermission(next, "work_order", "approve", getUiPermission(permissions, "Work Orders", "Approval"));

  setPermission(next, "production", "view", getUiPermission(permissions, "Production Dashboard", "View"));
  setPermission(next, "production", "create", false);
  setPermission(next, "production", "update", false);
  setPermission(next, "production", "delete", false);

  const inventoryView = [
    "Raw Materials",
    "Indirect Raw Material",
    "Sub Con Raw Materials",
    "Finished Goods",
    "Scrap Stock",
  ].some((feature) => getUiPermission(permissions, feature, "View"));
  const inventoryCreate = [
    "Raw Materials",
    "Indirect Raw Material",
    "Sub Con Raw Materials",
    "Scrap Stock",
  ].some((feature) => getUiPermission(permissions, feature, "Create"));
  const inventoryUpdate = [
    "Raw Materials",
    "Indirect Raw Material",
    "Sub Con Raw Materials",
    "Scrap Stock",
  ].some((feature) => getUiPermission(permissions, feature, "Edit"));
  const inventoryDelete = [
    "Raw Materials",
    "Indirect Raw Material",
    "Sub Con Raw Materials",
    "Scrap Stock",
  ].some((feature) => getUiPermission(permissions, feature, "Delete"));
  const inventoryDownload = [
    "Raw Materials",
    "Indirect Raw Material",
    "Sub Con Raw Materials",
    "Finished Goods",
    "Scrap Stock",
  ].some((feature) => getUiPermission(permissions, feature, "Download Report"));

  setPermission(next, "inventory", "view", inventoryView);
  setPermission(next, "inventory", "create", inventoryCreate);
  setPermission(next, "inventory", "update", inventoryUpdate);
  setPermission(next, "inventory", "delete", inventoryDelete);
  setPermission(next, "inventory", "download_report", inventoryDownload);

  const procurementView = ["PO - Raw Materials", "PO - Indirect", "PO - Sub Con"].some((feature) =>
    getUiPermission(permissions, feature, "View"),
  );
  const procurementCreate = ["PO - Raw Materials", "PO - Indirect", "PO - Sub Con"].some((feature) =>
    getUiPermission(permissions, feature, "Create"),
  );
  const procurementUpdate = ["PO - Raw Materials", "PO - Indirect", "PO - Sub Con"].some((feature) =>
    getUiPermission(permissions, feature, "Edit"),
  );

  setPermission(next, "procurement", "view", procurementView);
  setPermission(next, "procurement", "create", procurementCreate);
  setPermission(next, "procurement", "update", procurementUpdate);

  const deliveryView = [
    "Customer PO & DN",
    "DN - Raw Material",
    "DN - Indirect",
    "DN - Sub Con",
    "Delivery Scheduling",
  ].some((feature) => getUiPermission(permissions, feature, "View"));
  const deliveryCreate = [
    "Customer PO & DN",
    "DN - Raw Material",
    "DN - Indirect",
    "DN - Sub Con",
    "Delivery Scheduling",
  ].some((feature) => getUiPermission(permissions, feature, "Create"));
  const deliveryUpdate = [
    "Customer PO & DN",
    "DN - Raw Material",
    "DN - Indirect",
    "DN - Sub Con",
    "Delivery Scheduling",
  ].some((feature) => getUiPermission(permissions, feature, "Edit"));
  const deliveryDelete = [
    "Customer PO & DN",
    "DN - Raw Material",
    "DN - Indirect",
    "DN - Sub Con",
    "Delivery Scheduling",
  ].some((feature) => getUiPermission(permissions, feature, "Delete"));

  setPermission(next, "delivery_note", "view", deliveryView);
  setPermission(next, "delivery_note", "create", deliveryCreate);
  setPermission(next, "delivery_note", "update", deliveryUpdate);
  setPermission(next, "delivery_note", "delete", deliveryDelete);

  setPermission(next, "action_ui", "view", getUiPermission(permissions, "Customer PO & DN", "Action UI") || getUiPermission(permissions, "Production Dashboard", "Action UI"));
  setPermission(next, "action_ui", "create", false);
  setPermission(next, "action_ui", "update", false);
  setPermission(next, "action_ui", "delete", false);

  setPermission(next, "employee", "view", getUiPermission(permissions, "Employee & Dept", "View"));
  setPermission(next, "employee", "create", false);
  setPermission(next, "employee", "update", false);
  setPermission(next, "employee", "delete", false);

  setPermission(next, "department", "view", getUiPermission(permissions, "Employee & Dept", "View"));
  setPermission(next, "department", "create", false);
  setPermission(next, "department", "update", false);
  setPermission(next, "department", "delete", false);

  setPermission(next, "manufacturing", "view", getUiPermission(permissions, "Shop Floor", "View"));
  setPermission(next, "manufacturing", "create_wo", getUiPermission(permissions, "Shop Floor", "Create"));
  setPermission(next, "manufacturing", "production_plan", getUiPermission(permissions, "Shop Floor", "Edit"));

  const systemView = getUiPermission(permissions, "System Settings", "View");
  const systemCreate = getUiPermission(permissions, "System Settings", "Create");
  const systemUpdate = getUiPermission(permissions, "System Settings", "Edit");
  const systemDelete = getUiPermission(permissions, "System Settings", "Delete");
  const systemApprove = getUiPermission(permissions, "System Settings", "Approval");

  for (const moduleKey of SYSTEM_SETTINGS_BACKEND_KEYS) {
    setPermission(next, moduleKey, "view", systemView);
    setPermission(next, moduleKey, "create", systemCreate);
    setPermission(next, moduleKey, "update", systemUpdate);
    setPermission(next, moduleKey, "delete", systemDelete);
  }
  setPermission(next, "approval_workflow", "approve", systemApprove);

  return next;
};

const fromBackendPermissions = (permissions: RolePermissions | undefined): UiPermissions => {
  const next = buildDefaultPermissions(FEATURES);
  if (!permissions) return next;

  next["Dashboard"]["View"] = anyBackendPermission(permissions, ["dashboard"], ["view"]);

  next["Bill of Material"]["View"] = anyBackendPermission(permissions, ["bom"], ["view"]);
  next["Bill of Material"]["Create"] = anyBackendPermission(permissions, ["bom"], ["create"]);
  next["Bill of Material"]["Edit"] = anyBackendPermission(permissions, ["bom"], ["update"]);
  next["Bill of Material"]["Delete"] = anyBackendPermission(permissions, ["bom"], ["delete"]);
  next["Bill of Material"]["Approval"] = anyBackendPermission(permissions, ["bom"], ["approve"]);

  next["PO Budget"]["View"] = anyBackendPermission(permissions, ["po_budget"], ["view"]);
  next["PO Budget"]["Create"] = anyBackendPermission(permissions, ["po_budget"], ["create"]);
  next["PO Budget"]["Edit"] = anyBackendPermission(permissions, ["po_budget"], ["update"]);
  next["PO Budget"]["Delete"] = anyBackendPermission(permissions, ["po_budget"], ["delete"]);
  next["PO Budget"]["Approval"] = anyBackendPermission(permissions, ["po_budget"], ["approve"]);

  next["Work Orders"]["View"] = anyBackendPermission(permissions, ["work_order"], ["view"]);
  next["Work Orders"]["Create"] = anyBackendPermission(permissions, ["work_order"], ["create"]);
  next["Work Orders"]["Edit"] = anyBackendPermission(permissions, ["work_order"], ["update"]);
  next["Work Orders"]["Delete"] = anyBackendPermission(permissions, ["work_order"], ["delete"]);
  next["Work Orders"]["Approval"] = anyBackendPermission(permissions, ["work_order"], ["approve"]);
  next["Work Orders"]["Download Report"] = anyBackendPermission(permissions, ["work_order"], ["download_report"]);

  next["QC Dashboard"]["View"] = anyBackendPermission(permissions, ["qc"], ["view"]);
  next["Production Dashboard"]["View"] = anyBackendPermission(permissions, ["production"], ["view"]);
  next["Production Dashboard"]["Action UI"] = anyBackendPermission(permissions, ["action_ui"], ["view"]);

  for (const featureKey of [
    "Raw Materials",
    "Indirect Raw Material",
    "Sub Con Raw Materials",
    "Finished Goods",
    "Scrap Stock",
  ]) {
    next[featureKey]["View"] = anyBackendPermission(permissions, ["inventory"], ["view"]);
    if (next[featureKey]["Create"] !== undefined) next[featureKey]["Create"] = anyBackendPermission(permissions, ["inventory"], ["create"]);
    if (next[featureKey]["Edit"] !== undefined) next[featureKey]["Edit"] = anyBackendPermission(permissions, ["inventory"], ["update"]);
    if (next[featureKey]["Delete"] !== undefined) next[featureKey]["Delete"] = anyBackendPermission(permissions, ["inventory"], ["delete"]);
    if (next[featureKey]["Download Report"] !== undefined) next[featureKey]["Download Report"] = anyBackendPermission(permissions, ["inventory"], ["download_report"]);
    if (next[featureKey]["Approval"] !== undefined) next[featureKey]["Approval"] = anyBackendPermission(permissions, ["inventory"], ["approve"]);
  }

  for (const featureKey of ["PO - Raw Materials", "PO - Indirect", "PO - Sub Con"]) {
    next[featureKey]["View"] = anyBackendPermission(permissions, ["procurement"], ["view"]);
    next[featureKey]["Create"] = anyBackendPermission(permissions, ["procurement"], ["create"]);
    next[featureKey]["Edit"] = anyBackendPermission(permissions, ["procurement"], ["update"]);
  }

  for (const featureKey of ["Customer PO & DN", "DN - Raw Material", "DN - Indirect", "DN - Sub Con", "Delivery Scheduling"]) {
    next[featureKey]["View"] = anyBackendPermission(permissions, ["delivery_note"], ["view"]);
    next[featureKey]["Create"] = anyBackendPermission(permissions, ["delivery_note"], ["create"]);
    next[featureKey]["Edit"] = anyBackendPermission(permissions, ["delivery_note"], ["update"]);
    next[featureKey]["Delete"] = anyBackendPermission(permissions, ["delivery_note"], ["delete"]);
    if (next[featureKey]["Action UI"] !== undefined) next[featureKey]["Action UI"] = anyBackendPermission(permissions, ["action_ui"], ["view"]);
  }

  next["Employee & Dept"]["View"] = anyBackendPermission(permissions, ["employee", "department"], ["view"]);

  next["Shop Floor"]["View"] = anyBackendPermission(permissions, ["manufacturing"], ["view"]);
  next["Shop Floor"]["Create"] = anyBackendPermission(permissions, ["manufacturing"], ["create_wo"]);
  next["Shop Floor"]["Edit"] = anyBackendPermission(permissions, ["manufacturing", "production"], ["production_plan", "update"]);

  next["System Settings"]["View"] = anyBackendPermission(permissions, [...SYSTEM_SETTINGS_BACKEND_KEYS], ["view"]);
  next["System Settings"]["Create"] = anyBackendPermission(permissions, [...SYSTEM_SETTINGS_BACKEND_KEYS], ["create"]);
  next["System Settings"]["Edit"] = anyBackendPermission(permissions, [...SYSTEM_SETTINGS_BACKEND_KEYS], ["update"]);
  next["System Settings"]["Delete"] = anyBackendPermission(permissions, [...SYSTEM_SETTINGS_BACKEND_KEYS], ["delete"]);
  next["System Settings"]["Approval"] = anyBackendPermission(permissions, ["approval_workflow"], ["approve"]);

  return next;
};

const buildDefaultPermissions = (
  features: FeatureConfig[],
  checked = false
) => {
  const next: UiPermissions = {};
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
  const [permissions, setPermissions] = useState<UiPermissions>({});
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

  useEffect(() => {
    if (!id) {
      setPermissions(buildDefaultPermissions(FEATURES));
      return;
    }
    if (!role) return;
    setPermissions(fromBackendPermissions((role.permissions ?? role.Permissions ?? {}) as RolePermissions));
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

      const backendPermissions = toBackendPermissions(permissions);

      if (mode === "edit") {
        if (!id) throw new Error("Missing role id");
        await updateRole({
          id,
          body: {
            name: normalizedName,
            description: normalizedDescription || "",
            permissions: backendPermissions,
          },
        }).unwrap();
        message.success("Role updated");
        router.push("/system-settings");
        return;
      }

      await createRole({
        name: normalizedName,
        description: normalizedDescription || "",
        permissions: backendPermissions,
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
