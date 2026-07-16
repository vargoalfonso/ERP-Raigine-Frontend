"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Card, Empty, Input, Modal, Table, Tabs, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftOutlined,
  AuditOutlined,
  FileTextOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type StockInventoryType,
  type StockOpnameEntryRecord,
  useApproveStockOpnameSessionMutation,
  useGetStockOpnameAuditLogsQuery,
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

function inventoryLabelFromType(type: string) {
  switch ((type ?? "").toUpperCase()) {
    case "RM":
      return "Raw Material";
    case "IDR":
      return "Indirect Raw Material";
    case "WIP":
      return "Work In Process";
    case "FG":
      return "Finished Goods";
    default:
      return "Finished Goods";
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${formatNumber(abs)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function variance(systemQty: number, physicalQty: number) {
  const diff = physicalQty - systemQty;
  const pct = systemQty === 0 ? 0 : (diff / systemQty) * 100;
  return { diff, pct };
}

function statusTagColor(label: string): string {
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
  if (lower.includes("waiting") || lower.includes("pending")) return { statusLabel: "Waiting Approval", impactLabel: "Waiting for Approval" };
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
  const tabInventoryType = TAB_TO_INVENTORY_TYPE[tab] ?? "FG";

  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");
  const [approvalRemarks, setApprovalRemarks] = useState<string>("");

  const [uniqCode, setUniqCode] = useState<string>(() => searchParams.get("uniq_code") ?? "");
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit, setLogsLimit] = useState(20);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit, setAuditLimit] = useState(20);

  const { data: detail, isFetching, refetch } = useGetStockOpnameSessionByIdQuery(
    { id },
    { skip: !apiEnabled || !id }
  );
  const session = detail?.session ?? null;
  const entries = detail?.entries ?? [];
  const [approveSession, { isLoading: approving }] = useApproveStockOpnameSessionMutation();

  // The material type follows the actual session; fall back to the tab param.
  const inventoryType: StockInventoryType = (session?.inventory_type as StockInventoryType) || tabInventoryType;
  const inventoryLabel = inventoryLabelFromType(inventoryType);

  // History logs are scoped to THIS session. We fetch the logs for the
  // inventory type once (large page) and then filter client-side to only the
  // uniq codes that belong to this session's entries. The backend history-logs
  // endpoint only supports a single uniq_code filter, so scoping by a set of
  // uniq codes must be done here.
  const { data: history, isFetching: logsLoading } = useGetStockOpnameHistoryLogsQuery(
    { type: inventoryType, uniq_code: "", page: 1, limit: 1000 },
    { skip: !apiEnabled }
  );

  // Set of uniq codes belonging to this session (defines the history scope).
  const sessionUniqSet = useMemo(
    () => new Set(entries.map((e) => (e.uniq_code ?? "").trim()).filter(Boolean)),
    [entries]
  );

  // Rows limited to this session, then narrowed further by the manual filter.
  const filteredHistory = useMemo(() => {
    const all = history?.items ?? [];
    // If the session has no entries (or is still loading), we should show no history logs,
    // not ALL history logs for the inventory type.
    if (sessionUniqSet.size === 0) return [];
    
    const scoped = all.filter((r) => sessionUniqSet.has((r.uniq_code ?? "").trim()));
    const term = uniqCode.trim().toLowerCase();
    return term ? scoped.filter((r) => (r.uniq_code ?? "").toLowerCase().includes(term)) : scoped;
  }, [history, sessionUniqSet, uniqCode]);

  // Client-side pagination over the scoped/filtered rows.
  const pagedHistory = useMemo(() => {
    const start = (logsPage - 1) * logsLimit;
    return filteredHistory.slice(start, start + logsLimit);
  }, [filteredHistory, logsPage, logsLimit]);

  const { data: audit, isFetching: auditLoading } = useGetStockOpnameAuditLogsQuery(
    { id, page: auditPage, limit: auditLimit },
    { skip: !apiEnabled || !id }
  );

  const fallbackData = useMemo<DetailData>(() => {
    const norm = normalizeStatus("approved");
    return {
      sessionId: id || "mock-session",
      sessionNumber: id || "SO-FG-012024",
      inventoryLabel,
      period: "-",
      location: "-",
      scheduleDate: undefined,
      countedDate: undefined,
      statusLabel: norm.statusLabel,
      impactLabel: norm.impactLabel,
      systemQty: 0,
      physicalQty: 0,
      costImpact: 0,
      submittedBy: "-",
      approvedBy: "-",
      approvalRemarks: "-",
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
  }, [apiEnabled, id, session]);

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

  const entryColumns = useMemo<ColumnsType<StockOpnameEntryRecord & { key: string }>>(
    () => [
      { title: "Uniq", dataIndex: "uniq_code", key: "uniq_code", width: 140 },
      { title: "Part Name", dataIndex: "part_name", key: "part_name" },
      { title: "UOM", dataIndex: "uom", key: "uom", width: 90 },
      {
        title: "System Qty",
        dataIndex: "system_qty_snapshot",
        key: "system_qty_snapshot",
        width: 120,
        render: (val: number) => formatNumber(val),
      },
      {
        title: "Counted Qty",
        dataIndex: "counted_qty",
        key: "counted_qty",
        width: 120,
        render: (val: number) => formatNumber(val),
      },
      {
        title: "Variance",
        dataIndex: "variance_qty",
        key: "variance_qty",
        width: 110,
        render: (val: number) => (
          <span className={val < 0 ? "text-red-600" : val > 0 ? "text-green-600" : "text-slate-600"}>
            {val > 0 ? `+${val}` : val}
          </span>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (val: string) => <Tag color={statusTagColor(val)}>{val}</Tag>,
      },
    ],
    []
  );

  const historyColumns = useMemo<ColumnsType<{ key: string; uniq_code: string; packing: string; qty_change: number; reason: string; qty: number; last_update: string }>>(
    () => [
      { title: "Uniq", dataIndex: "uniq_code", key: "uniq_code", width: 140 },
      { title: "Packing", dataIndex: "packing", key: "packing", width: 160 },
      {
        title: "Qty Change",
        dataIndex: "qty_change",
        key: "qty_change",
        width: 120,
        render: (v2: number) => <span className={v2 < 0 ? "text-red-600" : v2 > 0 ? "text-green-600" : "text-slate-600"}>{v2 > 0 ? `+${v2}` : v2}</span>,
      },
      { title: "Reason", dataIndex: "reason", key: "reason" },
      { title: "Qty", dataIndex: "qty", key: "qty", width: 100, render: (val: number) => formatNumber(val) },
      { title: "Last Update", dataIndex: "last_update", key: "last_update", width: 180, render: (val: string) => formatDateTime(val) },
    ],
    []
  );

  const auditColumns = useMemo<ColumnsType<{ key: string; action: string; entity_type: string; actor: string; remarks: string; created_at: string }>>(
    () => [
      { title: "Action", dataIndex: "action", key: "action", width: 160, render: (val: string) => <Tag color={statusTagColor(val)}>{val}</Tag> },
      { title: "Entity", dataIndex: "entity_type", key: "entity_type", width: 140 },
      { title: "Actor", dataIndex: "actor", key: "actor", width: 180 },
      { title: "Remarks", dataIndex: "remarks", key: "remarks" },
      { title: "Time", dataIndex: "created_at", key: "created_at", width: 180, render: (val: string) => formatDateTime(val) },
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
          <div className="flex items-center gap-2">
            <Tag color={statusTagColor(data.statusLabel)} className="!rounded-full !px-3 !py-0.5">{data.statusLabel}</Tag>
            <Tag color={statusTagColor(data.impactLabel)} className="!rounded-full !px-3 !py-0.5">{data.impactLabel}</Tag>
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
          className="px-4!"
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
                  <div className="text-sm text-gray-500 mb-3">
                    Submitted By: {data.submittedBy ?? "-"}
                    <span className="mx-2">•</span>
                    Approved By: {data.approvedBy ?? "-"} 
                    <span className="mx-2">•</span>
                    Approval Remarks: {data.approvalRemarks ?? "-"}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-gray-100">
                    <Table
                      dataSource={entries.map((e, idx) => ({ key: e.uuid || `${e.uniq_code}-${idx}`, ...e }))}
                      rowKey="key"
                      size="middle"
                      loading={isFetching}
                      columns={entryColumns}
                      locale={{ emptyText: <Empty description="Belum ada item pada sesi ini" /> }}
                      pagination={false}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: "history",
              label: (
                <span className="inline-flex items-center gap-2">
                  <HistoryOutlined /> History Logs
                </span>
              ),
              children: (
                <div className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-2 mb-3">
                    <Input
                      placeholder="Filter Uniq Code pada sesi ini"
                      value={uniqCode}
                      onChange={(e) => {
                        setUniqCode(e.target.value);
                        setLogsPage(1);
                      }}
                      allowClear
                      className="max-w-md"
                    />
                    <Tag color="blue">Type: {inventoryType}</Tag>
                    <Tag color="purple">Sesi ini: {sessionUniqSet.size} uniq</Tag>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-gray-100">
                    <Table
                      dataSource={pagedHistory.map((r, idx) => ({ key: `${r.uniq_code}-${idx}`, ...r }))}
                      rowKey="key"
                      size="middle"
                      loading={logsLoading}
                      columns={historyColumns}
                      locale={{ emptyText: <Empty description="Belum ada history logs untuk sesi ini" /> }}
                      pagination={{
                        current: logsPage,
                        pageSize: logsLimit,
                        total: filteredHistory.length,
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
            {
              key: "audit",
              label: (
                <span className="inline-flex items-center gap-2">
                  <AuditOutlined /> Audit Trail
                </span>
              ),
              children: (
                <div className="p-4">
                  <div className="overflow-hidden rounded-xl border border-gray-100">
                    <Table
                      dataSource={(audit?.items ?? []).map((r, idx) => ({ key: `${r.id}-${idx}`, ...r }))}
                      rowKey="key"
                      size="middle"
                      loading={auditLoading}
                      columns={auditColumns}
                      locale={{ emptyText: <Empty description="Belum ada audit trail" /> }}
                      pagination={{
                        current: auditPage,
                        pageSize: auditLimit,
                        total: audit?.pagination.total ?? 0,
                        showSizeChanger: true,
                        onChange: (p, s) => {
                          setAuditPage(p);
                          if (typeof s === "number") setAuditLimit(s);
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
