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
import { FinishedGoodsRecord } from "@/lib/api/finished-goods/interface";
import { FaRegEdit, FaRegTrashAlt } from "react-icons/fa";
import dayjs from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type ScrapStockRecord,
  useGetScrapStocksQuery,
  useGetScrapStocksStatsQuery,
} from "@/lib/api/scrap-stock/api";
import { useGetEmployeesQuery } from "@/lib/api/system-settings/api";
import {
  type ScrapReleaseRecord,
  useGetScrapReleasesLegacyQuery,
  useGetScrapReleasesQuery,
} from "@/lib/api/scrap-release/api";

type ScrapRecord = ScrapStockRecord;

type ReleaseRecord = ScrapReleaseRecord;

const dummyScrapData: ScrapRecord[] = [];

const makeScrapColumns = (actions: {
  onEdit: (record: ScrapRecord) => void;
  onView: (record: ScrapRecord) => void;
  onDelete: (record: ScrapRecord) => void;
}): ColumnType<ScrapRecord>[] => [
  {
    title: "Part Info",
    key: "partInfo",
    width: 260,
    render: (_: unknown, record: ScrapRecord) => (
      <div>
        <div className="font-semibold text-gray-900">{record.part_name || "-"}</div>
        <div className="text-sm text-gray-500">{record.wo_number ?? "-"}</div>
      </div>
    ),
  },
  {
    title: "UNIQ",
    key: "uniq",
    width: 180,
    render: (_: unknown, record: ScrapRecord) => (
      <div>
        <div className="font-semibold text-gray-900">{record.uniq || "-"}</div>
        <div className="text-sm text-gray-500">{record.part_number || "-"}</div>
      </div>
    ),
  },
  {
    title: "Model",
    key: "model",
    width: 120,
    render: (_: unknown, record: ScrapRecord) => (
      <div className="text-sm text-gray-700">{record.model || "-"}</div>
    ),
  },
  {
    title: "Scrap Type",
    key: "scrapType",
    width: 160,
    render: (_: unknown, record: ScrapRecord) => {
      const v = String(record.scrap_type || "-");
      const lowered = v.toLowerCase();
      const color = lowered.includes("return") ? "blue" : lowered.includes("process") ? "geekblue" : "purple";
      return <Tag color={color}>{v}</Tag>;
    },
  },
  {
    title: "UoM",
    key: "uom",
    width: 80,
    render: (_: unknown, record: ScrapRecord) => (
      <div className="text-sm text-gray-700">{record.uom || "-"}</div>
    ),
  },
  {
    title: "Qty",
    key: "quantity",
    width: 90,
    render: (_: unknown, record: ScrapRecord) => (
      <div className="text-sm font-semibold text-gray-900">{record.quantity ?? 0}</div>
    ),
  },
  {
    title: "Weight (kg)",
    key: "weightKg",
    width: 110,
    render: (_: unknown, record: ScrapRecord) => (
      <div className="text-sm text-gray-700">{Number(record.weight_kg ?? 0)}</div>
    ),
  },
  {
    title: "Date Received",
    key: "dateReceived",
    width: 140,
    render: (_: unknown, record: ScrapRecord) => (
      <div className="text-sm text-gray-600">
        {record.date_received ? dayjs(record.date_received).format("YYYY-MM-DD") : "-"}
      </div>
    ),
  },
  {
    title: "Packing Number",
    key: "packingNumber",
    width: 210,
    render: (_: unknown, record: ScrapRecord) => (
      <div className="text-sm text-gray-700">{record.packing_number || "-"}</div>
    ),
  },
  {
    title: "Validator",
    key: "validator",
    width: 140,
    render: (_: unknown, record: ScrapRecord) => (
      <div className="text-sm text-gray-700">{record.validator || "-"}</div>
    ),
  },
  {
    title: "Status",
    key: "status",
    width: 110,
    render: (_: unknown, record: ScrapRecord) => {
      const v = String(record.status || "-");
      const lowered = v.toLowerCase();
      const color = lowered.includes("active") ? "green" : lowered.includes("close") ? "default" : "blue";
      return <Tag color={color}>{v}</Tag>;
    },
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
};

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

const isNotFoundError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: unknown };
  return e.status === 404;
};

