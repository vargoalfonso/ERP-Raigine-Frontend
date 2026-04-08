"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined, EyeOutlined } from "@ant-design/icons";
import { Button, Card, Table, Tabs, Tag } from "antd";

interface RowHistory {
  key: string;
  uniq: string;
  kanban: string;
  stock: number;
  reason: string;
  qty: number;
  lastUpdate: string;
}

function ScrapStockDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uniq = searchParams.get("uniq") ?? "LV7-001";

  const [activeTab, setActiveTab] = useState("1");

  const detailInfo = useMemo(
    () => ({
      uniq,
      partNumber: "EMA-001",
      partName: "Engine Mount Assembly",
      model: "Camry 2024",
      dateReceived: "01/15/2024, 10:30",
      packingNumber: "KBN-001-2024",
      scrapType: "Setting Machine Scrap",
      scrapReason: "Dump",
      quantity: 50,
      validator: "John Mejer",
      status: "Open",
    }),
    [uniq]
  );

  const historyData: RowHistory[] = [
    {
      key: "1",
      uniq,
      kanban: "XXX-XXXX",
      stock: -10,
      reason: "Delivery Notes",
      qty: 50,
      lastUpdate: "Feb 04, 2025 13.06",
    },
    {
      key: "2",
      uniq,
      kanban: "XXX-XXXX",
      stock: +6,
      reason: "Scan",
      qty: 56,
      lastUpdate: "Jan 04, 2025 13.06",
    },
    {
      key: "3",
      uniq,
      kanban: "XXX-XXXX",
      stock: -12,
      reason: "Inventory",
      qty: 44,
      lastUpdate: "Dec 04, 2024 13.06",
    },
  ];

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
          onClick={() => router.push(`/scrap-stock/detail?uniq=${encodeURIComponent(record.uniq)}`)}
        />
      ),
    },
  ];

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="flex items-center justify-between bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <ArrowLeftOutlined className="cursor-pointer" onClick={() => router.back()} />
          <h1 className="text-2xl font-semibold m-0">Scrap Stock Details</h1>
        </div>

        <div>
          <Button className="rounded-xl">Admin PPIC</Button>
        </div>
      </div>

      <div className="p-8">
        <Card className="rounded-2xl shadow">
          <h2 className="text-xl font-bold">Details & History Log</h2>
          <p className="text-gray-400">Complete Scrap Stock Detail for {detailInfo.uniq}</p>

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
                        <p className="text-gray-400">Model</p>
                        <p className="font-semibold">{detailInfo.model}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Date Received</p>
                        <p className="font-semibold">{detailInfo.dateReceived}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Packing Number</p>
                        <p className="font-semibold">{detailInfo.packingNumber}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Scrap Type</p>
                        <Tag className="bg-blue-100 text-blue-600">{detailInfo.scrapType}</Tag>
                      </div>

                      <div>
                        <p className="text-gray-400">Scrap Reason</p>
                        <Tag className="bg-red-100 text-red-600">{detailInfo.scrapReason}</Tag>
                      </div>

                      <div>
                        <p className="text-gray-400">Quantity</p>
                        <Tag className="bg-blue-100 text-blue-600">{detailInfo.quantity}</Tag>
                      </div>

                      <div>
                        <p className="text-gray-400">Validator</p>
                        <p className="font-semibold">{detailInfo.validator}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Status</p>
                        <Tag className="bg-green-100 text-green-600">{detailInfo.status}</Tag>
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
        <Button className="bg-blue-600 text-white rounded-xl" onClick={() => router.push("/scrap-stock")}
        >
          Back
        </Button>
      </div>
    </div>
  );
}

export default function ScrapStockDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ScrapStockDetailPageContent />
    </Suspense>
  );
}
