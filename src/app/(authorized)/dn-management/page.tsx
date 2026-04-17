"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatsCard from "@/components/StatsCard";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type ProcurementDnType,
  useGetProcurementDnByIdQuery,
  useLazyScanProcurementDnPackingQuery,
  useListProcurementDnsQuery,
} from "@/lib/api/procurement-dn/api";

type ProcurementTab = "raw" | "indirect" | "subcon";

type DnRow = {
  key: string;
  id: string;
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
    id: "DN-001",
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
    id: "DN-002",
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
    id: "DN-003",
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

const tabToType = (tab: ProcurementTab): ProcurementDnType => {
  if (tab === "indirect") return "IRM";
  if (tab === "subcon") return "SC";
  return "RM";
};

const formatPeriodDisplay = (value: string): string => {
  const trimmed = String(value ?? "").trim();
  const match = /^([0-1]\d)\/(\d{4})$/.exec(trimmed);
  if (!match) return trimmed || "-";
  const month = Number(match[1]);
  const year = Number(match[2]);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const label = months[month - 1] ?? trimmed;
  const yy = String(year).slice(-2);
  return `${label}\n-${yy}`;
};

const receiptStatus = (progressPercent: number) => {
  if (progressPercent >= 100) return "Fully Received";
  if (progressPercent <= 0) return "Pending Receipt";
  return "Pending Receipt";
};

export default function DnManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProcurementTab>("raw");
  const [hiddenDn, setHiddenDn] = useState<Set<string>>(() => new Set());

  const [barcodeDnId, setBarcodeDnId] = useState<string | null>(null);
  const [barcodeCopies, setBarcodeCopies] = useState<number>(1);
  const [barcodeColumns, setBarcodeColumns] = useState<2 | 3>(3);
  const [barcodeIncludePo, setBarcodeIncludePo] = useState<boolean>(true);
  const [barcodeIncludeUniq, setBarcodeIncludeUniq] = useState<boolean>(true);
  const [barcodeQrByPacking, setBarcodeQrByPacking] = useState<Record<string, string>>({});
  const [barcodePreparing, setBarcodePreparing] = useState(false);

  const apiEnabled = Boolean(apiBaseUrl);
  const listQuery = useListProcurementDnsQuery(undefined, { skip: !apiEnabled });
  const barcodeQuery = useGetProcurementDnByIdQuery(barcodeDnId ?? "", {
    skip: !apiEnabled || !barcodeDnId,
  });
  const [runScanPacking] = useLazyScanProcurementDnPackingQuery();

  const procurementApiAvailable = apiEnabled && !listQuery.error;

  const rows = useMemo<DnRow[]>(() => {
    if (!procurementApiAvailable) return dnRows;

    const type = tabToType(activeTab);
    const list = (listQuery.data?.data ?? []).filter((dn) => String(dn.type ?? "").toUpperCase() === type);

    return list
      .map((dn, index) => {
        const id = String(dn.id ?? "").trim() || String(dn.dn_number ?? dn.po_number ?? index);
        const totalPo = Number(dn.total_po_qty ?? 0);
        const totalIncoming = Number(dn.total_po_incoming ?? 0);
        const progressPercent = totalPo > 0 ? Math.round((totalIncoming / totalPo) * 100) : 0;
        return {
          key: id,
          id,
          period: formatPeriodDisplay(dn.period ?? "-"),
          dnNumber: String(dn.dn_number ?? "-"),
          totalPo,
          totalIncoming,
          progressPercent,
          pendingUnits: Math.max(totalPo - totalIncoming, 0),
          dnCreated: Number(dn.total_dn_created ?? 0),
          dnIncoming: Number(dn.total_dn_incoming ?? 0),
          supplier: String(dn.supplier_name ?? (dn.supplier_id ? `Supplier #${dn.supplier_id}` : "-")),
        };
      })
      .filter((row) => !hiddenDn.has(row.dnNumber));
  }, [activeTab, hiddenDn, listQuery.data, procurementApiAvailable]);

  const totalDns = useMemo(() => rows.length, [rows]);
  const fullyReceived = useMemo(() => rows.filter((r) => r.progressPercent >= 100).length, [rows]);
  const pendingReceipt = useMemo(() => rows.filter((r) => r.progressPercent < 100).length, [rows]);
  const varianceIssues = useMemo(() => rows.filter((r) => r.pendingUnits > 0).length, [rows]);

  const openDetail = (dnId: string) => {
    router.push(`/dn-management/detail/${encodeURIComponent(dnId)}?tab=${encodeURIComponent(activeTab)}`);
  };

  const deleteRow = (dnNumber: string) => {
    const ok = window.confirm(`Delete ${dnNumber}?`);
    if (!ok) return;
    setHiddenDn((prev) => {
      const next = new Set(prev);
      next.add(dnNumber);
      return next;
    });
  };

  const tabs: { id: ProcurementTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "raw",
      label: "Raw Material",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6M9 11h6M9 15h6" />
        </svg>
      ),
    },
    {
      id: "indirect",
      label: "Indirect",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 7l1 14h12l1-14" />
        </svg>
      ),
    },
    {
      id: "subcon",
      label: "Subcon",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3h2v18h-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 7h14M5 12h14M5 17h14" />
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

  const barcodeData = barcodeQuery.data?.data;

  useEffect(() => {
    setBarcodeQrByPacking({});
    setBarcodePreparing(false);
  }, [barcodeDnId]);

  const barcodeLabelItems = useMemo(() => {
    const items = barcodeData?.items ?? [];
    return items.filter((it) => Boolean(it.packing_number));
  }, [barcodeData?.items]);

  useEffect(() => {
    if (!barcodeDnId || !barcodeData) return;

    const preview = (barcodeData.items ?? []).slice(0, 6);
    const missingPackings = Array.from(
      new Set(
        preview
          .filter((it) => !it.qr)
          .map((it) => it.packing_number)
          .filter((p): p is string => Boolean(p && String(p).trim()))
          .map((p) => String(p).trim())
      )
    ).filter((p) => !barcodeQrByPacking[p]);

    if (missingPackings.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const packing of missingPackings) {
        try {
          const res = await runScanPacking({ packing }).unwrap();
          const qr = res.data?.qr;
          if (!qr) continue;
          if (cancelled) return;
          setBarcodeQrByPacking((prev) => (prev[packing] ? prev : { ...prev, [packing]: qr }));
        } catch {
          // Best-effort (preview only)
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [barcodeDnId, barcodeData, barcodeQrByPacking, runScanPacking]);

  const barcodeItems = useMemo(() => {
    return barcodeLabelItems.map((it) => {
      const packingKey = it.packing_number ? String(it.packing_number).trim() : "";
      const resolvedQr = it.qr ?? (packingKey ? barcodeQrByPacking[packingKey] : undefined);
      return { ...it, qr: resolvedQr };
    });
  }, [barcodeLabelItems, barcodeQrByPacking]);

  const escapeHtml = (value: unknown): string =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const handlePrintBarcodes = async () => {
    if (!barcodeData) return;

    const baseItems = barcodeLabelItems;
    if (baseItems.length === 0) {
      window.alert("No barcode labels available to print.");
      return;
    }

    setBarcodePreparing(true);
    try {
      const qrByPacking: Record<string, string> = { ...barcodeQrByPacking };

      for (const it of baseItems) {
        if (it.qr) continue;
        const packingKey = it.packing_number ? String(it.packing_number).trim() : "";
        if (!packingKey) continue;
        if (qrByPacking[packingKey]) continue;

        try {
          const res = await runScanPacking({ packing: packingKey }).unwrap();
          const qr = res.data?.qr;
          if (qr) qrByPacking[packingKey] = qr;
        } catch {
          // ignore; we'll just skip that label
        }
      }

      setBarcodeQrByPacking(qrByPacking);

      const labels = baseItems
        .map((it) => {
          const packingKey = it.packing_number ? String(it.packing_number).trim() : "";
          const packingDisplay = it.packing_number ?? "-";
          const uniq = it.item_uniq_code ?? "-";
          const qr = it.qr ?? (packingKey ? qrByPacking[packingKey] : "") ?? "";
          return { packing: packingDisplay, uniq, qr };
        })
        .filter((l) => Boolean(l.qr));

      if (labels.length === 0) {
        window.alert("No barcode QR available. Please ensure /delivery-notes/scan returns qr for the packing numbers.");
        return;
      }

      const copies = Math.max(1, Math.min(100, Math.floor(Number(barcodeCopies) || 1)));
      const cols = barcodeColumns;
      const title = `Barcode Labels - ${barcodeData.dn_number ?? barcodeData.id ?? "DN"}`;
      const poNumber = barcodeData.po_number ?? "-";

      const cards: string[] = [];
      for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
        for (const it of labels) {
          cards.push(`
            <div class="card">
              <div class="qr">
                <img src="${escapeHtml(it.qr)}" alt="QR" />
              </div>
              <div class="meta">
                ${barcodeIncludePo ? `<div class="line">PO: <span>${escapeHtml(poNumber)}</span></div>` : ""}
                ${barcodeIncludeUniq ? `<div class="line">UNIQ: <span>${escapeHtml(it.uniq)}</span></div>` : ""}
                <div class="line">Packing: <span>${escapeHtml(it.packing)}</span></div>
              </div>
            </div>
          `);
        }
      }

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>${escapeHtml(title)}</title>
            <style>
              :root { --border: #e5e7eb; --muted: #6b7280; --text: #111827; }
              * { box-sizing: border-box; }
              body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: var(--text); }
              .wrap { padding: 16px; }
              .grid { display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: 12px; }
              .card { border: 1px solid var(--border); border-radius: 12px; padding: 12px; page-break-inside: avoid; }
              .qr { display: flex; align-items: center; justify-content: center; background: #f9fafb; border: 1px solid var(--border); border-radius: 10px; padding: 10px; }
              .qr img { width: 160px; height: 160px; object-fit: contain; }
              .meta { margin-top: 10px; font-size: 12px; color: var(--muted); }
              .line { margin-top: 4px; }
              .line span { color: var(--text); font-weight: 600; }
              @media print {
                .wrap { padding: 0; }
                .card { break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <div class="wrap">
              <div class="grid">
                ${cards.join("\n")}
              </div>
            </div>
            <script>window.onload = () => window.print();</script>
          </body>
        </html>
      `;

      const w = window.open("", "_blank");
      if (!w) {
        window.alert("Pop-up blocked. Please allow pop-ups to print.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } finally {
      setBarcodePreparing(false);
    }
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
              onClick={() => router.push(`/dn-management/create?tab=${encodeURIComponent(activeTab)}`)}
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
              <input className="w-full text-sm outline-none placeholder:text-gray-400" placeholder="Search by PO, Supplier, Uniq, or Material..." defaultValue="" />
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
                          <button type="button" onClick={() => openDetail(r.id)} className="text-blue-600 font-medium hover:underline">
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
                          <div className="text-xs text-gray-500 mb-2">
                            Progress: <span className="text-gray-800 font-medium">{r.progressPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${progressColor}`} style={{ width: `${r.progressPercent}%` }} />
                          </div>
                          {r.pendingUnits > 0 && (
                            <div className="mt-2 text-xs text-orange-600">Pending: {r.pendingUnits.toLocaleString()} units</div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-xs text-gray-500">
                            DN Created: <span className="text-gray-900">{r.dnCreated.toLocaleString()}</span>
                          </div>
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
                            <button type="button" className="hover:text-gray-700" aria-label="QR" title="Barcode" onClick={() => setBarcodeDnId(r.id)}>
                              <span className="sr-only">QR</span>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h3v3H7V7zM14 7h3v3h-3V7zM7 14h3v3H7v-3z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 14h1m2 0h0m-3 3h3" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6z" />
                              </svg>
                            </button>
                            <button type="button" onClick={() => openDetail(r.id)} className="hover:text-gray-700" aria-label="View">
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
        </div>
      </div>

      {barcodeDnId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
              <div>
                <div className="text-base font-semibold text-gray-900">Print Barcode Labels</div>
                <div className="text-sm text-gray-500">Generate and print barcode labels for packing lists</div>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setBarcodeDnId(null)}
              >
                Close
              </button>
            </div>

            <div className="px-6 py-5">
              {barcodeQuery.isFetching ? <div className="text-sm text-gray-600">Loading…</div> : null}

              {!barcodeQuery.isFetching && !barcodeData ? <div className="text-sm text-gray-600">No barcode data available.</div> : null}

              {barcodeData ? (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-900">Delivery Note</div>
                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <div className="rounded-xl border border-gray-100 bg-white p-3">
                          <div className="text-xs text-gray-500">PO Number</div>
                          <div className="text-sm font-medium text-gray-900">{barcodeData.po_number ?? "-"}</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white p-3">
                          <div className="text-xs text-gray-500">Material UNIQ</div>
                          <div className="text-sm font-medium text-gray-900">{barcodeData.items?.[0]?.item_uniq_code ?? "-"}</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white p-3">
                          <div className="text-xs text-gray-500">Material Name</div>
                          <div className="text-sm font-medium text-gray-900">
                            {barcodeData.items?.[0]?.kanban?.kanban_number ?? barcodeData.items?.[0]?.item_uniq_code ?? "-"}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">Supplier: {barcodeData.supplier_name ?? "-"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 p-4">
                      <div className="text-sm font-semibold text-gray-900">Print Options</div>
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <div className="text-xs text-gray-500">Copies</div>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={barcodeCopies}
                              onChange={(e) => setBarcodeCopies(Number(e.target.value))}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                            />
                          </label>

                          <label className="block">
                            <div className="text-xs text-gray-500">Columns</div>
                            <select
                              value={barcodeColumns}
                              onChange={(e) => setBarcodeColumns((Number(e.target.value) === 2 ? 2 : 3) as 2 | 3)}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                            >
                              <option value={3}>3</option>
                              <option value={2}>2</option>
                            </select>
                          </label>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <div className="text-xs font-medium text-gray-700">Include on label</div>
                          <div className="mt-2 space-y-2 text-sm text-gray-700">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={barcodeIncludePo} onChange={(e) => setBarcodeIncludePo(e.target.checked)} />
                              PO Number
                            </label>
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={barcodeIncludeUniq} onChange={(e) => setBarcodeIncludeUniq(e.target.checked)} />
                              Material UNIQ
                            </label>
                          </div>
                        </div>

                        <div className="text-xs text-gray-500">
                          Labels available: <span className="font-medium text-gray-900">{barcodeLabelItems.length}</span>
                          {barcodePreparing ? <span className="ml-2 text-gray-400">Preparing QR…</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-3 rounded-2xl border border-gray-100 p-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Barcode Label Preview</div>
                      <div className="text-xs text-gray-500">Preview first 6 labels</div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {barcodeItems.slice(0, 6).map((it, idx) => {
                        const qrSrc = it.qr ? String(it.qr) : "";
                        return (
                          <div key={String(it.id ?? it.packing_number ?? idx)} className="rounded-2xl border border-gray-100 bg-white p-3">
                            <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-gray-50 p-3">
                              {qrSrc ? (
                                <img src={qrSrc} alt="QR" className="h-40 w-40 object-contain" />
                              ) : (
                                <div className="h-40 w-40 rounded-lg border border-dashed border-gray-200 bg-white flex items-center justify-center text-xs text-gray-400">
                                  No QR
                                </div>
                              )}
                            </div>
                            <div className="mt-2 text-xs text-gray-500">{it.packing_number ?? "-"}</div>
                            <div className="mt-1 text-[11px] text-gray-400">PO: {barcodeData.po_number ?? "-"}</div>
                            <div className="text-[11px] text-gray-400">UNIQ: {it.item_uniq_code ?? "-"}</div>
                          </div>
                        );
                      })}
                    </div>

                    {barcodeLabelItems.length > 6 ? <div className="mt-3 text-xs text-gray-500">Showing first 6 labels…</div> : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-white">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setBarcodeDnId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={handlePrintBarcodes}
                disabled={!barcodeData || barcodeLabelItems.length === 0 || barcodePreparing}
              >
                {barcodePreparing ? "Preparing…" : "Print Labels"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
