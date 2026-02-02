"use client";

import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  DatePicker,
  Form,
  InputNumber,
  Select,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";

const { Title } = Typography;

type ScrapEntry = {
  uniq?: string;
  packingNumber?: string;
  dateReceived?: Dayjs;
  scrapType?: string;
  scrapReason?: string;
  quantity?: number;
  weight?: number;
  uom?: string;
};

type ScrapStockCreateForm = {
  entries: ScrapEntry[];
};

const uniqOptions = [
  { label: "LV-001", value: "LV-001" },
  { label: "LV-002", value: "LV-002" },
  { label: "LV-003", value: "LV-003" },
];

const packingOptions = [
  { label: "WH-FG-029", value: "WH-FG-029" },
  { label: "WH-FG-030", value: "WH-FG-030" },
  { label: "WH-FG-031", value: "WH-FG-031" },
];

const scrapTypeOptions = [
  { label: "Setting Machine Scrap", value: "Setting Machine Scrap" },
  { label: "Process Scrap", value: "Process Scrap" },
  { label: "Product Return Scrap", value: "Product Return Scrap" },
];

const scrapReasonOptions = [
  { label: "Dump", value: "Dump" },
  { label: "Inventory", value: "Inventory" },
  { label: "Sell", value: "Sell" },
];

const uomOptions = [
  { label: "pcs", value: "pcs" },
  { label: "kg", value: "kg" },
  { label: "box", value: "box" },
];

function isEntryComplete(entry: ScrapEntry) {
  return Boolean(
    entry.uniq &&
      entry.packingNumber &&
      entry.dateReceived &&
      entry.scrapType &&
      entry.scrapReason &&
      typeof entry.quantity === "number" &&
      typeof entry.weight === "number" &&
      entry.uom
  );
}

export default function CreateScrapStockPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<ScrapStockCreateForm>();

  const watchedEntries = Form.useWatch("entries", form);
  const entries = watchedEntries ?? [];
  const entryCount = Math.max(entries.length, 1);
  const completeCount = entries.filter(isEntryComplete).length;

  const handleSave = async () => {
    try {
      await form.validateFields();
      messageApi.success("Scrap Stock Database saved");
      router.push("/scrap-stock");
    } catch {
      // validation errors shown by antd
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {contextHolder}

      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-3 flex items-center justify-between">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push("/scrap-stock")}
            className="text-gray-600 hover:text-gray-800"
          >
            Back to Scrap Stock
          </Button>

          <div className="flex-1 px-6">
            <Title level={4} className="!mb-0">
              Scrap Stock Database
            </Title>
            <div className="text-sm text-gray-500">
              Create Scrap Stock Database <span className="px-2">•</span> {entryCount} entry
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => router.push("/scrap-stock")}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              Save Scrap Stock Database
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <Form<ScrapStockCreateForm>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ entries: [{}] }}
        >
          <Form.List name="entries">
            {(fields, { add }) => (
              <>
                {fields.map((field, idx) => (
                  <Card key={field.key} className="!rounded-xl" styles={{ body: { padding: 20 } }}>
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <div className="text-lg font-semibold text-gray-900">
                          Add Scrap Stock #{idx + 1}
                        </div>
                        <div className="text-sm text-gray-500">Add Scrap Stock entry.</div>
                      </div>
                      <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700">
                        Entry {idx + 1}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Form.Item
                        name={[field.name, "uniq"]}
                        label={
                          <span className="inline-flex items-center gap-1">
                            Uniq <span className="text-blue-600 text-xs">ⓘ</span>
                          </span>
                        }
                        rules={[{ required: true, message: "Select uniq" }]}
                      >
                        <Select placeholder="Select Uniq" options={uniqOptions} />
                      </Form.Item>

                      <Form.Item
                        name={[field.name, "packingNumber"]}
                        label="Packing Number"
                        rules={[{ required: true, message: "Select packing number" }]}
                      >
                        <Select placeholder="Select Packing Number" options={packingOptions} />
                      </Form.Item>

                      <Form.Item
                        name={[field.name, "dateReceived"]}
                        label="Date Received"
                        rules={[{ required: true, message: "Select date received" }]}
                      >
                        <DatePicker className="w-full" placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
                      </Form.Item>

                      <Form.Item
                        name={[field.name, "scrapType"]}
                        label="Scrap Type"
                        rules={[{ required: true, message: "Select scrap type" }]}
                      >
                        <Select placeholder="Select Scrap Type" options={scrapTypeOptions} />
                      </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Form.Item
                        name={[field.name, "scrapReason"]}
                        label="Scrap Reason"
                        rules={[{ required: true, message: "Select reason" }]}
                      >
                        <Select placeholder="Select Reason" options={scrapReasonOptions} />
                      </Form.Item>

                      <Form.Item
                        name={[field.name, "quantity"]}
                        label="Quantity"
                        rules={[{ required: true, message: "Enter quantity" }]}
                      >
                        <InputNumber min={0} className="w-full" placeholder="300" />
                      </Form.Item>

                      <Form.Item
                        name={[field.name, "weight"]}
                        label="Weight"
                        rules={[{ required: true, message: "Enter weight" }]}
                      >
                        <InputNumber min={0} className="w-full" placeholder="10" />
                      </Form.Item>

                      <Form.Item
                        name={[field.name, "uom"]}
                        label="Unit of Measurement"
                        rules={[{ required: true, message: "Select unit" }]}
                      >
                        <Select placeholder="Select Unit" options={uomOptions} />
                      </Form.Item>
                    </div>
                  </Card>
                ))}

                <div className="flex justify-center">
                  <Button icon={<PlusOutlined />} onClick={() => add({})}>
                    Add Another Scrap Stock
                  </Button>
                </div>
              </>
            )}
          </Form.List>
        </Form>

        <Card className="!rounded-xl" styles={{ body: { padding: 18 } }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Summary</div>
              <div className="text-sm text-gray-500">{entryCount} Scrap Stock Entry ready to be saved</div>
            </div>
            <div className="flex items-center gap-10">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{entryCount}</div>
                <div className="text-xs text-gray-500">Entries</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{completeCount}</div>
                <div className="text-xs text-gray-500">Complete</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
