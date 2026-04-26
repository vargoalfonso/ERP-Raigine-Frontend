import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

const TAG = "ApprovalManager" as const;

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
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const ok = <T,>(data: T, message = "OK", pagination?: ApiResponse<T>["pagination"]): ApiResponse<T> => ({
  message,
  status: "success",
  data,
  ...(pagination ? { pagination } : {}),
});

const normalizeBackendPath = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "/";

  let path = trimmed;

  // Accept absolute URLs.
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      path = `${u.pathname}${u.search}`;
    } catch {
      // keep original
    }
  }

  if (!path.startsWith("/")) path = `/${path}`;

  // Proxy target includes `/api/v1` in dev (`API_PROXY_TARGET=http://localhost:8899/api/v1`).
  // Strip it to avoid `/api/v1/api/v1/...`.
  path = path.replace(/^\/api\/v1\b/, "");
  if (!path.startsWith("/")) path = `/${path}`;

  return path;
};

const safeParseMaybeJson = (raw: unknown): unknown => {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
};

export type ApprovalManagerType =
  | "all"
  | "bom"
  | "prl"
  | "po_budget"
  | "stock_opname"
  | (string & {});

export type ApprovalManagerItem = {
  instance_id: number;
  module: string;
  module_label: string;
  reference_table?: string;
  reference_id: number;
  document_id?: string;
  document_uuid?: string;
  item_name?: string;
  item_code?: string;
  submitted_by?: string;
  submitted_by_name?: string;
  submitted_at?: string;
  status?: string;
  current_level?: number;
  max_level?: number;
  current_level_role?: string;
  is_final_level?: boolean;
  can_view?: boolean;
  can_approve?: boolean;
  can_reject?: boolean;
  is_my_turn?: boolean;
  view_mode?: string;
  detail_url?: string;
  approval_url?: string;
};

export type ApprovalManagerSummary = {
  type: string;
  pending: number;
  approved: number;
  rejected: number;
  total: number;
};

export type ApprovalManagerDecision = "approve" | "reject";

export type ApprovalManagerSubmitDecisionRequest = {
  approval_url: string;
  action: ApprovalManagerDecision;
  remarks?: string;
  module_kind?: string;
};

const buildDecisionUrl = (
  approvalUrl: string,
  action: ApprovalManagerDecision,
  moduleKind?: string
): string => {
  const normalized = normalizeBackendPath(approvalUrl);
  const lower = normalized.toLowerCase();
  const kind = (moduleKind ?? "").trim().toLowerCase();

  // If backend already gives a concrete action URL, keep it.
  if (lower.endsWith("/approve") || lower.endsWith("/reject")) return normalized;

  // Some modules expose action endpoints instead of a generic `/approval` endpoint.
  // Example (BOM): /products/bom/59/approve | /products/bom/59/reject
  if ((kind === "bom" || kind === "prl" || kind === "po_budget") && lower.endsWith("/approval")) {
    return normalized.replace(/\/approval\/?$/i, `/${action}`);
  }

  // Stock opname uses separate approve/reject endpoints.
  // Example: /stock-opname-sessions/6/approve
  if (lower.includes("/stock-opname-sessions/") && !lower.endsWith("/approve") && !lower.endsWith("/reject")) {
    return `${normalized.replace(/\/$/, "")}/${action}`;
  }

  // Default: use the provided URL; backend may accept `{ action }` body.
  return normalized;
};

type ItemsPayload = {
  items?: unknown[];
  pagination?: {
    total?: unknown;
    page?: unknown;
    limit?: unknown;
    total_pages?: unknown;
  };
};

const parsePagination = (
  payload: ItemsPayload,
  fallback: { page: number; limit: number }
): ApiResponse<unknown>["pagination"] => {
  const total = toNumber(payload.pagination?.total) ?? 0;
  const page = toNumber(payload.pagination?.page) ?? fallback.page;
  const perPage = toNumber(payload.pagination?.limit) ?? fallback.limit;
  const totalPages =
    toNumber(payload.pagination?.total_pages) ??
    (perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1);

  return { total, page, perPage, totalPages };
};

