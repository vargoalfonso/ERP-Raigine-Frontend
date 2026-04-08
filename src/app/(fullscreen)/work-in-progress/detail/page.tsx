"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined, EyeOutlined } from "@ant-design/icons";
import { Button, Card, Table, Tabs, Tag } from "antd";

interface RowHistory {
  key: string;
  uniq: string;
  process: string;
  stock: number;
  reason: string;
  qty: number;
  lastUpdate: string;
}

function WorkInProgressDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uniq = searchParams.get("uniq") ?? "LV7-001";

  const [activeTab, setActiveTab] = useState("1");

  const detailInfo = useMemo(
    () => ({
      uniq,
      partNumber: "EMA7-001",
      partName: "Engine Mount Assembly",
      model: "Camry 2024",
      woNumber: "WO-001-2024",
      process: "Assembly",
      station: "Welding Station 2",
      stock: 200,
      kanbanCode: "KBN-001-2024",
      type: "Child Part",
      stockToCompleteKanban: 250,
      kanban: 5,
      status: "On Track",
    }),
    [uniq]
  );

  const historyData: RowHistory[] = [
    {
      key: "1",
      uniq,
      process: "Assembly",
      stock: -10,
      reason: "Move Station",
      qty: 190,
      lastUpdate: "Feb 04, 2025 13.06",
    },
    {
      key: "2",
      uniq,
      process: "Machining",
      stock: +6,
      reason: "Scan",
      qty: 196,
      lastUpdate: "Jan 04, 2025 13.06",
    },
    {
      key: "3",
      uniq,
      process: "Quality Check",
      stock: -12,
      reason: "Rework",
      qty: 184,
      lastUpdate: "Dec 04, 2024 13.06",
    },
  ];

  const historyColumns = [
    { title: "Uniq", dataIndex: "uniq", key: "uniq" },
    { title: "Process", dataIndex: "process", key: "process" },
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
    { title: "Reason", dataIndex: "reason", key: "reason" },
    { title: "Qty", dataIndex: "qty", key: "qty" },
    { title: "Last Update", dataIndex: "lastUpdate", key: "lastUpdate" },
    {
      title: "Action",
      key: "action",
      render: (_: unknown, record: RowHistory) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          className="text-blue-600 hover:text-blue-800"
          onClick={() => router.push(`/work-in-progress/detail?uniq=${encodeURIComponent(record.uniq)}`)}
        />
      ),
    },
  ];

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="flex items-center justify-between bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <ArrowLeftOutlined className="cursor-pointer" onClick={() => router.back()} />
          <h1 className="text-2xl font-semibold m-0">Work In-Progress Details</h1>
        </div>

        <div>
          <Button className="rounded-xl">Admin PPIC</Button>
        </div>
      </div>

      <div className="p-8">
        <Card className="rounded-2xl shadow">
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
                        <p className="text-gray-400">Model</p>
                        <p className="font-semibold">{detailInfo.model}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">WO Number</p>
                        <p className="font-semibold">{detailInfo.woNumber}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Process</p>
                        <Tag className="bg-blue-100 text-blue-600">{detailInfo.process}</Tag>
                      </div>

                      <div>
                        <p className="text-gray-400">Station</p>
                        <p className="font-semibold">{detailInfo.station}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Stock</p>
                        <Tag className="bg-blue-100 text-blue-600">{detailInfo.stock}</Tag>
                      </div>

                      <div>
                        <p className="text-gray-400">Kanban</p>
                        <p className="font-semibold">{detailInfo.kanban}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Type</p>
                        <p className="font-semibold">{detailInfo.type}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Stock to Complete Kanban</p>
                        <p className="font-semibold">{detailInfo.stockToCompleteKanban}</p>
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
                      <p className="text-blue-600 font-semibold">Note: Activity Log {detailInfo.uniq}</p>
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
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <WorkInProgressDetailPageContent />
    </Suspense>
  );
}
