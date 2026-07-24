import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord => typeof v === "object" && v !== null;

const parseArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (isRecord(response)) {
    const d = response.data;
    if (Array.isArray(d)) return d as T[];
    if (isRecord(d)) {
      if (Array.isArray(d.items)) return d.items as T[];
      if (Array.isArray(d.data)) return d.data as T[];
      if (isRecord(d.data) && Array.isArray((d.data as UnknownRecord).items)) {
        return (d.data as UnknownRecord).items as T[];
      }
    }
  }
  return [];
};

const parseObjectResponse = <T,>(response: unknown): T | null => {
  if (isRecord(response)) {
    const d = response.data;
    if (isRecord(d) && isRecord(d.data)) return d.data as T;
    if (isRecord(d)) return d as T;
  }
  if (isRecord(response)) return response as T;
  return null;
};

const parseNextCode = (response: unknown): string => {
  if (typeof response === "string") return response;
  if (!isRecord(response)) return "";

  const direct = response.next_code ?? response.nextCode ?? response.code;
  if (typeof direct === "string") return direct;

  const d = response.data;
  if (typeof d === "string") return d;
  if (isRecord(d)) {
    const nested = d.next_code ?? d.nextCode ?? d.code ?? d.supplier_code;
    if (typeof nested === "string") return nested;
  }

  return "";
};

export type SupplierStatus = "Active" | "Inactive";

export type SupplierRecord = {
  row_id?: number;
  id?: string | number;
  supplier_code?: string;
  supplier_name?: string;

  contact_person?: string;
  contact_number?: string;
  email_address?: string;

  material_category?: string;

  full_address?: string;
  city?: string;
  province?: string;
  country?: string;

  tax_id_npwp?: string;

  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;

  payment_terms?: string;
  delivery_lead_time_days?: number;

  status?: SupplierStatus | string;

  [key: string]: unknown;
};

export type CreateSupplierRequest = {
  supplier_code?: string;
  supplier_name: string;
  contact_person?: string;
  contact_number?: string;
  email_address?: string;
  material_category?: string;
  full_address?: string;
  city?: string;
  province?: string;
  country?: string;
  tax_id_npwp?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  payment_terms?: string;
  delivery_lead_time_days?: number;
  status?: SupplierStatus | string;
};

export type UpdateSupplierPutRequest = {
  contact_person?: string;
  delivery_lead_time_days?: number;
  [key: string]: unknown;
};

export type EditSupplierPatchRequest = {
  status?: SupplierStatus | string;
  [key: string]: unknown;
};

export type ListSuppliersParams = {
  material_category?: string;
  status?: string;
  search?: string;
  uniq_code?: string;
  limit?: number;
  page?: number;
};

const buildQueryString = (params: Record<string, string | undefined>): string => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
};

const TAG = "Suppliers" as const;

export const supplierApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getNextSupplierCode: builder.query<string, void>({
        query: () => ({
          url: "/suppliers/next-code",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => parseNextCode(response),
      }),

      listSuppliers: builder.query<SupplierRecord[], ListSuppliersParams | void>({
        query: (params) => ({
          url: `/suppliers${buildQueryString({
            material_category: params?.material_category,
            status: params?.status,
            search: params?.search,
            uniq_code: params?.uniq_code,
            limit: params?.limit !== undefined ? String(params.limit) : undefined,
          })}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => parseArrayResponse<SupplierRecord>(response),
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: "LIST" | string | number }> = [
            { type: TAG, id: "LIST" },
          ];
          if (!result) return base;
          return base.concat(
            result
              .map((r) => r.id ?? r.supplier_code)
              .filter((id): id is string | number => id !== undefined && id !== null)
              .map((id) => ({ type: TAG, id }))
          );
        },
      }),

      createSupplier: builder.mutation<SupplierRecord, CreateSupplierRequest>({
        query: (body) => ({
          url: "/suppliers",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => (parseObjectResponse<SupplierRecord>(response) ?? {}) as SupplierRecord,
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      getSupplierById: builder.query<SupplierRecord, string | number>({
        query: (id) => ({
          url: `/suppliers/${encodeURIComponent(String(id))}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => (parseObjectResponse<SupplierRecord>(response) ?? {}) as SupplierRecord,
        providesTags: (_res, _err, id) => [{ type: TAG, id }],
      }),

      updateSupplier: builder.mutation<SupplierRecord, { id: string | number; body: UpdateSupplierPutRequest }>({
        query: ({ id, body }) => ({
          url: `/suppliers/${encodeURIComponent(String(id))}`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => (parseObjectResponse<SupplierRecord>(response) ?? {}) as SupplierRecord,
        invalidatesTags: (_res, _err, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: arg.id },
        ],
      }),

      editSupplier: builder.mutation<SupplierRecord, { id: string | number; body: EditSupplierPatchRequest }>({
        query: ({ id, body }) => ({
          url: `/suppliers/${encodeURIComponent(String(id))}`,
          method: "PATCH",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => (parseObjectResponse<SupplierRecord>(response) ?? {}) as SupplierRecord,
        invalidatesTags: (_res, _err, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: arg.id },
        ],
      }),

      deleteSupplier: builder.mutation<{ success: boolean } | unknown, string | number>({
        query: (id) => ({
          url: `/suppliers/${encodeURIComponent(String(id))}`,
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
  useGetNextSupplierCodeQuery,
  useListSuppliersQuery,
  useCreateSupplierMutation,
  useGetSupplierByIdQuery,
  useUpdateSupplierMutation,
  useEditSupplierMutation,
  useDeleteSupplierMutation,
} = supplierApiSlice;
