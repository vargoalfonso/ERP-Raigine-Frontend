import type { ExcelColumn } from "@/lib/utils/excel/masterExcel";

/**
 * Kolom template import Excel untuk halaman Indirect Raw Materials.
 * Part Number / Part Name / UoM boleh kosong: backend melengkapinya dari
 * master item berdasarkan Uniq.
 */
export const INDIRECT_EXCEL_COLUMNS: ExcelColumn[] = [
  {
    key: "uniq_code",
    header: "Uniq",
    required: true,
    example: "IRM-001",
    instruction: "Kode UNIQ material indirect. Wajib diisi dan tidak boleh dobel di file.",
  },
  {
    key: "part_number",
    header: "Part Number",
    example: "WASHER-M8",
    instruction: "Opsional. Jika kosong diambil dari master item.",
  },
  {
    key: "part_name",
    header: "Part Name",
    example: "Washer M8",
    instruction: "Opsional. Jika kosong diambil dari master item.",
  },
  {
    key: "warehouse_location",
    header: "Warehouse Location",
    example: "WH-A",
    instruction: "Opsional. Nama warehouse penyimpanan.",
  },
  {
    key: "uom",
    header: "UoM",
    example: "pcs",
    instruction: "Opsional. Satuan, mis. pcs / kg. Jika kosong diambil dari master item.",
  },
  {
    key: "stock_qty",
    header: "Stock Qty",
    required: true,
    example: "3000",
    instruction: "Wajib. Angka stok awal (0 atau lebih).",
  },
];

export const INDIRECT_EXCEL_EXAMPLE_ROWS = [
  {
    uniq_code: "IRM-001",
    part_number: "WASHER-M8",
    part_name: "Washer M8",
    warehouse_location: "WH-A",
    uom: "pcs",
    stock_qty: "3000",
  },
];
