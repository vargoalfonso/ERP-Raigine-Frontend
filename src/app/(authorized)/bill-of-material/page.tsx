"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Modal,
  Table,
  Tag,
  Typography,
  Upload,
  message,
  Progress,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BulbOutlined,
  CalendarOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  InboxOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";

import {
  useDeleteBomChildMutation,
  useDeleteBomParentMutation,
  useGetBomListQuery,
  useImportBomMutation,
  useGetImportHistoryQuery,
} from "@/lib/api/bom/api";
import type { BackendBomNode, ImportHistoryDto } from "@/lib/api/bom/api";
import { apiBaseUrl, getCookiesFromBrowser } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { getCurrentUserDisplayName } from "@/lib/utils/currentUser";

type BomStatus = string;

type UnknownRecord = Record<string, unknown>;

type BomRow = {
  key: string;
  uniq: string;
  partName: string;
  partNumber: string;
  model?: string;
  customerCycle?: string;
  imageSrc?: string;
  assetLabel: string;
  assetType: string;
  cadViewable: boolean;
  levelLabel: string;
  isParent: boolean;
  qpu: string;
  version: string;
  status: BomStatus;
  children?: BomRow[];

  bomId?: string;
  internalId?: string;
  parentBomId?: string;
  bomChildId?: string;
};

type ImportPreviewIssue = {
  key: string;
  rowLabel: string;
  message: string;
  values: Record<string, string>;
};

type ImportPreviewState = {
  status: "success" | "partial" | "error";
  message: string;
  imported: number;
  failed: number;
  issues: ImportPreviewIssue[];
};

type ImportPreviewRow = Record<string, string> & {
  key: string;
  error?: string;
};

type UploadHistoryEntry = {
  id: string;
  fileName: string;
  fileSizeKb: number;
  rowCount: number;
  uploadedBy: string;
  uploadedAt: string;
  status: "success" | "partial" | "error";
  summary: string;
  imported: number;
  failed: number;
  requestId?: string;
  downloadUrl?: string;
  previewRows: ImportPreviewRow[];
  previewColumns: string[];
  issues: ImportPreviewIssue[];
};

const normalizeHistoryStatus = (s: string): "success" | "partial" | "error" => {
  const v = (s || "").toLowerCase();
  if (v === "success") return "success";
  if (v === "partial") return "partial";
  return "error";
};

const mapHistoryDtoToEntry = (dto: ImportHistoryDto): UploadHistoryEntry => {
  const rawRows = Array.isArray(dto.preview_rows) ? dto.preview_rows : [];
  const previewRows: ImportPreviewRow[] = rawRows
    .slice(0, MAX_PREVIEW_ROWS)
    .map((r, i) => {
      const rec = (r ?? {}) as Record<string, unknown>;
      const out: ImportPreviewRow = { key: `hist-${dto.id}-${i}` };
      for (const [k, v] of Object.entries(rec)) {
        out[k] = v == null ? "" : String(v);
      }
      return out;
    });
  const previewColumns = Array.from(
    previewRows.reduce((set, row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "key") set.add(k);
      });
      return set;
    }, new Set<string>()),
  );

  return {
    id: String(dto.id),
    fileName: dto.file_name,
    fileSizeKb: dto.file_size_kb,
    rowCount: dto.row_count,
    uploadedBy: dto.uploaded_by || "-",
    uploadedAt: dto.created_at,
    status: normalizeHistoryStatus(dto.status),
    summary: dto.summary,
    imported: dto.imported_count,
    failed: dto.failed_count,
    requestId: dto.request_id,
    downloadUrl: dto.has_error_file
      ? `${apiBaseUrl}/products/bom/import/history/${dto.id}/errors`
      : undefined,
    previewRows,
    previewColumns,
    issues: [],
  };
};

const BOM_UPLOAD_HISTORY_STORAGE_KEY = "bom-upload-history-v1";
const MAX_HISTORY_ITEMS = 10;
const MAX_PREVIEW_ROWS = 100;

const toStatusLabel = (value: unknown): BomStatus => {
  const s = typeof value === "string" ? value.trim() : "";
  return s || "-";
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const asNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const toDisplayText = (value: unknown): string => {
  if (value == null) return "-";
  if (typeof value === "string") return value.trim() || "-";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value))
    return value.map((entry) => toDisplayText(entry)).join(", ");
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, entry]) => `${key}: ${toDisplayText(entry)}`)
      .join(" • ");
  }
  return String(value);
};

const titleizeKey = (key: string) =>
  key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const extractIssueValues = (input: unknown): Record<string, string> => {
  if (!isRecord(input)) return {};

  const source =
    (isRecord(input.row_data) && input.row_data) ||
    (isRecord(input.data) && input.data) ||
    (isRecord(input.row) && input.row) ||
    input;

  return Object.entries(source).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (
        [
          "message",
          "messages",
          "error",
          "errors",
          "detail",
          "reason",
          "row",
          "row_number",
          "line",
          "line_number",
          "data",
          "row_data",
        ].includes(key)
      ) {
        return acc;
      }

      const rendered = toDisplayText(value);
      if (rendered !== "-") {
        acc[titleizeKey(key)] = rendered;
      }
      return acc;
    },
    {},
  );
};

const normalizeImportIssue = (
  item: unknown,
  index: number,
): ImportPreviewIssue => {
  if (!isRecord(item)) {
    const text = toDisplayText(item);
    return {
      key: `issue-${index}`,
      rowLabel: `Row ${index + 1}`,
      message: text,
      values: {},
    };
  }

  const rowCandidate =
    item.row_number ?? item.row ?? item.line_number ?? item.line ?? item.index;
  const rowLabel =
    asNumber(rowCandidate) > 0
      ? `Row ${asNumber(rowCandidate)}`
      : `Row ${index + 1}`;

  const messageParts = [
    item.message,
    item.error,
    item.detail,
    item.reason,
    Array.isArray(item.errors) ? item.errors.join(", ") : undefined,
    Array.isArray(item.messages) ? item.messages.join(", ") : undefined,
  ]
    .map((part) => toDisplayText(part))
    .filter((part) => part && part !== "-");

  return {
    key: `issue-${index}-${String(rowCandidate ?? "na")}`,
    rowLabel,
    message: messageParts[0] ?? "Validation error",
    values: extractIssueValues(item),
  };
};

const buildImportPreview = (payload: unknown): ImportPreviewState => {
  const layers: UnknownRecord[] = [];
  let cursor: unknown = payload;
  for (let i = 0; i < 4 && isRecord(cursor); i += 1) {
    layers.push(cursor);
    cursor = cursor.data;
  }

  const pick = (...keys: string[]): unknown => {
    for (const layer of layers) {
      for (const key of keys) {
        const value = layer[key];
        if (value !== undefined && value !== null) return value;
      }
    }
    return undefined;
  };

  const importStatusRaw = String(pick("import_status") ?? "")
    .trim()
    .toLowerCase();
  const imported = asNumber(
    pick("success_count", "imported", "success", "created"),
  );
  const total = asNumber(pick("total"));
  const initialFailed = asNumber(
    pick("failed_count", "failed", "error_count", "invalid", "rejected"),
  );

  const asArray = (value: unknown): unknown[] =>
    Array.isArray(value) ? value : [];
  const rawIssues = [
    ...asArray(pick("errors")),
    ...asArray(pick("validation_errors")),
    ...asArray(pick("failed_rows")),
    ...asArray(pick("invalid_rows")),
  ];
  const issues = rawIssues.map(normalizeImportIssue);

  let failed = initialFailed || issues.length;
  if (!failed && total > 0 && imported < total) {
    failed = total - imported;
  }

  let status: "success" | "partial" | "error";
  if (importStatusRaw === "failed") {
    status = "error";
  } else if (importStatusRaw === "partial") {
    status = "partial";
  } else if (importStatusRaw === "success") {
    status = "success";
  } else {
    status = failed > 0 ? (imported > 0 ? "partial" : "error") : "success";
  }

  const backendMessage = pick("message");
  const message =
    (typeof backendMessage === "string" && backendMessage.trim()) ||
    (status === "success"
      ? `Upload successful. ${imported || 0} row${imported === 1 ? "" : "s"} imported`
      : status === "partial"
        ? `Sebagian gagal: ${imported} berhasil, ${failed} gagal dari ${total || imported + failed} BOM`
        : `Import gagal: ${failed || total || "semua"} BOM tidak dapat diimport`);

  return { status, message, imported, failed, issues };
};

