"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Modal, Table, Typography, Upload, message } from "antd";
import type { UploadFile } from "antd";
import {
  DownloadOutlined,
  InboxOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  downloadTemplate,
  parseSpreadsheetFile,
  type ExcelColumn,
  type ParsedRow,
} from "@/lib/utils/excel/masterExcel";
import {
  emptyBulkOutcome,
  type BulkImportOutcome,
} from "@/lib/utils/excel/bulkImportTypes";

export type ImportRowResult = {
  rowNumber: number;
  label: string;
  status: "success" | "error";
  message?: string;
};

type MapResult<TPayload> =
  | { ok: true; payload: TPayload; label: string }
  | { ok: false; error: string; label: string };

export type ExcelImportModalProps<TPayload> = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Human readable entity name, e.g. "customer" / "supplier". */
  entityName: string;
  templateFileName: string;
  templateTitle: string;
  columns: ExcelColumn[];
  exampleRows?: Array<Record<string, string | number | undefined>>;
  /** Validate + map a parsed spreadsheet row to an API payload. */
  mapRow: (row: ParsedRow, index: number) => MapResult<TPayload>;
  /**
   * Persist ALL mapped payloads in a single bulk request and return the
   * per-row outcome reported by the backend. Rows that fail client-side
   * validation are NOT sent here; only valid payloads are.
   */
  bulkImport: (payloads: TPayload[]) => Promise<BulkImportOutcome>;
  /** Called once after an import finishes with at least one success. */
  onImported?: () => void;
};

