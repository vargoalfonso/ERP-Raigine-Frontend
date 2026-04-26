import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const TAG = "WorkOrders" as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const normalizeArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (isRecord(response)) {
    const data = response.data;
    if (Array.isArray(data)) return data as T[];
    if (isRecord(data) && Array.isArray(data.data)) return data.data as T[];
    if (isRecord(data) && Array.isArray((data as UnknownRecord).items)) {
      return (data as UnknownRecord).items as T[];
    }
  }
  return [];
};

const normalizeObjectResponse = <T,>(response: unknown): T | null => {
  if (isRecord(response)) {
    const data = response.data;
    if (isRecord(data)) {
      const nested = data.data;
      if (isRecord(nested)) return nested as T;
      return data as T;
    }
  }
  return isRecord(response) ? (response as T) : null;
};

export type Pagination = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type Paginated<T> = {
  items: T[];
  pagination: Pagination;
};

const normalizePaginatedResponse = <T,>(response: unknown): Paginated<T> => {
  const empty: Paginated<T> = {
    items: [],
    pagination: { total: 0, page: 1, limit: 20, total_pages: 1 },
  };

  if (!isRecord(response)) return empty;
  const data = response.data;
  if (!isRecord(data)) return empty;
  const itemsRaw = (data as UnknownRecord).items;
  const paginationRaw = (data as UnknownRecord).pagination;

  const items = Array.isArray(itemsRaw) ? (itemsRaw as T[]) : [];
  const paginationRecord = isRecord(paginationRaw) ? (paginationRaw as UnknownRecord) : {};

  return {
    items,
    pagination: {
      total: getNumber(paginationRecord, ["total"]) ?? empty.pagination.total,
      page: getNumber(paginationRecord, ["page"]) ?? empty.pagination.page,
      limit: getNumber(paginationRecord, ["limit"]) ?? empty.pagination.limit,
      total_pages: getNumber(paginationRecord, ["total_pages", "totalPages"]) ?? empty.pagination.total_pages,
    },
  };
};

