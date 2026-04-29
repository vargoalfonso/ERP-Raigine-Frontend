"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Select, message } from "antd";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useCreateAccessControlMatrixMutation,
  useGetDepartmentsQuery,
  useGetEmployeesQuery,
  useGetRolesQuery,
} from "@/lib/api/system-settings/api";

type UserAccessEntry = {
  key: string;
  fullName?: string;
  employeeId?: string;
  departmentId?: string;
  roleId?: string;
};

export default function AddUserAccessControlPage() {
  const router = useRouter();
  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);

  const [entries, setEntries] = useState<UserAccessEntry[]>([{ key: "1" }]);
  const [forms] = useState(() => new Map<string, ReturnType<typeof Form.useForm>[0]>());

  const { data: employeesData = [] } = useGetEmployeesQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: departmentsData = [] } = useGetDepartmentsQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: rolesData = [] } = useGetRolesQuery(undefined, {
    skip: !apiEnabled,
  });
  const [createAccessControl] = useCreateAccessControlMatrixMutation();

  const employeeOptions = useMemo(
    () =>
      (apiEnabled ? employeesData : [])
        .map((employee) => ({
          label: `${employee.full_name} (${employee.employee_id ?? employee.id})`,
          value: String(employee.employee_id ?? employee.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [apiEnabled, employeesData]
  );

  const departmentOptions = useMemo(
    () =>
      (apiEnabled ? departmentsData : [])
        .map((department) => ({
          label: String(department.department_name),
          value: String(department.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [apiEnabled, departmentsData]
  );

  const roleOptions = useMemo(
    () =>
      (apiEnabled ? rolesData : [])
        .map((role) => ({ label: String(role.name), value: String(role.id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [apiEnabled, rolesData]
  );

  const employeeNameById = useMemo(() => {
    if (!apiEnabled) return {} as Record<string, string>;
    return (employeesData ?? []).reduce<Record<string, string>>((acc, employee) => {
      const key = String(employee.employee_id ?? employee.id);
      if (employee.full_name) acc[key] = employee.full_name;
      return acc;
    }, {});
  }, [apiEnabled, employeesData]);

  const employeeDepartmentById = useMemo(() => {
    if (!apiEnabled) return {} as Record<string, string>;
    return (employeesData ?? []).reduce<Record<string, string>>((acc, employee) => {
      const key = String(employee.employee_id ?? employee.id);
      if (employee.department_id != null) acc[key] = String(employee.department_id);
      return acc;
    }, {});
  }, [apiEnabled, employeesData]);

  const completeCount = useMemo(() => {
    return entries.reduce((count, entry) => {
      const isComplete =
        !!entry.fullName &&
        !!entry.employeeId &&
        !!entry.departmentId &&
        !!entry.roleId;
      return count + (isComplete ? 1 : 0);
    }, 0);
  }, [entries]);

  const setEntryPatch = (key: string, patch: Partial<UserAccessEntry>) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, { key: String(prev.length + 1) }]);
  };

  const handleSave = async () => {
    try {
      for (const entry of entries) {
        const form = forms.get(entry.key);
        if (form) {
          await form.validateFields();
        }
      }

      if (apiEnabled) {
        for (const entry of entries) {
          await createAccessControl({
            full_name: String(entry.fullName ?? ""),
            employee_id: String(entry.employeeId ?? ""),
            department_id: String(entry.departmentId ?? ""),
            role_id: String(entry.roleId ?? ""),
            status: "active",
          }).unwrap();
        }

        message.success("User access entries created");
      } else {
        message.success("User access saved locally");
      }

      router.push("/system-settings");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save user access"));
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      <div className="border-b border-gray-200 bg-white px-8 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
              onClick={() => router.push("/system-settings")}
            >
              <ArrowLeftOutlined />
              <span>Back to System Settings</span>
            </button>

            <div className="h-6 w-px bg-gray-200" />

            <div>
              <div className="text-2xl font-semibold text-gray-900">Add User Access Control</div>
              <div className="text-sm text-gray-500">
                Create multiple user in bulk <span className="mx-2">•</span> {entries.length} entry{entries.length > 1 ? "ies" : ""}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="large" className="rounded-xl" onClick={() => router.push("/system-settings")}>
              Cancel
            </Button>
            <Button size="large" type="primary" className="rounded-xl" icon={<SaveOutlined />} onClick={handleSave}>
              Save User Access
            </Button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="mx-auto max-w-[1120px] space-y-6">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-blue-700 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-base">↗</div>
              <div>
                <div className="font-semibold">Multiple User Access</div>
                <div className="mt-1 text-sm text-blue-700/90">
                  Add new users to the system quickly and securely. Each user will be granted access based on the role you assign. You can add more users using the "Add Another User" button.
                </div>
              </div>
            </div>
          </div>

          {entries.map((entry, idx) => (
            <Card
              key={entry.key}
              className="rounded-2xl border border-gray-200 shadow-sm"
              styles={{ body: { padding: 20 } }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[18px] font-semibold text-gray-900">User #{idx + 1}</div>
                  <div className="text-sm text-gray-500">Configure user permissions and access levels</div>
                </div>
                <div className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500">
                  Entry {idx + 1}
                </div>
              </div>

              <div className="mt-8">
                <UserEntryForm
                  entry={entry}
                  onChange={(patch) => setEntryPatch(entry.key, patch)}
                  onFormReady={(form) => forms.set(entry.key, form)}
                  employeeOptions={employeeOptions}
                  departmentOptions={departmentOptions}
                    roleOptions={roleOptions}
                    employeeNameById={employeeNameById}
                    employeeDepartmentById={employeeDepartmentById}
                />
              </div>
            </Card>
          ))}

          <div className="flex justify-center">
            <Button
              icon={<PlusOutlined />}
              size="large"
              className="rounded-xl border-gray-200 px-6"
              onClick={addAnother}
            >
              Add Another User
            </Button>
          </div>

          <Card className="rounded-2xl border border-gray-200 shadow-sm" styles={{ body: { padding: 14 } }}>
            <div className="flex flex-wrap items-center justify-between gap-4 px-1">
              <div>
                <div className="text-[18px] font-semibold text-gray-900">Summary</div>
                <div className="text-sm text-gray-500">{entries.length} User Access ready to be saved</div>
              </div>
              <div className="flex items-center gap-10 pr-2">
                <div className="text-right">
                  <div className="text-[30px] font-semibold leading-none text-gray-900">{entries.length}</div>
                  <div className="mt-1 text-xs text-gray-500">Entries</div>
                </div>
                <div className="text-right">
                  <div className="text-[30px] font-semibold leading-none text-gray-900">{completeCount}</div>
                  <div className="mt-1 text-xs text-gray-500">Complete</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function UserEntryForm({
  entry,
  onChange,
  onFormReady,
  employeeOptions,
  departmentOptions,
  roleOptions,
  employeeNameById,
  employeeDepartmentById,
}: {
  entry: UserAccessEntry;
  onChange: (patch: Partial<UserAccessEntry>) => void;
  onFormReady: (form: ReturnType<typeof Form.useForm>[0]) => void;
  employeeOptions: { label: string; value: string }[];
  departmentOptions: { label: string; value: string }[];
  roleOptions: { label: string; value: string }[];
  employeeNameById: Record<string, string>;
  employeeDepartmentById: Record<string, string>;
}) {
  const [form] = Form.useForm();
  const selectedEmployeeId = Form.useWatch("employeeId", form);

  React.useEffect(() => {
    onFormReady(form);
  }, [form, onFormReady]);

  React.useEffect(() => {
    if (!selectedEmployeeId) return;
    const key = String(selectedEmployeeId);
    const employeeName = employeeNameById[key];
    if (employeeName) {
      const currentName = form.getFieldValue("fullName");
      if (!currentName || currentName !== employeeName) {
        form.setFieldsValue({ fullName: employeeName });
        onChange({ fullName: employeeName });
      }
    }

    const employeeDept = employeeDepartmentById[key];
    if (employeeDept) {
      const currentDept = form.getFieldValue("departmentId");
      if (!currentDept || String(currentDept) !== String(employeeDept)) {
        form.setFieldsValue({ departmentId: String(employeeDept) });
        onChange({ departmentId: String(employeeDept) });
      }
    }
  }, [selectedEmployeeId, employeeNameById, employeeDepartmentById, form, onChange]);


  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      colon={false}
      initialValues={{
        fullName: entry.fullName,
        employeeId: entry.employeeId,
        departmentId: entry.departmentId,
        roleId: entry.roleId,
      }}
      onValuesChange={(_, values) => {
        onChange(values);
      }}
    >
      <div className="grid grid-cols-1 gap-x-5 gap-y-1 md:grid-cols-2">
        <Form.Item
          label={<span className="text-sm font-medium text-gray-700">Employee ID</span>}
          name="employeeId"
          rules={[{ required: true, message: "Employee ID is required" }]}
        >
          <Select
            size="large"
            className="rounded-xl"
            placeholder="Select employee ID"
            options={employeeOptions}
            showSearch
            filterOption={(input, option) =>
              String(option?.label ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item
          label={<span className="text-sm font-medium text-gray-700">Full Name</span>}
          name="fullName"
          rules={[{ required: true, message: "Full Name is required" }]}
        >
          <Input size="large" className="rounded-xl" placeholder="Enter Full Name" />
        </Form.Item>

        

        <Form.Item
          label={<span className="text-sm font-medium text-gray-700">Department</span>}
          name="departmentId"
          rules={[{ required: true, message: "Department is required" }]}
        >
          <Select
            size="large"
            className="rounded-xl"
            placeholder="Select department"
            options={departmentOptions}
            showSearch
            filterOption={(input, option) =>
              String(option?.label ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item
          label={<span className="text-sm font-medium text-gray-700">Role</span>}
          name="roleId"
          rules={[{ required: true, message: "Role is required" }]}
        >
          <Select
            size="large"
            className="rounded-xl"
            placeholder="Select role"
            options={roleOptions}
            showSearch
            filterOption={(input, option) =>
              String(option?.label ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          />
        </Form.Item>
      </div>
    </Form>
  );
}
