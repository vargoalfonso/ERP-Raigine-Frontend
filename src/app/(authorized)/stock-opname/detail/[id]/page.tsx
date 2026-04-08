"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Card, Table, Tabs, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  FileTextOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type StockOpnameDetailResponse,
  useGetStockOpnameDetailQuery,
  useSubmitStockOpnameMutation,
} from "@/lib/api/stock-opname/api";

type DetailLine = {
  key: string;
  itemId: number;
  uniq: string;
  partNumber: string;
  partName: string;
  currentStock: number;
  countedQty: number;
  userCounted: string;
  decision?: "approved" | "rejected";
};

type HistoryLog = {
  key: string;
  at: string;
  by: string;
  action: string;
  note?: string;
};

type DetailData = {
  opnameId: string;
  period: string;
  uniqContext: string;
  statusImpact: "Approved" | "Waiting for Approval" | "Pending Verification";
  systemQty: number;
  physicalQty: number;
  costImpact: number;
  lines: DetailLine[];
  logs: HistoryLog[];
};

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

function inventoryLabelFromId(opnameId: string) {
  const upper = opnameId.toUpperCase();
  if (upper.includes("SO-FG")) return "Finished Good";
  if (upper.includes("SO-RM")) return "Raw Material";
  if (upper.includes("SO-IND")) return "Indirect";
  if (upper.includes("SO-WIP")) return "WIP";
  return "Stock";
}

function normalizeStatusImpact(value?: string): DetailData["statusImpact"] {
  const lower = (value ?? "").toLowerCase();
  if (lower.includes("approved") || lower.includes("complete")) return "Approved";
  if (lower.includes("waiting")) return "Waiting for Approval";
  return "Pending Verification";
}

function mapDetailResponse(id: string, response: StockOpnameDetailResponse): DetailData {
  const session = response.session;
  const summary = session.summary;
  return {
    opnameId: session.opname_number || id,
    period: session.period ?? "-",
    uniqContext: response.items[0]?.uniq ?? session.location ?? "-",
    statusImpact: normalizeStatusImpact(session.status_label ?? session.status),
    systemQty: summary?.system_total ?? 0,
    physicalQty: summary?.physical_total ?? 0,
    costImpact: summary?.cost_impact ?? 0,
    lines: response.items.map((item) => ({
      key: String(item.id),
      itemId: item.id,
      uniq: item.uniq,
      partNumber: item.part_number ?? "-",
      partName: item.item_name ?? "-",
      currentStock: item.system_quantity ?? 0,
      countedQty: item.counted_quantity ?? 0,
      userCounted: item.user_counter ?? "-",
      decision:
        item.verification_status === "verified"
          ? "approved"
          : item.verification_status === "rejected"
          ? "rejected"
          : undefined,
    })),
    logs: response.logs.map((log) => ({
      key: String(log.id),
      at: log.createdAt ?? "-",
      by: log.performed_by ?? "-",
      action: log.action ?? "-",
      note: log.description,
    })),
  };
}

