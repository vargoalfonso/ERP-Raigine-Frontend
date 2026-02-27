"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined, EyeOutlined } from "@ant-design/icons";
import { Button, Card, Table, Tabs, Tag } from "antd";

type DeliveryNoteLogRow = {
  key: string;
  dnNumber: string;
  receivedDate: string;
  quantity: number;
  kanban: number;
  vendorName: string;
  receivedBy: string;
};

export default function SubConMaterialsDetailPage() {
  return (
    <Suspense fallback={null}>
      <SubConMaterialsDetailPageContent />
    </Suspense>
  );
}

function SubConMaterialsDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uniq = searchParams.get("uniq") ?? "SUB-001";

  const [activeTab, setActiveTab] = useState("details");

  const detailInfo = useMemo(
    () => ({
      uniq,
      partNumber: "SUB-PLT-001",
      partName: "Plating Process - Bracket",
      subconVendor: "PT Subcon Plating",
      period: "2025-Q1",
      dateDelivery: "2025-09-25",
      stockDate: 500,
      totalStock: 2500,
      totalPO: 5000,
      deltaPoStock: 2500,
      status: "NORMAL" as const,
      lastUpdate: "Oct 15, 2025 10:21",
      dnId: "DN-RM-2025-001",
    }),
    [uniq]
  );

  const logs: DeliveryNoteLogRow[] = [
    {
      key: "1",
      dnNumber: "DN-SUB-2025-001",
      receivedDate: "12-09-25 08:41",
      quantity: 200,
      kanban: 1,
      vendorName: "PT Subcon Plating",
      receivedBy: "PPIC",
    },
    {
      key: "2",
      dnNumber: "DN-SUB-2025-002",
      receivedDate: "12-09-25 09:05",
      quantity: 250,
      kanban: 1,
      vendorName: "PT Subcon Plating",
      receivedBy: "PPIC",
    },
    {
      key: "3",
      dnNumber: "DN-SUB-2025-003",
      receivedDate: "12-09-25 10:10",
      quantity: 300,
      kanban: 1,
      vendorName: "PT Subcon Plating",
      receivedBy: "PPIC",
    },
  ];

  const totalDeliveryNotes = logs.length;
  const totalQuantity = logs.reduce((sum, r) => sum + r.quantity, 0);

  const logColumns = [
    { title: "DN Number", dataIndex: "dnNumber", key: "dnNumber" },
    { title: "Received Date", dataIndex: "receivedDate", key: "receivedDate" },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      align: "right" as const,
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "Kanban",
      dataIndex: "kanban",
      key: "kanban",
      align: "right" as const,
    },
    { title: "Vendor Name", dataIndex: "vendorName", key: "vendorName" },
    { title: "Received By", dataIndex: "receivedBy", key: "receivedBy" },
    {
      title: "Action",
      key: "action",
      width: 80,
      render: () => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          className="text-blue-600 hover:text-blue-800"
          onClick={() =>
            router.push(
              `/sub-con-materials/detail?uniq=${encodeURIComponent(detailInfo.uniq)}`
            )
          }
        />
      ),
    },
  ];

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="flex items-center justify-between bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <ArrowLeftOutlined className="cursor-pointer" onClick={() => router.back()} />
          <h1 className="text-2xl font-semibold m-0">SubCon Stock In Vendor Details</h1>
        </div>

        <div>
          <Button className="rounded-xl">Admin PPIC</Button>
        </div>
      </div>

      <div className="p-8">
        <Card className="rounded-2xl shadow">
          <h2 className="text-xl font-bold">Details & Delivery Note Logs</h2>
          <p className="text-gray-400">Complete SubCon detail for {detailInfo.uniq}</p>

          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
            items={[
              {
                key: "details",
                label: <span className="flex items-center gap-2">📦 Details</span>,
                children: (
                  <Card className="mt-5 bg-gray-50 rounded-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-gray-400">UNIQ</p>
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
                        <p className="text-gray-400">Subcon Vendor</p>
                        <p className="font-semibold">{detailInfo.subconVendor}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Period</p>
                        <p className="font-semibold">{detailInfo.period}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Date Delivery</p>
                        <p className="font-semibold">{detailInfo.dateDelivery}</p>
                      </div>

                      <div>
                        <p className="text-gray-400">Stock/Date</p>
                        <Tag className="bg-blue-100 text-blue-600">{detailInfo.stockDate.toLocaleString("en-US")}</Tag>
                      </div>

                      <div>
                        <p className="text-gray-400">Total Stock</p>
                        <Tag className="bg-blue-100 text-blue-600">{detailInfo.totalStock.toLocaleString("en-US")}</Tag>
                      </div>

                      <div>
                        <p className="text-gray-400">Total PO</p>
                        <Tag className="bg-blue-100 text-blue-600">{detailInfo.totalPO.toLocaleString("en-US")}</Tag>
                      </div>

                      <div>
                        <p className="text-gray-400">ΔPO-Stock</p>
                        <Tag className="bg-blue-100 text-blue-600">{detailInfo.deltaPoStock.toLocaleString("en-US")}</Tag>
                      </div>

                      <div>
                        <p className="text-gray-400">Status</p>
                        <Tag className="bg-green-100 text-green-600">{detailInfo.status}</Tag>
                      </div>

                      <div>
                        <p className="text-gray-400">Last Update</p>
                        <p className="font-semibold">{detailInfo.lastUpdate}</p>
                      </div>
                    </div>
                  </Card>
                ),
              },
              {
                key: "logs",
                label: <span className="flex items-center gap-2">🧾 Delivery Note Logs</span>,
                children: (
                  <div className="mt-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="rounded-xl" styles={{ body: { padding: 16 } }}>
                          <div className="text-gray-500 text-sm">Total Delivery Notes</div>
                          <div className="text-2xl font-bold">{totalDeliveryNotes}</div>
                        </Card>
                        <Card className="rounded-xl" styles={{ body: { padding: 16 } }}>
                          <div className="text-gray-500 text-sm">Total Quantity</div>
                          <div className="text-2xl font-bold">{totalQuantity.toLocaleString("en-US")}</div>
                        </Card>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="bg-white border border-gray-200 rounded-xl px-4 py-2">
                          <div className="text-xs text-gray-500">DN ID</div>
                          <div className="font-semibold">{detailInfo.dnId}</div>
                        </div>
                        <Button>Export DN Log</Button>
                        <Button type="primary">Create DN</Button>
                      </div>
                    </div>

                    <div className="mt-5" style={{ overflowX: "auto" }}>
                      <Table<DeliveryNoteLogRow>
                        columns={logColumns}
                        dataSource={logs}
                        pagination={false}
                        rowKey="key"
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
        <Button className="bg-blue-600 text-white rounded-xl" onClick={() => router.push("/sub-con-materials")}>
          Back
        </Button>
      </div>
    </div>
  );
}
