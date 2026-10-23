import { apiBaseUrl, getCookiesFromBrowser } from "@/lib/api/instance";

export type SupplierInfoImportError = {
  sheet?: string;
  row: number;
  field?: string;
  message: string;
};

export type SupplierInfoImportResult = {
  import_status: "success" | "partial" | "failed";
  total: number;
  success_count: number;
  failed_count: number;
  download_url?: string;
  errors?: SupplierInfoImportError[];
};

const XLSX_ENDPOINT = "/supplier-info/import";

const authHeaders = (): Record<string, string> => {
  const token = getCookiesFromBrowser("Authorization");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const readError = async (res: Response, fallback: string) => {
  try {
    const payload = await res.json();
    return payload?.message || payload?.detail || `${fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status})`;
  }
};

/** Unduh template Excel (berisi sheet referensi Supplier Item terbaru). */
export async function downloadSupplierInfoTemplate(): Promise<void> {
  const res = await fetch(`${apiBaseUrl}${XLSX_ENDPOINT}/template?t=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
    headers: { ...authHeaders(), "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (!res.ok) throw new Error(await readError(res, "Gagal mengunduh template"));
  saveBlob(await res.blob(), "supplier_info_template.xlsx");
}

/**
 * Unggah file .xlsx. Backend membalas 200 (success), 207 (partial) atau 422 (failed);
 * ketiganya membawa payload hasil yang sama sehingga tidak dianggap error jaringan.
 */
export async function importSupplierInfoExcel(
  file: File,
): Promise<SupplierInfoImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  // Jangan set Content-Type: browser perlu menambahkan boundary multipart sendiri.
  const res = await fetch(`${apiBaseUrl}${XLSX_ENDPOINT}`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  const text = await res.text();
  let payload: { message?: string; data?: SupplierInfoImportResult } | null = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (payload?.data?.import_status) return payload.data;
  throw new Error(payload?.message || `Import gagal dengan status ${res.status}`);
}

/**
 * Unduh file error (sekali pakai, kedaluwarsa 30 menit). Route-nya butuh JWT,
 * jadi diambil lewat fetch + Authorization, bukan window.open.
 */
export async function downloadSupplierInfoImportErrors(
  downloadUrl: string,
): Promise<void> {
  const token = downloadUrl.split("?")[0].split("/").filter(Boolean).pop();
  if (!token) throw new Error("URL file error tidak valid");

  const res = await fetch(
    `${apiBaseUrl}${XLSX_ENDPOINT}/errors/${encodeURIComponent(token)}`,
    { method: "GET", cache: "no-store", headers: authHeaders() },
  );
  if (!res.ok) throw new Error(await readError(res, "Gagal mengunduh file error"));
  saveBlob(await res.blob(), "supplier_info_import_errors.xlsx");
}
