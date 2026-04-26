import { apiSlice } from "@/lib/api/instance";

export type CustomerPoStatus = "Active" | "Completed" | "Cancelled" | "On Hold" | string;

export type CustomerPoItemDto = {
  item_uniq_code: string;
  quantity: number;
  uom?: string;
  delivery_date?: string;
};

export type CustomerPoDto = {
  id: string;
  po_number?: string;
  customer_id?: number;
  status?: CustomerPoStatus;
  contact_person?: string;
  delivery_address?: string;
  special_instructions?: string;
  created_by?: string;
  items?: CustomerPoItemDto[];
  // Some backends include customer relation; support it when present.
  customer?: { customer_name?: string; code?: string };
};

export type CreateCustomerPoRequest = {
  po_number: string;
  customer_id: number;
  contact_person?: string;
  delivery_address?: string;
  special_instructions?: string;
  created_by?: string;
  items: CustomerPoItemDto[];
};

export type DeliveryNoteStatus = "Planning" | "Active" | "In Production" | "Shipped" | "Confirmed" | string;

export type DeliveryNoteItemDto = {
  item_uniq_code: string;
  quantity: number;
  uom?: string;
};

export type DeliveryNoteDto = {
  id: string;
  dn_number?: string;
  customer_id?: number;
  delivery_date?: string;
  status?: DeliveryNoteStatus;
  contact_person?: string;
  delivery_address?: string;
  notes?: string;
  created_by?: string;
  items?: DeliveryNoteItemDto[];
  customer?: { customer_name?: string; code?: string };
};

export type CreateDeliveryNoteRequest = {
  dn_number: string;
  customer_id: number;
  delivery_date: string;
  contact_person?: string;
  delivery_address?: string;
  notes?: string;
  created_by?: string;
  items: DeliveryNoteItemDto[];
};

export type SpecialOrderDto = {
  id: string;
  so_number?: string;
  customer_id?: number | null;
  order_date?: string;
  special_instructions?: string;
  contact_person?: string;
  delivery_address?: string;
  created_by?: string;
  items?: Array<{ item_uniq_code: string; quantity: number; uom?: string; target_date?: string }>;
  customer?: { customer_name?: string; code?: string };
  status?: string;
};

export type CreateSpecialOrderRequest = {
  so_number: string;
  customer_id?: number | null;
  order_date: string;
  special_instructions?: string;
  contact_person?: string;
  delivery_address?: string;
  created_by?: string;
  items: Array<{ item_uniq_code: string; quantity: number; uom?: string; target_date?: string }>;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const getString = (record: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
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

export type Pagination = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type Paginated<T> = {
  items: T[];
  pagination: Pagination;
};

const normalizeObjectResponse = <T,>(response: unknown): T | null => {
  if (!isRecord(response)) return null;
  const data = response.data;
  if (isRecord(data)) return data as T;
  return null;
};

const normalizePaginatedResponse = <T,>(response: unknown): Paginated<T> => {
  const empty: Paginated<T> = {
    items: [],
    pagination: { total: 0, page: 1, limit: 20, total_pages: 1 },
  };

  if (!isRecord(response)) return empty;
  const data = response.data;
  if (!isRecord(data)) return empty;

  const itemsRaw = (data as UnknownRecord).items;
  const paginationRaw = (data as UnknownRecord).pagination;

  const items = Array.isArray(itemsRaw) ? (itemsRaw as T[]) : [];
  const paginationRecord = isRecord(paginationRaw) ? (paginationRaw as UnknownRecord) : {};

  return {
    items,
    pagination: {
      total: getNumber(paginationRecord, ["total"]) ?? empty.pagination.total,
      page: getNumber(paginationRecord, ["page"]) ?? empty.pagination.page,
      limit: getNumber(paginationRecord, ["limit"]) ?? empty.pagination.limit,
      total_pages:
        getNumber(paginationRecord, ["total_pages", "totalPages"]) ?? empty.pagination.total_pages,
    },
  };
};

export type CustomerOrderDocumentType = "PO" | "DN" | "SO" | string;

export type CustomerOrderItemRecord = {
  id: string;
  line_no: number;
  item_uniq_code: string;
  part_name: string;
  part_number: string;
  model: string | null;
  quantity: number;
  delivery_date: string | null;
};

export type CustomerOrderRecord = {
  id: string;
  document_type: CustomerOrderDocumentType;
  document_number: string;
  document_date: string;
  period_schedule?: string | null;
  customer_id: number;
  customer_name: string;
  contact_person: string | null;
  delivery_address: string | null;
  status: string;
  notes: string | null;
  total_quantity: number;
  total_uniq: number;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items: CustomerOrderItemRecord[];
};

export type CreateCustomerOrderRequest = {
  document_type: CustomerOrderDocumentType;
  customer_id: number;
  contact_person: string;
  delivery_address: string;
  notes: string;
  delivery_date?: string;
  items: Array<{ item_uniq_code: string; quantity: number; delivery_date?: string }>;
};

export type UpdateCustomerOrderRequest = {
  customer_id: number;
  contact_person: string;
  delivery_address: string;
  notes: string;
  delivery_date?: string;
  items: Array<{ item_uniq_code: string; quantity: number; delivery_date?: string }>;
};

const toCustomerOrderItemRecord = (raw: unknown): CustomerOrderItemRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: getString(record, ["id", "uuid"]) ?? "",
    line_no: getNumber(record, ["line_no", "lineNo"]) ?? 0,
    item_uniq_code: getString(record, ["item_uniq_code", "itemUniqCode"]) ?? "",
    part_name: getString(record, ["part_name", "partName"]) ?? "",
    part_number: getString(record, ["part_number", "partNumber"]) ?? "",
    model: getString(record, ["model"]) ?? null,
    quantity: getNumber(record, ["quantity", "qty"]) ?? 0,
    delivery_date: getString(record, ["delivery_date", "deliveryDate"]) ?? null,
  };
};

