import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

type Pagination = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type MachinePatternMovingType = "Fast Moving" | "Slow Moving" | "Normal";

export type MachinePatternRecord = {
  id: string;
  uniq_code: string;
  machine_id: number;
  cycle_time: number;
  pattern_value: number;
  working_days: number;
  moving_type: MachinePatternMovingType | string;
  min_output: number;
  prl_reference: number;
  status: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

export type CreateMachinePatternRequest = {
  uniq_code: string;
  machine_id: number;
  cycle_time: number;
  pattern_value: number;
  working_days: number;
  moving_type: MachinePatternMovingType | string;
  min_output: number;
  prl_reference: number;
  status: string;
};

export type UpdateMachinePatternRequest = Partial<Omit<CreateMachinePatternRequest, "uniq_code" | "machine_id">> & {
  status?: string;
};

export type MachinePatternSummary = {
  total_pattern: number;
  fast_moving: number;
  slow_moving: number;
  normal: number;
  avg_pattern: number;
};

export type MachinePatternListResponse = {
  items: MachinePatternRecord[];
  pagination: Pagination;
};

export type MachinePatternListParams = {
  page?: number;
  limit?: number;
  uniq_code?: string;
  moving_type?: MachinePatternMovingType | string;
  status?: string;
};

export type CreateMachinePatternBulkRequest = {
  items: CreateMachinePatternRequest[];
};

export type CalculateMachinePatternParams = {
  cycle_time_sec: number;
  prl_reference: number;
  working_days: number;
};

export type MachinePatternCalculation = {
  moving_type: MachinePatternMovingType | string;
  pattern_value: number;
  min_output: number;
  daily_requirement: number;
  cycle_time_min: number;
};

export type MachinePatternParams = {
  fast_moving_threshold: number;
  slow_cycle_minutes: number;
  default_working_days: number;
};

export type UpdateMachinePatternParamsRequest = Partial<MachinePatternParams>;

export type MachinePatternSafetyStockItem = {
  uniq_code: string;
  safety_stock: number;
  calculation_type?: string;
  constanta?: number;
};

export type MachinePatternSafetyStockResponse = {
  items: MachinePatternSafetyStockItem[];
};

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

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

const normalizePagination = (raw: unknown): Pagination => {
  const record = isRecord(raw) ? raw : {};
  return {
    total: getNumber(record, ["total"]) ?? 0,
    page: getNumber(record, ["page"]) ?? 1,
    limit: getNumber(record, ["limit"]) ?? 20,
    total_pages: getNumber(record, ["total_pages", "totalPages"]) ?? 1,
  };
};

const toMachinePatternRecord = (raw: unknown): MachinePatternRecord => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: String(record.id ?? record.uuid ?? ""),
    uniq_code: getString(record, ["uniq_code", "uniqCode"]) ?? "",
    machine_id: getNumber(record, ["machine_id", "machineId"]) ?? 0,
    cycle_time: getNumber(record, ["cycle_time", "cycleTime"]) ?? 0,
    pattern_value: getNumber(record, ["pattern_value", "patternValue"]) ?? 0,
    working_days: getNumber(record, ["working_days", "workingDays"]) ?? 0,
    moving_type: (getString(record, ["moving_type", "movingType"]) ?? "Normal") as MachinePatternMovingType,
    min_output: getNumber(record, ["min_output", "minOutput"]) ?? 0,
    prl_reference: getNumber(record, ["prl_reference", "prlReference"]) ?? 0,
    status: getString(record, ["status"]) ?? "Active",
    created_by: getString(record, ["created_by", "createdBy"]),
    created_at: getString(record, ["created_at", "createdAt"]),
    updated_at: getString(record, ["updated_at", "updatedAt"]),
  };
};

const normalizeObjectResponse = (response: unknown): MachinePatternRecord => {
  if (!isRecord(response)) return toMachinePatternRecord(response);
  const data = response.data;
  if (isRecord(data) && isRecord(data.data)) return toMachinePatternRecord(data.data);
  if (isRecord(data)) return toMachinePatternRecord(data);
  return toMachinePatternRecord(response);
};

