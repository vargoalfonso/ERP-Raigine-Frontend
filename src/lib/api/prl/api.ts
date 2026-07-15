import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === "object";

const parseArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];

  const unwrapped = unwrapBackendData<unknown>(response);
  if (Array.isArray(unwrapped)) return unwrapped as T[];

  if (!isRecord(response)) return [];
  const data = response.data;
  if (Array.isArray(data)) return data as T[];
  if (isRecord(data) && Array.isArray(data.items)) return data.items as T[];
  if (isRecord(data) && Array.isArray(data.data)) return data.data as T[];

  return [];
};

const parseObjectResponse = <T,>(response: unknown): T | null => {
  const unwrapped = unwrapBackendData<unknown>(response);
  if (isRecord(unwrapped)) return unwrapped as T;

  if (!isRecord(response)) return null;
  const data = response.data;
  if (isRecord(data) && isRecord(data.data)) return data.data as T;
  if (isRecord(data)) return data as T;
  return response as T;
};

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

export type PrlStatus = "active" | "inactive" | string;

export type PrlRecord = {
  id: string;
  row_id?: number;
  prl_id?: string;
  customer_uuid?: string;
  customer_id?: string | number;
  customer_name?: string;
  uniq_code?: string;
  item_uniq_code?: string;
  forecast_period?: string;
  period?: string;
  quantity?: number;
  delivery_quantity?: number;
  status?: PrlStatus;
  approval_status?: string;
  product_model?: string;
  part_name?: string;
  part_number?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  customer?: {
    customer_name?: string;
    code?: string;
  };
  product_details?: {
    description?: string;
    model?: string;
    part_name?: string;
    part_number?: string;
  };
};

export type PrlListRequest = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  forecast_period?: string;
  customer_uuid?: string;
  uniq_code?: string;
};

export type PrlListPagination = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type PrlListResponse = PrlRecord[] & {
  items: PrlRecord[];
  pagination: PrlListPagination;
};

export type PrlType = "additional" | "reguler";

export type CreatePrlRequest = {
  customer_uuid: string;
  uniq_code: string;
  product_model: string;
  part_name: string;
  part_number: string;
  forecast_period: string;
  quantity: number;
  prl_type?: PrlType;
};

export type CreatePrlEntry = {
  customer_uuid: string;
  uniq_code: string;
  product_model?: string;
  part_name?: string;
  part_number?: string;
  forecast_period: string;
  quantity: number;
  prl_type?: PrlType;
  remarks?: string;
};

// Bulk create shares ONE prl_id across all entries (backend groups them into a
// single PRL group), while each entry keeps its own quantity. Must be sent as
// { entries: [...] } so the backend routes it to BulkCreatePRLs.
export type BulkCreatePrlRequest = { entries: CreatePrlEntry[] };

export type UpdatePrlRequest = {
  forecast_period: string;
  quantity: number;
};

export type ImportPrlsResponse = {
  success?: boolean;
  message?: string;
  data?: {
    total_rows?: number;
    inserted?: number;
    updated?: number;
    errors?: unknown[];
  };
};

export type PrlGapStatus = "Under" | "Over" | "On Track" | string;

export type PrlGapRowDto = {
  uniq: string;
  customer_forecast: number;
  actual_delivery: number;
  gap_units: string | number;
  gap_percentage: string;
  status: PrlGapStatus;
};

const normalizePrlRecord = (raw: unknown): PrlRecord => {
  const record = isRecord(raw) ? raw : {};
  const customer = isRecord(record.customer) ? record.customer : undefined;
  const productDetails = isRecord(record.product_details) ? record.product_details : undefined;
  const normalizedCustomerId =
    toText(record.customer_id) ??
    toText(customer?.id) ??
    toText(customer?.customer_id);

  return {
    id: toText(record.id) ?? toText(record.prl_id) ?? "",
    row_id: toNumber(record.row_id),
    prl_id: toText(record.prl_id),
    customer_uuid: toText(record.customer_uuid),
    customer_id: normalizedCustomerId,
    customer_name: toText(record.customer_name) ?? toText(customer?.customer_name),
    uniq_code: toText(record.uniq_code) ?? toText(record.item_uniq_code),
    item_uniq_code: toText(record.item_uniq_code) ?? toText(record.uniq_code),
    forecast_period: toText(record.forecast_period) ?? toText(record.period),
    period: toText(record.period) ?? toText(record.forecast_period),
    quantity: toNumber(record.quantity),
    delivery_quantity: toNumber(record.delivery_quantity),
    status: toText(record.status) ?? toText(record.approval_status),
    approval_status: toText(record.approval_status) ?? toText(record.status),
    product_model:
      toText(record.product_model) ??
      toText(productDetails?.model) ??
      toText(productDetails?.description),
    part_name: toText(record.part_name) ?? toText(productDetails?.part_name),
    part_number: toText(record.part_number) ?? toText(productDetails?.part_number),
    created_by: toText(record.created_by),
    created_at: toText(record.created_at),
    updated_at: toText(record.updated_at),
    customer:
      customer || record.customer_name
        ? {
            customer_name: toText(record.customer_name) ?? toText(customer?.customer_name),
            code: toText(customer?.code),
          }
        : undefined,
    product_details:
      productDetails || record.product_model || record.part_name || record.part_number
        ? {
            description: toText(productDetails?.description) ?? toText(record.product_model),
            model: toText(productDetails?.model) ?? toText(record.product_model),
            part_name: toText(productDetails?.part_name) ?? toText(record.part_name),
            part_number: toText(productDetails?.part_number) ?? toText(record.part_number),
          }
        : undefined,
  };
};

