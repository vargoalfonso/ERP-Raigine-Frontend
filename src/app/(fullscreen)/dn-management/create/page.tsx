"use client";

export const dynamic = "force-dynamic";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Card, DatePicker, Input, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, SaveOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  type ProcurementDnPreview,
  useCreateProcurementDnMutation,
  usePreviewProcurementDnMutation,
  type ProcurementDnType,
} from "@/lib/api/procurement-dn/api";
import { type ProcurementPoType, useGetProcurementPoByIdQuery, useListProcurementPosQuery } from "@/lib/api/procurement-po/api";
import { useGetGlobalWorkingDaysQuery } from "@/lib/api/system-settings/api";
import { useGetKanbanStandardsQuery } from "@/lib/api/system-settings/api";

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
  weightKg?: number;
};

type UniqOption = {
  label: string;
  value: string;
  material: {
    code: string;
    name: string;
    model: string;
  };
  totalQty: number;
  remainingQty: number;
  uom: string;
  packingNumber: string;
  pcsPerKanban: number;
  dateIncoming?: string;
};

type UnknownRecord = Record<string, unknown>;

dayjs.extend(customParseFormat);

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

const parseIncomingDate = (value?: string): Dayjs | undefined => {
  const text = toText(value);
  if (!text) return undefined;

  const parsed = dayjs(text, ["DD/MM/YYYY", "YYYY-MM-DD", "YYYY/MM/DD"], true);
  if (parsed.isValid()) return parsed;

  const fallback = dayjs(text);
  return fallback.isValid() ? fallback : undefined;
};

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

const formatDisplayNumber = (value?: number) => {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
};

