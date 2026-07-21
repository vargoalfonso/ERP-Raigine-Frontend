"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  message,
} from "antd";
import dayjs from "dayjs";
import { ArrowLeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  type ApprovedDeliveryScheduleDnOption,
  useCreateCustomerDeliveryNoteMutation,
  useLazyGetApprovedDeliveryScheduleDnAutocompleteQuery,
} from "@/lib/api/delivery-schedule/api";
import { useListCustomersQuery } from "@/lib/api/customers/api";

type DeliveryItemFormRow = {
  source_dn_number?: string;
  item_uniq_code?: string;
  product_name?: string;
  part_number?: string;
  model?: string;
  fg_location?: string;
  quantity?: number;
  uom?: string;
};

type EntryFormValues = {
  schedule_id?: string;
  schedule_date?: dayjs.Dayjs | null;

  customer_id?: number;
  customer_name?: string;
  po_number?: string;
  customer_contact_person?: string;
  customer_phone_number?: string;
  delivery_address?: string;
  total_items?: number;
  total_quantity?: number;

  priority?: string;
  transport_company?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_contact?: string;
  departure_at?: dayjs.Dayjs | null;
  arrival_at?: dayjs.Dayjs | null;
  status?: string;
  approval_status?: string;

  delivery_instructions?: string;
  remarks?: string;

  items?: DeliveryItemFormRow[];
};

type FormValues = {
  entries: EntryFormValues[];
};

const compact = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  return value;
};

const stripEmpty = (obj: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => compact(v) !== undefined));

const formatDateTime = (value: dayjs.Dayjs | null | undefined, format: string) =>
  value ? value.format(format) : undefined;

const DN_AUTOCOMPLETE_PAGE_SIZE = 10;

const toFormDate = (value?: string): dayjs.Dayjs | null => {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
};

