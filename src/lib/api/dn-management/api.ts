import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";

type UnknownRecord = Record<string, unknown>;

const TAG = "DnManagement" as const;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.data)) return value.data;
  return [];
};

const getString = (record: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const getNumber = (record: UnknownRecord, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

export type DnManagementType = "rm" | "subcon" | "indirect";

export type DnManagementItemRecord = {
  uniq: string;
  order_qty?: number;
  packing?: string;
  pcs_per_kanban?: number;
  date_incoming?: string;
  qty_stated?: number;
};

export type DnManagementRecord = {
  id: string;
  dn_number?: string;
  po_number?: string;
  supplier_id?: number;
  supplier_name?: string;
  dn_type?: string;
  period?: string;
  total_po_qty?: number;
  total_dn_created?: number;
  created_by?: string;
  items: DnManagementItemRecord[];
};

export type CreateDnManagementRequest = {
  type: DnManagementType;
  period: string;
  po_number: string;
  supplier_id: number;
  dn_type: string;
  total_po_qty: number;
  total_dn_created: number;
  created_by: string;
  items: Array<{
    uniq: string;
    order_qty: number;
    packing: string;
    pcs_per_kanban: number;
    date_incoming: string;
    qty_stated: number;
  }>;
};

const toItem = (raw: unknown): DnManagementItemRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    uniq: getString(record, ["uniq", "item_uniq_code"]) ?? "-",
    order_qty: getNumber(record, ["order_qty", "orderQty", "qty_order"]),
    packing: getString(record, ["packing", "packing_type"]),
    pcs_per_kanban: getNumber(record, ["pcs_per_kanban", "pcsPerKanban", "pcs_kanban"]),
    date_incoming: getString(record, ["date_incoming", "dateIncoming"]),
    qty_stated: getNumber(record, ["qty_stated", "qtyStated", "quantity", "qty"]),
  };
};

const toRecord = (raw: unknown): DnManagementRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: getString(record, ["id", "dn_number", "po_number"]) ?? "",
    dn_number: getString(record, ["dn_number", "dnNumber"]),
    po_number: getString(record, ["po_number", "poNumber"]),
    supplier_id: getNumber(record, ["supplier_id", "supplierId"]),
    supplier_name: getString(record, ["supplier_name", "supplierName"]),
    dn_type: getString(record, ["dn_type", "dnType"]),
    period: getString(record, ["period"]),
    total_po_qty: getNumber(record, ["total_po_qty", "totalPoQty"]),
    total_dn_created: getNumber(record, ["total_dn_created", "totalDnCreated"]),
    created_by: getString(record, ["created_by", "createdBy"]),
    items: Array.isArray(record.items) ? record.items.map(toItem) : [],
  };
};

const typePath = (type: DnManagementType) => `/api/dn-management/type/${type}`;

export const dnManagementApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getDnManagementByType: builder.query<DnManagementRecord[], DnManagementType>({
        query: (type) => ({
          url: typePath(type),
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const unwrapped = unwrapBackendData<unknown>(response);
          return asArray(unwrapped).map(toRecord);
        },
        providesTags: (_result, _error, type) => [{ type: TAG, id: `LIST-${type}` }],
      }),
      createDnManagement: builder.mutation<DnManagementRecord, CreateDnManagementRequest>({
        query: ({ type, ...body }) => ({
          url: typePath(type),
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => toRecord(unwrapBackendData<unknown>(response)),
        invalidatesTags: (_result, _error, arg) => [{ type: TAG, id: `LIST-${arg.type}` }],
      }),
    }),
  });

export const { useGetDnManagementByTypeQuery, useCreateDnManagementMutation } = dnManagementApiSlice;