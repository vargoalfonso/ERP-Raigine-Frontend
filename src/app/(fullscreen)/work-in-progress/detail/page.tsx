"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Table, Tabs, Tag, message } from "antd";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useGetWipDetailQuery,
  useGetWipHistoryQuery,
  useGetDeliveryNoteByUniqQuery,
  type WipMovementLogItem,
} from "@/lib/api/wip/api";
import { useGetInventoryKanbanSummaryQuery } from "@/lib/api/inventory/api";

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;
const isMissingRouteError = (error: unknown): boolean => isRecord(error) && error.status === 404;

const formatNumber = (value: number | undefined) => new Intl.NumberFormat("en-US").format(Number(value ?? 0));

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const wipReasonLabel = (item: WipMovementLogItem): string => {
  const raw = String(item.reason ?? item.movement_type ?? "").trim();
  if (!raw) return "-";
  const map: Record<string, string> = {
    QC_FINISH: "Selesai QC \u2192 Finished Goods",
    qc_finish: "Selesai QC \u2192 Finished Goods",
    MOVE_TO_FG: "Pindah ke Finished Goods",
    incoming: "Masuk",
    outgoing: "Keluar",
  };
  return map[raw] ?? raw;
};

interface RowProcess {
  key: string;
  process: string;
  stock: number;
}

function WorkInProgressDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uniq = searchParams.get("uniq") ?? "LV7-001";
  const id = searchParams.get("id") ?? "";
  const apiEnabled = Boolean(apiBaseUrl);

  const [activeTab, setActiveTab] = useState("1");

  const detailQuery = useGetWipDetailQuery({ id }, { skip: !apiEnabled || !id });

  useEffect(() => {
    if (!apiEnabled || !detailQuery.error) return;
    if (isMissingRouteError(detailQuery.error)) {
      message.warning("WIP detail API route is not available yet; showing placeholder data.");
      return;
    }
    message.error(getApiErrorMessage(detailQuery.error, "Failed to load WIP detail"));
  }, [apiEnabled, detailQuery.error]);

  const useMock = !apiEnabled || !id || isMissingRouteError(detailQuery.error);
  const detail = useMock ? null : detailQuery.data?.data;

  const detailInfo = useMemo(
    () => ({
      id: detail?.id ?? id,
      uniq: detail?.uniq ?? uniq,
      partNumber: detail?.part_number ?? "-",
      partName: detail?.part_name ?? "-",
      woNumber: detail?.wo_number ?? "-",
    }),
    [detail, id, uniq]
  );

  const processRows = useMemo<RowProcess[]>(() => {
    if (useMock) return [];
    return (detail?.processes ?? []).map((p, index) => ({
      key: `${index}`,
      process: p.process ?? "-",
      stock: Number(p.stock ?? 0),
    }));
  }, [detail?.processes, useMock]);

  const historyQuery = useGetWipHistoryQuery(
    { uniq_code: uniq, page: 1, limit: 100 },
    { skip: !apiEnabled || !uniq },
  );

  const historyRows = useMemo<WipMovementLogItem[]>(() => {
    if (useMock) return [];
    return historyQuery.data?.data ?? [];
  }, [historyQuery.data, useMock]);

  const processColumns = [
    { title: "Process", dataIndex: "process", key: "process" },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      align: "right" as const,
      render: (v: number) => <Tag className="bg-blue-100 text-blue-600">{formatNumber(v)}</Tag>,
    },
  ];

  const historyColumns = [
    {
      title: "Uniq",
      dataIndex: "uniq_code",
      key: "uniq_code",
      render: (v: string | undefined) => v ?? "-",
    },
    {
      title: "WO Number",
      dataIndex: "wo_number",
      key: "wo_number",
      render: (v: string | null | undefined) => v ?? "-",
    },
    {
      title: "DN Number",
      dataIndex: "dn_number",
      key: "dn_number",
      render: (v: string | null | undefined) => v ?? "-",
    },
    {
      title: "Stock",
      dataIndex: "qty_change",
      key: "qty_change",
      align: "right" as const,
      render: (v: number | undefined) => {
        const n = Number(v ?? 0);
        const cls = n < 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600";
        return <Tag className={cls}>{n > 0 ? `+${formatNumber(n)}` : formatNumber(n)}</Tag>;
      },
    },
    {
      title: "Reason",
      key: "reason",
      render: (_: unknown, row: WipMovementLogItem) => wipReasonLabel(row),
    },
    {
      title: "By",
      dataIndex: "logged_by",
      key: "logged_by",
      render: (v: string | null | undefined) => v ?? "-",
    },
    {
      title: "Last Update",
      dataIndex: "logged_at",
      key: "logged_at",
      render: (v: string | undefined) => formatDateTime(v),
    },
  ];

  const kanbanSummaryQuery = useGetInventoryKanbanSummaryQuery(
    { uniq_code: uniq },
    { skip: !apiEnabled || !uniq },
  );
  const kanbanSummary = kanbanSummaryQuery.data?.data;

  const { data: deliveryNoteRes } = useGetDeliveryNoteByUniqQuery(uniq, {
    skip: !apiEnabled || !uniq,
  });
  const deliveryNoteData = deliveryNoteRes?.data ?? [];

  const packingCurrentQty = Number(kanbanSummary?.stock_qty ?? 0);
  const packingTargetQty =
    packingCurrentQty + Number(kanbanSummary?.stock_to_complete ?? 0);
  const packingProgress =
    packingTargetQty > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round((packingCurrentQty / packingTargetQty) * 100),
          ),
        )
      : 0;

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="flex items-center justify-between bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <ArrowLeftOutlined className="cursor-pointer" onClick={() => router.back()} />
          <h1 className="text-2xl font-semibold m-0">Work In-Progress Details</h1>
        </div>

        {/* <div>
          <Button className="rounded-xl">Admin PPIC</Button>
        </div> */}
      </div>

      <div className="p-8">
        <Card className="rounded-2xl shadow" loading={apiEnabled ? detailQuery.isFetching : false}>
          <h2 className="text-xl font-bold">Details & History Log</h2>
          <p className="text-gray-400">Complete Work In-Progress Detail for {detailInfo.uniq}</p>

          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
            items={[
              {
                key: "1",
                label: <span className="flex items-center gap-2">📦 Details</span>,
                children: (
                  <Card className="mt-5 bg-gray-50 rounded-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-gray-400">Uniq</p>
                        <p className="font-semibold">{detailInfo.uniq}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Part Number</p>
                        <p className="font-semibold">{detailInfo.partNumber}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Part Name</p>
                        <p className="font-semibold">{detailInfo.partName}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">WO Number</p>
                        <p className="font-semibold">{detailInfo.woNumber}</p>
                      </div>
                    </div>
                  </Card>
                ),
              },
              {
                key: "2",
                label: <span className="flex items-center gap-2">🧾 Processes</span>,
                children: (
                  <div className="mt-6">
                    <div className="bg-blue-50 p-4 rounded-xl mb-5">
                      <p className="text-blue-600 font-semibold">Note: Process stock breakdown for {detailInfo.uniq}</p>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <Table<RowProcess>
                        columns={processColumns}
                        dataSource={processRows}
                        pagination={false}
                        rowKey="key"
                        locale={{ emptyText: "No process data" }}
                      />
                    </div>
                  </div>
                ),
              },
              {
                key: "3",
                label: <span className="flex items-center gap-2">🧾 History Logs</span>,
                children: (
                  <div className="mt-6" style={{ overflowX: "auto" }}>
                    <Table<WipMovementLogItem>
                      columns={historyColumns}
                      dataSource={historyRows}
                      loading={apiEnabled ? historyQuery.isFetching : false}
                      pagination={false}
                      rowKey={(row) => String(row.id ?? `${row.logged_at ?? ""}-${row.reference_id ?? ""}`)}
                      locale={{ emptyText: "No history data" }}
                    />
                  </div>
                ),
              },
            ]}
          />

          {deliveryNoteData?.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">
                Delivery Note History
              </h3>

              <Table
                rowKey={(record: any) =>
                  `${record.dn_number}-${record.packing_number}`
                }
                pagination={false}
                dataSource={deliveryNoteData}
                columns={[
                  {
                    title: "DN Number",
                    dataIndex: "dn_number",
                    key: "dn_number",
                    render: (value: string) => value || "-",
                  },
                  {
                    title: "Packing Number",
                    dataIndex: "packing_number",
                    key: "packing_number",
                    render: (value: string) => value || "-",
                  },
                  {
                    title: "Quantity",
                    dataIndex: "quantity",
                    key: "quantity",
                    align: "right",
                    render: (value: number) => formatNumber(Number(value ?? 0)),
                  },
                  {
                    title: "Progress",
                    key: "progress",
                    width: 220,
                    render: () => (
                      <div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{ width: `${packingProgress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {packingProgress}% tercapai
                        </p>
                      </div>
                    ),
                  },
                  {
                    title: "Qty saat ini",
                    key: "current_qty",
                    align: "right",
                    render: () => formatNumber(packingCurrentQty),
                  },
                  {
                    title: "Qty maksimal",
                    key: "target_qty",
                    align: "right",
                    render: () => formatNumber(packingTargetQty),
                  },
                ]}
              />
            </div>
          )}
        </Card>
      </div>

      <div className="flex justify-end px-8 pb-8">
        <Button className="bg-blue-600 text-white rounded-xl" onClick={() => router.push("/work-in-progress")}
        >
          Back
        </Button>
      </div>
    </div>
  );
}

export default function WorkInProgressDetailPage() {
  return (
    <Suspense fallback={null}>
      <WorkInProgressDetailPageContent />
    </Suspense>
  );
}
