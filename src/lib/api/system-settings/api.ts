import { apiSlice } from "@/lib/api/instance";
import { ApiResponse, DataArray, DataObject } from "@/types";

// Note:
// The backend route prefixes may differ per environment.
// These defaults follow the same convention used by other slices in this repo:
//   - list:   GET    /<resource>/?page=1&perPage=10
//   - create: POST   /<resource>/create
//   - update: PUT    /<resource>/update/<id>
//   - delete: DELETE /<resource>/delete/<id>
// If your ERP-Raigine backend uses different paths, adjust the constants below.

const ROUTES = {
  role: "/role",
  accessControlMatrix: "/access-control-matrix",
  approvalWorkflow: "/approval",
  globalWorkingDays: "/global",
  kanban: "/kanban",
  machinePattern: "/machine-pattern",
  process: "/process",
  uom: "/uom",
  typeParameter: "/type-parameter",
  safetyStock: "/safety-stock",
  stockdays: "/stockdays-parameter",
  poSplit: "/po-split",
} as const;

export type StatusType = "Active" | "Inactive";

export type CreateRoleRequest = {
  role_name: string;
  // A flattened permissions map: key -> boolean.
  permissions: Record<string, boolean>;
};

export type RoleRecord = {
  id: string;
  role_name: string;
  permissions?: Record<string, boolean>;
};

export type CreateAccessControlMatrixRequest = {
  full_name: string;
  employee_id: string;
  department: string;
  role: string;
};

export type AccessControlMatrixRecord = {
  id: string;
  full_name: string;
  employee_id: string;
  department: string;
  role: string;
};

export type CreateApprovalWorkflowRequest = {
  menu_action: string;
  level_1_role: string;
  level_2_role: string;
  level_3_role: string;
  level_4_role: string;
  status: StatusType;
};

export type ApprovalWorkflowRecord = {
  id: string;
  menu_action: string;
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
  product_name: string;
  product_code: string;
  kanban_qty: number;
  min_stock: number;
  max_stock: number;
  status: StatusType;
};

export type KanbanStandardRecord = {
  id: string;
  product_name: string;
  product_code: string;
  kanban_qty: number;
  min_stock: number;
  max_stock: number;
  status: StatusType;
};

export type CreateMachinePatternRequest = {
  machine_name: string;
  machine_count: number;
  operating_hours: number;
  status: StatusType;
};

export type MachinePatternRecord = {
  id: string;
  machine_name: string;
  machine_count: number;
  operating_hours: number;
  status: StatusType;
};

export type CreateProcessRequest = {
  category: string;
  process_name: string;
  sequence: number;
  status: StatusType;
};

export type ProcessRecord = {
  id: string;
  process_code?: string;
  category: string;
  process_name: string;
  sequence: number;
  status: StatusType;
};

export type CreateUomRequest = {
  type_code: string;
  type_name: string;
  category: string;
  status: StatusType;
};

export type UomRecord = {
  id: string;
  type_code: string;
  type_name: string;
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
  type: string;
  uniq: string;
  calculation_type: string;
  constanta: number;
};

export type SafetyStockRecord = {
  id: string;
  type: string;
  uniq: string;
  calculation_type: string;
  constanta: number;
};

export type CreateStockdaysRequest = {
  type: string;
  uniq: string;
  calculation_type: string;
  constanta: number;
};

export type StockdaysRecord = {
  id: string;
  type: string;
  uniq: string;
  calculation_type: string;
  constanta: number;
};

export type CreatePoSplitRequest = {
  material_type: string;
  min_order_qty: number;
  max_split_lines: number;
  split_rule: string;
  status: StatusType;
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
    createRole: builder.mutation<ApiResponse<DataObject<RoleRecord>>, CreateRoleRequest>({
      query: (body) => ({
        url: `${ROUTES.role}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Access control matrix
    createAccessControlMatrix: builder.mutation<
      ApiResponse<DataObject<AccessControlMatrixRecord>>,
      CreateAccessControlMatrixRequest
    >({
      query: (body) => ({
        url: `${ROUTES.accessControlMatrix}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Approval workflow
    createApprovalWorkflow: builder.mutation<
      ApiResponse<DataObject<ApprovalWorkflowRecord>>,
      CreateApprovalWorkflowRequest
    >({
      query: (body) => ({
        url: `${ROUTES.approvalWorkflow}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Global working days
    createGlobalWorkingDays: builder.mutation<
      ApiResponse<DataObject<GlobalWorkingDaysRecord>>,
      CreateGlobalWorkingDaysRequest
    >({
      query: (body) => ({
        url: `${ROUTES.globalWorkingDays}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Kanban standards
    createKanbanStandard: builder.mutation<
      ApiResponse<DataObject<KanbanStandardRecord>>,
      CreateKanbanStandardRequest
    >({
      query: (body) => ({
        url: `${ROUTES.kanban}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Machine pattern
    createMachinePattern: builder.mutation<
      ApiResponse<DataObject<MachinePatternRecord>>,
      CreateMachinePatternRequest
    >({
      query: (body) => ({
        url: `${ROUTES.machinePattern}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Process
    createProcess: builder.mutation<ApiResponse<DataObject<ProcessRecord>>, CreateProcessRequest>({
      query: (body) => ({
        url: `${ROUTES.process}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // UoM
    createUom: builder.mutation<ApiResponse<DataObject<UomRecord>>, CreateUomRequest>({
      query: (body) => ({
        url: `${ROUTES.uom}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Type parameters
    createTypeParameter: builder.mutation<
      ApiResponse<DataObject<TypeParameterRecord>>,
      CreateTypeParameterRequest
    >({
      query: (body) => ({
        url: `${ROUTES.typeParameter}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Safety stock
    createSafetyStock: builder.mutation<
      ApiResponse<DataObject<SafetyStockRecord>>,
      CreateSafetyStockRequest
    >({
      query: (body) => ({
        url: `${ROUTES.safetyStock}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Stockdays
    createStockdays: builder.mutation<
      ApiResponse<DataObject<StockdaysRecord>>,
      CreateStockdaysRequest
    >({
      query: (body) => ({
        url: `${ROUTES.stockdays}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // PO split
    createPoSplit: builder.mutation<ApiResponse<DataObject<PoSplitRecord>>, CreatePoSplitRequest>({
      query: (body) => ({
        url: `${ROUTES.poSplit}/create`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Optional: list endpoints (used later by the System Settings dashboard tables)
    getRoles: builder.query<ApiResponse<DataArray<RoleRecord>>, { currentPage: number; pageSize: number }>({
      query: ({ currentPage, pageSize }) => ({
        url: `${ROUTES.role}/?page=${currentPage}&perPage=${pageSize}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),
  }),
});

export const {
  useCreateRoleMutation,
  useCreateAccessControlMatrixMutation,
  useCreateApprovalWorkflowMutation,
  useCreateGlobalWorkingDaysMutation,
  useCreateKanbanStandardMutation,
  useCreateMachinePatternMutation,
  useCreateProcessMutation,
  useCreateUomMutation,
  useCreateTypeParameterMutation,
  useCreateSafetyStockMutation,
  useCreateStockdaysMutation,
  useCreatePoSplitMutation,
  useGetRolesQuery,
} = systemSettingsSlice;