const getString = (record: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const getNumber = (record: UnknownRecord, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const getArray = (record: UnknownRecord, keys: string[]): unknown[] => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

export type CreateWorkOrderItemRequest = {
  item_uniq_code: string;
  quantity: number;
  uom: string;
  process_name: string;
};

export type CreateWorkOrderRequest = {
  wo_type: "New" | "Rework" | "Assembly" | "Additional" | string;
  reference_wo: string | null;
  created_date: string;
  target_date: string;
  items: CreateWorkOrderItemRequest[];
  notes: string | null;
};

export type WorkOrderApprovalDecision = "approve" | "reject";

export type WorkOrderApprovalRequest = {
  decision: WorkOrderApprovalDecision;
  notes: string | null;
};

export type WorkOrderBulkApprovalRequest = {
  decision: WorkOrderApprovalDecision;
  wo_numbers: string[];
  notes: string | null;
};

export type BulkGenerateWorkOrderItemRequest = {
  uniq_code: string;
  qty: number;
  kanban_count: number | null;
  item_target_date: string | null;
};

export type BulkGenerateWorkOrderRequest = {
  prl_reference: string | null;
  customer_name: string | null;
  product_model: string | null;
  wo_type: string;
  target_date: string;
  items: BulkGenerateWorkOrderItemRequest[];
};

export type RmProcessingWorkOrderRequest = {
  source_material_uniq: string;
  target_material_uniq: string;
  model: string;
  grade_size: string;
  input_qty: number;
  input_uom: string;
  output_qty: number;
  output_uom: string;
  date_issued: string;
  remarks: string | null;
};

export type WorkOrderUniqSource = "raw_material" | "indirect" | "subcon";

export type WorkOrderUniqOption = {
  uniq_code: string;
  part_name?: string;
  part_number?: string;
  model?: string;
  grade_size?: string;
  uom?: string;
  source?: string;
};

export type WorkOrderSummary = {
  active_wos: number;
  completed: number;
  pending_wos: number;
  total_uniqs: number;
};

export type GetWorkOrdersParams = {
  page: number;
  limit: number;
};

export type WorkOrderItemRecord = {
  id: string;
  wo_item_id?: string;
  item_uniq_code: string;
  quantity: number;
  uom: string;
  process_name: string;
  kanban_number?: string;
  status?: string;
  part_name?: string;
  part_number?: string;
  model?: string;
  qr_data_url?: string;
  process_flow_json?: unknown;
};

export type WorkOrderRecord = {
  id: string;
  wo_number: string;
  wo_type: string;
  wo_kind?: string;
  status?: string;
  approval_status?: string;
  created_at?: string;
  created_date?: string;
  target_date?: string;
  operator_name?: string;
  created_by_name?: string;
  uniq_total?: number;
  uniq_closed?: number;
  aging_days?: number;
  notes?: string;
  reference_wo?: string | null;
  qr_data_url?: string;
  items: WorkOrderItemRecord[];
};

export type RmProcessingWorkOrderRecord = {
  id: string;
  wo_number?: string;
  wo_type?: string;
  wo_kind?: string;
  source_material_uniq?: string;
  target_material_uniq?: string;
  model?: string;
  grade_size?: string;
  input_qty?: number;
  input_uom?: string;
  output_qty?: number;
  output_uom?: string;
  date_issued?: string;
  date_completed?: string;
  cycle_time_days?: number;
  remarks?: string;
  status?: string;
  approval_status?: string;
  created_date?: string;
  created_by_name?: string;
  aging_days?: number;
  qr_data_url?: string;
  created_at?: string;
};

const toWorkOrderItem = (raw: unknown): WorkOrderItemRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    id:
      getString(record, ["id", "uuid", "item_id", "work_order_item_id"]) ??
      getString(record, ["item_uniq_code", "uniq", "uniq_code"]) ??
      "",
    wo_item_id: getString(record, ["wo_item_id", "work_order_item_id"]),
    item_uniq_code:
      getString(record, ["item_uniq_code", "uniq", "uniq_code"]) ?? "",
    quantity: getNumber(record, ["quantity", "qty"]) ?? 0,
    uom: getString(record, ["uom", "unit", "unit_measurement"]) ?? "pcs",
    process_name:
      getString(record, ["process_name", "process", "processName"]) ?? "",
    kanban_number: getString(record, ["kanban_number", "kanbanNumber"]),
    status: getString(record, ["status", "item_status"]),
    part_name: getString(record, ["part_name", "item_name", "product_name", "partName"]),
    part_number: getString(record, ["part_number", "part_no", "partNumber"]),
    model: getString(record, ["model", "product_model", "assembly_code"]),
    qr_data_url: getString(record, ["qr_data_url", "qrDataUrl"]),
    process_flow_json: (record as UnknownRecord)["process_flow_json"],
  };
};

const toWorkOrderRecord = (raw: unknown): WorkOrderRecord => {
  const record = isRecord(raw) ? raw : {};
  const items = getArray(record, ["items", "details", "work_order_items", "lines"]).map(
    toWorkOrderItem
  );

  return {
    id:
      getString(record, ["id", "uuid", "wo_id", "work_order_id"]) ??
      getString(record, ["wo_number", "woNumber"]) ??
      "",
    wo_number: getString(record, ["wo_number", "woNumber", "number"]) ?? "",
    wo_type: getString(record, ["wo_type", "woType", "type"]) ?? "New",
    wo_kind: getString(record, ["wo_kind", "woKind"]),
    status: getString(record, ["status", "wo_status"]),
    approval_status: getString(record, ["approval_status", "approvalStatus"]),
    created_at: getString(record, ["created_at", "createdAt", "create_date", "createDate", "created_date"]),
    created_date: getString(record, ["created_date", "createdDate"]),
    target_date: getString(record, ["target_date", "targetDate"]),
    operator_name: getString(record, ["operator_name", "operator", "assigned_to"]),
    created_by_name: getString(record, ["created_by_name", "createdByName", "created_by"]),
    uniq_total:
      getNumber(record, ["uniq_total", "total_uniq", "uniq_count", "total_items"]) ??
      items.length,
    uniq_closed: getNumber(record, ["uniq_closed", "closed_uniq", "completed_items"]),
    aging_days: getNumber(record, ["aging_days", "aging", "agingDays"]),
    notes: getString(record, ["notes", "note"]),
    reference_wo: getString(record, ["reference_wo", "referenceWo"]) ?? null,
    qr_data_url: getString(record, ["qr_data_url", "qrDataUrl"]),
    items,
  };
};

