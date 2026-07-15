import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null;

const ok = <T>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

const parseObjectResponse = <T>(response: unknown): T | null => {
  if (isRecord(response)) {
    const d = response.data;
    if (isRecord(d)) return d as T;
    if (isRecord(d) && isRecord(d.data)) return d.data as T;
  }
  if (isRecord(response)) return response as T;
  return null;
};

type Pagination = {
  page: number;
  limit: number;
  total?: number;
};

export type ProductReturnListParams = {
  page?: number;
  limit?: number;
};

export type ProductReturnListData = {
  items: BackendProductReturn[];
  pagination: Pagination;
};

const parsePagination = (
  response: unknown,
  fallback: { page: number; limit: number },
): Pagination => {
  const base: Pagination = { page: fallback.page, limit: fallback.limit };
  if (!isRecord(response)) return base;

  const d = response.data;
  const candidates = [response, d, isRecord(d) ? d.data : null].filter(
    Boolean,
  ) as UnknownRecord[];

  const pickNum = (...vals: unknown[]): number | undefined => {
    for (const v of vals) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim() && Number.isFinite(Number(v)))
        return Number(v);
    }
    return undefined;
  };

  for (const c of candidates) {
    const page = pickNum(c.page, c.current_page, c.currentPage);
    const limit = pickNum(
      c.limit,
      c.per_page,
      c.perPage,
      c.page_size,
      c.pageSize,
    );
    const total = pickNum(c.total, c.total_items, c.totalItems, c.count);

    if (typeof page === "number") base.page = page;
    if (typeof limit === "number") base.limit = limit;
    if (typeof total === "number") base.total = total;
  }

  return base;
};

const parseListItems = <T>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (!isRecord(response)) return [];

  const d = response.data;
  if (Array.isArray(d)) return d as T[];
  if (isRecord(d)) {
    if (Array.isArray(d.items)) return d.items as T[];
    if (Array.isArray(d.data)) return d.data as T[];
    if (isRecord(d.data)) {
      if (Array.isArray(d.data.items)) return d.data.items as T[];
      if (Array.isArray(d.data.data)) return d.data.data as T[];
    }
  }

  if (Array.isArray(response.items)) return response.items as T[];
  return [];
};

export type BackendProductReturn = {
  id?: string | number;
  uuid?: string;
  return_id?: string;
  returnId?: string;

  date?: string;
  created_at?: string;
  createdAt?: string;
  date_received?: string;
  dateReceived?: string;

  part_no?: string;
  partNo?: string;
  part_number?: string;
  partNumber?: string;

  part_name?: string;
  partName?: string;

  kanban?: string;
  packing_number?: string;
  packingNumber?: string;
  uniq_id?: string;
  uniqId?: string;
  uniq?: string;

  model?: string;
  dn_number?: string;
  dnNumber?: string;

  scrap_type?: string;
  scrapType?: string;

  scrap_qty?: number;
  scrapQty?: number;
  scrap_quantity?: number;
  quantity_scrap?: number;

  rework_qty?: number;
  reworkQty?: number;
  rework_quantity?: number;
  quantity_rework?: number;

  weight?: number;
  unit?: string;
  uom?: string;
  submitted_by?: string;
  submittedBy?: string;

  status?: string;
  notes?: string;
  remark?: string;
};

export type UpsertProductReturnRequest = {
  uniq: string;
  dn_number: string;
  quantity_scrap: number;
  quantity_rework: number;
  status: string;
  // BRD fields
  date_received?: string; // format "YYYY-MM-DD"
  scrap_type?: string; // default "Product Return"
  weight?: number;
  uom?: string;
};

export type UpdateProductReturnRequest = {
  id: string | number;
  body: UpsertProductReturnRequest;
};

export const productReturnSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProductReturnList: builder.query<
      ApiResponse<ProductReturnListData>,
      ProductReturnListParams | void
    >({
      query: (params) => {
        const page =
          typeof params?.page === "number" && params.page > 0 ? params.page : 1;
        const limit =
          typeof params?.limit === "number" && params.limit > 0
            ? params.limit
            : 10;
        return {
          url: "/product-return",
          method: "GET",
          params: { page, limit },
          meta: { useAuthorization: true, contentType: "application/json" },
        };
      },
      transformResponse: (response: unknown, _meta, arg) => {
        const page =
          typeof arg?.page === "number" && arg.page > 0 ? arg.page : 1;
        const limit =
          typeof arg?.limit === "number" && arg.limit > 0 ? arg.limit : 10;
        return ok({
          items: parseListItems<BackendProductReturn>(response),
          pagination: parsePagination(response, { page, limit }),
        });
      },
      providesTags: (result) => {
        const base = [{ type: "ProductReturns" as const, id: "LIST" }];
        const ids = (result?.data.items ?? [])
          .map((it) =>
            typeof it.id === "number" || typeof it.id === "string"
              ? String(it.id)
              : "",
          )
          .filter(Boolean)
          .map((id) => ({ type: "ProductReturns" as const, id }));
        return [...base, ...ids];
      },
    }),

    getProductReturnDetail: builder.query<
      ApiResponse<BackendProductReturn>,
      string | number
    >({
      query: (id) => ({
        url: `/product-return/${encodeURIComponent(String(id))}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        ok(
          (parseObjectResponse<BackendProductReturn>(response) ??
            {}) as BackendProductReturn,
        ),
      providesTags: (_result, _error, id) => [
        { type: "ProductReturns", id: String(id) },
      ],
    }),

    createProductReturn: builder.mutation<
      ApiResponse<BackendProductReturn>,
      UpsertProductReturnRequest
    >({
      query: (body) => ({
        url: "/product-return",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        ok(
          (parseObjectResponse<BackendProductReturn>(response) ??
            {}) as BackendProductReturn,
          "Created",
        ),
      invalidatesTags: [{ type: "ProductReturns", id: "LIST" }],
    }),

    updateProductReturn: builder.mutation<
      ApiResponse<BackendProductReturn>,
      UpdateProductReturnRequest
    >({
      query: ({ id, body }) => ({
        url: `/product-return/${encodeURIComponent(String(id))}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        ok(
          (parseObjectResponse<BackendProductReturn>(response) ??
            {}) as BackendProductReturn,
          "Updated",
        ),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ProductReturns", id: "LIST" },
        { type: "ProductReturns", id: String(id) },
      ],
    }),

    deleteProductReturn: builder.mutation<
      ApiResponse<{ id: string }>,
      string | number
    >({
      query: (id) => ({
        url: `/product-return/${encodeURIComponent(String(id))}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (_response: unknown, _meta, id) =>
        ok({ id: String(id) }, "Deleted"),
      invalidatesTags: (_result, _error, id) => [
        { type: "ProductReturns", id: "LIST" },
        { type: "ProductReturns", id: String(id) },
      ],
    }),

    scanProductReturn: builder.mutation<
      ApiResponse<any>,
      string
    >({
      query: (qrCodeValue) => ({
        url: "/action-ui/qc-return/scan",
        method: "POST",
        body: { qr_code_value: qrCodeValue },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        ok((parseObjectResponse<any>(response) ?? {}) as any, "Scanned"),
    }),
  }),
});

export const {
  useGetProductReturnListQuery,
  useGetProductReturnDetailQuery,
  useCreateProductReturnMutation,
  useUpdateProductReturnMutation,
  useDeleteProductReturnMutation,
  useScanProductReturnMutation,
} = productReturnSlice;
