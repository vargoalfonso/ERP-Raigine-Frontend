import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const TAG = "StockOpname" as const;

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

const getArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    if (Array.isArray(value.data)) return value.data;
    if (isRecord(value.data) && Array.isArray(value.data.data)) return value.data.data;
    if (Array.isArray(value.items)) return value.items;
    if (isRecord(value.data) && Array.isArray(value.data.items)) return value.data.items;
  }
  return [];
};

const getObject = (value: unknown): UnknownRecord | null => {
  if (isRecord(value)) {
    if (isRecord(value.data)) {
      if (isRecord(value.data.data)) return value.data.data;
      return value.data;
    }
    return value;
  }
  return null;
};

export type StockInventoryType = "finished_good" | "raw_material" | "indirect" | "wip";

export type StockOpnameSummary = {
  total_records: number;
  completed: number;
  completed_approved: number;
  with_variance: number;
  pending_verification: number;
  waiting_approval: number;
};

export type StockOpnameSessionRecord = {
  id: number;
  opname_number: string;
  inventory_type: StockInventoryType;
  method?: string;
  period?: string;
  location?: string;
  status?: string;
  impact?: string;
  status_label?: string;
  remarks?: string;
  summary?: {
    total_items?: number;
    items_counted?: number;
    items_with_variance?: number;
    system_total?: number;
    physical_total?: number;
    variance_total?: number;
    variance_percentage?: number;
    cost_impact?: number;
  };
};

export type StockOpnameListRecord = {
  id: number;
  opname_number: string;
  inventory_type: StockInventoryType;
  period?: string;
  location?: string;
  ui_status?: string;
  ui_impact?: string;
  decision_status?: string;
  status?: string;
  impact?: string;
  status_label?: string;
  system_total?: number;
  physical_total?: number;
  variance_total?: number;
  variance_percentage?: number;
  cost_impact?: number;
  summary?: StockOpnameSessionRecord["summary"];
};

export type StockOpnameUniqSearchRecord = {
  id: string;
  inventory_id: string;
  uniq: string;
  item_name?: string;
  part_number?: string;
  unit_measurement?: string;
  system_quantity?: number;
  location?: string;
};

export type StockOpnameCreateItemRequest = {
  inventory_id: string | null;
  counted_quantity: number;
  user_counter: string | null;
  unit_measurement: string | null;
};

export type StockOpnameCreateRequest = {
  inventory_type: StockInventoryType;
  period: string;
  method: "manual" | "bulk";
  location: string | null;
  remarks: string | null;
  items: StockOpnameCreateItemRequest[];
};

export type StockOpnameDetailItem = {
  id: number;
  opname_id: number;
  inventory_type: StockInventoryType;
  inventory_id: string;
  uniq: string;
  item_name?: string;
  part_number?: string | null;
  unit_measurement?: string;
  user_counter?: string;
  location?: string;
  system_quantity?: number;
  counted_quantity?: number;
  difference?: number;
  status?: string;
  verification_status?: string;
  approval_status?: string;
  reject_reason?: string | null;
  notes?: string | null;
  counted_at?: string;
};

export type StockOpnameLogRecord = {
  id: number;
  action?: string;
  description?: string;
  performed_by?: string | null;
  createdAt?: string;
};

export type StockOpnameDetailResponse = {
  session: StockOpnameSessionRecord;
  items: StockOpnameDetailItem[];
  items_pagination?: {
    page?: number;
    limit?: number;
    total_records?: number;
    total_pages?: number;
  };
  logs: StockOpnameLogRecord[];
};

export type StockOpnameDetailRequest = {
  opname_number: string;
  item_status?: string;
  page?: number;
  limit?: number;
};

export type StockOpnameSubmitRequest = {
  opname_id: number;
  action: string;
  verified_by: string | null;
  items: Array<{
    item_id: number;
    verification_status: string;
    reject_reason?: string;
  }>;
};

export type StockOpnameSubmitResponse = {
  opname_id: number;
  opname_number: string;
  status: string;
  impact: string;
  status_label: string;
};

const toSummary = (value: unknown): StockOpnameSummary => {
  const record = getObject(value) ?? {};
  return {
    total_records: getNumber(record, ["total_records"]) ?? 0,
    completed: getNumber(record, ["completed"]) ?? 0,
    completed_approved: getNumber(record, ["completed_approved"]) ?? 0,
    with_variance: getNumber(record, ["with_variance"]) ?? 0,
    pending_verification: getNumber(record, ["pending_verification"]) ?? 0,
    waiting_approval: getNumber(record, ["waiting_approval"]) ?? 0,
  };
};

