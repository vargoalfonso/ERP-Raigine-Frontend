"use client";

/* Hallmark · pre-emit critique: P4 H4 E4 S5 R5 V4
 * surface: work-order detail · macrostructure: Workbench
 * genre: modern-minimal · tone: utilitarian-clean
 * audience: production operators and planners
 * use: inspect and print QR for each work-order item
 */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftOutlined,
  CloseOutlined,
  PrinterOutlined,
  QrcodeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Empty, Progress, Spin, Tag, message } from "antd";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { formatWorkOrderDisplayNumber } from "@/lib/utils/workOrder";
import {
  useGetWorkOrderByIdQuery,
  useGetWorkOrderItemQRQuery,
} from "@/lib/api/work-orders/api";
import {
  buildKanbanCardsHtml,
  buildKanbanId,
  kanbanCardCount,
  kanbanNextProcessLabel,
  kanbanPrintStamp,
  kanbanQty,
  resolveWorkOrderKanbanCategory,
  type KanbanCardData,
} from "@/components/kanban/KanbanTransportCard";

type DetailRow = {
  key: string;
  id: string;
  uniq: string;
  partName: string;
  partNumber: string;
  model: string;
  quantity: string;
  processName: string;
  status: string;
  kanbanNumber: string;
  qrDataUrl?: string;
  /** Routing snapshot; each step carries the is_assembly flag. */
  processFlowJson: unknown;
};

type DetailFieldProps = {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US");
};

const normalizeStatusColor = (value?: string) => {
  const lower = String(value ?? "").toLowerCase();
  if (lower.includes("approve") || lower.includes("complete") || lower.includes("close")) return "green";
  if (lower.includes("progress") || lower.includes("process")) return "blue";
  if (lower.includes("pending")) return "gold";
  if (lower.includes("reject") || lower.includes("error")) return "red";
  return "default";
};

const DetailField = ({ label, value, mono }: DetailFieldProps) => (
  <div className="min-w-0">
    <div className="text-[11px] font-medium text-slate-500">{label}</div>
    <div
      className={`mt-1 min-w-0 break-words text-sm font-semibold text-slate-950 ${
        mono ? "font-mono tabular-nums" : ""
      }`}
    >
      {value}
    </div>
  </div>
);