const makeReleaseColumns = (actions: {
  onView: (record: ReleaseRecord) => void;
  getScrapStockDisplay?: (scrapStockId: number) => {
    part_name?: string;
    wo_number?: string | null;
    uniq?: string;
    part_number?: string;
    model?: string;
    uom?: string;
  } | null;
}): ColumnType<ReleaseRecord>[] => [
  {
    title: "Release Number",
    key: "releaseNumber",
    width: 150,
    render: (_: unknown, record: ReleaseRecord) => (
      <div className="text-sm font-semibold text-gray-900">{record.release_number || "-"}</div>
    ),
  },
  {
    title: "Release Date",
    key: "releaseDate",
    width: 140,
    render: (_: unknown, record: ReleaseRecord) => (
      <div className="text-sm text-gray-600">
        {record.release_date ? dayjs(record.release_date).format("YYYY-MM-DD") : "-"}
      </div>
    ),
  },
  {
    title: "Type",
    key: "releaseType",
    width: 110,
    render: (_: unknown, record: ReleaseRecord) => {
      const v = String(record.release_type || "-");
      const lowered = v.toLowerCase();
      const color = lowered.includes("sell") ? "blue" : lowered.includes("dump") ? "red" : "default";
      return <Tag color={color}>{v}</Tag>;
    },
  },
  {
    title: "Part Info",
    key: "partInfo",
    width: 220,
    render: (_: unknown, record: ReleaseRecord) => {
      const display = actions.getScrapStockDisplay?.(record.scrap_stock_id) ?? null;
      return (
        <div>
          <div className="font-semibold text-gray-900">{display?.part_name || `#${record.scrap_stock_id}`}</div>
          <div className="text-sm text-gray-500">{display?.wo_number ?? "-"}</div>
        </div>
      );
    },
  },
  {
    title: "UNIQ / Part Number",
    key: "uniqPart",
    width: 200,
    render: (_: unknown, record: ReleaseRecord) => {
      const display = actions.getScrapStockDisplay?.(record.scrap_stock_id) ?? null;
      return (
        <div>
          <div className="font-semibold text-gray-900">{display?.uniq || "-"}</div>
          <div className="text-sm text-gray-500">{display?.part_number || "-"}</div>
        </div>
      );
    },
  },
  {
    title: "Model",
    key: "model",
    width: 110,
    render: (_: unknown, record: ReleaseRecord) => {
      const display = actions.getScrapStockDisplay?.(record.scrap_stock_id) ?? null;
      return <div className="text-sm text-gray-700">{display?.model || "-"}</div>;
    },
  },
  {
    title: "Qty Released",
    key: "qty",
    width: 120,
    render: (_: unknown, record: ReleaseRecord) => {
      const display = actions.getScrapStockDisplay?.(record.scrap_stock_id) ?? null;
      return (
        <div className="text-sm font-semibold text-gray-900">
          {record.release_qty ?? 0} {display?.uom || ""}
        </div>
      );
    },
  },
  {
    title: "Weight (kg)",
    key: "weight",
    width: 110,
    render: (_: unknown, record: ReleaseRecord) => (
      <div className="text-sm text-gray-700">{record.weight_released ?? "-"}</div>
    ),
  },
  {
    title: "Buyer / Disposal",
    key: "buyer",
    width: 210,
    render: (_: unknown, record: ReleaseRecord) => (
      <div>
        <div className="text-sm text-gray-900">{record.customer_name || "-"}</div>
        <div className="text-xs text-gray-500">{record.disposal_reason || "-"}</div>
      </div>
    ),
  },
  {
    title: "Value",
    key: "value",
    width: 140,
    render: (_: unknown, record: ReleaseRecord) => (
      <div className="text-sm text-gray-900">{record.total_value ?? "-"}</div>
    ),
  },
  {
    title: "Validator",
    key: "validator",
    width: 160,
    render: (_: unknown, record: ReleaseRecord) => (
      <div className="text-sm text-gray-700">{record.validator || "-"}</div>
    ),
  },
  {
    title: "Status",
    key: "status",
    width: 120,
    render: (_: unknown, record: ReleaseRecord) => {
      const v = String(record.approval_status || "-");
      const lowered = v.toLowerCase();
      const color = lowered.includes("pending") ? "orange" : lowered.includes("approve") ? "green" : "blue";
      return <Tag color={color}>{v}</Tag>;
    },
  },
  {
    title: "Actions",
    key: "actions",
    width: 80,
    render: (_: unknown, record: ReleaseRecord) => (
      <Button
        type="text"
        icon={<EyeOutlined />}
        size="small"
        className="text-blue-600 hover:text-blue-800"
        onClick={() => actions.onView(record)}
      />
    ),
  },
];

