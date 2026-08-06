/**
 * Shared types + helper for the bulk (many-rows-at-once) import feature.
 *
 * The backend MRP endpoints POST /customers/bulk and POST /suppliers/bulk
 * return a per-row report wrapped in the standard response envelope:
 *   { request_id, status, message, data: { total, success_count, failed_count, results } }
 *
 * On HTTP 207 (partial) and 422 (all failed) RTK Query surfaces the same
 * envelope, so we normalize all of them with extractBulkOutcome().
 */

export type BulkRowOutcome = {
  /** 0-based position in the submitted items array. */
  index: number;
  /** 1-based spreadsheet row (as computed by the backend), if provided. */
  row?: number;
  status: "success" | "failed";
  message?: string;
  id?: string;
  customer_id?: string;
  supplier_code?: string;
  customer_name?: string;
  supplier_name?: string;
};

export type BulkImportOutcome = {
  total: number;
  success_count: number;
  failed_count: number;
  results: BulkRowOutcome[];
};

export const emptyBulkOutcome = (): BulkImportOutcome => ({
  total: 0,
  success_count: 0,
  failed_count: 0,
  results: [],
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/**
 * Normalize a raw response (or RTK error `.data`) into a BulkImportOutcome.
 * Accepts either the response envelope ({ data: {...} }) or a bare result.
 * Returns null when the shape is not recognisable as a bulk result.
 */
export const extractBulkOutcome = (raw: unknown): BulkImportOutcome | null => {
  if (!isRecord(raw)) return null;

  let candidate: Record<string, unknown> | null = null;
  if (isRecord(raw.data) && Array.isArray((raw.data as Record<string, unknown>).results)) {
    candidate = raw.data as Record<string, unknown>;
  } else if (Array.isArray(raw.results)) {
    candidate = raw;
  }
  if (!candidate) return null;

  const results = Array.isArray(candidate.results)
    ? (candidate.results as BulkRowOutcome[])
    : [];

  const successFromResults = results.filter((r) => r.status === "success").length;
  const failedFromResults = results.filter((r) => r.status === "failed").length;

  return {
    total: Number(candidate.total ?? results.length),
    success_count: Number(candidate.success_count ?? successFromResults),
    failed_count: Number(candidate.failed_count ?? failedFromResults),
    results,
  };
};
