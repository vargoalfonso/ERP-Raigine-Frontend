"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, DatePicker, InputNumber, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { LeftOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs, { Dayjs } from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { useCreateProcurementPoMutation, useLazyListProcurementPosQuery } from "@/lib/api/procurement-po/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { useListMasterSuppliersQuery } from "@/lib/api/master-supplier/api";

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

const categoryToPrefix = (category: "RAW_MATERIAL" | "INDIRECT_RAW_MATERIAL" | "SUBCON") => {
  if (category === "RAW_MATERIAL") return "PO-RM-";
  if (category === "INDIRECT_RAW_MATERIAL") return "PO-IRM-";
  return "PO-SC-";
};

const tabToCategory = (tab: string | null): "RAW_MATERIAL" | "INDIRECT_RAW_MATERIAL" | "SUBCON" => {
  if (tab === "indirect") return "INDIRECT_RAW_MATERIAL";
  if (tab === "subcon") return "SUBCON";
  return "RAW_MATERIAL";
};

const categoryToUniqPrefix = (category: "RAW_MATERIAL" | "INDIRECT_RAW_MATERIAL" | "SUBCON") => {
  if (category === "RAW_MATERIAL") return "RM";
  if (category === "INDIRECT_RAW_MATERIAL") return "IRM";
  return "SC";
};

const extractTrailingNumber = (value: string, prefix: string): number | null => {
  if (!value.startsWith(prefix)) return null;
  const rest = value.slice(prefix.length);
  const m = rest.match(/(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
};

export default function CreatePoProcurementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apiEnabled = Boolean(apiBaseUrl);
  const [createPo, createPoState] = useCreateProcurementPoMutation();
  const [triggerListPos] = useLazyListProcurementPosQuery();

  const poCategory = useMemo(() => tabToCategory(searchParams.get("tab")), [searchParams]);
  const returnUrl = useMemo(() => {
    const tab = searchParams.get("tab");
    if (!tab) return "/po-procurement";
    return `/po-procurement?tab=${encodeURIComponent(tab)}`;
  }, [searchParams]);

  const [period, setPeriod] = useState<Dayjs | null>(dayjs("2024-01-01"));
  const [totalIncoming, setTotalIncoming] = useState<number>(0);
  const [dnCreated, setDnCreated] = useState<number>(0);
  const [dnIncoming, setDnIncoming] = useState<number>(0);

  const [poBudget, setPoBudget] = useState<string | undefined>(undefined);
  const [poSequence, setPoSequence] = useState<string | undefined>(undefined);
  const [supplier, setSupplier] = useState<string | undefined>(undefined);
  const masterSuppliersQuery = useListMasterSuppliersQuery(undefined, { skip: !apiEnabled });

  const supplierOptions = useMemo(() => {
    if (!apiEnabled) {
      return [
        { label: "Supplier A", value: "Supplier A" },
        { label: "Supplier B", value: "Supplier B" },
      ];
    }
    const list = masterSuppliersQuery.data ?? [];
    return list
      .map((r) => (r.supplier_name ? String(r.supplier_name) : ""))
      .filter((v) => v.trim().length > 0)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ label: name, value: name }));
  }, [apiEnabled, masterSuppliersQuery.data]);

  useEffect(() => {
    // Default supplier selection from API list
    if (supplier) return;
    if (!supplierOptions.length) return;
    setSupplier(String(supplierOptions[0].value));
  }, [supplier, supplierOptions]);

  const poBudgetOptions = useMemo(
    () => [
      { label: "(Open PO Budget menu)", value: "" },
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

  const baseItems: PoItemRow[] = useMemo(() => {
    const uniqPrefix = categoryToUniqPrefix(poCategory);
    const items: Omit<PoItemRow, "uniq">[] = [
      {
        key: "1",
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
        partNumber: "SP-001-A",
        partName: "Steel Plate",
        model: "Camry 2024",
        qty: 100,
        uom: "pcs",
        packingNumber: "KBN-084-2024",
        pcsPerKanban: 20,
        budgetPoIdr: 90_000_000,
      },
    ];

    return items.map((it, idx) => ({
      ...it,
      uniq: `${uniqPrefix}-${pad3(idx + 1)}`,
    }));
  }, [poCategory]);

  const poGroups = useMemo(
    () => [
      {
        id: "(auto)",
        supplierName: supplier || "-",
        totalQty: baseItems.reduce((sum, r) => sum + (r.qty || 0), 0),
        totalUniq: baseItems.length,
        items: baseItems.map((r) => ({ ...r, key: `xxx-${r.key}` })),
      },
    ],
    [baseItems, supplier]
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
    message.success("PO data prepared");
  };

  const handleSave = async () => {
    if (!period) {
      message.error("Period is required");
      return;
    }

    if (!supplier?.trim()) {
      message.error("Supplier is required");
      return;
    }

    if (apiEnabled && poCategory !== "RAW_MATERIAL") {
      message.info("POST procurement backend saat ini hanya tersedia untuk Raw Material");
      return;
    }

    if (!apiEnabled) {
      message.success("PO saved (mock)");
      router.replace(returnUrl);
      router.refresh();
      return;
    }

    try {
      const prefix = categoryToPrefix(poCategory);
      const listRes = await triggerListPos({ category: poCategory }).unwrap();
      const list = listRes.data ?? [];
      let max = 0;
      for (const p of list) {
        const candidate = typeof p.po_number === "string" ? p.po_number : "";
        const n = extractTrailingNumber(candidate, prefix);
        if (n !== null && n > max) max = n;
      }

      const month = period.format("YYYY-MM");
      const nextPoNumber = (n: number) => `${prefix}${pad3(n)}`;
      const headerBase = {
        po_category: poCategory,
        month,
        supplier_name: poCategory === "SUBCON" ? undefined : supplier.trim() || undefined,
        subcon_name: poCategory === "SUBCON" ? (supplier.trim() || undefined) : undefined,

        total_incoming: Number.isFinite(totalIncoming) ? totalIncoming : undefined,
        dn_created: Number.isFinite(dnCreated) ? dnCreated : undefined,
        dn_incoming: Number.isFinite(dnIncoming) ? dnIncoming : undefined,
      };

      const items = poGroups.flatMap((g) => g.items);
      const totalPoQty = items.reduce((sum, it) => sum + (Number.isFinite(it.qty) ? Number(it.qty) : 0), 0);
      const totalBudgetPo = items.reduce((sum, it) => sum + (Number.isFinite(it.budgetPoIdr) ? Number(it.budgetPoIdr) : 0), 0);

      const po_number = nextPoNumber(max + 1);
      await createPo({
        ...headerBase,
        po_number,
        total_po: totalPoQty || undefined,
        total_budget_po: totalBudgetPo || undefined,
      }).unwrap();

      message.success(`PO created (${po_number})`);
      router.replace(returnUrl);
      router.refresh();
    } catch (e) {
      message.error(getApiErrorMessage(e, "Failed to create PO"));
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
            loading={createPoState.isLoading}
          >
            Save PO
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-xl font-bold text-gray-900">PO Procurement Management</div>
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
              <div className="text-xs font-semibold text-gray-700 mb-1">{poCategory === "SUBCON" ? "Subcon" : "Supplier"}</div>
              <Select
                value={supplier}
                onChange={setSupplier}
                options={supplierOptions}
                placeholder={poCategory === "SUBCON" ? "Subcon" : "Supplier"}
                className="w-full"
                showSearch
                filterOption={(input, option) => String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
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
