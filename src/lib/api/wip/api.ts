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
  wo_id: number;
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
  }),
});

export const {
  useGetWipListQuery,
  useGetWipDetailQuery,
  useCreateWipMutation,
  useUpdateWipMutation,
} = wipApiSlice;
