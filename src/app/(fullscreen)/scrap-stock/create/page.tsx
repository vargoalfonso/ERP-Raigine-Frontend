"use client";

import { useMemo } from "react";
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
import {
  useCreateScrapStockMutation,
  useGetScrapPackingOptionsQuery,
} from "@/lib/api/scrap-stock/api";
import {
  useGetFinishedGoodUniqOptionsQuery,
  type FinishedGoodUniqOption,
} from "@/lib/api/finished-goods/api";
import { useGetUomsQuery } from "@/lib/api/system-settings/api";

const { Title } = Typography;

type ScrapStockCreateForm = {
  uniq: string;
  part_number: string;
  part_name: string;
  model: string;
  packing_number: string;
  scrap_type: string;
  disposal_reason: string;
  quantity: number;
  uom: string;
  weight_kg: number;
  date_received: Dayjs;
  remarks?: string | null;
};

const disposalReasonOptions = [
  { label: "Dump", value: "dump" },
  { label: "Sell", value: "sell" },
  { label: "Inventory", value: "inventory" },
];

const scrapTypeOptions = [
  { label: "Setting Machine Scrap", value: "Setting Machine Scrap" },
  { label: "Process Scrap", value: "Process Scrap" },
  { label: "Product Return Scrap", value: "Product Return Scrap" },
];

export default function CreateScrapStockPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<ScrapStockCreateForm>();
  const apiEnabled = Boolean(apiBaseUrl);

  // UNIQ diambil dari Inventory Finished Goods (barang jadi), bukan BOM (perencanaan).
  const fgUniqQuery = useGetFinishedGoodUniqOptionsQuery(
    { q: "", limit: 500 },
    { skip: !apiEnabled },
  );
  const fgUniqItems = fgUniqQuery.data?.items ?? [];
  const fgUniqByCode = useMemo(() => {
    const map: Record<string, FinishedGoodUniqOption> = {};
    for (const it of fgUniqItems) map[it.uniq_code] = it;
    return map;
  }, [fgUniqItems]);

  // Packing number = daftar package finished dari scan produksi untuk UNIQ terpilih.
  const selectedUniq = Form.useWatch("uniq", form);
  const packingQuery = useGetScrapPackingOptionsQuery(selectedUniq ?? "", {
    skip: !apiEnabled || !selectedUniq,
  });
  const packingOptions = useMemo(
    () =>
      (packingQuery.data ?? [])
        .map((p) => String(p ?? "").trim())
        .filter(Boolean)
        .map((p) => ({ label: p, value: p })),
    [packingQuery.data],
  );

  const { data: uomsData, isFetching: isFetchingUoms } = useGetUomsQuery(
    undefined,
    { skip: !apiEnabled },
  );
  const uomOptions = useMemo(() => {
    const items = uomsData ?? [];
    return items
      .map((u) => {
        const code = String(u.code ?? u.unit_code ?? u.unit_name ?? "").trim();
        const name = String(u.name ?? u.unit_name ?? "").trim();
        if (!code && !name) return null;
        return {
          label: name ? `${name} (${code})` : code,
          value: code || name,
        };
      })
      .filter(Boolean) as { label: string; value: string }[];
  }, [uomsData]);

  const uniqOptions = useMemo(
    () =>
      fgUniqItems.map((it) => ({
        label: it.part_name
          ? `${it.uniq_code} - ${it.part_name}`
          : it.uniq_code,
        value: it.uniq_code,
      })),
    [fgUniqItems],
  );

  const [createScrapStock, createState] = useCreateScrapStockMutation();

const onSelectUniq = (uniq: string) => {
  const fg = fgUniqByCode[uniq];
  const orDash = (v?: string) => (v && v.trim() ? v : "-");
  form.setFieldsValue({
    uniq,
    part_name: orDash(fg?.part_name),
    part_number: orDash(fg?.part_number),
    model: orDash(fg?.model),
    packing_number: undefined,
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
        packing_number: values.packing_number ?? "",
        wo_number: null,
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
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={createState.isLoading}
            >
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
              <Form.Item
                name="uniq"
                label="UNIQ"
                rules={[{ required: true, message: "Select UNIQ" }]}
              >
                <Select
                  placeholder="Select UNIQ from Finished Goods"
                  options={uniqOptions}
                  loading={apiEnabled && fgUniqQuery.isFetching}
                  showSearch
                  optionFilterProp="label"
                  onChange={onSelectUniq}
                />
              </Form.Item>

              <Form.Item
                name="packing_number"
                label="Packing Number"
                rules={[]}
              >
                <Select
                  placeholder={
                    selectedUniq ? "Select packing number" : "Select UNIQ first"
                  }
                  options={packingOptions}
                  disabled={!selectedUniq}
                  loading={apiEnabled && packingQuery.isFetching}
                  showSearch
                  optionFilterProp="label"
                  notFoundContent={
                    !selectedUniq
                      ? "Select UNIQ first"
                      : packingQuery.isFetching
                        ? "Loading..."
                        : "No packing number from production scan"
                  }
                  allowClear
                />
              </Form.Item>

              <Form.Item
                name="date_received"
                label="Date Received"
                rules={[{ required: true, message: "Select date received" }]}
              >
                <DatePicker
                  className="w-full"
                  placeholder="dd/mm/yyyy"
                  format="DD/MM/YYYY"
                />
              </Form.Item>

              <Form.Item
                name="part_name"
                label="Part Name"
                rules={[{ required: true }]}
              >
                <Input disabled placeholder="Auto-filled" />
              </Form.Item>

              <Form.Item
                name="part_number"
                label="Part Number"
                rules={[{ required: true }]}
              >
                <Input disabled placeholder="Auto-filled" />
              </Form.Item>

              <Form.Item
                name="model"
                label="Model"
                rules={[{ required: true }]}
              >
                <Input disabled placeholder="Auto-filled" />
              </Form.Item>

              <Form.Item
                name="scrap_type"
                label="Scrap Type"
                rules={[{ required: true, message: "Select scrap type" }]}
              >
                <Select
                  placeholder="Select scrap type"
                  options={scrapTypeOptions}
                />
              </Form.Item>

              <Form.Item name="disposal_reason" label="Scrap Reason" rules={[]}>
                <Select
                  placeholder="Select Reason"
                  options={disposalReasonOptions}
                />
              </Form.Item>

              <Form.Item
                name="quantity"
                label="Quantity"
                rules={[{ required: true, message: "Enter quantity" }]}
              >
                <InputNumber min={0} className="w-full" placeholder="2" />
              </Form.Item>

              <Form.Item
                name="uom"
                label="UoM"
                rules={[{ required: true, message: "Enter uom" }]}
              >
                <Select
                  placeholder="Select UoM"
                  options={uomOptions}
                  loading={apiEnabled && isFetchingUoms}
                  showSearch
                  optionFilterProp="label"
                  allowClear
                />
              </Form.Item>

              <Form.Item
                name="weight_kg"
                label="Weight (kg)"
                rules={[{ required: true, message: "Enter weight" }]}
              >
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
