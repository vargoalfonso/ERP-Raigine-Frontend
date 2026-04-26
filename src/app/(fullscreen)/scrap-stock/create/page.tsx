"use client";

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
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { useCreateScrapStockMutation } from "@/lib/api/scrap-stock/api";

const { Title } = Typography;

type ScrapStockCreateForm = {
  uniq: string;
  part_number: string;
  part_name: string;
  model: string;
  packing_number: string;
  wo_number?: string | null;
  scrap_type: string;
  disposal_reason: string;
  quantity: number;
  uom: string;
  weight_kg: number;
  date_received: Dayjs;
  remarks?: string | null;
};

const scrapTypeOptions = [
  { label: "Setting Machine Scrap", value: "setting_machine_scrap" },
  { label: "Process Scrap", value: "process_scrap" },
  { label: "Product Return Scrap", value: "product_return_scrap" },
];

const disposalReasonOptions = [
  { label: "Dump", value: "dump" },
  { label: "Sell", value: "sell" },
  { label: "Inventory", value: "inventory" },
];

export default function CreateScrapStockPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<ScrapStockCreateForm>();
  const apiEnabled = Boolean(apiBaseUrl);

  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const bomIndex = buildBomUniqIndex(bomTreeRes?.data ?? []);
  const uniqOptions = bomIndex.uniqs.map((uniq) => {
    const partName = bomIndex.partNameByUniq[uniq];
    return {
      label: partName ? `${uniq} - ${partName}` : uniq,
      value: uniq,
    };
  });

  const [createScrapStock, createState] = useCreateScrapStockMutation();

  const onSelectUniq = (uniq: string) => {
    form.setFieldsValue({
      uniq,
      part_name: bomIndex.partNameByUniq[uniq] ?? "",
      part_number: bomIndex.partNumberByUniq[uniq] ?? "",
      model: bomIndex.modelByUniq[uniq] ?? "",
      uom: bomIndex.uomByUniq[uniq] ?? form.getFieldValue("uom"),
      weight_kg: bomIndex.weightKgByUniq[uniq] ?? form.getFieldValue("weight_kg") ?? 0,
    });
  };

  const handleSave = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true);

      if (!apiEnabled) {
        messageApi.success("Scrap Stock created locally");
        router.push("/scrap-stock");
        return;
      }

      await createScrapStock({
        uniq: values.uniq,
        part_number: values.part_number,
        part_name: values.part_name,
        model: values.model,
        packing_number: values.packing_number,
        wo_number: values.wo_number ? String(values.wo_number) : null,
        scrap_type: values.scrap_type,
        disposal_reason: values.disposal_reason,
        quantity: Number(values.quantity),
        uom: values.uom,
        weight_kg: Number(values.weight_kg ?? 0),
        date_received: dayjs(values.date_received).format("YYYY-MM-DD"),
        remarks: values.remarks ? String(values.remarks) : null,
      }).unwrap();

      messageApi.success("Scrap Stock created");
      router.push("/scrap-stock");
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      messageApi.error(getApiErrorMessage(err, "Failed to create scrap stock"));
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
              Create Scrap Stock <span className="px-2">•</span> 1 entry
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => router.push("/scrap-stock")}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={createState.isLoading}>
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
          initialValues={{
            weight_kg: 0,
            uom: "pcs",
            date_received: dayjs(),
          }}
        >
          <Card className="!rounded-xl" styles={{ body: { padding: 20 } }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Form.Item name="uniq" label="UNIQ" rules={[{ required: true, message: "Select UNIQ" }]}>
                <Select
                  placeholder="Select UNIQ from BOM"
                  options={uniqOptions}
                  showSearch
                  optionFilterProp="label"
                  onChange={onSelectUniq}
                />
              </Form.Item>

              <Form.Item name="packing_number" label="Packing Number" rules={[{ required: true, message: "Enter packing number" }]}>
                <Input placeholder="KBN-2026-0001-..." />
              </Form.Item>

              <Form.Item name="date_received" label="Date Received" rules={[{ required: true, message: "Select date received" }]}>
                <DatePicker className="w-full" placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
              </Form.Item>

              <Form.Item name="part_name" label="Part Name" rules={[{ required: true }]}>
                <Input disabled placeholder="Auto-filled" />
              </Form.Item>

              <Form.Item name="part_number" label="Part Number" rules={[{ required: true }]}>
                <Input disabled placeholder="Auto-filled" />
              </Form.Item>

              <Form.Item name="model" label="Model" rules={[{ required: true }]}>
                <Input disabled placeholder="Auto-filled" />
              </Form.Item>

              <Form.Item name="wo_number" label="WO Number (optional)">
                <Input placeholder="WO-2026-000001" />
              </Form.Item>

              <Form.Item name="scrap_type" label="Scrap Type" rules={[{ required: true, message: "Select scrap type" }]}>
                <Select placeholder="Select scrap type" options={scrapTypeOptions} />
              </Form.Item>

              <Form.Item name="disposal_reason" label="Disposal Reason" rules={[{ required: true, message: "Select disposal reason" }]}>
                <Select placeholder="Select reason" options={disposalReasonOptions} />
              </Form.Item>

              <Form.Item name="quantity" label="Quantity" rules={[{ required: true, message: "Enter quantity" }]}>
                <InputNumber min={0} className="w-full" placeholder="2" />
              </Form.Item>

              <Form.Item name="uom" label="UoM" rules={[{ required: true, message: "Enter uom" }]}>
                <Input placeholder="pcs" />
              </Form.Item>

              <Form.Item name="weight_kg" label="Weight (kg)" rules={[{ required: true, message: "Enter weight" }]}>
                <InputNumber min={0} className="w-full" placeholder="0" />
              </Form.Item>

              <Form.Item name="remarks" label="Remarks">
                <Input placeholder="manual add" />
              </Form.Item>
            </div>
          </Card>
        </Form>
      </div>
    </div>
  );
}
