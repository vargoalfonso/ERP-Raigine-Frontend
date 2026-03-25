"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatsCard from "@/components/StatsCard";
import { Button, Modal, QRCode, message } from "antd";
import { encodeBarcodePayload } from "@/lib/utils/barcodePayload";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetProcurementDnBoardQuery } from "@/lib/api/procurement-dn/api";
import { getApiErrorMessage } from "@/lib/api/error";

type DnTabId = "dn-board" | "po-dn-management" | "ppic-view" | "incoming-logs";

type DnRow = {
  key: string;
  period: string;
  dnNumber: string;
  totalPo: number;
  totalIncoming: number;
  progressPercent: number;
  pendingUnits: number;
  dnCreated: number;
  dnIncoming: number;
  supplier: string;
};

const dnRows: DnRow[] = [
  {
    key: "DN-001",
    period: "Oct\n-25",
    dnNumber: "DN-001",
    totalPo: 1000,
    totalIncoming: 950,
    progressPercent: 95,
    pendingUnits: 50,
    dnCreated: 1000,
    dnIncoming: 950,
    supplier: "PT Steel Indonesia",
  },
  {
    key: "DN-002",
    period: "Oct\n-25",
    dnNumber: "DN-002",
    totalPo: 800,
    totalIncoming: 0,
    progressPercent: 0,
    pendingUnits: 800,
    dnCreated: 800,
    dnIncoming: 0,
    supplier: "PT Metal Works",
  },
  {
    key: "DN-003",
    period: "Oct\n-25",
    dnNumber: "DN-003",
    totalPo: 600,
    totalIncoming: 600,
    progressPercent: 100,
    pendingUnits: 0,
    dnCreated: 600,
    dnIncoming: 600,
    supplier: "PT Chemical Solutions",
  },
];

const receiptStatus = (progressPercent: number) => {
  if (progressPercent >= 100) return "Fully Received";
  if (progressPercent <= 0) return "Pending Receipt";
  return "Pending Receipt";
};

