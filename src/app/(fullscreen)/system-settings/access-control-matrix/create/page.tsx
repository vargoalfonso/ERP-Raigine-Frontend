"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Select, message } from "antd";

type UserAccessEntry = {
  key: string;
  fullName?: string;
  employeeId?: string;
  department?: string;
  role?: string;
};

const departmentOptions = [
  "Production",
  "Quality",
  "Warehouse",
  "Planning",
  "Procurement",
].map((v) => ({ label: v, value: v }));

const roleOptions = [
  "Supervisor",
  "QC Inspector",
  "Warehouse Manager",
  "Production Planner",
  "Buyer",
].map((v) => ({ label: v, value: v }));

const employeeIdOptions = ["EMP-001", "EMP-002", "EMP-003", "EMP-004", "EMP-005"].map(
  (v) => ({ label: v, value: v })
);

export default function AddUserAccessControlPage() {
  const router = useRouter();

  const [entries, setEntries] = useState<UserAccessEntry[]>([{ key: "1" }]);
  const [forms] = useState(() => new Map<string, ReturnType<typeof Form.useForm>[0]>());

  const completeCount = useMemo(() => {
    return entries.reduce((count, entry) => {
      const isComplete =
        !!entry.fullName &&
        !!entry.employeeId &&
        !!entry.department &&
        !!entry.role;
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
    // Validate all entry forms
    for (const entry of entries) {
      const form = forms.get(entry.key);
      if (form) {
        await form.validateFields();
      }
    }

    message.success("User access saved");
    router.push("/system-settings");
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="bg-white border-b px-8 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              onClick={() => router.push("/system-settings")}
            >
              <ArrowLeftOutlined />
              <span>Back to System Settings</span>
            </button>

            <div className="h-6 w-px bg-gray-200" />

            <div>
              <div className="text-2xl font-semibold text-gray-900">Add User Access Control</div>
              <div className="text-sm text-gray-500">
                Create multiple user in bulk <span className="mx-2">•</span> {entries.length} entry
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => router.push("/system-settings")}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              Save User Access
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className="border border-blue-100 bg-blue-50 rounded-2xl p-5">
          <div className="text-blue-700 font-semibold">Multiple User Access</div>
          <div className="text-blue-700/80 text-sm mt-1">
            Add new users to the system quickly and securely. Each user will be granted access based on the role you assign. You can add more users using the "Add Another User" button.
          </div>
        </div>

        {entries.map((entry, idx) => (
          <Card
            key={entry.key}
            className="rounded-2xl"
            styles={{ body: { padding: 24 } }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-gray-900">User #{idx + 1}</div>
                <div className="text-sm text-gray-500">Configure user permissions and access levels</div>
              </div>
              <div className="text-xs text-gray-500 border rounded-lg px-3 py-1">Entry {idx + 1}</div>
            </div>

            <div className="mt-6">
              <UserEntryForm
                entry={entry}
                onChange={(patch) => setEntryPatch(entry.key, patch)}
                onFormReady={(form) => forms.set(entry.key, form)}
              />
            </div>
          </Card>
        ))}

        <div className="flex justify-center">
          <Button icon={<PlusOutlined />} className="rounded-xl" onClick={addAnother}>
            Add Another User
          </Button>
        </div>

        <Card className="rounded-2xl" styles={{ body: { padding: 20 } }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="font-semibold text-gray-900">Summary</div>
              <div className="text-sm text-gray-500">{entries.length} User Access ready to be saved</div>
            </div>
            <div className="flex items-center gap-10">
              <div className="text-right">
                <div className="text-xl font-semibold text-gray-900">{entries.length}</div>
                <div className="text-xs text-gray-500">Entries</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold text-gray-900">{completeCount}</div>
                <div className="text-xs text-gray-500">Complete</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function UserEntryForm({
  entry,
  onChange,
  onFormReady,
}: {
  entry: UserAccessEntry;
  onChange: (patch: Partial<UserAccessEntry>) => void;
  onFormReady: (form: ReturnType<typeof Form.useForm>[0]) => void;
}) {
  const [form] = Form.useForm();

  // expose form instance once
  React.useEffect(() => {
    onFormReady(form);
  }, [form, onFormReady]);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        fullName: entry.fullName,
        employeeId: entry.employeeId,
        department: entry.department,
        role: entry.role,
      }}
      onValuesChange={(_, values) => {
        onChange(values);
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Form.Item label="Full Name" name="fullName" rules={[{ required: true }]}>
          <Input placeholder="Enter Full Name" />
        </Form.Item>

        <Form.Item label="Employee ID" name="employeeId" rules={[{ required: true }]}>
          <Select
            placeholder="Select employee"
            options={employeeIdOptions}
            showSearch
            filterOption={(input, option) =>
              String(option?.label ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item label="Department" name="department" rules={[{ required: true }]}>
          <Select placeholder="Select department" options={departmentOptions} />
        </Form.Item>

        <Form.Item label="Role" name="role" rules={[{ required: true }]}>
          <Select placeholder="Select Role" options={roleOptions} />
        </Form.Item>
      </div>
    </Form>
  );
}
