import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const ok = <T,>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

const parseArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (!isRecord(response)) return [];

  const data = response.data;
  if (Array.isArray(data)) return data as T[];
  if (isRecord(data) && Array.isArray(data.data)) return data.data as T[];

  return [];
};

const parseObjectResponse = <T,>(response: unknown): T | null => {
  if (!isRecord(response)) return null;

  const data = response.data;
  if (isRecord(data)) {
    const nested = data.data;
    if (isRecord(nested)) return nested as T;
    return data as T;
  }
  return response as T;
};

export type ShopFloorLiveProductionSummaryParams = {
  limit?: number;
  stale_minutes?: number;
};

export type ShopFloorDeliveryReadinessSummaryParams = {
  limit?: number;
};

export type ShopFloorProductionIssuesSummaryParams = {
  limit?: number;
};

export type ShopFloorScanEventsSummaryParams = {
  limit?: number;
  window_hours?: number;
};

export type ShopFloorLiveProductionSummaryItem = {
  machine?: {
    id?: string;
    name?: string;
    code?: string;
    status?: string;
  };
  production?: {
    uniq_code?: string;
    work_order?: string;
    part_name?: string;
    operator_name?: string;
    last_scan_at?: string | null;
  };
  progress?: {
    percent?: number;
    label?: string;
    status?: string;
    target_qty?: number;
    done_qty?: number;
  };
};

export type ShopFloorLiveProductionSummary = {
  as_of?: string;
  stale_window_minutes?: number;
  throughput_today?: number;
  machine_total?: number;
  machine_running?: number;
  machine_idle?: number;
  machine_stale?: number;
  items?: ShopFloorLiveProductionSummaryItem[];
};

export type ShopFloorDeliveryReadinessSummaryItem = {
  identity?: {
    uniq_code?: string;
    product_name?: string;
    customer_name?: string;
  };
  delivery?: {
    schedule_date?: string;
    schedule_time?: string;
    due_at?: string;
    required_qty?: number;
  };
  inventory?: {
    finished_goods_qty?: number;
    wip_qty?: number;
    total_available_qty?: number;
    shortfall_qty?: number;
  };
  readiness?: {
    status?: string;
    coverage_percent?: number;
  };
};

export type ShopFloorDeliveryReadinessSummary = {
  as_of?: string;
  scheduled_total?: number;
  ready_total?: number;
  critical_total?: number;
  required_qty_total?: number;
  available_qty_total?: number;
  shortfall_qty_total?: number;
  items?: ShopFloorDeliveryReadinessSummaryItem[];
};

export type ShopFloorProductionIssuesSummaryItem = {
  issue_id?: string;
  title?: string;
  issue_type?: string;
  description?: string;
  machine_name?: string;
  machine_code?: string;
  production_line?: string;
  reported_by?: string;
  operator_name?: string;
  priority?: string;
  status?: string;
  impact?: string;
  reported_at?: string;
};

export type ShopFloorProductionIssuesSummary = {
  as_of?: string;
  source_available?: boolean;
  window_hours?: number;
  total_issues?: number;
  high_priority?: number;
  medium_priority?: number;
  low_priority?: number;
  items?: ShopFloorProductionIssuesSummaryItem[];
};

export type ShopFloorScanEventsSummaryItem = {
  id?: string | number;
  event_at?: string;
  scan_type?: string;
  machine_name?: string;
  machine_code?: string;
  uniq_code?: string;
  work_order?: string;
  operator_name?: string;
  process_name?: string;
  qty?: number;
  good_qty?: number;
  ng_qty?: number;
  scrap_qty?: number;
};

export type ShopFloorScanEventsSummary = {
  as_of?: string;
  window_hours?: number;
  scan_in_count?: number;
  scan_out_count?: number;
  qc_count?: number;
  total_events?: number;
  items?: ShopFloorScanEventsSummaryItem[];
};

