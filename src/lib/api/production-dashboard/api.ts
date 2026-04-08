import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const emptySummary = {
  fg_output: 0,
  wip_output: 0,
  total_ng: 0,
  total_rework: 0,
};

export type ProductionDashboardSummaryCards = {
  fg_output?: number;
  wip_output?: number;
  total_ng?: number;
  total_rework?: number;
};

export type FinishedGoodsDashboardRow = {
  id?: string;
  report_date?: string | null;
  uniq?: string;
  product_name?: string;
  wo_number?: string;
  fg_output?: number;
  shift?: string;
  ng_setting?: number;
  ng_process?: number;
  rework?: number;
  scrap?: number;
};

export type WipDashboardRow = {
  id?: string;
  report_date?: string | null;
  uniq?: string;
  product_name?: string;
  process_name?: string;
  wo_number?: string;
  wip_output?: number;
  shift?: string;
  ng_setting?: number;
  ng_process?: number;
  rework?: number;
  scrap?: number;
};

export type OutputMachineDashboardRow = {
  id?: string;
  report_date?: string | null;
  line_process?: string;
  machine_name?: string;
  uniq?: string;
  shift?: string;
  wo_number?: string;
  product_output?: number;
  ng_setting?: number;
  ng_process?: number;
  rework?: number;
  scrap?: number;
};

export type SummaryStrokeDashboardRow = {
  id?: string;
  report_date?: string | null;
  production_line?: string;
  stroke?: number;
  production_output?: number;
  machine_time_min?: number;
  dandori_time_min?: number;
  set_qc_time_min?: number;
};

export type RuntimeDashboardRow = {
  id?: string;
  report_date?: string | null;
  wo_number?: string;
  production_line?: string;
  machine_number?: string;
  total_machine_time_min?: number;
  dandori_time_min?: number;
  set_qc_time_min?: number;
};

export type ProductionDashboardPayload<T> = {
  summary_cards: ProductionDashboardSummaryCards;
  table_data: T[];
};

const parseDashboardPayload = <T,>(response: unknown): ApiResponse<ProductionDashboardPayload<T>> => {
  const root = isRecord(response) ? response : {};
  const success = root.success === true;
  const data = isRecord(root.data) ? root.data : {};
  const summaryCards = isRecord(data.summary_cards)
    ? (data.summary_cards as ProductionDashboardSummaryCards)
    : emptySummary;
  const tableData = toArray<T>(data.table_data);

  return {
    message: typeof root.message === "string" ? root.message : success ? "OK" : "Failed",
    status: success ? "success" : "error",
    data: {
      summary_cards: summaryCards,
      table_data: tableData,
    },
  };
};

export const productionDashboardApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFinishedGoodsDashboard: builder.query<ApiResponse<ProductionDashboardPayload<FinishedGoodsDashboardRow>>, void>({
      query: () => ({
        url: "/api/production-dashboard/fg-dashboard",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => parseDashboardPayload<FinishedGoodsDashboardRow>(response),
    }),
    getWipDashboard: builder.query<ApiResponse<ProductionDashboardPayload<WipDashboardRow>>, void>({
      query: () => ({
        url: "/api/production-dashboard/wip-dashboard",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => parseDashboardPayload<WipDashboardRow>(response),
    }),
    getOutputMachineDashboard: builder.query<ApiResponse<ProductionDashboardPayload<OutputMachineDashboardRow>>, void>({
      query: () => ({
        url: "/api/production-dashboard/output-machine-dashboard",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => parseDashboardPayload<OutputMachineDashboardRow>(response),
    }),
    getSummaryStrokeDashboard: builder.query<ApiResponse<ProductionDashboardPayload<SummaryStrokeDashboardRow>>, void>({
      query: () => ({
        url: "/api/production-dashboard/summary-stroke-dashboard",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => parseDashboardPayload<SummaryStrokeDashboardRow>(response),
    }),
    getRuntimeDashboard: builder.query<ApiResponse<ProductionDashboardPayload<RuntimeDashboardRow>>, void>({
      query: () => ({
        url: "/api/production-dashboard/runtime",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => parseDashboardPayload<RuntimeDashboardRow>(response),
    }),
  }),
});

export const {
  useGetFinishedGoodsDashboardQuery,
  useGetWipDashboardQuery,
  useGetOutputMachineDashboardQuery,
  useGetSummaryStrokeDashboardQuery,
  useGetRuntimeDashboardQuery,
} = productionDashboardApiSlice;
