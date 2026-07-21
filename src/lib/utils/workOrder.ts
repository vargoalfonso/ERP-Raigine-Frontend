export type WorkOrderGenerationInput = {
  date?: Date;
  existingWoNumbers?: string[];
  storageNamespace?: string;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const pad3 = (n: number) => String(n).padStart(3, "0");

export const formatWorkOrderPrefix = (date: Date): string => {
  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yy = pad2(date.getFullYear() % 100);
  return `WO-${dd}${mm}${yy}-`;
};

export const formatWorkOrderNumber = (prefix: string, sequence: number): string => {
  return `${prefix}${pad3(sequence)}`;
};

export const formatWorkOrderDisplayNumber = (woNumber?: string | null): string => {
  const value = String(woNumber ?? "").trim();
  if (!value) return "";
  return value.replace(/-\d{0}$/, "");
};

export const tryParseWorkOrderSequence = (woNumber: string, prefix: string): number | null => {
  if (!woNumber.startsWith(prefix)) return null;
  const suffix = woNumber.slice(prefix.length);
  if (!/^[0-9]{3}$/.test(suffix)) return null;
  const n = Number(suffix);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const getStorageKey = (namespace: string, prefix: string) => `${namespace}:${prefix}`;

const safeGetLocalStorage = (): Storage | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

/**
 * Generates the next WO number in format: WO-ddmmyy-001.
 *
 * Notes:
 * - Uses localStorage to keep a per-day counter.
 * - If `existingWoNumbers` is provided, it will advance the counter to avoid duplicates.
 */
export const generateNextWorkOrderNumber = (input: WorkOrderGenerationInput = {}): string => {
  const date = input.date ?? new Date();
  const prefix = formatWorkOrderPrefix(date);
  const namespace = input.storageNamespace ?? "mrp-erp:wo";
  const storage = safeGetLocalStorage();

  let maxExisting = 0;
  for (const wo of input.existingWoNumbers ?? []) {
    const seq = tryParseWorkOrderSequence(String(wo), prefix);
    if (seq != null) maxExisting = Math.max(maxExisting, seq);
  }

  let next = 1;
  if (storage) {
    const raw = storage.getItem(getStorageKey(namespace, prefix));
    const fromStorage = raw ? Number(raw) : NaN;
    const baseline = Number.isFinite(fromStorage) && fromStorage > 0 ? fromStorage : 0;
    next = Math.max(baseline + 1, maxExisting + 1, 1);
    storage.setItem(getStorageKey(namespace, prefix), String(next));
  } else {
    next = Math.max(maxExisting + 1, 1);
  }

  return formatWorkOrderNumber(prefix, next);
};
