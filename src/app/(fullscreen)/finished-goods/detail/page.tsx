"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Table, Tabs, Card, Tag, Button, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  useGetFinishedGoodParameterizedSummaryQuery,
  useGetFinishedGoodHistoryQuery,
  useGetDeliveryNoteByUniqQuery,
  type FinishedGoodHistoryItem,
} from "@/lib/api/finished-goods/api";

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

const formatDateTime = (iso: string): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = MONTHS[d.getMonth()];
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm} ${dd}, ${yyyy} ${hh}.${min}`;
};

const statusLabel = (status: string): string => {
  switch ((status || "").toLowerCase()) {
    case "low_on_stock":
      return "Low on Stock";
    case "overstock":
      return "Overstock";
    case "normal":
      return "Normal";
    default:
      return status || "-";
  }
};

const statusTagClass = (status: string): string => {
  switch ((status || "").toLowerCase()) {
    case "low_on_stock":
      return "bg-red-100 text-red-600";
    case "overstock":
      return "bg-orange-100 text-orange-600";
    default:
      return "bg-green-100 text-green-600";
  }
};

/* ================= DETAIL CONTENT ================= */

function FinishedGoodDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState("1");

  const uniqCode =
    searchParams.get("uniq_code") ??
    searchParams.get("uniq") ??
    searchParams.get("uniqCode") ??
    "";

  const {
    data: detail,
    isFetching: detailLoading,
    isError: detailError,
  } = useGetFinishedGoodParameterizedSummaryQuery(
    { uniq_code: uniqCode },
    { skip: !uniqCode },
  );

  const {
    data: historyRes,
    isFetching: historyLoading,
  } = useGetFinishedGoodHistoryQuery(
    { uniq_code: uniqCode, page: 1, limit: 100 },
    { skip: !uniqCode },
  );

  const historyData: FinishedGoodHistoryItem[] = historyRes?.items ?? [];
  const resolvedUniq = detail?.uniq_code || uniqCode || "-";

const { data: deliveryNoteRes, isFetching: deliveryNoteLoading } =
  useGetDeliveryNoteByUniqQuery(uniqCode, {
    skip: !uniqCode,
  });

const deliveryNoteData = deliveryNoteRes?.data ?? [];

  /* ================= COLUMNS HISTORY ================= */
  const historyColumns: ColumnsType<FinishedGoodHistoryItem> = [
    {
      title: "Uniq",
      dataIndex: "uniq_code",
      key: "uniq_code",
      render: (value: string) => value || "-",
    },
    {
      title: "Kanban / Packing List",
      dataIndex: "reference_id",
      key: "reference_id",
      render: (value: string) => value || "-",
    },
    {
      title: "DN Number",
      dataIndex: "dn_number",
      key: "dn_number",
      render: (value: string) => value || "-",
    },
    {
      title: "WO Number",
      dataIndex: "wo_number",
      key: "wo_number",
      render: (value: string) => value || "-",
    },
    {
      title: "Stock",
      dataIndex: "qty_change",
      key: "qty_change",
      render: (value: number) => {
        if (value < 0) {
          return <Tag className="bg-red-100 text-red-600">{value}</Tag>;
        }
        return <Tag className="bg-green-100 text-green-600">+{value}</Tag>;
      },
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (value: string) => value || "-",
    },
    {
      title: "Qty",
      dataIndex: "qty_after",
      key: "qty_after",
    },
    {
      title: "Last Update",
      dataIndex: "logged_at",
      key: "logged_at",
      render: (value: string) => formatDateTime(value),
    },
  ];

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* ================= NAVBAR ================= */}
      <div className="flex items-center justify-between bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <ArrowLeftOutlined
            className="cursor-pointer"
            onClick={() => router.back()}
          />
          <h1 className="text-2xl font-semibold m-0">Finished Good Details</h1>
        </div>
      </div>

      {/* ================= CARD UTAMA ================= */}
      <div className="p-8">
        <Card className="rounded-2xl shadow">
          <h2 className="text-xl font-bold">Details & History Log</h2>
          <p className="text-gray-400">
            Complete Finished Good Detail for {resolvedUniq}
          </p>

          {!uniqCode ? (
            <div className="text-gray-500 py-10 text-center">
              No uniq_code provided. Open this page from the Finished Goods list.
            </div>
          ) : (
            <Tabs
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key)}
              items={[
                {
                  key: "1",
                  label: (
                    <span className="flex items-center gap-2">Details</span>
                  ),
                  children: (
                    <Card className="mt-5 bg-gray-50 rounded-2xl">
                      {detailLoading ? (
                        <div className="py-10 text-center">
                          <Spin />
                        </div>
                      ) : detailError || !detail ? (
                        <div className="text-red-500 py-6 text-center">
                          Failed to load detail.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-gray-400">Uniq</p>
                            <p className="font-semibold">{detail.uniq_code || "-"}</p>
                          </div>

                          <div>
                            <p className="text-gray-400">Product Name</p>
                            <p className="font-semibold">
                              {detail.part_name || "-"}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-400">Model</p>
                            <p className="font-semibold">{detail.model || "-"}</p>
                          </div>

                          <div>
                            <p className="text-gray-400">Working Order Number</p>
                            <p className="font-semibold">
                              {detail.wo_number || "-"}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-400">Warehouse Destination</p>
                            <p className="font-semibold">
                              {detail.warehouse_location || "-"}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-400">Stock</p>
                            <Tag className="bg-blue-100 text-blue-600">
                              {detail.stock_qty ?? 0}
                            </Tag>
                          </div>

                          <div>
                            <p className="text-gray-400">
                              Stock to Complete Kanban
                            </p>
                            <p className="font-semibold">
                              {detail.stock_to_kanban_pcs ?? 0}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-400">Kanban</p>
                            <p className="font-semibold">
                              {detail.current_kanban ?? 0}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-400">Status</p>
                            <Tag className={statusTagClass(detail.status)}>
                              {statusLabel(detail.status)}
                            </Tag>
                          </div>
                        </div>
                      )}
                    </Card>
                  ),
                },

                {
                  key: "2",
                  label: (
                    <span className="flex items-center gap-2">
                      🕘 History Logs
                    </span>
                  ),
                  children: (
                    <div className="mt-6">
                      <div className="bg-blue-50 p-4 rounded-xl mb-5">
                        <p className="text-blue-600 font-semibold">
                          Note: In-Out Activity Log {resolvedUniq}
                        </p>
                      </div>

                      <div style={{ overflowX: "auto" }}>
                        <Table<FinishedGoodHistoryItem>
                          columns={historyColumns}
                          dataSource={historyData}
                          loading={historyLoading}
                          pagination={false}
                          rowKey="id"
                          locale={{
                            emptyText: "No history data",
                          }}
                        />
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          )}

          {deliveryNoteData?.length > 0 && (
  <div className="mt-8">
    <h3 className="text-lg font-semibold mb-4">Delivery Note History</h3>

    <Table
      rowKey={(record) => `${record.dn_number}-${record.packing_number}`}
      pagination={false}
      dataSource={deliveryNoteData}
      columns={[
        {
          title: "DN Number",
          dataIndex: "dn_number",
          key: "dn_number",
        },
        {
          title: "Packing Number",
          dataIndex: "packing_number",
          key: "packing_number",
        },
        {
          title: "Quantity",
          dataIndex: "quantity",
          key: "quantity",
          align: "right",
        },
        {
          title: "Check",
          dataIndex: "check",
          key: "check",
          render: (value: string) => {
            let color = "default";

            if (value === "progress") color = "processing";
            else if (value === "done") color = "success";
            else if (value === "pending") color = "warning";

            return <Tag color={color}>{value}</Tag>;
          },
        },
      ]}
    />
  </div>
)}
        </Card>
      </div>

      {/* ================= FOOTER ACTION ================= */}
      <div className="flex justify-end px-8 pb-8">
        <Button
          className="bg-blue-600 text-white rounded-xl"
          onClick={() => router.push("/finished-goods")}
        >
          Back
        </Button>
      </div>
    </div>
  );
}

export default function FinishedGoodDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen flex items-center justify-center">
          <Spin />
        </div>
      }
    >
      <FinishedGoodDetailContent />
    </Suspense>
  );
}
