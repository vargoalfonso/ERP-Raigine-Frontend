import { apiSlice } from "@/lib/api/instance";
import { ApiResponse, DataArray, DataObject } from "@/types";
import { FinishedGoodsRecord } from "./interface";

type BackendFinishedGood = {
  id: string;
  uniq?: string;
  item_name?: string;
  warehouse_code?: string;
  quantity?: number;
  weight?: number;
  unit_measurement?: string;
  date?: string;
  reference_no?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type FinishedGoodCreateRequest = {
  uniq?: string;
  item_name?: string;
  warehouse_code?: string;
  quantity: number;
  weight?: number;
  unit_measurement?: string;
  date?: string;
  reference_no?: string;
  notes?: string;
};

const toFinishedGoodsRecord = (item: BackendFinishedGood): FinishedGoodsRecord => {
  return {
    id: item.id,
    current_stock: item.quantity,
    notes: item.notes,
    created_at: item.created_at,
    updated_at: item.updated_at,
    total_kanban: 0,
    target_stock: 0,
    stock_to_complete: 0 as unknown as FinishedGoodsRecord["stock_to_complete"],
    warehouse: item.warehouse_code
      ? ({ code: item.warehouse_code } as FinishedGoodsRecord["warehouse"])
      : undefined,
    master_list: (item.uniq || item.item_name)
      ? ({
          uniq_code: item.uniq,
          part_name: item.item_name,
        } as FinishedGoodsRecord["master_list"])
      : undefined,
    // ERP-raigine finished-good uses `reference_no` (often WO number) but UI expects work_order.wo_number
    work_order: item.reference_no
      ? ({
          id: item.reference_no,
          wo_number: item.reference_no,
        } as FinishedGoodsRecord["work_order"])
      : undefined,
  };
};

const ok = <T>(data: T, pagination?: ApiResponse<T>["pagination"]): ApiResponse<T> => ({
  message: "OK",
  status: "success",
  data,
  pagination,
});

export const finishedGoodSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAll: builder.query<
      ApiResponse<DataArray<FinishedGoodsRecord>>,
      { currentPage: number; pageSize: number }
    >({
      query: ({ currentPage, pageSize }) => ({
        url: `/api/finished-good?page=${currentPage}&perPage=${pageSize}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown, _meta, arg) => {
        const raw = Array.isArray(response) ? response : [];
        const mapped = (raw as BackendFinishedGood[]).map(toFinishedGoodsRecord);

        const total = mapped.length;
        const perPage = arg.pageSize;
        const page = arg.currentPage;
        const totalPages = perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;

        return ok(mapped, { total, page, perPage, totalPages });
      },
    }),
    getOneById: builder.query<
      ApiResponse<DataObject<FinishedGoodsRecord>>,
      string
    >({
      query: (id) => ({
        url: `/api/finished-good/${id}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) => {
        const item = response as BackendFinishedGood;
        return ok(toFinishedGoodsRecord(item));
      },
    }),
    create: builder.mutation<
      ApiResponse<DataObject<FinishedGoodsRecord>>,
      FinishedGoodCreateRequest
    >({
      query: (body) => ({
        url: "/api/finished-good",
        method: "POST",
        body,
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string }>;
        return {
          message: "Created",
          status: "success",
          data: ({ id: r?.id ?? "" } as FinishedGoodsRecord),
        };
      },
    }),
    update: builder.mutation<
      ApiResponse<DataObject<FinishedGoodsRecord>>,
      { id: string; body: Partial<FinishedGoodsRecord> }
    >({
      query: ({ id, body }) => ({
        url: `/api/finished-good/${id}`,
        method: "PUT",
        body: {
          ...(body.current_stock != null ? { quantity: body.current_stock } : {}),
        },
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return {
          message: r?.message ?? "Updated",
          status: "success",
          data: ({ id: r?.id ?? "" } as FinishedGoodsRecord),
        };
      },
    }),
    delete: builder.mutation<ApiResponse<DataObject<null>>, { id: string }>({
      query: ({ id }) => ({
        url: `/api/finished-good/${id}`,
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
