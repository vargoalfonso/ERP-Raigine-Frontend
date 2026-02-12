import { apiSlice } from "@/lib/api/instance";
import { ApiResponse, DataArray, DataObject } from "@/types";
import {
  RawMaterialRecord,
  CreateRawMaterialRequest,
  UpdateRawMaterialRequest,
} from "./interface";

type BackendRmInventory = {
  id: string;
  rm_uniq?: string;
  rm_type?: string;
  rm_source?: string;
  warehouse_code?: string;
  unit_measurement?: string;
  stock?: number;
  weight?: number;
  item_name?: string;
  code?: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
};

const ok = <T>(data: T, pagination?: ApiResponse<T>["pagination"], message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
  pagination,
});

const mapWarehouseCode = (warehouseId: string | undefined): string | undefined => {
  // UI values in some forms are placeholders like 'warehouse1'.
  switch (warehouseId) {
    case "warehouse1":
      return "WH-001";
    case "warehouse2":
      return "WH-002";
    case "warehouse3":
      return "WH-003";
    default:
      return warehouseId;
  }
};

const computeStatus = (stock: number | undefined): RawMaterialRecord["status"] => {
  const s = Number(stock ?? 0);
  if (s <= 0) return "OutOfStock";
  if (s < 10) return "LowStock";
  return "Available";
};

const toRawMaterialRecord = (item: BackendRmInventory): RawMaterialRecord => {
  const stock = Number(item.stock ?? 0);
  const source = (item.rm_source ?? "").toLowerCase();
  const isBuyed = source.includes("supplier") || source.includes("direct") || source.includes("buy");
  const warehouseCode = item.warehouse_code;

  return {
    id: item.id,
    uniq: item.rm_uniq ?? "-",
    code: item.code ?? item.rm_uniq ?? "-",
    name: item.item_name ?? item.name ?? item.rm_type ?? item.rm_uniq ?? "-",
    category: item.rm_type,
    master_list_supplier_id: item.rm_source,
    warehouse_id: warehouseCode,
    warehouse: warehouseCode
      ? {
          id: warehouseCode,
          name: warehouseCode,
          code: warehouseCode,
        }
      : undefined,
    stock,
    unit: item.unit_measurement,
    price: item.weight,
    order_flag: false,
    status: computeStatus(stock),
    is_buyed: isBuyed,
    created_by: "",
    created_at: item.created_at ?? "",
    updated_at: item.updated_at ?? "",
    current_stock: undefined,
    master_list: undefined,
  };
};

const mapCreateToBackend = (body: CreateRawMaterialRequest) => {
  const warehouseCode = mapWarehouseCode(body.warehouse_id);
  const stock = Number(body.stock ?? 0);
  const weight = body.price != null ? Number(body.price) : undefined;
  const rmUniq = body.uniq ?? body.code;

  return {
    rmType: body.category,
    rmSource: body.master_list_supplier_id,
    warehouse: warehouseCode,
    unitMeasurement: body.unit,
    rmUniq,
    stock,
    weight,
    // Some backends accept snake_case; send both to be safe.
    rm_type: body.category,
    rm_source: body.master_list_supplier_id,
    warehouse_code: warehouseCode,
    unit_measurement: body.unit,
    rm_uniq: rmUniq,
  };
};

const mapUpdateToBackend = (body: UpdateRawMaterialRequest) => {
  const warehouseCode = mapWarehouseCode(body.warehouse_id);
  const stock = body.stock != null ? Number(body.stock) : undefined;
  return {
    ...(body.category != null ? { rmType: body.category, rm_type: body.category } : {}),
    ...(body.master_list_supplier_id != null
      ? { rmSource: body.master_list_supplier_id, rm_source: body.master_list_supplier_id }
      : {}),
    ...(warehouseCode != null
      ? { warehouse: warehouseCode, warehouse_code: warehouseCode }
      : {}),
    ...(body.unit != null ? { unitMeasurement: body.unit, unit_measurement: body.unit } : {}),
    ...(body.uniq != null ? { rmUniq: body.uniq, rm_uniq: body.uniq } : {}),
    ...(stock != null ? { stock } : {}),
  };
};

export const rawMaterialSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAllRawMaterials: builder.query<
      ApiResponse<DataArray<RawMaterialRecord>>,
      { currentPage: number; pageSize: number }
    >({
      query: ({ currentPage, pageSize }) => ({
        url: `/api/rm-inventory?page=${currentPage}&perPage=${pageSize}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown, _meta, arg) => {
        const raw = Array.isArray(response) ? response : [];
        const mapped = (raw as BackendRmInventory[]).map(toRawMaterialRecord);

        const toTime = (value: string | undefined): number => {
          if (!value) return 0;
          const t = new Date(value).getTime();
          return Number.isFinite(t) ? t : 0;
        };

        mapped.sort((a, b) => {
          const bt = toTime(b.created_at) || toTime(b.updated_at);
          const at = toTime(a.created_at) || toTime(a.updated_at);
          if (bt !== at) return bt - at;
          return String(b.id).localeCompare(String(a.id));
        });

        const total = mapped.length;
        const perPage = arg.pageSize;
        const page = arg.currentPage;
        const totalPages = perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;

        return ok(mapped, { total, page, perPage, totalPages });
      },
    }),

    getRawMaterialById: builder.query<
      ApiResponse<DataObject<RawMaterialRecord>>,
      string
    >({
      query: (id) => ({
        url: `/api/rm-inventory/${id}`,
        method: "GET",
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) => {
        return ok(toRawMaterialRecord(response as BackendRmInventory));
      },
    }),

    createRawMaterial: builder.mutation<
      ApiResponse<DataObject<RawMaterialRecord>>,
      CreateRawMaterialRequest
    >({
      query: (body) => ({
        url: "/api/rm-inventory",
        method: "POST",
        body: mapCreateToBackend(body),
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok(({ id: r?.id ?? "" } as RawMaterialRecord), undefined, r?.message ?? "Created");
      },
    }),

    updateRawMaterial: builder.mutation<
      ApiResponse<DataObject<RawMaterialRecord>>,
      { id: string; body: UpdateRawMaterialRequest }
    >({
      query: ({ id, body }) => ({
        url: `/api/rm-inventory/${id}`,
        method: "PUT",
        body: mapUpdateToBackend(body),
        meta: {
          useAuthorization: true,
          contentType: "application/json",
        },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok(({ id: r?.id ?? "" } as RawMaterialRecord), undefined, r?.message ?? "Updated");
      },
    }),

    deleteRawMaterial: builder.mutation<
      ApiResponse<DataObject<null>>,
      { id: string }
    >({
      query: ({ id }) => ({
        url: `/api/rm-inventory/${id}`,
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
  useGetAllRawMaterialsQuery,
  useGetRawMaterialByIdQuery,
  useCreateRawMaterialMutation,
  useUpdateRawMaterialMutation,
  useDeleteRawMaterialMutation,
} = rawMaterialSlice;
