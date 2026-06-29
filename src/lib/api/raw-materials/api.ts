import { apiSlice } from "@/lib/api/instance";
import { ApiResponse, DataArray, DataObject } from "@/types";
import {
  RawMaterialRecord,
  CreateRawMaterialRequest,
  UpdateRawMaterialRequest,
} from "./interface";

export const rawMaterialSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllRawMaterials: builder.query<
      ApiResponse<DataArray<RawMaterialRecord>>,
      { currentPage: number; pageSize: number }
    >({
      query: ({ currentPage, pageSize }) => ({
        url: `/raw-material/?page=${currentPage}&perPage=${pageSize}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),

    getRawMaterialById: builder.query<
      ApiResponse<DataObject<RawMaterialRecord>>,
      string
    >({
      query: (id) => ({
        url: `/raw-material/${id}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),

    createRawMaterial: builder.mutation<
      ApiResponse<DataObject<RawMaterialRecord>>,
      CreateRawMaterialRequest
    >({
      query: (body) => ({
        url: "/raw-material/create",
        method: "POST",
        body,
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),

    updateRawMaterial: builder.mutation<
      ApiResponse<DataObject<RawMaterialRecord>>,
      { id: string; body: UpdateRawMaterialRequest }
    >({
      query: ({ id, body }) => ({
        url: `/raw-material/update/${id}`,
        method: "PUT",
        body,
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),

    deleteRawMaterial: builder.mutation<
      ApiResponse<DataObject<null>>,
      { id: string }
    >({
      query: ({ id }) => ({
        url: `/raw-material/delete/${id}`,
        method: "DELETE",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),

    generateQRRawmaterial: builder.query<
      ApiResponse<DataObject<RawMaterialRecord>>,
      string
    >({
      query: (code) => ({
        url: `/inventory/raw-materials/${code}/create-qr`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),

  }),
});

export const {
  useGetAllRawMaterialsQuery,
  useGetRawMaterialByIdQuery,
  useCreateRawMaterialMutation,
  useUpdateRawMaterialMutation,
  useDeleteRawMaterialMutation,
  useLazyGenerateQRRawmaterialQuery,
} = rawMaterialSlice;
