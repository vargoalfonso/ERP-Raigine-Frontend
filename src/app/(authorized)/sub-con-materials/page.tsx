"use client";

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal, Table, Tag, message } from "antd";
import { DeleteOutlined, EyeOutlined, FilterOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { type InventoryRecord, useGetInventoryListQuery } from "@/lib/api/inventory/api";

type SubconMaterialRow = {
  id: string;
  uniq: string;
  partNumber: string;
  partName: string;
  warehouse: string;
  source: string;
  currentStock: number;
  status: "NORMAL" | "LOW STOCK";
};

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;
const isMissingRouteError = (error: unknown): boolean => isRecord(error) && error.status === 404;

const mapInventoryToRow = (record: InventoryRecord): SubconMaterialRow => {
  const currentStock = Number(record.stock_qty ?? 0);
  return {
    id: record.id,
    uniq: record.uniq_code ?? "-",
    partNumber: record.part_number ?? "-",
    partName: record.part_name ?? record.item_name ?? record.uniq_code ?? "-",
    warehouse: record.warehouse_location ?? "-",
    source: record.rm_source ?? "-",
    currentStock,
    status: currentStock > 20 ? "NORMAL" : "LOW STOCK",
  };
};

const initialRows: SubconMaterialRow[] = [
  {
    id: "SUB-001",
    uniq: "SUB-001",
    partNumber: "SUB-PLT-001",
    partName: "Plating Process - Bracket",
    warehouse: "-",
    source: "DN-SUB-2025-001",
    currentStock: 2500,
    status: "NORMAL",
  },
];

export default function SubConMaterialsPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SubconMaterialRow[]>(initialRows);
  const apiEnabled = Boolean(apiBaseUrl);

  const listQuery = useGetInventoryListQuery(
    { type: "subcon-materials", page: 1, limit: 20 },
    { skip: !apiEnabled }
  );

  useEffect(() => {
    if (!apiEnabled || !listQuery.error) return;
    if (isMissingRouteError(listQuery.error)) {
      messageApi.warning("Inventory subcon-materials API route is not available yet; showing mock data.");
      return;
    }
    messageApi.error(getApiErrorMessage(listQuery.error, "Failed to load subcon materials inventory"));
  }, [apiEnabled, listQuery.error, messageApi]);

  const inventoryRows = useMemo(() => {
    if (!apiEnabled || isMissingRouteError(listQuery.error)) return rows;
    const items = listQuery.data?.data ?? [];
    if (!items.length) return [];
    return items.map(mapInventoryToRow);
  }, [apiEnabled, listQuery.data, listQuery.error, rows]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<SubconMaterialRow | null>(null);

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

  const openDelete = (row: SubconMaterialRow) => {
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

  const columns: ColumnsType<SubconMaterialRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      width: 90,
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
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
      width: 200,
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse",
      key: "warehouse",
      width: 120,
    },
    {
      title: "Source",
      dataIndex: "source",
      key: "source",
      width: 160,
    },
    {
      title: "Current Stock",
      dataIndex: "currentStock",
      key: "currentStock",
      width: 130,
      align: "right",
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: SubconMaterialRow["status"]) => {
        if (v === "LOW STOCK") return <Tag className="bg-red-50 text-red-600">LOW STOCK</Tag>;
        return <Tag className="bg-green-50 text-green-600">NORMAL</Tag>;
      },
    },
    {
      title: "Action",
      key: "action",
      width: 90,
      fixed: "right",
      render: (_: unknown, row: SubconMaterialRow) => (
        <div className="flex items-center gap-1">
          <Button
            type="text"
            icon={<EyeOutlined />}
            className="text-blue-600 hover:text-blue-800"
            onClick={() =>
              router.push(
                `/sub-con-materials/detail?id=${encodeURIComponent(row.id)}&uniq=${encodeURIComponent(row.uniq)}`
              )
            }
          />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => openDelete(row)} />
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
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{deletingRow?.uniq}</span>.
        </div>
      </Modal>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sub Con Materials Inventory</h1>
          <p className="text-gray-600">Track subcon materials inventory</p>
        </div>

        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push("/sub-con-materials/create")}>
          Add Material
        </Button>
      </div>

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
          <Table<SubconMaterialRow>
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
