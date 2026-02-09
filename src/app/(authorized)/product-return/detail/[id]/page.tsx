"use client";

import React, { useMemo } from "react";
import { Button, Card, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";

type LineRow = {
  key: string;
  field: string;
  value: string;
};

export default function ProductReturnDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);

  const status = useMemo(() => {
    if (id === "RET-003") return "Rework Created";
    if (id === "RET-002") return "QC Approved";
    return "Pending QC";
  }, [id]);

  const summary = useMemo(
    () => ({
      returnId: id,
      date: id === "RET-004" ? "2024-12-16" : "2024-12-15",
      partNo: id === "RET-004" ? "PN-78901" : "PN-45678",
      partName: id === "RET-004" ? "Hydraulic Cylinder" : "Bearing Assembly",
      kanban: id === "RET-004" ? "KB-456789" : "KB-123456",
      scrapQty: id === "RET-004" ? "5 Pcs" : "25 Pcs",
      reworkQty: id === "RET-004" ? "3 Pcs" : "20 Pcs",
      submittedBy: id === "RET-004" ? "Sarah Williams" : "John Doe",
    }),
    [id]
  );

  const rows = useMemo<LineRow[]>(
    () => [
      { key: "1", field: "Return ID", value: summary.returnId },
      { key: "2", field: "Date", value: summary.date },
      { key: "3", field: "Part No", value: summary.partNo },
      { key: "4", field: "Part Name", value: summary.partName },
      { key: "5", field: "Kanban", value: summary.kanban },
      { key: "6", field: "Scrap Qty", value: summary.scrapQty },
      { key: "7", field: "Rework Qty", value: summary.reworkQty },
      { key: "8", field: "Submitted By", value: summary.submittedBy },
    ],
    [summary]
  );

  const columns = useMemo<ColumnsType<LineRow>>(
    () => [
      { title: "Field", dataIndex: "field", key: "field", width: 200 },
      { title: "Value", dataIndex: "value", key: "value" },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button className="!rounded-lg" icon={<ArrowLeftOutlined />} onClick={() => router.push("/product-return")}>
              Back
            </Button>
            <div>
              <div className="text-2xl font-bold text-gray-900">Product Return</div>
              <div className="text-sm text-gray-500 mt-1">Detail for {summary.returnId}</div>
            </div>
          </div>
        </div>
        <Tag
          color={status === "QC Approved" ? "green" : status === "Pending QC" ? "gold" : status === "Rework Created" ? "blue" : "red"}
          className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
        >
          {status}
        </Tag>
      </div>

      <Card className="!rounded-xl" bordered>
        <Table<LineRow> dataSource={rows} columns={columns} rowKey="key" pagination={false} size="middle" />
      </Card>
    </div>
  );
}
