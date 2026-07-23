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

export type ScrapType =
  | "setting_machine_scrap"
  | "process_scrap"
  | "product_return_scrap";
export type DisposalReason = "dump" | "sell" | "inventory";

export type ScrapStockRecord = {
  id: number;
  uuid: string;
  uniq: string;
  part_number: string;
  part_name: string;
  model: string;
  packing_number: string;
  wo_number: string | null;
  source_qc_log_id: number | null;
  source_defect_id: number | null;
  scrap_type: string;
  disposal_reason?: string | null;
  quantity: number;
  uom: string;
  weight_kg: number;
  date_received: string;
  validator: string;
  remarks: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type ScrapStockCreateRequest = {
  uniq: string;
  part_number: string;
  part_name: string;
  model: string;
  packing_number: string;
  scrap_type: ScrapType | string;
  disposal_reason: DisposalReason | string;
  quantity: number;
  uom: string;
  weight_kg: number;
  date_received: string;
  remarks: string | null;
  wo_number?: string | null;
};

export type ScrapItemOption = {
  uniq_code: string;
  part_number: string;
  part_name: string;
  model: string;
  uom: string;
  material_type: string;
};

export type ScrapStocksStats = {
  total_items: number;
  total_qty: number;
  total_weight_kg: number;
  scrap_types: number;
};

export type ScrapStockHistoryLogRecord = {
  id: number;
  action: string;
  message: string;
  created_by: string | null;
  created_at: string | null;
  raw?: UnknownRecord;
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

const toScrapStockRecord = (raw: unknown): ScrapStockRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: getNumber(record, ["id"]) ?? 0,
    uuid: getString(record, ["uuid"]) ?? "",
    uniq: getString(record, ["uniq"]) ?? "",
    part_number: getString(record, ["part_number", "partNumber"]) ?? "",
    part_name: getString(record, ["part_name", "partName"]) ?? "",
    model: getString(record, ["model"]) ?? "",
    packing_number:
      getString(record, ["packing_number", "packingNumber"]) ?? "",
    wo_number: getString(record, ["wo_number", "woNumber"]) ?? null,
    source_qc_log_id:
      getNumber(record, ["source_qc_log_id", "sourceQcLogId"]) ?? null,
    source_defect_id:
      getNumber(record, ["source_defect_id", "sourceDefectId"]) ?? null,
    scrap_type: getString(record, ["scrap_type", "scrapType"]) ?? "",
    disposal_reason:
      getString(record, ["disposal_reason", "scrap_reason", "reasons"]) ?? null,
    quantity: getNumber(record, ["quantity", "qty"]) ?? 0,
    uom: getString(record, ["uom", "unit"]) ?? "",
    weight_kg: getNumber(record, ["weight_kg", "weightKg", "weight"]) ?? 0,
    date_received: getString(record, ["date_received", "dateReceived"]) ?? "",
    validator: getString(record, ["validator"]) ?? "",
    remarks: getString(record, ["remarks", "notes"]) ?? null,
    status: getString(record, ["status"]) ?? "",
    created_at: getString(record, ["created_at", "createdAt"]),
    updated_at: getString(record, ["updated_at", "updatedAt"]),
  };
};

const toScrapItemOption = (raw: unknown): ScrapItemOption => {
  const record = isRecord(raw) ? raw : {};
  return {
    uniq_code: getString(record, ["uniq_code", "uniqCode"]) ?? "",
    part_number: getString(record, ["part_number", "partNumber"]) ?? "",
    part_name: getString(record, ["part_name", "partName"]) ?? "",
    model: getString(record, ["model"]) ?? "",
    uom: getString(record, ["uom", "unit"]) ?? "",
    material_type: getString(record, ["material_type", "materialType"]) ?? "",
  };
};

const toScrapStocksStats = (raw: unknown): ScrapStocksStats => {
  const record = isRecord(raw) ? raw : {};
  return {
    total_items: getNumber(record, ["total_items"]) ?? 0,
    total_qty: getNumber(record, ["total_qty"]) ?? 0,
    total_weight_kg: getNumber(record, ["total_weight_kg"]) ?? 0,
    scrap_types: getNumber(record, ["scrap_types"]) ?? 0,
  };
};

