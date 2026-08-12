"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Form, Input, InputNumber, Select, message, notification } from "antd";
import {
  ArrowLeftOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useCreateEmployeeMutation,
  useGetDepartmentsQuery,
  useGetEmployeesQuery,
  useGetRolesQuery,
} from "@/lib/api/system-settings/api";

type EmployeeRow = {
  key: string;
  empId: string;
  name: string;
  isManager: boolean;
  jobTitle: string;
  jobLevel: string;
  email: string;
  phone: string;
  department: string;
  manager: string;
  role: string;
  roleHint: string;
  joinDate: string;
  status: "Active" | "Inactive";
};

type DepartmentRow = {
  key: string;
  name: string;
  head: string;
  employeeCount: number;
  status: "Active" | "Inactive";
};

const STORAGE_EMPLOYEES = "ai-erp-employees";
const STORAGE_DEPARTMENTS = "ai-erp-departments";

const DEFAULT_DEPARTMENTS: DepartmentRow[] = [
  { key: "dept-1", name: "Production", head: "John Smith", employeeCount: 12, status: "Active" },
  { key: "dept-2", name: "Quality Control", head: "Jane Doe", employeeCount: 8, status: "Active" },
  { key: "dept-3", name: "Manufacturing", head: "Mike Johnson", employeeCount: 15, status: "Active" },
  { key: "dept-4", name: "PPIC", head: "Sarah Wilson", employeeCount: 6, status: "Active" },
  { key: "dept-5", name: "Operations", head: "David Chen", employeeCount: 5, status: "Active" },
];

const todayMMDDYYYY = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const nextEmployeeId = (existing: EmployeeRow[]) => {
  const nums = existing
    .map((e) => e.empId)
    .map((id) => {
      const match = id.match(/(\d+)$/);
      return match ? Number(match[1]) : null;
    })
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `EMP-2024-${String(next).padStart(3, "0")}`;
};

