import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

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

  const total = toNumber(data.total) ?? toNumber((data as UnknownRecord).count) ?? 0;
  const page = toNumber(data.page) ?? 1;
  const perPage = toNumber(data.limit) ?? toNumber(data.perPage) ?? 10;
  const totalPages = perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;

  return { total, page, perPage, totalPages };
};

export type WipListRow = {
  id?: string;
  process?: string;
  uniq?: string;
  part_number?: string;
  part_info?: string;
  wo_number?: string;
  stock?: number;
  kanban_number?: string;
  type?: string;
  stock_to_complete_kanban?: number;
  kanban?: number;
};

export type WipDetailProcess = {
  process?: string;
  stock?: number;
};

export type WipDetail = {
  id: string;
  wo_number?: string;
  uniq?: string;
  part_number?: string;
  part_name?: string;
  processes: WipDetailProcess[];
};

export type WipCreateProcessFlow = {
  op_seq: number;
  machine_name: string;
  process_name: string;
};

export type WipCreateItem = {
  uniq: string;
  kanban_number: string;
  wip_type: string;
  uom: string;
  stock: number;
  stock_kanban: number;
  process_flow: WipCreateProcessFlow[];
};

export type WipCreateRequest = {
  wo_id: string | number;
  wo_number: string;
  items: WipCreateItem[];
};

export type WipUpdateRequest = {
  status: string;
};

const toWipListRow = (raw: unknown): WipListRow => {
  const r = isRecord(raw) ? raw : {};
  return {
    id: toText(r.id ?? r.wip_id ?? r.ID),
    process: toText(r.process ?? r.process_name ?? r.Process),
    uniq: toText(r.uniq ?? r.uniq_code ?? r.Uniq),
    part_number: toText(r.part_number ?? r.part_no ?? r.PartNumber),
    part_info: toText(r.part_info ?? r.part_name ?? r.partName ?? r.PartInfo),
    wo_number: toText(r.wo_number ?? r.woNumber ?? r.WorkOrderNumber),
    stock: toNumber(r.stock ?? r.stock_qty ?? r.Stock),
    kanban_number: toText(r.kanban_number ?? r.kanbanCode ?? r.packing_number ?? r.PackingNumber),
    type: toText(r.type ?? r.wip_type ?? r.status ?? r.Status),
    stock_to_complete_kanban: toNumber(r.stock_to_complete_kanban ?? r.stockToCompleteKanban),
    kanban: toNumber(r.kanban ?? r.kanban_count ?? r.kanbanCount),
  };
};

const toWipDetail = (raw: unknown): WipDetail | null => {
  const r = isRecord(raw) ? raw : null;
  if (!r) return null;

  const processesRaw = Array.isArray(r.processes) ? r.processes : [];
  const processes: WipDetailProcess[] = processesRaw.map((p) => {
    const pr = isRecord(p) ? p : {};
    return {
      process: toText(pr.process ?? pr.process_name ?? pr.Process),
      stock: toNumber(pr.stock ?? pr.stock_qty ?? pr.Stock),
    };
  });

  return {
    id: toText(r.id ?? r.wip_id ?? r.ID) ?? "",
    wo_number: toText(r.wo_number ?? r.woNumber),
    uniq: toText(r.uniq ?? r.uniq_code),
    part_number: toText(r.part_number ?? r.part_no),
    part_name: toText(r.part_name ?? r.part_info ?? r.partName),
    processes,
  };
};

const parseListItems = (response: unknown): WipListRow[] => {
  const unwrapped = unwrapBackendData<unknown>(response);
  const base = isRecord(unwrapped) ? unwrapped : isRecord(response) ? response : undefined;

  // When `unwrapBackendData` returns `{ items: [...] }` directly.
  if (base && Array.isArray((base as UnknownRecord).items)) {
    return ((base as UnknownRecord).items as unknown[]).map(toWipListRow);
  }

  // Expected: data.items
  if (base && isRecord(base.data) && Array.isArray(base.data.items)) {
    return base.data.items.map(toWipListRow);
  }

  // Alternative: items nested deeper (e.g. `{ data: { items: [...] } }` before unwrap).
  if (isRecord(response) && isRecord((response as UnknownRecord).data)) {
    const data = (response as UnknownRecord).data as UnknownRecord;
    if (Array.isArray(data.items)) {
      return (data.items as unknown[]).map(toWipListRow);
    }
  }

  // Alternative shapes
  if (base && isRecord(base.data) && Array.isArray((base.data as UnknownRecord).data)) {
    return ((base.data as UnknownRecord).data as unknown[]).map(toWipListRow);
  }
  if (Array.isArray(unwrapped)) return unwrapped.map(toWipListRow);

  return [];
};

