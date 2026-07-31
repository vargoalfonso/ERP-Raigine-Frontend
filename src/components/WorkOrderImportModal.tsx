"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Table, Upload, Progress, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CalendarOutlined,
  CloseOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  InboxOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";

import {
  useGetWorkOrderImportHistoryQuery,
  useImportWorkOrdersMutation,
  type WorkOrderImportHistoryDto,
} from "@/lib/api/work-orders/import/api";
import { apiBaseUrl, getCookiesFromBrowser } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";

type PreviewState = {
  status: "success" | "partial" | "error";
  message: string;
  imported: number;
  failed: number;
};

type HistoryEntry = {
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
  downloadUrl?: string;
  previewRows: Record<string, string>[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const buildPreview = (payload: unknown): PreviewState => {
  const layers: Record<string, unknown>[] = [];
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
  const statusRaw = String(pick("import_status") ?? "").toLowerCase();
  const imported = Number(pick("success_count", "imported", "success") ?? 0);
  const total = Number(pick("total") ?? 0);
  const failed = Number(pick("failed_count", "failed") ?? 0);
  let status: "success" | "partial" | "error";
  if (statusRaw === "failed" || statusRaw === "error") status = "error";
  else if (statusRaw === "partial") status = "partial";
  else if (statusRaw === "success") status = "success";
  else status = failed > 0 ? (imported > 0 ? "partial" : "error") : "success";
  const backendMessage = pick("message");
  const msg =
    (typeof backendMessage === "string" && backendMessage.trim()) ||
    (status === "success"
      ? `Upload successful. ${imported} row(s) imported`
      : status === "partial"
        ? `Partial: ${imported} success, ${failed} failed`
        : `Failed: ${failed || total || "all"} row(s)`);
  return { status, message: msg, imported, failed };
};

const parseExcelRows = async (
  file: File,
): Promise<Record<string, string>[]> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return rows.slice(0, 100).map((r, i) => {
    const out: Record<string, string> = { key: `row-${i}` };
    Object.entries(r).forEach(([k, v]) => {
      out[k] = v == null ? "" : String(v);
    });
    return out;
  });
};

const downloadWithAuth = async (url: string, fileName: string) => {
  const token = getCookiesFromBrowser("Authorization");
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`(${res.status})`);
  const blob = await res.blob();
  const a = document.createElement("a");
  const objUrl = window.URL.createObjectURL(blob);
  a.href = objUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(objUrl);
};

