"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Modal,
  Table,
  Tag,
  message,
} from "antd";
import {
  DeleteOutlined,
  EyeOutlined,
  FilterOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

type IndirectRawMaterialRow = {
  id: string;
  uniq: string;
  partNumber: string;
  partName: string;
  warehouse: string;
  currentStock: number;
  toCompleteKanban: number;
  kanbanCount: number;
  stockDays: number;
  safetyStockDays: number;
  status: "NORMAL" | "LOW STOCK";
  buyFlag: "BUY" | "NOT BUY";
};

const initialRows: IndirectRawMaterialRow[] = [
  {
    id: "RM-001",
    uniq: "RM-001",
    partNumber: "BOLT-M8-20",
    partName: "Bolt M8-20mm",
    warehouse: "WH-A",
    currentStock: 15000,
    toCompleteKanban: 5000,
    kanbanCount: 25,
    stockDays: 10,
    safetyStockDays: 10,
    status: "NORMAL",
    buyFlag: "NOT BUY",
  },
  {
    id: "RM-002",
    uniq: "RM-002",
    partNumber: "WASHER-M8",
    partName: "Washer M8",
    warehouse: "WH-A",
    currentStock: 3000,
    toCompleteKanban: 2000,
    kanbanCount: 5,
    stockDays: 10,
    safetyStockDays: 5,
    status: "LOW STOCK",
    buyFlag: "BUY",
  },
];

export default function IndirectRawMaterialsPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<IndirectRawMaterialRow[]>(initialRows);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<IndirectRawMaterialRow | null>(
    null
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.uniq.toLowerCase().includes(q) ||
        r.partNumber.toLowerCase().includes(q) ||
        r.partName.toLowerCase().includes(q)
      );
    });
  }, [query, rows]);

  const openDelete = (row: IndirectRawMaterialRow) => {
    setDeletingRow(row);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeletingRow(null);
  };

  const confirmDelete = () => {
    if (!deletingRow) return;
    setRows((prev) => prev.filter((r) => r.id !== deletingRow.id));
    messageApi.success("Deleted");
    closeDelete();
  };

  const columns: ColumnsType<IndirectRawMaterialRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      width: 90,
      render: (v: string) => (
        <span className="text-blue-600 font-medium">{v}</span>
      ),
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
      width: 180,
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse",
      key: "warehouse",
      width: 110,
    },
    {
      title: "Current Stock",
      dataIndex: "currentStock",
      key: "currentStock",
      width: 120,
      align: "right",
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "To Complete Kanban",
      dataIndex: "toCompleteKanban",
      key: "toCompleteKanban",
      width: 150,
      align: "right",
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "Kanban Count",
      dataIndex: "kanbanCount",
      key: "kanbanCount",
      width: 120,
      align: "right",
    },
    {
      title: "Stock Days",
      dataIndex: "stockDays",
      key: "stockDays",
      width: 110,
      align: "right",
      render: (v: number) => `${v} days`,
    },
    {
      title: "Safety Stock",
      dataIndex: "safetyStockDays",
      key: "safetyStockDays",
      width: 120,
      align: "right",
      render: (v: number) => `${v} days`,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: IndirectRawMaterialRow["status"]) => {
        if (v === "LOW STOCK") {
          return <Tag className="bg-red-50 text-red-600">LOW STOCK</Tag>;
        }
        return <Tag className="bg-green-50 text-green-600">NORMAL</Tag>;
      },
    },
    {
      title: "Buy Flag",
      dataIndex: "buyFlag",
      key: "buyFlag",
      width: 110,
      render: (v: IndirectRawMaterialRow["buyFlag"]) => {
        if (v === "BUY") {
          return <Tag className="bg-blue-50 text-blue-600">BUY</Tag>;
        }
        return <Tag className="bg-gray-50 text-gray-600">NOT BUY</Tag>;
      },
    },
    {
      title: "Action",
      key: "action",
      width: 90,
      fixed: "right",
      render: (_: unknown, row: IndirectRawMaterialRow) => (
        <div className="flex items-center gap-1">
          <Button
            type="text"
            icon={<EyeOutlined />}
            className="text-blue-600 hover:text-blue-800"
            onClick={() =>
              router.push(
                `/indirect-raw-material/detail?uniq=${encodeURIComponent(row.uniq)}`
              )
            }
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => openDelete(row)}
          />
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
        <div>
          <div className="text-gray-700">
            This will remove <span className="font-semibold">{deletingRow?.uniq}</span>.
          </div>
        </div>
      </Modal>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Indirect Raw Material Database
          </h1>
          <p className="text-gray-600">
            Track indirect materials with buy/not buy recommendations
          </p>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push("/indirect-raw-material/create")}
        >
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
          <Table<IndirectRawMaterialRow>
            columns={columns}
            dataSource={filteredRows}
            rowKey="id"
            pagination={false}
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>
    </div>
  );
}
