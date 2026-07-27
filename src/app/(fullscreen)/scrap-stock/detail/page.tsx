"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Pagination, Table, Tabs, Tag } from "antd";
import dayjs from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type ScrapStockHistoryLogRecord,
  useGetScrapStockByIdQuery,
  useGetScrapStockHistoryLogsQuery,
  useGetDeliveryNoteByUniqQuery,
  type DeliveryNoteItem as ApiDeliveryNoteItem,
} from "@/lib/api/scrap-stock/api";

function ScrapStockDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const apiEnabled = Boolean(apiBaseUrl);

  const [activeTab, setActiveTab] = useState("1");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);

  const detailQuery = useGetScrapStockByIdQuery(String(id), {
    skip: !apiEnabled || !id,
  });

  const historyLogsQuery = useGetScrapStockHistoryLogsQuery(
    { id: String(id), page: historyPage, limit: historyLimit },
    { skip: !apiEnabled || !id },
  );

  const detailInfo = useMemo(() => {
    if (apiEnabled && detailQuery.data) {
      return detailQuery.data;
    }
    return null;
  }, [apiEnabled, detailQuery.data]);

  const uniqCode =
    searchParams.get("uniq_code") ??
    searchParams.get("uniq") ??
    searchParams.get("uniqCode") ??
    "";

  const { data: deliveryNoteRes, isFetching: deliveryNoteLoading } =
    useGetDeliveryNoteByUniqQuery(uniqCode, {
      skip: !uniqCode,
    });

  const deliveryNoteData: ApiDeliveryNoteItem[] = deliveryNoteRes?.data ?? [];

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="flex items-center justify-between bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <ArrowLeftOutlined
            className="cursor-pointer"
            onClick={() => router.back()}
          />
          <h1 className="text-2xl font-semibold m-0">Scrap Stock Details</h1>
        </div>

        {/* <div>
          <Button className="rounded-xl">Admin PPIC</Button>
        </div> */}
      </div>

      <div className="p-8">
        <Card className="rounded-2xl shadow">
          <h2 className="text-xl font-bold">Details & History Log</h2>
          <p className="text-gray-400">
            {id
              ? `Complete Scrap Stock Detail for ${id}`
              : "Missing scrap stock id"}
          </p>

          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
            items={[
              {
                key: "1",
                label: <span className="flex items-center gap-2">Details</span>,
                children: (
                  <Card className="mt-5 bg-gray-50 rounded-2xl">
                    {detailQuery.isFetching ? (
                      <div className="text-sm text-gray-500">Loading...</div>
                    ) : !detailInfo ? (
                      <div className="text-sm text-gray-500">No data.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-gray-400">Uniq</p>
                          <p className="font-semibold">
                            {detailInfo.uniq || "-"}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-400">Date Received</p>
                          <p className="font-semibold">
                            {detailInfo.date_received
                              ? dayjs(detailInfo.date_received).format(
                                  "YYYY-MM-DD",
                                )
                              : "-"}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-400">Part Name</p>
                          <p className="font-semibold">
                            {detailInfo.part_name || "-"}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-400">Model</p>
                          <p className="font-semibold">
                            {detailInfo.model || "-"}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-400">Packing Number</p>
                          <p className="font-semibold">
                            {detailInfo.packing_number || "-"}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-400">WO Number</p>
                          <p className="font-semibold">
                            {detailInfo.wo_number || "-"}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-400">QC Cause (Trace)</p>
                          <p className="font-semibold">
                            {detailInfo.source_qc_log_id
                              ? `QC Log #${detailInfo.source_qc_log_id}${
                                  detailInfo.source_defect_id
                                    ? ` • Defect #${detailInfo.source_defect_id}`
                                    : ""
                                }`
                              : "Manual entry"}
                          </p>
                        </div>

                        {["dump", "disposal"].includes(
                          String(detailInfo.scrap_type ?? "").toLowerCase(),
                        ) && (
                          <div>
                            <p className="text-gray-400">Disposal Reason</p>
                            <p className="font-semibold">
                              {detailInfo.disposal_reason || "-"}
                            </p>
                          </div>
                        )}

                        <div>
                          <p className="text-gray-400">Scrap Type</p>
                          <Tag className="bg-blue-100 text-blue-600">
                            {detailInfo.scrap_type || "-"}
                          </Tag>
                        </div>

                        <div>
                          <p className="text-gray-400">Quantity</p>
                          <Tag className="bg-blue-100 text-blue-600">
                            {detailInfo.quantity ?? 0}
                          </Tag>
                        </div>

                        <div>
                          <p className="text-gray-400">Validator</p>
                          <p className="font-semibold">
                            {detailInfo.validator || "-"}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-400">Status</p>
                          <Tag className="bg-green-100 text-green-600">
                            {detailInfo.status || "-"}
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
                  <span className="flex items-center gap-2">History Logs</span>
                ),
                children: (
                  <div className="mt-6">
                    <div className="bg-white rounded-2xl border border-gray-200 p-4">
                      <Table<ScrapStockHistoryLogRecord>
                        rowKey={(r) =>
                          String(
                            r.id ||
                              `${r.action}-${r.created_at ?? ""}-${r.message}`,
                          )
                        }
                        loading={historyLogsQuery.isFetching}
                        dataSource={historyLogsQuery.data?.items ?? []}
                        pagination={false}
                        columns={[
                          {
                            title: "Timestamp",
                            key: "created_at",
                            width: 200,
                            render: (
                              _: unknown,
                              record: ScrapStockHistoryLogRecord,
                            ) => (
                              <div className="text-sm text-gray-700">
                                {record.created_at
                                  ? dayjs(record.created_at).format(
                                      "YYYY-MM-DD HH:mm:ss",
                                    )
                                  : "-"}
                              </div>
                            ),
                          },
                          {
                            title: "Action",
                            dataIndex: "action",
                            key: "action",
                            width: 180,
                            render: (v: unknown) => (
                              <Tag>{String(v ?? "-")}</Tag>
                            ),
                          },
                          {
                            title: "Message",
                            dataIndex: "message",
                            key: "message",
                            render: (v: unknown) => (
                              <div className="text-sm text-gray-800">
                                {String(v ?? "-")}
                              </div>
                            ),
                          },
                          {
                            title: "By",
                            dataIndex: "created_by",
                            key: "created_by",
                            width: 180,
                            render: (v: unknown) => (
                              <div className="text-sm text-gray-700">
                                {String(v ?? "-")}
                              </div>
                            ),
                          },
                        ]}
                      />

                      <div className="flex justify-end mt-4">
                        <Pagination
                          current={historyPage}
                          pageSize={historyLimit}
                          total={historyLogsQuery.data?.pagination?.total ?? 0}
                          showSizeChanger
                          onChange={(p, s) => {
                            setHistoryPage(p);
                            setHistoryLimit(s);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "3",
                label: (
                  <span className="flex items-center gap-2">Delivery Notes</span>
                ),
                children: (
                  <div className="mt-6">
                    <Table<ApiDeliveryNoteItem>
                      rowKey={(record) =>
                        `${record.dn_number ?? "-"}-${record.packing_number ?? "-"}`
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
                        },
                      ]}
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
          onClick={() => router.push("/scrap-stock")}
        >
          Back
        </Button>
      </div>
    </div>
  );
}

export default function ScrapStockDetailPage() {
  return (
    <Suspense fallback={null}>
      <ScrapStockDetailPageContent />
    </Suspense>
  );
}
