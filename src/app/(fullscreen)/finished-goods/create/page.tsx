"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Radio, Select, Typography, message } from "antd";
import type { FormInstance } from "antd";
import type { RadioChangeEvent } from "antd";

import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { useCreateFinishedGoodMutation } from "@/lib/api/finished-goods/api";
import { apiBaseUrl } from "@/lib/api/instance";
import { useListWarehousesQuery } from "@/lib/api/warehouse/api";
import { buildBomUniqIndex, type BomUniqIndex } from "@/lib/utils/bomUniq";

const { Title, Text } = Typography;

type FinishedGoodsFormData = {
  uniq_code?: string;
  part_name?: string;
  warehouse_location?: string;
};

type FormEntry = {
  id: number;
  key: string;
  formRef: React.MutableRefObject<FormInstance | null>;
};

const toLower = (v: unknown) => String(v ?? "").trim().toLowerCase();

const buildWarehouseOptions = (warehouses: unknown[] | undefined) => {
  const rows = (warehouses ?? []) as Array<Record<string, unknown>>;

  const finishedGoods = rows.filter((w) => {
    const t = toLower(w.type_warehouse);
    if (!t) return true;
    return t.includes("finished") || t.includes("fg");
  });

  const pick = (arr: Array<Record<string, unknown>>) =>
    arr
      .map((w) => String(w.warehouse_name ?? "").trim())
      .filter(Boolean)
      .map((name) => ({ label: name, value: name }));

  const preferred = pick(finishedGoods);
  return preferred.length ? preferred : pick(rows);
};

function FinishedGoodsForm({
  entryNumber,
  onRemove,
  showRemove,
  formRef,
  bomIndex,
  bomOptions,
  warehouseOptions,
}: {
  entryNumber: number;
  onRemove: () => void;
  showRemove: boolean;
  formRef: React.MutableRefObject<FormInstance | null>;
  bomIndex: BomUniqIndex;
  bomOptions: Array<{ label: string; value: string }>;
  warehouseOptions: Array<{ label: string; value: string }>;
}) {
  const [form] = Form.useForm<FinishedGoodsFormData>();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    formRef.current = form;
  }, [form, formRef]);

  if (!mounted) return null;

  return (
    <Card>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <Title level={4} className="!mb-0">Finished Goods Entry #{entryNumber}</Title>
          {showRemove ? (
            <Button type="text" danger icon={<DeleteOutlined />} onClick={onRemove} size="small">
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-gray-500">Pilih UNIQ dari BOM, warehouse dari Warehouse Master.</p>
      </div>

      <Form form={form} layout="vertical" requiredMark={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Form.Item
            name="uniq_code"
            label="UNIQ Code"
            rules={[{ required: true, message: "Please select UNIQ" }]}
          >
            <Select
              showSearch
              placeholder="Select UNIQ from BOM"
              size="large"
              className="rounded-lg"
              options={bomOptions}
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.trim().toLowerCase())
              }
              onChange={(uniq) => {
                const partName = bomIndex.partNameByUniq[uniq] || "";
                form.setFieldsValue({ part_name: partName });
              }}
            />
          </Form.Item>

          <Form.Item name="part_name" label="Part Name">
            <Input disabled size="large" className="rounded-lg" placeholder="Auto from BOM" />
          </Form.Item>
        </div>

        <Form.Item
          name="warehouse_location"
          label="Warehouse (Storage Location)"
          rules={[{ required: true, message: "Please select warehouse location" }]}
        >
          <Select
            showSearch
            placeholder="Select warehouse location"
            size="large"
            className="rounded-lg"
            options={warehouseOptions}
            filterOption={(input, option) =>
              String(option?.label ?? "")
                .toLowerCase()
                .includes(input.trim().toLowerCase())
            }
          />
        </Form.Item>
      </Form>
    </Card>
  );
}

