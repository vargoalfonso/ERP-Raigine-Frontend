import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const toText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const ok = <T,>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

// approval_status values from backend: pending | approved | rejected
export type SubconApprovalStatus = "pending" | "approved" | "rejected";

export type SubconInventoryItem = {
  id: string;
  uniq_code: string;
  part_number?: string;
  part_name?: string;
  po_number?: string;
  po_period?: string;
  subcon_vendor_id?: number;
  subcon_vendor_name?: string;
  stock_at_vendor_qty: number;
  total_po_qty: number;
  total_received_qty: number;
  delta_po: number;
  safety_stock_qty: number;
  date_delivery?: string;
  status: string;
  approval_status: SubconApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  source_type?: string;
  source_ref?: string;
  created_at?: string;
  updated_at?: string;
};

const pickArray = (response: unknown): unknown[] => {
  if (Array.isArray(response)) return response;
  if (isRecord(response)) {
    if (Array.isArray(response.items)) return response.items;
    if (isRecord(response.data)) {
      if (Array.isArray(response.data.items)) return response.data.items;
      if (Array.isArray(response.data)) return response.data as unknown[];
    }
    if (Array.isArray(response.data)) return response.data as unknown[];
  }
  return [];
};

const toSubconInventoryItem = (raw: unknown): SubconInventoryItem => {
  const r = isRecord(raw) ? raw : {};
  const approval = (toText(r.approval_status) ?? "pending").toLowerCase();
  const approvalStatus: SubconApprovalStatus =
    approval === "approved" || approval === "rejected" ? approval : "pending";
  return {
    id: toText(r.id ?? r.ID) ?? "",
    uniq_code: toText(r.uniq_code ?? r.uniq ?? r.UniqCode) ?? "-",
    part_number: toText(r.part_number ?? r.PartNumber),
    part_name: toText(r.part_name ?? r.PartName),
    po_number: toText(r.po_number ?? r.PONumber),
    po_period: toText(r.po_period ?? r.POPeriod),
    subcon_vendor_id: toNumber(r.subcon_vendor_id ?? r.SubconVendorID) || undefined,
    subcon_vendor_name: toText(r.subcon_vendor_name ?? r.SubconVendorName),
    stock_at_vendor_qty: toNumber(r.stock_at_vendor_qty ?? r.StockAtVendorQty),
    total_po_qty: toNumber(r.total_po_qty ?? r.TotalPOQty),
    total_received_qty: toNumber(r.total_received_qty ?? r.TotalReceivedQty),
    delta_po: toNumber(r.delta_po ?? r.DeltaPO),
    safety_stock_qty: toNumber(r.safety_stock_qty ?? r.SafetyStockQty),
    date_delivery: toText(r.date_delivery ?? r.DateDelivery),
    status: toText(r.status ?? r.Status) ?? "normal",
    approval_status: approvalStatus,
    approved_by: toText(r.approved_by ?? r.ApprovedBy),
    approved_at: toText(r.approved_at ?? r.ApprovedAt),
    source_type: toText(r.source_type ?? r.SourceType),
    source_ref: toText(r.source_ref ?? r.SourceRef),
    created_at: toText(r.created_at ?? r.CreatedAt),
    updated_at: toText(r.updated_at ?? r.UpdatedAt),
  };
};

export const subconInventorySlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Stock In Vendor list (auto-populated from subcon PO on the backend).
    getSubconInventory: builder.query<
      ApiResponse<SubconInventoryItem[]>,
      { page?: number; limit?: number } | void
    >({
      query: (args) => {
        const page = args?.page ?? 1;
        const limit = args?.limit ?? 50;
        return {
          url: `/inventory/subcon-materials?page=${page}&limit=${limit}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        };
      },
      transformResponse: (response: unknown) =>
        ok(pickArray(response).map(toSubconInventoryItem), "Subcon inventory retrieved"),
    }),

    // Stock Received from Vendor list (auto-populated from subcon DN Management on the backend,
    // any DN status). Same shape + approval flow as Stock In Vendor.
    getSubconReceived: builder.query<
      ApiResponse<SubconInventoryItem[]>,
      { page?: number; limit?: number } | void
    >({
      query: (args) => {
        const page = args?.page ?? 1;
        const limit = args?.limit ?? 50;
        return {
          url: `/inventory/subcon-materials?source=received&page=${page}&limit=${limit}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        };
      },
      transformResponse: (response: unknown) =>
        ok(pickArray(response).map(toSubconInventoryItem), "Subcon received retrieved"),
    }),

    approveSubconInventory: builder.mutation<ApiResponse<{ id: string }>, string>({
      query: (id) => ({
        url: `/inventory/subcon-materials/${encodeURIComponent(id)}/approve`,
        method: "POST",
        body: {},
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ message: string }>;
        return ok({ id: "" }, r?.message ?? "Approved");
      },
    }),

    rejectSubconInventory: builder.mutation<ApiResponse<{ id: string }>, string>({
      query: (id) => ({
        url: `/inventory/subcon-materials/${encodeURIComponent(id)}/reject`,
        method: "POST",
        body: {},
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ message: string }>;
        return ok({ id: "" }, r?.message ?? "Rejected");
      },
    }),

    // [subcon-del] Baris pada tab Stock In Vendor maupun Stock Received
    // sama-sama berasal dari tabel subcon_inventories, sehingga keduanya
    // dihapus lewat endpoint soft delete yang sama.
    deleteSubconInventory: builder.mutation<ApiResponse<{ id: string }>, string>({
      query: (id) => ({
        url: `/inventory/subcon-materials/${encodeURIComponent(id)}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ message: string }>;
        return ok({ id: "" }, r?.message ?? "Deleted");
      },
    }),
  }),
});

export const {
  useGetSubconInventoryQuery,
  useGetSubconReceivedQuery,
  useApproveSubconInventoryMutation,
  useRejectSubconInventoryMutation,
  useDeleteSubconInventoryMutation,
} = subconInventorySlice;
