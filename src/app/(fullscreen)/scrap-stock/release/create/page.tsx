"use client";

// CART-RELEASE-V1: multi-item cart + total weight(kg)/price-per-kg redesign

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  MinusOutlined,
  PlusOutlined,
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
import { useListCustomersQuery } from "@/lib/api/customers/api";
import { getApiErrorMessage } from "@/lib/api/error";

type FormValues = {
  release_date: dayjs.Dayjs;
  release_type: string;
  customer_name?: string;
  disposal_reason?: string;
  remarks?: string;
  weight_kg?: number;
  price_per_kg?: number;
};

type CartLine = { stockId: number; qty: number };

export default function ScrapReleaseCreatePage() {
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const apiEnabled = Boolean(apiBaseUrl);

  const [createRelease, createState] = useCreateScrapReleaseMutation();
  const [cart, setCart] = useState<CartLine[]>([]);

  const releaseType = Form.useWatch("release_type", form);
  const releaseDate = Form.useWatch("release_date", form);
  const customerName = Form.useWatch("customer_name", form);
  const disposalReason = Form.useWatch("disposal_reason", form);
  const weightKg = Form.useWatch("weight_kg", form);
  const pricePerKg = Form.useWatch("price_per_kg", form);

  const isDump = String(releaseType ?? "").toLowerCase() === "dump";
  const totalValue = (weightKg ?? 0) * (pricePerKg ?? 0);

  const scrapStocksQuery = useGetScrapStocksQuery(
    { page: 1, limit: 500 },
    { skip: !apiEnabled },
  );

  const stockById = useMemo(() => {
    const map = new Map<number, ScrapStockRecord>();
    for (const item of scrapStocksQuery.data?.items ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [scrapStocksQuery.data?.items]);

  const scrapStockOptions = useMemo(() => {
    const items = scrapStocksQuery.data?.items ?? [];
    const inCart = new Set(cart.map((c) => c.stockId));
    return items
      .filter((i) => i.id && !inCart.has(i.id))
      .map((i) => ({
        label: (i.uniq || "-") + " \u2014 " + (i.part_name || "-"),
        value: i.id,
      }));
  }, [scrapStocksQuery.data?.items, cart]);

  const customersQuery = useListCustomersQuery(undefined, { skip: !apiEnabled });

  const customerOptions = useMemo(
    () =>
      (customersQuery.data ?? [])
        .map((c) => c.customer_name)
        .filter((n): n is string => Boolean(n && n.trim()))
        .map((n) => ({ label: n, value: n })),
    [customersQuery.data],
  );

  const totalPcs = useMemo(
    () => cart.reduce((sum, c) => sum + (c.qty || 0), 0),
    [cart],
  );

  const hasInvalidQty = cart.some((c) => {
    const st = stockById.get(c.stockId);
    const max = st?.quantity ?? 0;
    return !c.qty || c.qty <= 0 || c.qty > max;
  });

  const addToCart = (stockId?: number) => {
    if (!stockId) return;
    setCart((prev) =>
      prev.some((c) => c.stockId === stockId)
        ? prev
        : [...prev, { stockId, qty: 1 }],
    );
  };

  const setQty = (stockId: number, qty: number) => {
    setCart((prev) =>
      prev.map((c) => (c.stockId === stockId ? { ...c, qty } : c)),
    );
  };

  const stepQty = (stockId: number, delta: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.stockId !== stockId) return c;
        const st = stockById.get(stockId);
        const max = st?.quantity ?? 0;
        let next = (c.qty || 0) + delta;
        if (next < 1) next = 1;
        if (max && next > max) next = max;
        return { ...c, qty: next };
      }),
    );
  };

  const removeFromCart = (stockId: number) => {
    setCart((prev) => prev.filter((c) => c.stockId !== stockId));
  };

  const onFinish = async (values: FormValues) => {
    try {
      if (!apiEnabled)
        throw new Error("API is not configured (NEXT_PUBLIC_API_URL)");
      if (cart.length === 0) throw new Error("Add at least one scrap item");
      if (hasInvalidQty)
        throw new Error("Check the pcs quantity of each cart item");

      const res = await createRelease({
        scrap_stock_id: cart[0].stockId,
        release_date: values.release_date.format("YYYY-MM-DD"),
        release_type: values.release_type,
        release_qty: totalPcs,
        items: cart.map((c) => ({
          scrap_stock_id: c.stockId,
          release_qty: c.qty,
        })),
        weight_kg: values.weight_kg ?? null,
        price_per_kg: isDump ? null : (values.price_per_kg ?? null),
        customer_name: values.customer_name ?? "",
        disposal_reason: values.disposal_reason?.trim() || "",
        remarks: values.remarks?.trim() || null,
      }).unwrap();

      messageApi.success("Scrap release created");
      router.push(
        "/scrap-stock/release/detail?id=" + encodeURIComponent(String(res.id)),
      );
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, "Failed to create scrap release"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {contextHolder}
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
          />
          <div>
            <h1 className="text-xl font-semibold">Add Scrap Release</h1>
            <p className="text-sm text-gray-400">
              Pilih beberapa scrap seperti keranjang belanja, lalu timbang total
              (kg) untuk perhitungan penjualan
            </p>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ release_type: "Sell", release_date: dayjs() }}
        >
          {/* Scrap Items (Cart) */}
          <Card className="mb-6 rounded-2xl shadow">
            <div className="mb-0.5 text-base font-semibold">Scrap Items</div>
            <div className="mb-4 text-xs text-green-600">
              Pilih multi data scrap, atur jumlah pcs (tidak boleh melebihi stock)
            </div>

            <Select
              showSearch
              className="mb-4 w-full"
              placeholder="Search and add scrap stock to cart..."
              value={null}
              loading={scrapStocksQuery.isFetching}
              options={scrapStockOptions}
              onSelect={(val) => addToCart(Number(val))}
              filterOption={(input, opt) =>
                String(opt?.label ?? "")
                  .toLowerCase()
                  .includes(input.trim().toLowerCase())
              }
            />

            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                Belum ada item. Tambahkan scrap dari daftar di atas.
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((line) => {
                  const st = stockById.get(line.stockId);
                  const max = st?.quantity ?? 0;
                  const over = !line.qty || line.qty <= 0 || line.qty > max;
                  return (
                    <div
                      key={line.stockId}
                      className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 md:flex-row md:items-center"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-semibold">
                          {(st?.uniq || "-") + " \u2014 " + (st?.part_name || "-")}
                        </div>
                        <div className="text-xs text-gray-400">
                          {(st?.part_number || "-") +
                            " \u00b7 " +
                            (st?.scrap_type || "-")}{" "}
                          \u00b7 Stock:{" "}
                          <span className="font-medium text-orange-500">
                            {max}
                          </span>{" "}
                          pcs
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="small"
                          icon={<MinusOutlined />}
                          onClick={() => stepQty(line.stockId, -1)}
                        />
                        <InputNumber
                          min={1}
                          max={max}
                          value={line.qty}
                          status={over ? "error" : undefined}
                          onChange={(v) => setQty(line.stockId, Number(v ?? 0))}
                          className="w-24"
                        />
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => stepQty(line.stockId, 1)}
                        />
                        <span className="w-16 text-right text-xs text-gray-400">
                          / {max} pcs
                        </span>
                        <Button
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          onClick={() => removeFromCart(line.stockId)}
                        />
                      </div>
                      {over ? (
                        <div className="text-xs text-red-500 md:w-full">
                          Qty tidak boleh lebih dari stock ({max} pcs)
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <div className="text-right text-sm font-medium">
                  Total: {totalPcs} pcs dari {cart.length} item
                </div>
              </div>
            )}
          </Card>

          {/* Release Type */}
          <Card className="mb-6 rounded-2xl shadow">
            <div className="mb-3 text-base font-semibold">Release Type</div>
            <Form.Item
              name="release_type"
              rules={[{ required: true, message: "Release type is required" }]}
            >
              <Select
                options={[
                  { label: "Sell", value: "Sell" },
                  { label: "Dump", value: "Dump" },
                ]}
              />
            </Form.Item>
          </Card>

          {/* Release Details */}
          <Card className="mb-6 rounded-2xl shadow">
            <div className="mb-3 text-base font-semibold">Release Details</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Form.Item
                label="Release Date"
                name="release_date"
                rules={[{ required: true, message: "Release date is required" }]}
              >
                <DatePicker className="w-full" format="DD/MM/YYYY" />
              </Form.Item>

              <Form.Item
                label="Customer / Buyer Name"
                name="customer_name"
                hidden={isDump}
                rules={
                  isDump
                    ? []
                    : [{ required: true, message: "Customer is required" }]
                }
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Select customer"
                  loading={customersQuery.isFetching}
                  options={customerOptions}
                  filterOption={(input, opt) =>
                    String(opt?.label ?? "")
                      .toLowerCase()
                      .includes(input.trim().toLowerCase())
                  }
                />
              </Form.Item>

              <Form.Item
                label="Weight (kg)"
                name="weight_kg"
                extra="Total berat scrap yang ditimbang (kg)"
                rules={
                  isDump
                    ? []
                    : [{ required: true, message: "Weight (kg) is required" }]
                }
              >
                <InputNumber className="w-full" min={0} step={0.1} />
              </Form.Item>

              <Form.Item
                label="Price per kg (IDR)"
                name="price_per_kg"
                hidden={isDump}
                rules={
                  isDump
                    ? []
                    : [{ required: true, message: "Price per kg is required" }]
                }
              >
                <InputNumber
                  className="w-full"
                  min={0}
                  formatter={(v) =>
                    (v ?? "").toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  parser={(v) => Number((v ?? "").replace(/,/g, ""))}
                />
              </Form.Item>
            </div>

            {!isDump ? (
              <div className="mt-2 rounded-xl bg-green-50 p-4">
                <div className="text-xs text-gray-500">Total Value</div>
                <div className="text-lg font-bold text-green-600">
                  IDR {totalValue.toLocaleString("id-ID")}
                </div>
                <div className="text-xs text-gray-400">
                  {(weightKg ?? 0)} kg \u00d7 IDR{" "}
                  {(pricePerKg ?? 0).toLocaleString("id-ID")}/kg
                </div>
              </div>
            ) : null}

            {isDump ? (
              <Form.Item
                className="mt-2"
                label="Disposal Reason"
                name="disposal_reason"
                rules={[
                  { required: true, message: "Disposal reason is required" },
                ]}
              >
                <Input placeholder="e.g. Damaged beyond repair" />
              </Form.Item>
            ) : null}

            <Form.Item
              className="mt-2"
              label="Remarks / Reference Number"
              name="remarks"
            >
              <TextArea rows={3} placeholder="Optional notes" />
            </Form.Item>
          </Card>

          {/* Release Summary */}
          <Card className="mb-6 rounded-2xl shadow">
            <div className="mb-0.5 text-base font-semibold">Release Summary</div>
            <div className="mb-4 text-xs text-gray-400">Review before processing</div>

            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 text-left font-normal text-gray-400">Item</th>
                  <th className="py-2 text-left font-normal text-gray-400">
                    Qty (pcs)
                  </th>
                  <th className="py-2 text-left font-normal text-gray-400">
                    Remaining Stock
                  </th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td className="py-2 text-gray-400" colSpan={3}>
                      No items
                    </td>
                  </tr>
                ) : (
                  cart.map((line) => {
                    const st = stockById.get(line.stockId);
                    const max = st?.quantity ?? 0;
                    return (
                      <tr key={line.stockId} className="border-b border-gray-100">
                        <td className="py-2 font-medium">
                          {(st?.uniq || "-") + " \u2014 " + (st?.part_name || "-")}
                        </td>
                        <td className="py-2 font-medium text-orange-500">
                          {line.qty} pcs
                        </td>
                        <td className="py-2">{max - (line.qty || 0)} pcs</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="w-1/3 py-2 text-gray-500">Release Type</td>
                  <td className="py-2">
                    <Tag color={isDump ? "default" : "blue"}>
                      {releaseType || "-"}
                    </Tag>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-500">Total Quantity</td>
                  <td className="py-2 font-medium text-orange-500">
                    {totalPcs} pcs
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-500">Weight</td>
                  <td className="py-2 font-medium">{weightKg ?? 0} kg</td>
                </tr>
                {!isDump ? (
                  <>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-500">Price per kg</td>
                      <td className="py-2 font-medium">
                        IDR {(pricePerKg ?? 0).toLocaleString("id-ID")}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-500">Buyer</td>
                      <td className="py-2 font-medium">{customerName || "-"}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-500">Total Value</td>
                      <td className="py-2 font-bold text-green-600">
                        IDR {totalValue.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-500">Disposal Reason</td>
                    <td className="py-2 font-medium">{disposalReason || "-"}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-2 text-gray-500">Release Date</td>
                  <td className="py-2 font-medium">
                    {releaseDate ? dayjs(releaseDate).format("DD/MM/YYYY") : "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          <div className="flex justify-end gap-3">
            <Button onClick={() => router.back()}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createState.isLoading}
              disabled={cart.length === 0 || hasInvalidQty}
            >
              Process Release
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
