import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";
import type { ApiResponse } from "@/types";

type UnknownRecord = Record<string, unknown>;

const TAG = "ApprovalManager" as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

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

const ok = <T>(
  data: T,
  message = "OK",
  pagination?: ApiResponse<T>["pagination"],
): ApiResponse<T> => ({
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
  reference_id?: number;
  action: ApprovalManagerDecision;
  remarks?: string;
  module_kind?: string;
};

/**
 * Build decision URL based on module type.
 * Each module has different approval endpoint patterns:
 * - PO Budget: /po-budget/{type}/budget/{id}/approve (POST with status body)
 * - BOM: /products/bom/{id}/approval (POST with action body)
 * - Stock Opname: /stock-opname-sessions/{id}/approve (PUT with action body)
 * - PRL: /prls/actions/approve OR /prls/actions/reject (POST with ids body)
 *
 * IMPORTANT: Use reference_id for building URL, not parsing from approval_url
 */
const buildDecisionUrl = (
  approvalUrl: string,
  action: ApprovalManagerDecision,
  moduleKind?: string,
  referenceId?: number,
): string => {
  const normalized = normalizeBackendPath(approvalUrl);
  const lower = normalized.toLowerCase();
  const kind = (moduleKind ?? "").trim().toLowerCase();

  // === BOM ===
  // BOM uses POST /:id/approval (single endpoint for both approve/reject)
  // Example: /products/bom/59/approval
  if (kind === "bom") {
    if (referenceId) {
      return `/products/bom/${referenceId}/approval`;
    }
    // Fallback: avoid duplicate /approval/approval
    if (lower.endsWith("/approval")) {
      return normalized;
    }
    return normalized.replace(/\/$/, "") + "/approval";
  }

  // === PRL ===
  // PRL uses separate endpoints for approve and reject
  // /prls/actions/approve | /prls/actions/reject (no ID in URL, body carries IDs)
  if (kind === "prl") {
    return `/prls/actions/${action}`;
  }

  // === PO Budget ===
  // PO Budget uses POST /:id/approve or /:id/reject
  // Example: /po-budget/subcon/budget/3/approve
  if (kind === "po_budget") {
    if (referenceId) {
      // Extract type from the approval_url: /po-budget/{type}/budget/{id}
      const typeMatch = normalized.match(/\/po-budget\/([^/]+)\/budget/);
      if (typeMatch) {
        // Avoid duplicate: if URL already has action, don't add again
        if (lower.endsWith("/approve") || lower.endsWith("/reject")) {
          return `/po-budget/${typeMatch[1]}/budget/${referenceId}/${action}`;
        }
        return `/po-budget/${typeMatch[1]}/budget/${referenceId}/${action}`;
      }
    }
    // Fallback: if URL already has /approve or /reject, don't add again
    if (lower.endsWith("/approve") || lower.endsWith("/reject")) {
      return normalized;
    }
    return normalized.replace(/\/$/, "") + `/${action}`;
  }

  // === Stock Opname ===
  // Stock Opname uses PUT /:id/approve (SAME URL for both approve/reject!)
  // Body distinguishes action: { action: "approve" | "reject" }
  // Example: /stock-opname-sessions/6/approve
  if (kind === "stock_opname") {
    if (referenceId) {
      // Use reference_id for correct session ID
      return `/stock-opname-sessions/${referenceId}/approve`;
    }
    // Fallback: extract ID from URL /stock-opname-sessions/{id}/approve
    const match = normalized.match(/\/stock-opname-sessions\/(\d+)/);
    if (match) {
      return `/stock-opname-sessions/${match[1]}/approve`;
    }
    // Fallback: if URL already ends with /approve, use as-is
    if (lower.endsWith("/approve")) {
      return normalized;
    }
    return normalized.replace(/\/$/, "") + "/approve";
  }

  // === Default ===
  // Default: use the provided URL with action appended
  if (lower.endsWith("/approve") || lower.endsWith("/reject")) {
    return normalized;
  }
  return `${normalized.replace(/\/$/, "")}/${action}`;
};

/**
 * Build request body based on module type.
 * Each module expects different body format:
 * - PO Budget: { status: "Approved" | "Rejected" }
 * - BOM: { action: "approve" | "reject", notes?: string }
 * - Stock Opname: { action: "approve" | "reject", remarks?: string }
 * - PRL: { ids: string[], note?: string } - ids must include reference_id
 */
const buildDecisionBody = (
  action: ApprovalManagerDecision,
  moduleKind?: string,
  remarks?: string,
  referenceId?: number,
): Record<string, unknown> => {
  const kind = (moduleKind ?? "").trim().toLowerCase();
  const trimmed = remarks?.trim();

  // PO Budget: { status: "Approved" | "Rejected" }
  if (kind === "po_budget") {
    return {
      status: action === "approve" ? "Approved" : "Rejected",
      ...(trimmed ? { remarks: trimmed } : {}),
    };
  }

  // BOM: { action, notes }
  if (kind === "bom") {
    return {
      action,
      ...(trimmed ? { notes: trimmed } : {}),
    };
  }

  // PRL: { ids: [referenceId], note } - ids must be string array with reference_id
  if (kind === "prl" && referenceId) {
    return {
      ids: [String(referenceId)],
      ...(trimmed ? { note: trimmed } : {}),
    };
  }

  // Stock Opname, Default: { action, remarks? }
  return {
    action,
    decision: action,
    ...(trimmed ? { remarks: trimmed } : {}),
  };
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
  fallback: { page: number; limit: number },
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
    is_final_level:
      typeof r.is_final_level === "boolean" ? r.is_final_level : undefined,
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
          const payload = (
            isRecord(unwrapped) ? unwrapped : {}
          ) as ItemsPayload;

          const items = Array.isArray(payload.items)
            ? payload.items.map(toItem)
            : [];
          const pagination = parsePagination(payload, {
            page: arg.page ?? 1,
            limit: arg.limit ?? 20,
          });

          return ok(items, "OK", pagination);
        },
        providesTags: (result) => {
          const base: Array<{ type: typeof TAG; id: "LIST" | string }> = [
            { type: TAG, id: "LIST" },
          ];
          const ids = (result?.data ?? [])
            .map((i) => String(i.instance_id ?? ""))
            .filter((id) => id && id !== "0")
            .map((id) => ({ type: TAG, id }));
          return base.concat(ids);
        },
      }),

      getApprovalManagerSummary: builder.query<
        ApiResponse<ApprovalManagerSummary>,
        { type: ApprovalManagerType }
      >({
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

      getApprovalManagerDetailByUrl: builder.query<
        unknown,
        { detail_url: string }
      >({
        query: ({ detail_url }) => ({
          url: normalizeBackendPath(detail_url),
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
          // Avoid PARSING_ERROR when upstream returns non-JSON (e.g. HTML 404 body).
          responseHandler: (response: Response) => response.text(),
        }),
        transformResponse: (response: unknown) =>
          unwrapBackendData<unknown>(safeParseMaybeJson(response)),
      }),

      submitApprovalManagerDecision: builder.mutation<
        unknown,
        ApprovalManagerSubmitDecisionRequest
      >({
        async queryFn(arg, _api, _extraOptions, fetchWithBQ) {
          const { approval_url, reference_id, action, remarks, module_kind } =
            arg;

          // DEBUG LOGGING
          console.log("[ApprovalManager] Decision Request:", {
            approval_url,
            reference_id,
            action,
            module_kind,
          });

          const normalizedApprovalUrl = normalizeBackendPath(approval_url);
          const decisionUrl = buildDecisionUrl(
            approval_url,
            action,
            module_kind,
            reference_id,
          );
          const urlLower = decisionUrl.toLowerCase();
          const kind = (module_kind ?? "").trim().toLowerCase();

          // DEBUG LOGGING
          console.log("[ApprovalManager] Built URL:", {
            normalizedApprovalUrl,
            decisionUrl,
            urlLower,
            kind,
          });

          // Determine HTTP method based on module type:
          // - Stock Opname uses PUT /:id/approve
          // - BOM, PRL, PO Budget all use POST
          const primaryMethod = kind === "stock_opname" ? "PUT" : "POST";

          // Build body based on module type
          const primaryBody = buildDecisionBody(
            action,
            module_kind,
            remarks,
            reference_id,
          );

          // DEBUG LOGGING
          console.log("[ApprovalManager] Request:", {
            method: primaryMethod,
            url: decisionUrl,
            body: primaryBody,
          });

          const primary = await fetchWithBQ({
            url: decisionUrl,
            method: primaryMethod,
            body: primaryBody,
            meta: { useAuthorization: true, contentType: "application/json" },
            responseHandler: (response: Response) => response.text(),
          });

          // DEBUG LOGGING
          console.log("[ApprovalManager] Response:", {
            url: decisionUrl,
            status: primary.error ? primary.error.status : 200,
            data: primaryBody,
            error: primary.error,
          });

          const unwrapText = (raw: unknown) =>
            unwrapBackendData<unknown>(safeParseMaybeJson(raw));

          if (!primary.error) {
            return { data: unwrapText(primary.data) };
          }

          const actionInPath =
            urlLower.endsWith("/approve") || urlLower.endsWith("/reject");
          const shouldFallback =
            actionInPath &&
            decisionUrl !== normalizedApprovalUrl &&
            (kind === "bom" || kind === "prl" || kind === "po_budget") &&
            (primary.error.status === 404 || primary.error.status === 405);

          if (!shouldFallback) {
            return { error: primary.error };
          }

          // Fallback for BOM/PRL that may use /approval endpoint
          const fallback = await fetchWithBQ({
            url: normalizedApprovalUrl,
            method: "POST",
            body: buildDecisionBody(action, module_kind, remarks, reference_id),
            meta: { useAuthorization: true, contentType: "application/json" },
            responseHandler: (response: Response) => response.text(),
          });

          if (fallback.error) return { error: fallback.error };
          return { data: unwrapText(fallback.data) };
        },
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
