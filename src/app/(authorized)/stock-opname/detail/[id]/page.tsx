"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Modal, Table, Tabs, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type StockInventoryType,
  useApproveStockOpnameSessionMutation,
  useGetStockOpnameHistoryLogsQuery,
  useGetStockOpnameSessionByIdQuery,
} from "@/lib/api/stock-opname/api";

type DetailData = {
  sessionId: string;
  sessionNumber: string;
  inventoryLabel: string;
  period: string;
  location: string;
  scheduleDate?: string;
  countedDate?: string;
  statusLabel: string;
  impactLabel: string;
  systemQty: number;
  physicalQty: number;
  costImpact: number;
  submittedBy?: string | null;
  approvedBy?: string | null;
  approvalRemarks?: string | null;
};

const TAB_TO_INVENTORY_TYPE: Record<string, StockInventoryType> = {
  finished: "FG",
  raw: "RM",
  indirect: "IDR",
  wip: "WIP",
};

function inventoryLabelFromTab(tab: string) {
  if (tab === "raw") return "Raw Material";
  if (tab === "indirect") return "Indirect";
  if (tab === "wip") return "WIP";
  return "Finished Goods";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${formatNumber(abs)}`;
}

function variance(systemQty: number, physicalQty: number) {
  const diff = physicalQty - systemQty;
  const pct = systemQty === 0 ? 0 : (diff / systemQty) * 100;
  return { diff, pct };
}

function statusTagColor(label?: string): string {
  const lower = (label ?? "").toLowerCase();
  if (lower.includes("approved") || lower.includes("complete")) return "green";
  if (lower.includes("reject")) return "red";
  if (lower.includes("waiting") || lower.includes("pending")) return "gold";
  return "blue";
}

function normalizeStatus(value?: string): { statusLabel: string; impactLabel: string } {
  const lower = (value ?? "").toLowerCase();
  if (lower.includes("approved") || lower.includes("complete")) return { statusLabel: "Completed", impactLabel: "Approved" };
  if (lower.includes("reject")) return { statusLabel: "Rejected", impactLabel: "Rejected" };
  if (lower.includes("waiting")) return { statusLabel: "Waiting Approval", impactLabel: "Waiting for Approval" };
  return { statusLabel: "In Progress", impactLabel: "Pending" };
}

export default function StockOpnameDetailPage() {
  return (
    <Suspense fallback={null}>
      <StockOpnameDetailPageContent />
    </Suspense>
  );
}

function StockOpnameDetailPageContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const apiEnabled = Boolean(apiBaseUrl);

  const id = useMemo(() => decodeURIComponent(params?.id ?? ""), [params?.id]);
  const tab = (searchParams.get("tab") ?? "finished").toLowerCase();
  const inventoryType = TAB_TO_INVENTORY_TYPE[tab] ?? "FG";
  const inventoryLabel = inventoryLabelFromTab(tab);

  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");
  const [approvalRemarks, setApprovalRemarks] = useState<string>("");

  const [uniqCode, setUniqCode] = useState<string>(() => searchParams.get("uniq_code") ?? "");
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit, setLogsLimit] = useState(20);

  const { data: session, isFetching, refetch } = useGetStockOpnameSessionByIdQuery(
    { id },
    { skip: !apiEnabled || !id }
  );
  const [approveSession, { isLoading: approving }] = useApproveStockOpnameSessionMutation();

  const { data: history, isFetching: logsLoading } = useGetStockOpnameHistoryLogsQuery(
    { type: inventoryType, uniq_code: uniqCode, page: logsPage, limit: logsLimit },
    { skip: !apiEnabled || !uniqCode }
  );

  const fallbackData = useMemo<DetailData>(() => {
    const norm = normalizeStatus("approved");
    return {
      sessionId: id || "mock-session",
      sessionNumber: id || "SO-FG-012024",
      inventoryLabel,
      period: "Sep 2025",
      location: "-",
      scheduleDate: "2025-09-24",
      countedDate: "2025-09-24",
      statusLabel: norm.statusLabel,
      impactLabel: norm.impactLabel,
      systemQty: 17890,
      physicalQty: 17888,
      costImpact: 250,
      submittedBy: "Admin PPIC",
      approvedBy: "Admin PPIC",
      approvalRemarks: "OK",
    };
  }, [id, inventoryLabel]);

  const data = useMemo<DetailData>(() => {
    if (!apiEnabled || !session) return fallbackData;
    const norm = normalizeStatus(session.status_label ?? session.status);
    return {
      sessionId: session.uuid || String(session.id),
      sessionNumber: session.session_number ?? id,
      inventoryLabel,
      period: session.period_label ?? "-",
      location: session.warehouse_location ?? "-",
      scheduleDate: session.schedule_date ?? undefined,
      countedDate: session.counted_date ?? undefined,
      statusLabel: session.status_label ?? norm.statusLabel,
      impactLabel: session.impact_label ?? norm.impactLabel,
      systemQty: session.system_qty_total ?? 0,
      physicalQty: session.physical_qty_total ?? 0,
      costImpact: session.cost_impact ?? 0,
      submittedBy: session.submitted_by ?? session.created_by ?? null,
      approvedBy: session.approved_by ?? null,
      approvalRemarks: session.approval_remarks ?? null,
    };
  }, [apiEnabled, fallbackData, id, inventoryLabel, session]);

  const v = useMemo(() => variance(data.systemQty, data.physicalQty), [data.physicalQty, data.systemQty]);
  const vColor = v.diff < 0 ? "text-red-600" : v.diff > 0 ? "text-green-600" : "text-slate-500";
  const vDiffText = v.diff === 0 ? "0" : `${v.diff > 0 ? "+" : ""}${v.diff}`;
  const vPctText = v.diff === 0 ? "0%" : `${v.pct > 0 ? "+" : ""}${v.pct.toFixed(1)}%`;

  const titleLabel = useMemo(() => `Stock Opname ${data.inventoryLabel} Details`, [data.inventoryLabel]);

  const canApprove = useMemo(() => {
    const lower = (session?.status ?? session?.status_label ?? "").toLowerCase();
    if (!apiEnabled) return false;
    if (!id) return false;
    if (!session) return false;
    if (lower.includes("approved") || lower.includes("complete") || lower.includes("reject")) return false;
    return true;
  }, [apiEnabled, id, session?.status, session?.status_label]);

  async function submitApproval(action: "approve" | "reject") {
    try {
      await approveSession({ id, body: { action, remarks: approvalRemarks } }).unwrap();
      message.success(action === "approve" ? "Approved" : "Rejected");
      setApprovalOpen(false);
      setApprovalRemarks("");
      void refetch();
    } catch {
      message.error("Failed to submit approval");
    }
  }

  const historyColumns = useMemo<ColumnsType<{ key: string; uniq_code: string; packing: string; qty_change: number; reason: string; qty: number; last_update: string }>>(
    () => [
      { title: "Uniq", dataIndex: "uniq_code", key: "uniq_code", width: 140 },
      { title: "Packing", dataIndex: "packing", key: "packing", width: 120 },
      {
        title: "Qty Change",
        dataIndex: "qty_change",
        key: "qty_change",
        width: 120,
        render: (v2: number) => <span className={v2 < 0 ? "text-red-600" : v2 > 0 ? "text-green-600" : "text-slate-600"}>{v2}</span>,
      },
      { title: "Reason", dataIndex: "reason", key: "reason" },
      { title: "Qty", dataIndex: "qty", key: "qty", width: 100 },
      { title: "Last Update", dataIndex: "last_update", key: "last_update", width: 180 },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          onClick={() => router.push(`/stock-opname?tab=${tab}`)}
        >
          <ArrowLeftOutlined />
          Back
        </button>

        <div className="flex items-center gap-2">
          {canApprove && (
            <>
              <Button
                className="!rounded-lg"
                onClick={() => {
                  setApprovalAction("reject");
                  setApprovalOpen(true);
                }}
                danger
              >
                Reject
              </Button>
              <Button
                type="primary"
                className="!rounded-lg"
                onClick={() => {
                  setApprovalAction("approve");
                  setApprovalOpen(true);
                }}
              >
                Approve
              </Button>
            </>
          )}
          <Button className="!rounded-lg" onClick={() => void refetch()} loading={isFetching}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold text-gray-900">{titleLabel}</div>
            <div className="text-sm text-gray-500 mt-1">
              {data.sessionNumber}
              <span className="mx-2">•</span>
              <span className="text-gray-400">Period: {data.period}</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Location: {data.location}
              {data.scheduleDate ? <span className="mx-2">•</span> : null}
              {data.scheduleDate ? `Schedule: ${data.scheduleDate}` : null}
              {data.countedDate ? <span className="mx-2">•</span> : null}
              {data.countedDate ? `Counted: ${data.countedDate}` : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-xs font-semibold text-gray-500">Status</div>
            <div className="flex items-center gap-2">
              <Tag color={statusTagColor(data.statusLabel)} className="!rounded-full !px-3 !py-0.5 !font-semibold">
                {data.statusLabel}
              </Tag>
              <Tag color={statusTagColor(data.impactLabel)} className="!rounded-full !px-3 !py-0.5">
                {data.impactLabel}
              </Tag>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-5">
        <Card className="!rounded-xl !border-gray-100 !shadow-sm">
          <div className="text-xs text-gray-500">System Qty Total</div>
          <div className="text-xl font-bold mt-1">{formatNumber(data.systemQty)}</div>
        </Card>
        <Card className="!rounded-xl !border-gray-100 !shadow-sm">
          <div className="text-xs text-gray-500">Physical Qty Total</div>
          <div className="text-xl font-bold mt-1">{formatNumber(data.physicalQty)}</div>
        </Card>
        <Card className="!rounded-xl !border-gray-100 !shadow-sm">
          <div className="text-xs text-gray-500">Variance</div>
          <div className={"text-xl font-bold mt-1 " + vColor}>
            {vDiffText} <span className="text-sm font-semibold">({vPctText})</span>
          </div>
        </Card>
        <Card className="!rounded-xl !border-gray-100 !shadow-sm">
          <div className="text-xs text-gray-500">Cost Impact</div>
          <div className="text-xl font-bold mt-1">{formatMoney(data.costImpact)}</div>
        </Card>
      </div>

      <Card className="!rounded-xl !border-gray-100 !shadow-sm" bodyStyle={{ padding: 0 }}>
        <Tabs
          defaultActiveKey="detail"
          items={[
            {
              key: "detail",
              label: (
                <span className="inline-flex items-center gap-2">
                  <FileTextOutlined /> Details
                </span>
              ),
              children: (
                <div className="p-4">
                  <div className="text-sm text-gray-500">
                    Submitted By: {data.submittedBy ?? "-"}
                    <span className="mx-2">•</span>
                    Approved By: {data.approvedBy ?? "-"}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Approval Remarks: {data.approvalRemarks ?? "-"}</div>
                  <div className="mt-3 text-xs text-gray-400">
                    Note: item-level lines are not fetched here (backend detail endpoint not specified for session items).
                  </div>
                </div>
              ),
            },
            {
              key: "history",
              label: (
                <span className="inline-flex items-center gap-2">
                  <HistoryOutlined /> Audit Logs
                </span>
              ),
              children: (
                <div className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-2 mb-3">
                    <Input
                      placeholder="Uniq Code (e.g. LV7-001)"
                      value={uniqCode}
                      onChange={(e) => {
                        setUniqCode(e.target.value);
                        setLogsPage(1);
                      }}
                      className="max-w-md"
                    />
                    <div className="text-xs text-gray-400">Type: {inventoryType}</div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-gray-100">
                    <Table
                      dataSource={(history?.items ?? []).map((r, idx) => ({ key: `${r.uniq_code}-${idx}`, ...r }))}
                      rowKey="key"
                      size="middle"
                      loading={logsLoading}
                      columns={historyColumns}
                      pagination={{
                        current: logsPage,
                        pageSize: logsLimit,
                        total: history?.pagination.total ?? 0,
                        showSizeChanger: true,
                        onChange: (p, s) => {
                          setLogsPage(p);
                          if (typeof s === "number") setLogsLimit(s);
                        },
                      }}
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={approvalAction === "approve" ? "Approve Session" : "Reject Session"}
        open={approvalOpen}
        onCancel={() => setApprovalOpen(false)}
        onOk={() => void submitApproval(approvalAction)}
        okText={approvalAction === "approve" ? "Approve" : "Reject"}
        okButtonProps={{ danger: approvalAction === "reject", loading: approving }}
      >
        <div className="text-sm text-gray-500 mb-2">Remarks (optional)</div>
        <Input.TextArea rows={4} value={approvalRemarks} onChange={(e) => setApprovalRemarks(e.target.value)} />
      </Modal>
    </div>
  );
}
