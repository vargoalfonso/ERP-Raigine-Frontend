"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import {
  DownloadOutlined,
  EyeOutlined,
  UploadOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScanOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnType } from "antd/es/table";
import * as XLSX from "xlsx";
import StatsCard from "@/components/StatsCard";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  type WipCreateItem,
  type WipListRow,
  useCreateWipMutation,
  useGetWipListQuery,
  useUpdateWipMutation,
} from "@/lib/api/wip/api";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { useGetWorkOrdersQuery } from "@/lib/api/work-orders/api";
import {
  useGetProcessesQuery,
  useGetTypeParametersQuery,
} from "@/lib/api/system-settings/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { formatWorkOrderDisplayNumber } from "@/lib/utils/workOrder";
import ExcelImportModal from "@/components/master-data/ExcelImportModal";
import { downloadTemplate } from "@/lib/utils/excel/masterExcel";
import type { BulkImportOutcome } from "@/lib/utils/excel/bulkImportTypes";
import {
  WIP_EXCEL_COLUMNS,
  WIP_EXCEL_EXAMPLE_ROWS,
} from "@/lib/utils/excel/wipExcelConfig";
import { BsBoxSeam } from "react-icons/bs";
import { HiOutlineArchiveBox } from "react-icons/hi2";
import { LuChartColumn } from "react-icons/lu";
import { FaRegEdit, FaRegTrashAlt } from "react-icons/fa";

type WipRecord = {
  id: string;
  apiId?: string;
  process: string;
  uniq: string;
  partNumber: string;
  partName: string;
  woNumber: string;
  stock: number;
  kanbanCode: string;
  type: string;
  stockToCompleteKanban: number;
  kanban: number;
  /** process = sedang diproses, queue = menunggu proses berikutnya. */
  status?: string;
  waitingProcess?: string;
};

type WipEditFormValues = {
  status?: string;
};

// Satu baris Excel yang sudah divalidasi, siap dikirim ke POST /wip.
type WipImportPayload = {
  woId: string;
  woNumber: string;
  item: WipCreateItem;
};

