"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, DatePicker, Input, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, SaveOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { type DnManagementType, useCreateDnManagementMutation } from "@/lib/api/dn-management/api";
import { getApiErrorMessage } from "@/lib/api/error";

type Step1Data = {
  period?: string;
  poNumber?: string;
  supplierId?: number;
  supplier?: string;
  totalPo?: number;
  totalIncoming?: number;
  dnCreated?: number;
  dnIncoming?: number;
};

type DnItemRow = {
  key: string;
  uniq: string;
  materialInfo: {
    code: string;
    name: string;
    model: string;
  };
  totalQty: number;
  remainingQty: number;
  uom: string;
  orderQty: number;
  packingNumber: string;
  pcsPerKanban: number;
  dateIncoming?: Dayjs;
};

type Step2Draft = {
  uniq?: string;
  orderQty?: number;
  uom?: string;
  packing?: string;
  pcsPerKanban?: number;
  dateIncoming?: Dayjs;
};

const PO_OPTIONS = [
  { label: "PO-RM-2024-01", value: "PO-RM-2024-01", supplier: "Autofilled" },
  { label: "PO-RM-2024-02", value: "PO-RM-2024-02", supplier: "Autofilled" },
];

const UNIQ_OPTIONS = [
  {
    label: "LV-001",
    value: "LV-001",
    material: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
    totalQty: 120,
    remainingQty: 40,
    uom: "pcs",
    packingNumber: "KBN-004-2024",
  },
  {
    label: "LV-002",
    value: "LV-002",
    material: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
    totalQty: 100,
    remainingQty: 50,
    uom: "pcs",
    packingNumber: "KBN-004-2024",
  },
  {
    label: "LV-003",
    value: "LV-003",
    material: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
    totalQty: 200,
    remainingQty: 100,
    uom: "pcs",
    packingNumber: "KBN-004-2024",
  },
  {
    label: "LV-004",
    value: "LV-004",
    material: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
    totalQty: 200,
    remainingQty: 100,
    uom: "pcs",
    packingNumber: "KBN-004-2024",
  },
];

const UOM_OPTIONS = [
  { label: "pcs", value: "pcs" },
  { label: "kg", value: "kg" },
  { label: "m", value: "m" },
];

const PACKING_OPTIONS = [
  { label: "Select Packing", value: "" },
  { label: "KBN-004-2024", value: "KBN-004-2024" },
  { label: "KBN-005-2024", value: "KBN-005-2024" },
];

function nextDnCode() {
  return "DN-RM-2024-001";
}

const tabToType = (tab: string): DnManagementType => {
  if (tab === "subcon") return "subcon";
  if (tab === "indirect") return "indirect";
  return "rm";
};

const typeCopy = (type: DnManagementType) => {
  if (type === "subcon") return { label: "SubCon", title: "DN SubCon", back: "SubCon", codePrefix: "DN-SUB" };
  if (type === "indirect") return { label: "Indirect Raw Material", title: "DN Indirect Raw Material", back: "Indirect Raw Material", codePrefix: "DN-IND" };
  return { label: "Raw Material", title: "DN Raw Material", back: "Raw Material", codePrefix: "DN-RM" };
};

