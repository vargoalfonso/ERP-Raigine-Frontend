/**
 * Pengembangan entri form Safety Stock menjadi item yang dikirim ke API.
 *
 * - Pilihan Uniq "All Uniq in <Type>" (ALL_UNIQ_VALUE) diterapkan ke semua uniq yang
 *   tersedia untuk KATEGORI tipe itu (lihat uniqsInCategory).
 * - Entri yang memilih uniq tertentu selalu didahulukan: uniq itu tidak ikut diambil
 *   oleh "All Uniq" (tidak dobel).
 * - Calculation type "forecast" tidak memakai Constanta (backend memakai hasil forecast
 *   apa adanya), jadi Constanta dikirim 0.
 */

export const ALL_UNIQ_VALUE = "__ALL_UNIQ__";
export const FORECAST_CALCULATION = "forecast";

export type SafetyStockEntryLike = {
  uniq?: string;
  calculationType?: string;
  constanta?: number;
};

export type SafetyStockItem = {
  inventory_type: string;
  item_uniq_code: string;
  calculation_type: string;
  constanta: number;
};

/**
 * Kategori uniq untuk pilihan "All Uniq in <Type>". Uniq hanya ikut bila kategorinya
 * sama dengan Type yang dipilih (bukan semua uniq):
 * - raw_material      : material spec BOM type_material = raw
 * - indirect_material : material spec BOM type_material = indirect
 * - subcon            : material spec BOM is_subcon = true
 * - finished_goods    : uniq dengan Kanban Standard aktif (sama dengan form Finished Goods)
 *
 * Satu uniq bisa masuk dua kategori (mis. raw sekaligus subcon).
 */
export type UniqCategoryContext = {
  materialSpecByUniq: Record<string, Record<string, unknown> | undefined>;
  /** uniq dengan Kanban Standard aktif */
  finishedGoodsUniqs: string[];
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

const specTypeMaterial = (spec?: Record<string, unknown>) =>
  norm(spec?.type_material ?? spec?.typeMaterial);

const specIsSubcon = (spec?: Record<string, unknown>) => {
  const flag = spec?.is_subcon ?? spec?.isSubcon;
  return flag === true || norm(flag) === "true";
};

export function uniqsInCategory(
  type: string | undefined,
  ctx: UniqCategoryContext,
  candidates: string[],
): string[] {
  switch (type) {
    case "raw_material":
      return candidates.filter((u) => {
        const t = specTypeMaterial(ctx.materialSpecByUniq[u]);
        return t === "raw" || t === "raw_material";
      });
    case "indirect_material":
      return candidates.filter((u) => specTypeMaterial(ctx.materialSpecByUniq[u]) === "indirect");
    case "subcon":
      return candidates.filter((u) => specIsSubcon(ctx.materialSpecByUniq[u]));
    case "finished_goods": {
      const fg = new Set(ctx.finishedGoodsUniqs.map((u) => String(u).trim()));
      return candidates.filter((u) => fg.has(u));
    }
    default:
      return [];
  }
}

export const isForecastCalculation = (calculationType?: string) =>
  String(calculationType ?? "").trim() === FORECAST_CALCULATION;

export const isAllUniq = (uniq?: string) => uniq === ALL_UNIQ_VALUE;

/** Uniq yang akan dipakai oleh entri "All Uniq" (tidak termasuk uniq yang dipilih eksplisit). */
export function uniqsForAllEntries(
  entries: SafetyStockEntryLike[],
  availableUniqs: string[],
): string[] {
  const explicit = new Set(
    entries
      .filter((e) => e.uniq && !isAllUniq(e.uniq))
      .map((e) => String(e.uniq).trim()),
  );
  return availableUniqs.filter((u) => !explicit.has(u));
}

export type ExpandResult =
  | { ok: true; items: SafetyStockItem[]; allUniqCount: number }
  | { ok: false; error: string };

export function expandSafetyStockEntries(
  entries: SafetyStockEntryLike[],
  availableUniqs: string[],
  inventoryType: string,
): ExpandResult {
  const taken = new Set(
    entries
      .filter((e) => e.uniq && !isAllUniq(e.uniq))
      .map((e) => String(e.uniq).trim()),
  );

  const items: SafetyStockItem[] = [];
  let allUniqCount = 0;

  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const calculation_type = String(e.calculationType ?? "").trim();
    const constanta = isForecastCalculation(calculation_type) ? 0 : Number(e.constanta ?? 0);

    if (isAllUniq(e.uniq)) {
      const targets = availableUniqs.filter((u) => !taken.has(u));
      if (targets.length === 0) {
        return {
          ok: false,
          error: `Entry ${i + 1}: tidak ada Uniq tersisa untuk diterapkan`,
        };
      }
      targets.forEach((u) => taken.add(u));
      allUniqCount += targets.length;
      targets.forEach((u) =>
        items.push({ inventory_type: inventoryType, item_uniq_code: u, calculation_type, constanta }),
      );
      continue;
    }

    items.push({
      inventory_type: inventoryType,
      item_uniq_code: String(e.uniq ?? "").trim(),
      calculation_type,
      constanta,
    });
  }

  return { ok: true, items, allUniqCount };
}
