"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Modal, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { EyeOutlined, PlusOutlined } from "@ant-design/icons";

type ReasonOption =
  | "Production Use"
  | "Quality Testing"
  | "Sample Request"
  | "Rework"
  | "Maintenance"
  | "Others";

type Unit = "Kg" | "Pcs" | "Box" | "Pallet" | "Roll" | "Meter";

type OutgoingRow = {
  id: string;
  transactionId: string;
  date: string;
  rmCode: string;
  rmName: string;
  packingList: string;
  qtyOutKg: number;
  stockBeforeKg: number;
  stockAfterKg: number;
  unit: Unit;
  reason: ReasonOption;
  requestedBy: string;
  approvedBy: string;
  destination: string;
  purpose: string;
  workOrder: string;
  remarks?: string;
};

const initialRows: OutgoingRow[] = [
  {
    id: "1",
    transactionId: "OUT-RM-001",
    date: "2024-12-16",
    rmCode: "RM-PL-98795",
    rmName: "Steel Wire - Grade A",
    packingList: "PL-345678",
    qtyOutKg: 150,
    stockBeforeKg: 500,
    stockAfterKg: 350,
    unit: "Kg",
    reason: "Production Use",
    requestedBy: "John Doe",
    approvedBy: "Manager A",
    destination: "Production Line A",
    purpose: "Work Order WO-2024-045",
    workOrder: "WO-2024-045",
  },
  {
    id: "2",
    transactionId: "OUT-RM-002",
    date: "2024-12-15",
    rmCode: "RM-PL-28690",
    rmName: "Aluminum Sheet - 2mm",
    packingList: "PL-112233",
    qtyOutKg: 75,
    stockBeforeKg: 300,
    stockAfterKg: 225,
    unit: "Kg",
    reason: "Quality Testing",
    requestedBy: "Jane Smith",
    approvedBy: "Manager A",
    destination: "QC Lab",
    purpose: "Quality Testing",
    workOrder: "WO-2024-046",
  },
  {
    id: "3",
    transactionId: "OUT-RM-003",
    date: "2024-12-14",
    rmCode: "RM-PL-398456",
    rmName: "Copper Wire - 1.5mm",
    packingList: "PL-998877",
    qtyOutKg: 200,
    stockBeforeKg: 800,
    stockAfterKg: 600,
    unit: "Kg",
    reason: "Production Use",
    requestedBy: "Mike Johnson",
    approvedBy: "Manager A",
    destination: "Production Line B",
    purpose: "Work Order WO-2024-047",
    workOrder: "WO-2024-047",
  },
  {
    id: "4",
    transactionId: "OUT-RM-004",
    date: "2024-12-14",
    rmCode: "RM-PL-512389",
    rmName: "Plastic Resin - ABS",
    packingList: "PL-556677",
    qtyOutKg: 50,
    stockBeforeKg: 250,
    stockAfterKg: 200,
    unit: "Kg",
    reason: "Sample Request",
    requestedBy: "Sarah Lee",
    approvedBy: "Manager A",
    destination: "R&D",
    purpose: "Sample Request",
    workOrder: "WO-2024-048",
  },
  {
    id: "5",
    transactionId: "OUT-RM-005",
    date: "2024-12-14",
    rmCode: "RM-PL-98795",
    rmName: "Steel Wire - Grade A",
    packingList: "PL-223344",
    qtyOutKg: 100,
    stockBeforeKg: 650,
    stockAfterKg: 550,
    unit: "Kg",
    reason: "Rework",
    requestedBy: "Tom Wilson",
    approvedBy: "Manager A",
    destination: "Rework Area",
    purpose: "Rework",
    workOrder: "WO-2024-049",
  },
];

const reasonOptions: ReasonOption[] = [
  "Production Use",
  "Quality Testing",
  "Sample Request",
  "Rework",
  "Maintenance",
  "Others",
];

const unitOptions: Unit[] = ["Kg", "Pcs", "Box", "Pallet", "Roll", "Meter"];

const packingCatalog: Array<{
  packingList: string;
  rmCode: string;
  rmName: string;
  currentStock: number;
  unit: Unit;
}> = [
  { packingList: "PL-345678", rmCode: "RM-PL-69795", rmName: "Steel Wire - Grade A", currentStock: 500, unit: "Kg" },
  { packingList: "PL-112233", rmCode: "RM-PL-28693", rmName: "Aluminum Sheet - 2mm", currentStock: 300, unit: "Kg" },
  { packingList: "PL-998877", rmCode: "RM-PL-398456", rmName: "Copper Wire - 1.5mm", currentStock: 800, unit: "Kg" },
  { packingList: "PL-556677", rmCode: "RM-PL-512389", rmName: "Plastic Resin - ABS", currentStock: 250, unit: "Kg" },
  { packingList: "PL-223344", rmCode: "RM-PL-69795", rmName: "Steel Wire - Grade A", currentStock: 650, unit: "Kg" },
];

type OutgoingFormValues = {
  packingList: string;
  rmCode: string;
  rmName: string;
  currentStock: number;
  unit: Unit;
  qtyOut: number;
  reason: string;
  purpose?: string;
  workOrder?: string;
  destination?: string;
  remarks?: string;
};

