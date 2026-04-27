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

const getRecord = (value: unknown): UnknownRecord | null => (isRecord(value) ? value : null);

const getText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const getNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeShopFloorLiveProductionSummaryItem = (item: unknown): ShopFloorLiveProductionSummaryItem => {
  const record = getRecord(item);
  const machine = getRecord(record?.machine);
  const production = getRecord(record?.production);
  const progress = getRecord(record?.progress);
  const quality = getRecord(record?.quality);

  const progressPercent = getNumber(progress?.progress_percent ?? progress?.percent);
  const targetQty = getNumber(progress?.target_qty);
  const outputQty = getNumber(progress?.output_qty ?? progress?.done_qty);
  const throughputToday = getNumber(progress?.throughput_today);
  const runtimeStatus = getText(machine?.runtime_status ?? machine?.status);
  const woStatus = getText(production?.wo_status);

  return {
    machine: {
      id: getText(machine?.id ?? machine?.number ?? machine?.code),
      name: getText(machine?.name ?? machine?.production_line ?? machine?.number),
      code: getText(machine?.code ?? machine?.number ?? machine?.id),
      number: getText(machine?.number ?? machine?.code),
      production_line: getText(machine?.production_line ?? machine?.name),
      status: runtimeStatus,
      runtime_status: runtimeStatus,
    },
    production: {
      uniq_code: getText(production?.uniq_code ?? production?.current_uniq),
      work_order: getText(production?.work_order ?? production?.wo_number),
      wo_number: getText(production?.wo_number ?? production?.work_order),
      part_name: getText(production?.part_name),
      operator_name: getText(production?.operator_name),
      last_scan_at: getText(production?.last_scan_at) ?? null,
      process_name: getText(production?.process_name),
      wo_status: woStatus,
      last_scan_type: getText(production?.last_scan_type),
      current_uniq: getText(production?.current_uniq ?? production?.uniq_code),
    },
    progress: {
      percent: progressPercent,
      label:
        getText(progress?.label) ??
        (typeof progressPercent === "number" ? (progressPercent >= 100 ? "Completed" : "In Progress") : undefined),
      status: getText(progress?.status ?? runtimeStatus ?? woStatus),
      target_qty: targetQty,
      done_qty: outputQty,
      output_qty: outputQty,
      throughput_today: throughputToday,
    },
    quality: {
      checked_qty: getNumber(quality?.checked_qty),
      pass_qty: getNumber(quality?.pass_qty),
      defect_qty: getNumber(quality?.defect_qty),
      scrap_qty: getNumber(quality?.scrap_qty),
      rate_percent: getNumber(quality?.rate_percent),
    },
  };
};

const normalizeShopFloorLiveProductionSummary = (response: unknown): ShopFloorLiveProductionSummary => {
  const raw = (parseObjectResponse<UnknownRecord>(response) ?? {}) as UnknownRecord;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  return {
    as_of: getText(raw.as_of),
    stale_window_minutes: getNumber(raw.stale_window_minutes),
    throughput_today: getNumber(raw.throughput_today) ?? 0,
    machine_total: getNumber(raw.machine_total ?? raw.active_machines) ?? rawItems.length,
    machine_running: getNumber(raw.machine_running ?? raw.running_machines) ?? 0,
    machine_idle: getNumber(raw.machine_idle ?? raw.idle_machines) ?? 0,
    machine_stale: getNumber(raw.machine_stale),
    active_machines: getNumber(raw.active_machines),
    running_machines: getNumber(raw.running_machines),
    idle_machines: getNumber(raw.idle_machines),
    items: rawItems.map(normalizeShopFloorLiveProductionSummaryItem),
  };
};

