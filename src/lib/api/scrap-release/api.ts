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

const getNullableNumber = (
  record: UnknownRecord,
  keys: string[],
): number | null => {
  const v = getNumber(record, keys);
  return v == null ? null : v;
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

export type ScrapReleaseRecord = {
  id: number;
  uuid: string;
  release_number: string;
  scrap_stock_id: number;
  release_date: string;
  release_type: string;
  release_qty: number;
  weight_released: number | null;
  customer_name: string | null;
  price_per_unit: number | null;
  price_per_kg: number | null;
  items: ScrapReleaseLineRecord[];
  total_value: number | null;
  disposal_reason: string | null;
  approval_status: string;
  validator: string | null;
  approver: string | null;
  approved_by: string | null;
  approved_at: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ScrapReleaseCreateRequest = {
  scrap_stock_id: number;
  release_date: string; // YYYY-MM-DD
  release_type: string;
  release_qty: number;
  // CART-RELEASE-V1: multi-item cart lines
  items?: { scrap_stock_id: number; release_qty: number }[];
  // CART-RELEASE-V1: total weight + price per kg (sale calc)
  weight_kg?: number | null;
  price_per_kg?: number | null;
  customer_name: string;
  price_per_unit?: number;
  remarks: string | null;
  disposal_reason: string; // dump|sell|inventory
  approver?: string;
};

export type ScrapReleaseLineRecord = {
  scrap_stock_id: number;
  uniq: string | null;
  part_name: string | null;
  release_qty: number;
};

const mapScrapReleaseLines = (raw: unknown): ScrapReleaseLineRecord[] => {
  const record = isRecord(raw) ? raw : {};
  const list = record["items"];
  if (!Array.isArray(list)) return [];
  return list.map((it) => {
    const r = isRecord(it) ? it : {};
    return {
      scrap_stock_id: getNumber(r, ["scrap_stock_id", "scrapStockId"]) ?? 0,
      uniq: getString(r, ["uniq"]) ?? null,
      part_name: getString(r, ["part_name", "partName"]) ?? null,
      release_qty: getNumber(r, ["release_qty", "releaseQty"]) ?? 0,
    };
  });
};

const toScrapReleaseRecord = (raw: unknown): ScrapReleaseRecord => {
  const record = isRecord(raw) ? raw : {};

  return {
    id: getNumber(record, ["id"]) ?? 0,
    uuid: getString(record, ["uuid"]) ?? "",
    release_number:
      getString(record, ["release_number", "releaseNumber"]) ?? "",
    scrap_stock_id: getNumber(record, ["scrap_stock_id", "scrapStockId"]) ?? 0,
    release_date: getString(record, ["release_date", "releaseDate"]) ?? "",
    release_type: getString(record, ["release_type", "releaseType"]) ?? "",
    release_qty: getNumber(record, ["release_qty", "releaseQty"]) ?? 0,
    weight_released: getNullableNumber(record, [
      "weight_released",
      "weightReleased",
    ]),
    customer_name: getString(record, ["customer_name", "customerName"]) ?? null,
    price_per_unit: getNullableNumber(record, [
      "price_per_unit",
      "pricePerUnit",
    ]),
    price_per_kg: getNullableNumber(record, ["price_per_kg", "pricePerKg"]),
    items: mapScrapReleaseLines(record),
    total_value: getNullableNumber(record, ["total_value", "totalValue"]),
    disposal_reason:
      getString(record, ["disposal_reason", "scrap_reason"]) ?? null,
    approval_status:
      getString(record, ["approval_status", "approvalStatus", "status"]) ?? "",
    validator: getString(record, ["validator"]) ?? null,
    approver: getString(record, ["approver"]) ?? null,
    approved_by: getString(record, ["approved_by", "approvedBy"]) ?? null,
    approved_at: getString(record, ["approved_at", "approvedAt"]) ?? null,
    remarks: getString(record, ["remarks"]) ?? null,
    created_by: getString(record, ["created_by", "createdBy"]) ?? null,
    created_at: getString(record, ["created_at", "createdAt"]) ?? null,
    updated_at: getString(record, ["updated_at", "updatedAt"]) ?? null,
  };
};

export const scrapReleaseSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getScrapReleases: builder.query<
      Paginated<ScrapReleaseRecord>,
      { page: number; limit: number }
    >({
      query: ({ page, limit }) => ({
        url: "/scrap-releases",
        method: "GET",
        params: { page, limit },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const normalized = normalizePaginatedResponse<unknown>(response);
        return {
          items: normalized.items.map(toScrapReleaseRecord),
          pagination: normalized.pagination,
        };
      },
    }),

    // Some environments expose list under singular path (/scrap-release). Keep as a fallback.
    getScrapReleasesLegacy: builder.query<
      Paginated<ScrapReleaseRecord>,
      { page: number; limit: number }
    >({
      query: ({ page, limit }) => ({
        url: "/scrap-release",
        method: "GET",
        params: { page, limit },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const normalized = normalizePaginatedResponse<unknown>(response);
        return {
          items: normalized.items.map(toScrapReleaseRecord),
          pagination: normalized.pagination,
        };
      },
    }),

    getScrapReleaseById: builder.query<ScrapReleaseRecord, string>({
      query: (id) => ({
        url: `/scrap-releases/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        toScrapReleaseRecord(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
    }),

    createScrapRelease: builder.mutation<
      ScrapReleaseRecord,
      ScrapReleaseCreateRequest
    >({
      query: (body) => ({
        url: "/scrap-releases",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        toScrapReleaseRecord(
          normalizeObjectResponse<unknown>(response) ?? response,
        ),
    }),
    approveScrapRelease: builder.mutation<
      { success?: boolean } | unknown,
      {
        id: number | string;
        action: "Completed" | "Rejected";
        remarks?: string | null;
      }
    >({
      query: ({ id, action, remarks }) => ({
        url: `/scrap-releases/${encodeURIComponent(String(id))}/approve`,
        method: "PUT",
        body: { action, remarks: remarks ?? null },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),
  }),
});

export const {
  useGetScrapReleasesQuery,
  useGetScrapReleasesLegacyQuery,
  useGetScrapReleaseByIdQuery,
  useCreateScrapReleaseMutation,
  useApproveScrapReleaseMutation
} = scrapReleaseSlice;
