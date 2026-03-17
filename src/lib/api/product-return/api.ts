import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord => typeof v === "object" && v !== null;

const ok = <T,>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

const parseArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (isRecord(response)) {
    const d = response.data;
    if (Array.isArray(d)) return d as T[];
    if (isRecord(d) && Array.isArray(d.data)) return d.data as T[];
  }
  return [];
};

const parseObjectResponse = <T,>(response: unknown): T | null => {
  if (isRecord(response)) {
    const d = response.data;
    if (isRecord(d)) return d as T;
    if (isRecord(d) && isRecord(d.data)) return d.data as T;
  }
  if (isRecord(response)) return response as T;
  return null;
};

export type BackendProductReturn = {
  id?: string;
  uuid?: string;
  return_id?: string;
  returnId?: string;

  date?: string;
  created_at?: string;
  createdAt?: string;
  date_received?: string;
  dateReceived?: string;

  part_no?: string;
  partNo?: string;
  part_number?: string;
  partNumber?: string;

  part_name?: string;
  partName?: string;

  kanban?: string;
  packing_number?: string;
  packingNumber?: string;
  uniq_id?: string;
  uniqId?: string;

  model?: string;
  dn_number?: string;
  dnNumber?: string;

  scrap_type?: string;
  scrapType?: string;

  scrap_qty?: number;
  scrapQty?: number;
  scrap_quantity?: number;
  quantity_scrap?: number;

  rework_qty?: number;
  reworkQty?: number;
  rework_quantity?: number;
  quantity_rework?: number;

  weight?: number;
  unit?: string;
  submitted_by?: string;
  submittedBy?: string;

  status?: string;
  notes?: string;
  remark?: string;
};

export type CreateProductReturnRequest = {
  // Backend requires this field name
  uniq?: string;
  // Legacy/alternative naming
  uniq_id?: string;

  kanban?: string;
  part_no?: string;
  part_name?: string;
  model?: string;
  packing_number?: string;
  dn_number?: string;
  date_received?: string;

  // Backend expects these names
  quantity_scrap?: number;
  quantity_rework?: number;

  // Legacy aliases used by older clients
  scrap_qty?: number;
  rework_qty?: number;

  weight?: number;
  unit?: string;
  notes?: string;
  submitted_by?: string;
};

export type ProductReturnDecisionRequest = {
  id: string;
  decision: "approve" | "reject";
  remark?: string;
};

export const productReturnSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createProductReturn: builder.mutation<ApiResponse<BackendProductReturn>, CreateProductReturnRequest>({
      query: (body) => {
        const uniq = (typeof body.uniq === "string" && body.uniq.trim()) ? body.uniq.trim() : (typeof body.uniq_id === "string" ? body.uniq_id.trim() : "");
        const quantityScrap =
          typeof body.quantity_scrap === "number" ? body.quantity_scrap :
          typeof body.scrap_qty === "number" ? body.scrap_qty :
          0;
        const quantityRework =
          typeof body.quantity_rework === "number" ? body.quantity_rework :
          typeof body.rework_qty === "number" ? body.rework_qty :
          0;

        return {
          url: "/api/product-return",
          method: "POST",
          body: {
            // Required by backend validators
            uniq,
            scrap_type: "Product Return",
            quantity_scrap: quantityScrap,
            quantity_rework: quantityRework,

            // Helpful extras (backend can ignore if not used)
            kanban: body.kanban,
            part_no: body.part_no,
            part_name: body.part_name,
            model: body.model,
            packing_number: body.packing_number,
            dn_number: body.dn_number,
            date_received: body.date_received,
            weight: body.weight,
            unit: body.unit,
            notes: body.notes,
            submitted_by: body.submitted_by,
          },
          meta: { useAuthorization: true, contentType: "application/json" },
        };
      },
      transformResponse: (response: unknown) => ok((parseObjectResponse<BackendProductReturn>(response) ?? {}) as BackendProductReturn, "Created"),
      invalidatesTags: [{ type: "ProductReturns", id: "PENDING" }, { type: "ProductReturns", id: "HISTORY" }],
    }),

    getProductReturnPending: builder.query<ApiResponse<BackendProductReturn[]>, void>({
      query: () => ({
        url: "/api/product-return/pending",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<BackendProductReturn>(response)),
      providesTags: [{ type: "ProductReturns", id: "PENDING" }],
    }),

    getProductReturnPendingById: builder.query<ApiResponse<BackendProductReturn>, string>({
      query: (id) => ({
        url: `/api/product-return/pending/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok((parseObjectResponse<BackendProductReturn>(response) ?? {}) as BackendProductReturn),
      providesTags: (_result, _error, id) => [{ type: "ProductReturns", id }],
    }),

    getProductReturnHistory: builder.query<ApiResponse<BackendProductReturn[]>, void>({
      query: () => ({
        url: "/api/product-return/history",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok(parseArrayResponse<BackendProductReturn>(response)),
      providesTags: [{ type: "ProductReturns", id: "HISTORY" }],
    }),

    getProductReturnById: builder.query<ApiResponse<BackendProductReturn>, string>({
      query: (id) => ({
        url: `/api/product-return/${encodeURIComponent(id)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => ok((parseObjectResponse<BackendProductReturn>(response) ?? {}) as BackendProductReturn),
      providesTags: (_result, _error, id) => [{ type: "ProductReturns", id }],
    }),

    decideProductReturn: builder.mutation<ApiResponse<{ id: string }>, ProductReturnDecisionRequest>({
      query: ({ id, decision, remark }) => ({
        url: `/api/product-return/${encodeURIComponent(id)}/decision`,
        method: "POST",
        body: { decision, remark },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ id: string; message: string }>;
        return ok({ id: typeof r?.id === "string" ? r.id : "" }, r?.message ?? "Updated");
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ProductReturns", id: "PENDING" },
        { type: "ProductReturns", id: "HISTORY" },
        { type: "ProductReturns", id },
      ],
    }),
  }),
});

export const {
  useCreateProductReturnMutation,
  useGetProductReturnPendingQuery,
  useGetProductReturnPendingByIdQuery,
  useGetProductReturnHistoryQuery,
  useGetProductReturnByIdQuery,
  useDecideProductReturnMutation,
} = productReturnSlice;
