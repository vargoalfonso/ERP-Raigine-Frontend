import { apiSlice } from "@/lib/api/instance";

export type MasterSupplierRecord = {
  id?: string | number;
  supplier_code?: string;
  supplier_name?: string;
  status?: string;

  // Item-ish fields (based on provided payload)
  sebango?: string;
  customer_cycle?: string;
  quantity?: number;
  type?: string;
  description?: string;

  // Allow backend to add extra fields without breaking
  [key: string]: unknown;
};

export type MasterSupplierCreateRequest = {
  supplier_code: string;
  supplier_name: string;
  sebango: string;
  customer_cycle: string;
  quantity: number;
  type: string;
  description: string;
};

const normalizeArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === "object") {
    const maybeData = (response as Record<string, unknown>).data;
    if (Array.isArray(maybeData)) return maybeData as T[];
  }
  return [];
};

const normalizeObjectResponse = <T,>(response: unknown): T => {
  if (response && typeof response === "object") {
    const maybeData = (response as Record<string, unknown>).data;
    if (maybeData && typeof maybeData === "object") return maybeData as T;
  }
  return response as T;
};

const TAG = "MasterSuppliers" as const;

export const masterSupplierApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      listMasterSuppliers: builder.query<MasterSupplierRecord[], void>({
        query: () => ({
          url: "/api/master-suppliers",
          method: "GET",
          meta: {
            useAuthorization: true,
            contentType: "application/json",
          },
        }),
        transformResponse: (response: unknown) =>
          normalizeArrayResponse<MasterSupplierRecord>(response),
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

      createMasterSupplier: builder.mutation<MasterSupplierRecord, MasterSupplierCreateRequest>({
        query: (body) => ({
          url: "/api/master-suppliers",
          method: "POST",
          body,
          meta: {
            useAuthorization: true,
            contentType: "application/json",
          },
        }),
        transformResponse: (response: unknown) =>
          normalizeObjectResponse<MasterSupplierRecord>(response),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

    updateMasterSupplier: builder.mutation<
      MasterSupplierRecord,
      { id: string | number; body: Partial<MasterSupplierCreateRequest> & Record<string, unknown> }
    >({
      query: ({ id, body }) => ({
        url: `/api/master-suppliers/${id}`,
        method: "PUT",
        body,
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) =>
        normalizeObjectResponse<MasterSupplierRecord>(response),
      invalidatesTags: (_res, _err, arg) => [
        { type: TAG, id: "LIST" },
        { type: TAG, id: arg.id },
      ],
    }),

    deleteMasterSupplier: builder.mutation<{ success: boolean } | unknown, string | number>({
      query: (id) => ({
        url: `/api/master-suppliers/${id}`,
        method: "DELETE",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      invalidatesTags: (_res, _err, id) => [
        { type: TAG, id: "LIST" },
        { type: TAG, id },
      ],
    }),
  }),
});

export const {
  useListMasterSuppliersQuery,
  useCreateMasterSupplierMutation,
  useUpdateMasterSupplierMutation,
  useDeleteMasterSupplierMutation,
} = masterSupplierApiSlice;
