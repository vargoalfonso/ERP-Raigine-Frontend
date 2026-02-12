import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

export type BackendScrapStock = {
  id: string;
  uniq?: string;
  item_name?: string;
  part_number?: string;
  packing_number?: string;
  date_received?: string;
  scrap_type?: string;
  scrap_qty?: number;
  validator?: string;
  quantity?: number;
  weight?: number;
  unit_measurement?: string;
  reasons?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type ScrapStockCreateRequest = {
  uniq?: string;
  item_name?: string;
  part_number?: string;
  packing_number: string;
  date_received: string;
  scrap_type: string;
  scrap_qty?: number;
  validator?: string;
  quantity: number;
  weight?: number;
  unit_measurement?: string;
  reasons?: string;
  notes?: string;
};

export type ScrapStockUpdateRequest = Partial<ScrapStockCreateRequest>;

const normalizeArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === "object") {
    const maybeData = (response as Record<string, unknown>).data;
    if (Array.isArray(maybeData)) return maybeData as T[];
  }
  return [];
};

const ok = <T,>(
  data: T,
  message = "OK",
  pagination?: ApiResponse<T>["pagination"]
): ApiResponse<T> => ({
  message,
  status: "success",
  data,
  pagination,
});

export const scrapStockSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getScrapStockById: builder.query<ApiResponse<BackendScrapStock>, string>({
      query: (id) => ({
        url: `/api/scrap-stock/${id}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const item = response as BackendScrapStock;
        return ok(item);
      },
    }),

    getAllScrapStock: builder.query<
      ApiResponse<BackendScrapStock[]>,
      { currentPage: number; pageSize: number }
    >({
      query: ({ currentPage, pageSize }) => ({
        url: `/api/scrap-stock?page=${currentPage}&perPage=${pageSize}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown, _meta, arg) => {
        const raw = normalizeArrayResponse<BackendScrapStock>(response);
        const total = raw.length;
        const perPage = arg.pageSize;
        const page = arg.currentPage;
        const totalPages = perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;
        return ok(raw, "OK", { total, page, perPage, totalPages });
      },
    }),

    createScrapStock: builder.mutation<ApiResponse<{ id: string }>, ScrapStockCreateRequest>({
      query: (body) => ({
        url: "/api/scrap-stock",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok({ id: r?.id ?? "" }, r?.message ?? "Created");
      },
    }),

    updateScrapStock: builder.mutation<
      ApiResponse<{ id: string }>,
      { id: string; body: ScrapStockUpdateRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/scrap-stock/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok({ id: r?.id ?? "" }, r?.message ?? "Updated");
      },
    }),

    deleteScrapStock: builder.mutation<ApiResponse<{ id: string }>, string>({
      query: (id) => ({
        url: `/api/scrap-stock/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok({ id: r?.id ?? "" }, r?.message ?? "Deleted");
      },
    }),
  }),
});

export const {
  useGetAllScrapStockQuery,
  useGetScrapStockByIdQuery,
  useCreateScrapStockMutation,
  useUpdateScrapStockMutation,
  useDeleteScrapStockMutation,
} = scrapStockSlice;