const normalizeListResponse = (response: unknown): MachinePatternListResponse => {
  if (!isRecord(response)) {
    return {
      items: [],
      pagination: { total: 0, page: 1, limit: 20, total_pages: 1 },
    };
  }

  const data = isRecord(response.data) ? response.data : response;
  let rawItems: unknown[] = [];
  if (Array.isArray(data)) {
    rawItems = data;
  } else if (Array.isArray((data as UnknownRecord).items)) {
    rawItems = (data as UnknownRecord).items as unknown[];
  } else if (Array.isArray((data as UnknownRecord).data)) {
    rawItems = (data as UnknownRecord).data as unknown[];
  } else if (Array.isArray((response as UnknownRecord).items)) {
    rawItems = (response as UnknownRecord).items as unknown[];
  }

  return {
    items: rawItems.map(toMachinePatternRecord),
    pagination: normalizePagination(isRecord(data) ? data.pagination : undefined),
  };
};

const normalizeSummary = (response: unknown): MachinePatternSummary => {
  const source = isRecord(response) && isRecord(response.data) ? response.data : isRecord(response) ? response : {};
  return {
    total_pattern: getNumber(source, ["total_pattern", "totalPattern"]) ?? 0,
    fast_moving: getNumber(source, ["fast_moving", "fastMoving"]) ?? 0,
    slow_moving: getNumber(source, ["slow_moving", "slowMoving"]) ?? 0,
    normal: getNumber(source, ["normal"]) ?? 0,
    avg_pattern: getNumber(source, ["avg_pattern", "avgPattern"]) ?? 0,
  };
};

const normalizeRecordList = (response: unknown): MachinePatternRecord[] => normalizeListResponse(response).items;

const normalizeCalculation = (response: unknown): MachinePatternCalculation => {
  const source = isRecord(response) && isRecord(response.data) ? response.data : isRecord(response) ? response : {};
  return {
    moving_type: (getString(source, ["moving_type", "movingType"]) ?? "Normal") as MachinePatternMovingType,
    pattern_value: getNumber(source, ["pattern_value", "patternValue"]) ?? 0,
    min_output: getNumber(source, ["min_output", "minOutput"]) ?? 0,
    daily_requirement: getNumber(source, ["daily_requirement", "dailyRequirement"]) ?? 0,
    cycle_time_min: getNumber(source, ["cycle_time_min", "cycleTimeMin"]) ?? 0,
  };
};

const normalizeParams = (response: unknown): MachinePatternParams => {
  const source = isRecord(response) && isRecord(response.data) ? response.data : isRecord(response) ? response : {};
  return {
    fast_moving_threshold: getNumber(source, ["fast_moving_threshold", "fastMovingThreshold"]) ?? 0,
    slow_cycle_minutes: getNumber(source, ["slow_cycle_minutes", "slowCycleMinutes"]) ?? 0,
    default_working_days: getNumber(source, ["default_working_days", "defaultWorkingDays"]) ?? 0,
  };
};

const toSafetyStockItem = (raw: unknown): MachinePatternSafetyStockItem => {
  const record = isRecord(raw) ? raw : {};
  return {
    uniq_code: getString(record, ["uniq_code", "uniqCode", "item_uniq_code"]) ?? "",
    safety_stock: getNumber(record, ["safety_stock", "safetyStock"]) ?? 0,
    calculation_type: getString(record, ["calculation_type", "calculationType"]),
    constanta: getNumber(record, ["constanta"]),
  };
};

const normalizeSafetyStock = (response: unknown): MachinePatternSafetyStockResponse => {
  if (!isRecord(response)) return { items: [] };
  const data = isRecord(response.data) ? response.data : response;
  let rawItems: unknown[] = [];
  if (Array.isArray(data)) {
    rawItems = data;
  } else if (Array.isArray((data as UnknownRecord).items)) {
    rawItems = (data as UnknownRecord).items as unknown[];
  } else if (Array.isArray((data as UnknownRecord).data)) {
    rawItems = (data as UnknownRecord).data as unknown[];
  } else if (Array.isArray((response as UnknownRecord).items)) {
    rawItems = (response as UnknownRecord).items as unknown[];
  }
  return { items: rawItems.map(toSafetyStockItem) };
};

const TAG = "MachinePatterns" as const;

