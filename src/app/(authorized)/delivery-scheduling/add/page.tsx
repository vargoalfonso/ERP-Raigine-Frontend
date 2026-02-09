"use client";

import { useMemo, useState } from "react";
import { Button, InputNumber, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";

type ReviewRow = {
  key: string;
  uniq: string;
  partNo: string;
  partName: string;
  model: string;
  totalOrder: number;
  totalDelivery: number;
};

type DnRef = {
  value: string;
  label: string;
  customer: string;
  deliverySchedule: string;
  cycle: string;
  rows: ReviewRow[];
};

export default function AddNewDeliverySchedulePage() {
  const router = useRouter();

  const dnRefs: DnRef[] = useMemo(
    () => [
      {
        value: "DN-TMC-2025-001",
        label: "DN-TMC-2025-001",
        customer: "Toyota Motor Indonesia",
        deliverySchedule: "10/10/2025",
        cycle: "Daily",
        rows: [
          {
            key: "r-1",
            uniq: "LV-001",
            partNo: "BRK-001-A",
            partName: "Bracket Assembly",
            model: "Avanza Model A",
            totalOrder: 100,
            totalDelivery: 50,
          },
          {
            key: "r-2",
            uniq: "LV-001",
            partNo: "SA-001-A",
            partName: "Suspension Arm",
            model: "Avanza Model A",
            totalOrder: 100,
            totalDelivery: 50,
          },
          {
            key: "r-3",
            uniq: "LV-001",
            partNo: "SA-001-A",
            partName: "Suspension Arm",
            model: "Avanza Model A",
            totalOrder: 100,
            totalDelivery: 50,
          },
        ],
      },
    ],
    []
  );

  const customerOptions = useMemo(
    () => [{ label: "Select Customer", value: "" }, ...Array.from(new Set(dnRefs.map((d) => d.customer))).map((c) => ({ label: c, value: c }))],
    [dnRefs]
  );

  const dnRefOptions = useMemo(() => [{ label: "Select DN Number", value: "" }, ...dnRefs.map((d) => ({ label: d.label, value: d.value }))], [dnRefs]);

  const [dnReference, setDnReference] = useState<string>(dnRefs[0]?.value ?? "");
  const selectedRef = useMemo(() => dnRefs.find((d) => d.value === dnReference) ?? null, [dnRefs, dnReference]);

  const [customer, setCustomer] = useState<string>(selectedRef?.customer ?? "");

  const [rows, setRows] = useState<ReviewRow[]>(selectedRef?.rows ?? []);

  // Keep dependent state in sync when DN reference changes
  const syncFromRef = (refValue: string) => {
    setDnReference(refValue);
    const ref = dnRefs.find((d) => d.value === refValue) ?? null;
    setCustomer(ref?.customer ?? "");
    setRows(ref?.rows ?? []);
  };

  const columns: ColumnsType<ReviewRow> = [
    { title: "Uniq", dataIndex: "uniq", key: "uniq", width: 120, render: (v: string) => <span className="text-sm text-gray-800">{v}</span> },
    { title: "Part No", dataIndex: "partNo", key: "partNo", width: 140, render: (v: string) => <span className="text-sm text-gray-800">{v}</span> },
    { title: "Part Name", dataIndex: "partName", key: "partName", width: 180, render: (v: string) => <span className="text-sm text-gray-800">{v}</span> },
    { title: "Model", dataIndex: "model", key: "model", width: 160, render: (v: string) => <span className="text-sm text-gray-800">{v}</span> },
    { title: "Total Order", dataIndex: "totalOrder", key: "totalOrder", width: 120, render: (v: number) => <span className="text-sm text-gray-800">{v}</span> },
    {
      title: (
        <div className="flex items-center gap-1">
          <span>Total Delivery</span>
          <InfoCircleOutlined className="text-gray-400" />
        </div>
      ),
      dataIndex: "totalDelivery",
      key: "totalDelivery",
      width: 160,
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
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => message.info(`Edit ${record.partNo} (mock)`)} />
          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setRows((prev) => prev.filter((r) => r.key !== record.key))} />
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
          <div className="text-2xl font-bold text-gray-900">Add New Delivery Schedule</div>
          <div className="text-sm text-gray-500">Create DN for incoming raw material receipt and tracking  1 entry</div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-gray-900">Step 1: Input Delivery Date</div>
              <div className="text-sm text-gray-500">Select Delivery Note Number as Reference</div>
            </div>
            <Tag color="blue" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">Required</Tag>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <div className="w-28 text-sm text-gray-600">DN Reference</div>
              <Select
                value={dnReference}
                onChange={(v) => syncFromRef(v)}
                options={dnRefOptions}
                className="!rounded-lg"
                style={{ width: 260 }}
              />
            </div>
            <div className="flex items-center gap-4 md:justify-end">
              <div className="w-28 text-sm text-gray-600">Customer</div>
              <Select
                value={customer}
                onChange={(v) => setCustomer(v)}
                options={customerOptions}
                className="!rounded-lg"
                style={{ width: 260 }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-gray-900">Step 2: Review Items</div>
              <div className="text-sm text-gray-500">Review Items for Delivery</div>
            </div>
            <Tag color="blue" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">Required</Tag>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-xs font-semibold text-gray-500">Customer</div>
              <div className="text-sm text-gray-900 mt-1">{selectedRef?.customer ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">Delivery Schedule</div>
              <div className="text-sm text-gray-900 mt-1">{selectedRef?.deliverySchedule ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">Cycle</div>
              <div className="text-sm text-gray-900 mt-1">{selectedRef?.cycle ?? "-"}</div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-gray-100">
            <Table<ReviewRow>
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
    </div>
  );
}
