"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import Image from "next/image";
import type { FormInstance } from "antd";
import { BsBoxSeam } from "react-icons/bs";
import { FiAlertTriangle } from "react-icons/fi";
import { HiOutlineArchiveBox } from "react-icons/hi2";
import { LuChartColumn } from "react-icons/lu";
import { FaRegEdit, FaRegTrashAlt } from "react-icons/fa";
import { RawMaterialRecord } from "@/lib/api/raw-materials/interface";
import PrintButton from "@/components/PrintButton";
import type { PrintCardOptions } from "@/lib/utils/printCard";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  type InventoryKanbanSummary,
  type InventoryRecord,
  useGetInventoryListQuery,
  useLazyGetInventoryKanbanSummaryQuery,
  useLazyGetDeliveryNoteByUniqQuery,
} from "@/lib/api/inventory/api";
import {
  formatNumber,
  getStatusStockColor,
} from "@/lib/api/raw-materials/utils";

import { useLazyGenerateQRRawmaterialQuery } from "@/lib/api/raw-materials/api";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";

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
    qr: "",
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
    qr: "",
  },
];

interface DetailModalState {
  visible: boolean;
  record: RawMaterialRecord | null;
  isEditing: boolean;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const isMissingRouteError = (error: unknown): boolean =>
  isRecord(error) && error.status === 404;

const deriveStatus = (stockQty: number): RawMaterialRecord["status"] => {
  if (stockQty <= 0) return "OutOfStock";
  if (stockQty <= 20) return "LowStock";
  return "Available";
};

const mapKanbanStatusToUi = (
  value: unknown,
): RawMaterialRecord["status"] | null => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw.includes("out")) return "OutOfStock";
  if (raw.includes("low")) return "LowStock";
  if (
    raw.includes("avail") ||
    raw.includes("in_stock") ||
    raw.includes("in stock")
  )
    return "Available";
  return null;
};

const isBuyValue = (value: unknown): boolean | null => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw === "buy") return true;
  if (raw === "not_buy" || raw === "not buy" || raw === "no") return false;
  if (raw.includes("not")) return false;
  if (raw.includes("buy")) return true;
  return null;
};

