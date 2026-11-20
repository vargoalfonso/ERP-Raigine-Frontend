"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button, DatePicker, Input, InputNumber, Modal, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { EditOutlined, LeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useGetProcurementDnByIdQuery,
  useLazyScanProcurementDnPackingQuery,
  useGetProcurementDnHistoryQuery,
  useListProcurementDnsQuery,
  useUpdateProcurementDnMutation,
  type ProcurementDnRecord,
} from "@/lib/api/procurement-dn/api";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { buildDnDocumentHtml } from "@/lib/utils/dnDocumentHtml";
import { useListSupplierItemsQuery } from "@/lib/api/supplier-items/api";
import { resolveSubconSupplierName } from "@/lib/utils/subconSupplier";
import {
  buildPackingLabelsHtml,
  formatLabelQty,
  normalizeQrSrc,
  printHtmlViaIframe,
  type PackingLabel,
} from "@/lib/utils/dnPackingLabel";

type DetailTabId = "details";

type DnDetailItem = {
  key: string;
  uniq: string;
  materialgrade: string;
  itemId: string;
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
  dateIncoming: string;
  qtyReceived: number;
  qtySent: number;
  weight: number;
  weightReceived: number;
  qualityStatus: string;
  qr?: string;
  check: string;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const isMissingRouteError = (error: unknown): boolean => isRecord(error) && error.status === 404;

const formatNumber = (value: number | undefined) => new Intl.NumberFormat("en-US").format(Number(value ?? 0));
const formatConfiguredNumber = (value: number | undefined) => Number(value ?? 0) > 0 ? formatNumber(value) : "-";
const formatCompactNumber = (value: number | undefined) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value ?? 0));

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatPeriodLabel = (value?: string) => {
  if (!value) return "-";
  const normalized = value.trim();
  const match = normalized.match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return normalized;
  const month = Number(match[1]);
  const year = Number(match[2]);
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return normalized;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
};

const toStatusTone = (value?: string) => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("approve") || normalized.includes("active") || normalized.includes("on time")) {
    return "bg-green-50 text-green-700 border-green-200";
  }
  if (normalized.includes("progress") || normalized.includes("pending")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (normalized.includes("reject") || normalized.includes("delay") || normalized.includes("inactive")) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  return "bg-gray-50 text-gray-700 border-gray-200";
};

function mockDnHeader(dnNumber: string) {
  return {
    period: "01/2024",
    poNumber: "PO-RM-XXX",
    supplier: "PT Supplier",
    totalPo: 1000,
    totalIncoming: 250,
    dnCreated: 10,
    dnIncoming: 8,
    dnCode: `DN-RM-${dnNumber}`,
    type: "RM",
    status: "On Time",
    createdAt: "2026-04-13T16:38:33.895733+07:00",
  };
}

function mockItems(): DnDetailItem[] {
  return [
    {
      key: "LV-001",
      itemId: "LV-001",
      materialgrade: "SWM-B",
      uniq: "LV-001",
      materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
      totalQty: 120,
      remainingQty: 40,
      uom: "pcs",
      orderQty: 40,
      packingNumber: "KBN-004-2024",
      pcsPerKanban: 40,
      dateIncoming: "1/19/2024",
      qtyReceived: 80,
      qtySent: 0,
      weight: 1200,
      weightReceived: 1000,
      qualityStatus: "Approved",
      check: "progress",
    },
    {
      key: "LV-002",
      itemId: "LV-002",
      materialgrade: "SWM-B",
      uniq: "LV-002",
      materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
      totalQty: 100,
      remainingQty: 50,
      uom: "pcs",
      orderQty: 100,
      packingNumber: "KBN-004-2024",
      pcsPerKanban: 50,
      dateIncoming: "1/19/2024",
      qtyReceived: 50,
      qtySent: 0,
      weight: 1200,
      weightReceived: 0,
      qualityStatus: "Progress",
      check: "progress",
    },
  ];
}

