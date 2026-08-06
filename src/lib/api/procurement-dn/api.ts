import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";
import type { ApiResponse } from "@/types";

const TAG = "ProcurementDns" as const;

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
  if (isRecord(unwrapped) && Array.isArray(unwrapped.data)) return unwrapped.data as T[];
  if (isRecord(unwrapped) && Array.isArray(unwrapped.items)) return unwrapped.items as T[];
  if (!isRecord(response)) return [];
  if (Array.isArray(response.data)) return response.data as T[];
  if (isRecord(response.data) && Array.isArray(response.data.items)) return response.data.items as T[];
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

export type ProcurementDnType = "RM" | "IRM" | "SC";

export type CreateProcurementDnItemRequest = {
  item_uniq_code: string;
  qty: number;
  incoming_date: string;
};

export type CreateProcurementDnRequest = {
  po_number: string;
  period: string;
  type: ProcurementDnType | string;
  items: CreateProcurementDnItemRequest[];
  customer_id?: number;
  contact_person?: string;
  wo_number?: string;
  // "Pengiriman ke ..." (delivery sequence) + total pengiriman terjadwal (= cycle_time/lead time supplier).
  delivery_to?: number;
  delivery_total?: number;
};

export type ProcurementDnItem = {
  id?: number | string;
  dn_id?: number | string;
  item_uniq_code?: string;
  quantity?: number;
  uom?: string;
  weight?: number;
  qr?: string;
  order_qty?: number;
  date_incoming?: string;
  qty_sent?: number;
  qty_stated?: number;
  qty_received?: number;
  weight_received?: number;
  quality_status?: string;
  pcs_per_kanban?: number;
  received_at?: string | null;
  packing_number?: string;
  check?: string;
  kanban_id?: number | string;
  kanban?: {
    id?: number | string;
    kanban_number?: string;
    item_uniq_code?: string;
    kanban_qty?: number;
    min_stock?: number;
    max_stock?: number;
    status?: string;
  };
};

export type ProcurementDnRecord = {
  id: string;
  dn_number?: string;
  customer_id?: number | string;
  contact_person?: string;
  period?: string;
  po_number?: string;
  type?: ProcurementDnType;
  status?: string;
  incoming_date?: string;
  supplier_id?: number | string;
  supplier_name?: string;
  total_po_qty?: number;
  total_po_incoming?: number;
  total_dn_created?: number;
  total_dn_incoming?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  supplier?: {
    id?: string;
    uuid?: string;
    supplier_code?: string;
    supplier_name?: string;
    contact_person?: string;
    contact_number?: string;
    email_address?: string;
    full_address?: string;
    city?: string;
    province?: string;
    country?: string;
    tax_id_npwp?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_account_name?: string;
    payment_terms?: string;
    delivery_lead_time_days?: number;
    status?: string;
    created_at?: string;
    updated_at?: string;
  };
  items: ProcurementDnItem[];
  material_grade?: string; 
  // "Pengiriman ke ..." berikut total pengiriman terjadwal (= cycle_time supplier).
  delivery_to?: number;
  delivery_total?: number;
};

export type ProcurementDnPreview = {
  period?: string;
  po_number?: string;
  type?: ProcurementDnType;
  supplier?: string;
  total_po?: number;
  total_incoming?: number;
  total_dn_created?: number;
  total_dn_incoming?: number;
  items: ProcurementDnPreviewItem[];
};

export type ProcurementDnPreviewItem = {
  item_uniq_code?: string;
  material_info?: string;
  total_qty?: number;
  remaining_qty?: number;
  uom?: string;
  order_qty?: number;
  pcs_per_kanban?: number;
  packing_number?: string;
  date_incoming?: string;
};

export type ProcurementDnPreviewRequest = {
  po_number: string;
  period?: string;
  type?: ProcurementDnType | string;
  item?: unknown[];
};

export type ProcurementDnScanResult = {
  packing_number?: string;
  dn_number?: string;
  item_uniq_code?: string;
  quantity?: number;
  qty_stated?: number;
  qty_received?: number;
  weight_received?: number;
  quality_status?: string;
  check?: string;
  uom?: string;
  po_number?: string;
  period?: string;
  qr?: string;
};

