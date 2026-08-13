"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DatePicker, Modal, message } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import StatsCard from "@/components/StatsCard";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type ProcurementDnItem,
  type ProcurementDnRecord,
  type ProcurementDnType,
  useGetProcurementDnByIdQuery,
  useLazyScanProcurementDnPackingQuery,
  useListProcurementDnsQuery,
} from "@/lib/api/procurement-dn/api";
import {
  buildKanbanCardsHtml,
  buildKanbanId,
  kanbanCardCount,
  kanbanPrintStamp,
  kanbanQty,
  type KanbanCardData,
  type KanbanCategory,
} from "@/components/kanban/KanbanTransportCard";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";

type ProcurementTab = "raw" | "indirect" | "subcon";

type TabPaginationState = Record<ProcurementTab, { page: number; pageSize: number }>;

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
  deliveryTo: number;
  deliveryTotal: number;
};



const tabToType = (tab: ProcurementTab): ProcurementDnType => {
  if (tab === "indirect") return "IRM";
  if (tab === "subcon") return "SC";
  return "RM";
};

/** DN tab -> kanban card style. Raw Material is green, Indirect is cyan. */
const tabToKanbanCategory = (
  tab: ProcurementTab
): { category: KanbanCategory; label: string } => {
  if (tab === "indirect") return { category: "IRM", label: "Indirect" };
  if (tab === "subcon") return { category: "CP", label: "Child Parts" };
  return { category: "RM", label: "Raw Material" };
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

const normalizeQrSrc = (value: unknown): string => {
  const qr = String(value ?? "").trim();
  if (!qr || qr === "-") return "";
  if (qr.startsWith("data:image/")) return qr;
  if (qr.startsWith("http://") || qr.startsWith("https://")) return qr;

  const looksLikeBase64 = qr.length > 80 && /^[A-Za-z0-9+/=]+$/.test(qr);
  return looksLikeBase64 ? `data:image/png;base64,${qr}` : qr;
};

export default function DnManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProcurementTab>("raw");
  const [hiddenDn, setHiddenDn] = useState<Set<string>>(() => new Set());
  const [paginationByTab, setPaginationByTab] = useState<TabPaginationState>({
    raw: { page: 1, pageSize: 10 },
    indirect: { page: 1, pageSize: 10 },
    subcon: { page: 1, pageSize: 10 },
  });

  // [dn-export-per-day] State untuk modal export DN per hari.
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDate, setExportDate] = useState<Dayjs>(() => dayjs());
  const [exportBusy, setExportBusy] = useState(false);

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

  // Part names are not carried on the DN item, so they are resolved from BOM.
  const bomTreeQuery = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeQuery.data?.data ?? []),
    [bomTreeQuery.data?.data]
  );

  const procurementApiAvailable = apiEnabled && !listQuery.error;

  const rows = useMemo<DnRow[]>(() => {
    if (!procurementApiAvailable) return [];

    const type = tabToType(activeTab);
    const list = (listQuery.data?.data ?? []).filter((dn) => String(dn.type ?? "").toUpperCase() === type);

    return list
      .map((dn, index) => {
        const id = String(dn.id ?? "").trim() || String(dn.dn_number ?? dn.po_number ?? index);
        const totalPo = Number(dn.total_po_qty ?? 0);
        const totalIncoming = Number(dn.total_po_incoming ?? 0);
        const dnCreated = Number(dn.total_dn_created ?? 0);
        // Open DN (pending units) is defined as Total PO minus total incoming
        const pending = Math.max(totalPo - totalIncoming, 0);
        const progressPercent = totalPo > 0 ? Math.round((totalIncoming / totalPo) * 100) : 0;
        return {
          key: id,
          id,
          period: formatPeriodDisplay(dn.period ?? "-"),
          dnNumber: String(dn.dn_number ?? "-"),
          totalPo,
          totalIncoming,
          progressPercent,
          pendingUnits: pending,
          dnCreated,
          dnIncoming: Number(dn.total_dn_incoming ?? 0),
          supplier: String(dn.supplier_name ?? (dn.supplier_id ? `Supplier #${dn.supplier_id}` : "-")),
          deliveryTo: Number(dn.delivery_to ?? 0),
          deliveryTotal: Number(dn.delivery_total ?? 0),
        };
      })
      .filter((row) => !hiddenDn.has(row.dnNumber));
  }, [activeTab, hiddenDn, listQuery.data, procurementApiAvailable]);

  const activePagination = paginationByTab[activeTab];
  const totalPages = Math.max(1, Math.ceil(rows.length / activePagination.pageSize));
  const currentPage = Math.min(activePagination.page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * activePagination.pageSize;
    return rows.slice(start, start + activePagination.pageSize);
  }, [activePagination.pageSize, currentPage, rows]);

  const rangeStart = rows.length === 0 ? 0 : (currentPage - 1) * activePagination.pageSize + 1;
  const rangeEnd = rows.length === 0 ? 0 : Math.min(currentPage * activePagination.pageSize, rows.length);

  const paginationItems = useMemo<(number | "ellipsis")[]>(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, "ellipsis", totalPages];
    if (currentPage >= totalPages - 2) return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
  }, [currentPage, totalPages]);

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
          const res = await runScanPacking({ packing, qty: 1 }).unwrap();
          const qr = normalizeQrSrc(res.data?.qr);
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
      return { ...it, qr: normalizeQrSrc(resolvedQr) };
    });
  }, [barcodeLabelItems, barcodeQrByPacking]);

  const escapeHtml = (value: unknown): string =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  /**
   * Expands the DN items into Kanban Transport cards. One DN item becomes
   * ceil(total qty / qty per kanban) cards, numbered "01 / N".
   */
  const kanbanCards = useMemo<KanbanCardData[]>(() => {
    if (!barcodeData) return [];

    const { category, label } = tabToKanbanCategory(activeTab);
    const supplierCode = barcodeData.supplier?.supplier_code ?? "";
    const supplierName =
      barcodeData.supplier?.supplier_name ?? barcodeData.supplier_name ?? "";
    const supplier = [supplierCode, supplierName].filter(Boolean).join(" - ");
    const printedAt = kanbanPrintStamp();

    const cards: KanbanCardData[] = [];

    for (const item of barcodeItems) {
      const uniq = String(item.item_uniq_code ?? "").trim();
      const uom = String(item.uom ?? "PCS").toUpperCase();
      const totalPlan = Number(item.quantity ?? item.order_qty ?? 0);
      const perKanban =
        Number(item.pcs_per_kanban ?? item.kanban?.kanban_qty ?? 0) || totalPlan;
      const cardTotal = kanbanCardCount(totalPlan, perKanban);
      const qr = String(item.qr ?? "");
      const kanbanNumber = String(item.kanban?.kanban_number ?? "").trim();

      for (let index = 1; index <= cardTotal; index += 1) {
        cards.push({
          key: `${uniq}::${item.packing_number ?? ""}::${index}`,
          category,
          categoryLabel: label,
          partNumber: uniq || "-",
          partName: bomIndex.partNameByUniq[uniq] ?? "-",
          qtyPerKanban: kanbanQty(perKanban, uom),
          totalPlan: kanbanQty(totalPlan, uom),
          cardNo: index,
          cardTotal,
          kanbanId:
            cardTotal === 1 && kanbanNumber
              ? kanbanNumber
              : buildKanbanId(category, uniq, index, cardTotal),
          supplier: supplier || "-",
          plant: "-",
          // No plant / store / dock / routing data exists on the DN payload.
          batchLot: String(item.packing_number ?? "-"),
          basis: `DN ${barcodeData.dn_number ?? "-"}`,
          areaStore: "-",
          partLocation: "-",
          nextProcess: "-",
          dock: "-",
          lineStore: "-",
          partQr: qr,
          // The DN payload exposes one QR per packing number only.
          kanbanQr: qr,
          printedAt,
        });
      }
    }

    return cards;
  }, [activeTab, barcodeData, barcodeItems, bomIndex]);

  // [dn-export-per-day] Utilities untuk export Delivery Note per hari.
  //
  // Alur:
  // 1. User klik Export -> muncul modal DatePicker (default hari ini).
  // 2. User pilih tanggal -> filter semua DN pada tab aktif yang
  //    `incoming_date`-nya sama dengan tanggal terpilih.
  // 3. Untuk tiap DN yang cocok, render satu halaman print dengan layout
  //    Delivery Note yang mengikuti template PT. MATRA RODA PIRANTI.
  // 4. Buka jendela baru dan panggil window.print() supaya user bisa
  //    Save-as-PDF via dialog browser.

  // Formatter angka gaya Indonesia (ribuan pakai titik, desimal koma).
  const formatIdNumber = (
    value: number | undefined | null,
    fractionDigits = 0,
  ) => {
    if (value == null || !Number.isFinite(value)) return "-";
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  };

  const formatIdDate = (value: string | undefined | null) => {
    if (!value) return "-";
    const d = dayjs(value);
    if (!d.isValid()) return String(value);
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    return `${d.date()} ${months[d.month()]} ${d.year()}`;
  };

  // QR generator (public API, tanpa dependency baru).
  const buildQrSrc = (payload: string) => {
    const base = 'https://' + 'api.qrserver.com/v1/create-qr-code/';
    const q = encodeURIComponent(payload || '-');
    return `${base}?size=140x140&margin=0&data=${q}`;
  }

  const buildDnPageHtml = (
    dn: ProcurementDnRecord,
    printedAtLabel: string,
  ): string => {
    const dnNumber = String(dn.dn_number ?? "-").trim() || "-";
    const supplierName =
      dn.supplier?.supplier_name ?? dn.supplier_name ?? "-";
    const supplierAddress = dn.supplier?.full_address ?? "-";
    const dnDate = formatIdDate(dn.created_at);
    const deliveryDate = formatIdDate(dn.incoming_date);
    const cycleText =
      dn.supplier?.delivery_lead_time_days != null
        ? String(dn.supplier.delivery_lead_time_days)
        : "-";
    const rit =
      dn.delivery_to != null && dn.delivery_total != null
        ? `${dn.delivery_to} / ${dn.delivery_total}`
        : dn.delivery_to != null
          ? String(dn.delivery_to)
          : "-";
    const dnType = (dn.type ?? "-").toString().toUpperCase();
    const status = (dn.status ?? "-").toString().toUpperCase();

    let totalKbn = 0;
    let totalUnit = 0;
    const rowsHtml = (dn.items ?? [])
      .map((it: ProcurementDnItem, index: number) => {
        const uniq = it.item_uniq_code ?? "-";
        const partNumber = bomIndex.partNumberByUniq[uniq] ?? "-";
        const partName = bomIndex.partNameByUniq[uniq] ?? "-";
        const packing = it.packing_number ?? "-";
        const uom = (it.uom ?? "PCS").toString().toUpperCase();
        const snp = it.pcs_per_kanban ?? 0;
        const orderUnit = it.order_qty ?? 0;
        const orderKbn = snp > 0 ? orderUnit / snp : 0;
        totalKbn += orderKbn;
        totalUnit += orderUnit;
        return `
          <tr>
            <td class="c">${index + 1}</td>
            <td class="c b">${escapeHtml(uniq)}</td>
            <td>
              <div class="b">${escapeHtml(partNumber)}</div>
              <div class="muted">${escapeHtml(partName)}</div>
            </td>
            <td class="c">${escapeHtml(packing).toUpperCase()}</td>
            <td class="c">-</td>
            <td class="c">${escapeHtml(uom)}</td>
            <td class="r">${formatIdNumber(snp)}</td>
            <td class="r">${formatIdNumber(orderKbn, orderKbn % 1 === 0 ? 0 : 2)}</td>
            <td class="r">${formatIdNumber(orderUnit)}</td>
          </tr>`;
      })
      .join("");

    return `
      <section class="page">
        <div class="frame">
          <div class="top">
            <div class="brand">
              <div class="logo">
                <div class="logo-mark">MRP</div>
              </div>
              <div>
                <div class="brand-name">PT. MATRA RODA PIRANTI</div>
                <div class="brand-sub">Department Logistics (PPIC)</div>
              </div>
            </div>
            <div class="top-right">
              <div class="dn-title">DELIVERY NOTE</div>
              <div class="dn-number">${escapeHtml(dnNumber)}</div>
              <div class="dn-print-date">PRINT DATE : ${escapeHtml(printedAtLabel)}</div>
              <div class="dn-status"><span>STATUS : ${escapeHtml(status)}</span></div>
            </div>
          </div>

          <div class="info">
            <div class="info-col">
              <div class="info-row"><span class="label">SUPPLIER</span><span class="sep">:</span><span class="value b">${escapeHtml(supplierName)}</span></div>
              <div class="info-row"><span class="label">DATE</span><span class="sep">:</span><span class="value b">${escapeHtml(dnDate)}</span></div>
              <div class="info-row info-row-multi"><span class="label">DEL. TO</span><span class="sep">:</span><span class="value">${escapeHtml(supplierAddress)}</span></div>
              <div class="info-row"><span class="label">RECIPIENT</span><span class="sep">:</span><span class="value">PPIC / Receiving Warehouse</span></div>
            </div>
            <div class="info-qr">
              <img src="${escapeHtml(buildQrSrc(dnNumber))}" alt="DN QR" />
            </div>
            <div class="info-col">
              <div class="info-row"><span class="label">CYCLE</span><span class="sep">:</span><span class="value b">${escapeHtml(cycleText)}</span></div>
              <div class="info-row"><span class="label">DELIVERY</span><span class="sep">:</span><span class="value b">${escapeHtml(deliveryDate)}</span></div>
              <div class="info-row"><span class="label">RIT/TIME</span><span class="sep">:</span><span class="value b">${escapeHtml(rit)}</span></div>
              <div class="info-row"><span class="label">AREA</span><span class="sep">:</span><span class="value">-</span></div>
              <div class="info-row"><span class="label">TYPE</span><span class="sep">:</span><span class="value b">${escapeHtml(dnType === "RM" ? "NORMAL" : dnType)}</span></div>
            </div>
          </div>

          <table class="items">
            <thead>
              <tr>
                <th style="width:36px">NO.</th>
                <th style="width:70px">UNIQ</th>
                <th>PART NUMBER /<br/>PART NAME</th>
                <th style="width:80px">PACKING</th>
                <th style="width:70px">DROP<br/>ZONE</th>
                <th style="width:50px">UNIT</th>
                <th style="width:60px">SNP</th>
                <th style="width:70px">ORDER<br/>KBN</th>
                <th style="width:70px">ORDER<br/>UNIT</th>
              </tr>
            </thead>
            <tbody>${rowsHtml || `<tr><td colspan="9" class="c muted">Tidak ada item.</td></tr>`}</tbody>
            <tfoot>
              <tr>
                <td colspan="7" class="r b">Total</td>
                <td class="r b">${formatIdNumber(totalKbn, totalKbn % 1 === 0 ? 0 : 2)}</td>
                <td class="r b">${formatIdNumber(totalUnit)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="remarks">
            <div class="remarks-label">Remarks :</div>
            <div class="remarks-body">&nbsp;</div>
          </div>

          <div class="plant-tag">MRP PLANT 2</div>

          <div class="sig-grid">
            <div class="sig-box">
              <div class="sig-title">SECURITY</div>
              <div class="sig-area"></div>
              <div class="sig-date">Date:</div>
            </div>
            <div class="sig-box sig-box-double">
              <div class="sig-titles">
                <div>CONTROL MAN</div>
                <div>RECEIVED</div>
              </div>
              <div class="sig-areas">
                <div class="sig-area"></div>
                <div class="sig-area"></div>
              </div>
              <div class="sig-dates">
                <div>Date:</div>
                <div>Date:</div>
              </div>
            </div>
            <div class="sig-box sig-box-supplier">
              <div class="sig-title">SUPPLIER</div>
              <div class="sig-titles">
                <div>APPROVED</div>
                <div>PREPARED</div>
              </div>
              <div class="sig-areas">
                <div class="sig-area"></div>
                <div class="sig-area"></div>
              </div>
              <div class="sig-dates">
                <div>Date:</div>
                <div>Date:</div>
              </div>
            </div>
          </div>

          <div class="page-number">Page 1</div>
        </div>
      </section>`;
  };

  const buildDnPrintHtml = (
    dnList: ProcurementDnRecord[],
    dateLabel: string,
  ): string => {
    const printedAtLabel = dateLabel;
    const body = dnList
      .map((dn) => buildDnPageHtml(dn, printedAtLabel))
      .join("\n");
    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Delivery Notes - ${escapeHtml(dateLabel)}</title>
          <style>
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; background: #eef2f7; color: #111827; font-family: Arial, Helvetica, sans-serif; }
            .page { padding: 18px; page-break-after: always; }
            .page:last-child { page-break-after: auto; }
            .frame { background: #fff; border: 2px solid #111827; border-radius: 4px; padding: 14px 16px; }
            .top { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: flex-start; }
            .brand { display: flex; align-items: center; gap: 10px; }
            .logo { width: 42px; height: 42px; border: 1.5px solid #b91c1c; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #b91c1c; font-weight: 800; font-size: 11px; }
            .brand-name { font-size: 15px; font-weight: 800; color: #111827; }
            .brand-sub { font-size: 10px; color: #4b5563; margin-top: 2px; }
            .top-right { text-align: right; }
            .dn-title { font-size: 18px; font-weight: 800; letter-spacing: 0.02em; }
            .dn-number { font-size: 12px; margin-top: 4px; font-weight: 700; }
            .dn-print-date { font-size: 10px; color: #4b5563; margin-top: 2px; }
            .dn-status { margin-top: 4px; }
            .dn-status > span { border: 1px solid #111827; padding: 2px 8px; font-size: 10px; font-weight: 700; display: inline-block; }
            .info { display: grid; grid-template-columns: 1fr 150px 1fr; gap: 12px; margin-top: 14px; padding: 10px 4px; border-top: 1px solid #111827; }
            .info-col { display: flex; flex-direction: column; gap: 6px; font-size: 11px; }
            .info-row { display: grid; grid-template-columns: 68px 8px 1fr; align-items: baseline; }
            .info-row-multi .value { white-space: normal; }
            .info-row .label { color: #4b5563; font-weight: 600; letter-spacing: 0.03em; }
            .info-row .sep { color: #4b5563; }
            .info-row .value { color: #111827; }
            .info-qr { display: flex; align-items: center; justify-content: center; }
            .info-qr img { width: 130px; height: 130px; border: 1px solid #111827; padding: 4px; background: #fff; }
            .b { font-weight: 700; }
            .muted { color: #4b5563; font-size: 10px; margin-top: 1px; }
            .items { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10.5px; }
            .items th, .items td { border: 1px solid #111827; padding: 4px 6px; vertical-align: middle; }
            .items thead th { background: #f3f4f6; text-align: center; font-weight: 700; }
            .items td.c { text-align: center; }
            .items td.r { text-align: right; }
            .items tfoot td { background: #f9fafb; }
            .remarks { border: 1px solid #111827; border-top: none; padding: 10px 8px; min-height: 42px; }
            .remarks-label { font-size: 10px; color: #4b5563; }
            .plant-tag { text-align: center; font-size: 10px; color: #4b5563; margin: 10px 0 6px; }
            .sig-grid { display: grid; grid-template-columns: 1fr 1.5fr 1.4fr; gap: 8px; }
            .sig-box { border: 1px solid #111827; padding: 8px; display: flex; flex-direction: column; font-size: 10px; min-height: 110px; }
            .sig-title { text-align: center; font-weight: 700; letter-spacing: 0.04em; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
            .sig-area { flex: 1; }
            .sig-date { border-top: 1px solid #d1d5db; padding-top: 4px; }
            .sig-titles { display: grid; grid-template-columns: 1fr 1fr; text-align: center; font-weight: 700; letter-spacing: 0.04em; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
            .sig-titles > div + div { border-left: 1px solid #d1d5db; }
            .sig-areas { display: grid; grid-template-columns: 1fr 1fr; flex: 1; }
            .sig-areas > div + div { border-left: 1px solid #d1d5db; }
            .sig-dates { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #d1d5db; padding-top: 4px; }
            .sig-dates > div + div { border-left: 1px solid #d1d5db; padding-left: 6px; }
            .sig-box-supplier .sig-title { margin-bottom: 4px; }
            .page-number { text-align: right; font-size: 10px; color: #4b5563; margin-top: 8px; }
            @page { size: A4; margin: 8mm; }
            @media print {
              body { background: #fff; }
              .page { padding: 0; }
              .frame { border-width: 1.5px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${body}
          <div class="no-print" style="position:fixed; bottom:12px; right:12px;">
            <button onclick="window.print()" style="padding:8px 14px; border-radius:6px; border:1px solid #111827; background:#111827; color:#fff; cursor:pointer;">Print / Save as PDF</button>
          </div>
        </body>
      </html>`;
  };

  const handleExportDnByDate = () => {
    if (!procurementApiAvailable) {
      message.warning("Data DN belum tersedia.");
      return;
    }
    if (!exportDate || !exportDate.isValid()) {
      message.warning("Pilih tanggal terlebih dahulu.");
      return;
    }
    setExportBusy(true);
    try {
      const selectedIso = exportDate.format("YYYY-MM-DD");
      const type = tabToType(activeTab);
      // [dn-export-per-day] Filter berdasarkan `created_at` DN
      // (tanggal DN dibuat), bukan `incoming_date`, karena banyak DN
      // yang belum punya `incoming_date` terisi sehingga tidak masuk
      // filter. `created_at` selalu ada.
      const list = (listQuery.data?.data ?? []).filter((dn) => {
        if (String(dn.type ?? "").toUpperCase() !== type) return false;
        const created = dn.created_at ? dayjs(dn.created_at) : null;
        if (!created || !created.isValid()) return false;
        return created.format("YYYY-MM-DD") === selectedIso;
      });
      if (list.length === 0) {
        message.info(
          `Tidak ada DN pada ${exportDate.format("DD MMM YYYY")} untuk tab ini.`,
        );
        return;
      }
      const html = buildDnPrintHtml(list, exportDate.format("DD MMM YYYY"));
      const win = window.open("", "_blank", "width=900,height=1100");
      if (!win) {
        message.error(
          "Popup diblokir browser. Izinkan popup untuk mengunduh DN.",
        );
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
      setExportOpen(false);
    } catch (err) {
      console.error("[dn-export-per-day] failed", err);
      message.error("Gagal menyiapkan export DN.");
    } finally {
      setExportBusy(false);
    }
  };

  /** Prints through a hidden iframe so the app is never navigated away. */
  const handlePrintKanban = () => {
    if (kanbanCards.length === 0) {
      window.alert("Tidak ada kanban yang bisa dicetak untuk DN ini.");
      return;
    }

    const html = buildKanbanCardsHtml(
      kanbanCards,
      `Kanban Transport - ${barcodeData?.dn_number ?? "DN"}`
    );

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.srcdoc = html;

    iframe.onload = () => {
      const frameWindow = iframe.contentWindow;
      if (!frameWindow) return;
      frameWindow.focus();
      frameWindow.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          // already detached
        }
      }, 1000);
    };

    document.body.appendChild(iframe);
  };

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
          const res = await runScanPacking({ packing: packingKey, qty: 1 }).unwrap();
          const qr = normalizeQrSrc(res.data?.qr);
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
          const qr = normalizeQrSrc(it.qr ?? (packingKey ? qrByPacking[packingKey] : "") ?? "");
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
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline';" />
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
          </body>
        </html>
      `;

      // Render label HTML into the current page and trigger print dialog (no redirect)
      const printInPlace = () => {
        const container = document.createElement("div");
        container.id = "__copilot_print_container";
        container.style.position = "fixed";
        container.style.left = "0";
        container.style.top = "0";
        container.style.width = "100%";
        container.style.height = "100%";
        container.style.zIndex = "2147483647";
        container.style.background = "white";
        container.style.overflow = "auto";
        container.innerHTML = html;

        const style = document.createElement("style");
        style.setAttribute("data-copilot-print", "true");
        style.textContent = `
          @media print {
            body * { visibility: hidden !important; }
            #__copilot_print_container, #__copilot_print_container * { visibility: visible !important; }
            #__copilot_print_container { position: static !important; width: auto !important; height: auto !important; }
          }
        `;

        document.head.appendChild(style);
        document.body.appendChild(container);

        try {
          window.print();
        } finally {
          setTimeout(() => {
            try { document.body.removeChild(container); } catch {};
            try { const s = document.querySelector('style[data-copilot-print]'); if (s) s.remove(); } catch {};
          }, 1000);
        }
      };

      printInPlace();
      // Trigger automatic downloads for QR + simple e-label PNGs
      const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      };

      const fetchImage = async (url: string): Promise<HTMLImageElement | null> => {
        if (!url) return null;
        // If data URL, load directly
        if (typeof url === "string" && url.startsWith("data:")) {
          return await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url;
          });
        }
        try {
          const res = await fetch(url, { cache: "no-store" });
          const blob = await res.blob();
          return await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(blob);
          });
        } catch {
          return null;
        }
      };

      const renderLabelPng = async (qrUrl: string, uniq: string, packing: string, index: number) => {
        const img = await fetchImage(qrUrl);
        // canvas size: 400x520
        const cw = 400;
        const ch = 520;
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        // background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        // draw QR (centered)
        if (img) {
          const size = 320;
          const x = (cw - size) / 2;
          ctx.drawImage(img, x, 20, size, size);
        }
        // draw texts
        ctx.fillStyle = "#111827";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(uniq || "-", cw / 2, 370);
        ctx.font = "12px Arial";
        ctx.fillText(`Packing: ${packing || "-"}`, cw / 2, 394);
        ctx.fillText(`PO: ${poNumber || "-"}`, cw / 2, 414);

        return await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), "image/png");
        });
      };

      // Download sequentially to avoid browser popup/download blocking
      for (let i = 0; i < labels.length; i += 1) {
        const it = labels[i];
        const safeUniq = (it.uniq || "uniq").replaceAll(/[^a-z0-9\-_]/gi, "_");
        const safePacking = (it.packing || "packing").replaceAll(/[^a-z0-9\-_]/gi, "_");
        try {
          // Generate and download a single combined label PNG (QR + texts)
          const labelBlob = await renderLabelPng(it.qr, it.uniq, it.packing, i);
          if (labelBlob) {
            downloadBlob(labelBlob, `${title.replaceAll(/[^a-z0-9\-]/gi, "_")}-LABEL-${safeUniq}-${safePacking}-${i + 1}.png`);
          }
        } catch {
          // ignore individual failures
        }
      }
      // printing already handled via writeAndPrint for new window or iframe
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
              + Create DN
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
            {/* [dn-export-per-day] */}
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 text-sm hover:bg-gray-50"
              onClick={() => {
                setExportDate(dayjs());
                setExportOpen(true);
              }}
            >
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
                    <th className="text-left font-medium px-4 py-3">PENGIRIMAN</th>
                    <th className="text-right font-medium px-4 py-3">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedRows.map((r) => {
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
                            DN Created: <span className="text-gray-900">{r.totalPo.toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            DN Incoming: <span className="text-blue-600 font-medium">{r.totalIncoming.toLocaleString()}</span>
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
                        <td className="px-4 py-4 whitespace-nowrap">
                          {r.deliveryTotal > 0
                            ? `${r.deliveryTo}/${r.deliveryTotal}`
                            : r.deliveryTo > 0
                              ? String(r.deliveryTo)
                              : "-"}
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
                            {/* <button type="button" onClick={() => deleteRow(r.dnNumber)} className="hover:text-red-600" aria-label="Trash">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11v6M14 11v6" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                              </svg>
                            </button> */}
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
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">
                        No delivery notes found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-gray-100 bg-white">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Show rows</span>
                <select
                  value={activePagination.pageSize}
                  onChange={(e) => {
                    const nextSize = Number(e.target.value) || 10;
                    setPaginationByTab((prev) => ({
                      ...prev,
                      [activeTab]: { page: 1, pageSize: nextSize },
                    }));
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-700"
                >
                  {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span>{rangeStart}-{rangeEnd} of {rows.length} Results</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setPaginationByTab((prev) => ({
                      ...prev,
                      [activeTab]: { ...prev[activeTab], page: Math.max(1, currentPage - 1) },
                    }))
                  }
                  className={`w-8 h-8 rounded-md border text-sm ${
                    currentPage <= 1
                      ? "border-gray-200 bg-gray-50 text-gray-400"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  &lt;
                </button>
                {paginationItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-1 text-gray-400">…</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        setPaginationByTab((prev) => ({
                          ...prev,
                          [activeTab]: { ...prev[activeTab], page: item },
                        }))
                      }
                      className={`min-w-8 px-2 h-8 rounded-md border text-sm ${
                        item === currentPage
                          ? "border-blue-200 bg-blue-50 text-blue-700 font-medium"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setPaginationByTab((prev) => ({
                      ...prev,
                      [activeTab]: { ...prev[activeTab], page: Math.min(totalPages, currentPage + 1) },
                    }))
                  }
                  className={`w-8 h-8 rounded-md border text-sm ${
                    currentPage >= totalPages
                      ? "border-gray-200 bg-gray-50 text-gray-400"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  &gt;
                </button>
                <span className="ml-3 text-xs text-gray-500">Go to Page</span>
                <input
                  className="w-14 h-8 rounded-md border border-gray-200 px-2 text-sm"
                  value={String(currentPage)}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isFinite(next)) return;
                    setPaginationByTab((prev) => ({
                      ...prev,
                      [activeTab]: {
                        ...prev[activeTab],
                        page: Math.min(Math.max(1, next), totalPages),
                      },
                    }));
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    setPaginationByTab((prev) => ({
                      ...prev,
                      [activeTab]: {
                        ...prev[activeTab],
                        page: Math.min(Math.max(1, prev[activeTab].page), totalPages),
                      },
                    }))
                  }
                  className="h-8 px-3 rounded-md border border-blue-500 bg-white text-blue-600 text-sm font-medium"
                >
                  Go
                </button>
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
                className="inline-flex items-center justify-center rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                onClick={handlePrintKanban}
                disabled={!barcodeData || kanbanCards.length === 0}
              >
                Print Kanban ({kanbanCards.length})
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

      {/* [dn-export-per-day] Modal pilih tanggal untuk export Delivery Note */}
      <Modal
        title="Export Delivery Note per Hari"
        open={exportOpen}
        onCancel={() => (exportBusy ? null : setExportOpen(false))}
        maskClosable={!exportBusy}
        footer={[
          <Button
            key="cancel"
            onClick={() => setExportOpen(false)}
            disabled={exportBusy}
          >
            Batal
          </Button>,
          <Button
            key="export"
            type="primary"
            loading={exportBusy}
            onClick={handleExportDnByDate}
          >
            Download PDF
          </Button>,
        ]}
      >
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            Pilih tanggal DN dibuat (created at). Semua DN{" "}
            <span className="font-semibold">
              {activeTab === "raw"
                ? "Raw Material"
                : activeTab === "indirect"
                  ? "Indirect"
                  : "Sub-Con"}
            </span>{" "}
            yang dibuat pada tanggal tersebut akan dicetak dengan format
            Delivery Note standar.
          </div>
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">
              Tanggal DN Dibuat
            </div>
            <DatePicker
              className="w-full"
              format="DD MMM YYYY"
              value={exportDate}
              onChange={(v) => v && setExportDate(v)}
              allowClear={false}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
