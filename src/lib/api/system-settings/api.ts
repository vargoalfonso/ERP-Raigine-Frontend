import { apiSlice } from "@/lib/api/instance";

// ERP-raigine (Express) mounts System Settings routes under `/api/...` and uses:
// - create: POST   /api/<resource>
// - list:   GET    /api/<resource>
// - update: PUT    /api/<resource>/:id
// - delete: DELETE /api/<resource>/:id

const ROUTES = {
  role: "/api/roles",
  employee: "/api/employees",
  department: "/api/departments",
  accessControlMatrix: "/api/access-control",
  approvalWorkflow: "/api/approval-workflows",
  globalWorkingDays: "/api/global-parameters",
  kanban: "/api/kanban-parameters",
  machinePattern: "/api/machine-parameters",
  process: "/api/process-parameters",
  uom: "/api/uom-parameters",
  typeParameter: "/api/type-parameters",
  safetyStock: "/api/safety-stock",
  stockdays: "/api/stockdays",
  poSplit: "/api/po-split-settings",
} as const;

const normalizeArrayResponse = <T>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === "object") {
    const maybeData = (response as Record<string, unknown>).data;
    if (Array.isArray(maybeData)) return maybeData as T[];
    if (maybeData && typeof maybeData === "object") {
      const nestedData = (maybeData as Record<string, unknown>).data;
      if (Array.isArray(nestedData)) return nestedData as T[];
    }
  }
  return [];
};

const normalizeObjectResponse = <T>(response: unknown): T | null => {
  if (response && typeof response === "object") {
    const maybeData = (response as Record<string, unknown>).data;
    if (maybeData && typeof maybeData === "object") {
      const nestedData = (maybeData as Record<string, unknown>).data;
      if (nestedData && typeof nestedData === "object") return nestedData as T;
      return maybeData as T;
    }
  }
  return response && typeof response === "object" ? (response as T) : null;
};

export type StatusType = "Active" | "Inactive";

export type CreateRoleRequest = {
  name: string;
  description?: string;
  permissions: Record<string, boolean>;
  status?: StatusType;
};

export type RoleRecord = {
  id: string;
  name: string;
  description?: string | null;
  permissions?: Record<string, boolean>;
  status?: StatusType;
};

export type EmployeeRecord = {
  id: string;
  employee_id: string;
  full_name: string;
  email?: string | null;
  phone_number?: string | null;
  job_title?: string | null;
  status?: string;
  unit_cost?: number | null;
  role_id?: string | null;
  department_id?: string | null;
};

export type CreateEmployeeRequest = {
  employee_id: string;
  full_name: string;
  email?: string | null;
  phone_number?: string | null;
  job_title?: string | null;
  status?: string;
  unit_cost?: number | null;
  role_id?: string | null;
  department_id?: string | null;
};

