"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, InputNumber, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useListCustomersQuery } from "@/lib/api/customers/api";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { useCreateDeliveryScheduleMutation } from "@/lib/api/delivery-schedule/api";
import {
  useGetCustomerOrderByIdQuery,
  useListCustomerOrdersQuery,
} from "@/lib/api/customer-orders/api";

type ReviewRow = {
  key: string;
  itemUuid: string;
  uniq: string;
  partNo: string;
  partName: string;
  model: string;
  totalOrder: number;
  totalDelivery: number;
  uom: string;
};

type UniqOption = {
  value: string;
  label: string;
  itemUuid: string;
  partNo: string;
  partName: string;
  model: string;
  totalOrder: number;
  uom: string;
};

const toPositiveInt = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0)
    return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  }
  return null;
};

const formatOffsetDateTime = (value: Dayjs): string =>
  value.format("YYYY-MM-DDTHH:mm:ssZ");

export default function AddNewDeliverySchedulePage() {
  const router = useRouter();

  const apiEnabled = Boolean(apiBaseUrl);
  const customersQuery = useListCustomersQuery(undefined, {
    skip: !apiEnabled,
  });
  const bomTreeQuery = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeQuery.data?.data ?? []),
    [bomTreeQuery.data],
  );

  const poListQuery = useListCustomerOrdersQuery(
    { document_type: "PO", page: 1, limit: 200 },
    { skip: !apiEnabled },
  );
  const dnListQuery = useListCustomerOrdersQuery(
    { document_type: "DN", page: 1, limit: 200 },
    { skip: !apiEnabled },
  );
  const soListQuery = useListCustomerOrdersQuery(
    { document_type: "SO", page: 1, limit: 200 },
    { skip: !apiEnabled },
  );

  const [createDeliverySchedule, createState] =
    useCreateDeliveryScheduleMutation();

  const [customerOrderUuid, setCustomerOrderUuid] = useState<string>("");
  const dnDetailQuery = useGetCustomerOrderByIdQuery(customerOrderUuid, {
    skip: !apiEnabled || !customerOrderUuid,
  });

  const dnRefOptions = useMemo(() => {
    if (!apiEnabled) {
      return [
        { label: "Select PO / DN / SO Reference", value: "" },
        {
          label: "[DN] DN-2026-0001 · PT Endpoint Check Customer",
          value: "2f057f77-9006-4ffe-afd6-942133012bb3",
        },
      ];
    }
    const orders = [
      ...(poListQuery.data?.items ?? []),
      ...(dnListQuery.data?.items ?? []),
      ...(soListQuery.data?.items ?? []),
    ];
    return [
      { label: "Select PO / DN / SO Reference", value: "" },
      ...orders
        .filter((o) => o.id && o.document_number)
        .map((o) => ({
          label: `[${o.document_type}] ${o.document_number}${
            o.customer_name ? ` \u00b7 ${o.customer_name}` : ""
          }`,
          value: o.id,
        })),
    ];
  }, [apiEnabled, poListQuery.data, dnListQuery.data, soListQuery.data]);

  const customerOptions = useMemo(() => {
    if (!apiEnabled) {
      return [
        { value: 1, label: "PT Endpoint Check Customer" },
        { value: 2, label: "Toyota Motor" },
      ];
    }
    const customers = customersQuery.data ?? [];
    return customers
      .map((c) => {
        const id =
          toPositiveInt(c.id) ??
          toPositiveInt(c.row_id) ??
          toPositiveInt(c.customer_id) ??
          toPositiveInt(c.customer_code);
        const name = String(c.customer_name ?? "").trim();
        if (!id || !name) return null;
        return { value: id, label: name };
      })
      .filter((x): x is { value: number; label: string } => Boolean(x));
  }, [apiEnabled, customersQuery.data]);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState<string>("");

  const customerSelectOptions = useMemo(() => {
    if (!customerId) return customerOptions;
    if (customerOptions.some((o) => o.value === customerId))
      return customerOptions;
    return [
      { value: customerId, label: customerName || `Customer #${customerId}` },
      ...customerOptions,
    ];
  }, [customerOptions, customerId, customerName]);

  const [deliveryDate, setDeliveryDate] = useState<Dayjs | null>(dayjs());
  const [cycle, setCycle] = useState<string>("daily");
  const [priority] = useState<string>("normal");
  const [transportCompany] = useState<string>("");
  const [vehicleNumber] = useState<string>("");
  const [driverName] = useState<string>("");
  const [driverContact] = useState<string>("");
  const [departureAt] = useState<Dayjs | null>(null);
  const [arrivalAt] = useState<Dayjs | null>(null);
  const [deliveryInstructions] = useState<string>("");

  const [draftUniq, setDraftUniq] = useState<string>("");
  const [draftQty, setDraftQty] = useState<number>(0);

  const [rows, setRows] = useState<ReviewRow[]>([]);

  const uniqOptions = useMemo<UniqOption[]>(() => {
    if (!apiEnabled) {
      return [
        {
          value: "LV-001",
          label: "LV-001",
          itemUuid: "item-1",
          partNo: "BRK-001-A",
          partName: "Bracket Assembly",
          model: "Avanza Model A",
          totalOrder: 100,
          uom: "pcs",
        },
      ];
    }

    const order = dnDetailQuery.data;
    const orderItems = order?.items ?? [];
    const mapped = orderItems
      .map((item, idx) => {
        const uniq = String(item.item_uniq_code ?? "").trim();
        if (!uniq) return null;
        const partNo = String(
          item.part_number ?? bomIndex.partNumberByUniq[uniq] ?? "",
        ).trim();
        const partName = String(
          item.part_name ?? bomIndex.partNameByUniq[uniq] ?? "",
        ).trim();
        const model = String(
          item.model ?? bomIndex.modelByUniq[uniq] ?? "",
        ).trim();
        const uom = String(bomIndex.uomByUniq[uniq] ?? "pcs").trim() || "pcs";
        const totalOrder = Number(item.quantity ?? 0);
        const itemUuid = String(item.id ?? `item-${idx}`);

        return {
          value: uniq,
          label: uniq,
          itemUuid,
          partNo,
          partName,
          model,
          totalOrder,
          uom,
        } satisfies UniqOption;
      })
      .filter((v): v is UniqOption => v !== null);

    const deduped = new Map<string, UniqOption>();
    mapped.forEach((m) => {
      if (!deduped.has(m.value)) deduped.set(m.value, m);
    });
    return Array.from(deduped.values());
  }, [apiEnabled, bomIndex, dnDetailQuery.data]);

  const selectedUniq = useMemo(
    () => uniqOptions.find((o) => o.value === draftUniq) ?? null,
    [draftUniq, uniqOptions],
  );

  const addDraftItem = () => {
    if (!draftUniq.trim()) {
      message.error("Uniq is required");
      return;
    }
    if (!draftQty || draftQty <= 0) {
      message.error("Quantity to deliver must be greater than 0");
      return;
    }
    const option = selectedUniq;
    if (!option) {
      message.error("Invalid uniq selection");
      return;
    }

    setRows((prev) => {
      const exists = prev.some(
        (r) => r.itemUuid === option.itemUuid || r.uniq === option.value,
      );
      if (exists) {
        message.warning("This UNIQ already exists in the review list");
        return prev;
      }
      return [
        ...prev,
        {
          key: `r-${option.itemUuid}`,
          itemUuid: option.itemUuid,
          uniq: option.value,
          partNo: option.partNo,
          partName: option.partName,
          model: option.model,
          totalOrder: option.totalOrder,
          totalDelivery: Math.min(draftQty, option.totalOrder || draftQty),
          uom: option.uom,
        },
      ];
    });

    setDraftUniq("");
    setDraftQty(0);
  };

  useEffect(() => {
    if (!apiEnabled) {
      if (!customerId) setCustomerId(1);
      if (!customerName) setCustomerName("PT Endpoint Check Customer");
      if (!customerOrderUuid)
        setCustomerOrderUuid("2f057f77-9006-4ffe-afd6-942133012bb3");
      return;
    }

    const order = dnDetailQuery.data;
    if (!order || !order.id) return;

    setCustomerId(toPositiveInt(order.customer_id) ?? null);
    setCustomerName(order.customer_name ?? "");

    if (!deliveryDate && order.document_date) {
      const parsed = dayjs(order.document_date);
      if (parsed.isValid()) setDeliveryDate(parsed);
    }
  }, [
    apiEnabled,
    customerId,
    customerName,
    deliveryDate,
    dnDetailQuery.data,
    customerOrderUuid,
  ]);

  const cycleLabel = useMemo(() => {
    if (!cycle) return "-";
    const normalized = String(cycle).toLowerCase();
    if (normalized === "weekly") return "Weekly";
    if (normalized === "monthly") return "Monthly";
    return "Daily";
  }, [cycle]);

  const deliveryDateLabel = useMemo(() => {
    if (!deliveryDate) return "-";
    return deliveryDate.format("MM/DD/YYYY");
  }, [deliveryDate]);

  const selectedOrderReference = useMemo(() => {
    return String(
      dnRefOptions.find((o) => o.value === customerOrderUuid)?.label ?? "",
    ).trim();
  }, [dnRefOptions, customerOrderUuid]);

  const columns: ColumnsType<ReviewRow> = [
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      width: 120,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Part No",
      dataIndex: "partNo",
      key: "partNo",
      width: 140,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      width: 180,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Model",
      dataIndex: "model",
      key: "model",
      width: 160,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Total Order",
      dataIndex: "totalOrder",
      key: "totalOrder",
      width: 120,
      render: (v: number) => <span className="text-sm text-gray-800">{v}</span>,
    },
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
            setRows((prev) =>
              prev.map((r) =>
                r.key === record.key ? { ...r, totalDelivery: v } : r,
              ),
            );
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
            onClick={() => {
              setDraftUniq(record.uniq);
              setDraftQty(record.totalDelivery);
              setRows((prev) => prev.filter((r) => r.key !== record.key));
            }}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() =>
              setRows((prev) => prev.filter((r) => r.key !== record.key))
            }
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <style jsx global>{`
        .ds-highlight .ant-select-selector {
          background: #fef9c3 !important;
          border-color: #fde68a !important;
        }
        .ds-highlight .ant-input-number {
          background: #fef9c3 !important;
          border-color: #fde68a !important;
        }
        .ds-highlight .ant-input-number-input {
          background: transparent !important;
        }
      `}</style>

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
            <Button
              className="!rounded-lg"
              onClick={() => router.push("/delivery-scheduling")}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<SaveOutlined />}
              onClick={() => {
                if (!customerOrderUuid || !selectedOrderReference) {
                  message.error("DN Reference is required");
                  return;
                }
                if (!customerId || !customerName.trim()) {
                  message.error("Customer is required");
                  return;
                }
                if (!rows.length) {
                  message.error("Items are required");
                  return;
                }

                const req = {
                  customer_order_document_uuid: customerOrderUuid,
                  customer_order_reference: selectedOrderReference,
                  customer_id: customerId,
                  customer_name: customerName.trim(),
                  delivery_date: (deliveryDate ?? dayjs()).format("YYYY-MM-DD"),
                  cycle,
                  priority,
                  transport_company: transportCompany,
                  vehicle_number: vehicleNumber,
                  driver_name: driverName,
                  driver_contact: driverContact,
                  departure_at: departureAt
                    ? formatOffsetDateTime(departureAt)
                    : "",
                  arrival_at: arrivalAt ? formatOffsetDateTime(arrivalAt) : "",
                  delivery_instructions: deliveryInstructions,
                  items: rows.map((r) => ({
                    customer_order_document_item_uuid: r.itemUuid,
                    item_uniq_code: r.uniq,
                    part_no: r.partNo,
                    part_name: r.partName,
                    model: r.model,
                    total_order: Number(r.totalOrder ?? 0),
                    total_delivery: Number(r.totalDelivery ?? 0),
                    uom: r.uom,
                  })),
                };

                if (!apiEnabled) {
                  message.success("Saved delivery schedule (mock)");
                  router.push("/delivery-scheduling");
                  return;
                }

                createDeliverySchedule(req)
                  .unwrap()
                  .then(() => {
                    message.success("Saved delivery schedule");
                    router.push("/delivery-scheduling");
                  })
                  .catch((error) =>
                    message.error(
                      getApiErrorMessage(
                        error,
                        "Failed to save delivery schedule",
                      ),
                    ),
                  );
              }}
              loading={createState.isLoading}
            >
              Save Delivery Schedule
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">
            Add New Delivery Schedule
          </div>
          <div className="text-sm text-gray-500">
            Create DN for incoming raw material receipt and tracking • 1 entry
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-gray-900">
                Step 1: Input Delivery Date
              </div>
              <div className="text-sm text-gray-500">
                Select Delivery Note Number as Reference
              </div>
            </div>
            <Tag
              color="blue"
              className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
            >
              Required
            </Tag>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs font-semibold text-gray-500">
                PO/DN Reference
              </div>
              <Select
                value={customerOrderUuid}
                onChange={(v) => {
                  setCustomerOrderUuid(v);
                  setRows([]);
                  setDraftUniq("");
                  setDraftQty(0);
                }}
                options={dnRefOptions}
                className="w-full !rounded-lg mt-1"
                loading={
                  poListQuery.isFetching ||
                  dnListQuery.isFetching ||
                  soListQuery.isFetching ||
                  dnDetailQuery.isFetching
                }
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Customer
              </div>
              <Select
                value={customerId ?? undefined}
                onChange={(v, option) => {
                  const id = toPositiveInt(v);
                  if (!id) {
                    setCustomerId(null);
                    setCustomerName("");
                    return;
                  }
                  setCustomerId(id);
                  setCustomerName(
                    String(
                      (option as { label?: string } | undefined)?.label ?? "",
                    ).trim(),
                  );
                }}
                options={customerSelectOptions}
                className="w-full !rounded-lg mt-1"
                loading={customersQuery.isFetching}
                showSearch
                allowClear
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
              />
            </div>

            <div className="">
              <div className="text-xs font-semibold text-gray-500">Uniq</div>
              <Select
                value={draftUniq || undefined}
                onChange={(v) => {
                  const nextUniq = String(v ?? "");
                  setDraftUniq(nextUniq);
                  const matched = uniqOptions.find((o) => o.value === nextUniq);
                  setDraftQty(
                    matched?.totalOrder ? Math.max(0, matched.totalOrder) : 0,
                  );
                }}
                options={[
                  { label: "Select Uniq", value: "" },
                  ...uniqOptions.map((u) => ({
                    label: u.label,
                    value: u.value,
                  })),
                ]}
                className="w-full !rounded-lg mt-1"
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500">Model</div>
              <Input
                className="!rounded-lg mt-1"
                value={selectedUniq?.model ?? ""}
                disabled
                placeholder="Auto-filled"
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Part Name
              </div>
              <Input
                className="!rounded-lg mt-1"
                value={selectedUniq?.partName ?? ""}
                disabled
                placeholder="Auto-filled"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Part Number
              </div>
              <Input
                className="!rounded-lg mt-1"
                value={selectedUniq?.partNo ?? ""}
                disabled
                placeholder="Auto-filled"
              />
            </div>

            <div className="">
              <div className="text-xs font-semibold text-gray-500">
                Quantity to Deliver
              </div>
              <InputNumber
                className="w-full !rounded-lg mt-1"
                min={0}
                value={draftQty}
                onChange={(v) => setDraftQty(typeof v === "number" ? v : 0)}
                placeholder="0"
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500">
                Cycle Pengiriman
              </div>
              <Select
                className="w-full !rounded-lg mt-1"
                value={cycle}
                onChange={(v) => setCycle(v)}
                options={[
                  { label: "Daily", value: "daily" },
                  { label: "Weekly", value: "weekly" },
                  { label: "Monthly", value: "monthly" },
                ]}
              />

              <div className="mt-3 flex justify-end">
                <Button
                  type="primary"
                  className="!rounded-lg"
                  icon={<PlusOutlined />}
                  onClick={addDraftItem}
                >
                  + Add Item
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-gray-900">
                Step 2: Review Items
              </div>
              <div className="text-sm text-gray-500">
                Review Items for Delivery
              </div>
            </div>
            <Tag
              color="blue"
              className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
            >
              Required
            </Tag>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Customer
              </div>
              <div className="text-sm text-gray-900 mt-1">
                {customerName || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Delivery Schedule
              </div>
              <div className="text-sm text-gray-900 mt-1">
                {deliveryDateLabel}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">Cycle</div>
              <div className="text-sm text-gray-900 mt-1">{cycleLabel}</div>
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
