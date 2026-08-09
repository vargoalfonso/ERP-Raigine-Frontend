"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Input, message } from "antd";
import { DownloadOutlined, EditOutlined, LeftOutlined } from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetProcurementDnByIdQuery, useLazyScanProcurementDnPackingQuery, useGetProcurementDnHistoryQuery } from "@/lib/api/procurement-dn/api";

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
                  <div className="text-xs text-gray-500">{packingLists.length} packings</div>
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
                            onClick={() => message.info(`Packing ${p.packingNumber}`)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            onClick={() => window.print()}
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
              <Button icon={<EditOutlined />} onClick={() => router.push(`/dn-management/create?tab=${encodeURIComponent(tab)}&id=${encodeURIComponent(String(dnNumber))}`)}>
                Edit DN
              </Button>
              <Button onClick={() => message.info("Scan incoming from this page uses the form above")}>Scan Incoming</Button>
              <Button type="primary" icon={<DownloadOutlined />} onClick={() => window.print()}>
                Download DN Detail
              </Button>
            </div>
          </div>
        </div>
      </div>
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
