import type { ExcelColumn } from "@/lib/utils/excel/masterExcel";

/**
 * Kolom template import Excel untuk halaman Work In Progress.
 * Satu baris = satu item WIP (WO + Uniq + Packing Number). Kolom Process
 * boleh berisi beberapa proses dipisah koma, sesuai urutan alur proses.
 */
export const WIP_EXCEL_COLUMNS: ExcelColumn[] = [
  {
    key: "wo_number",
    header: "WO Number",
    required: true,
    example: "WO-2026-0001",
    instruction: "Nomor Work Order yang sudah ada di sistem.",
  },
  {
    key: "uniq",
    header: "Uniq",
    required: true,
    example: "CW8",
    instruction: "Kode UNIQ yang terdaftar di BOM.",
  },
  {
    key: "packing_number",
    header: "Packing Number",
    example: "PK-0001",
    instruction: "Opsional. Nomor packing / kanban. Jika kosong diambil dari BOM.",
  },
  {
    key: "wip_type",
    header: "WIP Type",
    example: "Draft",
    instruction: "Opsional. Harus sesuai Type Parameter. Jika kosong dipakai tipe pertama.",
  },
  {
    key: "process",
    header: "Process",
    required: true,
    example: "Welding, Assembly",
    instruction:
      "Wajib. Nama proses sesuai master Process. Beberapa proses dipisah koma dan diurutkan sesuai alur.",
  },
  {
    key: "stock",
    header: "Stock",
    required: true,
    example: "100",
    instruction: "Wajib. Jumlah stok WIP (angka lebih dari 0).",
  },
  {
    key: "qty_per_kanban",
    header: "Qty / Kanban",
    example: "50",
    instruction: "Opsional. Jumlah pcs per kanban.",
  },
];

export const WIP_EXCEL_EXAMPLE_ROWS = [
  {
    wo_number: "WO-2026-0001",
    uniq: "CW8",
    packing_number: "PK-0001",
    wip_type: "Draft",
    process: "Welding, Assembly",
    stock: "100",
    qty_per_kanban: "50",
  },
];
