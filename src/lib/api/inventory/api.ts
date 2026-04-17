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
  if (!isRecord(response)) return undefined;

  const direct = isRecord(response.pagination) ? response.pagination : undefined;
  const nested = isRecord(response.data) && isRecord(response.data.pagination) ? response.data.pagination : undefined;
  const source = direct ?? nested;
  if (!source) return undefined;

  return {
    total: toNumber(source.total) ?? 0,
    page: toNumber(source.page) ?? 1,
    perPage: toNumber(source.perPage ?? source.limit) ?? 20,
    totalPages: toNumber(source.totalPages) ?? 1,
  };
};

const parseArrayResponse = <T,>(response: unknown): T[] => {
  const unwrapped = unwrapBackendData<unknown>(response);
  if (Array.isArray(unwrapped)) return unwrapped as T[];
  if (isRecord(unwrapped) && Array.isArray(unwrapped.items)) return unwrapped.items as T[];
  if (isRecord(unwrapped) && Array.isArray(unwrapped.data)) return unwrapped.data as T[];
  if (isRecord(response) && Array.isArray(response.data)) return response.data as T[];
  if (isRecord(response) && isRecord(response.data) && Array.isArray(response.data.items)) return response.data.items as T[];
  return [];
};

const parseObjectResponse = <T,>(response: unknown): T | null => {
  const unwrapped = unwrapBackendData<unknown>(response);
  if (isRecord(unwrapped)) return unwrapped as T;
  if (isRecord(response) && isRecord(response.data) && isRecord(response.data.data)) return response.data.data as T;
  if (isRecord(response) && isRecord(response.data)) return response.data as T;
  if (isRecord(response)) return response as T;
  return null;
};

export type InventoryType = "raw-materials" | "indirect-materials" | "subcon-materials";

export type InventoryRecord = {
  id: string;
  uniq_code?: string;
  raw_material_type?: string;
  rm_source?: string;
  warehouse_location?: string;
  uom?: string;
  stock_qty?: number;
  stock_weight_kg?: number;
  part_name?: string;
  part_number?: string;
  item_name?: string;
  created_at?: string;
  updated_at?: string;
};

export type InventoryHistoryRecord = {
  id: string;
  inventory_id?: string;
  uniq_code?: string;
  action?: string;
  reason?: string;
  qty?: number;
  stock_before?: number;
  stock_after?: number;
  date_time?: string;
  created_by?: string;
  reference_number?: string;
  kanban_number?: string;
  packing_number?: string;
};

export type InventoryIncomingRecord = {
  id: string;
  inventory_id?: string;
  uniq_code?: string;
  quantity?: number;
  stock_qty?: number;
  weight_kg?: number;
  stock_weight_kg?: number;
  uom?: string;
  warehouse_location?: string;
  supplier_name?: string;
  packing_number?: string;
  reference_number?: string;
  date_incoming?: string;
  created_at?: string;
};

export type InventoryKanbanSummary = {
  uniq_code?: string;
  total_kanban?: number;
  stock_to_complete_kanban?: number;
  kanban_count?: number;
  stock_days?: number;
  safety_stock_days?: number;
};

export type InventoryMutationRequest = {
  uniq_code: string;
  raw_material_type?: string;
  rm_source?: string;
  warehouse_location?: string;
  uom?: string;
  stock_qty?: number;
  stock_weight_kg?: number;
  part_name?: string;
  part_number?: string;
};

