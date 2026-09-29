"use client";

/**
 * DOWNLOAD EXCEL PER PROSES
 *
 * Mengunduh Excel yang berisi SEMUA item (UNIQ) dari SEMUA Work Order yang
 * melewati satu proses tertentu (mis. Bending). Tidak terikat ke WO id
 * tertentu dan tidak bergantung pada halaman/pencarian yang sedang tampil di
 * tabel, karena data diambil ulang dari backend halaman demi halaman.
 *
 * Sumber data:
 *  - /working-order/work-orders (semua halaman): header WO + item + process_flow_json
 *  - BOM tree yang sudah dimuat halaman: fallback part name/number, route, material
 *  - /working-order/work-orders/form-options/processes: daftar pilihan proses
 */

import { useMemo, useState } from "react";
import { Alert, Button, Modal, Select, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import {
  type WorkOrderItemRecord,
  type WorkOrderRecord,
  useGetWorkOrderProcessOptionsQuery,
  useLazyGetWorkOrdersQuery,
} from "@/lib/api/work-orders/api";
import type { BomUniqIndex } from "@/lib/utils/bomUniq";
import type { BomDetailIndex } from "@/components/work-orders/WorkOrderLineReport";
import { formatWorkOrderDisplayNumber } from "@/lib/utils/workOrder";

/** Nilai khusus untuk "tanpa filter proses". */
const ALL_PROCESSES = "__ALL__";
/** Ukuran halaman saat menarik semua WO (batas backend = 1000). */
const FETCH_PAGE_SIZE = 1000;
/** Pengaman supaya tidak looping tanpa henti bila backend salah kirim total_pages. */
const MAX_PAGES = 200;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const pickString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return "";
};

const pickNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const norm = (value: string) => value.trim().toLowerCase();

/** yyyy-mm-dd supaya Excel mudah di-sort/filter. */
const formatDate = (value?: string): string => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

type FlowStep = {
  opSeq: number;
  processName: string;
  machineName: string;
  cycleTimeSec: number | undefined;
  setupTimeMin: number | undefined;
  subCon: boolean;
};

/** process_flow_json bisa berupa array atau string JSON. */
const readFlow = (raw: unknown): FlowStep[] => {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const steps: FlowStep[] = [];
  list.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    const processName = pickString(
      entry.process_name,
      entry.processName,
      entry.process,
    );
    if (!processName) return;
    steps.push({
      opSeq: pickNumber(entry.op_seq, entry.opSeq, entry.seq) ?? index + 1,
      processName,
      machineName: pickString(entry.machine_name, entry.machineName),
      cycleTimeSec: pickNumber(entry.cycle_time_sec, entry.cycleTimeSec),
      setupTimeMin: pickNumber(entry.setup_time_min, entry.setupTimeMin),
      subCon: entry.sub_con === true || entry.subCon === true,
    });
  });
  steps.sort((a, b) => a.opSeq - b.opSeq);
  return steps;
};

/** Angka di string "60 pcs" / "60" -> 60. */
const toNumber = (value: unknown): number => pickNumber(value) ?? 0;

type ExportRow = Record<string, string | number>;

type Props = {
  open: boolean;
  onClose: () => void;
  bomIndex: BomUniqIndex;
  bomDetail: BomDetailIndex;
};

