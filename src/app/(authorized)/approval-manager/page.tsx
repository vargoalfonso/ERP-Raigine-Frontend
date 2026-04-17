"use client";

import { useMemo, useState } from "react";
import { Button, Card, Segmented, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
} from "@ant-design/icons";

type ApprovalTab = "All Items" | "BOM" | "PRL" | "PO Budget" | "Stock Opname";
type ApprovalStatus = "Pending" | "Approved" | "Rejected";
type ApprovalModule = "Bill of Material" | "PRL Management" | "PO Budget" | "Stock Opname";

type ApprovalRow = {
  key: string;
  id: string;
  tab: ApprovalTab;
  module: ApprovalModule;
  itemName: string;
  itemCode: string;
  submittedBy: string;
  submittedDate: string;
  approvalStatus: ApprovalStatus;
};

const TAB_OPTIONS: ApprovalTab[] = ["All Items", "BOM", "PRL", "PO Budget", "Stock Opname"];

const approvalRows: ApprovalRow[] = [
  {
    key: "BOM-001",
    id: "BOM-001",
    tab: "BOM",
    module: "Bill of Material",
    itemName: "Bracket Plate",
    itemCode: "MB-001-LV7-A",
    submittedBy: "John Doe",
    submittedDate: "2024-04-10",
    approvalStatus: "Pending",
  },
  {
    key: "BOM-002",
    id: "BOM-002",
    tab: "BOM",
    module: "Bill of Material",
    itemName: "Bracket Bolt",
    itemCode: "MB-001-LV7-B",
    submittedBy: "Jane Smith",
    submittedDate: "2024-04-09",
    approvalStatus: "Pending",
  },
  {
    key: "BOM-003",
    id: "BOM-003",
    tab: "BOM",
    module: "Bill of Material",
    itemName: "Main Bracket",
    itemCode: "LV7-001-A",
    submittedBy: "Mike Johnson",
    submittedDate: "2024-04-01",
    approvalStatus: "Approved",
  },
  {
    key: "PRL-001",
    id: "PRL-001",
    tab: "PRL",
    module: "PRL Management",
    itemName: "Suspension Arm - Honda",
    itemCode: "LV8-002",
    submittedBy: "Sarah Lee",
    submittedDate: "2024-04-12",
    approvalStatus: "Pending",
  },
  {
    key: "PRL-002",
    id: "PRL-002",
    tab: "PRL",
    module: "PRL Management",
    itemName: "Brake Caliper - Nissan",
    itemCode: "LW0-003",
    submittedBy: "David Chen",
    submittedDate: "2024-04-11",
    approvalStatus: "Pending",
  },
  {
    key: "PRL-003",
    id: "PRL-003",
    tab: "PRL",
    module: "PRL Management",
    itemName: "Engine Mount - Toyota",
    itemCode: "LV7-001",
    submittedBy: "Emily Wang",
    submittedDate: "2024-04-05",
    approvalStatus: "Approved",
  },
  {
    key: "POB-001",
    id: "POB-001",
    tab: "PO Budget",
    module: "PO Budget",
    itemName: "PO Budget - Honda Civic Q1",
    itemCode: "POB-2024-001",
    submittedBy: "Robert Kim",
    submittedDate: "2024-04-13",
    approvalStatus: "Pending",
  },
  {
    key: "POB-002",
    id: "POB-002",
    tab: "PO Budget",
    module: "PO Budget",
    itemName: "PO Budget - Toyota Camry Q1",
    itemCode: "POB-2024-002",
    submittedBy: "Lisa Anderson",
    submittedDate: "2024-04-08",
    approvalStatus: "Approved",
  },
  {
    key: "SO-001",
    id: "SO-001",
    tab: "Stock Opname",
    module: "Stock Opname",
    itemName: "Stock Opname - WH-001 April",
    itemCode: "SO-2024-04-001",
    submittedBy: "Kevin Brown",
    submittedDate: "2024-04-12",
    approvalStatus: "Pending",
  },
  {
    key: "SO-002",
    id: "SO-002",
    tab: "Stock Opname",
    module: "Stock Opname",
    itemName: "Stock Opname - WH-002 April",
    itemCode: "SO-2024-04-002",
    submittedBy: "Anna Wilson",
    submittedDate: "2024-04-07",
    approvalStatus: "Rejected",
  },
  {
    key: "SO-003",
    id: "SO-003",
    tab: "Stock Opname",
    module: "Stock Opname",
    itemName: "Stock Opname - RM Area",
    itemCode: "SO-2024-04-003",
    submittedBy: "Chris Park",
    submittedDate: "2024-04-02",
    approvalStatus: "Rejected",
  },
];

