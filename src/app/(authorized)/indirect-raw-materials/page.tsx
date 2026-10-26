"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Modal,
  Table,
  Tag,
  message,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FilterOutlined,
  UploadOutlined,
  PlusOutlined,
  SearchOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  type InventoryMutationRequest,
  type InventoryRecord,
  useBulkCreateInventoryMutation,
  useGetInventoryListQuery,
  useLazyGenerateQRIndirectQuery,
} from "@/lib/api/inventory/api";
import ExcelImportModal from "@/components/master-data/ExcelImportModal";
import { downloadTemplate } from "@/lib/utils/excel/masterExcel";
import type { BulkImportOutcome } from "@/lib/utils/excel/bulkImportTypes";
import {
  INDIRECT_EXCEL_COLUMNS,
  INDIRECT_EXCEL_EXAMPLE_ROWS,
} from "@/lib/utils/excel/indirectExcelConfig";
import { consumeFlashMessage } from "@/lib/utils/flashMessage";
import PrintButton from "@/components/PrintButton";
import type { PrintCardOptions } from "@/lib/utils/printCard";

type IndirectRawMaterialRow = {
  id: string;
  uniq: string;
  partNumber: string;
  partName: string;
  warehouse: string;
  currentStock: number;
  toCompleteKanban: number;
  kanbanCount: number;
  stockDays: number;
  safetyStockDays: number;
  status: "NORMAL" | "LOW STOCK";
  buyFlag: "BUY" | "NOT BUY";
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const isMissingRouteError = (error: unknown): boolean => isRecord(error) && error.status === 404;

const mapInventoryToIndirectRow = (record: InventoryRecord): IndirectRawMaterialRow => {
  const currentStock = Number(record.stock_qty ?? 0);
  return {
    id: record.id,
    uniq: record.uniq_code ?? "-",
    partNumber: record.part_number ?? "-",
    partName: record.part_name ?? record.item_name ?? record.uniq_code ?? "-",
    warehouse: record.warehouse_location ?? "-",
    currentStock,
    toCompleteKanban: 0,
    kanbanCount: 0,
    stockDays: 0,
    safetyStockDays: 0,
    status: currentStock > 20 ? "NORMAL" : "LOW STOCK",
    buyFlag: currentStock > 20 ? "NOT BUY" : "BUY",
  };
};

const initialRows: IndirectRawMaterialRow[] = [
  {
    id: "RM-001",
    uniq: "RM-001",
    partNumber: "BOLT-M8-20",
    partName: "Bolt M8-20mm",
    warehouse: "WH-A",
    currentStock: 15000,
    toCompleteKanban: 5000,
    kanbanCount: 25,
    stockDays: 10,
    safetyStockDays: 10,
    status: "NORMAL",
    buyFlag: "NOT BUY",
  },
  {
    id: "RM-002",
    uniq: "RM-002",
    partNumber: "WASHER-M8",
    partName: "Washer M8",
    warehouse: "WH-A",
    currentStock: 3000,
    toCompleteKanban: 2000,
    kanbanCount: 5,
    stockDays: 10,
    safetyStockDays: 5,
    status: "LOW STOCK",
    buyFlag: "BUY",
  },
];

export default function IndirectRawMaterialsPage() {
  const router = useRouter();
  const [generateQRIndirect] = useLazyGenerateQRIndirectQuery();

  // Builds the print-card options and fetches the QR (packing list / kanban
  // list from DN management) on demand. 1 uniq = 1 QR.
  const handleGenerateQR = async (
    row: IndirectRawMaterialRow,
  ): Promise<PrintCardOptions | null> => {
    if (!row.uniq) {
      message.error("Uniq code tidak ditemukan");
      return null;
    }

    let qrDataUrl: string | undefined;
    try {
      const result = await generateQRIndirect(row.uniq).unwrap();
      const qr = result?.data?.qr ?? "";
      qrDataUrl = qr
        ? qr.startsWith("data:image")
          ? qr
          : `data:image/png;base64,${qr}`
        : undefined;
      if (!qrDataUrl) {
        message.error(
          `QR untuk uniq ${row.uniq} belum tersedia di DN management`,
        );
      }
    } catch (err) {
      console.error(err);
      const detail =
        (err as { data?: { message?: string } })?.data?.message ??
        (err as { error?: string })?.error ??
        "Gagal mengambil QR dari DN management";
      message.error(`Gagal mengambil QR (${row.uniq}): ${detail}`);
    }

    return {
      documentTitle: `Indirect Raw Material - ${row.uniq}`,
      heading: "INDIRECT RAW MATERIAL",
      subheading: row.uniq,
      fields: [
        { label: "Part Number", value: row.partNumber },
        { label: "Part Name", value: row.partName, full: true },
        { label: "Warehouse", value: row.warehouse },
        { label: "Current Stock", value: row.currentStock.toLocaleString("en-US") },
        { label: "Status", value: row.status },
        { label: "Buy/Not Buy", value: row.buyFlag },
      ],
      qrDataUrl,
      bottomCode: row.uniq,
      onError: (msg) => message.error(msg),
    };
  };
  const [messageApi, contextHolder] = message.useMessage();

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<IndirectRawMaterialRow[]>(initialRows);
  const apiEnabled = Boolean(apiBaseUrl);
  const listQuery = useGetInventoryListQuery(
    { type: "indirect-materials", page: 1, limit: 20 },
    { skip: !apiEnabled }
  );

  // ---- Import via Excel (POST /inventory/indirect-materials/bulk) ----
  const [importOpen, setImportOpen] = useState(false);
  const [bulkCreateInventory] = useBulkCreateInventoryMutation();

  const handleDownloadTemplate = () => {
    downloadTemplate({
      fileName: "template-import-indirect-raw-material.xlsx",
      title: "Template Import Indirect Raw Material",
      columns: INDIRECT_EXCEL_COLUMNS,
      exampleRows: INDIRECT_EXCEL_EXAMPLE_ROWS,
    });
  };

  // Backend menyimpan semua baris dalam satu transaksi (semua berhasil atau
  // semua gagal). UNIQ dobel di dalam file ditolak di sini supaya satu baris
  // bermasalah tidak menggagalkan baris lain.
  const handleBulkImport = async (
    payloads: InventoryMutationRequest[],
  ): Promise<BulkImportOutcome> => {
    const seen = new Set<string>();
    const sendable: InventoryMutationRequest[] = [];
    const sendableIndex: number[] = [];
    const results: BulkImportOutcome["results"] = [];

    payloads.forEach((payload, index) => {
      const key = payload.uniq_code.trim().toUpperCase();
      if (seen.has(key)) {
        results.push({
          index,
          status: "failed",
          message: `UNIQ ${payload.uniq_code} dobel di file.`,
        });
        return;
      }
      seen.add(key);
      sendable.push(payload);
      sendableIndex.push(index);
    });

    if (sendable.length > 0) {
      try {
        await bulkCreateInventory({
          type: "indirect-materials",
          items: sendable,
        }).unwrap();
        sendableIndex.forEach((index) => results.push({ index, status: "success" }));
      } catch (error) {
        const msg = getApiErrorMessage(error, "Gagal menyimpan data indirect raw material.");
        sendableIndex.forEach((index) =>
          results.push({ index, status: "failed", message: msg }),
        );
      }
    }

    const success = results.filter((r) => r.status === "success").length;
    return {
      total: payloads.length,
      success_count: success,
      failed_count: payloads.length - success,
      results,
    };
  };

  useEffect(() => {
    const flash = consumeFlashMessage("/indirect-raw-materials");
    if (flash) {
      messageApi.open({ type: flash.type, content: flash.content });
    }
  }, [messageApi]);

  useEffect(() => {
    if (!apiEnabled || !listQuery.error) return;
    if (isMissingRouteError(listQuery.error)) {
      messageApi.warning("Inventory indirect-materials API route is not available yet; showing mock data.");
      return;
    }
    messageApi.error(getApiErrorMessage(listQuery.error, "Failed to load indirect materials inventory"));
  }, [apiEnabled, listQuery.error, messageApi]);

  const inventoryRows = useMemo(() => {
    if (!apiEnabled || isMissingRouteError(listQuery.error)) return rows;
    const items = listQuery.data?.data ?? [];
    if (!items.length) return [];
    return items.map(mapInventoryToIndirectRow);
  }, [apiEnabled, listQuery.data, listQuery.error, rows]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<IndirectRawMaterialRow | null>(
    null
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inventoryRows;
    return inventoryRows.filter((r) => {
      return (
        r.uniq.toLowerCase().includes(q) ||
        r.partNumber.toLowerCase().includes(q) ||
        r.partName.toLowerCase().includes(q)
      );
    });
  }, [inventoryRows, query]);

  const openDelete = (row: IndirectRawMaterialRow) => {
    setDeletingRow(row);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeletingRow(null);
  };

  const confirmDelete = () => {
    if (!deletingRow) return;
    if (apiEnabled && !isMissingRouteError(listQuery.error)) {
      messageApi.info("Delete inventory is not integrated for this page yet.");
      closeDelete();
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== deletingRow.id));
    messageApi.success("Deleted");
    closeDelete();
  };

  const columns: ColumnsType<IndirectRawMaterialRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      width: 90,
      render: (v: string) => (
        <span className="text-blue-600 font-medium">{v}</span>
      ),
    },
    {
      title: "Part Number",
      dataIndex: "partNumber",
      key: "partNumber",
      width: 140,
      render: (v: string) => <span className="font-medium">{v}</span>,
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      width: 180,
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse",
      key: "warehouse",
      width: 110,
    },
    {
      title: "Current Stock",
      dataIndex: "currentStock",
      key: "currentStock",
      width: 120,
      align: "right",
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "To Complete Kanban",
      dataIndex: "toCompleteKanban",
      key: "toCompleteKanban",
      width: 150,
      align: "right",
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "Kanban Count",
      dataIndex: "kanbanCount",
      key: "kanbanCount",
      width: 120,
      align: "right",
    },
    {
      title: "Stock Days",
      dataIndex: "stockDays",
      key: "stockDays",
      width: 110,
      align: "right",
      render: (v: number) => `${v} days`,
    },
    {
      title: "Safety Stock",
      dataIndex: "safetyStockDays",
      key: "safetyStockDays",
      width: 120,
      align: "right",
      render: (v: number) => `${v} days`,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: IndirectRawMaterialRow["status"]) => {
        if (v === "LOW STOCK") {
          return <Tag className="bg-red-50 text-red-600">LOW STOCK</Tag>;
        }
        return <Tag className="bg-green-50 text-green-600">NORMAL</Tag>;
      },
    },
    {
      title: "Buy Flag",
      dataIndex: "buyFlag",
      key: "buyFlag",
      width: 110,
      render: (v: IndirectRawMaterialRow["buyFlag"]) => {
        if (v === "BUY") {
          return <Tag className="bg-blue-50 text-blue-600">BUY</Tag>;
        }
        return <Tag className="bg-gray-50 text-gray-600">NOT BUY</Tag>;
      },
    },
    {
      title: "Action",
      key: "action",
      width: 90,
      fixed: "right",
      render: (_: unknown, row: IndirectRawMaterialRow) => (
        <div className="flex items-center gap-1">
          <Button
            type="text"
            icon={<EyeOutlined />}
            className="text-blue-600 hover:text-blue-800"
            onClick={() =>
              router.push(
                `/indirect-raw-material/detail?id=${encodeURIComponent(row.id)}&uniq=${encodeURIComponent(row.uniq)}`
              )
            }
          />
          <PrintButton
            type="text"
            icon={<QrcodeOutlined />}
            title="Print"
            className="text-gray-600 hover:text-blue-600"
            loadOptions={() => handleGenerateQR(row)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => openDelete(row)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      {contextHolder}

      <Modal
        title="Delete item?"
        open={deleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmDelete}
        onCancel={closeDelete}
      >
        <div>
          <div className="text-gray-700">
            This will remove <span className="font-semibold">{deletingRow?.uniq}</span>.
          </div>
        </div>
      </Modal>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Indirect Raw Material Database
          </h1>
          <p className="text-gray-600">
            Track indirect materials with buy/not buy recommendations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            Download Template
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            Import Excel
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push("/indirect-raw-material/create")}
          >
            Add Material
          </Button>
        </div>
      </div>

      <ExcelImportModal<InventoryMutationRequest>
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Indirect Raw Material (Data Massal)"
        entityName="material"
        templateFileName="template-import-indirect-raw-material.xlsx"
        templateTitle="Template Import Indirect Raw Material"
        columns={INDIRECT_EXCEL_COLUMNS}
        exampleRows={INDIRECT_EXCEL_EXAMPLE_ROWS}
        mapRow={(row) => {
          const uniq = (row.uniq_code ?? "").trim();
          const label = uniq || "(tanpa uniq)";
          if (!uniq) return { ok: false, label, error: "Uniq wajib diisi." };

          const qtyRaw = (row.stock_qty ?? "").replace(/,/g, "").trim();
          const qty = Number(qtyRaw);
          if (!qtyRaw || !Number.isFinite(qty) || qty < 0) {
            return {
              ok: false,
              label,
              error: "Stock Qty wajib diisi dengan angka 0 atau lebih.",
            };
          }

          const optional = (value?: string) => {
            const v = (value ?? "").trim();
            return v ? v : undefined;
          };
          return {
            ok: true,
            label,
            payload: {
              uniq_code: uniq,
              raw_material_type: "Indirect",
              part_number: optional(row.part_number),
              part_name: optional(row.part_name),
              warehouse_location: optional(row.warehouse_location),
              uom: optional(row.uom),
              stock_qty: qty,
            },
          };
        }}
        bulkImport={handleBulkImport}
        onImported={() => listQuery.refetch()}
      />

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 flex items-center gap-3 justify-between flex-wrap">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by UNIQ, part name, or part number..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="max-w-xl"
          />

          <div className="flex items-center gap-2">
            <Button icon={<FilterOutlined />}>Filter</Button>
            <Button>Create DN for Supplier</Button>
          </div>
        </div>

        <div className="p-4 pt-0">
          <Table<IndirectRawMaterialRow>
            columns={columns}
            dataSource={filteredRows}
            rowKey="id"
            loading={apiEnabled ? listQuery.isFetching : false}
            pagination={false}
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>
    </div>
  );
}
