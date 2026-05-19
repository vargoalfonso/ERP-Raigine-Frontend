import { apiSlice } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const toText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

type PaginationDto = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

type PagedResult<T> = {
  items: T[];
  pagination: PaginationDto;
};

export type PrlMachinePatternRowDto = {
  forecast_period?: string;
  uniq_code?: string;
  machine_pattern?: string;
  production_output?: number;
};

export type PrlHistoryVsDeliveryRowDto = {
  forecast_period?: string;
  uniq_code?: string;
  prl_quantity?: number;
  delivery_qty?: number;
  last_updated?: string;
};

export type PrlHistoryTimelineItemDto = {
  activity?: string;
  description?: string;
  actor?: string;
  event_time?: string;
  source?: string;
  new_value?: number;
};

export type PrlHistoryDetailDto = {
  summary?: {
    uniq_code?: string;
    forecast_period?: string;
    total_logs?: number;
    prl_quantity?: number;
    delivery_qty?: number;
    last_updated?: string;
    machine_pattern?: string;
  };
  timeline: PrlHistoryTimelineItemDto[];
};

const emptyPagination = (): PaginationDto => ({
  page: 1,
  limit: 20,
  total: 0,
  total_pages: 1,
});

const unwrapData = (response: unknown): unknown => {
  if (!isRecord(response)) return response;
  const data = response.data;
  if (isRecord(data) || Array.isArray(data)) return data;
  return response;
};

const normalizePagination = (raw: unknown): PaginationDto => {
  const record = isRecord(raw) ? raw : {};
  return {
    page: toNumber(record.page) ?? 1,
    limit: toNumber(record.limit) ?? 20,
    total: toNumber(record.total) ?? 0,
    total_pages: toNumber(record.total_pages) ?? 1,
  };
};

const normalizePagedResponse = <T,>(response: unknown, mapItem: (raw: unknown) => T): PagedResult<T> => {
  const data = unwrapData(response);
  if (!isRecord(data)) {
    return { items: [], pagination: emptyPagination() };
  }

  const rawItems = Array.isArray(data.items) ? data.items : [];
  return {
    items: rawItems.map(mapItem),
    pagination: normalizePagination(data.pagination),
  };
};

const normalizeMachinePatternRow = (raw: unknown): PrlMachinePatternRowDto => {
  const record = isRecord(raw) ? raw : {};
  return {
    forecast_period: toText(record.forecast_period),
    uniq_code: toText(record.uniq_code),
    machine_pattern: toText(record.machine_pattern),
    production_output: toNumber(record.production_output),
  };
};

const normalizeHistoryVsDeliveryRow = (raw: unknown): PrlHistoryVsDeliveryRowDto => {
  const record = isRecord(raw) ? raw : {};
  return {
    forecast_period: toText(record.forecast_period),
    uniq_code: toText(record.uniq_code),
    prl_quantity: toNumber(record.prl_quantity),
    delivery_qty: toNumber(record.delivery_qty),
    last_updated: toText(record.last_updated),
  };
};

const normalizeHistoryDetail = (response: unknown): PrlHistoryDetailDto => {
  const data = unwrapData(response);
  const record = isRecord(data) ? data : {};
  const rawSummary = isRecord(record.summary) ? record.summary : {};
  const rawTimeline = Array.isArray(record.timeline) ? record.timeline : [];

  return {
    summary: {
      uniq_code: toText(rawSummary.uniq_code),
      forecast_period: toText(rawSummary.forecast_period),
      total_logs: toNumber(rawSummary.total_logs),
      prl_quantity: toNumber(rawSummary.prl_quantity),
      delivery_qty: toNumber(rawSummary.delivery_qty),
      last_updated: toText(rawSummary.last_updated),
      machine_pattern: toText(rawSummary.machine_pattern),
    },
    timeline: rawTimeline.map((item) => {
      const timelineItem = isRecord(item) ? item : {};
      return {
        activity: toText(timelineItem.activity),
        description: toText(timelineItem.description),
        actor: toText(timelineItem.actor),
        event_time: toText(timelineItem.event_time),
        source: toText(timelineItem.source),
        new_value: toNumber(timelineItem.new_value),
      };
    }),
  };
};

export const prlLogApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPrlMachinePatterns: builder.query<PagedResult<PrlMachinePatternRowDto>, { page?: number; limit?: number } | void>({
      query: (params) => ({
        url: "/prls/machine-patterns",
        method: "GET",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
        },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizePagedResponse(response, normalizeMachinePatternRow),
    }),

    getPrlHistoryVsDelivery: builder.query<PagedResult<PrlHistoryVsDeliveryRowDto>, { page?: number; limit?: number } | void>({
      query: (params) => ({
        url: "/prls/history-vs-delivery",
        method: "GET",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
        },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizePagedResponse(response, normalizeHistoryVsDeliveryRow),
    }),

    getPrlHistoryVsDeliveryDetail: builder.query<PrlHistoryDetailDto, { uniq_code: string; forecast_period: string; limit?: number }>({
      query: ({ uniq_code, forecast_period, limit = 50 }) => ({
        url: "/prls/history-vs-delivery/detail",
        method: "GET",
        params: {
          uniq_code,
          forecast_period,
          limit,
        },
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => normalizeHistoryDetail(response),
    }),
  }),
});

export const {
  useGetPrlMachinePatternsQuery,
  useGetPrlHistoryVsDeliveryQuery,
  useGetPrlHistoryVsDeliveryDetailQuery,
} = prlLogApiSlice;
