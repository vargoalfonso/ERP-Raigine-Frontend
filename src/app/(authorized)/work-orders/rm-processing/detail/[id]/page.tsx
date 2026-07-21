"use client";

import { Button, Card, QRCode, Tag } from "antd";
import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const valueOrDash = (value: string | null) => value?.trim() || "-";

export default function RmProcessingDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const autoPrintedRef = useRef(false);

  const detail = {
    id: Array.isArray(params?.id) ? params.id[0] : params?.id ?? "",
    woNumber: valueOrDash(searchParams.get("woNumber")),
    approvalStatus: valueOrDash(searchParams.get("approvalStatus")),
    createdDate: valueOrDash(searchParams.get("createdDate")),
    createdByName: valueOrDash(searchParams.get("createdByName")),
    sourceMaterialUniq: valueOrDash(searchParams.get("sourceMaterialUniq")),
    targetMaterialUniq: valueOrDash(searchParams.get("targetMaterialUniq")),
    model: valueOrDash(searchParams.get("model")),
    gradeSize: valueOrDash(searchParams.get("gradeSize")),
    inputQty: valueOrDash(searchParams.get("inputQty")),
    inputUom: valueOrDash(searchParams.get("inputUom")),
    outputQty: valueOrDash(searchParams.get("outputQty")),
    outputUom: valueOrDash(searchParams.get("outputUom")),
    dateIssued: valueOrDash(searchParams.get("dateIssued")),
    remarks: valueOrDash(searchParams.get("remarks")),
    status: valueOrDash(searchParams.get("status")),
    agingDays: valueOrDash(searchParams.get("agingDays")),
  };

  useEffect(() => {
    if (searchParams.get("autoPrint") !== "1" || autoPrintedRef.current === true) return;
    autoPrintedRef.current = true;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 print:bg-white print:p-0">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 print:hidden">
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
            <Button icon={<PrinterOutlined />} className="!rounded-lg" onClick={() => window.print()}>
              Print
            </Button>
            <Button className="!rounded-lg" onClick={() => router.push("/work-orders")}>
              Close
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">RM Processing Detail</div>
          <div className="text-sm text-gray-500">Detail data from raw material processing work order selection</div>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="rounded-xl border border-gray-100 shadow-sm print:border-0 print:shadow-none">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500">WO Number</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.woNumber}</div>
            </div>
            <div>
              <div className="text-gray-500">Status</div>
              <div className="mt-1"><Tag color="blue" className="!rounded-md">{detail.status}</Tag></div>
            </div>
            <div>
              <div className="text-gray-500">Approval</div>
              <div className="mt-1">
                <Tag color={detail.approvalStatus.toLowerCase().includes("approve") ? "green" : detail.approvalStatus.toLowerCase().includes("reject") ? "red" : "gold"} className="!rounded-md">
                  {detail.approvalStatus}
                </Tag>
              </div>
            </div>
            <div>
              <div className="text-gray-500">Created Date</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.createdDate}</div>
            </div>
            <div>
              <div className="text-gray-500">Created By</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.createdByName}</div>
            </div>
            <div>
              <div className="text-gray-500">Aging</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.agingDays}</div>
            </div>
            <div>
              <div className="text-gray-500">Source UNIQ</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.sourceMaterialUniq}</div>
            </div>
            <div>
              <div className="text-gray-500">Target UNIQ</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.targetMaterialUniq}</div>
            </div>
            <div>
              <div className="text-gray-500">Date Issued</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.dateIssued}</div>
            </div>
            <div>
              <div className="text-gray-500">Model</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.model}</div>
            </div>
            <div>
              <div className="text-gray-500">Grade / Size</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.gradeSize}</div>
            </div>
            <div>
              <div className="text-gray-500">Input / Output</div>
              <div className="font-semibold text-gray-900 mt-1">{`${detail.inputQty} ${detail.inputUom} → ${detail.outputQty} ${detail.outputUom}`}</div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <div className="text-xs font-semibold text-gray-600">Remarks</div>
            <div className="mt-1 whitespace-pre-wrap">{detail.remarks}</div>
          </div>
        </Card>

        <Card className="rounded-xl border border-gray-100 shadow-sm print:border-0 print:shadow-none">
          <div className="text-sm font-semibold text-gray-900 mb-3">QR / Kanban</div>
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-lg border border-gray-200 p-3 bg-white">
              <QRCode
                value={JSON.stringify({ t: "wo", wo: detail.woNumber })}
                size={200}
                bordered={false}
              />
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-900">{detail.woNumber}</div>
              <div className="text-xs text-gray-500">{detail.model} · {detail.gradeSize}</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
