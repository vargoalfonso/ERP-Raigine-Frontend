"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircleFilled,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  EyeOutlined,
  SearchOutlined,
  PlusOutlined,
  ScanOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { BsBoxSeam } from "react-icons/bs";
import { FiAlertTriangle } from "react-icons/fi";
import { HiOutlineArchiveBox } from "react-icons/hi2";
import { IoLocationOutline } from "react-icons/io5";
import { LuChartColumn } from "react-icons/lu";

import StatsCard from "@/components/StatsCard";
import StatsCardStatus from "@/components/StatsCardStatus";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type FinishedGoodListItem,
  useGetFinishedGoodParameterizedSummaryQuery,
  useGetFinishedGoodsQuery,
  useGetFinishedGoodsSummaryQuery,
  useDeleteFinishedGoodMutation,
  useUpdateFinishedGoodMutation,
  useLazyGenerateFinishedGoodQRQuery,
  useLazyGetDeliveryNoteByUniqQuery,
} from "@/lib/api/finished-goods/api";
import PrintButton from "@/components/PrintButton";
import type { PrintCardOptions } from "@/lib/utils/printCard";

function StatusTag({ status }: { status?: string }) {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized.includes("low"))
    return <Tag color="red">{status || "Low"}</Tag>;
  if (normalized.includes("over"))
    return <Tag color="orange">{status || "Overstock"}</Tag>;
  return <Tag color="geekblue">{status || "Normal"}</Tag>;
}

function CurrentStockCell({ uniqCode }: { uniqCode: string }) {
  const apiEnabled = Boolean(apiBaseUrl);
  const q = useGetFinishedGoodParameterizedSummaryQuery(
    { uniq_code: uniqCode },
    { skip: !apiEnabled || !uniqCode },
  );

  if (q.isFetching) return <span className="text-gray-400">…</span>;
  if (q.isError || !q.data) return <span className="text-gray-400">-</span>;

  return (
    <div className="leading-tight">
      <div className="text-base font-semibold text-gray-900">
        {q.data.stock_qty ?? 0}
      </div>
      <div className="text-xs text-gray-500">
        Target: {q.data.target_stock_qty ?? 0}
      </div>
    </div>
  );
}

function StockToKanbanCell({ uniqCode }: { uniqCode: string }) {
  const apiEnabled = Boolean(apiBaseUrl);
  const q = useGetFinishedGoodParameterizedSummaryQuery(
    { uniq_code: uniqCode },
    { skip: !apiEnabled || !uniqCode },
  );
  if (q.isFetching) return <span className="text-gray-400">…</span>;
  if (q.isError || !q.data) return <span className="text-gray-400">-</span>;
  return (
    <span className="text-base font-semibold text-gray-900">
      {q.data.stock_to_kanban_pcs ?? 0}
    </span>
  );
}

function KanbanCell({ uniqCode }: { uniqCode: string }) {
  const apiEnabled = Boolean(apiBaseUrl);
  const q = useGetFinishedGoodParameterizedSummaryQuery(
    { uniq_code: uniqCode },
    { skip: !apiEnabled || !uniqCode },
  );
  if (q.isFetching) return <span className="text-gray-400">…</span>;
  if (q.isError || !q.data) return <span className="text-gray-400">-</span>;
  return (
    <span className="text-sm text-gray-700">
      {q.data.current_kanban ?? 0} Kanban
    </span>
  );
}

function StockStatusCell({ uniqCode }: { uniqCode: string }) {
  const apiEnabled = Boolean(apiBaseUrl);
  const q = useGetFinishedGoodParameterizedSummaryQuery(
    { uniq_code: uniqCode },
    { skip: !apiEnabled || !uniqCode },
  );
  if (q.isFetching) return <span className="text-gray-400">…</span>;
  if (q.isError || !q.data) return <span className="text-gray-400">-</span>;

  const status = q.data.status || "Normal";
  const normalized = status.trim().toLowerCase();
  const isLow = normalized.includes("low");

  return (
    <div className="flex items-center gap-2">
      {isLow ? (
        <ExclamationCircleFilled className="text-red-500" />
      ) : (
        <CheckCircleFilled className="text-green-600" />
      )}
      <StatusTag status={status} />
    </div>
  );
}

