import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

type Pagination = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

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

const getBoolean = (record: UnknownRecord, keys: string[]): boolean | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
};

const normalizePagination = (raw: unknown): Pagination => {
  const record = isRecord(raw) ? raw : {};
  return {
    total: getNumber(record, ["total"]) ?? 0,
    page: getNumber(record, ["page"]) ?? 1,
    limit: getNumber(record, ["limit"]) ?? 20,
    total_pages: getNumber(record, ["total_pages", "totalPages"]) ?? 1,
  };
};

export type ScrapTypeRecord = {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  is_system: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

export type ScrapTypeListResponse = {
  items: ScrapTypeRecord[];
  pagination: Pagination;
};

export type CreateScrapTypeRequest = {
  name: string;
  description: string;
  status: string;
};

export type UpdateScrapTypeRequest = {
  name?: string;
  description?: string;
  status?: string;
};

const toScrapTypeRecord = (raw: unknown): ScrapTypeRecord => {
  const record = isRecord(raw) ? raw : {};
  const rawId = record.id ?? record.uuid;

  return {
    id: rawId != null ? String(rawId) : "",
    code: getString(record, ["code", "type_code", "typeCode"]) ?? "",
    name: getString(record, ["name", "type_name", "typeName"]) ?? "",
    description: getString(record, ["description"]) ?? "",
    status: getString(record, ["status"]) ?? "Active",
    is_system: getBoolean(record, ["is_system", "isSystem"]) ?? false,
    created_by: getString(record, ["created_by", "createdBy"]),
    created_at: getString(record, ["created_at", "createdAt"]),
    updated_at: getString(record, ["updated_at", "updatedAt"]),
  };
};

const normalizeListResponse = (response: unknown): ScrapTypeListResponse => {
  if (!isRecord(response)) {
    return {
      items: [],
      pagination: { total: 0, page: 1, limit: 20, total_pages: 1 },
    };
  }

  const data = isRecord(response.data) ? response.data : response;
  let rawItems: unknown[] = [];
  if (Array.isArray(data)) {
    rawItems = data;
  } else if (Array.isArray((data as UnknownRecord).items)) {
    rawItems = (data as UnknownRecord).items as unknown[];
  } else if (Array.isArray((data as UnknownRecord).data)) {
    rawItems = (data as UnknownRecord).data as unknown[];
  } else if (Array.isArray((response as UnknownRecord).items)) {
    rawItems = (response as UnknownRecord).items as unknown[];
  }

  return {
    items: rawItems.map(toScrapTypeRecord),
    pagination: normalizePagination(isRecord(data) ? data.pagination : undefined),
  };
};

const normalizeObjectResponse = (response: unknown): ScrapTypeRecord => {
  if (!isRecord(response)) return toScrapTypeRecord(response);
  const data = response.data;
  if (isRecord(data) && isRecord(data.data)) return toScrapTypeRecord(data.data);
  if (isRecord(data)) return toScrapTypeRecord(data);
  return toScrapTypeRecord(response);
};

const TAG = "ScrapTypes" as const;

export const scrapTypesApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getScrapTypes: builder.query<ScrapTypeListResponse, { page?: number; limit?: number } | void>({
        query: (params) => ({
          url: "/scrap-types",
          method: "GET",
          params: {
            page: params?.page ?? 1,
            limit: params?.limit ?? 20,
          },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeListResponse(response),
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: string }> = [{ type: TAG, id: "LIST" }];
          if (!result) return base;
          return base.concat(
            result.items
              .map((item) => item.id)
              .filter(Boolean)
              .map((id) => ({ type: TAG, id })),
          );
        },
      }),
      getScrapTypeById: builder.query<ScrapTypeRecord, string | number>({
        query: (id) => ({
          url: `/scrap-types/${encodeURIComponent(String(id))}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeObjectResponse(response),
        providesTags: (_result, _error, id) => [{ type: TAG, id: String(id) }],
      }),
      createScrapType: builder.mutation<ScrapTypeRecord, CreateScrapTypeRequest>({
        query: (body) => ({
          url: "/scrap-types",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeObjectResponse(response),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),
      updateScrapType: builder.mutation<ScrapTypeRecord, { id: string | number; body: UpdateScrapTypeRequest }>({
        query: ({ id, body }) => ({
          url: `/scrap-types/${encodeURIComponent(String(id))}`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeObjectResponse(response),
        invalidatesTags: (_result, _error, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(arg.id) },
        ],
      }),
      deleteScrapType: builder.mutation<{ success?: boolean } | unknown, string | number>({
        query: (id) => ({
          url: `/scrap-types/${encodeURIComponent(String(id))}`,
          method: "DELETE",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: (_result, _error, id) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(id) },
        ],
      }),
    }),
  });

export const {
  useGetScrapTypesQuery,
  useGetScrapTypeByIdQuery,
  useCreateScrapTypeMutation,
  useUpdateScrapTypeMutation,
  useDeleteScrapTypeMutation,
} = scrapTypesApiSlice;
