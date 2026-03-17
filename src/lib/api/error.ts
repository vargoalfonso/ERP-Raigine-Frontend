type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const getStringField = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === "string" && field.trim() ? field : undefined;
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

    const data = (error as UnknownRecord).data;
    const dataMessage = getStringField(data, "message");
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

      const base = `${fallback} (status ${String(status)})`;
      return dataText ? `${base}: ${dataText}` : base;
    }
  }

  return fallback;
};