const normalizeShopFloorDeliveryReadinessSummaryItem = (item: unknown): ShopFloorDeliveryReadinessSummaryItem => {
  const record = getRecord(item);
  const identity = getRecord(record?.identity);
  const delivery = getRecord(record?.delivery);
  const inventory = getRecord(record?.inventory);
  const readiness = getRecord(record?.readiness);

  return {
    identity: {
      uniq_code: getText(identity?.uniq_code ?? identity?.item_uniq_code),
      item_uniq_code: getText(identity?.item_uniq_code ?? identity?.uniq_code),
      product_name: getText(identity?.product_name ?? identity?.part_name),
      part_name: getText(identity?.part_name ?? identity?.product_name),
      part_number: getText(identity?.part_number),
      customer_name: getText(identity?.customer_name),
      schedule_number: getText(identity?.schedule_number),
    },
    delivery: {
      schedule_date: getText(delivery?.schedule_date),
      schedule_time: getText(delivery?.schedule_time ?? delivery?.due_time),
      due_at: getText(delivery?.due_at ?? delivery?.due_date ?? delivery?.schedule_date),
      due_date: getText(delivery?.due_date),
      due_time: getText(delivery?.due_time ?? delivery?.schedule_time),
      hours_until_due: getNumber(delivery?.hours_until_due),
      required_qty: getNumber(delivery?.required_qty),
    },
    inventory: {
      finished_goods_qty: getNumber(inventory?.finished_goods_qty ?? inventory?.fg_qty),
      fg_qty: getNumber(inventory?.fg_qty ?? inventory?.finished_goods_qty),
      wip_qty: getNumber(inventory?.wip_qty),
      total_available_qty: getNumber(inventory?.total_available_qty ?? inventory?.available_qty),
      available_qty: getNumber(inventory?.available_qty ?? inventory?.total_available_qty),
      shortfall_qty: getNumber(inventory?.shortfall_qty),
      fg_readiness_state: getText(inventory?.fg_readiness_state),
    },
    readiness: {
      status: getText(readiness?.status ?? readiness?.readiness_status),
      readiness_status: getText(readiness?.readiness_status ?? readiness?.status),
      coverage_percent: getNumber(readiness?.coverage_percent),
      shortfall_qty: getNumber(readiness?.shortfall_qty),
    },
  };
};

const normalizeShopFloorDeliveryReadinessSummary = (response: unknown): ShopFloorDeliveryReadinessSummary => {
  const raw = (parseObjectResponse<UnknownRecord>(response) ?? {}) as UnknownRecord;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  return {
    as_of: getText(raw.as_of),
    scheduled_total: getNumber(raw.scheduled_total ?? raw.total_scheduled),
    ready_total: getNumber(raw.ready_total ?? raw.ready_items),
    critical_total: getNumber(raw.critical_total ?? raw.critical_items),
    at_risk_total: getNumber(raw.at_risk_total ?? raw.at_risk_items),
    required_qty_total: getNumber(raw.required_qty_total ?? raw.total_required_qty),
    available_qty_total: getNumber(raw.available_qty_total ?? raw.total_available_qty),
    shortfall_qty_total: getNumber(raw.shortfall_qty_total ?? raw.total_shortfall_qty),
    items: rawItems.map(normalizeShopFloorDeliveryReadinessSummaryItem),
  };
};

const normalizeShopFloorProductionIssuesSummaryItem = (item: unknown): ShopFloorProductionIssuesSummaryItem => {
  const record = getRecord(item);

  return {
    issue_id: getText(record?.issue_id ?? record?.id),
    id: getText(record?.id ?? record?.issue_id),
    title: getText(record?.title),
    issue_type: getText(record?.issue_type),
    description: getText(record?.description),
    machine_name: getText(record?.machine_name ?? record?.machine),
    machine: getText(record?.machine ?? record?.machine_name),
    machine_code: getText(record?.machine_code),
    production_line: getText(record?.production_line),
    reported_by: getText(record?.reported_by),
    operator_name: getText(record?.operator_name),
    priority: getText(record?.priority),
    severity: getText(record?.severity),
    status: getText(record?.status),
    impact: getText(record?.impact),
    reported_at: getText(record?.reported_at ?? record?.occurred_at),
    occurred_at: getText(record?.occurred_at ?? record?.reported_at),
    updated_at: getText(record?.updated_at),
  };
};

