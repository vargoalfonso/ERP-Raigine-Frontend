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

export type QcReportLookupType = "production_qc" | "incoming_qc" | "product_return_qc";

export type QcReportFormOptionItem = {
  value: string;
  label: string;
};

export type QcReportFormOptionRecord = {
  qc_task_id?: number;
  return_id?: string;
  uniq?: string;
  wo_po_dn_number?: string;
  reference_type?: string;
  kanban_number?: string;
  po_number?: string;
  dn_number?: string;
  previous_dn_number?: string;
  kanban_scan_or_packing_list_scan?: string;
  report_date?: string;
};

export type QcReportFormOptionsFilters = {
  qc_type: QcReportLookupType;
  uniq?: string;
};

export type QcReportFormOptionsResponse = {
  qc_type?: QcReportLookupType;
  data_source?: string;
  uniq_options?: QcReportFormOptionItem[];
  wo_po_dn_options?: QcReportFormOptionItem[];
  records?: QcReportFormOptionRecord[];
};

export type QcReportFormDetailFilters = {
  qc_type: QcReportLookupType;
  record_id: string;
};

export type QcReportStatusOption = {
  value: string;
  label: string;
};

export type QcReportIssueOption = {
  value: string;
  label: string;
  code?: string;
  name?: string;
};

export type QcReportFormDetailResponse = {
  qc_type?: QcReportLookupType;
  record_id?: string | number;
  data_source?: string;
  report_date?: string;
  wo_po_dn_number?: string;
  reference_type?: string;
  po_number?: string;
  dn_number?: string;
  previous_dn_number?: string;
  kanban_number?: string;
  kanban_scan_or_packing_list_scan?: string;
  uniq?: string;
  supplier_name?: string;
  part_number?: string;
  part_name?: string;
  number_of_item_check?: number;
  issue?: string;
  number_of_defect?: number;
  number_of_scrap?: number;
  number_of_product_return?: number;
  status?: string;
  passed_or_not_passed?: string;
  remarks?: string;
  issue_options?: QcReportIssueOption[];
  status_options?: QcReportStatusOption[];
};

export type CreateQcDashboardReportRequest = {
  qc_type: QcReportLookupType;
  record_id: string | number;
  report_date: string;
  wo_po_dn_number?: string;
  reference_type?: string;
  uniq?: string;
  supplier_name?: string;
  part_number?: string;
  part_name?: string;
  number_of_item_check: number;
  issue?: string;
  number_of_defect?: number;
  number_of_scrap?: number;
  number_of_product_return?: number;
  status: string;
  remarks?: string;
  created_by?: string;
};

export type CreateQcDashboardReportResponse = {
  id?: string;
  qc_type?: QcReportLookupType;
  source_record_id?: string;
  report_date?: string;
  reference_number?: string;
  reference_type?: string;
  uniq?: string;
  supplier_name?: string;
  part_number?: string;
  part_name?: string;
  number_of_item_check?: number;
  issue?: string;
  number_of_defect?: number;
  number_of_scrap?: number;
  number_of_product_return?: number;
  status?: string;
  passed_or_not_passed?: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
};

export type ProductionQcReportDto = {
  qc_task_id?: number;
  data_source?: string;
  report_date?: string;
  wo_number?: string;
  uniq?: string;
  kanban_number?: string;
  supplier_name?: string;
  process_name?: string;
  part_number?: string;
  part_name?: string;
  number_of_item_check?: number;
  issue?: string;
  issue_history?: Array<Record<string, unknown>>;
  number_of_defect?: number;
  number_of_scrap?: number;
  passed_or_not_passed?: string;
  status?: string;
  inspected_by?: string;
  remarks?: string;
  defect_data?: Record<string, unknown>;
  created_at?: string;
};

export type IncomingQcReportDto = {
  qc_task_id?: number;
  data_source?: string;
  report_date?: string;
  kanban_scan_or_packing_list_scan?: string;
  po_number?: string;
  supplier_name?: string;
  uniq?: string;
  number_of_item_check?: number;
  issue?: string;
  issue_history?: unknown[];
  number_of_defect?: number;
  number_of_scrap?: number;
  passed_or_not_passed?: string;
  status?: string;
  inspected_by?: string;
  remarks?: string;
  defect_data?: Record<string, unknown>;
  packing_type?: string;
  qty_stated?: number;
  qty_received?: number;
  created_at?: string;
};

export type ProductReturnQcReportDto = {
  return_id?: string;
  data_source?: string;
  report_date?: string;
  kanban_scan_or_packing_list_scan?: string;
  previous_dn_number?: string;
  supplier_name?: string | null;
  uniq?: string;
  part_number?: string;
  part_name?: string;
  number_of_item_check?: number;
  issue?: string;
  number_of_product_return?: number;
  number_of_scrap?: number;
  number_of_defect?: number;
  passed_or_not_passed?: string;
  status?: string;
  decided_by?: string;
  submitted_by?: string;
  qc_notes?: string;
  created_at?: string;
};

export type DefectReportDto = {
  source_type?: string;
  source_module?: string;
  source_id?: string | number;
  report_date?: string;
  packing_list_or_kanban?: string;
  po_number?: string | null;
  supplier_name?: string | null;
  uniq?: string;
  product_name?: string;
  product_number?: string;
  number_of_defect?: number;
  defect_issue?: string;
  defect_description?: string;
  wo_number?: string | null;
  wo_rework_status?: string;
  rework_work_order?: {
    wo_id?: string;
    wo_number?: string;
    status?: string;
    approval_status?: string;
    quantity?: number;
    kanban_number?: string;
    created_at?: string;
  } | null;
  can_create_rework_wo?: boolean;
  create_rework_wo_payload?: {
    source_type?: string;
    source_id?: string;
    suggested_quantity?: number;
  } | null;
};

