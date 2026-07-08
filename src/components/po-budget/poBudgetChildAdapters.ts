import type {
  PoBudgetChildSupplier,
  PoBudgetPrlChild,
  PoBudgetPrlDetail,
  PoBudgetStoredDetail,
  PoBudgetStoredDetailParent,
  PoBudgetType,
} from "@/lib/api/po-budget/api";

export type PoBudgetChildRowSupplier = {
  id: string;
  supplier: string;
  qty: number;
  percentage?: number;
};

export type PoBudgetChildRow = {
  key: string;
  prlId: string;
  prlItemId: number | null;
  uniq: string;
  childUniqCode: string;
  /** uniq_code of the PRL parent item (for grouping display) */
  parentUniqCode: string;
  productModel: string;
  partName: string;
  partNumber: string;
  weightKg: number;
  uom: string;
  quantity: number;
  existingRawMaterial: string;
  suppliers: PoBudgetChildRowSupplier[];
  materialSpec?: PoBudgetPrlChild["material_spec"];
  qtyPerUniq?: number;
  /** If true, this row is a non-editable group header (parent UNIQ) */
  isHeader?: boolean;
  /** Number of children under this header */
  childCount?: number;
};

const text = (value: unknown, fallback = "") =>
  String(value ?? fallback).trim();

const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const isChildBudgetType = (type: PoBudgetType) =>
  type === "raw-material" || type === "indirect";

export const getChildSupplierLookupUniq = (row: PoBudgetChildRow) =>
  text(row.childUniqCode || row.uniq);

const toChildRow = (
  detail: PoBudgetPrlDetail | undefined,
  parentItem: PoBudgetPrlDetail["items"][number] | undefined,
  child: PoBudgetPrlChild,
  index: number,
  effectiveQty: number,
): PoBudgetChildRow => ({
    key: `${text(detail?.id, "prl")}-${text(parentItem?.id, "item")}-${text(child.uniq_code, `child-${index}`)}-${index}`,
    prlId: text(detail?.id),
    prlItemId: parentItem?.id ?? null,
    uniq: text(
      child.uniq ?? child.material_spec?.material_grade ?? child.uniq_code,
    ),
    childUniqCode: text(child.uniq_code),
    parentUniqCode: text(parentItem?.uniq_code),
    productModel: text(child.model ?? parentItem?.product_model, "-"),
    partName: text(child.part_name, "-"),
    partNumber: text(child.part_number, "-"),
    weightKg: num(child.weight_kg ?? child.material_spec?.weight_kg),
    uom: text(child.uom),
    quantity: effectiveQty ?? 0,
    existingRawMaterial: text(child.existing_raw_material, "-"),
    suppliers: Array.isArray(child.suppliers)
      ? child.suppliers.map((supplier, supplierIndex) => ({
          id: `seed-${supplierIndex + 1}`,
          supplier: text(supplier.supplier_name),
          qty: num(supplier.quantity),
        }))
      : [],
    materialSpec: child.material_spec,
    qtyPerUniq: num(child.qty_per_uniq),
});

export function buildSingleChildRowsFromPrlDetail(
  detail: PoBudgetPrlDetail | undefined,
): PoBudgetChildRow[] {
  const items = detail?.items ?? [];
  return items.flatMap((parent) => {
    const children = Array.isArray(parent.children) ? parent.children : [];
    const childCount = children.length > 0 ? children.length : 1;
    const parentQty = num(parent?.remaining_qty ?? parent?.quantity);
    const perChildQty = Math.round(parentQty / childCount);
    return children.map((child, index) =>
      toChildRow(detail, parent, child, index, perChildQty),
    );
  });
}

/**
 * Build flat child rows from PRL detail, with header rows interspersed
 * for each parent UNIQ group so the bulk table renders grouped sections.
 */
export function buildBulkChildRowsFromPrlDetail(
  detail: PoBudgetPrlDetail | undefined,
): PoBudgetChildRow[] {
  const items = detail?.items ?? [];
  const rows: PoBudgetChildRow[] = [];

  for (let pIdx = 0; pIdx < items.length; pIdx++) {
    const item = items[pIdx];
    const children = Array.isArray(item.children) ? item.children : [];
    const parentQty = num(item?.remaining_qty ?? item?.quantity);
    const childCount = children.length > 0 ? children.length : 1;
    const perChildQty = Math.round(parentQty / childCount);

    // Insert header row for this parent UNIQ
    rows.push({
      key: `${text(detail?.id, "prl")}-parent-${text(item?.id, `p${pIdx}`)}`,
      prlId: text(detail?.id),
      prlItemId: item?.id ?? null,
      uniq: text(item?.uniq_code),
      childUniqCode: "",
      parentUniqCode: text(item?.uniq_code),
      productModel: text(item?.product_model, "-"),
      partName: text(item?.part_name, "-"),
      partNumber: text(item?.part_number, "-"),
      weightKg: num(item?.weight_kg),
      uom: text(item?.uom),
      quantity: parentQty,
      existingRawMaterial: text(item?.existing_raw_material, "-"),
      suppliers: [],
      materialSpec: undefined,
      qtyPerUniq: 0,
      isHeader: true,
      childCount: children.length,
    });

    // Child rows
    for (let cIdx = 0; cIdx < children.length; cIdx++) {
      rows.push(toChildRow(detail, item, children[cIdx], cIdx, perChildQty));
    }
  }

  return rows;
}

