import { apiSlice } from "@/lib/api/instance";

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
      listCustomers: builder.query<CustomerRecord[], void>({
        query: () => ({
          url: "/customers",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => parseArrayResponse<CustomerRecord>(response),
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
  useGetCustomerByIdQuery,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
} = customerApiSlice;
