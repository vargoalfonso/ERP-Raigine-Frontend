"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftOutlined,
  EyeOutlined,
  ExportOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Card, Table, Tabs, Tag, message } from "antd";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useGetInventoryDetailQuery,
  useGetInventoryIncomingQuery,
  useGetInventoryKanbanSummaryQuery,
  useGetDeliveryNoteByUniqQuery,
  type DeliveryNoteItem as ApiDeliveryNoteItem,
} from "@/lib/api/inventory/api";

type DeliveryNoteLogRow = {
  key: string;
  dnNumber: string;
  receivedDate: string;
  quantity: number;
  source: string;
  kanban: number;
  vendorName: string;
};

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;
const isMissingRouteError = (error: unknown): boolean =>
  isRecord(error) && error.status === 404;

const formatNumber = (value: number | undefined) =>
  new Intl.NumberFormat("en-US").format(Number(value ?? 0));

// [subcon-dnlog] Backend mengirim scan_ref berisi arah pergerakan
// (SUBCON-OUT / SUBCON-IN) untuk tiap scan DN Subcon.
const subconLogSource = (item: UnknownRecord): string => {
  const ref = String(item?.scan_ref ?? "").toUpperCase();
  if (ref.startsWith("SUBCON-OUT")) return "DN Subcon OUT";
  if (ref.startsWith("SUBCON-IN")) return "DN Subcon IN";
  return String(item?.rm_source ?? "-");
};

function SubConMaterialsDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uniq = searchParams.get("uniq") ?? "SUB-001";
  const id = searchParams.get("id") ?? "";
  const isReceived = (searchParams.get("type") ?? "in-vendor") === "received";
  const apiEnabled = Boolean(apiBaseUrl);

  const labels = {
    headerTitle: isReceived
      ? "SubCon Stock Received Details"
      : "SubCon Stock In Vendor Details",
    back: isReceived
      ? "Back to SubCon Stock Received"
      : "Back to SubCon Stock In Vendor",
    subtitle: isReceived
      ? `Complete SubCon Stock Received from Vendor Information for ${uniq}`
      : `Complete SubCon Stock In Vendor information for ${uniq}`,
    backMode: isReceived
      ? "/sub-con-materials?mode=received"
      : "/sub-con-materials",
  };

  const [activeTab, setActiveTab] = useState("details");

  const detailQuery = useGetInventoryDetailQuery(
    { type: "subcon-materials", id },
    { skip: !apiEnabled || !id },
  );
  const incomingQuery = useGetInventoryIncomingQuery(
    { type: "subcon-materials", page: 1, limit: 20 },
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
        "Inventory subcon-materials API route is not available yet; showing placeholder data.",
      );
      return;
    }
    message.error(
      getApiErrorMessage(error, "Failed to load subcon material detail"),
    );
  }, [apiEnabled, detailQuery.error, incomingQuery.error, summaryQuery.error]);

  const useMock = !apiEnabled || isMissingRouteError(detailQuery.error);
  const detail = useMock ? null : detailQuery.data?.data;
  const summary = useMock ? null : summaryQuery.data?.data;

  const detailInfo = useMemo(() => {
    const record = (detail ?? null) as UnknownRecord | null;
    const totalStock = Number(detail?.stock_qty ?? 0);
    const totalPo = Number(record?.total_po ?? 0);
    return {
      uniq: detail?.uniq_code ?? uniq,
      partName:
        detail?.part_name ?? detail?.item_name ?? detail?.uniq_code ?? "-",
      partNumber: detail?.part_number ?? "-",
      dateDelivery: String(detail?.updated_at ?? detail?.created_at ?? "-"),
      quantityDeliveryItems: String(
        record?.reference_number ?? detail?.rm_source ?? "-",
      ),
      subconVendorName: String(record?.supplier_name ?? "-"),
      stockPerDate: Number(record?.stock_qty_per_date ?? 0),
      totalStock,
      totalPo,
      apoStock: Math.max(0, totalPo - totalStock),
      safetyStock: Number(summary?.safety_stock_days ?? 0),
      status: totalStock > 20 ? ("NORMAL" as const) : ("LOW STOCK" as const),
    };
  }, [detail, summary, uniq]);

  const logs = useMemo<DeliveryNoteLogRow[]>(() => {
    if (useMock) return [];
    return (incomingQuery.data?.data ?? [])
      .filter((item) => !item.uniq_code || item.uniq_code === detailInfo.uniq)
      .map((item, index) => ({
        key: item.id || `${index}`,
        dnNumber:
          item.dn_number ??
          item.reference_number ??
          item.packing_number ??
          item.id,
        receivedDate: item.date_incoming ?? item.created_at ?? "-",
        quantity: Number(item.quantity ?? item.stock_qty ?? 0),
        source: subconLogSource(item as UnknownRecord),
        kanban: Number(summary?.kanban_count ?? 0),
        vendorName: item.supplier_name ?? "-",
      }));
  }, [detailInfo.uniq, incomingQuery.data, summary?.kanban_count, useMock]);

  const totalDeliveryNotes = logs.length;
  // [subcon-del] Hanya baris DN Subcon IN yang dijumlahkan. Baris OUT adalah
  // barang yang keluar ke vendor, sehingga tidak boleh ikut menambah total.
  const totalQuantity = logs
    .filter((r) => r.source === "DN Subcon IN")
    .reduce((sum, r) => sum + r.quantity, 0);
  const latestDn = logs.length ? logs[0].dnNumber : "-";

  const logColumns = [
    { title: "DN Number", dataIndex: "dnNumber", key: "dnNumber" },
    { title: "Received Date", dataIndex: "receivedDate", key: "receivedDate" },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      align: "right" as const,
      render: (v: number) => formatNumber(v),
    },
    { title: "Source", dataIndex: "source", key: "source" },
    {
      title: "Kanban",
      dataIndex: "kanban",
      key: "kanban",
      align: "right" as const,
      render: (v: number) => formatNumber(v),
    },
    { title: "Vendor Name", dataIndex: "vendorName", key: "vendorName" },
    {
      title: "Barcode/Packing List",
      key: "barcode",
      render: () => (
        <Button size="small" icon={<EyeOutlined />}>
          View
        </Button>
      ),
    },
  ];

  const infoItem = (label: string, value: React.ReactNode) => (
    <div>
      <p className="text-gray-400 mb-1">{label}</p>
      <div className="font-semibold">{value}</div>
    </div>
  );

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

  const subconCurrentQty = detailInfo.totalStock;
  const subconTargetQty = detailInfo.totalPo;
  const subconProgress =
    subconTargetQty > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((subconCurrentQty / subconTargetQty) * 100)),
        )
      : 0;

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="flex items-center justify-between bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push(labels.backMode)}
          >
            {labels.back}
          </Button>
          <h1 className="text-2xl font-semibold m-0">{labels.headerTitle}</h1>
        </div>
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
          <p className="text-gray-400">{labels.subtitle}</p>

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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {infoItem("Uniq", detailInfo.uniq)}
                      {infoItem("Product/Part Name", detailInfo.partName)}
                      {infoItem("Part Number", detailInfo.partNumber)}

                      {infoItem("Date Delivery", detailInfo.dateDelivery)}
                      {infoItem(
                        "Quantity Delivery Items",
                        detailInfo.quantityDeliveryItems,
                      )}
                      {infoItem(
                        "SubCon Vendor Name",
                        detailInfo.subconVendorName,
                      )}

                      {infoItem(
                        "Stock (per Date)",
                        formatNumber(detailInfo.stockPerDate),
                      )}
                      {infoItem(
                        "Total Stock",
                        formatNumber(detailInfo.totalStock),
                      )}
                      {infoItem("Total PO", formatNumber(detailInfo.totalPo))}

                      {infoItem("APO-Stock", formatNumber(detailInfo.apoStock))}
                      {infoItem(
                        "Safety Stock",
                        formatNumber(detailInfo.safetyStock),
                      )}
                      {infoItem(
                        "Status",
                        detailInfo.status === "LOW STOCK" ? (
                          <Tag className="bg-red-100 text-red-600 border-0">
                            LOW STOCK
                          </Tag>
                        ) : (
                          <Tag className="bg-green-100 text-green-600 border-0">
                            NORMAL
                          </Tag>
                        ),
                      )}
                    </div>
                  </Card>
                ),
              },
              {
                key: "logs",
                label: (
                  <span className="flex items-center gap-2">
                    🧾 Delivery Note Logs
                  </span>
                ),
                children: (
                  <div className="mt-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                        <Card
                          className="rounded-xl"
                          styles={{ body: { padding: 16 } }}
                        >
                          <div className="text-gray-500 text-sm">
                            Total Delivery Notes
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
                        <Card
                          className="rounded-xl"
                          styles={{ body: { padding: 16 } }}
                        >
                          <div className="text-gray-500 text-sm">Latest DN</div>
                          <div className="text-2xl font-bold">{latestDn}</div>
                        </Card>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          icon={<ExportOutlined />}
                          onClick={() =>
                            message.success("Exporting DN logs...")
                          }
                        >
                          Export DN Logs
                        </Button>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => router.push("/dn-management")}
                        >
                          Create New DN
                        </Button>
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
                    // [packing-qty] Dihitung PER BARIS: qty_opname / quantity.
                    // quantity = rencana DN (batas), qty_opname = hasil stock opname.
                    render: (_: unknown, record: import("@/lib/api/inventory/api").DeliveryNoteItem) => {
                      const rowMax = Number(record?.quantity ?? subconTargetQty);
                      const rowCur = Number(
                        record?.qty_opname ?? record?.quantity ?? subconCurrentQty,
                      );
                      const rowPct =
                        rowMax > 0
                          ? Math.max(
                              0,
                              Math.min(100, Math.round((rowCur / rowMax) * 100)),
                            )
                          : subconProgress;
                      return (
                        <div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{ width: `${rowPct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {rowPct}% tercapai
                          </p>
                        </div>
                      );
                    },
                  },
                  {
                    title: "Qty saat ini",
                    key: "current_qty",
                    align: "right",
                    render: (_: unknown, record: import("@/lib/api/inventory/api").DeliveryNoteItem) =>
                      formatNumber(Number(record?.qty_opname ?? record?.quantity ?? subconCurrentQty)),
                  },
                  {
                    title: "Qty maksimal",
                    key: "target_qty",
                    align: "right",
                    render: (_: unknown, record: import("@/lib/api/inventory/api").DeliveryNoteItem) =>
                      formatNumber(Number(record?.quantity ?? subconTargetQty)),
                  },
                ]}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function SubConMaterialsDetailPage() {
  return (
    <Suspense fallback={null}>
      <SubConMaterialsDetailPageContent />
    </Suspense>
  );
}
