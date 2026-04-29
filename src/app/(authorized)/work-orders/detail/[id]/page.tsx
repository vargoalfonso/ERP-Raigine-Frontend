"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { Button, Card, Input, Spin, Table, Tag, message, Progress } from "antd";
import type { ColumnsType } from "antd/es/table";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { formatWorkOrderDisplayNumber } from "@/lib/utils/workOrder";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useApproveWorkOrderMutation,
  useGetWorkOrderByIdQuery,
} from "@/lib/api/work-orders/api";

type DetailRow = {
  key: string;
  uniq: string;
  partName: string;
  partNumber: string;
  model: string;
  quantity: string;
  processName: string;
  status: string;
  kanbanNumber: string;
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
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const apiEnabled = Boolean(apiBaseUrl) && Boolean(id);
  const autoPrintedRef = useRef(false);

  const { TextArea } = Input;
  const [approvalNote, setApprovalNote] = useState("");
  const [approveWorkOrder, approveState] = useApproveWorkOrderMutation();

  const { data: workOrder, isFetching } = useGetWorkOrderByIdQuery(id ?? "", {
    skip: !apiEnabled,
  });
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !Boolean(apiBaseUrl),
  });

  const [frontAging, setFrontAging] = useState<number | null>(null);

  useEffect(() => {
    if (workOrder?.aging_days != null) {
      setFrontAging(Number(workOrder.aging_days));
    }
  }, [workOrder?.aging_days]);

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
      kanbanNumber: item.kanban_number ?? "-",
    }));
  }, [bomIndex, workOrder?.items]);

  const totalUniq = workOrder?.uniq_total ?? detailRows.length;
  const completedCount = useMemo(
    () =>
      detailRows.filter((item) => {
        const s = String(item.status ?? "").toLowerCase();
        return s.includes("complete") || s.includes("close") || s.includes("finished");
      }).length,
    [detailRows]
  );

  const percentComplete = totalUniq ? Math.round((completedCount / Number(totalUniq)) * 100) : 0;

  const escapePrint = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const printDetail = () => {
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) {
      message.error("Unable to open print window");
      return;
    }

    const printedWoNumber = String(formatWorkOrderDisplayNumber(workOrder?.wo_number) || workOrder?.wo_number || "Work Order")
      .replace(/\(mock\)/gi, "")
      .trim();

    const rowsHtml = detailRows
      .map(
        (row) => `
          <tr>
            <td>${escapePrint(row.uniq)}</td>
            <td>${escapePrint(row.kanbanNumber)}</td>
            <td>${escapePrint(row.quantity)}</td>
            <td>${escapePrint(row.processName)}</td>
            <td>${escapePrint(row.status)}</td>
          </tr>`
      )
      .join("");

    win.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapePrint(printedWoNumber)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .header { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; }
            .title { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
            .meta { font-size: 13px; margin-bottom: 4px; color: #374151; }
            .summary { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 24px; margin-top: 20px; }
            .summary div { font-size: 13px; }
            .label { color:#6b7280; }
            table { width:100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border:1px solid #e5e7eb; padding: 8px; text-align:left; font-size: 12px; }
            th { background:#f3f4f6; }
            img.qr { max-width: 140px; border: 1px solid #e5e7eb; padding: 6px; }
            @media print { .no-print { display:none; } body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">${escapePrint(printedWoNumber)}</div>
              <div class="meta">Type: ${escapePrint(String(workOrder?.wo_type || "-"))}</div>
              <div class="meta">Status: ${escapePrint(String(workOrder?.status || "-"))}</div>
              <div class="meta">Approval: ${escapePrint(String(workOrder?.approval_status || "Pending Approval"))}</div>
            </div>
            ${workOrder?.qr_data_url ? `<img src="${escapePrint(workOrder.qr_data_url)}" class="qr" alt="WO QR" />` : ""}
          </div>
          <div class="summary">
            <div><span class="label">Created Date:</span> ${escapePrint(formatDate(workOrder?.created_date ?? workOrder?.created_at))}</div>
            <div><span class="label">Target Date:</span> ${escapePrint(formatDate(workOrder?.target_date))}</div>
            <div><span class="label">Operator:</span> ${escapePrint(String(workOrder?.operator_name || "Not Assigned"))}</div>
            <div><span class="label">Aging:</span> ${escapePrint(frontAging != null ? `${frontAging} days` : workOrder?.aging_days != null ? `${workOrder.aging_days} days` : "-")}</div>
            <div><span class="label">Total UNIQ:</span> ${escapePrint(String(workOrder?.uniq_total ?? detailRows.length))}</div>
            <div><span class="label">Closed UNIQ:</span> ${escapePrint(String(workOrder?.uniq_closed ?? detailRows.filter((item) => item.status.toLowerCase().includes("close")).length))}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>UNIQ</th>
                <th>Kanban</th>
                <th>Quantity</th>
                <th>Process</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="no-print" style="margin-top:16px;">
            <button onclick="window.print()">Print / Save as PDF</button>
          </div>
        </body>
      </html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  useEffect(() => {
    if (searchParams.get("autoPrint") !== "1") return;
    if (!workOrder || autoPrintedRef.current) return;
    autoPrintedRef.current = true;
    const timer = window.setTimeout(() => printDetail(), 300);
    return () => window.clearTimeout(timer);
  }, [searchParams, workOrder]);

  const columns: ColumnsType<DetailRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      render: (value: string) => <span className="font-semibold text-gray-900">{value}</span>,
    },
    { title: "Kanban", dataIndex: "kanbanNumber", key: "kanbanNumber" },
    // { title: "Part Name", dataIndex: "partName", key: "partName" },
    // { title: "Part Number", dataIndex: "partNumber", key: "partNumber" },
    // { title: "Model", dataIndex: "model", key: "model" },
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

          <div className="flex items-center gap-2">
            <Button icon={<PrinterOutlined />} className="!rounded-lg" onClick={printDetail}>
              Print
            </Button>
            <Button className="!rounded-lg" onClick={() => router.push("/work-orders")}>
              Close
            </Button>
            <Button
              danger
              className="!rounded-lg"
              loading={approveState.isLoading}
              disabled={!apiEnabled}
              onClick={async () => {
                if (!id) return;
                try {
                  await approveWorkOrder({
                    uuid: id,
                    body: { decision: "reject", notes: approvalNote.trim() ? approvalNote.trim() : null },
                  }).unwrap();
                  message.success("Rejected");
                } catch (err) {
                  message.error(getApiErrorMessage(err, "Failed to reject"));
                }
              }}
            >
              Reject
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              loading={approveState.isLoading}
              disabled={!apiEnabled}
              onClick={async () => {
                if (!id) return;
                try {
                  await approveWorkOrder({
                    uuid: id,
                    body: { decision: "approve", notes: approvalNote.trim() ? approvalNote.trim() : null },
                  }).unwrap();
                  message.success("Approved");
                } catch (err) {
                  message.error(getApiErrorMessage(err, "Failed to approve"));
                }
              }}
            >
              Approve
            </Button>
          </div>
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
                <div className="font-semibold text-gray-900 mt-1">
                  {formatWorkOrderDisplayNumber(workOrder?.wo_number) || "-"}
                </div>
              </div>
              <div>
                <div className="text-gray-500">WO Type</div>
                <div className="font-semibold text-gray-900 mt-1">{workOrder?.wo_type || "-"}</div>
              </div>
              <div>
                {/* <div className="text-gray-500">Reference WO</div>
                <div className="font-semibold text-gray-900 mt-1">
                  {formatWorkOrderDisplayNumber(workOrder?.reference_wo) || "-"}
                </div> */}
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
                <div className="font-semibold text-gray-900 mt-1">{formatDate(workOrder?.created_date ?? workOrder?.created_at)}</div>
              </div>
              <div>
                <div className="text-gray-500">Target Date</div>
                <div className="font-semibold text-gray-900 mt-1">{formatDate(workOrder?.target_date)}</div>
              </div>
              <div>
                  <div className="text-gray-500">Aging</div>
                  <div className="mt-1 flex items-center gap-3">
                    <Tag color={normalizeStatusColor(String(frontAging ?? workOrder?.aging_days))} className="!rounded-md">
                      {frontAging != null ? `${frontAging} days` : workOrder?.aging_days != null ? `${workOrder.aging_days} days` : "- days"}
                    </Tag>
                    
                  </div>
              </div>
              <div>
                <div className="text-gray-500">Operator</div>
                <div className="font-semibold text-gray-900 mt-1">{workOrder?.operator_name || "Not Assigned"}</div>
              </div>
              {/* <div>
                <div className="text-gray-500">Created By</div>
                <div className="font-semibold text-gray-900 mt-1">{workOrder?.created_by_name || "-"}</div>
              </div> */}
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

            <div className="mt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="text-xs text-gray-500">Completion</div>
                  <div className="mt-2">
                    <Progress percent={percentComplete} status={percentComplete >= 100 ? "success" : "active"} />
                  </div>
                </div>
               
              </div>
            </div>

            {/* {workOrder?.notes ? (
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <div className="text-xs font-semibold text-gray-600">Notes</div>
                <div className="mt-1 whitespace-pre-wrap">{workOrder.notes}</div>
              </div>
            ) : null} */}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs font-semibold text-gray-700">Approval Note</div>
                <TextArea
                  className="!rounded-lg mt-2"
                  rows={3}
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="OK"
                />
                {!apiEnabled ? (
                  <div className="mt-2 text-xs text-gray-400">Approval disabled when API URL is not set</div>
                ) : null}
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs font-semibold text-gray-700">WO QR</div>
                {workOrder?.qr_data_url ? (
                  <img
                    src={workOrder.qr_data_url}
                    alt="WO QR"
                    className="mt-2 max-w-[220px] rounded-lg border border-gray-100"
                  />
                ) : (
                  <div className="mt-2 text-xs text-gray-400">No QR data</div>
                )}
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