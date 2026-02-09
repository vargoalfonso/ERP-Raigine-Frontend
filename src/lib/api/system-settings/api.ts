import { apiSlice } from "@/lib/api/instance";

// ERP-raigine (Express) mounts System Settings routes under `/api/...` and uses:
// - create: POST   /api/<resource>
// - list:   GET    /api/<resource>
// - update: PUT    /api/<resource>/:id
// - delete: DELETE /api/<resource>/:id

const ROUTES = {
  role: "/api/roles",
  employee: "/api/employees",
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
  }
  return [];
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
  status?: string;
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

    getRoles: builder.query<RoleRecord[], void>({
      query: () => ({
        url: `${ROUTES.role}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeArrayResponse<RoleRecord>(response),
    }),

    getEmployees: builder.query<{ data: EmployeeRecord[] }, void>({
      query: () => ({
        url: `${ROUTES.employee}`,
        method: "GET",
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
  useGetRolesQuery,
  useGetEmployeesQuery,
  useGetAccessControlMatrixQuery,
  useCreateAccessControlMatrixMutation,
  useCreateApprovalWorkflowMutation,
  useGetApprovalWorkflowsQuery,
  useCreateGlobalWorkingDaysMutation,
  useGetGlobalWorkingDaysQuery,
  useCreateKanbanStandardMutation,
  useGetKanbanStandardsQuery,
  useCreateMachinePatternMutation,
  useGetMachinePatternsQuery,
  useCreateProcessMutation,
  useGetProcessesQuery,
  useCreateUomMutation,
  useGetUomsQuery,
  useCreateTypeParameterMutation,
  useGetTypeParametersQuery,
  useCreateSafetyStockMutation,
  useGetSafetyStockQuery,
  useCreateStockdaysMutation,
  useGetStockdaysQuery,
  useCreatePoSplitMutation,
  useGetPoSplitSettingsQuery,
} = systemSettingsSlice;
