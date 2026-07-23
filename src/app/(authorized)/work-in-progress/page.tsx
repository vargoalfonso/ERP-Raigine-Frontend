"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Drawer, Form, Input, Modal, Select, Table, Tag, message } from "antd";
import {
  DownloadOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScanOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnType } from "antd/es/table";
import StatsCard from "@/components/StatsCard";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { type WipListRow, useGetWipListQuery, useUpdateWipMutation } from "@/lib/api/wip/api";
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
};

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;
const isMissingRouteError = (error: unknown): boolean => isRecord(error) && error.status === 404;

const dummyWipData: WipRecord[] = [
  {
    id: "1",
    process: "Assembly",
    uniq: "LV7-001",
    partNumber: "EMA7-001",
    partName: "Engine Mount Assembly",
    woNumber: "WO-001-2024",
    stock: 200,
    kanbanCode: "KBN-001-2024",
    type: "draft",
    stockToCompleteKanban: 250,
    kanban: 5,
  },
  {
    id: "2",
    process: "Machining",
    uniq: "LV7-001",
    partNumber: "EMA7-001",
    partName: "Engine Mount Assembly",
    woNumber: "WO-001-2024",
    stock: 200,
    kanbanCode: "KBN-001-2024",
    type: "draft",
    stockToCompleteKanban: 250,
    kanban: 5,
  },
  {
    id: "3",
    process: "Quality Check",
    uniq: "LV8-002",
    partNumber: "SA8-002",
    partName: "Suspension Arm",
    woNumber: "WO-002-2024",
    stock: 200,
    kanbanCode: "KBN-002-2024",
    type: "draft",
    stockToCompleteKanban: 25,
    kanban: 2,
  },
  {
    id: "4",
    process: "Assembly",
    uniq: "LW0-003",
    partNumber: "BC0-003",
    partName: "Brake Caliper",
    woNumber: "WO-003-2024",
    stock: 200,
    kanbanCode: "KBN-003-2024",
    type: "draft",
    stockToCompleteKanban: 25,
    kanban: 2,
  },
  {
    id: "5",
    process: "Quality Check",
    uniq: "MB6-004",
    partNumber: "CM6-004",
    partName: "Control Module",
    woNumber: "WO-004-2024",
    stock: 200,
    kanbanCode: "KBN-004-2024",
    type: "draft",
    stockToCompleteKanban: 29,
    kanban: 2,
  },
];

type WipEditFormValues = {
  status?: string;
};