export type WipMovementLogItem = {
  id?: string | number;
  uniq_code?: string;
  movement_type?: string;
  reason?: string;
  qty_change?: number;
  qty_before?: number;
  qty_after?: number;
  wo_number?: string | null;
  dn_number?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  logged_by?: string | null;
  logged_at?: string;
};

export type WipHistoryParams = {
  uniq_code: string;
  page?: number;
  limit?: number;
};

const toWipMovementLogItem = (raw: unknown): WipMovementLogItem => {
  const r = isRecord(raw) ? raw : {};
  return {
    id: toText(r.id ?? r.ID),
    uniq_code: toText(r.uniq_code ?? r.uniq ?? r.UniqCode),
    movement_type: toText(r.movement_type ?? r.action ?? r.MovementType),
    reason: toText(r.reason ?? r.Reason ?? r.notes ?? r.Notes),
    qty_change: toNumber(r.qty_change ?? r.qty ?? r.QtyChange) ?? 0,
    qty_before: toNumber(r.qty_before ?? r.QtyBefore),
    qty_after: toNumber(r.qty_after ?? r.QtyAfter),
    wo_number: toText(r.wo_number ?? r.WONumber ?? r.reference_id ?? r.ReferenceID) ?? null,
    dn_number: toText(r.dn_number ?? r.DNNumber) ?? null,
    reference_id: toText(r.reference_id ?? r.reference ?? r.ReferenceID) ?? null,
    notes: toText(r.notes ?? r.Notes) ?? null,
    logged_by: toText(r.logged_by ?? r.LoggedBy) ?? null,
    logged_at: toText(r.logged_at ?? r.created_at ?? r.LoggedAt),
  };
};

const parseHistoryItems = (response: unknown): WipMovementLogItem[] => {
  const unwrapped = unwrapBackendData<unknown>(response);
  const base = isRecord(unwrapped) ? unwrapped : isRecord(response) ? response : undefined;

  const pickArray = (obj: unknown): unknown[] | undefined => {
    if (!isRecord(obj)) return undefined;
    if (Array.isArray(obj.items)) return obj.items as unknown[];
    if (isRecord(obj.data)) {
      if (Array.isArray(obj.data.items)) return obj.data.items as unknown[];
      if (Array.isArray((obj.data as UnknownRecord).data))
        return (obj.data as UnknownRecord).data as unknown[];
    }
    return undefined;
  };

  const arr =
    pickArray(base) ??
    pickArray(response) ??
    (Array.isArray(unwrapped) ? (unwrapped as unknown[]) : undefined) ??
    [];

  return arr.map(toWipMovementLogItem);
};

export const wipApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getWipList: builder.query<ApiResponse<WipListRow[]>, { page?: number; limit?: number }>({
      query: ({ page = 1, limit = 10 }) => ({
        url: `/wip?page=${page}&limit=${limit}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseListItems(response), "WIP retrieved", parsePagination(response)),
    }),

    getWipDetail: builder.query<ApiResponse<WipDetail>, { id: string | number }>({
      query: ({ id }) => ({
        url: `/wip/${encodeURIComponent(String(id))}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown, _meta, arg) => {
        const unwrapped = unwrapBackendData<unknown>(response);
        const obj = isRecord(unwrapped) ? unwrapped : isRecord(response) ? response : {};
        const data = isRecord(obj.data) ? obj.data : obj;
        return ok(toWipDetail(data) ?? { id: String(arg.id), processes: [] }, "WIP detail retrieved");
      },
    }),

    createWip: builder.mutation<ApiResponse<unknown>, WipCreateRequest>({
      query: (body) => ({
        url: `/wip`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(unwrapBackendData<unknown>(response), "WIP created"),
    }),

    updateWip: builder.mutation<ApiResponse<unknown>, { id: string | number; body: WipUpdateRequest }>({
      query: ({ id, body }) => ({
        url: `/wip/${encodeURIComponent(String(id))}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(unwrapBackendData<unknown>(response), "WIP updated"),
    }),

    getWipHistory: builder.query<ApiResponse<WipMovementLogItem[]>, WipHistoryParams>({
      query: ({ uniq_code, page = 1, limit = 100 }) => ({
        url: `/wip/history?uniq_code=${encodeURIComponent(uniq_code)}&page=${page}&limit=${limit}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseHistoryItems(response), "WIP history retrieved", parsePagination(response)),
    }),
  }),
});

export const {
  useGetWipListQuery,
  useGetWipDetailQuery,
  useCreateWipMutation,
  useUpdateWipMutation,
  useGetWipHistoryQuery,
} = wipApiSlice;
