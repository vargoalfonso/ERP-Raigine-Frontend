"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, InputNumber, Select, Tag, message } from "antd";
import {
  InfoCircleOutlined,
  LeftOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useCreateSafetyStockBulkMutation,
  useCreateSafetyStockMutation,
} from "@/lib/api/system-settings/api";
import { useGetInventoryListQuery } from "@/lib/api/inventory/api";

type Entry = {
  id: string;
  uniq?: string;
  calculationType?: string;
  constanta?: number;
  created: boolean;
};

const TYPE_OPTIONS = [
  { label: "Raw Material", value: "raw_material" },
  { label: "Indirect Raw Material", value: "indirect_material" },
  { label: "SubCon", value: "subcon" },
  { label: "Finished Goods", value: "finished_goods" },
];



const CALCULATION_OPTIONS = [
  { label: "Using PRL/working days * days (C)", value: "days" },
  { label: "Using PRL/working days * percentage (C)", value: "percentage" },
  { label: "Demand Forecasting result for each Uniq", value: "forecast" },
  { label: "Using PRL/working days * days (C)", value: "Using PRL/working days * days (C)" },
];

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    uniq: undefined,
    calculationType: CALCULATION_OPTIONS[0]?.value,
    constanta: undefined,
    created: false,
  };
}