export default function OutgoingRawMaterialPage() {
  const [rows, setRows] = useState<OutgoingRow[]>(initialRows);
  const [reasonFilter, setReasonFilter] = useState<ReasonOption | "ALL">("ALL");
  const [trxOpen, setTrxOpen] = useState(false);
  const [form] = Form.useForm<OutgoingFormValues>();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<OutgoingRow | null>(null);

  const data = useMemo(() => {
    if (reasonFilter === "ALL") return rows;
    return rows.filter((r) => r.reason === reasonFilter);
  }, [reasonFilter, rows]);

  const openTrx = () => {
    setTrxOpen(true);
    form.setFieldsValue({
      unit: "Kg",
      currentStock: 0,
      qtyOut: 0,
    });
  };

  const closeTrx = () => {
    setTrxOpen(false);
    form.resetFields();
  };

  const handleProcess = async () => {
    const values = await form.validateFields();

    const now = new Date();
    const date = now.toISOString().slice(0, 10);

    const nextId = String(rows.length + 1);
    const txNumber = `OUT-RM-${String(rows.length + 1).padStart(3, "0")}`;

    const stockBefore = Number(values.currentStock ?? 0);
    const qtyOut = Number(values.qtyOut ?? 0);
    const stockAfter = Math.max(0, stockBefore - qtyOut);

    const nextRow: OutgoingRow = {
      id: nextId,
      transactionId: txNumber,
      date,
      rmCode: values.rmCode,
      rmName: values.rmName,
      packingList: values.packingList,
      qtyOutKg: qtyOut,
      stockBeforeKg: stockBefore,
      stockAfterKg: stockAfter,
      unit: values.unit,
      reason: (values.reason as ReasonOption) ?? "Production Use",
      requestedBy: "Admin PPIC",
      approvedBy: "Manager A",
      destination: values.destination || "-",
      purpose: values.purpose || "-",
      workOrder: values.workOrder || "-",
      remarks: values.remarks,
    };

    setRows((prev) => [nextRow, ...prev]);
    message.success("Outgoing transaction created");
    closeTrx();
  };

  const openDetail = (row: OutgoingRow) => {
    setDetailRow(row);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailRow(null);
  };

  const columns: ColumnsType<OutgoingRow> = [
    {
      title: "Transaction ID",
      dataIndex: "transactionId",
      key: "transactionId",
      width: 140,
      render: (v: string) => <span className="font-medium text-gray-900">{v}</span>,
    },
    { title: "Date", dataIndex: "date", key: "date", width: 120 },
    {
      title: "RM Info",
      dataIndex: "rmName",
      key: "rmInfo",
      width: 260,
      render: (_: unknown, r: OutgoingRow) => (
        <div className="text-gray-800">
          <div className="font-medium">{r.rmCode}</div>
          <div className="text-gray-500">{r.rmName}</div>
        </div>
      ),
    },
    {
      title: "Qty Out",
      dataIndex: "qtyOutKg",
      key: "qtyOutKg",
      width: 110,
      align: "right",
      render: (_: number, r: OutgoingRow) => (
        <span className="text-red-600 font-medium">- {r.qtyOutKg} {r.unit}</span>
      ),
    },
    {
      title: "Stock Before",
      dataIndex: "stockBeforeKg",
      key: "stockBeforeKg",
      width: 120,
      align: "right",
      render: (_: number, r: OutgoingRow) => `${r.stockBeforeKg} ${r.unit}`,
    },
    {
      title: "Stock After",
      dataIndex: "stockAfterKg",
      key: "stockAfterKg",
      width: 110,
      align: "right",
      render: (_: number, r: OutgoingRow) => `${r.stockAfterKg} ${r.unit}`,
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      width: 140,
      render: (v: ReasonOption) => (
        <Tag className="bg-blue-50 text-blue-700 border-blue-100">{v}</Tag>
      ),
    },
    { title: "Requested By", dataIndex: "requestedBy", key: "requestedBy", width: 140 },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      fixed: "right",
      render: (_: unknown, r: OutgoingRow) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          className="text-gray-500"
          onClick={() => openDetail(r)}
        />
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <Modal
        title={
          <div>
            <div className="text-sm font-bold text-slate-900">Outgoing RM Transaction - {detailRow?.transactionId}</div>
            <div className="text-xs text-slate-500 mt-0.5">Complete information about this outgoing transaction</div>
          </div>
        }
        open={detailOpen}
        onCancel={closeDetail}
        footer={null}
        width={560}
        destroyOnClose
      >
        {detailRow && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Transaction Date</div>
                <div className="text-sm text-slate-900 mt-1">{detailRow.date}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Reason</div>
                <Tag className="!mt-1 !rounded-md !border-blue-200 !bg-blue-600 !text-white">{detailRow.reason}</Tag>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Raw Material Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">RM Code</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.rmCode}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">RM Name</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.rmName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Packing List</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.packingList}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Transaction Details</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Quantity Out</div>
                  <div className="text-sm font-semibold text-red-600 mt-1">- {detailRow.qtyOutKg} {detailRow.unit}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Purpose</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.purpose}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Stock Before</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.stockBeforeKg} {detailRow.unit}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Stock After</div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">{detailRow.stockAfterKg} {detailRow.unit}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Destination</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.destination}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Work Order</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.workOrder}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Approval Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Requested By</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.requestedBy}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Approved By</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.approvedBy}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Process Outgoing Raw Material"
        open={trxOpen}
        onCancel={closeTrx}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeTrx}>Cancel</Button>
            <Button type="primary" onClick={handleProcess}>
              Process Outgoing RM
            </Button>
          </div>
        }
        width={560}
        destroyOnClose
      >
        <div className="text-gray-500 text-sm mb-3">
          Scan packing list or manually enter raw material outgoing information
        </div>

        <Form form={form} layout="vertical">
          <Form.Item label="Packing List RM" name="packingList" rules={[{ required: true }]}>
            <Input
              placeholder="Scan or enter packing list"
              onChange={(e) => {
                const v = e.target.value?.trim();
                const found = packingCatalog.find((x) => x.packingList.toLowerCase() === v.toLowerCase());
                if (!found) return;
                form.setFieldsValue({
                  packingList: found.packingList,
                  rmCode: found.rmCode,
                  rmName: found.rmName,
                  currentStock: found.currentStock,
                  unit: found.unit,
                });
              }}
            />
          </Form.Item>

          <div className="text-gray-900 font-semibold mb-2">Raw Material Information</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="RM Code" name="rmCode" rules={[{ required: true }]}>
              <Input placeholder="Auto-filled or input manual" />
            </Form.Item>

            <Form.Item label="RM Name" name="rmName" rules={[{ required: true }]}>
              <Input placeholder="Auto-filled or input manual" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Current Stock" name="currentStock" rules={[{ required: true }]}>
              <InputNumber className="w-full" min={0} placeholder="Auto-filled" />
            </Form.Item>

            <Form.Item label="Unit" name="unit" rules={[{ required: true }]}>
              <Select
                placeholder="Select Unit"
                options={unitOptions.map((u) => ({ label: u, value: u }))}
              />
            </Form.Item>
          </div>

          <div className="text-gray-900 font-semibold mb-2">Outgoing Transaction Details</div>

          <Form.Item
            label="Quantity Out"
            name="qtyOut"
            rules={[
              { required: true },
              {
                validator: async (_, value) => {
                  const stock = Number(form.getFieldValue("currentStock") ?? 0);
                  const qty = Number(value ?? 0);
                  if (qty > stock) throw new Error("Quantity out cannot exceed current stock");
                },
              },
            ]}
          >
            <InputNumber className="w-full" min={0} placeholder="Enter quantity to decrease" />
          </Form.Item>

          <Form.Item label="Reason" name="reason" rules={[{ required: true, message: "Select reason" }]}>
            <Select
              placeholder="Select reason"
              options={reasonOptions.map((r) => ({ label: r, value: r }))}
            />
          </Form.Item>

          <Form.Item label="Purpose" name="purpose" rules={[{ required: true, message: "Purpose is required" }]}>
            <Input placeholder="Describe the purpose (e.g., Work Order WO-2024-045)" />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Work Order Number" name="workOrder">
              <Input placeholder="Optional - if related to WO" />
            </Form.Item>

            <Form.Item label="Destination Location" name="destination">
              <Input placeholder="e.g., Production Line A, QC Lab" />
            </Form.Item>
          </div>

          <Form.Item label="Remarks" name="remarks">
            <Input.TextArea rows={3} placeholder="Additional notes or comments" />
          </Form.Item>

          <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-sm">
            <div className="text-red-700 font-medium mb-1">Important:</div>
            <div className="text-red-700">
              This transaction will immediately decrease the raw material stock quantity.
              The database will be updated and logged for tracking purposes.
            </div>
          </div>
        </Form>
      </Modal>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outgoing - Raw Material</h1>
          <p className="text-gray-600">
            Track and manage raw material quantity decrements with detailed history logs
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openTrx}>
          New Outgoing Transaction
        </Button>
      </div>

      <Card className="rounded-lg shadow-sm" styles={{ body: { padding: 16 } }}>
        <div className="flex items-center gap-2 text-sm text-gray-700 mb-4">
          <span className="font-medium">Outgoing Raw Material Management</span>
          <span className="text-gray-400">—</span>
          <span className="text-gray-500">Process outgoing raw materials and track all quantity decrements</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Filter by Reason:</span>
            <Select
              value={reasonFilter}
              onChange={(v) => setReasonFilter(v as ReasonOption | "ALL")}
              style={{ width: 200 }}
              options={[
                { label: "All Transactions", value: "ALL" },
                ...reasonOptions.map((r) => ({ label: r, value: r })),
              ]}
            />
          </div>
        </div>

        <div className="mt-4" style={{ overflowX: "auto" }}>
          <Table<OutgoingRow>
            columns={columns}
            dataSource={data}
            rowKey="id"
            pagination={false}
            scroll={{ x: "max-content" }}
          />
        </div>
      </Card>
    </div>
  );
}
