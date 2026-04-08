import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";

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
  created_by?: string;
  items?: DeliveryNoteItemDto[];
  customer?: { customer_name?: string; code?: string };
};

export type CreateDeliveryNoteRequest = {
  dn_number: string;
  customer_id: number;
  delivery_date: string;
  created_by?: string;
  items: DeliveryNoteItemDto[];
};

export type SpecialOrderDto = {
  id: string;
  so_number?: string;
  customer_id?: number | null;
  order_date?: string;
  special_instructions?: string;
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
  created_by?: string;
  items: Array<{ item_uniq_code: string; quantity: number; uom?: string; target_date?: string }>;
};

export const customerOrdersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Customer PO
    createCustomerPo: builder.mutation<unknown, CreateCustomerPoRequest>({
      query: (body) => ({
        url: "/api/customer-po/create",
        method: "POST",
        meta: { useAuthorization: true, contentType: "application/json" },
        body,
      }),
    }),

    listCustomerPos: builder.query<CustomerPoDto[], void>({
      query: () => ({
        url: "/api/customer-po/list",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const list = unwrapBackendData<CustomerPoDto[]>(response);
        return Array.isArray(list) ? list : [];
      },
    }),

    patchCustomerPoStatus: builder.mutation<unknown, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `/api/customer-po/${encodeURIComponent(id)}/status`,
        method: "PATCH",
        meta: { useAuthorization: true, contentType: "application/json" },
        body: { status },
      }),
    }),

    // Delivery Notes
    createDeliveryNote: builder.mutation<unknown, CreateDeliveryNoteRequest>({
      query: (body) => ({
        url: "/api/delivery-notes/create",
        method: "POST",
        meta: { useAuthorization: true, contentType: "application/json" },
        body,
      }),
    }),

    listDeliveryNotes: builder.query<DeliveryNoteDto[], void>({
      query: () => ({
        url: "/api/delivery-notes/list",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const list = unwrapBackendData<DeliveryNoteDto[]>(response);
        return Array.isArray(list) ? list : [];
      },
    }),

    patchDeliveryNoteStatus: builder.mutation<unknown, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `/api/delivery-notes/${encodeURIComponent(id)}/status`,
        method: "PATCH",
        meta: { useAuthorization: true, contentType: "application/json" },
        body: { status },
      }),
    }),

    // Special Order
    createSpecialOrder: builder.mutation<unknown, CreateSpecialOrderRequest>({
      query: (body) => ({
        url: "/api/special-order/create",
        method: "POST",
        meta: { useAuthorization: true, contentType: "application/json" },
        body,
      }),
    }),

    listSpecialOrders: builder.query<SpecialOrderDto[], void>({
      query: () => ({
        url: "/api/special-order/list",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const list = unwrapBackendData<SpecialOrderDto[]>(response);
        return Array.isArray(list) ? list : [];
      },
    }),
  }),
});

export const {
  useCreateCustomerPoMutation,
  useListCustomerPosQuery,
  usePatchCustomerPoStatusMutation,
  useCreateDeliveryNoteMutation,
  useListDeliveryNotesQuery,
  usePatchDeliveryNoteStatusMutation,
  useCreateSpecialOrderMutation,
  useListSpecialOrdersQuery,
} = customerOrdersApiSlice;
