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
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";

import {
  useDeleteBomChildMutation,
  useDeleteBomParentMutation,
  useGetBomListQuery,
  useImportBomMutation,
} from "@/lib/api/bom/api";
import type { BackendBomNode } from "@/lib/api/bom/api";
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
  const record = isRecord(payload) ? payload : {};
  const data = isRecord(record.data) ? record.data : record;

  const imported = asNumber(
    data.imported ?? data.success ?? data.success_count ?? data.created,
  );
  const initialFailed = asNumber(
    data.failed ?? data.error_count ?? data.invalid ?? data.rejected,
  );

  const rawIssues = [
    ...(Array.isArray(data.errors) ? data.errors : []),
    ...(Array.isArray(data.validation_errors) ? data.validation_errors : []),
    ...(Array.isArray(data.failed_rows) ? data.failed_rows : []),
    ...(Array.isArray(data.invalid_rows) ? data.invalid_rows : []),
  ];

  const issues = rawIssues.map(normalizeImportIssue);
  const failed = initialFailed || issues.length;
  const message =
    (typeof data.message === "string" && data.message.trim()) ||
    (failed > 0
      ? imported > 0
        ? `${failed} validation issue${failed > 1 ? "s" : ""} found`
        : `Upload failed with ${failed} issue${failed > 1 ? "s" : ""}`
      : `Upload successful. ${imported || 0} row${imported === 1 ? "" : "s"} imported`);

  return {
    status: failed > 0 ? (imported > 0 ? "partial" : "error") : "success",
    message,
    imported,
    failed,
    issues,
  };
};

const extractRequestId = (payload: unknown): string | undefined => {
  if (!isRecord(payload)) return undefined;
  const direct = payload.request_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = isRecord(payload.data) ? payload.data.request_id : undefined;
  return typeof nested === "string" && nested.trim()
    ? nested.trim()
    : undefined;
};