/**
 * Build stored detail payload for single-add budget entry.
 * Groups children by parentUniqCode into the new multi-parent format.
 */
export function buildSingleStoredDetailPayload(input: {
  prlId?: string;
  prlPeriod?: string;
  parentUniqCode: string;
  parentPartName: string;
  parentPartNumber: string;
  purchaseRequest: number;
  supplierId?: number | string | null;
  supplierName?: string;
  rows: PoBudgetChildRow[];
}): PoBudgetStoredDetail | undefined {
  if (input.rows.length === 0) return undefined;

  const childSupplier: PoBudgetChildSupplier[] = input.supplierName
    ? [
        {
          supplier_id: input.supplierId ?? null,
          supplier_name: text(input.supplierName),
          quantity: num(input.purchaseRequest),
        },
      ]
    : [];

  // Group rows by parentUniqCode
  const groupMap = new Map<string, PoBudgetChildRow[]>();
  for (const row of input.rows) {
    const key = row.parentUniqCode || input.parentUniqCode || "_";
    const existing = groupMap.get(key) ?? [];
    existing.push(row);
    groupMap.set(key, existing);
  }

  const parents: PoBudgetStoredDetailParent[] = [];
  for (const [uniqCode, groupRows] of groupMap) {
    const firstRow = groupRows[0];
    parents.push({
      prl_row_id: firstRow?.prlItemId ?? undefined,
      uniq_code: uniqCode,
      part_name: firstRow?.partName ?? input.parentPartName,
      part_number: firstRow?.partNumber ?? input.parentPartNumber,
      children: groupRows.map((row) => ({
        uniq: text(row.uniq),
        uniq_code: text(row.childUniqCode),
        part_name: text(row.partName),
        part_number: text(row.partNumber),
        model: text(row.productModel),
        qty_per_uniq: num(row.qtyPerUniq),
        weight_kg: num(row.weightKg),
        quantity: num(input.purchaseRequest),
        existing_raw_material: text(row.existingRawMaterial, "-"),
        uom: text(row.uom),
        material_spec: row.materialSpec,
        suppliers: childSupplier,
        children: [],
      })),
    });
  }

  return {
    prl_id: text(input.prlId),
    period: text(input.prlPeriod),
    parent: {
      prl_id: text(input.prlId),
      prl_row_id: input.rows[0]?.prlItemId ?? undefined,
      uniq_code: text(input.parentUniqCode),
      part_name: text(input.parentPartName),
      part_number: text(input.parentPartNumber),
    },
    // Simpan juga children flat untuk backward compat
    children: input.rows.map((row) => ({
      uniq: text(row.uniq),
      uniq_code: text(row.childUniqCode),
      part_name: text(row.partName),
      part_number: text(row.partNumber),
      model: text(row.productModel),
      qty_per_uniq: num(row.qtyPerUniq),
      weight_kg: num(row.weightKg),
      quantity: num(input.purchaseRequest),
      existing_raw_material: text(row.existingRawMaterial, "-"),
      uom: text(row.uom),
      material_spec: row.materialSpec,
      suppliers: childSupplier,
      children: [],
    })),
    parents,
  };
}

export function getStoredChildren(
  detailJson: PoBudgetStoredDetail | undefined,
): PoBudgetPrlChild[] {
  // Prefer new format: parents[].children[]
  if (Array.isArray(detailJson?.parents) && detailJson.parents.length > 0) {
    return detailJson.parents.flatMap((p) =>
      Array.isArray(p.children) ? p.children : [],
    );
  }
  // Fallback: old flat children[]
  return Array.isArray(detailJson?.children) ? detailJson.children : [];
}

/** Return parents array from stored detail (new format) or wrap old format. */
export function getStoredParents(
  detailJson: PoBudgetStoredDetail | undefined,
): PoBudgetStoredDetailParent[] {
  if (Array.isArray(detailJson?.parents) && detailJson.parents.length > 0) {
    return detailJson.parents;
  }
  // Wrap old single-parent format
  if (detailJson?.parent) {
    const children = Array.isArray(detailJson?.children)
      ? detailJson.children
      : [];
    return [
      {
        prl_row_id: detailJson.parent.prl_row_id,
        uniq_code: detailJson.parent.uniq_code,
        part_name: detailJson.parent.part_name,
        part_number: detailJson.parent.part_number,
        children,
      },
    ];
  }
  return [];
}
