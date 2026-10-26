import { normalizeSupplierItemTypeKey } from "@/lib/utils/supplierItemType";

type SupplierItemLike = {
  uniq_code?: unknown;
  supplier_name?: unknown;
  status?: unknown;
  type?: unknown;
  material_type?: unknown;
};

const norm = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

/**
 * Nama SubCon untuk PO bertipe subcon.
 *
 * PO lama menyimpan supplier dari entry budget yang kadang salah (pemasok
 * bahan baku). Nama yang ditampilkan dicocokkan dengan Master Supplier Item
 * bertipe `subcon` untuk UNIQ di PO tersebut:
 *  - nama tersimpan termasuk vendor subcon resmi  -> dipakai apa adanya
 *  - hanya ada satu vendor subcon resmi           -> pakai vendor itu
 *  - selain itu (tidak ada / lebih dari satu)     -> nama tersimpan
 */
export function resolveSubconSupplierName(args: {
  storedName: string;
  uniqCodes: Array<string | undefined | null>;
  supplierItems: SupplierItemLike[];
}): string {
  const { storedName, uniqCodes, supplierItems } = args;
  const wanted = new Set(uniqCodes.map(norm).filter(Boolean));
  if (wanted.size === 0) return storedName;

  const candidates = new Map<string, string>(); // lower -> display
  supplierItems.forEach((item) => {
    const status = norm(item.status || "active");
    if (status && status !== "active") return;
    if (
      normalizeSupplierItemTypeKey(item.type ?? item.material_type) !== "subcon"
    ) {
      return;
    }
    if (!wanted.has(norm(item.uniq_code))) return;
    const name = String(item.supplier_name ?? "").trim();
    if (name) candidates.set(name.toLowerCase(), name);
  });

  if (candidates.size === 0) return storedName;
  if (candidates.has(norm(storedName))) return storedName;
  if (candidates.size === 1) return Array.from(candidates.values())[0];
  return storedName;
}

/**
 * Cycle time (lead time) vendor subcon = jumlah total pengiriman terjadwal.
 * Hanya dari Supplier Item bertipe `subcon` milik vendor itu untuk UNIQ yang
 * relevan. Mengembalikan 0 bila tidak ada data (pemanggil boleh fallback).
 */
export function resolveSubconCycleTime(args: {
  supplierName: string;
  uniqCodes: Array<string | undefined | null>;
  supplierItems: Array<SupplierItemLike & { cycle_time?: unknown }>;
}): number {
  const name = norm(args.supplierName);
  if (!name) return 0;
  const wanted = new Set(args.uniqCodes.map(norm).filter(Boolean));
  let max = 0;
  args.supplierItems.forEach((item) => {
    const status = norm(item.status || "active");
    if (status && status !== "active") return;
    if (
      normalizeSupplierItemTypeKey(item.type ?? item.material_type) !== "subcon"
    ) {
      return;
    }
    if (norm(item.supplier_name) !== name) return;
    if (wanted.size > 0 && !wanted.has(norm(item.uniq_code))) return;
    const ct = Number(item.cycle_time ?? 0);
    if (Number.isFinite(ct) && ct > max) max = ct;
  });
  return max;
}