export default function DnRawMaterialCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiEnabled = Boolean(apiBaseUrl);
  const dnType = tabToType((searchParams.get("tab") ?? "raw").toLowerCase());
  const copy = typeCopy(dnType);
  const [createDnManagement, { isLoading: saving }] = useCreateDnManagementMutation();

  const [step1, setStep1] = useState<Step1Data>({
    period: "01/2024",
    poNumber: "PO-RM-2024-01",
    supplierId: 1,
    supplier: "Autofilled",
    totalPo: 1000,
    totalIncoming: 950,
    dnCreated: 10,
    dnIncoming: 8,
  });

  const [draft, setDraft] = useState<Step2Draft>({});

  const [items, setItems] = useState<DnItemRow[]>(() => {
    const baseDate = undefined;
    return [
      {
        key: "LV-001",
        uniq: "LV-001",
        materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
        totalQty: 120,
        remainingQty: 40,
        uom: "pcs",
        orderQty: 40,
        packingNumber: "KBN-004-2024",
        pcsPerKanban: 40,
        dateIncoming: baseDate,
      },
      {
        key: "LV-002",
        uniq: "LV-002",
        materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
        totalQty: 100,
        remainingQty: 50,
        uom: "pcs",
        orderQty: 100,
        packingNumber: "KBN-004-2024",
        pcsPerKanban: 50,
        dateIncoming: baseDate,
      },
      {
        key: "LV-003",
        uniq: "LV-003",
        materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
        totalQty: 200,
        remainingQty: 100,
        uom: "pcs",
        orderQty: 100,
        packingNumber: "KBN-004-2024",
        pcsPerKanban: 100,
        dateIncoming: baseDate,
      },
      {
        key: "LV-004",
        uniq: "LV-004",
        materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
        totalQty: 200,
        remainingQty: 100,
        uom: "pcs",
        orderQty: 100,
        packingNumber: "KBN-004-2024",
        pcsPerKanban: 100,
        dateIncoming: baseDate,
      },
    ];
  });

  const dnCode = useMemo(() => `${copy.codePrefix}-${step1.period?.replace(/[^0-9A-Za-z]/g, "") ?? "202401"}-001`, [copy.codePrefix, step1.period]);
  const totalUniqChosen = useMemo(() => items.length, [items]);

  const onPickPo = (poValue: string) => {
    const po = PO_OPTIONS.find((p) => p.value === poValue);
    setStep1((prev) => ({
      ...prev,
      poNumber: poValue,
      supplier: po?.supplier ?? "Autofilled",
    }));
  };

  const onPickUniq = (uniq: string) => {
    const found = UNIQ_OPTIONS.find((u) => u.value === uniq);
    setDraft((prev) => ({
      ...prev,
      uniq,
      uom: found?.uom ?? prev.uom,
      packing: found?.packingNumber ?? prev.packing,
    }));
  };

  const addItem = () => {
    if (!draft.uniq) {
      message.error("Uniq is required");
      return;
    }
    if (draft.orderQty === undefined || draft.orderQty === null) {
      message.error("Order Qty is required");
      return;
    }
    if (!draft.uom) {
      message.error("Unit of Measurement is required");
      return;
    }

    const uniq = draft.uniq;
    const uom = draft.uom;
    const orderQty = draft.orderQty;

    const found = UNIQ_OPTIONS.find((u) => u.value === uniq);
    const material = found?.material ?? { code: "-", name: "-", model: "-" };
    const totalQty = found?.totalQty ?? 0;
    const remainingQty = found?.remainingQty ?? 0;
    const packingNumber = draft.packing && draft.packing.length > 0 ? draft.packing : found?.packingNumber ?? "-";

    setItems((prev) => {
      const exists = prev.some((p) => p.uniq === uniq);
      if (exists) {
        message.warning("This UNIQ already exists in the table");
        return prev;
      }
      return [
        ...prev,
        {
          key: uniq,
          uniq,
          materialInfo: material,
          totalQty,
          remainingQty,
          uom,
          orderQty,
          packingNumber,
          pcsPerKanban: draft.pcsPerKanban ?? 0,
          dateIncoming: draft.dateIncoming,
        },
      ];
    });

    setDraft({});
  };

  const onSave = async () => {
    if (!step1.period || !step1.poNumber) {
      message.error("Period and PO Number are required");
      return;
    }

    if (items.length === 0) {
      message.error("Add at least one DN item first");
      return;
    }

    if (!apiEnabled) {
      message.success(`${copy.title} saved`);
      router.push(`/dn-procurement?tab=${dnType === "rm" ? "raw" : dnType}`);
      return;
    }

    try {
      await createDnManagement({
        type: dnType,
        period: step1.period,
        po_number: step1.poNumber,
        supplier_id: step1.supplierId ?? 1,
        dn_type: copy.label,
        total_po_qty: step1.totalPo ?? 0,
        total_dn_created: step1.dnCreated ?? items.reduce((total, item) => total + item.orderQty, 0),
        created_by: "System",
        items: items.map((item) => ({
          uniq: item.uniq,
          order_qty: item.orderQty,
          packing: item.packingNumber,
          pcs_per_kanban: item.pcsPerKanban,
          date_incoming: item.dateIncoming ? item.dateIncoming.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
          qty_stated: item.orderQty,
        })),
      }).unwrap();

      message.success(`${copy.title} saved successfully`);
      router.push(`/dn-procurement?tab=${dnType === "rm" ? "raw" : dnType}`);
    } catch (error) {
      message.error(getApiErrorMessage(error, `Failed to save ${copy.title}`));
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              onClick={() => router.push(`/dn-procurement?tab=${dnType === "rm" ? "raw" : dnType}`)}
            >
              <LeftOutlined />
              <span>Back to {copy.back}</span>
            </button>

            <div className="flex items-center gap-2">
              <Button onClick={() => router.push(`/dn-procurement?tab=${dnType === "rm" ? "raw" : dnType}`)}>Cancel</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={() => void onSave()} loading={saving}>
                Save {copy.title}
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">{copy.title} Management</div>
            <div className="text-sm text-gray-500">
              Initialize new {copy.title} <span className="mx-2">•</span> 1 entry
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-gray-900">Step 1: Input General Data</div>
                <div className="text-sm text-gray-500">Input General Data</div>
              </div>
              <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">Required</Tag>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Period</div>
                  <Input value={step1.period} onChange={(e) => setStep1((p) => ({ ...p, period: e.target.value }))} />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">PO Number</div>
                  <Select
                    value={step1.poNumber}
                    onChange={onPickPo}
                    options={PO_OPTIONS.map((p) => ({ label: p.label, value: p.value }))}
                    placeholder="Select PO Number"
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Supplier</div>
                  <Select
                    value={step1.supplier}
                    options={[{ label: step1.supplier ?? "Autofilled", value: step1.supplier ?? "Autofilled" }]}
                    className="w-full"
                    disabled
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Total PO</div>
                  <InputNumber
                    value={step1.totalPo}
                    onChange={(v) => setStep1((p) => ({ ...p, totalPo: v ?? undefined }))}
                    className="w-full"
                    min={0}
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-700 mb-2">Total Incoming</div>
                  <InputNumber
                    value={step1.totalIncoming}
                    onChange={(v) => setStep1((p) => ({ ...p, totalIncoming: v ?? undefined }))}
                    className="w-full"
                    min={0}
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-700 mb-2">DN Created</div>
                  <InputNumber
                    value={step1.dnCreated}
                    onChange={(v) => setStep1((p) => ({ ...p, dnCreated: v ?? undefined }))}
                    className="w-full"
                    min={0}
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-700 mb-2">DN Incoming</div>
                  <InputNumber
                    value={step1.dnIncoming}
                    onChange={(v) => setStep1((p) => ({ ...p, dnIncoming: v ?? undefined }))}
                    className="w-full"
                    min={0}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-gray-900">Step 2: Input Data</div>
                <div className="text-sm text-gray-500">Input Data for each items</div>
              </div>
              <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">Entry 1</Tag>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Uniq</div>
                  <Select
                    value={draft.uniq}
                    onChange={onPickUniq}
                    placeholder="Select Uniq"
                    options={UNIQ_OPTIONS.map((u) => ({ label: u.label, value: u.value }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Order Qty</div>
                  <InputNumber
                    value={draft.orderQty}
                    onChange={(v) => setDraft((p) => ({ ...p, orderQty: v ?? undefined }))}
                    placeholder="Input Quantity"
                    className="w-full"
                    min={0}
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Unit of Measurement</div>
                  <Select
                    value={draft.uom}
                    onChange={(v) => setDraft((p) => ({ ...p, uom: v }))}
                    placeholder="Select UoM"
                    options={UOM_OPTIONS}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Packing</div>
                  <Select
                    value={draft.packing}
                    onChange={(v) => setDraft((p) => ({ ...p, packing: v }))}
                    placeholder="Select Packing"
                    options={PACKING_OPTIONS.filter((p) => p.value !== "").map((p) => ({ label: p.label, value: p.value }))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Pcs/Kanban</div>
                  <InputNumber
                    value={draft.pcsPerKanban}
                    onChange={(v) => setDraft((p) => ({ ...p, pcsPerKanban: v ?? undefined }))}
                    placeholder="Input pcs/kanban"
                    className="w-full"
                    min={0}
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Date Incoming</div>
                  <DatePicker
                    value={draft.dateIncoming}
                    onChange={(v) => setDraft((p) => ({ ...p, dateIncoming: v ?? undefined }))}
                    className="w-full"
                  />
                </div>

                <div className="lg:col-span-2 flex justify-start lg:justify-center">
                  <Button type="primary" icon={<PlusOutlined />} onClick={addItem} className="w-full lg:w-64">
                    Create DN
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <div className="text-base font-semibold text-gray-900">{dnCode}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-3">
                  <div>
                    <div className="text-xs text-gray-500">Period</div>
                    <div className="text-sm font-medium text-gray-900">{step1.period ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">PO Number</div>
                    <div className="text-sm font-medium text-gray-900">{step1.poNumber ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Uniq Choosen</div>
                    <div className="text-sm font-medium text-gray-900">{totalUniqChosen}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">Uniq</th>
                        <th className="text-left font-medium px-4 py-3">Material Info</th>
                        <th className="text-left font-medium px-4 py-3">Total Qty</th>
                        <th className="text-left font-medium px-4 py-3">Remaining Qty</th>
                        <th className="text-left font-medium px-4 py-3">UoM</th>
                        <th className="text-left font-medium px-4 py-3">Order Qty</th>
                        <th className="text-left font-medium px-4 py-3">Packing Number</th>
                        <th className="text-left font-medium px-4 py-3">Pcs/Kanban</th>
                        <th className="text-left font-medium px-4 py-3">Date Incoming</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((r) => (
                        <tr key={r.key} className="text-gray-800">
                          <td className="px-4 py-4 whitespace-nowrap">{r.uniq}</td>
                          <td className="px-4 py-4 min-w-[220px]">
                            <div className="text-[11px] text-gray-500">{r.materialInfo.code}</div>
                            <div className="text-sm font-medium text-gray-900">{r.materialInfo.name}</div>
                            <div className="text-[11px] text-gray-500">{r.materialInfo.model}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.totalQty}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.remainingQty}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.uom}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.orderQty}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.packingNumber}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.pcsPerKanban}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.dateIncoming ? r.dateIncoming.format("M/D/YYYY") : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