export default function SafetyStockCreatePage() {
  const router = useRouter();
  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const [createSafetyStock, createSafetyStockState] = useCreateSafetyStockMutation();
  const [createSafetyStockBulk, createSafetyStockBulkState] = useCreateSafetyStockBulkMutation();

  const [type, setType] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<Entry[]>([makeEntry(1)]);

  const inventoryType = useMemo<"raw-materials" | "indirect-materials" | "subcon-materials" | undefined>(() => {
    switch (type) {
      case "raw_material":
        return "raw-materials";
      case "indirect_material":
        return "indirect-materials";
      case "subcon":
        return "subcon-materials";
      default:
        return undefined;
    }
  }, [type]);

  const { data: inventoryListResp } = useGetInventoryListQuery(
    inventoryType ? { type: inventoryType, page: 1, limit: 1000 } : ({} as any),
    { skip: !inventoryType }
  );

  const uniqOptions = useMemo(() => {
    const items = inventoryListResp?.data ?? [];
    return items
      .map((r) => {
        const uniq = (r as any)?.uniq_code ?? (r as any)?.uniq //?? (r as any)?.item_name ?? undefined;
        if (!uniq) return null;
        //const part = (r as any)?.part_name ?? (r as any)?.part_number ?? (r as any)?.item_name ?? "";
        return { label: String(uniq), value: String(uniq)}; //label: part ? `${uniq} — ${part}` : };
      })
      .filter(Boolean) as { label: string; value: string }[];
  }, [inventoryListResp]);

  const completeCount = useMemo(() => entries.filter((e) => e.created).length, [entries]);

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const validateEntry = (e: Entry) => {
    if (!e.uniq) return "Uniq is required";
    if (!e.calculationType) return "Calculation Type is required";
    if (e.constanta === undefined || e.constanta === null) return "Constanta is required";
    return null;
  };

  const onCreateStockDays = (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    const err = validateEntry(entry);
    if (err) {
      message.error(err);
      return;
    }

    updateEntry(id, { created: true });
    message.success("Entry saved");
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, makeEntry(prev.length + 1)]);
  };

  const onSave = async () => {
    try {
      if (!type) {
        message.error("Type is required");
        return;
      }

      for (const e of entries) {
        const err = validateEntry(e);
        if (err) {
          message.error(`Entry ${entries.indexOf(e) + 1}: ${err}`);
          return;
        }
      }

      if (!apiEnabled) {
        message.success("Safety stock parameter saved");
        router.push("/system-settings");
        return;
      }

      const items = entries.map((entry) => ({
        inventory_type: String(type),
        item_uniq_code: String(entry.uniq ?? "").trim(),
        calculation_type: String(entry.calculationType ?? "").trim(),
        constanta: Number(entry.constanta ?? 0),
      }));

      if (items.length === 1) {
        await createSafetyStock(items[0]).unwrap();
      } else {
        await createSafetyStockBulk({ items }).unwrap();
      }

      message.success("Safety stock parameter saved");
      router.push("/system-settings");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save safety stock parameter"));
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              onClick={() => router.push("/system-settings")}
            >
              <LeftOutlined />
              <span>Back to System Parameters</span>
            </button>

            <div className="flex items-center gap-2">
              <Button onClick={() => router.push("/system-settings")}>Cancel</Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => void onSave()}
                loading={createSafetyStockState.isLoading || createSafetyStockBulkState.isLoading}
              >
                Save Parameter
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">
              Add Parameter for Safety Stock
            </div>
            <div className="text-sm text-gray-500">
              Create Stockdays <span className="mx-2">•</span> {entries.length} entry
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-gray-900">Step 1: Select Type</div>
                <div className="text-sm text-gray-500">Select Type before create Safety Stock</div>
              </div>
              <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Required
              </Tag>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="w-20 text-sm text-gray-700">Type</div>
              <div className="w-[280px]">
                <Select
                  value={type}
                  onChange={setType}
                  placeholder="Select Type"
                  options={TYPE_OPTIONS}
                  optionFilterProp="label"
                />
              </div>
              <InfoCircleOutlined className="text-blue-600" />
            </div>
          </Card>

          <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-gray-900">Step 2: Input Data</div>
                <div className="text-sm text-gray-500">Input Data for each Items</div>
              </div>
              <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Entry 1
              </Tag>
            </div>

            <div className="mt-5 space-y-4">
              {entries.map((e, idx) => (
                <div key={e.id}>
                  {idx > 0 && (
                    <div className="flex items-center justify-end mb-2">
                      <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        Entry {idx + 1}
                      </Tag>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                    <div className="lg:col-span-3">
                      <div className="text-sm text-gray-700 mb-2">Uniq</div>
                      <Select
                      className="safetystock-select-uniq max-w-2xl"
                        value={e.uniq}
                        onChange={(v) => updateEntry(e.id, { uniq: v, created: false })}
                        placeholder={inventoryType ? "Select Uniq" : "Select Type first"}
                        options={uniqOptions}
                        disabled={!inventoryType}
                      />
                    </div>

                    <div className="lg:col-span-4">
                      <div className="text-sm text-gray-700 mb-2 max-w-2xl">Calculation Type</div>
                      <Select
                        className="safetystock-select max-w-2xl"
                        popupClassName="safetystock-select-popup"
                        value={e.calculationType}
                        onChange={(v) => updateEntry(e.id, { calculationType: v, created: false })}
                        options={CALCULATION_OPTIONS}
                      />
                    </div>

                    <div className="lg:col-span-3">
                      <div className="text-sm text-gray-700 mb-2">Constanta</div>
                      <InputNumber
                        className="w-full"
                        value={e.constanta}
                        onChange={(v) => updateEntry(e.id, { constanta: v ?? undefined, created: false })}
                        placeholder="Input Constanta"
                        min={0}
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <Button
                        type="primary"
                        className="w-full"
                        icon={<PlusOutlined />}
                        onClick={() => onCreateStockDays(e.id)}
                        loading={createSafetyStockState.isLoading || createSafetyStockBulkState.isLoading}
                      >
                        Create Stock days
                      </Button>
                    </div>
                  </div>

                  {idx < entries.length - 1 && <div className="mt-6 border-t border-gray-200" />}
                </div>
              ))}
            </div>
          </Card>

          <div className="flex items-center justify-center">
            <Button icon={<PlusOutlined />} onClick={addAnother}>
              Add Another Parameter
            </Button>
          </div>

          <Card className="rounded-2xl" bodyStyle={{ padding: 18 }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-gray-900">Summary</div>
                <div className="text-sm text-gray-500">{entries.length} Parameter ready to be saved</div>
              </div>
              <div className="flex items-center gap-10">
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">{entries.length}</div>
                  <div className="text-xs text-gray-500">Entries</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">{completeCount}</div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
