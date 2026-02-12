import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

export type BackendIndirectRawMaterial = {
  id: string;
  uniq?: string;
  item_name?: string;
  warehouse_code?: string;
  quantity?: number;
  unit_measurement?: string;
  date?: string;
  reference_no?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type IndirectRawMaterialCreateRequest = {
  uniq?: string;
  item_name?: string;
  warehouse_code?: string;
  quantity: number;
  unit_measurement?: string;
  date?: string;
  reference_no?: string;
  notes?: string;
};

export type IndirectRawMaterialUpdateRequest = Partial<IndirectRawMaterialCreateRequest>;

const ok = <T,>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

export const indirectRawMaterialSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllIndirectRawMaterial: builder.query<
      ApiResponse<BackendIndirectRawMaterial[]>,
      { currentPage: number; pageSize: number }
    >({
      query: ({ currentPage, pageSize }) => ({
        url: `/api/indirect-raw-material?page=${currentPage}&perPage=${pageSize}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const raw = Array.isArray(response) ? (response as BackendIndirectRawMaterial[]) : [];
        return ok(raw);
      },
    }),

    createIndirectRawMaterial: builder.mutation<ApiResponse<{ id: string }>, IndirectRawMaterialCreateRequest>({
      query: (body) => ({
        url: "/api/indirect-raw-material",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok({ id: r?.id ?? "" }, r?.message ?? "Created");
      },
    }),

    deleteIndirectRawMaterial: builder.mutation<ApiResponse<{ id: string }>, string>({
      query: (id) => ({
        url: `/api/indirect-raw-material/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok({ id: r?.id ?? "" }, r?.message ?? "Deleted");
      },
    }),

    updateIndirectRawMaterial: builder.mutation<
      ApiResponse<{ id: string }>,
      { id: string; body: IndirectRawMaterialUpdateRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/indirect-raw-material/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok({ id: r?.id ?? "" }, r?.message ?? "Updated");
      },
    }),
  }),
});

export const {
  useGetAllIndirectRawMaterialQuery,
  useCreateIndirectRawMaterialMutation,
  useDeleteIndirectRawMaterialMutation,
  useUpdateIndirectRawMaterialMutation,
} = indirectRawMaterialSlice;
