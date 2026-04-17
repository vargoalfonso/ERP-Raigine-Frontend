import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

export type PoBudgetType = "raw-material" | "subcon" | "indirect";

export type PoBudgetSummary = {
  total_entries: number;
  total_sales_plan: number;
  total_po: number;
  total_prl: number;
  delta_apo_prl: number;
  pending_approvals: number;
};

export interface PoBudgetEntryRequest {
  customer_id: number | string;
  customer_name: string;
  uniq_code: string;
  product_model: string;
  part_name: string;
  part_number: string;
  uom: string;
  weight_kg: number;
  description?: string;
  supplier_name: string;
  supplier_id: number | string;
  period: string;
  sales_plan: number;
  purchase_request: number;
  po1_pct: number;
  po2_pct: number;
  prl: number;
  budget_subtype?: string;
}

export interface PoBudgetBulkItemSupplierRequest {
  supplier_id: number | string;
  supplier_name: string;
  quantity: number;
}

export interface PoBudgetBulkItemRequest {
  prl_item_id: number | string;
  uniq_code: string;
  sales_plan: number;
  po1_pct: number;
  po2_pct: number;
  weight_kg: number;
  uom: string;
  suppliers: PoBudgetBulkItemSupplierRequest[];
}

export interface PoBudgetBulkRequest {
  prl_id: string;
  budget_subtype: "adhoc" | "regular" | string;
  period: string;
  items: PoBudgetBulkItemRequest[];
}

export interface PoBudgetUpdateRequest {
  purchase_request: number;
  prl: number;
  po1_pct: number;
  po2_pct: number;
  period: string;
}

export type PoBudgetRow = {
  key: string;
  id?: string;
  poBudgetRef?: string;
  uniq: string;
  customer: string;
  customerId?: string;
  contactPerson?: string;
  productModel: string;
  partName: string;
  partNumber?: string;
  supplier: string;
  supplierId?: string;
  type: string;
  salesPlan: number;
  pr: number;
  po1: number;
  po2: number;
  prl: number;
  totalPo: number;
  apoPrl: number;
  period: string;
  uom?: string;
  weightKg?: number;
  description?: string;
  status: "approved" | "pending";
  approval: "Approved" | "Pending";
};

export type PoBudgetGroupedDetail = {
  basic_information?: {
    id?: number | string;
    po_budget_ref?: string;
    customer_name?: string;
    uniq?: string;
    product_model?: string;
    part_name?: string;
    part_number?: string;
    supplier_name?: string;
    budget_type?: string;
    type_label?: string;
    period?: string;
  };
  budget_calculations?: {
    sales_plan?: number;
    purchase_request?: number;
    prl_amount?: number;
    po1_pct?: number;
    po2_pct?: number;
  };
  calculation_results?: {
    po1_amount?: number;
    po2_amount?: number;
    total_po?: number;
    apo_prl_abs?: number;
    apo_prl_state?: string;
  };
  additional_information?: {
    submitted_by?: string;
    submitted_by_name?: string;
    submitted_at?: string;
    approved_by?: string;
    approved_by_name?: string;
    approved_at?: string;
    approval_date?: string;
    notes?: string;
  };
  history?: Array<{
    date_time?: string;
    action?: string;
    user?: string;
    user_id?: string;
    notes?: string;
  }>;
};

