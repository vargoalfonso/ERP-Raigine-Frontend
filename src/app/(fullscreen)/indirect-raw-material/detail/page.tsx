"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Table, Tabs, Tag, message } from "antd";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useGetInventoryDetailQuery,
  useGetInventoryIncomingQuery,
  useGetInventoryKanbanSummaryQuery,
  useGetDeliveryNoteByUniqQuery,
} from "@/lib/api/inventory/api";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const isMissingRouteError = (error: unknown): boolean =>
  isRecord(error) && error.status === 404;

type DeliveryNoteLogRow = {
  key: string;
  jobNumber: string;
  receivedDate: string;
  quantity: number;
  kanban: number;
  supplierName: string;
  receivedBy: string;
};

const formatNumber = (value: number | undefined) =>
  new Intl.NumberFormat("en-US").format(Number(value ?? 0));

function IndirectRawMaterialDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uniq = searchParams.get("uniq") ?? "RM-001";
  const id = searchParams.get("id") ?? "";
  const apiEnabled = Boolean(apiBaseUrl);

  const [activeTab, setActiveTab] = useState("details");
  const detailQuery = useGetInventoryDetailQuery(
    { type: "indirect-materials", id },
    { skip: !apiEnabled || !id },
  );
  const incomingQuery = useGetInventoryIncomingQuery(
    { type: "indirect-materials", page: 1, limit: 20 },
    { skip: !apiEnabled },
  );
  const summaryQuery = useGetInventoryKanbanSummaryQuery(
    { uniq_code: uniq },
    { skip: !apiEnabled || !uniq },
  );

  useEffect(() => {
    const error =
      detailQuery.error ?? incomingQuery.error ?? summaryQuery.error;
    if (!apiEnabled || !error) return;
    if (isMissingRouteError(error)) {
      message.warning(
        "Inventory indirect-materials API route is not available yet; showing placeholder data.",
      );
      return;
    }
    message.error(
      getApiErrorMessage(error, "Failed to load indirect raw material detail"),
    );
  }, [apiEnabled, detailQuery.error, incomingQuery.error, summaryQuery.error]);

  const useMock = !apiEnabled || isMissingRouteError(detailQuery.error);
  const detail = useMock ? null : detailQuery.data?.data;
  const summary = useMock ? null : summaryQuery.data?.data;

  const detailInfo = useMemo(
    () => ({
      uniq: detail?.uniq_code ?? uniq,
      partNumber: detail?.part_number ?? "-",
      partName:
        detail?.part_name ?? detail?.item_name ?? detail?.uniq_code ?? "-",
      warehouse: detail?.warehouse_location ?? "-",
      poNumber: detail?.rm_source ?? "-",
      deliveryNotesNumber: detail?.id ?? id,
      quantity: Number(detail?.stock_qty ?? 0),
      status: Number(detail?.stock_qty ?? 0) > 20 ? "NORMAL" : "LOW STOCK",
      buyFlag: Number(detail?.stock_qty ?? 0) > 20 ? "NOT BUY" : "BUY",
      lastUpdate: detail?.updated_at ?? detail?.created_at ?? "-",
      uom: detail?.uom ?? "-",
      weight: Number(detail?.stock_weight_kg ?? 0),
      kanbanCount: Number(summary?.kanban_count ?? 0),
      stockDays: Number(summary?.stock_days ?? 0),
      safetyStockDays: Number(summary?.safety_stock_days ?? 0),
    }),
    [detail, id, summary, uniq],
  );

  const logs = useMemo<DeliveryNoteLogRow[]>(() => {
    if (useMock) return [];
    return (incomingQuery.data?.data ?? [])
      .filter((item) => !item.uniq_code || item.uniq_code === detailInfo.uniq)
      .map((item, index) => ({
        key: item.id || `${index}`,
        jobNumber: item.reference_number ?? item.packing_number ?? item.id,
        receivedDate: item.date_incoming ?? item.created_at ?? "-",
        quantity: Number(item.quantity ?? item.stock_qty ?? 0),
        kanban: Number(summary?.kanban_count ?? 0),
        supplierName: item.supplier_name ?? "-",
        receivedBy: item.warehouse_location ?? "-",
      }));
  }, [detailInfo.uniq, incomingQuery.data, summary?.kanban_count, useMock]);

  const totalDeliveryNotes = logs.length;
  const totalQuantity = logs.reduce((sum, row) => sum + row.quantity, 0);

  const logColumns = [
    { title: "Job Number", dataIndex: "jobNumber", key: "jobNumber" },
    { title: "Received Date", dataIndex: "receivedDate", key: "receivedDate" },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      align: "right" as const,
      render: (value: number) => formatNumber(value),
    },
    {
      title: "Kanban",
      dataIndex: "kanban",
      key: "kanban",
      align: "right" as const,
      render: (value: number) => formatNumber(value),
    },
    { title: "Supplier Name", dataIndex: "supplierName", key: "supplierName" },
    { title: "Received By", dataIndex: "receivedBy", key: "receivedBy" },
  ];

  const uniqCode =
    searchParams.get("uniq_code") ??
    searchParams.get("uniq") ??
    searchParams.get("uniqCode") ??
    "";

  const { data: deliveryNoteRes, isFetching: deliveryNoteLoading } =
    useGetDeliveryNoteByUniqQuery(uniqCode, {
      skip: !uniqCode,
    });

  const deliveryNoteData = deliveryNoteRes?.data ?? [];

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="flex items-center justify-between bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <ArrowLeftOutlined
            className="cursor-pointer"
            onClick={() => router.back()}
          />
          <h1 className="text-2xl font-semibold m-0">
            Indirect Raw Material Details
          </h1>
        </div>

        {/* <div>
          <Button className="rounded-xl">Admin PPIC</Button>
        </div> */}
      </div>

      <div className="p-8">
        <Card
          className="rounded-2xl shadow"
          loading={
            apiEnabled
              ? detailQuery.isFetching || summaryQuery.isFetching
              : false
          }
        >
          <h2 className="text-xl font-bold">Details & Delivery Note Logs</h2>
          <p className="text-gray-400">
            Complete Indirect Raw Material Detail for {detailInfo.uniq}
          </p>

          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
            items={[
              {
                key: "details",
                label: (
                  <span className="flex items-center gap-2">📦 Details</span>
                ),
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
                        <p className="text-gray-400">Warehouse</p>
                        <p className="font-semibold">{detailInfo.warehouse}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">RM Source</p>
                        <p className="font-semibold">{detailInfo.poNumber}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Inventory ID</p>
                        <p className="font-semibold">
                          {detailInfo.deliveryNotesNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Quantity</p>
                        <Tag className="bg-blue-100 text-blue-600">
                          {formatNumber(detailInfo.quantity)} {detailInfo.uom}
                        </Tag>
                      </div>
                      <div>
                        <p className="text-gray-400">Weight</p>
                        <p className="font-semibold">
                          {formatNumber(detailInfo.weight)} kg
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Status</p>
                        {detailInfo.status === "LOW STOCK" ? (
                          <Tag className="bg-red-100 text-red-600">
                            LOW STOCK
                          </Tag>
                        ) : (
                          <Tag className="bg-green-100 text-green-600">
                            NORMAL
                          </Tag>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-400">Buy Flag</p>
                        {detailInfo.buyFlag === "BUY" ? (
                          <Tag className="bg-blue-100 text-blue-600">BUY</Tag>
                        ) : (
                          <Tag className="bg-gray-100 text-gray-600">
                            NOT BUY
                          </Tag>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-400">Kanban Count</p>
                        <p className="font-semibold">
                          {formatNumber(detailInfo.kanbanCount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Stock / Safety Days</p>
                        <p className="font-semibold">
                          {formatNumber(detailInfo.stockDays)} /{" "}
                          {formatNumber(detailInfo.safetyStockDays)}
                        </p>
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
                label: (
                  <span className="flex items-center gap-2">
                    🧾 Incoming Logs
                  </span>
                ),
                children: (
                  <div className="mt-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card
                          className="rounded-xl"
                          styles={{ body: { padding: 16 } }}
                        >
                          <div className="text-gray-500 text-sm">
                            Total Incoming Logs
                          </div>
                          <div className="text-2xl font-bold">
                            {totalDeliveryNotes}
                          </div>
                        </Card>
                        <Card
                          className="rounded-xl"
                          styles={{ body: { padding: 16 } }}
                        >
                          <div className="text-gray-500 text-sm">
                            Total Quantity
                          </div>
                          <div className="text-2xl font-bold">
                            {formatNumber(totalQuantity)}
                          </div>
                        </Card>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="bg-white border border-gray-200 rounded-xl px-4 py-2">
                          <div className="text-xs text-gray-500">UNIQ</div>
                          <div className="font-semibold">{detailInfo.uniq}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5" style={{ overflowX: "auto" }}>
                      <Table<DeliveryNoteLogRow>
                        columns={logColumns}
                        dataSource={logs}
                        loading={apiEnabled ? incomingQuery.isFetching : false}
                        pagination={false}
                        rowKey="key"
                      />
                    </div>
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
                rowKey={(record) =>
                  `${record.dn_number}-${record.packing_number}`
                }
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

      <div className="flex justify-end px-8 pb-8">
        <Button
          className="bg-blue-600 text-white rounded-xl"
          onClick={() => router.push("/indirect-raw-materials")}
        >
          Back
        </Button>
      </div>
    </div>
  );
}

export default function IndirectRawMaterialDetailPage() {
  return (
    <Suspense fallback={null}>
      <IndirectRawMaterialDetailPageContent />
    </Suspense>
  );
}
