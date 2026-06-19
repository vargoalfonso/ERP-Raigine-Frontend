export const BUY_NOT_BUY_FLAG_STORAGE_KEY = "system-settings-buy-not-buy-flags";

export type BuyNotBuyStatus = "Overstock" | "Normal";
export type BuyNotBuyDecision = "Buy" | "Not Buy";

export type BuyNotBuyFlagRecord = {
  id: string;
  uniq: string;
  materialCode: string;
  materialName: string;
  inventoryType: string;
  safetyStockParam: string;
  deliveryCycle: number;
  currentStock: number;
  safetyStock: number;
  kanbanStd: number;
  forecastedUsagePerDay?: number;
  stockDays?: number;
  highRatio?: number;
  status: BuyNotBuyStatus;
  buyFlag: BuyNotBuyDecision;
  createdAt: string;
  updatedAt: string;
};

export type BuyNotBuyFlagDraft = Omit<
  BuyNotBuyFlagRecord,
  "id" | "status" | "buyFlag" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

const DEFAULT_HIGH_RATIO = 2;
const DEFAULT_PRL_DIVISOR = 1;

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown) => String(value ?? "").trim();

export const computeBuyNotBuyMetrics = (
  draft: Pick<
    BuyNotBuyFlagDraft,
    | "currentStock"
    | "safetyStock"
    | "deliveryCycle"
    | "kanbanStd"
    | "forecastedUsagePerDay"
    | "stockDays"
    | "highRatio"
  >,
  options?: { prlDivisor?: number },
) => {
  const currentStock = toFiniteNumber(draft.currentStock);
  const safetyStock = Math.max(0, toFiniteNumber(draft.safetyStock));
  const deliveryCycle = Math.max(0, toFiniteNumber(draft.deliveryCycle));
  const kanbanStd = Math.max(0, toFiniteNumber(draft.kanbanStd));
  const highRatio = Math.max(
    0.1,
    toFiniteNumber(draft.highRatio, DEFAULT_HIGH_RATIO),
  );
  const prlDivisor = Math.max(
    1,
    toFiniteNumber(options?.prlDivisor, DEFAULT_PRL_DIVISOR),
  );

  const explicitDailyUsage = toFiniteNumber(draft.forecastedUsagePerDay);
  const derivedDailyUsage =
    explicitDailyUsage > 0
      ? explicitDailyUsage
      : deliveryCycle > 0 && kanbanStd > 0
        ? kanbanStd / deliveryCycle
        : 0;

  const denominator = Math.max(1, derivedDailyUsage / prlDivisor);
  const explicitStockDays = toFiniteNumber(draft.stockDays);
  const stockDays =
    explicitStockDays > 0 ? explicitStockDays : currentStock / denominator;

  const status: BuyNotBuyStatus =
    currentStock > safetyStock * highRatio ? "Overstock" : "Normal";
  const buyFlag: BuyNotBuyDecision =
    status === "Overstock" || stockDays > deliveryCycle ? "Not Buy" : "Buy";

  return {
    highRatio,
    dailyUsage: derivedDailyUsage,
    stockDays: Number(stockDays.toFixed(2)),
    status,
    buyFlag,
  };
};

export const normalizeBuyNotBuyFlagRecord = (
  draft: BuyNotBuyFlagDraft,
  existing?: BuyNotBuyFlagRecord,
) => {
  const timestamp = new Date().toISOString();
  const metrics = computeBuyNotBuyMetrics(draft);

  return {
    id:
      normalizeText(draft.id) ||
      existing?.id ||
      `BNB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    uniq: normalizeText(draft.uniq),
    materialCode: normalizeText(draft.materialCode),
    materialName: normalizeText(draft.materialName),
    inventoryType: normalizeText(draft.inventoryType),
    safetyStockParam: normalizeText(draft.safetyStockParam),
    deliveryCycle: Math.max(0, toFiniteNumber(draft.deliveryCycle)),
    currentStock: Math.max(0, toFiniteNumber(draft.currentStock)),
    safetyStock: Math.max(0, toFiniteNumber(draft.safetyStock)),
    kanbanStd: Math.max(0, toFiniteNumber(draft.kanbanStd)),
    forecastedUsagePerDay:
      toFiniteNumber(draft.forecastedUsagePerDay) > 0
        ? toFiniteNumber(draft.forecastedUsagePerDay)
        : undefined,
    stockDays: metrics.stockDays,
    highRatio: metrics.highRatio,
    status: metrics.status,
    buyFlag: metrics.buyFlag,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  } satisfies BuyNotBuyFlagRecord;
};

export const loadBuyNotBuyFlagRecords = () => {
  if (typeof window === "undefined") return [] as BuyNotBuyFlagRecord[];

  try {
    const raw = window.localStorage.getItem(BUY_NOT_BUY_FLAG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is BuyNotBuyFlagDraft =>
        Boolean(item && typeof item === "object"),
      )
      .map((item) => normalizeBuyNotBuyFlagRecord(item));
  } catch {
    return [];
  }
};

export const saveBuyNotBuyFlagRecords = (records: BuyNotBuyFlagRecord[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    BUY_NOT_BUY_FLAG_STORAGE_KEY,
    JSON.stringify(records),
  );
};