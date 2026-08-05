import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

type QueryValue = string | undefined;

const TAG = "QcDashboard";

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const toStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const ok = <T,>(data: T, message = "OK", pagination?: ApiResponse<T>["pagination"]) => ({
  message,
  status: "success",
  data,
  ...(pagination ? { pagination } : {}),
});

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

type BackendPaginationV2 = {
  total?: unknown;
  page?: unknown;
  limit?: unknown;
  total_pages?: unknown;
};

const toApiPagination = (
  value: unknown,
  fallback: { page: number; limit: number },
  itemsLengthFallback: number
): ApiResponse<unknown>["pagination"] => {
  const p = isRecord(value) ? (value as BackendPaginationV2) : {};
  const total = toNumber(p.total) ?? itemsLengthFallback;
  const page = toNumber(p.page) ?? fallback.page;
  const perPage = toNumber(p.limit) ?? fallback.limit;
  const totalPages =
    toNumber(p.total_pages) ?? (perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1);
  return { total, page, perPage, totalPages };
};

export type QcDashboardOverviewCards = {
  total_reports: number;
  total_defects: number;
  total_scrap: number;
  pending_rework: number;
};

export type QcDashboardBySource = {
  defect_source: string;
  qty_defect: number;
  qty_scrap: number;
};

export type QcDashboardTopIssue = {
  reason_code: string;
  reason_text: string;
  qty_defect: number;
};

export type QcDashboardOverview = {
  as_of: string;
  window_hours: number;
  cards: QcDashboardOverviewCards;
  by_source: QcDashboardBySource[];
  top_issues: QcDashboardTopIssue[];
  implementation_note?: string;
};

export type QcDashboardProductionQcIssue = {
  source: string;
  reason_code: string;
  reason_text: string;
  qty: number;
  qty_defect: number;
  qty_scrap: number;
  process_name: string;
};

export type QcDashboardProductionQcItem = {
  qc_log_id: number;
  report_date: string;
  wo_number: string;
  uniq_code: string;
  kanban_number: string;
  items_checked: number;
  issue_label: string | null;
  qty_defect: number;
  qty_scrap: number;
  quality_rate_percent: number;
  status: string;
  issues?: QcDashboardProductionQcIssue[];
};

export type QcDashboardProductionQcDetail = {
  item: QcDashboardProductionQcItem;
};

export type QcDashboardIncomingQcItem = {
  qc_log_id: number;
  qc_task_id: number;
  report_date: string;
  dn_number: string;
  kanban_pl_scan: string;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  uniq_code: string;
  items_checked: number;
  issue_label: string | null;
  qty_defect: number;
  qty_scrap: number;
  quality_rate_percent: number;
  status: string;
};

export type QcDashboardDefectItem = {
  defect_id: number;
  qc_log_id: number;
  report_date: string;
  defect_source: string;
  kanban_pl: string;
  uniq_code: string;
  product_name: string;
  reason_code: string;
  reason_text: string;
  qty_defect: number;
  qty_scrap: number;
  is_repairable: boolean;
  wo_rework_status: string;
  rework_qc_task_id: number | null;
};

export type QcDashboardProductReturnQcItem = {
  qc_log_id: number;
  product_return_id: number;
  report_date: string;
  product_return_number: string;
  dn_number: string;
  partner_type: string;
  partner_name: string;
  items_checked: number;
  issue_label: string | null;
  qty_rework: number;
  qty_defect: number;
  qty_scrap: number;
  quality_rate_percent: number;
  status: string;
};

export type QcDashboardPaginatedRequest = { limit: number; page: number };

export type CreateQcDashboardManualReportRequest = {
  qc_type: "production" | "incoming";
  report_date: string;
  reference_number: string;
  uniq_code: string;
  number_of_item_check: number;
  issue_reason_code?: string;
  issue_reason_text?: string;
  number_of_defect?: number;
  number_of_scrap?: number;
  status: string;
};

const toQueryString = (params: Record<string, QueryValue>) => {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      search.set(key, value.trim());
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
};