export default function DeliverySchedulingDnCreationCreatePage() {
  const router = useRouter();
  const apiEnabled = Boolean(apiBaseUrl);

  const [form] = Form.useForm<FormValues>();

  const [createCustomerDeliveryNote, createState] = useCreateCustomerDeliveryNoteMutation();
  const [loadApprovedDnOptions, approvedDnOptionsState] = useLazyGetApprovedDeliveryScheduleDnAutocompleteQuery();
  const [approvedDnOptions, setApprovedDnOptions] = useState<ApprovedDeliveryScheduleDnOption[]>([]);
  const [approvedDnSearch, setApprovedDnSearch] = useState("");
  const [approvedDnPage, setApprovedDnPage] = useState(0);
  const [hasMoreApprovedDns, setHasMoreApprovedDns] = useState(true);
  const approvedDnRequestInFlight = useRef(false);

  const customersQuery = useListCustomersQuery(undefined, { skip: !apiEnabled });
  useEffect(() => {
    if (customersQuery.error) {
      message.error(getApiErrorMessage(customersQuery.error, "Failed to load customers"));
    }
  }, [customersQuery.error]);

  const customers = customersQuery.data ?? [];
  const customerOptions = useMemo(() => {
    return customers
      .map((c) => {
        const id = c.row_id ?? c.id ?? c.customer_id;
        const name = String(c.customer_name ?? "").trim();
        if (id === undefined || id === null || !name) return null;
        return { value: String(id), label: name };
      })
      .filter((v): v is { value: string; label: string } => Boolean(v));
  }, [customers]);

  const customerById = useMemo(() => {
    const map = new Map<string, (typeof customers)[number]>();
    for (const c of customers) {
      [c.row_id, c.id, c.customer_id, c.customer_code]
        .filter((id): id is string | number => id !== undefined && id !== null && String(id).trim() !== "")
        .forEach((id) => map.set(String(id), c));
    }
    return map;
  }, [customers]);

  const updateEntryTotals = (entryIndex: number) => {
    const entryItems = (form.getFieldValue(["entries", entryIndex, "items"]) ?? []) as DeliveryItemFormRow[];
    const totalItems = entryItems.filter((it) => String(it?.item_uniq_code ?? "").trim()).length;
    const totalQuantity = entryItems.reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0);
    form.setFieldValue(["entries", entryIndex, "total_items"], totalItems);
    form.setFieldValue(["entries", entryIndex, "total_quantity"], totalQuantity);
  };

  const fetchApprovedDnOptions = useCallback(
    async (page: number, search: string, replace: boolean) => {
      if (!apiEnabled || approvedDnRequestInFlight.current) return;

      approvedDnRequestInFlight.current = true;
      try {
        const response = await loadApprovedDnOptions({
          search: search.trim() || undefined,
          page,
          limit: DN_AUTOCOMPLETE_PAGE_SIZE,
        }).unwrap();
        const nextItems = response.data.items;

        setApprovedDnOptions((previous) => {
          if (replace) return nextItems;
          const byDnNumber = new Map(previous.map((item) => [item.dnNumber, item]));
          nextItems.forEach((item) => byDnNumber.set(item.dnNumber, item));
          return Array.from(byDnNumber.values());
        });
        setApprovedDnPage(response.data.pagination.page);
        setHasMoreApprovedDns(response.data.pagination.page < response.data.pagination.totalPages);
      } catch (error) {
        if (replace) {
          message.error(getApiErrorMessage(error, "Failed to load approved DN options"));
        }
      } finally {
        approvedDnRequestInFlight.current = false;
      }
    },
    [apiEnabled, loadApprovedDnOptions],
  );

  useEffect(() => {
    if (!apiEnabled) {
      setApprovedDnOptions([]);
      setApprovedDnPage(0);
      setHasMoreApprovedDns(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      void fetchApprovedDnOptions(1, approvedDnSearch, true);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [apiEnabled, approvedDnSearch, fetchApprovedDnOptions]);

  const approvedDnSelectOptions = useMemo(
    () => approvedDnOptions.map((option) => ({
      value: option.dnNumber,
      label: `${option.dnNumber} — ${option.customerName || option.scheduleId || "-"}`,
    })),
    [approvedDnOptions],
  );

  const onSelectApprovedDn = (entryIndex: number, dnNumber?: string) => {
    const selected = approvedDnOptions.find((option) => option.dnNumber === dnNumber);
    if (!selected) return;

    const customer = selected.customerId == null ? undefined : customerById.get(String(selected.customerId));
    const fallbackContactPerson = String(customer?.customer_name ?? "").trim();
    const currentEntry = form.getFieldValue(["entries", entryIndex]) ?? {};
    form.setFieldValue(["entries", entryIndex], {
      ...currentEntry,
      schedule_id: selected.scheduleId,
      schedule_date: toFormDate(selected.deliveryDate || selected.scheduleDate),
      customer_id: selected.customerId,
      customer_name: selected.customerName,
      po_number: selected.poNumber,
      customer_contact_person: selected.customerContactPerson || fallbackContactPerson,
      customer_phone_number: selected.customerPhoneNumber,
      delivery_address: selected.deliveryAddress,
      priority: selected.priority || "normal",
      transport_company: selected.transportCompany,
      vehicle_number: selected.vehicleNumber,
      driver_name: selected.driverName,
      driver_contact: selected.driverContact,
      departure_at: toFormDate(selected.departureAt),
      arrival_at: toFormDate(selected.arrivalAt),
      delivery_instructions: selected.deliveryInstructions,
      items: selected.items.map((item) => ({
        source_dn_number: selected.dnNumber,
        item_uniq_code: item.itemUniqCode,
        product_name: item.productName,
        part_number: item.partNumber,
        model: item.model,
        fg_location: item.fgLocation,
        quantity: item.quantity,
        uom: item.uom,
      })),
    });
    updateEntryTotals(entryIndex);
  };

  const onSave = async (values: FormValues) => {
    const entries = values.entries ?? [];
    if (!entries.length) {
      message.error("At least 1 entry is required");
      return;
    }

    const payloads = entries.map((entry) => {
      const items = (entry.items ?? []).filter((row) => String(row.item_uniq_code ?? "").trim());
      return stripEmpty({
        customer_id: typeof entry.customer_id === "number" ? entry.customer_id : undefined,
        customer_name: compact(entry.customer_name),
        po_number: compact(entry.po_number),
        customer_contact_person: compact(entry.customer_contact_person),
        customer_phone_number: compact(entry.customer_phone_number),
        delivery_address: compact(entry.delivery_address),
        delivery_date: entry.schedule_date ? entry.schedule_date.format("YYYY-MM-DD") : undefined,
        priority: compact(entry.priority),
        transport_company: compact(entry.transport_company),
        vehicle_number: compact(entry.vehicle_number),
        driver_name: compact(entry.driver_name),
        driver_contact: compact(entry.driver_contact),
        departure_at: formatDateTime(entry.departure_at, "YYYY-MM-DDTHH:mm:ssZ"),
        arrival_at: formatDateTime(entry.arrival_at, "YYYY-MM-DDTHH:mm:ssZ"),
        status: compact(entry.status),
        approval_status: compact(entry.approval_status),
        delivery_instructions: compact(entry.delivery_instructions),
        remarks: compact(entry.remarks) ?? "",
        items: items.map((row) =>
          stripEmpty({
            item_uniq_code: compact(String(row.item_uniq_code ?? "").trim()),
            product_name: compact(row.product_name),
            part_number: compact(row.part_number),
            model: compact(row.model) ?? "",
            fg_location: compact(row.fg_location),
            quantity: typeof row.quantity === "number" ? row.quantity : Number(row.quantity ?? 0),
            uom: compact(row.uom),
          })
        ),
      });
    });

    const invalidIndex = payloads.findIndex((p) => {
      const record = p as Record<string, unknown>;
      const items = record.items as unknown;
      return !record.customer_id || !record.customer_name || !Array.isArray(items) || items.length === 0;
    });
    if (invalidIndex !== -1) {
      message.error(`Entry ${invalidIndex + 1}: Customer and at least 1 item are required`);
      return;
    }

    if (!apiEnabled) {
      message.success(`Saved ${payloads.length} entry (mock)`);
      router.push("/delivery-scheduling?tab=dn");
      return;
    }

    try {
      for (let i = 0; i < payloads.length; i += 1) {
        await createCustomerDeliveryNote(payloads[i]).unwrap();
      }
      message.success(`Saved ${payloads.length} entry`);
      router.push("/delivery-scheduling?tab=dn");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to save DN Creation"));
    }
  };

  const entries = Form.useWatch("entries", form) ?? [];
  const completeCount = useMemo(() => {
    return (entries as EntryFormValues[]).filter((e) => {
      const okCustomer = typeof e.customer_id === "number" && Boolean(String(e.customer_name ?? "").trim());
      const itemCount = (e.items ?? []).filter((it) => String(it.item_uniq_code ?? "").trim()).length;
      return okCustomer && itemCount > 0;
    }).length;
  }, [entries]);

  return (
    <div className="min-h-screen bg-[#EAF3FF] p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4 mb-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => router.push("/delivery-scheduling?tab=dn")}
          >
            <ArrowLeftOutlined />
            <span>Back to Delivery Scheduling</span>
          </button>

          <div className="flex items-center gap-2">
            <Button className="!rounded-md" onClick={() => router.push("/delivery-scheduling?tab=dn")}>
              Cancel
            </Button>
            <Button
              type="primary"
              className="!rounded-md"
              icon={<SaveOutlined />}
              onClick={() => form.submit()}
              loading={createState.isLoading}
            >
              Save
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="text-xl font-semibold text-gray-900">Add Delivery Note</div>
          <div className="text-sm text-gray-500">
            Create DN for delivery note creation and tracking
          </div>
        </div>

        <Form<FormValues>
          form={form}
          layout="vertical"
          initialValues={{
            entries: [
              {
                schedule_id: "",
                schedule_date: null,
                customer_id: undefined,
                customer_name: "",
                po_number: "",
                customer_contact_person: "",
                customer_phone_number: "",
                delivery_address: "",
                total_items: 0,
                total_quantity: 0,
                priority: "normal",
                transport_company: "",
                vehicle_number: "",
                driver_name: "",
                driver_contact: "",
                departure_at: null,
                arrival_at: null,
                status: "created",
                approval_status: "pending",
                delivery_instructions: "",
                remarks: "",
                items: [{ item_uniq_code: undefined, product_name: "", part_number: "", model: "", fg_location: "WH-FG-A01", quantity: 0, uom: "" }],
              },
            ],
          }}
          onFinish={onSave}
        >
          <Form.List name="entries">
            {(entryFields, { add: addEntry, remove: removeEntry }) => (
              <>
                {entryFields.map((entryField, entryIndex) => (
                  <div key={entryField.key} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <div className="text-base font-semibold text-gray-900">Add Delivery Note #{entryIndex + 1}</div>
                        <div className="text-xs text-gray-500">Create DN for delivery note creation and tracking</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag className="!rounded-md">Entry {entryIndex + 1}</Tag>
                        {entryFields.length > 1 && (
                          <Button danger onClick={() => removeEntry(entryField.name)}>
                            Remove Entry
                          </Button>
                        )}
                      </div>
                    </div>

                    <Form.Item name={[entryField.name, "customer_id"]} hidden>
                      <Input />
                    </Form.Item>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Form.Item
                        label="Schedule ID"
                        name={[entryField.name, "schedule_id"]}
                        className="md:col-span-2"
                      >
                        <Input placeholder="DS-2024-001" />
                      </Form.Item>

                      <Form.Item
                        label="Schedule Date"
                        name={[entryField.name, "schedule_date"]}
                        className="md:col-span-2"
                      >
                        <DatePicker className="w-full" format="DD/MM/YYYY" />
                      </Form.Item>

                      <Form.Item
                        label="Customer Name"
                        name={[entryField.name, "customer_name"]}
                        rules={[{ required: true, message: "Select Customer" }]}
                      >
                        <Select
                          placeholder="Select Customer"
                          options={customerOptions}
                          loading={customersQuery.isFetching}
                          showSearch
                          onChange={(value) => {
                            const idStr = String(value ?? "");
                            const customer = customerById.get(idStr);
                            const idNum = Number(idStr);
                            form.setFieldValue(["entries", entryField.name, "customer_id"], Number.isFinite(idNum) ? idNum : undefined);
                            if (customer) {
                              form.setFieldValue(["entries", entryField.name, "customer_name"], String(customer.customer_name ?? "").trim());
                              form.setFieldValue(["entries", entryField.name, "customer_contact_person"], String(customer.customer_name ?? "").trim());
                              form.setFieldValue(["entries", entryField.name, "customer_phone_number"], String(customer.phone_number ?? "").trim());
                              form.setFieldValue(["entries", entryField.name, "delivery_address"], String(customer.shipping_address ?? "").trim());
                            }
                          }}
                          filterOption={(input, option) =>
                            String(option?.label ?? "")
                              .toLowerCase()
                              .includes(input.trim().toLowerCase())
                          }
                        />
                      </Form.Item>

                      <Form.Item label="PO Number" name={[entryField.name, "po_number"]}>
                        <Input placeholder="DN-2026-0001" />
                      </Form.Item>

                      <Form.Item label="Customer Contact Person" name={[entryField.name, "customer_contact_person"]}>
                        <Input placeholder="Sari Dewi" />
                      </Form.Item>

                      <Form.Item label="Customer Phone Number" name={[entryField.name, "customer_phone_number"]}>
                        <Input placeholder="+62 812 0000 0000" />
                      </Form.Item>

                      <Form.Item label="Delivery Address" name={[entryField.name, "delivery_address"]}>
                        <Input placeholder="Jl. Raya No.10, Jakarta" />
                      </Form.Item>

                      <Form.Item label="Total Items" name={[entryField.name, "total_items"]}>
                        <Input disabled />
                      </Form.Item>

                      <Form.Item label="Total Quantity" name={[entryField.name, "total_quantity"]}>
                        <Input disabled />
                      </Form.Item>

                      <Form.Item label="Priority" name={[entryField.name, "priority"]}>
                        <Select
                          placeholder="Select Priority"
                          options={[
                            { value: "low", label: "Low" },
                            { value: "normal", label: "Normal" },
                            { value: "high", label: "High" },
                            { value: "urgent", label: "Urgent" },
                          ]}
                        />
                      </Form.Item>
                    </div>

                    <div className="mt-2">
                      <div className="text-sm font-semibold text-gray-900">Delivery Items</div>
                      <div className="text-xs text-gray-500">Select items for this delivery note</div>
                    </div>

                    <Form.List name={[entryField.name, "items"]}>
                      {(fields, { add, remove }) => (
                        <div className="mt-3 space-y-3">
                          {fields.map((field, index) => (
                            <div key={field.key} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                              <Form.Item
                                {...field}
                                label={index === 0 ? "DN Number" : ""}
                                name={[field.name, "source_dn_number"]}
                                className="mb-0"
                                rules={[{ required: index === 0, message: "Select DN Number" }]}
                              >
                                <Select
                                  allowClear
                                  showSearch
                                  filterOption={false}
                                  placeholder="Select DN Number"
                                  options={approvedDnSelectOptions}
                                  loading={approvedDnOptionsState.isFetching}
                                  notFoundContent={approvedDnOptionsState.isFetching ? "Loading approved DNs..." : "No approved DN found"}
                                  onSearch={setApprovedDnSearch}
                                  onChange={(value) => onSelectApprovedDn(entryIndex, typeof value === "string" ? value : undefined)}
                                  onPopupScroll={(event) => {
                                    const target = event.currentTarget;
                                    const reachedEnd = target.scrollTop + target.clientHeight >= target.scrollHeight - 24;
                                    if (reachedEnd && hasMoreApprovedDns && !approvedDnOptionsState.isFetching) {
                                      void fetchApprovedDnOptions(approvedDnPage + 1, approvedDnSearch, false);
                                    }
                                  }}
                                />
                              </Form.Item>

                              <Form.Item {...field} name={[field.name, "item_uniq_code"]} hidden>
                                <Input />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, "part_number"]} hidden>
                                <Input />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, "model"]} hidden>
                                <Input />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, "uom"]} hidden>
                                <Input />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, "fg_location"]} hidden>
                                <Input />
                              </Form.Item>

                              <Form.Item
                                {...field}
                                label={index === 0 ? "Product Name" : ""}
                                name={[field.name, "product_name"]}
                                className="mb-0"
                              >
                                <Input placeholder="Product Name" disabled />
                              </Form.Item>

                              <Form.Item
                                {...field}
                                label={index === 0 ? "Total Quantity" : ""}
                                name={[field.name, "quantity"]}
                                className="mb-0"
                              >
                                <InputNumber
                                  className="w-full"
                                  min={0}
                                  onChange={() => updateEntryTotals(entryIndex)}
                                />
                              </Form.Item>

                              <div className="flex items-center gap-2">
                                <Button
                                  type="primary"
                                  className="w-full"
                                  onClick={() => {
                                    add({ item_uniq_code: undefined, product_name: "", part_number: "", model: "", fg_location: "WH-FG-A01", quantity: 0, uom: "" });
                                  }}
                                >
                                  Add More Delivery Items
                                </Button>
                                {fields.length > 1 && (
                                  <Button
                                    danger
                                    onClick={() => {
                                      remove(field.name);
                                      updateEntryTotals(entryIndex);
                                    }}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Form.List>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                      <Form.Item label="Transport Company" name={[entryField.name, "transport_company"]}>
                        <Input placeholder="PT Logistik Nusantara" />
                      </Form.Item>
                      <Form.Item label="Vehicle Number" name={[entryField.name, "vehicle_number"]}>
                        <Input placeholder="B 1234 XYZ" />
                      </Form.Item>
                      <Form.Item label="Driver Name" name={[entryField.name, "driver_name"]}>
                        <Input placeholder="Budi Santoso" />
                      </Form.Item>
                      <Form.Item label="Driver Contact" name={[entryField.name, "driver_contact"]}>
                        <Input placeholder="+62 812 0000 0001" />
                      </Form.Item>

                      <Form.Item label="Departure Date & Time" name={[entryField.name, "departure_at"]}>
                        <DatePicker className="w-full" showTime />
                      </Form.Item>
                      <Form.Item label="Arrival Date & Time" name={[entryField.name, "arrival_at"]}>
                        <DatePicker className="w-full" showTime />
                      </Form.Item>
                      <Form.Item label="Status" name={[entryField.name, "status"]}>
                        <Select
                          placeholder="Select Status"
                          options={[
                            { value: "created", label: "Created" },
                            { value: "printed", label: "Printed" },
                            { value: "scanned", label: "Scanned" },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item label="Approval Status" name={[entryField.name, "approval_status"]}>
                        <Select
                          placeholder="Status From Manager"
                          options={[
                            { value: "pending", label: "Pending" },
                            { value: "approved", label: "Approved" },
                            { value: "rejected", label: "Rejected" },
                          ]}
                        />
                      </Form.Item>
                    </div>

                    <Form.Item
                      label="Remarks & Special Instructions"
                      name={[entryField.name, "delivery_instructions"]}
                      className="mt-2"
                    >
                      <Input.TextArea rows={4} placeholder="Require QC certificate" />
                    </Form.Item>
                    <Form.Item name={[entryField.name, "remarks"]} hidden>
                      <Input />
                    </Form.Item>
                  </div>
                ))}

                <div className="flex justify-center mt-6">
                  <Button
                    icon={<PlusOutlined />}
                    className="!rounded-md"
                    onClick={() => {
                      addEntry({
                        schedule_id: "",
                        schedule_date: null,
                        customer_id: undefined,
                        customer_name: "",
                        po_number: "",
                        customer_contact_person: "",
                        customer_phone_number: "",
                        delivery_address: "",
                        total_items: 0,
                        total_quantity: 0,
                        priority: "normal",
                        transport_company: "",
                        vehicle_number: "",
                        driver_name: "",
                        driver_contact: "",
                        departure_at: null,
                        arrival_at: null,
                        status: "created",
                        approval_status: "pending",
                        delivery_instructions: "",
                        remarks: "",
                        items: [{ item_uniq_code: undefined, product_name: "", part_number: "", model: "", fg_location: "WH-FG-A01", quantity: 0, uom: "" }],
                      });
                    }}
                  >
                    Add Another Schedule
                  </Button>
                </div>
              </>
            )}
          </Form.List>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Summary</div>
                <div className="text-xs text-gray-500">
                  {entries.length} Schedule {entries.length === 1 ? "Entry" : "Entries"} ready to be saved
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">{entries.length}</div>
                <div className="text-xs text-gray-500">Entries</div>
                <div className="text-xs text-gray-500">{completeCount} Complete</div>
              </div>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );

}
