import { apiSlice } from "@/lib/api/instance";
import { ApiResponse, DataArray, DataObject } from "@/types";
import { FinishedGoodsRecord } from "./interface";

export const finishedGoodSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAll: builder.query<
      ApiResponse<DataArray<FinishedGoodsRecord>>,
      { currentPage: number; pageSize: number }
    >({
      query: ({ currentPage, pageSize }) => ({
        url: `/finished-good/?page=${currentPage}&perPage=${pageSize}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),
    getOneById: builder.query<
      ApiResponse<DataObject<FinishedGoodsRecord>>,
      string
    >({
      query: (id) => ({
        url: `/finished-good/${id}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),
    create: builder.mutation<
      ApiResponse<DataObject<FinishedGoodsRecord>>,
      Partial<FinishedGoodsRecord>
    >({
      query: (body) => ({
        url: "/finished-good/create",
        method: "POST",
        body,
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),
    update: builder.mutation<
      ApiResponse<DataObject<FinishedGoodsRecord>>,
      { id: string; body: Partial<FinishedGoodsRecord> }
    >({
      query: ({ id, body }) => ({
        url: `/finished-good/update/${id}`,
        method: "PUT",
        body,
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),
    delete: builder.mutation<ApiResponse<DataObject<null>>, { id: string }>({
      query: ({ id }) => ({
        url: `/finished-good/delete/${id}`,
        method: "DELETE",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),
  }),
});

export const {
  useGetAllQuery,
  useGetOneByIdQuery,
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
} = finishedGoodSlice;