const unwrapList = <T,>(response: unknown, fallbackMessage: string): DashboardListResponse<T> => {
  const root = isRecord(response) ? response : {};
  const rawData = root.data;
  const list = Array.isArray(rawData)
    ? (rawData as T[])
    : isRecord(rawData) && Array.isArray(rawData.data)
      ? (rawData.data as T[])
      : [];

  return {
    message: typeof root.message === "string" ? root.message : fallbackMessage,
    status: typeof root.status === "string" ? root.status : "success",
    data: list,
    total: typeof root.total === "number" ? root.total : list.length,
    filters: isRecord(root.filters) ? root.filters : undefined,
    bulkUploadColumns: toStringList(root.bulk_upload_columns),
  };
};

const unwrapObject = <T,>(response: unknown, fallbackMessage: string): ApiResponse<T> => {
  const root = isRecord(response) ? response : {};
  const rawData = root.data;
  const data = (isRecord(rawData) ? rawData : root) as T;
  return ok(data, typeof root.message === "string" ? root.message : fallbackMessage);
};

export type DashboardListResponse<T> = ApiResponse<T[]> & {
  total?: number;
  filters?: Record<string, unknown>;
  bulkUploadColumns?: string[];
};

export type ProductionQcReportFilters = {
  uniq?: string;
  report_date?: string;
};

export type IncomingQcReportFilters = {
  uniq?: string;
  report_date?: string;
  po_number?: string;
  supplier?: string;
};

export type ProductReturnQcReportFilters = {
  uniq?: string;
  report_date?: string;
  supplier?: string;
  previous_dn_number?: string;
};

export type DefectReportFilters = {
  uniq?: string;
  report_date?: string;
  po_number?: string;
  supplier?: string;
  defect_from?: string;
};

export type QcReportLookupType = "production" | "incoming" | "product_return";

export type ManualReferenceOptionItem = {
  qc_type: string;
  reference_number: string;
  secondary_reference: string;
  uniq_code: string;
  context_id: string;
  kanban_or_packing_number: string;
  part_name: string;
  uom: string;
  item_qty: number;
};

export type ManualReferenceOptionsResponse = {
  items: ManualReferenceOptionItem[];
};

export type QcReportFormOptionsFilters = {
  qc_type: QcReportLookupType;
  q?: string;
  limit?: number;
};

export type CreateQcDashboardReportRequest = {
  qc_type: QcReportLookupType;
  report_date: string;
  reference_number: string;
  uniq_code: string;
  number_of_item_check: number;
  issue_reason_code?: string;
  issue_reason_text?: string;
  number_of_defect?: number;
  number_of_scrap?: number;
  status: string;
};