export default function ScrapStockPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [searchValue, setSearchValue] = useState("");
  const [loading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tab, setTab] = useState("scrap");
  const apiEnabled = Boolean(apiBaseUrl);

  const scrapStocksQuery = useGetScrapStocksQuery(
    { page: currentPage, limit: pageSize },
    { skip: !apiEnabled || tab !== "scrap" }
  );
  const scrapStatsQuery = useGetScrapStocksStatsQuery(undefined, {
    skip: !apiEnabled,
  });

  const releasesQueryPlural = useGetScrapReleasesQuery(
    { page: currentPage, limit: pageSize },
    { skip: !apiEnabled || tab !== "release" }
  );
  const useLegacyReleases = apiEnabled && tab === "release" && isNotFoundError(releasesQueryPlural.error);
  const releasesQueryLegacy = useGetScrapReleasesLegacyQuery(
    { page: currentPage, limit: pageSize },
    { skip: !useLegacyReleases }
  );

  const releasesQuery = useLegacyReleases ? releasesQueryLegacy : releasesQueryPlural;

  const scrapStockMapQuery = useGetScrapStocksQuery(
    { page: 1, limit: 500 },
    { skip: !apiEnabled || tab !== "release" }
  );
  const scrapStockById = useMemo(() => {
    const map = new Map<number, ScrapRecord>();
    for (const item of scrapStockMapQuery.data?.items ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [scrapStockMapQuery.data?.items]);

  const [scrapData, setScrapData] = useState<ScrapRecord[]>(dummyScrapData);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingScrap, setDeletingScrap] = useState<ScrapRecord | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingScrap, setEditingScrap] = useState<ScrapRecord | null>(null);
  const [editForm] = Form.useForm<ScrapEditFormValues>();

  const employeesQuery = useGetEmployeesQuery(undefined, { skip: !apiEnabled });
  const employeeOptions = useMemo(() => {
    return (employeesQuery.data ?? [])
      .map((e) => ({ label: e.full_name ?? e.email ?? String(e.id), value: e.full_name ?? e.employee_id ?? e.id }));
  }, [employeesQuery.data]);

  const openEditDrawer = (record: ScrapRecord) => {
    setEditingScrap(record);
    editForm.setFieldsValue({
      uniq: record.uniq,
      date_received: record.date_received ? dayjs(record.date_received) : undefined,
      packing_number: record.packing_number,
      scrap_quantity: record.quantity,
      scrap_type: record.scrap_type,
      validator: record.validator ?? undefined,
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
      console.log("Save scrap edit:", { id: editingScrap?.id, ...values });
      messageApi.success("Saved");
      closeEditDrawer();
    } catch {
      // validation errors shown by antd
    }
  };

  const openScrapDetail = (record: ScrapRecord) => {
    const id = record.uuid || String(record.id);
    router.push(`/scrap-stock/detail?id=${encodeURIComponent(id)}`);
  };

  const openDeleteModal = (record: ScrapRecord) => {
    setDeletingScrap(record);
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteOpen(false);
    setDeletingScrap(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingScrap) return;

    setScrapData((prev) => prev.filter((item) => item.id !== deletingScrap.id));
    if (editingScrap?.id === deletingScrap.id) {
      closeEditDrawer();
    }
    messageApi.success("Deleted");
    closeDeleteModal();
  };

  const scrapColumns = makeScrapColumns({
    onEdit: (record) => openEditDrawer(record),
    onView: (record) => openScrapDetail(record),
    onDelete: (record) => openDeleteModal(record),
  });

  const openReleaseDetail = (record: ReleaseRecord) => {
    router.push(`/scrap-stock/release/detail?id=${encodeURIComponent(String(record.id))}`);
  };

  const releaseColumns = makeReleaseColumns({
    onView: openReleaseDetail,
    getScrapStockDisplay: (scrapStockId) => scrapStockById.get(scrapStockId) ?? null,
  });

  const liveScrapRows = scrapStocksQuery.data?.items ?? [];
  const scrapRows = apiEnabled ? liveScrapRows : scrapData;
  const scrapTotal = apiEnabled
    ? scrapStocksQuery.data?.pagination?.total ?? liveScrapRows.length
    : scrapData.length;

  const releaseRows = apiEnabled ? releasesQuery.data?.items ?? [] : [];
  const releaseTotal = apiEnabled
    ? releasesQuery.data?.pagination?.total ?? releaseRows.length
    : releaseRows.length;
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
            <Button type="primary" onClick={handleSaveEdit}>
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
              options={[
                { label: "LV-001", value: "LV-001" },
                { label: "LV-002", value: "LV-002" },
                { label: "LV-003", value: "LV-003" },
              ]}
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
              options={[
                {
                  label: "Setting Machine Scrap",
                  value: "Setting Machine Scrap",
                },
                { label: "Process Scrap", value: "Process Scrap" },
                {
                  label: "Product Return Scrap",
                  value: "Product Return Scrap",
                },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Validator"
            name="validator"
            rules={[{ required: true, message: "Validator is required" }]}
          >
            <Select
              placeholder="Select Validator"
              options={employeeOptions.length ? employeeOptions : [
                { label: "John Mejer", value: "John Mejer" },
                { label: "QC Inspector A", value: "QC Inspector A" },
                { label: "Operator John", value: "Operator John" },
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
            icon={<PlusOutlined />}
            className="flex items-center gap-2"
            onClick={() => router.push("/scrap-stock/release/create")}
          >
            Add Scrap Release
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
          value={apiEnabled ? scrapStatsQuery.data?.total_items ?? 0 : scrapTotal}
          icon={<BsBoxSeam size={30} />}
          bgColor=""
          textColor="text-blue-600"
        />
        <StatsCard
          title="Total Scrap Qty"
          value={apiEnabled ? scrapStatsQuery.data?.total_qty ?? 0 : scrapRows.reduce((acc, r) => acc + (r.quantity ?? 0), 0)}
          icon={<FiAlertTriangle size={30} />}
          bgColor=""
          textColor="text-red-600"
        />
        <StatsCard
          title="Total Weight (kg)"
          value={apiEnabled ? scrapStatsQuery.data?.total_weight_kg ?? 0 : scrapRows.reduce((acc, r) => acc + Number(r.weight_kg ?? 0), 0)}
          icon={<HiOutlineArchiveBox size={30} />}
          bgColor=""
          textColor="text-green-600"
        />
        <StatsCard
          title="Scrap Types"
          value={apiEnabled ? scrapStatsQuery.data?.scrap_types ?? 0 : new Set(scrapRows.map((r) => r.scrap_type)).size}
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
              onClick={() => setTab("release")}
              className={`${
                tab === "release" ? "bg-white" : ""
              } rounded-xl text-center p-1`}
            >
              Scrap Release History
            </div>
          </div>
        </div>

        <div className="p-6">
          {tab === "scrap" ? (
            <TableTemplate<ScrapRecord>
              columns={scrapColumns as (ColumnType<ScrapRecord> & { sortFieldKey?: string })[]}
              data={scrapRows.filter((r) => {
                const q = searchValue.trim().toLowerCase();
                if (!q) return true;
                return [
                  r.part_name,
                  r.wo_number ?? "",
                  r.uniq,
                  r.part_number,
                  r.model,
                  r.scrap_type,
                  r.packing_number,
                  r.validator,
                  r.status,
                ]
                  .join(" ")
                  .toLowerCase()
                  .includes(q);
              })}
              rowKey={(r) => r.uuid || String(r.id)}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder="Search scrap..."
              pageSize={pageSize}
              currentPage={currentPage}
              total={scrapTotal}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              loading={loading || scrapStocksQuery.isFetching}
            />
          ) : (
            <TableTemplate<ReleaseRecord>
              columns={releaseColumns as (ColumnType<ReleaseRecord> & { sortFieldKey?: string })[]}
              data={releaseRows.filter((r) => {
                const q = searchValue.trim().toLowerCase();
                if (!q) return true;
                const stock = scrapStockById.get(r.scrap_stock_id);
                return [
                  r.release_number,
                  r.release_type,
                  r.customer_name ?? "",
                  r.disposal_reason ?? "",
                  r.approval_status,
                  r.validator ?? "",
                  String(r.scrap_stock_id),
                  stock?.uniq ?? "",
                  stock?.part_number ?? "",
                  stock?.part_name ?? "",
                  stock?.model ?? "",
                ]
                  .join(" ")
                  .toLowerCase()
                  .includes(q);
              })}
              rowKey={(r) => r.uuid || String(r.id)}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder="Search release..."
              pageSize={pageSize}
              currentPage={currentPage}
              total={releaseTotal}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              loading={loading || releasesQuery.isFetching || scrapStockMapQuery.isFetching}
            />
          )}
        </div>
      </div>
    </div>
  );
}