const normalizeShopFloorProductionIssuesSummary = (response: unknown): ShopFloorProductionIssuesSummary => {
  const raw = (parseObjectResponse<UnknownRecord>(response) ?? {}) as UnknownRecord;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  return {
    as_of: getText(raw.as_of),
    source_available: typeof raw.source_available === "boolean" ? raw.source_available : true,
    window_hours: getNumber(raw.window_hours),
    total_issues: getNumber(raw.total_issues),
    open_issues: getNumber(raw.open_issues),
    critical_issues: getNumber(raw.critical_issues),
    high_priority: getNumber(raw.high_priority),
    medium_priority: getNumber(raw.medium_priority),
    low_priority: getNumber(raw.low_priority),
    items: rawItems.map(normalizeShopFloorProductionIssuesSummaryItem),
  };
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
    number?: string;
    production_line?: string;
    status?: string;
    runtime_status?: string;
  };
  production?: {
    uniq_code?: string;
    work_order?: string;
    wo_number?: string;
    part_name?: string;
    operator_name?: string;
    last_scan_at?: string | null;
    current_uniq?: string;
    wo_status?: string;
    process_name?: string;
    last_scan_type?: string;
  };
  progress?: {
    percent?: number;
    label?: string;
    status?: string;
    target_qty?: number;
    done_qty?: number;
    output_qty?: number;
    throughput_today?: number;
  };
  quality?: {
    checked_qty?: number;
    pass_qty?: number;
    defect_qty?: number;
    scrap_qty?: number;
    rate_percent?: number;
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
  active_machines?: number;
  running_machines?: number;
  idle_machines?: number;
  items?: ShopFloorLiveProductionSummaryItem[];
};

export type ShopFloorDeliveryReadinessSummaryItem = {
  identity?: {
    uniq_code?: string;
    item_uniq_code?: string;
    product_name?: string;
    part_name?: string;
    part_number?: string;
    customer_name?: string;
    schedule_number?: string;
  };
  delivery?: {
    schedule_date?: string;
    schedule_time?: string;
    due_at?: string;
    due_date?: string;
    due_time?: string;
    hours_until_due?: number;
    required_qty?: number;
  };
  inventory?: {
    finished_goods_qty?: number;
    fg_qty?: number;
    wip_qty?: number;
    total_available_qty?: number;
    available_qty?: number;
    shortfall_qty?: number;
    fg_readiness_state?: string;
  };
  readiness?: {
    status?: string;
    readiness_status?: string;
    coverage_percent?: number;
    shortfall_qty?: number;
  };
};

export type ShopFloorDeliveryReadinessSummary = {
  as_of?: string;
  scheduled_total?: number;
  ready_total?: number;
  critical_total?: number;
  at_risk_total?: number;
  required_qty_total?: number;
  available_qty_total?: number;
  shortfall_qty_total?: number;
  items?: ShopFloorDeliveryReadinessSummaryItem[];
};

export type ShopFloorProductionIssuesSummaryItem = {
  id?: string;
  issue_id?: string;
  title?: string;
  issue_type?: string;
  description?: string;
  machine?: string;
  machine_name?: string;
  machine_code?: string;
  production_line?: string;
  reported_by?: string;
  operator_name?: string;
  priority?: string;
  severity?: string;
  status?: string;
  impact?: string;
  reported_at?: string;
  occurred_at?: string;
  updated_at?: string;
};

export type ShopFloorProductionIssuesSummary = {
  as_of?: string;
  source_available?: boolean;
  window_hours?: number;
  total_issues?: number;
  open_issues?: number;
  critical_issues?: number;
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
      transformResponse: (response: unknown) => ok(normalizeShopFloorLiveProductionSummary(response)),
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
      transformResponse: (response: unknown) => ok(normalizeShopFloorDeliveryReadinessSummary(response)),
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
      transformResponse: (response: unknown) => ok(normalizeShopFloorProductionIssuesSummary(response)),
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