const normalizePrlListResponse = (response: unknown, fallback: PrlListRequest): PrlListResponse => {
  const root = isRecord(response) ? response : {};
  const data = isRecord(root.data) ? root.data : {};
  const items = parseArrayResponse<unknown>(response).map(normalizePrlRecord);
  const pagination = isRecord(data.pagination) ? data.pagination : {};
  const total = toNumber(pagination.total) ?? items.length;
  const page = toNumber(pagination.page) ?? fallback.page;
  const limit = toNumber(pagination.limit) ?? fallback.limit;
  const result = [...items] as PrlListResponse;

  result.items = items;
  result.pagination = {
    total,
    page,
    limit,
    total_pages:
      toNumber(pagination.total_pages) ??
      Math.max(1, Math.ceil((total || items.length) / Math.max(1, limit))),
  };

  return result;
};

const TAG = "PRL" as const;

export const prlApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      listPrls: builder.query<PrlListResponse, PrlListRequest | void>({
        query: (params) => {
          const page = params?.page ?? 1;
          const limit = params?.limit ?? 100;

          return {
          url: "/prls",
          method: "GET",
          params: {
            page,
            limit,
            ...(params?.search ? { search: params.search } : {}),
            ...(params?.status ? { status: params.status } : {}),
            ...(params?.forecast_period ? { forecast_period: params.forecast_period } : {}),
            ...(params?.customer_uuid ? { customer_uuid: params.customer_uuid } : {}),
            ...(params?.uniq_code ? { uniq_code: params.uniq_code } : {}),
          },
          meta: { useAuthorization: true, contentType: "application/json" },
        };
        },
        transformResponse: (response: unknown, _meta, arg) =>
          normalizePrlListResponse(response, {
            page: arg?.page ?? 1,
            limit: arg?.limit ?? 100,
          }),
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: string }> = [{ type: TAG, id: "LIST" }];
          if (!result) return base;
          return base.concat(result.items.filter((item) => item.id).map((item) => ({ type: TAG, id: item.id })));
        },
      }),

      getPrlById: builder.query<PrlRecord, string | number>({
        query: (id) => ({
          url: `/prls/${encodeURIComponent(String(id))}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizePrlRecord(parseObjectResponse<unknown>(response)),
        providesTags: (_result, _error, id) => [{ type: TAG, id: String(id) }],
      }),

      createPrl: builder.mutation<PrlRecord, CreatePrlRequest>({
        query: (body) => ({
          url: "/prls",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizePrlRecord(parseObjectResponse<unknown>(response)),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      createPrlsBulk: builder.mutation<PrlRecord[] | { message?: string }, BulkCreatePrlRequest>({
        query: (body) => ({
          url: "/prls",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const list = parseArrayResponse<unknown>(response).map(normalizePrlRecord);
          if (list.length) return list;
          const obj = parseObjectResponse<{ message?: string }>(response);
          return obj ?? { message: "Created" };
        },
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      updatePrl: builder.mutation<PrlRecord, { id: string | number; body: UpdatePrlRequest }>({
        query: ({ id, body }) => ({
          url: `/prls/${encodeURIComponent(String(id))}`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizePrlRecord(parseObjectResponse<unknown>(response)),
        invalidatesTags: (_result, _error, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(arg.id) },
        ],
      }),

      deletePrl: builder.mutation<{ success?: boolean }, string | number>({
        query: (id) => ({
          url: `/prls/${encodeURIComponent(String(id))}`,
          method: "DELETE",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: (_result, _error, id) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(id) },
        ],
      }),

      importPrls: builder.mutation<ImportPrlsResponse, File>({
        query: (file) => {
          const formData = new FormData();
          formData.append("file", file);

          return {
            url: "/import/prls",
            method: "POST",
            body: formData,
            meta: { useAuthorization: true, contentType: "multipart/form-data" },
          };
        },
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      getPrlGapAnalysis: builder.query<PrlGapRowDto[], void>({
        query: () => ({
          url: "/api/prl/gap-analysis",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const list = unwrapBackendData<PrlGapRowDto[]>(response);
          return Array.isArray(list) ? list : [];
        },
      }),
    }),
    overrideExisting: true,
  });

export const {
  useListPrlsQuery,
  useGetPrlByIdQuery,
  useCreatePrlMutation,
  useCreatePrlsBulkMutation,
  useUpdatePrlMutation,
  useDeletePrlMutation,
  useImportPrlsMutation,
  useGetPrlGapAnalysisQuery,
} = prlApiSlice;

export const useListPrlForecastsQuery = useListPrlsQuery;
