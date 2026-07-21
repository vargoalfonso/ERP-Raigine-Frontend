"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Popconfirm, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EyeOutlined,
  ExportOutlined,
  QrcodeOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  MdChecklist,
  MdOutlineTrendingDown,
  MdOutlineWarningAmber,
} from "react-icons/md";
import * as XLSX from "xlsx";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type StockInventoryType,
  type StockOpnameSessionListRecord,
  useApproveStockOpnameSessionMutation,
  useDeleteStockOpnameSessionMutation,
  useGetStockOpnameSessionsQuery,
} from "@/lib/api/stock-opname/api";

type StockTab = "finished" | "raw" | "indirect" | "wip" | "subcon";

type StockOpnameRow = {
  key: string;
  apiId?: number;
  opnameId: string;
  period: string;
  location: string;
  systemQty: number;
  physicalQty: number;
  status: "Completed" | "Pending Verification" | "In Progress";
  approval: "Approved" | "Waiting for Approval" | "-";
  costImpact: number;
  uom?: string;
  itemName?: string;
  itemCode?: string;
  countedBy?: string;
  countedAt?: string;
  impact?: "Adjusted" | "Pending";
};

const DEFAULT_PERIOD = "01/2024";

const TAB_TO_INVENTORY_TYPE: Record<StockTab, StockInventoryType> = {
  finished: "FG",
  raw: "RM",
  indirect: "IDR",
  wip: "WIP",
  subcon: "SUBCON",
};

const STOCK_TABS: StockTab[] = ["finished", "raw", "indirect", "wip", "subcon"];

function isStockTab(value: string): value is StockTab {
  return (STOCK_TABS as string[]).includes(value);
}

function normalizeStatus(value?: string): StockOpnameRow["status"] {
  const lower = (value ?? "").toLowerCase();
  if (lower.includes("approved") || lower.includes("complete")) return "Completed";
  if (lower.includes("waiting") || lower.includes("pending verification")) return "Pending Verification";
  if (lower.includes("pending")) return "Pending Verification";
  return "In Progress";
}

function normalizeApproval(value?: string): StockOpnameRow["approval"] {
  const lower = (value ?? "").toLowerCase();
  if (lower.includes("approved")) return "Approved";
  if (lower.includes("waiting") || lower.includes("pending")) return "Waiting for Approval";
  return "-";
}

function mapRecordToRow(record: StockOpnameSessionListRecord): StockOpnameRow {
  const systemQty = record.system_qty_total ?? 0;
  const physicalQty = record.physical_qty_total ?? 0;
  const impactSource = record.impact_label;
  const statusSource = record.status_label ?? record.status;
  const approvalSource = record.impact_label ?? record.status;

  return {
    key: record.uuid || record.session_number || String(record.id),
    apiId: record.id,
    opnameId: record.session_number,
    period: record.period_label ?? DEFAULT_PERIOD,
    location: record.warehouse_location ?? "-",
    systemQty,
    physicalQty,
    status: normalizeStatus(statusSource),
    approval: normalizeApproval(approvalSource),
    costImpact: record.cost_impact ?? 0,
    uom: record.uom ?? undefined,
    itemName: record.session_number,
    itemCode: String(record.inventory_type ?? "-"),
    countedBy: record.submitted_by ?? record.created_by ?? undefined,
    countedAt: record.counted_date ?? record.schedule_date ?? undefined,
    impact:
      (impactSource ?? "").toLowerCase().includes("waiting") ||
      (impactSource ?? "").toLowerCase().includes("pending") ||
      (impactSource ?? "").toLowerCase().includes("none")
        ? "Pending"
        : "Adjusted",
  };
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

function StatCard(props: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  accent: string;
}) {
  const { label, value, icon, accent } = props;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
      </div>
      <div className={"h-10 w-10 rounded-lg flex items-center justify-center " + accent}>{icon}</div>
    </div>
  );
}

