import { apiSlice } from "@/lib/api/instance";

// RTK Query module for work-order automation failure logs (history logs).
// Backed by the MRP backend:
//   GET  /work-order-logs   list failed-automation rows (filter: wo_number, automation_job_id, search)
//   POST /work-order-logs   create a failed-automation row
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

export type WorkOrderLogRecord = {
  id: string;
  wo_number: string;
  automation_job_id: string;
  robot_name: string;
  row_no: number;
  item_uniq_code: string;
  part_name: string;
  description: string;
  qty: number;
  failure_reason: string;
  special_instructions: string;
  source: string;
  status: string;
  created_at: string | null;
};

export type ListWorkOrderLogParams = {
  wo_number?: string;
  automation_job_id?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type CreateWorkOrderLogRequest = {
  wo_number?: string;
  automation_job_id?: string;
  robot_name?: string;
  row_no?: number;
  item_uniq_code?: string;
  part_name?: string;
  description?: string;
  qty?: number;
  failure_reason: string;
  special_instructions?: string;
  source?: string;
};

const toLogRecord = (raw: unknown): WorkOrderLogRecord => {
  const r = isRecord(raw) ? raw : {};
  return {
    id: getString(r, ["id", "uuid"]) ?? "",
    wo_number: getString(r, ["wo_number", "woNumber"]) ?? "",
    automation_job_id:
      getString(r, ["automation_job_id", "automationJobId"]) ?? "",
    robot_name: getString(r, ["robot_name", "robotName"]) ?? "",
    row_no: getNumber(r, ["row_no", "rowNo"]) ?? 0,
    item_uniq_code: getString(r, ["item_uniq_code", "itemUniqCode"]) ?? "",
    part_name: getString(r, ["part_name", "partName"]) ?? "",
    description: getString(r, ["description"]) ?? "",
    qty: getNumber(r, ["qty", "quantity"]) ?? 0,
    failure_reason: getString(r, ["failure_reason", "failureReason"]) ?? "",
    special_instructions:
      getString(r, ["special_instructions", "specialInstructions"]) ?? "",
    source: getString(r, ["source"]) ?? "",
    status: getString(r, ["status"]) ?? "",
    created_at: getString(r, ["created_at", "createdAt"]) ?? null,
  };
};

const normalizeLogItems = (response: unknown): WorkOrderLogRecord[] => {
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

export const workOrderLogsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listWorkOrderLogs: builder.query<
      WorkOrderLogRecord[],
      ListWorkOrderLogParams | void
    >({
      query: (params) => ({
        url: "/work-order-logs",
        method: "GET",
        params: {
          wo_number: params?.wo_number || undefined,
          automation_job_id: params?.automation_job_id || undefined,
          search: params?.search || undefined,
          page: params?.page ?? 1,
          limit: params?.limit ?? 100,
        },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeLogItems(response),
    }),

    createWorkOrderLog: builder.mutation<unknown, CreateWorkOrderLogRequest>({
      query: (body) => ({
        url: "/work-order-logs",
        method: "POST",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),
  }),
});

export const { useListWorkOrderLogsQuery, useCreateWorkOrderLogMutation } =
  workOrderLogsApiSlice;
