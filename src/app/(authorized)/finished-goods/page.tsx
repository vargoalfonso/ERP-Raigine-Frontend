"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Drawer,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
} from "antd";
import {
  ScanOutlined,
  PlusOutlined,
  EyeOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import StatsCard from "@/components/StatsCard";
import TableTemplate from "@/components/TableTemplate";
import type { ColumnType } from "antd/es/table";
import { BsBoxSeam } from "react-icons/bs";
import { FiAlertTriangle } from "react-icons/fi";
import { HiOutlineArchiveBox } from "react-icons/hi2";
import { LuChartColumn } from "react-icons/lu";
import { IoLocationOutline } from "react-icons/io5";
import { FinishedGoodsRecord } from "@/lib/api/finished-goods/interface";
import { FaRegEdit, FaRegTrashAlt } from "react-icons/fa";
import StatsCardStatus from "@/components/StatsCardStatus";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  useDeleteMutation as useDeleteFinishedGoodsMutation,
  useGetAllQuery as useGetAllFinishedGoodsQuery,
  useUpdateMutation as useUpdateFinishedGoodsMutation,
} from "@/lib/api/finished-goods/api";

function getStockStatus(record: FinishedGoodsRecord):
  | "low"
  | "overstock"
  | "normal" {
  const current = record.current_stock ?? 0;
  const threshold = record.master_list?.threshold_kanban ?? 0;
  const totalKanban = record.total_kanban ?? 0;

  if (current < threshold) return "low";
  if (totalKanban > 0 && current > totalKanban) return "overstock";
  return "normal";
}

function getStatusTagConfig(status: "low" | "overstock" | "normal") {
  switch (status) {
    case "low":
      return { color: "red", icon: <AlertOutlined />, label: "Low" } as const;
    case "overstock":
      return {
        color: "orange",
        icon: <WarningOutlined />,
        label: "Overstock",
      } as const;
    case "normal":
    default:
      return { color: "green", icon: <CheckCircleOutlined />, label: "Normal" } as const;
  }
}