const toItem = (raw: unknown): ApprovalManagerItem => {
  const r = isRecord(raw) ? raw : {};

  return {
    instance_id: toNumber(r.instance_id) ?? 0,
    module: toText(r.module) ?? "",
    module_label: toText(r.module_label) ?? toText(r.module) ?? "",
    reference_table: toText(r.reference_table),
    reference_id: toNumber(r.reference_id) ?? 0,
    document_id: toText(r.document_id),
    document_uuid: toText(r.document_uuid),
    item_name: toText(r.item_name),
    item_code: toText(r.item_code),
    submitted_by: toText(r.submitted_by),
    submitted_by_name: toText(r.submitted_by_name),
    submitted_at: toText(r.submitted_at),
    status: toText(r.status),
    current_level: toNumber(r.current_level),
    max_level: toNumber(r.max_level),
    current_level_role: toText(r.current_level_role),
    is_final_level: typeof r.is_final_level === "boolean" ? r.is_final_level : undefined,
    can_view: typeof r.can_view === "boolean" ? r.can_view : undefined,
    can_approve: typeof r.can_approve === "boolean" ? r.can_approve : undefined,
    can_reject: typeof r.can_reject === "boolean" ? r.can_reject : undefined,
    is_my_turn: typeof r.is_my_turn === "boolean" ? r.is_my_turn : undefined,
    view_mode: toText(r.view_mode),
    detail_url: toText(r.detail_url),
    approval_url: toText(r.approval_url),
  };
};

const toSummary = (raw: unknown): ApprovalManagerSummary => {
  const r = isRecord(raw) ? raw : {};
  return {
    type: toText(r.type) ?? "all",
    pending: toNumber(r.pending) ?? 0,
    approved: toNumber(r.approved) ?? 0,
    rejected: toNumber(r.rejected) ?? 0,
    total: toNumber(r.total) ?? 0,
  };
};

export const approvalManagerApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getApprovalManagerItems: builder.query<
        ApiResponse<ApprovalManagerItem[]>,
        { type: ApprovalManagerType; page?: number; limit?: number }
      >({
        query: ({ type, page = 1, limit = 20 }) => ({
          url: "/approval-manager/items",
          method: "GET",
          params: { type, page, limit },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown, _meta, arg) => {
          const unwrapped = unwrapBackendData<unknown>(response);
          const payload = (isRecord(unwrapped) ? unwrapped : {}) as ItemsPayload;

          const items = Array.isArray(payload.items) ? payload.items.map(toItem) : [];
          const pagination = parsePagination(payload, {
            page: arg.page ?? 1,
            limit: arg.limit ?? 20,
          });

          return ok(items, "OK", pagination);
        },
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: "LIST" | string }> = [{ type: TAG, id: "LIST" }];
          const ids = (result?.data ?? [])
            .map((i) => String(i.instance_id ?? ""))
            .filter((id) => id && id !== "0")
            .map((id) => ({ type: TAG, id }));
          return base.concat(ids);
        },
      }),

      getApprovalManagerSummary: builder.query<ApiResponse<ApprovalManagerSummary>, { type: ApprovalManagerType }>({
        query: ({ type }) => ({
          url: "/approval-manager/summary",
          method: "GET",
          params: { type },
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          const unwrapped = unwrapBackendData<unknown>(response);
          return ok(toSummary(unwrapped), "OK");
        },
        providesTags: [{ type: TAG, id: "LIST" }],
      }),

      getApprovalManagerDetailByUrl: builder.query<unknown, { detail_url: string }>({
        query: ({ detail_url }) => ({
          url: normalizeBackendPath(detail_url),
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
          // Avoid PARSING_ERROR when upstream returns non-JSON (e.g. HTML 404 body).
          responseHandler: (response: Response) => response.text(),
        }),
        transformResponse: (response: unknown) => unwrapBackendData<unknown>(safeParseMaybeJson(response)),
      }),

      submitApprovalManagerDecision: builder.mutation<unknown, ApprovalManagerSubmitDecisionRequest>({
        query: ({ approval_url, action, remarks, module_kind }) => {
          const decisionUrl = buildDecisionUrl(approval_url, action, module_kind);
          const urlLower = decisionUrl.toLowerCase();
          const trimmed = remarks?.trim();

          const actionInPath = urlLower.endsWith("/approve") || urlLower.endsWith("/reject");
          const method = actionInPath ? "PUT" : "POST";

          return {
            url: decisionUrl,
            method,
            body: actionInPath
              ? {
                  ...(trimmed ? { remarks: trimmed } : {}),
                }
              : {
                  action,
                  decision: action,
                  ...(trimmed ? { remarks: trimmed } : {}),
                },
            meta: { useAuthorization: true, contentType: "application/json" },
            // Avoid PARSING_ERROR when upstream returns non-JSON.
            responseHandler: (response: Response) => response.text(),
          };
        },
        transformResponse: (response: unknown) => unwrapBackendData<unknown>(safeParseMaybeJson(response)),
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),
    }),
  });

export const {
  useGetApprovalManagerItemsQuery,
  useGetApprovalManagerSummaryQuery,
  useLazyGetApprovalManagerDetailByUrlQuery,
  useSubmitApprovalManagerDecisionMutation,
} = approvalManagerApiSlice;