const toCustomerOrderRecord = (raw: unknown): CustomerOrderRecord => {
  const record = isRecord(raw) ? raw : {};
  const itemsRaw = Array.isArray(record.items) ? (record.items as unknown[]) : [];

  return {
    id: getString(record, ["id", "uuid"]) ?? "",
    document_type: getString(record, ["document_type", "documentType"]) ?? "",
    document_number: getString(record, ["document_number", "documentNumber"]) ?? "",
    document_date: getString(record, ["document_date", "documentDate"]) ?? "",
    period_schedule: getString(record, ["period_schedule", "periodSchedule"]) ?? null,
    customer_id: getNumber(record, ["customer_id", "customerId"]) ?? 0,
    customer_name: getString(record, ["customer_name", "customerName"]) ?? "",
    contact_person: getString(record, ["contact_person", "contactPerson"]) ?? null,
    delivery_address: getString(record, ["delivery_address", "deliveryAddress"]) ?? null,
    status: getString(record, ["status"]) ?? "",
    notes: getString(record, ["notes"]) ?? null,
    total_quantity: getNumber(record, ["total_quantity", "totalQuantity"]) ?? 0,
    total_uniq: getNumber(record, ["total_uniq", "totalUniq"]) ?? 0,
    created_by: getString(record, ["created_by", "createdBy"]) ?? null,
    created_at: getString(record, ["created_at", "createdAt"]) ?? null,
    updated_at: getString(record, ["updated_at", "updatedAt"]) ?? null,
    items: itemsRaw.map(toCustomerOrderItemRecord),
  };
};

const toCustomerPoDto = (order: CustomerOrderRecord): CustomerPoDto => {
  return {
    id: order.id,
    po_number: order.document_number,
    customer_id: order.customer_id,
    status: order.status,
    contact_person: order.contact_person ?? undefined,
    delivery_address: order.delivery_address ?? undefined,
    special_instructions: order.notes ?? undefined,
    created_by: order.created_by ?? undefined,
    customer: {
      customer_name: order.customer_name,
    },
    items: order.items.map((i) => ({
      item_uniq_code: i.item_uniq_code,
      quantity: i.quantity,
      uom: "Pcs",
      delivery_date: i.delivery_date ?? undefined,
    })),
  };
};

const toDeliveryNoteDto = (order: CustomerOrderRecord): DeliveryNoteDto => {
  const firstDeliveryDate = order.items[0]?.delivery_date ?? null;
  return {
    id: order.id,
    dn_number: order.document_number,
    customer_id: order.customer_id,
    delivery_date: firstDeliveryDate ?? order.document_date,
    status: order.status,
    contact_person: order.contact_person ?? undefined,
    delivery_address: order.delivery_address ?? undefined,
    notes: order.notes ?? undefined,
    created_by: order.created_by ?? undefined,
    customer: {
      customer_name: order.customer_name,
    },
    items: order.items.map((i) => ({
      item_uniq_code: i.item_uniq_code,
      quantity: i.quantity,
      uom: "Pcs",
    })),
  };
};

const toSpecialOrderDto = (order: CustomerOrderRecord): SpecialOrderDto => {
  const firstDeliveryDate = order.items[0]?.delivery_date ?? null;
  return {
    id: order.id,
    so_number: order.document_number,
    customer_id: order.customer_id,
    order_date: firstDeliveryDate ?? order.document_date,
    special_instructions: order.notes ?? undefined,
    contact_person: order.contact_person ?? undefined,
    delivery_address: order.delivery_address ?? undefined,
    created_by: order.created_by ?? undefined,
    customer: {
      customer_name: order.customer_name,
    },
    status: order.status,
    items: order.items.map((i) => ({
      item_uniq_code: i.item_uniq_code,
      quantity: i.quantity,
      uom: "Pcs",
      target_date: i.delivery_date ?? undefined,
    })),
  };
};

