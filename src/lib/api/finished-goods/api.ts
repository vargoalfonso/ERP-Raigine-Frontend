import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const getString = (
  record: UnknownRecord,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const getNumber = (
  record: UnknownRecord,
  keys: string[],
): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

export type Pagination = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type Paginated<T> = {
  items: T[];
  pagination: Pagination;
};

const normalizeObjectResponse = <T>(response: unknown): T | null => {
  if (!isRecord(response)) return null;
  const data = response.data;
  if (isRecord(data)) return data as T;
  return null;
};

const normalizePaginatedResponse = <T>(response: unknown): Paginated<T> => {
  const empty: Paginated<T> = {
    items: [],
    pagination: { total: 0, page: 1, limit: 20, total_pages: 1 },
  };

  if (!isRecord(response)) return empty;
  const data = response.data;
  if (!isRecord(data)) return empty;

  const itemsRaw = (data as UnknownRecord).items;
  const paginationRaw = (data as UnknownRecord).pagination;

  const items = Array.isArray(itemsRaw) ? (itemsRaw as T[]) : [];
  const paginationRecord = isRecord(paginationRaw)
    ? (paginationRaw as UnknownRecord)
    : {};

  return {
    items,
    pagination: {
      total: getNumber(paginationRecord, ["total"]) ?? empty.pagination.total,
      page: getNumber(paginationRecord, ["page"]) ?? empty.pagination.page,
      limit: getNumber(paginationRecord, ["limit"]) ?? empty.pagination.limit,
      total_pages:
        getNumber(paginationRecord, ["total_pages", "totalPages"]) ??
        empty.pagination.total_pages,
    },
  };
};

export type FinishedGoodListItem = {
  id: number;
  uuid: string;
  uniq_code: string;
  part_number: string;
  part_name: string;
  model: string;
  wo_number: string;
  warehouse_location: string;
  uom: string;
  created_at: string;
  updated_at: string;
};

export type FinishedGoodsSummary = {
  total_fg_items: number;
  low_stock_items: number;
  total_stock: number;
  active_alerts: number;
};

export type FinishedGoodParameterizedSummary = {
  uniq_code: string;
  part_number: string;
  part_name: string;
  model: string;
  wo_number: string;
  warehouse_location: string;
  stock_qty: number;
  uom: string;
  kanban_standard_qty: number;
  min_threshold: number;
  max_threshold: number;
  target_stock_qty: number;
  current_kanban: number;
  stock_gap_to_target: number;
  kanban_need: number;
  stock_to_kanban_pcs: number;
  stock_after_replenish: number;
  status: string;
  parameter_source: string;
};

export type GetFinishedGoodsParams = { page: number; limit: number };

export type CreateFinishedGoodRequest = {
  uniq_code: string;
  warehouse_location: string;
};

export type UpdateFinishedGoodRequest = {
  uniq_code?: string;
  warehouse_location?: string;
  stock_qty?: number;
};
export interface DeliveryNoteItem {
  dn_number: string;
  item_uniq_code: string;
  packing_number: string;
  quantity: number;
  check: string;
}

export interface DeliveryNoteResponse {
  request_id: string;
  status: number;
  message: string;
  data: DeliveryNoteItem[];
}

const toFinishedGoodListItem = (raw: unknown): FinishedGoodListItem => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: getNumber(record, ["id"]) ?? 0,
    uuid: getString(record, ["uuid"]) ?? "",
    uniq_code: getString(record, ["uniq_code", "uniqCode"]) ?? "",
    part_number: getString(record, ["part_number", "partNumber"]) ?? "",
    part_name: getString(record, ["part_name", "partName"]) ?? "",
    model: getString(record, ["model"]) ?? "",
    wo_number: getString(record, ["wo_number", "woNumber"]) ?? "",
    warehouse_location:
      getString(record, [
        "warehouse_location",
        "warehouseLocation",
        "warehouse",
      ]) ?? "",
    uom: getString(record, ["uom", "unit"]) ?? "",
    created_at: getString(record, ["created_at", "createdAt"]) ?? "",
    updated_at: getString(record, ["updated_at", "updatedAt"]) ?? "",
  };
};

const toFinishedGoodsSummary = (raw: unknown): FinishedGoodsSummary => {
  const record = isRecord(raw) ? raw : {};
  return {
    total_fg_items: getNumber(record, ["total_fg_items"]) ?? 0,
    low_stock_items: getNumber(record, ["low_stock_items"]) ?? 0,
    total_stock: getNumber(record, ["total_stock"]) ?? 0,
    active_alerts: getNumber(record, ["active_alerts"]) ?? 0,
  };
};