export default function WorkOrderProcessExportModal({
  open,
  onClose,
  bomIndex,
  bomDetail,
}: Props) {
  const [processValue, setProcessValue] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const processOptionsQuery = useGetWorkOrderProcessOptionsQuery(undefined, {
    skip: !open,
  });
  const [fetchWorkOrders] = useLazyGetWorkOrdersQuery();

  /** Pilihan proses: dari master proses, ditambah proses yang ada di BOM route. */
  const options = useMemo(() => {
    const names = new Map<string, string>();
    for (const item of processOptionsQuery.data ?? []) {
      const key = norm(item.process_name);
      if (key && !names.has(key)) names.set(key, item.process_name.trim());
    }
    for (const routes of Object.values(bomDetail.routesByUniq)) {
      for (const route of routes) {
        const key = norm(route.processName);
        if (key && !names.has(key)) names.set(key, route.processName.trim());
      }
    }
    const list = [...names.values()]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ label: name, value: name }));
    return [{ label: "Semua proses (tanpa filter)", value: ALL_PROCESSES }].concat(
      list,
    );
  }, [bomDetail.routesByUniq, processOptionsQuery.data]);

  /** Tarik semua WO, halaman demi halaman. */
  const fetchAllWorkOrders = async (): Promise<WorkOrderRecord[]> => {
    const all: WorkOrderRecord[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      setProgress(`Mengambil data Work Order (halaman ${page})...`);
      const res = await fetchWorkOrders(
        { page, limit: FETCH_PAGE_SIZE },
        false,
      ).unwrap();
      all.push(...res.items);
      totalPages = res.pagination.total_pages || 1;
      if (!res.items.length) break;
      page += 1;
    } while (page <= totalPages && page <= MAX_PAGES);
    return all;
  };

  const buildRows = (
    workOrders: WorkOrderRecord[],
    processName: string | null,
  ): ExportRow[] => {
    const rows: ExportRow[] = [];
    const target = processName ? norm(processName) : null;

    for (const wo of workOrders) {
      for (const item of wo.items as WorkOrderItemRecord[]) {
        const uniq = (item.item_uniq_code ?? "").trim();

        let steps = readFlow(item.process_flow_json);
        /* Fallback: WO lama yang process_flow_json-nya kosong -> pakai route BOM. */
        if (!steps.length && uniq) {
          steps = (bomDetail.routesByUniq[uniq] ?? []).map((route, index) => ({
            opSeq: index + 1,
            processName: route.processName,
            machineName: route.machineName,
            cycleTimeSec: route.cycleTimeSec || undefined,
            setupTimeMin: undefined,
            subCon: false,
          }));
        }

        let matched: FlowStep | undefined;
        if (target) {
          matched = steps.find((step) => norm(step.processName) === target);
          /* Fallback terakhir: process_name di level item. */
          if (!matched && norm(item.process_name ?? "") === target) {
            matched = {
              opSeq: 0,
              processName: (item.process_name ?? "").trim(),
              machineName: "",
              cycleTimeSec: undefined,
              setupTimeMin: undefined,
              subCon: false,
            };
          }
          if (!matched) continue;
        }

        const qty = toNumber(item.quantity);
        const cycle = matched?.cycleTimeSec;
        const materials = (bomDetail.materialsByUniq[uniq] ?? [])
          .map(
            (m) =>
              `${m.code} (${m.qtyPerUniq * qty} ${m.uom})${m.name && m.name !== m.code ? ` - ${m.name}` : ""}`,
          )
          .join("; ");

        rows.push({
          "WO Number": formatWorkOrderDisplayNumber(wo.wo_number) || "-",
          "WO Type": wo.wo_type ?? "",
          "WO Status": wo.status ?? "",
          "Approval Status": wo.approval_status ?? "",
          "Create Date": formatDate(wo.created_at ?? wo.created_date),
          "Target Date": formatDate(wo.target_date),
          Operator: wo.operator_name ?? "",
          "Reference WO": wo.reference_wo ?? "",
          Remark: (wo.remark ?? wo.notes ?? "").trim(),
          UNIQ: uniq,
          "Part Name":
            item.part_name ?? bomIndex.partNameByUniq[uniq] ?? "",
          "Part Number":
            item.part_number ?? bomIndex.partNumberByUniq[uniq] ?? "",
          Model: item.model ?? bomIndex.modelByUniq[uniq] ?? "",
          "Kanban Number": item.kanban_number ?? "",
          Qty: qty,
          UOM: item.uom || bomDetail.uomByUniq[uniq] || "pcs",
          "Item Status": item.status ?? "",
          Process: matched?.processName ?? "",
          "Op Seq": matched && matched.opSeq > 0 ? matched.opSeq : "",
          Machine: matched?.machineName ?? "",
          "Sub Con": matched ? (matched.subCon ? "Ya" : "Tidak") : "",
          "Cycle Time (s)": cycle ?? "",
          "Setup Time (min)": matched?.setupTimeMin ?? "",
          "Total Cycle Time (s)":
            typeof cycle === "number" ? Math.round(cycle * qty * 100) / 100 : "",
          "Routing Lengkap": steps
            .map((step) => `${step.opSeq}. ${step.processName}`)
            .join(" > "),
          "Material (BOM)": materials,
        });
      }
    }
    return rows;
  };

  const buildSummaryRows = (rows: ExportRow[]): ExportRow[] => {
    const byUniq = new Map<
      string,
      { part: string; model: string; uom: string; qty: number; wos: Set<string> }
    >();
    for (const row of rows) {
      const uniq = String(row.UNIQ);
      const entry = byUniq.get(uniq) ?? {
        part: String(row["Part Name"]),
        model: String(row.Model),
        uom: String(row.UOM),
        qty: 0,
        wos: new Set<string>(),
      };
      entry.qty += Number(row.Qty) || 0;
      entry.wos.add(String(row["WO Number"]));
      byUniq.set(uniq, entry);
    }
    return [...byUniq.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([uniq, entry]) => ({
        UNIQ: uniq,
        "Part Name": entry.part,
        Model: entry.model,
        "Total Qty": entry.qty,
        UOM: entry.uom,
        "Jumlah WO": entry.wos.size,
        "Daftar WO": [...entry.wos].join(", "),
      }));
  };

  const withWidths = (sheet: XLSX.WorkSheet, rows: ExportRow[]) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    sheet["!cols"] = headers.map((header) => {
      const longest = rows.reduce(
        (max, row) => Math.max(max, String(row[header] ?? "").length),
        header.length,
      );
      return { wch: Math.min(Math.max(longest + 2, 10), 60) };
    });
    sheet["!autofilter"] = { ref: sheet["!ref"] ?? "A1" };
  };

  const handleDownload = async () => {
    if (!processValue) {
      message.warning("Pilih proses terlebih dahulu");
      return;
    }
    const processName = processValue === ALL_PROCESSES ? null : processValue;

    setLoading(true);
    try {
      const workOrders = await fetchAllWorkOrders();
      setProgress("Menyusun file Excel...");
      const rows = buildRows(workOrders, processName);

      if (!rows.length) {
        message.info(
          processName
            ? `Tidak ada item yang memakai proses "${processName}" di ${workOrders.length} Work Order.`
            : "Tidak ada data Work Order untuk diexport.",
        );
        return;
      }

      const workbook = XLSX.utils.book_new();
      const detailSheet = XLSX.utils.json_to_sheet(rows);
      withWidths(detailSheet, rows);
      XLSX.utils.book_append_sheet(
        workbook,
        detailSheet,
        (processName ?? "Semua Proses").slice(0, 31),
      );

      const summaryRows = buildSummaryRows(rows);
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      withWidths(summarySheet, summaryRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan per UNIQ");

      const stamp = new Date().toISOString().slice(0, 10);
      const slug = (processName ?? "semua-proses")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      XLSX.writeFile(workbook, `work-order-proses-${slug}-${stamp}.xlsx`);

      message.success(
        `${rows.length} item dari ${new Set(rows.map((r) => r["WO Number"])).size} WO berhasil diunduh`,
      );
      onClose();
    } catch {
      message.error("Gagal mengambil data Work Order untuk export");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <Modal
      open={open}
      title="Download Excel per Proses"
      onCancel={() => {
        if (!loading) onClose();
      }}
      maskClosable={!loading}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loading}>
          Batal
        </Button>,
        <Button
          key="download"
          type="primary"
          icon={<DownloadOutlined />}
          loading={loading}
          disabled={!processValue}
          onClick={handleDownload}
        >
          Download Excel
        </Button>,
      ]}
    >
      <div className="text-sm text-gray-600">
        Mengunduh semua item (UNIQ) dari <b>semua Work Order</b> yang memakai
        proses yang dipilih. Data tidak terbatas pada halaman atau WO yang
        sedang tampil di tabel.
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs font-semibold text-gray-700">Proses</div>
        <Select
          showSearch
          className="w-full"
          placeholder="Pilih proses, mis. Bending"
          value={processValue}
          onChange={setProcessValue}
          options={options}
          loading={processOptionsQuery.isFetching}
          disabled={loading}
          optionFilterProp="label"
        />
      </div>

      {loading ? (
        <Alert className="mt-4" type="info" showIcon message={progress} />
      ) : null}
    </Modal>
  );
}
