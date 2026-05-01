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
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { formatWorkOrderDisplayNumber } from "@/lib/utils/workOrder";
import { useCreateScrapStockMutation } from "@/lib/api/scrap-stock/api";
import { useGetWorkOrdersQuery } from "@/lib/api/work-orders/api";
import { useGetScrapTypesQuery } from "@/lib/api/scrap-types/api";

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
  const selectedWoNumber = Form.useWatch("wo_number", form);
  const selectedUniq = Form.useWatch("uniq", form);

  const workOrdersQuery = useGetWorkOrdersQuery({ page: 1, limit: 200 }, { skip: !apiEnabled });
  const workOrders = workOrdersQuery.data?.items ?? [];
  const scrapTypesQuery = useGetScrapTypesQuery({ page: 1, limit: 100 }, { skip: !apiEnabled });
  const scrapTypeOptions = useMemo(
    () =>
      (scrapTypesQuery.data?.items ?? [])
        .map((item) => {
          const name = String(item.name ?? "").trim();
          if (!name) return null;
          return {
            label: name,
            value: name,
          };
        })
        .filter((item): item is { label: string; value: string } => Boolean(item)),
    [scrapTypesQuery.data?.items]
  );

  const selectedWorkOrder = useMemo(
    () => workOrders.find((item) => item.wo_number === selectedWoNumber),
    [selectedWoNumber, workOrders]
  );

  const selectedWorkOrderItems = selectedWorkOrder?.items ?? [];

  const workOrderOptions = useMemo(
    () =>
      workOrders
        .filter((item) => Boolean(item.wo_number))
        .map((item) => ({
          label: formatWorkOrderDisplayNumber(item.wo_number),
          value: item.wo_number,
        })),
    [workOrders]
  );

  const uniqOptions = useMemo(() => {
    if (selectedWorkOrderItems.length > 0) {
      return Array.from(
        new Map(
          selectedWorkOrderItems
            .filter((item) => Boolean(item.item_uniq_code))
            .map((item) => {
              const uniq = item.item_uniq_code;
              const partName = item.part_name ?? bomIndex.partNameByUniq[uniq] ?? "";
              return [uniq, { label: partName ? `${uniq} - ${partName}` : uniq, value: uniq }] as const;
            })
        ).values()
      );
    }

    return bomIndex.uniqs.map((uniq) => {
      const partName = bomIndex.partNameByUniq[uniq];
      return {
        label: partName ? `${uniq} - ${partName}` : uniq,
        value: uniq,
      };
    });
  }, [bomIndex.partNameByUniq, bomIndex.uniqs, selectedWorkOrderItems]);

  const packingOptions = useMemo(() => {
    const options = Array.from(
      new Map(
        selectedWorkOrderItems
          .filter((item) => !selectedUniq || item.item_uniq_code === selectedUniq)
          .map((item) => {
            const packing = String(item.kanban_number ?? "").trim();
            if (!packing) return null;
            return [packing, { label: packing, value: packing }] as const;
          })
          .filter((item): item is readonly [string, { label: string; value: string }] => Boolean(item))
      ).values()
    );

    if (options.length > 0) return options;

    const bomPacking = selectedUniq ? bomIndex.packingNumberByUniq[selectedUniq] : undefined;
    return bomPacking ? [{ label: bomPacking, value: bomPacking }] : [];
  }, [bomIndex.packingNumberByUniq, selectedUniq, selectedWorkOrderItems]);

  const [createScrapStock, createState] = useCreateScrapStockMutation();

  const applyUniqAutofill = (uniq: string, packingOverride?: string) => {
    const workOrderItem = selectedWorkOrderItems.find(
      (item) => item.item_uniq_code === uniq && (!packingOverride || item.kanban_number === packingOverride)
    ) ?? selectedWorkOrderItems.find((item) => item.item_uniq_code === uniq);

    const packingNumber =
      packingOverride ??
      workOrderItem?.kanban_number ??
      bomIndex.packingNumberByUniq[uniq] ??
      form.getFieldValue("packing_number");

    form.setFieldsValue({
      uniq,
      packing_number: packingNumber,
      part_name: workOrderItem?.part_name ?? bomIndex.partNameByUniq[uniq] ?? "",
      part_number: workOrderItem?.part_number ?? bomIndex.partNumberByUniq[uniq] ?? "",
      model: workOrderItem?.model ?? bomIndex.modelByUniq[uniq] ?? "",
      uom: bomIndex.uomByUniq[uniq] ?? form.getFieldValue("uom"),
      weight_kg: bomIndex.weightKgByUniq[uniq] ?? form.getFieldValue("weight_kg") ?? 0,
    });
  };

  const onSelectWo = (woNumber: string) => {
    const workOrder = workOrders.find((item) => item.wo_number === woNumber);
    const firstItem = workOrder?.items?.[0];

    form.setFieldsValue({
      wo_number: woNumber,
      uniq: undefined,
      packing_number: undefined,
      part_name: "",
      part_number: "",
      model: "",
    });

    if (firstItem?.item_uniq_code) {
      applyUniqAutofill(firstItem.item_uniq_code, firstItem.kanban_number ?? undefined);
    }
  };

  const onSelectUniq = (uniq: string) => {
    applyUniqAutofill(uniq);
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
              <Form.Item name="wo_number" label="WO Number">
                <Select
                  placeholder="Select work order"
                  options={workOrderOptions}
                  showSearch
                  optionFilterProp="label"
                  loading={apiEnabled && workOrdersQuery.isFetching}
                  onChange={onSelectWo}
                  allowClear
                />
              </Form.Item>

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
                <Select
                  placeholder="Select related packing number"
                  options={packingOptions}
                  showSearch
                  optionFilterProp="label"
                  onChange={(value) => {
                    const uniq = form.getFieldValue("uniq");
                    if (uniq) applyUniqAutofill(uniq, value);
                  }}
                  allowClear
                />
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

              <Form.Item name="scrap_type" label="Scrap Type" rules={[{ required: true, message: "Select scrap type" }]}>
                <Select
                  placeholder="Select scrap type"
                  options={scrapTypeOptions}
                  loading={apiEnabled && scrapTypesQuery.isFetching}
                  showSearch
                  optionFilterProp="label"
                />
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
