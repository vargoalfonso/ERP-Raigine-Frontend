"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  SaveOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { FormInstance } from "antd";
import type { Dayjs } from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { useCreateSubconRawMaterialMutation } from "@/lib/api/subcon-raw-material/api";

const { Title, Text } = Typography;

type SubConStockReceivedFormData = {
  deliveryNotesNumber?: string;
  invoiceNumber?: string;
  uniq?: string;
  partNumber?: string;
  partName?: string;
  warehouseDestination?: string;
  periodPo?: string;
  dateReceived?: Dayjs | null;
  quantityReceived?: number;
  subconVendorName?: string;
  addStock?: number;
};

type FormEntry = {
  id: number;
  key: string;
  formRef: React.MutableRefObject<FormInstance | null>;
};

const SubConStockReceivedFormCard = ({
  entryNumber,
  formRef,
  showRemove,
  onRemove,
  uniqOptions,
  partNumberByUniq,
  partNameByUniq,
  assemblyCodeByUniq,
}: {
  entryNumber: number;
  formRef: React.MutableRefObject<FormInstance | null>;
  showRemove: boolean;
  onRemove: () => void;
  uniqOptions: { label: string; value: string }[];
  partNumberByUniq: Record<string, string | undefined>;
  partNameByUniq: Record<string, string | undefined>;
  assemblyCodeByUniq: Record<string, string | undefined>;
}) => {
  const [form] = Form.useForm<SubConStockReceivedFormData>();
  const watchedPartNumber = Form.useWatch("partNumber", form);
  const watchedPartName = Form.useWatch("partName", form);

  useEffect(() => {
    formRef.current = form;
  }, [form, formRef]);

  const applyUniqDerivedFields = (uniq: string | undefined) => {
    if (!uniq) return;
    const partNumber = partNumberByUniq?.[uniq];
    const partName = partNameByUniq?.[uniq];
    const assemblyCode = assemblyCodeByUniq?.[uniq];
    const currentWarehouse = form.getFieldValue("warehouseDestination");

    form.setFieldsValue({
      uniq,
      partNumber: partNumber ?? uniq,
      partName: partName ?? assemblyCode ?? uniq,
      ...(currentWarehouse ? {} : { warehouseDestination: "WH-001" }),
    });
  };

  return (
    <Card>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <Title level={4} className="!mb-0">
            Add Stock Received from Vendor #{entryNumber}
          </Title>
          <div className="flex items-center gap-2">
            <Text className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm">
              Entry {entryNumber}
            </Text>
            {showRemove && (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={onRemove}
                size="small"
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        <p className="text-gray-500">Sub Con materials stock received entry</p>
      </div>

      <Form form={form} layout="vertical">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Form.Item
            label="Delivery Notes Number"
            name="deliveryNotesNumber"
            rules={[{ required: true, message: "Please input delivery notes number!" }]}
          >
            <Input placeholder="DN-SUB-2025-001" size="large" />
          </Form.Item>

          <Form.Item
            label="Subcon Vendor's Invoice Number"
            name="invoiceNumber"
            rules={[{ required: true, message: "Please input invoice number!" }]}
          >
            <Input placeholder="INV-SUB-2025-001" size="large" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item
            label="Uniq"
            name="uniq"
            rules={[{ required: true, message: "Please select uniq!" }]}
            extra={
              watchedPartNumber || watchedPartName ? (
                <div className="mt-1">
                  {watchedPartNumber ? (
                    <Text type="secondary">Part Number: {watchedPartNumber}</Text>
                  ) : null}
                  {watchedPartName ? (
                    <div>
                      <Text type="secondary">Part Name: {watchedPartName}</Text>
                    </div>
                  ) : null}
                </div>
              ) : null
            }
          >
            <Select
              placeholder="Select UNIQ from BOM"
              size="large"
              allowClear
              showSearch
              options={uniqOptions}
              onChange={(value) => {
                if (!value) {
                  form.setFieldsValue({ uniq: undefined, partNumber: undefined, partName: undefined });
                  return;
                }
                applyUniqDerivedFields(value);
              }}
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="Part Number"
            name="partNumber"
            rules={[{ required: true, message: "Please input part number!" }]}
          >
            <Input placeholder="Auto from BOM" size="large" />
          </Form.Item>

          <Form.Item
            label="Part Name"
            name="partName"
            rules={[{ required: true, message: "Please input part name!" }]}
          >
            <Input placeholder="Auto from BOM" size="large" />
          </Form.Item>

          <Form.Item
            label="Warehouse Destination"
            name="warehouseDestination"
            rules={[{ required: true, message: "Please select warehouse!" }]}
            initialValue="WH-001"
          >
            <Select placeholder="WH-001" size="large" allowClear>
              <Select.Option value="WH-001">WH-001</Select.Option>
              <Select.Option value="WH-002">WH-002</Select.Option>
              <Select.Option value="WH-003">WH-003</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Period PO"
            name="periodPo"
            rules={[{ required: true, message: "Please select period!" }]}
          >
            <Select placeholder="Select Period" size="large" allowClear>
              <Select.Option value="2025-Q1">2025-Q1</Select.Option>
              <Select.Option value="2025-Q2">2025-Q2</Select.Option>
              <Select.Option value="2025-Q3">2025-Q3</Select.Option>
              <Select.Option value="2025-Q4">2025-Q4</Select.Option>
            </Select>
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item
            label="Date Received"
            name="dateReceived"
            rules={[{ required: true, message: "Please select date received!" }]}
          >
            <DatePicker className="w-full" size="large" />
          </Form.Item>

          <Form.Item
            label="Quantity Received"
            name="quantityReceived"
            rules={[{ required: true, message: "Please input quantity received!" }]}
          >
            <InputNumber
              placeholder="Quantity received here"
              size="large"
              style={{ width: "100%" }}
              min={0}
            />
          </Form.Item>

          <Form.Item
            label="Subcon Vendor Name"
            name="subconVendorName"
            rules={[{ required: true, message: "Please input vendor name!" }]}
          >
            <Input placeholder="Subcon Vendor Name" size="large" />
          </Form.Item>

          <Form.Item
            label="Add Stock"
            name="addStock"
            rules={[{ required: true, message: "Please input add stock!" }]}
          >
            <InputNumber placeholder="Add stock" size="large" style={{ width: "100%" }} min={0} />
          </Form.Item>
        </div>
      </Form>
    </Card>
  );
};

export default function CreateSubConStockReceivedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<FormEntry[]>([]);

  const [createSubconRawMaterial] = useCreateSubconRawMaterialMutation();

  const useApi = Boolean(apiBaseUrl);
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, { skip: !useApi });
  const bomIndex = useMemo(() => buildBomUniqIndex(bomTreeRes?.data ?? []), [bomTreeRes?.data]);
  const uniqOptions = bomIndex.options.length
    ? bomIndex.options
    : [
        { label: "SUB-001", value: "SUB-001" },
        { label: "SUB-002", value: "SUB-002" },
        { label: "SUB-003", value: "SUB-003" },
      ];

  useEffect(() => {
    if (entries.length === 0) {
      setEntries([{ id: 1, key: "entry-1", formRef: { current: null } }]);
    }
  }, [entries.length]);

  const completeCount = useMemo(() => {
    return entries.filter((e) => {
      const form = e.formRef.current;
      if (!form) return false;
      const v = form.getFieldsValue() as SubConStockReceivedFormData;
      return (
        v.deliveryNotesNumber &&
        v.invoiceNumber &&
        v.uniq &&
        v.partNumber &&
        v.partName &&
        v.warehouseDestination &&
        v.periodPo &&
        v.dateReceived &&
        typeof v.quantityReceived === "number" &&
        v.subconVendorName &&
        typeof v.addStock === "number"
      );
    }).length;
  }, [entries]);

  const addEntry = () => {
    const nextId = entries.length + 1;
    setEntries((prev) => [
      ...prev,
      { id: nextId, key: `entry-${nextId}`, formRef: { current: null } },
    ]);
  };

  const removeEntry = (id: number) => {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const saveAll = async () => {
    setLoading(true);
    try {
      for (const entry of entries) {
        const form = entry.formRef.current;
        if (!form) continue;
        await form.validateFields();

        const v = form.getFieldsValue() as SubConStockReceivedFormData;
        if (useApi) {
          await createSubconRawMaterial({
            uniq: v.uniq,
            item_name: v.partName ?? v.uniq,
            warehouse_code: v.warehouseDestination ?? "WH-001",
            quantity: Number(v.addStock ?? v.quantityReceived ?? 0),
            unit_measurement: "pcs",
            date: (v.dateReceived ? v.dateReceived.format("YYYY-MM-DD") : new Date().toISOString().slice(0, 10)),
            reference_no: v.deliveryNotesNumber || v.invoiceNumber,
            notes: [
              v.subconVendorName ? `Vendor: ${v.subconVendorName}` : null,
              v.periodPo ? `Period: ${v.periodPo}` : null,
              v.invoiceNumber ? `Invoice: ${v.invoiceNumber}` : null,
            ].filter(Boolean).join(" | ") || undefined,
          }).unwrap();
        }
      }

      message.success("Stock received saved");
      router.push("/sub-con-materials?mode=received");
    } catch {
      message.error("Please complete all required fields");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 justify-center pb-32">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="border-r border-gray-300">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push("/sub-con-materials")}
                className="flex items-center gap-2"
                type="text"
              >
                Back to SubCon Material Database
              </Button>
            </div>
            <div>
              <Title level={3} className="!mb-0">
                Add Stock Received from Vendor
              </Title>
              <Text className="text-gray-500">
                Sub Con Material Database • Stock Received from Vendor
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => router.push("/sub-con-materials")}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={saveAll}>
              Save Stock Received
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mx-auto w-full max-w-6xl">
          {entries.map((entry, index) => (
            <div key={entry.key} className={index !== entries.length - 1 ? "mb-12" : ""}>
              <SubConStockReceivedFormCard
                entryNumber={entry.id}
                formRef={entry.formRef}
                showRemove={entries.length > 1}
                onRemove={() => removeEntry(entry.id)}
                uniqOptions={uniqOptions}
                partNumberByUniq={bomIndex.partNumberByUniq ?? {}}
                partNameByUniq={bomIndex.partNameByUniq ?? {}}
                assemblyCodeByUniq={bomIndex.assemblyCodeByUniq ?? {}}
              />
            </div>
          ))}

          <div className="text-center my-6">
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              size="large"
              onClick={addEntry}
              className="w-full max-w-md"
            >
              Add Another Stock Received
            </Button>
          </div>
        </div>
      </div>

      <Card
        className="mt-6"
        style={{
          position: "fixed",
          left: 0,
          bottom: 0,
          width: "100vw",
          maxWidth: "100vw",
          zIndex: 50,
          borderRadius: 0,
          boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
          margin: 0,
          padding: 0,
        }}
        styles={{ body: { padding: "16px 48px" } }}
      >
        <div className="flex items-center justify-between">
          <div>
            <Title level={5} className="!mb-1">Summary</Title>
            <Text className="text-gray-600">
              {entries.length} Stock Received Entry ready to be saved
            </Text>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{entries.length}</div>
              <div className="text-sm text-gray-500">Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{completeCount}</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
