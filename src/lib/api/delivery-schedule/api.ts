import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

const TAG = "DeliverySchedule" as const;

const ok = <T,>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

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

const normalizeListResponse = (response: unknown): unknown[] => {
  if (Array.isArray(response)) return response;
  if (!isRecord(response)) return [];

  if (Array.isArray(response.data)) return response.data;

  if (isRecord(response.data)) {
    if (Array.isArray(response.data.data)) return response.data.data;
    if (Array.isArray(response.data.items)) return response.data.items;
    if (Array.isArray(response.data.schedules)) return response.data.schedules;
  }

  return [];
};

const normalizeObjectResponse = (response: unknown): unknown => {
  if (!isRecord(response)) return response;

  if (isRecord(response.data)) {
    if (isRecord(response.data.data)) return response.data.data;
    return response.data;
  }

  return response;
};

export interface DeliveryScheduleItemPayload {
  uniq: string;
  model: string;
  part_no: string;
  part_name: string;
  quantity: number;
  uom: string;
}

export interface CreateDeliveryScheduleRequest {
  delivery_date: string;
  customer_id: number;
  po_dn_name: string;
  cycle: string;
  items: DeliveryScheduleItemPayload[];
}

export interface UpdateDeliveryScheduleRequest {
  delivery_date?: string;
  customer_id?: number;
  po_dn_name?: string;
  cycle?: string;
  items?: DeliveryScheduleItemPayload[];
}

export interface ApproveDeliveryScheduleRequest {
  schedule_id: string;
  admin_name: string;
}

export interface ApproveBulkDeliveryScheduleRequest {
  schedule_ids: string[];
  admin_name: string;
}

export interface ScanDnRobotRequest {
  dn_number: string;
}

export interface DeliveryScheduleItemRecord {
  uniq: string;
  model: string;
  partNo: string;
  partName: string;
  quantity: number;
  uom: string;
}

export interface DeliveryScheduleRecord {
  id: string;
  deliveryDate: string;
  customerId?: number;
  customerName: string;
  poDnName: string;
  cycle: string;
  status: string;
  approvedBy: string;
  approvedAt: string;
  createdAt: string;
  updatedAt: string;
  items: DeliveryScheduleItemRecord[];
}

