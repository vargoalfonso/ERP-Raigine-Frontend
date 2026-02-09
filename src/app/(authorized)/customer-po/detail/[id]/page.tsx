"use client";

import React, { useMemo } from "react";
import { Button, Card, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";

type DetailRow = {
  key: string;
  deliveryDate: string;
  uniq: string;
  partNumber: string;
  partName: string;
  model: string;
  totalQty: number;
};

type CustomerPoDetail = {
  poCreatedDate: string;
  poNumber: string;
  customer: string;
  contactPerson: string;
  deliveryAddress: string;
  totalQuantity: number;
  uom: string;
  deliveryCycle: "Daily" | "Weekly" | "Monthly";
  totalUniq: number;
  specialInstructions: string;
  rows: DetailRow[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function CustomerPoDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const id = useMemo(() => decodeURIComponent(params?.id ?? ""), [params?.id]);

  const detail = useMemo<CustomerPoDetail>(() => {
    // Mock details; expand as you add more clickable IDs.
    const base: CustomerPoDetail = {
      poCreatedDate: "10/01/2025",
      poNumber: id || "PO-TMC-2025-001",
      customer: "Toyota Motor Company",
      contactPerson: "Arifin Wijaya (+62 859 0001 0002)",
      deliveryAddress: "Cikarang Raya, No. 21",
      totalQuantity: 1000,
      uom: "250",
      deliveryCycle: "Daily",
      totalUniq: 8,
      specialInstructions: "-",
      rows: [
        {
          key: "r1",
          deliveryDate: "10/10/2025",
          uniq: "LV-001",
          partNumber: "SP-001-A",
          partName: "Steel Plate",
          model: "Camry 2024",
          totalQty: 120,
        },
        {
          key: "r2",
          deliveryDate: "10/12/2025",
          uniq: "LV-001",
          partNumber: "SP-001-B",
          partName: "Steel Plate X",
          model: "Camry 2024",
          totalQty: 120,
        },
        {
          key: "r3",
          deliveryDate: "10/16/2025",
          uniq: "LV-001",
          partNumber: "SP-001-C",
          partName: "Steel Plate Y",
          model: "Camry 2024",
          totalQty: 120,
        },
      ],
    };

    // Simple per-id variations
    if (id.startsWith("PO-FMC")) {
      return {
        ...base,
        poNumber: id,
        customer: "Ford Motor Company",
        contactPerson: "Kevin Hart (+1 415 222 1199)",
        deliveryAddress: "Dearborn, MI",
        deliveryCycle: "Daily",
      };
    }

    if (id.startsWith("PO-GM")) {
      return {
        ...base,
        poNumber: id,
        customer: "General Motors",
        contactPerson: "Sofia Gomez (+1 313 555 0102)",
        deliveryAddress: "Detroit, MI",
        deliveryCycle: "Weekly",
      };
    }

    return base;
  }, [id]);

  const columns = useMemo<ColumnsType<DetailRow>>(
    () => [
      { title: "Delivery Date", dataIndex: "deliveryDate", key: "deliveryDate", width: 140 },
      { title: "Uniq", dataIndex: "uniq", key: "uniq", width: 110 },
      {
        title: "Part Number",
        dataIndex: "partNumber",
        key: "partNumber",
        width: 170,
        render: (v: string) => (
          <Tag className="!rounded-lg !px-2 !py-0.5 !text-xs !text-gray-700" color="default">
            {v}
          </Tag>
        ),
      },
      { title: "Part Name", dataIndex: "partName", key: "partName" },
      {
        title: "Model",
        dataIndex: "model",
        key: "model",
        render: (v: string) => <span className="text-sm text-slate-500">{v}</span>,
      },
      {
        title: "Total Qty",
        dataIndex: "totalQty",
        key: "totalQty",
        align: "right",
        width: 110,
        render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
      },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          className="!rounded-lg"
          onClick={() => router.push("/customer-po")}
        >
          Back to Customer PO
        </Button>
        <div className="text-xl font-bold text-gray-900">Customer Purchase Order Details</div>
      </div>

      <Card
        className="!rounded-xl !border-gray-100 !shadow-sm"
        title={
          <div>
            <div className="text-lg font-bold text-gray-900">Details</div>
            <div className="text-xs text-gray-500">Complete Customer PO Information for {detail.poNumber}</div>
          </div>
        }
      >
        <Tabs
          items={[
            {
              key: "details",
              label: (
                <span className="text-sm font-semibold">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
                    Details
                  </span>
                </span>
              ),
              children: (
                <div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">PO Created Date</div>
                      <div className="text-sm text-gray-900 mt-1">{detail.poCreatedDate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">PO Number</div>
                      <div className="text-sm text-gray-900 mt-1">{detail.poNumber}</div>
                    </div>
                    <div />

                    <div>
                      <div className="text-xs text-gray-500">Customer</div>
                      <div className="text-sm text-gray-900 mt-1">{detail.customer}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Contact Person</div>
                      <div className="text-sm text-gray-900 mt-1">{detail.contactPerson}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Delivery Address</div>
                      <div className="text-sm text-gray-900 mt-1">{detail.deliveryAddress}</div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">Total Quantity</div>
                      <div className="text-sm text-gray-900 mt-1">{formatNumber(detail.totalQuantity)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Unit of Measurement</div>
                      <div className="text-sm text-gray-900 mt-1">{detail.uom}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Delivery Cycle</div>
                      <div className="text-sm text-gray-900 mt-1">
                        <Tag className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold !text-gray-700">
                          {detail.deliveryCycle}
                        </Tag>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">Total Uniq</div>
                      <div className="text-sm text-gray-900 mt-1">{detail.totalUniq}</div>
                    </div>
                    <div className="lg:col-span-2">
                      <div className="text-xs text-gray-500">Special Instructions</div>
                      <div className="text-sm text-gray-900 mt-1">{detail.specialInstructions}</div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-gray-100">
                    <Table<DetailRow>
                      dataSource={detail.rows}
                      columns={columns}
                      rowKey="key"
                      pagination={false}
                      size="middle"
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