export type DepartmentRecord = {
  id: string;
  department_name: string;
  description?: string | null;
  parent_department_id?: string | null;
  parent_department?: {
    id?: string;
    department_name?: string;
  } | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export type CreateDepartmentRequest = {
  department_name: string;
  description?: string | null;
  parent_department_id?: string | null;
};

export type CreateAccessControlMatrixRequest = {
  full_name: string;
  employee_id: string;
  department: string;
  role_id: string;
};

export type AccessControlMatrixRecord = {
  id: string;
  full_name: string;
  employee_id: string;
  department: string;
  role_id: string;
};

export type CreateApprovalWorkflowRequest = {
  action_name: string;
  level_1_role: string;
  level_2_role: string;
  level_3_role: string;
  level_4_role: string;
};

export type ApprovalWorkflowRecord = {
  id: string;
  action_name: string;
  level_1_role: string;
  level_2_role: string;
  level_3_role: string;
  level_4_role: string;
  status: StatusType;
};

export type CreateGlobalWorkingDaysRequest = {
  period: string;
  working_days: number;
};

export type GlobalWorkingDaysRecord = {
  id: string;
  period: string;
  working_days: number;
};

export type CreateKanbanStandardRequest = {
  item_name: string;
  item_uniq_code: string;
  kanban_qty: number;
  min_stock: number;
  max_stock: number;
};

export type KanbanStandardRecord = {
  id: string;
  item_name: string;
  item_uniq_code: string;
  kanban_qty: number;
  min_stock: number;
  max_stock: number;
  status: StatusType;
};

export type CreateMachinePatternRequest = {
  pattern_name: string;
  machine_count: number;
  operating_hours: number;
  category?: string;
};

export type MachinePatternRecord = {
  id: string;
  pattern_name: string;
  machine_count: number;
  operating_hours: number;
  category?: string;
  status: StatusType;
};

export type CreateProcessRequest = {
  process_code: string;
  category: string;
  process_name: string;
  sequence: number;
};

export type ProcessRecord = {
  id: string;
  process_code: string;
  category: string;
  process_name: string;
  sequence: number;
  status: StatusType;
};

export type CreateUomRequest = {
  code: string;
  name: string;
  category: string;
};

export type UomRecord = {
  id: string;
  code: string;
  name: string;
  category: string;
  status: StatusType;
};

export type CreateTypeParameterRequest = {
  type_code: string;
  type_name: string;
  description: string;
  status: StatusType;
};

export type TypeParameterRecord = {
  id: string;
  type_code: string;
  type_name: string;
  description: string;
  status: StatusType;
};

export type CreateSafetyStockRequest = {
  inventory_type: string;
  item_uniq_code: string;
  calculation_type: string;
  constanta: number;
};

export type SafetyStockRecord = {
  id: string;
  inventory_type: string;
  item_uniq_code: string;
  calculation_type: string;
  constanta: number;
};

export type CreateStockdaysRequest = {
  inventory_type: string;
  item_uniq_code: string;
  calculation_type: string;
  constanta: number;
};

export type StockdaysRecord = {
  id: string;
  inventory_type: string;
  item_uniq_code: string;
  calculation_type: string;
  constanta: number;
};

export type CreatePoSplitRequest = {
  material_type: string;
  min_order_qty: number;
  max_split_lines: number;
  split_rule: string;
};

export type PoSplitRecord = {
  id: string;
  material_type: string;
  min_order_qty: number;
  max_split_lines: number;
  split_rule: string;
  status: StatusType;
};

export const systemSettingsSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Role
    createRole: builder.mutation<{ id: string; message?: string }, CreateRoleRequest>({
      query: (body) => ({
        url: `${ROUTES.role}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateRole: builder.mutation<{ message?: string; data?: RoleRecord }, { id: string; body: Partial<CreateRoleRequest> }>({
      query: ({ id, body }) => ({
        url: `${ROUTES.role}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteRole: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.role}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getRoles: builder.query<RoleRecord[], void>({
      query: () => ({
        url: `${ROUTES.role}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeArrayResponse<RoleRecord>(response),
    }),

    getDepartments: builder.query<DepartmentRecord[], void>({
      query: () => ({
        url: `${ROUTES.department}/`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeArrayResponse<DepartmentRecord>(response),
    }),

    createDepartment: builder.mutation<{ message?: string; data?: DepartmentRecord }, CreateDepartmentRequest>({
      query: (body) => ({
        url: `${ROUTES.department}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateDepartment: builder.mutation<{ message?: string; data?: DepartmentRecord }, { id: string; body: Partial<CreateDepartmentRequest> }>({
      query: ({ id, body }) => ({
        url: `${ROUTES.department}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteDepartment: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.department}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getEmployees: builder.query<EmployeeRecord[], void>({
      query: () => ({
        url: `${ROUTES.employee}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeArrayResponse<EmployeeRecord>(response),
    }),

    getEmployeeById: builder.query<EmployeeRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.employee}/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeObjectResponse<EmployeeRecord>(response),
    }),

    createEmployee: builder.mutation<{ message?: string; data?: EmployeeRecord }, CreateEmployeeRequest>({
      query: (body) => ({
        url: `${ROUTES.employee}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateEmployee: builder.mutation<{ message?: string; data?: EmployeeRecord }, { id: string; body: Partial<CreateEmployeeRequest> }>({
      query: ({ id, body }) => ({
        url: `${ROUTES.employee}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteEmployee: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.employee}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Access control matrix (list)
    getAccessControlMatrix: builder.query<AccessControlMatrixRecord[], void>({
      query: () => ({
        url: `${ROUTES.accessControlMatrix}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<AccessControlMatrixRecord>(response),
    }),

    // Access control matrix
    createAccessControlMatrix: builder.mutation<
      { message?: string; id?: string },
      CreateAccessControlMatrixRequest
    >({
      query: (body) => ({
        url: `${ROUTES.accessControlMatrix}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateAccessControlMatrix: builder.mutation<
      { message?: string; data?: AccessControlMatrixRecord },
      { id: string; body: Partial<CreateAccessControlMatrixRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.accessControlMatrix}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteAccessControlMatrix: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.accessControlMatrix}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Approval workflow
    createApprovalWorkflow: builder.mutation<
      { message?: string; data?: ApprovalWorkflowRecord },
      CreateApprovalWorkflowRequest
    >({
      query: (body) => ({
        url: `${ROUTES.approvalWorkflow}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateApprovalWorkflow: builder.mutation<
      { message?: string; data?: ApprovalWorkflowRecord },
      { id: string; body: Partial<CreateApprovalWorkflowRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.approvalWorkflow}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteApprovalWorkflow: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.approvalWorkflow}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getApprovalWorkflows: builder.query<ApprovalWorkflowRecord[], void>({
      query: () => ({
        url: `${ROUTES.approvalWorkflow}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<ApprovalWorkflowRecord>(response),
    }),

    // Global working days
    createGlobalWorkingDays: builder.mutation<
      { message?: string; data?: GlobalWorkingDaysRecord },
      CreateGlobalWorkingDaysRequest
    >({
      query: (body) => ({
        url: `${ROUTES.globalWorkingDays}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateGlobalWorkingDays: builder.mutation<
      { message?: string; data?: GlobalWorkingDaysRecord },
      { id: string; body: Partial<CreateGlobalWorkingDaysRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.globalWorkingDays}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteGlobalWorkingDays: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.globalWorkingDays}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getGlobalWorkingDays: builder.query<GlobalWorkingDaysRecord[], void>({
      query: () => ({
        url: `${ROUTES.globalWorkingDays}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<GlobalWorkingDaysRecord>(response),
    }),

    // Kanban standards
    createKanbanStandard: builder.mutation<
      { message?: string; data?: KanbanStandardRecord },
      CreateKanbanStandardRequest
    >({
      query: (body) => ({
        url: `${ROUTES.kanban}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateKanbanStandard: builder.mutation<
      { message?: string; data?: KanbanStandardRecord },
      { id: string; body: Partial<CreateKanbanStandardRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.kanban}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteKanbanStandard: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.kanban}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getKanbanStandards: builder.query<KanbanStandardRecord[], void>({
      query: () => ({
        url: `${ROUTES.kanban}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<KanbanStandardRecord>(response),
    }),

    // Machine pattern
    createMachinePattern: builder.mutation<
      { message?: string; data?: MachinePatternRecord },
      CreateMachinePatternRequest
    >({
      query: (body) => ({
        url: `${ROUTES.machinePattern}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateMachinePattern: builder.mutation<
      { message?: string; data?: MachinePatternRecord },
      { id: string; body: Partial<CreateMachinePatternRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.machinePattern}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteMachinePattern: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.machinePattern}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getMachinePatterns: builder.query<MachinePatternRecord[], void>({
      query: () => ({
        url: `${ROUTES.machinePattern}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<MachinePatternRecord>(response),
    }),

    // Process
    createProcess: builder.mutation<{ message?: string; data?: ProcessRecord }, CreateProcessRequest>({
      query: (body) => ({
        url: `${ROUTES.process}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateProcess: builder.mutation<
      { message?: string; data?: ProcessRecord },
      { id: string; body: Partial<CreateProcessRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.process}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteProcess: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.process}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getProcesses: builder.query<ProcessRecord[], void>({
      query: () => ({
        url: `${ROUTES.process}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<ProcessRecord>(response),
    }),

    // UoM
    createUom: builder.mutation<{ message?: string; data?: UomRecord }, CreateUomRequest>({
      query: (body) => ({
        url: `${ROUTES.uom}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateUom: builder.mutation<{ message?: string; data?: UomRecord }, { id: string; body: Partial<CreateUomRequest> & { status?: StatusType } }>({
      query: ({ id, body }) => ({
        url: `${ROUTES.uom}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteUom: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.uom}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getUoms: builder.query<UomRecord[], void>({
      query: () => ({
        url: `${ROUTES.uom}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeArrayResponse<UomRecord>(response),
    }),

    // Type parameters
    createTypeParameter: builder.mutation<
      { message?: string; data?: TypeParameterRecord },
      CreateTypeParameterRequest
    >({
      query: (body) => ({
        url: `${ROUTES.typeParameter}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateTypeParameter: builder.mutation<
      { message?: string; data?: TypeParameterRecord },
      { id: string; body: Partial<CreateTypeParameterRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.typeParameter}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteTypeParameter: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.typeParameter}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getTypeParameters: builder.query<TypeParameterRecord[], void>({
      query: () => ({
        url: `${ROUTES.typeParameter}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<TypeParameterRecord>(response),
    }),

    // Safety stock
    createSafetyStock: builder.mutation<
      { message?: string; data?: SafetyStockRecord },
      CreateSafetyStockRequest
    >({
      query: (body) => ({
        url: `${ROUTES.safetyStock}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateSafetyStock: builder.mutation<
      { message?: string; data?: SafetyStockRecord },
      { id: string; body: Partial<CreateSafetyStockRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.safetyStock}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteSafetyStock: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.safetyStock}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getSafetyStock: builder.query<SafetyStockRecord[], void>({
      query: () => ({
        url: `${ROUTES.safetyStock}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<SafetyStockRecord>(response),
    }),

    // Stockdays
    createStockdays: builder.mutation<
      { message?: string; data?: StockdaysRecord },
      CreateStockdaysRequest
    >({
      query: (body) => ({
        url: `${ROUTES.stockdays}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateStockdays: builder.mutation<
      { message?: string; data?: StockdaysRecord },
      { id: string; body: Partial<CreateStockdaysRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.stockdays}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteStockdays: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.stockdays}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getStockdays: builder.query<StockdaysRecord[], void>({
      query: () => ({
        url: `${ROUTES.stockdays}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<StockdaysRecord>(response),
    }),

    // PO split
    createPoSplit: builder.mutation<{ message?: string; data?: PoSplitRecord }, CreatePoSplitRequest>({
      query: (body) => ({
        url: `${ROUTES.poSplit}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updatePoSplit: builder.mutation<
      { message?: string; data?: PoSplitRecord },
      { id: string; body: Partial<CreatePoSplitRequest> & { status?: StatusType } }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.poSplit}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deletePoSplit: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.poSplit}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    getPoSplitSettings: builder.query<PoSplitRecord[], void>({
      query: () => ({
        url: `${ROUTES.poSplit}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<PoSplitRecord>(response),
    }),
  }),
});

export const {
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetRolesQuery,
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetEmployeesQuery,
  useGetEmployeeByIdQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useGetAccessControlMatrixQuery,
  useCreateAccessControlMatrixMutation,
  useUpdateAccessControlMatrixMutation,
  useDeleteAccessControlMatrixMutation,
  useCreateApprovalWorkflowMutation,
  useUpdateApprovalWorkflowMutation,
  useDeleteApprovalWorkflowMutation,
  useGetApprovalWorkflowsQuery,
  useCreateGlobalWorkingDaysMutation,
  useUpdateGlobalWorkingDaysMutation,
  useDeleteGlobalWorkingDaysMutation,
  useGetGlobalWorkingDaysQuery,
  useCreateKanbanStandardMutation,
  useUpdateKanbanStandardMutation,
  useDeleteKanbanStandardMutation,
  useGetKanbanStandardsQuery,
  useCreateMachinePatternMutation,
  useUpdateMachinePatternMutation,
  useDeleteMachinePatternMutation,
  useGetMachinePatternsQuery,
  useCreateProcessMutation,
  useUpdateProcessMutation,
  useDeleteProcessMutation,
  useGetProcessesQuery,
  useCreateUomMutation,
  useUpdateUomMutation,
  useDeleteUomMutation,
  useGetUomsQuery,
  useCreateTypeParameterMutation,
  useUpdateTypeParameterMutation,
  useDeleteTypeParameterMutation,
  useGetTypeParametersQuery,
  useCreateSafetyStockMutation,
  useUpdateSafetyStockMutation,
  useDeleteSafetyStockMutation,
  useGetSafetyStockQuery,
  useCreateStockdaysMutation,
  useUpdateStockdaysMutation,
  useDeleteStockdaysMutation,
  useGetStockdaysQuery,
  useCreatePoSplitMutation,
  useUpdatePoSplitMutation,
  useDeletePoSplitMutation,
  useGetPoSplitSettingsQuery,
} = systemSettingsSlice;
