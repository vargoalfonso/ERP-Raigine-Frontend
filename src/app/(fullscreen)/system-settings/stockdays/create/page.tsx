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
import { apiBaseUrl } from "@/lib/api/instance";
import { useCreateStockdaysMutation, useGetStockdaysQuery } from "@/lib/api/system-settings/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { mockBomTree } from "@/lib/mock/bomTree";
import { useGetAllRawMaterialsQuery } from "@/lib/api/raw-materials/api";
import { useGetAllIndirectRawMaterialQuery } from "@/lib/api/indirect-raw-material/api";
import { useGetAllSubconRawMaterialQuery } from "@/lib/api/subcon-raw-material/api";
import { useGetAllQuery as useGetAllFinishedGoodsQuery } from "@/lib/api/finished-goods/api";
import {
  collectBomUniqsForInventoryType,
  INVENTORY_TYPE_OPTIONS,
  type InventoryType,
} from "@/lib/utils/bomInventoryType";

type Entry = {
  id: string;
  uniq?: string;
  parameterNote?: string;
  constanta?: number;
  created: boolean;
};

const UNIQ_OPTIONS: Array<{ label: string; value: string }> = [];

const STOCKDAYS_CALCULATION_TYPE = "Stockdays - DailyUsage = Stock / Daily Usage (Data history)";

const FALLBACK_PARAMETER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: STOCKDAYS_CALCULATION_TYPE, value: STOCKDAYS_CALCULATION_TYPE },
];

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    uniq: undefined,
    parameterNote: FALLBACK_PARAMETER_OPTIONS[0]?.value,
    constanta: undefined,
    created: false,
  };
}

