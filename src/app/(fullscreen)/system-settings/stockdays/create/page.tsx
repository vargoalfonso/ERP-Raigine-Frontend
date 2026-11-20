"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Card, Form, InputNumber, Modal, Select, Tag, message } from "antd";
import { LeftOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";

import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetBomListQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";

import { ALL_UNIQ_VALUE, isAllUniq, uniqsInCategory } from "@/lib/utils/safetyStockEntries";
import { isForecastCalculation } from "@/lib/utils/safetyStockEntries";
import {
  effectiveConstanta,
  expandStockdaysEntries,
  hidesConstanta,
  supportsForecastStockdays,
} from "@/lib/utils/stockdaysEntries";

import {
  useCreateStockdaysBulkMutation,
  useCreateStockdaysMutation,
  useGetKanbanStandardsQuery,
  useGetStockdaysQuery,
  useGetStockdaysByIdQuery,
  useUpdateStockdaysMutation,
} from "@/lib/api/system-settings/api";

const TYPE_LABELS: Record<string, string> = {
  raw_material: "Raw Material",
  finished_goods: "Finished Goods",
  indirect_material: "Indirect Raw Material",
  subcon: "SubCon",
};

type FormValues = {
  inventoryType?: string;
  itemCode?: string;
  calculationType?: string;
  constanta?: number;
};

type EntryType = {
  inventoryType: string;
  itemCode: string;
  calculationType: string;
  constanta?: number;
};

export default function StockdaysCreatePage() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goBackToSystemSettings = () => {
    if (typeof window !== "undefined") {
      window.location.replace("/system-settings");
      return;
    }
    router.replace("/system-settings");
  };

  const [form] = Form.useForm<FormValues>();
  const [entries, setEntries] = useState<EntryType[]>([]);

  const apiEnabled = Boolean(apiBaseUrl);

  const id = searchParams.get("id") ?? "";
  const mode = (searchParams.get("mode") ?? "create").toLowerCase();

  const isEditMode = mode === "edit";
  const isDetailMode = mode === "detail" || mode === "view";
  const isReadOnly = isDetailMode;

  const [createStockdays, createState] = useCreateStockdaysMutation();
  const [updateStockdays, updateState] = useUpdateStockdaysMutation();
  const [createStockdaysBulk, bulkState] = useCreateStockdaysBulkMutation();
  const [modal, modalContextHolder] = Modal.useModal();
  const { data: stockdaysList } = useGetStockdaysQuery(undefined, {
    skip: !apiEnabled,
  });

  const { data: bomTreeRes } = useGetBomListQuery({ limit: 200 }, {
    skip: !apiEnabled,
  });

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data]
  );

  const selectedInventoryType = Form.useWatch("inventoryType", form);
  const selectedCalculationType = Form.useWatch("calculationType", form);
  const selectedItemCode = Form.useWatch("itemCode", form);
  const hideConstanta = hidesConstanta(selectedCalculationType);
  const isForecast = isForecastCalculation(selectedCalculationType);

  // Uniq options are sourced entirely from the Bill of Material (see uniqOptions).

  const uniqOptions = useMemo(() => {
    const currentItemCode = String(form.getFieldValue("itemCode") ?? "").trim();

    // Read ALL uniq from the Bill of Material (not from inventory).
    const baseOptions = bomIndex.options.map((item) => ({
      value: item.value,
      label: bomIndex.partNameByUniq[item.value]
        ? `${item.value} - ${bomIndex.partNameByUniq[item.value]}`
        : item.value,
    }));

    const used = new Set<string>();
    for (const item of stockdaysList ?? []) {
      const uniq = String(item?.item_code ?? "").trim();
      const inventoryType = String(item?.inventory_type ?? "").trim();
      if (!uniq) continue;
      if (selectedInventoryType && inventoryType && inventoryType !== selectedInventoryType) continue;
      used.add(uniq);
    }

    return baseOptions.filter((option) => {
      if (currentItemCode && option.value === currentItemCode) return true;
      return !used.has(option.value);
    });
  }, [bomIndex, form, selectedInventoryType, stockdaysList]);

  // Kanban Standard aktif = uniq Finished Goods.
  const { data: kanbanStandards } = useGetKanbanStandardsQuery(undefined, {
    skip: !apiEnabled,
  });
  const finishedGoodsUniqs = useMemo(
    () =>
      (kanbanStandards ?? [])
        .filter((k) => String(k?.status ?? "").toLowerCase() === "active")
        .map((k) => String(k?.item_uniq_code ?? "").trim())
        .filter(Boolean),
    [kanbanStandards],
  );

  // Uniq untuk "All Uniq in <Type>": hanya yang KATEGORInya sama dengan Type dan
  // belum punya parameter Stockdays untuk Type itu.
  const availableUniqsFor = (inventoryType: string): string[] => {
    const used = new Set<string>();
    for (const item of stockdaysList ?? []) {
      const uniq = String(item?.item_code ?? "").trim();
      const type = String(item?.inventory_type ?? "").trim();
      if (!uniq) continue;
      if (type && type !== inventoryType) continue;
      used.add(uniq);
    }
    return uniqsInCategory(
      inventoryType,
      { materialSpecByUniq: bomIndex.materialSpecByUniq, finishedGoodsUniqs },
      bomIndex.options.map((option) => option.value).filter((u) => !used.has(u)),
    );
  };

  const categoryUniqs = useMemo(
    () =>
      selectedInventoryType
        ? uniqsInCategory(
            selectedInventoryType,
            { materialSpecByUniq: bomIndex.materialSpecByUniq, finishedGoodsUniqs },
            uniqOptions.map((option) => String(option.value)),
          )
        : [],
    [selectedInventoryType, bomIndex.materialSpecByUniq, finishedGoodsUniqs, uniqOptions],
  );

  const typeLabel = TYPE_LABELS[String(selectedInventoryType ?? "")] ?? "";

  // Uniq yang akan diambil "All Uniq" untuk Type terpilih (uniq manual di Summary tidak ikut).
  const allUniqTargetCount = useMemo(
    () =>
      categoryUniqs.filter(
        (u) => !entries.some((e) => e.inventoryType === selectedInventoryType && e.itemCode === u),
      ).length,
    [categoryUniqs, entries, selectedInventoryType],
  );

  // Pilihan Uniq: "All Uniq in <Type> (N)" di paling atas (hanya saat membuat baru).
  const uniqSelectOptions = useMemo(() => {
    if (isEditMode || isReadOnly || !selectedInventoryType || categoryUniqs.length === 0) {
      return uniqOptions;
    }
    return [
      { value: ALL_UNIQ_VALUE, label: `All Uniq in ${typeLabel} (${categoryUniqs.length})` },
      ...uniqOptions,
    ];
  }, [isEditMode, isReadOnly, selectedInventoryType, categoryUniqs, typeLabel, uniqOptions]);

  const detailQuery = useGetStockdaysByIdQuery(id, {
    skip: !apiEnabled || !id,
  });

  useEffect(() => {
    if (!detailQuery.data || !id) return;

    const item = detailQuery.data;

    form.setFieldsValue({
      inventoryType: item.inventory_type,
      itemCode: item.item_code,
      calculationType: item.calculation_type,
      constanta: item.constanta,
    });
  }, [detailQuery.data, form, id]);

  useEffect(() => {
    const currentItemCode = form.getFieldValue("itemCode");
    if (currentItemCode && uniqSelectOptions.some((option) => option.value === currentItemCode)) {
      return;
    }
    form.setFieldsValue({ itemCode: uniqOptions[0]?.value });
  }, [form, uniqOptions, uniqSelectOptions]);

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();

      if (isForecastCalculation(values.calculationType) && !supportsForecastStockdays(values.inventoryType)) {
        message.warning("Demand Forecasting hanya untuk Raw Material dan Indirect Raw Material");
        return;
      }

      const duplicate = entries.find(
        (x) =>
          x.inventoryType === values.inventoryType &&
          x.itemCode === values.itemCode
      );

      if (duplicate) {
        message.warning("Type + Uniq already added");
        return;
      }

      setEntries((prev) => [
        ...prev,
        {
          inventoryType: values.inventoryType!,
          itemCode: values.itemCode!,
          calculationType: values.calculationType!,
          // Data history dikirim 100 (= 100% daily usage); Demand Forecasting dikirim 0.
          constanta: effectiveConstanta(values.calculationType, values.constanta),
        },
      ]);

      form.resetFields(["itemCode", "calculationType", "constanta"]);

      message.success("Parameter added");
    } catch {}
  };

  const handleSave = async () => {
    try {
      if (entries.length === 0 && !isEditMode) {
        message.error("Please add minimum one parameter");
        return;
      }

      if (isEditMode && id) {
        const values = await form.validateFields();

        await updateStockdays({
          id,
          body: {
            inventory_type: values.inventoryType,
            item_code: values.itemCode,
            calculation_type: values.calculationType,
            constanta: effectiveConstanta(values.calculationType, values.constanta),
            status: "active",
          },
        }).unwrap();

        message.success("Stockdays updated");
        goBackToSystemSettings();
        return;
      }

      // "All Uniq" dikembangkan ke semua uniq sekategori; uniq manual didahulukan.
      const expanded = expandStockdaysEntries(entries, availableUniqsFor);
      if (!expanded.ok) {
        message.error(expanded.error);
        return;
      }
      const { items, allUniqCount } = expanded;

      if (allUniqCount > 0) {
        const confirmed = await new Promise<boolean>((resolve) => {
          modal.confirm({
            title: `Terapkan ke ${allUniqCount} Uniq?`,
            content: `Parameter akan dibuat untuk ${allUniqCount} Uniq yang belum punya parameter Stockdays (sesuai kategori Type-nya). Total ${items.length} parameter akan disimpan.`,
            okText: "Terapkan",
            cancelText: "Batal",
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!confirmed) return;
      }

      if (items.length === 1) {
        await createStockdays(items[0]).unwrap();
      } else {
        await createStockdaysBulk({ items }).unwrap();
      }

      message.success("Stockdays created");
      goBackToSystemSettings();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed save stockdays"));
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      {modalContextHolder}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center">
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-gray-600"
              onClick={goBackToSystemSettings}
            >
              <LeftOutlined />
              Back to System Parameters
            </button>

            <div className="flex gap-2">
              <Button onClick={goBackToSystemSettings}>
                Cancel
              </Button>

              {!isReadOnly && (
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={
                    createState.isLoading || updateState.isLoading || bulkState.isLoading
                  }
                  onClick={handleSave}
                >
                  {isEditMode ? "Update Parameter" : "Save Parameter"}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3">
            <h1 className="text-2xl font-semibold">
              Add Parameter for Stockdays Option
            </h1>

            <p className="text-gray-500 text-sm">
              Create Stockdays • {entries.length} entry
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Card>
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
            >
              <div className="flex justify-between">
                <div>
                  <h3 className="font-semibold text-lg">
                    Step 1: Select Type
                  </h3>
                  <p className="text-sm text-gray-500">
                    Select Type before create Stockdays
                  </p>
                </div>

                <Tag color="blue">Required</Tag>
              </div>

              <Form.Item
                label="Type"
                name="inventoryType"
                rules={[{ required: true }]}
                className="mt-5"
              >
                <Select
                  placeholder="Select Type"
                  disabled={isReadOnly}
                  options={[
                    {
                      label: "Raw Material",
                      value: "raw_material",
                    },
                    {
                      label: "Finished Goods",
                      value: "finished_goods",
                    },
                    {
                      label: "Indirect Raw Material",
                      value: "indirect_material",
                    },
                    {
                      label: "SubCon",
                      value: "subcon",
                    },
                  ]}
                />
              </Form.Item>

              <div className="mt-8">
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      Step 2: Input Data
                    </h3>
                    <p className="text-sm text-gray-500">
                      Input Data for each Items
                    </p>
                  </div>

                  <Tag color="blue">
                    Entry {entries.length + 1}
                  </Tag>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-5">
                  <Form.Item
                    label="Uniq"
                    name="itemCode"
                    rules={[{ required: true }]}
                    extra={
                      isAllUniq(selectedItemCode) ? (
                        <span className="text-blue-700">
                          Diterapkan ke {allUniqTargetCount} Uniq kategori {typeLabel} yang belum punya
                          parameter.
                        </span>
                      ) : undefined
                    }
                  >
                    <Select
                      placeholder="Select Uniq"
                      showSearch
                      optionFilterProp="label"
                      options={uniqSelectOptions}
                      virtual
                      listHeight={320}
                    />
                  </Form.Item>

                 

                  {!hideConstanta && (
                    <Form.Item
                      label="Constanta (days)"
                      name="constanta"
                    >
                      <InputNumber
                        className="w-full"
                        min={0}
                      />
                    </Form.Item>
                  )}

                 
                   <Form.Item
                    className="lg:col-span-4"
                    label="Calculation Type"
                    name="calculationType"
                    rules={[{ required: true }]}
                  >
                    <Select
                     className="w-full"
                      options={[
                        {
                          label:
                            "Stockdays - PRL = Stock / (PRL / Working Days)",
                          value: "days",
                        },
                        {
                          label:
                            "Stockdats - DailyUsage = Stock / Daily Usage (Data history)",
                          value: "percentage",
                        },
                        {
                          label: "Demand Forecasting result for each Uniq",
                          value: "forecast",
                        },
                      ]}
                    />
                    {isForecast && (
                      <div className="mt-2 text-xs text-gray-500">
                        Stock days memakai hasil Demand Forecasting: daily usage RM/IRM dijumlah
                        dari semua FG yang memakainya di BOM, tanpa Constanta. Hanya untuk Raw
                        Material dan Indirect Raw Material. Dihitung otomatis oleh job forecasting.
                      </div>
                    )}
                  </Form.Item>
                </div>
                 <div className="flex items-end">
                    <Button
                      type="primary"
                      block
                      onClick={handleAdd}
                    >
                      + Create Stock days
                    </Button>
                  </div>
              </div>
            </Form>
          </Card>

          <Card title="Summary">
            <div className="space-y-2">
              {entries.map((item, index) => (
                <div
                  key={index}
                  className="border rounded p-3 flex justify-between"
                >
                  <div>
                    <div>
                      {isAllUniq(item.itemCode)
                        ? `All Uniq in ${TYPE_LABELS[item.inventoryType] ?? item.inventoryType} (${
                            availableUniqsFor(item.inventoryType).filter(
                              (u) =>
                                !entries.some(
                                  (e) => e.inventoryType === item.inventoryType && e.itemCode === u,
                                ),
                            ).length
                          })`
                        : item.itemCode}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.inventoryType} - {item.calculationType}
                    </div>
                  </div>

                  <div>
                    {hidesConstanta(item.calculationType) ? "-" : item.constanta ?? 0}
                  </div>
                </div>
              ))}

              <div className="text-sm text-gray-500">
                {entries.length} Parameter ready to be saved
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}