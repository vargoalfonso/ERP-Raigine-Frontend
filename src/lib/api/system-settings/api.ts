import { apiSlice } from "@/lib/api/instance";

// ERP-raigine (Express) mounts System Settings routes under `/api/...` and uses:
// - create: POST   /api/<resource>
// - list:   GET    /api/<resource>
// - update: PUT    /api/<resource>/:id
// - delete: DELETE /api/<resource>/:id

const ROUTES = {
  // New API v1 mounts these at the root
  role: "/roles",
  employee: "/employee",
  department: "/department",
  accessControlMatrix: "/user",
  approvalWorkflow: "/approval-workflows",
  globalWorkingDays: "/global-parameters",
  kanban: "/kanban",
  machinePattern: "/api/machine-parameters",
  process: "/process",
  uom: "/unit-measurement",
  typeParameter: "/type-parameter",
  safetyStock: "/safety-stock",
  stockdays: "/stockdays",
  poSplit: "/po-split-setting",
} as const;

const normalizeArrayResponse = <T>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === "object") {
    const maybeData = (response as Record<string, unknown>).data;
    if (Array.isArray(maybeData)) return maybeData as T[];
    if (maybeData && typeof maybeData === "object") {
      const inner = maybeData as Record<string, unknown>;
      // Handle { data: { items: [...] } } — paginated backend responses
      if (Array.isArray(inner.items)) return inner.items as T[];
      if (Array.isArray(inner.data)) return inner.data as T[];
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

const normalizeGlobalWorkingDaysRecord = (
  record: unknown,
): GlobalWorkingDaysRecord | null => {
  if (!record || typeof record !== "object") return null;
  const raw = record as Record<string, unknown>;

  const id = raw.id ?? raw.ID;
  if (id == null || id === "") return null;

  const parameterGroup = raw.parameter_group ?? raw.ParameterGroup;
  const period = raw.period ?? raw.Period;
  const workingDays = raw.working_days ?? raw.WorkingDays;
  const status = raw.status ?? raw.Status;
  const createdAt = raw.created_at ?? raw.CreatedAt;
  const updatedAt = raw.updated_at ?? raw.UpdatedAt;

  return {
    id: String(id),
    parameter_group:
      parameterGroup == null ? undefined : String(parameterGroup),
    period: period == null ? "" : String(period),
    working_days:
      typeof workingDays === "number"
        ? workingDays
        : Number(String(workingDays ?? 0)) || 0,
    status: status == null ? undefined : String(status),
    created_at: createdAt == null ? undefined : String(createdAt),
    updated_at: updatedAt == null ? undefined : String(updatedAt),
  };
};

const normalizeGlobalWorkingDaysPayload = (
  body: CreateGlobalWorkingDaysRequest,
) => ({
  parameter_group: String(body.parameter_group ?? "").trim(),
  period: String(body.period ?? "").trim(),
  working_days: Number(body.working_days ?? 0),
  status: String(body.status ?? "active")
    .trim()
    .toLowerCase(),
});

// Backends are inconsistent: some use "Active"/"Inactive", others "active"/"inactive".
export type StatusType = string;

export type RolePermissions = Record<string, Record<string, boolean>>;

const normalizeRolePermissions = (
  role: unknown,
): RolePermissions | undefined => {
  if (!role || typeof role !== "object") return undefined;
  const rec = role as Record<string, unknown>;
  const perms = rec.permissions ?? rec.Permissions;
  if (!perms || typeof perms !== "object") return undefined;
  return perms as RolePermissions;
};

export type CreateRoleRequest = {
  name: string;
  description?: string;
  permissions: RolePermissions;
  status?: StatusType;
};

export type RoleRecord = {
  id: string;
  name: string;
  description?: string | null;
  permissions?: RolePermissions;
  Permissions?: RolePermissions;
  status?: StatusType;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeRecord = {
  id: string;
  employee_id?: string;
  full_name: string;
  email?: string | null;
  phone_number?: string | null;
  job_title?: string | null;
  status?: string;
  unit_cost?: number | null;
  join_date?: string | null;
  role_id?: string | number | null;
  department_id?: string | number | null;
  reports_to_id?: string | number | null;
  notes?: string | null;
};

export type CreateEmployeeRequest = {
  employee_id?: string;
  full_name: string;
  email?: string | null;
  phone_number?: string | null;
  job_title?: string | null;
  status?: string;
  unit_cost?: number | null;
  join_date?: string | null;
  role_id?: string | number | null;
  department_id?: string | number | null;
  reports_to_id?: string | number | null;
  notes?: string | null;
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
  department_code?: string | null;
  status?: string | null;
};

export type CreateAccessControlMatrixRequest = {
  full_name: string;
  employee_id: string;
  department_id: string | number;
  role_id: string | number;
  status: string;
};

export type AccessControlMatrixRecord = {
  id: string;
  full_name: string;
  employee_id: string;
  department_id?: string | number;
  role_id: string | number;
  status?: string;
  department?: string;
};

export type CreateApprovalWorkflowRequest = {
  action_name: string;
  level_1_role: string | null;
  level_2_role: string | null;
  level_3_role: string | null;
  level_4_role: string | null;
  status?: StatusType;
  created_by?: string;
};

export type ApprovalWorkflowRecord = {
  id: string;
  action_name: string;
  level_1_role: string | null;
  level_2_role: string | null;
  level_3_role: string | null;
  level_4_role: string | null;
  status: StatusType;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

const normalizeApprovalWorkflowRecord = (
  record: unknown,
): ApprovalWorkflowRecord | null => {
  if (!record || typeof record !== "object") return null;
  const raw = record as Record<string, unknown>;

  const id = raw.id ?? raw.ID;
  if (id == null || id === "") return null;

  return {
    id: String(id),
    action_name: String(raw.action_name ?? raw.ActionName ?? ""),
    level_1_role: String(raw.level_1_role ?? raw.Level1Role ?? ""),
    level_2_role: String(raw.level_2_role ?? raw.Level2Role ?? ""),
    level_3_role: String(raw.level_3_role ?? raw.Level3Role ?? ""),
    level_4_role: String(raw.level_4_role ?? raw.Level4Role ?? ""),
    status: String(raw.status ?? raw.Status ?? "active"),
    created_by:
      raw.created_by == null
        ? raw.CreatedBy == null
          ? undefined
          : String(raw.CreatedBy)
        : String(raw.created_by),
    created_at:
      raw.created_at == null
        ? raw.CreatedAt == null
          ? undefined
          : String(raw.CreatedAt)
        : String(raw.created_at),
    updated_at:
      raw.updated_at == null
        ? raw.UpdatedAt == null
          ? undefined
          : String(raw.UpdatedAt)
        : String(raw.updated_at),
  };
};

export type CreateGlobalWorkingDaysRequest = {
  // Legacy name; endpoint now matches /global-parameters.
  parameter_group?: string;
  period: string;
  working_days: number;
  status?: StatusType;
};

export type GlobalWorkingDaysRecord = {
  id: string;
  parameter_group?: string;
  period: string;
  working_days: number;
  status?: StatusType;
  created_at?: string;
  updated_at?: string;
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
  status?: StatusType;
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
  code?: string;
  name?: string;
  category?: string;
  unit_code?: string;
  unit_name?: string;
  description?: string;
  status?: "active" | "inactive" | string;
};

export type UomRecord = {
  id: string;
  code?: string;
  name?: string;
  unit_code?: string;
  unit_name?: string;
  category?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

const normalizeUomPayload = (body: CreateUomRequest) => ({
  code: String(body.code ?? body.unit_code ?? "")
    .trim()
    .toUpperCase(),
  name: String(body.name ?? body.unit_name ?? "").trim(),
  category: String(body.category ?? body.description ?? "").trim(),
  status: String(body.status ?? "active").toLowerCase(),
});

const normalizeUomRecord = (record: unknown): UomRecord | null => {
  if (!record || typeof record !== "object") return null;
  const raw = record as Record<string, unknown>;
  const id = raw.id ?? raw.ID;
  if (id == null || id === "") return null;

  const code = raw.code ?? raw.Code ?? raw.unit_code;
  const name = raw.name ?? raw.Name ?? raw.unit_name;
  const category = raw.category ?? raw.Category ?? raw.description;
  const status = raw.status ?? raw.Status;
  const createdAt = raw.created_at ?? raw.CreatedAt;
  const updatedAt = raw.updated_at ?? raw.UpdatedAt;

  return {
    id: String(id),
    code: code == null ? undefined : String(code),
    name: name == null ? undefined : String(name),
    unit_code: code == null ? undefined : String(code),
    unit_name: name == null ? undefined : String(name),
    category: category == null ? null : String(category),
    status: status == null ? undefined : String(status),
    created_at: createdAt == null ? undefined : String(createdAt),
    updated_at: updatedAt == null ? undefined : String(updatedAt),
  };
};

export type CreateTypeParameterRequest = {
  type_code: string;
  type_name: string;
  description: string;
  status: StatusType;
  parameter_group?: string;
};

export type TypeParameterRecord = {
  id: string;
  type_code: string;
  type_name: string;
  description: string;
  status: StatusType;
  parameter_group?: string;
};

export type CreateSafetyStockRequest = {
  inventory_type: string;
  item_uniq_code: string;
  calculation_type: string;
  constanta: number;
};

export type CreateSafetyStockBulkRequest = {
  items: CreateSafetyStockRequest[];
};

export type CalculateSafetyStockRequest = {
  item_code: string;
  prl: number;
  po: number;
  working_days: number;
};

export type CalculateSafetyStockResponse = {
  safety_stock?: number;
  suggested_order?: number;
  remaining_stock?: number;
  item_code?: string;
  calculation_type?: string;
  [key: string]: unknown;
};

export type SafetyStockRecord = {
  id: string;
  inventory_type: string;
  item_uniq_code: string;
  calculation_type: string;
  constanta: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export type CreateStockdaysRequest = {
  inventory_type: string;
  item_code: string;
  calculation_type: string;
  constanta?: number;
  status?: StatusType;
};

export type StockdaysRecord = {
  id: string;
  inventory_type: string;
  item_code: string;
  calculation_type: string;
  constanta?: number;
  status?: StatusType;
  created_at?: string;
  updated_at?: string;
};

export type CreatePoSplitRequest = {
  budget_type: string;
  po1_pct: number;
  po2_pct: number;
  description?: string;
  min_order_qty: number;
  max_split_lines: number;
  split_rule: string;
  status?: StatusType;
};

export type PoSplitRecord = {
  id: string;
  budget_type: string;
  po1_pct: number;
  po2_pct: number;
  description?: string | null;
  min_order_qty: number;
  max_split_lines: number;
  split_rule: string;
  status: StatusType;
  po_split_sum?: number;
  created_at?: string;
  updated_at?: string;
};

export const systemSettingsSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Role
    createRole: builder.mutation<
      { id: string; message?: string },
      CreateRoleRequest
    >({
      query: (body) => ({
        url: `${ROUTES.role}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: [{ type: "SystemSettingsRoles", id: "LIST" }],
    }),

    updateRole: builder.mutation<
      { message?: string; data?: RoleRecord },
      { id: string; body: Partial<CreateRoleRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.role}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsRoles", id: "LIST" },
        { type: "SystemSettingsRoles", id: arg.id },
      ],
    }),

    deleteRole: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.role}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsRoles", id: "LIST" },
        { type: "SystemSettingsRoles", id },
      ],
    }),

    getRoles: builder.query<RoleRecord[], void>({
      query: () => ({
        url: `${ROUTES.role}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<RoleRecord>(response).map((r) => ({
          ...r,
          permissions: normalizeRolePermissions(r) ?? r.permissions,
        })),
      providesTags: (result) =>
        result
          ? [
              { type: "SystemSettingsRoles", id: "LIST" },
              ...result
                .map((r) => r?.id)
                .filter((id): id is string => Boolean(id))
                .map((id) => ({ type: "SystemSettingsRoles" as const, id })),
            ]
          : [{ type: "SystemSettingsRoles", id: "LIST" }],
    }),

    getRoleById: builder.query<RoleRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.role}/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const obj = normalizeObjectResponse<RoleRecord>(response);
        if (!obj) return null;
        return {
          ...obj,
          permissions: normalizeRolePermissions(obj) ?? obj.permissions,
        };
      },
      providesTags: (_res, _err, id) => [{ type: "SystemSettingsRoles", id }],
    }),

    getDepartments: builder.query<DepartmentRecord[], void>({
      query: () => ({
        url: `${ROUTES.department}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<DepartmentRecord>(response),
      providesTags: (result) =>
        result
          ? [
              { type: "SystemSettingsDepartments", id: "LIST" },
              ...result
                .map((d) => d?.id)
                .filter((id): id is string => Boolean(id))
                .map((id) => ({
                  type: "SystemSettingsDepartments" as const,
                  id,
                })),
            ]
          : [{ type: "SystemSettingsDepartments", id: "LIST" }],
    }),

    createDepartment: builder.mutation<
      { message?: string; data?: DepartmentRecord },
      CreateDepartmentRequest
    >({
      query: (body) => ({
        url: `${ROUTES.department}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: [{ type: "SystemSettingsDepartments", id: "LIST" }],
    }),

    updateDepartment: builder.mutation<
      { message?: string; data?: DepartmentRecord },
      { id: string; body: Partial<CreateDepartmentRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.department}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsDepartments", id: "LIST" },
        { type: "SystemSettingsDepartments", id: arg.id },
      ],
    }),

    deleteDepartment: builder.mutation<
      { message?: string; id?: string },
      string
    >({
      query: (id) => ({
        url: `${ROUTES.department}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsDepartments", id: "LIST" },
        { type: "SystemSettingsDepartments", id },
      ],
    }),

    getDepartmentById: builder.query<DepartmentRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.department}/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeObjectResponse<DepartmentRecord>(response),
      providesTags: (_res, _err, id) => [
        { type: "SystemSettingsDepartments", id },
      ],
    }),

    getEmployees: builder.query<EmployeeRecord[], void>({
      query: () => ({
        url: `${ROUTES.employee}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<EmployeeRecord>(response),
    }),

    getEmployeeById: builder.query<EmployeeRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.employee}/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeObjectResponse<EmployeeRecord>(response),
    }),

    createEmployee: builder.mutation<
      { message?: string; data?: EmployeeRecord },
      CreateEmployeeRequest
    >({
      query: (body) => ({
        url: `${ROUTES.employee}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateEmployee: builder.mutation<
      { message?: string; data?: EmployeeRecord },
      { id: string; body: Partial<CreateEmployeeRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.employee}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    deleteEmployee: builder.mutation<{ message?: string; id?: string }, string>(
      {
        query: (id) => ({
          url: `${ROUTES.employee}/${id}`,
          method: "DELETE",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
      },
    ),

    // Access control matrix (list)
    getAccessControlMatrix: builder.query<AccessControlMatrixRecord[], void>({
      query: () => ({
        url: `${ROUTES.accessControlMatrix}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<AccessControlMatrixRecord>(response),
      providesTags: (result) =>
        result
          ? [
              { type: "SystemSettingsAccessControl", id: "LIST" },
              ...result
                .map((record) => record?.id)
                .filter((id): id is string => Boolean(id))
                .map((id) => ({
                  type: "SystemSettingsAccessControl" as const,
                  id,
                })),
            ]
          : [{ type: "SystemSettingsAccessControl", id: "LIST" }],
    }),

    getAccessControlMatrixById: builder.query<
      AccessControlMatrixRecord | null,
      string
    >({
      query: (id) => ({
        url: `${ROUTES.accessControlMatrix}/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeObjectResponse<AccessControlMatrixRecord>(response),
      providesTags: (_res, _err, id) => [
        { type: "SystemSettingsAccessControl", id },
      ],
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
      invalidatesTags: [{ type: "SystemSettingsAccessControl", id: "LIST" }],
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
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsAccessControl", id: "LIST" },
        { type: "SystemSettingsAccessControl", id: arg.id },
      ],
    }),

    deleteAccessControlMatrix: builder.mutation<
      { message?: string; id?: string },
      string
    >({
      query: (id) => ({
        url: `${ROUTES.accessControlMatrix}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsAccessControl", id: "LIST" },
        { type: "SystemSettingsAccessControl", id },
      ],
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
      invalidatesTags: [{ type: "SystemSettingsApprovalWorkflow", id: "LIST" }],
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
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsApprovalWorkflow", id: "LIST" },
        { type: "SystemSettingsApprovalWorkflow", id: arg.id },
      ],
    }),

    deleteApprovalWorkflow: builder.mutation<
      { message?: string; id?: string },
      string
    >({
      query: (id) => ({
        url: `${ROUTES.approvalWorkflow}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsApprovalWorkflow", id: "LIST" },
        { type: "SystemSettingsApprovalWorkflow", id },
      ],
    }),

    getApprovalWorkflows: builder.query<ApprovalWorkflowRecord[], void>({
      query: () => ({
        url: `${ROUTES.approvalWorkflow}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<unknown>(response)
          .map((item) => normalizeApprovalWorkflowRecord(item))
          .filter((item): item is ApprovalWorkflowRecord => Boolean(item)),
      providesTags: (result) =>
        result
          ? [
              { type: "SystemSettingsApprovalWorkflow", id: "LIST" },
              ...result
                .map((record) => record?.id)
                .filter((id): id is string => Boolean(id))
                .map((id) => ({
                  type: "SystemSettingsApprovalWorkflow" as const,
                  id,
                })),
            ]
          : [{ type: "SystemSettingsApprovalWorkflow", id: "LIST" }],
    }),

    getApprovalWorkflowById: builder.query<
      ApprovalWorkflowRecord | null,
      string
    >({
      query: (id) => ({
        url: `${ROUTES.approvalWorkflow}/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeApprovalWorkflowRecord(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
      providesTags: (_res, _err, id) => [
        { type: "SystemSettingsApprovalWorkflow", id },
      ],
    }),

    // Global working days
    createGlobalWorkingDays: builder.mutation<
      { message?: string; data?: GlobalWorkingDaysRecord },
      CreateGlobalWorkingDaysRequest
    >({
      query: (body) => ({
        url: `${ROUTES.globalWorkingDays}`,
        method: "POST",
        body: normalizeGlobalWorkingDaysPayload(body),
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ({
        message: "OK",
        data:
          normalizeGlobalWorkingDaysRecord(
            normalizeObjectResponse<unknown>(response) ?? response,
          ) ?? undefined,
      }),
      invalidatesTags: [{ type: "SystemSettingsGlobalParameters", id: "LIST" }],
    }),

    updateGlobalWorkingDays: builder.mutation<
      { message?: string; data?: GlobalWorkingDaysRecord },
      { id: string; body: Partial<CreateGlobalWorkingDaysRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.globalWorkingDays}/${id}`,
        method: "PUT",
        body: normalizeGlobalWorkingDaysPayload({
          period: String(body.period ?? ""),
          working_days: Number(body.working_days ?? 0),
          parameter_group: body.parameter_group,
          status: body.status,
        }),
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ({
        message: "OK",
        data:
          normalizeGlobalWorkingDaysRecord(
            normalizeObjectResponse<unknown>(response) ?? response,
          ) ?? undefined,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsGlobalParameters", id: "LIST" },
        { type: "SystemSettingsGlobalParameters", id: arg.id },
      ],
    }),

    deleteGlobalWorkingDays: builder.mutation<
      { message?: string; id?: string },
      string
    >({
      query: (id) => ({
        url: `${ROUTES.globalWorkingDays}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsGlobalParameters", id: "LIST" },
        { type: "SystemSettingsGlobalParameters", id },
      ],
    }),

    getGlobalWorkingDays: builder.query<GlobalWorkingDaysRecord[], void>({
      query: () => ({
        url: `${ROUTES.globalWorkingDays}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<unknown>(response)
          .map((item) => normalizeGlobalWorkingDaysRecord(item))
          .filter((item): item is GlobalWorkingDaysRecord => Boolean(item)),
      providesTags: (result) => {
        const base = [
          { type: "SystemSettingsGlobalParameters" as const, id: "LIST" },
        ];
        const ids = (result ?? [])
          .map((r) => r?.id)
          .filter((id): id is string => typeof id === "string" && Boolean(id));
        return base.concat(
          ids.map((id) => ({
            type: "SystemSettingsGlobalParameters" as const,
            id,
          })),
        );
      },
    }),

    getGlobalWorkingDaysById: builder.query<
      GlobalWorkingDaysRecord | null,
      string
    >({
      query: (id) => ({
        url: `${ROUTES.globalWorkingDays}/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeGlobalWorkingDaysRecord(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
      providesTags: (_res, _err, id) => [
        { type: "SystemSettingsGlobalParameters", id },
      ],
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
      invalidatesTags: [{ type: "SystemSettingsKanban", id: "LIST" }],
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
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsKanban", id: "LIST" },
        { type: "SystemSettingsKanban", id: arg.id },
      ],
    }),

    deleteKanbanStandard: builder.mutation<
      { message?: string; id?: string },
      string
    >({
      query: (id) => ({
        url: `${ROUTES.kanban}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsKanban", id: "LIST" },
        { type: "SystemSettingsKanban", id },
      ],
    }),

    getKanbanStandards: builder.query<KanbanStandardRecord[], void>({
      query: () => ({
        url: `${ROUTES.kanban}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<KanbanStandardRecord>(response),
      providesTags: (result) =>
        result
          ? [
              { type: "SystemSettingsKanban", id: "LIST" },
              ...result
                .map((k) => k?.id)
                .filter((id): id is string => Boolean(id))
                .map((id) => ({ type: "SystemSettingsKanban" as const, id })),
            ]
          : [{ type: "SystemSettingsKanban", id: "LIST" }],
    }),

    getKanbanStandardById: builder.query<KanbanStandardRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.kanban}/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeObjectResponse<KanbanStandardRecord>(response),
      providesTags: (_res, _err, id) => [{ type: "SystemSettingsKanban", id }],
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

    deleteMachinePattern: builder.mutation<
      { message?: string; id?: string },
      string
    >({
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
    createProcess: builder.mutation<
      { message?: string; data?: ProcessRecord },
      CreateProcessRequest
    >({
      query: (body) => ({
        url: `${ROUTES.process}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: [{ type: "SystemSettingsProcess", id: "LIST" }],
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
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsProcess", id: "LIST" },
        { type: "SystemSettingsProcess", id: arg.id },
      ],
    }),

    deleteProcess: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.process}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsProcess", id: "LIST" },
        { type: "SystemSettingsProcess", id },
      ],
    }),

    getProcesses: builder.query<ProcessRecord[], void>({
      query: () => ({
        url: `${ROUTES.process}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<unknown>(response).map((item) => {
          const r = (item ?? {}) as Record<string, unknown>;
          // Backend returns Go PascalCase; normalize to snake_case.
          return {
            id: String(r.id ?? r.ID ?? ""),
            process_code: String(r.process_code ?? r.ProcessCode ?? ""),
            process_name: String(r.process_name ?? r.ProcessName ?? ""),
            category: String(r.category ?? r.Category ?? ""),
            sequence: Number(r.sequence ?? r.Sequence ?? 0),
            status: String(r.status ?? r.Status ?? ""),
          } satisfies ProcessRecord;
        }),
      providesTags: (result) => {
        const base = [{ type: "SystemSettingsProcess" as const, id: "LIST" }];
        const ids = (result ?? [])
          .map((r) => r?.id)
          .filter((id): id is string => typeof id === "string" && Boolean(id));
        return base.concat(
          ids.map((id) => ({ type: "SystemSettingsProcess" as const, id })),
        );
      },
    }),

    getProcessById: builder.query<ProcessRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.process}/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeObjectResponse<ProcessRecord>(response),
      providesTags: (_res, _err, id) => [{ type: "SystemSettingsProcess", id }],
    }),

    // UoM
    createUom: builder.mutation<
      { message?: string; data?: UomRecord },
      CreateUomRequest
    >({
      query: (body) => ({
        url: `${ROUTES.uom}`,
        method: "POST",
        body: normalizeUomPayload(body),
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: [{ type: "SystemSettingsUom" }],
    }),

    updateUom: builder.mutation<
      { message?: string; data?: UomRecord },
      { id: string; body: Partial<CreateUomRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.uom}/${id}`,
        method: "PUT",
        body: normalizeUomPayload(body),
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsUom" },
        { type: "SystemSettingsUom", id: arg.id },
      ],
    }),

    deleteUom: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.uom}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsUom" },
        { type: "SystemSettingsUom", id },
      ],
    }),

    getUoms: builder.query<UomRecord[], void>({
      query: () => ({
        url: `${ROUTES.uom}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<unknown>(response)
          .map((item) => normalizeUomRecord(item))
          .filter((item): item is UomRecord => Boolean(item)),
      providesTags: (result) => {
        const base = [{ type: "SystemSettingsUom" as const }];
        const ids = (result ?? [])
          .map((r) => r?.id)
          .filter((id): id is string => typeof id === "string" && Boolean(id));
        return base.concat(
          ids.map((id) => ({ type: "SystemSettingsUom" as const, id })),
        );
      },
    }),

    getUomById: builder.query<UomRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.uom}/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeUomRecord(normalizeObjectResponse<unknown>(response)),
      providesTags: (_res, _err, id) => [{ type: "SystemSettingsUom", id }],
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
      invalidatesTags: [{ type: "SystemSettingsTypeParameter", id: "LIST" }],
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
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsTypeParameter", id: "LIST" },
        { type: "SystemSettingsTypeParameter", id: arg.id },
      ],
    }),

    deleteTypeParameter: builder.mutation<
      { message?: string; id?: string },
      string
    >({
      query: (id) => ({
        url: `${ROUTES.typeParameter}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsTypeParameter", id: "LIST" },
        { type: "SystemSettingsTypeParameter", id },
      ],
    }),

    getTypeParameters: builder.query<TypeParameterRecord[], void>({
      query: () => ({
        url: `${ROUTES.typeParameter}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<TypeParameterRecord>(response),
      providesTags: (result) => {
        const base = [
          { type: "SystemSettingsTypeParameter" as const, id: "LIST" },
        ];
        const ids = (result ?? [])
          .map((r) => r?.id)
          .filter((id): id is string => typeof id === "string" && Boolean(id));
        return base.concat(
          ids.map((id) => ({
            type: "SystemSettingsTypeParameter" as const,
            id,
          })),
        );
      },
    }),

    getTypeParameterById: builder.query<TypeParameterRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.typeParameter}/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeObjectResponse<TypeParameterRecord>(response),
      providesTags: (_res, _err, id) => [
        { type: "SystemSettingsTypeParameter", id },
      ],
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
      invalidatesTags: [{ type: "SystemSettingsSafetyStock", id: "LIST" }],
    }),

    createSafetyStockBulk: builder.mutation<
      { message?: string; data?: SafetyStockRecord[] },
      CreateSafetyStockBulkRequest
    >({
      query: (body) => ({
        url: `${ROUTES.safetyStock}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: [{ type: "SystemSettingsSafetyStock", id: "LIST" }],
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
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsSafetyStock", id: "LIST" },
        { type: "SystemSettingsSafetyStock", id: arg.id },
      ],
    }),

    deleteSafetyStock: builder.mutation<
      { message?: string; id?: string },
      string
    >({
      query: (id) => ({
        url: `${ROUTES.safetyStock}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsSafetyStock", id: "LIST" },
        { type: "SystemSettingsSafetyStock", id },
      ],
    }),

    getSafetyStock: builder.query<SafetyStockRecord[], void>({
      query: () => ({
        url: `${ROUTES.safetyStock}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<SafetyStockRecord>(response),
      providesTags: (result) =>
        result
          ? [
              { type: "SystemSettingsSafetyStock", id: "LIST" },
              ...result
                .map((record) => record?.id)
                .filter((id): id is string => Boolean(id))
                .map((id) => ({
                  type: "SystemSettingsSafetyStock" as const,
                  id,
                })),
            ]
          : [{ type: "SystemSettingsSafetyStock", id: "LIST" }],
    }),

    getSafetyStockById: builder.query<SafetyStockRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.safetyStock}/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeObjectResponse<SafetyStockRecord>(response),
      providesTags: (_res, _err, id) => [
        { type: "SystemSettingsSafetyStock", id },
      ],
    }),

    calculateSafetyStock: builder.query<
      CalculateSafetyStockResponse | null,
      CalculateSafetyStockRequest
    >({
      query: ({ item_code, prl, po, working_days }) => ({
        url: `${ROUTES.safetyStock}/calculate`,
        method: "GET",
        params: {
          item_code,
          prl,
          po,
          working_days,
        },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeObjectResponse<CalculateSafetyStockResponse>(response),
    }),

    // Stockdays
    createStockdays: builder.mutation<
      { message?: string; data?: StockdaysRecord },
      CreateStockdaysRequest
    >({
      query: (body) => ({
        url: `${ROUTES.stockdays}`,
        method: "POST",
        body: {
          inventory_type: body.inventory_type,
          item_code: body.item_code,
          calculation_type: body.calculation_type,
          constanta: body.constanta,
          status: body.status,
        },
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      invalidatesTags: [{ type: "SystemSettingsStockdays", id: "LIST" }],
    }),

    updateStockdays: builder.mutation<
      { message?: string; data?: StockdaysRecord },
      { id: string; body: Partial<CreateStockdaysRequest> }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.stockdays}/${id}`,
        method: "PUT",
        body: {
          inventory_type: body.inventory_type,
          item_code: body.item_code,
          calculation_type: body.calculation_type,
          constanta: body.constanta,
          status: body.status,
        },
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsStockdays", id: "LIST" },
        { type: "SystemSettingsStockdays", id: arg.id },
      ],
    }),

    deleteStockdays: builder.mutation<
      { message?: string; id?: string },
      string
    >({
      query: (id) => ({
        url: `${ROUTES.stockdays}/${id}`,
        method: "DELETE",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsStockdays", id: "LIST" },
        { type: "SystemSettingsStockdays", id },
      ],
    }),

    getStockdays: builder.query<StockdaysRecord[], void>({
      query: () => ({
        url: `${ROUTES.stockdays}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<StockdaysRecord>(response),
      providesTags: (result) =>
        result
          ? [
              { type: "SystemSettingsStockdays", id: "LIST" },
              ...result
                .map((r) => r?.id)
                .filter((id): id is string => Boolean(id))
                .map((id) => ({
                  type: "SystemSettingsStockdays" as const,
                  id,
                })),
            ]
          : [{ type: "SystemSettingsStockdays", id: "LIST" }],
    }),

    getStockdaysById: builder.query<StockdaysRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.stockdays}/${encodeURIComponent(id)}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) =>
        normalizeObjectResponse<StockdaysRecord>(response),
      providesTags: (_res, _err, id) => [
        { type: "SystemSettingsStockdays", id },
      ],
    }),

    // PO split
    createPoSplit: builder.mutation<
      { message?: string; data?: PoSplitRecord },
      CreatePoSplitRequest
    >({
      query: (body) => ({
        url: `${ROUTES.poSplit}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: [{ type: "SystemSettingsPoSplit", id: "LIST" }],
    }),

    updatePoSplit: builder.mutation<
      { message?: string; data?: PoSplitRecord },
      {
        id: string;
        body: Partial<CreatePoSplitRequest> & { status?: StatusType };
      }
    >({
      query: ({ id, body }) => ({
        url: `${ROUTES.poSplit}/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsPoSplit", id: "LIST" },
        { type: "SystemSettingsPoSplit", id: arg.id },
      ],
    }),

    deletePoSplit: builder.mutation<{ message?: string; id?: string }, string>({
      query: (id) => ({
        url: `${ROUTES.poSplit}/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: "SystemSettingsPoSplit", id: "LIST" },
        { type: "SystemSettingsPoSplit", id },
      ],
    }),

    getPoSplitSettings: builder.query<PoSplitRecord[], void>({
      query: () => ({
        url: `${ROUTES.poSplit}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeArrayResponse<PoSplitRecord>(response),
      providesTags: (result) =>
        result
          ? [
              { type: "SystemSettingsPoSplit", id: "LIST" },
              ...result
                .map((record) => record?.id)
                .filter((id): id is string => Boolean(id))
                .map((id) => ({ type: "SystemSettingsPoSplit" as const, id })),
            ]
          : [{ type: "SystemSettingsPoSplit", id: "LIST" }],
    }),

    getPoSplitSettingById: builder.query<PoSplitRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.poSplit}/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeObjectResponse<PoSplitRecord>(response),
      providesTags: (_res, _err, id) => [{ type: "SystemSettingsPoSplit", id }],
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
  useGetAccessControlMatrixByIdQuery,
  useCreateAccessControlMatrixMutation,
  useUpdateAccessControlMatrixMutation,
  useDeleteAccessControlMatrixMutation,
  useCreateApprovalWorkflowMutation,
  useUpdateApprovalWorkflowMutation,
  useDeleteApprovalWorkflowMutation,
  useGetApprovalWorkflowsQuery,
  useGetApprovalWorkflowByIdQuery,
  useCreateGlobalWorkingDaysMutation,
  useUpdateGlobalWorkingDaysMutation,
  useDeleteGlobalWorkingDaysMutation,
  useGetGlobalWorkingDaysQuery,
  useGetGlobalWorkingDaysByIdQuery,
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
  useGetProcessByIdQuery,
  useCreateUomMutation,
  useUpdateUomMutation,
  useDeleteUomMutation,
  useGetUomsQuery,
  useGetUomByIdQuery,
  useCreateTypeParameterMutation,
  useUpdateTypeParameterMutation,
  useDeleteTypeParameterMutation,
  useGetTypeParametersQuery,
  useGetTypeParameterByIdQuery,
  useCreateSafetyStockMutation,
  useCreateSafetyStockBulkMutation,
  useUpdateSafetyStockMutation,
  useDeleteSafetyStockMutation,
  useGetSafetyStockQuery,
  useGetSafetyStockByIdQuery,
  useCalculateSafetyStockQuery,
  useCreateStockdaysMutation,
  useUpdateStockdaysMutation,
  useDeleteStockdaysMutation,
  useGetStockdaysQuery,
  useGetStockdaysByIdQuery,
  useCreatePoSplitMutation,
  useUpdatePoSplitMutation,
  useDeletePoSplitMutation,
  useGetPoSplitSettingsQuery,
  useGetPoSplitSettingByIdQuery,
  useGetRoleByIdQuery,
  useGetDepartmentByIdQuery,
  useGetKanbanStandardByIdQuery,
} = systemSettingsSlice;