export default function WorkInProgressPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [searchValue, setSearchValue] = useState("");
  const [tab, setTab] = useState("wip");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [processFilter, setProcessFilter] = useState<string>("all");

  const apiEnabled = Boolean(apiBaseUrl);
  const listQuery = useGetWipListQuery(
    { page: 1, limit: 1000, includeDone: true },
    { skip: !apiEnabled },
  );
  const [updateWip] = useUpdateWipMutation();
  const [createWip] = useCreateWipMutation();

  // ---- Data pendukung untuk validasi import Excel ----
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });
  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data],
  );
  const workOrdersQuery = useGetWorkOrdersQuery(
    { page: 1, limit: 200 },
    { skip: !apiEnabled },
  );
  const { data: processRecords = [] } = useGetProcessesQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: typeParameterRecords = [] } = useGetTypeParametersQuery(
    undefined,
    { skip: !apiEnabled },
  );
  const [importOpen, setImportOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingWip, setEditingWip] = useState<WipRecord | null>(null);
  const [editForm] = Form.useForm<WipEditFormValues>();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingWip, setDeletingWip] = useState<WipRecord | null>(null);

  useEffect(() => {
    if (!apiEnabled || !listQuery.error) return;
    messageApi.error(
      getApiErrorMessage(listQuery.error, "Failed to load WIP inventory"),
    );
  }, [apiEnabled, listQuery.error, messageApi]);

  const mapApiRowToRecord = (row: WipListRow, index: number): WipRecord => {
    const fallbackId = `${row.wo_number ?? "-"}-${row.uniq ?? "-"}-${row.process ?? "-"}-${index}`;
    return {
      id: fallbackId, // uniqueRowKey: wips.id shared across processes
      apiId: row.id,
      process: row.process ?? "-",
      uniq: row.uniq ?? "-",
      partNumber: row.part_number ?? "-",
      partName: row.part_info ?? "-",
      woNumber: row.wo_number ?? "-",
      stock: Number(row.stock ?? 0),
      kanbanCode: row.kanban_number ?? "-",
      type: row.type ?? "-",
      stockToCompleteKanban: Number(row.stock_to_complete_kanban ?? 0),
      kanban: Number(row.kanban ?? 0),
      status: (row.status ?? "").toLowerCase(),
      waitingProcess: row.waiting_process ?? "-",
    };
  };

  // Sumber data HANYA dari API (/wip -> tabel wip_items), tanpa data dummy.
  const tableRows = useMemo(() => {
    const items = listQuery.data?.data ?? [];
    return items.map(mapApiRowToRecord);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQuery.data]);

  const openWipDetail = (record: WipRecord) => {
    const params = new URLSearchParams();
    if (record.apiId) params.set("id", record.apiId);
    if (record.uniq && record.uniq !== "-") params.set("uniq", record.uniq);
    router.push(`/work-in-progress/detail?${params.toString()}`);
  };

  const openEditDrawer = (record: WipRecord) => {
    setEditingWip(record);
    editForm.setFieldsValue({ status: record.type });
    setEditOpen(true);
  };

  const closeEditDrawer = () => {
    setEditOpen(false);
    setEditingWip(null);
    editForm.resetFields();
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      if (!editingWip) return;

      const nextStatus = String(values.status ?? "").trim();
      if (!nextStatus) {
        messageApi.error("Status is required");
        return;
      }

      if (!editingWip.apiId) {
        messageApi.error("WIP id not found");
        return;
      }
      await updateWip({
        id: editingWip.apiId,
        body: { status: nextStatus },
      }).unwrap();
      messageApi.success("Status updated");
      listQuery.refetch();
      closeEditDrawer();
    } catch {
      // validation errors shown by antd
    }
  };

  const openDeleteModal = (record: WipRecord) => {
    setDeletingWip(record);
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteOpen(false);
    setDeletingWip(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingWip) return;
    messageApi.info("Delete WIP is not integrated for this page yet.");
    closeDeleteModal();
  };

  const filteredData = tableRows.filter((row) => {
    const matchesSearch =
      !searchValue ||
      [
        row.process,
        row.uniq,
        row.partNumber,
        row.partName,
        row.woNumber,
        row.kanbanCode,
        row.status,
        row.waitingProcess,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchValue.toLowerCase());

    const matchesProcess =
      processFilter === "all" ||
      row.process === processFilter ||
      row.waitingProcess === processFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active"
        ? (row.status ?? "") !== "done"
        : (row.status ?? "") === statusFilter);

    return matchesSearch && matchesProcess && matchesStatus;
  });

  // ================================================================
  // Export ke Excel (.xlsx)
  // ----------------------------------------------------------------
  // Mengekspor baris yang sedang tampil di tabel WIP Inventory, yaitu
  // sesudah filter Status, filter Process, dan pencarian diterapkan
  // (seluruh halaman, bukan hanya halaman pagination yang terlihat).
  // Kolom Actions tidak diekspor.
  // ================================================================
  const statusLabel = (status?: string) => {
    switch (status) {
      case "queue":
        return "Queue";
      case "process":
        return "In Process";
      case "done":
        return "Done";
      default:
        return status || "";
    }
  };

  const handleExport = () => {
    if (tab !== "wip") {
      messageApi.info("Export hanya tersedia pada tab WIP Inventory.");
      return;
    }
    if (filteredData.length === 0) {
      messageApi.warning("Tidak ada data untuk diekspor");
      return;
    }

    const clean = (value: string) => (value === "-" ? "" : value);
    const rows = filteredData.map((r) => ({
      Status: statusLabel(r.status),
      Process: clean(r.process),
      "Next Process": r.status === "queue" ? clean(r.waitingProcess ?? "") : "",
      Uniq: clean(r.uniq),
      "Part Name": clean(r.partName),
      "Part Number": clean(r.partNumber),
      "WO Number": clean(r.woNumber),
      Stock: r.stock,
      "Kanban No.": clean(r.kanbanCode),
      "Qty / Kanban": r.kanban,
    }));

    try {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 12 }, // Status
        { wch: 16 }, // Process
        { wch: 16 }, // Next Process
        { wch: 14 }, // Uniq
        { wch: 30 }, // Part Name
        { wch: 18 }, // Part Number
        { wch: 16 }, // WO Number
        { wch: 10 }, // Stock
        { wch: 18 }, // Kanban No.
        { wch: 14 }, // Qty / Kanban
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "WIP Inventory");
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `wip-inventory-${dateStr}.xlsx`);
      messageApi.success(`Berhasil mengekspor ${rows.length} baris`);
    } catch (err) {
      console.error("Export WIP gagal", err);
      messageApi.error("Gagal mengekspor data WIP");
    }
  };

  // ================================================================
  // Import via Excel
  // ----------------------------------------------------------------
  // Satu baris = satu item WIP. Payload sama dengan form Create WIP:
  // process_flow dibuat dari kolom Process (op_seq 10, 20, ...).
  // Baris dikelompokkan per Work Order, satu request POST /wip per WO.
  // ================================================================
  const norm = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toLowerCase();

  const handleDownloadTemplate = () => {
    downloadTemplate({
      fileName: "template-import-wip.xlsx",
      title: "Template Import Work In Progress",
      columns: WIP_EXCEL_COLUMNS,
      exampleRows: WIP_EXCEL_EXAMPLE_ROWS,
    });
  };

  const handleBulkImport = async (
    payloads: WipImportPayload[],
  ): Promise<BulkImportOutcome> => {
    const byWo = new Map<
      string,
      { woNumber: string; items: WipCreateItem[]; indexes: number[] }
    >();
    payloads.forEach((payload, index) => {
      const group = byWo.get(payload.woId) ?? {
        woNumber: payload.woNumber,
        items: [],
        indexes: [],
      };
      group.items.push(payload.item);
      group.indexes.push(index);
      byWo.set(payload.woId, group);
    });

    const results: BulkImportOutcome["results"] = [];
    for (const [woId, group] of byWo) {
      try {
        await createWip({
          wo_id: woId,
          wo_number: group.woNumber,
          items: group.items,
        }).unwrap();
        group.indexes.forEach((index) =>
          results.push({ index, status: "success" }),
        );
      } catch (error) {
        const msg = getApiErrorMessage(
          error,
          `Gagal menyimpan WIP untuk WO ${group.woNumber}.`,
        );
        group.indexes.forEach((index) =>
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

  const summaryStats = useMemo(() => {
    // Statistik hanya menghitung WIP aktif; baris "done" hanya riwayat.
    const activeRows = tableRows.filter((r) => r.status !== "done");
    const totalQuantity = activeRows.reduce(
      (sum, row) => sum + Number(row.stock ?? 0),
      0,
    );
    const inProcess = activeRows.filter((r) => r.status === "process").length;
    const inQueue = activeRows.filter((r) => r.status === "queue").length;
    return {
      activeWip: activeRows.length,
      totalQuantity,
      inProcess,
      inQueue,
    };
  }, [tableRows]);

  const columns: ColumnType<WipRecord>[] = [
    {
      title: "Status",
      key: "status",
      width: 130,
      render: (_: unknown, record: WipRecord) =>
        record.status === "queue" ? (
          <Tag color="orange" className="!m-0">
            Queue
          </Tag>
        ) : record.status === "process" ? (
          <Tag color="blue" className="!m-0">
            In Process
          </Tag>
        ) : record.status === "done" ? (
          <Tag color="green" className="!m-0">
            Done
          </Tag>
        ) : (
          <Tag className="!m-0">{record.status || "-"}</Tag>
        ),
    },
    {
      title: "Process",
      key: "process",
      width: 130,
      render: (_: unknown, record: WipRecord) => (
        <span className="inline-flex rounded-full bg-[#F1F5F9] px-3 py-1 text-xs text-gray-700">
          {record.process}
        </span>
      ),
    },
    {
      title: "Next Process",
      key: "waitingProcess",
      width: 140,
      render: (_: unknown, record: WipRecord) =>
        record.status === "queue" ? (
          <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs text-orange-700">
            {record.waitingProcess}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      width: 110,
    },
    {
      title: "Part Info",
      key: "partInfo",
      width: 230,
      render: (_: unknown, record: WipRecord) => (
        <div>
          <div className="font-semibold text-gray-900">{record.partName}</div>
          <div className="text-xs text-gray-400">{record.partNumber}</div>
        </div>
      ),
    },
    {
      title: "WO Number",
      key: "woNumber",
      width: 140,
      render: (_: unknown, record: WipRecord) => (
        <span className="inline-flex rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
          {record.woNumber}
        </span>
      ),
    },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      width: 100,
    },
    {
      title: "Kanban No.",
      key: "kanbanCode",
      width: 150,
      render: (_: unknown, record: WipRecord) => (
        <span className="inline-flex rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
          {record.kanbanCode}
        </span>
      ),
    },
    {
      title: "Qty / Kanban",
      dataIndex: "kanban",
      key: "kanban",
      width: 120,
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, record: WipRecord) => (
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            className="text-blue-600 hover:text-blue-800"
            onClick={() => openWipDetail(record)}
          />
          <Button
            type="text"
            icon={<FaRegEdit />}
            size="small"
            className="text-green-600 hover:text-green-800"
            onClick={() => openEditDrawer(record)}
          />
          <Button
            type="text"
            icon={<FaRegTrashAlt color="red" />}
            size="small"
            className="text-red-600 hover:text-gray-800"
            onClick={() => openDeleteModal(record)}
          />
          <Button
            type="text"
            icon={<ReloadOutlined />}
            size="small"
            className="text-gray-600 hover:text-gray-800"
            onClick={() => listQuery.refetch()}
          />
        </div>
      ),
    },
  ];

  const processOptions = useMemo(() => {
    const values = new Set(
      tableRows
        .flatMap((row) => [row.process, row.waitingProcess ?? ""])
        .filter((v) => Boolean(v) && v !== "-"),
    );
    return [
      { label: "All Process", value: "all" },
      ...Array.from(values).map((p) => ({ label: p, value: p })),
    ];
  }, [tableRows]);

  return (
    <div className="p-6 space-y-6">
      {contextHolder}

      <Modal
        title="Delete WIP item?"
        open={deleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={handleConfirmDelete}
        onCancel={closeDeleteModal}
      >
        <p>
          This will remove{" "}
          <span className="font-semibold">{deletingWip?.uniq}</span> from the
          list.
        </p>
      </Modal>

      <Drawer
        title={<div className="font-semibold">Update Status</div>}
        placement="right"
        width={380}
        open={editOpen}
        onClose={closeEditDrawer}
        closeIcon={<span className="text-gray-500">×</span>}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button onClick={closeEditDrawer}>Cancel</Button>
            <Button type="primary" onClick={handleSaveEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={editForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: "Status is required" }]}
          >
            <Select
              placeholder="Select status"
              options={[
                { label: "draft", value: "draft" },
                { label: "in_progress", value: "in_progress" },
                { label: "completed", value: "completed" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-semibold text-gray-900">
            Work In-Progress Database
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <span>Tuesday, September 23, 2025</span>
            <span className="text-gray-300">•</span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>System Online</span>
            </span>
          </div>
        </div>

        {/* <Button className="rounded-xl">Admin PPIC</Button> */}
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              Work In-Progress Database
            </div>
            <div className="text-sm text-gray-500">
              Barang yang belum selesai dan sedang dikerjakan (In Process) atau
              menunggu proses berikutnya (Queue) otomatis masuk WIP; keluar dari
              daftar saat sudah selesai.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button icon={<ScanOutlined />} className="flex items-center gap-2">
              Scan WIP
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="flex items-center gap-2"
              onClick={() => router.push("/work-in-progress/create")}
            >
              Add WIP
            </Button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Active WIP"
          value={summaryStats.activeWip}
          icon={<BsBoxSeam size={22} />}
          bgColor=""
          textColor="text-blue-600"
        />
        <StatsCard
          title="Total Quantity"
          value={summaryStats.totalQuantity}
          icon={<LuChartColumn size={22} />}
          bgColor=""
          textColor="text-green-600"
        />
        <StatsCard
          title="In Process"
          value={summaryStats.inProcess}
          icon={<HiOutlineArchiveBox size={22} />}
          bgColor=""
          textColor="text-orange-600"
        />
        <StatsCard
          title="In Queue"
          value={summaryStats.inQueue}
          icon={<LuChartColumn size={22} />}
          bgColor=""
          textColor="text-purple-600"
        />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 space-y-4">
          <div className="inline-grid grid-cols-2 p-[2px] bg-[#F1F5F9] rounded-lg">
            <button
              type="button"
              onClick={() => setTab("wip")}
              className={`${tab === "wip" ? "bg-white" : ""} rounded-xl text-sm px-4 py-2`}
            >
              WIP Inventory
            </button>
            <button
              type="button"
              onClick={() => setTab("station")}
              className={`${tab === "station" ? "bg-white" : ""} rounded-xl text-sm px-4 py-2`}
            >
              Station Visibility
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by Uniq, Part, WO, Process or Kanban..."
              prefix={<SearchOutlined className="text-gray-400" />}
              className="max-w-[420px]"
              allowClear
            />

            <div className="flex items-center gap-2">
              <Button
                icon={<DownloadOutlined />}
                className="flex items-center gap-2"
                onClick={handleDownloadTemplate}
              >
                Download Template
              </Button>
              <Button
                icon={<UploadOutlined />}
                className="flex items-center gap-2"
                onClick={() => setImportOpen(true)}
              >
                Import Excel
              </Button>
              <Button
                icon={<DownloadOutlined />}
                className="flex items-center gap-2"
                onClick={handleExport}
                disabled={apiEnabled && listQuery.isFetching}
              >
                Export
              </Button>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {tab === "wip" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">
                  WIP Inventory
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={statusFilter}
                    onChange={setStatusFilter}
                    style={{ width: 160 }}
                    options={[
                      { label: "Active (Belum Done)", value: "active" },
                      { label: "All Status", value: "all" },
                      { label: "In Process", value: "process" },
                      { label: "Queue", value: "queue" },
                      { label: "Done", value: "done" },
                    ]}
                  />
                  <Select
                    value={processFilter}
                    onChange={setProcessFilter}
                    style={{ width: 200 }}
                    options={processOptions}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table<WipRecord>
                  columns={columns}
                  dataSource={filteredData}
                  rowKey="id"
                  loading={apiEnabled ? listQuery.isFetching : false}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  bordered
                  scroll={{ x: "max-content" }}
                  locale={{
                    emptyText:
                      "Belum ada WIP. Barang masuk WIP setelah scan-in dan keluar saat selesai.",
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-gray-500">
              No station data
            </div>
          )}
        </div>
      </div>

      <ExcelImportModal<WipImportPayload>
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Work In Progress (Data Massal)"
        entityName="WIP"
        templateFileName="template-import-wip.xlsx"
        templateTitle="Template Import Work In Progress"
        columns={WIP_EXCEL_COLUMNS}
        exampleRows={WIP_EXCEL_EXAMPLE_ROWS}
        mapRow={(row) => {
          const woInput = (row.wo_number ?? "").trim();
          const uniq = (row.uniq ?? "").trim();
          const label = [woInput, uniq].filter(Boolean).join(" / ") || "(kosong)";

          if (!woInput) return { ok: false, label, error: "WO Number wajib diisi." };
          if (!uniq) return { ok: false, label, error: "Uniq wajib diisi." };

          // WO: cocokkan nomor asli atau nomor tampilan, tanpa beda huruf besar/kecil.
          const workOrders = workOrdersQuery.data?.items ?? [];
          const wo = workOrders.find(
            (w) =>
              norm(w.wo_number) === norm(woInput) ||
              norm(formatWorkOrderDisplayNumber(w.wo_number)) === norm(woInput),
          );
          if (!wo?.id) {
            return {
              ok: false,
              label,
              error: `WO Number "${woInput}" tidak ditemukan.`,
            };
          }

          // Uniq harus ada di BOM (bila data BOM sudah termuat).
          const matchedUniq = bomIndex.uniqs.find((u) => norm(u) === norm(uniq));
          if (bomIndex.uniqs.length > 0 && !matchedUniq) {
            return { ok: false, label, error: `Uniq "${uniq}" tidak ada di BOM.` };
          }
          const uniqCode = matchedUniq ?? uniq;

          const stockRaw = (row.stock ?? "").replace(/,/g, "").trim();
          const stock = Number(stockRaw);
          if (!stockRaw || !Number.isFinite(stock) || stock <= 0) {
            return { ok: false, label, error: "Stock wajib diisi dengan angka lebih dari 0." };
          }

          const perKanbanRaw = (row.qty_per_kanban ?? "").replace(/,/g, "").trim();
          const perKanban = perKanbanRaw ? Number(perKanbanRaw) : 0;
          if (perKanbanRaw && (!Number.isFinite(perKanban) || perKanban < 0)) {
            return { ok: false, label, error: "Qty / Kanban harus berupa angka 0 atau lebih." };
          }

          // Process: satu atau lebih nama proses (dipisah koma), sesuai master.
          const processNames = (row.process ?? "")
            .split(/[,;\n]/)
            .map((p) => p.trim())
            .filter(Boolean);
          if (processNames.length === 0) {
            return { ok: false, label, error: "Process wajib diisi." };
          }
          const masterProcesses = processRecords
            .map((p) => (p.process_name ? String(p.process_name).trim() : ""))
            .filter(Boolean);
          const resolvedProcesses: string[] = [];
          for (const name of processNames) {
            if (masterProcesses.length === 0) {
              resolvedProcesses.push(name);
              continue;
            }
            const found = masterProcesses.find((m) => norm(m) === norm(name));
            if (!found) {
              return { ok: false, label, error: `Process "${name}" tidak ada di master Process.` };
            }
            resolvedProcesses.push(found);
          }

          // WIP Type: sesuai Type Parameter; kosong = tipe pertama.
          const typeNames = typeParameterRecords
            .map((t) => String(t.type_name ?? "").trim())
            .filter(Boolean);
          const typeInput = (row.wip_type ?? "").trim();
          let wipType = typeNames[0] ?? "";
          if (typeInput) {
            const foundType = typeNames.find((t) => norm(t) === norm(typeInput));
            if (typeNames.length > 0 && !foundType) {
              return { ok: false, label, error: `WIP Type "${typeInput}" tidak ada di Type Parameter.` };
            }
            wipType = foundType ?? typeInput;
          }

          const packingNumber =
            (row.packing_number ?? "").trim() ||
            bomIndex.packingNumberByUniq[uniqCode] ||
            "";

          return {
            ok: true,
            label,
            payload: {
              woId: String(wo.id),
              woNumber: String(wo.wo_number),
              item: {
                uniq: uniqCode,
                kanban_number: packingNumber,
                wip_type: wipType,
                uom: bomIndex.uomByUniq[uniqCode] || "Piece",
                stock,
                stock_kanban: perKanban,
                process_flow: resolvedProcesses.map((process, index) => ({
                  op_seq: (index + 1) * 10,
                  machine_name: `${process} Station`,
                  process_name: process,
                })),
              },
            },
          };
        }}
        bulkImport={handleBulkImport}
        onImported={() => listQuery.refetch()}
      />
    </div>
  );
}