const escapePrint = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const apiEnabled = Boolean(apiBaseUrl) && Boolean(id);
  const autoPrintedRef = useRef(false);

  const { data: workOrder, isFetching } = useGetWorkOrderByIdQuery(id ?? "", {
    skip: !apiEnabled,
  });
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !Boolean(apiBaseUrl),
  });

  const [frontAging, setFrontAging] = useState<number | null>(null);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [brokenQRSrc, setBrokenQRSrc] = useState("");

  useEffect(() => {
    if (workOrder?.aging_days != null) {
      setFrontAging(Number(workOrder.aging_days));
    }
  }, [workOrder?.aging_days]);

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data]
  );

  const detailRows = useMemo<DetailRow[]>(() => {
    return (workOrder?.items ?? []).map((item, index) => ({
      key: item.id || `${item.item_uniq_code}-${index}`,
      id: item.id,
      uniq: item.item_uniq_code,
      partName: item.part_name ?? bomIndex.partNameByUniq[item.item_uniq_code] ?? "-",
      partNumber: item.part_number ?? bomIndex.partNumberByUniq[item.item_uniq_code] ?? "-",
      model: item.model ?? bomIndex.assemblyCodeByUniq[item.item_uniq_code] ?? "-",
      quantity: `${item.quantity} ${item.uom || "pcs"}`,
      processName: item.process_name || "-",
      status: item.status || "Pending",
      kanbanNumber: item.kanban_number ?? "-",
      qrDataUrl: item.qr_data_url,
      processFlowJson: item.process_flow_json,
    }));
  }, [bomIndex, workOrder?.items]);

  useEffect(() => {
    if (detailRows.length === 0) {
      setSelectedItemKey(null);
      return;
    }

    setSelectedItemKey((current) =>
      current && detailRows.some((row) => row.key === current)
        ? current
        : detailRows[0].key,
    );
  }, [detailRows]);

  const selectedItem = useMemo(
    () => detailRows.find((row) => row.key === selectedItemKey) ?? null,
    [detailRows, selectedItemKey],
  );

  const shouldFetchSelectedItemQR = Boolean(apiEnabled && selectedItem?.id);

  const {
    data: selectedItemQRResponse,
    isFetching: isItemQRFetching,
    isError: isItemQRError,
    refetch: refetchItemQR,
  } = useGetWorkOrderItemQRQuery(selectedItem?.id ?? "", {
    skip: !shouldFetchSelectedItemQR,
  });

  const selectedItemQRSrc =
    selectedItemQRResponse?.data_url || selectedItem?.qrDataUrl || "";
  const hasBrokenSelectedQR = Boolean(selectedItemQRSrc) && brokenQRSrc === selectedItemQRSrc;
  const totalUniq = workOrder?.uniq_total ?? detailRows.length;
  const closedUniq =
    workOrder?.uniq_closed ??
    detailRows.filter((item) => item.status.toLowerCase().includes("close")).length;

  const completedCount = useMemo(
    () =>
      detailRows.filter((item) => {
        const s = String(item.status ?? "").toLowerCase();
        return s.includes("complete") || s.includes("close") || s.includes("finished");
      }).length,
    [detailRows]
  );

  const percentComplete = totalUniq ? Math.round((completedCount / Number(totalUniq)) * 100) : 0;
  const displayWoNumber = formatWorkOrderDisplayNumber(workOrder?.wo_number) || "-";
  const displayAging =
    frontAging != null
      ? `${frontAging} days`
      : workOrder?.aging_days != null
        ? `${workOrder.aging_days} days`
        : "-";

  useEffect(() => {
    setBrokenQRSrc("");
  }, [selectedItem?.key, selectedItemQRSrc]);

  /**
   * Builds Kanban Transport cards for the given work order items.
   *
   * A child part prints as CP (orange header). If ANY routing step of the item
   * is flagged is_assembly in System Settings > Process, that item prints in
   * the Sub-assy layout (cyan header) instead. The flag is read from the
   * process_flow_json snapshot on the work order item, so renaming a process
   * never breaks the rule.
   */
  const buildKanbanCards = useCallback(
    (rows: DetailRow[]): KanbanCardData[] => {
      const printedAt = kanbanPrintStamp();
      const woNumber = String(
        formatWorkOrderDisplayNumber(workOrder?.wo_number) ||
          workOrder?.wo_number ||
          "-",
      )
        .replace(/\(mock\)/gi, "")
        .trim();

      const cards: KanbanCardData[] = [];

      for (const row of rows) {
        const { category, label } = resolveWorkOrderKanbanCategory(
          row.processFlowJson,
        );

        // row.quantity is already formatted as "120 pcs".
        const totalPlan = Number.parseFloat(row.quantity) || 0;
        const uom =
          row.quantity.replace(/^[\d.,\s]+/, "").trim().toUpperCase() || "PCS";

        // SNP from BOM is the closest available "qty per kanban" source.
        const snp = Number(bomIndex.packingNumberByUniq[row.uniq] ?? 0);
        const perKanban = snp > 0 ? snp : totalPlan;
        const cardTotal = kanbanCardCount(totalPlan, perKanban);
        const qr = row.qrDataUrl ?? "";
        const kanbanNumber = row.kanbanNumber === "-" ? "" : row.kanbanNumber;

        for (let index = 1; index <= cardTotal; index += 1) {
          cards.push({
            key: `${row.key}::${index}`,
            category,
            categoryLabel: label,
            partNumber: row.uniq || "-",
            partName: row.partName,
            qtyPerKanban: kanbanQty(perKanban, uom),
            totalPlan: kanbanQty(totalPlan, uom),
            cardNo: index,
            cardTotal,
            kanbanId:
              cardTotal === 1 && kanbanNumber
                ? kanbanNumber
                : buildKanbanId(category, row.uniq, index, cardTotal),
            // Internal production: no supplier, and no plant / store / dock
            // source exists on the work order payload.
            supplier: "-",
            plant: "-",
            batchLot: "-",
            basis: `WO ${woNumber}`,
            areaStore: "-",
            partLocation: "-",
            nextProcess: kanbanNextProcessLabel(
              row.processFlowJson,
              row.processName,
            ),
            dock: "-",
            lineStore: "-",
            partQr: qr,
            kanbanQr: qr,
            printedAt,
          });
        }
      }

      return cards;
    },
    [bomIndex, workOrder?.wo_number],
  );

  /** Prints through a hidden iframe so the page is never navigated away. */
  const printKanbanCards = useCallback(
    (rows: DetailRow[]) => {
      const cards = buildKanbanCards(rows);
      if (cards.length === 0) {
        message.warning("No kanban card to print");
        return;
      }

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.srcdoc = buildKanbanCardsHtml(cards, "Kanban Transport");

      iframe.onload = () => {
        const frameWindow = iframe.contentWindow;
        if (!frameWindow) return;
        frameWindow.focus();
        frameWindow.print();
        window.setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {
            // already detached
          }
        }, 1000);
      };

      document.body.appendChild(iframe);
    },
    [buildKanbanCards],
  );

  const printDetail = useCallback(() => {
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) {
      message.error("Unable to open print window");
      return;
    }

    const printedWoNumber = String(formatWorkOrderDisplayNumber(workOrder?.wo_number) || workOrder?.wo_number || "Work Order")
      .replace(/\(mock\)/gi, "")
      .trim();

    const rowsHtml = detailRows
      .map(
        (row) => `
          <tr>
            <td>${escapePrint(row.uniq)}</td>
            <td>${escapePrint(row.kanbanNumber)}</td>
            <td>${escapePrint(row.quantity)}</td>
            <td>${escapePrint(row.processName)}</td>
            <td>${escapePrint(row.status)}</td>
          </tr>`
      )
      .join("");

    win.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapePrint(printedWoNumber)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .header { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; }
            .title { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
            .meta { font-size: 13px; margin-bottom: 4px; color: #374151; }
            .summary { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 24px; margin-top: 20px; }
            .summary div { font-size: 13px; }
            .label { color:#6b7280; }
            table { width:100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border:1px solid #e5e7eb; padding: 8px; text-align:left; font-size: 12px; }
            th { background:#f3f4f6; }
            img.qr { max-width: 140px; border: 1px solid #e5e7eb; padding: 6px; }
            @media print { .no-print { display:none; } body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">${escapePrint(printedWoNumber)}</div>
              <div class="meta">Type: ${escapePrint(String(workOrder?.wo_type || "-"))}</div>
              <div class="meta">Status: ${escapePrint(String(workOrder?.status || "-"))}</div>
              <div class="meta">Approval: ${escapePrint(String(workOrder?.approval_status || "Pending Approval"))}</div>
            </div>
            ${workOrder?.qr_data_url ? `<img src="${escapePrint(workOrder.qr_data_url)}" class="qr" alt="WO QR" />` : ""}
          </div>
          <div class="summary">
            <div><span class="label">Created Date:</span> ${escapePrint(formatDate(workOrder?.created_date ?? workOrder?.created_at))}</div>
            <div><span class="label">Target Date:</span> ${escapePrint(formatDate(workOrder?.target_date))}</div>
            <div><span class="label">Operator:</span> ${escapePrint(String(workOrder?.operator_name || "Not Assigned"))}</div>
            <div><span class="label">Aging:</span> ${escapePrint(displayAging)}</div>
            <div><span class="label">Total UNIQ:</span> ${escapePrint(String(totalUniq))}</div>
            <div><span class="label">Closed UNIQ:</span> ${escapePrint(String(closedUniq))}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>UNIQ</th>
                <th>Kanban</th>
                <th>Quantity</th>
                <th>Process</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="no-print" style="margin-top:16px;">
            <button onclick="window.print()">Print / Save as PDF</button>
          </div>
        </body>
      </html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }, [closedUniq, detailRows, displayAging, totalUniq, workOrder]);

  const printSelectedItem = () => {
    if (!selectedItem || !selectedItemQRSrc || hasBrokenSelectedQR) {
      message.warning("Item QR is not available to print");
      return;
    }

    const win = window.open("", "_blank", "width=520,height=720");
    if (!win) {
      message.error("Unable to open print window");
      return;
    }

    const woNumber = String(
      formatWorkOrderDisplayNumber(workOrder?.wo_number) ||
        workOrder?.wo_number ||
        "Work Order",
    )
      .replace(/\(mock\)/gi, "")
      .trim();

    win.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapePrint(selectedItem.uniq)} · ${escapePrint(woNumber)}</title>
          <style>
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 24px; color: #18202a; font-family: Arial, sans-serif; }
            main { width: 100%; max-width: 420px; margin: 0 auto; border: 1px solid #dfe3e8; padding: 24px; }
            .eyebrow { color: #6c7684; font-size: 11px; margin-bottom: 6px; }
            h1 { margin: 0; font-size: 20px; overflow-wrap: anywhere; }
            .qr { display: block; width: 240px; height: 240px; object-fit: contain; margin: 24px auto; }
            dl { display: grid; grid-template-columns: 110px 1fr; gap: 10px 16px; margin: 0; font-size: 13px; }
            dt { color: #6c7684; }
            dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
            button { width: 100%; min-height: 44px; margin-top: 24px; }
            @media print { button { display: none; } body { padding: 0; } main { border: 0; } }
          </style>
        </head>
        <body>
          <main>
            <div class="eyebrow">${escapePrint(woNumber)}</div>
            <h1>${escapePrint(selectedItem.uniq)}</h1>
            <img class="qr" src="${escapePrint(selectedItemQRSrc)}" alt="Item QR" />
            <dl>
              <dt>Kanban</dt><dd>${escapePrint(selectedItem.kanbanNumber)}</dd>
              <dt>Part</dt><dd>${escapePrint(selectedItem.partName)}</dd>
              <dt>Quantity</dt><dd>${escapePrint(selectedItem.quantity)}</dd>
              <dt>Process</dt><dd>${escapePrint(selectedItem.processName)}</dd>
              <dt>Status</dt><dd>${escapePrint(selectedItem.status)}</dd>
            </dl>
            <button onclick="window.print()">Print item QR</button>
          </main>
        </body>
      </html>`);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 300);
  };

  useEffect(() => {
    if (searchParams.get("autoPrint") !== "1") return;
    if (!workOrder || autoPrintedRef.current) return;
    autoPrintedRef.current = true;
    const timer = window.setTimeout(() => printDetail(), 300);
    return () => window.clearTimeout(timer);
  }, [searchParams, workOrder, printDetail]);

  const renderItemQR = () => {
    if (!selectedItem) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Select an item to view its details"
          className="py-6"
        />
      );
    }

    if (isItemQRFetching && !selectedItemQRResponse?.data_url) {
      return (
        <div className="flex aspect-square w-44 items-center justify-center rounded-lg border border-slate-200 bg-slate-50" aria-live="polite">
          <Spin tip="Loading item QR">
            <div />
          </Spin>
        </div>
      );
    }

    if (selectedItemQRSrc && !hasBrokenSelectedQR) {
      return (
        <img
          src={selectedItemQRSrc}
          alt={`QR for ${selectedItem.uniq}`}
          onError={() => setBrokenQRSrc(selectedItemQRSrc)}
          className="aspect-square w-44 rounded-lg border border-slate-200 bg-white object-contain p-2"
        />
      );
    }

    return (
      <div className="flex aspect-square w-44 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500" role="status">
        <QrcodeOutlined className="text-2xl" aria-hidden />
        <span>{isItemQRError ? "Unable to load item QR" : "Item QR is unavailable"}</span>
        {isItemQRError ? (
          <Button icon={<ReloadOutlined />} onClick={() => refetchItemQR()} className="!rounded-md">
            Retry
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div className=" min-h-full overflow-x-clip bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full ">
        <header className="mb-5 flex min-w-0 flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.push("/work-orders")}
              className="mb-3 inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-sm font-medium text-slate-600 transition-colors duration-150 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <ArrowLeftOutlined aria-hidden />
              Work orders
            </button>
            <h1 className="min-w-0 break-words text-2xl font-semibold tracking-[-0.02em] text-slate-950 sm:text-3xl">
              Work order detail
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review the work order and inspect QR details for each UNIQ item.
            </p>
          </div>
          <div className="flex w-full gap-2 lg:w-auto">
            <Button className="min-h-11 flex-1 !rounded-md lg:flex-none" onClick={() => router.push("/work-orders")}>
              Close
            </Button>
            <Button
              icon={<PrinterOutlined />}
              className="min-h-11 flex-1 !rounded-md lg:flex-none"
              onClick={() => printKanbanCards(detailRows)}
              disabled={detailRows.length === 0}
            >
              Print Kanban ({detailRows.length})
            </Button>
            <Button type="primary" icon={<PrinterOutlined />} className="min-h-11 flex-1 !rounded-md lg:flex-none" onClick={printDetail}>
              Print work order
            </Button>
          </div>
        </header>

        <Spin spinning={isFetching}>
          <section aria-labelledby="work-order-overview" className="mb-5 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0 p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 id="work-order-overview" className="text-sm font-semibold text-slate-950">
                      Work order overview
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">Current order status and production context.</p>
                  </div>
                  <Tag color={normalizeStatusColor(workOrder?.approval_status)} className="!m-0 !w-fit !rounded-md">
                    {workOrder?.approval_status || "Pending Approval"}
                  </Tag>
                </div>

                <div className="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-4">
                  <DetailField label="WO Number" value={displayWoNumber} mono />
                  <DetailField label="WO Type" value={workOrder?.wo_type || "-"} />
                  <DetailField label="Operator" value={workOrder?.operator_name || "Not Assigned"} />
                  <DetailField label="Aging" value={displayAging} mono />
                  <DetailField label="Created Date" value={formatDate(workOrder?.created_date ?? workOrder?.created_at)} />
                  <DetailField label="Target Date" value={formatDate(workOrder?.target_date)} />
                  <DetailField label="Total UNIQ" value={totalUniq} mono />
                  <DetailField label="Closed UNIQ" value={closedUniq} mono />
                </div>

                {workOrder?.defect_reason ? (
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div className="text-[11px] font-medium text-amber-700">
                      Reason / Info Defect (NG)
                    </div>
                    <div className="mt-1 break-words text-sm font-semibold text-amber-900">
                      {workOrder.defect_reason}
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="border-t border-slate-200 p-4 sm:p-5 xl:border-l xl:border-t-0">
                <div className="flex items-start gap-4 xl:flex-col">
                  <div className="min-w-0 flex-1 xl:w-full">
                    <div className="text-[11px] font-medium text-slate-500">Completion</div>
                    <div className="mt-1 font-mono text-3xl font-semibold tracking-[-0.04em] text-slate-950 tabular-nums">
                      {percentComplete}%
                    </div>
                    <Progress percent={percentComplete} status={percentComplete >= 100 ? "success" : "active"} showInfo={false} />
                  </div>
                  <div className="shrink-0">
                    {workOrder?.qr_data_url ? (
                      <img
                        src={workOrder.qr_data_url}
                        alt="Work order QR"
                        className="h-24 w-24 rounded-lg border border-slate-200 bg-white object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
                        No WO QR
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <section className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
            <div className="min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 px-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">Work order items</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Select an item to view its QR and metadata.</p>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums">{detailRows.length} items</span>
              </div>

              {detailRows.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="This work order has no items" className="py-12" />
              ) : (
                <div className="min-w-0">
                  <div className="hidden grid-cols-[minmax(160px,1.2fr)_minmax(130px,1fr)_100px_minmax(110px,0.8fr)_88px] gap-3 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500 md:grid">
                    <span>UNIQ</span>
                    <span>Kanban</span>
                    <span>Quantity</span>
                    <span>Status</span>
                    <span className="text-right">Action</span>
                  </div>
                  {detailRows.map((row) => {
                    const selected = selectedItemKey === row.key;
                    return (
                      <button
                        key={row.key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedItemKey(row.key)}
                        className={`grid min-h-14 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-slate-100 px-4 py-3 text-left transition-colors duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 md:grid-cols-[minmax(160px,1.2fr)_minmax(130px,1fr)_100px_minmax(110px,0.8fr)_88px] ${
                          selected
                            ? "bg-blue-50 shadow-[inset_3px_0_0_#2563eb]"
                            : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block break-words font-mono text-sm font-semibold text-slate-950">{row.uniq}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{row.partName}</span>
                        </span>
                        <span className="hidden min-w-0 break-words font-mono text-xs text-slate-700 md:block">{row.kanbanNumber}</span>
                        <span className="hidden font-mono text-xs text-slate-700 tabular-nums md:block">{row.quantity}</span>
                        <span className="justify-self-end md:justify-self-start">
                          <Tag color={normalizeStatusColor(row.status)} className="!m-0 !rounded-md">
                            {row.status}
                          </Tag>
                        </span>
                        <span className="hidden justify-self-end text-sm font-semibold text-blue-700 md:block">
                          {selected ? "Selected" : "View"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:sticky xl:top-5">
              <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 px-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">Detail item</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedItem ? "QR and production fields for the selected item." : "No item selected."}
                  </p>
                </div>
                {selectedItem ? (
                  <Button
                    icon={<CloseOutlined />}
                    className="!rounded-md"
                    onClick={() => setSelectedItemKey(null)}
                    aria-label="Close item detail"
                  />
                ) : null}
              </div>

              <div className="p-4 sm:p-5">
                {selectedItem ? (
                  <>
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row xl:flex-col 2xl:flex-row">
                      <div className="flex justify-center sm:justify-start">{renderItemQR()}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium text-slate-500">Selected UNIQ</div>
                        <div className="mt-1 break-words font-mono text-lg font-semibold tracking-[-0.02em] text-slate-950">
                          {selectedItem.uniq}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          QR is read from the item response first, then fetched from the item QR endpoint when needed.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
                      <DetailField label="Kanban" value={selectedItem.kanbanNumber} mono />
                      <DetailField
                        label="Status"
                        value={(
                          <Tag color={normalizeStatusColor(selectedItem.status)} className="!m-0 !rounded-md">
                            {selectedItem.status}
                          </Tag>
                        )}
                      />
                      <DetailField label="Part name" value={selectedItem.partName} />
                      <DetailField label="Part number" value={selectedItem.partNumber} mono />
                      <DetailField label="Model" value={selectedItem.model} mono />
                      <DetailField label="Quantity" value={selectedItem.quantity} mono />
                      <DetailField label="Process" value={selectedItem.processName} />
                    </div>

                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="primary"
                        icon={<PrinterOutlined />}
                        className="min-h-11 flex-1 !rounded-md"
                        onClick={printSelectedItem}
                        disabled={!selectedItemQRSrc || hasBrokenSelectedQR}
                      >
                        Print item QR
                      </Button>
                      <Button
                        icon={<PrinterOutlined />}
                        className="min-h-11 flex-1 !rounded-md"
                        onClick={() =>
                          printKanbanCards([
                            {
                              ...selectedItem,
                              qrDataUrl: selectedItemQRSrc || selectedItem.qrDataUrl,
                            },
                          ])
                        }
                      >
                        Print Kanban
                      </Button>
                      <Button className="min-h-11 flex-1 !rounded-md" onClick={() => setSelectedItemKey(null)}>
                        Close detail
                      </Button>
                    </div>
                  </>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select an item to view its details" className="py-10" />
                )}
              </div>
            </aside>
          </section>
        </Spin>
      </div>
    </div>
  );
}