export default function WorkInProgressPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [searchValue, setSearchValue] = useState("");
  const [tab, setTab] = useState("wip");
  const [processFilter, setProcessFilter] = useState<string>("all");

  const apiEnabled = Boolean(apiBaseUrl);
  const listQuery = useGetWipListQuery({ page: 1, limit: 10 }, { skip: !apiEnabled });
  const [updateWip] = useUpdateWipMutation();

  const [wipData, setWipData] = useState<WipRecord[]>(dummyWipData);

  const [editOpen, setEditOpen] = useState(false);
  const [editingWip, setEditingWip] = useState<WipRecord | null>(null);
  const [editForm] = Form.useForm<WipEditFormValues>();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingWip, setDeletingWip] = useState<WipRecord | null>(null);

  useEffect(() => {
    if (!apiEnabled || !listQuery.error) return;
    if (isMissingRouteError(listQuery.error)) {
      messageApi.warning("WIP API route is not available yet; showing mock data.");
      return;
    }
    messageApi.error(getApiErrorMessage(listQuery.error, "Failed to load WIP inventory"));
  }, [apiEnabled, listQuery.error, messageApi]);

  const mapApiRowToRecord = (row: WipListRow, index: number): WipRecord => {
    const fallbackId = `${row.wo_number ?? "-"}-${row.uniq ?? "-"}-${row.process ?? "-"}-${index}`;
    return {
      id: row.id ?? fallbackId,
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
    };
  };

  const tableRows = useMemo(() => {
    if (!apiEnabled || isMissingRouteError(listQuery.error)) return wipData;
    const items = listQuery.data?.data ?? [];
    if (!items.length) return [];
    return items.map(mapApiRowToRecord);
  }, [apiEnabled, listQuery.data, listQuery.error, wipData]);

  const openWipDetail = (record: WipRecord) => {
    const fromApi = apiEnabled && !isMissingRouteError(listQuery.error);
    if (fromApi) {
      if (!record.id) {
        messageApi.warning("WIP id is missing; cannot open detail.");
        return;
      }
      router.push(`/work-in-progress/detail?id=${encodeURIComponent(record.id)}&uniq=${encodeURIComponent(record.uniq)}`);
      return;
    }
    router.push(`/work-in-progress/detail?uniq=${encodeURIComponent(record.uniq)}`);
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

      const fromApi = apiEnabled && !isMissingRouteError(listQuery.error);
      if (fromApi && editingWip.apiId) {
        await updateWip({ id: editingWip.apiId, body: { status: nextStatus } }).unwrap();
        messageApi.success("Status updated");
        listQuery.refetch();
        closeEditDrawer();
        return;
      }

      setWipData((prev) => prev.map((row) => (row.id === editingWip.id ? { ...row, type: nextStatus } : row)));
      messageApi.success("Saved");
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
    if (apiEnabled && !isMissingRouteError(listQuery.error)) {
      messageApi.info("Delete WIP is not integrated for this page yet.");
      closeDeleteModal();
      return;
    }
    setWipData((prev) => prev.filter((row) => row.id !== deletingWip.id));
    if (editingWip?.id === deletingWip.id) {
      closeEditDrawer();
    }
    messageApi.success("Deleted");
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
        row.type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchValue.toLowerCase());

    const matchesProcess =
      processFilter === "all" || row.process === processFilter;

    return matchesSearch && matchesProcess;
  });

  const summaryStats = useMemo(() => {
    const totalQuantity = tableRows.reduce((sum, row) => sum + Number(row.stock ?? 0), 0);
    const activeStations = new Set(tableRows.map((r) => r.process).filter(Boolean)).size;
    return {
      activeWip: tableRows.length,
      totalQuantity,
      activeStations,
    };
  }, [tableRows]);

  const columns: ColumnType<WipRecord>[] = [
    {
      title: "Process",
      key: "process",
      width: 120,
      render: (_: unknown, record: WipRecord) => (
        <span className="inline-flex rounded-full bg-[#F1F5F9] px-3 py-1 text-xs text-gray-700">
          {record.process}
        </span>
      ),
    },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      width: 110,
    },
    {
      title: "Part Number",
      dataIndex: "partNumber",
      key: "partNumber",
      width: 130,
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
      title: "Kanban",
      key: "kanbanCode",
      width: 140,
      render: (_: unknown, record: WipRecord) => (
        <span className="inline-flex rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
          {record.kanbanCode}
        </span>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 140,
    },
    {
      title: "Stock to Complete Kanban",
      key: "stockToCompleteKanban",
      dataIndex: "stockToCompleteKanban",
      width: 120,
    },
    {
      title: "Kanban",
      dataIndex: "kanban",
      key: "kanban",
      width: 140,
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
    const values = new Set(tableRows.map((row) => row.process).filter(Boolean));
    return [{ label: "All Process", value: "all" }, ...Array.from(values).map((p) => ({ label: p, value: p }))];
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
          This will remove <span className="font-semibold">{deletingWip?.uniq}</span> from the list.
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
        <Form
          form={editForm}
          layout="vertical"
          requiredMark={false}
        >
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
          <div className="text-2xl font-semibold text-gray-900">Work In-Progress Database</div>
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
            <div className="text-lg font-semibold text-gray-900">Work In-Progress Database</div>
            <div className="text-sm text-gray-500">
              Track WIP by Uniq, Packing Number, Type and Process with real-time aging and station visibility
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
          title="Avg Aging"
          value="-"
          icon={<HiOutlineArchiveBox size={22} />}
          bgColor=""
          textColor="text-orange-600"
        />
        <StatsCard
          title="Active Stations"
          value={summaryStats.activeStations}
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
              WIP Tracking
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
              placeholder="Search by Uniq or Machine Name..."
              prefix={<SearchOutlined className="text-gray-400" />}
              className="max-w-[420px]"
              allowClear
            />

            <Button icon={<DownloadOutlined />} className="flex items-center gap-2">
              Export
            </Button>
          </div>

          <div className="h-px bg-gray-100" />

          {tab === "wip" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">
                  Real-time WIP Tracking
                </div>
                <Select
                  value={processFilter}
                  onChange={setProcessFilter}
                  style={{ width: 200 }}
                  options={processOptions}
                />
              </div>

              <div className="overflow-x-auto">
                <Table<WipRecord>
                  columns={columns}
                  dataSource={filteredData}
                  rowKey="id"
                  loading={apiEnabled ? listQuery.isFetching : false}
                  pagination={false}
                  bordered
                  scroll={{ x: "max-content" }}
                />
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-gray-500">No station data</div>
          )}
        </div>
      </div>
    </div>
  );
}
