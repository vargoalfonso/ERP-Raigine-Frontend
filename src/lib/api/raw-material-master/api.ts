import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";

export type RawMaterialMaster = {
  id: number;
  material_code: string;
  material_name: string;
  grade?: string | null;
  material_grade?: string | null;
  form?: string | null;
  type_material: "raw" | "indirect" | "subcon";
  width_mm?: number | null;
  diameter_mm?: number | null;
  thickness_mm?: number | null;
  length_mm?: number | null;
  weight_kg?: number | null;
  uom?: string | null;
  spec_key: string;
  status: "Active" | "Inactive";
  bom_usage_count: number;
  inventory_qty: number;
};

export type RawMaterialMasterInput = Omit<
  RawMaterialMaster,
  "id" | "spec_key" | "bom_usage_count" | "inventory_qty"
>;

export type RawMaterialPlanningItem = {
  master_id: number;
  material_code: string;
  material_name: string;
  material_grade?: string | null;
  uom?: string | null;
  daily_demand: number;
  beginning_stock: number;
  ending_stock: number;
  safety_stock: number;
  target_stock_days: number;
  actual_stock_days: number;
  minimum_stock_level: number;
  recommended_buy_qty: number;
  decision: "BUY" | "NOT_BUY" | "DATA_INCOMPLETE";
  demand_source_count: number;
};

type MasterList = { items: RawMaterialMaster[]; total: number };
type PlanningList = { items: RawMaterialPlanningItem[] };

const unwrap = <T>(response: unknown): T => unwrapBackendData<T>(response);

export const rawMaterialMasterApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRawMaterialMasters: builder.query<
      MasterList,
      { page?: number; limit?: number; search?: string }
    >({
      query: ({ page = 1, limit = 100, search = "" }) => ({
        url: `/inventory/raw-material-masters?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => unwrap<MasterList>(response),
      providesTags: ["RawMaterialMaster" as never],
    }),
    getRawMaterialPlanning: builder.query<RawMaterialPlanningItem[], void>({
      query: () => ({
        url: "/inventory/raw-material-masters/planning",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        unwrap<PlanningList>(response)?.items ?? [],
      providesTags: ["RawMaterialMaster" as never],
    }),
    createRawMaterialMaster: builder.mutation<
      RawMaterialMaster,
      RawMaterialMasterInput
    >({
      query: (body) => ({
        url: "/inventory/raw-material-masters",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        unwrap<RawMaterialMaster>(response),
      invalidatesTags: ["RawMaterialMaster" as never],
    }),
    updateRawMaterialMaster: builder.mutation<
      RawMaterialMaster,
      { id: number; body: Partial<RawMaterialMasterInput> }
    >({
      query: ({ id, body }) => ({
        url: `/inventory/raw-material-masters/${id}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        unwrap<RawMaterialMaster>(response),
      invalidatesTags: ["RawMaterialMaster" as never],
    }),
  }),
});

export const {
  useGetRawMaterialMastersQuery,
  useLazyGetRawMaterialMastersQuery,
  useGetRawMaterialPlanningQuery,
  useCreateRawMaterialMasterMutation,
  useUpdateRawMaterialMasterMutation,
} = rawMaterialMasterApi;
