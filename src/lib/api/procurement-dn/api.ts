import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";
import type { ApiResponse, DataArray, DataObject } from "@/types";

export type ProcurementDnItem = {
  uniq: string;
  qty: number;
  uom?: string;
  spec_material?: string;
  weigh_kg?: number;
  packing?: string;
  pcs_kanban?: number;
};

export type ProcurementDnRecord = {
  id: string;
  dn_id?: string;
  po_id?: string;
  dn_number?: string;
  delivery_date?: string;
  notes?: string;
  items?: ProcurementDnItem[];
  created_at?: string;
  updated_at?: string;
};

export type ProcurementDnBoardRow = {
  id: string;
  po_id?: string;
  po_number?: string;
  month?: string;
  supplier_name?: string;
  subcon_name?: string;
  expected_arrival?: string;
  dn_created?: number;
  dn_incoming?: number;
  total_po?: number;
  total_incoming?: number;
  open_dn?: number;
  dn_alert?: number;
};

export type ProcurementDnIncomingScanItem = { uniq: string; qty: number };

export type ProcurementDnIncomingLog = {
  id: string;
  dn_id?: string;
  scanned_at?: string;
  notes?: string;
  uniq?: string;
  qty?: number;
  created_at?: string;
  full_name?: string;
};

export type CreateProcurementDnRequest = {
  po_id: string;
  dn_number: string;
  delivery_date: string;
  notes?: string;
  items: ProcurementDnItem[];
};

export type UpdateProcurementDnRequest = Partial<Pick<CreateProcurementDnRequest, "dn_number" | "delivery_date" | "notes">>;

export type IncomingScanRequest = {
  scanned_at: string;
  notes?: string;
  items: ProcurementDnIncomingScanItem[];
};

export type ProcurementDnBoardFilters = {
  category?: string;
  month?: string;
  supplier?: string;
  subcon?: string;
};

const ok = <T>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

const toNumber = (value: unknown): number | undefined => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

const toItem = (raw: unknown): ProcurementDnItem => {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    uniq: String(r.uniq ?? r.item_uniq_code ?? r.itemUniqCode ?? ""),
    qty: Number(r.qty ?? r.quantity ?? 0),
    uom: (r.uom ?? r.unit) as string | undefined,
    spec_material: (r.spec_material ?? r.specMaterial ?? r.material_spec) as string | undefined,
    weigh_kg: toNumber(r.weigh_kg ?? r.weighKg ?? r.weight_kg ?? r.weightKg),
    packing: (r.packing ?? r.packing_type ?? r.packingNumber) as string | undefined,
    pcs_kanban: toNumber(r.pcs_kanban ?? r.pcsKanban ?? r.pcs_per_kanban ?? r.pcsPerKanban),
  };
};

const toDn = (raw: unknown): ProcurementDnRecord => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const items = Array.isArray(r.items) ? (r.items as unknown[]).map(toItem) : undefined;
  const id = String(r.dn_id ?? r.id ?? r.uuid ?? r.key ?? "");
  return {
    id,
    dn_id: (r.dn_id ?? r.id) as string | undefined,
    po_id: (r.po_id ?? r.poId) as string | undefined,
    dn_number: (r.dn_number ?? r.dnNumber) as string | undefined,
    delivery_date: (r.delivery_date ?? r.deliveryDate) as string | undefined,
    notes: (r.notes ?? r.note) as string | undefined,
    items,
    created_at: (r.created_at ?? r.createdAt) as string | undefined,
    updated_at: (r.updated_at ?? r.updatedAt) as string | undefined,
  };
};

const toBoardRow = (raw: unknown): ProcurementDnBoardRow => {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? r.po_id ?? r.poId ?? r.key ?? ""),
    po_id: (r.po_id ?? r.poId) as string | undefined,
    po_number: (r.po_number ?? r.poNumber) as string | undefined,
    month: (r.month ?? r.period) as string | undefined,
    supplier_name: (r.supplier_name ?? r.supplierName) as string | undefined,
    subcon_name: (r.subcon_name ?? r.subconName) as string | undefined,
    expected_arrival: (r.expected_arrival ?? r.expectedArrival) as string | undefined,
    dn_created: toNumber(r.dn_created ?? r.dnCreated),
    dn_incoming: toNumber(r.dn_incoming ?? r.dnIncoming),
    total_po: toNumber(r.total_po ?? r.totalPo),
    total_incoming: toNumber(r.total_incoming ?? r.totalIncoming),
    open_dn: toNumber(r.open_dn ?? r.openDn),
    dn_alert: toNumber(r.dn_alert ?? r.dnAlert),
  };
};