const toInventoryRecord = (raw: unknown): InventoryRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: toText(record.id ?? record.inventory_id ?? record.ID ?? record.InventoryID) ?? "",
    uniq_code: toText(record.uniq_code ?? record.uniq ?? record.UniqCode ?? record.Uniq),
    raw_material_type: toText(record.raw_material_type ?? record.category ?? record.type ?? record.RawMaterialType),
    rm_source: toText(record.rm_source ?? record.source ?? record.RMSource),
    warehouse_location: toText(record.warehouse_location ?? record.warehouse_code ?? record.warehouse ?? record.WarehouseLocation),
    uom: toText(record.uom ?? record.unit_measurement ?? record.unit ?? record.UOM),
    stock_qty: toNumber(record.stock_qty ?? record.quantity ?? record.stock ?? record.StockQty),
    stock_weight_kg: toNumber(record.stock_weight_kg ?? record.weight_kg ?? record.weight ?? record.StockWeightKg),
    part_name: toText(record.part_name ?? record.PartName),
    part_number: toText(record.part_number ?? record.part_no ?? record.PartNumber),
    item_name: toText(record.item_name ?? record.name ?? record.ItemName ?? record.Name),
    created_at: toText(record.created_at ?? record.CreatedAt),
    updated_at: toText(record.updated_at ?? record.UpdatedAt),
  };
};

const toInventoryHistoryRecord = (raw: unknown): InventoryHistoryRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: toText(record.id ?? record.ID) ?? toText(record.history_id ?? record.HistoryID) ?? "",
    inventory_id: toText(record.inventory_id ?? record.InventoryID),
    uniq_code: toText(record.uniq_code ?? record.uniq ?? record.UniqCode ?? record.Uniq),
    action: toText(record.action ?? record.Action),
    reason: toText(record.reason ?? record.activity_type ?? record.Reason ?? record.ActivityType),
    qty: toNumber(record.qty ?? record.quantity ?? record.qty_change ?? record.stock_change ?? record.Qty ?? record.Quantity),
    stock_before: toNumber(record.stock_before ?? record.StockBefore),
    stock_after: toNumber(record.stock_after ?? record.qty_after ?? record.StockAfter),
    date_time: toText(record.date_time ?? record.created_at ?? record.updated_at ?? record.DateTime ?? record.CreatedAt ?? record.UpdatedAt),
    created_by: toText(record.created_by ?? record.user_name ?? record.CreatedBy ?? record.UserName),
    reference_number: toText(record.reference_number ?? record.reference_no ?? record.ReferenceNumber ?? record.ReferenceNo),
    kanban_number: toText(record.kanban_number ?? record.KanbanNumber),
    packing_number: toText(record.packing_number ?? record.PackingNumber),
  };
};

const toInventoryIncomingRecord = (raw: unknown): InventoryIncomingRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: toText(record.id ?? record.inventory_id ?? record.ID ?? record.InventoryID) ?? "",
    inventory_id: toText(record.inventory_id ?? record.InventoryID),
    uniq_code: toText(record.uniq_code ?? record.uniq ?? record.UniqCode ?? record.Uniq),
    quantity: toNumber(record.quantity ?? record.Quantity),
    stock_qty: toNumber(record.stock_qty ?? record.quantity ?? record.StockQty ?? record.Quantity),
    weight_kg: toNumber(record.weight_kg ?? record.WeightKg),
    stock_weight_kg: toNumber(record.stock_weight_kg ?? record.weight_kg ?? record.StockWeightKg ?? record.WeightKg),
    uom: toText(record.uom ?? record.unit_measurement ?? record.unit ?? record.UOM),
    warehouse_location: toText(record.warehouse_location ?? record.warehouse_code ?? record.warehouse ?? record.WarehouseLocation),
    supplier_name: toText(record.supplier_name ?? record.SupplierName),
    packing_number: toText(record.packing_number ?? record.PackingNumber),
    reference_number: toText(record.reference_number ?? record.reference_no ?? record.ReferenceNumber ?? record.ReferenceNo),
    date_incoming: toText(record.date_incoming ?? record.created_at ?? record.DateIncoming ?? record.CreatedAt),
    created_at: toText(record.created_at ?? record.CreatedAt),
  };
};