function FinishedGoodsDetailModal({
  open,
  record,
  onClose,
  onEdit,
  onAdjustStock,
}: {
  open: boolean;
  record: FinishedGoodListItem | null;
  onClose: () => void;
  onEdit: () => void;
  onAdjustStock: () => void;
}) {
  const apiEnabled = Boolean(apiBaseUrl);
  const uniqCode = record?.uniq_code ?? null;

  const query = useGetFinishedGoodParameterizedSummaryQuery(
    { uniq_code: uniqCode ?? "" },
    { skip: !apiEnabled || !open || !uniqCode },
  );

  const detail = query.data;

  const progress = useMemo(() => {
    if (!detail) return 0;
    const target = detail.target_stock_qty || 0;
    const current = detail.stock_qty || 0;
    if (target <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  }, [detail]);

  const lastUpdatedLabel = record?.updated_at
    ? new Date(record.updated_at).toLocaleString()
    : "-";

  const kanbanStatusText = detail
    ? `${detail.current_kanban ?? 0} kanban complete, ${detail.stock_to_kanban_pcs ?? 0} units needed for next kanban`
    : "-";

  const currentStatusText = detail
    ? (detail.status || "Normal").toLowerCase().includes("low")
      ? "Low stock alert - Schedule production immediately"
      : "Stock level normal"
    : "-";

  return (
    <Modal
      title={<div className="font-semibold">Finished Goods Details</div>}
      open={open}
      onCancel={onClose}
      width={720}
      footer={
        <div className="flex items-center justify-between">
          <Button onClick={onClose}>Close</Button>
          <div className="flex items-center gap-2">
            <Button icon={<EditOutlined />} onClick={onEdit}>
              Edit Details
            </Button>
            <Button type="primary" onClick={onAdjustStock}>
              Adjust Stock
            </Button>
          </div>
        </div>
      }
    >
      {!uniqCode ? (
        <div className="text-gray-600">Select an item to view details.</div>
      ) : query.isFetching ? (
        <div className="text-gray-600">Loading…</div>
      ) : query.isError ? (
        <div className="text-red-600">Failed to load detail.</div>
      ) : !detail ? (
        <div className="text-gray-600">No detail found.</div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Complete information for finished goods item
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500">Product UNIQ</div>
                <div className="text-base font-semibold text-gray-900">
                  {detail.uniq_code}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Part Number</div>
                <div className="text-base font-semibold text-gray-900">
                  {detail.part_number}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="mt-1">
                  {StatusTag({ status: detail.status })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-base font-semibold text-gray-900">
              Product Information
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500">Part Name</div>
                <div className="text-sm font-medium text-gray-900">
                  {detail.part_name || "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Model</div>
                <div className="text-sm font-medium text-gray-900">
                  {detail.model || "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Work Order Number</div>
                <div className="mt-1">
                  <span className="text-xs text-gray-700 bg-[#FAFBFC] border border-gray-200 rounded-md px-2 py-1">
                    {detail.wo_number || "-"}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Warehouse Location</div>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-gray-400">
                    <IoLocationOutline size={16} />
                  </span>
                  <span className="text-xs text-gray-700 bg-[#FAFBFC] border border-gray-200 rounded-md px-2 py-1">
                    {detail.warehouse_location || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-base font-semibold text-gray-900">
              Stock & Kanban Information
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500">Current Stock</div>
                <div className="text-2xl font-bold text-blue-600">
                  {detail.stock_qty ?? 0}
                </div>
                <div className="text-xs text-gray-400">units available</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Target Kanban</div>
                <div className="text-2xl font-bold text-gray-900">
                  {detail.target_stock_qty ?? 0}
                </div>
                <div className="text-xs text-gray-400">target quantity</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Stock to Complete</div>
                <div className="text-2xl font-bold text-orange-600">
                  {detail.stock_to_kanban_pcs ?? 0}
                </div>
                <div className="text-xs text-gray-400">more needed</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="font-medium">Kanban Progress</div>
                <div>{progress}%</div>
              </div>
              <div className="mt-2 h-3 w-full rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: progress + "%" }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <div>{detail.current_kanban ?? 0} Kanban Complete</div>
                <div>
                  {detail.stock_qty ?? 0}/{detail.target_stock_qty ?? 0}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-xs text-gray-500">Min Threshold</div>
                <div className="text-lg font-bold text-gray-900">
                  {detail.min_threshold ?? 0}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-xs text-gray-500">Max Threshold</div>
                <div className="text-lg font-bold text-gray-900">
                  {detail.max_threshold ?? 0}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-base font-semibold text-gray-900">
              Activity Timeline
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="mt-2 h-2 w-2 rounded-full bg-green-500" />
                <div>
                  <div className="font-medium text-gray-900">Last Updated</div>
                  <div className="text-xs text-gray-500">
                    {lastUpdatedLabel}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-2 h-2 w-2 rounded-full bg-blue-500" />
                <div>
                  <div className="font-medium text-gray-900">Kanban Status</div>
                  <div className="text-xs text-gray-500">
                    {kanbanStatusText}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-2 h-2 w-2 rounded-full bg-orange-500" />
                <div>
                  <div className="font-medium text-gray-900">
                    Current Status
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentStatusText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditFinishedGoodModal({
  open,
  record,
  onClose,
}: {
  open: boolean;
  record: FinishedGoodListItem | null;
  onClose: (saved?: boolean) => void;
}) {
  const apiEnabled = Boolean(apiBaseUrl);
  const [form] = Form.useForm<{
    uniq_code: string;
    warehouse_location: string;
    stock_qty: number;
  }>();
  const [updateFinishedGood, updateState] = useUpdateFinishedGoodMutation();

  const uniqCode = record?.uniq_code ?? "";
  const summaryQuery = useGetFinishedGoodParameterizedSummaryQuery(
    { uniq_code: uniqCode },
    { skip: !apiEnabled || !open || !uniqCode },
  );

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      uniq_code: record?.uniq_code ?? "",
      warehouse_location: record?.warehouse_location ?? "",
      stock_qty: summaryQuery.data?.stock_qty ?? 0,
    });
  }, [open, record, form, summaryQuery.data?.stock_qty]);

  const onSubmit = async () => {
    const values = await form.validateFields();
    if (!record) return;
    await updateFinishedGood({
      id: record.id,
      body: {
        uniq_code: values.uniq_code,
        warehouse_location: values.warehouse_location,
        stock_qty: Number(values.stock_qty ?? 0),
      },
    }).unwrap();
    message.success("Finished goods updated");
    onClose(true);
  };

  return (
    <Modal
      title="Edit Finished Goods"
      open={open}
      onCancel={() => onClose(false)}
      okText="Save"
      onOk={onSubmit}
      confirmLoading={updateState.isLoading}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="uniq_code"
          label="UNIQ"
          rules={[{ required: true, message: "UNIQ wajib" }]}
        >
          <Input placeholder="LV8-002" />
        </Form.Item>
        <Form.Item
          name="warehouse_location"
          label="Warehouse"
          rules={[{ required: true, message: "Warehouse wajib" }]}
        >
          <Input placeholder="WH-FG-B02" />
        </Form.Item>
        <Form.Item
          name="stock_qty"
          label="Stock"
          rules={[{ required: true, message: "Stock wajib" }]}
          extra={summaryQuery.isFetching ? "Loading current stock…" : undefined}
        >
          <InputNumber className="w-full" min={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function FinishedGoodsPage() {
  const router = useRouter();

  const [generateFinishedGoodQR] = useLazyGenerateFinishedGoodQRQuery();
  const [generateDeliveryNote] = useLazyGetDeliveryNoteByUniqQuery();

  const handleGenerateQR = async (
    record: FinishedGoodListItem,
  ): Promise<PrintCardOptions | null> => {
    if (!record.uniq_code) {
      message.error("Uniq code tidak ditemukan");
      return null;
    }

    let qrDataUrl: string | undefined;

    const result = await generateFinishedGoodQR(record.uniq_code).unwrap();

    const qr = result?.qr ?? "";

    qrDataUrl = qr
      ? qr.startsWith("data:image")
        ? qr
        : `data:image/png;base64,${qr}`
      : undefined;

    const deliveryNoteRes = await generateDeliveryNote(
      record.uniq_code,
    ).unwrap();

    const deliveryNoteData = deliveryNoteRes.data ?? [];
    
    return {
      documentTitle: `Finished Good - ${record.uniq_code}`,
      heading: "FINISHED GOOD",
      subheading: record.uniq_code,
      fields: [
        {
          label: "Part Number",
          value: record.part_number,
        },
        {
          label: "Part Name",
          value: record.part_name,
          full: true,
        },
        {
          label: "Model",
          value: record.model,
        },
        {
          label: "WO Number",
          value: record.wo_number,
        },
        {
          label: "Warehouse",
          value: record.warehouse_location,
        },
      ],

      deliveryNotes: deliveryNoteData,

      qrDataUrl,

      bottomCode: record.uniq_code,

      onError: (msg) => message.error(msg),
    };
  };
  const apiEnabled = Boolean(apiBaseUrl);

  const [deleteFinishedGood, deleteState] = useDeleteFinishedGoodMutation();

  const [tab, setTab] = useState<"inventory" | "status">("inventory");
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<FinishedGoodListItem | null>(
    null,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<FinishedGoodListItem | null>(
    null,
  );

  const listQuery = useGetFinishedGoodsQuery(
    { page: currentPage, limit: pageSize },
    { skip: !apiEnabled },
  );
  const summaryQuery = useGetFinishedGoodsSummaryQuery(undefined, {
    skip: !apiEnabled,
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.pagination.total ?? items.length;

  const filteredItems = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) =>
      [
        r.uniq_code,
        r.part_number,
        r.part_name,
        r.model,
        r.wo_number,
        r.warehouse_location,
        r.uom,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, searchValue]);

  const openDetail = (record: FinishedGoodListItem) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailRecord(null);
  };

  const openEdit = (record: FinishedGoodListItem) => {
    setEditRecord(record);
    setEditOpen(true);
  };

  const closeEdit = (saved?: boolean) => {
    setEditOpen(false);
    setEditRecord(null);
    if (saved) listQuery.refetch();
  };

  const handleDelete = (record: FinishedGoodListItem) => {
    Modal.confirm({
      title: "Delete finished goods?",
      content: `UNIQ ${record.uniq_code}`,
      okText: "Delete",
      okButtonProps: { danger: true, loading: deleteState.isLoading },
      onOk: async () => {
        await deleteFinishedGood({ id: record.id }).unwrap();
        message.success("Deleted");
        listQuery.refetch();
      },
    });
  };

  const displayItems = useMemo(() => {
    // UI-only for now; keeping a dropdown like the screenshot.
    if (typeFilter === "all") return filteredItems;
    return filteredItems;
  }, [filteredItems, typeFilter]);

  const columns: ColumnsType<FinishedGoodListItem> = [
    { title: "Uniq", dataIndex: "uniq_code", key: "uniq", width: 110 },
    {
      title: "Part Number",
      dataIndex: "part_number",
      key: "part_number",
      width: 130,
    },
    {
      title: "Part Info",
      key: "part_info",
      width: 240,
      render: (_: unknown, record) => (
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-900">
            {record.part_name || "-"}
          </div>
          <div className="text-xs text-gray-500">{record.model || "-"}</div>
        </div>
      ),
    },
    {
      title: "WO Number",
      key: "wo",
      width: 140,
      render: (_: unknown, record) => (
        <span className="text-xs text-gray-700 bg-[#FAFBFC] border border-gray-200 rounded-md px-2 py-1">
          {record.wo_number || "-"}
        </span>
      ),
    },
    {
      title: "Warehouse",
      key: "warehouse",
      width: 150,
      render: (_: unknown, record) => (
        <div className="flex items-center gap-1">
          <span className="text-gray-400">
            <IoLocationOutline size={18} />
          </span>
          <span className="text-xs text-gray-600 bg-[#FAFBFC] border border-gray-200 rounded-md px-2 py-1">
            {record.warehouse_location || "-"}
          </span>
        </div>
      ),
    },
    {
      title: "Current Stock",
      key: "current_stock",
      width: 140,
      render: (_: unknown, record) => (
        <CurrentStockCell uniqCode={record.uniq_code} />
      ),
    },
    {
      title: "Stock to Kanban",
      key: "stock_to_kanban",
      width: 150,
      render: (_: unknown, record) => (
        <StockToKanbanCell uniqCode={record.uniq_code} />
      ),
    },
    {
      title: "Kanban",
      key: "kanban",
      width: 120,
      render: (_: unknown, record) => (
        <KanbanCell uniqCode={record.uniq_code} />
      ),
    },
    {
      title: "Stock Status",
      key: "stock_status",
      width: 150,
      render: (_: unknown, record) => (
        <StockStatusCell uniqCode={record.uniq_code} />
      ),
    },
    {
      title: "Last Updated",
      key: "updated_at",
      width: 180,
      render: (_: unknown, record) => (
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
      width: 120,
      fixed: "right",
      render: (_: unknown, record) => (
        <div className="flex items-center gap-1">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              router.push(
                `/finished-goods/detail?uniq_code=${encodeURIComponent(
                  record.uniq_code,
                )}`,
              );
            }}
          />
          <PrintButton
            type="text"
            size="small"
            icon={<QrcodeOutlined />}
            title="Print"
            loadOptions={() => handleGenerateQR(record)}
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              openEdit(record);
            }}
          />
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(record);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <FinishedGoodsDetailModal
        open={detailOpen}
        record={detailRecord}
        onClose={closeDetail}
        onEdit={() => {
          if (detailRecord) openEdit(detailRecord);
        }}
        onAdjustStock={() => {
          if (detailRecord) openEdit(detailRecord);
        }}
      />
      <EditFinishedGoodModal
        open={editOpen}
        record={editRecord}
        onClose={closeEdit}
      />

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total FG Items"
          value={summaryQuery.data?.total_fg_items ?? 0}
          icon={<BsBoxSeam size={30} />}
          bgColor=""
          textColor="text-blue-600"
        />
        <StatsCard
          title="Low Stock Items"
          value={summaryQuery.data?.low_stock_items ?? 0}
          icon={<FiAlertTriangle size={30} />}
          bgColor=""
          textColor="text-red-600"
        />
        <StatsCard
          title="Total Stock"
          value={summaryQuery.data?.total_stock ?? 0}
          icon={<HiOutlineArchiveBox size={30} />}
          bgColor=""
          textColor="text-green-600"
        />
        <StatsCard
          title="Active Alerts"
          value={summaryQuery.data?.active_alerts ?? 0}
          icon={<LuChartColumn size={30} />}
          bgColor=""
          textColor="text-orange-600"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 p-[2px] bg-[#F1F5F9] rounded-lg">
            <div
              onClick={() => setTab("inventory")}
              className={
                (tab === "inventory" ? "bg-white " : "") +
                "rounded-xl text-center p-1 cursor-pointer"
              }
            >
              FG Inventory
            </div>
            <div
              onClick={() => setTab("status")}
              className={
                (tab === "status" ? "bg-white " : "") +
                "rounded-xl text-center p-1 cursor-pointer"
              }
            >
              Status Monitoring
            </div>
          </div>
        </div>

        {tab === "status" ? (
          <>
            <div className="px-6 pb-4 text-xl">Status Monitoring & Alerts</div>
            <div className="pb-4 px-6 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="flex justify-center">
                <StatsCardStatus
                  title="Low Stock Items"
                  value={summaryQuery.data?.low_stock_items ?? 0}
                  icon={<FiAlertTriangle size={40} />}
                  textColor="text-red-600"
                  borderColor="border-red-600"
                />
              </div>
              <div className="flex justify-center">
                <StatsCardStatus
                  title="Total FG Items"
                  value={summaryQuery.data?.total_fg_items ?? 0}
                  icon={<BsBoxSeam size={40} />}
                  textColor="text-yellow-600"
                  borderColor="border-yellow-600"
                />
              </div>
              <div className="flex justify-center">
                <StatsCardStatus
                  title="Total Stock"
                  value={summaryQuery.data?.total_stock ?? 0}
                  icon={<HiOutlineArchiveBox size={40} />}
                  textColor="text-green-600"
                  borderColor="border-green-600"
                />
              </div>
            </div>
          </>
        ) : null}

        <div className="px-6 pt-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by Uniq or Machine Name..."
              prefix={<SearchOutlined className="text-gray-400" />}
              className="md:max-w-[520px]"
              allowClear
            />

            <div className="flex items-center gap-3">
              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 160 }}
                options={[
                  { value: "all", label: "All Types" },
                  { value: "normal", label: "Normal" },
                  { value: "low", label: "Low" },
                  { value: "overstock", label: "Overstock" },
                ]}
              />
              <Button
                icon={<DownloadOutlined />}
                onClick={() => message.info("Export (coming soon)")}
              >
                Export
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold text-gray-900">
              Finished Goods Inventory
            </div>
            <div className="text-xs text-gray-500 rounded-full border border-gray-200 px-3 py-1">
              {total} FG items tracked
            </div>
          </div>

          <Table<FinishedGoodListItem>
            rowKey={(r) => r.uuid || r.uniq_code}
            columns={columns}
            dataSource={tab === "inventory" ? displayItems : []}
            loading={apiEnabled ? listQuery.isFetching : false}
            rowSelection={{}}
            pagination={{
              current: currentPage,
              pageSize,
              total,
              showSizeChanger: true,
              onChange: (page, size) => {
                setCurrentPage(page);
                if (typeof size === "number") setPageSize(size);
              },
            }}
            scroll={{ x: 1480 }}
          />
        </div>
      </div>
    </div>
  );
}
