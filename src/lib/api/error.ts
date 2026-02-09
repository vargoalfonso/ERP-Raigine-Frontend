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
    const directMessage = getStringField(error, "message");
    if (directMessage) return directMessage;

    const directError = getStringField(error, "error");
    if (directError) return directError;

    const data = (error as UnknownRecord).data;
    const dataMessage = getStringField(data, "message");
    if (dataMessage) return dataMessage;

    const dataError = getStringField(data, "error");
    if (dataError) return dataError;
  }

  return fallback;
};