export default function WorkOrderImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState<"upload" | "history">("upload");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  );
  const [importWorkOrder] = useImportWorkOrdersMutation();
  const { data: historyRes, refetch: refetchHistory } =
    useGetWorkOrderImportHistoryQuery();

  const history = useMemo<HistoryEntry[]>(() => {
    const arr = Array.isArray(historyRes?.data) ? historyRes.data : [];
    return (arr as WorkOrderImportHistoryDto[]).map((dto) => ({
      id: String(dto.id),
      fileName: dto.file_name,
      fileSizeKb: dto.file_size_kb,
      rowCount: dto.row_count,
      uploadedBy: dto.uploaded_by || "-",
      uploadedAt: dto.created_at,
      status:
        dto.status.toLowerCase() === "success"
          ? "success"
          : dto.status.toLowerCase() === "partial"
            ? "partial"
            : "error",
      summary: dto.summary,
      imported: dto.imported_count,
      failed: dto.failed_count,
      downloadUrl: dto.has_error_file
        ? `${apiBaseUrl}/working-order/work-orders/import/history/${dto.id}/errors`
        : undefined,
      previewRows: Array.isArray(dto.preview_rows)
        ? dto.preview_rows.map((r, i) => {
            const out: Record<string, string> = {
              key: `hist-${dto.id}-${i}`,
            };
            Object.entries(r as Record<string, unknown>).forEach(
              ([k, v]) => {
                out[k] = v == null ? "" : String(v);
              },
            );
            return out;
          })
        : [],
    }));
  }, [historyRes]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setPreviewRows([]);
      setProgress(0);
      setIsUploading(false);
      setTab("upload");
    }
  }, [open]);

  useEffect(() => {
    if (selectedHistoryId == null && history.length > 0) {
      setSelectedHistoryId(history[0].id);
    }
  }, [history, selectedHistoryId]);

  const selectedHistory = useMemo(
    () => history.find((h) => h.id === selectedHistoryId) ?? null,
    [history, selectedHistoryId],
  );

  const handleDownloadTemplate = async () => {
    try {
      await downloadWithAuth(
        `${apiBaseUrl}/working-order/work-orders/import/template?t=${Date.now()}`,
        "work_order_template.xlsx",
      );
      messageApi.success("Template downloaded");
    } catch (err) {
      messageApi.error(getApiErrorMessage(err, "Failed to download template"));
    }
  };

  const doUpload = async () => {
    if (!file) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    try {
      setIsUploading(true);
      setProgress(0);
      timer = setInterval(
        () => setProgress((p) => (p >= 90 ? p : p + 10)),
        180,
      );
      const result = await importWorkOrder(file).unwrap();
      if (timer) clearInterval(timer);
      setProgress(100);
      setIsUploading(false);
      const p = buildPreview(result);
      setPreview(p);
      await refetchHistory();
      if (p.status === "success") {
        messageApi.success(`Imported ${file.name}`);
      } else if (p.status === "partial") {
        messageApi.warning(p.message);
      } else {
        messageApi.error(p.message);
      }
    } catch (err) {
      if (timer) clearInterval(timer);
      setIsUploading(false);
      setProgress(0);
      const p = buildPreview(err);
      setPreview(p);
      await refetchHistory();
      messageApi.error(getApiErrorMessage(err, "Import failed"));
    }
  };

  const previewColumns = useMemo<ColumnsType<Record<string, string>>>(() => {
    if (previewRows.length === 0) return [];
    const keys = Array.from(
      new Set(previewRows.flatMap((r) => Object.keys(r))),
    ).filter((k) => k !== "key");
    return keys.map((k) => ({ title: k, dataIndex: k, key: k }));
  }, [previewRows]);

  const historyColumns = useMemo<ColumnsType<Record<string, string>>>(() => {
    if (!selectedHistory || selectedHistory.previewRows.length === 0) return [];
    const keys = Array.from(
      new Set(selectedHistory.previewRows.flatMap((r) => Object.keys(r))),
    ).filter((k) => k !== "key");
    return keys.map((k) => ({ title: k, dataIndex: k, key: k }));
  }, [selectedHistory]);

  return (
    <>
      {contextHolder}
      <Modal
        open={open}
        title="Import Bulk Work Orders"
        onCancel={onClose}
        width={1024}
        destroyOnHidden
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={onClose}>Close</Button>
            {tab === "upload" && (
              <Button
                type="primary"
                danger={Boolean(preview && preview.status !== "success")}
                onClick={() => {
                  if (preview) {
                    setPreview(null);
                    setPreviewRows([]);
                    setFile(null);
                    setProgress(0);
                    return;
                  }
                  doUpload();
                }}
                disabled={!file || isUploading}
              >
                {preview ? "Fix & Re-upload" : "Save"}
              </Button>
            )}
          </div>
        }
      >
        <div className="mb-4 border-b border-[#eaecf0]">
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`mr-6 border-b-2 px-1 py-3 text-sm font-medium ${
              tab === "upload"
                ? "border-[#2563eb] text-[#2563eb]"
                : "border-transparent text-[#667085]"
            }`}
          >
            <UploadOutlined className="mr-1" /> Upload
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`border-b-2 px-1 py-3 text-sm font-medium ${
              tab === "history"
                ? "border-[#2563eb] text-[#2563eb]"
                : "border-transparent text-[#667085]"
            }`}
          >
            <HistoryOutlined className="mr-1" /> Upload History
          </button>
        </div>

        {tab === "upload" ? (
          <div className="space-y-4">
            {!file ? (
              <Upload.Dragger
                name="file"
                accept=".xlsx,.xls,.csv"
                multiple={false}
                showUploadList={false}
                beforeUpload={(f) => {
                  const lower = f.name.toLowerCase();
                  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls") && !lower.endsWith(".csv")) {
                    messageApi.error("Please upload an Excel/CSV file");
                    return Upload.LIST_IGNORE;
                  }
                  setFile(f as File);
                  setPreview(null);
                  setPreviewRows([]);
                  void parseExcelRows(f as File)
                    .then(setPreviewRows)
                    .catch(() => setPreviewRows([]));
                  return Upload.LIST_IGNORE;
                }}
              >
                <div className="py-8 text-center">
                  <InboxOutlined className="text-2xl text-[#8c8c8c]" />
                  <p className="mt-2 text-[15px] text-[#344054]">
                    Drag your file or <span className="text-[#2563eb]">Browse</span>
                  </p>
                  <p className="text-xs text-[#98a2b3]">.xlsx, .xls, .csv</p>
                </div>
              </Upload.Dragger>
            ) : (
              <div className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {isUploading ? (
                      <Progress
                        type="circle"
                        percent={progress}
                        width={34}
                        strokeColor="#2563eb"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded bg-[#E8F5E9] text-[#1F9254]">
                        <FileExcelOutlined className="text-lg" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-[#344054]">
                        {file.name}
                      </div>
                      <div className="text-xs text-[#98a2b3]">
                        {isUploading ? "Uploading..." : `${Math.max(1, Math.round(file.size / 1024))}Kb`}
                      </div>
                    </div>
                  </div>
                  {!isUploading && !preview && (
                    <button
                      type="button"
                      className="text-[#667085] hover:text-[#111827]"
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                        setPreviewRows([]);
                        setProgress(0);
                      }}
                    >
                      <CloseOutlined />
                    </button>
                  )}
                </div>
              </div>
            )}

            {preview && (
              <div
                className={
                  preview.status === "success"
                    ? "rounded-md border border-[#b7eb8f] bg-[#f6ffed] px-4 py-3 text-sm text-[#135200]"
                    : preview.status === "partial"
                      ? "rounded-md border border-[#ffe58f] bg-[#fffbe6] px-4 py-3 text-sm text-[#ad6800]"
                      : "rounded-md border border-[#ffccc7] bg-[#fff1f0] px-4 py-3 text-sm text-[#cf1322]"
                }
              >
                <div className="font-semibold">
                  {preview.status === "success"
                    ? `Upload successful - ${preview.imported} row(s) imported`
                    : preview.status === "partial"
                      ? `Partial - ${preview.imported} success, ${preview.failed} failed`
                      : `Upload failed - ${preview.failed} row(s) had issues`}
                </div>
                <div className="mt-1">{preview.message}</div>
              </div>
            )}

            {previewRows.length > 0 && !preview && (
              <div className="overflow-hidden rounded-lg border border-[#f0f0f0]">
                <Table
                  columns={previewColumns}
                  dataSource={previewRows}
                  pagination={false}
                  rowKey="key"
                  size="small"
                  scroll={{ x: "max-content", y: 240 }}
                />
              </div>
            )}

            <div className="rounded-md bg-[#eaf4ff] px-4 py-3 text-sm text-[#344054]">
              <p>
                1. Download our{" "}
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="font-medium text-[#2563eb] underline"
                >
                  XLSX template
                </button>{" "}
                as a guide.
              </p>
              <p className="mt-2">
                2. Fill one row per work order item and upload it.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[400px] grid-cols-[380px_1fr] gap-4">
            <div className="rounded-lg border border-[#eaecf0] bg-white">
              <div className="border-b border-[#eaecf0] px-4 py-3 font-semibold text-[#101828]">
                Recent Uploads ({history.length})
              </div>
              <div className="max-h-[360px] space-y-3 overflow-y-auto p-4">
                {history.length === 0 ? (
                  <div className="text-center text-sm text-[#667085]">
                    No upload history yet.
                  </div>
                ) : (
                  history.map((entry) => {
                    const isActive = entry.id === selectedHistoryId;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedHistoryId(entry.id)}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          entry.status === "success"
                            ? isActive
                              ? "border-[#98b8ff] bg-white shadow-sm"
                              : "border-[#eaecf0] bg-white hover:border-[#d0d5dd]"
                            : isActive
                              ? "border-[#fda29b] bg-[#fff1f0] shadow-sm"
                              : "border-[#fecdca] bg-[#fff5f5] hover:border-[#fda29b]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${
                              entry.status === "success"
                                ? "bg-[#ecfdf3] text-[#16a34a]"
                                : "bg-[#fef3f2] text-[#dc2626]"
                            }`}
                          >
                            <FileExcelOutlined className="text-lg" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-[15px] font-semibold text-[#101828]">
                                {entry.fileName}
                              </div>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  entry.status === "success"
                                    ? "bg-[#e8fff1] text-[#027a48]"
                                    : entry.status === "partial"
                                      ? "bg-[#fffbe6] text-[#ad6800]"
                                      : "bg-[#fff1f0] text-[#d92d20]"
                                }`}
                              >
                                {entry.status === "success"
                                  ? "Success"
                                  : entry.status === "partial"
                                    ? "Partial"
                                    : "Failed"}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#667085]">
                              <span>
                                <UserOutlined /> {entry.uploadedBy}
                              </span>
                              <span>
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
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <div className="rounded-lg border border-[#eaecf0] bg-white p-4">
              {selectedHistory ? (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-[#101828]">
                        {selectedHistory.fileName}
                      </div>
                      <div className="text-sm text-[#667085]">
                        {selectedHistory.summary}
                      </div>
                    </div>
                    {selectedHistory.downloadUrl && (
                      <Button
                        icon={<DownloadOutlined />}
                        size="small"
                        onClick={() => {
                          void downloadWithAuth(
                            selectedHistory.downloadUrl!,
                            `work_order_import_errors_${selectedHistory.id}.xlsx`,
                          ).catch((err) =>
                            messageApi.error(
                              getApiErrorMessage(
                                err,
                                "Failed to download error file",
                              ),
                            ),
                          );
                        }}
                      >
                        Download Errors
                      </Button>
                    )}
                  </div>
                  {selectedHistory.previewRows.length > 0 ? (
                    <Table
                      columns={historyColumns}
                      dataSource={selectedHistory.previewRows}
                      pagination={false}
                      rowKey="key"
                      size="small"
                      scroll={{ x: "max-content", y: 320 }}
                    />
                  ) : (
                    <div className="text-sm text-[#667085]">
                      No preview rows available.
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[#667085]">
                  Select an upload to view details.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}