export default function StockOpnameDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
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

  const { data: detailResponse, isFetching, refetch } = useGetStockOpnameDetailQuery(
    {
      opname_number: id,
      item_status: "all",
      page: 1,
      limit: 100,
    },
    {
      skip: !apiEnabled || !id,
    }
  );
  const [submitStockOpname, { isLoading: submitting }] = useSubmitStockOpnameMutation();

  const fallbackData = useMemo<DetailData>(() => {
    // Mock based on screenshot (Finished Good)
    const base: DetailData = {
      opnameId: id || "SO-FG-012024",
      period: "01/2024",
      uniqContext: "LV7-001",
      statusImpact: "Approved",
      systemQty: 17890,
      physicalQty: 17888,
      costImpact: 250,
      lines: [
        {
          key: "l1",
          itemId: 1,
          uniq: "FG-001",
          partNumber: "SP-001-A",
          partName: "Steel Plate",
          currentStock: 245,
          countedQty: 240,
          userCounted: "WO-2024-001",
        },
        {
          key: "l2",
          itemId: 2,
          uniq: "FG-001",
          partNumber: "SP-001-A",
          partName: "Steel Plate",
          currentStock: 245,
          countedQty: 200,
          userCounted: "WO-2024-001",
        },
        {
          key: "l3",
          itemId: 3,
          uniq: "FG-001",
          partNumber: "SP-001-A",
          partName: "Steel Plate",
          currentStock: 230,
          countedQty: 230,
          userCounted: "WO-2024-001",
        },
      ],
      logs: [
        {
          key: "h1",
          at: "2025-09-24 09:12",
          by: "Admin PPIC",
          action: "Created Stock Opname",
          note: "Session initialized",
        },
        {
          key: "h2",
          at: "2025-09-24 10:05",
          by: "John Meijer",
          action: "Counted items",
          note: "3 lines updated",
        },
        {
          key: "h3",
          at: "2025-09-24 10:40",
          by: "Admin PPIC",
          action: "Approved",
          note: "Variance accepted",
        },
      ],
    };

    // Quick variants by id prefix
    const upper = (id || "").toUpperCase();
    if (upper.includes("SO-RM")) {
      if (upper.includes("SO-RM-012024")) {
        return {
          ...base,
          opnameId: id,
          uniqContext: "RMV-010",
          systemQty: 17890,
          physicalQty: 17888,
          costImpact: 250,
          statusImpact: "Approved",
        };
      }
      if (upper.includes("SO-RM-122023")) {
        return {
          ...base,
          opnameId: id,
          uniqContext: "RMV-010",
          systemQty: 19200,
          physicalQty: 19195,
          costImpact: 425,
          statusImpact: "Waiting for Approval",
        };
      }
      if (upper.includes("SO-RM-112023")) {
        return {
          ...base,
          opnameId: id,
          uniqContext: "RMV-010",
          systemQty: 120,
          physicalQty: 122,
          costImpact: 180,
          statusImpact: "Approved",
        };
      }
      return {
        ...base,
        opnameId: id,
        uniqContext: "RMV-010",
        systemQty: 17890,
        physicalQty: 17888,
        costImpact: 250,
        statusImpact: "Approved",
      };
    }
    if (upper.includes("SO-IND")) {
      return {
        ...base,
        opnameId: id,
        uniqContext: "IND-001",
        systemQty: 420,
        physicalQty: 419,
        costImpact: 75,
        statusImpact: "Waiting for Approval",
      };
    }
    if (upper.includes("SO-WIP")) {
      return {
        ...base,
        opnameId: id,
        uniqContext: "WIP-007",
        systemQty: 320,
        physicalQty: 320,
        costImpact: 0,
        statusImpact: "Approved",
      };
    }

    return base;
  }, [id]);

  const data = useMemo(
    () => (apiEnabled && detailResponse ? mapDetailResponse(id, detailResponse) : fallbackData),
    [apiEnabled, detailResponse, fallbackData, id]
  );

  const [lines, setLines] = useState<DetailLine[]>(data.lines);

  useEffect(() => {
    setLines(data.lines);
  }, [data.lines]);

  const v = useMemo(() => variance(data.systemQty, data.physicalQty), [data.physicalQty, data.systemQty]);
  const vColor = v.diff < 0 ? "text-red-600" : v.diff > 0 ? "text-green-600" : "text-slate-500";
  const vDiffText = v.diff === 0 ? "0" : `${v.diff > 0 ? "+" : ""}${v.diff}`;
  const vPctText = v.diff === 0 ? "0%" : `${v.pct > 0 ? "+" : ""}${v.pct.toFixed(1)}%`;

  const titleLabel = useMemo(() => {
    const inv = inventoryLabelFromId(data.opnameId);
    return `Stock Opname ${inv} Details`;
  }, [data.opnameId]);

  const detailCopyLabel = useMemo(() => inventoryLabelFromId(data.opnameId), [data.opnameId]);

  const handleDecision = async (line: DetailLine, decision: "approved" | "rejected") => {
    if (!apiEnabled || !detailResponse?.session.id) {
      setLines((prev) => prev.map((x) => (x.key === line.key ? { ...x, decision } : x)));
      message.success(decision === "approved" ? "Approved" : "Rejected");
      return;
    }

    try {
      await submitStockOpname({
        opname_id: detailResponse.session.id,
        action: decision === "approved" ? "approved" : "rejected",
        verified_by: line.userCounted || null,
        items: [
          {
            item_id: line.itemId,
            verification_status: decision === "approved" ? "verified" : "rejected",
            ...(decision === "rejected" ? { reject_reason: "Rejected from stock opname detail" } : {}),
          },
        ],
      }).unwrap();

      setLines((prev) => prev.map((x) => (x.key === line.key ? { ...x, decision } : x)));
      message.success(decision === "approved" ? "Approved" : "Rejected");
      await refetch();
    } catch {
      message.error(`Failed to ${decision === "approved" ? "approve" : "reject"} item`);
    }
  };

  const columns = useMemo<ColumnsType<DetailLine>>(
    () => [
      { title: "Uniq", dataIndex: "uniq", key: "uniq", width: 120 },
      { title: "Part Number", dataIndex: "partNumber", key: "partNumber", width: 160 },
      { title: "Part Name", dataIndex: "partName", key: "partName" },
      {
        title: "Current Stock",
        dataIndex: "currentStock",
        key: "currentStock",
        align: "right",
        width: 130,
        render: (v2: number) => <span className="text-sm text-slate-700">{formatNumber(v2)}</span>,
      },
      {
        title: "Counted Qty",
        dataIndex: "countedQty",
        key: "countedQty",
        align: "right",
        width: 130,
        render: (v2: number) => <span className="text-sm text-slate-700">{formatNumber(v2)}</span>,
      },
      { title: "User Counted", dataIndex: "userCounted", key: "userCounted", width: 160 },
      {
        title: "Approval",
        key: "approval",
        align: "center",
        width: 220,
        render: (_, r) => {
          const decided = r.decision;
          return (
            <div className="flex items-center justify-center gap-2">
              <Button
                danger
                className="!rounded-lg"
                icon={<CloseOutlined />}
                disabled={decided === "approved"}
                loading={submitting}
                onClick={() => void handleDecision(r, "rejected")}
              >
                Reject
              </Button>
              <Button
                className="!rounded-lg !border-green-200 !text-green-700"
                icon={<CheckOutlined />}
                disabled={decided === "rejected"}
                loading={submitting}
                onClick={() => void handleDecision(r, "approved")}
              >
                Approve
              </Button>
            </div>
          );
        },
      },
    ],
    [submitting]
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          onClick={() => router.push("/stock-opname")}
        >
          <ArrowLeftOutlined />
          Back to Stock Opname {tab === "finished" ? "Finished Good" : tab === "raw" ? "Raw Material" : tab === "indirect" ? "Indirect" : "WIP"} Details
        </button>

        <div className="text-sm text-slate-500">{/* placeholder for top-right profile area */}</div>
      </div>

      <div className="mb-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="text-2xl font-bold text-gray-900">{titleLabel}</div>
        </div>
      </div>

      <Card
        className="!rounded-xl !border-gray-100 !shadow-sm"
        title={
          <div>
            <div className="text-xl font-bold text-gray-900">Details</div>
            <div className="text-sm text-slate-500">Complete {detailCopyLabel} Detail for {data.uniqContext}</div>
          </div>
        }
      >
        <Tabs
          defaultActiveKey="details"
          items={[
            {
              key: "details",
              label: (
                <span className="inline-flex items-center gap-2">
                  <FileTextOutlined /> Details
                </span>
              ),
              children: (
                <div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div>
                      <div className="text-xs text-slate-500">Stock Opname ID</div>
                      <div className="text-sm text-slate-800 mt-1">{data.opnameId}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Period</div>
                      <div className="text-sm text-slate-800 mt-1">{data.period}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">System:</div>
                      <div className="text-sm font-semibold text-slate-800">{formatNumber(data.systemQty)}</div>
                      <div className="text-xs text-slate-500 mt-1">Physical:</div>
                      <div className="text-sm font-semibold text-blue-600">{formatNumber(data.physicalQty)}</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">Status & Impact</div>
                      <div className="text-sm text-slate-800 mt-1">{data.statusImpact}</div>
                    </div>

                    <div>
                      <div className={"text-sm font-semibold mt-5 " + vColor}>
                        {vDiffText} <span className="font-normal">({vPctText})</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{formatMoney(data.costImpact)}</div>
                    </div>
                  </div>

                  <div className="text-2xl font-bold text-gray-900 mb-1">{data.opnameId}</div>
                  <div className="text-sm text-slate-500 mb-4">Complete Stock Opname {detailCopyLabel} Detail for {data.uniqContext}</div>

                  <div className="overflow-hidden rounded-xl border border-gray-100">
                    <Table<DetailLine>
                      dataSource={lines}
                      columns={columns}
                      rowKey="key"
                      loading={isFetching}
                      pagination={false}
                      size="middle"
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
                <div className="space-y-3">
                  {data.logs.map((l) => (
                    <div key={l.key} className="rounded-xl border border-gray-100 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800">{l.action}</div>
                        <Tag className="!rounded-full !px-3 !py-0.5 !text-xs">{l.at}</Tag>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">By: {l.by}</div>
                      {l.note && <div className="text-xs text-slate-600 mt-2">{l.note}</div>}
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
