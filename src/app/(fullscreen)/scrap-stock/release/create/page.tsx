"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  message,
} from "antd";
import TextArea from "antd/es/input/TextArea";
import dayjs from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type ScrapStockRecord,
  useGetScrapStocksQuery,
} from "@/lib/api/scrap-stock/api";
import { useCreateScrapReleaseMutation } from "@/lib/api/scrap-release/api";
import { getApiErrorMessage } from "@/lib/api/error";

type FormValues = {
  scrap_stock_id: number;
  release_date: dayjs.Dayjs;
  release_type: string;
  release_qty: number;
  customer_name: string;
  price_per_unit: number;
  disposal_reason?: string;
  remarks?: string;
};

export default function ScrapReleaseCreatePage() {
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const apiEnabled = Boolean(apiBaseUrl);

  const [createRelease, createState] = useCreateScrapReleaseMutation();

  const releaseType = Form.useWatch("release_type", form);
  const releaseQty = Form.useWatch("release_qty", form);
  const pricePerUnit = Form.useWatch("price_per_unit", form);
  const scrapStockId = Form.useWatch("scrap_stock_id", form);
  const releaseDate = Form.useWatch("release_date", form);
  const customerName = Form.useWatch("customer_name", form);
  const disposalReason = Form.useWatch("disposal_reason", form);

  const isDump = String(releaseType ?? "").toLowerCase() === "dump";
  const totalValue = (releaseQty ?? 0) * (pricePerUnit ?? 0);

  const scrapStocksQuery = useGetScrapStocksQuery(
    { page: 1, limit: 500 },
    { skip: !apiEnabled },
  );

  const scrapStockOptions = useMemo(() => {
    const items = scrapStocksQuery.data?.items ?? [];
    return items
      .filter((i) => i.id)
      .map((i) => ({
        label: `${i.uniq} — ${i.part_name}`,
        value: i.id,
      }));
  }, [scrapStocksQuery.data?.items]);

  const stockById = useMemo(() => {
    const map = new Map<number, ScrapStockRecord>();
    for (const item of scrapStocksQuery.data?.items ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [scrapStocksQuery.data?.items]);

  const selectedStock = scrapStockId ? stockById.get(scrapStockId) : undefined;

  const onFinish = async (values: FormValues) => {
    try {
      if (!apiEnabled)
        throw new Error("API is not configured (NEXT_PUBLIC_API_URL)");

      const res = await createRelease({
        scrap_stock_id: values.scrap_stock_id,
        release_date: values.release_date.format("YYYY-MM-DD"),
        release_type: values.release_type,
        release_qty: values.release_qty,
        customer_name: values.customer_name,
        price_per_unit: values.price_per_unit,
        disposal_reason: values.disposal_reason?.trim() || "",
        remarks: values.remarks?.trim() || null,
      }).unwrap();

      messageApi.success("Scrap release created");
      router.push(
        `/scrap-stock/release/detail?id=${encodeURIComponent(String(res.id))}`,
      );
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, "Failed to create scrap release"));
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {contextHolder}

      <div className="flex items-center bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <ArrowLeftOutlined
            className="cursor-pointer"
            onClick={() => router.back()}
          />
          <h1 className="text-2xl font-semibold m-0">Add Scrap Release</h1>
        </div>
      </div>

      <div className="p-8 max-w-10/12 mx-auto">
        <Form<FormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={onFinish}
          initialValues={{
            release_date: dayjs(),
            release_type: "Sell",
          }}>
          {/* Hidden field to keep release_type in form state */}
          <Form.Item name="release_type" hidden>
            <Input />
          </Form.Item>

          {/* Scrap Item Information */}
          <Card className="rounded-2xl shadow mb-6">
            <div className="font-semibold text-base mb-0.5">
              Scrap Item Information
            </div>
            <div className="text-xs text-green-600 mb-4">
              Current scrap details from database
            </div>

            <Form.Item
              name="scrap_stock_id"
              rules={[{ required: true, message: "Scrap stock is required" }]}
              className="mb-0">
              <Select
                showSearch
                placeholder="Search and select scrap stock..."
                loading={scrapStocksQuery.isFetching}
                options={scrapStockOptions}
                filterOption={(input, opt) =>
                  String(opt?.label ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
              />
            </Form.Item>

            {selectedStock && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <div className="text-xs text-gray-400">UNIQ</div>
                  <div className="font-semibold text-sm mt-0.5">
                    {selectedStock.uniq || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Part Number</div>
                  <div className="font-semibold text-sm mt-0.5">
                    {selectedStock.part_number || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Part Name</div>
                  <div className="font-semibold text-sm mt-0.5">
                    {selectedStock.part_name || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Model</div>
                  <div className="font-semibold text-sm mt-0.5">
                    {selectedStock.model || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Scrap Type</div>
                  <Tag color="red" className="mt-1">
                    {selectedStock.scrap_type || "-"}
                  </Tag>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Date Received</div>
                  <div className="font-semibold text-sm mt-0.5">
                    {selectedStock.date_received
                      ? dayjs(selectedStock.date_received).format("M/D/YYYY")
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Current Stock</div>
                  <div className="font-bold text-orange-500 text-xl mt-0.5">
                    {selectedStock.quantity ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Packing Number</div>
                  <div className="font-semibold text-sm mt-0.5">
                    {selectedStock.packing_number || "-"}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Release Type */}
          <Card className="rounded-2xl shadow mb-6">
            <div className="font-semibold text-base mb-0.5">Release Type</div>
            <div className="text-xs text-gray-400 mb-4">
              Select how to release the scrap material
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  value: "Sell",
                  label: "Sell",
                  desc: "Sell scrap to third party buyer",
                  iconEl: (sel: boolean) => (
                    <DollarOutlined
                      className={`text-3xl ${sel ? "text-green-500" : "text-gray-400"}`}
                    />
                  ),
                  activeCard: "border-green-500 bg-green-50",
                  activeCheck: "text-green-500",
                },
                {
                  value: "Dump",
                  label: "Dump",
                  desc: "Dispose of scrap material",
                  iconEl: (sel: boolean) => (
                    <DeleteOutlined
                      className={`text-3xl ${sel ? "text-red-500" : "text-gray-400"}`}
                    />
                  ),
                  activeCard: "border-red-500 bg-red-50",
                  activeCheck: "text-red-500",
                },
              ].map((opt) => {
                const selected = releaseType === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() =>
                      form.setFieldValue("release_type", opt.value)
                    }
                    className={`cursor-pointer rounded-xl border-2 p-5 flex flex-col items-center gap-2 transition-all ${
                      selected
                        ? opt.activeCard
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}>
                    {opt.iconEl(selected)}
                    <div className="font-semibold text-sm">{opt.label}</div>
                    <div className="text-xs text-gray-400 text-center">
                      {opt.desc}
                    </div>
                    {selected && (
                      <CheckCircleOutlined className={opt.activeCheck} />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Release Details */}
          <Card className="rounded-2xl shadow mb-6">
            <div className="font-semibold text-base mb-0.5">
              Release Details
            </div>
            <div className="text-xs text-gray-400 mb-4">
              {isDump
                ? "Enter information for disposing the scrap"
                : "Enter information for selling the scrap"}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                label="Release Date"
                name="release_date"
                rules={[
                  { required: true, message: "Release date is required" },
                ]}>
                <DatePicker className="w-full" />
              </Form.Item>

              <Form.Item
                label="Quantity to Release"
                name="release_qty"
                rules={[{ required: true, message: "Release qty is required" }]}
                extra={
                  selectedStock
                    ? `Maximum: ${selectedStock.quantity} units`
                    : undefined
                }>
                <InputNumber
                  className="w-full"
                  min={0}
                  max={selectedStock?.quantity}
                />
              </Form.Item>

              <Form.Item
                label="Customer / Buyer Name"
                name="customer_name"
                hidden={isDump}
                rules={
                  isDump
                    ? []
                    : [{ required: true, message: "Customer name is required" }]
                }>
                <Input placeholder="Customer/buyer" />
              </Form.Item>

              <Form.Item
                label="Price per Unit (IDR)"
                name="price_per_unit"
                hidden={isDump}
                rules={
                  isDump
                    ? []
                    : [
                        {
                          required: true,
                          message: "Price per unit is required",
                        },
                      ]
                }>
                <InputNumber className="w-full" min={0} />
              </Form.Item>
            </div>

            {/* Total Value — Sell only */}
            {!isDump && (
              <div className="rounded-xl bg-green-50 border border-green-100 p-4 flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-gray-500">Total Value</div>
                  <div className="text-2xl font-bold text-green-600">
                    IDR {totalValue.toLocaleString("id-ID")}
                  </div>
                  <div className="text-xs text-gray-400">
                    {releaseQty ?? 0} units × IDR{" "}
                    {(pricePerUnit ?? 0).toLocaleString("id-ID")}/unit
                  </div>
                </div>
                <DollarOutlined className="text-4xl text-green-400" />
              </div>
            )}

            {/* Disposal Reason — Dump only */}
            {isDump && (
              <Form.Item
                label="Disposal Reason"
                name="disposal_reason"
                rules={[
                  { required: true, message: "Disposal reason is required" },
                ]}>
                <Input placeholder="Enter disposal reason" />
              </Form.Item>
            )}

            <Form.Item
              label="Remarks / Reference Number"
              name="remarks"
              className="mb-4">
              <TextArea
                rows={3}
                placeholder="Additional notes, reference documents, or special instructions..."
              />
            </Form.Item>

            {/* Validator & Approver */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <UserOutlined className="text-blue-400 text-base" />
                <div>
                  <div className="text-xs text-gray-400">Validator</div>
                  <div className="font-medium text-gray-700">
                    Current User (Auto)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircleOutlined className="text-green-500 text-base" />
                <div>
                  <div className="text-xs text-gray-400">Approver Required</div>
                  <div className="font-medium text-gray-700">
                    Department Manager
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Release Summary */}
          <Card className="rounded-2xl shadow mb-6">
            <div className="font-semibold text-base mb-0.5">
              Release Summary
            </div>
            <div className="text-xs text-gray-400 mb-4">
              Review before processing
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-400 font-normal w-1/3">
                    Field
                  </th>
                  <th className="text-left py-2 text-gray-400 font-normal">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-500">Release Type</td>
                  <td className="py-2">
                    <Tag color={isDump ? "default" : "blue"}>
                      {releaseType || "-"}
                    </Tag>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-500">Item</td>
                  <td className="py-2 font-medium">
                    {selectedStock?.part_name || "-"}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-500">Quantity Released</td>
                  <td className="py-2 font-medium text-orange-500">
                    {releaseQty ?? 0} units
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-500">Remaining Stock</td>
                  <td className="py-2 font-medium">
                    {selectedStock
                      ? `${selectedStock.quantity - (releaseQty ?? 0)} units`
                      : "-"}
                  </td>
                </tr>
                {!isDump && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-500">Buyer</td>
                    <td className="py-2 font-medium">{customerName || "-"}</td>
                  </tr>
                )}
                {!isDump && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-500">Total Value</td>
                    <td className="py-2 font-bold text-green-600">
                      IDR {totalValue.toLocaleString("id-ID")}
                    </td>
                  </tr>
                )}
                {isDump && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-500">Disposal Reason</td>
                    <td className="py-2 font-medium">
                      {disposalReason || "-"}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="py-2 text-gray-500">Release Date</td>
                  <td className="py-2 font-medium">
                    {releaseDate ? dayjs(releaseDate).format("D/M/YYYY") : "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          <div className="flex items-center justify-end gap-3 mt-4">
            <Button onClick={() => router.back()}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createState.isLoading}
              disabled={!scrapStockId || !releaseQty || releaseQty <= 0}>
              Create Release
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
