"use client";

import { Suspense, useMemo, useState } from "react";
import { Button, InputNumber, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";

type ApproveRow = {
  key: string;
  poDnNumber: string;
  uniq: string;
  partNo: string;
  partName: string;
  model: string;
  totalOrder: number;
  totalDelivery: number;
};

const formatDateMMDDYYYY = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

export default function ApprovePartialDeliverySchedulePage() {
  return (
    <Suspense fallback={null}>
      <ApprovePartialDeliverySchedulePageContent />
    </Suspense>
  );
}

function ApprovePartialDeliverySchedulePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupKey = searchParams.get("group") ?? "2025-10-15";

  const headerInfo = useMemo(
    () => ({
      customer: "Toyota Motor Indonesia",
      deliverySchedule: formatDateMMDDYYYY(groupKey),
      cycle: "Daily",
    }),
    [groupKey]
  );

  const [rows, setRows] = useState<ApproveRow[]>([
    {
      key: "ap-1",
      poDnNumber: "DN-TMC-2025-001",
      uniq: "LV-001",
      partNo: "BRK-001-A",
      partName: "Bracket Assembly",
      model: "Avanza Model A",
      totalOrder: 100,
      totalDelivery: 100,
    },
    {
      key: "ap-2",
      poDnNumber: "DN-TMC-2025-001",
      uniq: "LV-001",
      partNo: "SA-001-A",
      partName: "Suspension Arm",
      model: "Avanza Model A",
      totalOrder: 100,
      totalDelivery: 50,
    },
    {
      key: "ap-3",
      poDnNumber: "DN-TMC-2025-001",
      uniq: "LV-001",
      partNo: "SA-001-A",
      partName: "Suspension Arm",
      model: "Avanza Model A",
      totalOrder: 100,
      totalDelivery: 50,
    },
  ]);

  const columns: ColumnsType<ApproveRow> = [
    {
      title: "PO/DN Number",
      dataIndex: "poDnNumber",
      key: "poDnNumber",
      width: 140,
      render: (v: string) => <a className="text-sm text-blue-600 hover:underline">{v}</a>,
    },
    { title: "Uniq", dataIndex: "uniq", key: "uniq", width: 110, render: (v: string) => <span className="text-sm text-gray-800">{v}</span> },
    { title: "Part No", dataIndex: "partNo", key: "partNo", width: 120, render: (v: string) => <span className="text-sm text-gray-800">{v}</span> },
    { title: "Part Name", dataIndex: "partName", key: "partName", width: 160, render: (v: string) => <span className="text-sm text-gray-800">{v}</span> },
    { title: "Model", dataIndex: "model", key: "model", width: 140, render: (v: string) => <span className="text-sm text-gray-800">{v}</span> },
    { title: "Total Order", dataIndex: "totalOrder", key: "totalOrder", width: 110, render: (v: number) => <span className="text-sm text-gray-800">{v}</span> },
    {
      title: (
        <div className="flex items-center gap-1">
          <span>Total Delivery</span>
          <InfoCircleOutlined className="text-gray-400" />
        </div>
      ),
      dataIndex: "totalDelivery",
      key: "totalDelivery",
      width: 150,
      render: (_: unknown, record) => (
        <InputNumber
          min={0}
          className="w-24 !rounded-lg"
          value={record.totalDelivery}
          onChange={(v) => {
            if (typeof v !== "number") return;
            setRows((prev) => prev.map((r) => (r.key === record.key ? { ...r, totalDelivery: v } : r)));
          }}
        />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
      fixed: "right",
      render: (_: unknown, record) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => message.info(`Edit row ${record.key} (mock)`)}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => setRows((prev) => prev.filter((r) => r.key !== record.key))}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => router.push("/delivery-scheduling")}
          >
            <ArrowLeftOutlined />
            <span>Back to Delivery Schedule</span>
          </button>

          <div className="flex items-center gap-2">
            <Button className="!rounded-lg" onClick={() => router.push("/delivery-scheduling")}>Cancel</Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<SaveOutlined />}
              onClick={() => {
                message.success("Saved delivery schedule (mock)");
                router.push("/delivery-scheduling");
              }}
            >
              Save Delivery Schedule
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">Approval Delivery Schedule</div>
          <div className="text-sm text-gray-500">Approve Delivery Schedule Partially  {rows.length} entry</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-gray-900">Approve Partial</div>
            <div className="text-sm text-gray-500">Add quantity for each uniq to approve partially</div>
          </div>
          <Tag color="blue" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">Required</Tag>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-xs font-semibold text-gray-500">Customer</div>
            <div className="text-sm text-gray-900 mt-1">{headerInfo.customer}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Delivery Schedule</div>
            <div className="text-sm text-gray-900 mt-1">{headerInfo.deliverySchedule}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500">Cycle</div>
            <div className="text-sm text-gray-900 mt-1">{headerInfo.cycle}</div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-gray-100">
          <Table<ApproveRow>
            columns={columns}
            dataSource={rows}
            rowKey="key"
            size="middle"
            pagination={false}
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>
    </div>
  );
}
