import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";
import type { ApiResponse } from "@/types";

const TAG = "ProcurementPos" as const;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

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

const ok = <T,>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

const parseArrayResponse = <T,>(response: unknown): T[] => {
  const unwrapped = unwrapBackendData<unknown>(response);
  if (Array.isArray(unwrapped)) return unwrapped as T[];

  if (isRecord(unwrapped)) {
    if (Array.isArray(unwrapped.items)) return unwrapped.items as T[];
    if (Array.isArray(unwrapped.data)) return unwrapped.data as T[];
  }

  if (!isRecord(response)) return [];
  if (Array.isArray(response.data)) return response.data as T[];
  if (isRecord(response.data) && Array.isArray(response.data.items)) return response.data.items as T[];
  if (isRecord(response.data) && Array.isArray(response.data.data)) return response.data.data as T[];
  return [];
};

const parseObjectResponse = <T,>(response: unknown): T | null => {
  const unwrapped = unwrapBackendData<unknown>(response);
  if (isRecord(unwrapped)) return unwrapped as T;

  if (!isRecord(response)) return null;
  if (isRecord(response.data) && isRecord(response.data.data)) return response.data.data as T;
  if (isRecord(response.data)) return response.data as T;
  return response as T;
};

export type ProcurementPoType = "raw_material" | "indirect" | "subcon";

export type ProcurementPoSummary = {
  total_pos?: number;
  active_suppliers?: number;
  total_po_value?: number;
  late_deliveries?: number;
};

export type ProcurementPoRecord = {
  id: string;
  po_id?: string;
  po_type?: ProcurementPoType;
  po_stage?: number;
  period?: string;
  month?: string;
  po_number?: string;
  uniq_code?: string;
  po_budget_ref?: string;
  sales_plan?: number;
  total_budget_po?: number;
  total_quantity?: number;
  total_uniq?: number;
  total_weight?: number;
  customer_id?: number | string;
  contact_person?: string;
  supplier_name?: string;
  supplier_id?: string | number;
  total_po?: number;
  total_incoming?: number;
  open_po?: number;
  expected_arrival?: string;
  po_alert?: number;
  status?: string;
  external_system?: string;
  external_po_number?: string;
  generate_mode?: string;
  po_budget_entry_ids?: Array<string | number>;
  data_order?: string;
  notes?: string;
  dn_created?: number;
  dn_incoming?: number;
  items?: Array<Record<string, unknown>>;
};

export type ProcurementPoItem = {
  id?: string;
  line_no?: number;
  uniq_code?: string;
  part_number?: string;
  part_name?: string;
  model?: string;
  qty?: number;
  uom?: string;
  weight_kg?: number;
  budget?: number;
};

export type ProcurementPoHistoryLog = {
  action?: string;
  notes?: string;
  username?: string;
  occurred_at?: string;
};

export type ProcurementPoDetail = {
  po: ProcurementPoRecord;
  items: ProcurementPoItem[];
  history_logs: ProcurementPoHistoryLog[];
};

export type ProcurementPoFilters = {
  po_type: ProcurementPoType;
};

export type GenerateProcurementPoRequest = {
  po_type: ProcurementPoType;
  period: string;
  po_budget_entry_ids: Array<string | number>;
  external_system?: string;
  external_po_number?: string;
  generate_mode?: "both_stages" | "stage_1" | "stage_2" | string;
};

const toProcurementPo = (raw: unknown): ProcurementPoRecord => {
  const record = isRecord(raw) ? raw : {};
  const totalPo =
    toNumber(record.total_po) ??
    toNumber(record.total_amount) ??
    toNumber(record.total_budget_po);
  const totalIncoming = toNumber(record.total_incoming) ?? toNumber(record.qty_delivered);
  const openPo =
    toNumber(record.open_po) ??
    (Number.isFinite(totalPo) && Number.isFinite(totalIncoming)
      ? Number(totalPo) - Number(totalIncoming)
      : undefined);

  return {
    id: toText(record.id) ?? toText(record.po_id) ?? "",
    po_id: toText(record.po_id) ?? toText(record.id),
    po_type: (toText(record.po_type) ?? toText(record.po_category)) as ProcurementPoType | undefined,
    po_stage: toNumber(record.po_stage),
    period: toText(record.period) ?? toText(record.month),
    month: toText(record.month) ?? toText(record.period),
    po_number: toText(record.po_number),
    uniq_code: toText(record.uniq_code) ?? toText(record.item_uniq_code) ?? toText(record.uniq),
    po_budget_ref: toText(record.po_budget_ref),
    sales_plan: toNumber(record.sales_plan),
    total_budget_po: toNumber(record.total_budget_po),
    total_quantity: toNumber(record.total_quantity),
    total_uniq: toNumber(record.total_uniq),
    total_weight: toNumber(record.total_weight),
    customer_id: toNumber(record.customer_id) ?? toText(record.customer_id),
    contact_person: toText(record.contact_person),
    supplier_name: toText(record.supplier_name) ?? toText(record.subcon_name),
    supplier_id: toText(record.supplier_id),
    total_po: totalPo,
    total_incoming: totalIncoming,
    open_po: openPo,
    expected_arrival: toText(record.expected_arrival),
    po_alert: toNumber(record.po_alert),
    status: toText(record.status),
    external_system: toText(record.external_system),
    external_po_number: toText(record.external_po_number),
    generate_mode: toText(record.generate_mode),
    po_budget_entry_ids: Array.isArray(record.po_budget_entry_ids)
      ? record.po_budget_entry_ids
          .map((value) => toText(value) ?? (typeof value === "number" ? value : undefined))
          .filter((value): value is string | number => value !== undefined)
      : undefined,
    data_order: toText(record.data_order),
    notes: toText(record.notes),
    dn_created: toNumber(record.dn_created),
    dn_incoming: toNumber(record.dn_incoming),
    items: Array.isArray(record.items)
      ? record.items.filter((item): item is Record<string, unknown> => isRecord(item))
      : undefined,
  };
};

