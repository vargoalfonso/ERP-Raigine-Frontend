"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Input, message } from "antd";
import { LeftOutlined } from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetProcurementDnByIdQuery, useLazyScanProcurementDnPackingQuery } from "@/lib/api/procurement-dn/api";

type DetailTabId = "details";

type DnDetailItem = {
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
  dateIncoming: string;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const isMissingRouteError = (error: unknown): boolean => isRecord(error) && error.status === 404;

const formatNumber = (value: number | undefined) => new Intl.NumberFormat("en-US").format(Number(value ?? 0));

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

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
  };
}

function mockItems(): DnDetailItem[] {
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
      dateIncoming: "1/19/2024",
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
      dateIncoming: "1/19/2024",
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
        uniq: item.item_uniq_code ?? "-",
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
        pcsPerKanban: Number(item.pcs_per_kanban ?? item.kanban?.kanban_qty ?? 0),
        dateIncoming: item.date_incoming ?? item.received_at ?? "-",
      };
    });
  }, [detail]);

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
          receivedAt: (it.received_at ?? it.date_incoming ?? "-") as string,
        };
      })
      .filter((l) => l.qty > 0 || l.receivedAt !== "-")
      .slice(0, 6);
  }, [detail]);

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
              onClick={() => router.push(`/dn-procurement?tab=${encodeURIComponent(tab)}`)}
            >
              <LeftOutlined />
              <span>Back to Delivery Notes</span>
            </button>

            <div className="flex items-center gap-2">
              <Button onClick={() => router.push(`/dn-procurement?tab=${encodeURIComponent(tab)}`)}>Close</Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">Delivery Note Details</div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-base font-semibold text-gray-900">{header.dnCode}</div>
                  <div className="text-sm text-gray-500">Complete delivery note information</div>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{progressPercent}%</span> received • Pending {formatNumber(pendingUnits)} units
                </div>
              </div>

              <div className="mt-4">
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className="lg:col-span-3 space-y-6">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-sm font-semibold text-gray-900">Summary</div>
                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <div className="text-xs text-gray-500">Period</div>
                        <div className="text-sm font-medium text-gray-900">{header.period}</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <div className="text-xs text-gray-500">PO Number</div>
                        <div className="text-sm font-medium text-gray-900">{header.poNumber}</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <div className="text-xs text-gray-500">Supplier</div>
                        <div className="text-sm font-medium text-gray-900">{header.supplier}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <div className="text-xs text-gray-500">Total PO</div>
                        <div className="text-sm font-semibold text-gray-900">{formatNumber(header.totalPo)}</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <div className="text-xs text-gray-500">Total Incoming</div>
                        <div className="text-sm font-semibold text-gray-900">{formatNumber(header.totalIncoming)}</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <div className="text-xs text-gray-500">DN Created</div>
                        <div className="text-sm font-semibold text-gray-900">{formatNumber(header.dnCreated)}</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-white p-3">
                        <div className="text-xs text-gray-500">DN Incoming</div>
                        <div className="text-sm font-semibold text-gray-900">{formatNumber(header.dnIncoming)}</div>
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
                              <div className="text-xs text-gray-500">Packing Number</div>
                              <div className="text-sm font-semibold text-gray-900 truncate">{p.packingNumber}</div>
                              <div className="mt-1 text-xs text-gray-500">UNIQ: <span className="font-medium text-gray-900">{p.uniq}</span></div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => message.info("View packing details is not wired yet")}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                onClick={() => message.info("Print packing labels from the DN Management page")}
                              >
                                Print
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div>
                              <div className="text-[11px] text-gray-500">Order Qty</div>
                              <div className="text-sm font-medium text-gray-900">{formatNumber(p.orderQty)}</div>
                            </div>
                            <div>
                              <div className="text-[11px] text-gray-500">Received Qty</div>
                              <div className="text-sm font-medium text-gray-900">{formatNumber(p.receivedQty)}</div>
                            </div>
                            <div>
                              <div className="text-[11px] text-gray-500">UoM</div>
                              <div className="text-sm font-medium text-gray-900">{p.uom}</div>
                            </div>
                            <div>
                              <div className="text-[11px] text-gray-500">Date Incoming</div>
                              <div className="text-sm font-medium text-gray-900">{p.dateIncoming}</div>
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
                        className={`pb-3 text-sm font-medium ${
                          activeTab === "details" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"
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
                            {items.map((item) => {
                              const checked = selectedKeys.has(item.key);
                              return (
                                <tr key={item.key} className="text-gray-800">
                                  <td className="px-4 py-4">
                                    <input type="checkbox" checked={checked} onChange={(event) => toggleOne(item.key, event.target.checked)} />
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">{item.uniq}</td>
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
                                    <span className="inline-flex px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium">{item.packingNumber}</span>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">{formatNumber(item.pcsPerKanban)}</td>
                                  <td className="px-4 py-4 whitespace-nowrap">{item.dateIncoming}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
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

                  <div className="rounded-2xl border border-gray-100 p-4 bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Incoming Logs</div>
                        <div className="text-xs text-gray-500">Latest received items</div>
                      </div>
                      <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => message.info("Incoming logs view is not wired yet")}>View all</button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {incomingLogs.length === 0 ? (
                        <div className="text-sm text-gray-500">No incoming logs yet.</div>
                      ) : (
                        incomingLogs.map((l, idx) => (
                          <div key={`${l.packing}-${idx}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-xs text-gray-500">Packing</div>
                                <div className="text-sm font-medium text-gray-900 truncate">{l.packing}</div>
                                <div className="mt-1 text-xs text-gray-500">UNIQ: <span className="font-medium text-gray-900">{l.uniq}</span></div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500">Qty</div>
                                <div className="text-sm font-semibold text-gray-900">{formatNumber(l.qty)}</div>
                                <div className="mt-1 text-xs text-gray-500">{l.quality}</div>
                              </div>
                            </div>
                            <div className="mt-2 text-[11px] text-gray-500">Received: {l.receivedAt}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-white">
              <Button onClick={() => router.push(`/dn-procurement?tab=${encodeURIComponent(tab)}`)}>Close</Button>
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