function clampPercent(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function FinishedGoodsDetailModal({
  open,
  record,
  onClose,
}: {
  open: boolean;
  record: FinishedGoodsRecord | null;
  onClose: () => void;
}) {
  const uniq = record?.master_list?.uniq_code ?? "-";
  const partNumber = record?.master_list?.part_no ?? "-";
  const partName = record?.master_list?.part_name ?? "-";
  const model = record?.master_list?.model ?? "-";
  const woNumber = record?.work_order?.wo_number ?? "-";
  const warehouse = record?.warehouse?.code ?? "-";
  const currentStock = record?.current_stock ?? 0;
  const targetKanban = record?.target_stock ?? 0;
  const stockToComplete = record?.stock_to_complete ?? 0;
  const minThreshold = record?.master_list?.threshold_kanban ?? 0;
  const maxThreshold = record?.total_kanban ?? 0;

  const progress = clampPercent(
    targetKanban > 0 ? (currentStock / targetKanban) * 100 : 0
  );

  const stockStatus = record ? getStockStatus(record) : "normal";
  const tagCfg = getStatusTagConfig(stockStatus);
  const lastUpdated = record?.updated_at
    ? new Date(record.updated_at).toLocaleString()
    : "-";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={920}
      title={
        <div>
          <div className="text-lg font-semibold text-gray-900">
            Finished Goods Details
          </div>
          <div className="text-sm text-gray-500">
            Complete information for finished goods item
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Product UNIQ</div>
              <div className="text-lg font-semibold text-gray-900">{uniq}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Part Number</div>
              <div className="text-lg font-semibold text-gray-900">{partNumber}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <div className="mt-1">
                <Tag color={tagCfg.color}>{tagCfg.label}</Tag>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="text-lg font-semibold text-gray-900 mb-4">
            Product Information
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Part Name</div>
              <div className="font-semibold text-gray-900">{partName}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Model</div>
              <div className="font-semibold text-gray-900">{model}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Work Order Number</div>
              <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800">
                {woNumber}
              </span>
            </div>
            <div>
              <div className="text-sm text-gray-600">Warehouse Location</div>
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <IoLocationOutline size={18} className="text-gray-500" />
                {warehouse}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="text-lg font-semibold text-gray-900 mb-4">
            Stock & Kanban Information
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Current Stock</div>
              <div className="text-3xl font-bold text-blue-600">
                {currentStock}
              </div>
              <div className="text-sm text-gray-500">units available</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Target Kanban</div>
              <div className="text-3xl font-bold text-gray-900">
                {targetKanban}
              </div>
              <div className="text-sm text-gray-500">target quantity</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Stock to Complete</div>
              <div className="text-3xl font-bold text-orange-600">
                {stockToComplete}
              </div>
              <div className="text-sm text-gray-500">more needed</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700 font-medium">
                Kanban Progress
              </div>
              <div className="text-sm text-gray-700 font-medium">{progress}%</div>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
              <div>{Math.floor(currentStock / 25)} Kanban Complete</div>
              <div>
                {currentStock} / {targetKanban}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-sm text-gray-600">Min Threshold</div>
              <div className="text-2xl font-bold text-gray-900">
                {minThreshold}
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-sm text-gray-600">Max Threshold</div>
              <div className="text-2xl font-bold text-gray-900">
                {maxThreshold}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="text-lg font-semibold text-gray-900 mb-4">
            Activity Timeline
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="mt-2 h-2 w-2 rounded-full bg-green-600" />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Last Updated
                </div>
                <div className="text-sm text-gray-600">{lastUpdated}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-2 h-2 w-2 rounded-full bg-blue-600" />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Kanban Status
                </div>
                <div className="text-sm text-gray-600">
                  {Math.floor(currentStock / 25)} kanban complete, {stockToComplete} units needed for next kanban
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-2 h-2 w-2 rounded-full bg-orange-600" />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Current Status
                </div>
                <div className="text-sm text-gray-600">
                  {tagCfg.label === "Low"
                    ? "Low stock alert - Schedule production immediately"
                    : tagCfg.label === "Overstock"
                      ? "Overstock - Hold production and review demand"
                      : "Stock level normal"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const dummyInventoryData: FinishedGoodsRecord[] = [
  {
    id: "1",
    master_list: {
      id: "1",
      part_name: "Engine Mount Assembly",
      uniq_code: "LV7-001",
      model: "EM-2024",
      threshold_kanban: 100,
    },
    work_order: {
      id: "1",
      wo_number: "WO-2024-001",
    },
    warehouse: {
      id: "1",
      code: "WH-01",
    },
    current_stock: 80,
    target_stock: 120,
    stock_to_complete: 40,
    total_kanban: 150,
    quality_status: "Medium",
    updated_at: "2025-09-25T10:30:00Z",
  },
  {
    id: "2",
    master_list: {
      id: "2",
      part_name: "Transmission Case",
      uniq_code: "TRC-002",
      model: "TC-2024",
      threshold_kanban: 50,
    },
    work_order: {
      id: "2",
      wo_number: "WO-2024-002",
    },
    warehouse: {
      id: "2",
      code: "WH-02",
    },
    current_stock: 60,
    target_stock: 80,
    stock_to_complete: 20,
    total_kanban: 90,
    quality_status: "High",
    updated_at: "2025-09-25T11:00:00Z",
  },
];

const dummyStatusData: FinishedGoodsRecord[] = [
  {
    id: "3",
    master_list: {
      id: "1",
      part_name: "Engine Mount Assembly",
      uniq_code: "LV7-001",
      model: "EM-2024",
      threshold_kanban: 100,
    },
    work_order: {
      id: "1",
      wo_number: "WO-2024-001",
    },
    warehouse: {
      id: "1",
      code: "WH-01",
    },
    current_stock: 80,
    target_stock: 120,
    stock_to_complete: 40,
    total_kanban: 150,
    quality_status: "Low",
    updated_at: "2025-09-25T10:30:00Z",
  },
];

export default function FinishedGoodsPage() {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tab, setTab] = useState("inventory");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<FinishedGoodsRecord[]>([]);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<FinishedGoodsRecord | null>(null);
  const [statusDetailOpen, setStatusDetailOpen] = useState(false);
  const [statusDetailRecord, setStatusDetailRecord] =
    useState<FinishedGoodsRecord | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] =
    useState<FinishedGoodsRecord | null>(null);
  const [form] = Form.useForm();

  const useApi = Boolean(apiBaseUrl);
  const {
    data: finishedGoodsResponse,
    isFetching: finishedGoodsFetching,
    isSuccess: finishedGoodsSuccess,
    refetch: refetchFinishedGoods,
  } = useGetAllFinishedGoodsQuery(
    { currentPage, pageSize },
    { skip: !useApi }
  );
  const [updateFinishedGood] = useUpdateFinishedGoodsMutation();
  const [deleteFinishedGood] = useDeleteFinishedGoodsMutation();

  const apiFinishedGoods = useMemo(() => {
    if (!useApi || !finishedGoodsSuccess) return null;
    return finishedGoodsResponse?.data ?? [];
  }, [finishedGoodsResponse?.data, finishedGoodsSuccess, useApi]);

  const displayedRows = useMemo(() => {
    if (apiFinishedGoods) return apiFinishedGoods;
    return tab === "inventory" ? dummyInventoryData : dummyStatusData;
  }, [apiFinishedGoods, tab]);

  const totalRows =
    apiFinishedGoods && finishedGoodsResponse?.pagination?.total != null
      ? finishedGoodsResponse.pagination.total
      : displayedRows.length;

  const loading = useApi ? finishedGoodsFetching : false;

  const openStatusDetail = (record: FinishedGoodsRecord) => {
    setStatusDetailRecord(record);
    setStatusDetailOpen(true);
  };

  const closeStatusDetail = () => {
    setStatusDetailOpen(false);
    setStatusDetailRecord(null);
  };

  // Handle row selection
  const handleRowSelection = {
    selectedRowKeys,
    onChange: (
      selectedRowKeys: React.Key[],
      selectedRows: FinishedGoodsRecord[]
    ) => {
      setSelectedRowKeys(selectedRowKeys);
      setSelectedRows(selectedRows);

      // Don't automatically show modal, we're using the bottom bar instead
      // The bottom bar will automatically show/hide based on selectedRows.length
    },
  };

  const handleCloseModal = () => {
    setSelectedRowKeys([]);
    setSelectedRows([]);
  };

  // --- Edit Drawer Functions ---
  const openEditDrawer = (record: FinishedGoodsRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      uniq_code: record.master_list?.uniq_code,
      warehouse: record.warehouse?.code,
      current_stock: record.current_stock,
    });
    setEditDrawerOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      if (!editingRecord) return;

      if (useApi && finishedGoodsSuccess) {
        await updateFinishedGood({
          id: editingRecord.id,
          body: {
            current_stock: Number(values.current_stock ?? editingRecord.current_stock ?? 0),
          },
        }).unwrap();
        await refetchFinishedGoods();
      }

      setEditDrawerOpen(false);
    } catch (error) {
      console.log("Validation failed:", error);
    }
  };

  // --- Delete Modal Functions ---
  const openDeleteModal = (record: FinishedGoodsRecord) => {
    setDeletingRecord(record);
    setDeleteModalOpen(true);
  };
  const handleConfirmDelete = () => {
    (async () => {
      if (!deletingRecord) return;
      try {
        if (useApi && finishedGoodsSuccess) {
          await deleteFinishedGood({ id: deletingRecord.id }).unwrap();
          await refetchFinishedGoods();
        }
        setDeleteModalOpen(false);
        setDeletingRecord(null);
      } catch {
        setDeleteModalOpen(false);
      }
    })();
  };
  const columns: ColumnType<FinishedGoodsRecord>[] = [
    {
      title: "Product Info",
      key: "productInfo",
      width: 250,
      render: (record: FinishedGoodsRecord) => (
        <div>
          <div className="font-semibold text-gray-900">
            {record.master_list?.part_name}
          </div>
          <div className="text-sm text-gray-500">
            {record.master_list?.uniq_code}
          </div>
          <div className="text-xs text-gray-400">
            {record.master_list?.model}
          </div>
        </div>
      ),
    },
    {
      title: "WO Number",
      key: "workOrder",
      width: 200,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => (
        <span className="border px-2  rounded-lg border-gray-300">
          {record.work_order?.wo_number}
        </span>
      ),
    },
    {
      title: "Warehouse",
      key: "warehouse",
      width: 100,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => (
        <div className="flex items-center gap-1">
          <div className="text-gray-400 ">
            <IoLocationOutline size={20} />
          </div>
          <span className="text-sm text-gray-600 bg-[#FAFBFC] px-2">
            {record.warehouse?.code}
          </span>
        </div>
      ),
    },

    {
      title: "Current Stock",
      key: "currentStock",
      width: 120,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => (
        <div>
          <div className="text-lg font-semibold">{record.current_stock}</div>
          <div className="text-xs text-gray-500">
            Target: {record.target_stock}
          </div>
        </div>
      ),
    },
    {
      title: "Kanban Status",
      key: "kanbanStatus",
      width: 120,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => (
        <div>
          <div className="text-sm font-semibold">
            {record.current_stock} Kanban
          </div>
          <div className="text-xs text-gray-500">
            Need: {record.stock_to_complete} more
          </div>
        </div>
      ),
    },
    {
      title: "Stock Status",
      key: "stockStatus",
      width: 120,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => {
        const status = getStockStatus(record);
        const config = getStatusTagConfig(status);

        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "Last Updated",
      key: "lastUpdated",
      width: 140,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => (
        <span className="text-sm text-gray-600">
          {record.updated_at
            ? new Date(record.updated_at).toLocaleString()
            : "-"}
        </span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: FinishedGoodsRecord) => (
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => router.push(`/finished-goods/detail?id=${record.id}`)}
            className="text-blue-600 hover:text-blue-800"
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
        </div>
      ),
    },
  ];
  const columnsStatus: ColumnType<FinishedGoodsRecord>[] = [
    {
      title: "Alert Type",
      key: "alertType",
      width: 250,
      render: (record: FinishedGoodsRecord) => (
        <div>
          <div className="font-semibold text-gray-900">
            {record.quality_status}
          </div>
        </div>
      ),
    },
    {
      title: "Product",
      key: "product",
      width: 200,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => (
        <div className="">
          {record.master_list?.part_name}
          <div className="text-gray-600">{record.master_list?.uniq_code}</div>
        </div>
      ),
    },
    {
      title: "Current Stock",
      key: "currentStock",
      width: 100,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => (
        <span className="text-sm text-gray-600 bg-[#FAFBFC] px-2">
          {record.warehouse?.code}
        </span>
      ),
    },
    {
      title: "Threshold",
      key: "threshold",
      width: 120,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => (
        <div className="text-lg font-semibold">{record.current_stock}</div>
      ),
    },
    {
      title: "Recomendation",
      key: "recomendation",
      width: 120,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => (
        <div className="text-sm font-semibold">
          {record.current_stock} Kanban
        </div>
      ),
    },
    {
      title: "Priority",
      key: "priority",
      width: 120,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => {
        const status = getStockStatus(record);
        const config = getStatusTagConfig(status);

        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "Created",
      key: "created",
      width: 140,
      render: (_: FinishedGoodsRecord, record: FinishedGoodsRecord) => (
        <span className="text-sm text-gray-600">
          {record.updated_at
            ? new Date(record.updated_at).toLocaleString()
            : "-"}
        </span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: FinishedGoodsRecord) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          size="small"
          className="text-blue-600 hover:text-blue-800"
          onClick={() => openStatusDetail(record)}
        />
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <FinishedGoodsDetailModal
        open={statusDetailOpen}
        record={statusDetailRecord}
        onClose={closeStatusDetail}
      />
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Finished Goods Database
          </h1>
          <p className="text-gray-600">
            Track FG by Uniq, linked to WO and warehouse location with real-time
            status flagging
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<ScanOutlined />} className="flex items-center gap-2">
            Scan FG
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="flex items-center gap-2"
            onClick={() => router.push("/finished-goods/create")}
          >
            Add FG
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total FG Items"
          value={2}
          icon={<BsBoxSeam size={30} />}
          bgColor=""
          textColor="text-blue-600"
        />
        <StatsCard
          title="Low Stock Items"
          value="1"
          icon={<FiAlertTriangle size={30} />}
          bgColor=""
          textColor="text-red-600"
        />
        <StatsCard
          title="Total Stock"
          value="1,150"
          icon={<HiOutlineArchiveBox size={30} />}
          bgColor=""
          textColor="text-green-600"
        />
        <StatsCard
          title="Active Alerts"
          value="3"
          icon={<LuChartColumn size={30} />}
          bgColor=""
          textColor="text-orange-600"
        />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4  border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 p-[2px] bg-[#F1F5F9] rounded-lg">
            <div
              onClick={() => setTab("inventory")}
              className={`${
                tab === "inventory" ? "bg-white" : ""
              } rounded-xl text-center p-1`}
            >
              FG Inventory
            </div>
            <div
              onClick={() => {
                setTab("status");
                setSelectedRowKeys([]);
                setSelectedRows([]);
              }}
              className={`${
                tab === "status" ? "bg-white" : ""
              } rounded-xl text-center p-1`}
            >
              Status Monitoring
            </div>
          </div>
        </div>
        {tab === "status" && (
          <>
            <div className="px-6 pb-4 text-xl">Status Monitoring & Alerts</div>
            <div className="pb-4 px-6 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="flex justify-center">
                <StatsCardStatus
                  title="Low Stock Items"
                  value={2}
                  icon={<FiAlertTriangle size={40} />}
                  textColor="text-red-600"
                  borderColor="border-red-600"
                />
              </div>
              <div className="flex justify-center">
                <StatsCardStatus
                  title="Total FG Items"
                  value={2}
                  icon={<BsBoxSeam size={40} />}
                  textColor="text-yellow-600"
                  borderColor="border-yellow-600"
                />
              </div>
              <div className="flex justify-center">
                <StatsCardStatus
                  title="Total Stock"
                  value={2}
                  icon={<HiOutlineArchiveBox size={40} />}
                  textColor="text-green-600"
                  borderColor="border-green-600"
                />
              </div>
            </div>
          </>
        )}

        <div className="p-6">
          <TableTemplate
            columns={tab === "inventory" ? columns : columnsStatus}
            data={displayedRows}
            rowKey="id"
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="Search finished goods..."
            pageSize={pageSize}
            currentPage={currentPage}
            total={totalRows}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            loading={loading}
            rowSelection={tab === "inventory" ? handleRowSelection : undefined}
          />
        </div>
      </div>

      {/* Selection Bar - Fixed Bottom Center */}
      {selectedRows.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-3 px-6 w-[1000px] max-w-[500px]">
            <div className="flex items-center justify-between">
              {/* Left side - Close button and count */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center text-sm"
                >
                  ✕
                </button>
                <span className="text-gray-700 font-medium">
                  {selectedRows.length} data selected
                </span>
              </div>

              {/* Right side - Action buttons */}
              <div className="flex items-center gap-3">
                <Button
                  type="primary"
                  icon={<FaRegEdit />}
                  className="bg-blue-500 hover:bg-blue-600 flex items-center gap-2 border-0"
                  size="middle"
                  onClick={() => {
                    // Handle bulk edit
                    console.log("Bulk edit selected items:", selectedRows);
                  }}
                >
                  Bulk Edit
                </Button>

                <Button
                  danger
                  icon={<FaRegTrashAlt />}
                  className="flex items-center gap-2"
                  size="middle"
                  type="primary"
                  onClick={() => {
                    // Handle delete
                    console.log("Delete selected items:", selectedRows);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit Drawer */}
      <Drawer
        title={`Edit Finished Good: ${editingRecord?.master_list?.part_name}`}
        width={400}
        onClose={() => setEditDrawerOpen(false)}
        open={editDrawerOpen}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSaveEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Uniq Code"
            name="uniq_code"
            rules={[{ required: true, message: "Please input Uniq Code!" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Warehouse Destination"
            name="warehouse"
            rules={[{ required: true, message: "Please select warehouse!" }]}
          >
            <Select>
              <Select.Option value="WH-01">WH-01</Select.Option>
              <Select.Option value="WH-02">WH-02</Select.Option>
              <Select.Option value="WH-03">WH-03</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="Current Stock"
            name="current_stock"
            rules={[{ required: true, message: "Please input current stock!" }]}
          >
            <InputNumber min={0} className="w-full" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Delete Modal */}
      <Modal
        title="Delete Finished Good"
        open={deleteModalOpen}
        onOk={handleConfirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
        okText="Yes"
        cancelText="No"
        okButtonProps={{ danger: true }}
      >
        <p>
          Are you sure you want to delete Product for{" "}
          <strong>{deletingRecord?.master_list?.part_name}</strong>? This action
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