const moduleTagClass: Record<ApprovalModule, string> = {
  "Bill of Material": "bg-blue-50 text-blue-600 border-blue-100",
  "PRL Management": "bg-green-50 text-green-600 border-green-100",
  "PO Budget": "bg-purple-50 text-purple-600 border-purple-100",
  "Stock Opname": "bg-orange-50 text-orange-600 border-orange-100",
};

const statusTagClass: Record<ApprovalStatus, string> = {
  Pending: "bg-amber-50 text-amber-600 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-600 border-emerald-200",
  Rejected: "bg-red-50 text-red-600 border-red-200",
};

export default function ApprovalManagerPage() {
  const [activeTab, setActiveTab] = useState<ApprovalTab>("All Items");

  const filteredRows = useMemo(() => {
    if (activeTab === "All Items") return approvalRows;
    return approvalRows.filter((row) => row.tab === activeTab);
  }, [activeTab]);

  const summary = useMemo(() => {
    return approvalRows.reduce(
      (acc, row) => {
        acc[row.approvalStatus] += 1;
        return acc;
      },
      { Pending: 0, Approved: 0, Rejected: 0 } as Record<ApprovalStatus, number>
    );
  }, []);

  const columns: ColumnsType<ApprovalRow> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 110,
      render: (value: string) => (
        <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
          {value}
        </span>
      ),
    },
    {
      title: "Module",
      dataIndex: "module",
      key: "module",
      width: 170,
      render: (value: ApprovalModule) => (
        <Tag className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${moduleTagClass[value]}`}>
          {value}
        </Tag>
      ),
    },
    {
      title: "Item Name",
      dataIndex: "itemName",
      key: "itemName",
      width: 230,
      render: (value: string) => <span className="font-medium text-gray-900">{value}</span>,
    },
    {
      title: "Item Code",
      dataIndex: "itemCode",
      key: "itemCode",
      width: 150,
      render: (value: string) => <span className="text-gray-600">{value}</span>,
    },
    {
      title: "Submitted By",
      dataIndex: "submittedBy",
      key: "submittedBy",
      width: 140,
    },
    {
      title: "Submitted Date",
      dataIndex: "submittedDate",
      key: "submittedDate",
      width: 130,
    },
    {
      title: "Approval Status",
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      width: 150,
      render: (value: ApprovalStatus) => (
        <Tag className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTagClass[value]}`}>
          {value}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 130,
      fixed: "right",
      render: (_value, row) => (
        <div className="flex items-center gap-3 text-base">
          <Button type="text" size="small" icon={<EyeOutlined />} className="text-gray-600" />
          {row.approvalStatus === "Pending" ? (
            <>
              <Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-500" />
              <Button type="text" size="small" icon={<CloseCircleOutlined />} className="text-red-500" />
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <Card className="rounded-2xl border border-gray-100 shadow-sm" bodyStyle={{ padding: 24 }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Approval Manager</h1>
            <p className="mt-1 text-gray-500">Centralized approval workflow for all modules requiring manager authorization</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="min-w-[76px] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <div className="text-3xl font-bold text-amber-600">{summary.Pending}</div>
              <div className="text-xs font-medium text-amber-600">Pending</div>
            </div>
            <div className="min-w-[76px] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <div className="text-3xl font-bold text-emerald-600">{summary.Approved}</div>
              <div className="text-xs font-medium text-emerald-600">Approved</div>
            </div>
            <div className="min-w-[76px] rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center">
              <div className="text-3xl font-bold text-red-600">{summary.Rejected}</div>
              <div className="text-xs font-medium text-red-600">Rejected</div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border border-gray-100 shadow-sm" bodyStyle={{ padding: 24 }}>
        <div className="rounded-2xl bg-gray-100 p-1">
          <Segmented
            block
            options={TAB_OPTIONS}
            value={activeTab}
            onChange={(value) => setActiveTab(value as ApprovalTab)}
            className="approval-manager-segmented"
          />
        </div>

        <div className="mt-6">
          <Table<ApprovalRow>
            columns={columns}
            dataSource={filteredRows}
            pagination={{ pageSize: 10 }}
            rowKey="key"
            scroll={{ x: 1280 }}
          />
        </div>
      </Card>

      <style jsx global>{`
        .approval-manager-segmented .ant-segmented-group {
          gap: 8px;
        }
        .approval-manager-segmented .ant-segmented-item {
          min-height: 38px;
          border-radius: 9999px;
          color: #374151;
          font-weight: 600;
        }
        .approval-manager-segmented .ant-segmented-item-selected {
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
        }
      `}</style>
    </div>
  );
}
