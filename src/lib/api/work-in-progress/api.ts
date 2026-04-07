import { apiSlice } from "@/lib/api/instance";
import { ApiResponse, DataArray, DataObject } from "@/types";
import {
  WorkInProgressRecord,
  CreateWorkInProgressRequest,
  UpdateWorkInProgressRequest,
} from "./interface";

export const workInProgressSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllWorkInProgress: builder.query<
      ApiResponse<DataArray<WorkInProgressRecord>>,
      { currentPage: number; pageSize: number }
    >({
      query: ({ currentPage, pageSize }) => ({
        url: `/work-in-progress/?page=${currentPage}&perPage=${pageSize}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),
    getWorkInProgressById: builder.query<
      ApiResponse<DataObject<WorkInProgressRecord>>,
      string
    >({
      query: (id) => ({
        url: `/work-in-progress/${id}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),
    createWorkInProgress: builder.mutation<
      ApiResponse<DataObject<WorkInProgressRecord>>,
      CreateWorkInProgressRequest
    >({
      query: (body) => ({
        url: "/work-in-progress/create",
        method: "POST",
        body,
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),
    updateWorkInProgress: builder.mutation<
      ApiResponse<DataObject<WorkInProgressRecord>>,
      UpdateWorkInProgressRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/work-in-progress/${id}`,
        method: "PUT",
        body,
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
    }),
    deleteWorkInProgress: builder.mutation<
      ApiResponse<DataObject<WorkInProgressRecord>>,
      string
    >({
      query: (id) => ({
        url: `/work-in-progress/${id}`,
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
  useGetAllWorkInProgressQuery,
  useGetWorkInProgressByIdQuery,
  useCreateWorkInProgressMutation,
  useUpdateWorkInProgressMutation,
  useDeleteWorkInProgressMutation,
} = workInProgressSlice;
