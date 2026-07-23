"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Spin, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  useGetWipDetailQuery,
  useGetWipHistoryQuery,
  type WipDetailProcess,
  type WipMovementLogItem,
} from "@/lib/api/wip/api";

/* ================= HELPERS ================= */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatDateTime = (iso?: string | null): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const mm = MONTHS[d.getMonth()];
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm} ${dd}, ${yyyy} ${hh}.${mi}`;
};

const reasonLabel = (item: WipMovementLogItem): string => {
  if (item.reason) return item.reason;
  const mt = (item.movement_type || "").toUpperCase();
  if (mt.includes("MOVE_TO_FG") || mt === "OUTGOING")
    return "WIP dipindah ke Finished Goods";
  if (mt === "INCOMING" || mt.includes("IN")) return "WIP bertambah";
  return item.movement_type || "-";
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{value || "-"}</div>
    </div>
  );
}

/* ================= CONTENT ================= */

function WipDetailContent() {
  const router = useRouter();
  const params = useSearchParams();

  const id = params.get("id") ?? params.get("wip_id") ?? "";
  const uniqParam =
    params.get("uniq") ??
    params.get("uniq_code") ??
    params.get("uniqCode") ??
    "";

  const { data: detailRes, isFetching: detailLoading } = useGetWipDetailQuery(
    { id },
    { skip: !id },
  );

  const detail = detailRes?.data;
  const resolvedUniq = (detail?.uniq || uniqParam || "").trim();

  const { data: historyRes, isFetching: historyLoading } =
    useGetWipHistoryQuery(
      { uniq_code: resolvedUniq, page: 1, limit: 100 },
      { skip: !resolvedUniq },
    );

  const history: WipMovementLogItem[] = historyRes?.data ?? [];

  const processColumns: ColumnsType<WipDetailProcess> = [
    {
      title: "Process",
      dataIndex: "process",
      key: "process",
      render: (v?: string) => v || "-",
    },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      render: (v?: number) => <Tag color="blue">{typeof v === "number" ? v : 0}</Tag>,
    },
  ];

  const historyColumns: ColumnsType<WipMovementLogItem> = [
    {
      title: "Uniq",
      dataIndex: "uniq_code",
      key: "uniq_code",
      render: (v?: string) => v || "-",
    },
    {
      title: "WO Number",
      dataIndex: "wo_number",
      key: "wo_number",
      render: (v?: string) => v || "-",
    },
    {
      title: "DN Number",
      dataIndex: "dn_number",
      key: "dn_number",
      render: (v?: string) => v || "-",
    },
    {
      title: "Stock",
      dataIndex: "qty_change",
      key: "qty_change",
      render: (v?: number) => {
        const n = typeof v === "number" ? v : 0;
        if (n < 0) return <Tag color="red">{n}</Tag>;
        return <Tag color="green">+{n}</Tag>;
      },
    },
    {
      title: "Reason",
      key: "reason",
      render: (_: unknown, row: WipMovementLogItem) => reasonLabel(row),
    },
    {
      title: "By",
      dataIndex: "logged_by",
      key: "logged_by",
      render: (v?: string) => v || "-",
    },
    {
      title: "Last Update",
      dataIndex: "logged_at",
      key: "logged_at",
      render: (v?: string) => formatDateTime(v),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          Back
        </Button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>WIP Detail</h1>
      </div>

      <Spin spinning={detailLoading}>
        <Card style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            <Field label="WO Number" value={detail?.wo_number} />
            <Field label="Uniq" value={detail?.uniq || resolvedUniq} />
            <Field label="Part Number" value={detail?.part_number} />
            <Field label="Part Name" value={detail?.part_name} />
          </div>
        </Card>

        <Tabs
          defaultActiveKey="details"
          items={[
            {
              key: "details",
              label: "Details",
              children: (
                <Table<WipDetailProcess>
                  rowKey={(r, i) => `${r.process ?? "row"}-${i ?? 0}`}
                  columns={processColumns}
                  dataSource={detail?.processes ?? []}
                  pagination={false}
                  locale={{ emptyText: "No process data" }}
                />
              ),
            },
            {
              key: "history",
              label: "History Logs",
              children: (
                <Table<WipMovementLogItem>
                  rowKey={(r, i) => String(r.id ?? i ?? 0)}
                  loading={historyLoading}
                  columns={historyColumns}
                  dataSource={history}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: "No history data" }}
                />
              ),
            },
          ]}
        />
      </Spin>
    </div>
  );
}

export default function WorkInProgressDetailPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spin />
        </div>
      }
    >
      <WipDetailContent />
    </Suspense>
  );
}
