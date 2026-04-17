import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === "object";

const toText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const parseArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (!isRecord(response)) return [];
  const data = response.data;
  if (Array.isArray(data)) return data as T[];
  if (isRecord(data)) {
    if (Array.isArray(data.items)) return data.items as T[];
    if (Array.isArray(data.data)) return data.data as T[];
  }
  return [];
};

const parseObjectResponse = <T,>(response: unknown): T | null => {
  if (!isRecord(response)) return null;
  const data = response.data;
  if (isRecord(data) && isRecord(data.data)) return data.data as T;
  if (isRecord(data)) return data as T;
  return response as T;
};

export type WarehouseRecord = {
  id?: string;
  warehouse_uuid?: string;
  warehouse_name?: string;
  type_warehouse?: string;
  plant_id?: string;
  plant_name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type WarehouseMutationRequest = {
  warehouse_name: string;
  type_warehouse: string;
  plant_id: string;
  status?: string;
};

const normalizeWarehouse = (record: unknown): WarehouseRecord => {
  const row = isRecord(record) ? record : {};
  const plant = isRecord(row.plant) ? row.plant : undefined;
  return {
    ...row,
    id: toText(row.warehouse_uuid) ?? toText(row.uuid) ?? toText(row.id),
    warehouse_uuid: toText(row.warehouse_uuid) ?? toText(row.uuid) ?? toText(row.id),
    warehouse_name: toText(row.warehouse_name) ?? toText(row.name),
    type_warehouse: toText(row.type_warehouse) ?? toText(row.type),
    plant_id: toText(row.plant_id) ?? toText(plant?.id) ?? toText(plant?.plant_id),
    plant_name: toText(row.plant_name) ?? toText(row.plant) ?? toText(plant?.name),
    status: toText(row.status),
    created_at: toText(row.created_at),
    updated_at: toText(row.updated_at),
  };
};

const TAG = "Warehouses" as const;

export const warehouseApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      listWarehouses: builder.query<WarehouseRecord[], void>({
        query: () => ({
          url: "/api/v1/warehouses",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => parseArrayResponse<unknown>(response).map(normalizeWarehouse),
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: string }> = [{ type: TAG, id: "LIST" }];
          if (!result) return base;
          return base.concat(
            result
              .map((item) => item.id)
              .filter((id): id is string => Boolean(id))
              .map((id) => ({ type: TAG, id }))
          );
        },
      }),

      getWarehouseById: builder.query<WarehouseRecord, string | number>({
        query: (id) => ({
          url: `/api/v1/warehouses/${encodeURIComponent(String(id))}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeWarehouse(parseObjectResponse<unknown>(response) ?? response),
        providesTags: (_result, _error, id) => [{ type: TAG, id: String(id) }],
      }),

      createWarehouse: builder.mutation<WarehouseRecord, WarehouseMutationRequest>({
        query: (body) => ({
          url: "/api/v1/warehouses",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeWarehouse(parseObjectResponse<unknown>(response) ?? response),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      updateWarehouse: builder.mutation<WarehouseRecord, { id: string | number; body: Partial<WarehouseMutationRequest> & Record<string, unknown> }>({
        query: ({ id, body }) => ({
          url: `/api/v1/warehouses/${encodeURIComponent(String(id))}`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeWarehouse(parseObjectResponse<unknown>(response) ?? response),
        invalidatesTags: (_result, _error, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(arg.id) },
        ],
      }),

      deleteWarehouse: builder.mutation<{ success: boolean } | unknown, string | number>({
        query: (id) => ({
          url: `/api/v1/warehouses/${encodeURIComponent(String(id))}`,
          method: "DELETE",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: (_result, _error, id) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(id) },
        ],
      }),
    }),
  });

export const {
  useListWarehousesQuery,
  useGetWarehouseByIdQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  useDeleteWarehouseMutation,
} = warehouseApiSlice;
