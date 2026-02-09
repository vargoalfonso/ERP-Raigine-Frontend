"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftOutlined, EyeOutlined } from "@ant-design/icons";
import { Table, Tabs, Card, Tag, Button } from "antd";

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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("1");

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
          onClick={() => router.push(`/raw-materials/detail/${record.key}`)}
        />
      ),
    },
  ];

  /* ================= DATA DETAIL ================= */
  const detailInfo = {
    uniq: "LV7-001",
    productName: "Engine Mount Assembly",
    model: "Camry 2024",
    woNumber: "WO-2024-001",
    warehouse: "WH-FG-002",
    stock: 250,
    stockKanban: 50,
    kanban: 5,
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
          <h1 className="text-2xl font-semibold m-0">Raw Materials Details</h1>
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
            Complete Raw Materials Detail for {detailInfo.uniq}
          </p>

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
          onClick={() => router.push("/raw-materials")}
        >
          Back
        </Button>
      </div>
    </div>
  );
}