export const machinePatternsApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getMachinePatterns: builder.query<MachinePatternListResponse, MachinePatternListParams | void>({
        query: (params) => ({
          url: "/machine-patterns",
          method: "GET",
          params: {
            page: params?.page ?? 1,
            limit: params?.limit ?? 20,
            ...(params?.uniq_code ? { uniq_code: params.uniq_code } : {}),
            ...(params?.moving_type ? { moving_type: params.moving_type } : {}),
            ...(params?.status ? { status: params.status } : {}),
          },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeListResponse(response),
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: string }> = [{ type: TAG, id: "LIST" }];
          if (!result) return base;
          return base.concat(result.items.map((item) => ({ type: TAG, id: item.id })));
        },
      }),
      getMachinePatternById: builder.query<MachinePatternRecord, string | number>({
        query: (id) => ({
          url: `/machine-patterns/${encodeURIComponent(String(id))}`,
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeObjectResponse(response),
        providesTags: (_result, _error, id) => [{ type: TAG, id: String(id) }],
      }),
      getMachinePatternSummary: builder.query<MachinePatternSummary, void>({
        query: () => ({
          url: "/machine-patterns/summary",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeSummary(response),
        providesTags: [{ type: TAG, id: "SUMMARY" }],
      }),
      createMachinePattern: builder.mutation<MachinePatternRecord, CreateMachinePatternRequest>({
        query: (body) => ({
          url: "/machine-patterns",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeObjectResponse(response),
        invalidatesTags: [{ type: TAG, id: "LIST" }, { type: TAG, id: "SUMMARY" }],
      }),
      updateMachinePattern: builder.mutation<MachinePatternRecord, { id: string | number; body: UpdateMachinePatternRequest }>({
        query: ({ id, body }) => ({
          url: `/machine-patterns/${encodeURIComponent(String(id))}`,
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeObjectResponse(response),
        invalidatesTags: (_result, _error, arg) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: "SUMMARY" },
          { type: TAG, id: String(arg.id) },
        ],
      }),
      deleteMachinePattern: builder.mutation<{ success?: boolean } | unknown, string | number>({
        query: (id) => ({
          url: `/machine-patterns/${encodeURIComponent(String(id))}`,
          method: "DELETE",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        invalidatesTags: (_result, _error, id) => [
          { type: TAG, id: "LIST" },
          { type: TAG, id: "SUMMARY" },
          { type: TAG, id: String(id) },
        ],
      }),
      createMachinePatternBulk: builder.mutation<MachinePatternRecord[], CreateMachinePatternBulkRequest>({
        query: (body) => ({
          url: "/machine-patterns/bulk",
          method: "POST",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeRecordList(response),
        invalidatesTags: [
          { type: TAG, id: "LIST" },
          { type: TAG, id: "SUMMARY" },
        ],
      }),
      calculateMachinePattern: builder.query<MachinePatternCalculation, CalculateMachinePatternParams>({
        query: ({ cycle_time_sec, prl_reference, working_days }) => ({
          url: "/machine-patterns/calculate",
          method: "GET",
          params: { cycle_time_sec, prl_reference, working_days },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeCalculation(response),
      }),
      getMachinePatternParams: builder.query<MachinePatternParams, void>({
        query: () => ({
          url: "/machine-patterns/params",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeParams(response),
        providesTags: [{ type: TAG, id: "PARAMS" }],
      }),
      updateMachinePatternParams: builder.mutation<MachinePatternParams, UpdateMachinePatternParamsRequest>({
        query: (body) => ({
          url: "/machine-patterns/params",
          method: "PUT",
          body,
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeParams(response),
        invalidatesTags: [{ type: TAG, id: "PARAMS" }],
      }),
      getMachinePatternSafetyStock: builder.query<MachinePatternSafetyStockResponse, void>({
        query: () => ({
          url: "/machine-patterns/safety-stock",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => normalizeSafetyStock(response),
        providesTags: [{ type: TAG, id: "SAFETY_STOCK" }],
      }),
    }),
    overrideExisting: true,
  });

export const {
  useGetMachinePatternsQuery,
  useGetMachinePatternByIdQuery,
  useGetMachinePatternSummaryQuery,
  useCreateMachinePatternMutation,
  useCreateMachinePatternBulkMutation,
  useUpdateMachinePatternMutation,
  useDeleteMachinePatternMutation,
  useCalculateMachinePatternQuery,
  useLazyCalculateMachinePatternQuery,
  useGetMachinePatternParamsQuery,
  useUpdateMachinePatternParamsMutation,
  useGetMachinePatternSafetyStockQuery,
} = machinePatternsApiSlice;