const toInventoryKanbanSummary = (raw: unknown): InventoryKanbanSummary => {
  const record = isRecord(parseObjectResponse<unknown>(raw)) ? (parseObjectResponse<unknown>(raw) as UnknownRecord) : isRecord(raw) ? raw : {};
  return {
    uniq_code: toText(record.uniq_code ?? record.uniq ?? record.UniqCode ?? record.Uniq),
    total_kanban: toNumber(record.total_kanban ?? record.TotalKanban),
    stock_to_complete_kanban: toNumber(
      record.stock_to_complete_kanban ?? record.to_complete_kanban ?? record.StockToCompleteKanban
    ),
    kanban_count: toNumber(record.kanban_count ?? record.KanbanCount),
    stock_days: toNumber(record.stock_days ?? record.StockDays),
    safety_stock_days: toNumber(record.safety_stock_days ?? record.SafetyStockDays),
  };
};

export const inventoryApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getInventoryList: builder.query<ApiResponse<InventoryRecord[]>, { type: InventoryType; page?: number; limit?: number }>({
      query: ({ type, page = 1, limit = 20 }) => ({
        url: `/inventory/${encodeURIComponent(type)}?page=${page}&limit=${limit}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<unknown>(response).map(toInventoryRecord), "Inventory retrieved", parsePagination(response)),
    }),

    getInventoryDetail: builder.query<ApiResponse<InventoryRecord>, { type: InventoryType; id: string | number }>({
      query: ({ type, id }) => ({
        url: `/inventory/${encodeURIComponent(type)}/${encodeURIComponent(String(id))}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(toInventoryRecord(parseObjectResponse<unknown>(response)), "Inventory detail retrieved"),
    }),

    getInventoryHistory: builder.query<
      ApiResponse<InventoryHistoryRecord[]>,
      { type: InventoryType; id: string | number; page?: number; limit?: number }
    >({
      query: ({ type, id, page = 1, limit = 20 }) => ({
        url: `/inventory/${encodeURIComponent(type)}/${encodeURIComponent(String(id))}/history?page=${page}&limit=${limit}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<unknown>(response).map(toInventoryHistoryRecord), "Inventory history retrieved", parsePagination(response)),
    }),

    getInventoryIncoming: builder.query<ApiResponse<InventoryIncomingRecord[]>, { type: InventoryType; page?: number; limit?: number }>({
      query: ({ type, page = 1, limit = 20 }) => ({
        url: `/inventory/${encodeURIComponent(type)}/incoming?page=${page}&limit=${limit}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<unknown>(response).map(toInventoryIncomingRecord), "Inventory incoming retrieved", parsePagination(response)),
    }),

    getInventoryKanbanSummary: builder.query<ApiResponse<InventoryKanbanSummary>, { uniq_code: string }>({
      query: ({ uniq_code }) => ({
        url: `/inventory/kanban-summary?uniq_code=${encodeURIComponent(uniq_code)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(toInventoryKanbanSummary(response), "Inventory kanban summary retrieved"),
    }),

    createInventory: builder.mutation<ApiResponse<InventoryRecord>, { type: InventoryType; body: InventoryMutationRequest }>({
      query: ({ type, body }) => ({
        url: `/inventory/${encodeURIComponent(type)}`,
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(toInventoryRecord(parseObjectResponse<unknown>(response)), "Inventory created"),
    }),

    updateInventory: builder.mutation<
      ApiResponse<InventoryRecord>,
      { type: InventoryType; id: string | number; body: Partial<InventoryMutationRequest> }
    >({
      query: ({ type, id, body }) => ({
        url: `/inventory/${encodeURIComponent(type)}/${encodeURIComponent(String(id))}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(toInventoryRecord(parseObjectResponse<unknown>(response)), "Inventory updated"),
    }),
  }),
});

export const {
  useGetInventoryListQuery,
  useGetInventoryDetailQuery,
  useGetInventoryHistoryQuery,
  useGetInventoryIncomingQuery,
  useGetInventoryKanbanSummaryQuery,
  useCreateInventoryMutation,
  useUpdateInventoryMutation,
} = inventoryApiSlice;
