"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Card, Input, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";

import {
  computeBuyNotBuyMetrics,
  loadBuyNotBuyFlagRecords,
  normalizeBuyNotBuyFlagRecord,
  saveBuyNotBuyFlagRecords,
  type BuyNotBuyFlagDraft,
} from "@/lib/utils/buyNotBuyFlag";
import { useGetInventoryListQuery } from "@/lib/api/inventory/api";

type EntryDraft = BuyNotBuyFlagDraft & {
  localId: string;
};

type MaterialOption = {
  uniq: string;
  materialCode: string;
  materialName: string;
  inventoryType: string;
  currentStock: number;
};

const SAFETY_STOCK_OPTIONS = [
  { label: "Parameter I (Days)", value: "parameter_i_days" },
  { label: "Parameter II (Forecast)", value: "parameter_ii_forecast" },
  { label: "Stock Days Existing", value: "stock_days_existing" },
];

const FALLBACK_OPTIONS: MaterialOption[] = [
  {
    uniq: "RM-STEEL-001",
    materialCode: "RM-ST-001",
    materialName: "Steel Plate 10mm",
    inventoryType: "raw-materials",
    currentStock: 850,
  },
  {
    uniq: "RM-AL-002",
    materialCode: "RM-AL-002",
    materialName: "Aluminium Coil 2mm",
    inventoryType: "raw-materials",
    currentStock: 420,
  },
];

const makeEntry = (index: number): EntryDraft => ({
  localId: `entry-${index}`,
  uniq: "",
  materialCode: "",
  materialName: "",
  inventoryType: "raw-materials",
  safetyStockParam: SAFETY_STOCK_OPTIONS[0]?.value ?? "parameter_i_days",
  deliveryCycle: 14,
  currentStock: 0,
  safetyStock: 0,
  kanbanStd: 0,
  forecastedUsagePerDay: undefined,
  stockDays: undefined,
  highRatio: 2,
});

