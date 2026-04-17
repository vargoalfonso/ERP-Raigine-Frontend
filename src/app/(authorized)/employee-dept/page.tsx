"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import {
  CrownOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";

import {
  type DepartmentRecord,
  useCreateAccessControlMatrixMutation,
  useCreateEmployeeMutation,
  useDeleteAccessControlMatrixMutation,
  useDeleteDepartmentMutation,
  useDeleteEmployeeMutation,
  useGetAccessControlMatrixQuery,
  useGetDepartmentsQuery,
  useGetEmployeeByIdQuery,
  useGetEmployeesQuery,
  useGetRolesQuery,
  useUpdateDepartmentMutation,
  useUpdateAccessControlMatrixMutation,
  useUpdateEmployeeMutation,
} from "@/lib/api/system-settings/api";
import { getApiErrorMessage } from "@/lib/api/error";

type TabKey = "employee" | "department";

type EmployeeRow = {
  key: string;
  apiId?: string;
  accessControlId?: string;
  departmentId?: string;
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
  roleId?: string;
  roleHint: string;
  joinDate: string;
  status: "Active" | "Inactive";
};

type DepartmentRow = {
  key: string;
  apiId?: string;
  parentDepartmentId?: string;
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

export default function EmployeeDeptPage() {
  return (
    <Suspense fallback={null}>
      <EmployeeDeptPageContent />
    </Suspense>
  );
}

function EmployeeDeptPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  const apiEnabled = Boolean(apiBaseUrl);

  const { data: employeesApiData, refetch: refetchEmployees } = useGetEmployeesQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: departmentsApiData, refetch: refetchDepartments } = useGetDepartmentsQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: accessControlApiData, refetch: refetchAccessControl } = useGetAccessControlMatrixQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: rolesApiData, refetch: refetchRoles } = useGetRolesQuery(undefined, {
    skip: !apiEnabled,
  });

  const [createEmployee] = useCreateEmployeeMutation();
  const [updateEmployee] = useUpdateEmployeeMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();
  const [updateDepartment] = useUpdateDepartmentMutation();
  const [deleteDepartment] = useDeleteDepartmentMutation();
  const [createAccessControl] = useCreateAccessControlMatrixMutation();
  const [updateAccessControl] = useUpdateAccessControlMatrixMutation();
  const [deleteAccessControl] = useDeleteAccessControlMatrixMutation();

  const [activeTab, setActiveTab] = useState<TabKey>("employee");
  const [viewDeptOpen, setViewDeptOpen] = useState(false);
  const [editDeptOpen, setEditDeptOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<DepartmentRow | null>(null);

  const [viewEmployeeOpen, setViewEmployeeOpen] = useState(false);
  const [editEmployeeOpen, setEditEmployeeOpen] = useState(false);
  const [deleteEmployeeOpen, setDeleteEmployeeOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);

  const { data: employeeDetailApiData } = useGetEmployeeByIdQuery(selectedEmployee?.apiId ?? "", {
    skip: !apiEnabled || !viewEmployeeOpen || !selectedEmployee?.apiId,
  });

  const { data: employeeEditApiData } = useGetEmployeeByIdQuery(selectedEmployee?.apiId ?? "", {
    skip: !apiEnabled || !editEmployeeOpen || !selectedEmployee?.apiId,
  });

  const [deptSearch, setDeptSearch] = useState("");
  const [deptStatus, setDeptStatus] = useState<"All" | DepartmentRow["status"]>("All");

  const [editDeptForm] = Form.useForm();
  const [editEmployeeForm] = Form.useForm();

  const defaultEmployees: EmployeeRow[] = [
    {
      key: "emp-001",
      empId: "EMP-001",
      name: "John Smith",
      isManager: true,
      jobTitle: "Production Manager",
      jobLevel: "Manager",
      email: "john.smith@company.com",
      phone: "+62-812-3456-7890",
      department: "Production",
      manager: "Sarah Wilson",
      role: "Production Manager",
      roleHint: "Full Production Access",
      joinDate: "3/15/2022",
      status: "Active",
    },
    {
      key: "emp-002",
      empId: "EMP-002",
      name: "Jane Doe",
      isManager: true,
      jobTitle: "Quality Control Supervisor",
      jobLevel: "Supervisor",
      email: "jane.doe@company.com",
      phone: "+62-812-3456-7891",
      department: "Quality Control",
      manager: "Mike Johnson",
      role: "QC Supervisor",
      roleHint: "QC Module Access",
      joinDate: "11/20/2021",
      status: "Active",
    },
    {
      key: "emp-003",
      empId: "EMP-003",
      name: "Mike Johnson",
      isManager: true,
      jobTitle: "Department Head - Manufacturing",
      jobLevel: "Department Head",
      email: "mike.johnson@company.com",
      phone: "+62-812-3456-7892",
      department: "Manufacturing",
      manager: "David Chen",
      role: "Department Head",
      roleHint: "Full Manufacturing Access",
      joinDate: "7/10/2020",
      status: "Active",
    },
    {
      key: "emp-004",
      empId: "EMP-004",
      name: "Sarah Wilson",
      isManager: false,
      jobTitle: "PPIC Coordinator",
      jobLevel: "Coordinator",
      email: "sarah.wilson@company.com",
      phone: "+62-812-3456-7893",
      department: "PPIC",
      manager: "David Chen",
      role: "PPIC Coordinator",
      roleHint: "Planning & Inventory Access",
      joinDate: "1/8/2023",
      status: "Active",
    },
    {
      key: "emp-005",
      empId: "EMP-005",
      name: "David Chen",
      isManager: true,
      jobTitle: "Operations Director",
      jobLevel: "Director",
      email: "david.chen@company.com",
      phone: "+62-812-3456-7894",
      department: "Operations",
      manager: "Top Level",
      role: "Operations Director",
      roleHint: "Full System Access",
      joinDate: "5/15/2019",
      status: "Active",
    },
  ];

  const defaultDepartments: DepartmentRow[] = [
    { key: "dept-1", code: "DEPT-001", name: "Production", head: "John Smith", employeeCount: 12, status: "Active" },
    { key: "dept-2", code: "DEPT-002", name: "Quality Control", head: "Jane Doe", employeeCount: 8, status: "Active" },
    { key: "dept-3", code: "DEPT-003", name: "Manufacturing", head: "Mike Johnson", employeeCount: 15, status: "Active" },
    { key: "dept-4", code: "DEPT-004", name: "PPIC", head: "Sarah Wilson", employeeCount: 6, status: "Active" },
    { key: "dept-5", code: "DEPT-005", name: "Operations", head: "David Chen", employeeCount: 5, status: "Active" },
  ];

  const [employees, setEmployees] = useState<EmployeeRow[]>(defaultEmployees);

  const [departments, setDepartments] = useState<DepartmentRow[]>(defaultDepartments);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (apiEnabled) {
      setHasLoaded(true);
      return;
    }
    try {
      const rawEmployees = localStorage.getItem(STORAGE_EMPLOYEES);
      const rawDepartments = localStorage.getItem(STORAGE_DEPARTMENTS);

      if (rawEmployees) {
        setEmployees(JSON.parse(rawEmployees) as EmployeeRow[]);
      } else {
        localStorage.setItem(STORAGE_EMPLOYEES, JSON.stringify(defaultEmployees));
      }

      if (rawDepartments) {
        const parsed = JSON.parse(rawDepartments) as DepartmentRow[];

        const usedNums = parsed
          .map((d) => d.code)
          .filter((c): c is string => Boolean(c))
          .map((code) => {
            const m = code.match(/(\d+)$/);
            return m ? Number(m[1]) : null;
          })
          .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

        let next = (usedNums.length ? Math.max(...usedNums) : 0) + 1;
        let changed = false;

        const backfilled = parsed.map((d) => {
          if (d.code) return d;
          changed = true;
          const code = `DEPT-${String(next).padStart(3, "0")}`;
          next += 1;
          return { ...d, code };
        });

        if (changed) {
          localStorage.setItem(STORAGE_DEPARTMENTS, JSON.stringify(backfilled));
        }
        setDepartments(backfilled);
      } else {
        localStorage.setItem(STORAGE_DEPARTMENTS, JSON.stringify(defaultDepartments));
      }
    } catch {
      // ignore
    } finally {
      setHasLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "department") setActiveTab("department");
    if (t === "employee") setActiveTab("employee");
  }, [searchParams]);

  useEffect(() => {
    if (apiEnabled) return;
    if (!hasLoaded) return;
    try {
      localStorage.setItem(STORAGE_EMPLOYEES, JSON.stringify(employees));
    } catch {
      // ignore
    }
  }, [employees, hasLoaded, apiEnabled]);

  useEffect(() => {
    if (apiEnabled) return;
    if (!hasLoaded) return;
    try {
      localStorage.setItem(STORAGE_DEPARTMENTS, JSON.stringify(departments));
    } catch {
      // ignore
    }
  }, [departments, hasLoaded, apiEnabled]);

  useEffect(() => {
    if (!apiEnabled) return;
    if (!editEmployeeOpen) return;
    if (!selectedEmployee?.apiId) return;
    if (!employeeEditApiData) return;

    editEmployeeForm.setFieldsValue({
      departmentId: employeeEditApiData.department_id ?? selectedEmployee.departmentId,
      roleId: employeeEditApiData.role_id ?? selectedEmployee.roleId,
      reportsToId: employeeEditApiData.reports_to_id ?? null,
      joinDate: employeeEditApiData.join_date ? dayjs(employeeEditApiData.join_date) : undefined,
      notes: employeeEditApiData.notes ?? "",
    });
  }, [
    apiEnabled,
    editEmployeeForm,
    editEmployeeOpen,
    employeeEditApiData,
    selectedEmployee?.apiId,
    selectedEmployee?.departmentId,
    selectedEmployee?.roleId,
  ]);

  const rolesById = useMemo(() => {
    const list = rolesApiData ?? [];
    const map: Record<string, string> = {};
    for (const r of list) map[r.id] = r.name;
    return map;
  }, [rolesApiData]);

  const managerRoleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rolesApiData ?? []) {
      const roleName = String(r?.name ?? "").toLowerCase();
      if (roleName.includes("manager")) ids.add(String(r.id));
    }
    return ids;
  }, [rolesApiData]);

  const accessControlByEmployeeId = useMemo(() => {
    const list = accessControlApiData ?? [];
    const map: Record<string, (typeof list)[number]> = {};
    for (const ac of list) {
      if (ac.employee_id) map[ac.employee_id] = ac;
    }
    return map;
  }, [accessControlApiData]);

  const departmentById = useMemo(() => {
    const map: Record<string, DepartmentRecord> = {};
    for (const dept of departmentsApiData ?? []) {
      map[dept.id] = dept;
    }
    return map;
  }, [departmentsApiData]);

  const employeeById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of employeesApiData ?? []) {
      map[e.id] = e.full_name;
    }
    return map;
  }, [employeesApiData]);

  const apiEmployeesRows: EmployeeRow[] = useMemo(() => {
    if (!apiEnabled) return [];
    const list = employeesApiData ?? [];

    return list.map((e) => {
      const employeeId = e.employee_id ?? e.id;
      const ac = accessControlByEmployeeId[employeeId];
      const departmentName = e.department_id ? departmentById[e.department_id]?.department_name : undefined;
      const department = departmentName ?? ac?.department ?? "-";
      const rawRoleId = e.role_id ?? ac?.role_id;
      const roleId = rawRoleId == null ? undefined : String(rawRoleId);
      const roleName = roleId ? rolesById[roleId] ?? roleId : "-";
      const isManager = roleId ? managerRoleIds.has(roleId) : false;

      const managerName = e.reports_to_id ? employeeById[String(e.reports_to_id)] : undefined;

      const normalizedStatus = String(e.status ?? "Active").toLowerCase();
      const status: EmployeeRow["status"] = normalizedStatus === "inactive" ? "Inactive" : "Active";

      return {
        key: e.id,
        apiId: e.id,
        accessControlId: ac?.id,
        departmentId: e.department_id == null ? undefined : String(e.department_id),
        empId: employeeId,
        name: ac?.full_name || e.full_name,
        isManager,
        jobTitle: e.job_title ?? "-",
        jobLevel: roleName !== "-" ? roleName : e.job_title ?? "-",
        email: e.email ?? "-",
        phone: e.phone_number ?? "-",
        department,
        manager: managerName ?? "Top Level",
        role: roleName,
        roleId,
        roleHint: "",
        joinDate: "-",
        status,
      };
    });
  }, [apiEnabled, employeesApiData, accessControlByEmployeeId, departmentById, employeeById, managerRoleIds, rolesById]);

  const departmentOptionsApi = useMemo(() => {
    return (departmentsApiData ?? []).map((d) => ({
      label: d.department_name,
      value: d.id,
    }));
  }, [departmentsApiData]);

  const roleOptionsApi = useMemo(() => {
    return (rolesApiData ?? []).map((r) => ({ label: r.name, value: r.id }));
  }, [rolesApiData]);

  const reportsToOptionsApi = useMemo(() => {
    if (!apiEnabled) return [];
    const managers = apiEmployeesRows.filter((e) => e.isManager);
    return [{ label: "Top Level", value: null }, ...managers.map((e) => ({ label: e.name, value: e.apiId ?? e.key }))];
  }, [apiEnabled, apiEmployeesRows]);

  const metrics = useMemo(() => {
    const activeEmployees = apiEnabled ? apiEmployeesRows : employees;
    const activeDepartments = apiEnabled ? departmentOptionsApi.map((d) => d.value) : departments.map((d) => d.name);

    const totalEmployees = activeEmployees.length;
    const managers = activeEmployees.filter((e) => e.isManager).length;
    const departmentsCount = apiEnabled ? activeDepartments.length : departments.length;
    const activeUsers = activeEmployees.filter((e) => e.status === "Active").length;
    return { totalEmployees, managers, departmentsCount, activeUsers };
  }, [employees, departments, apiEmployeesRows, apiEnabled, departmentOptionsApi]);

  const filteredDepartments = useMemo(() => {
    const q = deptSearch.trim().toLowerCase();
    const source = apiEnabled ? [] : departments;
    return source.filter((d) => {
      const matchesSearch =
        !q ||
        (d.code || "").toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.head.toLowerCase().includes(q);
      const matchesStatus = deptStatus === "All" ? true : d.status === deptStatus;
      return matchesSearch && matchesStatus;
    });
  }, [departments, deptSearch, deptStatus]);

  const tabButtonClass = (on: boolean) =>
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors border " +
    (on ? "bg-white text-gray-900 border-gray-200 shadow-sm" : "bg-transparent text-gray-600 border-transparent hover:bg-white");

  const employeeColumns: ColumnsType<EmployeeRow> = [
    {
      title: "Employee",
      key: "employee",
      width: 230,
      render: (_: unknown, record) => (
        <div className="flex items-start gap-3">
          <div className="mt-1 text-gray-400">≋</div>
          <div className="leading-tight">
            <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
              {record.empId}
            </span>
            <div className="text-sm font-semibold text-gray-900 mt-1">{record.name}</div>
            {record.isManager && (
              <div className="text-xs text-orange-600 mt-1 inline-flex items-center gap-1">
                <CrownOutlined />
                <span>Manager</span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Job Title",
      key: "jobTitle",
      width: 210,
      render: (_: unknown, record) => (
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-900">{record.jobTitle}</div>
          <div className="text-xs text-gray-500 mt-1">{record.jobLevel}</div>
        </div>
      ),
    },
    {
      title: "Contact",
      key: "contact",
      width: 240,
      render: (_: unknown, record) => (
        <div className="leading-tight">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <MailOutlined className="text-gray-400" />
            <span>{record.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
            <PhoneOutlined className="text-gray-400" />
            <span>{record.phone}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Department",
      dataIndex: "department",
      key: "department",
      width: 140,
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "Manager",
      dataIndex: "manager",
      key: "manager",
      width: 140,
      render: (v: string) => (
        <span className={"text-sm " + (v === "Top Level" ? "text-gray-400" : "text-gray-900")}>{v}</span>
      ),
    },
    {
      title: "Role",
      key: "role",
      width: 200,
      render: (_: unknown, record) => (
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-900">{record.role}</div>
          <div className="text-xs text-gray-500 mt-1">{record.roleHint}</div>
        </div>
      ),
    },
    {
      title: "Join Date",
      dataIndex: "joinDate",
      key: "joinDate",
      width: 110,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (v: EmployeeRow["status"]) => (
        <span className="text-sm font-semibold text-blue-600">{v}</span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, record) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedEmployee(record);
              setViewEmployeeOpen(true);
            }}
          />
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedEmployee(record);
              editEmployeeForm.setFieldsValue({
                empId: record.empId,
                name: record.name,
                email: record.email === "-" ? "" : record.email,
                department: record.department === "-" ? undefined : record.department,
                departmentId: record.departmentId,
                roleId: record.roleId,
                phone: record.phone === "-" ? "" : record.phone,
                jobTitle: record.jobTitle === "-" ? "" : record.jobTitle,
                status: record.status,
              });
              setEditEmployeeOpen(true);
            }}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              setSelectedEmployee(record);
              setDeleteEmployeeOpen(true);
            }}
          />
        </div>
      ),
    },
  ];

  const departmentColumns: ColumnsType<DepartmentRow> = [
    { title: "Department", dataIndex: "name", key: "name", render: (v: string) => <span className="text-sm font-semibold text-gray-900">{v}</span> },
    { title: "Head", dataIndex: "head", key: "head", render: (v: string) => <span className="text-sm text-gray-800">{v}</span> },
    { title: "Employees", dataIndex: "employeeCount", key: "employeeCount", render: (v: number) => <span className="text-sm text-gray-800">{v}</span> },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: DepartmentRow["status"]) => (
        <Tag color={v === "Active" ? "blue" : "default"} className="!rounded-full !px-3 !py-0.5 !text-xs">
          {v}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, record) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedDept(record);
              setViewDeptOpen(true);
            }}
          />
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedDept(record);
              editDeptForm.setFieldsValue({
                code: record.code || "DEPT-000",
                name: record.name,
                head: record.head,
                parentDepartment: record.parentDepartment,
                description: record.description,
                employeeCount: record.employeeCount,
                status: record.status,
              });
              setEditDeptOpen(true);
            }}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={async () => {
              if (!apiEnabled) {
                setDepartments((prev) => prev.filter((d) => d.key !== record.key));
                message.success("Department deleted");
                return;
              }

              try {
                if (!record.apiId) throw new Error("Missing department id");
                await deleteDepartment(record.apiId).unwrap();
                message.success("Department deleted");
                refetchDepartments();
              } catch (error) {
                message.error(getApiErrorMessage(error, "Failed to delete department"));
              }
            }}
          />
        </div>
      ),
    },
  ];

  const selectedDeptEmployees = useMemo(() => {
    if (!selectedDept) return [];
    const source = apiEnabled ? apiEmployeesRows : employees;
    return source.filter((e) =>
      apiEnabled
        ? e.departmentId === selectedDept.apiId || e.department === selectedDept.name
        : e.department === selectedDept.name
    );
  }, [employees, selectedDept, apiEnabled, apiEmployeesRows]);

  const employeeRows = apiEnabled ? apiEmployeesRows : employees;

  const departmentsReadOnlyApi: DepartmentRow[] = useMemo(() => {
    if (!apiEnabled) return [];
    return (departmentsApiData ?? []).map((dept) => {
      const employeeCount = apiEmployeesRows.filter((employee) => employee.departmentId === dept.id).length;
      const status: DepartmentRow["status"] = String(dept.status ?? "Active").toLowerCase() === "inactive" ? "Inactive" : "Active";
      return {
        key: dept.id,
        apiId: dept.id,
        parentDepartmentId: dept.parent_department_id ?? undefined,
        code: undefined,
        name: dept.department_name,
        head: "-",
        parentDepartment: dept.parent_department?.department_name,
        description: dept.description ?? undefined,
        employeeCount,
        status,
      };
    });
  }, [apiEnabled, apiEmployeesRows, departmentsApiData]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Employee Management</h1>
              <p className="text-sm text-gray-500">Manage employee master data and organizational hierarchy supporting workflows and approvals</p>
            </div>
            <div className="flex items-center gap-2">
              <Button className="!rounded-lg" icon={<TeamOutlined />} onClick={() => router.push("/employee-dept/add-department")}>
                Add Department
              </Button>
              <Button
                type="primary"
                className="!rounded-lg"
                icon={<PlusOutlined />}
                onClick={() => router.push("/employee-dept/add-employee")}
              >
                Add Employee
              </Button>
            </div>
          </div>

          {apiEnabled ? (
            <div className="mt-3 text-xs text-emerald-700">
              API mode: employee and department data are connected to backend endpoints.
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">Total Employees</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalEmployees}</div>
            </div>
            <UserOutlined className="text-blue-600 text-xl" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">Managers</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{metrics.managers}</div>
            </div>
            <CrownOutlined className="text-orange-500 text-xl" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">Departments</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{metrics.departmentsCount}</div>
            </div>
            <TeamOutlined className="text-green-600 text-xl" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">Active Users</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{metrics.activeUsers}</div>
            </div>
            <UserOutlined className="text-purple-600 text-xl" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-2 w-fit">
          <button
            type="button"
            className={tabButtonClass(activeTab === "employee")}
            onClick={() => {
              setActiveTab("employee");
              router.replace("/employee-dept?tab=employee");
            }}
          >
            Employee Management
          </button>
          <button
            type="button"
            className={tabButtonClass(activeTab === "department")}
            onClick={() => {
              setActiveTab("department");
              router.replace("/employee-dept?tab=department");
            }}
          >
            Department Management
          </button>
        </div>

        {activeTab === "employee" ? (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-900">Employee Master Data</div>
              <div className="text-xs text-gray-500">{employeeRows.length} employees</div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              <Table<EmployeeRow>
                columns={employeeColumns}
                dataSource={employeeRows}
                rowKey="key"
                size="middle"
                pagination={false}
                scroll={{ x: "max-content" }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg font-semibold text-gray-900">Department Master Data</div>
                <div className="text-xs text-gray-500 mt-1">
                  {apiEnabled ? departmentsReadOnlyApi.length : filteredDepartments.length} departments
                </div>
              </div>

              {!apiEnabled ? (
                <div className="flex items-center gap-2">
                  <Input
                    className="!rounded-lg w-64"
                    placeholder="Search department/head..."
                    value={deptSearch}
                    onChange={(e) => setDeptSearch(e.target.value)}
                    allowClear
                  />
                  <Select
                    className="!rounded-lg w-40"
                    value={deptStatus}
                    onChange={(v) => setDeptStatus(v)}
                    options={[
                      { label: "All Status", value: "All" },
                      { label: "Active", value: "Active" },
                      { label: "Inactive", value: "Inactive" },
                    ]}
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              <Table<DepartmentRow>
                columns={departmentColumns}
                dataSource={apiEnabled ? departmentsReadOnlyApi : filteredDepartments}
                rowKey="key"
                size="middle"
                pagination={false}
                scroll={{ x: "max-content" }}
              />
            </div>
          </div>
        )}
      </div>

      <Modal
        open={viewEmployeeOpen}
        onCancel={() => {
          setViewEmployeeOpen(false);
          setSelectedEmployee(null);
        }}
        title={<div className="text-sm font-semibold">Employee Detail</div>}
        footer={
          <Button
            className="!rounded-lg"
            onClick={() => {
              setViewEmployeeOpen(false);
              setSelectedEmployee(null);
            }}
          >
            Close
          </Button>
        }
      >
        {selectedEmployee ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-100 p-3">
              <div className="text-xs text-gray-500">Employee ID</div>
              <div className="text-sm font-semibold text-gray-900 mt-1">{selectedEmployee.empId}</div>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <div className="text-xs text-gray-500">Name</div>
              <div className="text-sm font-semibold text-gray-900 mt-1">{selectedEmployee.name}</div>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <div className="text-xs text-gray-500">Email</div>
              <div className="text-sm text-gray-900 mt-1">{employeeDetailApiData?.email ?? selectedEmployee.email}</div>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <div className="text-xs text-gray-500">Phone</div>
              <div className="text-sm text-gray-900 mt-1">{employeeDetailApiData?.phone_number ?? selectedEmployee.phone}</div>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <div className="text-xs text-gray-500">Department</div>
              <div className="text-sm text-gray-900 mt-1">{selectedEmployee.department}</div>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <div className="text-xs text-gray-500">Role</div>
              <div className="text-sm text-gray-900 mt-1">{selectedEmployee.role}</div>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <div className="text-xs text-gray-500">Job Title</div>
              <div className="text-sm text-gray-900 mt-1">{employeeDetailApiData?.job_title ?? selectedEmployee.jobTitle}</div>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-sm text-gray-900 mt-1">{selectedEmployee.status}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No employee selected</div>
        )}
      </Modal>

      <Modal
        open={editEmployeeOpen}
        onCancel={() => {
          setEditEmployeeOpen(false);
          setSelectedEmployee(null);
          editEmployeeForm.resetFields();
        }}
        title={<div className="text-sm font-semibold">Edit Employee</div>}
        okText="Save"
        cancelText="Cancel"
        okButtonProps={{ className: "!rounded-lg" }}
        cancelButtonProps={{ className: "!rounded-lg" }}
        onOk={async () => {
          try {
            const values = await editEmployeeForm.validateFields();
            if (!selectedEmployee) return;

            if (!apiEnabled) {
              setEmployees((prev) =>
                prev.map((e) =>
                  e.key === selectedEmployee.key
                    ? {
                        ...e,
                        name: values.name,
                        email: values.email || "-",
                        department: values.department || "-",
                        status: values.status,
                      }
                    : e
                )
              );
              message.success("Employee updated");
            } else {
              const apiId = selectedEmployee.apiId;
              if (!apiId) throw new Error("Missing employee id");

              const apiStatus = String(values.status ?? "active").toLowerCase() === "inactive" ? "inactive" : "active";
              const departmentNameForAccessControl = values.departmentId
                ? departmentById[String(values.departmentId)]?.department_name
                : values.department;

              await updateEmployee({
                id: apiId,
                body: {
                  full_name: values.name,
                  email: values.email || null,
                  phone_number: values.phone || null,
                  job_title: values.jobTitle || null,
                  status: apiStatus,
                  role_id: values.roleId || null,
                  department_id: values.departmentId ?? selectedEmployee.departmentId ?? null,
                  reports_to_id: values.reportsToId ?? null,
                  join_date:
                    values.joinDate && typeof values.joinDate.toISOString === "function" ? values.joinDate.toISOString() : null,
                  notes: values.notes ? String(values.notes) : null,
                },
              }).unwrap();

              if (selectedEmployee.accessControlId) {
                await updateAccessControl({
                  id: selectedEmployee.accessControlId,
                  body: {
                    employee_id: selectedEmployee.empId,
                    full_name: values.name,
                    department: departmentNameForAccessControl,
                    role_id: values.roleId,
                  },
                }).unwrap();
              } else if (departmentNameForAccessControl && values.roleId) {
                await createAccessControl({
                  employee_id: selectedEmployee.empId,
                  full_name: values.name,
                  department: departmentNameForAccessControl,
                  role_id: values.roleId,
                }).unwrap();
              }

              message.success("Employee updated");
              refetchEmployees();
              refetchAccessControl();
              refetchRoles();
            }

            setEditEmployeeOpen(false);
            setSelectedEmployee(null);
            editEmployeeForm.resetFields();
          } catch (e) {
            message.error(getApiErrorMessage(e, "Failed to update employee"));
          }
        }}
      >
        <Form form={editEmployeeForm} layout="vertical">
          <Form.Item name="empId" label="Employee ID">
            <Input className="!rounded-lg" disabled />
          </Form.Item>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}> 
            <Input className="!rounded-lg" placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input className="!rounded-lg" placeholder="name@company.com" />
          </Form.Item>
          <Form.Item name="phone" label="Phone Number">
            <Input className="!rounded-lg" placeholder="08xxxxxxxxxx" />
          </Form.Item>
          <Form.Item name="jobTitle" label="Job Title">
            <Input className="!rounded-lg" placeholder="Job title" />
          </Form.Item>
          <Form.Item name={apiEnabled ? "departmentId" : "department"} label="Department" rules={[{ required: true }]}>
            {apiEnabled ? (
              <Select
                className="!rounded-lg"
                placeholder="Select department"
                options={departmentOptionsApi}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            ) : (
              <Input className="!rounded-lg" placeholder="Department" />
            )}
          </Form.Item>

          <Form.Item name="roleId" label="Role" rules={apiEnabled ? [{ required: true }] : undefined}>
            {apiEnabled ? (
              <Select
                className="!rounded-lg"
                placeholder="Select role"
                options={roleOptionsApi}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            ) : (
              <Input className="!rounded-lg" placeholder="Role" />
            )}
          </Form.Item>

          {apiEnabled ? (
            <Form.Item name="reportsToId" label="Reports To">
              <Select
                className="!rounded-lg"
                placeholder="Select manager"
                allowClear
                options={reportsToOptionsApi}
              />
            </Form.Item>
          ) : null}

          {apiEnabled ? (
            <Form.Item name="joinDate" label="Join Date">
              <DatePicker className="!rounded-lg w-full" />
            </Form.Item>
          ) : null}

          {apiEnabled ? (
            <Form.Item name="notes" label="Notes">
              <Input.TextArea className="!rounded-lg" rows={3} placeholder="Notes" />
            </Form.Item>
          ) : null}

          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              className="!rounded-lg"
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Delete employee?"
        open={deleteEmployeeOpen}
        okText="Delete"
        okButtonProps={{ danger: true, className: "!rounded-lg" }}
        cancelText="Cancel"
        cancelButtonProps={{ className: "!rounded-lg" }}
        onCancel={() => {
          setDeleteEmployeeOpen(false);
          setSelectedEmployee(null);
        }}
        onOk={async () => {
          if (!selectedEmployee) return;
          try {
            if (!apiEnabled) {
              setEmployees((prev) => prev.filter((e) => e.key !== selectedEmployee.key));
              message.success("Employee deleted");
            } else {
              if (selectedEmployee.accessControlId) {
                await deleteAccessControl(selectedEmployee.accessControlId).unwrap();
              }
              if (selectedEmployee.apiId) {
                await deleteEmployee(selectedEmployee.apiId).unwrap();
              }
              message.success("Employee deleted");
              refetchEmployees();
              refetchAccessControl();
            }

            setDeleteEmployeeOpen(false);
            setSelectedEmployee(null);
          } catch (e) {
            message.error(getApiErrorMessage(e, "Failed to delete employee"));
          }
        }}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{selectedEmployee?.empId}</span>.
        </div>
      </Modal>

      <Modal
        open={viewDeptOpen}
        onCancel={() => {
          setViewDeptOpen(false);
          setSelectedDept(null);
        }}
        title={<div className="text-sm font-semibold">Department Detail</div>}
        footer={
          <Button
            className="!rounded-lg"
            onClick={() => {
              setViewDeptOpen(false);
              setSelectedDept(null);
            }}
          >
            Close
          </Button>
        }
      >
        {selectedDept ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Department Code</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{selectedDept.code || "—"}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Department</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{selectedDept.name}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Head</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{selectedDept.head}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Parent Department</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{selectedDept.parentDepartment || "—"}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Employees</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{selectedDept.employeeCount}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Status</div>
                <div className="mt-1">
                  <Tag color={selectedDept.status === "Active" ? "blue" : "default"} className="!rounded-full !px-3 !py-0.5 !text-xs">
                    {selectedDept.status}
                  </Tag>
                </div>
              </div>
            </div>

            {selectedDept.description ? (
              <div className="mt-3 rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Description</div>
                <div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{selectedDept.description}</div>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900">Employees in Department</div>
              <div className="text-xs text-gray-500 mt-1">{selectedDeptEmployees.length} employees</div>

              <div className="mt-3 overflow-hidden rounded-xl border border-gray-100">
                <Table<EmployeeRow>
                  columns={employeeColumns.filter((c) => c.key !== "actions")}
                  dataSource={selectedDeptEmployees}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  scroll={{ x: "max-content" }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No department selected</div>
        )}
      </Modal>

      <Modal
        open={editDeptOpen}
        onCancel={() => {
          setEditDeptOpen(false);
          setSelectedDept(null);
          editDeptForm.resetFields();
        }}
        title={<div className="text-sm font-semibold">Edit Department</div>}
        okText="Save"
        cancelText="Cancel"
        okButtonProps={{ className: "!rounded-lg" }}
        cancelButtonProps={{ className: "!rounded-lg" }}
        onOk={async () => {
          try {
            const values = await editDeptForm.validateFields();
            if (!selectedDept) return;

            if (apiEnabled) {
              if (!selectedDept.apiId) throw new Error("Missing department id");
              await updateDepartment({
                id: selectedDept.apiId,
                body: {
                  department_name: values.name,
                  description: values.description || null,
                  parent_department_id:
                    (departmentsApiData ?? []).find((dept) => dept.department_name === values.parentDepartment)?.id ??
                    selectedDept.parentDepartmentId ??
                    null,
                },
              }).unwrap();
              refetchDepartments();
            } else {
              setDepartments((prev) =>
                prev.map((d) =>
                  d.key === selectedDept.key
                    ? {
                        ...d,
                        code: values.code,
                        name: values.name,
                        head: values.head,
                        parentDepartment: values.parentDepartment || undefined,
                        description: values.description || undefined,
                        employeeCount: Number(values.employeeCount || 0),
                        status: values.status,
                      }
                    : d
                )
              );
            }

            setEditDeptOpen(false);
            setSelectedDept(null);
            editDeptForm.resetFields();
            message.success("Department updated");
          } catch (error) {
            if (error && typeof error === "object" && "errorFields" in error) return;
            message.error(getApiErrorMessage(error, "Failed to update department"));
          }
        }}
      >
        <Form form={editDeptForm} layout="vertical">
          <Form.Item name="code" label="Department Code" rules={[{ required: true }]}>
            <Input className="!rounded-lg" disabled placeholder="DEPT-001" />
          </Form.Item>
          <Form.Item name="name" label="Department Name" rules={[{ required: true }]}>
            <Input className="!rounded-lg" placeholder="Department" />
          </Form.Item>
          <Form.Item name="head" label="Department Head" rules={[{ required: true }]}>
            <Select
              className="!rounded-lg"
              options={(apiEnabled ? apiEmployeesRows : employees)
                .filter((e) => e.isManager)
                .map((e) => ({ label: e.name, value: e.name }))}
            />
          </Form.Item>
          <Form.Item name="parentDepartment" label="Parent Department">
            <Select
              className="!rounded-lg"
              allowClear
              placeholder="Select parent"
              options={(apiEnabled ? departmentsReadOnlyApi : departments).map((d) => ({ label: d.name, value: d.name }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea className="!rounded-lg" rows={3} placeholder="Department description" />
          </Form.Item>
          <Form.Item name="employeeCount" label="Employees" rules={[{ required: true }]}>
            <InputNumber className="!rounded-lg w-full" min={0} placeholder="e.g. 10" />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              className="!rounded-lg"
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
