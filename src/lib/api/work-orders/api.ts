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
  wo_type: string;
  target_date: string;
  items: CreateWorkOrderItemRequest[];
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
  source_material_uniq: string | null;
  target_material_uniq: string | null;
  part_name: string | null;
  model_grade: string | null;
  input_qty: number | null;
  output_qty: number | null;
  date_issued: string | null;
  remarks: string | null;
};

export type WorkOrderItemRecord = {
  id: string;
  item_uniq_code: string;
  quantity: number;
  uom: string;
  process_name: string;
  status?: string;
  part_name?: string;
  part_number?: string;
  model?: string;
};

export type WorkOrderRecord = {
  id: string;
  wo_number: string;
  wo_type: string;
  status?: string;
  approval_status?: string;
  created_at?: string;
  target_date?: string;
  operator_name?: string;
  uniq_total?: number;
  uniq_closed?: number;
  aging_days?: number;
  items: WorkOrderItemRecord[];
};

export type RmProcessingWorkOrderRecord = {
  id: string;
  source_material_uniq?: string;
  target_material_uniq?: string;
  part_name?: string;
  model_grade?: string;
  input_qty?: number;
  output_qty?: number;
  date_issued?: string;
  date_completed?: string;
  remarks?: string;
  status?: string;
  created_at?: string;
};

const toWorkOrderItem = (raw: unknown): WorkOrderItemRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    id:
      getString(record, ["id", "uuid", "item_id", "work_order_item_id"]) ??
      getString(record, ["item_uniq_code", "uniq", "uniq_code"]) ??
      "",
    item_uniq_code:
      getString(record, ["item_uniq_code", "uniq", "uniq_code"]) ?? "",
    quantity: getNumber(record, ["quantity", "qty"]) ?? 0,
    uom: getString(record, ["uom", "unit", "unit_measurement"]) ?? "pcs",
    process_name:
      getString(record, ["process_name", "process", "processName"]) ?? "",
    status: getString(record, ["status", "item_status"]),
    part_name: getString(record, ["part_name", "item_name", "product_name", "partName"]),
    part_number: getString(record, ["part_number", "part_no", "partNumber"]),
    model: getString(record, ["model", "product_model", "assembly_code"]),
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
    status: getString(record, ["status", "wo_status"]),
    approval_status: getString(record, ["approval_status", "approvalStatus"]),
    created_at: getString(record, ["created_at", "createdAt", "create_date", "createDate"]),
    target_date: getString(record, ["target_date", "targetDate"]),
    operator_name: getString(record, ["operator_name", "operator", "assigned_to", "created_by"]),
    uniq_total:
      getNumber(record, ["uniq_total", "total_uniq", "uniq_count", "total_items"]) ??
      items.length,
    uniq_closed: getNumber(record, ["uniq_closed", "closed_uniq", "completed_items"]),
    aging_days: getNumber(record, ["aging_days", "aging", "agingDays"]),
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
    source_material_uniq: getString(record, ["source_material_uniq", "sourceMaterialUniq"]),
    target_material_uniq: getString(record, ["target_material_uniq", "targetMaterialUniq"]),
    part_name: getString(record, ["part_name", "partName", "item_name"]),
    model_grade: getString(record, ["model_grade", "modelGrade", "grade_size", "gradeSize"]),
    input_qty: getNumber(record, ["input_qty", "inputQty", "qty_input", "qtyInput"]),
    output_qty: getNumber(record, ["output_qty", "outputQty", "qty_output", "qtyOutput"]),
    date_issued: getString(record, ["date_issued", "dateIssued"]),
    date_completed: getString(record, ["date_completed", "dateCompleted"]),
    remarks: getString(record, ["remarks", "notes"]),
    status: getString(record, ["status"]),
    created_at: getString(record, ["created_at", "createdAt"]),
  };
};

export const workOrdersApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getWorkOrders: builder.query<WorkOrderRecord[], void>({
        query: () => ({
          url: "/api/work-order/list",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          normalizeArrayResponse<unknown>(response).map(toWorkOrderRecord),
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: string }> = [{ type: TAG, id: "LIST" }];
          if (!result) return base;
          return base.concat(
            result
              .map((record) => record.id)
              .filter(Boolean)
              .map((id) => ({ type: TAG, id })),
          );
        },
      }),
      getWorkOrderById: builder.query<WorkOrderRecord, string>({
        query: (id) => ({
          url: `/api/work-order/${encodeURIComponent(id)}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          toWorkOrderRecord(normalizeObjectResponse<unknown>(response) ?? response),
        providesTags: (_result, _error, id) => [{ type: TAG, id }],
      }),
      createWorkOrder: builder.mutation<WorkOrderRecord, CreateWorkOrderRequest>({
        query: (body) => ({
          url: "/api/work-order/create",
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
      getRmProcessingWorkOrders: builder.query<RmProcessingWorkOrderRecord[], void>({
        query: () => ({
          url: "/api/work-order/rm-processing/",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          normalizeArrayResponse<unknown>(response).map(toRmProcessingWorkOrderRecord),
        providesTags: [{ type: TAG, id: "RM_PROCESSING_LIST" }],
      }),
      createRmProcessingWorkOrder: builder.mutation<
        RmProcessingWorkOrderRecord,
        RmProcessingWorkOrderRequest
      >({
        query: (body) => ({
          url: "/api/work-order/rm-processing",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          toRmProcessingWorkOrderRecord(normalizeObjectResponse<unknown>(response) ?? response),
        invalidatesTags: [{ type: TAG, id: "RM_PROCESSING_LIST" }],
      }),
    }),
  });

export const {
  useGetWorkOrdersQuery,
  useGetWorkOrderByIdQuery,
  useCreateWorkOrderMutation,
  useGenerateBulkWorkOrderMutation,
  useGetRmProcessingWorkOrdersQuery,
  useCreateRmProcessingWorkOrderMutation,
} = workOrdersApiSlice;