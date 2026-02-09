"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined, EyeOutlined } from "@ant-design/icons";
import { Table, Tabs, Card, Tag, Button } from "antd";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetOneByIdQuery } from "@/lib/api/finished-goods/api";
import type { FinishedGoodsRecord } from "@/lib/api/finished-goods/interface";

interface RowHistory {
  key: string;
  uniq: string;
  kanban: string;
  stock: number;
  reason: string;
  qty: number;
  lastUpdate: string;
}

export default function FinishedGoodDetailPage() {
  return (
    <Suspense fallback={null}>
      <FinishedGoodDetailPageContent />
    </Suspense>
  );
}

function FinishedGoodDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [activeTab, setActiveTab] = useState("1");

  const useApi = Boolean(apiBaseUrl) && Boolean(id);
  const { data: fgOneResponse, isFetching: fgFetching } = useGetOneByIdQuery(id ?? "", {
    skip: !useApi,
  });

  const record: FinishedGoodsRecord | null = useMemo(() => {
    if (!useApi) return null;
    return fgOneResponse?.data ?? null;
  }, [fgOneResponse?.data, useApi]);

  /* ================= SAMPLE DATA HISTORY ================= */
  const historyData: RowHistory[] = [
    {
      key: "1",
      uniq: "FG7-001",
      kanban: "XXX-XXXX",
      stock: -10,
      reason: "Delivery Notes",
      qty: 1090,
      lastUpdate: "Feb 04, 2025 13.06",
    },
    {
      key: "2",
      uniq: "FG7-001",
      kanban: "XXX-XXXX",
      stock: +6,
      reason: "Scan",
      qty: 1090,
      lastUpdate: "Jan 04, 2025 13.06",
    },
    {
      key: "3",
      uniq: "FG7-001",
      kanban: "XXX-XXXX",
      stock: -12,
      reason: "Delivery Notes",
      qty: 1090,
      lastUpdate: "Dec 04, 2024 13.06",
    },
    {
      key: "4",
      uniq: "FG7-001",
      kanban: "XXX-XXXX",
      stock: +6,
      reason: "Stock Opname",
      qty: 1090,
      lastUpdate: "Dec 03, 2024 13.06",
    },
    {
      key: "5",
      uniq: "FG7-001",
      kanban: "XXX-XXXX",
      stock: +6,
      reason: "Scan",
      qty: 1090,
      lastUpdate: "Nov 06, 2024 13.06",
    },
  ];

  /* ================= COLUMNS HISTORY ================= */
  const historyColumns = [
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
    },
    {
      title: "Kanban / Packing List",
      dataIndex: "kanban",
      key: "kanban",
    },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
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
    },
    {
      title: "Qty",
      dataIndex: "qty",
      key: "qty",
    },
    {
      title: "Last Update",
      dataIndex: "lastUpdate",
      key: "lastUpdate",
    },
    {
      title: "Action",
      key: "action",
      render: (_: unknown, record: RowHistory) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          className="text-blue-600 hover:text-blue-800"
          onClick={() => router.push(`/finished-good/detail/${record.key}`)}
        />
      ),
    },
  ];

  /* ================= DATA DETAIL ================= */
  const detailInfo = {
    uniq: record?.master_list?.uniq_code ?? "LV7-001",
    productName: record?.master_list?.part_name ?? "Engine Mount Assembly",
    model: record?.master_list?.model ?? "Camry 2024",
    woNumber: record?.work_order?.wo_number ?? "WO-2024-001",
    warehouse: record?.warehouse?.code ?? "WH-FG-002",
    stock: record?.current_stock ?? 250,
    stockKanban: Number(record?.stock_to_complete ?? 50),
    kanban: record?.total_kanban ?? 5,
    status: "Normal",
  };

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

        <div>
          <Button className="rounded-xl">Admin PPIC</Button>
        </div>
      </div>

      {/* ================= CARD UTAMA ================= */}
      <div className="p-8">
        <Card className="rounded-2xl shadow">
          <h2 className="text-xl font-bold">Details & History Log</h2>
          <p className="text-gray-400">
            Complete Finished Good Detail for {detailInfo.uniq}
          </p>
          {useApi && (
            <div className="mt-2 text-xs text-gray-500">
              {fgFetching ? "Loading from API..." : "Loaded from API"}
            </div>
          )}

          {/* ================= TABS ================= */}
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
            items={[
              {
                key: "1",
                label: (
                  <span className="flex items-center gap-2">📦 Details</span>
                ),
                children: (
                  <Card className="mt-5 bg-gray-50 rounded-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-gray-400">Uniq</p>
                        <p className="font-semibold">{detailInfo.uniq}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Product Name</p>
                        <p className="font-semibold">
                          {detailInfo.productName}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-400">Model</p>
                        <p className="font-semibold">{detailInfo.model}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Working Order Number</p>
                        <p className="font-semibold">{detailInfo.woNumber}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Warehouse Destination</p>
                        <p className="font-semibold">{detailInfo.warehouse}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Stock</p>
                        <Tag className="bg-blue-100 text-blue-600">
                          {detailInfo.stock}
                        </Tag>
                      </div>

                      <div>
                        <p className="text-gray-400">
                          Stock to Complete Kanban
                        </p>
                        <p className="font-semibold">
                          {detailInfo.stockKanban}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-400">Kanban</p>
                        <p className="font-semibold">{detailInfo.kanban}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Status</p>
                        <Tag className="bg-green-100 text-green-600">
                          {detailInfo.status}
                        </Tag>
                      </div>
                    </div>
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
                        Note: In-Out Activity Log {detailInfo.uniq}
                      </p>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <Table<RowHistory>
                        columns={historyColumns}
                        dataSource={historyData}
                        pagination={false}
                        rowKey="key"
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
        </Card>
      </div>

      {/* ================= FOOTER ACTION ================= */}
      <div className="flex justify-end px-8 pb-8">
        <Button
          className="bg-blue-600 text-white rounded-xl"
          onClick={() => router.push("/finished-good")}
        >
          Back
        </Button>
      </div>
    </div>
  );
}
