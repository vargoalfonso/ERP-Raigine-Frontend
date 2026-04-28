import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const ok = <T>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

export type DashboardOverviewSeriesRow = {
  bucket?: string;
  good_qty?: number;
  ng_setting_machine?: number;
  ng_process?: number;
  scrap_qty?: number;
  open_po?: number;
  closed_po?: number;
  scheduled?: number;
  shipped?: number;
  total?: number;
};

export type DashboardOverviewTrend = {
  delta_pct?: number | null;
  direction?: string;
  compare_to?: string;
};

export type DashboardOverview = {
  filters?: Record<string, unknown>;
  filter_sources?: Record<string, unknown>;
  delivery?: {
    total?: number;
    on_time?: number | null;
    scheduled?: number;
    approved_dn_created?: number;
    shipped?: number;
    due_today?: number;
    overdue?: number;
    trend?: DashboardOverviewTrend;
    series?: DashboardOverviewSeriesRow[];
  };
  production?: {
    good_qty?: number;
    completed_today?: number;
    ng_setting_machine?: number;
    ng_process?: number;
    product_return_scrap?: number;
    scrap_qty?: number;
    trend?: DashboardOverviewTrend;
    series?: DashboardOverviewSeriesRow[];
    uniq_progress?: Array<{
      uniq?: string;
      wo_count?: number;
      produced_qty?: number;
      target_qty?: number;
      progress_pct?: number;
      status?: string;
    }>;
  };
  current_production?: {
    running_machines?: number;
    idle_machines?: number;
    active_wo_count?: number;
    last_event_at?: string;
    trend?: DashboardOverviewTrend;
  };
  procurement?: {
    open_po_count?: number;
    open_po_qty?: number | null;
    dn_pending_count?: number;
    rm_low_stock?: number;
    buy_recommendations?: number;
    trend?: DashboardOverviewTrend;
  };
  alerts?: Array<Record<string, unknown>>;
  recommendations?: Array<Record<string, unknown>>;
  last_updated_at?: string;
};

// New API Types
export interface KPIData {
  value: number;
  subtitle: string;
  delta_percent?: number;
  delta_value?: number;
  delta_label: string;
  trend: "up" | "down" | "flat";
}

export interface MainDashboardSummary {
  as_of: string;
  period: {
    type: string;
    start_date: string;
    end_date: string;
  };
  kpis: {
    total_deliveries: KPIData;
    current_production: KPIData;
    total_production: KPIData;
    po_raw_material: KPIData;
  };
  delivery_performance: {
    total_deliveries: number;
    total_value: number;
    on_time_rate_percent: number;
    on_time_count: number;
    trend: Array<{ label: string; actual: number; target: number }>;
  };
  production_performance: {
    current_production: number;
    capacity_percent: number;
    total_production: number;
    quality_percent: number;
    trend: Array<{ label: string; produced: number; target: number }>;
  };
  top_customers: Array<{
    customer_id: number;
    customer_name: string;
    delivery_count: number;
    share_percent: number;
    status: string;
  }>;
  current_uniq_progress: Array<{
    uniq_code: string;
    total_units: number;
    produced_units: number;
    progress_percent: number;
    status: string;
  }>;
}

export interface RawMaterialSummary {
  as_of: string;
  po_summary: {
    total_pos: number;
    total_value: number;
    low_stock_alerts: number;
    critical_alerts: number;
    monthly_trend: Array<{ label: string; ordered: number; received: number }>;
  };
  category_distribution: Array<{
    category: string;
    share_percent: number;
  }>;
  top_suppliers: Array<{
    supplier_uuid: string;
    supplier_code: string;
    supplier_name: string;
    on_time_percent: number;
    quality_percent: number;
    grade: string;
  }>;
}

export interface DashboardQueryParams {
  period?: string;
  start_date?: string;
  end_date?: string;
}

export const dashboardApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardOverview: builder.query<ApiResponse<DashboardOverview>, void>({
      query: () => ({
        url: "/api/dashboard/overview",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const root = isRecord(response) ? response : {};
        const data = isRecord(root.data)
          ? (root.data as DashboardOverview)
          : ({} as DashboardOverview);
        return ok(data, typeof root.message === "string" ? root.message : "OK");
      },
    }),
    getMainDashboardSummary: builder.query<
      ApiResponse<MainDashboardSummary>,
      DashboardQueryParams
    >({
      query: (params) => ({
        url: "main-dashboard/summary",
        method: "GET",
        params,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const root = isRecord(response) ? response : {};
        const data = isRecord(root.data)
          ? (root.data as unknown as MainDashboardSummary)
          : ({} as MainDashboardSummary);
        return ok(data, typeof root.message === "string" ? root.message : "OK");
      },
    }),
    getRawMaterialSummary: builder.query<
      ApiResponse<RawMaterialSummary>,
      DashboardQueryParams
    >({
      query: (params) => ({
        url: "main-dashboard/raw-material/summary",
        method: "GET",
        params,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const root = isRecord(response) ? response : {};
        const data = isRecord(root.data)
          ? (root.data as unknown as RawMaterialSummary)
          : ({} as RawMaterialSummary);
        return ok(data, typeof root.message === "string" ? root.message : "OK");
      },
    }),
  }),
});

export const {
  useGetDashboardOverviewQuery,
  useGetMainDashboardSummaryQuery,
  useGetRawMaterialSummaryQuery,
} = dashboardApiSlice;
