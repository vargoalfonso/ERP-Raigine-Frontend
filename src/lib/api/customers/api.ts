import { apiSlice } from "@/lib/api/instance";
import {
  emptyBulkOutcome,
  extractBulkOutcome,
  type BulkImportOutcome,
} from "@/lib/utils/excel/bulkImportTypes";

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord => typeof v === "object" && v !== null;

const parseArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (!isRecord(response)) return [];

  const data = response.data;
  if (Array.isArray(data)) return data as T[];

  if (isRecord(data)) {
    if (Array.isArray(data.items)) return data.items as T[];
    if (Array.isArray(data.data)) return data.data as T[];
    if (isRecord(data.data) && Array.isArray((data.data as UnknownRecord).items)) {
      return (data.data as UnknownRecord).items as T[];
    }
  }

  return [];
};

const parseObjectResponse = <T,>(response: unknown): T | null => {
  if (isRecord(response)) {
    const data = response.data;
    if (isRecord(data) && isRecord(data.data)) return data.data as T;
    if (isRecord(data)) return data as T;
  }
  if (isRecord(response)) return response as T;
  return null;
};

// total_pages dari blok `pagination` (top-level, data, atau data.data).
const parseTotalPages = (response: unknown): number | undefined => {
  if (!isRecord(response)) return undefined;
  const candidates = [response, response.data, isRecord(response.data) ? response.data.data : undefined];
  for (const candidate of candidates) {
    if (!isRecord(candidate) || !isRecord(candidate.pagination)) continue;
    const n = Number(candidate.pagination.total_pages ?? candidate.pagination.totalPages);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return undefined;
};

export type CustomerRecord = {
  row_id?: number;
  id?: string | number;
  customer_id?: string;
  customer_code?: string;

  customer_name?: string;
  phone_number?: string;

  shipping_address?: string;

  billing_same_as_shipping?: boolean;
  billing_address?: string | null;

  bank_account?: string | null;
  bank_account_number?: string | null;

  bom_codes?: string[] | null;

  status?: string;

  created_at?: string;
  updated_at?: string;

  [key: string]: unknown;
};

export type CreateCustomerRequest = {
  customer_id?: string;
  customer_name: string;
  phone_number: string;
  shipping_address: string;
  billing_same_as_shipping: boolean;
  billing_address?: string | null;
  bank_account?: string | null;
  bank_account_number?: string | null;
  bom_codes?: string[];
};

export type UpdateCustomerRequest = CreateCustomerRequest;

const TAG = "Customers" as const;

export const customerApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      listCustomers: builder.query<CustomerRecord[], Record<string, unknown> | void>({
        // Backend hanya mengirim 10 customer bila `limit` tidak diisi. Tanpa `limit`
        // eksplisit, ambil SEMUA halaman (10.000/halaman = batas backend); dengan
        // `limit` eksplisit perilaku lama (satu request) dipertahankan.
        queryFn: async (params, _api, _extraOptions, fetchWithBQ) => {
          const meta = { useAuthorization: true, contentType: "application/json" };
          const hasLimit =
            params?.limit !== undefined && params?.limit !== null && String(params.limit) !== "";

          if (hasLimit) {
            const result = await fetchWithBQ({ url: "/customers", method: "GET", params: params ?? undefined, meta });
            if (result.error) return { error: result.error };
            return { data: parseArrayResponse<CustomerRecord>(result.data) };
          }

          const pageSize = 10000;
          const maxPages = 1000;
          const all: CustomerRecord[] = [];
          for (let page = 1; page <= maxPages; page += 1) {
            const result = await fetchWithBQ({
              url: "/customers",
              method: "GET",
              params: { ...(params ?? {}), limit: pageSize, page },
              meta,
            });
            if (result.error) return { error: result.error };
            const rows = parseArrayResponse<CustomerRecord>(result.data);
            all.push(...rows);
            const totalPages = parseTotalPages(result.data);
            if (rows.length === 0) break;
            if (totalPages ? page >= totalPages : rows.length < pageSize) break;
          }
          return { data: all };
        },
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: "LIST" | string | number }> = [
            { type: TAG, id: "LIST" },
          ];
          if (!result) return base;
          return base.concat(
            result
              .map((r) => r.row_id ?? r.id ?? r.customer_id ?? r.customer_code)
              .filter((id): id is string | number => id !== undefined && id !== null)
              .map((id) => ({ type: TAG, id }))
          );
        },
      }),

      createCustomer: builder.mutation<CustomerRecord, CreateCustomerRequest>({
        query: (body) => ({
          url: "/customers",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => (parseObjectResponse<CustomerRecord>(response) ?? {}) as CustomerRecord,
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      /**
       * Bulk import: sends every customer payload in one request to
       * POST /customers/bulk and returns the per-row outcome. On HTTP 207
       * (partial) and 422 (all failed) the envelope is surfaced as an RTK
       * error; the page-level wrapper reads it via extractBulkOutcome.
       */
      bulkImportCustomers: builder.mutation<BulkImportOutcome, CreateCustomerRequest[]>({
        query: (items) => ({
          url: "/customers/bulk",
          method: "POST",
          body: { items },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          extractBulkOutcome(response) ?? emptyBulkOutcome(),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      getCustomerById: builder.query<CustomerRecord, string | number>({
        query: (id) => ({
          url: `/customers/${encodeURIComponent(String(id))}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => (parseObjectResponse<CustomerRecord>(response) ?? {}) as CustomerRecord,
        providesTags: (_res, _err, id) => [{ type: TAG, id }],
      }),

      updateCustomer: builder.mutation<CustomerRecord, { id: string | number; body: UpdateCustomerRequest }>({
        query: ({ id, body }) => ({
          url: `/customers/${encodeURIComponent(String(id))}`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => (parseObjectResponse<CustomerRecord>(response) ?? {}) as CustomerRecord,
        invalidatesTags: (_res, _err, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: arg.id },
        ],
      }),

      deleteCustomer: builder.mutation<{ success: boolean } | unknown, string | number>({
        query: (id) => ({
          url: `/customers/${encodeURIComponent(String(id))}`,
          method: "DELETE",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: (_res, _err, id) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id },
        ],
      }),
    }),
  });

export const {
  useListCustomersQuery,
  useCreateCustomerMutation,
  useBulkImportCustomersMutation,
  useGetCustomerByIdQuery,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
} = customerApiSlice;
