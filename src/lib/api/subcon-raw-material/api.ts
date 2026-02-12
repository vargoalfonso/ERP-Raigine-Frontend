import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

export type BackendSubconRawMaterial = {
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

export type SubconRawMaterialCreateRequest = {
  uniq?: string;
  item_name?: string;
  warehouse_code?: string;
  quantity: number;
  unit_measurement?: string;
  date?: string;
  reference_no?: string;
  notes?: string;
};

export type SubconRawMaterialUpdateRequest = Partial<SubconRawMaterialCreateRequest>;

const ok = <T,>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

export const subconRawMaterialSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllSubconRawMaterial: builder.query<ApiResponse<BackendSubconRawMaterial[]>, { currentPage: number; pageSize: number }>({
      query: ({ currentPage, pageSize }) => ({
        url: `/api/subcon-raw-material?page=${currentPage}&perPage=${pageSize}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const raw = Array.isArray(response) ? (response as BackendSubconRawMaterial[]) : [];
        return ok(raw);
      },
    }),

    createSubconRawMaterial: builder.mutation<ApiResponse<{ id: string }>, SubconRawMaterialCreateRequest>({
      query: (body) => ({
        url: "/api/subcon-raw-material",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok({ id: r?.id ?? "" }, r?.message ?? "Created");
      },
    }),

    deleteSubconRawMaterial: builder.mutation<ApiResponse<{ id: string }>, string>({
      query: (id) => ({
        url: `/api/subcon-raw-material/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok({ id: r?.id ?? "" }, r?.message ?? "Deleted");
      },
    }),

    updateSubconRawMaterial: builder.mutation<
      ApiResponse<{ id: string }>,
      { id: string; body: SubconRawMaterialUpdateRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/subcon-raw-material/${id}`,
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
  useGetAllSubconRawMaterialQuery,
  useCreateSubconRawMaterialMutation,
  useDeleteSubconRawMaterialMutation,
  useUpdateSubconRawMaterialMutation,
} = subconRawMaterialSlice;