const toSession = (value: unknown): StockOpnameSessionRecord => {
  const record = isRecord(value) ? value : {};
  const summary = isRecord(record.summary) ? record.summary : undefined;
  return {
    id: getNumber(record, ["id"]) ?? 0,
    opname_number: getString(record, ["opname_number"]) ?? "-",
    inventory_type: (getString(record, ["inventory_type"]) ?? "finished_good") as StockInventoryType,
    method: getString(record, ["method"]),
    period: getString(record, ["period"]),
    location: getString(record, ["location"]),
    status: getString(record, ["status"]),
    impact: getString(record, ["impact"]),
    status_label: getString(record, ["status_label"]),
    remarks: getString(record, ["remarks"]),
    summary: summary
      ? {
          total_items: getNumber(summary, ["total_items"]),
          items_counted: getNumber(summary, ["items_counted"]),
          items_with_variance: getNumber(summary, ["items_with_variance"]),
          system_total: getNumber(summary, ["system_total"]),
          physical_total: getNumber(summary, ["physical_total"]),
          variance_total: getNumber(summary, ["variance_total"]),
          variance_percentage: getNumber(summary, ["variance_percentage"]),
          cost_impact: getNumber(summary, ["cost_impact"]),
        }
      : undefined,
  };
};

const toListRecord = (value: unknown): StockOpnameListRecord => {
  const record = isRecord(value) ? value : {};
  const summary = isRecord(record.summary) ? record.summary : undefined;
  return {
    id: getNumber(record, ["id"]) ?? 0,
    opname_number: getString(record, ["opname_number"]) ?? "-",
    inventory_type: (getString(record, ["inventory_type"]) ?? "finished_good") as StockInventoryType,
    period: getString(record, ["period"]),
    location: getString(record, ["location"]),
    ui_status: getString(record, ["ui_status"]),
    ui_impact: getString(record, ["ui_impact"]),
    decision_status: getString(record, ["decision_status"]),
    status: getString(record, ["status"]),
    impact: getString(record, ["impact"]),
    status_label: getString(record, ["status_label"]),
    system_total: getNumber(record, ["system_total"]),
    physical_total: getNumber(record, ["physical_total"]),
    variance_total: getNumber(record, ["variance_total"]),
    variance_percentage: getNumber(record, ["variance_percentage"]),
    cost_impact: getNumber(record, ["cost_impact"]),
    summary: summary
      ? {
          total_items: getNumber(summary, ["total_items"]),
          items_counted: getNumber(summary, ["items_counted"]),
          items_with_variance: getNumber(summary, ["items_with_variance"]),
          system_total: getNumber(summary, ["system_total"]),
          physical_total: getNumber(summary, ["physical_total"]),
          variance_total: getNumber(summary, ["variance_total"]),
          variance_percentage: getNumber(summary, ["variance_percentage"]),
          cost_impact: getNumber(summary, ["cost_impact"]),
        }
      : undefined,
  };
};

const toUniqSearchRecord = (value: unknown): StockOpnameUniqSearchRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id: getString(record, ["id", "inventory_id"]) ?? "",
    inventory_id: getString(record, ["inventory_id", "id"]) ?? "",
    uniq: getString(record, ["uniq", "item_uniq_code", "uniq_code"]) ?? "-",
    item_name: getString(record, ["item_name", "part_name", "name"]),
    part_number: getString(record, ["part_number", "part_no"]),
    unit_measurement: getString(record, ["unit_measurement", "uom", "unit"]),
    system_quantity: getNumber(record, ["system_quantity", "stock", "quantity", "current_stock"]),
    location: getString(record, ["location", "warehouse", "warehouse_code"]),
  };
};

const toDetailItem = (value: unknown): StockOpnameDetailItem => {
  const record = isRecord(value) ? value : {};
  return {
    id: getNumber(record, ["id"]) ?? 0,
    opname_id: getNumber(record, ["opname_id"]) ?? 0,
    inventory_type: (getString(record, ["inventory_type"]) ?? "finished_good") as StockInventoryType,
    inventory_id: getString(record, ["inventory_id"]) ?? "",
    uniq: getString(record, ["uniq"]) ?? "-",
    item_name: getString(record, ["item_name"]),
    part_number: getString(record, ["part_number"]),
    unit_measurement: getString(record, ["unit_measurement"]),
    user_counter: getString(record, ["user_counter"]),
    location: getString(record, ["location"]),
    system_quantity: getNumber(record, ["system_quantity"]),
    counted_quantity: getNumber(record, ["counted_quantity"]),
    difference: getNumber(record, ["difference"]),
    status: getString(record, ["status"]),
    verification_status: getString(record, ["verification_status"]),
    approval_status: getString(record, ["approval_status"]),
    reject_reason: getString(record, ["reject_reason"]),
    notes: getString(record, ["notes"]),
    counted_at: getString(record, ["counted_at"]),
  };
};