const toFinishedGoodParameterizedSummary = (
  raw: unknown,
): FinishedGoodParameterizedSummary => {
  const record = isRecord(raw) ? raw : {};
  return {
    uniq_code: getString(record, ["uniq_code", "uniqCode"]) ?? "",
    part_number: getString(record, ["part_number", "partNumber"]) ?? "",
    part_name: getString(record, ["part_name", "partName"]) ?? "",
    model: getString(record, ["model"]) ?? "",
    wo_number: getString(record, ["wo_number", "woNumber"]) ?? "",
    warehouse_location:
      getString(record, [
        "warehouse_location",
        "warehouseLocation",
        "warehouse",
      ]) ?? "",
    stock_qty: getNumber(record, ["stock_qty", "stockQty"]) ?? 0,
    uom: getString(record, ["uom", "unit"]) ?? "",
    kanban_standard_qty:
      getNumber(record, ["kanban_standard_qty", "kanbanStandardQty"]) ?? 0,
    min_threshold: getNumber(record, ["min_threshold", "minThreshold"]) ?? 0,
    max_threshold: getNumber(record, ["max_threshold", "maxThreshold"]) ?? 0,
    target_stock_qty:
      getNumber(record, ["target_stock_qty", "targetStockQty"]) ?? 0,
    current_kanban: getNumber(record, ["current_kanban", "currentKanban"]) ?? 0,
    stock_gap_to_target:
      getNumber(record, ["stock_gap_to_target", "stockGapToTarget"]) ?? 0,
    kanban_need: getNumber(record, ["kanban_need", "kanbanNeed"]) ?? 0,
    stock_to_kanban_pcs:
      getNumber(record, ["stock_to_kanban_pcs", "stockToKanbanPcs"]) ?? 0,
    stock_after_replenish:
      getNumber(record, ["stock_after_replenish", "stockAfterReplenish"]) ?? 0,
    status: getString(record, ["status"]) ?? "",
    parameter_source:
      getString(record, ["parameter_source", "parameterSource"]) ?? "",
  };
};

export type FinishedGoodUniqOption = {
  uniq_code: string;
  part_number: string;
  part_name: string;
  model: string;
  last_wo_number: string;
};

export type GetFinishedGoodUniqOptionsParams = { q?: string; limit?: number };

const toFinishedGoodUniqOption = (raw: unknown): FinishedGoodUniqOption => {
  const record = isRecord(raw) ? raw : {};
  return {
    uniq_code: getString(record, ["uniq_code", "uniqCode"]) ?? "",
    part_number: getString(record, ["part_number", "partNumber"]) ?? "",
    part_name: getString(record, ["part_name", "partName"]) ?? "",
    model: getString(record, ["model"]) ?? "",
    last_wo_number:
      getString(record, ["last_wo_number", "lastWoNumber", "wo_number"]) ?? "",
  };
};

export type FinishedGoodHistoryItem = {
  id: number;
  uniq_code: string;
  movement_type: string;
  reason: string;
  qty_change: number;
  qty_before: number;
  qty_after: number;
  wo_number: string;
  dn_number: string;
  reference_id: string;
  notes: string;
  logged_by: string;
  logged_at: string;
};

export type GetFinishedGoodHistoryParams = {
  uniq_code: string;
  page?: number;
  limit?: number;
};

const toFinishedGoodHistoryItem = (raw: unknown): FinishedGoodHistoryItem => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: getNumber(record, ["id"]) ?? 0,
    uniq_code: getString(record, ["uniq_code", "uniqCode"]) ?? "",
    movement_type: getString(record, ["movement_type", "movementType"]) ?? "",
    reason: getString(record, ["reason"]) ?? "",
    qty_change: getNumber(record, ["qty_change", "qtyChange"]) ?? 0,
    qty_before: getNumber(record, ["qty_before", "qtyBefore"]) ?? 0,
    qty_after: getNumber(record, ["qty_after", "qtyAfter"]) ?? 0,
    wo_number: getString(record, ["wo_number", "woNumber"]) ?? "",
    dn_number: getString(record, ["dn_number", "dnNumber"]) ?? "",
    reference_id: getString(record, ["reference_id", "referenceId"]) ?? "",
    notes: getString(record, ["notes"]) ?? "",
    logged_by: getString(record, ["logged_by", "loggedBy"]) ?? "",
    logged_at: getString(record, ["logged_at", "loggedAt"]) ?? "",
  };
};

export type FinishedGoodQRResult = { qr?: string };

