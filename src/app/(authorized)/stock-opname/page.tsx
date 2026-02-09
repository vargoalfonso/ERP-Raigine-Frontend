"use client";

import React, { useMemo, useState } from "react";
import { Button, Input, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
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

type StockTab = "finished" | "raw" | "indirect" | "wip";

type StockOpnameRow = {
  key: string;
  opnameId: string;
  period: string;
  location: string;
  systemQty: number;
  physicalQty: number;
  status: "Completed" | "Pending Verification" | "In Progress";
  approval: "Approved" | "Waiting for Approval" | "-";
  costImpact: number;
  itemName?: string;
  itemCode?: string;
  countedBy?: string;
  countedAt?: string;
  impact?: "Adjusted" | "Pending";
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
  const [tab, setTab] = useState<StockTab>("finished");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [scanMode, setScanMode] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const tabs = useMemo(
    () => [
      { id: "finished" as const, label: "Finished Goods" },
      { id: "raw" as const, label: "Raw Material" },
      { id: "indirect" as const, label: "Indirect Stock" },
      { id: "wip" as const, label: "WIP Stock" },
    ],
    []
  );

  const rowsByTab = useMemo<Record<StockTab, StockOpnameRow[]>>(
    () => ({
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

  const allRows = useMemo(() => rowsByTab[tab], [rowsByTab, tab]);

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
  }, [rowsByTab]);

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
        width: 110,
        render: (_, r) => (
          <div className="flex items-center justify-center gap-2">
            <Button
              size="small"
              className="!rounded-lg"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/stock-opname/detail/${encodeURIComponent(r.opnameId)}?tab=${tab}`)}
            />
            <Button
              size="small"
              className="!rounded-lg"
              icon={<EditOutlined />}
              onClick={() => router.push(`/stock-opname/start-count?tab=${tab}`)}
            />
            <Button
              size="small"
              danger
              className="!rounded-lg"
              icon={<DeleteOutlined />}
              onClick={() => message.info(`Delete ${r.opnameId}`)}
            />
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
        <StatCard label="Cost Impact" value={formatMoney(kpis.costImpact)} icon={<MdOutlineTrendingDown size={18} />} accent="bg-red-50 text-red-600" />
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
                  onClick={() => setTab(t.id)}
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
            <Button className="!rounded-lg" icon={<ExportOutlined />} onClick={() => message.info("Export")}
            >
              Export
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
              : "WIP Stock Opname"}
          </div>
          <Tag className="!rounded-full !px-3 !py-0.5 !text-xs">{itemsCounted} items counted</Tag>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100">
          <Table<StockOpnameRow>
            dataSource={filteredRows}
            columns={columns}
            rowKey="key"
            size="middle"
            pagination={{
              current: page,
              pageSize,
              total: 521390,
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
    </div>
  );
}