const toLogRecord = (value: unknown): StockOpnameLogRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id: getNumber(record, ["id"]) ?? 0,
    action: getString(record, ["action"]),
    description: getString(record, ["description"]),
    performed_by: getString(record, ["performed_by"]),
    createdAt: getString(record, ["createdAt", "created_at"]),
  };
};

export const stockOpnameApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getStockOpnameSummary: builder.query<StockOpnameSummary, void>({
        query: () => ({
          url: "/api/stock-opname/summary",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => toSummary(response),
        providesTags: [{ type: TAG, id: "SUMMARY" }],
      }),
      getStockOpnameList: builder.query<
        { rows: StockOpnameListRecord[]; total: number },
        { inventory_type: StockInventoryType; period: string; page: number; limit: number }
      >({
        query: ({ inventory_type, period, page, limit }) => ({
          url: `/api/stock-opname/list?inventory_type=${encodeURIComponent(inventory_type)}&period=${encodeURIComponent(period)}&page=${page}&limit=${limit}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const root = getObject(response) ?? {};
          const rows = getArray(response).map(toListRecord);
          const paginationSource = isRecord(root.pagination) ? root.pagination : root;
          const total = getNumber(paginationSource, ["total_records", "total", "count"]) ?? rows.length;
          return { rows, total };
        },
        providesTags: (result, _error, arg) => [
          { type: TAG, id: `LIST-${arg.inventory_type}` },
          ...(result?.rows ?? []).map((row) => ({ type: TAG, id: row.id } as const)),
        ],
      }),
      deleteStockOpname: builder.mutation<{ success?: boolean }, number | string>({
        query: (id) => ({
          url: `/api/stock-opname/${encodeURIComponent(String(id))}`,
          method: "DELETE",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: [{ type: TAG, id: "SUMMARY" }],
      }),
      searchStockOpnameUniq: builder.query<
        StockOpnameUniqSearchRecord[],
        { inventory_type: StockInventoryType; q: string; limit?: number }
      >({
        query: ({ inventory_type, q, limit = 20 }) => ({
          url: `/api/stock-opname/uniq/search?inventory_type=${encodeURIComponent(inventory_type)}&q=${encodeURIComponent(q)}&limit=${limit}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => getArray(response).map(toUniqSearchRecord),
      }),
      getStockOpnameUomList: builder.query<string[], void>({
        query: () => ({
          url: "/api/stock-opname/uom/list",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const values = getArray(response)
            .map((item) => {
              if (typeof item === "string") return item;
              if (isRecord(item)) return getString(item, ["name", "code", "uom", "unit_measurement"]);
              return undefined;
            })
            .filter((value): value is string => Boolean(value));
          return Array.from(new Set(values));
        },
      }),
      createStockOpname: builder.mutation<UnknownRecord, StockOpnameCreateRequest>({
        query: (body) => ({
          url: "/api/stock-opname/create",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: [{ type: TAG, id: "SUMMARY" }],
      }),
      getStockOpnameDetail: builder.query<StockOpnameDetailResponse, StockOpnameDetailRequest>({
        query: (body) => ({
          url: "/api/stock-opname/detail",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const root = getObject(response) ?? {};
          return {
            session: toSession(root.session),
            items: getArray(root.items).map(toDetailItem),
            items_pagination: isRecord(root.items_pagination)
              ? {
                  page: getNumber(root.items_pagination, ["page"]),
                  limit: getNumber(root.items_pagination, ["limit"]),
                  total_records: getNumber(root.items_pagination, ["total_records"]),
                  total_pages: getNumber(root.items_pagination, ["total_pages"]),
                }
              : undefined,
            logs: getArray(root.logs).map(toLogRecord),
          };
        },
        providesTags: (_result, _error, arg) => [{ type: TAG, id: `DETAIL-${arg.opname_number}` }],
      }),
      submitStockOpname: builder.mutation<StockOpnameSubmitResponse, StockOpnameSubmitRequest>({
        query: (body) => ({
          url: "/api/stock-opname/submit",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const record = getObject(response) ?? {};
          return {
            opname_id: getNumber(record, ["opname_id"]) ?? 0,
            opname_number: getString(record, ["opname_number"]) ?? "-",
            status: getString(record, ["status"]) ?? "-",
            impact: getString(record, ["impact"]) ?? "-",
            status_label: getString(record, ["status_label"]) ?? "-",
          };
        },
        invalidatesTags: [{ type: TAG, id: "SUMMARY" }],
      }),
    }),
  });

export const {
  useGetStockOpnameSummaryQuery,
  useGetStockOpnameListQuery,
  useDeleteStockOpnameMutation,
  useLazySearchStockOpnameUniqQuery,
  useGetStockOpnameUomListQuery,
  useCreateStockOpnameMutation,
  useGetStockOpnameDetailQuery,
  useSubmitStockOpnameMutation,
} = stockOpnameApiSlice;