export default function StockdaysCreatePage() {
  const router = useRouter();

  const apiEnabled = Boolean(apiBaseUrl);
  const [type, setType] = useState<InventoryType | undefined>(undefined);
  const [entries, setEntries] = useState<Entry[]>([makeEntry(1)]);

  const [createStockdays, { isLoading: isSaving }] = useCreateStockdaysMutation();

  const { data: existingStockdays } = useGetStockdaysQuery(undefined, {
    skip: !apiEnabled,
    refetchOnMountOrArgChange: true,
  });

  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, { skip: !apiEnabled });

  const { data: rawMaterialsRes, isFetching: isFetchingRawMaterials } = useGetAllRawMaterialsQuery(
    { currentPage: 1, pageSize: 10000 },
    { skip: !apiEnabled || type !== "Raw Material" }
  );
  const { data: indirectRes, isFetching: isFetchingIndirect } = useGetAllIndirectRawMaterialQuery(
    { currentPage: 1, pageSize: 10000 },
    { skip: !apiEnabled || type !== "Indirect Raw Material" }
  );
  const { data: subconRes, isFetching: isFetchingSubcon } = useGetAllSubconRawMaterialQuery(
    { currentPage: 1, pageSize: 10000 },
    { skip: !apiEnabled || type !== "SubCon" }
  );
  const { data: finishedGoodsRes, isFetching: isFetchingFinishedGoods } = useGetAllFinishedGoodsQuery(
    { currentPage: 1, pageSize: 10000 },
    { skip: !apiEnabled || type !== "Finished Goods" }
  );

  const bomSource = useMemo(() => {
    const apiTree = bomTreeRes?.data ?? [];
    return apiTree.length > 0 ? apiTree : mockBomTree;
  }, [bomTreeRes?.data]);

  const bomIndex = useMemo(() => buildBomUniqIndex(bomSource), [bomSource]);

  const fallbackUniqOptions = useMemo(() => {
    if (!type) return [];
    const uniqs = collectBomUniqsForInventoryType(bomSource as unknown as import("@/lib/api/bom/api").BackendBomNode[], type);
    const allowed = new Set(uniqs);
    return bomIndex.options.filter((o) => allowed.has(o.value));
  }, [bomIndex.options, bomSource, type]);

  const uniqOptions = useMemo(() => {
    if (!type) return [];

    // Requirement: when API is enabled, UNIQ must come from the DB list for each type.
    if (apiEnabled) {
      const uniqs: string[] = [];

      if (type === "Raw Material") {
        for (const item of rawMaterialsRes?.data ?? []) {
          if (typeof item?.uniq === "string" && item.uniq.trim()) uniqs.push(item.uniq.trim());
        }
      } else if (type === "Indirect Raw Material") {
        for (const item of indirectRes?.data ?? []) {
          if (typeof item?.uniq === "string" && item.uniq.trim()) uniqs.push(item.uniq.trim());
        }
      } else if (type === "SubCon") {
        for (const item of subconRes?.data ?? []) {
          if (typeof item?.uniq === "string" && item.uniq.trim()) uniqs.push(item.uniq.trim());
        }
      } else if (type === "Finished Goods") {
        for (const fg of finishedGoodsRes?.data ?? []) {
          const u = fg?.master_list?.uniq_code;
          if (typeof u === "string" && u.trim()) uniqs.push(u.trim());
        }
      }

      return Array.from(new Set(uniqs))
        .sort((a, b) => a.localeCompare(b))
        .map((u) => ({ label: u, value: u }));
    }

    return fallbackUniqOptions;
  }, [
    apiEnabled,
    fallbackUniqOptions,
    finishedGoodsRes?.data,
    indirectRes?.data,
    rawMaterialsRes?.data,
    subconRes?.data,
    type,
  ]);

  const isUniqLoading =
    Boolean(type) &&
    apiEnabled &&
    ((type === "Raw Material" && isFetchingRawMaterials) ||
      (type === "Indirect Raw Material" && isFetchingIndirect) ||
      (type === "SubCon" && isFetchingSubcon) ||
      (type === "Finished Goods" && isFetchingFinishedGoods));

  const parameterOptions = useMemo(() => {
    // Stockdays calculation type is informational only but backend expects a specific allowed value.
    // Keep it fixed to prevent validation errors.
    return [{ label: STOCKDAYS_CALCULATION_TYPE, value: STOCKDAYS_CALCULATION_TYPE }];
  }, []);

  const completeCount = useMemo(() => entries.filter((e) => e.created).length, [entries]);

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const validateEntry = (e: Entry) => {
    if (!e.uniq) return "Uniq is required";
    if (!e.parameterNote) return "Parameter is required";
    if (e.constanta === undefined || e.constanta === null) return "Constanta is required";
    return null;
  };

  const onCreateStockDays = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    const err = validateEntry(entry);
    if (err) {
      message.error(err);
      return;
    }

    if (!apiEnabled) {
      updateEntry(id, { created: true });
      message.success("Entry saved");
      return;
    }

    try {
      await createStockdays({
        inventory_type: type!,
        item_uniq_code: entry.uniq!,
        calculation_type: entry.parameterNote!,
        constanta: entry.constanta!,
      }).unwrap();
      updateEntry(id, { created: true });
      message.success("Entry saved");
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Failed to save entry"));
    }
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, makeEntry(prev.length + 1)]);
  };

  const onSave = async () => {
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
      message.success("Stockdays parameter saved");
      router.push("/system-settings");
      return;
    }

    try {
      for (const e of entries) {
        if (e.created) continue;
        await createStockdays({
          inventory_type: type,
          item_uniq_code: e.uniq!,
          calculation_type: e.parameterNote!,
          constanta: e.constanta!,
        }).unwrap();
        updateEntry(e.id, { created: true });
      }

      message.success("Stockdays parameter saved");
      router.push("/system-settings");
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, "Failed to save stockdays parameter"));
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
              <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={isSaving}>
                Save Parameter
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">
              Add Parameter for Stockdays Option
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
                <div className="text-sm text-gray-500">Select Type before create Stockdays</div>
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
                  onChange={(v) => {
                    setType(v);
                    setEntries((prev) => prev.map((e) => ({ ...e, uniq: undefined, created: false })));
                  }}
                  placeholder="Select Type"
                  options={INVENTORY_TYPE_OPTIONS}
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
                        value={e.uniq}
                        onChange={(v) => updateEntry(e.id, { uniq: v, created: false })}
                        placeholder={type ? "Select Uniq" : "Select Type first"}
                        options={type ? uniqOptions : UNIQ_OPTIONS}
                        disabled={!type}
                        loading={isUniqLoading}
                        showSearch
                        optionFilterProp="label"
                      />
                    </div>

                    <div className="lg:col-span-4">
                      <div className="text-sm text-gray-700 mb-2">Parameter (note)</div>
                      <Select
                        value={e.parameterNote}
                        onChange={(v) => updateEntry(e.id, { parameterNote: v, created: false })}
                        placeholder="Select parameter note"
                        options={parameterOptions}
                        disabled
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
