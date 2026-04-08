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
  if (isRecord(data)) return data as T;
  return response as T;
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
    getShopFloorLiveProduction: builder.query<ApiResponse<ShopFloorLiveProduction[]>, void>({
      query: () => ({
        url: "/api/shop-floor/live-production",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<ShopFloorLiveProduction>(response)),
    }),

    getShopFloorDeliveryReadiness: builder.query<ApiResponse<ShopFloorDeliveryReadiness[]>, void>({
      query: () => ({
        url: "/api/shop-floor/delivery-readiness",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<ShopFloorDeliveryReadiness>(response)),
    }),

    getShopFloorProductionIssues: builder.query<ApiResponse<ShopFloorProductionIssue[]>, void>({
      query: () => ({
        url: "/api/shop-floor/production-issues",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<ShopFloorProductionIssue>(response)),
    }),

    getShopFloorScanEvents: builder.query<ApiResponse<ShopFloorScanEvent[]>, void>({
      query: () => ({
        url: "/api/shop-floor/scan-events",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<ShopFloorScanEvent>(response)),
    }),

    getShopFloorMachineDetail: builder.query<ApiResponse<ShopFloorMachineDetail>, string>({
      query: (machineId) => ({
        url: `/api/shop-floor/machine/${encodeURIComponent(machineId)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok((parseObjectResponse<ShopFloorMachineDetail>(response) ?? {}) as ShopFloorMachineDetail),
    }),
  }),
});

export const {
  useGetShopFloorLiveProductionQuery,
  useGetShopFloorDeliveryReadinessQuery,
  useGetShopFloorProductionIssuesQuery,
  useGetShopFloorScanEventsQuery,
  useLazyGetShopFloorMachineDetailQuery,
} = shopFloorApiSlice;