export default function ExcelImportModal<TPayload>(
  props: ExcelImportModalProps<TPayload>
) {
  const {
    open,
    onClose,
    title,
    entityName,
    templateFileName,
    templateTitle,
    columns,
    exampleRows,
    mapRow,
    bulkImport,
    onImported,
  } = props;

  const [messageApi, contextHolder] = message.useMessage();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportRowResult[]>([]);

  const resetState = () => {
    setFileList([]);
    setParsedRows([]);
    setResults([]);
    setParsing(false);
    setImporting(false);
  };

  const handleClose = () => {
    if (importing) return;
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    downloadTemplate({
      fileName: templateFileName,
      title: templateTitle,
      columns,
      exampleRows,
    });
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setResults([]);
    try {
      const rows = await parseSpreadsheetFile(file, columns);
      if (rows.length === 0) {
        messageApi.warning("Tidak ada baris data yang ditemukan pada sheet \"Data\".");
      }
      setParsedRows(rows);
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Gagal membaca file Excel."
      );
      setParsedRows([]);
    } finally {
      setParsing(false);
    }
  };

  const previewColumns = useMemo(
    () =>
      columns.map((column) => ({
        title: column.header,
        dataIndex: column.key,
        key: column.key,
        ellipsis: true,
      })),
    [columns]
  );

  const handleImport = async () => {
    if (parsedRows.length === 0) {
      messageApi.warning("Silakan unggah file Excel terlebih dahulu.");
      return;
    }

    setImporting(true);

    // 1) Map + client-side validate every row. Keep valid payloads (to send in
    //    one bulk request) and remember which spreadsheet row each maps to.
    const collected: ImportRowResult[] = new Array(parsedRows.length);
    const validPayloads: TPayload[] = [];
    const validRowNumbers: number[] = [];

    parsedRows.forEach((row, index) => {
      const rowNumber = index + 2; // +1 header, +1 to be 1-based
      const mapped = mapRow(row, index);
      if (!mapped.ok) {
        collected[index] = {
          rowNumber,
          label: mapped.label,
          status: "error",
          message: mapped.error,
        };
        return;
      }
      validPayloads.push(mapped.payload);
      validRowNumbers.push(index);
      collected[index] = {
        rowNumber,
        label: mapped.label,
        status: "success",
      };
    });

    // 2) Send all valid payloads in a single bulk request.
    if (validPayloads.length > 0) {
      let outcome: BulkImportOutcome = emptyBulkOutcome();
      try {
        outcome = await bulkImport(validPayloads);
      } catch (error) {
        // Network / unexpected error: mark all sent rows as failed.
        const msg =
          error instanceof Error ? error.message : "Gagal mengirim data ke server.";
        validRowNumbers.forEach((originalIndex) => {
          const existing = collected[originalIndex];
          collected[originalIndex] = {
            rowNumber: existing.rowNumber,
            label: existing.label,
            status: "error",
            message: msg,
          };
        });
        setResults(collected);
        setImporting(false);
        messageApi.error(msg);
        return;
      }

      // 3) Merge the backend per-row outcome back onto the original rows.
      outcome.results.forEach((rowResult) => {
        const originalIndex = validRowNumbers[rowResult.index];
        if (originalIndex === undefined) return;
        const existing = collected[originalIndex];
        collected[originalIndex] = {
          rowNumber: existing.rowNumber,
          label: existing.label,
          status: rowResult.status === "success" ? "success" : "error",
          message:
            rowResult.status === "success" ? undefined : rowResult.message,
        };
      });
    }

    setResults(collected);
    setImporting(false);

    const successCount = collected.filter((r) => r.status === "success").length;
    const errorCount = collected.length - successCount;

    if (successCount > 0) {
      messageApi.success(
        `${successCount} ${entityName} berhasil diimpor.` +
          (errorCount > 0 ? ` ${errorCount} baris gagal.` : "")
      );
      onImported?.();
    } else {
      messageApi.error(`Impor gagal. ${errorCount} baris bermasalah.`);
    }
  };

  const resultColumns = [
    { title: "Baris", dataIndex: "rowNumber", key: "rowNumber", width: 80 },
    { title: entityName, dataIndex: "label", key: "label" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (value: string) => (
        <span
          className={
            value === "success"
              ? "text-green-600 font-semibold"
              : "text-red-600 font-semibold"
          }
        >
          {value === "success" ? "Berhasil" : "Gagal"}
        </span>
      ),
    },
    { title: "Keterangan", dataIndex: "message", key: "message", ellipsis: true },
  ];

  const successPreview = results.filter((r) => r.status === "success").length;
  const errorPreview = results.length - successPreview;

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      width={860}
      title={title}
      maskClosable={!importing}
      footer={[
        <Button key="cancel" className="!rounded-lg" onClick={handleClose} disabled={importing}>
          Tutup
        </Button>,
        <Button
          key="import"
          type="primary"
          className="!rounded-lg"
          icon={<UploadOutlined />}
          loading={importing}
          disabled={parsedRows.length === 0}
          onClick={handleImport}
        >
          Import {parsedRows.length > 0 ? `(${parsedRows.length})` : ""}
        </Button>,
      ]}
    >
      {contextHolder}

      <div className="space-y-4">
        <Alert
          type="info"
          showIcon
          message="Cara import data massal"
          description={
            <ol className="list-decimal pl-4 space-y-1 text-sm">
              <li>Unduh template Excel di bawah ini.</li>
              <li>
                Isi banyak baris data pada sheet <b>Data</b> (satu baris = satu{" "}
                {entityName}). Lihat sheet <b>Contoh</b> dan{" "}
                <b>Petunjuk Pengisian</b> untuk panduan.
              </li>
              <li>
                Unggah kembali file yang sudah diisi, lalu klik Import. Semua
                baris dikirim sekaligus dalam satu proses.
              </li>
            </ol>
          }
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button
            className="!rounded-lg"
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
          >
            Download Template Excel
          </Button>
          <Typography.Text type="secondary" className="text-xs">
            Format yang didukung: .xlsx, .xls
          </Typography.Text>
        </div>

        <Upload.Dragger
          multiple={false}
          maxCount={1}
          fileList={fileList}
          accept=".xlsx,.xls"
          showUploadList={{ showRemoveIcon: !importing }}
          beforeUpload={(file) => {
            const name = file.name.toLowerCase();
            if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
              messageApi.error("Silakan unggah file Excel (.xlsx / .xls)");
              return Upload.LIST_IGNORE;
            }
            setFileList([
              { uid: "-1", name: file.name, status: "done" } as UploadFile,
            ]);
            void handleFile(file);
            return false;
          }}
          onRemove={() => {
            setFileList([]);
            setParsedRows([]);
            setResults([]);
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            Klik atau seret file Excel ke sini
          </p>
          <p className="ant-upload-hint">
            Gunakan template yang sudah disediakan agar kolom sesuai.
          </p>
        </Upload.Dragger>

        {parsing ? (
          <Typography.Text type="secondary">Membaca file...</Typography.Text>
        ) : null}

        {parsedRows.length > 0 && results.length === 0 ? (
          <div>
            <Typography.Text strong>
              Pratinjau {parsedRows.length} baris
            </Typography.Text>
            <Table<ParsedRow>
              size="small"
              className="mt-2"
              columns={previewColumns}
              dataSource={parsedRows.map((row, index) => ({
                key: String(index),
                ...row,
              }))}
              pagination={{ pageSize: 5 }}
              scroll={{ x: true }}
            />
          </div>
        ) : null}

        {results.length > 0 ? (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Typography.Text strong>Hasil Import</Typography.Text>
              <span className="text-xs text-green-600 font-semibold">
                {successPreview} berhasil
              </span>
              {errorPreview > 0 ? (
                <span className="text-xs text-red-600 font-semibold">
                  {errorPreview} gagal
                </span>
              ) : null}
            </div>
            <Table<ImportRowResult>
              size="small"
              rowKey={(record) => `${record.rowNumber}-${record.label}`}
              columns={resultColumns}
              dataSource={results}
              pagination={{ pageSize: 5 }}
              scroll={{ x: true }}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
