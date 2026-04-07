"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Form, Input, Select, message } from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useCreateDepartmentMutation,
  useGetDepartmentsQuery,
  useGetEmployeesQuery,
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
  code?: string;
  name: string;
  head: string;
  parentDepartment?: string;
  description?: string;
  employeeCount: number;
  status: "Active" | "Inactive";
};

const STORAGE_EMPLOYEES = "ai-erp-employees";
const STORAGE_DEPARTMENTS = "ai-erp-departments";

const DEFAULT_DEPARTMENTS: DepartmentRow[] = [
  { key: "dept-1", code: "DEPT-001", name: "Production", head: "John Smith", employeeCount: 12, status: "Active" },
  { key: "dept-2", code: "DEPT-002", name: "Quality Control", head: "Jane Doe", employeeCount: 8, status: "Active" },
  { key: "dept-3", code: "DEPT-003", name: "Manufacturing", head: "Mike Johnson", employeeCount: 15, status: "Active" },
  { key: "dept-4", code: "DEPT-004", name: "PPIC", head: "Sarah Wilson", employeeCount: 6, status: "Active" },
  { key: "dept-5", code: "DEPT-005", name: "Operations", head: "David Chen", employeeCount: 5, status: "Active" },
];

const nextDeptCode = (existing: DepartmentRow[]) => {
  const nums = existing
    .map((d) => d.code)
    .filter((c): c is string => Boolean(c))
    .map((code) => {
      const m = code.match(/(\d+)$/);
      return m ? Number(m[1]) : null;
    })
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `DEPT-${String(next).padStart(3, "0")}`;
};

export default function AddDepartmentPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const apiEnabled = Boolean(apiBaseUrl);
  const [createDepartment, createDepartmentState] = useCreateDepartmentMutation();
  const { data: departmentApiData = [] } = useGetDepartmentsQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: employeesApiData = [] } = useGetEmployeesQuery(undefined, {
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

  const generatedCode = useMemo(() => nextDeptCode(departments), [departments]);

  useEffect(() => {
    form.setFieldsValue({ departmentCode: generatedCode });
  }, [form, generatedCode]);

  const managerOptions = useMemo(
    () =>
      apiEnabled
        ? employeesApiData.map((e) => ({ label: e.full_name, value: e.full_name }))
        : employees.map((e) => ({ label: e.name, value: e.name })),
    [apiEnabled, employees, employeesApiData]
  );

  const parentOptions = useMemo(
    () =>
      apiEnabled
        ? departmentApiData.map((d) => ({ label: d.department_name, value: d.id }))
        : departments.map((d) => ({ label: d.name, value: d.name })),
    [apiEnabled, departmentApiData, departments]
  );

  const onCreate = async () => {
    try {
      const values = await form.validateFields();

      if (apiEnabled) {
        await createDepartment({
          department_name: values.departmentName,
          description: values.departmentDescription || null,
          parent_department_id: values.parentDepartment || null,
        }).unwrap();

        message.success("Department created");
        router.push("/employee-dept?tab=department");
        return;
      }

      const newDept: DepartmentRow = {
        key: `dept-${Date.now()}`,
        code: values.departmentCode,
        name: values.departmentName,
        head: values.departmentManager,
        parentDepartment: values.parentDepartment || undefined,
        description: values.departmentDescription || undefined,
        employeeCount: 0,
        status: "Active",
      };

      const updated = [newDept, ...departments];
      localStorage.setItem(STORAGE_DEPARTMENTS, JSON.stringify(updated));

      message.success("Department created");
      router.push("/employee-dept?tab=department");
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to create department"));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => router.push("/employee-dept?tab=department")}
          >
            <ArrowLeftOutlined />
            <span>Back to Employee Management</span>
          </button>

          <div className="flex items-center gap-2">
            <Button className="!rounded-lg" onClick={() => router.push("/employee-dept?tab=department")}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<SaveOutlined />}
              onClick={onCreate}
              loading={createDepartmentState.isLoading}
            >
              Create Department
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">Add New Department</div>
          <div className="text-sm text-gray-500">Create department with manager assignment and organizational hierarchy</div>
        </div>
      </div>

      <Form form={form} layout="vertical">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-sm font-semibold text-gray-900">Department Information</div>
          <div className="text-xs text-gray-500 mt-1">Configure department details and organizational structure</div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Form.Item name="departmentCode" label="Department Code" rules={[{ required: true }]}>
                <Input className="!rounded-lg" disabled placeholder="DEPT-006" />
              </Form.Item>
              <div className="-mt-3 text-xs text-gray-400">Auto-generated on save</div>
            </div>

            <Form.Item
              name="departmentName"
              label="Department Name"
              rules={[{ required: true, message: "Enter department name" }]}
            >
              <Input className="!rounded-lg" placeholder="Enter department name" />
            </Form.Item>

            <Form.Item
              name="departmentManager"
              label="Department Manager"
              rules={[{ required: true, message: "Select manager" }]}
            >
              <Select
                className="!rounded-lg"
                placeholder="Select manager"
                options={managerOptions}
              />
            </Form.Item>

            <Form.Item name="parentDepartment" label="Parent Department">
              <Select
                className="!rounded-lg"
                placeholder="Select parent"
                allowClear
                options={parentOptions}
              />
            </Form.Item>
          </div>

          <Form.Item name="departmentDescription" label="Department Description">
            <Input.TextArea
              className="!rounded-lg"
              rows={4}
              placeholder="Enter department responsibilities, functions, and scope of work..."
            />
          </Form.Item>
        </div>
      </Form>
    </div>
  );
}
