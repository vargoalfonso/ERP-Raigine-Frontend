"use client";

import { useMemo, useState } from "react";
import { Button, DatePicker, Input, InputNumber, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { LeftOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs, { Dayjs } from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { useCreateProcurementPoMutation } from "@/lib/api/procurement-po/api";
import { getApiErrorMessage } from "@/lib/api/error";

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

  const apiEnabled = Boolean(apiBaseUrl);
  const [createPo, createPoState] = useCreateProcurementPoMutation();

  const [period, setPeriod] = useState<Dayjs | null>(dayjs("2024-01-01"));

  const [poCategory, setPoCategory] = useState<"RAW_MATERIAL" | "INDIRECT_RAW_MATERIAL" | "SUBCON">("RAW_MATERIAL");
  const [poNumber, setPoNumber] = useState<string>("");
  const [supplierName, setSupplierName] = useState<string>("PT ABC");
  const [subconName, setSubconName] = useState<string>("");
  const [dataOrder, setDataOrder] = useState<string>("");
  const [dateIncoming, setDateIncoming] = useState<Dayjs | null>(dayjs());
  const [expectedArrival, setExpectedArrival] = useState<Dayjs | null>(null);
  const [totalPo, setTotalPo] = useState<number>(0);
  const [status, setStatus] = useState<string>("Open");
  const [notes, setNotes] = useState<string>("");

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

  const handleSave = async () => {
    if (!poNumber.trim()) {
      message.error("PO Number is required");
      return;
    }
    if (!period) {
      message.error("Period is required");
      return;
    }

    if (!apiEnabled) {
      message.success("PO saved (mock)");
      router.push("/po-procurement");
      return;
    }

    try {
      const created = await createPo({
        po_category: poCategory,
        month: period.format("YYYY-MM"),
        po_number: poNumber.trim(),
        supplier_name: supplierName.trim() || undefined,
        subcon_name: poCategory === "SUBCON" ? (subconName.trim() || undefined) : undefined,
        data_order: dataOrder.trim() || undefined,
        date_incoming: dateIncoming ? dateIncoming.format("YYYY-MM-DD") : undefined,
        total_po: Number.isFinite(totalPo) ? totalPo : undefined,
        expected_arrival: expectedArrival ? expectedArrival.format("YYYY-MM-DD") : undefined,
        status: status.trim() || undefined,
        notes: notes.trim() || undefined,
      }).unwrap();

      message.success("PO created");
      const createdId = created.data?.id;
      if (createdId) router.push(`/po-procurement/detail/${encodeURIComponent(createdId)}`);
      else router.push("/po-procurement");
    } catch (e) {
      message.error(getApiErrorMessage(e, "Failed to create PO"));
    }
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
          <Button type="primary" className="!rounded-lg" onClick={handleSave} loading={createPoState.isLoading}>
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
              <div className="text-xs font-semibold text-gray-700 mb-1">PO Category</div>
              <Select
                value={poCategory}
                onChange={setPoCategory}
                options={[
                  { label: "RAW_MATERIAL", value: "RAW_MATERIAL" },
                  { label: "INDIRECT_RAW_MATERIAL", value: "INDIRECT_RAW_MATERIAL" },
                  { label: "SUBCON", value: "SUBCON" },
                ]}
                className="w-full"
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">PO Number</div>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="!rounded-lg" placeholder="PO-001" />
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Status</div>
              <Select
                value={status}
                onChange={setStatus}
                options={[{ label: "Open", value: "Open" }, { label: "Closed", value: "Closed" }]}
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Supplier Name</div>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="!rounded-lg" placeholder="PT ABC" />
            </div>

            {poCategory === "SUBCON" ? (
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Subcon Name</div>
                <Input value={subconName} onChange={(e) => setSubconName(e.target.value)} className="!rounded-lg" placeholder="Vendor Subcon" />
              </div>
            ) : (
              <div />
            )}

            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Data Order</div>
              <Input value={dataOrder} onChange={(e) => setDataOrder(e.target.value)} className="!rounded-lg" placeholder="DO-001" />
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Total PO</div>
              <InputNumber value={totalPo} onChange={(v) => setTotalPo(Number(v ?? 0))} className="w-full !rounded-lg" min={0} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Date Incoming</div>
              <DatePicker value={dateIncoming} onChange={(v) => setDateIncoming(v)} className="w-full !rounded-lg" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Expected Arrival</div>
              <DatePicker value={expectedArrival} onChange={(v) => setExpectedArrival(v)} className="w-full !rounded-lg" />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-semibold text-gray-700 mb-1">Notes</div>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="!rounded-lg" placeholder="sample row" />
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
