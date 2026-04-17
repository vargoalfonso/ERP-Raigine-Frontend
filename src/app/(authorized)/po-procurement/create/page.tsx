"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Button, DatePicker, Input, InputNumber, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { LeftOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs, { Dayjs } from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  useGenerateProcurementPoMutation,
  type ProcurementPoType,
} from "@/lib/api/procurement-po/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetPoBudgetListQuery, type PoBudgetType } from "@/lib/api/po-budget/api";

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

const pad3 = (n: number) => String(n).padStart(3, "0");

const tabToPoType = (tab: string | null): ProcurementPoType => {
  if (tab === "indirect") return "indirect";
  if (tab === "subcon") return "subcon";
  return "raw_material";
};

const procurementTypeToBudgetType = (type: ProcurementPoType): PoBudgetType => {
  if (type === "raw_material") return "raw-material";
  if (type === "subcon") return "subcon";
  return "indirect";
};

function CreatePoProcurementPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apiEnabled = Boolean(apiBaseUrl);
  const [generatePo, generatePoState] = useGenerateProcurementPoMutation();

  const poType = useMemo(() => tabToPoType(searchParams.get("tab")), [searchParams]);
  const poBudgetType = useMemo(() => procurementTypeToBudgetType(poType), [poType]);
  const returnUrl = useMemo(() => {
    const tab = searchParams.get("tab");
    if (!tab) return "/po-procurement";
    return `/po-procurement?tab=${encodeURIComponent(tab)}`;
  }, [searchParams]);

  const [period, setPeriod] = useState<Dayjs | null>(dayjs("2024-01-01"));
  const [totalIncoming, setTotalIncoming] = useState<number>(0);
  const [dnCreated, setDnCreated] = useState<number>(0);
  const [dnIncoming, setDnIncoming] = useState<number>(0);

  const [selectedBudgetIds, setSelectedBudgetIds] = useState<number[]>([]);
  const [externalSystem, setExternalSystem] = useState<string>("zahir");
  const [externalPoNumber, setExternalPoNumber] = useState<string>("");
  const [generateMode, setGenerateMode] = useState<string>("both_stages");

  const poBudgetQuery = useGetPoBudgetListQuery(
    { type: poBudgetType, page: 1, limit: 100 },
    { skip: !apiEnabled },
  );

  const poBudgetOptions = useMemo<{ label: string; value: number }[]>(() => {
    if (!apiEnabled) {
      return [
        { label: "PO Budget Mock 1", value: 1 },
        { label: "PO Budget Mock 2", value: 2 },
      ];
    }

    return (poBudgetQuery.data?.data ?? []).map((row) => ({
      label: `${row.poBudgetRef ?? row.id ?? row.key} - ${row.uniq} - ${row.supplier}`,
      value: Number(row.id ?? row.key),
    }));
  }, [apiEnabled, poBudgetQuery.data?.data]);

  const poSequenceOptions = useMemo(
    () => [
      { label: "Both Stages", value: "both_stages" },
      { label: "Stage 1", value: "stage_1" },
      { label: "Stage 2", value: "stage_2" },
    ],
    []
  );

  const baseItems: PoItemRow[] = useMemo(() => {
    const selectedRows = (poBudgetQuery.data?.data ?? []).filter((row) =>
      selectedBudgetIds.includes(Number(row.id ?? row.key)),
    );

    if (!selectedRows.length) return [];

    return selectedRows.map((row, index) => ({
      key: String(row.id ?? row.key ?? index + 1),
      uniq: row.uniq,
      partNumber: row.partNumber ?? "-",
      partName: row.partName,
      model: row.productModel,
      qty: row.totalPo || row.pr || row.salesPlan || 0,
      uom: row.uom ?? "-",
      packingNumber: row.poBudgetRef ?? "-",
      pcsPerKanban: 0,
      budgetPoIdr: row.totalPo || 0,
    }));
  }, [poBudgetQuery.data?.data, selectedBudgetIds]);

  const poGroups = useMemo(
    () => [
      {
        id: "(auto)",
        supplierName: baseItems[0]?.partName ? "Auto from PO Budget" : "-",
        totalQty: baseItems.reduce((sum, r) => sum + (r.qty || 0), 0),
        totalUniq: baseItems.length,
        items: baseItems.map((r) => ({ ...r, key: `xxx-${r.key}` })),
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
    if (!selectedBudgetIds.length) return message.error("Select PO Budget entries");
    if (!generateMode) return message.error("Select generate mode");
    message.success("PO data prepared");
  };

  const handleSave = async () => {
    if (!period) {
      message.error("Period is required");
      return;
    }

    if (!selectedBudgetIds.length) {
      message.error("PO Budget entries are required");
      return;
    }

    if (!apiEnabled) {
      message.success("PO saved (mock)");
      router.replace(returnUrl);
      router.refresh();
      return;
    }

    try {
      await generatePo({
        po_type: poType,
        period: period.format("YYYY-MM"),
        po_budget_entry_ids: selectedBudgetIds,
        external_system: externalSystem,
        external_po_number: externalPoNumber || undefined,
        generate_mode: generateMode,
      }).unwrap();

      message.success("PO generated successfully");
      router.replace(returnUrl);
      router.refresh();
    } catch (e) {
      message.error(getApiErrorMessage(e, "Failed to generate PO"));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.push(returnUrl)}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <LeftOutlined />
          Back to PO Raw Material
        </button>

        <div className="flex items-center gap-2">
          <Button className="!rounded-lg" onClick={() => router.push(returnUrl)}>
            Cancel
          </Button>
          <Button
            type="primary"
            className="!rounded-lg"
            onClick={handleSave}
            loading={generatePoState.isLoading}
          >
            Save PO
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-xl font-bold text-gray-900">PO Procurement Management</div>
          <div className="text-sm text-gray-500">Generate purchase order from PO Budget entries</div>
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
              <InputNumber
                value={totalIncoming}
                onChange={(v) => setTotalIncoming(Number(v ?? 0))}
                className="w-full !rounded-lg"
                min={0}
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">DN Created</div>
              <InputNumber
                value={dnCreated}
                onChange={(v) => setDnCreated(Number(v ?? 0))}
                className="w-full !rounded-lg"
                min={0}
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">DN Incoming</div>
              <InputNumber
                value={dnIncoming}
                onChange={(v) => setDnIncoming(Number(v ?? 0))}
                className="w-full !rounded-lg"
                min={0}
              />
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
                mode="multiple"
                value={selectedBudgetIds}
                onChange={(values) => setSelectedBudgetIds(values.map((value) => Number(value)).filter(Number.isFinite))}
                options={poBudgetOptions}
                placeholder="Select PO Budget entries"
                className="w-full"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Generate Mode</div>
              <Select
                value={generateMode}
                onChange={setGenerateMode}
                options={poSequenceOptions}
                placeholder="Select generate mode"
                className="w-full"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">External System</div>
              <Select
                value={externalSystem}
                onChange={setExternalSystem}
                options={[{ label: "Zahir", value: "zahir" }]}
                placeholder="External system"
                className="w-full"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">External PO Number</div>
              <Input
                value={externalPoNumber}
                onChange={(event) => setExternalPoNumber(event.target.value)}
                placeholder="e.g. ZH-PO-000123"
                className="!rounded-lg"
              />
            </div>
            <div className="md:col-span-2 flex items-end">
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

export default function CreatePoProcurementPage() {
  return (
    <Suspense fallback={null}>
      <CreatePoProcurementPageContent />
    </Suspense>
  );
}
