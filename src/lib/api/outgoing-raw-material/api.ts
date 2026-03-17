import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

export type BackendOutgoingRawMaterial = {
  id: string;
  uniq?: string;
  item_name?: string;
  issued_to?: string;
  destination?: string;
  destination_location?: string;
  warehouse_code?: string;
  packing_list_rm?: string;
  reason?: string;
  purpose?: string;
  work_order_no?: string;
  requested_by?: string;
  transaction_id?: string;
  quantity?: number;
  unit_measurement?: string;
  weight?: number;
  stock_after?: number;
  date?: string;
  reference_no?: string;
  notes?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
};

export type OutgoingRawMaterialCreateRequest = {
  uniq?: string;
  item_name?: string;
  issued_to?: string;
  destination?: string;
  destination_location?: string;
  warehouse_code?: string;
  packing_list_rm?: string;
  reason?: string;
  purpose?: string;
  work_order_no?: string;
  requested_by?: string;
  transaction_id?: string;
  quantity: number;
  weight?: number;
  unit_measurement?: string;
  stock_after?: number;
  date?: string;
  reference_no?: string;
  notes?: string;
  remarks?: string;
};

export type OutgoingRawMaterialUpdateRequest = Partial<OutgoingRawMaterialCreateRequest>;

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object";

const pickArray = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (isRecord(response) && Array.isArray((response as Record<string, unknown>).data)) {
    return (response as { data: T[] }).data;
  }
  return [];
};

const pickIdMessage = (response: unknown): { id: string; message?: string } => {
  if (isRecord(response)) {
    const id = typeof response.id === "string" ? response.id : "";
    const message = typeof response.message === "string" ? response.message : undefined;
    if (id || message) return { id, message };

    const data = (response as Record<string, unknown>).data;
    if (isRecord(data)) {
      return {
        id: typeof data.id === "string" ? data.id : "",
        message: typeof (data as Record<string, unknown>).message === "string" ? (data as Record<string, unknown>).message as string : undefined,
      };
    }
  }
  return { id: "" };
};

const ok = <T,>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

export const outgoingRawMaterialSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllOutgoingRawMaterial: builder.query<
      ApiResponse<BackendOutgoingRawMaterial[]>,
      { currentPage: number; pageSize: number }
    >({
      query: ({ currentPage, pageSize }) => ({
        url: `/api/outgoing-raw-material?page=${currentPage}&perPage=${pageSize}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const raw = pickArray<BackendOutgoingRawMaterial>(response);
        return ok(raw);
      },
    }),

    createOutgoingRawMaterial: builder.mutation<ApiResponse<{ id: string }>, OutgoingRawMaterialCreateRequest>({
      query: (body) => ({
        url: "/api/outgoing-raw-material",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = pickIdMessage(response);
        return ok({ id: r.id ?? "" }, r.message ?? "Created");
      },
    }),

    deleteOutgoingRawMaterial: builder.mutation<ApiResponse<{ id: string }>, string>({
      query: (id) => ({
        url: `/api/outgoing-raw-material/${id}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = pickIdMessage(response);
        return ok({ id: r.id ?? "" }, r.message ?? "Deleted");
      },
    }),

    updateOutgoingRawMaterial: builder.mutation<
      ApiResponse<{ id: string }>,
      { id: string; body: OutgoingRawMaterialUpdateRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/outgoing-raw-material/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = pickIdMessage(response);
        return ok({ id: r.id ?? "" }, r.message ?? "Updated");
      },
    }),

    editOutgoingRawMaterial: builder.mutation<
      ApiResponse<{ id: string }>,
      { id: string; body: Partial<OutgoingRawMaterialCreateRequest> }
    >({
      query: ({ id, body }) => ({
        url: `/api/outgoing-raw-material/${id}`,
        method: "PATCH",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = pickIdMessage(response);
        return ok({ id: r.id ?? "" }, r.message ?? "Updated");
      },
    }),
  }),
});

export const {
  useGetAllOutgoingRawMaterialQuery,
  useCreateOutgoingRawMaterialMutation,
  useDeleteOutgoingRawMaterialMutation,
  useUpdateOutgoingRawMaterialMutation,
  useEditOutgoingRawMaterialMutation,
} = outgoingRawMaterialSlice;
