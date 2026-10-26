/**
 * Pemilihan Supplier Item berdasarkan tipe item efektif.
 *
 * Masalah yang diselesaikan: UNIQ subcon (BOM: is_subcon = true) bisa punya
 * beberapa Supplier Item, mis. pemasok pipa bahan baku dan vendor subcon.
 * Pencarian supplier di PO Budget kadang tidak memfilter tipe (child row)
 * atau meloloskan item tanpa tipe, sehingga pemasok bahan baku ikut terpilih
 * sebagai SubCon. Helper ini memastikan item subcon hanya memakai Supplier
 * Item bertipe `subcon`.
 */
export type SupplierItemTypeKey = "raw" | "indirect" | "subcon";

type TypedSupplierItem = {
  type?: unknown;
  material_type?: unknown;
};

export function normalizeSupplierItemTypeKey(
  value: unknown,
): SupplierItemTypeKey | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw.includes("sub")) return "subcon";
  if (raw.includes("indirect")) return "indirect";
  if (raw.includes("raw")) return "raw";
  return null;
}

/** True bila material_spec BOM menandai UNIQ ini sebagai subcon. */
export function isSubconMaterialSpec(spec: unknown): boolean {
  if (!spec || typeof spec !== "object") return false;
  const record = spec as Record<string, unknown>;
  const flag = record.is_subcon ?? record.isSubcon;
  if (flag === true || String(flag ?? "").trim().toLowerCase() === "true") {
    return true;
  }
  return normalizeSupplierItemTypeKey(record.type_material) === "subcon";
}

/**
 * Ambil Supplier Item untuk tipe tertentu. Item bertipe sama diutamakan;
 * bila tidak ada, boleh item tanpa tipe (data lama). Item bertipe LAIN
 * (mis. raw_material) tidak pernah ikut terpilih.
 */
export function pickSupplierItemsByType<T extends TypedSupplierItem>(
  items: T[],
  type: SupplierItemTypeKey,
): T[] {
  const keyOf = (item: T) =>
    normalizeSupplierItemTypeKey(item.type ?? item.material_type);
  const typed = items.filter((item) => keyOf(item) === type);
  if (typed.length > 0) return typed;
  return items.filter((item) => keyOf(item) === null);
}