const toHistoryLogRecord = (raw: unknown): ScrapStockHistoryLogRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: getNumber(record, ["id"]) ?? 0,
    action: getString(record, ["action", "event", "type"]) ?? "",
    message: getString(record, ["message", "description", "remarks"]) ?? "",
    created_by: getString(record, ["created_by", "createdBy", "user"]) ?? null,
    created_at:
      getString(record, ["created_at", "createdAt", "timestamp"]) ?? null,
    raw: isRecord(raw) ? raw : undefined,
  };
};

export const scrapStockSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getScrapStocks: builder.query<
      Paginated<ScrapStockRecord>,
      { page: number; limit: number }
    >({
      query: ({ page, limit }) => ({
        url: "/scrap-stocks",
        method: "GET",
        params: { page, limit },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const normalized = normalizePaginatedResponse<unknown>(response);
        return {
          items: normalized.items.map(toScrapStockRecord),
          pagination: normalized.pagination,
        };
      },
    }),

    getScrapStockById: builder.query<ScrapStockRecord, string>({
      query: (id) => ({
        url: `/scrap-stocks/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        toScrapStockRecord(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
    }),

    getScrapStocksStats: builder.query<ScrapStocksStats, void>({
      query: () => ({
        url: "/scrap-stocks/stats",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        toScrapStocksStats(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
    }),

    createScrapStock: builder.mutation<
      ScrapStockRecord,
      ScrapStockCreateRequest
    >({
      query: (body) => ({
        url: "/scrap-stocks",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        toScrapStockRecord(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
    }),

    getScrapStockHistoryLogs: builder.query<
      Paginated<ScrapStockHistoryLogRecord>,
      { id: string; page: number; limit: number }
    >({
      query: ({ id, page, limit }) => ({
        url: `/scrap-stocks/${encodeURIComponent(id)}/history-logs`,
        method: "GET",
        params: { page, limit },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const normalized = normalizePaginatedResponse<unknown>(response);
        return {
          items: normalized.items.map(toHistoryLogRecord),
          pagination: normalized.pagination,
        };
      },
    }),

    getScrapItemOptions: builder.query<
      { items: ScrapItemOption[] },
      { q?: string; limit?: number } | void
    >({
      query: (params) => ({
        url: "/scrap-stocks/item-options",
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
          items: rawItems.map(toScrapItemOption).filter((it) => it.uniq_code),
        };
      },
    }),

    getScrapPackingOptions: builder.query<string[], string>({
      query: (uniq) => ({
        url: "/scrap-stocks/packing-options",
        method: "GET",
        params: { uniq },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const data = isRecord(response)
          ? (response as UnknownRecord).data
          : response;
        if (!Array.isArray(data)) return [];
        return data
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter((v): v is string => Boolean(v));
      },
    }),

    updateScrapStock: builder.mutation<
      ScrapStockRecord,
      {
        id: number | string;
        body: Partial<ScrapStockCreateRequest> & {
          status?: string;
          validator?: string;
        };
      }
    >({
      query: ({ id, body }) => ({
        url: `/scrap-stocks/${encodeURIComponent(String(id))}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        toScrapStockRecord(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
    }),

    deleteScrapStock: builder.mutation<
      { success?: boolean } | unknown,
      number | string
    >({
      query: (id) => ({
        url: `/scrap-stocks/${encodeURIComponent(String(id))}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
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
  useGetScrapStocksQuery,
  useGetScrapStockByIdQuery,
  useGetScrapStocksStatsQuery,
  useCreateScrapStockMutation,
  useGetScrapStockHistoryLogsQuery,
  useGetScrapPackingOptionsQuery,
  useGetScrapItemOptionsQuery,
  useUpdateScrapStockMutation,
  useDeleteScrapStockMutation,
  useGetDeliveryNoteByUniqQuery,
} = scrapStockSlice;
