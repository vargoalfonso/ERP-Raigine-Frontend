"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Button, Card, Form, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";

import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";

import {
  useCreateStockdaysMutation,
  useGetStockdaysQuery,
  useGetStockdaysByIdQuery,
  useUpdateStockdaysMutation,
} from "@/lib/api/system-settings/api";
import { useGetInventoryListQuery } from "@/lib/api/inventory/api";
import { useGetFinishedGoodsQuery } from "@/lib/api/finished-goods/api";

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
  const { data: stockdaysList } = useGetStockdaysQuery(undefined, {
    skip: !apiEnabled,
  });

  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data]
  );

  const selectedInventoryType = Form.useWatch("inventoryType", form);

  const normalizedInventoryType = String(selectedInventoryType ?? "").trim().toLowerCase();
  const inventoryApiType = (() => {
    switch (normalizedInventoryType) {
      case "raw_material":
      case "raw-material":
        return "raw-materials";
      case "indirect_material":
      case "indirect-raw-material":
        return "indirect-materials";
      case "subcon":
        return "subcon-materials";
      case "finished_goods":
      case "finished-goods":
        return "finished-goods";
      default:
        return undefined;
    }
  })();

  const { data: inventoryListResp } = useGetInventoryListQuery(
    inventoryApiType ? { type: inventoryApiType as any, page: 1, limit: 1000 } : ({} as any),
    { skip: !inventoryApiType || !apiEnabled }
  );
  const finishedGoodsQuery = useGetFinishedGoodsQuery({ page: 1, limit: 1000 }, { skip: !apiEnabled });

  const uniqOptions = useMemo(() => {
    const currentItemCode = String(form.getFieldValue("itemCode") ?? "").trim();

    // prefer inventory API results when available for the selected type
    const apiItems =
      inventoryApiType === "finished-goods"
        ? (finishedGoodsQuery?.data?.items ?? [])
        : (inventoryListResp as any)?.data ?? inventoryListResp ?? [];
    const apiOptions = (apiItems as any[])
      .map((r) => {
        const uniq = r?.uniq_code ?? r?.uniq ?? r?.UniqCode ?? r?.uniqCode;
        if (!uniq) return null;
        const label = uniq + (r?.part_name ? ` - ${r.part_name}` : "");
        return { value: String(uniq), label };
      })
      .filter(Boolean) as { value: string; label: string }[];

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

    // choose source: apiOptions if inventory type selected and results exist, otherwise bomIndex
    const source = inventoryApiType && apiOptions.length > 0 ? apiOptions : baseOptions;

    return source.filter((option) => {
      if (currentItemCode && option.value === currentItemCode) return true;
      return !used.has(option.value);
    });
  }, [inventoryListResp, bomIndex, form, selectedInventoryType, stockdaysList, inventoryApiType]);

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
    if (currentItemCode && uniqOptions.some((option) => option.value === currentItemCode)) {
      return;
    }
    form.setFieldsValue({ itemCode: uniqOptions[0]?.value });
  }, [form, uniqOptions]);

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();

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
          constanta: values.constanta,
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
            constanta: values.constanta,
            status: "active",
          },
        }).unwrap();

        message.success("Stockdays updated");
        goBackToSystemSettings();
        return;
      }

      for (const item of entries) {
        await createStockdays({
          inventory_type: item.inventoryType,
          item_code: item.itemCode,
          calculation_type: item.calculationType,
          constanta: item.constanta,
          status: "active",
        }).unwrap();
      }

      message.success("Stockdays created");
      goBackToSystemSettings();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed save stockdays"));
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
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
                    createState.isLoading || updateState.isLoading
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
                  >
                    <Select
                      placeholder="Select Uniq"
                      showSearch
                      optionFilterProp="label"
                      options={uniqOptions}
                    />
                  </Form.Item>

                 

                  <Form.Item
                    label="Constanta (days)"
                    name="constanta"
                  >
                    <InputNumber
                      className="w-full"
                      min={0}
                    />
                  </Form.Item>

                 
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
                      ]}
                    />
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
                    <div>{item.itemCode}</div>
                    <div className="text-xs text-gray-500">
                      {item.inventoryType} - {item.calculationType}
                    </div>
                  </div>

                  <div>{item.constanta ?? 0}</div>
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