const toRmProcessingWorkOrderRecord = (raw: unknown): RmProcessingWorkOrderRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    id:
      getString(record, ["id", "uuid", "rm_processing_id", "work_order_id"]) ??
      getString(record, ["source_material_uniq", "sourceMaterialUniq"]) ??
      "",
    wo_number: getString(record, ["wo_number", "woNumber", "number"]),
    wo_type: getString(record, ["wo_type", "woType", "type"]),
    wo_kind: getString(record, ["wo_kind", "woKind"]),
    source_material_uniq: getString(record, ["source_material_uniq", "sourceMaterialUniq"]),
    target_material_uniq: getString(record, ["target_material_uniq", "targetMaterialUniq"]),
    model: getString(record, ["model"]),
    grade_size: getString(record, ["grade_size", "gradeSize", "model_grade", "modelGrade"]),
    input_qty: getNumber(record, ["input_qty", "inputQty", "qty_input", "qtyInput"]),
    input_uom: getString(record, ["input_uom", "inputUom"]),
    output_qty: getNumber(record, ["output_qty", "outputQty", "qty_output", "qtyOutput"]),
    output_uom: getString(record, ["output_uom", "outputUom"]),
    date_issued: getString(record, ["date_issued", "dateIssued"]),
    date_completed: getString(record, ["date_completed", "dateCompleted"]),
    cycle_time_days: getNumber(record, ["cycle_time_days", "cycleTimeDays"]),
    remarks: getString(record, ["remarks", "notes"]),
    status: getString(record, ["status"]),
    approval_status: getString(record, ["approval_status", "approvalStatus"]),
    created_date: getString(record, ["created_date", "createdDate"]),
    created_by_name: getString(record, ["created_by_name", "createdByName", "created_by"]),
    aging_days: getNumber(record, ["aging_days", "aging", "agingDays"]),
    qr_data_url: getString(record, ["qr_data_url", "qrDataUrl"]),
    created_at: getString(record, ["created_at", "createdAt"]),
  };
};

const toWorkOrderUniqOption = (raw: unknown): WorkOrderUniqOption => {
  const record = isRecord(raw) ? raw : {};
  return {
    uniq_code: getString(record, ["uniq_code", "uniq", "item_uniq_code"]) ?? "",
    part_name: getString(record, ["part_name", "partName", "item_name", "name"]),
    part_number: getString(record, ["part_number", "partNumber", "part_no"]),
    model: getString(record, ["model", "product_model", "assembly_code"]),
    grade_size: getString(record, ["grade_size", "gradeSize", "model_grade", "modelGrade"]),
    uom: getString(record, ["uom", "unit"]),
    source: getString(record, ["source", "inventory_source", "type"]),
  };
};

const toWorkOrderSummary = (raw: unknown): WorkOrderSummary => {
  const record = isRecord(raw) ? raw : {};
  return {
    active_wos: getNumber(record, ["active_wos", "active"]) ?? 0,
    completed: getNumber(record, ["completed"]) ?? 0,
    pending_wos: getNumber(record, ["pending_wos", "pending"]) ?? 0,
    total_uniqs: getNumber(record, ["total_uniqs", "uniqs", "totalUniqs"]) ?? 0,
  };
};

