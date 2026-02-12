"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Tag,
  message,
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
import dayjs from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex, type BomUniqIndex } from "@/lib/utils/bomUniq";
import {
  useDeleteScrapStockMutation,
  useGetAllScrapStockQuery,
  useUpdateScrapStockMutation,
} from "@/lib/api/scrap-stock/api";
import type { BackendScrapStock } from "@/lib/api/scrap-stock/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetTypeParametersQuery } from "@/lib/api/system-settings/api";

// Scrap record type and dummy data matching the scrap stock table
type ScrapRecord = {
  id: string;
  uniq: string;
  part_number: string;
  part_info: { name: string; model?: string };
  date_received: string;
  packing_number: string;
  scrap_type: string;
  reasons: string;
  quantity: number;
};

const toScrapRecord = (item: BackendScrapStock, bomIndex?: BomUniqIndex): ScrapRecord => {
  const uniq = item.uniq ?? "-";
  const bomPartName = uniq !== "-" ? bomIndex?.partNameByUniq[uniq] : undefined;
  const bomPartNumber = uniq !== "-" ? bomIndex?.partNumberByUniq[uniq] : undefined;
  const bomAssemblyCode = uniq !== "-" ? bomIndex?.assemblyCodeByUniq[uniq] : undefined;

  return {
    id: item.id,
    uniq,
    part_number: bomPartNumber ?? item.part_number ?? "-",
    part_info: {
      name: bomPartName ?? item.item_name ?? "-",
      model: bomAssemblyCode,
    },
    date_received: item.date_received ?? item.created_at ?? "-",
    packing_number: item.packing_number ?? "-",
    scrap_type: item.scrap_type ?? "-",
    reasons: item.reasons ?? "-",
    quantity: typeof item.quantity === "number" ? item.quantity : (item.scrap_qty ?? 0),
  };
};

const dummyScrapData: ScrapRecord[] = [
  {
    id: "LV7-001",
    uniq: "LV7-001",
    part_number: "EMA-001",
    part_info: { name: "Engine Mount Assembly", model: "Camry 2024" },
    date_received: "2024-01-15",
    packing_number: "KBN-001-2024",
    scrap_type: "Setting Machine Scrap",
    reasons: "Dump",
    quantity: 50,
  },
  {
    id: "LV8-002",
    uniq: "LV8-002",
    part_number: "SPA-001",
    part_info: { name: "Suspension Arm", model: "Camry 2024" },
    date_received: "2024-01-15",
    packing_number: "KBN-002-2024",
    scrap_type: "Process Scrap",
    reasons: "Inventory",
    quantity: 23,
  },
  {
    id: "LW0-003",
    uniq: "LW0-003",
    part_number: "BRC-001",
    part_info: { name: "Brake Caliper", model: "Camry 2024" },
    date_received: "2024-01-15",
    packing_number: "KBN-003-2024",
    scrap_type: "Process Scrap",
    reasons: "Inventory",
    quantity: 50,
  },
  {
    id: "MB6-004",
    uniq: "MB6-004",
    part_number: "COM-001",
    part_info: { name: "Control Module", model: "Camry 2024" },
    date_received: "2024-01-15",
    packing_number: "KBN-004-2024",
    scrap_type: "Product Return Scrap",
    reasons: "Sell",
    quantity: 50,
  },
];

const makeScrapColumns = (actions: {
  onEdit: (record: ScrapRecord) => void;
  onView: (record: ScrapRecord) => void;
  onDelete: (record: ScrapRecord) => void;
}): ColumnType<ScrapRecord>[] => [
  {
    title: "Uniq",
    key: "uniq",
    width: 120,
    render: (record: ScrapRecord) => (
      <div className="text-sm text-gray-700">{record.uniq}</div>
    ),
  },
  {
    title: "Part Number",
    key: "partNumber",
    width: 140,
    render: (record: ScrapRecord) => (
      <div className="font-semibold">{record.part_number}</div>
    ),
  },
  {
    title: "Part Info",
    key: "partInfo",
    width: 300,
    render: (record: ScrapRecord) => (
      <div>
        <div className="font-semibold text-gray-900">{record.part_info.name}</div>
        <div className="text-sm text-gray-500">{record.part_number}</div>
        <div className="text-xs text-gray-400">{record.part_info.model}</div>
      </div>
    ),
  },
  {
    title: "Date Received",
    key: "dateReceived",
    width: 140,
    render: (record: ScrapRecord) => (
      <div className="text-sm text-gray-600">{record.date_received}</div>
    ),
  },
  {
    title: "Packing Number",
    key: "packingNumber",
    width: 160,
    render: (record: ScrapRecord) => (
      <div className="text-sm text-gray-600">{record.packing_number}</div>
    ),
  },
  {
    title: "Scrap Type",
    key: "scrapType",
    width: 180,
    render: (record: ScrapRecord) => (
      <Tag color={record.scrap_type.includes("Product") ? "blue" : "geekblue"}>
        {record.scrap_type}
      </Tag>
    ),
  },
  {
    title: "Reasons",
    key: "reasons",
    width: 120,
    render: (record: ScrapRecord) => (
      <Tag color={record.reasons === "Dump" ? "red" : "default"}>{record.reasons}</Tag>
    ),
  },
  {
    title: "Quantity",
    key: "quantity",
    width: 100,
    render: (record: ScrapRecord) => (
      <div className="text-lg font-semibold">{record.quantity}</div>
    ),
  },
  {
    title: "Actions",
    key: "actions",
    width: 100,
    render: (_: unknown, record: ScrapRecord) => (
      <div className="flex items-center gap-2">
        <Button
          type="text"
          icon={<EyeOutlined />}
          size="small"
          className="text-blue-600 hover:text-blue-800"
          onClick={() => actions.onView(record)}
        />
        <Button
          type="text"
          icon={<FaRegEdit />}
          size="small"
          className="text-green-600 hover:text-green-800"
          onClick={() => actions.onEdit(record)}
        />
        <Button
          type="text"
          icon={<FaRegTrashAlt color="red" />}
          size="small"
          className="text-red-600 hover:text-gray-800"
          onClick={() => actions.onDelete(record)}
        />
      </div>
    ),
  },
];

