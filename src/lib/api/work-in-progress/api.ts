import { apiSlice } from "@/lib/api/instance";
import { ApiResponse, DataArray, DataObject } from "@/types";
import {
  WorkInProgressRecord,
  CreateWorkInProgressRequest,
  UpdateWorkInProgressRequest,
} from "./interface";

type BackendWip = {
  id: string;
  uniq?: string;
  item_name?: string;
  warehouse_code?: string;
  quantity?: number;
  process?: string;
  unit_measurement?: string;
  date?: string;
  reference_no?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

const toWorkInProgressRecord = (item: BackendWip): WorkInProgressRecord => {
  return {
    id: item.id,
    product_uniq: item.uniq,
    part_name: item.item_name,
    quantity_in_process: item.quantity,
    current_process: item.process,
    batch_number: item.reference_no,
    production_start_date: item.date,
    process_notes: item.notes,
    created_at: item.created_at,
    updated_at: item.updated_at,
    warehouse: item.warehouse_code
      ? ({ code: item.warehouse_code } as WorkInProgressRecord["warehouse"])
      : undefined,
  };
};

const ok = <T>(data: T, pagination?: ApiResponse<T>["pagination"], message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
  pagination,
});

const mapCreateToBackend = (body: CreateWorkInProgressRequest) => {
  return {
    uniq: body.product_uniq,
    item_name: body.part_name,
    quantity: body.quantity_in_process,
    process: body.current_process,
    date: body.production_start_date,
    reference_no: body.batch_number || body.work_order_reference,
    notes: body.process_notes,
  };
};

const mapUpdateToBackend = (body: Omit<UpdateWorkInProgressRequest, "id">) => {
  return {
    ...(body.product_uniq != null ? { uniq: body.product_uniq } : {}),
    ...(body.part_name != null ? { item_name: body.part_name } : {}),
    ...(body.quantity_in_process != null ? { quantity: body.quantity_in_process } : {}),
    ...(body.current_process != null ? { process: body.current_process } : {}),
    ...(body.production_start_date != null ? { date: body.production_start_date } : {}),
    ...(body.batch_number != null || body.work_order_reference != null
      ? { reference_no: body.batch_number ?? body.work_order_reference }
      : {}),
    ...(body.process_notes != null ? { notes: body.process_notes } : {}),
  };
};

export const workInProgressSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllWorkInProgress: builder.query<
      ApiResponse<DataArray<WorkInProgressRecord>>,
      { currentPage: number; pageSize: number }
    >({
      query: ({ currentPage, pageSize }) => ({
        url: `/api/work-in-progress?page=${currentPage}&perPage=${pageSize}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown, _meta, arg) => {
        const raw = Array.isArray(response) ? response : [];
        const mapped = (raw as BackendWip[]).map(toWorkInProgressRecord);

        const total = mapped.length;
        const perPage = arg.pageSize;
        const page = arg.currentPage;
        const totalPages = perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;

        return ok(mapped, { total, page, perPage, totalPages });
      },
    }),
    getWorkInProgressById: builder.query<
      ApiResponse<DataObject<WorkInProgressRecord>>,
      string
    >({
      query: (id) => ({
        url: `/api/work-in-progress/${id}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) => {
        return ok(toWorkInProgressRecord(response as BackendWip));
      },
    }),
    createWorkInProgress: builder.mutation<
      ApiResponse<DataObject<WorkInProgressRecord>>,
      CreateWorkInProgressRequest
    >({
      query: (body) => ({
        url: "/api/work-in-progress",
        method: "POST",
        body: mapCreateToBackend(body),
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok(({ id: r?.id ?? "" } as WorkInProgressRecord), undefined, r?.message ?? "Created");
      },
    }),
    updateWorkInProgress: builder.mutation<
      ApiResponse<DataObject<WorkInProgressRecord>>,
      UpdateWorkInProgressRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/api/work-in-progress/${id}`,
        method: "PUT",
        body: mapUpdateToBackend(body),
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok(({ id: r?.id ?? "" } as WorkInProgressRecord), undefined, r?.message ?? "Updated");
      },
    }),
    deleteWorkInProgress: builder.mutation<
      ApiResponse<DataObject<WorkInProgressRecord>>,
      string
    >({
      query: (id) => ({
        url: `/api/work-in-progress/${id}`,
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
