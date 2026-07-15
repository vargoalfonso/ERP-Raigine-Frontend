"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
  useGetScrapItemOptionsQuery,
  type ScrapItemOption,
} from "@/lib/api/scrap-stock/api";
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

function CreateScrapStockContent() {
  const router = useRouter();
  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => {
    if (typeof window === "undefined") return new URLSearchParams("");
    return new URLSearchParams(window.location.search);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setSearchParams(new URLSearchParams(window.location.search));
    // update on mount
    handler();
    // listen to popstate/navigation changes
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<ScrapStockCreateForm>();
  const apiEnabled = Boolean(apiBaseUrl);

  const [searchUniq, setSearchUniq] = useState("");

  // UNIQ source-agnostic: items table mencakup FG / Raw Material / Indirect / subcon,
  // karena scrap kini bisa berasal dari semua sumber inventory (bukan hanya finished goods).
  const itemOptionsQuery = useGetScrapItemOptionsQuery(
    { q: searchUniq, limit: 100 },
    { skip: !apiEnabled },
  );
  const itemOptions = itemOptionsQuery.data?.items ?? [];
  const itemByCode = useMemo(() => {
    const map: Record<string, ScrapItemOption> = {};
    for (const it of itemOptions) map[it.uniq_code] = it;
    return map;
  }, [itemOptions]);

  // Packing number = daftar package finished dari scan produksi untuk UNIQ terpilih.
  const selectedUniq = Form.useWatch("uniq", form);
  const pureSelectedUniq = selectedUniq ? selectedUniq.split("___")[0] : "";
  const packingQuery = useGetScrapPackingOptionsQuery(pureSelectedUniq, {
    skip: !apiEnabled || !pureSelectedUniq,
  });
  const prefillPacking = searchParams.get("packing_number") ?? "";
  const packingOptions = useMemo(() => {
    const base = (packingQuery.data ?? [])
      .map((p) => String(p ?? "").trim())
      .filter(Boolean);
    if (prefillPacking && !base.includes(prefillPacking)) {
      base.unshift(prefillPacking);
    }
    return base.map((p) => ({ label: p, value: p }));
  }, [packingQuery.data, prefillPacking]);

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

  const uniqOptions = useMemo(() => {
    const opts = itemOptions.map((it, i) => {
      const uniqPart = it.part_name ? `${it.uniq_code} - ${it.part_name}` : it.uniq_code;
      const sourcePart = it.material_type ? it.material_type : "Item Master";
      return {
        label: `${uniqPart} - ${sourcePart}`,
        // Use composite value to prevent duplicate keys in Ant Design Select
        value: `${it.uniq_code}___${sourcePart}___${i}`,
      };
    });
    // Jika navigasi dari Product Return dengan uniq yang tak ada di daftar
    const prefillUniq = (searchParams.get("uniq") ?? "").trim();
    if (prefillUniq && !opts.some((o) => o.value.startsWith(`${prefillUniq}___`))) {
      const partName = (searchParams.get("part_name") ?? "").trim();
      opts.unshift({
        label: partName ? `${prefillUniq} - ${partName}` : prefillUniq,
        value: prefillUniq, // pure prefill value
      });
    }
    return opts;
  }, [itemOptions, searchParams]);

  const [createScrapStock, createState] = useCreateScrapStockMutation();

  useEffect(() => {
    const get = (k: string) => {
      const v = searchParams.get(k);
      return v && v.trim() ? v.trim() : undefined;
    };
    const uniq = get("uniq");
    if (!uniq) return;

    form.setFieldsValue({
      uniq,
      part_name: get("part_name") ?? "-",
      part_number: get("part_number") ?? "-",
      model: get("model") ?? "-",
      packing_number: get("packing_number"),
      scrap_type: get("scrap_type") ?? "Product Return Scrap",
      quantity: get("quantity") ? Number(get("quantity")) : undefined,
      uom: get("uom"),
      date_received: get("date_received")
        ? dayjs(get("date_received"))
        : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onSelectUniq = (val: string) => {
    const uniq = val.split("___")[0];
    const it = itemByCode[uniq];
    const orDash = (v?: string) => (v && v.trim() ? v : "-");
    form.setFieldsValue({
      uniq: val, // keep composite in form state so Select displays it properly
      part_name: orDash(it?.part_name),
      part_number: orDash(it?.part_number),
      model: orDash(it?.model),
      packing_number: undefined,
    });
    if (it?.uom && it.uom.trim()) {
      form.setFieldsValue({ uom: it.uom });
    }
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

      const pureUniq = values.uniq.split("___")[0];

      await createScrapStock({
        uniq: pureUniq,
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
                  placeholder="Select UNIQ (Finished Goods / Raw Material / Indirect)"
                  options={uniqOptions}
                  loading={apiEnabled && itemOptionsQuery.isFetching}
                  showSearch
                  onSearch={setSearchUniq}
                  filterOption={false}
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

export default function CreateScrapStockPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-500">Loading...</div>}>
      <CreateScrapStockContent />
    </Suspense>
  );
}
