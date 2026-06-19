type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const getStringField = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === "string" && field.trim() ? field : undefined;
};

const getValidationErrors = (value: unknown): string | undefined => {
  if (!isRecord(value) || !Array.isArray(value.errors)) return undefined;

  const messages = value.errors
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!isRecord(item)) return "";
      const field = typeof item.field === "string" ? item.field.trim() : "";
      const message = typeof item.message === "string" ? item.message.trim() : "";
      if (field && message) return `${field}: ${message}`;
      return message || field;
    })
    .filter(Boolean);

  return messages.length > 0 ? messages.join("; ") : undefined;
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
    if (dataMessage && dataValidationErrors) {
      const message = `${dataMessage}: ${dataValidationErrors}`;
      return status ? `${message} (status ${String(status)})` : message;
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
