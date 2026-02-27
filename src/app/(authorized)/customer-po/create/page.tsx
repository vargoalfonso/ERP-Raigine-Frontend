"use client";

import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import { useRouter } from "next/navigation";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";

type OrderType = "dn" | "po" | "so";

type EntryRow = {
  key: string;
  uniq: string;
  partNumber: string;
  partName: string;
  model: string;
  qty: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function customerCode(customerName: string) {
  const upper = customerName.toUpperCase();
  if (upper.includes("TOYOTA")) return "TMC";
  if (upper.includes("HONDA")) return "HM";
  if (upper.includes("NISSAN")) return "NG";
  return "CUST";
}

function requiredPill() {
  return (
    <Tag color="blue" className="!rounded-full !text-xs !px-3 !py-0.5">
      Required
    </Tag>
  );
}

export default function CreateCustomerOrderPage() {
  const router = useRouter();
  const [form] = Form.useForm();

  const [orderType, setOrderType] = useState<OrderType>("dn");
  const [deliveryDate, setDeliveryDate] = useState<Dayjs | null>(null);

  const [entryUniq, setEntryUniq] = useState<string | undefined>(undefined);
  const [entryQty, setEntryQty] = useState<number | null>(null);

  const [rows, setRows] = useState<EntryRow[]>([
    {
      key: "row-1",
      uniq: "LV-001",
      partNumber: "SP-001-A",
      partName: "Steel Plate",
      model: "Camry 2024",
      qty: 120,
    },
    {
      key: "row-2",
      uniq: "LV-001",
      partNumber: "SP-001-B",
      partName: "Steel Plate X",
      model: "Camry 2024",
      qty: 120,
    },
    {
      key: "row-3",
      uniq: "LV-001",
      partNumber: "SP-001-C",
      partName: "Steel Plate Y",
      model: "Camry 2024",
      qty: 120,
    },
  ]);

  const customerOptions = useMemo(
    () => [
      { label: "Toyota Motor Company", value: "Toyota Motor Company" },
      { label: "Honda Motor", value: "Honda Motor" },
      { label: "Nissan Global", value: "Nissan Global" },
    ],
    []
  );

  const uniqOptions = useMemo(
    () => [
      { label: "LV-001", value: "LV-001" },
      { label: "LV-002", value: "LV-002" },
      { label: "LV-003", value: "LV-003" },
      { label: "LV-004", value: "LV-004" },
    ],
    []
  );

  const partCatalog = useMemo(
    () => [
      { partNumber: "SP-001-A", partName: "Steel Plate", model: "Camry 2024" },
      { partNumber: "SP-001-B", partName: "Steel Plate X", model: "Camry 2024" },
      { partNumber: "SP-001-C", partName: "Steel Plate Y", model: "Camry 2024" },
      { partNumber: "AL-210-A", partName: "Aluminum Bracket", model: "Civic 2024" },
      { partNumber: "RB-110-Q", partName: "Rubber Bushing", model: "X-Trail 2024" },
    ],
    []
  );

  const customerName = Form.useWatch("customerName", form) as string | undefined;

  const orderNumber = useMemo(() => {
    const code = customerCode(customerName ?? "");
    const year = 2024;
    if (orderType === "dn") return `DN-${code}-${year}-001`;
    if (orderType === "po") return `PO-${code}-${year}-001`;
    return `SO-${code}-${year}-001`;
  }, [customerName, orderType]);

  const summary = useMemo(() => {
    const totalQty = rows.reduce((acc, r) => acc + (r.qty ?? 0), 0);
    const uniqSet = new Set(rows.map((r) => r.uniq));
    return {
      totalQty,
      uniqCount: uniqSet.size,
    };
  }, [rows]);

  const actionLabel = orderType === "dn" ? "Create DN" : orderType === "po" ? "Create PO" : "Create SO";
  const orderNumberLabel = orderType === "dn" ? "DN Number" : orderType === "po" ? "PO Number" : "SO Number";

  const columns = useMemo<ColumnsType<EntryRow>>(
    () => [
      { title: "Uniq", dataIndex: "uniq", key: "uniq", width: 110 },
      {
        title: "Part Number",
        dataIndex: "partNumber",
        key: "partNumber",
        render: (v: string) => (
          <Tag className="!rounded-lg !px-2 !py-0.5 !text-xs !text-gray-700" color="default">
            {v}
          </Tag>
        ),
      },
      { title: "Part Name", dataIndex: "partName", key: "partName" },
      { title: "Model", dataIndex: "model", key: "model" },
      {
        title: "Total Qty",
        dataIndex: "qty",
        key: "qty",
        align: "right",
        width: 110,
        render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
      },
      {
        title: "Actions",
        key: "actions",
        align: "center",
        width: 90,
        render: (_, r) => (
          <Popconfirm
            title="Delete this row?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
            onConfirm={() => {
              setRows((prev) => prev.filter((x) => x.key !== r.key));
              message.success("Row deleted");
            }}
          >
            <Button danger type="text" icon={<DeleteOutlined />} />
          </Popconfirm>
        ),
      },
    ],
    []
  );

  function onAddEntry() {
    if (!entryUniq) {
      message.warning("Select Uniq first");
      return;
    }
    if (!entryQty || entryQty <= 0) {
      message.warning("Input Quantity first");
      return;
    }

    const pick = partCatalog[Math.floor(Math.random() * partCatalog.length)];
    const newRow: EntryRow = {
      key: `row-${Date.now()}`,
      uniq: entryUniq,
      partNumber: pick.partNumber,
      partName: pick.partName,
      model: pick.model,
      qty: Math.min(999999, Math.round(entryQty)),
    };

    setRows((prev) => [newRow, ...prev]);
    setEntryUniq(undefined);
    setEntryQty(null);
  }

  async function onCreateOrder() {
    try {
      const values = await form.validateFields();
      if (!deliveryDate) {
        message.warning("Delivery Date is required");
        return;
      }
      if (rows.length === 0) {
        message.warning("Add at least one entry");
        return;
      }

      message.success(`Created ${orderType.toUpperCase()} for ${values.customerName}`);
      router.push("/customer-po");
    } catch {
      // Form will highlight missing fields
    }
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          onClick={() => router.push("/customer-po")}
        >
          <ArrowLeftOutlined />
          Back to Customer Orders
        </button>

        <div className="flex items-center gap-2">
          <Button className="!rounded-lg" onClick={() => router.push("/customer-po")}
          >
            Cancel
          </Button>
          <Button type="primary" className="!rounded-lg" onClick={onCreateOrder}
          >
            Create Order
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900">Create New Customer Order</h1>
          <p className="text-sm text-gray-500">Create Purchase Orders, Delivery Notes, or Special Orders</p>
        </div>
      </div>

      <Form form={form} layout="vertical" requiredMark={false}>
        {/* Step 1 */}
        <Card
          className="!rounded-xl !border-gray-100 !shadow-sm"
          title={
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Step 1: Select Order Type</div>
                <div className="text-xs text-gray-500">Select the type of customer order to create</div>
              </div>
              {requiredPill()}
            </div>
          }
        >
          <Form.Item label="Order Type" name="orderType" initialValue={"dn"} rules={[{ required: true }]}>
            <Select
              className="max-w-[420px]"
              value={orderType}
              onChange={(v: OrderType) => setOrderType(v)}
              options={[
                { label: "Delivery Note (DN)", value: "dn" },
                { label: "Purchase Order (PO)", value: "po" },
                { label: "Special Order (SO)", value: "so" },
              ]}
            />
          </Form.Item>
        </Card>

        <div className="h-4" />

        {/* Step 2 */}
        <Card
          className="!rounded-xl !border-gray-100 !shadow-sm"
          title={
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Step 2: Customer & Order Information</div>
                <div className="text-xs text-gray-500">Configure customer details and order information</div>
              </div>
              {requiredPill()}
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Form.Item label="Customer Name" name="customerName" rules={[{ required: true, message: "Select Customer" }]}
            >
              <Select placeholder="Select Customer" options={customerOptions} />
            </Form.Item>

            <Form.Item label="Contact Person" name="contactPerson" rules={[{ required: true, message: "Input Contact Person" }]}
            >
              <Input placeholder="Input Contact Person" />
            </Form.Item>

            <Form.Item label="Delivery Date" required>
              <DatePicker
                className="w-full"
                placeholder="dd/mm/yyyy"
                value={deliveryDate}
                onChange={(v) => setDeliveryDate(v)}
                format="DD/MM/YYYY"
              />
            </Form.Item>

            <Form.Item label="Delivery Address" name="deliveryAddress" rules={[{ required: true, message: "Input Delivery Address" }]}
            >
              <Input placeholder="Input Delivery Address" />
            </Form.Item>

            <Form.Item label="Special Instructions" name="specialInstructions" className="lg:col-span-2">
              <Input.TextArea
                placeholder="Enter any special handling or delivery requirements"
                rows={4}
              />
            </Form.Item>
          </div>
        </Card>

        <div className="h-4" />

        {/* Step 3 */}
        <Card
          className="!rounded-xl !border-gray-100 !shadow-sm"
          title={
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Step 3: Input Data</div>
                <div className="text-xs text-gray-500">Configure order detail specifications</div>
              </div>
              <Tag className="!rounded-full !text-xs !px-3 !py-0.5">Entry 1</Tag>
            </div>
          }
        >
          <div className="flex flex-col xl:flex-row xl:items-end gap-3 mb-4">
            <div className="w-full xl:w-[260px]">
              <div className="text-xs text-gray-500 mb-1">Uniq</div>
              <Select
                placeholder="Select Uniq"
                value={entryUniq}
                onChange={(v) => setEntryUniq(v)}
                options={uniqOptions}
              />
            </div>

            <div className="w-full xl:w-[260px]">
              <div className="text-xs text-gray-500 mb-1">Quantity</div>
              <InputNumber
                className="w-full"
                placeholder="Input Quantity"
                value={entryQty}
                min={1}
                onChange={(v) => setEntryQty(typeof v === "number" ? v : null)}
              />
            </div>

            <Button
              type="primary"
              className="!rounded-lg xl:ml-2"
              icon={<PlusOutlined />}
              onClick={onAddEntry}
            >
              {actionLabel}
            </Button>
          </div>

          <div className="text-base font-bold text-gray-900 mb-3">{orderNumber}</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">Total Qty</div>
              <div className="text-lg font-bold text-gray-900">{formatNumber(summary.totalQty)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">{orderNumberLabel}</div>
              <div className="text-sm font-semibold text-gray-900">{orderNumber}</div>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">Total Uniq Chosen</div>
              <div className="text-lg font-bold text-gray-900">{summary.uniqCount}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-100">
            <Table<EntryRow>
              dataSource={rows}
              columns={columns}
              rowKey="key"
              pagination={false}
              size="middle"
            />
          </div>
        </Card>

        {/* keep some breathing room */}
        <Divider className="!border-gray-100" />
      </Form>
    </div>
  );
}