const toProcurementPoItem = (raw: unknown): ProcurementPoItem => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: toText(record.id),
    line_no: toNumber(record.line_no),
    uniq_code: toText(record.uniq_code) ?? toText(record.item_uniq_code) ?? toText(record.uniq),
    part_number: toText(record.part_number),
    part_name: toText(record.part_name),
    model: toText(record.model),
    qty: toNumber(record.qty) ?? toNumber(record.quantity),
    uom: toText(record.uom) ?? toText(record.unit),
    weight_kg: toNumber(record.weight_kg) ?? toNumber(record.weight),
    budget: toNumber(record.budget),
  };
};

const toProcurementPoHistoryLog = (raw: unknown): ProcurementPoHistoryLog => {
  const record = isRecord(raw) ? raw : {};
  return {
    action: toText(record.action),
    notes: toText(record.notes),
    username: toText(record.username),
    occurred_at: toText(record.occurred_at),
  };
};

const toProcurementPoDetail = (raw: unknown): ProcurementPoDetail => {
  const parsed = parseObjectResponse<unknown>(raw);
  const record = isRecord(parsed)
    ? (parsed as UnknownRecord)
    : isRecord(raw)
      ? raw
      : {};

  const poRecord = isRecord(record.po) ? (record.po as UnknownRecord) : record;
  const itemsRaw = Array.isArray(record.items) ? record.items : [];
  const historyRaw = Array.isArray(record.history_logs) ? record.history_logs : [];

  return {
    po: toProcurementPo(poRecord),
    items: itemsRaw.map(toProcurementPoItem),
    history_logs: historyRaw.map(toProcurementPoHistoryLog),
  };
};

const toSummary = (response: unknown): ProcurementPoSummary => {
  const parsed = parseObjectResponse<unknown>(response);
  const record = isRecord(parsed) ? parsed : isRecord(response) ? response : {};
  return {
    total_pos:
      toNumber(record.total_pos) ??
      toNumber(record.total_po_count) ??
      toNumber(record.total_purchase_orders),
    active_suppliers:
      toNumber(record.active_suppliers) ??
      toNumber(record.total_suppliers),
    total_po_value:
      toNumber(record.total_po_value) ??
      toNumber(record.total_amount),
    late_deliveries:
      toNumber(record.late_deliveries) ??
      toNumber(record.po_alert),
  };
};

export const procurementPoApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getProcurementPoSummary: builder.query<ApiResponse<ProcurementPoSummary>, ProcurementPoFilters>({
        query: ({ po_type }) => ({
          url: `/procurement/purchase-orders/summary?po_type=${encodeURIComponent(po_type)}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(toSummary(response)),
        providesTags: (_result, _error, arg) => [{ type: TAG, id: `SUMMARY-${arg.po_type}` }],
      }),

      listProcurementPos: builder.query<ApiResponse<ProcurementPoRecord[]>, ProcurementPoFilters>({
        query: ({ po_type }) => ({
          url: `/procurement/purchase-orders?po_type=${encodeURIComponent(po_type)}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(parseArrayResponse<unknown>(response).map(toProcurementPo)),
        providesTags: (_result, _error, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: `LIST-${arg.po_type}` },
        ],
      }),

      getProcurementPoById: builder.query<ApiResponse<ProcurementPoDetail>, string | number>({
        query: (po_id) => ({
          url: `/procurement/purchase-orders/${encodeURIComponent(String(po_id))}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(toProcurementPoDetail(response)),
        providesTags: (_result, _error, po_id) => [{ type: TAG, id: String(po_id) }],
      }),

      generateProcurementPo: builder.mutation<ApiResponse<ProcurementPoRecord>, GenerateProcurementPoRequest>({
        query: (body) => ({
          url: "/procurement/purchase-orders/generate",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(toProcurementPo(parseObjectResponse<unknown>(response)), "Generated"),
        invalidatesTags: (_result, _error, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: `LIST-${arg.po_type}` },
          { type: TAG, id: `SUMMARY-${arg.po_type}` },
        ],
      }),
    }),
  });

export const {
  useGetProcurementPoSummaryQuery,
  useListProcurementPosQuery,
  useLazyListProcurementPosQuery,
  useGetProcurementPoByIdQuery,
  useGenerateProcurementPoMutation,
} = procurementPoApiSlice;

