/**
 * Utility functions untuk Raw Materials
 */

import { RawMaterialRecord } from "./interface";

/**
 * Format nilai yang bisa null/undefined menjadi string atau "-"
 */
export const formatValue = (
  value: string | number | null | undefined
): string => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
};

/**
 * Format angka dengan pemisah ribuan
 */
export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "-";
  }
  return new Intl.NumberFormat("id-ID").format(value);
};

/**
 * Format harga dalam IDR
 */
export const formatPrice = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "-";
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Format tanggal
 */
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return "-";
  }

  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return "-";
  }
};

/**
 * Format boolean menjadi Yes/No atau "-"
 */
export const formatBoolean = (value: boolean | null | undefined): string => {
  if (value === null || value === undefined) {
    return "-";
  }
  return value ? "Yes" : "No";
};

/**
 * Format status stock dengan warna
 */
export const getStatusStockColor = (status: string | undefined): string => {
  switch (status) {
    case "Available":
      return "text-green-600 bg-green-50";
    case "OutOfStock":
      return "text-red-600 bg-red-50";
    case "LowStock":
      return "text-yellow-600 bg-yellow-50";
    case "Reserved":
      return "text-blue-600 bg-blue-50";
    case "Damaged":
      return "text-gray-600 bg-gray-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
};

/**
 * Transform Raw Material data untuk display
 */
export const transformRawMaterialForDisplay = (data: RawMaterialRecord) => {
  return {
    id: data.id,
    //code: formatValue(data.code),
    name: formatValue(data.name),
    category: formatValue(data.category),
    partName: formatValue(data.part_name),
    partNo: formatValue(data.part_no),
    model: formatValue(data.model),
    kanbanQuantity: formatNumber(data.kanban_quantity),
    totalKanban: formatNumber(data.total_kanban),
    stock: formatNumber(data.stock),
    stockDays: formatNumber(data.stock_days),
    safetyStock: formatNumber(data.safety_stock),
    price: formatPrice(data.price),
    orderFlag: formatBoolean(data.order_flag),
    description: formatValue(data.description),
    //status: formatValue(data.status),
    isBuyed: formatBoolean(data.is_buyed),
    saveAs: formatValue(data.save_as),
    supplierName: formatValue(data.master_list_supplier?.name),
    warehouseName: formatValue(data.warehouse?.name),
    createdAt: formatDate(data.created_at),
    updatedAt: formatDate(data.updated_at),
  };
};

/**
 * Validate required fields untuk create/update
 */
export const validateRawMaterialData = (data: Partial<RawMaterialRecord>) => {
  const errors: string[] = [];

  // NOTE: For create/update raw material via `/inventory/:type`, backend does NOT require
  // `code` nor `quality_status`. Validate only the fields needed by that contract.
  const uniq = (data as any)?.uniq ?? (data as any)?.uniq_code;
  const rawMaterialType = (data as any)?.raw_material_type ?? (data as any)?.category;
  const rmSource = (data as any)?.rm_source ?? (data as any)?.master_list_supplier_id;
  const warehouseLocation = (data as any)?.warehouse_location ?? (data as any)?.warehouse_id;
  const uom = (data as any)?.uom ?? (data as any)?.unit;
  const stockQty = (data as any)?.stock_qty ?? (data as any)?.stock;

  if (!String(uniq ?? "").trim()) errors.push("Uniq is required");
  if (!String(rawMaterialType ?? "").trim()) errors.push("Raw Material Type is required");
  if (!String(rmSource ?? "").trim()) errors.push("Raw Material Source is required");
  if (!String(warehouseLocation ?? "").trim()) errors.push("Warehouse Location is required");
  if (!String(uom ?? "").trim()) errors.push("UOM is required");
  if (!(typeof stockQty === "number" ? Number.isFinite(stockQty) : String(stockQty ?? "").trim())) {
    errors.push("Stock Qty is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
