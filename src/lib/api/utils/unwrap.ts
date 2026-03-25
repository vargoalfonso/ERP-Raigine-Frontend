type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

/**
 * Normalizes common backend response wrappers.
 * Supports both raw payloads and `{ data: ... }` responses.
 */
export function unwrapBackendData<T>(response: unknown): T {
  if (isRecord(response) && "data" in response) {
    return (response as UnknownRecord).data as T;
  }
  return response as T;
}
