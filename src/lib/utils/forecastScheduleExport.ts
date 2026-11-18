import dayjs from "dayjs";
import * as XLSX from "xlsx";
import type { ForecastSchedule } from "@/lib/api/forecasting/api";

/**
 * Export hasil training terjadwal (System Settings -> Automation) ke Excel.
 *
 * Isinya satu baris per domain (DN / PRL): konfigurasi jadwal + hasil run terakhir.
 * Data diambil dari yang sudah tampil di panel (GET /forecasting/schedules).
 */

const DOMAIN_TITLE: Record<string, string> = {
  dn: "Delivery Note (DN)",
  prl: "PRL",
};

const FREQUENCY_LABEL: Record<string, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
};

const DAY_LABEL: Record<string, string> = {
  monday: "Senin",
  tuesday: "Selasa",
  wednesday: "Rabu",
  thursday: "Kamis",
  friday: "Jumat",
  saturday: "Sabtu",
  sunday: "Minggu",
};

const excelDateTime = (value?: string | null) =>
  value && dayjs(value).isValid() ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "";

const scheduleDay = (s: ForecastSchedule) => {
  if (s.frequency === "weekly") return DAY_LABEL[String(s.day_of_week ?? "")] ?? "";
  if (s.frequency === "monthly") return s.day_of_month ? `Tanggal ${s.day_of_month}` : "";
  return "";
};

export type ScheduleExportRow = Record<string, string>;

/** Urutan kolom = urutan di file Excel. */
export const SCHEDULE_EXPORT_HEADERS = [
  "Domain",
  "Jadwal Aktif",
  "Frekuensi",
  "Hari / Tanggal",
  "Jam",
  "Zona Waktu",
  "Model",
  "Last Run",
  "Status Last Run",
  "Pesan Last Run",
  "Training Run ID",
  "Run Berikutnya",
  "Terakhir Diubah",
  "Diubah Oleh",
] as const;

export function buildScheduleExportRows(schedules: ForecastSchedule[]): ScheduleExportRow[] {
  const order = ["dn", "prl"];
  return [...schedules]
    .filter((s) => s && (s.domain === "dn" || s.domain === "prl"))
    .sort((a, b) => order.indexOf(a.domain) - order.indexOf(b.domain))
    .map((s) => ({
      Domain: DOMAIN_TITLE[s.domain] ?? s.domain,
      "Jadwal Aktif": s.is_active ? "Ya" : "Tidak",
      Frekuensi: FREQUENCY_LABEL[s.frequency] ?? s.frequency ?? "",
      "Hari / Tanggal": scheduleDay(s),
      Jam: s.run_time ?? "",
      "Zona Waktu": s.timezone ?? "",
      Model: s.selected_model ?? "",
      "Last Run": excelDateTime(s.last_run_at),
      "Status Last Run": s.last_run_status ?? "",
      "Pesan Last Run": s.last_run_message ?? "",
      "Training Run ID": s.last_training_run_id ?? "",
      "Run Berikutnya": excelDateTime(s.next_run_at),
      "Terakhir Diubah": excelDateTime(s.updated_at),
      "Diubah Oleh": s.updated_by ?? "",
    }));
}

/** Membuat dan mengunduh file. Mengembalikan jumlah baris, atau 0 bila tidak ada data. */
export function downloadScheduleResults(schedules: ForecastSchedule[]): number {
  const rows = buildScheduleExportRows(schedules);
  if (rows.length === 0) return 0;

  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...SCHEDULE_EXPORT_HEADERS] });
  sheet["!cols"] = [
    { wch: 20 }, // Domain
    { wch: 13 }, // Jadwal Aktif
    { wch: 11 }, // Frekuensi
    { wch: 15 }, // Hari / Tanggal
    { wch: 8 }, // Jam
    { wch: 14 }, // Zona Waktu
    { wch: 14 }, // Model
    { wch: 20 }, // Last Run
    { wch: 15 }, // Status Last Run
    { wch: 40 }, // Pesan Last Run
    { wch: 38 }, // Training Run ID
    { wch: 20 }, // Run Berikutnya
    { wch: 20 }, // Terakhir Diubah
    { wch: 16 }, // Diubah Oleh
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Training Schedule");
  XLSX.writeFile(book, `training-schedule-${dayjs().format("YYYY-MM-DD")}.xlsx`);
  return rows.length;
}