export default function AddEmployeePage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const apiEnabled = Boolean(apiBaseUrl);
  const [createEmployee, createEmployeeState] = useCreateEmployeeMutation();
  const { data: employeesApiData = [] } = useGetEmployeesQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: departmentsApiData = [] } = useGetDepartmentsQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: rolesApiData = [] } = useGetRolesQuery(undefined, {
    skip: !apiEnabled,
  });

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);

  useEffect(() => {
    try {
      const rawEmployees = localStorage.getItem(STORAGE_EMPLOYEES);
      const rawDepartments = localStorage.getItem(STORAGE_DEPARTMENTS);

      if (rawEmployees) {
        setEmployees(JSON.parse(rawEmployees) as EmployeeRow[]);
      } else {
        localStorage.setItem(STORAGE_EMPLOYEES, JSON.stringify([]));
        setEmployees([]);
      }

      if (rawDepartments) {
        setDepartments(JSON.parse(rawDepartments) as DepartmentRow[]);
      } else {
        localStorage.setItem(STORAGE_DEPARTMENTS, JSON.stringify(DEFAULT_DEPARTMENTS));
        setDepartments(DEFAULT_DEPARTMENTS);
      }
    } catch {
      // ignore
    }
  }, []);

  const generatedEmpId = useMemo(() => nextEmployeeId(employees), [employees]);

  const generatedApiEmpId = useMemo(() => {
    if (!apiEnabled) return generatedEmpId;
    const nums = employeesApiData
      .map((e) => e.employee_id)
      .map((id) => {
        const match = String(id).match(/(\d+)$/);
        return match ? Number(match[1]) : null;
      })
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `EMP-2026-${String(next).padStart(3, "0")}`;
  }, [apiEnabled, employeesApiData, generatedEmpId]);

  useEffect(() => {
    form.setFieldsValue({ empId: generatedApiEmpId });
  }, [form, generatedApiEmpId]);

  const departmentOptions = useMemo(
    () =>
      apiEnabled
        ? departmentsApiData.map((d) => ({ label: d.department_name, value: d.id }))
        : departments.map((d) => ({ label: d.name, value: d.name })),
    [apiEnabled, departments, departmentsApiData]
  );

  const roleOptions = useMemo(
    () => rolesApiData.map((r) => ({ label: r.name, value: r.id })),
    [rolesApiData]
  );

  const toISOStringSafe = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === "string") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof value === "object" && value && "toISOString" in value) {
      const fn = (value as any).toISOString;
      if (typeof fn === "function") {
        const out = fn.call(value);
        return typeof out === "string" ? out : null;
      }
    }
    return null;
  };

  const managerRoleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rolesApiData) {
      const name = String(r?.name ?? "").toLowerCase();
      if (name.includes("manager")) ids.add(String(r.id));
    }
    return ids;
  }, [rolesApiData]);

  // Reports To dropdown — disamakan dengan dropdown pada halaman edit
  // (page.tsx: reportsToOptionsApi). Menampilkan SEMUA employee (tidak
  // di-filter khusus role "manager"), value berupa string ID, dan opsi
  // "Top Level" (null) berada di paling atas.
  const supervisorOptions = useMemo(() => {
    if (!apiEnabled) {
      return [
        { label: "Top Level", value: "Top Level" },
        ...employees.map((e) => ({ label: e.name, value: e.name })),
      ];
    }

    return [
      { label: "Top Level", value: null },
      ...employeesApiData.map((e) => ({
        label: e.full_name,
        value: String(e.id),
      })),
    ];
  }, [apiEnabled, employees, employeesApiData]);

  const employmentStatusOptions = [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ];

  const positionOptions = [
    { label: "Operator", value: "Operator" },
    { label: "Staff", value: "Staff" },
    { label: "Supervisor", value: "Supervisor" },
    { label: "Manager", value: "Manager" },
    { label: "Department Head", value: "Department Head" },
    { label: "Director", value: "Director" },
  ];

  const onCreate = async () => {
    try {
      const values = await form.validateFields();

      if (apiEnabled) {
        await createEmployee({
          employee_id: values.empId,
          full_name: values.fullName,
          email: values.workEmail || null,
          phone_number: values.phoneNumber || null,
          job_title: values.jobTitle || null,
          status: values.employmentStatus || "active",
          unit_cost: values.unitCost != null ? Number(values.unitCost) : null,
          join_date: toISOStringSafe(values.joinDate),
          role_id: values.roleId ?? null,
          department_id: values.departmentId ?? null,
          reports_to_id: values.reportsToId ?? null,
          notes: values.employeeNotes ? String(values.employeeNotes) : null,
        }).unwrap();

        message.success("Employee created");
        if (typeof values.workEmail === "string" && values.workEmail.trim()) {
          notification.success({
            message: "email berhasil dikirim",
            placement: "topRight",
          });
        }
        router.push("/employee-dept");
        return;
      }

      const isManager =
        values.positionRole === "Manager" ||
        values.positionRole === "Department Head" ||
        values.positionRole === "Director";

      const newEmployee: EmployeeRow = {
        key: `emp-${Date.now()}`,
        empId: values.empId,
        name: values.fullName,
        isManager,
        jobTitle: values.jobTitle,
        jobLevel: values.positionRole || "Staff",
        email: values.workEmail,
        phone: values.phoneNumber,
        department: values.department,
        manager: values.reportsTo || "Top Level",
        role: values.positionRole || "Staff",
        roleHint: "Role-based Access",
        joinDate: todayMMDDYYYY(),
        status: values.employmentStatus === "inactive" ? "Inactive" : "Active",
      };

      const updated = [newEmployee, ...employees];
      localStorage.setItem(STORAGE_EMPLOYEES, JSON.stringify(updated));

      message.success("Employee created");
      router.push("/employee-dept");
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to create employee"));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => router.push("/employee-dept")}
          >
            <ArrowLeftOutlined />
            <span>Back to Employee Management</span>
          </button>

          <div className="flex items-center gap-2">
            <Button className="!rounded-lg" onClick={() => router.push("/employee-dept")}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<SaveOutlined />}
              onClick={onCreate}
              loading={createEmployeeState.isLoading}
            >
              Create Employee
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">Add New Employee</div>
          <div className="text-sm text-gray-500">Create employee record with role assignment and access control</div>
        </div>
      </div>

      <Form form={form} layout="vertical">
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Basic Information</div>
            <div className="text-xs text-gray-500 mt-1">Configure employee personal and contact details</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="empId" label="Employee ID" rules={[{ required: true }]}>
                <Input className="!rounded-lg" disabled placeholder="EMP-2024-006" />
              </Form.Item>
              <Form.Item name="fullName" label="Full Name" rules={[{ required: true, message: "Enter employee full name" }]}>
                <Input className="!rounded-lg" placeholder="Enter employee full name" />
              </Form.Item>

              <div className="-mt-3 text-xs text-gray-400 md:col-span-1">Auto-generated on save</div>
              <div className="hidden md:block" />

              <Form.Item name="workEmail" label="Work Email Address" rules={[{ required: true, type: "email", message: "Enter work email address" }]}>
                <Input className="!rounded-lg" placeholder="Enter work email address" />
              </Form.Item>
              <Form.Item name="phoneNumber" label="Phone Number" rules={[{ required: true, message: "Enter phone number" }]}>
                <Input className="!rounded-lg" placeholder="Enter phone number" />
              </Form.Item>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Job Information</div>
            <div className="text-xs text-gray-500 mt-1">Configure job title, department, and organizational hierarchy</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="jobTitle" label="Job Title" rules={[{ required: true, message: "Enter job title" }]}>
                <Input className="!rounded-lg" placeholder="Enter job title" />
              </Form.Item>
              <Form.Item
                name={apiEnabled ? "departmentId" : "department"}
                label="Department"
              >
                <Select
                  className="!rounded-lg"
                  placeholder="Select department (optional)"
                  options={departmentOptions}
                  allowClear
                />
              </Form.Item>

              {apiEnabled ? (
                <Form.Item name="roleId" label="Role" rules={[{ required: true, message: "Select role" }]}>
                  <Select
                    className="!rounded-lg"
                    placeholder="Select role (optional)"
                    options={roleOptions}
                    allowClear
                  />
                </Form.Item>
              ) : (
                <Form.Item name="positionRole" label="Position/Role" rules={[{ required: true, message: "Select position" }]}> 
                  <Select className="!rounded-lg" placeholder="Select position" options={positionOptions} />
                </Form.Item>
              )}
              <Form.Item
                name={apiEnabled ? "reportsToId" : "reportsTo"}
                label="Reports To"
                rules={apiEnabled ? [{ required: false }] : [{ required: true, message: "Select supervisor" }]}
              >
                <Select
                  className="!rounded-lg"
                  placeholder="Select manager"
                  options={supervisorOptions}
                  allowClear
                />
              </Form.Item>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Employment Details</div>
            <div className="text-xs text-gray-500 mt-1">Configure employment status, schedule, and access permissions</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="employmentStatus" label="Employment Status" rules={[{ required: true, message: "Select status" }]}>
                <Select className="!rounded-lg" placeholder="Select status" options={employmentStatusOptions} />
              </Form.Item>
              <Form.Item name="joinDate" label="Join Date" rules={apiEnabled ? [{ required: true, message: "Select join date" }] : undefined}>
                <DatePicker className="!rounded-lg w-full" placeholder="Select join date" />
              </Form.Item>
              <Form.Item name="unitCost" label="Unit Cost">
                <InputNumber className="!rounded-lg w-full" min={0} addonAfter="Rupiah/hour" placeholder="0" />
              </Form.Item>
            </div>

            <Form.Item name="employeeNotes" label="Employee Notes">
              <Input.TextArea
                className="!rounded-lg"
                rows={4}
                placeholder="Enter skills, certifications, special training, additional notes..."
              />
            </Form.Item>
          </div>
        </div>
      </Form>
    </div>
  );
}
