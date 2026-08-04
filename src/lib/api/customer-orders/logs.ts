import { apiSlice } from "@/lib/api/instance";

// RTK Query module for customer-order automation failure logs.
// Backed by the MRP backend:
//   GET  /customer-order-logs   list failed-automation rows
//   POST /customer-order-logs   create a failed-automation row
//
// injectEndpoints auto-registers into the shared apiSlice, so no store change
// is needed — just import the generated hooks below.

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

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

export type CustomerOrderLogRecord = {
  id: string;
  document_number: string;
  row_no: number;
  item_uniq_code: string;
  part_name: string;
  description: string;
  qty_active: number;
  failure_reason: string;
  special_instructions: string;
  source: string;
  status: string;
  created_at: string | null;
};

export type ListLogParams = {
  document_number?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type CreateCustomerOrderLogRequest = {
  document_number?: string;
  row_no?: number;
  item_uniq_code?: string;
  part_name?: string;
  description?: string;
  qty_active?: number;
  failure_reason: string;
  special_instructions?: string;
  source?: string;
};

const toLogRecord = (raw: unknown): CustomerOrderLogRecord => {
  const r = isRecord(raw) ? raw : {};
  return {
    id: getString(r, ["id", "uuid"]) ?? "",
    document_number: getString(r, ["document_number", "documentNumber"]) ?? "",
    row_no: getNumber(r, ["row_no", "rowNo"]) ?? 0,
    item_uniq_code: getString(r, ["item_uniq_code", "itemUniqCode"]) ?? "",
    part_name: getString(r, ["part_name", "partName"]) ?? "",
    description: getString(r, ["description"]) ?? "",
    qty_active: getNumber(r, ["qty_active", "qtyActive"]) ?? 0,
    failure_reason: getString(r, ["failure_reason", "failureReason"]) ?? "",
    special_instructions:
      getString(r, ["special_instructions", "specialInstructions"]) ?? "",
    source: getString(r, ["source"]) ?? "",
    status: getString(r, ["status"]) ?? "",
    created_at: getString(r, ["created_at", "createdAt"]) ?? null,
  };
};

const normalizeLogItems = (response: unknown): CustomerOrderLogRecord[] => {
  if (Array.isArray(response)) return response.map(toLogRecord);
  if (!isRecord(response)) return [];

  const data = response.data;
  if (Array.isArray(data)) return data.map(toLogRecord);
  if (isRecord(data) && Array.isArray(data.items)) {
    return (data.items as unknown[]).map(toLogRecord);
  }
  if (Array.isArray(response.items)) {
    return (response.items as unknown[]).map(toLogRecord);
  }
  return [];
};

export const customerOrderLogsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listCustomerOrderLogs: builder.query<
      CustomerOrderLogRecord[],
      ListLogParams | void
    >({
      query: (params) => ({
        url: "/customer-order-logs",
        method: "GET",
        params: {
          document_number: params?.document_number || undefined,
          search: params?.search || undefined,
          page: params?.page ?? 1,
          limit: params?.limit ?? 100,
        },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeLogItems(response),
    }),

    createCustomerOrderLog: builder.mutation<
      unknown,
      CreateCustomerOrderLogRequest
    >({
      query: (body) => ({
        url: "/customer-order-logs",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),
  }),
});

export const {
  useListCustomerOrderLogsQuery,
  useCreateCustomerOrderLogMutation,
} = customerOrderLogsApiSlice;
