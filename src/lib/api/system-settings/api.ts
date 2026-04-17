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
  accessControlMatrix: "/api/access-control",
  approvalWorkflow: "/api/approval-workflows",
  globalWorkingDays: "/global-parameters",
  kanban: "/kanban",
  machinePattern: "/api/machine-parameters",
  process: "/process",
  uom: "/unit-measurement",
  typeParameter: "/type-parameter",
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

const normalizeGlobalWorkingDaysRecord = (record: unknown): GlobalWorkingDaysRecord | null => {
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
    parameter_group: parameterGroup == null ? undefined : String(parameterGroup),
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

const normalizeGlobalWorkingDaysPayload = (body: CreateGlobalWorkingDaysRequest) => ({
  parameter_group: String(body.parameter_group ?? "").trim(),
  period: String(body.period ?? "").trim(),
  working_days: Number(body.working_days ?? 0),
  status: String(body.status ?? "active").trim().toLowerCase(),
});

// Backends are inconsistent: some use "Active"/"Inactive", others "active"/"inactive".
export type StatusType = string;

export type RolePermissions = Record<string, Record<string, boolean>>;

const normalizeRolePermissions = (role: unknown): RolePermissions | undefined => {
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
  code: String(body.code ?? body.unit_code ?? "").trim().toUpperCase(),
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
      invalidatesTags: [{ type: "SystemSettingsRoles", id: "LIST" }],
    }),

    updateRole: builder.mutation<{ message?: string; data?: RoleRecord }, { id: string; body: Partial<CreateRoleRequest> }>({
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
      transformResponse: (response: unknown) => normalizeArrayResponse<DepartmentRecord>(response),
      providesTags: (result) =>
        result
          ? [
              { type: "SystemSettingsDepartments", id: "LIST" },
              ...result
                .map((d) => d?.id)
                .filter((id): id is string => Boolean(id))
                .map((id) => ({ type: "SystemSettingsDepartments" as const, id })),
            ]
          : [{ type: "SystemSettingsDepartments", id: "LIST" }],
    }),

    createDepartment: builder.mutation<{ message?: string; data?: DepartmentRecord }, CreateDepartmentRequest>({
      query: (body) => ({
        url: `${ROUTES.department}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: [{ type: "SystemSettingsDepartments", id: "LIST" }],
    }),

    updateDepartment: builder.mutation<{ message?: string; data?: DepartmentRecord }, { id: string; body: Partial<CreateDepartmentRequest> }>({
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

    deleteDepartment: builder.mutation<{ message?: string; id?: string }, string>({
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
      transformResponse: (response: unknown) => normalizeObjectResponse<DepartmentRecord>(response),
      providesTags: (_res, _err, id) => [{ type: "SystemSettingsDepartments", id }],
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
        body: normalizeGlobalWorkingDaysPayload(body),
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ({
        message: "OK",
        data: normalizeGlobalWorkingDaysRecord(normalizeObjectResponse<unknown>(response) ?? response) ?? undefined,
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
        data: normalizeGlobalWorkingDaysRecord(normalizeObjectResponse<unknown>(response) ?? response) ?? undefined,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "SystemSettingsGlobalParameters", id: "LIST" },
        { type: "SystemSettingsGlobalParameters", id: arg.id },
      ],
    }),

    deleteGlobalWorkingDays: builder.mutation<{ message?: string; id?: string }, string>({
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
        const base = [{ type: "SystemSettingsGlobalParameters" as const, id: "LIST" }];
        const ids = (result ?? [])
          .map((r) => r?.id)
          .filter((id): id is string => typeof id === "string" && Boolean(id));
        return base.concat(ids.map((id) => ({ type: "SystemSettingsGlobalParameters" as const, id })));
      },
    }),

    getGlobalWorkingDaysById: builder.query<GlobalWorkingDaysRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.globalWorkingDays}/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizeGlobalWorkingDaysRecord(normalizeObjectResponse<unknown>(response) ?? response),
      providesTags: (_res, _err, id) => [{ type: "SystemSettingsGlobalParameters", id }],
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

    deleteKanbanStandard: builder.mutation<{ message?: string; id?: string }, string>({
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
      transformResponse: (response: unknown) => normalizeObjectResponse<KanbanStandardRecord>(response),
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
        normalizeArrayResponse<ProcessRecord>(response),
      providesTags: (result) => {
        const base = [{ type: "SystemSettingsProcess" as const, id: "LIST" }];
        const ids = (result ?? [])
          .map((r) => r?.id)
          .filter((id): id is string => typeof id === "string" && Boolean(id));
        return base.concat(ids.map((id) => ({ type: "SystemSettingsProcess" as const, id })));
      },
    }),

    getProcessById: builder.query<ProcessRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.process}/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeObjectResponse<ProcessRecord>(response),
      providesTags: (_res, _err, id) => [{ type: "SystemSettingsProcess", id }],
    }),

    // UoM
    createUom: builder.mutation<{ message?: string; data?: UomRecord }, CreateUomRequest>({
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
        return base.concat(ids.map((id) => ({ type: "SystemSettingsUom" as const, id })));
      },
    }),

    getUomById: builder.query<UomRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.uom}/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeUomRecord(normalizeObjectResponse<unknown>(response)),
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

    deleteTypeParameter: builder.mutation<{ message?: string; id?: string }, string>({
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
        const base = [{ type: "SystemSettingsTypeParameter" as const, id: "LIST" }];
        const ids = (result ?? [])
          .map((r) => r?.id)
          .filter((id): id is string => typeof id === "string" && Boolean(id));
        return base.concat(ids.map((id) => ({ type: "SystemSettingsTypeParameter" as const, id })));
      },
    }),

    getTypeParameterById: builder.query<TypeParameterRecord | null, string>({
      query: (id) => ({
        url: `${ROUTES.typeParameter}/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeObjectResponse<TypeParameterRecord>(response),
      providesTags: (_res, _err, id) => [{ type: "SystemSettingsTypeParameter", id }],
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
  useGetRoleByIdQuery,
  useGetDepartmentByIdQuery,
  useGetKanbanStandardByIdQuery,
} = systemSettingsSlice;
