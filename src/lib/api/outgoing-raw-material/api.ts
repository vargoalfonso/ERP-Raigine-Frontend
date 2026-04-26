import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const getString = (record: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
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

const normalizeObjectResponse = <T,>(response: unknown): T | null => {
  if (!isRecord(response)) return null;
  const data = response.data;
  if (isRecord(data)) return data as T;
  return null;
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
      total_pages:
        getNumber(paginationRecord, ["total_pages", "totalPages"]) ?? empty.pagination.total_pages,
    },
  };
};

export type OutgoingRawMaterial = {
  id: number;
  transaction_id: string;
  transaction_date: string;
  uniq: string;
  rm_name: string;
  packing_list_rm: string;
  unit: string;
  quantity_out: number;
  stock_before: number;
  stock_after: number;
  reason: string;
  purpose: string;
  work_order_no: string;
  destination_location: string;
  requested_by: string;
  remarks: string;
  created_at: string;
};

export type GetOutgoingRawMaterialsParams = { page: number; limit: number };

export type CreateOutgoingRawMaterialRequest = {
  packing_list_rm: string;
  uniq: string;
  unit: string;
  quantity_out: number;
  reason: string;
  purpose?: string;
  work_order_no?: string;
  destination_location?: string;
  requested_by?: string;
  remarks?: string;
};

const toOutgoingRawMaterial = (raw: unknown): OutgoingRawMaterial => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: getNumber(record, ["id"]) ?? 0,
    transaction_id: getString(record, ["transaction_id", "transactionId"]) ?? "",
    transaction_date: getString(record, ["transaction_date", "transactionDate"]) ?? "",
    uniq: getString(record, ["uniq"]) ?? "",
    rm_name: getString(record, ["rm_name", "item_name", "rmName"]) ?? "",
    packing_list_rm: getString(record, ["packing_list_rm", "packingListRm"]) ?? "",
    unit: getString(record, ["unit", "unit_measurement", "unitMeasurement"]) ?? "",
    quantity_out: getNumber(record, ["quantity_out", "quantityOut", "quantity"]) ?? 0,
    stock_before: getNumber(record, ["stock_before", "stockBefore"]) ?? 0,
    stock_after: getNumber(record, ["stock_after", "stockAfter"]) ?? 0,
    reason: getString(record, ["reason"]) ?? "",
    purpose: getString(record, ["purpose"]) ?? "",
    work_order_no: getString(record, ["work_order_no", "workOrderNo"]) ?? "",
    destination_location: getString(record, ["destination_location", "destinationLocation"]) ?? "",
    requested_by: getString(record, ["requested_by", "requestedBy"]) ?? "",
    remarks: getString(record, ["remarks"]) ?? "",
    created_at: getString(record, ["created_at", "createdAt"]) ?? "",
  };
};

export const outgoingRawMaterialSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getOutgoingRawMaterials: builder.query<Paginated<OutgoingRawMaterial>, GetOutgoingRawMaterialsParams>({
      query: ({ page, limit }) => ({
        url: "/outgoing-raw-materials",
        method: "GET",
        params: { page, limit },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const normalized = normalizePaginatedResponse<unknown>(response);
        return {
          items: normalized.items.map(toOutgoingRawMaterial),
          pagination: normalized.pagination,
        };
      },
    }),

    getOutgoingRawMaterialById: builder.query<OutgoingRawMaterial, { id: number }>({
      query: ({ id }) => ({
        url: `/outgoing-raw-materials/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        toOutgoingRawMaterial(normalizeObjectResponse<unknown>(response) ?? response),
    }),

    createOutgoingRawMaterial: builder.mutation<OutgoingRawMaterial, CreateOutgoingRawMaterialRequest>({
      query: (body) => ({
        url: "/outgoing-raw-materials",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        toOutgoingRawMaterial(normalizeObjectResponse<unknown>(response) ?? response),
    }),
  }),
});

export const {
  useGetOutgoingRawMaterialsQuery,
  useGetOutgoingRawMaterialByIdQuery,
  useCreateOutgoingRawMaterialMutation,
} = outgoingRawMaterialSlice;
