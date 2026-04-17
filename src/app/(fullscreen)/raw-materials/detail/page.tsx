"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Table, Tabs, Card, Tag, Button, message } from "antd";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useGetInventoryDetailQuery,
  useGetInventoryHistoryQuery,
  useGetInventoryKanbanSummaryQuery,
} from "@/lib/api/inventory/api";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const isMissingRouteError = (error: unknown): boolean => isRecord(error) && error.status === 404;

type RowHistory = {
  key: string;
  uniq: string;
  kanban: string;
  stock: number;
  reason: string;
  qty: number;
  lastUpdate: string;
};

const formatNumber = (value: number | undefined) => new Intl.NumberFormat("en-US").format(Number(value ?? 0));

export default function RawMaterialsDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("1");
  const id = searchParams.get("id") ?? "";
  const uniq = searchParams.get("uniq") ?? "LV7-001";
  const apiEnabled = Boolean(apiBaseUrl);

  const detailQuery = useGetInventoryDetailQuery({ type: "raw-materials", id }, { skip: !apiEnabled || !id });
  const historyQuery = useGetInventoryHistoryQuery({ type: "raw-materials", id, page: 1, limit: 20 }, { skip: !apiEnabled || !id });
  const summaryQuery = useGetInventoryKanbanSummaryQuery({ uniq_code: uniq }, { skip: !apiEnabled || !uniq });

  useEffect(() => {
    const error = detailQuery.error ?? historyQuery.error ?? summaryQuery.error;
    if (!apiEnabled || !error) return;
    if (isMissingRouteError(error)) {
      message.warning("Inventory raw-materials API route is not available yet; showing placeholder data.");
      return;
    }
    message.error(getApiErrorMessage(error, "Failed to load raw material detail"));
  }, [apiEnabled, detailQuery.error, historyQuery.error, summaryQuery.error]);

  const useMock = !apiEnabled || isMissingRouteError(detailQuery.error);
  const detail = useMock ? null : detailQuery.data?.data;
  const summary = useMock ? null : summaryQuery.data?.data;

  const detailInfo = useMemo(
    () => ({
      uniq: detail?.uniq_code ?? uniq,
      productName: detail?.part_name ?? detail?.item_name ?? detail?.uniq_code ?? "-",
      model: detail?.raw_material_type ?? "-",
      woNumber: detail?.rm_source ?? "-",
      warehouse: detail?.warehouse_location ?? "-",
      stock: Number(detail?.stock_qty ?? 0),
      stockKanban: Number(summary?.stock_to_complete_kanban ?? 0),
      kanban: Number(summary?.kanban_count ?? 0),
      status: Number(detail?.stock_qty ?? 0) > 20 ? "Available" : Number(detail?.stock_qty ?? 0) > 0 ? "Low Stock" : "Out of Stock",
      uom: detail?.uom ?? "-",
      weight: Number(detail?.stock_weight_kg ?? 0),
      stockDays: Number(summary?.stock_days ?? 0),
      safetyStockDays: Number(summary?.safety_stock_days ?? 0),
    }),
    [detail, summary, uniq]
  );

  const historyData = useMemo<RowHistory[]>(() => {
    if (useMock) {
      return [];
    }
    return (historyQuery.data?.data ?? []).map((item, index) => ({
      key: item.id || `${index}`,
      uniq: item.uniq_code ?? detailInfo.uniq,
      kanban: item.kanban_number ?? item.packing_number ?? item.reference_number ?? "-",
      stock: Number(item.qty ?? 0),
      reason: item.reason ?? item.action ?? "-",
      qty: Number(item.stock_after ?? item.qty ?? 0),
      lastUpdate: item.date_time ?? "-",
    }));
  }, [detailInfo.uniq, historyQuery.data, useMock]);

  const historyColumns = [
    { title: "Uniq", dataIndex: "uniq", key: "uniq" },
    { title: "Kanban / Packing List", dataIndex: "kanban", key: "kanban" },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      render: (value: number) =>
        value < 0 ? <Tag className="bg-red-100 text-red-600">{value}</Tag> : <Tag className="bg-green-100 text-green-600">+{value}</Tag>,
    },
    { title: "Reason", dataIndex: "reason", key: "reason" },
    {
      title: "Qty",
      dataIndex: "qty",
      key: "qty",
      render: (value: number) => formatNumber(value),
    },
    { title: "Last Update", dataIndex: "lastUpdate", key: "lastUpdate" },
  ];

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="flex items-center justify-between bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <ArrowLeftOutlined className="cursor-pointer" onClick={() => router.back()} />
          <h1 className="text-2xl font-semibold m-0">Raw Materials Details</h1>
        </div>

        <div>
          <Button className="rounded-xl">Admin PPIC</Button>
        </div>
      </div>

      <div className="p-8">
        <Card className="rounded-2xl shadow" loading={apiEnabled ? detailQuery.isFetching || summaryQuery.isFetching : false}>
          <h2 className="text-xl font-bold">Details & History Log</h2>
          <p className="text-gray-400">Complete Raw Materials Detail for {detailInfo.uniq}</p>

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
                        <p className="text-gray-400">Product Name</p>
                        <p className="font-semibold">{detailInfo.productName}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Raw Material Type</p>
                        <p className="font-semibold">{detailInfo.model}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">RM Source</p>
                        <p className="font-semibold">{detailInfo.woNumber}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Warehouse</p>
                        <p className="font-semibold">{detailInfo.warehouse}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Stock</p>
                        <Tag className="bg-blue-100 text-blue-600">{formatNumber(detailInfo.stock)} {detailInfo.uom}</Tag>
                      </div>
                      <div>
                        <p className="text-gray-400">Stock Weight</p>
                        <p className="font-semibold">{formatNumber(detailInfo.weight)} kg</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Stock to Complete Kanban</p>
                        <p className="font-semibold">{formatNumber(detailInfo.stockKanban)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Kanban Count</p>
                        <p className="font-semibold">{formatNumber(detailInfo.kanban)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Stock Days</p>
                        <p className="font-semibold">{formatNumber(detailInfo.stockDays)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Safety Stock Days</p>
                        <p className="font-semibold">{formatNumber(detailInfo.safetyStockDays)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Status</p>
                        <Tag className={detailInfo.status === "Available" ? "bg-green-100 text-green-600" : detailInfo.status === "Low Stock" ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"}>
                          {detailInfo.status}
                        </Tag>
                      </div>
                    </div>
                  </Card>
                ),
              },
              {
                key: "2",
                label: <span className="flex items-center gap-2">🕘 History Logs</span>,
                children: (
                  <div className="mt-6">
                    <div className="bg-blue-50 p-4 rounded-xl mb-5">
                      <p className="text-blue-600 font-semibold">Note: In-Out Activity Log {detailInfo.uniq}</p>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <Table<RowHistory>
                        columns={historyColumns}
                        dataSource={historyData}
                        loading={apiEnabled ? historyQuery.isFetching : false}
                        pagination={false}
                        rowKey="key"
                        locale={{ emptyText: "No history data" }}
                      />
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <div className="flex justify-end px-8 pb-8">
        <Button className="bg-blue-600 text-white rounded-xl" onClick={() => router.push("/raw-materials")}>
          Back
        </Button>
      </div>
    </div>
  );
}
