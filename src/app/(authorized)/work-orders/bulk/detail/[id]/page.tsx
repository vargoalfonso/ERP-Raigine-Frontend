"use client";

import { Button, Card, Tag } from "antd";
import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const valueOrDash = (value: string | null) => value?.trim() || "-";

export default function BulkWorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const autoPrintedRef = useRef(false);

  const detail = {
    id: Array.isArray(params?.id) ? params.id[0] : params?.id ?? "",
    woNumber: valueOrDash(searchParams.get("woNumber")),
    sourceDocumentType: valueOrDash(searchParams.get("sourceDocumentType")),
    sourceDocumentId: valueOrDash(searchParams.get("sourceDocumentId")),
    woType: valueOrDash(searchParams.get("woType")),
    status: valueOrDash(searchParams.get("status")),
    approvalStatus: valueOrDash(searchParams.get("approvalStatus")),
    createdDate: valueOrDash(searchParams.get("createdDate")),
    targetDate: valueOrDash(searchParams.get("targetDate")),
    totalItems: valueOrDash(searchParams.get("totalItems")),
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
          <div className="text-2xl font-bold text-gray-900">Bulk Work Order Detail</div>
          <div className="text-sm text-gray-500">Detail data from bulk-generated work order selection</div>
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
              <div className="text-gray-500">WO Type</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.woType}</div>
            </div>
            <div>
              <div className="text-gray-500">Status</div>
              <div className="mt-1">
                <Tag color="blue" className="!rounded-md">{detail.status}</Tag>
              </div>
            </div>
            <div>
              <div className="text-gray-500">Approval Status</div>
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
              <div className="text-gray-500">Target Date</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.targetDate}</div>
            </div>
            <div>
              <div className="text-gray-500">Source Type</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.sourceDocumentType}</div>
            </div>
            <div>
              <div className="text-gray-500">Source Document</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.sourceDocumentId}</div>
            </div>
            <div>
              <div className="text-gray-500">Total Items</div>
              <div className="font-semibold text-gray-900 mt-1">{detail.totalItems}</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