export default function BuyNotBuyFlagCreatePage() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const mode = String(searchParams.get("mode") ?? "create").toLowerCase();
  const isEditMode = mode === "edit";
  const isDetailMode = mode === "detail" || mode === "view";
  const isReadOnly = isDetailMode;
  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);

  const [entries, setEntries] = useState<EntryDraft[]>([makeEntry(1)]);

  const rawMaterialsQuery = useGetInventoryListQuery(
    { type: "raw-materials", page: 1, limit: 1000 },
    { skip: !apiEnabled },
  );
  const indirectMaterialsQuery = useGetInventoryListQuery(
    { type: "indirect-materials", page: 1, limit: 1000 },
    { skip: !apiEnabled },
  );
  const subconMaterialsQuery = useGetInventoryListQuery(
    { type: "subcon-materials", page: 1, limit: 1000 },
    { skip: !apiEnabled },
  );

  const goBackToSystemSettings = () => {
    if (typeof window !== "undefined") {
      window.location.replace("/system-settings");
      return;
    }
    router.replace("/system-settings");
  };

  const materialOptions = useMemo<MaterialOption[]>(() => {
    const queries = [
      rawMaterialsQuery.data?.data ?? [],
      indirectMaterialsQuery.data?.data ?? [],
      subconMaterialsQuery.data?.data ?? [],
    ];

    const mapped = queries
      .flat()
      .map((item) => {
        const uniq = String(item.uniq_code ?? "").trim();
        if (!uniq) return null;

        const materialCode = String(
          item.part_number ?? item.uniq_code ?? item.id ?? "",
        ).trim();
        const materialName = String(
          item.part_name ?? item.item_name ?? item.uniq_code ?? "",
        ).trim();

        return {
          uniq,
          materialCode,
          materialName,
          inventoryType: String(item.raw_material_type ?? "raw-materials"),
          currentStock: Number(item.stock_qty ?? 0),
        } satisfies MaterialOption;
      })
      .filter((item): item is MaterialOption => Boolean(item));

    if (mapped.length === 0) return FALLBACK_OPTIONS;

    const byUniq = new Map<string, MaterialOption>();
    for (const item of mapped) {
      if (!byUniq.has(item.uniq)) byUniq.set(item.uniq, item);
    }
    return Array.from(byUniq.values()).sort((a, b) =>
      a.uniq.localeCompare(b.uniq),
    );
  }, [
    indirectMaterialsQuery.data?.data,
    rawMaterialsQuery.data?.data,
    subconMaterialsQuery.data?.data,
  ]);

  useEffect(() => {
    if (!id) return;

    const current = loadBuyNotBuyFlagRecords().find((item) => item.id === id);
    if (!current) return;

    setEntries([
      {
        localId: "entry-1",
        id: current.id,
        uniq: current.uniq,
        materialCode: current.materialCode,
        materialName: current.materialName,
        inventoryType: current.inventoryType,
        safetyStockParam: current.safetyStockParam,
        deliveryCycle: current.deliveryCycle,
        currentStock: current.currentStock,
        safetyStock: current.safetyStock,
        kanbanStd: current.kanbanStd,
        forecastedUsagePerDay: current.forecastedUsagePerDay,
        stockDays: current.stockDays,
        highRatio: current.highRatio,
      },
    ]);
  }, [id]);

  useEffect(() => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.uniq) return entry;
        const firstOption = materialOptions[0];
        if (!firstOption) return entry;
        return {
          ...entry,
          uniq: firstOption.uniq,
          materialCode: firstOption.materialCode,
          materialName: firstOption.materialName,
          inventoryType: firstOption.inventoryType,
          currentStock: firstOption.currentStock,
        };
      }),
    );
  }, [materialOptions]);

  const updateEntry = (localId: string, patch: Partial<EntryDraft>) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.localId === localId ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const applyMaterialOption = (localId: string, uniq: string) => {
    const selected = materialOptions.find((item) => item.uniq === uniq);
    if (!selected) return;

    updateEntry(localId, {
      uniq: selected.uniq,
      materialCode: selected.materialCode,
      materialName: selected.materialName,
      inventoryType: selected.inventoryType,
      currentStock: selected.currentStock,
    });
  };

  const addAnotherParameter = () => {
    setEntries((prev) => [...prev, makeEntry(prev.length + 1)]);
  };

  const validateEntry = (entry: EntryDraft) => {
    if (!String(entry.uniq ?? "").trim()) return "Uniq is required";
    if (!String(entry.materialCode ?? "").trim()) return "Material Code is required";
    if (!String(entry.materialName ?? "").trim()) return "Material Name is required";
    if (Number(entry.deliveryCycle ?? 0) <= 0) return "Delivery Cycle must be greater than 0";
    if (Number(entry.safetyStock ?? 0) < 0) return "Safety Stock cannot be negative";
    if (Number(entry.kanbanStd ?? 0) < 0) return "Kanban Std cannot be negative";
    return null;
  };

  const handleSave = () => {
    for (let index = 0; index < entries.length; index += 1) {
      const error = validateEntry(entries[index]);
      if (error) {
        message.error(`Entry ${index + 1}: ${error}`);
        return;
      }
    }

    const existing = loadBuyNotBuyFlagRecords();
    const nowSaved = entries.map((entry) => {
      const existingRow = entry.id
        ? existing.find((item) => item.id === entry.id)
        : undefined;
      return normalizeBuyNotBuyFlagRecord(entry, existingRow);
    });

    const retained = existing.filter(
      (item) => !nowSaved.some((saved) => saved.id === item.id),
    );

    saveBuyNotBuyFlagRecords([...nowSaved, ...retained]);
    message.success("Buy/Not Buy parameter saved");
    goBackToSystemSettings();
  };

  const completeCount = useMemo(
    () => entries.filter((entry) => !validateEntry(entry)).length,
    [entries],
  );

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      <div className="border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              onClick={goBackToSystemSettings}
            >
              <LeftOutlined />
              <span>Back to System Parameters</span>
            </button>

            <div className="flex items-center gap-2">
              <Button onClick={goBackToSystemSettings}>Cancel</Button>
              {!isReadOnly && (
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                  Save Parameter
                </Button>
              )}
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">
              {isEditMode
                ? "Edit Parameter for Buy/Not Buy"
                : isDetailMode
                  ? "Detail Parameter for Buy/Not Buy"
                  : "Add Parameter for Buy/Not Buy"}
            </div>
            <div className="text-sm text-gray-500">
              Create Buy or Not Buy flag
              <span className="mx-2">•</span>
              {entries.length} entry
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="mx-auto max-w-6xl space-y-5">
          {entries.map((entry, idx) => {
            const metrics = computeBuyNotBuyMetrics(entry);

            return (
              <Card key={entry.localId} className="rounded-2xl" bodyStyle={{ padding: 24 }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-gray-900">
                      Add New Parameter #{idx + 1}
                    </div>
                    <div className="text-sm text-gray-500">
                      Configure Parameter for Buy/Not Buy
                    </div>
                  </div>
                  <Tag className="rounded-full border border-blue-100 bg-blue-50 text-blue-700">
                    Entry {idx + 1}
                  </Tag>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-12">
                    <div className="mb-2 text-sm text-gray-700">Uniq</div>
                    <Select
                      value={entry.uniq || undefined}
                      onChange={(value) => applyMaterialOption(entry.localId, value)}
                      options={materialOptions.map((item) => ({
                        value: item.uniq,
                        label: `${item.uniq} - ${item.materialName}`,
                      }))}
                      placeholder="Select material uniq"
                      disabled={isReadOnly}
                      optionFilterProp="label"
                    />
                  </div>

                  <div className="lg:col-span-6">
                    <div className="mb-2 text-sm text-gray-700">Material Code</div>
                    <Input value={entry.materialCode} readOnly />
                  </div>

                  <div className="lg:col-span-6">
                    <div className="mb-2 text-sm text-gray-700">Material Name</div>
                    <Input value={entry.materialName} readOnly />
                  </div>

                  <div className="lg:col-span-3">
                    <div className="mb-2 text-sm text-gray-700">Safety Stock Param</div>
                    <Select
                      value={entry.safetyStockParam}
                      onChange={(value) => updateEntry(entry.localId, { safetyStockParam: value })}
                      options={SAFETY_STOCK_OPTIONS}
                      disabled={isReadOnly}
                    />
                  </div>

                  <div className="lg:col-span-3">
                    <div className="mb-2 text-sm text-gray-700">Delivery Cycle</div>
                    <InputNumber
                      className="w-full"
                      value={entry.deliveryCycle}
                      onChange={(value) => updateEntry(entry.localId, { deliveryCycle: value ?? 0 })}
                      min={1}
                      addonAfter="Days"
                      disabled={isReadOnly}
                    />
                  </div>

                  <div className="lg:col-span-3">
                    <div className="mb-2 text-sm text-gray-700">Current Stock</div>
                    <InputNumber
                      className="w-full"
                      value={entry.currentStock}
                      onChange={(value) => updateEntry(entry.localId, { currentStock: value ?? 0 })}
                      min={0}
                      disabled={isReadOnly}
                    />
                  </div>

                  <div className="lg:col-span-3">
                    <div className="mb-2 text-sm text-gray-700">Safety Stock</div>
                    <InputNumber
                      className="w-full"
                      value={entry.safetyStock}
                      onChange={(value) => updateEntry(entry.localId, { safetyStock: value ?? 0 })}
                      min={0}
                      disabled={isReadOnly}
                    />
                  </div>

                  <div className="lg:col-span-6">
                    <div className="mb-2 text-sm text-gray-700">Buy Flag</div>
                    <Input value={metrics.buyFlag} readOnly />
                  </div>

                  <div className="lg:col-span-6">
                    <div className="mb-2 text-sm text-gray-700">Kanban Std</div>
                    <InputNumber
                      className="w-full"
                      value={entry.kanbanStd}
                      onChange={(value) => updateEntry(entry.localId, { kanbanStd: value ?? 0 })}
                      min={0}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 rounded-2xl border border-[#d6e5ff] bg-[#f8fbff] p-4 lg:grid-cols-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Daily Usage
                    </div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">
                      {metrics.dailyUsage.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Stock Days
                    </div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">
                      {metrics.stockDays}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </div>
                    <Tag
                      className={`mt-2 rounded-full border px-3 py-0.5 ${metrics.status === "Overstock" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                    >
                      {metrics.status}
                    </Tag>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      High Ratio
                    </div>
                    <InputNumber
                      className="mt-1 w-full"
                      value={entry.highRatio}
                      onChange={(value) => updateEntry(entry.localId, { highRatio: value ?? 2 })}
                      min={0.1}
                      step={0.1}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </Card>
            );
          })}

          {!isReadOnly && (
            <div className="flex items-center justify-center">
              <Button icon={<PlusOutlined />} onClick={addAnotherParameter}>
                Add Another Parameter
              </Button>
            </div>
          )}

          <Card className="rounded-2xl" bodyStyle={{ padding: 18 }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-gray-900">Summary</div>
                <div className="text-sm text-gray-500">
                  {entries.length} Parameter ready to be saved
                </div>
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