const toDnItem = (raw: unknown): ProcurementDnItem => {
  const record = isRecord(raw) ? raw : {};
  const kanbanRecord = isRecord(record.kanban) ? record.kanban : undefined;
  return {
    id: toText(record.id),
    dn_id: toText(record.dn_id),
    item_uniq_code: toText(record.item_uniq_code) ?? toText(record.uniq),
    quantity: toNumber(record.quantity),
    uom: toText(record.uom),
    weight: toNumber(record.weight),
    qr: toText(record.qr),
    order_qty: toNumber(record.order_qty),
    date_incoming: toText(record.date_incoming),
    qty_stated: toNumber(record.qty_stated),
    qty_received: toNumber(record.qty_received),
    weight_received: toNumber(record.weight_received),
    quality_status: toText(record.quality_status),
    pcs_per_kanban: toNumber(record.pcs_per_kanban),
    received_at: toText(record.received_at) ?? null,
    packing_number: toText(record.packing_number),
    check: toText(record.check),
    kanban_id: toText(record.kanban_id),
    kanban: kanbanRecord
      ? {
          id: toText(kanbanRecord.id),
          kanban_number: toText(kanbanRecord.kanban_number),
          item_uniq_code: toText(kanbanRecord.item_uniq_code),
          kanban_qty: toNumber(kanbanRecord.kanban_qty),
          min_stock: toNumber(kanbanRecord.min_stock),
          max_stock: toNumber(kanbanRecord.max_stock),
          status: toText(kanbanRecord.status),
        }
      : undefined,
  };
};

const toDnRecord = (raw: unknown): ProcurementDnRecord => {
  const record = isRecord(raw) ? raw : {};
  const supplier = isRecord(record.supplier) ? record.supplier : undefined;
  return {
    id: toText(record.id) ?? toText(record.dn_number) ?? "",
    dn_number: toText(record.dn_number),
    customer_id: toText(record.customer_id),
    contact_person: toText(record.contact_person),
    period: toText(record.period),
    po_number: toText(record.po_number),
    type: toText(record.type) as ProcurementDnType | undefined,
    status: toText(record.status),
    incoming_date: toText(record.incoming_date),
    supplier_id: toText(record.supplier_id),
    supplier_name: toText(record.supplier_name) ?? toText(supplier?.supplier_name),
    total_po_qty: toNumber(record.total_po_qty),
    total_po_incoming: toNumber(record.total_po_incoming),
    total_dn_created: toNumber(record.total_dn_created),
    total_dn_incoming: toNumber(record.total_dn_incoming),
    created_by: toText(record.created_by),
    created_at: toText(record.created_at),
    updated_at: toText(record.updated_at),
    supplier: supplier
      ? {
          id: toText(supplier.id),
          uuid: toText(supplier.uuid),
          supplier_code: toText(supplier.supplier_code),
          supplier_name: toText(supplier.supplier_name),
          contact_person: toText(supplier.contact_person),
          contact_number: toText(supplier.contact_number),
          email_address: toText(supplier.email_address),
          full_address: toText(supplier.full_address),
          city: toText(supplier.city),
          province: toText(supplier.province),
          country: toText(supplier.country),
          tax_id_npwp: toText(supplier.tax_id_npwp),
          bank_name: toText(supplier.bank_name),
          bank_account_number: toText(supplier.bank_account_number),
          bank_account_name: toText(supplier.bank_account_name),
          payment_terms: toText(supplier.payment_terms),
          delivery_lead_time_days: toNumber(supplier.delivery_lead_time_days),
          status: toText(supplier.status),
          created_at: toText(supplier.created_at),
          updated_at: toText(supplier.updated_at),
        }
      : undefined,
    items: Array.isArray(record.items) ? record.items.map(toDnItem) : [],
    delivery_to: toNumber(record.delivery_to),
    delivery_total: toNumber(record.delivery_total),
  };
};

const toPreviewItem = (raw: unknown): ProcurementDnPreviewItem => {
  const record = isRecord(raw) ? raw : {};
  return {
    item_uniq_code: toText(record.item_uniq_code) ?? toText(record.uniq_code) ?? toText(record.uniq),
    material_info: toText(record.material_info) ?? toText(record.material) ?? toText(record.material_name),
    total_qty: toNumber(record.total_qty) ?? toNumber(record.total_quantity) ?? toNumber(record.quantity),
    remaining_qty: toNumber(record.remaining_qty) ?? toNumber(record.remaining_quantity),
    uom: toText(record.uom) ?? toText(record.unit),
    order_qty: toNumber(record.order_qty) ?? toNumber(record.qty_stated) ?? toNumber(record.orderQty),
    pcs_per_kanban: toNumber(record.pcs_per_kanban) ?? toNumber(record.pcsPerKanban),
    packing_number: toText(record.packing_number) ?? toText(record.packing),
    date_incoming: toText(record.date_incoming) ?? toText(record.incoming_date),
  };
};

const toPreview = (raw: unknown): ProcurementDnPreview => {
  const parsed = parseObjectResponse<unknown>(raw);
  const record = isRecord(parsed)
    ? (parsed as UnknownRecord)
    : isRecord(raw)
      ? raw
      : {};
  const itemsRaw = record.items;
  return {
    period: toText(record.period),
    po_number: toText(record.po_number),
    type: toText(record.type) as ProcurementDnType | undefined,
    supplier: toText(record.supplier),
    total_po: toNumber(record.total_po) ?? toNumber(record.total_po_qty),
    total_incoming: toNumber(record.total_incoming) ?? toNumber(record.total_po_incoming),
    total_dn_created: toNumber(record.total_dn_created),
    total_dn_incoming: toNumber(record.total_dn_incoming),
    items: Array.isArray(itemsRaw) ? itemsRaw.map(toPreviewItem) : [],
  };
};

