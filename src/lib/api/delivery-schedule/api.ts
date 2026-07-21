import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

const TAG = "DeliverySchedule" as const;

const ok = <T>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const getString = (
  record: UnknownRecord,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return undefined;
};

const getNumber = (
  record: UnknownRecord,
  keys: string[],
): number | undefined => {
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

const normalizePaginatedItems = (response: unknown): unknown[] => {
  if (!isRecord(response)) return [];
  const data = response.data;
  if (!isRecord(data)) return [];
  const items = (data as UnknownRecord).items;
  if (Array.isArray(items)) return items;
  if (
    isRecord((data as UnknownRecord).data) &&
    Array.isArray(((data as UnknownRecord).data as UnknownRecord).items)
  ) {
    return (
      (((data as UnknownRecord).data as UnknownRecord).items as unknown[]) ?? []
    );
  }
  return [];
};

const normalizeScheduleGroups = (
  response: unknown,
): DeliveryScheduleRecord[] => {
  if (!isRecord(response)) return [];

  let data: unknown = response.data;
  if (isRecord(data) && isRecord((data as UnknownRecord).data)) {
    data = (data as UnknownRecord).data;
  }
  if (!isRecord(data)) return [];

  const groups = (data as UnknownRecord).groups;
  if (!Array.isArray(groups)) return [];

  const records: DeliveryScheduleRecord[] = [];

  groups.forEach((group) => {
    if (!isRecord(group)) return;
    const deliveryDate =
      getString(group, ["delivery_date", "deliveryDate"]) ?? "";
    const rows = Array.isArray((group as UnknownRecord).items)
      ? ((group as UnknownRecord).items as unknown[])
      : [];

    rows.forEach((raw) => {
      if (!isRecord(raw)) return;
      const row = raw as UnknownRecord;

      records.push({
        id: getString(row, ["schedule_id", "scheduleId", "id"]) ?? "",
        deliveryDate,
        customerId: getNumber(row, ["customer_id", "customerId"]),
        customerName:
          getString(row, ["customer_name", "customerName", "customer"]) ?? "",
        poDnName:
          getString(row, [
            "po_dn_name",
            "poDnName",
            "customer_order_reference",
          ]) ?? "",
        cycle: getString(row, ["cycle"]) ?? "",
        priority: getString(row, ["priority"]) ?? undefined,
        // Prefer the schedule status; fall back to approval_status.
        status:
          getString(row, ["status", "approval_status", "approvalStatus"]) ??
          "pending",
        approvedBy: getString(row, ["approved_by", "approvedBy"]) ?? "",
        approvedAt: getString(row, ["approved_at", "approvedAt"]) ?? "",
        createdAt: getString(row, ["created_at", "createdAt"]) ?? "",
        updatedAt: getString(row, ["updated_at", "updatedAt"]) ?? "",
        items: [
          {
            uniq:
              getString(row, ["item_uniq_code", "uniq", "itemUniqCode"]) ?? "-",
            model: getString(row, ["model", "product_model"]) ?? "",
            partNo: getString(row, ["part_no", "partNo", "part_number"]) ?? "",
            partName: getString(row, ["part_name", "partName"]) ?? "",
            totalOrder: getNumber(row, ["total_order", "totalOrder"]) ?? 0,
            totalDelivery:
              getNumber(row, [
                "quantity",
                "total_delivery",
                "totalDelivery",
                "qty",
              ]) ?? 0,
            uom: getString(row, ["uom", "unit"]) ?? "",
          },
        ],
      });
    });
  });

  return records;
};

const normalizeInnerData = (response: unknown): unknown => {
  if (!isRecord(response)) return response;
  const data = response.data;
  if (!isRecord(data)) return response;
  if (isRecord((data as UnknownRecord).data))
    return (data as UnknownRecord).data;
  return data;
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
  customer_order_document_item_uuid: string;
  item_uniq_code: string;
  part_no: string;
  part_name: string;
  model: string;
  total_order: number;
  total_delivery: number;
  uom: string;
}

export interface CreateDeliveryScheduleRequest {
  customer_order_document_uuid: string;
  customer_order_reference: string;
  customer_id: number;
  customer_name: string;
  delivery_date: string;
  cycle: string;
  priority: string;
  transport_company: string;
  vehicle_number: string;
  driver_name: string;
  driver_contact: string;
  departure_at: string;
  arrival_at: string;
  delivery_instructions: string;
  items: DeliveryScheduleItemPayload[];
}

export interface UpdateDeliveryScheduleRequest {
  delivery_date?: string;
  cycle?: string;
  priority?: string;
  transport_company?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_contact?: string;
  departure_at?: string;
  arrival_at?: string;
  delivery_instructions?: string;
  items?: DeliveryScheduleItemPayload[];
}

export interface ApproveDeliveryScheduleRequest {
  schedule_id: string;
  notes: string;
  force_partial: boolean;
}

export interface ApproveBulkDeliveryScheduleRequest {
  delivery_date: string;
  schedule_ids: string[];
  notes: string;
  force_partial: boolean;
}

export interface ScanDnRobotRequest {
  dn_number: string;
}

export interface DeliveryScheduleItemRecord {
  uniq: string;
  model: string;
  partNo: string;
  partName: string;
  totalOrder: number;
  totalDelivery: number;
  uom: string;
}

export interface DeliveryScheduleRecord {
  id: string;
  deliveryDate: string;
  customerId?: number;
  customerName: string;
  poDnName: string;
  cycle: string;
  priority?: string;
  status: string;
  approvedBy: string;
  approvedAt: string;
  createdAt: string;
  updatedAt: string;
  items: DeliveryScheduleItemRecord[];
}

export type DeliveryScheduleSummary = {
  total_deliveries: number;
  in_transit: number;
  pending_approval: number;
  dn_created: number;
};

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

export interface CustomerDeliveryNoteDetailItem {
  dnItemId: string;
  itemUniqCode: string;
  partName: string;
  partNumber: string;
  model: string;
  quantity: number;
  uom: string;
  fgLocation: string;
  packingNumber: string;
  qr: string;
}

export interface CustomerDeliveryNoteDetail {
  dnId: string;
  dnNumber: string;
  scheduleId: string;
  customerId?: number;
  customerName: string;
  poNumber: string;
  customerContactPerson: string;
  customerPhoneNumber: string;
  deliveryAddress: string;
  deliveryDate: string;
  priority: string;
  status: string;
  approvalStatus: string;
  transportCompany: string;
  vehicleNumber: string;
  driverName: string;
  driverContact: string;
  departureAt?: string;
  arrivalAt?: string;
  deliveryInstructions: string;
  totalItems: number;
  totalQuantity: number;
  createdBy: string;
  items: CustomerDeliveryNoteDetailItem[];
}

export interface ApprovedDeliveryScheduleDnItem {
  itemUniqCode: string;
  productName: string;
  partNumber: string;
  model: string;
  fgLocation: string;
  quantity: number;
  uom: string;
}

export interface ApprovedDeliveryScheduleDnOption {
  scheduleId: string;
  dnId: string;
  dnNumber: string;
  scheduleDate: string;
  deliveryDate: string;
  customerId?: number;
  customerName: string;
  poNumber: string;
  customerContactPerson: string;
  customerPhoneNumber: string;
  deliveryAddress: string;
  priority: string;
  transportCompany: string;
  vehicleNumber: string;
  driverName: string;
  driverContact: string;
  departureAt?: string;
  arrivalAt?: string;
  deliveryInstructions: string;
  items: ApprovedDeliveryScheduleDnItem[];
}

export interface ApprovedDeliveryScheduleDnAutocompleteResponse {
  items: ApprovedDeliveryScheduleDnOption[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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
    uniq: getString(record, ["item_uniq_code", "uniq", "itemUniqCode"]) ?? "-",
    model: getString(record, ["model", "product_model", "productModel"]) ?? "",
    partNo:
      getString(record, ["part_no", "partNo", "part_number", "partNumber"]) ??
      "",
    partName: getString(record, ["part_name", "partName"]) ?? "",
    totalOrder:
      getNumber(record, ["total_order", "totalOrder", "quantity", "qty"]) ?? 0,
    totalDelivery: getNumber(record, ["total_delivery", "totalDelivery"]) ?? 0,
    uom: getString(record, ["uom", "unit"]) ?? "",
  };
};

const toRecord = (raw: unknown): DeliveryScheduleRecord => {
  const record = isRecord(raw) ? raw : {};
  const itemsRaw = Array.isArray(record.items) ? record.items : [];

  return {
    id: getString(record, ["id", "schedule_id", "uuid"]) ?? "",
    deliveryDate: getString(record, ["delivery_date", "deliveryDate"]) ?? "",
    customerId: getNumber(record, ["customer_id", "customerId"]),
    customerName:
      getString(record, ["customer_name", "customerName", "customer"]) ?? "",
    poDnName:
      getString(record, [
        "customer_order_reference",
        "po_dn_name",
        "poDnName",
        "po_number",
        "poNumber",
      ]) ?? "",
    cycle: getString(record, ["cycle"]) ?? "",
    priority: getString(record, ["priority"]) ?? undefined,
    status:
      getString(record, ["status", "approval_status", "approvalStatus"]) ??
      "pending",
    approvedBy:
      getString(record, ["approved_by", "approvedBy", "admin_name"]) ?? "",
    approvedAt: getString(record, ["approved_at", "approvedAt"]) ?? "",
    createdAt: getString(record, ["created_at", "createdAt"]) ?? "",
    updatedAt: getString(record, ["updated_at", "updatedAt"]) ?? "",
    items: itemsRaw.map(toItem),
  };
};

const toDnCreationRecord = (raw: unknown): DeliveryScheduleDnCreationRecord => {
  const record = isRecord(raw) ? raw : {};

  return {
    id: getString(record, ["dn_id", "id", "uuid"]) ?? "",
    dnNumber: getString(record, ["dn_number", "dnNumber"]) ?? "",
    dnDate:
      getString(record, [
        "delivery_date",
        "dn_date",
        "dnDate",
        "deliveryDate",
      ]) ?? "",
    customerName: getString(record, ["customer_name", "customerName"]) ?? "",
    customerPo: getString(record, ["po_number", "poNumber"]) ?? "",
    poDnName: getString(record, ["po_dn_name", "poDnName"]) ?? "",
    partTitle: getString(record, ["part_name", "partTitle", "part_name"]) ?? "",
    uniq: getString(record, ["item_uniq_code", "uniq"]) ?? "",
    model: getString(record, ["model"]) ?? "",
    partNo: getString(record, ["part_number", "part_no", "partNo"]) ?? "",
    partName: getString(record, ["part_name", "partName"]) ?? "",
    quantity: getNumber(record, ["quantity", "qty"]) ?? 0,
    uom: getString(record, ["uom", "unit"]) ?? "",
    fgLocation: getString(record, ["fg_location", "fgLocation"]) ?? "",
    qrCode: getString(record, ["qr_code", "qrCode"]) ?? "",
    packingList:
      getString(record, [
        "packing_list_number",
        "packing_list",
        "packingList",
      ]) ?? "",
    status: getString(record, ["status"]) ?? "",
    statusHint: getString(record, ["approval_status", "notes"]) ?? "",
    createdAt: getString(record, ["created_at", "createdAt"]) ?? "",
    updatedAt: getString(record, ["updated_at", "updatedAt"]) ?? "",
  };
};

const toCustomerDeliveryNoteDetail = (raw: unknown): CustomerDeliveryNoteDetail => {
  const record = isRecord(raw) ? raw : {};
  const rawItems = Array.isArray(record.items) ? record.items : [];

  return {
    dnId: getString(record, ["dn_id", "dnId", "id"]) ?? "",
    dnNumber: getString(record, ["dn_number", "dnNumber"]) ?? "",
    scheduleId: getString(record, ["schedule_id", "scheduleId"]) ?? "",
    customerId: getNumber(record, ["customer_id", "customerId"]),
    customerName: getString(record, ["customer_name", "customerName"]) ?? "",
    poNumber: getString(record, ["po_number", "poNumber"]) ?? "",
    customerContactPerson: getString(record, ["customer_contact_person", "customerContactPerson"]) ?? "",
    customerPhoneNumber: getString(record, ["customer_phone_number", "customerPhoneNumber"]) ?? "",
    deliveryAddress: getString(record, ["delivery_address", "deliveryAddress"]) ?? "",
    deliveryDate: getString(record, ["delivery_date", "deliveryDate"]) ?? "",
    priority: getString(record, ["priority"]) ?? "",
    status: getString(record, ["status"]) ?? "",
    approvalStatus: getString(record, ["approval_status", "approvalStatus"]) ?? "",
    transportCompany: getString(record, ["transport_company", "transportCompany"]) ?? "",
    vehicleNumber: getString(record, ["vehicle_number", "vehicleNumber"]) ?? "",
    driverName: getString(record, ["driver_name", "driverName"]) ?? "",
    driverContact: getString(record, ["driver_contact", "driverContact"]) ?? "",
    departureAt: getString(record, ["departure_at", "departureAt"]),
    arrivalAt: getString(record, ["arrival_at", "arrivalAt"]),
    deliveryInstructions: getString(record, ["delivery_instructions", "deliveryInstructions"]) ?? "",
    totalItems: getNumber(record, ["total_items", "totalItems"]) ?? 0,
    totalQuantity: getNumber(record, ["total_quantity", "totalQuantity"]) ?? 0,
    createdBy: getString(record, ["created_by", "createdBy"]) ?? "",
    items: rawItems.map((item) => {
      const itemRecord = isRecord(item) ? item : {};
      return {
        dnItemId: getString(itemRecord, ["dn_item_id", "dnItemId", "id"]) ?? "",
        itemUniqCode: getString(itemRecord, ["item_uniq_code", "itemUniqCode"]) ?? "",
        partName: getString(itemRecord, ["part_name", "partName", "product_name", "productName"]) ?? "",
        partNumber: getString(itemRecord, ["part_number", "partNumber", "part_no", "partNo"]) ?? "",
        model: getString(itemRecord, ["model"]) ?? "",
        quantity: getNumber(itemRecord, ["quantity", "qty"]) ?? 0,
        uom: getString(itemRecord, ["uom", "unit"]) ?? "",
        fgLocation: getString(itemRecord, ["fg_location", "fgLocation"]) ?? "",
        packingNumber: getString(itemRecord, ["packing_number", "packingNumber"]) ?? "",
        qr: getString(itemRecord, ["qr", "qr_code", "qrCode"]) ?? "",
      };
    }),
  };
};

const toApprovedDeliveryScheduleDnOption = (raw: unknown): ApprovedDeliveryScheduleDnOption => {
  const record = isRecord(raw) ? raw : {};
  const rawItems = Array.isArray(record.items) ? record.items : [];

  return {
    scheduleId: getString(record, ["schedule_id", "scheduleId"]) ?? "",
    dnId: getString(record, ["dn_id", "dnId", "id"]) ?? "",
    dnNumber: getString(record, ["dn_number", "dnNumber"]) ?? "",
    scheduleDate: getString(record, ["schedule_date", "scheduleDate"]) ?? "",
    deliveryDate: getString(record, ["delivery_date", "deliveryDate"]) ?? "",
    customerId: getNumber(record, ["customer_id", "customerId"]),
    customerName: getString(record, ["customer_name", "customerName"]) ?? "",
    poNumber: getString(record, ["po_number", "poNumber"]) ?? "",
    customerContactPerson: getString(record, ["customer_contact_person", "customerContactPerson"]) ?? "",
    customerPhoneNumber: getString(record, ["customer_phone_number", "customerPhoneNumber"]) ?? "",
    deliveryAddress: getString(record, ["delivery_address", "deliveryAddress"]) ?? "",
    priority: getString(record, ["priority"]) ?? "normal",
    transportCompany: getString(record, ["transport_company", "transportCompany"]) ?? "",
    vehicleNumber: getString(record, ["vehicle_number", "vehicleNumber"]) ?? "",
    driverName: getString(record, ["driver_name", "driverName"]) ?? "",
    driverContact: getString(record, ["driver_contact", "driverContact"]) ?? "",
    departureAt: getString(record, ["departure_at", "departureAt"]),
    arrivalAt: getString(record, ["arrival_at", "arrivalAt"]),
    deliveryInstructions: getString(record, ["delivery_instructions", "deliveryInstructions"]) ?? "",
    items: rawItems.map((item) => {
      const itemRecord = isRecord(item) ? item : {};
      return {
        itemUniqCode: getString(itemRecord, ["item_uniq_code", "itemUniqCode"]) ?? "",
        productName: getString(itemRecord, ["product_name", "productName", "part_name", "partName"]) ?? "",
        partNumber: getString(itemRecord, ["part_number", "partNumber"]) ?? "",
        model: getString(itemRecord, ["model"]) ?? "",
        fgLocation: getString(itemRecord, ["fg_location", "fgLocation"]) ?? "",
        quantity: getNumber(itemRecord, ["quantity", "qty"]) ?? 0,
        uom: getString(itemRecord, ["uom", "unit"]) ?? "",
      };
    }),
  };
};

const normalizeApprovedDeliveryScheduleDnAutocomplete = (response: unknown): ApprovedDeliveryScheduleDnAutocompleteResponse => {
  const data = normalizeInnerData(response);
  const record = isRecord(data) ? data : {};
  const pagination = isRecord(record.pagination) ? record.pagination : {};
  const rawItems = Array.isArray(record.items) ? record.items : [];

  return {
    items: rawItems.map(toApprovedDeliveryScheduleDnOption).filter((item) => Boolean(item.dnNumber)),
    pagination: {
      total: getNumber(pagination, ["total"]) ?? 0,
      page: getNumber(pagination, ["page"]) ?? 1,
      limit: getNumber(pagination, ["limit"]) ?? 20,
      totalPages: getNumber(pagination, ["total_pages", "totalPages"]) ?? 0,
    },
  };
};

const toScanDnRobotResponse = (raw: unknown): ScanDnRobotResponse => {
  const record = isRecord(raw) ? raw : {};

  return {
    dnNumber: getString(record, ["dn_number", "dnNumber"]) ?? "",
    status: getString(record, ["status"]) ?? "success",
    message: getString(record, ["message"]) ?? "OK",
    processedAt:
      getString(record, [
        "processed_at",
        "processedAt",
        "updated_at",
        "updatedAt",
      ]) ?? "",
    data: record.data,
  };
};

export const deliveryScheduleSlice = apiSlice
  .enhanceEndpoints({
    addTagTypes: [TAG],
  })
  .injectEndpoints({
    endpoints: (builder) => ({
      getDeliverySchedules: builder.query<
        ApiResponse<DeliveryScheduleRecord[]>,
        { status?: string; page?: number; limit?: number } | void
      >({
        query: (arg) => ({
          url: "/delivery-schedules",
          method: "GET",
          params: isRecord(arg)
            ? {
                status: getString(arg, ["status"]) ?? undefined,
                page: getNumber(arg, ["page"]) ?? 1,
                limit: getNumber(arg, ["limit"]) ?? 20,
              }
            : { status: "scheduled", page: 1, limit: 20 },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(normalizeScheduleGroups(response)),
        providesTags: (result) => [
          { type: TAG, id: "LIST" },
          ...(result?.data ?? [])
            .filter((item) => item.id)
            .map((item) => ({ type: TAG, id: item.id })),
        ],
      }),

      getDeliverySchedulesSummary: builder.query<
        ApiResponse<DeliveryScheduleSummary>,
        void
      >({
        query: () => ({
          url: "/delivery-schedules/summary",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const data = normalizeInnerData(response);
          const r = isRecord(data) ? (data as UnknownRecord) : {};
          return ok({
            total_deliveries:
              getNumber(r, ["total_deliveries", "totalDeliveries"]) ?? 0,
            in_transit: getNumber(r, ["in_transit", "inTransit"]) ?? 0,
            pending_approval:
              getNumber(r, ["pending_approval", "pendingApproval"]) ?? 0,
            dn_created: getNumber(r, ["dn_created", "dnCreated"]) ?? 0,
          });
        },
        providesTags: [{ type: TAG, id: "SUMMARY" }],
      }),

      getApprovedDeliveryScheduleDnAutocomplete: builder.query<
        ApiResponse<ApprovedDeliveryScheduleDnAutocompleteResponse>,
        { search?: string; page?: number; limit?: number } | void
      >({
        query: (arg) => ({
          url: "/delivery-schedules/form-options/dn",
          method: "GET",
          params: isRecord(arg)
            ? {
                search: getString(arg, ["search"]) ?? undefined,
                page: getNumber(arg, ["page"]) ?? 1,
                limit: getNumber(arg, ["limit"]) ?? 10,
              }
            : { page: 1, limit: 10 },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => ok(normalizeApprovedDeliveryScheduleDnAutocomplete(response)),
        providesTags: [{ type: TAG, id: "APPROVED-DN-AUTOCOMPLETE" }],
      }),

      getDeliveryScheduleDnCreationList: builder.query<
        ApiResponse<DeliveryScheduleDnCreationRecord[]>,
        { page?: number; limit?: number } | void
      >({
        query: (arg) => ({
          url: "/customer-delivery-notes",
          method: "GET",
          params: isRecord(arg)
            ? {
                page: getNumber(arg, ["page"]) ?? 1,
                limit: getNumber(arg, ["limit"]) ?? 20,
              }
            : { page: 1, limit: 20 },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(
            normalizePaginatedItems(response).map((item) =>
              toDnCreationRecord(item),
            ),
          ),
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
          url: "/delivery-schedules",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(toRecord(normalizeObjectResponse(response))),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      updateDeliverySchedule: builder.mutation<
        ApiResponse<DeliveryScheduleRecord>,
        { id: string; body: UpdateDeliveryScheduleRequest }
      >({
        query: ({ id, body }) => ({
          url: `/delivery-schedules/${encodeURIComponent(id)}`,
          method: "PATCH",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(toRecord(normalizeObjectResponse(response))),
        invalidatesTags: (_result, _error, { id }) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id },
        ],
      }),

      approveDeliverySchedule: builder.mutation<
        ApiResponse<DeliveryScheduleRecord>,
        ApproveDeliveryScheduleRequest
      >({
        query: ({ schedule_id, ...body }) => ({
          url: `/delivery-schedules/${encodeURIComponent(schedule_id)}/approve`,
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(toRecord(normalizeObjectResponse(response))),
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
          url: "/delivery-schedules/approve-partial",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(normalizePaginatedItems(response).map((item) => toRecord(item))),
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
          url: "/customer-delivery/scans",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          ok(toScanDnRobotResponse(normalizeObjectResponse(response))),
        invalidatesTags: [{ type: TAG, id: "DN-CREATION-LIST" }],
      }),

      getCustomerDeliveryNoteById: builder.query<CustomerDeliveryNoteDetail, string>({
        query: (id) => ({
          url: `/customer-delivery-notes/${encodeURIComponent(String(id))}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => toCustomerDeliveryNoteDetail(normalizeInnerData(response)),
        providesTags: (_res, _err, id) => [{ type: TAG, id: `DN-${id}` }],
      }),

      createCustomerDeliveryNote: builder.mutation<unknown, unknown>({
        query: (body) => ({
          url: "/customer-delivery-notes",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: [
          { type: TAG, id: "DN-CREATION-LIST" },
          { type: TAG, id: "SUMMARY" },
        ],
      }),
    }),
  });

export const {
  useGetDeliverySchedulesQuery,
  useGetDeliverySchedulesSummaryQuery,
  useGetApprovedDeliveryScheduleDnAutocompleteQuery,
  useLazyGetApprovedDeliveryScheduleDnAutocompleteQuery,
  useGetDeliveryScheduleDnCreationListQuery,
  useCreateDeliveryScheduleMutation,
  useUpdateDeliveryScheduleMutation,
  useApproveDeliveryScheduleMutation,
  useApproveBulkDeliveryScheduleMutation,
  useScanDeliveryScheduleDnRobotMutation,
  useGetCustomerDeliveryNoteByIdQuery,
  useCreateCustomerDeliveryNoteMutation,
} = deliveryScheduleSlice;