export interface DeliveryScheduleDnCreationRecord {
  id: string;
  dnNumber: string;
  dnDate: string;
  customerName: string;
  customerPo: string;
  poDnName: string;
  partTitle: string;
  uniq: string;
  model: string;
  partNo: string;
  partName: string;
  quantity: number;
  uom: string;
  fgLocation: string;
  qrCode: string;
  packingList: string;
  status: string;
  statusHint: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScanDnRobotResponse {
  dnNumber: string;
  status: string;
  message: string;
  processedAt: string;
  data: unknown;
}

const toItem = (raw: unknown): DeliveryScheduleItemRecord => {
  const record = isRecord(raw) ? raw : {};

  return {
    uniq: getString(record, ["uniq", "item_uniq_code"]) ?? "-",
    model: getString(record, ["model", "product_model"]) ?? "",
    partNo: getString(record, ["part_no", "partNo"]) ?? "",
    partName: getString(record, ["part_name", "partName"]) ?? "",
    quantity: getNumber(record, ["quantity", "qty"]) ?? 0,
    uom: getString(record, ["uom"]) ?? "",
  };
};

const toRecord = (raw: unknown): DeliveryScheduleRecord => {
  const record = isRecord(raw) ? raw : {};
  const itemsRaw = Array.isArray(record.items) ? record.items : [];

  return {
    id: getString(record, ["id", "schedule_id", "uuid"]) ?? "",
    deliveryDate: getString(record, ["delivery_date", "deliveryDate"]) ?? "",
    customerId: getNumber(record, ["customer_id", "customerId"]),
    customerName: getString(record, ["customer_name", "customerName", "customer"]) ?? "",
    poDnName: getString(record, ["po_dn_name", "poDnName"]) ?? "",
    cycle: getString(record, ["cycle"]) ?? "",
    status: getString(record, ["status", "approval_status", "approvalStatus"]) ?? "pending",
    approvedBy: getString(record, ["approved_by", "approvedBy", "admin_name"]) ?? "",
    approvedAt: getString(record, ["approved_at", "approvedAt"]) ?? "",
    createdAt: getString(record, ["created_at", "createdAt"]) ?? "",
    updatedAt: getString(record, ["updated_at", "updatedAt"]) ?? "",
    items: itemsRaw.map(toItem),
  };
};

const toDnCreationRecord = (raw: unknown): DeliveryScheduleDnCreationRecord => {
  const record = isRecord(raw) ? raw : {};

  return {
    id: getString(record, ["id", "dn_id", "uuid", "dn_number"]) ?? "",
    dnNumber: getString(record, ["dn_number", "dnNumber"]) ?? "",
    dnDate: getString(record, ["dn_date", "dnDate", "delivery_date", "deliveryDate"]) ?? "",
    customerName: getString(record, ["customer_name", "customerName", "customer"]) ?? "",
    customerPo: getString(record, ["customer_po", "customerPo", "po_number", "poNumber"]) ?? "",
    poDnName: getString(record, ["po_dn_name", "poDnName"]) ?? "",
    partTitle: getString(record, ["part_title", "partTitle", "part_name", "partName"]) ?? "",
    uniq: getString(record, ["uniq", "item_uniq_code"]) ?? "",
    model: getString(record, ["model", "product_model"]) ?? "",
    partNo: getString(record, ["part_no", "partNo"]) ?? "",
    partName: getString(record, ["part_name", "partName"]) ?? "",
    quantity: getNumber(record, ["quantity", "qty"]) ?? 0,
    uom: getString(record, ["uom"]) ?? "",
    fgLocation: getString(record, ["fg_location", "fgLocation", "location"]) ?? "",
    qrCode: getString(record, ["qr_code", "qrCode"]) ?? "",
    packingList: getString(record, ["packing_list", "packingList"]) ?? "",
    status: getString(record, ["status", "scan_status", "scanStatus"]) ?? "",
    statusHint: getString(record, ["status_hint", "statusHint", "remark", "notes"]) ?? "",
    createdAt: getString(record, ["created_at", "createdAt"]) ?? "",
    updatedAt: getString(record, ["updated_at", "updatedAt"]) ?? "",
  };
};

const toScanDnRobotResponse = (raw: unknown): ScanDnRobotResponse => {
  const record = isRecord(raw) ? raw : {};

  return {
    dnNumber: getString(record, ["dn_number", "dnNumber"]) ?? "",
    status: getString(record, ["status"]) ?? "success",
    message: getString(record, ["message"]) ?? "OK",
    processedAt: getString(record, ["processed_at", "processedAt", "updated_at", "updatedAt"]) ?? "",
    data: record.data,
  };
};

export const deliveryScheduleSlice = apiSlice
  .enhanceEndpoints({
    addTagTypes: [TAG],
  })
  .injectEndpoints({
    endpoints: (builder) => ({
      getDeliverySchedules: builder.query<ApiResponse<DeliveryScheduleRecord[]>, void>({
        query: () => ({
          url: "/api/delivery-schedule/schedules",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(normalizeListResponse(response).map((item) => toRecord(item))),
        providesTags: (result) => [
          { type: TAG, id: "LIST" },
          ...(result?.data ?? [])
            .filter((item) => item.id)
            .map((item) => ({ type: TAG, id: item.id })),
        ],
      }),

      getDeliveryScheduleDnCreationList: builder.query<
        ApiResponse<DeliveryScheduleDnCreationRecord[]>,
        void
      >({
        query: () => ({
          url: "/api/delivery-schedule/dn-creation",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(normalizeListResponse(response).map((item) => toDnCreationRecord(item))),
        providesTags: (result) => [
          { type: TAG, id: "DN-CREATION-LIST" },
          ...(result?.data ?? [])
            .filter((item) => item.id)
            .map((item) => ({ type: TAG, id: `DN-${item.id}` })),
        ],
      }),

      createDeliverySchedule: builder.mutation<
        ApiResponse<DeliveryScheduleRecord>,
        CreateDeliveryScheduleRequest
      >({
        query: (body) => ({
          url: "/api/delivery-schedule/schedules",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(toRecord(normalizeObjectResponse(response))),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      updateDeliverySchedule: builder.mutation<
        ApiResponse<DeliveryScheduleRecord>,
        { id: string; body: UpdateDeliveryScheduleRequest }
      >({
        query: ({ id, body }) => ({
          url: `/api/delivery-schedule/schedules/${encodeURIComponent(id)}`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(toRecord(normalizeObjectResponse(response))),
        invalidatesTags: (_result, _error, { id }) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id },
        ],
      }),

      approveDeliverySchedule: builder.mutation<
        ApiResponse<DeliveryScheduleRecord>,
        ApproveDeliveryScheduleRequest
      >({
        query: (body) => ({
          url: "/api/delivery-schedule/schedules/approve",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(toRecord(normalizeObjectResponse(response))),
        invalidatesTags: (_result, _error, { schedule_id }) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: schedule_id },
        ],
      }),

      approveBulkDeliverySchedule: builder.mutation<
        ApiResponse<DeliveryScheduleRecord[]>,
        ApproveBulkDeliveryScheduleRequest
      >({
        query: (body) => ({
          url: "/api/delivery-schedule/schedules/approve-bulk",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(normalizeListResponse(response).map((item) => toRecord(item))),
        invalidatesTags: (_result, _error, { schedule_ids }) => [
          { type: TAG, id: "LIST" },
          ...schedule_ids.map((id) => ({ type: TAG, id })),
        ],
      }),

      scanDeliveryScheduleDnRobot: builder.mutation<
        ApiResponse<ScanDnRobotResponse>,
        ScanDnRobotRequest
      >({
        query: (body) => ({
          url: "/api/delivery-schedule/scan-mode/process",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(toScanDnRobotResponse(normalizeObjectResponse(response))),
        invalidatesTags: [{ type: TAG, id: "DN-CREATION-LIST" }],
      }),
    }),
  });

export const {
  useGetDeliverySchedulesQuery,
  useGetDeliveryScheduleDnCreationListQuery,
  useCreateDeliveryScheduleMutation,
  useUpdateDeliveryScheduleMutation,
  useApproveDeliveryScheduleMutation,
  useApproveBulkDeliveryScheduleMutation,
  useScanDeliveryScheduleDnRobotMutation,
} = deliveryScheduleSlice;