function DnRawMaterialDetailPageContent() {
  const router = useRouter();
  const params = useParams<{ dnNumber: string }>();
  const dnNumber = params?.dnNumber ?? "XXX";
  const [tab, setTab] = useState("raw");
  const apiEnabled = Boolean(apiBaseUrl);

  const detailQuery = useGetProcurementDnByIdQuery(dnNumber, { skip: !apiEnabled || !dnNumber });
  const historyQuery = useGetProcurementDnHistoryQuery(dnNumber, { skip: !apiEnabled || !dnNumber });
  const [runScan, scanState] = useLazyScanProcurementDnPackingQuery();
  const [scanPacking, setScanPacking] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setTab(new URLSearchParams(window.location.search).get("tab") ?? "raw");
  }, []);

  useEffect(() => {
    if (!apiEnabled || !detailQuery.error) return;
    if (isMissingRouteError(detailQuery.error)) {
      message.warning("Delivery note detail API route is not available on this backend yet; showing mock data.");
      return;
    }
    message.error(getApiErrorMessage(detailQuery.error, "Failed to load delivery note detail"));
  }, [apiEnabled, detailQuery.error]);

  useEffect(() => {
    if (!scanState.error) return;
    message.error(getApiErrorMessage(scanState.error, "Failed to scan packing number"));
  }, [scanState.error]);

  const useMock = !apiEnabled || isMissingRouteError(detailQuery.error);
  const detail = useMock ? null : detailQuery.data?.data;
  const header = useMemo(() => {
    if (!detail) return mockDnHeader(dnNumber);
    return {
      period: detail.period ?? "-",
      poNumber: detail.po_number ?? "-",
      supplier: detail.supplier_name ?? "-",
      totalPo: Number(detail.total_po_qty ?? 0),
      totalIncoming: Number(detail.total_po_incoming ?? 0),
      dnCreated: Number(detail.total_dn_created ?? 0),
      dnIncoming: Number(detail.total_dn_incoming ?? 0),
      dnCode: detail.dn_number ?? dnNumber,
      type: detail.type ?? "-",
      status: detail.status ?? "-",
      createdAt: detail.created_at ?? "-",
    };
  }, [detail, dnNumber]);

  const progressPercent = useMemo(() => {
    if (!header.totalPo) return 0;
    return clampPercent(Math.round((Number(header.totalIncoming ?? 0) / Number(header.totalPo ?? 0)) * 100));
  }, [header.totalIncoming, header.totalPo]);

  const pendingUnits = useMemo(() => Math.max(Number(header.totalPo ?? 0) - Number(header.totalIncoming ?? 0), 0), [header.totalIncoming, header.totalPo]);

  const [activeTab, setActiveTab] = useState<DetailTabId>("details");
  const items = useMemo<DnDetailItem[]>(() => {
    if (!detail) return mockItems();
    return (detail.items ?? []).map((item, index) => {
      const quantity = Number(item.quantity ?? 0);
      const qtyReceived = Number(item.qty_received ?? 0);
      return {
        key: String(item.id ?? item.packing_number ?? index),
        itemId: String(item.id ?? index),
        uniq: item.item_uniq_code ?? "-",
        materialgrade: detail.material_grade ?? "-",
        materialInfo: {
          code: item.kanban?.kanban_number ?? "-",
          name: item.item_uniq_code ?? "-",
          model: detail.type ?? "-",
        },
        totalQty: quantity,
        remainingQty: Math.max(quantity - qtyReceived, 0),
        uom: item.uom ?? "-",
        orderQty: Number(item.order_qty ?? 0),
        packingNumber: item.packing_number ?? "-",
        pcsPerKanban: Number(item.pcs_per_kanban ?? 0),
        dateIncoming: formatDate(item.date_incoming ?? item.received_at ?? "-"),
        qtyReceived,
        qtySent: Number(item.qty_sent ?? 0),
        weight: Number(item.weight ?? 0),
        weightReceived: Number(item.weight_received ?? 0),
        qualityStatus: item.quality_status ?? "-",
        qr: item.qr,
        check: item.check ?? "-",
      };
    });
  }, [detail]);

  const firstItem = items[0] ?? null;
  const expectedIncomingDate = useMemo(() => {
    const values = items
      .map((item) => item.dateIncoming)
      .filter((value) => value && value !== "-")
      .sort();
    return values[0] ?? "-";
  }, [items]);

  const packingLists = useMemo(() => {
    const map = new Map<string, { packingNumber: string; uniq: string; orderQty: number; receivedQty: number; uom: string; dateIncoming: string }>();
    for (const item of items) {
      const packing = item.packingNumber || "-";
      if (!map.has(packing)) {
        map.set(packing, {
          packingNumber: packing,
          uniq: item.uniq,
          orderQty: item.orderQty,
          receivedQty: Math.max(item.totalQty - item.remainingQty, 0),
          uom: item.uom,
          dateIncoming: item.dateIncoming,
        });
      }
    }
    return Array.from(map.values());
  }, [items]);

  // ---- Label packing (QR + PO, UNIQ, Packing, Nama Supplier, Qty, Packing No) ----
  const isSubconDn = String(detail?.type ?? header.type ?? "").toUpperCase() === "SC";
  const supplierItemsQuery = useListSupplierItemsQuery(undefined, { skip: !apiEnabled || !isSubconDn });
  const [runLabelScan] = useLazyScanProcurementDnPackingQuery(); // terpisah dari form scan di halaman ini
  const labelQrCache = useRef<Record<string, string>>({});
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelPreview, setLabelPreview] = useState<PackingLabel | null>(null);

  // Packing yang punya nomor; urutan "i dari N" mengikuti daftar ini (sama dengan modal di list DN).
  const labelItems = useMemo(
    () => items.filter((item) => item.packingNumber && item.packingNumber !== "-"),
    [items],
  );

  const labelSupplierName = useMemo(() => {
    const stored = String(header.supplier ?? "-");
    if (!isSubconDn) return stored;
    // DN Subcon: nama SubCon sama dengan yang tampil di list (Master Supplier Item subcon).
    return resolveSubconSupplierName({
      storedName: stored,
      uniqCodes: items.map((item) => item.uniq),
      supplierItems: supplierItemsQuery.data ?? [],
    });
  }, [header.supplier, isSubconDn, items, supplierItemsQuery.data]);

  const buildLabel = async (packingNumber: string): Promise<PackingLabel | null> => {
    const index = labelItems.findIndex((item) => item.packingNumber === packingNumber);
    if (index < 0) return null;
    const item = labelItems[index];

    let qr = normalizeQrSrc(item.qr) || labelQrCache.current[packingNumber] || "";
    if (!qr && apiEnabled) {
      try {
        const res = await runLabelScan({ packing: packingNumber, qty: 1 }).unwrap();
        qr = normalizeQrSrc(res.data?.qr);
        if (qr) labelQrCache.current[packingNumber] = qr;
      } catch {
        // QR tidak tersedia untuk packing ini; dilewati oleh pemanggil
      }
    }
    if (!qr) return null;

    return {
      qr,
      uniq: item.uniq,
      packing: item.packingNumber,
      po: String(header.poNumber ?? "-"),
      supplier: labelSupplierName,
      qty: formatLabelQty(item.totalQty, item.uom),
      packingNo: `${index + 1} dari ${labelItems.length}`,
    };
  };

  const printLabels = async (packingNumbers: string[]) => {
    if (packingNumbers.length === 0) {
      message.warning("Tidak ada packing untuk dicetak");
      return;
    }
    setLabelBusy(true);
    try {
      const labels: PackingLabel[] = [];
      for (const packingNumber of packingNumbers) {
        const label = await buildLabel(packingNumber);
        if (label) labels.push(label);
      }
      if (labels.length === 0) {
        message.warning("QR belum tersedia untuk packing ini");
        return;
      }
      if (labels.length < packingNumbers.length) {
        message.warning(`${packingNumbers.length - labels.length} packing dilewati karena QR belum tersedia`);
      }
      printHtmlViaIframe(buildPackingLabelsHtml(labels, { title: `Packing Labels - ${header.dnCode}` }));
    } finally {
      setLabelBusy(false);
    }
  };

  const openLabelPreview = async (packingNumber: string) => {
    setLabelBusy(true);
    try {
      const label = await buildLabel(packingNumber);
      if (!label) {
        message.warning("QR belum tersedia untuk packing ini");
        return;
      }
      setLabelPreview(label);
    } finally {
      setLabelBusy(false);
    }
  };

  // ---- Dokumen DN (format A4 seperti Delivery Note: header, tabel item, tanda tangan di footer) ----
  // Nomor & nama part tidak dibawa item DN, jadi diambil dari BOM.
  const bomTreeQuery = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeQuery.data?.data ?? []),
    [bomTreeQuery.data?.data],
  );
  // Alamat & lead time supplier: bila belum ada di detail DN, dilengkapi dari list DN.
  const needSupplierInfo = Boolean(detail) && !detail?.supplier?.full_address;
  const dnListQuery = useListProcurementDnsQuery(undefined, { skip: !apiEnabled || !needSupplierInfo });

  const handlePrintDnDocument = () => {
    if (!detail) {
      message.warning("Data DN belum tersedia");
      return;
    }
    const listDn = (dnListQuery.data?.data ?? []).find(
      (d) => String(d.id) === String(detail.id) || (d.dn_number && d.dn_number === detail.dn_number),
    );
    const dn = {
      ...(listDn ?? {}),
      ...detail,
      supplier: { ...(listDn?.supplier ?? {}), ...(detail.supplier ?? {}) },
    } as ProcurementDnRecord;
    printHtmlViaIframe(
      buildDnDocumentHtml(
        [dn],
        {
          partNumberByUniq: bomIndex.partNumberByUniq,
          partNameByUniq: bomIndex.partNameByUniq,
          supplierItems: supplierItemsQuery.data ?? [],
        },
        String(dn.dn_number ?? header.dnCode),
      ),
    );
  };

  // ---- Edit DN ----
  // Hanya DN yang belum diproses (belum ada scan incoming/outgoing) yang bisa diedit, dan hanya:
  // Pengiriman ke / total, WO Number (Subcon), serta qty dan tanggal incoming per item.
  // PO, supplier, daftar item, nomor packing, dan QR tidak berubah (label yang sudah dicetak tetap valid).
  const [updateDn, updateDnState] = useUpdateProcurementDnMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [editDeliveryTo, setEditDeliveryTo] = useState<number | null>(null);
  const [editDeliveryTotal, setEditDeliveryTotal] = useState<number | null>(null);
  const [editWoNumber, setEditWoNumber] = useState("");
  const [editItems, setEditItems] = useState<
    Array<{ id: number; uniq: string; packing: string; uom: string; qty: number | null; date: Dayjs | null }>
  >([]);

  const editLockedReason = useMemo(() => {
    if (!detail) return "Data DN belum tersedia";
    if (String(detail.status ?? "").toLowerCase() !== "active") return `DN berstatus ${detail.status ?? "-"}, tidak bisa diedit`;
    const processed = (detail.items ?? []).some((item) => {
      const check = String(item.check ?? "").trim().toLowerCase();
      return (
        Number(item.qty_received ?? 0) > 0 ||
        Number(item.qty_sent ?? 0) > 0 ||
        Boolean(item.received_at) ||
        (check !== "" && check !== "progress")
      );
    });
    return processed ? "DN sudah diproses (ada scan incoming/outgoing), tidak bisa diedit" : "";
  }, [detail]);

  const openEdit = () => {
    if (!detail || editLockedReason) {
      message.warning(editLockedReason || "Data DN belum tersedia");
      return;
    }
    setEditDeliveryTo(detail.delivery_to != null ? Number(detail.delivery_to) : null);
    setEditDeliveryTotal(detail.delivery_total != null ? Number(detail.delivery_total) : null);
    setEditWoNumber(String(detail.wo_number ?? ""));
    setEditItems(
      (detail.items ?? []).map((item) => {
        const parsed = item.date_incoming ? dayjs(item.date_incoming) : null;
        return {
          id: Number(item.id),
          uniq: item.item_uniq_code ?? "-",
          packing: item.packing_number ?? "-",
          uom: item.uom ?? "",
          qty: item.quantity != null ? Number(item.quantity) : null,
          date: parsed && parsed.isValid() ? parsed : null,
        };
      }),
    );
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (editItems.some((item) => !item.qty || item.qty <= 0 || !Number.isInteger(item.qty))) {
      message.error("Qty setiap item harus bilangan bulat lebih dari 0");
      return;
    }
    try {
      await updateDn({
        id: dnNumber,
        body: {
          delivery_to: editDeliveryTo ?? undefined,
          delivery_total: editDeliveryTotal ?? undefined,
          ...(isSubconDn ? { wo_number: editWoNumber.trim() } : {}),
          items: editItems.map((item) => ({
            id: item.id,
            qty: Number(item.qty),
            incoming_date: item.date ? item.date.format("DD/MM/YYYY") : undefined,
          })),
        },
      }).unwrap();
      message.success("DN berhasil diperbarui");
      setEditOpen(false);
    } catch (error) {
      message.error(getApiErrorMessage(error, "Gagal memperbarui DN"));
    }
  };

  const incomingLogs = useMemo(() => {
    if (!detail) return [] as Array<{ packing: string; uniq: string; qty: number; quality: string; receivedAt: string }>;
    return (detail.items ?? [])
      .map((it) => {
        const qty = Number(it.qty_received ?? 0);
        return {
          packing: it.packing_number ?? "-",
          uniq: it.item_uniq_code ?? "-",
          qty,
          quality: it.quality_status ?? "-",
          receivedAt: formatDateTime((it.received_at ?? it.date_incoming ?? "-") as string),
        };
      })
      .filter((l) => l.qty > 0 || l.receivedAt !== "-")
      .slice(0, 6);
  }, [detail]);

  const historyLogs = useMemo(() => {
    const rows = historyQuery.data?.data ?? [];
    return rows.map((row, index) => ({
      key: String(row.id ?? index),
      uniq: row.uniq_code ?? "-",
      qty: Number(row.qty_change ?? 0),
      source: row.source_flag ?? "-",
      packing: row.packing_number ?? "-",
      by: row.logged_by ?? "-",
      at: formatDateTime(row.logged_at ?? "-"),
    }));
  }, [historyQuery.data]);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set(items.map((item) => item.key)));
  };

  const toggleOne = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const allChecked = items.length > 0 && selectedKeys.size === items.length;

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              onClick={() => router.push(`/dn-management?tab=${encodeURIComponent(tab)}`)}
            >
              <LeftOutlined />
              <span>Back to Delivery Notes</span>
            </button>

            <div className="flex items-center gap-2">
              <Button onClick={() => router.push(`/dn-management?tab=${encodeURIComponent(tab)}`)}>Close</Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">Delivery Note Details</div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-xl font-semibold text-gray-900">Delivery Note Details</div>
                  <div className="text-sm text-gray-500">View complete delivery note information including tracking, packing lists, and incoming logs</div>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{progressPercent}%</span> received • Pending {formatNumber(pendingUnits)} units
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <div className="text-xs text-gray-500">PO Number</div>
                    <div className="text-xl font-semibold text-gray-900">{header.poNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Material Grade</div>
                    <div className="text-xl font-semibold text-gray-900">  {detail?.material_grade ?? "-"} - {firstItem?.uniq ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Month</div>
                    <div className="text-xl font-semibold text-gray-900">{formatPeriodLabel(header.period)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Status</div>
                    <div className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${toStatusTone(header.status)}`}>
                      {String(header.status ?? "-")}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Pengiriman</div>
                    <div className="text-xl font-semibold text-gray-900">
                      {Number(detail?.delivery_total ?? 0) > 0
                        ? `Ke ${Number(detail?.delivery_to ?? 0)} / ${Number(detail?.delivery_total ?? 0)}`
                        : Number(detail?.delivery_to ?? 0) > 0
                          ? `Ke ${Number(detail?.delivery_to ?? 0)}`
                          : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="rounded-2xl border border-gray-100 p-5">
                <div className="text-sm font-semibold text-gray-900">Supplier Information</div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-gray-500">Supplier Name</div>
                    <div className="text-xl font-semibold text-gray-900">{detail?.supplier?.supplier_name ?? header.supplier}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Date Order</div>
                    <div className="text-lg font-medium text-gray-900">{formatDate(header.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Expected Incoming Date</div>
                    <div className="text-lg font-medium text-gray-900">{expectedIncomingDate}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-5">
                <div className="text-sm font-semibold text-gray-900">Material Specifications</div>
                <div className="mt-4">
                  <div className="text-xs text-gray-500">Material Description</div>
                  <div className="text-xl font-medium text-gray-900">{detail?.material_grade ?? "-"} - {firstItem?.uniq ?? "-"} {header.type ? `• ${header.type}` : ""}</div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="text-xs text-gray-500">Unit of Measure</div>
                    <div className="text-lg font-semibold text-gray-900">{firstItem?.uom ?? "-"}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="text-xs text-gray-500">Packing Type</div>
                    <div className="text-lg font-semibold text-gray-900">{firstItem?.packingNumber ? "Pallet" : "-"}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="text-xs text-gray-500">Pcs per Kanban</div>
                    <div className="text-lg font-semibold text-gray-900">{formatConfiguredNumber(firstItem?.pcsPerKanban)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-5">
                <div className="text-xl font-semibold text-gray-900">DN Tracking & Delivery Status</div>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
                    <div className="text-xs text-gray-500">Total PO</div>
                    <div className="text-4xl font-semibold text-blue-600">{formatCompactNumber(header.totalPo)}</div>
                  </div>
                  <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-center">
                    <div className="text-xs text-gray-500">DN Created</div>
                    <div className="text-4xl font-semibold text-purple-600">{formatCompactNumber(header.dnCreated)}</div>
                  </div>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                    <div className="text-xs text-gray-500">Total Incoming</div>
                    <div className="text-4xl font-semibold text-green-600">{formatCompactNumber(header.totalIncoming)}</div>
                  </div>
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center">
                    <div className="text-xs text-gray-500">Open DN</div>
                    <div className="text-4xl font-semibold text-orange-600">{formatCompactNumber(pendingUnits)}</div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-gray-600">DN Incoming Progress</span>
                    <span className="font-semibold text-gray-900">{progressPercent}%</span>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-green-500" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>Received: {formatNumber(header.totalIncoming)}</span>
                    <span>Total DN: {formatNumber(header.totalPo)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Packing Lists</div>
                    <div className="text-xs text-gray-500">View and print packing labels</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-500">{packingLists.length} packings</div>
                    <Button size="small" loading={labelBusy} onClick={() => printLabels(labelItems.map((item) => item.packingNumber))}>
                      Print All Labels
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {packingLists.slice(0, 4).map((p) => (
                    <div key={p.packingNumber} className="rounded-xl border border-gray-100 bg-white p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{p.packingNumber}</div>
                          <div className="mt-1 text-xs text-gray-500">Packing List #{p.packingNumber.split("-").slice(-1)[0] ?? "-"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => openLabelPreview(p.packingNumber)}
                            disabled={labelBusy}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            onClick={() => printLabels([p.packingNumber])}
                            disabled={labelBusy}
                          >
                            Print
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {packingLists.length > 4 ? <div className="text-xs text-gray-500">Showing first 4 packing lists…</div> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-6 border-b border-gray-100 bg-white px-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab("details")}
                    className={`pb-3 text-sm font-medium ${activeTab === "details" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"
                      }`}
                  >
                    Details
                  </button>
                </div>

                <div className="bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left font-medium px-4 py-3">
                            <input type="checkbox" checked={allChecked} onChange={(event) => toggleAll(event.target.checked)} />
                          </th>
                          <th className="text-left font-medium px-4 py-3">Material Grade</th>
                          <th className="text-left font-medium px-4 py-3">Material Info</th>
                          <th className="text-left font-medium px-4 py-3">Total Qty</th>
                          <th className="text-left font-medium px-4 py-3">Remaining Qty</th>
                          <th className="text-left font-medium px-4 py-3">UoM</th>
                          <th className="text-left font-medium px-4 py-3">PO Qty</th>
                          <th className="text-left font-medium px-4 py-3">Packing Number</th>
                          <th className="text-left font-medium px-4 py-3">Pcs/Kanban</th>
                          <th className="text-left font-medium px-4 py-3">Date Incoming</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((item) => {
                          const checked = selectedKeys.has(item.key);
                          return (
                            <tr key={item.key} className="text-gray-800">
                              <td className="px-4 py-4">
                                <input type="checkbox" checked={checked} onChange={(event) => toggleOne(item.key, event.target.checked)} />
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-blue-600">
                                  {item.materialgrade}
                                </div>
                                <div className="font-medium text-gray-900">
                                  {item.uniq}
                                </div>
                              </td>
                              <td className="px-4 py-4 min-w-[220px]">
                                <div className="text-[11px] text-gray-500">{item.materialInfo.code}</div>
                                <div className="text-sm font-medium text-gray-900">{item.materialInfo.name}</div>
                                <div className="text-[11px] text-gray-500">{item.materialInfo.model}</div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">{formatNumber(item.totalQty)}</td>
                              <td className="px-4 py-4 whitespace-nowrap">{formatNumber(item.remainingQty)}</td>
                              <td className="px-4 py-4 whitespace-nowrap">{item.uom}</td>
                              <td className="px-4 py-4 whitespace-nowrap">{formatNumber(item.orderQty)}</td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">{item.packingNumber}</span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">{formatConfiguredNumber(item.pcsPerKanban)}</td>
                              <td className="px-4 py-4 whitespace-nowrap">{item.dateIncoming}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold text-gray-900">Incoming Logs</div>
                  </div>
                  <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => message.info("Incoming logs view is not wired yet")}>View all</button>
                </div>

                <div className="mt-4 space-y-3">
                  {incomingLogs.length === 0 ? (
                    <div className="text-sm text-gray-500">No incoming logs yet.</div>
                  ) : (
                    incomingLogs.map((l, idx) => (
                      <div key={`${l.packing}-${idx}`} className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">{idx + 1}</div>
                            <div>
                              <div className="text-lg font-medium text-gray-900">Scanned: {l.packing}</div>
                              <div className="text-sm text-gray-500">By Warehouse Team</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-semibold text-blue-600">{formatCompactNumber(l.qty)} pcs</div>
                            <div className="text-xs text-gray-500">{l.receivedAt}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold text-gray-900">History Logs</div>
                    <div className="text-xs text-gray-500">Stock tercatat saat QC Incoming di-approve (mendukung partial incoming per DN)</div>
                  </div>
                  <div className="text-xs text-gray-500">{historyLogs.length} logs</div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  {historyQuery.isFetching ? (
                    <div className="text-sm text-gray-500">Loading history…</div>
                  ) : historyLogs.length === 0 ? (
                    <div className="text-sm text-gray-500">Belum ada history logs. Log muncul setelah QC Incoming di-approve.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left font-medium px-4 py-3">Uniq</th>
                          <th className="text-left font-medium px-4 py-3">Packing / DN</th>
                          <th className="text-left font-medium px-4 py-3">Reason</th>
                          <th className="text-left font-medium px-4 py-3">Qty</th>
                          <th className="text-left font-medium px-4 py-3">By</th>
                          <th className="text-left font-medium px-4 py-3">Last Update</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {historyLogs.map((log) => (
                          <tr key={log.key} className="text-gray-800">
                            <td className="px-4 py-3 font-medium text-gray-900">{log.uniq}</td>
                            <td className="px-4 py-3">{log.packing}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                {log.source === "qc_approve" ? "QC Approved" : log.source}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-green-700">+{formatNumber(log.qty)}</td>
                            <td className="px-4 py-3">{log.by}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{log.at}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-900">Scan Packing</div>
                <div className="mt-2 flex flex-col gap-3">
                  <Input
                    placeholder="Input packing number"
                    value={scanPacking}
                    onChange={(event) => setScanPacking(event.target.value)}
                    onPressEnter={() => {
                      const packing = scanPacking.trim();
                      if (!packing) return;
                      void runScan({ packing, qty: 1 });
                    }}
                  />
                  <Button
                    type="primary"
                    onClick={() => {
                      const packing = scanPacking.trim();
                      if (!packing) {
                        message.warning("Packing number is required");
                        return;
                      }
                      void runScan({ packing, qty: 1 });
                    }}
                    loading={scanState.isFetching}
                  >
                    Scan
                  </Button>
                </div>
                {scanState.data?.data ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-700">
                    <div className="rounded-xl border border-gray-100 bg-white p-3">
                      <div className="text-xs text-gray-500">Packing</div>
                      <div className="font-medium text-gray-900">{scanState.data.data.packing_number ?? "-"}</div>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white p-3">
                      <div className="text-xs text-gray-500">Uniq</div>
                      <div className="font-medium text-gray-900">{scanState.data.data.item_uniq_code ?? "-"}</div>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white p-3">
                      <div className="text-xs text-gray-500">Qty Stated / Received</div>
                      <div className="font-medium text-gray-900">
                        {formatNumber(scanState.data.data.qty_stated)} / {formatNumber(scanState.data.data.qty_received)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white p-3">
                      <div className="text-xs text-gray-500">Check</div>
                      <div className="font-medium text-gray-900">{scanState.data.data.check ?? "-"}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-white">
              <Button onClick={() => router.push(`/dn-management?tab=${encodeURIComponent(tab)}`)}>Close</Button>
              <Button icon={<EditOutlined />} onClick={openEdit} disabled={!detail || Boolean(editLockedReason)} title={editLockedReason || undefined}>
                Edit DN
              </Button>
              <Button onClick={() => message.info("Scan incoming from this page uses the form above")}>Scan Incoming</Button>
              <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrintDnDocument} disabled={!detail}>
                Print DN
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Modal
        open={editOpen}
        title={`Edit DN ${header.dnCode}`}
        onCancel={() => setEditOpen(false)}
        onOk={handleSaveEdit}
        okText="Simpan"
        cancelText="Batal"
        confirmLoading={updateDnState.isLoading}
        width={760}
        destroyOnClose
      >
        <div className="text-xs text-gray-500 mb-3">
          Hanya qty dan tanggal incoming item yang bisa diubah. PO, supplier, daftar item, nomor packing, dan QR tetap.
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <div className="text-xs text-gray-500 mb-1">Pengiriman ke</div>
            <InputNumber className="w-full" min={0} precision={0} value={editDeliveryTo} onChange={(v) => setEditDeliveryTo(v)} />
          </label>
          <label className="block">
            <div className="text-xs text-gray-500 mb-1">Dari total pengiriman</div>
            <InputNumber className="w-full" min={0} precision={0} value={editDeliveryTotal} onChange={(v) => setEditDeliveryTotal(v)} />
          </label>
          {isSubconDn ? (
            <label className="block">
              <div className="text-xs text-gray-500 mb-1">WO Number</div>
              <Input value={editWoNumber} onChange={(e) => setEditWoNumber(e.target.value)} />
            </label>
          ) : null}
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-medium px-3 py-2">Uniq</th>
                <th className="text-left font-medium px-3 py-2">Packing</th>
                <th className="text-left font-medium px-3 py-2">Qty</th>
                <th className="text-left font-medium px-3 py-2">Incoming Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {editItems.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{item.uniq}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{item.packing}</td>
                  <td className="px-3 py-2">
                    <InputNumber
                      min={1}
                      precision={0}
                      value={item.qty}
                      addonAfter={item.uom || undefined}
                      onChange={(v) =>
                        setEditItems((prev) => prev.map((row, i) => (i === index ? { ...row, qty: v } : row)))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <DatePicker
                      format="DD/MM/YYYY"
                      value={item.date}
                      allowClear={false}
                      onChange={(v) =>
                        setEditItems((prev) => prev.map((row, i) => (i === index ? { ...row, date: v } : row)))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal
        open={Boolean(labelPreview)}
        title="Label Packing"
        onCancel={() => setLabelPreview(null)}
        footer={[
          <Button key="close" onClick={() => setLabelPreview(null)}>
            Close
          </Button>,
          <Button
            key="print"
            type="primary"
            onClick={() => labelPreview && printHtmlViaIframe(buildPackingLabelsHtml([labelPreview], { title: `Packing Label - ${labelPreview.packing}`, columns: 2 }))}
          >
            Print Label
          </Button>,
        ]}
        width={360}
      >
        {labelPreview ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-3">
            <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-gray-50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={labelPreview.qr} alt="QR" className="h-40 w-40 object-contain" />
            </div>
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              <div>PO: <span className="font-semibold text-gray-900">{labelPreview.po}</span></div>
              <div>UNIQ: <span className="font-semibold text-gray-900">{labelPreview.uniq}</span></div>
              <div>Packing: <span className="font-semibold text-gray-900">{labelPreview.packing}</span></div>
              <div>Nama Supplier: <span className="font-semibold text-gray-900">{labelPreview.supplier}</span></div>
              <div>Qty: <span className="font-semibold text-gray-900">{labelPreview.qty}</span></div>
              <div>Packing No: <span className="font-semibold text-gray-900">{labelPreview.packingNo}</span></div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default function DnRawMaterialDetailPage() {
  return (
    <Suspense fallback={null}>
      <DnRawMaterialDetailPageContent />
    </Suspense>
  );
}