export default function CreateFinishedGoodsPage() {
  const router = useRouter();
  const apiEnabled = Boolean(apiBaseUrl);

  const [mode, setMode] = useState<"manual" | "bulk">("manual");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formEntries, setFormEntries] = useState<FormEntry[]>([
    { id: 1, key: "form-1", formRef: { current: null } },
  ]);

  const bomTreeQuery = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const warehousesQuery = useListWarehousesQuery(undefined, { skip: !apiEnabled });
  const [createFinishedGood] = useCreateFinishedGoodMutation();

  const bomIndex = useMemo(
    () => buildBomUniqIndex((bomTreeQuery.data?.data ?? []) as unknown),
    [bomTreeQuery.data]
  );

  const bomOptions = useMemo(() => {
    if (!apiEnabled) {
      return [
        { label: "LV7-001 - Example Part", value: "LV7-001" },
        { label: "LV7-002 - Example Part 2", value: "LV7-002" },
      ];
    }

    return (bomIndex.uniqs ?? []).map((uniq) => {
      const partName = bomIndex.partNameByUniq[uniq];
      return {
        value: uniq,
        label: partName ? `${uniq} — ${partName}` : uniq,
      };
    });
  }, [apiEnabled, bomIndex.partNameByUniq, bomIndex.uniqs]);

  const warehouseOptions = useMemo(() => {
    if (!apiEnabled) {
      return [
        { label: "Warehouse 1", value: "Warehouse 1" },
        { label: "Warehouse 2", value: "Warehouse 2" },
      ];
    }
    return buildWarehouseOptions(warehousesQuery.data as unknown[] | undefined);
  }, [apiEnabled, warehousesQuery.data]);

  const handleAddAnotherEntry = () => {
    const nextId = Math.max(...formEntries.map((e) => e.id)) + 1;
    setFormEntries((prev) => [...prev, { id: nextId, key: `form-${nextId}`, formRef: { current: null } }]);
  };

  const handleRemoveEntry = (id: number) => {
    if (formEntries.length <= 1) return;
    setFormEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleCancel = () => router.push("/finished-goods");

  const handleModeChange = (e: RadioChangeEvent) => {
    const value = (e.target.value ?? "manual") as "manual" | "bulk";
    setMode(value);
    if (value === "bulk") router.push("/finished-goods/bulk");
  };

  const validateAllForms = async (): Promise<FinishedGoodsFormData[]> => {
    const validated: FinishedGoodsFormData[] = [];
    for (const entry of formEntries) {
      const form = entry.formRef.current;
      if (!form) continue;
      const values = await form.validateFields();
      validated.push(values);
    }
    return validated;
  };

  const computeCompleteCount = () => {
    let complete = 0;
    for (const entry of formEntries) {
      const form = entry.formRef.current;
      if (!form) continue;
      const v = form.getFieldsValue() as FinishedGoodsFormData;
      if (v.uniq_code && v.warehouse_location) complete += 1;
    }
    return complete;
  };

  const handleSubmitAll = async () => {
    try {
      setIsSubmitting(true);
      const rows = await validateAllForms();
      if (!rows.length) {
        message.error("No entries to submit");
        return;
      }

      for (const [i, row] of rows.entries()) {
        const uniq_code = String(row.uniq_code ?? "").trim();
        const warehouse_location = String(row.warehouse_location ?? "").trim();
        if (!uniq_code || !warehouse_location) {
          message.error(`Entry ${i + 1}: UNIQ and Warehouse are required`);
          return;
        }

        if (!apiEnabled) continue;

        await createFinishedGood({ uniq_code, warehouse_location }).unwrap();
      }

      message.success(`Created ${rows.length} finished goods item(s)`);
      router.push("/finished-goods");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to create finished goods"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeCount = computeCompleteCount();

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div
        className="bg-white shadow-sm"
        style={{ position: "fixed", top: 0, left: 0, width: "100vw", zIndex: 50, padding: "16px 48px" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleCancel} className="flex items-center gap-2">
              Back to Finished Goods
            </Button>
            <div className="h-6 w-px bg-gray-300" />
            <div>
              <Title level={3} className="!mb-1">Create Finished Goods</Title>
              <Text className="text-gray-600">UNIQ from BOM, location from Warehouse Master</Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button size="large" onClick={handleCancel}>Cancel</Button>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSubmitAll}
              loading={isSubmitting}
              className="flex items-center gap-2"
            >
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 flex flex-1 justify-center items-start mt-20">
        <div className="w-full max-w-6xl space-y-6">
          <Card>
            <div>
              <Title level={5} className="!mb-1">Entry Mode</Title>
              <Text className="text-gray-600">Manual entry or bulk upload.</Text>
            </div>
            <div className="pt-4">
              <Radio.Group onChange={handleModeChange} value={mode} size="large">
                <div className="flex flex-col gap-2">
                  <Radio value="manual">Manual</Radio>
                  <Radio value="bulk">Bulk Action</Radio>
                </div>
              </Radio.Group>
            </div>
          </Card>

          {formEntries.map((entry) => (
            <FinishedGoodsForm
              key={entry.key}
              entryNumber={entry.id}
              onRemove={() => handleRemoveEntry(entry.id)}
              showRemove={formEntries.length > 1}
              formRef={entry.formRef}
              bomIndex={bomIndex}
              bomOptions={bomOptions}
              warehouseOptions={warehouseOptions}
            />
          ))}

          <div className="text-center">
            <Button type="dashed" icon={<PlusOutlined />} size="large" onClick={handleAddAnotherEntry} className="w-full max-w-md">
              Add Another Finished Goods
            </Button>
          </div>
        </div>
      </div>

      <Card
        style={{ position: "fixed", left: 0, bottom: 0, width: "100vw", zIndex: 50, borderRadius: 0, boxShadow: "0 -2px 8px rgba(0,0,0,0.04)", margin: 0, padding: 0 }}
        styles={{ body: { padding: "16px 48px" } }}
      >
        <div className="flex items-center justify-between">
          <div>
            <Title level={5} className="!mb-1">Summary</Title>
            <Text className="text-gray-600">{formEntries.length} entry(ies) ready to be saved</Text>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{formEntries.length}</div>
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