const extractDownloadUrl = (payload: unknown): string | undefined => {
  if (!isRecord(payload)) return undefined;
  const data = isRecord(payload.data) ? payload.data : payload;
  const url =
    data.download_url ?? data.error_download_url ?? data.failed_download_url;
  return typeof url === "string" && url.trim() ? url.trim() : undefined;
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

  const text = await response.text();
  const rows = parseDelimitedText(text);
  const issues = rows.map((row, index) => ({
    key: row.key,
    rowLabel: row.Row || `Row ${index + 1}`,
    message: row.Error || row.Message || row.error || "Validation error",
    values: Object.entries(row).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (!["key", "Row", "Error", "Message", "error"].includes(key)) {
          acc[key] = value;
        }
        return acc;
      },
      {},
    ),
  }));

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
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  );
  const [uniqSearch, setUniqSearch] = useState("");

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

  const bomRows = useMemo(() => {
    const tree = bomListRes?.data ?? [];
    return tree.map((n) => mapNodeToRow(n, { level: 0 }));
  }, [bomListRes?.data]);

  const filteredBomRows = useMemo(
    () => filterBomRowsByUniq(bomRows, uniqSearch),
    [bomRows, uniqSearch],
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
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(BOM_UPLOAD_HISTORY_STORAGE_KEY);
    if (!raw) return;

    const parsed = safeJsonParse<UploadHistoryEntry[]>(raw, []);
    setUploadHistory(Array.isArray(parsed) ? parsed : []);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      BOM_UPLOAD_HISTORY_STORAGE_KEY,
      JSON.stringify(uploadHistory),
    );
  }, [uploadHistory]);

  // Ensure we have a selected history entry after loading history from storage.
  // This fixes the case where the modal was opened and switched to the History
  // tab before `uploadHistory` was populated from localStorage, leaving the
  // preview pane empty even though entries exist.
  useEffect(() => {
    if (selectedHistoryId == null && uploadHistory.length > 0) {
      setSelectedHistoryId(uploadHistory[0].id);
    }
  }, [uploadHistory, selectedHistoryId]);

  const selectedHistoryEntry = useMemo(
    () => uploadHistory.find((entry) => entry.id === selectedHistoryId) ?? null,
    [selectedHistoryId, uploadHistory],
  );

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

  const historyPreviewColumns = useMemo<
    ColumnsType<Record<string, string>>
  >(() => {
    const fields = selectedHistoryEntry?.previewColumns ?? [];

    return fields.map((fieldKey) => ({
      title: fieldKey,
      dataIndex: fieldKey,
      key: fieldKey,
      render: (value: string) => {
        if (fieldKey.toLowerCase() === "error" && value) {
          return <span className="text-[#dc2626]">{value}</span>;
        }
        return value || "-";
      },
    }));
  }, [selectedHistoryEntry]);

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

  const persistHistoryEntry = (entry: UploadHistoryEntry) => {
    setUploadHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY_ITEMS));
    setSelectedHistoryId(entry.id);
  };

  const buildHistoryEntry = (args: {
    file: File;
    payload: unknown;
    preview: ImportPreviewState;
    previewRows: ImportPreviewRow[];
  }): UploadHistoryEntry => {
    const { file, payload, preview, previewRows } = args;
    const totalFromPayload =
      isRecord(payload) && isRecord(payload.data)
        ? asNumber(payload.data.total)
        : 0;
    const rowCount =
      totalFromPayload ||
      stagedPreviewRows.length ||
      preview.imported + preview.failed ||
      previewRows.length;
    const previewColumns = Array.from(
      new Set(
        previewRows.flatMap((row) =>
          Object.keys(row).filter((key) => key !== "key"),
        ),
      ),
    );

    return {
      id: crypto.randomUUID(),
      fileName: file.name,
      fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
      rowCount,
      uploadedBy: getCurrentUserDisplayName() ?? "Current User",
      uploadedAt: new Date().toISOString(),
      status: preview.status,
      summary: preview.message,
      imported: preview.imported,
      failed: preview.failed,
      requestId: extractRequestId(payload),
      downloadUrl: extractDownloadUrl(payload),
      previewRows,
      previewColumns,
      issues: preview.issues,
    };
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
            }>
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
            }}>
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
            }}>
            Excel Upload
          </Button>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="flex items-center gap-2"
            onClick={() => router.push("/bill-of-material/create")}>
            Add BOM Item
          </Button>
        </div>
      </div>
      {contextHolder}
      <Modal
        open={excelModalOpen}
        title="Upload Bill Of Material"
        onCancel={() => {
          setExcelModalOpen(false);
          resetImportModalState();
        }}
        width={1024}
        destroyOnHidden
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              onClick={() => {
                setExcelModalOpen(false);
                resetImportModalState();
              }}>
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

                    const historyEntry = buildHistoryEntry({
                      file: selectedFile,
                      payload: result,
                      preview,
                      previewRows: rows,
                    });
                    persistHistoryEntry(historyEntry);

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

                    const historyEntry = buildHistoryEntry({
                      file: selectedFile,
                      payload: err,
                      preview,
                      previewRows: rows,
                    });
                    persistHistoryEntry(historyEntry);

                    messageApi.error(
                      getApiErrorMessage(err, "BOM import failed"),
                    );
                  }
                }}
                disabled={!selectedFile || isUploading}>
                {importPreview ? "Fix & Re-upload" : "Save"}
              </Button>
            )}
          </div>
        }>
        <div className="mb-4 flex items-center gap-6 border-b border-[#f0f0f0] pb-3 text-sm">
          <button
            type="button"
            onClick={() => setExcelModalTab("upload")}
            className={
              excelModalTab === "upload"
                ? "flex items-center gap-2 border-b-2 border-[#2563eb] pb-2 font-medium text-[#2563eb]"
                : "flex items-center gap-2 pb-2 text-[#667085]"
            }>
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
            }>
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
                className="[&_.ant-upload-drag]:!rounded-lg [&_.ant-upload-drag]:!border-[#d9d9d9] [&_.ant-upload-drag]:!bg-white [&_.ant-upload-drag]:hover:!border-[#2563eb]">
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
                  importPreview?.status === "error"
                    ? "mb-3 rounded-lg border border-[#fca5a5] bg-white px-4 py-4"
                    : "mb-3 rounded-lg border border-[#e5e7eb] bg-white px-4 py-4"
                }>
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
                          : importPreview?.status === "error" &&
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
                      }}>
                      <CloseOutlined />
                    </button>
                  )}
                </div>

                {importPreview?.status === "error" && (
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
                      : "mb-3 rounded-md border border-[#ffccc7] bg-[#fff1f0] px-4 py-3 text-sm text-[#cf1322]"
                  }>
                  <div className="font-semibold">
                    {importPreview.status === "success"
                      ? `Upload successful - ${importPreview.imported} row${importPreview.imported === 1 ? "" : "s"} imported`
                      : `Upload Error - ${importPreview.failed} validation issue${importPreview.failed === 1 ? "" : "s"} found`}
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
                  <span className="font-medium text-[#2563eb]">CSV</span> or{" "}
                  <span className="font-medium text-[#2563eb]">XLS</span>{" "}
                  template as a guide to upload your Inventory.
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
          <div className="grid min-h-[520px] grid-cols-[360px_minmax(0,1fr)] gap-4">
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
                        className={`w-full rounded-xl border p-4 text-left transition ${cardClassName}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${entry.status === "success" ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-[#fef3f2] text-[#dc2626]"}`}>
                              <FileExcelOutlined className="text-lg" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-[15px] font-semibold text-[#101828]">
                                  {entry.fileName}
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone}`}>
                                  {entry.status === "success"
                                    ? "Success"
                                    : "Error"}
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
                              <div className="mt-2 text-sm text-[#667085]">
                                {entry.fileSizeKb}Kb • {entry.rowCount} rows
                              </div>
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm ${isActive ? "bg-[#dbeafe] text-[#175cd3]" : "text-[#175cd3]"}`}>
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
                        className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${selectedHistoryEntry.status === "success" ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-[#fef3f2] text-[#dc2626]"}`}>
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
                      <a
                        href={selectedHistoryEntry.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border border-[#d0d5dd] px-3 py-2 text-sm text-[#175cd3] hover:bg-[#f8fbff]">
                        <DownloadOutlined />
                      </a>
                    )}
                  </div>

                  {selectedHistoryEntry.status !== "success" && (
                    <div className="mx-5 mt-4 rounded-lg border border-[#ffccc7] bg-[#fff1f0] px-4 py-3 text-sm text-[#cf1322]">
                      This file contains validation errors
                    </div>
                  )}

                  <div className="min-h-0 flex-1 p-5 pt-4">
                    {selectedHistoryEntry.previewRows.length > 0 ? (
                      <Table<Record<string, string>>
                        columns={historyPreviewColumns}
                        dataSource={selectedHistoryEntry.previewRows}
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
        destroyOnHidden>
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
            className="text-sm">
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
                    aria-label={expanded ? "Collapse row" : "Expand row"}>
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
                disabled={expandableParentKeys.length === 0}>
                Expand All
              </Button>
              <Button
                onClick={() => setExpandedRowKeys([])}
                disabled={expandedRowKeys.length === 0}>
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