const mapInventoryToRawMaterial = (
  record: InventoryRecord,
): RawMaterialRecord => {
  const stockQty = Number(record.stock_qty ?? 0);
  const status = deriveStatus(stockQty);

  return {
    current_stock: undefined,
    master_list: undefined,
    id: record.id,
    uniq: record.uniq_code ?? "-",
    code: record.rm_source ?? "-",
    name: record.part_name ?? record.item_name ?? record.uniq_code ?? "-",
    category: record.raw_material_type,
    stock: stockQty,
    unit: record.uom,
    kanban_quantity: 0,
    safety_stock: 20,
    stock_days: 0,
    status,
    is_buyed: status !== "Available",
    warehouse: {
      id: record.warehouse_location ?? "",
      name: record.warehouse_location ?? "-",
    },
    master_list_supplier_id: record.rm_source,
    price: record.stock_weight_kg,
    po_reference: "",
    batch_number: "",
    quality_status: "",
    notes: "",
    order_flag: false,
    created_by: "",
    created_at: record.created_at ?? "",
    updated_at: record.updated_at ?? "",
    part_name: record.part_name,
    part_no: record.part_number,
    model: undefined,
    total_kanban: undefined,
    description: undefined,
    save_as: undefined,
    received_quantity: undefined,
    received_date: undefined,
    expiry_date: undefined,
    updated_by: undefined,
    master_list_supplier: undefined,
    qr: record.qr ?? "",
  };
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
  onSave: (data: any) => void;
  onDelete: (record: RawMaterialRecord) => void;
  onStartEdit: () => void;
}) => {
  const [form] = Form.useForm();
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] =
    useState<RawMaterialRecord | null>(null);
  const [qrModal, setQrModal] = useState({
    open: false,
    qr: "",
    uniq: "",
  });
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    visible: false,
    record: null,
    isEditing: false,
  });
  const [rawMaterials, setRawMaterials] =
    useState<RawMaterialRecord[]>(MOCK_RAW_MATERIALS);
  const apiEnabled = Boolean(apiBaseUrl);
  const listQuery = useGetInventoryListQuery(
    { type: "raw-materials", page: currentPage, limit: pageSize },
    { skip: !apiEnabled },
  );
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });
  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data],
  );

  const [triggerKanbanSummary] = useLazyGetInventoryKanbanSummaryQuery();
  const [kanbanSummaryByUniq, setKanbanSummaryByUniq] = useState<
    Record<string, InventoryKanbanSummary>
  >({});
  const requestedUniqsRef = useRef<Set<string>>(new Set());
  const [kanbanApiMissing, setKanbanApiMissing] = useState(false);

  useEffect(() => {
    if (!apiEnabled || !listQuery.error) return;
    if (isMissingRouteError(listQuery.error)) {
      message.warning(
        "Inventory raw-materials API route is not available yet; showing mock data.",
      );
      return;
    }
    message.error(
      getApiErrorMessage(
        listQuery.error,
        "Failed to load raw materials inventory",
      ),
    );
  }, [apiEnabled, listQuery.error]);

  const inventoryRows = useMemo<RawMaterialRecord[]>(() => {
    if (!apiEnabled || isMissingRouteError(listQuery.error))
      return rawMaterials;
    const items = listQuery.data?.data ?? [];
    if (!items.length) return [];
    return items.map(mapInventoryToRawMaterial);
  }, [apiEnabled, listQuery.data, listQuery.error, rawMaterials]);

  const filteredRows = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return inventoryRows;
    return inventoryRows.filter((item) => {
      return [
        item.uniq,
        item.name,
        item.code,
        item.category,
        item.warehouse?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [inventoryRows, searchValue]);

  useEffect(() => {
    if (!apiEnabled) return;
    if (kanbanApiMissing) return;
    if (isMissingRouteError(listQuery.error)) return;

    const uniqs = Array.from(
      new Set(
        filteredRows
          .map((row) => String(row.uniq ?? "").trim())
          .filter(Boolean),
      ),
    );

    uniqs.forEach((uniq) => {
      if (requestedUniqsRef.current.has(uniq)) return;
      requestedUniqsRef.current.add(uniq);

      triggerKanbanSummary({ uniq_code: uniq })
        .unwrap()
        .then((res) => {
          const summary = res?.data;
          if (!summary) return;
          setKanbanSummaryByUniq((prev) => ({ ...prev, [uniq]: summary }));
        })
        .catch((err) => {
          if (isMissingRouteError(err)) {
            setKanbanApiMissing(true);
          }
        });
    });
  }, [
    apiEnabled,
    filteredRows,
    kanbanApiMissing,
    listQuery.error,
    triggerKanbanSummary,
  ]);

  const paginationTotal = searchValue.trim()
    ? filteredRows.length
    : (listQuery.data?.pagination?.total ?? inventoryRows.length);

  const stats = {
    totalItems: paginationTotal || 0,
    availableItems: inventoryRows.filter((item) => item.status === "Available")
      .length,
    lowStockItems: inventoryRows.filter((item) => item.status === "LowStock")
      .length,
    outOfStockItems: inventoryRows.filter(
      (item) => item.status === "OutOfStock",
    ).length,
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
      if (apiEnabled && !isMissingRouteError(listQuery.error)) {
        message.info("Delete inventory is not integrated for this page yet.");
        closeDeleteModal();
        return;
      }

      setRawMaterials((prev) =>
        prev.filter((item) => item.id !== deletingRecord.id),
      );

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

  const handleDetailSave = (data: any) => {
    if (apiEnabled && !isMissingRouteError(listQuery.error)) {
      message.info("Update inventory is not integrated for this page yet.");
      setDetailModal({ visible: false, record: null, isEditing: false });
      return;
    }
    message.success("Raw material updated successfully!");
    setDetailModal({ visible: false, record: null, isEditing: false });
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

  const [generateQR] = useLazyGenerateQRRawmaterialQuery();
  const [generateDeliveryNote] = useLazyGetDeliveryNoteByUniqQuery();

  const handleGenerateQR = async (
    record: RawMaterialRecord,
  ): Promise<PrintCardOptions | null> => {
    if (!record.uniq) {
      message.error("Uniq code tidak ditemukan");
      return null;
    }

    let qrDataUrl: string | undefined;
    try {
      const result = await generateQR(record.uniq).unwrap();
      const qr = result?.data?.qr ?? "";
      qrDataUrl = qr
        ? qr.startsWith("data:image")
          ? qr
          : `data:image/png;base64,${qr}`
        : undefined;
    } catch (err) {
      console.error(err);
    }

    let progress: PrintCardOptions["progress"];
    try {
      const summaryRes = await triggerKanbanSummary({
        uniq_code: record.uniq,
      }).unwrap();
      const summary = summaryRes?.data;
      const currentQty = Number(summary?.stock_qty ?? record.stock ?? 0);
      const targetQty = currentQty + Number(summary?.stock_to_complete ?? 0);
      const stdQty = Number(summary?.kanban_pkg_qty ?? 0);
      const percent =
        targetQty > 0
          ? Math.max(
              0,
              Math.min(100, Math.round((currentQty / targetQty) * 100)),
            )
          : 0;
      progress = { currentQty, targetQty, stdQty, percent };
    } catch (err) {
      console.error(err);
    }

    let deliveryNotes: PrintCardOptions["deliveryNotes"];
    try {
      const dnRes = await generateDeliveryNote(record.uniq).unwrap();
      deliveryNotes = dnRes?.data ?? undefined;
    } catch (err) {
      console.error(err);
    }

    return {
      documentTitle: `Raw Material - ${record.uniq}`,
      heading: "RAW MATERIAL",
      subheading: record.uniq,
      fields: [
        { label: "Part Name", value: record.name, full: true },
        { label: "RM Type", value: record.category },
        { label: "RM Source", value: record.code },
        { label: "Warehouse", value: record.warehouse?.name },
        { label: "Stock", value: formatNumber(record.stock ?? 0) },
        { label: "Status", value: record.status },
      ],
      progress,
      deliveryNotes,
      qrDataUrl,
      bottomCode: record.uniq,
      onError: (msg) => message.error(msg),
    };
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
      title: "Child Uniq",
      key: "child_uniq",
      width: 140,
      render: (record: RawMaterialRecord) => {
        const children =
          bomIndex.childUniqsByUniq[String(record.uniq ?? "").trim()] ?? [];
        if (!children.length) {
          return <span className="text-sm text-gray-400">-</span>;
        }
        const [first, ...rest] = children;
        return (
          <span className="font-mono text-sm">
            {first}
            {rest.length ? (
              <span className="text-gray-400"> (+{rest.length} lagi)</span>
            ) : null}
          </span>
        );
      },
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
      width: 160,
      render: (record: RawMaterialRecord) =>
        (() => {
          const summary = kanbanSummaryByUniq[String(record.uniq ?? "").trim()];
          const totalneeded = Number(
            summary?.kanbans_needed ?? record.kanban_quantity ?? 0,
          );
          const needed = Number(
            summary?.stock_to_complete ??
              (record.safety_stock || 0) - (record.kanban_quantity || 0),
          );

          return (
            <div>
              <div className="text-sm font-semibold">
                {formatNumber(totalneeded)} Kanban
              </div>
              <div className="text-xs text-gray-500">
                Stock to Complete: {formatNumber(needed)}
              </div>
            </div>
          );
        })(),
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (record: RawMaterialRecord) => {
        const summary = kanbanSummaryByUniq[String(record.uniq ?? "").trim()];
        const mapped = mapKanbanStatusToUi(summary?.status);
        const status = mapped ?? record.status;
        const statusColor = getStatusStockColor(status);
        return <Tag className={statusColor}>{status || "-"}</Tag>;
      },
    },
    {
      title: "Buy/Not Buy",
      key: "is_buyed",
      width: 110,
      render: (record: RawMaterialRecord) => {
        const summary = kanbanSummaryByUniq[String(record.uniq ?? "").trim()];
        const mapped = isBuyValue(summary?.buy_not_buy);
        const isBuyed = mapped ?? record.is_buyed;
        return (
          <Tag
            className={`${
              isBuyed ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
            }`}
          >
            {isBuyed ? "Buy" : "Not Buy"}
          </Tag>
        );
      },
    },
    {
      title: "Stock Days",
      key: "stock_days",
      width: 110,
      render: (record: RawMaterialRecord) =>
        (() => {
          const summary = kanbanSummaryByUniq[String(record.uniq ?? "").trim()];
          const stockDays = Number(
            summary?.stock_days ?? record.stock_days ?? 0,
          );
          return (
            <div className="text-sm font-medium">
              {formatNumber(stockDays)}
              <p className="text-xs text-gray-500 font-normal">days</p>
            </div>
          );
        })(),
    },
    {
      title: "Safety Stocks",
      key: "safety_stock",
      width: 120,
      render: (record: RawMaterialRecord) =>
        (() => {
          const summary = kanbanSummaryByUniq[String(record.uniq ?? "").trim()];
          const stockQty = Number(summary?.stock_qty ?? record.stock ?? 0);
          const stockToComplete = Number(summary?.stock_to_complete ?? 0);
          const safetyStock = Math.ceil(
            summary
              ? stockQty + stockToComplete
              : Number(record.safety_stock ?? 0),
          );
          return (
            <div className="text-sm font-medium">
              {formatNumber(safetyStock)}
              <p className="text-xs text-gray-500 font-normal">threshold</p>
            </div>
          );
        })(),
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
            onClick={() =>
              router.push(
                `/raw-materials/detail?id=${encodeURIComponent(record.id)}&uniq=${encodeURIComponent(record.uniq)}`,
              )
            }
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
          <PrintButton
            type="text"
            icon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h3v3H7V7zM14 7h3v3h-3V7zM7 14h3v3H7v-3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 14h1m2 0h0m-3 3h3"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6z"
                />
              </svg>
            }
            size="small"
            className="text-gray-600 hover:text-blue-600"
            loadOptions={() => handleGenerateQR(record)}
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
            <div className="font-medium">
              Are you sure you want to delete this raw material?
            </div>
            <div className="text-gray-500">
              {deletingRecord
                ? `\"${deletingRecord.name}\" (${deletingRecord.uniq})`
                : ""}
            </div>
          </div>
        </div>
      </Modal>
      <Modal
        open={qrModal.open}
        title={`QR Code - ${qrModal.uniq}`}
        footer={null}
        centered
        onCancel={() =>
          setQrModal({
            open: false,
            qr: "",
            uniq: "",
          })
        }
      >
        <div className="flex justify-center">
          {qrModal.qr ? (
            <img
              src={
                qrModal.qr.startsWith("data:image")
                  ? qrModal.qr
                  : `data:image/png;base64,${qrModal.qr}`
              }
              alt="QR"
              className="w-64 h-64"
            />
          ) : (
            <div>Tidak ada QR</div>
          )}
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
            data={filteredRows}
            rowKey="id"
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="Search raw materials..."
            pageSize={pageSize}
            currentPage={currentPage}
            total={paginationTotal}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            loading={apiEnabled ? listQuery.isFetching : false}
          />
        </div>
      </div>
    </div>
  );
}
