"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Form, Input, Typography, message } from "antd";

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

export default function RoleCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form] = Form.useForm<FormValues>();

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
      form.setFieldsValue({
        permissionsJson: stringifyPretty({
          Dashboard: { view: true },
          BOM: { view: true, create: false, update: false, delete: false },
        }),
      });
      return;
    }

    if (!role) return;

    form.setFieldsValue({
      name: role.name,
      description: role.description ?? "",
      permissionsJson: stringifyPretty(role.permissions ?? role.Permissions ?? {}),
    });
  }, [form, id, role]);

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      const permissions = parsePermissions(values.permissionsJson);

      if (mode === "edit") {
        if (!id) throw new Error("Missing role id");
        await updateRole({
          id,
          body: {
            name: values.name,
            description: values.description || "",
            permissions,
          },
        }).unwrap();
        message.success("Role updated");
        router.push("/system-settings");
        return;
      }

      await createRole({
        name: values.name,
        description: values.description || "",
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
              permissionsJson: "{}",
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="name" label="Role Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Production Supervisor" className="!rounded-lg" />
              </Form.Item>

              <Form.Item name="description" label="Description">
                <Input placeholder="Optional" className="!rounded-lg" />
              </Form.Item>
            </div>

            <Form.Item
              name="permissionsJson"
              label="Permissions (JSON)"
              rules={[
                { required: true, message: "Permissions are required" },
                {
                  validator: async (_, value) => {
                    parsePermissions(String(value ?? ""));
                  },
                },
              ]}
            >
              <Input.TextArea
                rows={14}
                className="!rounded-lg font-mono"
                placeholder={stringifyPretty({
                  BOM: { view: true, create: false, update: false, delete: false },
                })}
              />
            </Form.Item>

            {mode !== "create" ? (
              <Text type="secondary">
                {isFetching ? "Loading role..." : id ? `Role ID: ${id}` : null}
              </Text>
            ) : null}
          </Form>
        </Card>
      </div>
    </div>
  );
}
