import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const TAG = "WorkOrdersBulk" as const;

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
      total_pages: getNumber(paginationRecord, ["total_pages", "totalPages"]) ?? empty.pagination.total_pages,
    },
  };
};

const normalizeArrayResponse = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (isRecord(response)) {
    const data = response.data;
    if (Array.isArray(data)) return data as T[];
    if (isRecord(data)) {
      const items = (data as UnknownRecord).items;
      if (Array.isArray(items)) return items as T[];
      const nested = (data as UnknownRecord).data;
      if (Array.isArray(nested)) return nested as T[];
      if (isRecord(nested) && Array.isArray((nested as UnknownRecord).items)) {
        return (nested as UnknownRecord).items as T[];
      }
    }
  }
  return [];
};

const normalizeObjectResponse = <T,>(response: unknown): T | null => {
  if (isRecord(response)) {
    const data = response.data;
    if (isRecord(data)) {
      const nested = data.data;
      if (isRecord(nested)) return nested as T;
      return data as T;
    }
  }
  return isRecord(response) ? (response as T) : null;
};

export type WorkOrderApprovalDecision = "approve" | "reject";

export type BulkWorkOrderApprovalRequest = {
  decision: WorkOrderApprovalDecision;
  wo_numbers: string[];
  notes?: string | null;
};

export type BulkDocumentItemOption = {
  source_line_id: string;
  item_uniq_code: string;
  part_name?: string;
  part_number?: string;
  uom?: string;
  quantity?: number;
  kanban_qty?: number;
  kanban_count?: number;
  target_date?: string;
};

export type BulkCreateWorkOrderItemRequest = {
  source_line_id: string;
  item_uniq_code: string;
  part_name: string;
  part_number: string;
  uom: string;
  quantity: number;
  kanban_qty: number;
  kanban_count: number;
  target_date: string;
};

export type BulkCreateWorkOrdersRequest = {
  source_document_id: string;
  source_document_type: string;
  wo_type: string;
  items: BulkCreateWorkOrderItemRequest[];
  notes?: string;
};

export type BulkWorkOrderRecord = {
  id: string;
  wo_number: string;
  wo_type?: string;
  status?: string;
  approval_status?: string;
  created_date?: string;
  target_date?: string;
  source_document_id?: string;
  source_document_type?: string;
  notes?: string;
  total_items?: number;
};

export type BulkWorkOrderSummary = Record<string, unknown> & {
  total?: number;
  pending?: number;
  approved?: number;
  rejected?: number;
};

const toBulkDocumentItemOption = (raw: unknown): BulkDocumentItemOption => {
  const r = isRecord(raw) ? raw : {};
  return {
    source_line_id: getString(r, ["source_line_id", "sourceLineId", "line_id", "lineId", "id"]) ?? "",
    item_uniq_code: getString(r, ["item_uniq_code", "uniq", "uniq_code", "itemUniqCode"]) ?? "",
    part_name: getString(r, ["part_name", "partName", "item_name"]) ?? undefined,
    part_number: getString(r, ["part_number", "partNumber", "item_number"]) ?? undefined,
    uom: getString(r, ["uom", "unit"]) ?? undefined,
    quantity: getNumber(r, ["quantity", "qty"]) ?? undefined,
    kanban_qty: getNumber(r, ["kanban_qty", "kanbanQty"]) ?? undefined,
    kanban_count: getNumber(r, ["kanban_count", "kanbanCount"]) ?? undefined,
    target_date: getString(r, ["target_date", "targetDate"]) ?? undefined,
  };
};

const toBulkWorkOrderRecord = (raw: unknown): BulkWorkOrderRecord => {
  const r = isRecord(raw) ? raw : {};
  return {
    id: getString(r, ["id", "uuid", "work_order_id", "wo_id"]) ?? getString(r, ["wo_number"]) ?? "",
    wo_number: getString(r, ["wo_number", "woNumber", "number"]) ?? "-",
    wo_type: getString(r, ["wo_type", "woType"]) ?? undefined,
    status: getString(r, ["status"]) ?? undefined,
    approval_status: getString(r, ["approval_status", "approvalStatus"]) ?? undefined,
    created_date: getString(r, ["created_date", "createdDate", "created_at", "createdAt"]) ?? undefined,
    target_date: getString(r, ["target_date", "targetDate"]) ?? undefined,
    source_document_id: getString(r, ["source_document_id", "sourceDocumentId"]) ?? undefined,
    source_document_type: getString(r, ["source_document_type", "sourceDocumentType"]) ?? undefined,
    notes: getString(r, ["notes", "note"]) ?? undefined,
    total_items: getNumber(r, ["total_items", "items_count"]) ?? undefined,
  };
};

export const workOrdersBulkApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getBulkDocumentItems: builder.query<BulkDocumentItemOption[], { document_id: string }>({
        query: ({ document_id }) => ({
          url: "/working-order/bulk/form-options/document-items",
          method: "GET",
          params: { document_id },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) =>
          normalizeArrayResponse<unknown>(response)
            .map(toBulkDocumentItemOption)
            .filter((x) => Boolean(x.source_line_id) && Boolean(x.item_uniq_code)),
      }),

      createBulkWorkOrders: builder.mutation<unknown, BulkCreateWorkOrdersRequest>({
        query: (body) => ({
          url: "/working-order/bulk/work-orders",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: [{ type: TAG, id: "LIST" }, { type: TAG, id: "SUMMARY" }],
      }),

      listBulkWorkOrders: builder.query<Paginated<BulkWorkOrderRecord>, { page: number; limit: number }>({
        query: ({ page, limit }) => ({
          url: "/working-order/bulk/work-orders",
          method: "GET",
          params: { page, limit },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const normalized = normalizePaginatedResponse<unknown>(response);
          return {
            items: normalized.items.map(toBulkWorkOrderRecord),
            pagination: normalized.pagination,
          };
        },
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: "LIST" | string }> = [{ type: TAG, id: "LIST" }];
          const ids = result?.items?.map((r) => r.id).filter(Boolean) ?? [];
          return base.concat(ids.map((id) => ({ type: TAG, id })));
        },
      }),

      getBulkWorkOrdersSummary: builder.query<BulkWorkOrderSummary, void>({
        query: () => ({
          url: "/working-order/bulk/work-orders/summary",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => (normalizeObjectResponse<BulkWorkOrderSummary>(response) ?? {}) as BulkWorkOrderSummary,
        providesTags: [{ type: TAG, id: "SUMMARY" }],
      }),

      bulkApproveBulkWorkOrders: builder.mutation<unknown, BulkWorkOrderApprovalRequest>({
        query: (body) => ({
          url: "/working-order/bulk/work-orders/bulk-approval",
          method: "POST",
          body: {
            decision: body.decision,
            wo_numbers: body.wo_numbers,
            notes: body.notes ?? null,
          },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: [{ type: TAG, id: "LIST" }, { type: TAG, id: "SUMMARY" }],
      }),
    }),
  });

export const {
  useGetBulkDocumentItemsQuery,
  useLazyGetBulkDocumentItemsQuery,
  useCreateBulkWorkOrdersMutation,
  useListBulkWorkOrdersQuery,
  useGetBulkWorkOrdersSummaryQuery,
  useBulkApproveBulkWorkOrdersMutation,
} = workOrdersBulkApiSlice;