const extractRequestId = (payload: unknown): string | undefined => {
  let cursor: unknown = payload;
  for (let i = 0; i < 4 && isRecord(cursor); i += 1) {
    const direct = cursor.request_id;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    cursor = cursor.data;
  }
  return undefined;
};

const extractDownloadUrl = (payload: unknown): string | undefined => {
  let cursor: unknown = payload;
  for (let i = 0; i < 4 && isRecord(cursor); i += 1) {
    const url =
      cursor.download_url ??
      cursor.error_download_url ??
      cursor.failed_download_url;
    if (typeof url === "string" && url.trim()) return url.trim();
    cursor = cursor.data;
  }
  return undefined;
};

const extractImportStatus = (
  payload: unknown,
): "success" | "partial" | "error" => {
  const preview = buildImportPreview(payload);
  return preview.status;
};

const safeJsonParse = <T,>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const normalizePreviewRow = (
  record: Record<string, unknown>,
  index: number,
): ImportPreviewRow => {
  const row: ImportPreviewRow = { key: `preview-${index}` };
  for (const [key, value] of Object.entries(record)) {
    row[titleizeKey(key)] = toDisplayText(value);
  }
  return row;
};

const parseDelimitedText = (text: string): ImportPreviewRow[] => {
  const workbook = XLSX.read(text, { type: "string" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return jsonRows.slice(0, MAX_PREVIEW_ROWS).map(normalizePreviewRow);
};

const parseWorkbookFile = async (file: File): Promise<ImportPreviewRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return jsonRows.slice(0, MAX_PREVIEW_ROWS).map(normalizePreviewRow);
};

const absoluteDownloadUrlToProxyUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/api\/v1\//, "");
    return `/api/proxy/${path}${parsed.search}`;
  } catch {
    return url;
  }
};

