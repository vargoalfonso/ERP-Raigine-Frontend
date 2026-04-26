import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const TAG = "StockOpnameSessions" as const;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const getString = (record: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const getNumber = (record: UnknownRecord, keys: string[]): number | undefined => {
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

const normalizeArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (isRecord(response)) {
    const data = response.data;
    if (Array.isArray(data)) return data as T[];
    if (isRecord(data)) {
      const items = (data as UnknownRecord).items;
      if (Array.isArray(items)) return items as T[];
      const nested = (data as UnknownRecord).data;
      if (Array.isArray(nested)) return nested as T[];
      if (isRecord(nested) && Array.isArray((nested as UnknownRecord).items)) return (nested as UnknownRecord).items as T[];
    }
  }
  return [];
};

const normalizeObjectResponse = <T,>(response: unknown): T | null => {
  if (isRecord(response)) {
    const data = response.data;
    if (isRecord(data)) {
      const nested = data.data;
      if (isRecord(nested)) return nested as T;
      return data as T;
    }
  }
  return isRecord(response) ? (response as T) : null;
};

const normalizePaginatedResponse = <T,>(response: unknown): Paginated<T> => {
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
  const paginationRecord = isRecord(paginationRaw) ? (paginationRaw as UnknownRecord) : {};

  return {
    items,
    pagination: {
      total: getNumber(paginationRecord, ["total"]) ?? empty.pagination.total,
      page: getNumber(paginationRecord, ["page"]) ?? empty.pagination.page,
      limit: getNumber(paginationRecord, ["limit"]) ?? empty.pagination.limit,
      total_pages: getNumber(paginationRecord, ["total_pages", "totalPages"]) ?? empty.pagination.total_pages,
    },
  };
};

export type StockInventoryType = "RM" | "FG" | "WIP" | "IDR";
export type StockOpnameMethod = "manual" | "bulk";
export type StockOpnameApprovalAction = "approve" | "reject";

export type StockOpnameUniqOption = {
  uniq_code: string;
  part_number: string;
  part_name: string;
  uom: string;
  system_qty: number;
  weight_kg: number | null;
};

export type StockOpnameCreateItemRequest = {
  uniq_code: string;
  counted_qty: number;
  user_counter?: string;
  weight_kg?: number | null;
};

export type StockOpnameCreateRequest = {
  inventory_type: StockInventoryType;
  method: StockOpnameMethod | string;
  period_month: number;
  period_year: number;
  warehouse_location?: string | null;
  schedule_date: string;
  counted_date: string;
  remarks?: string;
  approver?: string;
  items: StockOpnameCreateItemRequest[];
};

export type StockOpnameSessionListRecord = {
  id: number;
  uuid: string;
  session_number: string;
  inventory_type: StockInventoryType | string;
  method?: string;
  period_month?: number;
  period_year?: number;
  period_label?: string;
  warehouse_location?: string | null;
  schedule_date?: string;
  counted_date?: string;
  remarks?: string;
  total_entries?: number;
  total_variance_qty?: number;
  system_qty_total?: number;
  physical_qty_total?: number;
  variance_qty_total?: number;
  variance_pct_total?: number;
  cost_impact?: number;
  status?: string;
  status_label?: string;
  impact_label?: string;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approver?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  approval_remarks?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StockOpnameSessionDetail = StockOpnameSessionListRecord & {
  items?: unknown[];
};

export type StockOpnameApprovalRequest = {
  action: StockOpnameApprovalAction | string;
  remarks?: string;
};

export type StockOpnameHistoryLogRecord = {
  uniq_code: string;
  packing: string;
  qty_change: number;
  reason: string;
  qty: number;
  last_update: string;
};

const toUniqOption = (raw: unknown): StockOpnameUniqOption => {
  const r = isRecord(raw) ? raw : {};
  return {
    uniq_code: getString(r, ["uniq_code", "uniq", "uniqCode"]) ?? "",
    part_number: getString(r, ["part_number", "partNumber"]) ?? "",
    part_name: getString(r, ["part_name", "partName", "item_name", "itemName"]) ?? "",
    uom: getString(r, ["uom", "unit", "unit_measurement"]) ?? "",
    system_qty: getNumber(r, ["system_qty", "systemQty", "system_quantity"]) ?? 0,
    weight_kg: ((): number | null => {
      const v = (r as UnknownRecord)["weight_kg"];
      if (v === null) return null;
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim()) {
        const parsed = Number(v);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    })(),
  };
};

const toSessionListRecord = (raw: unknown): StockOpnameSessionListRecord => {
  const r = isRecord(raw) ? raw : {};
  return {
    id: getNumber(r, ["id"]) ?? 0,
    uuid: getString(r, ["uuid"]) ?? "",
    session_number: getString(r, ["session_number", "sessionNumber"]) ?? "-",
    inventory_type: (getString(r, ["inventory_type", "type"]) ?? "RM") as StockInventoryType,
    method: getString(r, ["method"]),
    period_month: getNumber(r, ["period_month"]) ?? undefined,
    period_year: getNumber(r, ["period_year"]) ?? undefined,
    period_label: getString(r, ["period_label"]) ?? undefined,
    warehouse_location: getString(r, ["warehouse_location"]) ?? null,
    schedule_date: getString(r, ["schedule_date"]) ?? undefined,
    counted_date: getString(r, ["counted_date"]) ?? undefined,
    remarks: getString(r, ["remarks"]) ?? undefined,
    total_entries: getNumber(r, ["total_entries"]) ?? undefined,
    total_variance_qty: getNumber(r, ["total_variance_qty"]) ?? undefined,
    system_qty_total: getNumber(r, ["system_qty_total"]) ?? undefined,
    physical_qty_total: getNumber(r, ["physical_qty_total"]) ?? undefined,
    variance_qty_total: getNumber(r, ["variance_qty_total"]) ?? undefined,
    variance_pct_total: getNumber(r, ["variance_pct_total"]) ?? undefined,
    cost_impact: getNumber(r, ["cost_impact"]) ?? undefined,
    status: getString(r, ["status"]) ?? undefined,
    status_label: getString(r, ["status_label"]) ?? undefined,
    impact_label: getString(r, ["impact_label"]) ?? undefined,
    submitted_by: getString(r, ["submitted_by"]) ?? null,
    submitted_at: getString(r, ["submitted_at"]) ?? null,
    approver: getString(r, ["approver"]) ?? null,
    approved_by: getString(r, ["approved_by"]) ?? null,
    approved_at: getString(r, ["approved_at"]) ?? null,
    approval_remarks: getString(r, ["approval_remarks"]) ?? null,
    created_by: getString(r, ["created_by"]) ?? null,
    created_at: getString(r, ["created_at"]) ?? null,
    updated_at: getString(r, ["updated_at"]) ?? null,
  };
};

const toHistoryLogRecord = (raw: unknown): StockOpnameHistoryLogRecord => {
  const r = isRecord(raw) ? raw : {};
  return {
    uniq_code: getString(r, ["uniq_code", "uniq"]) ?? "",
    packing: getString(r, ["packing"]) ?? "-",
    qty_change: getNumber(r, ["qty_change", "qtyChange"]) ?? 0,
    reason: getString(r, ["reason"]) ?? "-",
    qty: getNumber(r, ["qty"]) ?? 0,
    last_update: getString(r, ["last_update", "lastUpdate", "updated_at"]) ?? "-",
  };
};

export const stockOpnameApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getStockOpnameUniqOptions: builder.query<StockOpnameUniqOption[], { type: StockInventoryType; q: string; limit: number }>({
        query: ({ type, q, limit }) => ({
          url: "/stock-opname-sessions/form-options/uniq",
          method: "GET",
          params: { type, q, limit },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          normalizeArrayResponse<unknown>(response)
            .map(toUniqOption)
            .filter((x) => Boolean(x.uniq_code)),
      }),

      createStockOpnameSession: builder.mutation<unknown, StockOpnameCreateRequest>({
        query: (body) => ({
          url: "/stock-opname-sessions",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      getStockOpnameSessions: builder.query<Paginated<StockOpnameSessionListRecord>, { type: StockInventoryType; page: number; limit: number }>({
        query: ({ type, page, limit }) => ({
          url: "/stock-opname-sessions",
          method: "GET",
          params: { type, page, limit },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const normalized = normalizePaginatedResponse<unknown>(response);
          return {
            items: normalized.items.map(toSessionListRecord),
            pagination: normalized.pagination,
          };
        },
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: string }> = [{ type: TAG, id: "LIST" }];
          const ids = result?.items?.map((r) => r.uuid || String(r.id)).filter(Boolean) ?? [];
          return base.concat(ids.map((id) => ({ type: TAG, id })));
        },
      }),

      // Not in the provided spec, but common in the backend; used by detail page if available.
      getStockOpnameSessionById: builder.query<StockOpnameSessionDetail | null, { id: string | number }>({
        query: ({ id }) => ({
          url: `/stock-opname-sessions/${encodeURIComponent(String(id))}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const obj = normalizeObjectResponse<unknown>(response);
          if (!obj) return null;
          return toSessionListRecord(obj) as StockOpnameSessionDetail;
        },
        providesTags: (_r, _e, arg) => [{ type: TAG, id: String(arg.id) }],
      }),

      approveStockOpnameSession: builder.mutation<unknown, { id: string | number; body: StockOpnameApprovalRequest }>({
        query: ({ id, body }) => ({
          url: `/stock-opname-sessions/${encodeURIComponent(String(id))}/approve`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: (_r, _e, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(arg.id) },
        ],
      }),

      rejectStockOpnameSession: builder.mutation<unknown, { id: string | number; body: StockOpnameApprovalRequest }>({
        query: ({ id, body }) => ({
          url: `/stock-opname-sessions/${encodeURIComponent(String(id))}/reject`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: (_r, _e, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(arg.id) },
        ],
      }),

      getStockOpnameHistoryLogs: builder.query<Paginated<StockOpnameHistoryLogRecord>, { type: StockInventoryType; uniq_code: string; page: number; limit: number }>({
        query: ({ type, uniq_code, page, limit }) => ({
          url: "/stock-opname-sessions/history-logs",
          method: "GET",
          params: { type, uniq_code, page, limit },
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
    }),
  });

export const {
  useGetStockOpnameUniqOptionsQuery,
  useLazyGetStockOpnameUniqOptionsQuery,
  useCreateStockOpnameSessionMutation,
  useGetStockOpnameSessionsQuery,
  useGetStockOpnameSessionByIdQuery,
  useApproveStockOpnameSessionMutation,
  useRejectStockOpnameSessionMutation,
  useGetStockOpnameHistoryLogsQuery,
} = stockOpnameApiSlice;