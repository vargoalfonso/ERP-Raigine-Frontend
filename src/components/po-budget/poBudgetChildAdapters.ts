import type {
  PoBudgetChildSupplier,
  PoBudgetPrlChild,
  PoBudgetPrlDetail,
  PoBudgetStoredDetail,
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
  const parent = detail?.items?.[0];
  const children = Array.isArray(parent?.children) ? parent.children : [];
  const childCount = children.length > 0 ? children.length : 1;
  const parentQty = num(parent?.remaining_qty ?? parent?.quantity);
  const perChildQty = Math.round(parentQty / childCount);
  return children.map((child, index) =>
    toChildRow(detail, parent, child, index, perChildQty),
  );
}

export function buildBulkChildRowsFromPrlDetail(
  detail: PoBudgetPrlDetail | undefined,
): PoBudgetChildRow[] {
  return (detail?.items ?? []).flatMap((item) => {
    const children = Array.isArray(item.children) ? item.children : [];
    const childCount = children.length > 0 ? children.length : 1;
    const parentQty = num(item?.remaining_qty ?? item?.quantity);
    const perChildQty = Math.round(parentQty / childCount);
    return children.map((child, index) =>
      toChildRow(detail, item, child, index, perChildQty),
    );
  });
}

export function buildSingleStoredDetailPayload(input: {
  prlId?: string;
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

  return {
    parent: {
      prl_id: text(input.prlId),
      prl_row_id: input.rows[0]?.prlItemId ?? undefined,
      uniq_code: text(input.parentUniqCode),
      part_name: text(input.parentPartName),
      part_number: text(input.parentPartNumber),
    },
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
    })),
  };
}

export function getStoredChildren(
  detailJson: PoBudgetStoredDetail | undefined,
): PoBudgetPrlChild[] {
  return Array.isArray(detailJson?.children) ? detailJson.children : [];
}
