"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Input,
  Modal,
  Popconfirm,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  type WarehouseRecord,
  useDeleteWarehouseMutation,
  useListWarehousesQuery,
} from "@/lib/api/warehouse/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";

type WarehouseRow = {
  key: string;
  id?: string;
  warehouseId: string;
  warehouseName: string;
  type: string;
  plantId: string;
  plantLabel: string;
  createdDate: string;
};

const PLANT_LABELS: Record<string, string> = {
  "1": "Plant 1",
  "2": "Plant 2",
  "3": "Plant 3",
};

const TYPE_COLORS: Record<string, string> = {
  RM: "blue",
  "Finished Goods": "green",
  "Indirect RM": "purple",
  Subcon: "orange",
};

const pickText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const normalizePlant = (value: unknown) => {
  const raw = pickText(value);
  if (raw.startsWith("Plant ")) return raw;
  return PLANT_LABELS[raw] ?? raw ?? "-";
};

const toWarehouseRow = (record: WarehouseRecord, index: number): WarehouseRow => {
  const warehouseId = pickText(record.warehouse_uuid, record.id) || `warehouse-${index + 1}`;
  const plantId = pickText(record.plant_id);
  return {
    key: warehouseId,
    id: pickText(record.id, record.warehouse_uuid),
    warehouseId,
    warehouseName: pickText(record.warehouse_name) || "-",
    type: pickText(record.type_warehouse) || "-",
    plantId,
    plantLabel: normalizePlant(record.plant_name || plantId),
    createdDate: pickText(record.created_at) || "-",
  };
};

export default function MasterWarehousePage() {
  const router = useRouter();
  const apiEnabled = Boolean(apiBaseUrl);
  const [messageApi, contextHolder] = message.useMessage();
  const [searchValue, setSearchValue] = useState("");
  const [detailRow, setDetailRow] = useState<WarehouseRow | null>(null);

  const { data: warehouses = [], isLoading, error, refetch } = useListWarehousesQuery(undefined, {
    skip: !apiEnabled,
  });
  const [deleteWarehouse, deleteState] = useDeleteWarehouseMutation();

  const rows = useMemo(
    () => warehouses.map((warehouse, index) => toWarehouseRow(warehouse, index)),
    [warehouses]
  );

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      [row.warehouseId, row.warehouseName, row.type, row.plantLabel]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [rows, searchValue]);

  const handleDelete = async (row: WarehouseRow) => {
    if (!row.id) {
      messageApi.error("Missing warehouse id");
      return;
    }

    try {
      await deleteWarehouse(row.id).unwrap();
      messageApi.success("Warehouse deleted");
    } catch (deleteError) {
      messageApi.error(getApiErrorMessage(deleteError, "Failed to delete warehouse"));
    }
  };

  const columns: ColumnsType<WarehouseRow> = [
    {
      title: "Warehouse ID",
      dataIndex: "warehouseId",
      key: "warehouseId",
      width: 180,
      render: (value: string) => (
        <span className="inline-flex rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600">
          {value}
        </span>
      ),
    },
    {
      title: "Warehouse Name",
      dataIndex: "warehouseName",
      key: "warehouseName",
      width: 320,
      render: (value: string) => <span className="font-medium text-gray-900">{value}</span>,
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 180,
      render: (value: string) => <Tag color={TYPE_COLORS[value] ?? "default"}>{value}</Tag>,
    },
    {
      title: "Plant",
      dataIndex: "plantLabel",
      key: "plantLabel",
      width: 140,
    },
    {
      title: "Created Date",
      dataIndex: "createdDate",
      key: "createdDate",
      width: 180,
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      fixed: "right",
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetailRow(row)} />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => router.push(`/master-warehouse/create?mode=edit&id=${encodeURIComponent(row.id ?? row.warehouseId)}`)}
          />
          <Popconfirm
            title="Delete warehouse?"
            description={`Remove ${row.warehouseName}.`}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true, loading: deleteState.isLoading }}
            onConfirm={() => handleDelete(row)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {contextHolder}

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Master Warehouse</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage warehouse master data including type and plant assignment.
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push("/master-warehouse/create")}>
            Add Warehouse
          </Button>
        </div>
      </div>

      {!apiEnabled ? (
        <Alert
          type="warning"
          showIcon
          message="Backend is not configured"
          description="Set NEXT_PUBLIC_API_URL to enable warehouse list, detail, save, and delete operations."
        />
      ) : null}

      {apiEnabled && error ? (
        <Alert
          type="error"
          showIcon
          message="Failed to load warehouses"
          description={getApiErrorMessage(error, "Unable to fetch warehouse list")}
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      ) : null}

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Input
            allowClear
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search warehouse by id, name, type, or plant..."
            prefix={<SearchOutlined />}
            className="w-full md:w-[420px]"
          />
          <div className="text-xs text-gray-500">{filteredRows.length} warehouses</div>
        </div>

        <Table<WarehouseRow>
          columns={columns}
          dataSource={apiEnabled ? filteredRows : []}
          rowKey="key"
          loading={apiEnabled && isLoading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1100 }}
        />
      </div>

      <Modal
        open={Boolean(detailRow)}
        title="Warehouse Detail"
        footer={<Button onClick={() => setDetailRow(null)}>Close</Button>}
        onCancel={() => setDetailRow(null)}
      >
        {detailRow ? (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">Warehouse ID</div>
              <div className="font-medium text-gray-900">{detailRow.warehouseId}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Warehouse Name</div>
              <div className="font-medium text-gray-900">{detailRow.warehouseName}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Type</div>
              <div className="font-medium text-gray-900">{detailRow.type}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Plant</div>
              <div className="font-medium text-gray-900">{detailRow.plantLabel}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Created Date</div>
              <div className="font-medium text-gray-900">{detailRow.createdDate}</div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