export type CreateProductReturnReworkWoRequest = {
  returnId: string;
  quantity?: number;
  target_date?: string;
  notes?: string;
};

export type CreateProductReturnReworkWoResponse = {
  source_type?: string;
  source_id?: string;
  wo_id?: string;
  wo_number?: string;
  kanban_number?: string;
  quantity?: number;
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

      getProductionQcReports: builder.query<DashboardListResponse<ProductionQcReportDto>, ProductionQcReportFilters | void>({
        query: (filters) => ({
          url: `/api/qc-dashboard/production-qc-report${toQueryString({
            uniq: filters?.uniq,
            report_date: filters?.report_date,
          })}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => unwrapList<ProductionQcReportDto>(response, "Production QC reports retrieved"),
        providesTags: [{ type: TAG, id: "PRODUCTION" }],
      }),

      getIncomingQcReports: builder.query<DashboardListResponse<IncomingQcReportDto>, IncomingQcReportFilters | void>({
        query: (filters) => ({
          url: `/api/qc-dashboard/incoming-qc-report${toQueryString({
            uniq: filters?.uniq,
            report_date: filters?.report_date,
            po_number: filters?.po_number,
            supplier: filters?.supplier,
          })}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => unwrapList<IncomingQcReportDto>(response, "Incoming QC reports retrieved"),
        providesTags: [{ type: TAG, id: "INCOMING" }],
      }),

      getProductReturnQcReports: builder.query<DashboardListResponse<ProductReturnQcReportDto>, ProductReturnQcReportFilters | void>({
        query: (filters) => ({
          url: `/api/qc-dashboard/product-return-qc-report${toQueryString({
            uniq: filters?.uniq,
            report_date: filters?.report_date,
            supplier: filters?.supplier,
            previous_dn_number: filters?.previous_dn_number,
          })}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => unwrapList<ProductReturnQcReportDto>(response, "Product Return QC reports retrieved"),
        providesTags: [{ type: TAG, id: "PRODUCT_RETURN" }],
      }),

      getDefectReports: builder.query<DashboardListResponse<DefectReportDto>, DefectReportFilters | void>({
        query: (filters) => ({
          url: `/api/qc-dashboard/defect-report${toQueryString({
            uniq: filters?.uniq,
            report_date: filters?.report_date,
            po_number: filters?.po_number,
            supplier: filters?.supplier,
            defect_from: filters?.defect_from,
          })}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => unwrapList<DefectReportDto>(response, "Defect reports retrieved"),
        providesTags: [{ type: TAG, id: "DEFECT" }],
      }),

      getQcReportFormOptions: builder.query<ApiResponse<QcReportFormOptionsResponse>, QcReportFormOptionsFilters>({
        query: (filters) => ({
          url: `/api/qc-dashboard/qc-report-form-options${toQueryString({
            qc_type: filters.qc_type,
            uniq: filters.uniq,
          })}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => unwrapObject<QcReportFormOptionsResponse>(response, "QC report form options retrieved"),
      }),

      getQcReportFormDetail: builder.query<ApiResponse<QcReportFormDetailResponse>, QcReportFormDetailFilters>({
        query: (filters) => ({
          url: `/api/qc-dashboard/qc-report-form-detail${toQueryString({
            qc_type: filters.qc_type,
            record_id: filters.record_id,
          })}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => unwrapObject<QcReportFormDetailResponse>(response, "QC report form detail retrieved"),
      }),

      createQcDashboardReport: builder.mutation<ApiResponse<CreateQcDashboardReportResponse>, CreateQcDashboardReportRequest>({
        query: (body) => ({
          url: "/api/qc-dashboard/qc-report",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => unwrapObject<CreateQcDashboardReportResponse>(response, "QC Dashboard report created"),
        invalidatesTags: [
          { type: TAG, id: "PRODUCT_RETURN" },
          { type: TAG, id: "DEFECT" },
          { type: TAG, id: "PRODUCTION" },
          { type: TAG, id: "INCOMING" },
        ],
      }),

      createProductReturnReworkWo: builder.mutation<ApiResponse<CreateProductReturnReworkWoResponse>, CreateProductReturnReworkWoRequest>({
        query: ({ returnId, ...body }) => ({
          url: `/api/qc-dashboard/defect-report/product-return/${encodeURIComponent(returnId)}/create-rework-wo`,
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          unwrapObject<CreateProductReturnReworkWoResponse>(response, "Rework WO created from Product Return defect report"),
        invalidatesTags: [
          { type: TAG, id: "PRODUCT_RETURN" },
          { type: TAG, id: "DEFECT" },
          { type: TAG, id: "PRODUCTION" },
          { type: TAG, id: "INCOMING" },
        ],
      }),
    }),
  });

export const {
  useGetQcDashboardOverviewQuery,
  useGetQcDashboardProductionQcQuery,
  useGetQcDashboardIncomingQcQuery,
  useGetQcDashboardDefectsQuery,
  useGetQcDashboardProductReturnQcQuery,
  useCreateQcDashboardManualReportMutation,
  useGetProductionQcReportsQuery,
  useGetIncomingQcReportsQuery,
  useGetProductReturnQcReportsQuery,
  useGetDefectReportsQuery,
  useGetQcReportFormOptionsQuery,
  useGetQcReportFormDetailQuery,
  useCreateQcDashboardReportMutation,
  useCreateProductReturnReworkWoMutation,
} = qcDashboardApiSlice;
