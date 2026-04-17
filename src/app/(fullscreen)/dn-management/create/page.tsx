"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, DatePicker, Input, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, SaveOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  type ProcurementDnPreview,
  useCreateProcurementDnMutation,
  usePreviewProcurementDnMutation,
  type ProcurementDnType,
} from "@/lib/api/procurement-dn/api";
import { type ProcurementPoType, useGetProcurementPoByIdQuery, useListProcurementPosQuery } from "@/lib/api/procurement-po/api";

type DnManagementType = "rm" | "indirect" | "subcon";

type Step1Data = {
  period?: string;
  poNumber?: string;
  supplierId?: number;
  supplier?: string;
  totalPo?: number;
  totalIncoming?: number;
  dnCreated?: number;
  dnIncoming?: number;
  // customerId?: number;
  // contactPerson?: string;
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

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const toText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const UOM_OPTIONS = [
  { label: "pcs", value: "pcs" },
  { label: "kg", value: "kg" },
  { label: "m", value: "m" },
];

function nextDnCode() {
  return "DN-RM-2024-001";
}

const tabToType = (tab: string): DnManagementType => {
  if (tab === "subcon") return "subcon";
  if (tab === "indirect") return "indirect";
  return "rm";
};

const managementTypeToProcurementType = (type: DnManagementType): ProcurementDnType => {
  if (type === "subcon") return "SC";
  if (type === "indirect") return "IRM";
  return "RM";
};

const managementTypeToPoType = (type: DnManagementType): ProcurementPoType => {
  if (type === "subcon") return "subcon";
  if (type === "indirect") return "indirect";
  return "raw_material";
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
  const [createProcurementDn, { isLoading: saving }] = useCreateProcurementDnMutation();
  const [previewProcurementDn, { isLoading: previewing }] = usePreviewProcurementDnMutation();

  const [step1, setStep1] = useState<Step1Data>({});

  const [preview, setPreview] = useState<ProcurementDnPreview | null>(null);

  const [draft, setDraft] = useState<Step2Draft>({});

  const [items, setItems] = useState<DnItemRow[]>([]);

  const poType = managementTypeToPoType(dnType);
  const poListQuery = useListProcurementPosQuery({ po_type: poType }, { skip: !apiEnabled });


  const selectedPo = useMemo(() => {
    const poNumber = String(step1.poNumber ?? "").trim();
    if (!poNumber) return undefined;
    return (poListQuery.data?.data ?? []).find((po) => String(po.po_number ?? "").trim() === poNumber);
  }, [poListQuery.data, step1.poNumber]);

  const poDetailQuery = useGetProcurementPoByIdQuery(selectedPo?.id ?? "", {
    skip: !apiEnabled || !selectedPo?.id,
  });


  const poOptions = useMemo(() => {
    const list = poListQuery.data?.data ?? [];
    return list
      .map((po) => ({
        label: String(po.po_number ?? "-")
          .trim(),
        value: String(po.po_number ?? "").trim(),
        supplier: String(po.supplier_name ?? "-").trim(),
      }))
      .filter((opt) => Boolean(opt.value));
  }, [poListQuery.data]);

  const uniqOptions = useMemo(() => {
    if (preview?.items?.length) {
      const mapped = preview.items
        .map((item) => {
          const uniq = toText(item.item_uniq_code);
          if (!uniq) return null;
          const totalQty = Number(item.total_qty ?? 0);
          const remainingQty = Number(item.remaining_qty ?? 0);
          return {
            label: uniq,
            value: uniq,
            material: {
              code: toText(item.material_info) ?? uniq,
              name: toText(item.material_info) ?? uniq,
              model: String(preview.type ?? "-") || "-",
            },
            totalQty,
            remainingQty,
            uom: toText(item.uom) ?? "-",
            packingNumber: toText(item.packing_number) ?? "-",
            pcsPerKanban: Number(item.pcs_per_kanban ?? 0),
            dateIncoming: toText(item.date_incoming),
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      const deduped = new Map<string, (typeof mapped)[number]>();
      mapped.forEach((m) => {
        if (!deduped.has(m.value)) deduped.set(m.value, m);
      });
      return Array.from(deduped.values());
    }

    const rawItems = (poDetailQuery.data?.data?.items ?? []).filter((it): it is UnknownRecord => isRecord(it));

    const mapped = rawItems
      .map((item) => {
        const uniq = toText(item.uniq_code) ?? toText(item.item_uniq_code) ?? toText(item.uniq);
        if (!uniq) return null;

        const received = toNumber(item.qty_received) ?? toNumber(item.received_qty) ?? 0;
        const totalQty =
          toNumber(item.quantity) ??
          toNumber(item.order_qty) ??
          toNumber(item.qty_stated) ??
          toNumber(item.total_qty) ??
          0;

        return {
          label: uniq,
          value: uniq,
          material: {
            code:
              toText(item.material_code) ??
              toText(item.item_code) ??
              toText(item.part_number) ??
              toText(item.kanban_number) ??
              "-",
            name:
              toText(item.part_name) ??
              toText(item.material_name) ??
              toText(item.item_name) ??
              uniq,
            model: toText(item.product_model) ?? toText(item.model) ?? "-",
          },
          totalQty,
          remainingQty: Math.max(totalQty - Number(received || 0), 0),
          uom: toText(item.uom) ?? toText(item.unit) ?? "-",
          packingNumber:
            toText(item.packing_number) ??
            toText(item.packing) ??
            toText(item.kanban_number) ??
            "-",
          pcsPerKanban: toNumber(item.pcs_per_kanban) ?? toNumber(item.pcs) ?? 0,
          dateIncoming: undefined,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    const deduped = new Map<string, (typeof mapped)[number]>();
    mapped.forEach((m) => {
      if (!deduped.has(m.value)) deduped.set(m.value, m);
    });
    return Array.from(deduped.values());
  }, [poDetailQuery.data, preview]);

  const dnCode = useMemo(() => `${copy.codePrefix}-${step1.period?.replace(/[^0-9A-Za-z]/g, "") ?? "202401"}-001`, [copy.codePrefix, step1.period]);
  const totalUniqChosen = useMemo(() => items.length, [items]);

  const onPickPo = async (poValue: string) => {
    const po = (poListQuery.data?.data ?? []).find((p) => String(p.po_number ?? "").trim() === poValue);

    const procurementType = managementTypeToProcurementType(dnType);

    setStep1((prev) => ({
      ...prev,
      poNumber: poValue,
      period: String(po?.period ?? prev.period ?? "").trim() || prev.period,
      supplierId: po?.supplier_id == null ? prev.supplierId : Number(po.supplier_id),
      supplier: String(po?.supplier_name ?? prev.supplier ?? "").trim() || prev.supplier,
      totalPo: po?.total_po == null ? prev.totalPo : Number(po.total_po),
      totalIncoming: po?.total_incoming == null ? prev.totalIncoming : Number(po.total_incoming),
      dnCreated: po?.dn_created == null ? prev.dnCreated : Number(po.dn_created),
      dnIncoming: po?.dn_incoming == null ? prev.dnIncoming : Number(po.dn_incoming),
    }));

    if (!apiEnabled) return;

    try {
      const res = await previewProcurementDn({
        po_number: poValue,
        period: dayjs().format("YYYY-MM"),
        type: procurementType,
        item: [],
      }).unwrap();

      setPreview(res.data);

      setStep1((prev) => ({
        ...prev,
        period: res.data.period ?? prev.period,
        supplier: res.data.supplier ?? prev.supplier,
        totalPo: res.data.total_po ?? prev.totalPo,
        totalIncoming: res.data.total_incoming ?? prev.totalIncoming,
        dnCreated: res.data.total_dn_created ?? prev.dnCreated,
        dnIncoming: res.data.total_dn_incoming ?? prev.dnIncoming,
      }));

      const nextItems: DnItemRow[] = (res.data.items ?? [])
        .map((item, index) => {
          const uniq = String(item.item_uniq_code ?? "").trim();
          if (!uniq) return null;
          const packingNumber = String(item.packing_number ?? "").trim() || "-";
          const dateIncomingText = String(item.date_incoming ?? "").trim();
          const dateIncoming = dateIncomingText ? dayjs(dateIncomingText, "DD/MM/YYYY") : undefined;

          return {
            key: `${uniq}-${packingNumber}-${index}`,
            uniq,
            materialInfo: {
              code: String(item.material_info ?? uniq),
              name: String(item.material_info ?? uniq),
              model: String(res.data.type ?? "-") || "-",
            },
            totalQty: Number(item.total_qty ?? 0),
            remainingQty: Number(item.remaining_qty ?? 0),
            uom: String(item.uom ?? "-") || "-",
            orderQty: Number(item.order_qty ?? 0),
            packingNumber,
            pcsPerKanban: Number(item.pcs_per_kanban ?? 0),
            dateIncoming,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      if (nextItems.length > 0) {
        setItems(nextItems);
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to load DN preview"));
      setPreview(null);
    }
  };

  const onPickUniq = (uniq: string) => {
    const found = uniqOptions.find((u) => u.value === uniq);
    setDraft((prev) => ({
      ...prev,
      uniq,
      uom: found?.uom ?? prev.uom,
      packing: found?.packingNumber ?? prev.packing,
      pcsPerKanban: found?.pcsPerKanban ?? prev.pcsPerKanban,
      dateIncoming: found?.dateIncoming ? dayjs(found.dateIncoming, "DD/MM/YYYY") : prev.dateIncoming,
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

    const found = uniqOptions.find((u) => u.value === uniq);
    const material = found?.material ?? { code: "-", name: "-", model: "-" };
    const totalQty = found?.totalQty ?? 0;
    const remainingQty = found?.remainingQty ?? 0;
    const packingNumber = draft.packing && draft.packing.length > 0 ? draft.packing : found?.packingNumber ?? "-";

    setItems((prev) => {
      const exists = prev.some((p) => p.uniq === uniq && p.packingNumber === packingNumber);
      if (exists) {
        message.warning("This UNIQ already exists in the table");
        return prev;
      }
      return [
        ...prev,
        {
          key: `${uniq}-${packingNumber}-${prev.length}`,
          uniq,
          materialInfo: material,
          totalQty,
          remainingQty,
          uom,
          orderQty,
          packingNumber,
          pcsPerKanban: draft.pcsPerKanban ?? found?.pcsPerKanban ?? 0,
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
      router.push("/dn-management");
      return;
    }

    const procurementType = managementTypeToProcurementType(dnType);

    try {
      await createProcurementDn({
        po_number: step1.poNumber,
        period: step1.period,
        type: procurementType,
        items: items.map((item) => ({
          item_uniq_code: item.uniq,
          qty: Number(item.orderQty || 0),
          incoming_date: item.dateIncoming ? item.dateIncoming.format("DD/MM/YYYY") : dayjs().format("DD/MM/YYYY"),
        })),
      }).unwrap();

      message.success(`${copy.title} saved successfully`);
      router.push("/dn-management");
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
              onClick={() => router.push("/dn-management")}
            >
              <LeftOutlined />
              <span>Back to {copy.back}</span>
            </button>

            <div className="flex items-center gap-2">
              <Button onClick={() => router.push("/dn-management")}>Cancel</Button>
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
                    options={poOptions.map((p) => ({ label: p.label, value: p.value }))}
                    placeholder="Select PO Number"
                    className="w-full"
                    disabled={previewing}
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
                    options={uniqOptions.map((u) => ({ label: u.label, value: u.value }))}
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
                  <Input
                    value={draft.packing}
                    onChange={(e) => setDraft((p) => ({ ...p, packing: e.target.value }))}
                    placeholder="Input Packing Number"
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