const toIncomingLog = (raw: unknown): ProcurementDnIncomingLog => {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? r.log_id ?? r.logId ?? r.key ?? ""),
    dn_id: (r.dn_id ?? r.dnId) as string | undefined,
    scanned_at: (r.scanned_at ?? r.scannedAt ?? r.timestamp ?? r.created_at) as string | undefined,
    notes: (r.notes ?? r.note) as string | undefined,
    uniq: (r.uniq ?? r.item_uniq_code ?? r.itemUniqCode) as string | undefined,
    qty: toNumber(r.qty ?? r.quantity),
    created_at: (r.created_at ?? r.createdAt) as string | undefined,
    full_name: (r.full_name ?? r.fullName ?? r.actor) as string | undefined,
  };
};

const toQueryString = (filters?: ProcurementDnBoardFilters): string => {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.month) params.set("month", filters.month);
  if (filters.supplier) params.set("supplier", filters.supplier);
  if (filters.subcon) params.set("subcon", filters.subcon);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const procurementDnApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProcurementDnBoard: builder.query<ApiResponse<DataArray<ProcurementDnBoardRow>>, ProcurementDnBoardFilters | void>({
      query: (filters) => ({
        url: `/api/procurement/dn/board${toQueryString(filters || undefined)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const unwrapped = unwrapBackendData<unknown>(response);
        const list = Array.isArray(unwrapped) ? unwrapped : [];
        return ok((list as unknown[]).map(toBoardRow));
      },
    }),

    createProcurementDn: builder.mutation<ApiResponse<DataObject<ProcurementDnRecord>>, CreateProcurementDnRequest>({
      query: (body) => ({
        url: "/api/procurement/dn/create",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(toDn(unwrapBackendData(response)), "Created"),
    }),

    listProcurementDnsByPo: builder.query<ApiResponse<DataArray<ProcurementDnRecord>>, string>({
      query: (poId) => ({
        url: `/api/procurement/dn/po/${encodeURIComponent(poId)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const unwrapped = unwrapBackendData<unknown>(response);
        const list = Array.isArray(unwrapped) ? unwrapped : [];
        return ok((list as unknown[]).map(toDn));
      },
    }),

    getProcurementDnById: builder.query<ApiResponse<DataObject<ProcurementDnRecord>>, string>({
      query: (dnId) => ({
        url: `/api/procurement/dn/${encodeURIComponent(dnId)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(toDn(unwrapBackendData(response))),
    }),

    updateProcurementDn: builder.mutation<ApiResponse<DataObject<ProcurementDnRecord>>, { dnId: string; body: UpdateProcurementDnRequest }>({
      query: ({ dnId, body }) => ({
        url: `/api/procurement/dn/${encodeURIComponent(dnId)}`,
        method: "PATCH",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(toDn(unwrapBackendData(response)), "Updated"),
    }),

    scanProcurementDnIncoming: builder.mutation<ApiResponse<DataObject<{ ok: boolean }>>, { dnId: string; body: IncomingScanRequest }>({
      query: ({ dnId, body }) => ({
        url: `/api/procurement/dn/${encodeURIComponent(dnId)}/scan-incoming`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const unwrapped = unwrapBackendData<unknown>(response);
        if (typeof unwrapped === "object" && unwrapped !== null) return ok({ ok: true }, "Scanned");
        return ok({ ok: true }, "Scanned");
      },
    }),

    getProcurementDnIncomingLogs: builder.query<ApiResponse<DataArray<ProcurementDnIncomingLog>>, string>({
      query: (dnId) => ({
        url: `/api/procurement/dn/${encodeURIComponent(dnId)}/incoming-logs`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const unwrapped = unwrapBackendData<unknown>(response);
        const list = Array.isArray(unwrapped) ? unwrapped : [];
        return ok((list as unknown[]).map(toIncomingLog));
      },
    }),

    getProcurementDnPackingListHtml: builder.query<ApiResponse<DataObject<string>>, string>({
      query: (dnId) => ({
        url: `/api/procurement/dn/${encodeURIComponent(dnId)}/packing-list`,
        method: "GET",
        responseHandler: (response: Response) => response.text(),
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(String(response ?? "")),
    }),

    deleteProcurementDn: builder.mutation<ApiResponse<DataObject<{ id: string }>>, string>({
      query: (dnId) => ({
        url: `/api/procurement/dn/${encodeURIComponent(dnId)}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (_response: unknown, _meta, arg) => ok({ id: arg }, "Deleted"),
    }),
  }),
});

export const {
  useGetProcurementDnBoardQuery,
  useCreateProcurementDnMutation,
  useListProcurementDnsByPoQuery,
  useGetProcurementDnByIdQuery,
  useUpdateProcurementDnMutation,
  useScanProcurementDnIncomingMutation,
  useGetProcurementDnIncomingLogsQuery,
  useGetProcurementDnPackingListHtmlQuery,
  useLazyGetProcurementDnPackingListHtmlQuery,
  useDeleteProcurementDnMutation,
} = procurementDnApiSlice;