export const customerOrdersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listCustomerOrders: builder.query<Paginated<CustomerOrderRecord>, { document_type: CustomerOrderDocumentType; page: number; limit: number }>({
      query: ({ document_type, page, limit }) => ({
        url: "/customer-orders",
        method: "GET",
        params: { document_type, page, limit },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const normalized = normalizePaginatedResponse<unknown>(response);
        return {
          items: normalized.items.map(toCustomerOrderRecord),
          pagination: normalized.pagination,
        };
      },
    }),

    getCustomerOrderById: builder.query<CustomerOrderRecord, string>({
      query: (uuid) => ({
        url: `/customer-orders/${encodeURIComponent(uuid)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        toCustomerOrderRecord(normalizeObjectResponse<unknown>(response) ?? response),
    }),

    deleteCustomerOrder: builder.mutation<unknown, string>({
      query: (uuid) => ({
        url: `/customer-orders/${encodeURIComponent(uuid)}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    updateCustomerOrder: builder.mutation<unknown, { uuid: string; body: UpdateCustomerOrderRequest }>({
      query: ({ uuid, body }) => ({
        url: `/customer-orders/${encodeURIComponent(uuid)}`,
        method: "PUT",
        body,
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    // Keep existing UI hooks (PO/DN/SO) backed by /customer-orders
    listCustomerPos: builder.query<CustomerPoDto[], void>({
      query: () => ({
        url: "/customer-orders",
        method: "GET",
        params: { document_type: "PO", page: 1, limit: 200 },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizePaginatedResponse<unknown>(response).items.map((r) => toCustomerPoDto(toCustomerOrderRecord(r))),
    }),

    listDeliveryNotes: builder.query<DeliveryNoteDto[], void>({
      query: () => ({
        url: "/customer-orders",
        method: "GET",
        params: { document_type: "DN", page: 1, limit: 200 },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizePaginatedResponse<unknown>(response).items.map((r) => toDeliveryNoteDto(toCustomerOrderRecord(r))),
    }),

    listSpecialOrders: builder.query<SpecialOrderDto[], void>({
      query: () => ({
        url: "/customer-orders",
        method: "GET",
        params: { document_type: "SO", page: 1, limit: 200 },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) =>
        normalizePaginatedResponse<unknown>(response).items.map((r) => toSpecialOrderDto(toCustomerOrderRecord(r))),
    }),

    createCustomerPo: builder.mutation<CustomerOrderRecord, CreateCustomerPoRequest>({
      query: (body) => {
        const req: CreateCustomerOrderRequest = {
          document_type: "PO",
          customer_id: body.customer_id,
          contact_person: body.contact_person ?? "",
          delivery_address: body.delivery_address ?? "",
          notes: body.special_instructions ?? "",
          items: body.items.map((i) => ({
            item_uniq_code: i.item_uniq_code,
            quantity: Number(i.quantity),
            delivery_date: i.delivery_date,
          })),
        };

        return {
          url: "/customer-orders",
          method: "POST",
          meta: { useAuthorization: true, contentType: "application/json" },
          body: req,
        };
      },
      transformResponse: (response: unknown) =>
        toCustomerOrderRecord(normalizeObjectResponse<unknown>(response) ?? response),
    }),

    createDeliveryNote: builder.mutation<CustomerOrderRecord, CreateDeliveryNoteRequest>({
      query: (body) => {
        const req: CreateCustomerOrderRequest = {
          document_type: "DN",
          customer_id: body.customer_id,
          contact_person: body.contact_person ?? "",
          delivery_address: body.delivery_address ?? "",
          notes: body.notes ?? "",
          delivery_date: body.delivery_date,
          items: body.items.map((i) => ({
            item_uniq_code: i.item_uniq_code,
            quantity: Number(i.quantity),
          })),
        };
        return {
          url: "/customer-orders",
          method: "POST",
          meta: { useAuthorization: true, contentType: "application/json" },
          body: req,
        };
      },
      transformResponse: (response: unknown) =>
        toCustomerOrderRecord(normalizeObjectResponse<unknown>(response) ?? response),
    }),

    createSpecialOrder: builder.mutation<CustomerOrderRecord, CreateSpecialOrderRequest>({
      query: (body) => {
        const req: CreateCustomerOrderRequest = {
          document_type: "SO",
          customer_id: Number(body.customer_id ?? 0),
          contact_person: body.contact_person ?? "",
          delivery_address: body.delivery_address ?? "",
          notes: body.special_instructions ?? "",
          delivery_date: body.order_date,
          items: body.items.map((i) => ({
            item_uniq_code: i.item_uniq_code,
            quantity: Number(i.quantity),
          })),
        };
        return {
          url: "/customer-orders",
          method: "POST",
          meta: { useAuthorization: true, contentType: "application/json" },
          body: req,
        };
      },
      transformResponse: (response: unknown) =>
        toCustomerOrderRecord(normalizeObjectResponse<unknown>(response) ?? response),
    }),
  }),
});

export const {
  useCreateCustomerPoMutation,
  useListCustomerPosQuery,
  useCreateDeliveryNoteMutation,
  useListDeliveryNotesQuery,
  useCreateSpecialOrderMutation,
  useListSpecialOrdersQuery,
  useListCustomerOrdersQuery,
  useGetCustomerOrderByIdQuery,
  useUpdateCustomerOrderMutation,
  useDeleteCustomerOrderMutation,
} = customerOrdersApiSlice;