const ok = <T,>(data: T, message = "OK", pagination?: ApiResponse<T>["pagination"]): ApiResponse<T> => ({
  message,
  status: "success",
  data,
  ...(pagination ? { pagination } : {}),
});

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const getString = (record: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
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

const normalizeListResponse = (response: unknown): unknown[] => {
  if (Array.isArray(response)) return response;
  if (!isRecord(response)) return [];

  if (Array.isArray(response.data)) return response.data;
  if (isRecord(response.data) && Array.isArray(response.data.data)) return response.data.data;
  if (isRecord(response.data) && Array.isArray(response.data.items)) return response.data.items;

  return [];
};

const normalizeObjectResponse = (response: unknown): unknown => {
  if (!isRecord(response)) return response;
  if (isRecord(response.data) && isRecord(response.data.data)) return response.data.data;
  if (isRecord(response.data)) return response.data;
  return response;
};

const parsePagination = (response: unknown): ApiResponse<unknown>["pagination"] | undefined => {
  if (!isRecord(response)) return undefined;

  const direct = isRecord(response.pagination) ? response.pagination : undefined;
  const nested = isRecord(response.data) && isRecord(response.data.pagination) ? response.data.pagination : undefined;
  const source = direct ?? nested;
  if (!source) return undefined;

  return {
    total: getNumber(source, ["total"]) ?? 0,
    page: getNumber(source, ["page"]) ?? 1,
    perPage: getNumber(source, ["perPage", "per_page", "limit"]) ?? 20,
    totalPages: getNumber(source, ["totalPages", "total_pages"]) ?? 1,
  };
};

const toPoBudgetSummary = (payload: unknown): PoBudgetSummary => {
  const record = isRecord(payload) ? payload : {};

  return {
    total_entries: getNumber(record, ["total_entries", "totalEntries"]) ?? 0,
    total_sales_plan: getNumber(record, ["total_sales_plan", "totalSalesPlan", "sales_plan_total"]) ?? 0,
    total_po: getNumber(record, ["total_po", "totalPo"]) ?? 0,
    total_prl: getNumber(record, ["total_prl", "totalPrl"]) ?? 0,
    delta_apo_prl: getNumber(record, ["delta_apo_prl", "deltaApoPrl", "apo_prl_delta"]) ?? 0,
    pending_approvals: getNumber(record, ["pending_approvals", "pendingApprovals"]) ?? 0,
  };
};

const toPoBudgetRow = (item: unknown, index: number): PoBudgetRow => {
  const record = isRecord(item) ? item : {};
  const salesPlan = getNumber(record, ["sales_plan", "salesPlan"]) ?? 0;
  const purchaseRequest = getNumber(record, ["purchase_request", "purchaseRequest", "pr_qty"]) ?? 0;
  const prl = getNumber(record, ["prl", "prl_amount", "prl_qty"]) ?? 0;
  const po1Pct = getNumber(record, ["po1_pct", "po1_percent"]) ?? 0;
  const po2Pct = getNumber(record, ["po2_pct", "po2_percent"]) ?? 0;
  const po1 = getNumber(record, ["po1_amount", "po1", "po1_qty"]) ?? Math.round((purchaseRequest * po1Pct) / 100);
  const po2 = getNumber(record, ["po2_amount", "po2", "po2_qty"]) ?? Math.round((purchaseRequest * po2Pct) / 100);
  const totalPo = getNumber(record, ["total_po", "totalPo"]) ?? po1 + po2;
  const apoPrl = getNumber(record, ["apo_prl_abs", "apo_prl", "apoPrl"]) ?? Math.abs(totalPo - prl);
  const rawStatus = getString(record, ["status", "approval_status", "apo_prl_state"]);
  const status: PoBudgetRow["status"] = String(rawStatus ?? "pending").toLowerCase() === "approved" ? "approved" : "pending";

  return {
    key: getString(record, ["id", "po_budget_ref", "key"]) ?? `po-budget-${index + 1}`,
    id: getString(record, ["id"]),
    poBudgetRef: getString(record, ["po_budget_ref"]),
    uniq: getString(record, ["uniq_code", "uniq", "item_uniq_code"]) ?? `ITEM-${index + 1}`,
    customer: getString(record, ["customer_name", "customer"]) ?? "-",
    customerId: getString(record, ["customer_id"]),
    contactPerson: getString(record, ["contact_person", "contactPerson", "pic_name", "pic", "contact_name"]),
    productModel: getString(record, ["product_model", "productModel", "model"]) ?? "",
    partName: getString(record, ["part_name", "partName", "description"]) ?? "",
    partNumber: getString(record, ["part_number", "partNumber"]),
    supplier: getString(record, ["supplier_name", "supplier"]) ?? "-",
    supplierId: getString(record, ["supplier_id"]),
    type: getString(record, ["type_label", "budget_subtype", "type"]) ?? "",
    salesPlan,
    pr: purchaseRequest,
    po1,
    po2,
    prl,
    totalPo,
    apoPrl,
    period: getString(record, ["period"]) ?? "-",
    uom: getString(record, ["uom"]),
    weightKg: getNumber(record, ["weight_kg", "weightKg"]),
    description: getString(record, ["description", "notes"]),
    status,
    approval: status === "approved" ? "Approved" : "Pending",
  };
};

export const poBudgetSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: ["PoBudget"] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getPoBudgetSummary: builder.query<ApiResponse<PoBudgetSummary>, { type: PoBudgetType }>({
        query: ({ type }) => ({
          url: `/po-budget/${type}/budget/summary`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(toPoBudgetSummary(normalizeObjectResponse(response))),
        providesTags: (_result, _error, arg) => [{ type: "PoBudget", id: arg.type }],
      }),

      getPoBudgetList: builder.query<ApiResponse<PoBudgetRow[]>, { type: PoBudgetType; page?: number; limit?: number }>({
        query: ({ type, page = 1, limit = 20 }) => ({
          url: `/po-budget/${type}/budget?limit=${limit}&page=${page}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(
            normalizeListResponse(response).map((item, index) => toPoBudgetRow(item, index)),
            "OK",
            parsePagination(response),
          ),
        providesTags: (_result, _error, arg) => [{ type: "PoBudget", id: arg.type }],
      }),

      addPoBudgetEntry: builder.mutation<ApiResponse<PoBudgetRow>, { type: PoBudgetType; body: PoBudgetEntryRequest }>({
        query: ({ type, body }) => ({
          url: `/po-budget/${type}/budget`,
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(toPoBudgetRow(normalizeObjectResponse(response), 0)),
        invalidatesTags: (_result, _error, arg) => [{ type: "PoBudget", id: arg.type }],
      }),

      addPoBudgetBulk: builder.mutation<ApiResponse<unknown>, { type: PoBudgetType; body: PoBudgetBulkRequest }>({
        query: ({ type, body }) => ({
          url: `/po-budget/${type}/budget/bulk`,
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(normalizeObjectResponse(response)),
        invalidatesTags: (_result, _error, arg) => [{ type: "PoBudget", id: arg.type }],
      }),

      getPoBudgetDetail: builder.query<ApiResponse<PoBudgetGroupedDetail>, { type: PoBudgetType; id: string | number }>({
        query: ({ type, id }) => ({
          url: `/po-budget/${type}/budget/${encodeURIComponent(String(id))}/detail?format=grouped`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok((normalizeObjectResponse(response) ?? {}) as PoBudgetGroupedDetail),
        providesTags: (_result, _error, arg) => [{ type: "PoBudget", id: `${arg.type}-${arg.id}` }],
      }),

      updatePoBudgetEntry: builder.mutation<ApiResponse<PoBudgetRow>, { type: PoBudgetType; id: string | number; body: PoBudgetUpdateRequest }>({
        query: ({ type, id, body }) => ({
          url: `/po-budget/${type}/budget/${encodeURIComponent(String(id))}`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(toPoBudgetRow(normalizeObjectResponse(response), 0)),
        invalidatesTags: (_result, _error, arg) => [
          { type: "PoBudget", id: arg.type },
          { type: "PoBudget", id: `${arg.type}-${arg.id}` },
        ],
      }),
    }),
    overrideExisting: true,
  });

export const {
  useGetPoBudgetSummaryQuery,
  useGetPoBudgetListQuery,
  useAddPoBudgetEntryMutation,
  useAddPoBudgetBulkMutation,
  useGetPoBudgetDetailQuery,
  useUpdatePoBudgetEntryMutation,
} = poBudgetSlice;