const fetchDownloadPreview = async (
  downloadUrl: string,
): Promise<{ issues: ImportPreviewIssue[]; rows: ImportPreviewRow[] }> => {
  const token = getCookiesFromBrowser("Authorization");
  const proxiedUrl = downloadUrl.startsWith("http")
    ? absoluteDownloadUrlToProxyUrl(downloadUrl)
    : downloadUrl;
  const response = await fetch(proxiedUrl, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch import error detail (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await response.json().catch(() => null);
    const preview = buildImportPreview(json);
    const rows = preview.issues.map((issue) => ({
      key: issue.key,
      row: issue.rowLabel,
      error: issue.message,
      ...issue.values,
    }));
    return { issues: preview.issues, rows };
  }

  // Otherwise read the tabular error report. The backend returns an .xlsx
  // workbook whose "Items" sheet keeps the failure reason in column A
  // ("error_field") and echoes the original row in the remaining columns.
  // CSV is handled as a fallback.
  let parsedRows: ImportPreviewRow[];
  if (contentType.includes("csv") || contentType.includes("text/plain")) {
    parsedRows = parseDelimitedText(await response.text());
  } else {
    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName =
      workbook.SheetNames.find((name) => name.toLowerCase() === "items") ??
      workbook.SheetNames[0];
    if (!sheetName) return { issues: [], rows: [] };
    const sheet = workbook.Sheets[sheetName];
    parsedRows = XLSX.utils
      .sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
      .slice(0, MAX_PREVIEW_ROWS)
      .map(normalizePreviewRow);
  }

  const issues: ImportPreviewIssue[] = [];
  const rows: ImportPreviewRow[] = [];

  parsedRows.forEach((raw, index) => {
    const values: Record<string, string> = {};
    let message = "";
    for (const [key, value] of Object.entries(raw)) {
      if (key === "key") continue;
      const lower = key.trim().toLowerCase();
      const text = typeof value === "string" ? value : toDisplayText(value);
      if (
        lower === "error_field" ||
        lower === "error field" ||
        lower === "error" ||
        lower === "message"
      ) {
        if (text && text !== "-") message = text;
        continue;
      }
      values[key] = text;
    }

    // Rows without a failure reason are template/sample rows — skip them.
    if (!message) return;

    const rowLabel =
      values["Uniq Code"] ||
      values["Bom Group"] ||
      values["uniq_code"] ||
      values["bom_group"] ||
      `Row ${index + 1}`;
    const key = `err-${index}`;
    issues.push({ key, rowLabel, message, values });
    rows.push({ key, row: rowLabel, error: message, ...values });
  });

  return { issues, rows };
};

const statusToColor = (value: string): string => {
  const s = value.trim().toLowerCase();
  if (s === "draft") return "gold";
  if (s === "released") return "green";
  if (s === "obsolete") return "default";
  if (s === "active") return "green";
  if (s === "inactive") return "default";
  return "blue";
};

const mapNodeToRow = (
  node: BackendBomNode,
  opts: { parentBomId?: string; level?: number },
): BomRow => {
  const uniq = String(node.uniq ?? node.uniq_code ?? "").trim();
  const bomId = String(node.bom_id ?? "").trim() || undefined;
  const internalId = String(node.id ?? node.uuid ?? "").trim() || undefined;
  const bomChildId = String(node.bom_child_id ?? "").trim() || undefined;
  const depth = opts.level ?? 0; // 0 = parent, 1 = level 1, 2 = level 2 ...
  const isParent = depth === 0;

  const qpuNumber =
    typeof node.qpu === "number" && Number.isFinite(node.qpu) ? node.qpu : null;
  const qpu = !isParent && qpuNumber != null ? `${qpuNumber} pcs` : "-";
  const version =
    typeof node.version === "string" && node.version.trim()
      ? node.version
      : "-";
  const imageSrc =
    typeof node.asset === "string" && node.asset.trim()
      ? node.asset
      : node.image_url;
  const materialSpec = isRecord((node as any).material_specifications)
    ? ((node as any).material_specifications as Record<string, unknown>)
    : isRecord((node as any).material_spec)
      ? ((node as any).material_spec as Record<string, unknown>)
      : undefined;
  const customerCycleText = materialSpec
    ? String(
        materialSpec.customer_cycle ?? materialSpec.customerCycle ?? "",
      ).trim() || "-"
    : "-";
  const assetLabel = node.asset_label || (imageSrc ? "2D Available" : "-");
  const assetType = node.asset_type || "";
  const cadViewable = Boolean(node.cad_viewable);
  const children = Array.isArray(node.children)
    ? node.children.map((c) =>
        mapNodeToRow(c, {
          parentBomId: opts.parentBomId ?? bomId ?? internalId,
          level: depth + 1,
        }),
      )
    : undefined;

  return {
    key: uniq || bomId || internalId || bomChildId || crypto.randomUUID(),
    uniq: uniq || "-",
    partName: String(node.part_name ?? "-") || "-",
    partNumber: String(node.part_number ?? "-") || "-",
    model: String(node.model ?? "").trim() || "-",
    imageSrc: imageSrc || undefined,
    assetLabel,
    assetType,
    cadViewable,
    levelLabel: isParent ? "Parent" : `Level ${depth}`,
    isParent,
    qpu,
    version,
    status: toStatusLabel(
      (isRecord(node) ? node.bom_status : undefined) ?? node.status,
    ),
    customerCycle: customerCycleText,
    children,
    bomId,
    internalId,
    parentBomId: opts.parentBomId,
    bomChildId,
  };
};

const filterBomRowsByUniq = (rows: BomRow[], query: string): BomRow[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return rows;

  return rows.reduce<BomRow[]>((acc, row) => {
    const matchedChildren = row.children
      ? filterBomRowsByUniq(row.children, normalizedQuery)
      : undefined;
    const selfMatched = row.uniq.toLowerCase().includes(normalizedQuery);

    if (!selfMatched && (!matchedChildren || matchedChildren.length === 0)) {
      return acc;
    }

    acc.push({
      ...row,
      children: selfMatched ? row.children : matchedChildren,
    });
    return acc;
  }, []);
};

// [where-used-parent-with-children-dropdown]
// Satu baris di tabel Where Used mewakili SATU parent BOM.
// Field `matchedChildren` berisi daftar child (di level manapun) yang
// cocok dengan search term — di-render sebagai expandable dropdown
// di bawah baris parent.
type WhereUsedChildEntry = {
  key: string;
  childCode: string;
  childName: string;
  // [where-used-material-code-column] material_code asli dari node (dari
  // material_specifications.material_code / material_grade / material_code
  // langsung). Ditampilkan sebagai kolom terpisah supaya user bisa lihat
  // material dasar tanpa tercampur dengan UNIQ.
  materialCode: string;
  type: string;
  qtyUse: string;
  yieldValue: string;
  scrap: string;
  position: string;
  substitution: string;
  note: string;
};

type WhereUsedRow = {
  key: string;
  parentCode: string;
  parentName: string;
  type: string;
  qtyUse: string;
  yieldValue: string;
  scrap: string;
  position: string;
  substitution: string;
  rev: string;
  status: BomStatus;
  note: string;
  targetBomId?: string;
  matchedChildren: WhereUsedChildEntry[];
};

// "Where Used" = reverse BOM lookup. Given a MATERIAL CODE, walk the whole BOM
// tree and return every PARENT node that has a direct child whose material_code
// matches. Matching is restricted to the material_code field only (per spec).
const collectWhereUsedRows = (
  nodes: BackendBomNode[],
  rawCode: string,
): WhereUsedRow[] => {
  const q = rawCode.trim().toLowerCase();
  if (!q) return [];

  const rows: WhereUsedRow[] = [];
  let counter = 0;

  const walk = (node: BackendBomNode, parent: BackendBomNode | null) => {
    const spec = isRecord((node as UnknownRecord).material_specifications)
      ? ((node as UnknownRecord).material_specifications as UnknownRecord)
      : isRecord((node as UnknownRecord).material_spec)
        ? ((node as UnknownRecord).material_spec as UnknownRecord)
        : undefined;
    // A material code (e.g. an RM/CP code like "BR50") can live directly on the
    // node OR inside material specifications (material_code / material_grade).
    const materialCode = String(
      node.material_code ??
        spec?.material_code ??
        spec?.material_grade ??
        "",
    ).trim();
    // [where-used-server-search] Selain material_code, cocokkan juga
    // uniq_code / part_number / part_name / model child. Backend
    // sekarang bisa menemukan parent BOM lewat child uniq di level
    // manapun (via bom_lines EXISTS); walker lokal ini ikut memakai
    // field yang sama supaya baris yang di-render konsisten dengan
    // hasil query backend.
    const childUniq = String(
      (node as UnknownRecord).uniq_code ??
        (node as UnknownRecord).uniq ??
        "",
    ).trim();
    const childPartNumber = String(
      (node as UnknownRecord).part_number ?? "",
    ).trim();
    const childPartName = String(
      (node as UnknownRecord).part_name ?? "",
    ).trim();
    const childModel = String((node as UnknownRecord).model ?? "").trim();
    const matchedByAny =
      (materialCode && materialCode.toLowerCase().includes(q)) ||
      (childUniq && childUniq.toLowerCase().includes(q)) ||
      (childPartNumber && childPartNumber.toLowerCase().includes(q)) ||
      (childPartName && childPartName.toLowerCase().includes(q)) ||
      (childModel && childModel.toLowerCase().includes(q));
    if (parent && matchedByAny) {
      const parentCode =
        String(parent.uniq_code ?? parent.uniq ?? "").trim() || "-";
      const parentName = String(parent.part_name ?? "").trim() || "-";
      const type =
        String(
          (node as UnknownRecord).type_material ??
            (parent as UnknownRecord).type_material ??
            "",
        ).trim() || "-";
      const qtyNum = asNumber(
        node.qpu ?? node.quantity ?? (node as UnknownRecord).qty_per_uniq,
      );
      const yieldNum = asNumber(
        (node as UnknownRecord).yield ??
          (node as UnknownRecord).yield_factor ??
          spec?.yield ??
          spec?.yield_factor ??
          1,
      );
      const scrapNum = asNumber(
        (node as UnknownRecord).scrap_factor ??
          (node as UnknownRecord).scrap ??
          spec?.scrap_factor ??
          spec?.scrap ??
          0,
      );
      const rev = String(parent.version ?? node.version ?? "").trim() || "-";
      const status = toStatusLabel(
        (isRecord(parent) ? parent.bom_status : undefined) ?? parent.status,
      );
      const note = String(node.description ?? "").trim() || "-";
      const targetBomId =
        String(parent.bom_id ?? parent.id ?? parent.uuid ?? "").trim() ||
        undefined;

      // Prioritas untuk kode child: UNIQ code dulu (sama seperti yang
      // dilihat user di tabel BOM utama), lalu part_number, baru
      // material_code sebagai fallback terakhir. Sebelumnya
      // material_code diprioritaskan, sehingga hasilnya jadi beda
      // dengan UNIQ yang tampil di tree BOM.
      const childCode =
        childUniq || childPartNumber || materialCode || "-";
      const childName = childPartName || "-";
      const positionStr =
        String((node as UnknownRecord).position ?? "").trim() || "-";
      const substitutionStr =
        String(
          (node as UnknownRecord).substitution ??
            (node as UnknownRecord).substitute ??
            "",
        ).trim() || "-";
      const qtyUseStr = qtyNum ? String(qtyNum) : "-";
      const yieldStr = yieldNum ? String(yieldNum) : "-";
      const scrapStr = String(scrapNum);

      counter += 1;
      // Cari row parent yang sudah ada supaya semua child yang cocok
      // dari parent yang sama di-group jadi satu baris + dropdown.
      const existing = rows.find((r) => r.parentCode === parentCode);
      const childEntry: WhereUsedChildEntry = {
        key: `${parentCode}-${childCode}-${counter}`,
        childCode,
        childName,
        materialCode: materialCode || "-",
        type,
        qtyUse: qtyUseStr,
        yieldValue: yieldStr,
        scrap: scrapStr,
        position: positionStr,
        substitution: substitutionStr,
        note,
      };
      if (existing) {
        existing.matchedChildren.push(childEntry);
      } else {
        rows.push({
          key: `${parentCode}-${counter}`,
          parentCode,
          parentName,
          // Baris parent tetap menampilkan info dari child yang PERTAMA
          // cocok (behaviour lama untuk kolom Type/Qty/Yield/dst).
          type,
          qtyUse: qtyUseStr,
          yieldValue: yieldStr,
          scrap: scrapStr,
          position: positionStr,
          substitution: substitutionStr,
          rev,
          status,
          note,
          targetBomId,
          matchedChildren: [childEntry],
        });
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => walk(child, node));
    }
  };

  nodes.forEach((n) => walk(n, null));
  return rows;
};

const fetchBomIdByAnyId = async (anyId: string): Promise<string> => {
  const token = getCookiesFromBrowser("Authorization");
  if (!apiBaseUrl || !anyId) return "";
  const res = await fetch(
    `${apiBaseUrl}/products/bom/${encodeURIComponent(anyId)}`,
    {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );
  if (!res.ok) return "";
  const json = await res.json().catch(() => null);
  const data = isRecord(json) && "data" in json ? json.data : json;
  const bomId = isRecord(data) ? data.bom_id : undefined;
  if (typeof bomId === "number" && Number.isFinite(bomId)) return String(bomId);
  if (typeof bomId === "string" && bomId.trim()) return bomId.trim();
  return "";
};

export default function BillOfMaterialPage() {
  const router = useRouter();
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [deleteTarget, setDeleteTarget] = useState<BomRow | null>(null);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [excelModalTab, setExcelModalTab] = useState<"upload" | "history">(
    "upload",
  );
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(
    null,
  );
  const [importPreviewRows, setImportPreviewRows] = useState<
    ImportPreviewRow[]
  >([]);
  const [stagedPreviewRows, setStagedPreviewRows] = useState<
    ImportPreviewRow[]
  >([]);
  const { data: importHistoryRes, refetch: refetchHistory } =
    useGetImportHistoryQuery();
  const uploadHistory = useMemo<UploadHistoryEntry[]>(
    () => (importHistoryRes?.data ?? []).map(mapHistoryDtoToEntry),
    [importHistoryRes],
  );
  
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  );
  const [uniqSearch, setUniqSearch] = useState("");
  const [whereUsedOpen, setWhereUsedOpen] = useState(false);
  const [whereUsedCode, setWhereUsedCode] = useState("");
  const [historyPreviewRows, setHistoryPreviewRows] = useState<
    ImportPreviewRow[]
  >([]);
  const [historyPreviewLoading, setHistoryPreviewLoading] = useState(false);

  const {
    data: bomListRes,
    isLoading: isBomLoading,
    refetch,
  } = useGetBomListQuery();
  const [deleteBomParent, { isLoading: isDeletingParent }] =
    useDeleteBomParentMutation();
  const [deleteBomChild, { isLoading: isDeletingChild }] =
    useDeleteBomChildMutation();
  const [importBom] = useImportBomMutation();

  const downloadErrorFile = async (downloadUrl: string, fileName: string) => {
    try {
      const token = getCookiesFromBrowser("Authorization");
      const proxiedUrl = downloadUrl.startsWith("http")
        ? absoluteDownloadUrlToProxyUrl(downloadUrl)
        : downloadUrl;
      const res = await fetch(proxiedUrl, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`(${res.status})`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      messageApi.error(getApiErrorMessage(err, "Gagal mengunduh file error"));
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = getCookiesFromBrowser("Authorization");
      // Cache-busting: template selalu di-generate ulang dari master data
      // terbaru, jadi jangan sampai browser/proxy menyajikan salinan lama.
      const res = await fetch(
        `${apiBaseUrl}/products/bom/import/template?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
      );
      if (!res.ok) throw new Error(`(${res.status})`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bom_template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      messageApi.error(getApiErrorMessage(err, "Gagal mengunduh template"));
    }
  };

  const bomRows = useMemo(() => {
    const tree = bomListRes?.data ?? [];
    return tree.map((n) => mapNodeToRow(n, { level: 0 }));
  }, [bomListRes?.data]);

  const filteredBomRows = useMemo(
    () => filterBomRowsByUniq(bomRows, uniqSearch),
    [bomRows, uniqSearch],
  );

  const whereUsedRows = useMemo(
    () => collectWhereUsedRows(bomListRes?.data ?? [], whereUsedCode),
    [bomListRes?.data, whereUsedCode],
  );

  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);

  useEffect(() => {
    setTablePage(1);
  }, [uniqSearch]);

  const expandableParentKeys = filteredBomRows
    .filter((r) => (r.children?.length ?? 0) > 0)
    .map((r) => r.key);

  const effectiveExpandedRowKeys = uniqSearch.trim()
    ? expandableParentKeys
    : expandedRowKeys;

  useEffect(() => {
    if (selectedHistoryId == null && uploadHistory.length > 0) {
      setSelectedHistoryId(uploadHistory[0].id);
    }
  }, [uploadHistory, selectedHistoryId]);

  const selectedHistoryEntry = useMemo(
    () => uploadHistory.find((entry) => entry.id === selectedHistoryId) ?? null,
    [selectedHistoryId, uploadHistory],
  );

  useEffect(() => {
    let cancelled = false;
    const url = selectedHistoryEntry?.downloadUrl;
    if (!url) {
      setHistoryPreviewRows([]);
      setHistoryPreviewLoading(false);
      return;
    }
    setHistoryPreviewLoading(true);
    fetchDownloadPreview(url)
      .then((detail) => {
        if (!cancelled) setHistoryPreviewRows(detail.rows);
      })
      .catch(() => {
        if (!cancelled) setHistoryPreviewRows([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedHistoryEntry?.id, selectedHistoryEntry?.downloadUrl]);

  const previewTableRows = useMemo(() => {
    if (importPreviewRows.length > 0) return importPreviewRows;

    return (importPreview?.issues ?? []).map((issue) => ({
      key: issue.key,
      row: issue.rowLabel,
      error: issue.message,
      ...issue.values,
    }));
  }, [importPreview, importPreviewRows]);

  const previewFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of previewTableRows) {
      Object.keys(row).forEach((key) => {
        if (!["key", "row", "error"].includes(key)) keys.add(key);
      });
    }
    return Array.from(keys);
  }, [previewTableRows]);

  const previewColumns = useMemo<ColumnsType<Record<string, string>>>(() => {
    const base: ColumnsType<Record<string, string>> = [
      {
        title: "Row",
        dataIndex: "row",
        key: "row",
        width: 110,
      },
      {
        title: "Issue",
        dataIndex: "error",
        key: "error",
        width: 280,
        render: (value: string) => (
          <span className="text-[#dc2626]">{value}</span>
        ),
      },
    ];

    return [
      ...base,
      ...previewFieldKeys.map((fieldKey) => ({
        title: fieldKey,
        dataIndex: fieldKey,
        key: fieldKey,
        render: (value: string) => value || "-",
      })),
    ];
  }, [previewFieldKeys]);

  const historyDetailRows = useMemo<ImportPreviewRow[]>(() => {
    if (historyPreviewRows.length > 0) return historyPreviewRows;
    return selectedHistoryEntry?.previewRows ?? [];
  }, [historyPreviewRows, selectedHistoryEntry]);

  const historyPreviewColumns = useMemo<
    ColumnsType<Record<string, string>>
  >(() => {
    const fieldKeys = new Set<string>();
    for (const row of historyDetailRows) {
      Object.keys(row).forEach((key) => {
        if (!["key", "row", "error"].includes(key)) fieldKeys.add(key);
      });
    }
    const base: ColumnsType<Record<string, string>> = [
      { title: "Row", dataIndex: "row", key: "row", width: 110 },
      {
        title: "Issue",
        dataIndex: "error",
        key: "error",
        width: 280,
        render: (value: string) => (
          <span className="text-[#dc2626]">{value}</span>
        ),
      },
    ];
    return [
      ...base,
      ...Array.from(fieldKeys).map((fieldKey) => ({
        title: fieldKey,
        dataIndex: fieldKey,
        key: fieldKey,
        render: (value: string) => value || "-",
      })),
    ];
  }, [historyDetailRows]);

  const resetImportModalState = () => {
    setExcelModalTab("upload");
    setSelectedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
    setUploadDone(false);
    setImportPreview(null);
    setImportPreviewRows([]);
    setStagedPreviewRows([]);
    setSelectedHistoryId(null);
  };

  const handleDelete = async (record: BomRow): Promise<boolean> => {
    try {
      if (record.isParent) {
        const anyId = record.bomId || record.internalId;
        if (!anyId) {
          messageApi.error("Missing bom_id for parent item");
          return false;
        }

        const resolvedBomId =
          record.bomId || (await fetchBomIdByAnyId(anyId)) || anyId;
        await deleteBomParent({ bom_id: resolvedBomId }).unwrap();
        messageApi.success("Deleted");
        return true;
      }

      if (!record.parentBomId || !record.bomChildId) {
        messageApi.error("Missing bom_id/bom_child_id for child item");
        return false;
      }

      await deleteBomChild({
        bom_id: record.parentBomId,
        bom_child_id: record.bomChildId,
      }).unwrap();
      messageApi.success("Deleted");
      return true;
    } catch {
      messageApi.error("Delete failed");
      return false;
    }
  };

  const columns: ColumnsType<BomRow> = [
    {
      title: "UNIQ",
      key: "uniq",
      width: 140,
      render: (_: unknown, record: BomRow) => {
        return (
          <span
            className={
              record.isParent
                ? "inline-flex items-center rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                : "inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700"
            }
          >
            {record.uniq}
          </span>
        );
      },
    },
    {
      title: "Part Name",
      key: "partName",
      width: 260,
      render: (_: unknown, record: BomRow) => (
        <div className="font-semibold text-gray-900">{record.partName}</div>
      ),
    },
    {
      title: "Part Number",
      key: "partNumber",
      width: 160,
      render: (_: unknown, record: BomRow) => (
        <span className="text-gray-700">{record.partNumber}</span>
      ),
    },
    {
      title: "Product Model",
      key: "model",
      width: 140,
      render: (_: unknown, record: BomRow) => (
        <span className="text-gray-700">{record.model ?? "-"}</span>
      ),
    },
    // {
    //   title: "Customer Cycle",
    //   key: "customerCycle",
    //   width: 160,
    //   render: (_: unknown, record: BomRow) => (
    //     <span className="text-gray-700">{record.customerCycle ?? "-"}</span>
    //   ),
    // },
    {
      title: "Image",
      key: "image",
      width: 90,
      render: (_: unknown, record: BomRow) => (
        <img
          src={record.imageSrc ?? "/mock/bom/placeholder.svg"}
          alt={record.partName}
          className="h-10 w-10 rounded-md border border-gray-200 bg-gray-50 object-cover"
          loading="lazy"
        />
      ),
    },
    {
      title: "Level",
      key: "level",
      width: 110,
      render: (_: unknown, record: BomRow) => {
        return (
          <Tag color={record.isParent ? "gold" : "blue"}>
            {record.levelLabel}
          </Tag>
        );
      },
    },
    {
      title: "QPU",
      key: "qpu",
      width: 90,
      render: (_: unknown, record: BomRow) => (
        <span className="text-gray-700">{record.qpu}</span>
      ),
    },
    {
      title: "Version",
      key: "version",
      width: 90,
      render: (_: unknown, record: BomRow) => (
        <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
          {record.version}
        </span>
      ),
    },
    {
      title: "2D/3D CAD",
      key: "cad",
      width: 160,
      render: (_: unknown, record: BomRow) => {
        const hasAsset = record.assetLabel !== "-";
        return (
          <Button
            type={hasAsset ? "default" : "text"}
            size="small"
            icon={<EyeOutlined />}
            disabled={!hasAsset}
            onClick={(e) => {
              e.stopPropagation();
              if (record.cadViewable) {
                messageApi.info(`Open CAD viewer for ${record.uniq}`);
              } else if (record.imageSrc) {
                window.open(record.imageSrc, "_blank");
              }
            }}
          >
            {record.assetLabel}
          </Button>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_: unknown, record: BomRow) => (
        <Tag color={statusToColor(record.status)}>{record.status}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      fixed: "right",
      render: (_: unknown, record: BomRow) => (
        <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white/95 p-1 shadow-sm backdrop-blur-sm">
          <Button
            type="text"
            size="small"
            className="!flex !h-8 !w-8 !items-center !justify-center !rounded-full hover:!bg-blue-50"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              const targetId = record.isParent
                ? record.bomId || record.internalId
                : record.parentBomId;
              if (!targetId) {
                messageApi.error("Missing BOM id");
                return;
              }
              router.push(`/bill-of-material/${encodeURIComponent(targetId)}`);
            }}
          />
          <Button
            type="text"
            size="small"
            className="!flex !h-8 !w-8 !items-center !justify-center !rounded-full hover:!bg-blue-50"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              const targetId = record.isParent
                ? record.bomId || record.internalId
                : record.parentBomId;
              if (!targetId) {
                messageApi.error("Missing BOM id");
                return;
              }
              router.push(
                `/bill-of-material/${encodeURIComponent(targetId)}/edit`,
              );
            }}
          />
          <Button
            danger
            type="text"
            size="small"
            className="!flex !h-8 !w-8 !items-center !justify-center !rounded-full hover:!bg-red-50"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(record);
            }}
          />
        </div>
      ),
    },
  ];

  const whereUsedColumns: ColumnsType<WhereUsedRow> = [
    {
      title: "Parent Code",
      dataIndex: "parentCode",
      key: "parentCode",
      width: 130,
      render: (v: string) => (
        <span className="font-semibold text-blue-600">{v}</span>
      ),
    },
    {
      title: "Parent Name",
      dataIndex: "parentName",
      key: "parentName",
      width: 200,
    },
    { title: "Type", dataIndex: "type", key: "type", width: 120 },
    { title: "Qty/Use", dataIndex: "qtyUse", key: "qtyUse", width: 90 },
    { title: "Yield", dataIndex: "yieldValue", key: "yieldValue", width: 80 },
    { title: "Scrap %", dataIndex: "scrap", key: "scrap", width: 90 },
    { title: "Posisi", dataIndex: "position", key: "position", width: 90 },
    {
      title: "Substitusi",
      dataIndex: "substitution",
      key: "substitution",
      width: 110,
    },
    { title: "Rev", dataIndex: "rev", key: "rev", width: 80 },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (v: string) => <Tag color={statusToColor(v)}>{v}</Tag>,
    },
    {
      title: "Note",
      dataIndex: "note",
      key: "note",
      width: 280,
      render: (v: string) => (
        <span className="text-xs text-gray-500">{v}</span>
      ),
    },
    {
      title: "Aksi",
      key: "action",
      width: 140,
      fixed: "right",
      render: (_: unknown, record: WhereUsedRow) => (
        <Button
          size="small"
          onClick={() => {
            if (!record.targetBomId) {
              messageApi.error("Missing BOM id");
              return;
            }
            router.push(
              `/bill-of-material/${encodeURIComponent(record.targetBomId)}`,
            );
          }}
        >
          Buka Struktur
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm mb-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Bill of Material Management
          </h1>
          <p className="text-gray-600">
            Define parent-child structure, process routes, and material
            specifications per Uniq
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            icon={<UploadOutlined />}
            className="flex items-center gap-2"
            onClick={() => {
              resetImportModalState();
              setExcelModalOpen(true);
            }}
          >
            Excel Upload
          </Button>

          <Button
            icon={<SearchOutlined />}
            className="flex items-center gap-2"
            onClick={() => setWhereUsedOpen(true)}
          >
            Where Used
          </Button>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="flex items-center gap-2"
            onClick={() => router.push("/bill-of-material/create")}
          >
            Add BOM Item
          </Button>
        </div>
      </div>
      {contextHolder}
      <Modal
        open={whereUsedOpen}
        onCancel={() => setWhereUsedOpen(false)}
        footer={null}
        title={null}
        width={1120}
        destroyOnHidden
      >
        <div className="pr-6">
          <h2 className="text-xl font-bold text-gray-900">Where Used</h2>
          <p className="mt-1 text-sm text-gray-500">
            Cari parent yang memakai material code, lalu klik untuk buka
            struktur BOM utama.
          </p>
        </div>

        <div className="mt-4">
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={whereUsedCode}
            onChange={(event) => setWhereUsedCode(event.target.value)}
            placeholder="Ketik material code (mis. BR50)"
            className="w-full md:w-[420px]"
          />
        </div>

        {whereUsedCode.trim() ? (
          <p className="mt-4 text-sm text-gray-600">
            <span className="font-semibold text-gray-900">
              {whereUsedCode.trim()}
            </span>{" "}
            dipakai di {whereUsedRows.length} baris BOM.
          </p>
        ) : (
          <p className="mt-4 text-sm text-gray-400">
            Masukkan material code untuk melihat semua parent/uniq yang
            memakainya.
          </p>
        )}

        <Table<WhereUsedRow>
          className="mt-3"
          columns={whereUsedColumns}
          dataSource={whereUsedRows}
          rowKey="key"
          size="small"
          bordered
          loading={isBomLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total, range) => `(${range[1]} of ${total}) baris`,
          }}
          scroll={{ x: "max-content", y: 420 }}
          /*
           * [where-used-parent-with-children-dropdown]
           * Dropdown expand per parent — tampilkan daftar child yang cocok
           * (bisa dari material_code ATAU dari uniq/part_number/part_name/
           * model child). Expand disembunyikan kalau hanya ada 1 child dan
           * itu adalah material_code (behavior lama), tapi kalau match dari
           * child uniq/part number/dll, dropdown akan otomatis muncul.
           */
          expandable={{
            rowExpandable: (record) => record.matchedChildren.length > 0,
            expandedRowRender: (record) => (
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs font-semibold text-gray-700 mb-2">
                  Child yang cocok ({record.matchedChildren.length})
                </div>
                <Table<WhereUsedChildEntry>
                  size="small"
                  bordered
                  pagination={false}
                  rowKey="key"
                  dataSource={record.matchedChildren}
                  columns={[
                    {
                      title: "Child Code",
                      dataIndex: "childCode",
                      key: "childCode",
                      width: 130,
                      render: (v: string) => (
                        <span className="font-semibold text-emerald-600">
                          {v}
                        </span>
                      ),
                    },
                    {
                      title: "Child Name",
                      dataIndex: "childName",
                      key: "childName",
                      width: 220,
                    },
                    {
                      title: "Material Code",
                      dataIndex: "materialCode",
                      key: "materialCode",
                      width: 140,
                      render: (v: string) => (
                        <span className="font-medium text-orange-600">
                          {v}
                        </span>
                      ),
                    },
                    {
                      title: "Type",
                      dataIndex: "type",
                      key: "type",
                      width: 110,
                    },
                    {
                      title: "Qty/Use",
                      dataIndex: "qtyUse",
                      key: "qtyUse",
                      width: 90,
                    },
                    {
                      title: "Yield",
                      dataIndex: "yieldValue",
                      key: "yieldValue",
                      width: 80,
                    },
                    {
                      title: "Scrap %",
                      dataIndex: "scrap",
                      key: "scrap",
                      width: 90,
                    },
                    {
                      title: "Posisi",
                      dataIndex: "position",
                      key: "position",
                      width: 90,
                    },
                    {
                      title: "Substitusi",
                      dataIndex: "substitution",
                      key: "substitution",
                      width: 110,
                    },
                    {
                      title: "Note",
                      dataIndex: "note",
                      key: "note",
                      render: (v: string) => (
                        <span className="text-xs text-gray-500">{v}</span>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          }}
          locale={{
            emptyText: whereUsedCode.trim()
              ? "Tidak ada parent yang memakai material code ini."
              : "Belum ada pencarian.",
          }}
        />
      </Modal>
      <Modal
        open={excelModalOpen}
        title="Upload Bill Of Material"
        onCancel={() => {
          setExcelModalOpen(false);
          resetImportModalState();
        }}
        width={1324}
        destroyOnHidden
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              onClick={() => {
                setExcelModalOpen(false);
                resetImportModalState();
              }}
            >
              Close
            </Button>
            {excelModalTab === "upload" && (
              <Button
                type="primary"
                danger={Boolean(
                  importPreview && importPreview.status !== "success",
                )}
                onClick={async () => {
                  if (importPreview) {
                    setImportPreview(null);
                    setImportPreviewRows([]);
                    setSelectedFile(null);
                    setUploadProgress(0);
                    setUploadDone(false);
                    setStagedPreviewRows([]);
                    return;
                  }

                  if (!selectedFile) return;
                  let progressTimer: ReturnType<typeof setInterval> | null =
                    null;

                  try {
                    setIsUploading(true);
                    setUploadProgress(0);
                    progressTimer = setInterval(() => {
                      setUploadProgress((current) =>
                        current >= 90 ? current : current + 9,
                      );
                    }, 180);

                    const result = await importBom(selectedFile).unwrap();

                    if (progressTimer) clearInterval(progressTimer);

                    let preview = buildImportPreview(result);
                    let rows = stagedPreviewRows;
                    const downloadUrl = extractDownloadUrl(result);

                    if (downloadUrl) {
                      try {
                        const detail = await fetchDownloadPreview(downloadUrl);
                        if (detail.issues.length > 0) {
                          preview = {
                            ...preview,
                            issues: detail.issues,
                            failed: detail.issues.length,
                          };
                        }
                        if (detail.rows.length > 0) {
                          rows = detail.rows;
                        }
                      } catch (detailError) {
                        messageApi.warning(
                          getApiErrorMessage(
                            detailError,
                            "Failed to load import error preview",
                          ),
                        );
                      }
                    }

                    setUploadProgress(100);
                    setUploadDone(true);
                    setIsUploading(false);
                    setImportPreview(preview);
                    setImportPreviewRows(rows);

                    await refetchHistory();
                    setSelectedHistoryId(null);

                    if (preview.imported > 0) {
                      await refetch();
                    }

                    if (preview.failed > 0) {
                      messageApi.warning(preview.message);
                    } else {
                      messageApi.success(`Imported ${selectedFile.name}`);
                    }
                  } catch (err) {
                    if (progressTimer) clearInterval(progressTimer);

                    let preview = buildImportPreview(err);
                    let rows = stagedPreviewRows;
                    const downloadUrl = extractDownloadUrl(err);

                    if (downloadUrl) {
                      try {
                        const detail = await fetchDownloadPreview(downloadUrl);
                        if (detail.issues.length > 0) {
                          preview = {
                            ...preview,
                            issues: detail.issues,
                            failed: detail.issues.length,
                          };
                        }
                        if (detail.rows.length > 0) {
                          rows = detail.rows;
                        }
                      } catch (detailError) {
                        messageApi.warning(
                          getApiErrorMessage(
                            detailError,
                            "Failed to load import error preview",
                          ),
                        );
                      }
                    }

                    setIsUploading(false);
                    setUploadProgress(0);
                    setUploadDone(true);
                    setImportPreview(preview);
                    setImportPreviewRows(rows);

                    await refetchHistory();
                    setSelectedHistoryId(null);

                    messageApi.error(
                      getApiErrorMessage(err, "BOM import failed"),
                    );
                  }
                }}
                disabled={!selectedFile || isUploading}
              >
                {importPreview ? "Fix & Re-upload" : "Save"}
              </Button>
            )}
          </div>
        }
      >
        <div className="mb-4 flex items-center gap-6 border-b border-[#f0f0f0] pb-3 text-sm">
          <button
            type="button"
            onClick={() => setExcelModalTab("upload")}
            className={
              excelModalTab === "upload"
                ? "flex items-center gap-2 border-b-2 border-[#2563eb] pb-2 font-medium text-[#2563eb]"
                : "flex items-center gap-2 pb-2 text-[#667085]"
            }
          >
            <UploadOutlined />
            Upload
          </button>
          <button
            type="button"
            onClick={() => {
              setExcelModalTab("history");
              setSelectedHistoryId(
                (current) => current ?? uploadHistory[0]?.id ?? null,
              );
            }}
            className={
              excelModalTab === "history"
                ? "flex items-center gap-2 border-b-2 border-[#2563eb] pb-2 font-medium text-[#2563eb]"
                : "flex items-center gap-2 pb-2 text-[#667085]"
            }
          >
            <HistoryOutlined />
            Upload History
          </button>
        </div>

        {excelModalTab === "upload" ? (
          <>
            {!selectedFile && (
              <Upload.Dragger
                name="file"
                accept=".xlsx,.xls,.csv"
                multiple={false}
                showUploadList={false}
                disabled={isUploading}
                beforeUpload={(file) => {
                  const lowerName = file.name.toLowerCase();
                  const isAllowed =
                    lowerName.endsWith(".xlsx") ||
                    lowerName.endsWith(".xls") ||
                    lowerName.endsWith(".csv");

                  if (!isAllowed) {
                    messageApi.error(
                      "Please upload an Excel or CSV file (.xlsx/.xls/.csv)",
                    );
                    return Upload.LIST_IGNORE;
                  }

                  setSelectedFile(file as File);
                  setUploadProgress(0);
                  setUploadDone(false);
                  setImportPreview(null);
                  setImportPreviewRows([]);

                  void parseWorkbookFile(file as File)
                    .then((rows) => setStagedPreviewRows(rows))
                    .catch(() => setStagedPreviewRows([]));

                  return Upload.LIST_IGNORE;
                }}
                className="[&_.ant-upload-drag]:!rounded-lg [&_.ant-upload-drag]:!border-[#d9d9d9] [&_.ant-upload-drag]:!bg-white [&_.ant-upload-drag]:hover:!border-[#2563eb]"
              >
                <div className="flex min-h-[124px] items-center justify-center gap-3 py-6 text-center">
                  <InboxOutlined className="text-2xl text-[#8c8c8c]" />
                  <div>
                    <div className="text-[15px] text-[#344054]">
                      Drag your file or{" "}
                      <span className="font-medium text-[#2563eb]">Browse</span>
                    </div>
                    <div className="mt-1 text-xs text-[#98a2b3]">
                      Xls,csv file. 32MB max.
                    </div>
                  </div>
                </div>
              </Upload.Dragger>
            )}

            {selectedFile && (
              <div
                className={
                  importPreview && importPreview.status !== "success"
                    ? "mb-3 rounded-lg border border-[#fca5a5] bg-white px-4 py-4"
                    : "mb-3 rounded-lg border border-[#e5e7eb] bg-white px-4 py-4"
                }
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {isUploading ? (
                      <Progress
                        type="circle"
                        percent={uploadProgress}
                        width={34}
                        strokeColor="#2563eb"
                        trailColor="#e5e7eb"
                        format={(percent) => (
                          <span className="text-[9px] text-[#344054]">
                            {percent}%
                          </span>
                        )}
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded bg-[#E8F5E9] text-[#1F9254]">
                        <FileExcelOutlined className="text-lg" />
                      </div>
                    )}

                    <div>
                      <div className="text-sm font-medium text-[#344054]">
                        {selectedFile.name}
                      </div>
                      <div className="text-xs text-[#98a2b3]">
                        {isUploading
                          ? "Uploading..."
                          : importPreview &&
                              importPreview.status !== "success" &&
                              importPreview.failed > 0
                            ? `Uploaded with ${importPreview.failed} issue${importPreview.failed > 1 ? "s" : ""}`
                            : `${Math.max(1, Math.round(selectedFile.size / 1024))}Kb`}
                      </div>
                    </div>
                  </div>

                  {!isUploading && !importPreview && (
                    <button
                      type="button"
                      aria-label="remove-file"
                      className="text-[#667085] transition hover:text-[#111827]"
                      onClick={() => {
                        setSelectedFile(null);
                        setUploadProgress(0);
                        setUploadDone(false);
                      }}
                    >
                      <CloseOutlined />
                    </button>
                  )}
                </div>

                {importPreview && importPreview.status !== "success" && (
                  <div className="mt-3 border-t border-[#f3f4f6] pt-3 text-sm text-[#475467]">
                    File validation completed. Review the issues below before
                    re-uploading.
                  </div>
                )}
              </div>
            )}

            {importPreview && (
              <>
                <div
                  className={
                    importPreview.status === "success"
                      ? "mb-3 rounded-md border border-[#b7eb8f] bg-[#f6ffed] px-4 py-3 text-sm text-[#135200]"
                      : importPreview.status === "partial"
                        ? "mb-3 rounded-md border border-[#ffe58f] bg-[#fffbe6] px-4 py-3 text-sm text-[#ad6800]"
                        : "mb-3 rounded-md border border-[#ffccc7] bg-[#fff1f0] px-4 py-3 text-sm text-[#cf1322]"
                  }
                >
                  <div className="font-semibold">
                    {importPreview.status === "success"
                      ? `Upload successful - ${importPreview.imported} row${importPreview.imported === 1 ? "" : "s"} imported`
                      : importPreview.status === "partial"
                        ? `Sebagian berhasil - ${importPreview.imported} sukses, ${importPreview.failed} gagal`
                        : `Upload gagal - ${importPreview.failed} baris bermasalah`}
                  </div>
                  <div className="mt-1">{importPreview.message}</div>
                  {(importPreview.imported > 0 || importPreview.failed > 0) && (
                    <div className="mt-2 text-xs">
                      Imported: {importPreview.imported} • Failed:{" "}
                      {importPreview.failed}
                    </div>
                  )}
                  {importPreview.issues.length > 0 && (
                    <div className="mt-3 space-y-1 text-sm">
                      {importPreview.issues.slice(0, 5).map((issue) => (
                        <div key={issue.key}>
                          <span className="font-medium">{issue.rowLabel}:</span>{" "}
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {previewTableRows.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-[#f0f0f0]">
                    <Table<Record<string, string>>
                      columns={previewColumns}
                      dataSource={previewTableRows}
                      pagination={false}
                      rowKey="key"
                      size="small"
                      scroll={{ x: "max-content", y: 240 }}
                      rowClassName={() => "bg-[#fff1f0]"}
                    />
                  </div>
                )}
              </>
            )}

            <div className="rounded-md bg-[#eaf4ff] px-4 py-3 text-sm text-[#344054]">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[#667085]">
                  1
                </span>
                <p>
                  Download our{" "}
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="font-medium text-[#2563eb] underline hover:opacity-80"
                  >
                    XLSX
                  </button>{" "}
                  template as a guide to upload your BOM. Sheet{" "}
                  <span className="font-medium">Master Data</span> berisi daftar
                  process, machine, UOM, dan supplier aktif terbaru dari sistem.
                </p>
              </div>
              <div className="mt-3 flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[#667085]">
                  2
                </span>
                <p>
                  The package upload is asynchronous and may take a few minutes
                  to complete, depending on infrastructure speed.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="grid min-h-[520px] grid-cols-[480px_minmax(0,1fr)] gap-4">
            <div className="min-h-0 rounded-lg border border-[#eaecf0] bg-white">
              <div className="flex items-center justify-between border-b border-[#eaecf0] px-4 py-3">
                <div className="text-[18px] font-semibold text-[#101828]">
                  Recent Uploads
                </div>
                <div className="text-sm text-[#98a2b3]">
                  {uploadHistory.length} uploads
                </div>
              </div>

              <div className="max-h-[452px] space-y-3 overflow-y-auto p-4">
                {uploadHistory.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#d0d5dd] bg-[#fafafa] px-4 py-10 text-center text-sm text-[#667085]">
                    No upload history yet.
                  </div>
                ) : (
                  uploadHistory.map((entry) => {
                    const isActive = entry.id === selectedHistoryId;
                    const statusTone =
                      entry.status === "success"
                        ? "bg-[#e8fff1] text-[#027a48]"
                        : entry.status === "partial"
                          ? "bg-[#fffbe6] text-[#ad6800]"
                          : "bg-[#fff1f0] text-[#d92d20]";
                    const cardClassName =
                      entry.status === "success"
                        ? isActive
                          ? "border-[#98b8ff] bg-white shadow-sm"
                          : "border-[#eaecf0] bg-white hover:border-[#d0d5dd]"
                        : isActive
                          ? "border-[#fda29b] bg-[#fff1f0] shadow-sm"
                          : "border-[#fecdca] bg-[#fff5f5] hover:border-[#fda29b]";

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedHistoryId(entry.id)}
                        className={`w-full rounded-xl border p-4 text-left transition ${cardClassName}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${entry.status === "success" ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-[#fef3f2] text-[#dc2626]"}`}
                            >
                              <FileExcelOutlined className="text-lg" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-[15px] font-semibold text-[#101828]">
                                  {entry.fileName}
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone}`}
                                >
                                  {entry.status === "success"
                                    ? "Success"
                                    : entry.status === "partial"
                                      ? "Partial"
                                      : "Failed"}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-[#667085]">
                                <span className="inline-flex items-center gap-1">
                                  <UserOutlined /> {entry.uploadedBy}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <CalendarOutlined />{" "}
                                  {new Date(entry.uploadedAt).toLocaleString()}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                                <span>{entry.fileSizeKb}Kb</span>
                                <span>•</span>
                                <span>{entry.rowCount} rows</span>
                                {entry.imported > 0 && (
                                  <span className="rounded bg-[#ecfdf3] px-1.5 py-0.5 font-medium text-[#027a48]">
                                    {entry.imported} imported
                                  </span>
                                )}
                                {entry.failed > 0 && (
                                  <span className="rounded bg-[#fef3f2] px-1.5 py-0.5 font-medium text-[#d92d20]">
                                    {entry.failed} failed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center cursor-pointer gap-1 rounded-md px-2 py-1 text-sm ${isActive ? "bg-[#dbeafe] text-[#175cd3]" : "text-[#175cd3]"}`}
                          >
                            <EyeOutlined /> {isActive ? "Viewing" : "Preview"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="min-h-0 rounded-lg border border-[#eaecf0] bg-white">
              {!selectedHistoryEntry ? (
                <div className="flex h-full min-h-[452px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#d0d5dd] bg-[#fafafa] text-center text-[#667085]">
                  <EyeOutlined className="mb-3 text-4xl text-[#98a2b3]" />
                  <div className="text-2xl font-medium text-[#101828]">
                    Select a file to preview
                  </div>
                  <div className="mt-2 text-sm">
                    Click on any file from the list to view its contents
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between border-b border-[#eaecf0] px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${selectedHistoryEntry.status === "success" ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-[#fef3f2] text-[#dc2626]"}`}
                      >
                        <FileExcelOutlined className="text-lg" />
                      </div>
                      <div>
                        <div className="text-[22px] font-semibold text-[#101828]">
                          {selectedHistoryEntry.fileName}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-[#667085]">
                          <span className="inline-flex items-center gap-1">
                            <UserOutlined /> {selectedHistoryEntry.uploadedBy}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarOutlined />{" "}
                            {new Date(
                              selectedHistoryEntry.uploadedAt,
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    {selectedHistoryEntry.downloadUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadErrorFile(
                            selectedHistoryEntry.downloadUrl as string,
                            `errors-${selectedHistoryEntry.fileName}`,
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-md border border-[#d0d5dd] px-3 py-2 text-sm text-[#175cd3] hover:bg-[#f8fbff]"
                      >
                        <DownloadOutlined /> Download file error
                      </button>
                    )}
                  </div>

                  <div
                    className={
                      selectedHistoryEntry.status === "success"
                        ? "mx-5 mt-4 rounded-lg border border-[#b7eb8f] bg-[#f6ffed] px-4 py-3 text-sm text-[#135200]"
                        : selectedHistoryEntry.status === "partial"
                          ? "mx-5 mt-4 rounded-lg border border-[#ffe58f] bg-[#fffbe6] px-4 py-3 text-sm text-[#ad6800]"
                          : "mx-5 mt-4 rounded-lg border border-[#ffccc7] bg-[#fff1f0] px-4 py-3 text-sm text-[#cf1322]"
                    }
                  >
                    <div className="font-semibold">
                      {selectedHistoryEntry.status === "success"
                        ? "Import berhasil"
                        : selectedHistoryEntry.status === "partial"
                          ? "Import sebagian berhasil"
                          : "Import gagal"}
                    </div>
                    <div className="mt-1">{selectedHistoryEntry.summary}</div>
                    <div className="mt-1 text-xs">
                      Imported: {selectedHistoryEntry.imported} • Failed:{" "}
                      {selectedHistoryEntry.failed}
                    </div>
                  </div>

                  {selectedHistoryEntry.status !== "success" && (
                    <div className="mx-5 mt-4 rounded-lg border border-[#ffccc7] bg-[#fff1f0] px-4 py-3 text-sm text-[#cf1322]">
                      This file contains validation errors
                    </div>
                  )}

                  <div className="min-h-0 flex-1 p-5 pt-4">
                    {historyPreviewLoading ? (
                      <div className="flex h-full min-h-[260px] items-center justify-center rounded-lg border border-dashed border-[#d0d5dd] bg-[#fafafa] text-sm text-[#667085]">
                        Memuat preview…
                      </div>
                    ) : historyDetailRows.length > 0 ? (
                      <Table<Record<string, string>>
                        columns={historyPreviewColumns}
                        dataSource={historyDetailRows}
                        rowKey="key"
                        size="small"
                        pagination={{ pageSize: 10, showSizeChanger: true }}
                        scroll={{ x: "max-content", y: 330 }}
                        rowClassName={(record) =>
                          record.error ? "bg-[#fff1f0]" : ""
                        }
                      />
                    ) : (
                      <div className="flex h-full min-h-[260px] items-center justify-center rounded-lg border border-dashed border-[#d0d5dd] bg-[#fafafa] text-sm text-[#667085]">
                        No preview rows available for this upload.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(deleteTarget)}
        title="Delete BOM item?"
        okText="Delete"
        cancelText="Cancel"
        okButtonProps={{
          danger: true,
          loading: isDeletingParent || isDeletingChild,
        }}
        onCancel={() => setDeleteTarget(null)}
        onOk={async () => {
          if (!deleteTarget) return;
          const deleted = await handleDelete(deleteTarget);
          if (deleted) {
            setDeleteTarget(null);
          }
        }}
        destroyOnHidden
      >
        <p>Delete {deleteTarget?.uniq ?? "this BOM item"}?</p>
      </Modal>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">BOM Structure</h1>
              <p>Expandable Parent & Child Parts</p>
            </div>
          </div>

          <Typography.Link
            onClick={() => messageApi.info("Tip: Click any row to view CAD")}
            className="text-sm"
          >
            <BulbOutlined /> Click any row to view 3D CAD model
          </Typography.Link>
        </div>

        <div className="px-5 pb-5">
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <Input
              allowClear
              value={uniqSearch}
              onChange={(event) => setUniqSearch(event.target.value)}
              placeholder="Search by UNIQ code"
              className="w-full md:w-[360px]"
            />
          </div>

          <Table<BomRow>
            columns={columns}
            dataSource={filteredBomRows}
            rowKey="key"
            bordered
            loading={isBomLoading || isDeletingParent || isDeletingChild}
            pagination={{
              current: tablePage,
              pageSize: tablePageSize,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ["5", "10", "20", "50", "100"],
              onChange: (page, size) => {
                setTablePage(page);
                setTablePageSize(size);
              },
              showTotal: (total, range) =>
                `(${range[1]} of ${total}) Parent BOMs`,
            }}
            expandable={{
              expandedRowKeys: effectiveExpandedRowKeys,
              onExpandedRowsChange: (keys) => {
                if (!uniqSearch.trim()) {
                  setExpandedRowKeys([...keys]);
                }
              },
              rowExpandable: (record) => (record.children?.length ?? 0) > 0,
              expandIcon: ({ expanded, onExpand, record }) => {
                const canExpand = (record.children?.length ?? 0) > 0;
                if (!canExpand) return <span className="inline-block w-4" />;

                return (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpand(record, e);
                    }}
                    aria-label={expanded ? "Collapse row" : "Expand row"}
                  >
                    <RightOutlined
                      className={
                        expanded
                          ? "text-gray-600 rotate-90 transition-transform"
                          : "text-gray-600 transition-transform"
                      }
                    />
                  </button>
                );
              },
              indentSize: 20,
            }}
            onRow={(record) => ({
              onClick: () => {
                messageApi.info(`Open CAD viewer for ${record.uniq}`);
              },
            })}
            rowClassName={(record) => (record.isParent ? "bg-blue-50" : "")}
            scroll={{ x: "max-content" }}
          />

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setExpandedRowKeys(expandableParentKeys)}
                disabled={expandableParentKeys.length === 0}
              >
                Expand All
              </Button>
              <Button
                onClick={() => setExpandedRowKeys([])}
                disabled={expandedRowKeys.length === 0}
              >
                Collapse All
              </Button>
            </div>
            <div className="text-sm text-gray-500">
              {expandedRowKeys.length} parent items expanded
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
