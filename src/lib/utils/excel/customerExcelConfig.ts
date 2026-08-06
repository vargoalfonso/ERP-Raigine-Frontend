import type { ExcelColumn } from "@/lib/utils/excel/masterExcel";

/**
 * Column definition for Master Customer Import / Export.
 * `key` maps to the parsed row object and to the export row we build.
 */
export const CUSTOMER_EXCEL_COLUMNS: ExcelColumn[] = [
  {
    key: "customer_id",
    header: "Customer ID",
    required: false,
    example: "CUST-0001",
    instruction:
      "Opsional. Kosongkan jika ingin ID dibuat otomatis oleh sistem.",
  },
  {
    key: "customer_name",
    header: "Customer Name",
    required: true,
    example: "PT Maju Jaya",
    instruction: "Wajib. Nama perusahaan / customer.",
  },
  {
    key: "phone_number",
    header: "Phone Number",
    required: true,
    example: "+62-21-1234567",
    instruction: "Wajib. Nomor telepon customer.",
  },
  {
    key: "shipping_address",
    header: "Shipping Address",
    required: true,
    example: "Jl. Industri No. 10, Bekasi",
    instruction: "Wajib. Alamat pengiriman lengkap.",
  },
  {
    key: "billing_same_as_shipping",
    header: "Billing Same As Shipping",
    required: false,
    example: "Yes",
    instruction:
      "Isi Yes / No (atau Ya / Tidak). Jika Yes maka Billing Address diabaikan. Default Yes.",
  },
  {
    key: "billing_address",
    header: "Billing Address",
    required: false,
    example: "",
    instruction:
      "Wajib diisi jika Billing Same As Shipping = No. Alamat penagihan lengkap.",
  },
  {
    key: "bank_account",
    header: "Bank Account",
    required: false,
    example: "BCA",
    instruction: "Opsional. Nama bank.",
  },
  {
    key: "bank_account_number",
    header: "Bank Account Number",
    required: false,
    example: "1234567890",
    instruction: "Opsional. Nomor rekening bank.",
  },
  {
    key: "bom_codes",
    header: "BOM Codes",
    required: false,
    example: "UNIQ-001, UNIQ-002",
    instruction:
      "Opsional. Daftar kode BOM / Sebango, pisahkan dengan koma (,).",
  },
];

export const CUSTOMER_EXCEL_EXAMPLE_ROWS: Array<Record<string, string>> = [
  {
    customer_id: "CUST-0001",
    customer_name: "PT Maju Jaya",
    phone_number: "+62-21-1234567",
    shipping_address: "Jl. Industri No. 10, Bekasi",
    billing_same_as_shipping: "Yes",
    billing_address: "",
    bank_account: "BCA",
    bank_account_number: "1234567890",
    bom_codes: "UNIQ-001, UNIQ-002",
  },
  {
    customer_id: "",
    customer_name: "CV Sumber Rejeki",
    phone_number: "+62-31-7654321",
    shipping_address: "Jl. Rungkut No. 5, Surabaya",
    billing_same_as_shipping: "No",
    billing_address: "Jl. Darmo No. 88, Surabaya",
    bank_account: "Mandiri",
    bank_account_number: "9876543210",
    bom_codes: "UNIQ-010",
  },
];

export const parseYesNo = (value: string | undefined): boolean => {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return true; // default: same as shipping
  return ["yes", "y", "ya", "true", "1"].includes(v);
};

export const parseCommaList = (value: string | undefined): string[] =>
  String(value ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
