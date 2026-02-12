"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Tag,
  message,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Drawer,
  Space,
  Divider,
  Descriptions,
} from "antd";
import {
  ScanOutlined,
  PlusOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  CloseOutlined,
  SaveOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import StatsCard from "@/components/StatsCard";
import TableTemplate from "@/components/TableTemplate";
import type { ColumnType } from "antd/es/table";
import type { FormInstance } from "antd";
import { BsBoxSeam } from "react-icons/bs";
import { FiAlertTriangle } from "react-icons/fi";
import { HiOutlineArchiveBox } from "react-icons/hi2";
import { LuChartColumn } from "react-icons/lu";
import { FaRegEdit, FaRegTrashAlt } from "react-icons/fa";
import {
  useGetAllRawMaterialsQuery,
  useDeleteRawMaterialMutation,
  useUpdateRawMaterialMutation,
} from "@/lib/api/raw-materials/api";
import { RawMaterialRecord } from "@/lib/api/raw-materials/interface";
import {
  formatNumber,
  getStatusStockColor,
} from "@/lib/api/raw-materials/utils";
import { apiBaseUrl } from "@/lib/api/instance";

// Mock data untuk demo
const MOCK_RAW_MATERIALS: RawMaterialRecord[] = [
  {
    id: "1",
    uniq: "LV-001",
    code: "RM-ST-001",
    name: "Steel Plate 10mm",
    category: "Metal",
    stock: 1000,
    unit: "pcs",
    kanban_quantity: 250,
    safety_stock: 500,
    stock_days: 15,
    status: "Available",
    is_buyed: true,
    warehouse: { id: "wh1", name: "WH-001" },
    master_list_supplier_id: "SUP-001",
    price: 150000,
    po_reference: "PO-2024-001",
    batch_number: "2024/2025",
    quality_status: "Goods",
    notes: "High quality steel plate",
    order_flag: false,
    created_by: "",
    created_at: "",
    updated_at: "",
    current_stock: undefined,
    master_list: undefined,
  },
  {
    id: "2",
    uniq: "LV-002",
    code: "RM-PL-002",
    name: "Plastic Sheet 5mm",
    category: "Plastic",
    stock: 500,
    unit: "pcs",
    kanban_quantity: 100,
    safety_stock: 250,
    stock_days: 8,
    status: "LowStock",
    is_buyed: false,
    warehouse: { id: "wh2", name: "WH-002" },
    master_list_supplier_id: "SUP-002",
    price: 75000,
    po_reference: "PO-2024-002",
    batch_number: "2025/2026",
    quality_status: "Services",
    notes: "Plastic material for assembly",
    order_flag: false,
    created_by: "",
    created_at: "",
    updated_at: "",
    current_stock: undefined,
    master_list: undefined,
  },
];

interface DetailModalState {
  visible: boolean;
  record: RawMaterialRecord | null;
  isEditing: boolean;
}

type RawMaterialDrawerValues = {
  category: string;
  master_list_supplier_id: string;
  stock: number;
  unit: string;
};

const RawMaterialDetailModal = ({
  state,
  onClose,
  onSave,
  onDelete,
  onStartEdit,
}: {
  state: DetailModalState;
  onClose: () => void;
  onSave: (data: RawMaterialDrawerValues) => void;
  onDelete: (record: RawMaterialRecord) => void;
  onStartEdit: () => void;
}) => {
  const [form] = Form.useForm<RawMaterialDrawerValues>();
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      onSave(values);
      setLoading(false);
    } catch (error) {
      message.error("Please complete all required fields");
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  if (!state.record) return null;

  const isEditing = state.isEditing;

  return (
    <Drawer
      title={isEditing ? "Edit Raw Material" : "Raw Material Details"}
      onClose={handleCancel}
      open={state.visible}
      width={380}
      footer={
        <Space style={{ float: "right" }}>
          {isEditing && (
            <>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={loading}
              >
                Save Changes
              </Button>
            </>
          )}
          {!isEditing && (
            <>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  onDelete(state.record!);
                }}
              >
                Delete
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  form.setFieldsValue({
                    category: state.record?.category,
                    master_list_supplier_id:
                      state.record?.master_list_supplier_id,
                    stock: state.record?.stock,
                    unit: state.record?.unit,
                  });
                  onStartEdit();
                }}
              >
                Edit
              </Button>
            </>
          )}
        </Space>
      }
    >
      {isEditing ? (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            uniq: state.record.uniq,
            category: state.record.category,
            master_list_supplier_id: state.record.master_list_supplier_id,
            stock: state.record.stock,
            unit: state.record.unit,
            weight: state.record.price, // Menggunakan price sebagai weight
          }}
        >
          <Form.Item label="Uniq (Cannot be edited)">
            <Input disabled value={state.record.uniq} />
          </Form.Item>

          <Form.Item label="Weight (Cannot be edited)">
            <Input disabled value={state.record.price} />
          </Form.Item>

          <Form.Item
            label="Raw Material Type"
            name="category"
            rules={[{ required: true, message: "Please select type!" }]}
          >
            <Select placeholder="Select type" allowClear>
              <Select.Option value="Metal">Metal</Select.Option>
              <Select.Option value="Plastic">Plastic</Select.Option>
              <Select.Option value="Chemical">Chemical</Select.Option>
              <Select.Option value="Electronics">Electronics</Select.Option>
              <Select.Option value="Textiles">Textiles</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Raw Material Source"
            name="master_list_supplier_id"
            rules={[{ required: true, message: "Please select source!" }]}
          >
            <Input placeholder="Enter supplier/source" />
          </Form.Item>

          <Form.Item
            label="Stock"
            name="stock"
            rules={[{ required: true, message: "Please input stock!" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            label="Unit of Measurement"
            name="unit"
            rules={[{ required: true, message: "Please select unit!" }]}
          >
            <Select placeholder="Select unit" allowClear>
              <Select.Option value="kg">Kilogram (kg)</Select.Option>
              <Select.Option value="g">Gram (g)</Select.Option>
              <Select.Option value="ltr">Liter (ltr)</Select.Option>
              <Select.Option value="pcs">Pieces (pcs)</Select.Option>
              <Select.Option value="m">Meter (m)</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      ) : (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Uniq">
            <span className="font-mono font-semibold">{state.record.uniq}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Part Name">
            {state.record.name}
          </Descriptions.Item>
          <Descriptions.Item label="Code">
            {state.record.code}
          </Descriptions.Item>
          <Descriptions.Item label="Raw Material Type">
            <Tag>{state.record.category}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Raw Material Source">
            {state.record.master_list_supplier_id}
          </Descriptions.Item>
          <Descriptions.Item label="Warehouse">
            <Tag color="blue">{state.record.warehouse?.name}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Stock">
            <span className="text-lg font-semibold">
              {formatNumber(state.record.stock || 0)}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="Unit of Measurement">
            {state.record.unit}
          </Descriptions.Item>
          <Descriptions.Item label="Weight">
            {state.record.price}
          </Descriptions.Item>
          <Descriptions.Item label="Kanban Quantity">
            {formatNumber(state.record.kanban_quantity || 0)}
          </Descriptions.Item>
          <Descriptions.Item label="Safety Stock">
            {formatNumber(state.record.safety_stock || 0)}
          </Descriptions.Item>
          <Descriptions.Item label="Stock Days">
            {formatNumber(state.record.stock_days || 0)} days
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag className={getStatusStockColor(state.record.status)}>
              {state.record.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Buy/Not Buy">
            <Tag
              className={
                state.record.is_buyed
                  ? "text-green-600 bg-green-50"
                  : "text-red-600 bg-red-50"
              }
            >
              {state.record.is_buyed ? "Buy" : "Not Buy"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Notes">
            {state.record.notes}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Drawer>
  );
};

export default function RawMaterialsPage() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchValue, setSearchValue] = useState("");
  const [deleteRawMaterial] = useDeleteRawMaterialMutation();
  const [updateRawMaterial] = useUpdateRawMaterialMutation();

  const useApi = Boolean(apiBaseUrl);
  const {
    data: rawMaterialsResponse,
    isFetching: rawMaterialsFetching,
    isError: rawMaterialsIsError,
    isSuccess: rawMaterialsIsSuccess,
    refetch: refetchRawMaterials,
  } = useGetAllRawMaterialsQuery(
    { currentPage, pageSize },
    { skip: !useApi, refetchOnMountOrArgChange: true }
  );

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] =
    useState<RawMaterialRecord | null>(null);
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    visible: false,
    record: null,
    isEditing: false,
  });
  const [rawMaterials, setRawMaterials] =
    useState<RawMaterialRecord[]>(MOCK_RAW_MATERIALS);

  const displayedRawMaterials = useMemo(() => {
    if (useApi && rawMaterialsIsSuccess) return rawMaterialsResponse?.data ?? [];
    return rawMaterials;
  }, [rawMaterials, rawMaterialsIsSuccess, rawMaterialsResponse?.data, useApi]);

  const pagination = {
    total:
      (useApi && rawMaterialsIsSuccess
        ? rawMaterialsResponse?.pagination?.total
        : undefined) ?? displayedRawMaterials.length,
  };

  const stats = {
    totalItems: pagination.total || 0,
    availableItems: displayedRawMaterials.filter((item) => item.status === "Available")
      .length,
    lowStockItems: displayedRawMaterials.filter((item) => item.status === "LowStock")
      .length,
    outOfStockItems: displayedRawMaterials.filter((item) => item.status === "OutOfStock")
      .length,
  };

  const handleEdit = (record: RawMaterialRecord) => {
    setDetailModal({
      visible: true,
      record,
      isEditing: true,
    });
  };

  const openDeleteModal = (record: RawMaterialRecord) => {
    setDeletingRecord(record);
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteOpen(false);
    setDeletingRecord(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;
    try {
      if (useApi && rawMaterialsIsSuccess && !rawMaterialsIsError) {
        await deleteRawMaterial({ id: deletingRecord.id }).unwrap();
        await refetchRawMaterials();
      } else {
        // MOCK delete
        setRawMaterials((prev) =>
          prev.filter((item) => item.id !== deletingRecord.id)
        );
      }

      message.success("Raw material deleted successfully!");
      closeDeleteModal();

      // Close detail drawer if it's currently showing the deleted record
      if (detailModal.record?.id === deletingRecord.id) {
        setDetailModal({ visible: false, record: null, isEditing: false });
      }
    } catch (error) {
      message.error("Failed to delete raw material");
    }
  };

  const handleView = (record: RawMaterialRecord) => {
    setDetailModal({
      visible: true,
      record,
      isEditing: false,
    });
  };

  const handleDetailSave = async (data: RawMaterialDrawerValues) => {
    try {
      if (detailModal.record && useApi && rawMaterialsIsSuccess && !rawMaterialsIsError) {
        await updateRawMaterial({
          id: detailModal.record.id,
          body: {
            category: data.category,
            master_list_supplier_id: data.master_list_supplier_id,
            stock: data.stock,
            unit: data.unit,
          },
        }).unwrap();
        await refetchRawMaterials();
      } else if (detailModal.record) {
        setRawMaterials((prev) =>
          prev.map((item) =>
            item.id === detailModal.record!.id
              ? {
                  ...item,
                  category: data.category,
                  master_list_supplier_id: data.master_list_supplier_id,
                  stock: data.stock,
                  unit: data.unit,
                }
              : item
          )
        );
      }

      message.success("Raw material updated successfully!");
      setDetailModal({ visible: false, record: null, isEditing: false });
    } catch {
      message.error("Failed to update raw material");
    }
  };

  const handleDetailClose = () => {
    setDetailModal({ visible: false, record: null, isEditing: false });
  };

  const handleStartEditFromDrawer = () => {
    setDetailModal((prev) => {
      if (!prev.record) return prev;
      return { ...prev, isEditing: true };
    });
  };

  const columns: ColumnType<RawMaterialRecord>[] = [
    {
      title: "Uniq",
      key: "uniq",
      width: 100,
      render: (record: RawMaterialRecord) => (
        <span className="font-mono text-sm">{record.uniq || "-"}</span>
      ),
    },
    {
      title: "Part Name",
      key: "part_name",
      width: 200,
      render: (record: RawMaterialRecord) => (
        <span className="font-semibold text-gray-900">
          {record.name || "-"}
        </span>
      ),
    },
    {
      title: "RM Type",
      key: "rm_type",
      width: 120,
      render: (record: RawMaterialRecord) => (
        <span className="border px-2 py-1 rounded-lg border-gray-300 text-sm">
          {record.category || "-"}
        </span>
      ),
    },
    {
      title: "RM Source",
      key: "rm_source",
      width: 120,
      render: (record: RawMaterialRecord) => (
        <span className="text-sm text-gray-600">{record.code || "-"}</span>
      ),
    },
    {
      title: "Warehouse",
      key: "warehouse",
      width: 120,
      render: (record: RawMaterialRecord) => (
        <span className="border px-2 py-1 rounded-lg border-gray-300 text-sm">
          {record.warehouse?.name || "-"}
        </span>
      ),
    },
    {
      title: "Stock",
      key: "stock",
      width: 100,
      render: (record: RawMaterialRecord) => (
        <div className="text-lg font-semibold text-gray-900">
          {formatNumber(record.stock || 0)}
        </div>
      ),
    },
    {
      title: "Kanban Info",
      key: "kanban_quantity",
      width: 120,
      render: (record: RawMaterialRecord) => (
        <div>
          <div className="text-sm font-semibold">
            {formatNumber(record.kanban_quantity || 0)}
          </div>
          <div className="text-xs text-gray-500">
            Need:{" "}
            {formatNumber(
              (record.safety_stock || 0) - (record.kanban_quantity || 0)
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (record: RawMaterialRecord) => {
        const statusColor = getStatusStockColor(record.status);
        return <Tag className={statusColor}>{record.status || "-"}</Tag>;
      },
    },
    {
      title: "Buy/Not Buy",
      key: "is_buyed",
      width: 110,
      render: (record: RawMaterialRecord) => {
        return (
          <Tag
            className={`${
              record.is_buyed
                ? "text-green-600 bg-green-50"
                : "text-red-600 bg-red-50"
            }`}
          >
            {record.is_buyed ? "Buy" : "Not Buy"}
          </Tag>
        );
      },
    },
    {
      title: "Stock Days",
      key: "stock_days",
      width: 110,
      render: (record: RawMaterialRecord) => (
        <div className="text-sm font-medium">
          {formatNumber(record.stock_days || 0)}
          <p className="text-xs text-gray-500 font-normal">days</p>
        </div>
      ),
    },
    {
      title: "Safety Stocks",
      key: "safety_stock",
      width: 120,
      render: (record: RawMaterialRecord) => (
        <div className="text-sm font-medium">
          {formatNumber(record.safety_stock || 0)}
          <p className="text-xs text-gray-500 font-normal">threshold</p>
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
      fixed: "right",
      render: (record: RawMaterialRecord) => (
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            className="text-blue-600 hover:text-blue-800"
            onClick={() => router.push(`/raw-materials/detail`)}
          />
          <Button
            type="text"
            icon={<FaRegEdit />}
            size="small"
            className="text-green-600 hover:text-green-800"
            onClick={() => handleEdit(record)}
          />
          <Button
            type="text"
            icon={<FaRegTrashAlt />}
            size="small"
            className="text-red-600 hover:text-red-800"
            onClick={() => openDeleteModal(record)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <Modal
        title="Delete Raw Material"
        open={deleteOpen}
        okText="Delete"
        okType="danger"
        cancelText="Cancel"
        onOk={handleConfirmDelete}
        onCancel={closeDeleteModal}
      >
        <div className="flex items-start gap-3">
          <ExclamationCircleOutlined className="text-red-500 mt-1" />
          <div>
            <div className="font-medium">Are you sure you want to delete this raw material?</div>
            <div className="text-gray-500">
              {deletingRecord ? `\"${deletingRecord.name}\" (${deletingRecord.uniq})` : ""}
            </div>
          </div>
        </div>
      </Modal>

      <RawMaterialDetailModal
        state={detailModal}
        onClose={handleDetailClose}
        onSave={handleDetailSave}
        onDelete={openDeleteModal}
        onStartEdit={handleStartEditFromDrawer}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Raw Materials Database
          </h1>
          <p className="text-gray-600">
            Track RM on hand, consumption per kanban, and Buy/Not Buy
            recommendations with Stock Days and Safety Stock
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button icon={<ScanOutlined />} className="flex items-center gap-2">
            Scan Incoming
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push("/raw-materials/create")}
          >
            Add Raw Material
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Items"
          value={stats.totalItems.toString()}
          icon={<BsBoxSeam size={30} />}
          bgColor=""
          textColor="text-blue-600"
        />
        <StatsCard
          title="Available"
          value={stats.availableItems.toString()}
          icon={<HiOutlineArchiveBox size={30} />}
          bgColor=""
          textColor="text-green-600"
        />
        <StatsCard
          title="Low Stock"
          value={stats.lowStockItems.toString()}
          icon={<FiAlertTriangle size={30} />}
          bgColor=""
          textColor="text-yellow-600"
        />
        <StatsCard
          title="Out of Stock"
          value={stats.outOfStockItems.toString()}
          icon={<LuChartColumn size={30} />}
          bgColor=""
          textColor="text-red-600"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Raw Material Database
          </h2>
        </div>
        <div className="p-6">
          <TableTemplate
            columns={columns}
            data={displayedRawMaterials}
            rowKey="id"
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="Search raw materials..."
            pageSize={pageSize}
            currentPage={currentPage}
            total={pagination?.total || 0}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            loading={useApi ? rawMaterialsFetching : false}
          />
        </div>
      </div>
    </div>
  );
}