export default function StockOpnamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Respect the ?tab= query param so create redirects and the detail "Back"
  // button land on the tab whose data was just created (e.g. Subcon), instead
  // of always defaulting to Finished Goods.
  const tabParam = (searchParams.get("tab") ?? "").toLowerCase();
  const apiEnabled = Boolean(apiBaseUrl);
  const [tab, setTab] = useState<StockTab>(() =>
    isStockTab(tabParam) ? tabParam : "finished"
  );

  // Keep the active tab in sync when navigating back with a different ?tab=.
  useEffect(() => {
    if (isStockTab(tabParam)) setTab(tabParam);
  }, [tabParam]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [scanMode, setScanMode] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const inventoryType = TAB_TO_INVENTORY_TYPE[tab];

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const { data: listData, isFetching: listLoading } = useGetStockOpnameSessionsQuery(
    {
      type: inventoryType,
      page,
      limit: pageSize,
    },
    { skip: !apiEnabled }
  );

  const [deleteSession, { isLoading: deleting }] = useDeleteStockOpnameSessionMutation();
  const [approveSession, { isLoading: approving }] = useApproveStockOpnameSessionMutation();
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");
  const [approvalRemarks, setApprovalRemarks] = useState<string>("");
  const [approvalTarget, setApprovalTarget] = useState<StockOpnameRow | null>(null);

  // Approve/reject a session straight from the list table (same backend action
  // used by the detail page). Falls back gracefully when not connected.
  const submitApproval = async () => {
    if (!approvalTarget) return;
    if (!apiEnabled) {
      message.info("Approval hanya tersedia saat terhubung ke backend");
      return;
    }
    const targetId = approvalTarget.apiId ?? approvalTarget.key;
    try {
      await approveSession({ id: targetId, body: { action: approvalAction, remarks: approvalRemarks } }).unwrap();
      message.success(approvalAction === "approve" ? "Approved" : "Rejected");
      setApprovalOpen(false);
      setApprovalRemarks("");
      setApprovalTarget(null);
    } catch {
      message.error("Gagal mengirim approval");
    }
  };

  // Deleting relies on the numeric session id (the backend resolves sessions by
  // their integer primary key, not by uuid/session_number).
  const handleDeleteSession = async (r: StockOpnameRow) => {
    if (!apiEnabled) {
      message.info("Hapus hanya tersedia saat terhubung ke backend");
      return;
    }
    const targetId = r.apiId ?? r.key;
    try {
      await deleteSession({ id: targetId }).unwrap();
      message.success("Sesi stock opname berhasil dihapus");
    } catch {
      message.error("Gagal menghapus sesi stock opname");
    }
  };

  const tabs = useMemo(
    () => [
      { id: "finished" as const, label: "Finished Goods" },
      { id: "raw" as const, label: "Raw Material" },
      { id: "indirect" as const, label: "Indirect Stock" },
      { id: "wip" as const, label: "WIP Stock" },
      { id: "subcon" as const, label: "Subcon Materials" },
    ],
    []
  );

  const rowsByTab = useMemo<Record<StockTab, StockOpnameRow[]>>(
    () => ({
      subcon: [],
      finished: [
        {
          key: "fg-1",
          opnameId: "SO-FG-012024",
          period: "01/2024",
          location: "WH-FG-A01",
          systemQty: 17890,
          physicalQty: 17888,
          status: "Completed",
          approval: "Approved",
          costImpact: 250,
        },
        {
          key: "fg-2",
          opnameId: "SO-FG-122023",
          period: "01/2024",
          location: "WH-FG-B02",
          systemQty: 19200,
          physicalQty: 19195,
          status: "Pending Verification",
          approval: "Waiting for Approval",
          costImpact: 425,
        },
        {
          key: "fg-3",
          opnameId: "SO-FG-112023",
          period: "01/2024",
          location: "WH-FG-C03",
          systemQty: 120,
          physicalQty: 122,
          status: "Completed",
          approval: "Approved",
          costImpact: 180,
        },
      ],
      raw: [
        {
          key: "rm-1",
          opnameId: "SO-RM-012024",
          period: "01/2024",
          location: "WH-RM-A01",
          systemQty: 17890,
          physicalQty: 17888,
          status: "Completed",
          approval: "Approved",
          costImpact: 250,
        },
        {
          key: "rm-2",
          opnameId: "SO-RM-122023",
          period: "01/2024",
          location: "WH-RM-B02",
          systemQty: 19200,
          physicalQty: 19195,
          status: "Pending Verification",
          approval: "Waiting for Approval",
          costImpact: 425,
        },
        {
          key: "rm-3",
          opnameId: "SO-RM-112023",
          period: "01/2024",
          location: "WH-RM-C03",
          systemQty: 120,
          physicalQty: 122,
          status: "Completed",
          approval: "Approved",
          costImpact: 180,
        },
      ],
      indirect: [
        {
          key: "ind-1",
          opnameId: "SO-IND-012024",
          period: "01/2024",
          location: "TOOL-ROOM-A",
          systemQty: 25,
          physicalQty: 23,
          status: "Completed",
          approval: "Approved",
          costImpact: 180,
          itemName: "Cutting Tools Set",
          itemCode: "ID-TOOL-001",
          countedBy: "Ben Tools",
          countedAt: "1/10/2024",
          impact: "Adjusted",
        },
        {
          key: "ind-2",
          opnameId: "SO-IND-122023",
          period: "01/2024",
          location: "CONS-STORE-B",
          systemQty: 100,
          physicalQty: 98,
          status: "Completed",
          approval: "Approved",
          costImpact: 45,
          itemName: "Machine Consumables",
          itemCode: "ID-CONS-001",
          countedBy: "Carol Indirect",
          countedAt: "1/9/2024",
          impact: "Adjusted",
        },
      ],
      wip: [
        {
          key: "wip-1",
          opnameId: "SO-WIP-012024",
          period: "01/2024",
          location: "Welding Station 2",
          systemQty: 45,
          physicalQty: 44,
          status: "Completed",
          approval: "-",
          costImpact: 25,
          itemName: "Engine Mount WIP",
          itemCode: "KBN-001-2024",
          countedBy: "Oliver Production",
          countedAt: "1/8/2024",
          impact: "Adjusted",
        },
        {
          key: "wip-2",
          opnameId: "SO-WIP-022024",
          period: "01/2024",
          location: "CNC Machine 3",
          systemQty: 18,
          physicalQty: 18,
          status: "Completed",
          approval: "-",
          costImpact: 0,
          itemName: "Suspension Arm WIP",
          itemCode: "KBN-002-2024",
          countedBy: "Jack Machine",
          countedAt: "1/7/2024",
          impact: "Pending",
        },
      ],
    }),
    []
  );

  const allRows = useMemo(() => {
    if (apiEnabled) return (listData?.items ?? []).map(mapRecordToRow);
    return rowsByTab[tab];
  }, [apiEnabled, listData?.items, rowsByTab, tab]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      const v = variance(r.systemQty, r.physicalQty);
      const withVariance = v.diff !== 0;

      const passType =
        typeFilter === "all" ||
        (typeFilter === "withVariance" && withVariance) ||
        (typeFilter === "completed" && r.status === "Completed") ||
        (typeFilter === "pending" && r.status === "Pending Verification");

      const passSearch =
        !q ||
        r.opnameId.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.period.toLowerCase().includes(q) ||
        (r.itemName ? r.itemName.toLowerCase().includes(q) : false) ||
        (r.itemCode ? r.itemCode.toLowerCase().includes(q) : false);

      return passType && passSearch;
    });
  }, [allRows, search, typeFilter]);

  const kpis = useMemo(() => {
    if (apiEnabled) {
      const items = listData?.items ?? [];
      const completed = items.filter((r) => normalizeStatus(r.status_label ?? r.status) === "Completed").length;
      const withVariance = items.filter((r) => (r.variance_qty_total ?? 0) !== 0).length;
      const costImpact = items.reduce((total, r) => total + (r.cost_impact ?? 0), 0);
      return {
        totalRecords: listData?.pagination.total ?? items.length,
        completed,
        withVariance,
        costImpact,
      };
    }
    const all = Object.values(rowsByTab).flat();
    const completed = all.filter((r) => r.status === "Completed").length;
    const withVariance = all.filter((r) => variance(r.systemQty, r.physicalQty).diff !== 0).length;
    const costImpact = all.reduce((acc, r) => acc + (r.costImpact ?? 0), 0);
    return {
      totalRecords: all.length,
      completed,
      withVariance,
      costImpact,
    };
  }, [apiEnabled, listData?.items, listData?.pagination.total, rowsByTab]);

  const columns = useMemo<ColumnsType<StockOpnameRow>>(
    () => {
      const varianceCell = (_: unknown, r: StockOpnameRow) => {
        const v = variance(r.systemQty, r.physicalQty);
        const isNeg = v.diff < 0;
        const color = v.diff === 0 ? "text-slate-500" : isNeg ? "text-red-600" : "text-green-600";
        const pctText = v.diff === 0 ? "0%" : `${v.pct > 0 ? "+" : ""}${v.pct.toFixed(0)}%`;
        const diffText = v.diff === 0 ? "0" : `${v.diff > 0 ? "+" : ""}${v.diff}`;
        return (
          <div className="text-xs leading-5">
            <div className={"font-semibold " + color}>
              {diffText} <span className="font-normal">({pctText})</span>
            </div>
            <div className={"flex items-center gap-1 " + (v.diff < 0 ? "text-red-500" : v.diff > 0 ? "text-green-600" : "text-slate-500")}>
              {v.diff < 0 ? <MdOutlineTrendingDown size={14} /> : v.diff > 0 ? <span className="text-[10px]">▲</span> : null}
              <span className="text-slate-500">{r.costImpact ? formatMoney(r.costImpact) : "$0"}</span>
            </div>
          </div>
        );
      };

      const actionsCol: ColumnsType<StockOpnameRow>[number] = {
        title: "Actions",
        key: "actions",
        align: "center",
        width: 160,
        render: (_, r) => (
          <div className="flex items-center justify-center gap-2">
            <Button
              size="small"
              className="!rounded-lg"
              icon={<EyeOutlined />}
              onClick={() =>
                router.push(
                  `/stock-opname/detail/${encodeURIComponent(String(r.apiId ?? r.key))}?tab=${tab}`
                )
              }
            />
            {r.status !== "Completed" && r.approval !== "Approved" && (
              <>
                <Button
                  size="small"
                  type="primary"
                  className="!rounded-lg !bg-green-600 hover:!bg-green-700"
                  icon={<CheckOutlined />}
                  title="Approve"
                  onClick={() => {
                    setApprovalTarget(r);
                    setApprovalAction("approve");
                    setApprovalRemarks("");
                    setApprovalOpen(true);
                  }}
                />
                <Button
                  size="small"
                  danger
                  className="!rounded-lg"
                  icon={<CloseOutlined />}
                  title="Reject"
                  onClick={() => {
                    setApprovalTarget(r);
                    setApprovalAction("reject");
                    setApprovalRemarks("");
                    setApprovalOpen(true);
                  }}
                />
              </>
            )}
            {/* <Popconfirm
              title="Hapus sesi stock opname?"
              description="Tindakan ini tidak dapat dibatalkan."
              okText="Hapus"
              okButtonProps={{ danger: true, loading: deleting }}
              cancelText="Batal"
              onConfirm={() => handleDeleteSession(r)}
            >
              <Button size="small" danger className="!rounded-lg" icon={<DeleteOutlined />} />
            </Popconfirm> */}
          </div>
        ),
      };

      if (tab === "indirect" || tab === "wip") {
        return [
          {
            title: "Item Information",
            key: "item",
            render: (_, r) => (
              <div className="leading-5">
                <div className="text-sm font-semibold text-slate-800">{r.itemName ?? "-"}</div>
                <div className="text-xs text-slate-500">{r.itemCode ?? r.opnameId}</div>
              </div>
            ),
          },
          {
            title: "Location",
            dataIndex: "location",
            key: "location",
            render: (v: string) => <span className="text-sm text-slate-700">{v}</span>,
            width: 160,
          },
          {
            title: "UOM",
            dataIndex: "uom",
            key: "uom",
            width: 100,
            render: (v: string | undefined) => (
              <span className="text-sm font-medium text-slate-700">{v && v.trim() ? v : "-"}</span>
            ),
          },
          {
            title: "Count Comparison",
            key: "comparison",
            render: (_, r) => (
              <div className="text-xs text-slate-600 leading-5">
                <div>
                  <span className="text-slate-500">System:</span> <span className="font-semibold">{formatNumber(r.systemQty)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Physical:</span>{" "}
                  <span className="font-semibold text-blue-600">{formatNumber(r.physicalQty)}</span>
                </div>
              </div>
            ),
          },
          {
            title: "Variance Analysis",
            key: "variance",
            render: varianceCell,
            width: 140,
          },
          {
            title: "Count Details",
            key: "details",
            render: (_, r) => (
              <div className="text-xs leading-5 text-slate-600">
                <div className="flex items-center gap-1">
                  <UserOutlined className="text-slate-400" />
                  <span>{r.countedBy ?? "-"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CalendarOutlined className="text-slate-400" />
                  <span>{r.countedAt ?? "-"}</span>
                </div>
              </div>
            ),
            width: 180,
          },
          {
            title: "Status & Impact",
            key: "status",
            render: (_, r) => (
              <div className="text-xs leading-5">
                <div>
                  <Tag
                    color={r.status === "Completed" ? "blue" : r.status === "Pending Verification" ? "gold" : "processing"}
                    className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
                  >
                    {r.status}
                  </Tag>
                </div>
                <div className="text-slate-500 flex items-center gap-1">
                  {r.impact === "Adjusted" ? (
                    <>
                      <CheckCircleOutlined className="text-green-600" /> Adjusted
                    </>
                  ) : r.impact === "Pending" ? (
                    <>
                      <MdOutlineWarningAmber className="text-orange-500" /> Pending
                    </>
                  ) : (
                    <>
                      <CheckCircleOutlined className="text-green-600" /> Adjusted
                    </>
                  )}
                </div>
              </div>
            ),
            width: 160,
          },
          actionsCol,
        ];
      }

      return [
        {
          title: "Stock Opname ID",
          dataIndex: "opnameId",
          key: "opnameId",
          render: (v: string) => <span className="text-sm font-semibold text-slate-700">{v}</span>,
        },
        { title: "Period", dataIndex: "period", key: "period", width: 110 },
        {
          title: "UOM",
          dataIndex: "uom",
          key: "uom",
          width: 100,
          render: (v: string | undefined) => (
            <span className="text-sm font-medium text-slate-700">{v && v.trim() ? v : "-"}</span>
          ),
        },
        {
          title: "Location",
          dataIndex: "location",
          key: "location",
          render: (v: string) => <span className="text-sm text-slate-700">{v}</span>,
        },
        {
          title: "Count Comparison",
          key: "comparison",
          render: (_, r) => (
            <div className="text-xs text-slate-600 leading-5">
              <div>
                <span className="text-slate-500">System:</span> <span className="font-semibold">{formatNumber(r.systemQty)}</span>
              </div>
              <div>
                <span className="text-slate-500">Physical:</span>{" "}
                <span className="font-semibold text-blue-600">{formatNumber(r.physicalQty)}</span>
              </div>
            </div>
          ),
        },
        {
          title: "Variance Analysis",
          key: "variance",
          render: varianceCell,
        },
        {
          title: "Status & Impact",
          key: "status",
          render: (_, r) => (
            <div className="text-xs leading-5">
              <div>
                <Tag
                  color={r.status === "Completed" ? "blue" : r.status === "Pending Verification" ? "gold" : "processing"}
                  className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
                >
                  {r.status}
                </Tag>
              </div>
              <div className="text-slate-500 flex items-center gap-1">
                {r.approval === "Approved" ? (
                  <>
                    <CheckCircleOutlined className="text-green-600" /> Approved
                  </>
                ) : r.approval === "Waiting for Approval" ? (
                  <>
                    <MdOutlineWarningAmber className="text-orange-500" /> Waiting for Approval
                  </>
                ) : (
                  <>-</>
                )}
              </div>
            </div>
          ),
        },
        actionsCol,
      ];
    },
    [router, tab]
  );

  const itemsCounted = useMemo(() => filteredRows.length, [filteredRows.length]);

  const handleExportExcel = () => {
    if (!filteredRows.length) {
      message.warning("Tidak ada data untuk diexport");
      return;
    }

    const tabLabel = tabs.find((t) => t.id === tab)?.label ?? "Stock Opname";
    const exportData = filteredRows.map((r) => {
      const v = variance(r.systemQty, r.physicalQty);
      return {
        "Stock Opname ID": r.opnameId,
        "Item Name": r.itemName ?? "-",
        "Item Code": r.itemCode ?? "-",
        Period: r.period,
        UOM: r.uom && r.uom.trim() ? r.uom : "-",
        Location: r.location,
        "System Qty": r.systemQty,
        "Physical Qty": r.physicalQty,
        "Variance Qty": v.diff,
        "Variance %": `${v.pct.toFixed(1)}%`,
        Status: r.status,
        Approval: r.approval,
        Impact: r.impact ?? "-",
        "Counted By": r.countedBy ?? "-",
        "Counted At": r.countedAt ?? "-",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = [
      { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
      { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 14 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tabLabel.slice(0, 31));
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `stock-opname-${tab}-${dateStr}.xlsx`);
    message.success(`${exportData.length} baris berhasil diexport ke Excel`);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Stock Opname Management</h1>
            <p className="text-sm text-gray-500">
              Manual physical stock counting across all inventory types with variance analysis and system adjustment
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="!rounded-lg"
              icon={<QrcodeOutlined />}
              onClick={() => {
                setScanMode((s) => !s);
                message.info(`Scan Mode: ${!scanMode ? "ON" : "OFF"}`);
              }}
            >
              Scan Mode
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<MdChecklist size={16} />}
              onClick={() => router.push(`/stock-opname/start-count?tab=${tab}`)}
            >
              Start Count
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Records" value={kpis.totalRecords} icon={<MdChecklist size={18} />} accent="bg-blue-50 text-blue-600" />
        <StatCard label="Completed" value={kpis.completed} icon={<CheckCircleOutlined />} accent="bg-green-50 text-green-600" />
        <StatCard label="With Variance" value={kpis.withVariance} icon={<MdOutlineWarningAmber size={18} />} accent="bg-orange-50 text-orange-600" />
        {/* <StatCard label="Cost Impact" value={formatMoney(kpis.costImpact)} icon={<MdOutlineTrendingDown size={18} />} accent="bg-red-50 text-red-600" /> */}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* Tabs */}
        <div className="mb-4">
          <div className="inline-flex rounded-xl bg-gray-50 p-1 border border-gray-100">
            {tabs.map((t) => {
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    router.replace(`/stock-opname?tab=${t.id}`);
                  }}
                  className={
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors " +
                    (isActive ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900")
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div className="flex-1 max-w-2xl">
            <Input
              prefix={<span className="text-gray-400">⌕</span>}
              placeholder="Search by Uniq or Machine Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { label: "All Types", value: "all" },
                { label: "With Variance", value: "withVariance" },
                { label: "Completed", value: "completed" },
                { label: "Pending Verification", value: "pending" },
              ]}
              className="min-w-[180px]"
            />
            <Button className="!rounded-lg" icon={<ExportOutlined />} onClick={handleExportExcel}>
              Download Excel
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-bold text-gray-900">
            {tab === "finished"
              ? "Finished Goods Stock Opname"
              : tab === "raw"
              ? "Raw Material Stock Opname"
              : tab === "indirect"
              ? "Indirect Stock Opname"
              : tab === "wip"
              ? "WIP Stock Opname"
              : "Subcon Materials Stock Opname"}
          </div>
          <Tag className="!rounded-full !px-3 !py-0.5 !text-xs">{itemsCounted} items counted</Tag>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100">
          <Table<StockOpnameRow>
            dataSource={filteredRows}
            columns={columns}
            rowKey="key"
            size="middle"
            loading={listLoading}
            pagination={{
              current: page,
              pageSize,
              total: apiEnabled ? (listData?.pagination.total ?? filteredRows.length) : 521390,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} Results`,
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage);
                if (typeof nextPageSize === "number") setPageSize(nextPageSize);
              },
            }}
          />
        </div>
      </div>

      <Modal
        title={approvalAction === "approve" ? "Approve Session" : "Reject Session"}
        open={approvalOpen}
        onCancel={() => setApprovalOpen(false)}
        onOk={() => void submitApproval()}
        okText={approvalAction === "approve" ? "Approve" : "Reject"}
        okButtonProps={{ danger: approvalAction === "reject", loading: approving }}
      >
        <div className="mb-2 text-sm text-slate-600">
          {approvalTarget ? `Sesi: ${approvalTarget.opnameId}` : ""}
        </div>
        <div className="mb-1 text-xs font-semibold text-slate-500">Remarks</div>
        <Input.TextArea rows={4} value={approvalRemarks} onChange={(e) => setApprovalRemarks(e.target.value)} />
      </Modal>
    </div>
  );
}
