import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

type PeriodType = "monthly" | "yearly" | "specific";

type PaginationIn = {
  total?: number;
  page?: number;
  limit?: number;
  total_pages?: number;
};

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const toText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const ok = <T,>(data: T, message = "OK", pagination?: ApiResponse<T>["pagination"]): ApiResponse<T> => ({
  message,
  status: "success",
  data,
  ...(pagination ? { pagination } : {}),
});

const parsePagination = (response: unknown): ApiResponse<unknown>["pagination"] | undefined => {
  const unwrapped = unwrapBackendData<unknown>(response);
  const container = isRecord(unwrapped) ? unwrapped : isRecord(response) ? response : undefined;
  const data = container && isRecord(container.data) ? container.data : container;
  if (!data || !isRecord(data)) return undefined;

  const paginationRaw = (isRecord(data.pagination) ? data.pagination : undefined) as PaginationIn | undefined;

  const total = toNumber(paginationRaw?.total ?? data.total) ?? 0;
  const page = toNumber(paginationRaw?.page ?? data.page) ?? 1;
  const perPage = toNumber(paginationRaw?.limit ?? data.limit) ?? 20;
  const totalPages =
    toNumber(paginationRaw?.total_pages ?? data.total_pages) ??
    (perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1);

  return { total, page, perPage, totalPages };
};

const parseItems = <T,>(response: unknown): T[] => {
  const unwrapped = unwrapBackendData<unknown>(response);
  const container = isRecord(unwrapped) ? unwrapped : isRecord(response) ? response : undefined;
  const data = container && isRecord(container.data) ? container.data : container;
  if (!data || !isRecord(data)) return [];

  if (Array.isArray(data.items)) return data.items as T[];
  if (isRecord(data.data) && Array.isArray((data.data as UnknownRecord).items)) {
    return (data.data as UnknownRecord).items as T[];
  }

  return [];
};

const parseObject = <T,>(response: unknown): T => {
  const unwrapped = unwrapBackendData<unknown>(response);
  if (isRecord(unwrapped)) return unwrapped as T;
  if (isRecord(response)) {
    const d = response.data;
    if (isRecord(d)) return d as T;
  }
  return {} as T;
};

export type SupplierPerformanceRow = {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;

  evaluation_period_type?: PeriodType | string;
  evaluation_period_value?: string;

  total_deliveries?: number;
  on_time_deliveries?: number;
  late_deliveries?: number;
  otd_percentage?: number;
  average_delay_days?: number;

  quality_inspection_count?: number;
  accepted_quantity?: number;
  rejected_quantity?: number;
  inspected_quantity?: number;
  quality_percentage?: number;

  total_purchase_value?: number;
  performance_grade?: string;
  status_label?: string;

  flags?: string[];
  supplier_review_required?: boolean;
  is_grade_overridden?: boolean;

  logic_version?: string;
  formula_otd?: string;
  formula_quality?: string;
  formula_grade?: string;
  formula_notes?: string;
  evaluation_date?: string;
};

export type SupplierPerformanceSummary = {
  excellent_suppliers?: number;
  good_suppliers?: number;
  review_required_suppliers?: number;
  total_suppliers_evaluated?: number;
  total_purchase_value?: number;
  logic_version?: string;
  formula_grade?: string;
  computed_at?: string;
};

export type SupplierPerformanceCharts = {
  trend?: Array<{
    period: string;
    avg_otd_percentage: number;
    avg_quality_percentage: number;
  }>;
  scatter?: Array<{
    supplier_id: string;
    supplier_name: string;
    otd_percentage: number;
    quality_percentage: number;
    status_label?: string;
  }>;
  top_5?: Array<{
    supplier_id: string;
    supplier_name: string;
    performance_grade?: string;
    status_label?: string;
    score: number;
  }>;
  bottom_5?: Array<{
    supplier_id: string;
    supplier_name: string;
    performance_grade?: string;
    status_label?: string;
    score: number;
  }>;
};

const TAG = "SupplierPerformance" as const;

const buildQueryString = (params: Record<string, string | number | undefined>) => {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === "") return;
    usp.set(key, String(value));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
};

const filenameFromContentDisposition = (contentDisposition: string | null | undefined): string | undefined => {
  const raw = toText(contentDisposition);
  if (!raw) return undefined;

  const filenameStar = raw.match(/filename\*=(?:UTF-8'')?([^;]+)/i)?.[1];
  if (filenameStar) return decodeURIComponent(filenameStar.replace(/^"|"$/g, "").trim());

  const filename = raw.match(/filename=([^;]+)/i)?.[1];
  if (filename) return filename.replace(/^"|"$/g, "").trim();

  return undefined;
};

export const supplierPerformanceApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getSupplierPerformanceList: builder.query<
        ApiResponse<SupplierPerformanceRow[]>,
        { page?: number; limit?: number; period_type?: PeriodType | string; period_value?: string }
      >({
        query: ({ page = 1, limit = 20, period_type, period_value }) => ({
          url: `/suppliers/performance${buildQueryString({ page, limit, period_type, period_value })}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(parseItems<SupplierPerformanceRow>(response), "OK", parsePagination(response)),
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: "LIST" | string }> = [{ type: TAG, id: "LIST" }];
          const items = result?.data ?? [];
          return base.concat(items.map((r) => ({ type: TAG, id: r.supplier_id ?? r.supplier_code ?? "" })).filter((t) => t.id));
        },
      }),

      getSupplierPerformanceSummary: builder.query<
        ApiResponse<SupplierPerformanceSummary>,
        { period_type: PeriodType | string; period_value?: string }
      >({
        query: ({ period_type, period_value }) => ({
          url: `/suppliers/performance/summary${buildQueryString({ period_type, period_value })}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(parseObject<SupplierPerformanceSummary>(response), "OK"),
        providesTags: [{ type: TAG, id: "LIST" }],
      }),

      getSupplierPerformanceCharts: builder.query<
        ApiResponse<SupplierPerformanceCharts>,
        { period_type: PeriodType | string; period_value?: string }
      >({
        query: ({ period_type, period_value }) => ({
          url: `/suppliers/performance/charts${buildQueryString({ period_type, period_value })}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(parseObject<SupplierPerformanceCharts>(response), "OK"),
        providesTags: [{ type: TAG, id: "LIST" }],
      }),

      exportSupplierPerformance: builder.mutation<
        { blob: Blob; filename: string },
        { period_type: PeriodType | string; period_value: string; format?: "xlsx" }
      >({
        query: ({ period_type, period_value, format = "xlsx" }) => ({
          url: `/suppliers/performance/export${buildQueryString({ period_type, period_value, format })}`,
          method: "GET",
          // Don’t force Content-Type for a file download.
          meta: { useAuthorization: true, contentType: "" },
          responseHandler: (response: Response) => response.blob(),
        }),
        transformResponse: (blob: Blob, meta: { response?: Response } | undefined, arg) => {
          const cd = meta?.response?.headers?.get?.("content-disposition");
          const derived = filenameFromContentDisposition(cd);
          const fallback = `supplier-performance-${String(arg.period_type)}-${String(arg.period_value)}.${arg.format ?? "xlsx"}`;
          return { blob, filename: derived ?? fallback };
        },
      }),
    }),
  });

export const {
  useGetSupplierPerformanceListQuery,
  useGetSupplierPerformanceSummaryQuery,
  useGetSupplierPerformanceChartsQuery,
  useExportSupplierPerformanceMutation,
} = supplierPerformanceApiSlice;
