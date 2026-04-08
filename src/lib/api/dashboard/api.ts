import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const ok = <T,>(data: T, message = "OK"): ApiResponse<T> => ({
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
        const data = isRecord(root.data) ? (root.data as DashboardOverview) : ({} as DashboardOverview);
        return ok(data, typeof root.message === "string" ? root.message : "OK");
      },
    }),
  }),
});

export const { useGetDashboardOverviewQuery } = dashboardApiSlice;
