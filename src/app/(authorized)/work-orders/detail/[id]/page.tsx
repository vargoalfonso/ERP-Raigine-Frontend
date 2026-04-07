"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { useGetWorkOrderByIdQuery } from "@/lib/api/work-orders/api";

type DetailRow = {
  key: string;
  uniq: string;
  partName: string;
  partNumber: string;
  model: string;
  quantity: string;
  processName: string;
  status: string;
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US");
};

const normalizeStatusColor = (value?: string) => {
  const lower = String(value ?? "").toLowerCase();
  if (lower.includes("complete") || lower.includes("close")) return "green";
  if (lower.includes("progress") || lower.includes("process")) return "blue";
  if (lower.includes("reject")) return "red";
  return "default";
};

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const apiEnabled = Boolean(apiBaseUrl) && Boolean(id);

  const { data: workOrder, isFetching } = useGetWorkOrderByIdQuery(id ?? "", {
    skip: !apiEnabled,
  });
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !Boolean(apiBaseUrl),
  });

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data]
  );

  const detailRows = useMemo<DetailRow[]>(() => {
    return (workOrder?.items ?? []).map((item, index) => ({
      key: item.id || `${item.item_uniq_code}-${index}`,
      uniq: item.item_uniq_code,
      partName: item.part_name ?? bomIndex.partNameByUniq[item.item_uniq_code] ?? "-",
      partNumber: item.part_number ?? bomIndex.partNumberByUniq[item.item_uniq_code] ?? "-",
      model: item.model ?? bomIndex.assemblyCodeByUniq[item.item_uniq_code] ?? "-",
      quantity: `${item.quantity} ${item.uom || "pcs"}`,
      processName: item.process_name || "-",
      status: item.status || "Pending",
    }));
  }, [bomIndex, workOrder?.items]);

  const columns: ColumnsType<DetailRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      render: (value: string) => <span className="font-semibold text-gray-900">{value}</span>,
    },
    { title: "Part Name", dataIndex: "partName", key: "partName" },
    { title: "Part Number", dataIndex: "partNumber", key: "partNumber" },
    { title: "Model", dataIndex: "model", key: "model" },
    { title: "Quantity", dataIndex: "quantity", key: "quantity" },
    { title: "Process", dataIndex: "processName", key: "processName" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value: string) => (
        <Tag color={normalizeStatusColor(value)} className="!rounded-md">
          {value}
        </Tag>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => router.push("/work-orders")}
          >
            <ArrowLeftOutlined />
            <span>Back to Work Orders</span>
          </button>

          <Button className="!rounded-lg" onClick={() => router.push("/work-orders")}>
            Close
          </Button>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">Work Order Detail</div>
          <div className="text-sm text-gray-500">
            Detail data loaded from /api/work-order/{id ?? "..."}
          </div>
        </div>
      </div>

      <Spin spinning={isFetching}>
        <div className="space-y-6">
          <Card className="rounded-xl border border-gray-100 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-500">WO Number</div>
                <div className="font-semibold text-gray-900 mt-1">{workOrder?.wo_number || "-"}</div>
              </div>
              <div>
                <div className="text-gray-500">WO Type</div>
                <div className="font-semibold text-gray-900 mt-1">{workOrder?.wo_type || "-"}</div>
              </div>
              <div>
                <div className="text-gray-500">Status</div>
                <div className="mt-1">
                  <Tag color={normalizeStatusColor(workOrder?.status)} className="!rounded-md">
                    {workOrder?.status || "Pending"}
                  </Tag>
                </div>
              </div>
              <div>
                <div className="text-gray-500">Approval Status</div>
                <div className="mt-1">
                  <Tag color={normalizeStatusColor(workOrder?.approval_status)} className="!rounded-md">
                    {workOrder?.approval_status || "Pending Approval"}
                  </Tag>
                </div>
              </div>
              <div>
                <div className="text-gray-500">Created Date</div>
                <div className="font-semibold text-gray-900 mt-1">{formatDate(workOrder?.created_at)}</div>
              </div>
              <div>
                <div className="text-gray-500">Target Date</div>
                <div className="font-semibold text-gray-900 mt-1">{formatDate(workOrder?.target_date)}</div>
              </div>
              <div>
                <div className="text-gray-500">Operator</div>
                <div className="font-semibold text-gray-900 mt-1">{workOrder?.operator_name || "Not Assigned"}</div>
              </div>
              <div>
                <div className="text-gray-500">Total UNIQ</div>
                <div className="font-semibold text-gray-900 mt-1">{workOrder?.uniq_total ?? detailRows.length}</div>
              </div>
              <div>
                <div className="text-gray-500">Closed UNIQ</div>
                <div className="font-semibold text-gray-900 mt-1">
                  {workOrder?.uniq_closed ?? detailRows.filter((item) => item.status.toLowerCase().includes("close")).length}
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-xl border border-gray-100 shadow-sm">
            <div className="text-sm font-semibold text-gray-900 mb-4">Work Order Items</div>
            <Table<DetailRow>
              columns={columns}
              dataSource={detailRows}
              rowKey="key"
              pagination={false}
              scroll={{ x: "max-content" }}
            />
          </Card>
        </div>
      </Spin>
    </div>
  );
}