"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, DatePicker, Form, Input, InputNumber, Select, message } from "antd";
import TextArea from "antd/es/input/TextArea";
import dayjs from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { type ScrapStockRecord, useGetScrapStocksQuery } from "@/lib/api/scrap-stock/api";
import { useCreateScrapReleaseMutation } from "@/lib/api/scrap-release/api";
import { getApiErrorMessage } from "@/lib/api/error";

type FormValues = {
  scrap_stock_id: number;
  release_date: dayjs.Dayjs;
  release_type: string;
  release_qty: number;
  customer_name: string;
  price_per_unit: number;
  disposal_reason: "dump" | "sell" | "inventory";
  remarks?: string;
};

export default function ScrapReleaseCreatePage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const apiEnabled = Boolean(apiBaseUrl);

  const [createRelease, createState] = useCreateScrapReleaseMutation();

  const scrapStocksQuery = useGetScrapStocksQuery(
    { page: 1, limit: 500 },
    { skip: !apiEnabled }
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

  const onFinish = async (values: FormValues) => {
    try {
      if (!apiEnabled) throw new Error("API is not configured (NEXT_PUBLIC_API_URL)");

      const res = await createRelease({
        scrap_stock_id: values.scrap_stock_id,
        release_date: values.release_date.format("YYYY-MM-DD"),
        release_type: values.release_type,
        release_qty: values.release_qty,
        customer_name: values.customer_name,
        price_per_unit: values.price_per_unit,
        disposal_reason: values.disposal_reason,
        remarks: values.remarks?.trim() || null,
      }).unwrap();

      messageApi.success("Scrap release created");
      const id = res.uuid || String(res.id);
      router.push(`/scrap-stock/release/detail?id=${encodeURIComponent(id)}`);
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, "Failed to create scrap release"));
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {contextHolder}

      <div className="flex items-center justify-between bg-white px-8 py-4 border-b">
        <div className="flex items-center gap-4">
          <ArrowLeftOutlined className="cursor-pointer" onClick={() => router.back()} />
          <h1 className="text-2xl font-semibold m-0">Add Scrap Release</h1>
        </div>
      </div>

      <div className="p-8">
        <Card className="rounded-2xl shadow">
          <Form<FormValues>
            layout="vertical"
            requiredMark={false}
            onFinish={onFinish}
            initialValues={{
              release_date: dayjs(),
              release_type: "Sell",
              disposal_reason: "sell",
            }}
          >
            <Form.Item
              label="Scrap Stock"
              name="scrap_stock_id"
              rules={[{ required: true, message: "Scrap stock is required" }]}
            >
              <Select
                showSearch
                placeholder="Select scrap stock"
                loading={scrapStocksQuery.isFetching}
                options={scrapStockOptions}
                filterOption={(input, opt) =>
                  String(opt?.label ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
              />
            </Form.Item>

            <Form.Item shouldUpdate={(prev, cur) => prev.scrap_stock_id !== cur.scrap_stock_id}>
              {({ getFieldValue }) => {
                const selectedId = getFieldValue("scrap_stock_id") as number | undefined;
                if (!selectedId) return null;
                const stock = stockById.get(selectedId);
                if (!stock) return null;
                return (
                  <div className="mb-4 rounded-xl bg-gray-50 p-4 text-sm">
                    <div className="font-semibold text-gray-900">{stock.part_name}</div>
                    <div className="text-gray-600">UNIQ: {stock.uniq}</div>
                    <div className="text-gray-600">Part Number: {stock.part_number}</div>
                    <div className="text-gray-600">Model: {stock.model}</div>
                    <div className="text-gray-600">UoM: {stock.uom}</div>
                  </div>
                );
              }}
            </Form.Item>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                label="Release Date"
                name="release_date"
                rules={[{ required: true, message: "Release date is required" }]}
              >
                <DatePicker className="w-full" />
              </Form.Item>

              <Form.Item
                label="Release Type"
                name="release_type"
                rules={[{ required: true, message: "Release type is required" }]}
              >
                <Select
                  options={[
                    { label: "Sell", value: "Sell" },
                    { label: "Dump", value: "Dump" },
                    { label: "Inventory", value: "Inventory" },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="Release Qty"
                name="release_qty"
                rules={[{ required: true, message: "Release qty is required" }]}
              >
                <InputNumber className="w-full" min={0} />
              </Form.Item>

              <Form.Item
                label="Price / Unit"
                name="price_per_unit"
                rules={[{ required: true, message: "Price per unit is required" }]}
              >
                <InputNumber className="w-full" min={0} />
              </Form.Item>

              <Form.Item
                label="Buyer / Customer"
                name="customer_name"
                rules={[{ required: true, message: "Customer name is required" }]}
              >
                <Input placeholder="PT Buyer Scrap" />
              </Form.Item>

              <Form.Item
                label="Disposal Reason"
                name="disposal_reason"
                rules={[{ required: true, message: "Disposal reason is required" }]}
              >
                <Select
                  options={[
                    { label: "Dump", value: "dump" },
                    { label: "Sell", value: "sell" },
                    { label: "Inventory", value: "inventory" },
                  ]}
                />
              </Form.Item>
            </div>

            <Form.Item label="Remarks" name="remarks">
              <TextArea rows={3} placeholder="invoice ..." />
            </Form.Item>

            <div className="flex items-center justify-end gap-3">
              <Button onClick={() => router.back()}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createState.isLoading}>
                Create Release
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}
