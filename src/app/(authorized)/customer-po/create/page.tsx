"use client";

import React, { useMemo, useState, useEffect } from "react";
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
import dayjs, { type Dayjs } from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useListCustomersQuery } from "@/lib/api/customers/api";
import {
  useCreateCustomerPoMutation,
  useCreateDeliveryNoteMutation,
  useCreateSpecialOrderMutation,
  useGetCustomerOrderByIdQuery,
  useUpdateCustomerOrderMutation,
} from "@/lib/api/customer-orders/api";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { useGetUomsQuery } from "@/lib/api/system-settings/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";

type OrderType = "dn" | "po" | "so";

type EntryRow = {
  key: string;
  uniq: string;
  partNumber: string;
  partName: string;
  model: string;
  qty: number;
  uom: string;
};

function toPositiveIntString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0)
    return String(Math.trunc(value));
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0)
      return String(Math.trunc(parsed));
  }
  return null;
}

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

  const apiEnabled = Boolean(apiBaseUrl);
  const [createCustomerPo, createCustomerPoState] =
    useCreateCustomerPoMutation();
  const [createDeliveryNote, createDeliveryNoteState] =
    useCreateDeliveryNoteMutation();
  const [createSpecialOrder, createSpecialOrderState] =
    useCreateSpecialOrderMutation();

  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [editTypeParam, setEditTypeParam] = useState<OrderType | null>(null);
  const isEditMode = Boolean(editId);

  const [updateCustomerOrder, updateCustomerOrderState] =
    useUpdateCustomerOrderMutation();

  const existingOrderQuery = useGetCustomerOrderByIdQuery(editId ?? "", {
    skip: !editId,
  });
  // ───────────────────────────────────────────────────────────

  const [orderType, setOrderType] = useState<OrderType>(editTypeParam ?? "dn");
  const [deliveryDate, setDeliveryDate] = useState<Dayjs | null>(null);

  const [entryUniq, setEntryUniq] = useState<string | undefined>(undefined);
  const [entryQty, setEntryQty] = useState<number | null>(null);
  const [entryUom, setEntryUom] = useState<string | undefined>(undefined);

  const [rows, setRows] = useState<EntryRow[]>([]);

  // Prefill saat mode edit: isi form + rows dari data existing
  useEffect(() => {
    const order = existingOrderQuery.data;
    if (!order) return;

    const nextType: OrderType =
      order.document_type === "PO"
        ? "po"
        : order.document_type === "SO"
          ? "so"
          : "dn";
    setOrderType(nextType);

    form.setFieldsValue({
      orderType: nextType,
      customerId: String(order.customer_id),
      customerName: order.customer_name,
      contactPerson: order.contact_person ?? undefined,
      deliveryAddress: order.delivery_address ?? undefined,
      specialInstructions: order.notes ?? undefined,
      externalOrderNumber: order.document_number ?? undefined,
    });

    const firstDate =
      order.document_date || order.items?.[0]?.delivery_date || "";
    setDeliveryDate(firstDate ? dayjs(firstDate) : null);

    setRows(
      (order.items ?? []).map((it, idx) => ({
        key: `row-${it.id || idx}`,
        uniq: it.item_uniq_code,
        partNumber: it.part_number,
        partName: it.part_name,
        model: it.model ?? "",
        qty: it.quantity,
        uom: "Pcs", // NOTE: item record backend tidak mengembalikan uom, default "Pcs"
      })),
    );
  }, [existingOrderQuery.data, form]);

  // Bridge component to read search params inside a Suspense boundary
  function SearchParamsBridge() {
    const searchParams = useSearchParams();
    useEffect(() => {
      const id = searchParams.get("id") ?? undefined;
      const type = (searchParams.get("type") as OrderType) ?? null;
      setEditId(id);
      setEditTypeParam(type);
    }, [searchParams]);
    return null;
  }

  const customersQuery = useListCustomersQuery(undefined, {
    skip: !apiEnabled,
  });
  const bomTreeQuery = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const uomsQuery = useGetUomsQuery(undefined, { skip: !apiEnabled });

  const bomIndex = useMemo(
    () => buildBomUniqIndex((bomTreeQuery.data?.data ?? []) as unknown),
    [bomTreeQuery.data],
  );

  const selectedCustomerId = Form.useWatch("customerId", form) as
    | string
    | undefined;

  const uniqOptions = useMemo(() => {
    if (!apiEnabled) {
      return [
        { label: "LV-001", value: "LV-001" },
        { label: "LV-002", value: "LV-002" },
        { label: "LV-003", value: "LV-003" },
        { label: "LV-004", value: "LV-004" },
      ];
    }

    // Full uniq catalog from the BOM tree, keyed by uniq code.
    const allOptions = (bomIndex.uniqs ?? []).map((uniq) => {
      const partName = bomIndex.partNameByUniq[uniq];
      return {
        value: uniq,
        label: partName ? `${uniq} — ${partName}` : uniq,
      };
    });

    // Only expose uniqs that are registered to the selected customer
    // (customer master "Parent Codes / Sebango" -> bom_codes).
    if (!selectedCustomerId) {
      return [
        { label: "Pilih customer terlebih dahulu", value: "", disabled: true },
      ];
    }

    const customers = customersQuery.data ?? [];
    const selectedCustomer = customers.find((c) => {
      const idStr =
        toPositiveIntString(c.id) ??
        toPositiveIntString(c.row_id) ??
        toPositiveIntString(c.customer_id) ??
        toPositiveIntString(c.customer_code);
      return idStr === selectedCustomerId;
    });

    const registeredCodes = Array.isArray(selectedCustomer?.bom_codes)
      ? selectedCustomer!.bom_codes
          .map((code) => String(code).trim())
          .filter(Boolean)
      : [];

    if (registeredCodes.length === 0) {
      return [
        {
          label: "Belum ada uniq terdaftar untuk customer ini",
          value: "",
          disabled: true,
        },
      ];
    }

    const optionByUniq = new Map(allOptions.map((o) => [o.value, o]));
    return registeredCodes.map(
      (code) => optionByUniq.get(code) ?? { label: code, value: code },
    );
  }, [
    apiEnabled,
    bomIndex.partNameByUniq,
    bomIndex.uniqs,
    selectedCustomerId,
    customersQuery.data,
  ]);

  const customerOptions = useMemo(() => {
    if (!apiEnabled) {
      return [
        { value: "1", label: "Toyota Motor" },
        { value: "2", label: "Honda Motor" },
        { value: "3", label: "Nissan Group" },
      ].map((o) => ({
        ...o,
        customer: { customer_name: o.label, shipping_address: "" },
      }));
    }
    const customers = customersQuery.data ?? [];
    return customers
      .map((c) => {
        const idStr =
          toPositiveIntString(c.id) ??
          toPositiveIntString(c.row_id) ??
          toPositiveIntString(c.customer_id) ??
          toPositiveIntString(c.customer_code);
        const name = String(c.customer_name ?? "").trim();
        if (!idStr || !name) return null;
        return {
          value: idStr,
          label: name,
          customer: c,
        } as const;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [apiEnabled, customersQuery.data]);

  const uomOptions = useMemo(() => {
    if (!apiEnabled) {
      return [
        { label: "Pcs", value: "Pcs" },
        { label: "Kg", value: "Kg" },
        { label: "Set", value: "Set" },
      ];
    }

    const list = uomsQuery.data ?? [];
    return list
      .map((u) => {
        const name = String(
          u.name ?? u.unit_name ?? u.code ?? u.unit_code ?? "",
        ).trim();
        if (!name) return null;
        return { label: name, value: name };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [apiEnabled, uomsQuery.data]);

  const customerName = Form.useWatch("customerName", form) as
    | string
    | undefined;
  const externalOrderNumberWatch = Form.useWatch(
    "externalOrderNumber",
    form,
  ) as string | undefined;

  const orderNumber = useMemo(() => {
    const code = customerCode(customerName ?? "");
    const year = 2024;
    if (orderType === "dn") return `DN-${code}-${year}-001`;
    if (orderType === "po") return `PO-${code}-${year}-001`;
    return `SO-${code}-${year}-001`;
  }, [customerName, orderType]);

  const displayOrderNumber = useMemo(() => {
    const ext = String(externalOrderNumberWatch ?? "").trim();
    return ext || orderNumber;
  }, [externalOrderNumberWatch, orderNumber]);

  const summary = useMemo(() => {
    const totalQty = rows.reduce((acc, r) => acc + (r.qty ?? 0), 0);
    const uniqSet = new Set(rows.map((r) => r.uniq));
    return {
      totalQty,
      uniqCount: uniqSet.size,
    };
  }, [rows]);

  const actionLabel =
    orderType === "dn"
      ? "Create DN"
      : orderType === "po"
        ? "Create PO"
        : "Create SO";
  const orderNumberLabel =
    orderType === "dn"
      ? "DN Number"
      : orderType === "po"
        ? "PO Number"
        : "SO Number";

  const columns = useMemo<ColumnsType<EntryRow>>(
    () => [
      { title: "Uniq", dataIndex: "uniq", key: "uniq", width: 110 },
      {
        title: "Part Number",
        dataIndex: "partNumber",
        key: "partNumber",
        render: (v: string) => (
          <Tag
            className="!rounded-lg !px-2 !py-0.5 !text-xs !text-gray-700"
            color="default"
          >
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
        render: (v: number) => (
          <span className="text-sm text-gray-700">{formatNumber(v)}</span>
        ),
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
    [],
  );

  function onAddEntry() {
    if (!entryUniq) {
      message.warning("Select Uniq first");
      return;
    }
    if (!entryUom) {
      message.warning("Select UOM first");
      return;
    }
    if (!entryQty || entryQty <= 0) {
      message.warning("Input Quantity first");
      return;
    }

    const partNumber = bomIndex.partNumberByUniq[entryUniq] ?? "";
    const partName = bomIndex.partNameByUniq[entryUniq] ?? "";
    const model = bomIndex.modelByUniq[entryUniq] ?? "";
    const newRow: EntryRow = {
      key: `row-${Date.now()}`,
      uniq: entryUniq,
      partNumber,
      partName,
      model,
      qty: Math.min(999999, Math.round(entryQty)),
      uom: entryUom,
    };

    setRows((prev) => [newRow, ...prev]);
    setEntryUniq(undefined);
    setEntryUom(undefined);
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

      const customerId = Number(String(values.customerId ?? "").trim());
      if (!Number.isFinite(customerId) || customerId <= 0) {
        message.error("Customer ID must be a positive number");
        return;
      }

      if (!apiEnabled) {
        message.success(
          `Created ${orderType.toUpperCase()} for ${values.customerName || `Customer #${customerId}`}`,
        );
        router.push("/customer-po");
        return;
      }

      const dateStr = deliveryDate.format("YYYY-MM-DD");
      const externalNumber =
        String(values.externalOrderNumber ?? "").trim() || undefined;

      // ── EDIT MODE: update order yang sudah ada, lalu keluar ──
      if (isEditMode && editId) {
        await updateCustomerOrder({
          uuid: editId,
          body: {
            customer_id: customerId,
            contact_person: values.contactPerson,
            delivery_address: values.deliveryAddress,
            notes: values.specialInstructions ?? "",
            delivery_date: dateStr,
            items: rows.map((r) => ({
              item_uniq_code: r.uniq,
              quantity: r.qty,
              delivery_date: dateStr,
            })),
          },
        }).unwrap();

        message.success(
          `Updated ${orderType.toUpperCase()} for ${values.customerName || `Customer #${customerId}`}`,
        );
        router.push("/customer-po");
        return;
      }
      // ────────────────────────────────────────────────────────

      if (orderType === "po") {
        await createCustomerPo({
          po_number: externalNumber ?? orderNumber,
          customer_id: customerId,
          contact_person: values.contactPerson,
          delivery_address: values.deliveryAddress,
          special_instructions: values.specialInstructions,
          items: rows.map((r) => ({
            item_uniq_code: r.uniq,
            quantity: r.qty,
            uom: r.uom || "Pcs",
            delivery_date: dateStr,
          })),
        }).unwrap();
      } else if (orderType === "dn") {
        await createDeliveryNote({
          dn_number: externalNumber ?? orderNumber,
          customer_id: customerId,
          delivery_date: dateStr,
          contact_person: values.contactPerson,
          delivery_address: values.deliveryAddress,
          notes: values.specialInstructions,
          items: rows.map((r) => ({
            item_uniq_code: r.uniq,
            quantity: r.qty,
            uom: r.uom || "Pcs",
          })),
        }).unwrap();
      } else {
        await createSpecialOrder({
          so_number: externalNumber ?? orderNumber,
          customer_id: customerId,
          order_date: dateStr,
          special_instructions: values.specialInstructions,
          contact_person: values.contactPerson,
          delivery_address: values.deliveryAddress,
          items: rows.map((r) => ({
            item_uniq_code: r.uniq,
            quantity: r.qty,
            uom: r.uom || "Pcs",
            target_date: dateStr,
          })),
        }).unwrap();
      }

      message.success(
        `Created ${orderType.toUpperCase()} for ${values.customerName || `Customer #${customerId}`}`,
      );
      router.push("/customer-po");
    } catch (err) {
      if (apiEnabled && err) {
        message.error(getApiErrorMessage(err, "Failed to create order"));
      }
      // Form will highlight missing fields
    }
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <React.Suspense fallback={null}>
        <SearchParamsBridge />
      </React.Suspense>
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
          <Button
            className="!rounded-lg"
            onClick={() => router.push("/customer-po")}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            className="!rounded-lg"
            onClick={onCreateOrder}
            loading={
              createCustomerPoState.isLoading ||
              createDeliveryNoteState.isLoading ||
              createSpecialOrderState.isLoading ||
              updateCustomerOrderState.isLoading
            }
          >
            {isEditMode ? "Update Order" : "Create Order"}
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900">
            {isEditMode ? "Edit Customer Order" : "Create New Customer Order"}
          </h1>
          <p className="text-sm text-gray-500">
            Create Purchase Orders, Delivery Notes, or Special Orders
          </p>
        </div>
      </div>

      <Form form={form} layout="vertical" requiredMark={false}>
        {/* Step 1 */}
        <Card
          className="!rounded-xl !border-gray-100 !shadow-sm"
          title={
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Step 1: Select Order Type
                </div>
                <div className="text-xs text-gray-500">
                  Select the type of customer order to create
                </div>
              </div>
              {requiredPill()}
            </div>
          }
        >
          <Form.Item
            label="Order Type"
            name="orderType"
            initialValue={"dn"}
            rules={[{ required: true }]}
          >
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
                <div className="text-sm font-semibold text-gray-900">
                  Step 2: Customer & Order Information
                </div>
                <div className="text-xs text-gray-500">
                  Configure customer details and order information
                </div>
              </div>
              {requiredPill()}
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Form.Item
              label="Customer Name"
              name="customerId"
              rules={[{ required: true, message: "Select Customer Name" }]}
            >
              <Select
                placeholder="Select customer from master"
                showSearch
                allowClear
                loading={customersQuery.isLoading}
                options={customerOptions as any}
                filterOption={(input, option) =>
                  String((option as any)?.label ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
                onChange={(value, option) => {
                  // Reset the chosen uniq whenever the customer changes so the
                  // Uniq dropdown only offers codes registered to that customer.
                  setEntryUniq(undefined);
                  const nextCustomerId = toPositiveIntString(value);
                  if (!nextCustomerId) {
                    form.setFieldValue("customerName", undefined);
                    return;
                  }

                  const customer = (option as any)?.customer as
                    | { customer_name?: unknown; shipping_address?: unknown }
                    | undefined;

                  const nextName =
                    typeof customer?.customer_name === "string"
                      ? customer.customer_name
                      : (option as any)?.label;
                  if (typeof nextName === "string")
                    form.setFieldValue("customerName", nextName);

                  // always set/override delivery address from master customer when selection changes
                  const shippingAddr =
                    typeof customer?.shipping_address === "string"
                      ? customer.shipping_address
                      : "";
                  if (shippingAddr.trim()) {
                    form.setFieldValue("deliveryAddress", shippingAddr.trim());
                  } else {
                    form.setFieldValue("deliveryAddress", undefined);
                  }

                  // always set/override contact person from common customer fields when selection changes
                  const candidate =
                    (customer &&
                      String((customer as any).contact_person ?? "").trim()) ||
                    (customer &&
                      String((customer as any).contactName ?? "").trim()) ||
                    (customer &&
                      String((customer as any).contact_name ?? "").trim()) ||
                    (customer &&
                      String((customer as any).pic_name ?? "").trim()) ||
                    (customer &&
                      String((customer as any).phone_number ?? "").trim());
                  if (candidate) {
                    form.setFieldValue("contactPerson", candidate);
                  } else {
                    form.setFieldValue("contactPerson", undefined);
                  }
                }}
              />
            </Form.Item>

            <Form.Item
              name="customerName"
              rules={[{ required: true, message: "Select Customer" }]}
              hidden
            >
              <Input />
            </Form.Item>

            <Form.Item
              label="Contact Person"
              name="contactPerson"
              rules={[{ required: true, message: "Input Contact Person" }]}
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

            <Form.Item
              label="Delivery Address"
              name="deliveryAddress"
              rules={[{ required: true, message: "Input Delivery Address" }]}
            >
              <Input placeholder="Input Delivery Address" />
            </Form.Item>

            <Form.Item
              label="Special Instructions"
              name="specialInstructions"
              className="lg:col-span-2"
            >
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
                <div className="text-sm font-semibold text-gray-900">
                  Step 3: Input Data
                </div>
                <div className="text-xs text-gray-500">
                  Configure order detail specifications
                </div>
              </div>
              <Tag className="!rounded-full !text-xs !px-3 !py-0.5">
                Entry 1
              </Tag>
            </div>
          }
        >
          <div className="flex flex-col xl:flex-row xl:items-end gap-3 mb-4">
            <div className="w-full xl:w-[260px]">
              <div className="text-xs text-gray-500 mb-1">Uniq</div>
              <Select
                placeholder="Select Uniq"
                value={entryUniq}
                onChange={(v) => {
                  setEntryUniq(v);
                  const bomUom = bomIndex.uomByUniq[v];
                  if (
                    !entryUom &&
                    typeof bomUom === "string" &&
                    bomUom.trim()
                  ) {
                    const hasUom = uomOptions.some(
                      (o) => o.value === bomUom.trim(),
                    );
                    if (hasUom) setEntryUom(bomUom.trim());
                  }
                }}
                options={uniqOptions}
                loading={bomTreeQuery.isLoading}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
              />
            </div>

            <div className="w-full xl:w-[260px]">
              <div className="text-xs text-gray-500 mb-1">UOM</div>
              <Select
                placeholder="Select UOM"
                value={entryUom}
                onChange={(v) => setEntryUom(v)}
                options={uomOptions}
                loading={uomsQuery.isLoading}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
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
            <div className="lg:col-span-3">
              <label className="block mb-2 font-medium text-gray-700">
                Customer PO / DN / SO Number
              </label>

              <Form.Item name="externalOrderNumber" noStyle>
                <Input placeholder="Masukkan nomor PO/DN/SO (free-text) — akan menggantikan nomor yang digenerate" />
              </Form.Item>
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

          <div className="text-base font-bold text-gray-900 mb-3">
            {orderNumber}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">Total Qty</div>
              <div className="text-lg font-bold text-gray-900">
                {formatNumber(summary.totalQty)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">{orderNumberLabel}</div>
              <div className="text-sm font-semibold text-gray-900">
                {displayOrderNumber}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">Total Uniq Chosen</div>
              <div className="text-lg font-bold text-gray-900">
                {summary.uniqCount}
              </div>
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
