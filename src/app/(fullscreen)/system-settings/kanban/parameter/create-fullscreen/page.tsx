"use client";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Form, Input, InputNumber, Select, message } from "antd";

import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { useCreateKanbanStandardMutation } from "@/lib/api/system-settings/api";

type FormValues = {
  item_name: string;
  item_uniq_code: string;
  kanban_qty: number;
  min_stock: number;
  max_stock: number;
};

export default function KanbanParameterCreateFullscreenPage() {
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();

  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const { data: bomTreeApiData } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });

  const [createKanbanStandard, createState] = useCreateKanbanStandardMutation();

  const bomUniqOptions = useMemo(() => {
    const uniqMap = new Map<string, { uniq: string; partName?: string }>();

    const walk = (nodes: any[]) => {
      for (const n of nodes) {
        const uniq = String(n?.uniq_code ?? "").trim();
        if (uniq) {
          uniqMap.set(uniq, {
            uniq,
            partName:
              typeof n?.part_name === "string" ? n.part_name : undefined,
          });
        }
        if (Array.isArray(n?.children) && n.children.length) walk(n.children);
      }
    };

    const nodes = (bomTreeApiData as any)?.data;
    if (Array.isArray(nodes)) walk(nodes);

    return Array.from(uniqMap.values())
      .sort((a, b) => a.uniq.localeCompare(b.uniq))
      .map((x) => ({
        label: x.partName ? `${x.uniq} — ${x.partName}` : x.uniq,
        value: x.uniq,
      }));
  }, [bomTreeApiData]);

  const selectedUniq = Form.useWatch("item_uniq_code", form);

  useEffect(() => {
    if (!selectedUniq) return;
    const opt = bomUniqOptions.find((o) => o.value === selectedUniq);
    const name =
      opt && String(opt.label).includes("—")
        ? String(opt.label).split("—")[1].trim()
        : String(opt?.label ?? selectedUniq);
    form.setFieldsValue({ item_name: name });
  }, [selectedUniq, bomUniqOptions, form]);

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createKanbanStandard({
        item_name: values.item_name,
        item_uniq_code: values.item_uniq_code,
        kanban_qty: Number(values.kanban_qty ?? 0),
        min_stock: Number(values.min_stock ?? 0),
        max_stock: Number(values.max_stock ?? 0),
      }).unwrap();

      message.success("Kanban parameter created");
      router.push("/system-settings");
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(
        getApiErrorMessage(err, "Failed to create kanban parameter"),
      );
    }
  };

  const onAddAnother = async () => {
    try {
      const values = await form.validateFields();
      await createKanbanStandard({
        item_name: values.item_name,
        item_uniq_code: values.item_uniq_code,
        kanban_qty: Number(values.kanban_qty ?? 0),
        min_stock: Number(values.min_stock ?? 0),
        max_stock: Number(values.max_stock ?? 0),
      }).unwrap();

      message.success("Kanban parameter created");
      // reset form for next entry
      form.resetFields();
      form.setFieldsValue({ kanban_qty: 50, min_stock: 100, max_stock: 500 });
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(
        getApiErrorMessage(err, "Failed to create kanban parameter"),
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF5FF] p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <Card className="rounded-2xl shadow-sm" style={{ padding: 20 }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                Create Kanban Parameter
              </div>
              <div className="text-sm text-gray-500">
                Select item UNIQ from registered BOMs
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="!rounded-lg"
                onClick={() => router.push("/system-settings")}
              >
                Back
              </Button>
              <Button className="!rounded-lg" onClick={onAddAnother}>
                + Add Another Parameter
              </Button>
              <Button
                type="primary"
                className="!rounded-lg"
                loading={createState.isLoading}
                onClick={onSubmit}
              >
                Save
              </Button>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl shadow-sm" style={{ padding: 20 }}>
          <Form<FormValues>
            form={form}
            layout="vertical"
          
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="item_uniq_code"
                label="Item UNIQ Code"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  className="!rounded-lg"
                  placeholder="Select BOM UNIQ"
                  options={bomUniqOptions}
                  optionFilterProp="label"
                  filterOption={(input, opt) =>
                    String(opt?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
              <Form.Item
                name="item_name"
                label="Item Name"
                rules={[{ required: true }]}
              >
                <Input
                  className="!rounded-lg"
                  placeholder="e.g. Bracket Assembly"
                />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Form.Item
                name="kanban_qty"
                label="Kanban Qty"
                rules={[{ required: true }]}
              >
                <InputNumber className="w-full !rounded-lg" min={0} />
              </Form.Item>
              {/* <Form.Item
                name="min_stock"
                label="Min Stock"
                rules={[{ required: true }]}
              >
                <InputNumber className="w-full !rounded-lg" min={0} />
              </Form.Item>
              <Form.Item
                name="max_stock"
                label="Max Stock"
                rules={[{ required: true }]}
              >
                <InputNumber className="w-full !rounded-lg" min={0} />
              </Form.Item> */}
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}