export const qcDashboardApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getQcDashboardOverview: builder.query<ApiResponse<QcDashboardOverview>, void>({
        query: () => ({
          url: "/qc-dashboard/overview",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(unwrapBackendData<QcDashboardOverview>(response), "OK"),
        providesTags: [{ type: TAG, id: "OVERVIEW_V2" }],
      }),

      getQcDashboardProductionQc: builder.query<ApiResponse<QcDashboardProductionQcItem[]>, QcDashboardPaginatedRequest>({
        query: ({ limit, page }) => ({
          url: "/qc-dashboard/production-qc",
          method: "GET",
          params: { limit, page },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown, _meta, arg) => {
          const payload = unwrapBackendData<unknown>(response);
          const root = isRecord(payload) ? payload : {};
          const items = Array.isArray(root.items) ? (root.items as QcDashboardProductionQcItem[]) : [];
          const pagination = toApiPagination(root.pagination, arg, items.length);
          return ok(items, "OK", pagination);
        },
        providesTags: [{ type: TAG, id: "PRODUCTION_V2" }],
      }),

      getQcDashboardProductionQcDetail: builder.query<ApiResponse<QcDashboardProductionQcDetail>, number>({
        query: (qcLogId) => ({
          url: `/qc-dashboard/production-qc/${qcLogId}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const payload = unwrapBackendData<unknown>(response);
          const root = isRecord(payload) ? payload : {};
          const item = (isRecord(root.item) ? root.item : root) as QcDashboardProductionQcItem;
          return ok({ item }, "OK");
        },
        providesTags: [{ type: TAG, id: "PRODUCTION_V2" }],
      }),

      getQcDashboardIncomingQc: builder.query<ApiResponse<QcDashboardIncomingQcItem[]>, QcDashboardPaginatedRequest>({
        query: ({ limit, page }) => ({
          url: "/qc-dashboard/incoming-qc",
          method: "GET",
          params: { limit, page },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown, _meta, arg) => {
          const payload = unwrapBackendData<unknown>(response);
          const root = isRecord(payload) ? payload : {};
          const items = Array.isArray(root.items) ? (root.items as QcDashboardIncomingQcItem[]) : [];
          const pagination = toApiPagination(root.pagination, arg, items.length);
          return ok(items, "OK", pagination);
        },
        providesTags: [{ type: TAG, id: "INCOMING_V2" }],
      }),

      getQcDashboardDefects: builder.query<ApiResponse<QcDashboardDefectItem[]>, QcDashboardPaginatedRequest>({
        query: ({ limit, page }) => ({
          url: "/qc-dashboard/defects",
          method: "GET",
          params: { limit, page },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown, _meta, arg) => {
          const payload = unwrapBackendData<unknown>(response);
          const root = isRecord(payload) ? payload : {};
          const items = Array.isArray(root.items) ? (root.items as QcDashboardDefectItem[]) : [];
          const pagination = toApiPagination(root.pagination, arg, items.length);
          return ok(items, "OK", pagination);
        },
        providesTags: [{ type: TAG, id: "DEFECTS_V2" }],
      }),

      getQcDashboardProductReturnQc: builder.query<ApiResponse<QcDashboardProductReturnQcItem[]>, QcDashboardPaginatedRequest>({
        query: ({ limit, page }) => ({
          url: "/qc-dashboard/product-return-qc",
          method: "GET",
          params: { limit, page },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown, _meta, arg) => {
          const payload = unwrapBackendData<unknown>(response);
          const root = isRecord(payload) ? payload : {};
          const items = Array.isArray(root.items) ? (root.items as QcDashboardProductReturnQcItem[]) : [];
          const pagination = toApiPagination(root.pagination, arg, items.length);
          return ok(items, "OK", pagination);
        },
        providesTags: [{ type: TAG, id: "PRODUCT_RETURN_V2" }],
      }),

      createQcDashboardManualReport: builder.mutation<ApiResponse<unknown>, CreateQcDashboardManualReportRequest>({
        query: (body) => ({
          url: "/qc-dashboard/reports/manual",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(unwrapBackendData<unknown>(response), "OK"),
        invalidatesTags: [
          { type: TAG, id: "OVERVIEW_V2" },
          { type: TAG, id: "PRODUCTION_V2" },
          { type: TAG, id: "INCOMING_V2" },
          { type: TAG, id: "DEFECTS_V2" },
          { type: TAG, id: "PRODUCT_RETURN_V2" },
        ],
      }),

      getManualReferenceOptions: builder.query<ApiResponse<ManualReferenceOptionsResponse>, QcReportFormOptionsFilters>({
        query: (filters) => ({
          url: `/qc-dashboard/form-options/manual-references${toQueryString({
            qc_type: filters.qc_type,
            q: filters.q,
            limit: filters.limit != null ? String(filters.limit) : undefined,
          })}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const payload = unwrapBackendData<unknown>(response);
          const root = isRecord(payload) ? payload : {};
          const items = Array.isArray(root.items) ? (root.items as ManualReferenceOptionItem[]) : [];
          return ok({ items }, "OK");
        },
      }),

      createQcDashboardReport: builder.mutation<ApiResponse<unknown>, CreateQcDashboardReportRequest>({
        query: (body) => ({
          url: "/qc-dashboard/reports/manual",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(unwrapBackendData<unknown>(response), "OK"),
        invalidatesTags: [
          { type: TAG, id: "OVERVIEW_V2" },
          { type: TAG, id: "PRODUCTION_V2" },
          { type: TAG, id: "INCOMING_V2" },
          { type: TAG, id: "PRODUCT_RETURN_V2" },
          { type: TAG, id: "DEFECTS_V2" },
        ],
      }),
    }),
  });

export const {
  useGetQcDashboardOverviewQuery,
  useGetQcDashboardProductionQcQuery,
  useGetQcDashboardProductionQcDetailQuery,
  useGetQcDashboardIncomingQcQuery,
  useGetQcDashboardDefectsQuery,
  useGetQcDashboardProductReturnQcQuery,
  useCreateQcDashboardManualReportMutation,
  useGetManualReferenceOptionsQuery,
  useCreateQcDashboardReportMutation,
} = qcDashboardApiSlice;