export const workOrdersApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getWorkOrders: builder.query<Paginated<WorkOrderRecord>, GetWorkOrdersParams>({
        query: ({ page, limit }) => ({
          url: "/working-order/work-orders",
          method: "GET",
          params: { page, limit },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const normalized = normalizePaginatedResponse<unknown>(response);
          return {
            items: normalized.items.map(toWorkOrderRecord),
            pagination: normalized.pagination,
          };
        },
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: string }> = [{ type: TAG, id: "LIST" }];
          if (!result) return base;
          return base.concat(
            result.items
              .map((record) => record.id)
              .filter(Boolean)
              .map((id) => ({ type: TAG, id })),
          );
        },
      }),
      getWorkOrderById: builder.query<WorkOrderRecord, string>({
        query: (id) => ({
          url: `/working-order/work-orders/${encodeURIComponent(id)}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          toWorkOrderRecord(normalizeObjectResponse<unknown>(response) ?? response),
        providesTags: (_result, _error, id) => [{ type: TAG, id }],
      }),
      createWorkOrder: builder.mutation<WorkOrderRecord, CreateWorkOrderRequest>({
        query: (body) => ({
          url: "/working-order/work-orders",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          toWorkOrderRecord(normalizeObjectResponse<unknown>(response) ?? response),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),
      generateBulkWorkOrder: builder.mutation<WorkOrderRecord, BulkGenerateWorkOrderRequest>({
        query: (body) => ({
          url: "/api/work-order/bulk/generate",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          toWorkOrderRecord(normalizeObjectResponse<unknown>(response) ?? response),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),
      getWorkOrdersSummary: builder.query<WorkOrderSummary, void>({
        query: () => ({
          url: "/working-order/work-orders/summary",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          toWorkOrderSummary(normalizeObjectResponse<unknown>(response) ?? response),
        providesTags: [{ type: TAG, id: "SUMMARY" }],
      }),
      getWorkOrderUniqOptions: builder.query<WorkOrderUniqOption[], { limit: number; sources: WorkOrderUniqSource[] }>({
        query: ({ limit, sources }) => ({
          url: "/working-order/work-orders/form-options/uniq",
          method: "GET",
          params: { limit, sources: sources.join(",") },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          normalizeArrayResponse<unknown>(response).map(toWorkOrderUniqOption).filter((o) => Boolean(o.uniq_code)),
      }),
      approveWorkOrder: builder.mutation<unknown, { uuid: string; body: WorkOrderApprovalRequest }>({
        query: ({ uuid, body }) => ({
          url: `/working-order/work-orders/${encodeURIComponent(uuid)}/approval`,
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: (_r, _e, { uuid }) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: uuid },
          { type: TAG, id: "SUMMARY" },
        ],
      }),
      bulkApproveWorkOrders: builder.mutation<unknown, WorkOrderBulkApprovalRequest>({
        query: (body) => ({
          url: "/working-order/work-orders/bulk-approval",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: [{ type: TAG, id: "LIST" }, { type: TAG, id: "SUMMARY" }],
      }),
      getRmProcessingWorkOrders: builder.query<Paginated<RmProcessingWorkOrderRecord>, GetWorkOrdersParams>({
        query: ({ page, limit }) => ({
          url: "/working-order/rm-processing/work-orders",
          method: "GET",
          params: { page, limit },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const normalized = normalizePaginatedResponse<unknown>(response);
          return {
            items: normalized.items.map(toRmProcessingWorkOrderRecord),
            pagination: normalized.pagination,
          };
        },
        providesTags: [{ type: TAG, id: "RM_PROCESSING_LIST" }],
      }),
      getRmProcessingWorkOrdersSummary: builder.query<WorkOrderSummary, void>({
        query: () => ({
          url: "/working-order/rm-processing/work-orders/summary",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          toWorkOrderSummary(normalizeObjectResponse<unknown>(response) ?? response),
        providesTags: [{ type: TAG, id: "RM_PROCESSING_SUMMARY" }],
      }),
      createRmProcessingWorkOrder: builder.mutation<
        RmProcessingWorkOrderRecord,
        RmProcessingWorkOrderRequest
      >({
        query: (body) => ({
          url: "/working-order/rm-processing/work-orders",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          toRmProcessingWorkOrderRecord(normalizeObjectResponse<unknown>(response) ?? response),
        invalidatesTags: [
          { type: TAG, id: "RM_PROCESSING_LIST" },
          { type: TAG, id: "RM_PROCESSING_SUMMARY" },
        ],
      }),
    }),
  });

export const {
  useGetWorkOrdersQuery,
  useGetWorkOrderByIdQuery,
  useCreateWorkOrderMutation,
  useGenerateBulkWorkOrderMutation,
  useGetWorkOrdersSummaryQuery,
  useGetWorkOrderUniqOptionsQuery,
  useApproveWorkOrderMutation,
  useBulkApproveWorkOrdersMutation,
  useGetRmProcessingWorkOrdersQuery,
  useGetRmProcessingWorkOrdersSummaryQuery,
  useCreateRmProcessingWorkOrderMutation,
} = workOrdersApiSlice;