type ScrapEditFormValues = {
  uniq?: string;
  date_received?: dayjs.Dayjs;
  packing_number?: string;
  scrap_quantity?: number;
  scrap_type?: string;
  validator?: string;
  quantity?: number;
  weight?: number;
  unit_measurement?: string;
};

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
      wo_number: "WO-110226-001",
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
      wo_number: "WO-110226-002",
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
      wo_number: "WO-110226-001",
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

export default function ScrapStockPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [searchValue, setSearchValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tab, setTab] = useState("scrap");

  const useApi = Boolean(apiBaseUrl);
  const { data: typeParams } = useGetTypeParametersQuery(undefined, {
    skip: !useApi,
    refetchOnMountOrArgChange: true,
  });
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, { skip: !useApi });
  const bomUniqIndex = useMemo(() => buildBomUniqIndex(bomTreeRes?.data ?? []), [bomTreeRes?.data]);
  const uniqOptions = useMemo(() => {
    const idx = bomUniqIndex;
    return idx.options.length
      ? idx.options
      : [
          { label: "LV-001", value: "LV-001" },
          { label: "LV-002", value: "LV-002" },
          { label: "LV-003", value: "LV-003" },
        ];
  }, [bomUniqIndex]);

  const scrapTypeOptions = useMemo(() => {
    const fallback = [
      { label: "Setting Machine Scrap", value: "Setting Machine Scrap" },
      { label: "Process Scrap", value: "Process Scrap" },
      { label: "Product Return Scrap", value: "Product Return Scrap" },
    ];

    if (!useApi) return fallback;

    const candidates = (typeParams ?? [])
      .filter((p) => String(p?.status ?? "").toLowerCase() !== "inactive")
      .filter((p) => {
        const code = String(p?.type_code ?? "").trim().toLowerCase();
        const name = String(p?.type_name ?? "").trim().toLowerCase();
        return code.startsWith("scrap") || name.includes("scrap");
      })
      .map((p) => String(p?.type_name ?? p?.type_code ?? "").trim())
      .filter(Boolean);

    const uniq = Array.from(new Set(candidates)).sort((a, b) => a.localeCompare(b));
    if (uniq.length === 0) return fallback;
    return uniq.map((v) => ({ label: v, value: v }));
  }, [typeParams, useApi]);

  const [localScrapData, setLocalScrapData] = useState<ScrapRecord[]>(dummyScrapData);

  const {
    data: scrapRes,
    isFetching: isScrapFetching,
    refetch: refetchScrap,
  } = useGetAllScrapStockQuery(
    { currentPage, pageSize },
    { skip: !useApi || tab !== "scrap" }
  );

  const [deleteScrapStock, { isLoading: isDeleting }] = useDeleteScrapStockMutation();
  const [updateScrapStock, { isLoading: isUpdating }] = useUpdateScrapStockMutation();

  const scrapData = useMemo(() => {
    if (!useApi) return localScrapData;
    const items = scrapRes?.data ?? [];
    return items.map((i) => toScrapRecord(i, bomUniqIndex));
  }, [bomUniqIndex, localScrapData, scrapRes?.data, useApi]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingScrap, setDeletingScrap] = useState<ScrapRecord | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingScrap, setEditingScrap] = useState<ScrapRecord | null>(null);
  const [editForm] = Form.useForm<ScrapEditFormValues>();

  const openEditDrawer = (record: ScrapRecord) => {
    setEditingScrap(record);
    editForm.setFieldsValue({
      uniq: record.uniq,
      date_received: record.date_received ? dayjs(record.date_received) : undefined,
      packing_number: record.packing_number,
      scrap_quantity: record.quantity,
      scrap_type: record.scrap_type,
      validator: "John Mejer",
      quantity: record.quantity,
    });
    setEditOpen(true);
  };

  const closeEditDrawer = () => {
    setEditOpen(false);
    setEditingScrap(null);
    editForm.resetFields();
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();

      if (useApi && editingScrap?.id) {
        await updateScrapStock({
          id: editingScrap.id,
          body: {
            uniq: values.uniq,
            packing_number: values.packing_number,
            date_received: values.date_received ? values.date_received.format("YYYY-MM-DD") : undefined,
            scrap_type: values.scrap_type,
            scrap_qty: values.scrap_quantity,
            validator: values.validator,
            quantity: values.quantity,
            weight: values.weight,
            unit_measurement: values.unit_measurement,
          },
        }).unwrap();
        await refetchScrap();
      } else if (!useApi && editingScrap?.id) {
        setLocalScrapData((prev) =>
          prev.map((item) =>
            item.id !== editingScrap.id
              ? item
              : {
                  ...item,
                  uniq: values.uniq ?? item.uniq,
                  date_received: values.date_received
                    ? values.date_received.format("YYYY-MM-DD")
                    : item.date_received,
                  packing_number: values.packing_number ?? item.packing_number,
                  scrap_type: values.scrap_type ?? item.scrap_type,
                  quantity: typeof values.quantity === "number" ? values.quantity : item.quantity,
                  reasons: item.reasons,
                }
          )
        );
      }

      messageApi.success("Saved");
      closeEditDrawer();
    } catch {
      // validation errors shown by antd
    }
  };

  const openScrapDetail = (record: ScrapRecord) => {
    router.push(`/scrap-stock/detail?id=${encodeURIComponent(record.id)}`);
  };

  const openDeleteModal = (record: ScrapRecord) => {
    setDeletingScrap(record);
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteOpen(false);
    setDeletingScrap(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingScrap) return;

    try {
      if (useApi) {
        await deleteScrapStock(deletingScrap.id).unwrap();
        await refetchScrap();
      } else {
        setLocalScrapData((prev) => prev.filter((item) => item.id !== deletingScrap.id));
      }

      if (editingScrap?.id === deletingScrap.id) {
        closeEditDrawer();
      }

      messageApi.success("Deleted");
      closeDeleteModal();
    } catch (err: unknown) {
      messageApi.error(getApiErrorMessage(err, "Failed to delete"));
    }
  };

  const scrapColumns = makeScrapColumns({
    onEdit: (record) => openEditDrawer(record),
    onView: (record) => openScrapDetail(record),
    onDelete: (record) => openDeleteModal(record),
  });

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
        let status = "normal";
        if (
          record?.current_stock ||
          0 < (record.master_list?.threshold_kanban ?? 0)
        )
          status = "low";
        if ((record?.current_stock ?? 0) > (record.total_kanban ?? 0))
          status = "overstock";

        const getStatusConfig = (status: string) => {
          switch (status) {
            case "low":
              return { color: "red", icon: <AlertOutlined /> };
            case "overstock":
              return { color: "orange", icon: <WarningOutlined /> };
            case "normal":
            default:
              return { color: "green", icon: <CheckCircleOutlined /> };
          }
        };

        const config = getStatusConfig(status);

        return (
          <Tag color={config.color} icon={config.icon}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
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
      render: () => (
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            className="text-blue-600 hover:text-blue-800"
          />
          <Button
            type="text"
            icon={<FaRegEdit />}
            size="small"
            className="text-green-600 hover:text-green-800"
          />
          <Button
            type="text"
            icon={<FaRegTrashAlt color="red" />}
            size="small"
            className="text-red-600 hover:text-gray-800"
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
        let status = "normal";
        if (
          (record.current_stock ?? 0) <
          (record.master_list?.threshold_kanban ?? 0)
        )
          status = "low";
        if ((record.current_stock ?? 0) > (record.total_kanban ?? 0))
          status = "overstock";

        const getStatusConfig = (status: string) => {
          switch (status) {
            case "low":
              return { color: "red", icon: <AlertOutlined /> };
            case "overstock":
              return { color: "orange", icon: <WarningOutlined /> };
            case "normal":
            default:
              return { color: "green", icon: <CheckCircleOutlined /> };
          }
        };

        const config = getStatusConfig(status);

        return (
          <Tag color={config.color} icon={config.icon}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
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
      render: () => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          size="small"
          className="text-blue-600 hover:text-blue-800"
        />
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {contextHolder}

      <Modal
        title="Delete scrap item?"
        open={deleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        confirmLoading={isDeleting}
        onOk={handleConfirmDelete}
        onCancel={closeDeleteModal}
      >
        <p>
          This will remove <span className="font-semibold">{deletingScrap?.uniq}</span> from the list.
        </p>
      </Modal>

      <Drawer
        title={<div className="font-semibold">Edit</div>}
        placement="right"
        width={380}
        open={editOpen}
        onClose={closeEditDrawer}
        closeIcon={<span className="text-gray-500">×</span>}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button onClick={closeEditDrawer}>Cancel</Button>
            <Button type="primary" onClick={handleSaveEdit} loading={isUpdating}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={editForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Uniq"
            name="uniq"
            rules={[{ required: true, message: "Uniq is required" }]}
          >
            <Select
              placeholder="Select Uniq"
              showSearch
              options={uniqOptions}
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="Date Received"
            name="date_received"
            rules={[{ required: true, message: "Date Received is required" }]}
          >
            <DatePicker
              className="w-full"
              showTime
              format="MM/DD/YYYY, HH:mm"
              placeholder="mm/dd/yyyy, --:--"
            />
          </Form.Item>

          <Form.Item
            label="Packing Number"
            name="packing_number"
            rules={[{ required: true, message: "Packing Number is required" }]}
          >
            <Input placeholder="Packing Number" />
          </Form.Item>

          <Form.Item
            label="Scrap Quantity"
            name="scrap_quantity"
            rules={[{ required: true, message: "Scrap Quantity is required" }]}
          >
            <InputNumber className="w-full" min={0} placeholder="250" />
          </Form.Item>

          <Form.Item
            label="Scrap Type"
            name="scrap_type"
            rules={[{ required: true, message: "Scrap Type is required" }]}
          >
            <Select
              placeholder="Select Scrap Type"
              options={scrapTypeOptions}
            />
          </Form.Item>

          <Form.Item
            label="Validator"
            name="validator"
            rules={[{ required: true, message: "Validator is required" }]}
          >
            <Select
              placeholder="Select Validator"
              options={[
                { label: "John Mejer", value: "John Mejer" },
                { label: "QC Inspector A", value: "QC Inspector A" },
                { label: "Operator John", value: "Operator John" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Weight" name="weight">
            <InputNumber className="w-full" min={0} placeholder="10" />
          </Form.Item>

          <Form.Item label="Unit Measurement" name="unit_measurement">
            <Select
              placeholder="Select unit"
              options={[
                { label: "pcs", value: "pcs" },
                { label: "kg", value: "kg" },
                { label: "box", value: "box" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Quantity"
            name="quantity"
            rules={[{ required: true, message: "Quantity is required" }]}
          >
            <InputNumber className="w-full" min={0} placeholder="5" />
          </Form.Item>
        </Form>
      </Drawer>
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Scrap Stock Database
          </h1>
          <p className="text-gray-600">
            Hold defective quantities not repairable and trace back to WO/QC
            causes with root cause analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<ScanOutlined />} className="flex items-center gap-2">
            Scan Scrap
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="flex items-center gap-2"
            onClick={() => router.push("/scrap-stock/create")}
          >
            Add Scrap
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Scrap Items"
          value={2}
          icon={<BsBoxSeam size={30} />}
          bgColor=""
          textColor="text-blue-600"
        />
        <StatsCard
          title="Total Scrap Qty"
          value="1"
          icon={<FiAlertTriangle size={30} />}
          bgColor=""
          textColor="text-red-600"
        />
        <StatsCard
          title="Total Cost"
          value="1,150"
          icon={<HiOutlineArchiveBox size={30} />}
          bgColor=""
          textColor="text-green-600"
        />
        <StatsCard
          title="Active Cases"
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
              onClick={() => setTab("scrap")}
              className={`${
                tab === "scrap" ? "bg-white" : ""
              } rounded-xl text-center p-1`}
            >
              Scrap Database
            </div>
            <div
              onClick={() => setTab("incoming")}
              className={`${
                tab === "incoming" ? "bg-white" : ""
              } rounded-xl text-center p-1`}
            >
              Incoming Scrap
            </div>
          </div>
        </div>

        <div className="p-6">
          <TableTemplate
            columns={
              (tab === "scrap"
                ? scrapColumns
                : columnsStatus) as unknown as (ColumnType<FinishedGoodsRecord> & {
                sortFieldKey?: string;
              })[]
            }
            data={
              (tab === "scrap"
                ? scrapData
                : dummyStatusData) as unknown as FinishedGoodsRecord[]
            }
            rowKey="id"
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="Search scrap..."
            pageSize={pageSize}
            currentPage={currentPage}
            total={tab === "scrap" ? scrapData.length : dummyStatusData.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            loading={isScrapFetching}
          />
        </div>
      </div>
    </div>
  );
}