export type ShopFloorWorkOrder = {
  id?: string;
  wo_number?: string;
  wo_type?: string;
  status?: string;
  approval_status?: string;
  target_date?: string;
  scan_start_date?: string;
  close_date?: string | null;
  operator_name?: string | null;
  approved_by?: string | null;
  approved_on?: string | null;
  approval_notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ShopFloorProcessRoute = {
  machine_no?: string;
  machine_name?: string;
  process_name?: string;
};

export type ShopFloorProductDetails = {
  id?: string;
  assembly_code?: string;
  uniq?: string;
  part_name?: string;
  part_number?: string;
  description?: string;
  unit_measurement?: string | null;
  image_path?: string | null;
  process_routes?: ShopFloorProcessRoute[] | null;
};

export type ShopFloorWoItem = {
  id?: string;
  wo_id?: string;
  item_uniq_code?: string;
  quantity?: number;
  uom?: string;
  process_name?: string;
  kanban_number?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  product_details?: ShopFloorProductDetails | null;
};

export type ShopFloorMachine = {
  machine_id?: string;
  machine_name?: string;
  machine_number?: string;
  production_line?: string;
  process_id?: string;
  machine_capacity?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ShopFloorScanEvent = {
  id?: number;
  wo_item_id?: string;
  wo_id?: string;
  scan_type?: string;
  process_name?: string;
  production_line?: string | null;
  machine_id?: string | null;
  raw_material_id?: string | null;
  quantity?: number;
  quantity_rm_used?: string | number | null;
  good_quantity?: number;
  ng_setting_machine?: number;
  ng_process?: number;
  scrap_quantity?: number;
  dandori_time?: string | null;
  setup_qc_time?: string | null;
  shift?: string | null;
  operator_name?: string | null;
  issue_type?: string | null;
  issue_time?: string | null;
  issue_description?: string | null;
  report_date?: string | null;
  kanban_number?: string | null;
  item_uniq_code?: string | null;
  issue_id?: string | null;
  createdAt?: string;
  updatedAt?: string;
  master_machine?: ShopFloorMachine | null;
  work_order?: ShopFloorWorkOrder | null;
  wo_item?: ShopFloorWoItem | null;
};

export type ShopFloorLiveProduction = {
  machine_id?: string;
  machine_name?: string;
  machine_number?: string;
  production_line?: string;
  status?: string;
  current_wo?: string;
  current_uniq?: string;
  operator?: string;
  last_update?: string | null;
};

export type ShopFloorDeliveryReadiness = {
  uniq?: string;
  stock?: number;
  status?: string;
  shortage?: number;
};

export type ShopFloorProductionIssue = {
  id?: string | number;
  issue_id?: string | number;
  title?: string;
  issue_type?: string | null;
  issue_description?: string | null;
  description?: string | null;
  machine_name?: string | null;
  machine_id?: string | null;
  production_line?: string | null;
  process_name?: string | null;
  operator_name?: string | null;
  reported_by?: string | null;
  priority?: string | null;
  status?: string | null;
  impact?: string | null;
  production_impact?: string | null;
  estimated_resolution?: string | null;
  issue_time?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ShopFloorMachineDetail = ShopFloorMachine & {
  issues?: ShopFloorProductionIssue[];
  scan_logs?: ShopFloorScanEvent[];
};

export const shopFloorApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getShopFloorLiveProductionSummary: builder.query<ApiResponse<ShopFloorLiveProductionSummary>, ShopFloorLiveProductionSummaryParams | void>({
      query: (arg) => {
        const params = isRecord(arg) ? (arg as ShopFloorLiveProductionSummaryParams) : {};
        return {
          url: "/shop-floor/live-production/summary",
          method: "GET",
          params,
          meta: { useAuthorization: true, contentType: "application/json" },
        };
      },
      transformResponse: (response: unknown) => ok((parseObjectResponse<ShopFloorLiveProductionSummary>(response) ?? {}) as ShopFloorLiveProductionSummary),
    }),

    getShopFloorDeliveryReadinessSummary: builder.query<
      ApiResponse<ShopFloorDeliveryReadinessSummary>,
      ShopFloorDeliveryReadinessSummaryParams | void
    >({
      query: (arg) => {
        const params = isRecord(arg) ? (arg as ShopFloorDeliveryReadinessSummaryParams) : {};
        return {
          url: "/shop-floor/delivery-readiness/summary",
          method: "GET",
          params,
          meta: { useAuthorization: true, contentType: "application/json" },
        };
      },
      transformResponse: (response: unknown) => ok((parseObjectResponse<ShopFloorDeliveryReadinessSummary>(response) ?? {}) as ShopFloorDeliveryReadinessSummary),
    }),

    getShopFloorProductionIssuesSummary: builder.query<
      ApiResponse<ShopFloorProductionIssuesSummary>,
      ShopFloorProductionIssuesSummaryParams | void
    >({
      query: (arg) => {
        const params = isRecord(arg) ? (arg as ShopFloorProductionIssuesSummaryParams) : {};
        return {
          url: "/shop-floor/production-issues/summary",
          method: "GET",
          params,
          meta: { useAuthorization: true, contentType: "application/json" },
        };
      },
      transformResponse: (response: unknown) => ok((parseObjectResponse<ShopFloorProductionIssuesSummary>(response) ?? {}) as ShopFloorProductionIssuesSummary),
    }),

    getShopFloorScanEventsSummary: builder.query<ApiResponse<ShopFloorScanEventsSummary>, ShopFloorScanEventsSummaryParams | void>({
      query: (arg) => {
        const params = isRecord(arg) ? (arg as ShopFloorScanEventsSummaryParams) : {};
        return {
          url: "/shop-floor/scan-events/summary",
          method: "GET",
          params,
          meta: { useAuthorization: true, contentType: "application/json" },
        };
      },
      transformResponse: (response: unknown) => ok((parseObjectResponse<ShopFloorScanEventsSummary>(response) ?? {}) as ShopFloorScanEventsSummary),
    }),

    getShopFloorLiveProduction: builder.query<ApiResponse<ShopFloorLiveProduction[]>, void>({
      query: () => ({
        url: "/shop-floor/live-production",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<ShopFloorLiveProduction>(response)),
    }),

    getShopFloorDeliveryReadiness: builder.query<ApiResponse<ShopFloorDeliveryReadiness[]>, void>({
      query: () => ({
        url: "/shop-floor/delivery-readiness",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<ShopFloorDeliveryReadiness>(response)),
    }),

    getShopFloorProductionIssues: builder.query<ApiResponse<ShopFloorProductionIssue[]>, void>({
      query: () => ({
        url: "/shop-floor/production-issues",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<ShopFloorProductionIssue>(response)),
    }),

    getShopFloorScanEvents: builder.query<ApiResponse<ShopFloorScanEvent[]>, void>({
      query: () => ({
        url: "/shop-floor/scan-events",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<ShopFloorScanEvent>(response)),
    }),

    getShopFloorMachineDetail: builder.query<ApiResponse<ShopFloorMachineDetail>, string>({
      query: (machineId) => ({
        url: `/shop-floor/machine/${encodeURIComponent(machineId)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok((parseObjectResponse<ShopFloorMachineDetail>(response) ?? {}) as ShopFloorMachineDetail),
    }),
  }),
});

export const {
  useGetShopFloorLiveProductionSummaryQuery,
  useGetShopFloorDeliveryReadinessSummaryQuery,
  useGetShopFloorProductionIssuesSummaryQuery,
  useGetShopFloorScanEventsSummaryQuery,
  useGetShopFloorLiveProductionQuery,
  useGetShopFloorDeliveryReadinessQuery,
  useGetShopFloorProductionIssuesQuery,
  useGetShopFloorScanEventsQuery,
  useLazyGetShopFloorMachineDetailQuery,
} = shopFloorApiSlice;