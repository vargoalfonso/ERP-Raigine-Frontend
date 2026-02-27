"use client";

import { useMemo, useState } from "react";
import { Button, DatePicker, Input, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { LeftOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs, { Dayjs } from "dayjs";

type PoItemRow = {
  key: string;
  uniq: string;
  partNumber: string;
  partName: string;
  model: string;
  qty: number;
  uom: string;
  packingNumber: string;
  pcsPerKanban: number;
  budgetPoIdr: number;
};

const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);
const formatIdr = (n: number) => `${formatNumber(n)} IDR`;

export default function CreatePoProcurementPage() {
  const router = useRouter();

  const [period, setPeriod] = useState<Dayjs | null>(dayjs("2024-01-01"));
  const [totalIncoming, setTotalIncoming] = useState<string>("245");
  const [dnCreated, setDnCreated] = useState<string>("12");
  const [dnIncoming, setDnIncoming] = useState<string>("4");

  const [poBudget, setPoBudget] = useState<string | undefined>(undefined);
  const [poSequence, setPoSequence] = useState<string | undefined>(undefined);
  const [supplier, setSupplier] = useState<string | undefined>("Supplier A");

  const poBudgetOptions = useMemo(
    () => [
      { label: "Budget 2024", value: "Budget 2024" },
      { label: "Budget 2025", value: "Budget 2025" },
    ],
    []
  );

  const poSequenceOptions = useMemo(
    () => [
      { label: "Sequence 1", value: "Sequence 1" },
      { label: "Sequence 2", value: "Sequence 2" },
    ],
    []
  );

  const supplierOptions = useMemo(
    () => [
      { label: "Supplier A", value: "Supplier A" },
      { label: "Supplier B", value: "Supplier B" },
    ],
    []
  );

  const baseItems: PoItemRow[] = useMemo(
    () => [
      {
        key: "1",
        uniq: "LV-001",
        partNumber: "SP-001-A",
        partName: "Steel Plate",
        model: "Camry 2024",
        qty: 100,
        uom: "pcs",
        packingNumber: "KBN-084-2024",
        pcsPerKanban: 20,
        budgetPoIdr: 100_000_000,
      },
      {
        key: "2",
        uniq: "LV-001",
        partNumber: "SP-001-A",
        partName: "Steel Plate",
        model: "Camry 2024",
        qty: 100,
        uom: "pcs",
        packingNumber: "KBN-084-2024",
        pcsPerKanban: 20,
        budgetPoIdr: 10_000_000,
      },
      {
        key: "3",
        uniq: "LV-001",
        partNumber: "SP-001-A",
        partName: "Steel Plate",
        model: "Camry 2024",
        qty: 100,
        uom: "pcs",
        packingNumber: "KBN-084-2024",
        pcsPerKanban: 20,
        budgetPoIdr: 5_000_000,
      },
      {
        key: "4",
        uniq: "LV-001",
        partNumber: "SP-001-A",
        partName: "Steel Plate",
        model: "Camry 2024",
        qty: 100,
        uom: "pcs",
        packingNumber: "KBN-084-2024",
        pcsPerKanban: 20,
        budgetPoIdr: 20_000_000,
      },
      {
        key: "5",
        uniq: "LV-001",
        partNumber: "SP-001-A",
        partName: "Steel Plate",
        model: "Camry 2024",
        qty: 100,
        uom: "pcs",
        packingNumber: "KBN-084-2024",
        pcsPerKanban: 20,
        budgetPoIdr: 90_000_000,
      },
    ],
    []
  );

  const poGroups = useMemo(
    () => [
      {
        id: "PO-RM-XXX",
        supplierName: "PT Supplier Raw Material",
        totalQty: 3000,
        totalUniq: 15,
        items: baseItems.map((r) => ({ ...r, key: `xxx-${r.key}` })),
      },
      {
        id: "PO-RM-YYYY",
        supplierName: "PT Supplier Raw Material B",
        totalQty: 3000,
        totalUniq: 15,
        items: baseItems.map((r) => ({ ...r, key: `yyyy-${r.key}` })),
      },
    ],
    [baseItems]
  );

  const columns: ColumnsType<PoItemRow> = [
    { title: "Uniq", dataIndex: "uniq", key: "uniq", width: 90 },
    { title: "Part Number", dataIndex: "partNumber", key: "partNumber", width: 120 },
    { title: "Part Name", dataIndex: "partName", key: "partName", width: 140 },
    { title: "Model", dataIndex: "model", key: "model", width: 110 },
    { title: "Qty", dataIndex: "qty", key: "qty", width: 80 },
    { title: "UoM", dataIndex: "uom", key: "uom", width: 80 },
    {
      title: "Packing Number",
      dataIndex: "packingNumber",
      key: "packingNumber",
      width: 140,
      render: (v: string) => <span className="text-blue-600">{v}</span>,
    },
    { title: "Pcs/Kanban", dataIndex: "pcsPerKanban", key: "pcsPerKanban", width: 110 },
    {
      title: "Budget PO",
      dataIndex: "budgetPoIdr",
      key: "budgetPoIdr",
      width: 140,
      align: "right",
      render: (v: number) => <span className="text-xs text-gray-700">{formatIdr(v)}</span>,
    },
  ];

  const handleGeneratePo = () => {
    if (!poBudget) return message.error("Select PO Budget");
    if (!poSequence) return message.error("Select Sequence");
    if (!supplier) return message.error("Select Supplier");
    message.success("PO generated (mock)");
  };

  const handleSave = () => {
    message.success("PO saved (mock)");
    router.push("/po-procurement");
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.push("/po-procurement")}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <LeftOutlined />
          Back to PO Raw Material
        </button>

        <div className="flex items-center gap-2">
          <Button className="!rounded-lg" onClick={() => router.push("/po-procurement")}>
            Cancel
          </Button>
          <Button type="primary" className="!rounded-lg" onClick={handleSave}>
            Save PO
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-xl font-bold text-gray-900">PO Raw Material Management</div>
          <div className="text-sm text-gray-500">Initialize new PO Raw Material &nbsp;•&nbsp; 1 entry</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Step 1: Input General Data</div>
              <div className="text-xs text-gray-500">Input General Data</div>
            </div>
            <Tag color="blue" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
              Required
            </Tag>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Period</div>
              <DatePicker
                picker="month"
                format="MM/YYYY"
                value={period}
                onChange={(v) => setPeriod(v)}
                className="w-full !rounded-lg"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Total Incoming</div>
              <Input value={totalIncoming} onChange={(e) => setTotalIncoming(e.target.value)} className="!rounded-lg" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">DN Created</div>
              <Input value={dnCreated} onChange={(e) => setDnCreated(e.target.value)} className="!rounded-lg" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">DN Incoming</div>
              <Input value={dnIncoming} onChange={(e) => setDnIncoming(e.target.value)} className="!rounded-lg" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Step 2: Input Data</div>
              <div className="text-xs text-gray-500">Input Data for each items</div>
            </div>
            <Tag color="blue" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
              Entry 1
            </Tag>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">PO Budget</div>
              <Select
                value={poBudget}
                onChange={setPoBudget}
                options={poBudgetOptions}
                placeholder="Select PO Budget"
                className="w-full"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">PO Sequence</div>
              <Select
                value={poSequence}
                onChange={setPoSequence}
                options={poSequenceOptions}
                placeholder="Select Sequence"
                className="w-full"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Supplier</div>
              <Select
                value={supplier}
                onChange={setSupplier}
                options={supplierOptions}
                placeholder="Supplier"
                className="w-full"
              />
            </div>
            <div className="flex items-end">
              <Button type="primary" className="!rounded-lg w-full" icon={<PlusOutlined />} onClick={handleGeneratePo}>
                Generate PO
              </Button>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {poGroups.map((g, idx) => (
              <div key={g.id} className={idx === 0 ? "" : "pt-4 border-t border-gray-100"}>
                <div className="text-sm font-semibold text-gray-900">PO 1: {g.id}</div>

                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Supplier</div>
                    <div className="text-sm font-semibold text-gray-800">{g.supplierName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Quantity</div>
                    <div className="text-sm font-semibold text-gray-800">{formatNumber(g.totalQty)} pcs</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Uniq</div>
                    <div className="text-sm font-semibold text-gray-800">{formatNumber(g.totalUniq)}</div>
                  </div>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-gray-100">
                  <Table<PoItemRow>
                    columns={columns}
                    dataSource={g.items}
                    rowKey="key"
                    size="middle"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