function DnRawMaterialCreatePageContent() {
  const router = useRouter();
  const apiEnabled = Boolean(apiBaseUrl);
  const [tabParam, setTabParam] = useState("raw");
  const dnType = tabToType(tabParam);
  const copy = typeCopy(dnType);

  const [createProcurementDn, { isLoading: saving }] = useCreateProcurementDnMutation();
  const [previewProcurementDn, { isLoading: previewing }] = usePreviewProcurementDnMutation();

  const [step1, setStep1] = useState<Step1Data>({});

  const [scheduleDate, setScheduleDate] = useState<Dayjs | null>(dayjs());
  const [priority, setPriority] = useState<string>("normal");

  const [transportCompany, setTransportCompany] = useState<string>("");
  const [vehicleNumber, setVehicleNumber] = useState<string>("");
  const [driverName, setDriverName] = useState<string>("");
  const [driverContact, setDriverContact] = useState<string>("");
  const [departureAt, setDepartureAt] = useState<Dayjs | null>(null);
  const [arrivalAt, setArrivalAt] = useState<Dayjs | null>(null);
  const [status, setStatus] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  const [preview, setPreview] = useState<ProcurementDnPreview | null>(null);

  const [draft, setDraft] = useState<Step2Draft>({});

  const [items, setItems] = useState<DnItemRow[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextTab = new URLSearchParams(window.location.search).get("tab")?.toLowerCase() ?? "raw";
    setTabParam(nextTab);
  }, []);

  const poType = managementTypeToPoType(dnType);
  const poListQuery = useListProcurementPosQuery({ po_type: poType }, { skip: !apiEnabled });
  const { data: globalParameters = [] } = useGetGlobalWorkingDaysQuery(undefined, { skip: !apiEnabled });

  useEffect(() => {
    if (step1.poNumber || step1.period) return;

    const activePlanningPeriods = globalParameters
      .filter((item) => String(item.status ?? "active").trim().toLowerCase() === "active")
      .filter((item) => String(item.parameter_group ?? "").trim().toLowerCase() === "planning")
      .map((item) => String(item.period ?? "").trim())
      .filter(Boolean);

    const fallbackPeriods = globalParameters
      .filter((item) => String(item.status ?? "active").trim().toLowerCase() === "active")
      .map((item) => String(item.period ?? "").trim())
      .filter(Boolean);

    const nextPeriod =
      (activePlanningPeriods.length ? activePlanningPeriods : fallbackPeriods)[0] ??
      (scheduleDate ?? dayjs()).format("YYYY-MM");

    setStep1((prev) => ({ ...prev, period: nextPeriod }));
  }, [globalParameters, scheduleDate, step1.period, step1.poNumber]);


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

  const { data: kanbanApi = { items: [] } } = useGetKanbanStandardsQuery(undefined, { skip: !apiEnabled });

  const kanbanMap = useMemo(() => {
    const map = new Map<string, { kanbanQty?: number; productCode?: string }>();
    const items = Array.isArray(kanbanApi) ? kanbanApi : (kanbanApi?.items ?? []);
    items.forEach((k: any) => {
      const code = String(k.item_uniq_code ?? k.item_uniq ?? k.uniq_code ?? k.uniq ?? "").trim();
      if (!code) return;
      const qty = Number(k.kanban_qty ?? k.kanbanQty ?? k.kanban_quantity ?? 0) || 0;
      map.set(code, { kanbanQty: qty, productCode: code });
    });
    return map;
  }, [kanbanApi]);

  const periodOptions = useMemo(() => {
    const activePlanningPeriods = globalParameters
      .filter((item) => String(item.status ?? "active").trim().toLowerCase() === "active")
      .filter((item) => String(item.parameter_group ?? "").trim().toLowerCase() === "planning")
      .map((item) => String(item.period ?? "").trim())
      .filter(Boolean);

    const fallbackPeriods = globalParameters
      .filter((item) => String(item.status ?? "active").trim().toLowerCase() === "active")
      .map((item) => String(item.period ?? "").trim())
      .filter(Boolean);

    const basePeriods = (activePlanningPeriods.length ? activePlanningPeriods : fallbackPeriods).filter(
      (value, index, array) => array.indexOf(value) === index,
    );

    const extraPeriods = [step1.period, preview?.period]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);

    return [...basePeriods, ...extraPeriods]
      .filter((value, index, array) => array.indexOf(value) === index)
      .map((value) => ({ label: value, value }));
  }, [globalParameters, preview?.period, step1.period]);

  const previewItems = useMemo<UniqOption[]>(() => {
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

      return mapped;
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

    return mapped;
  }, [poDetailQuery.data, preview]);

  const uniqOptions = useMemo(() => {
    const deduped = new Map<string, UniqOption>();
    previewItems.forEach((item) => {
      if (!deduped.has(item.value)) deduped.set(item.value, item);
    });
    return Array.from(deduped.values());
  }, [previewItems]);

  const getPreviewItemForUniq = (uniq: string, packingNumber?: string) => {
    if (packingNumber) {
      const exact = previewItems.find((item) => item.value === uniq && item.packingNumber === packingNumber);
      if (exact) return exact;
    }

    const nextUnused = previewItems.find(
      (item) => item.value === uniq && !items.some((existing) => existing.uniq === uniq && existing.packingNumber === item.packingNumber),
    );

    return nextUnused ?? previewItems.find((item) => item.value === uniq);
  };

  const selectedDraftItem = useMemo(
    () => (draft.uniq ? getPreviewItemForUniq(draft.uniq, draft.packing) : undefined),
    [draft.packing, draft.uniq, items, previewItems],
  );

  const dnCode = useMemo(() => `${copy.codePrefix}-${step1.period?.replace(/[^0-9A-Za-z]/g, "") ?? "202401"}-001`, [copy.codePrefix, step1.period]);
  const totalUniqChosen = useMemo(() => items.length, [items]);
  const totalQty = useMemo(() => items.reduce((sum, it) => sum + Number(it.orderQty ?? 0), 0), [items]);
  const tableRows = useMemo(() => items, [items]);

  const requestPreview = async (poNumber: string, periodValue?: string) => {
    if (!apiEnabled || !poNumber) return;

    const procurementType = managementTypeToProcurementType(dnType);

    try {
      const res = await previewProcurementDn({
        po_number: poNumber,
        period: periodValue,
        type: procurementType,
        item: [],
      }).unwrap();

      setPreview(res.data);
      setStep1((prev) => ({
        ...prev,
        period: String(res.data.period ?? periodValue ?? prev.period ?? "").trim() || prev.period,
        supplier: String(res.data.supplier ?? prev.supplier ?? "").trim() || prev.supplier,
        totalPo: res.data.total_po == null ? undefined : Number(res.data.total_po),
        totalIncoming: res.data.total_incoming == null ? undefined : Number(res.data.total_incoming),
        dnCreated: res.data.total_dn_created == null ? undefined : Number(res.data.total_dn_created),
        dnIncoming: res.data.total_dn_incoming == null ? undefined : Number(res.data.total_dn_incoming),
      }));
    } catch (error) {
      setPreview(null);
      setStep1((prev) => ({
        ...prev,
        totalPo: undefined,
        totalIncoming: undefined,
        dnCreated: undefined,
        dnIncoming: undefined,
      }));
      message.error(getApiErrorMessage(error, "Failed to load DN preview"));
    }
  };

  const onPickPo = async (poValue?: string) => {
    setDraft({});
    setItems([]);
    setPreview(null);

    if (!poValue) {
      setStep1({
        period: step1.period ?? periodOptions[0]?.value ?? (scheduleDate ?? dayjs()).format("YYYY-MM"),
      });
      return;
    }

    const po = (poListQuery.data?.data ?? []).find((p) => String(p.po_number ?? "").trim() === poValue);
    const nextPeriod = String(step1.period ?? po?.period ?? periodOptions[0]?.value ?? "").trim() || undefined;

    setStep1((prev) => ({
      ...prev,
      poNumber: poValue,
      period: nextPeriod ?? prev.period,
      supplierId: po?.supplier_id == null ? prev.supplierId : Number(po.supplier_id),
      supplier: String(po?.supplier_name ?? prev.supplier ?? "").trim() || prev.supplier,
      totalPo: undefined,
      totalIncoming: undefined,
      dnCreated: undefined,
      dnIncoming: undefined,
    }));

    await requestPreview(poValue, nextPeriod);
  };

  const onPickPeriod = async (value?: string) => {
    setDraft({});
    setItems([]);
    setPreview(null);

    setStep1((prev) => ({
      ...prev,
      period: value,
      totalPo: undefined,
      totalIncoming: undefined,
      dnCreated: undefined,
      dnIncoming: undefined,
    }));

    if (!step1.poNumber || !value) return;
    await requestPreview(step1.poNumber, value);
  };

  const onPickUniq = (uniq: string) => {
    const found = getPreviewItemForUniq(uniq);

    // Ensure pcsPerKanban is populated even if preview-mapped value is 0
    let resolvedPcs = found?.pcsPerKanban ?? undefined;
    if ((resolvedPcs == null || Number(resolvedPcs) === 0) && preview?.items?.length) {
      const match = preview.items.find((it) => {
        const item = it as any;
        const code = String(item.item_uniq_code ?? item.uniq ?? "").trim();
        return code === uniq;
      });
      if (match) {
        const m = match as any;
        resolvedPcs = Number(m.pcs_per_kanban ?? m.pcsPerKanban ?? resolvedPcs ?? 0);
      }
    }

    // Try to autofill pcsPerKanban from system-settings kanban map if available
    const kanbanEntry = kanbanMap.get(uniq) ?? kanbanMap.get(uniq.toLowerCase());
    const kanbanPcs = kanbanEntry?.kanbanQty ?? undefined;

    setDraft((prev) => ({
      ...prev,
      uniq,
      orderQty: undefined,
      uom: found?.uom ?? prev.uom,
      packing: found?.packingNumber ?? prev.packing,
      pcsPerKanban: kanbanPcs ?? resolvedPcs ?? prev.pcsPerKanban,
      dateIncoming: parseIncomingDate(found?.dateIncoming) ?? prev.dateIncoming,
      weightKg: prev.weightKg,
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

    const found = getPreviewItemForUniq(uniq, draft.packing);
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
          dateIncoming: draft.dateIncoming ?? parseIncomingDate(found?.dateIncoming),
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

    // allow saving even when no items are added

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
                Save {copy.back}
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">{copy.title} Management</div>
            <div className="text-sm text-gray-500">Initialize new {copy.label} • 1 entry</div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          <Card className="rounded-2xl border border-gray-200" bodyStyle={{ padding: 24 }}>
            <div className="rounded-2xl border-2 border-sky-400 p-5 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.35)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-gray-900">Step 1: Input General Data</div>
                  <div className="text-sm text-gray-500">Input General Data</div>
                </div>
                <Tag className="rounded-full border border-blue-100 bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-700">Required</Tag>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">Period</div>
                  <Select
                    value={step1.period}
                    onChange={(value) => void onPickPeriod(value)}
                    options={periodOptions}
                    placeholder="Select period"
                    className="w-full"
                    disabled={previewing}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                  />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">PO Number</div>
                  <Select
                    value={step1.poNumber}
                    onChange={onPickPo}
                    options={poOptions.map((p) => ({ label: p.label, value: p.value }))}
                    placeholder="Select PO Number"
                    className="w-full"
                    disabled={previewing}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                  />
                </div>
                <div className="xl:col-span-2">
                  <div className="mb-2 text-sm font-medium text-gray-700">Supplier</div>
                  <Input value={step1.supplier ?? ""} disabled placeholder="Autofilled" />
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">Total PO</div>
                  <Input value={formatDisplayNumber(step1.totalPo)} disabled />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">Total Incoming</div>
                  <Input value={formatDisplayNumber(step1.totalIncoming)} disabled />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">DN Created</div>
                  <Input value={formatDisplayNumber(step1.dnCreated)} disabled />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">DN Incoming</div>
                  <Input value={formatDisplayNumber(step1.dnIncoming)} disabled />
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-gray-900">Step 2: Input Data</div>
                  <div className="text-sm text-gray-500">Input Data for each items</div>
                </div>
                <Tag className="rounded-full border border-blue-100 bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-700">Entry 1</Tag>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">Uniq</div>
                  <Select
                    value={draft.uniq}
                    onChange={onPickUniq}
                    placeholder={step1.poNumber ? "Select Uniq" : "Select PO Number first"}
                    options={uniqOptions.map((u) => ({ label: u.label, value: u.value }))}
                    className="w-full"
                    disabled={!step1.poNumber || previewing}
                  />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">Order Qty</div>
                  <InputNumber
                    value={draft.orderQty}
                    onChange={(v) => setDraft((p) => ({ ...p, orderQty: v ?? undefined }))}
                    className="w-full"
                    min={0}
                    placeholder="Input Quantity"
                  />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">Unit of Measurement</div>
                  <Input value={draft.uom ?? selectedDraftItem?.uom ?? ""} disabled placeholder="Select UoM" />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">Packing</div>
                  <Input value={draft.packing ?? selectedDraftItem?.packingNumber ?? ""} disabled placeholder="Select Packing" />
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">Pcs/Kanban</div>
                  <InputNumber
                    value={draft.pcsPerKanban}
                    onChange={(v) => setDraft((p) => ({ ...p, pcsPerKanban: v ?? undefined }))}
                    className="w-full"
                    min={0}
                    placeholder="Input pcs/kanban"
                  />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">Weight (kg)</div>
                  <InputNumber
                    value={draft.weightKg}
                    onChange={(v) => setDraft((p) => ({ ...p, weightKg: v ?? undefined }))}
                    className="w-full"
                    min={0}
                    placeholder="Input weight"
                    style={{ backgroundColor: "white" }}
                  />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">Date Incoming</div>
                  <DatePicker
                    className="w-full"
                    value={draft.dateIncoming ?? null}
                    onChange={(value) => setDraft((p) => ({ ...p, dateIncoming: value ?? undefined }))}
                    format="DD/MM/YYYY"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="primary"
                    className="!h-10 !w-full !rounded-lg"
                    onClick={addItem}
                    icon={<PlusOutlined />}
                    disabled={!step1.poNumber || previewing}
                  >
                    Create DN
                  </Button>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="text-lg font-semibold text-gray-900">{dnCode}</div>
                  <div className="grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-3 md:gap-8">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Period</div>
                      <div className="mt-1 font-medium text-gray-800">{step1.period ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">PO Number</div>
                      <div className="mt-1 font-medium text-gray-800">{step1.poNumber ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Uniq Choosen</div>
                      <div className="mt-1 font-medium text-gray-800">{totalUniqChosen}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="border-b border-gray-200 px-3 py-3 font-medium">Uniq</th>
                        <th className="border-b border-gray-200 px-3 py-3 font-medium">Material Info</th>
                        <th className="border-b border-gray-200 px-3 py-3 font-medium">Total Qty</th>
                        <th className="border-b border-gray-200 px-3 py-3 font-medium">Remaining Qty</th>
                        <th className="border-b border-gray-200 px-3 py-3 font-medium">UoM</th>
                        <th className="border-b border-gray-200 px-3 py-3 font-medium">Order Qty</th>
                        <th className="border-b border-gray-200 px-3 py-3 font-medium">Packing Number</th>
                        <th className="border-b border-gray-200 px-3 py-3 font-medium">Pcs/Kanban</th>
                        <th className="border-b border-gray-200 px-3 py-3 font-medium">Date Incoming</th>
                        <th className="border-b border-gray-200 px-3 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.length > 0 ? (
                        tableRows.map((it) => (
                          <tr key={it.key} className="align-top text-gray-700">
                            <td className="border-b border-gray-100 px-3 py-4 font-medium">{it.uniq}</td>
                            <td className="border-b border-gray-100 px-3 py-4">
                              <div className="font-medium text-gray-900">{it.materialInfo.name}</div>
                              <div className="text-xs text-gray-500">{it.materialInfo.model}</div>
                            </td>
                            <td className="border-b border-gray-100 px-3 py-4">{it.totalQty}</td>
                            <td className="border-b border-gray-100 px-3 py-4">{it.remainingQty}</td>
                            <td className="border-b border-gray-100 px-3 py-4">{it.uom}</td>
                            <td className="border-b border-gray-100 px-3 py-4">{it.orderQty}</td>
                            <td className="border-b border-gray-100 px-3 py-4">{it.packingNumber}</td>
                            <td className="border-b border-gray-100 px-3 py-4">{it.pcsPerKanban}</td>
                            <td className="border-b border-gray-100 px-3 py-4">{it.dateIncoming ? it.dateIncoming.format("M/D/YYYY") : "-"}</td>
                            <td className="border-b border-gray-100 px-3 py-4">
                              <Button
                                danger
                                size="small"
                                onClick={() => setItems((prev) => prev.filter((p) => p.key !== it.key))}
                                className="!rounded-lg"
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-400">
                            No DN items added yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-sm text-gray-700 mb-2">Transport Company</div>
                <Input value={transportCompany} onChange={(e) => setTransportCompany(e.target.value)} placeholder="PT JNE" />
              </div>
              <div>
                <div className="text-sm text-gray-700 mb-2">Vehicle Number</div>
                <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="B 1234 ABC" />
              </div>
              <div>
                <div className="text-sm text-gray-700 mb-2">Driver Name</div>
                <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Driver Name" />
              </div>
              <div>
                <div className="text-sm text-gray-700 mb-2">Driver Contact</div>
                <Input value={driverContact} onChange={(e) => setDriverContact(e.target.value)} placeholder="Driver Contact" />
              </div>

              <div>
                <div className="text-sm text-gray-700 mb-2">Departure Date & Time</div>
                <DatePicker className="w-full" value={departureAt} onChange={(v) => setDepartureAt(v)} showTime format="DD/MM/YYYY HH:mm" />
              </div>
              <div>
                <div className="text-sm text-gray-700 mb-2">Arrival Date & Time</div>
                <DatePicker className="w-full" value={arrivalAt} onChange={(v) => setArrivalAt(v)} showTime format="DD/MM/YYYY HH:mm" />
              </div>
              <div>
                <div className="text-sm text-gray-700 mb-2">Status</div>
                <Select
                  className="w-full"
                  value={status}
                  onChange={(v) => setStatus(v)}
                  options={[
                    { label: "Select Status", value: "" },
                    { label: "Scheduled", value: "scheduled" },
                    { label: "In Transit", value: "in_transit" },
                    { label: "Arrived", value: "arrived" },
                  ]}
                />
              </div>
              <div>
                <div className="text-sm text-gray-700 mb-2">Approval Status</div>
                <Input value="Status From Manager" disabled />
              </div>
            </div> */}

            {/* <div className="mt-6">
              <div className="text-sm text-gray-700 mb-2">Remarks & Special Instructions</div>
              <Input.TextArea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Require QC Certificate and special handling" />
            </div> */}
          </Card>

          {/* <div className="flex justify-center">
            <Button className="!rounded-lg" disabled>
              + Add Another Schedule
            </Button>
          </div> */}

          <Card className="rounded-2xl" bodyStyle={{ padding: 20 }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Summary</div>
                <div className="text-xs text-gray-500">1 Schedule Entry ready to be saved</div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{step1.dnCreated ?? 0}</div>
                  <div className="text-xs text-gray-500">DN Created</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{step1.dnIncoming ?? 0}</div>
                  <div className="text-xs text-gray-500">DN Incoming</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function DnRawMaterialCreatePage() {
  return (
    <Suspense fallback={null}>
      <DnRawMaterialCreatePageContent />
    </Suspense>
  );
}
