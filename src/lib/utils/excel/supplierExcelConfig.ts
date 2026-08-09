import type { ExcelColumn } from "@/lib/utils/excel/masterExcel";

/**
 * Column definition for Master Supplier -> Supplier Only Import / Export.
 *
 * The `required` flags below match the backend validation for creating a
 * supplier (CreateSupplierRequest). Columns with a sensible default
 * (Country, Payment Terms, Lead Time, Status, Category) stay optional and are
 * filled in automatically when left blank.
 */
export const SUPPLIER_ONLY_EXCEL_COLUMNS: ExcelColumn[] = [
  {
    key: "supplier_code",
    header: "Supplier Code",
    required: false,
    example: "SUP-0001",
    instruction:
      "Opsional. Kosongkan jika ingin kode dibuat otomatis oleh sistem.",
  },
  {
    key: "supplier_name",
    header: "Supplier Name",
    required: true,
    example: "PT Baja Sentosa",
    instruction: "Wajib. Nama supplier.",
  },
  {
    key: "contact_person",
    header: "Contact Person",
    required: true,
    example: "Budi Santoso",
    instruction: "Wajib. Nama narahubung.",
  },
  {
    key: "contact_number",
    header: "Contact Number",
    required: true,
    example: "+62-812-3456789",
    instruction: "Wajib. Nomor telepon narahubung.",
  },
  {
    key: "email_address",
    header: "Email",
    required: true,
    example: "sales@bajasentosa.co.id",
    instruction: "Wajib. Alamat email supplier yang valid.",
  },
  {
    key: "material_category",
    header: "Category",
    required: false,
    example: "Raw Material",
    instruction:
      "Pilih salah satu: Raw Material, Indirect Raw Material, atau Subcon. Default Raw Material.",
  },
  {
    key: "full_address",
    header: "Full Address",
    required: true,
    example: "Jl. Logam No. 21, Karawang",
    instruction: "Wajib. Alamat lengkap supplier.",
  },
  {
    key: "city",
    header: "City",
    required: true,
    example: "Karawang",
    instruction: "Wajib. Kota.",
  },
  {
    key: "province",
    header: "Province",
    required: true,
    example: "Jawa Barat",
    instruction: "Wajib. Provinsi.",
  },
  {
    key: "country",
    header: "Country",
    required: false,
    example: "Indonesia",
    instruction: "Opsional. Negara. Default Indonesia jika dikosongkan.",
  },
  {
    key: "tax_id_npwp",
    header: "NPWP",
    required: true,
    example: "01.234.567.8-901.000",
    instruction: "Wajib. Nomor NPWP.",
  },
  {
    key: "bank_name",
    header: "Bank Name",
    required: true,
    example: "BCA",
    instruction: "Wajib. Nama bank.",
  },
  {
    key: "bank_account_number",
    header: "Bank Account Number",
    required: true,
    example: "1234567890",
    instruction: "Wajib. Nomor rekening.",
  },
  {
    key: "bank_account_name",
    header: "Bank Account Name",
    required: true,
    example: "PT Baja Sentosa",
    instruction: "Wajib. Nama pemilik rekening.",
  },
  {
    key: "payment_terms",
    header: "Payment Terms",
    required: false,
    example: "30D",
    instruction: "Opsional. Termin pembayaran, mis. 30D. Default 30D jika dikosongkan.",
  },
  {
    key: "delivery_lead_time_days",
    header: "Lead Time (days)",
    required: false,
    example: "7",
    instruction:
      "Opsional. Lead time pengiriman dalam hari (angka). Default 7 jika dikosongkan.",
  },
  {
    key: "status",
    header: "Status",
    required: false,
    example: "Active",
    instruction: "Isi Active atau Inactive. Default Active jika dikosongkan.",
  },
];

export const SUPPLIER_ONLY_EXCEL_EXAMPLE_ROWS: Array<Record<string, string>> = [
  {
    supplier_code: "SUP-0001",
    supplier_name: "PT Baja Sentosa",
    contact_person: "Budi Santoso",
    contact_number: "+62-812-3456789",
    email_address: "sales@bajasentosa.co.id",
    material_category: "Raw Material",
    full_address: "Jl. Logam No. 21, Karawang",
    city: "Karawang",
    province: "Jawa Barat",
    country: "Indonesia",
    tax_id_npwp: "01.234.567.8-901.000",
    bank_name: "BCA",
    bank_account_number: "1234567890",
    bank_account_name: "PT Baja Sentosa",
    payment_terms: "30D",
    delivery_lead_time_days: "7",
    status: "Active",
  },
  {
    supplier_code: "",
    supplier_name: "CV Kimia Abadi",
    contact_person: "Sri Wahyuni",
    contact_number: "+62-813-9876543",
    email_address: "info@kimiaabadi.co.id",
    material_category: "Indirect Raw Material",
    full_address: "Jl. Kimia No. 3, Gresik",
    city: "Gresik",
    province: "Jawa Timur",
    country: "Indonesia",
    tax_id_npwp: "02.345.678.9-012.000",
    bank_name: "Mandiri",
    bank_account_number: "9876543210",
    bank_account_name: "CV Kimia Abadi",
    payment_terms: "45D",
    delivery_lead_time_days: "14",
    status: "Active",
  },
];

export const normalizeMaterialCategory = (value: unknown): string => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw.includes("indirect")) return "Indirect Raw Material";
  if (raw.includes("sub")) return "Subcon";
  return "Raw Material";
};

export const normalizeStatusToApi = (
  value: string | undefined
): string | undefined => {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return undefined;
  if (s === "inactive" || s === "nonaktif" || s === "tidak aktif") return "inactive";
  return "active";
};