export default function DnManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DnTabId>("dn-board");

  const [mockRows, setMockRows] = useState<DnRow[]>(dnRows);

  const apiEnabled = Boolean(apiBaseUrl);
  const dnBoardQuery = useGetProcurementDnBoardQuery(undefined, { skip: !apiEnabled });

  const rows = useMemo<DnRow[]>(() => {
    if (!apiEnabled) return mockRows;
    const list = dnBoardQuery.data?.data ?? [];
    return list.map((r) => {
      const dnCreated = Number(r.dn_created ?? 0);
      const dnIncoming = Number(r.dn_incoming ?? 0);
      const totalPo = Number(r.total_po ?? 0);
      const totalIncoming = Number(r.total_incoming ?? 0);
      const pendingUnits = Math.max(0, dnCreated - dnIncoming);
      const progressPercent = dnCreated > 0 ? Math.round((dnIncoming / dnCreated) * 100) : 0;
      const rawMonth = String(r.month ?? "");
      const period = rawMonth ? rawMonth.replace("-", "\n-") : "-";

      return {
        key: String(r.po_id ?? r.id ?? ""),
        period,
        dnNumber: String(r.po_number ?? r.po_id ?? r.id ?? "-"),
        totalPo,
        totalIncoming,
        progressPercent,
        pendingUnits,
        dnCreated,
        dnIncoming,
        supplier: String(r.supplier_name ?? r.subcon_name ?? "-"),
      };
    });
  }, [apiEnabled, dnBoardQuery.data?.data]);

  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeRow, setBarcodeRow] = useState<DnRow | null>(null);

  const totalDns = useMemo(() => rows.length, [rows]);
  const fullyReceived = useMemo(() => rows.filter((r) => r.progressPercent >= 100).length, [rows]);
  const pendingReceipt = useMemo(() => rows.filter((r) => r.progressPercent < 100).length, [rows]);
  const varianceIssues = useMemo(() => rows.filter((r) => r.pendingUnits > 0).length, [rows]);

  const openDetail = (idOrPo: string) => {
    router.push(`/dn-management/detail/${encodeURIComponent(idOrPo)}`);
  };

  const openBarcode = (row: DnRow) => {
    setBarcodeRow(row);
    setBarcodeOpen(true);
  };

  const deleteRow = (dnNumber: string) => {
    if (apiEnabled) {
      message.info(`Delete action is available in DN detail: ${dnNumber}`);
      return;
    }
    const ok = window.confirm(`Delete ${dnNumber}?`);
    if (!ok) return;
    setMockRows((prev) => prev.filter((r) => r.dnNumber !== dnNumber));
  };

  useEffect(() => {
    if (!apiEnabled) return;
    if (!dnBoardQuery.error) return;
    message.error(getApiErrorMessage(dnBoardQuery.error, "Failed to load DN board"));
  }, [apiEnabled, dnBoardQuery.error]);

  const tabs: { id: DnTabId; label: string; icon: React.ReactNode }[] = [
    {
      id: "dn-board",
      label: "DN Board",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6M9 11h6M9 15h6" />
        </svg>
      ),
    },
    {
      id: "po-dn-management",
      label: "PO & DN Management",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 7l1 14h12l1-14" />
        </svg>
      ),
    },
    {
      id: "ppic-view",
      label: "PPIC View",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3h2v18h-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 7h14M5 12h14M5 17h14" />
        </svg>
      ),
    },
    {
      id: "incoming-logs",
      label: "Incoming Logs",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h6M9 9h6M9 13h6M9 17h6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
        </svg>
      ),
    },
  ];

  const statsIcons = {
    totalDns: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6M9 11h6M9 15h6" />
      </svg>
    ),
    fullyReceived: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22a10 10 0 110-20 10 10 0 010 20z" />
      </svg>
    ),
    pending: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22a10 10 0 110-20 10 10 0 010 20z" />
      </svg>
    ),
    variance: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 4h.01" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-gray-900">DN Management</div>
            <div className="text-sm text-gray-500">
              Track incoming DN created vs DN incoming and PO totals with comprehensive PPIC view and variance analysis
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 text-sm hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h16M7 16V8m5 8V5m5 11v-6" />
              </svg>
              Analytics
            </button>
            <button
              type="button"
              onClick={() => router.push("/dn-management/create")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white border border-blue-600 text-sm hover:bg-blue-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create DN
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatsCard title="Total DNs" value={totalDns} icon={statsIcons.totalDns} bgColor="bg-blue-50" textColor="text-blue-600" />
        <StatsCard title="Fully Received" value={fullyReceived} icon={statsIcons.fullyReceived} bgColor="bg-green-50" textColor="text-green-600" />
        <StatsCard title="Pending Receipt" value={pendingReceipt} icon={statsIcons.pending} bgColor="bg-orange-50" textColor="text-orange-600" />
        <StatsCard title="Variance Issues" value={varianceIssues} icon={statsIcons.variance} bgColor="bg-red-50" textColor="text-red-600" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="inline-flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filters:
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white w-full lg:max-w-xl">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                className="w-full text-sm outline-none placeholder:text-gray-400"
                placeholder="Search by PO, Supplier, Uniq, or Material..."
                defaultValue=""
              />
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 text-sm hover:bg-gray-50">
              All Months
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 text-sm hover:bg-gray-50">
              All Status
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 text-sm hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l-3-3m3 3l3-3" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 pt-5">
          <div className="bg-gray-100 rounded-xl p-2 flex items-center gap-2">
            {tabs.map((t) => {
              const isActive = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                    isActive ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span className={isActive ? "text-gray-600" : "text-gray-500"}>{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 pb-6 pt-4">
          {activeTab !== "dn-board" ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-sm text-gray-500">
              This tab is a placeholder. Share the screenshot for this tab and I’ll match it.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left font-medium px-4 py-3">PERIOD</th>
                      <th className="text-left font-medium px-4 py-3">DN NUMBER</th>
                      <th className="text-left font-medium px-4 py-3">TOTAL PO</th>
                      <th className="text-left font-medium px-4 py-3">TOTAL INCOMING</th>
                      <th className="text-left font-medium px-4 py-3">DELIVERY STATUS</th>
                      <th className="text-left font-medium px-4 py-3">DELIVERY NOTES</th>
                      <th className="text-left font-medium px-4 py-3">SUPPLIER</th>
                      <th className="text-right font-medium px-4 py-3">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r) => {
                      const status = receiptStatus(r.progressPercent);
                      const isComplete = status === "Fully Received";
                      const progressColor = isComplete ? "bg-green-500" : "bg-orange-500";
                      return (
                        <tr key={r.key} className="text-gray-800">
                          <td className="px-4 py-4 whitespace-pre-line text-gray-500">{r.period}</td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <button type="button" onClick={() => openDetail(r.key)} className="text-blue-600 font-medium hover:underline">
                              {r.dnNumber}
                            </button>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.totalPo.toLocaleString()}</td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <button type="button" className="text-blue-600 font-medium hover:underline">
                              {r.totalIncoming.toLocaleString()}
                            </button>
                          </td>
                          <td className="px-4 py-4 min-w-[220px]">
                            <div className="text-xs text-gray-500 mb-2">Progress: <span className="text-gray-800 font-medium">{r.progressPercent}%</span></div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${progressColor}`} style={{ width: `${r.progressPercent}%` }} />
                            </div>
                            {r.pendingUnits > 0 && (
                              <div className="mt-2 text-xs text-orange-600">Pending: {r.pendingUnits.toLocaleString()} units</div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-xs text-gray-500">DN Created: <span className="text-gray-900">{r.dnCreated.toLocaleString()}</span></div>
                            <div className="text-xs text-gray-500 mt-1">
                              DN Incoming: <span className="text-blue-600 font-medium">{r.dnIncoming.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 text-xs font-semibold">
                                {r.supplier
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((w) => w[0])
                                  .join("")
                                  .toUpperCase()}
                              </div>
                              <div className="text-sm font-medium text-gray-900">{r.supplier}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-3 text-gray-500">
                              <button type="button" className="hover:text-gray-700" aria-label="QR" onClick={() => openBarcode(r)}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h3v3H7V7zM14 7h3v3h-3V7zM7 14h3v3H7v-3z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 14h1m2 0h0m-3 3h3" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6z" />
                                </svg>
                              </button>
                              <button type="button" onClick={() => openDetail(r.key)} className="hover:text-gray-700" aria-label="View">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <button type="button" onClick={() => deleteRow(r.dnNumber)} className="hover:text-red-600" aria-label="Trash">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11v6M14 11v6" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                </svg>
                              </button>
                              <button type="button" className="hover:text-gray-700" aria-label="Download">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l-3-3m3 3l3-3" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-gray-100 bg-white">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Show rows</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-700">
                    10
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                  <span>1-10 of 521390 Results</span>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" className="w-8 h-8 rounded-md border border-gray-200 bg-gray-50 text-gray-400">&lt;</button>
                  <button type="button" className="w-8 h-8 rounded-md border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium">1</button>
                  <button type="button" className="w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-600 text-sm">2</button>
                  <span className="px-1 text-gray-400">…</span>
                  <button type="button" className="px-2 h-8 rounded-md border border-gray-200 bg-white text-gray-600 text-sm">12345</button>
                  <button type="button" className="w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-600">&gt;</button>
                  <span className="ml-3 text-xs text-gray-500">Go to Page</span>
                  <input className="w-14 h-8 rounded-md border border-gray-200 px-2 text-sm" defaultValue="" />
                  <button type="button" className="h-8 px-3 rounded-md border border-blue-500 bg-white text-blue-600 text-sm font-medium">Go</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        title={<span className="text-sm font-semibold">DN Barcode</span>}
        open={barcodeOpen}
        onCancel={() => {
          setBarcodeOpen(false);
          setBarcodeRow(null);
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              className="!rounded-lg"
              onClick={() => {
                setBarcodeOpen(false);
                setBarcodeRow(null);
              }}
            >
              Close
            </Button>
          </div>
        }
        width={620}
      >
        {barcodeRow ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="text-center">
              <div className="text-lg font-extrabold tracking-wide text-gray-900">DN INFORMATION</div>
              <div className="text-xs text-gray-500 mt-1">{barcodeRow.dnNumber}</div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-gray-500">Period</div>
                <div className="text-sm font-semibold text-gray-900 whitespace-pre-line">{barcodeRow.period}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500">Supplier</div>
                <div className="text-sm font-semibold text-gray-900">{barcodeRow.supplier}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500">Total PO</div>
                <div className="text-sm font-semibold text-gray-900">{barcodeRow.totalPo.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500">Total Incoming</div>
                <div className="text-sm font-semibold text-gray-900">{barcodeRow.totalIncoming.toLocaleString()}</div>
              </div>
            </div>

            <div className="my-5 h-px bg-gray-200" />

            <div className="flex items-center justify-center">
              <div className="rounded-lg border border-gray-200 p-3">
                <QRCode
                  value={encodeBarcodePayload({
                    v: 1,
                    t: "dn",
                    dnNumber: barcodeRow.dnNumber,
                    period: barcodeRow.period,
                    supplier: barcodeRow.supplier,
                    totalPo: barcodeRow.totalPo,
                    totalIncoming: barcodeRow.totalIncoming,
                    dnCreated: barcodeRow.dnCreated,
                    dnIncoming: barcodeRow.dnIncoming,
                  })}
                  size={180}
                  bordered={false}
                />
              </div>
            </div>

            <div className="mt-3 text-center text-sm font-semibold text-gray-900">{barcodeRow.dnNumber}</div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No DN selected.</div>
        )}
      </Modal>
    </div>
  );
}
