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

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
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
    const nested = data.data;
    if (isRecord(nested) && Array.isArray(nested.items)) return nested.items as T[];
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

export type SupplierItemRecord = {
  row_id?: number;
  id?: string;
  supplier_item_uuid?: string;
  supplier_uuid?: string;
  supplier_name?: string;
  supplier_code?: string;
  warehouse_uuid?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  sebango_code?: string;
  uniq_code?: string;
  type?: string;
  material_type?: string;
  description?: string;
  quantity?: number;
  uom?: string;
  weight?: number;
  pcs_per_kanban?: number;
  customer_cycle?: string | number;
  percentage?: number;
  status?: string;
  product_model?: string;
  part_name?: string;
  part_number?: string;
  grade?: string;
  size?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type SupplierItemMutationRequest = {
  supplier_uuid: string;
  sebango_code: string;
  uniq_code: string;
  type: string;
  description: string;
  quantity: string | number;
  uom: string;
  weight: string | number;
  pcs_per_kanban: string | number;
  customer_cycle: string;
  status?: string;
  warehouse_uuid?: string;
  warehouse_name?: string;
  product_model?: string;
  part_name?: string;
  part_number?: string;
  material_type?: string;
  grade?: string;
  size?: string;
};

const normalizeSupplierItem = (record: unknown): SupplierItemRecord => {
  const row = isRecord(record) ? record : {};
  const supplier = isRecord(row.supplier) ? row.supplier : undefined;
  const warehouse = isRecord(row.warehouse) ? row.warehouse : undefined;
  const product = isRecord(row.product) ? row.product : undefined;

  return {
    ...row,
    row_id: toNumber(row.row_id),
    id:
      toText(row.supplier_item_uuid) ??
      toText(row.uuid) ??
      toText(row.id),
    supplier_item_uuid:
      toText(row.supplier_item_uuid) ??
      toText(row.uuid) ??
      toText(row.id),
    supplier_uuid:
      toText(row.supplier_uuid) ??
      toText(row.supplier_id) ??
      toText(supplier?.uuid) ??
      toText(supplier?.id),
    supplier_name:
      toText(row.supplier_name) ??
      toText(row.supplier) ??
      toText(supplier?.supplier_name) ??
      toText(supplier?.name),
    supplier_code:
      toText(row.supplier_code) ??
      toText(supplier?.supplier_code) ??
      toText(supplier?.code),
    warehouse_uuid:
      toText(row.warehouse_uuid) ??
      toText(row.warehouse_id) ??
      toText(warehouse?.warehouse_uuid) ??
      toText(warehouse?.uuid) ??
      toText(warehouse?.id),
    warehouse_id:
      toText(row.warehouse_id) ??
      toText(row.warehouse_uuid) ??
      toText(warehouse?.warehouse_uuid) ??
      toText(warehouse?.id),
    warehouse_name:
      toText(row.warehouse_name) ??
      toText(row.location) ??
      toText(warehouse?.warehouse_name) ??
      toText(warehouse?.name),
    sebango_code: toText(row.sebango_code) ?? toText(row.sebanggo) ?? toText(row.sebango),
    uniq_code: toText(row.uniq_code) ?? toText(row.uniq),
    type: toText(row.type),
    material_type: toText(row.material_type) ?? toText(row.item_type) ?? toText(row.raw_material_type),
    description: toText(row.description),
    quantity: toNumber(row.quantity),
    uom: toText(row.uom),
    weight: toNumber(row.weight),
    pcs_per_kanban: toNumber(row.pcs_per_kanban) ?? toNumber(row.qty_per_kanban),
    customer_cycle: toText(row.customer_cycle) ?? toText(row.cycle_days) ?? toText(row.cycle),
    status: toText(row.status) ?? "active",
    product_model: toText(row.product_model) ?? toText(product?.model) ?? toText(product?.description),
    part_name: toText(row.part_name) ?? toText(product?.part_name),
    part_number: toText(row.part_number) ?? toText(product?.part_number),
    grade: toText(row.grade) ?? toText(row.material_grade),
    size: toText(row.size),
    percentage: toNumber(row.percentage),
    created_at: toText(row.created_at),
    updated_at: toText(row.updated_at),
  };
};

const TAG = "SupplierItems" as const;

export const supplierItemsApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      listSupplierItems: builder.query<SupplierItemRecord[], void>({
        query: () => ({
          url: "/supplier-items",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => parseArrayResponse<unknown>(response).map(normalizeSupplierItem),
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

      getSupplierItemById: builder.query<SupplierItemRecord, string | number>({
        query: (id) => ({
          url: `/supplier-items/${encodeURIComponent(String(id))}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeSupplierItem(parseObjectResponse<unknown>(response) ?? response),
        providesTags: (_result, _error, id) => [{ type: TAG, id: String(id) }],
      }),

      createSupplierItem: builder.mutation<SupplierItemRecord, SupplierItemMutationRequest>({
        query: (body) => ({
          url: "/supplier-items",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeSupplierItem(parseObjectResponse<unknown>(response) ?? response),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      updateSupplierItem: builder.mutation<SupplierItemRecord, { id: string | number; body: Partial<SupplierItemMutationRequest> & Record<string, unknown> }>({
        query: ({ id, body }) => ({
          url: `/supplier-items/${encodeURIComponent(String(id))}`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeSupplierItem(parseObjectResponse<unknown>(response) ?? response),
        invalidatesTags: (_result, _error, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: String(arg.id) },
        ],
      }),

      deleteSupplierItem: builder.mutation<{ success: boolean } | unknown, string | number>({
        query: (id) => ({
          url: `/supplier-items/${encodeURIComponent(String(id))}`,
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
  useListSupplierItemsQuery,
  useGetSupplierItemByIdQuery,
  useCreateSupplierItemMutation,
  useUpdateSupplierItemMutation,
  useDeleteSupplierItemMutation,
} = supplierItemsApiSlice;