const toScanResult = (raw: unknown): ProcurementDnScanResult => {
  const record = isRecord(parseObjectResponse<unknown>(raw))
    ? (parseObjectResponse<unknown>(raw) as UnknownRecord)
    : isRecord(raw)
      ? raw
      : {};
  return {
    packing_number: toText(record.packing_number) ?? toText(record.packing),
    dn_number: toText(record.dn_number),
    item_uniq_code: toText(record.item_uniq_code) ?? toText(record.uniq),
    quantity: toNumber(record.quantity),
    qty_stated: toNumber(record.qty_stated),
    qty_received: toNumber(record.qty_received),
    weight_received: toNumber(record.weight_received),
    quality_status: toText(record.quality_status),
    check: toText(record.check),
    uom: toText(record.uom),
    po_number: toText(record.po_number),
    period: toText(record.period),
    qr:
      toText(record.qr) ??
      toText(record.qr_code) ??
      toText(record.qrcode) ??
      toText(record.qr_image) ??
      toText(record.qrImage) ??
      toText(record.qr_url) ??
      toText(record.qrUrl),
  };
};

export type ProcurementDnHistoryLog = {
  id: string;
  uniq_code?: string;
  qty_change?: number;
  weight_change?: number;
  source_flag?: string;
  packing_number?: string;
  logged_by?: string;
  logged_at?: string;
};

const toDnHistoryLog = (raw: unknown): ProcurementDnHistoryLog => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: toText(record.id ?? record.ID) ?? "",
    uniq_code: toText(record.uniq_code ?? record.UniqCode),
    qty_change: toNumber(record.qty_change ?? record.QtyChange),
    weight_change: toNumber(record.weight_change ?? record.WeightChange),
    source_flag: toText(record.source_flag ?? record.SourceFlag),
    packing_number: toText(record.packing_number ?? record.PackingNumber ?? record.reference_id ?? record.ReferenceID),
    logged_by: toText(record.logged_by ?? record.LoggedBy),
    logged_at: toText(record.logged_at ?? record.LoggedAt),
  };
};

export const procurementDnApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
  endpoints: (builder) => ({
    listProcurementDns: builder.query<ApiResponse<ProcurementDnRecord[]>, void>({
      query: () => ({
        url: "/delivery-notes",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<unknown>(response).map(toDnRecord)),
      providesTags: [{ type: TAG, id: "LIST" }],
    }),

    createProcurementDn: builder.mutation<ApiResponse<ProcurementDnRecord>, CreateProcurementDnRequest>({
      query: (body) => ({
        url: "/delivery-notes",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(toDnRecord(parseObjectResponse<unknown>(response)), "Created"),
      invalidatesTags: [{ type: TAG, id: "LIST" }],
    }),

    previewProcurementDn: builder.mutation<ApiResponse<ProcurementDnPreview>, ProcurementDnPreviewRequest>({
      query: ({ po_number, period }) => {
        const params = new URLSearchParams({ po_number: String(po_number ?? "").trim() });
        const normalizedPeriod = String(period ?? "").trim();
        if (normalizedPeriod) params.set("period", normalizedPeriod);

        return {
          url: `/delivery-notes/preview?${params.toString()}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        };
      },
      transformResponse: (response: unknown) => ok(toPreview(response), "success"),
    }),

    scanProcurementDnPacking: builder.query<
      ApiResponse<ProcurementDnScanResult>,
      { packing: string; qty?: number }
    >({
      query: ({ packing, qty }) => ({
        url: "/delivery-notes/scan",
        method: "POST",
        body: { packing, qty: typeof qty === "number" && Number.isFinite(qty) ? qty : 1 },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(toScanResult(response)),
    }),

    getProcurementDnById: builder.query<ApiResponse<ProcurementDnRecord>, string | number>({
      query: (id) => ({
        url: `/delivery-notes/${encodeURIComponent(String(id))}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(toDnRecord(parseObjectResponse<unknown>(response))),
    }),

    getProcurementDnHistory: builder.query<ApiResponse<ProcurementDnHistoryLog[]>, string | number>({
      query: (id) => ({
        url: `/delivery-notes/${encodeURIComponent(String(id))}/history`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<unknown>(response).map(toDnHistoryLog)),
    }),
  }),
});

export const {
  useListProcurementDnsQuery,
  usePreviewProcurementDnMutation,
  useScanProcurementDnPackingQuery,
  useLazyScanProcurementDnPackingQuery,
  useGetProcurementDnByIdQuery,
  useCreateProcurementDnMutation,
  useGetProcurementDnHistoryQuery,
} = procurementDnApiSlice;
