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
  useGetStockdaysByIdQuery,
  useUpdateStockdaysMutation,
} from "@/lib/api/system-settings/api";

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

  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data]
  );

  const uniqOptions = useMemo(
    () =>
      bomIndex.options.map((item) => ({
        value: item.value,
        label: bomIndex.partNameByUniq[item.value]
          ? `${item.value} - ${bomIndex.partNameByUniq[item.value]}`
          : item.value,
      })),
    [bomIndex]
  );

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
        router.push("/system-settings");
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
      router.push("/system-settings");
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
              className="flex items-center gap-2 text-sm text-gray-600"
              onClick={() => router.push("/system-settings")}
            >
              <LeftOutlined />
              Back to System Parameters
            </button>

            <div className="flex gap-2">
              <Button onClick={() => router.push("/system-settings")}>
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
                    label="Calculation Type"
                    name="calculationType"
                    rules={[{ required: true }]}
                  >
                    <Select
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

                  <Form.Item
                    label="Constanta"
                    name="constanta"
                  >
                    <InputNumber
                      className="w-full"
                      min={0}
                    />
                  </Form.Item>

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