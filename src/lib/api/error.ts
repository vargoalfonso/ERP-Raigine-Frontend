type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const getStringField = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === "string" && field.trim() ? field : undefined;
};

// Label ramah untuk nama field JSON dari backend (respons 422 hanya membawa nama
// field "daun", mis. "quantity", tanpa nomor baris).
const FIELD_LABELS: Record<string, string> = {
  quantity: "Qty supplier",
  supplier_name: "Nama supplier",
  supplier_id: "ID supplier",
  suppliers: "Supplier",
  items: "Item",
  uniq_code: "UNIQ",
  child_uniq_code: "UNIQ child",
  prl_id: "PRL",
  prl_item_id: "PRL item",
  period: "Periode",
  budget_subtype: "Tipe budget",
  po_type: "Tipe PO",
  sales_plan: "Sales plan",
  qty_per_uniq: "Qty per UNIQ",
  weight_kg: "Berat (kg)",
  uom: "UoM",
};

const labelForField = (field: string): string => {
  const key = field.trim();
  if (!key) return "";
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const spaced = key.replace(/[_.]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// "quantity harus lebih besar dari 0" -> "Qty supplier harus lebih besar dari 0".
// Pesan backend sudah memuat nama field di depannya, jadi cukup diganti dengan label
// (tidak diberi awalan "field: " lagi supaya tidak dobel).
const formatValidationItem = (field: string, message: string): string => {
  const f = field.trim();
  const m = message.trim();
  if (!f || f === "_") return m;
  const label = labelForField(f);
  if (!m) return label;
  if (m.toLowerCase().startsWith(f.toLowerCase())) return `${label}${m.slice(f.length)}`;
  return `${label}: ${m}`;
};

const MAX_VALIDATION_LINES = 5;

// Error validasi (422) bisa ada di `value.errors` (body langsung) atau
// `value.data.errors` (body dibungkus { status, message, data: { errors } }).
const getValidationErrors = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const list = Array.isArray(value.errors)
    ? value.errors
    : isRecord(value.data) && Array.isArray(value.data.errors)
      ? value.data.errors
      : undefined;
  if (!list) return undefined;

  const counts = new Map<string, number>();
  list.forEach((item) => {
    let text = "";
    if (typeof item === "string") text = item.trim();
    else if (isRecord(item)) {
      const field = typeof item.field === "string" ? item.field : "";
      const message = typeof item.message === "string" ? item.message : "";
      text = formatValidationItem(field, message);
    }
    if (text) counts.set(text, (counts.get(text) ?? 0) + 1);
  });

  // Pesan yang sama berulang (satu per baris) digabung: "... (3 baris)".
  const lines = Array.from(counts.entries()).map(([text, n]) => (n > 1 ? `${text} (${n} baris)` : text));
  if (lines.length === 0) return undefined;
  const shown = lines.slice(0, MAX_VALIDATION_LINES);
  const rest = lines.length - shown.length;
  return rest > 0 ? `${shown.join("; ")}; +${rest} kesalahan lainnya` : shown.join("; ");
};

/**
 * Best-effort extraction of a human-readable message from RTK Query / fetch errors.
 */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!error) return fallback;

  if (typeof error === "string" && error.trim()) return error;

  if (isRecord(error)) {
    const status = (error as UnknownRecord).status;

    const directMessage = getStringField(error, "message");
    if (directMessage) return status ? `${directMessage} (status ${String(status)})` : directMessage;

    const directError = getStringField(error, "error");
    if (directError) return status ? `${directError} (status ${String(status)})` : directError;

    if (status === "FETCH_ERROR") {
      const networkError = getStringField(error, "error") || getStringField(error, "message");
      return networkError
        ? `${fallback}: ${networkError}. Check NEXT_PUBLIC_API_URL, API server availability, and browser CORS settings.`
        : `${fallback}: network request failed. Check NEXT_PUBLIC_API_URL, API server availability, and browser CORS settings.`;
    }

    const data = (error as UnknownRecord).data;
    const dataValidationErrors = getValidationErrors(data);
    const dataMessage = getStringField(data, "message");
    if (dataValidationErrors) {
      // Validasi gagal: tampilkan hanya daftar kesalahan yang mudah dibaca,
      // tanpa "validation failed (status 422)" yang tidak membantu.
      return `Data belum valid — ${dataValidationErrors}`;
    }
    if (dataMessage) return status ? `${dataMessage} (status ${String(status)})` : dataMessage;

    const dataError = getStringField(data, "error");
    if (dataError) return status ? `${dataError} (status ${String(status)})` : dataError;

    // RTK Query often returns { status, data }. If message fields aren't present,
    // surface a compact hint to help debugging.
    if (status != null) {
      const dataText = (() => {
        if (typeof data === "string") return data;
        if (!isRecord(data)) return "";
        try {
          return JSON.stringify(data);
        } catch {
          return "";
        }
      })();

      const looksLikeHtml =
        typeof dataText === "string" &&
        (dataText.trim().startsWith("<!DOCTYPE") || dataText.trim().startsWith("<html"));

      if (looksLikeHtml) {
        return `${fallback} (status ${String(status)}): Received HTML instead of JSON. Check NEXT_PUBLIC_API_URL and the API path (/api/...).`;
      }

      const base = `${fallback} (status ${String(status)})`;

      // Avoid flooding UI with huge HTML/text payloads.
      const clipped =
        dataText && dataText.length > 280 ? `${dataText.slice(0, 280)}…` : dataText;
      return clipped ? `${base}: ${clipped}` : base;
    }
  }

  return fallback;
};
