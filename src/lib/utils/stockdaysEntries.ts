import { ALL_UNIQ_VALUE, isAllUniq } from "@/lib/utils/safetyStockEntries";

/**
 * Entri form Stockdays -> item yang dikirim ke API.
 *
 * - "Data history" (calculation_type = "percentage") tidak memakai Constanta di form.
 *   Backend menghitung tipe ini sebagai daily usage x (constanta / 100), jadi yang
 *   dikirim adalah 100 (= 100% daily usage, yaitu Stock / Daily Usage apa adanya).
 *   Mengirim 0 akan membuat daily usage efektif 0 dan hasilnya salah.
 * - Pilihan Uniq "All Uniq in <Type>" diterapkan ke semua uniq yang tersedia untuk
 *   KATEGORI tipe itu. Uniq yang dipilih manual didahulukan (tidak dobel).
 */

export const DATA_HISTORY_CALCULATION = "percentage";
export const DATA_HISTORY_CONSTANTA = 100;

export const isDataHistoryCalculation = (calculationType?: string) =>
  String(calculationType ?? "").trim() === DATA_HISTORY_CALCULATION;

/** Constanta yang dikirim ke API untuk sebuah entri. */
export const effectiveConstanta = (calculationType?: string, constanta?: number) =>
  isDataHistoryCalculation(calculationType) ? DATA_HISTORY_CONSTANTA : constanta;

export type StockdaysEntryLike = {
  inventoryType: string;
  itemCode: string;
  calculationType: string;
  constanta?: number;
};

export type StockdaysItem = {
  inventory_type: string;
  item_code: string;
  calculation_type: string;
  constanta?: number;
  status: "active";
};

export type StockdaysExpandResult =
  | { ok: true; items: StockdaysItem[]; allUniqCount: number }
  | { ok: false; error: string };

/**
 * @param availableUniqsFor uniq yang boleh dipakai "All Uniq" untuk sebuah tipe
 *                          (sudah sekategori dan belum punya parameter Stockdays).
 */
export function expandStockdaysEntries(
  entries: StockdaysEntryLike[],
  availableUniqsFor: (inventoryType: string) => string[],
): StockdaysExpandResult {
  const taken = new Map<string, Set<string>>();
  const takenFor = (type: string) => {
    let set = taken.get(type);
    if (!set) {
      set = new Set<string>();
      taken.set(type, set);
    }
    return set;
  };
  // Uniq manual didahulukan.
  entries.forEach((e) => {
    if (!isAllUniq(e.itemCode)) takenFor(e.inventoryType).add(String(e.itemCode).trim());
  });

  const items: StockdaysItem[] = [];
  let allUniqCount = 0;

  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const constanta = effectiveConstanta(e.calculationType, e.constanta);
    const base = {
      inventory_type: e.inventoryType,
      calculation_type: e.calculationType,
      constanta,
      status: "active" as const,
    };

    if (isAllUniq(e.itemCode)) {
      const used = takenFor(e.inventoryType);
      const targets = availableUniqsFor(e.inventoryType).filter((u) => !used.has(u));
      if (targets.length === 0) {
        return { ok: false, error: `Entry ${i + 1}: tidak ada Uniq tersisa untuk diterapkan` };
      }
      targets.forEach((u) => used.add(u));
      allUniqCount += targets.length;
      targets.forEach((u) => items.push({ ...base, item_code: u }));
      continue;
    }
    items.push({ ...base, item_code: String(e.itemCode).trim() });
  }

  return { ok: true, items, allUniqCount };
}

export { ALL_UNIQ_VALUE };