export const finishedGoodsSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Generate (or fetch) the QR for a finished good. The QR carries the kanban
    // list / packing list resolved from the work order. 1 uniq = 1 QR.
    generateFinishedGoodQR: builder.query<{ qr?: string }, string>({
      query: (code) => ({
        url: `/finished-goods/${encodeURIComponent(code)}/create-qr`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown): { qr?: string } => {
        if (isRecord(response) && isRecord(response.data)) {
          const qr = response.data.qr;
          return { qr: typeof qr === "string" ? qr : undefined };
        }
        return { qr: undefined };
      },
    }),

    getFinishedGoods: builder.query<
      Paginated<FinishedGoodListItem>,
      GetFinishedGoodsParams
    >({
      query: ({ page, limit }) => ({
        url: "/finished-goods",
        method: "GET",
        params: { page, limit },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      providesTags: (result) => {
        const items = result?.items ?? [];
        return [
          { type: "FinishedGoods" as const, id: "LIST" },
          ...items.map((it) => ({
            type: "FinishedGoods" as const,
            id: it.id || it.uuid || it.uniq_code,
          })),
        ];
      },
      transformResponse: (response: unknown) => {
        const normalized = normalizePaginatedResponse<unknown>(response);
        return {
          items: normalized.items.map(toFinishedGoodListItem),
          pagination: normalized.pagination,
        };
      },
    }),

    getFinishedGoodsSummary: builder.query<FinishedGoodsSummary, void>({
      query: () => ({
        url: "/finished-goods/summary",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        toFinishedGoodsSummary(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
    }),

    getFinishedGoodParameterizedSummary: builder.query<
      FinishedGoodParameterizedSummary,
      { uniq_code: string }
    >({
      query: ({ uniq_code }) => ({
        url: "/finished-goods/parameterized-summary",
        method: "GET",
        params: { uniq_code },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        toFinishedGoodParameterizedSummary(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
    }),

    getFinishedGoodUniqOptions: builder.query<
      { items: FinishedGoodUniqOption[] },
      GetFinishedGoodUniqOptionsParams | void
    >({
      query: (params) => ({
        url: "/finished-goods/form-options/uniq",
        method: "GET",
        params: { q: params?.q ?? "", limit: params?.limit ?? 200 },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const obj =
          normalizeObjectResponse<UnknownRecord>(response) ??
          (isRecord(response) ? (response as UnknownRecord) : {});
        const rawItems = Array.isArray((obj as UnknownRecord).items)
          ? ((obj as UnknownRecord).items as unknown[])
          : [];
        return {
          items: rawItems
            .map(toFinishedGoodUniqOption)
            .filter((it) => it.uniq_code),
        };
      },
    }),

    getFinishedGoodHistory: builder.query<
      Paginated<FinishedGoodHistoryItem>,
      GetFinishedGoodHistoryParams
    >({
      query: ({ uniq_code, page, limit }) => ({
        url: "/finished-goods/history",
        method: "GET",
        params: { uniq_code, page: page ?? 1, limit: limit ?? 20 },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const normalized = normalizePaginatedResponse<unknown>(response);
        return {
          items: normalized.items.map(toFinishedGoodHistoryItem),
          pagination: normalized.pagination,
        };
      },
    }),

    createFinishedGood: builder.mutation<
      FinishedGoodListItem,
      CreateFinishedGoodRequest
    >({
      query: (body) => ({
        url: "/finished-goods",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: [{ type: "FinishedGoods", id: "LIST" }],
      transformResponse: (response: unknown) =>
        toFinishedGoodListItem(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
    }),

    updateFinishedGood: builder.mutation<
      FinishedGoodListItem,
      { id: number; body: UpdateFinishedGoodRequest }
    >({
      query: ({ id, body }) => ({
        url: `/finished-goods/${id}`,
        method: "PATCH",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "FinishedGoods", id: "LIST" },
        { type: "FinishedGoods", id: arg.id },
      ],
      transformResponse: (response: unknown) =>
        toFinishedGoodListItem(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
    }),

    deleteFinishedGood: builder.mutation<{ id: number }, { id: number }>({
      query: ({ id }) => ({
        url: `/finished-goods/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "FinishedGoods", id: "LIST" },
        { type: "FinishedGoods", id: arg.id },
      ],
      transformResponse: (_response: unknown, _meta: unknown, arg) => ({
        id: arg.id,
      }),
    }),

    getDeliveryNoteByUniq: builder.query<DeliveryNoteResponse, string>({
      query: (uniq) => ({
        url: `/delivery-notes/uniq/${encodeURIComponent(uniq)}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),
  }),
});

export const {
  useGetFinishedGoodsQuery,
  useGetFinishedGoodsSummaryQuery,
  useGetFinishedGoodParameterizedSummaryQuery,
  useGetFinishedGoodHistoryQuery,
  useGetFinishedGoodUniqOptionsQuery,
  useCreateFinishedGoodMutation,
  useUpdateFinishedGoodMutation,
  useDeleteFinishedGoodMutation,
  useLazyGenerateFinishedGoodQRQuery,
  useGetDeliveryNoteByUniqQuery,
  useLazyGetDeliveryNoteByUniqQuery,
} = finishedGoodsSlice;
