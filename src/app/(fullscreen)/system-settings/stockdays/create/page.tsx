"use client";

import React, { Suspense, useEffect, useMemo } from "react";
import { Button, Card, Form, InputNumber, Select, Tag, message } from "antd";
import {
  InfoCircleOutlined,
  LeftOutlined,
  SaveOutlined,
} from "@ant-design/icons";
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
  itemUniq?: string;
  calculationType?: string;
  constanta?: number;
  stockDays?: number;
};

const toUiStatus = (value: unknown): "Active" | "Inactive" =>
  String(value ?? "active").toLowerCase().includes("inact") ? "Inactive" : "Active";

const toBackendStatus = (value: unknown): string =>
  String(value ?? "active").toLowerCase().includes("inact") ? "inactive" : "active";

export default function StockdaysCreatePage() {
  return (
    <Suspense fallback={null}>
      <StockdaysCreatePageContent />
    </Suspense>
  );
}

function StockdaysCreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiEnabled = Boolean(apiBaseUrl);
  const [form] = Form.useForm<FormValues>();
  const [createStockdays, createState] = useCreateStockdaysMutation();
  const [updateStockdays, updateState] = useUpdateStockdaysMutation();

  const id = searchParams.get("id") ?? "";
  const mode = (searchParams.get("mode") ?? "create").toLowerCase();
  const isEditMode = mode === "edit";
  const isDetailMode = mode === "detail" || mode === "view";
  const isReadOnly = isDetailMode;

  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const bomIndex = useMemo(() => buildBomUniqIndex(bomTreeRes?.data ?? []), [bomTreeRes?.data]);
  const uniqOptions = useMemo(
    () =>
      bomIndex.options.map((option) => ({
        label: bomIndex.partNameByUniq[option.value]
          ? `${option.value} — ${bomIndex.partNameByUniq[option.value]}`
          : option.value,
        value: option.value,
      })),
    [bomIndex.options, bomIndex.partNameByUniq]
  );

  const stockdaysDetailQuery = useGetStockdaysByIdQuery(id, {
    skip: !apiEnabled || !id,
  });

  useEffect(() => {
    if (!id) {
      form.setFieldsValue({});
      return;
    }

    const detail = stockdaysDetailQuery.data;
    if (!detail) return;

    form.setFieldsValue({
      inventoryType: String(detail.inventory_type ?? "raw_material"),
      itemUniq: String(detail.item_uniq_code ?? ""),
      calculationType: String(detail.calculation_type ?? "a"),
      stockDays: Number(detail.stock_days ?? 0),
    });
  }, [form, id, stockdaysDetailQuery.data]);

  const [entries, setEntries] = React.useState<FormValues[]>([{ }]);

  const addEntryToList = async (values: FormValues) => {
    setEntries((prev) => [...prev, values]);
  };

  const onSave = async () => {
    try {
      // collect entries from UI state and submit each to API
      // validate each entry
      for (const e of entries) {
        if (!e.inventoryType || !e.itemUniq || !e.calculationType) {
          message.error("Please complete all parameter entries before saving");
          return;
        }
      }

      if (apiEnabled) {
        for (const e of entries) {
          const payload = {
            inventory_type: String(e.inventoryType),
            item_uniq_code: String(e.itemUniq),
            stock_days: Number(e.stockDays ?? 0),
            status: "active",
            calculation_type: String(e.calculationType ?? "a"),
          };
          await createStockdays(payload).unwrap();
        }
        message.success("Stockdays parameters created");
      } else {
        message.success("Stockdays parameters saved locally");
      }

      router.push("/system-settings");
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(getApiErrorMessage(error, "Failed to save stockdays"));
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
              {!isReadOnly && (
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={onSave}
                  loading={createState.isLoading || updateState.isLoading}
                >
                  {isEditMode ? "Update Parameter" : "Save Parameter"}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">
              {isReadOnly ? "Stockdays Detail" : isEditMode ? "Edit Stockdays Parameter" : "Add Parameter for Stockdays Option"}
            </div>
            <div className="text-sm text-gray-500">
              Configure stock days and safety stock from BOM item code
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <Card className="rounded-2xl" bodyStyle={{ padding: 24 }} loading={Boolean(id) && stockdaysDetailQuery.isFetching}>
            <div className="flex items-start justify-between gap-4">
              <div>
                  <div className="text-base font-semibold text-gray-900">Stockdays Parameter</div>
                  <div className="text-sm text-gray-500">Item code is sourced from BOM UNIQ code</div>
              </div>
              <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Required
              </Tag>
            </div>

              <div className="space-y-6 mt-5">
                <Card type="inner" title="Step 1: Select Type">
                  <Form form={form} layout="vertical" requiredMark={false}>
                    <Form.Item name="inventoryType" label="Type" rules={[{ required: true, message: "Select Type" }] }>
                      <Select placeholder="Select Type" options={[{ label: "Raw Material", value: "raw_material" }, { label: "Finished Goods", value: "finished_goods" }]} disabled={isReadOnly} />
                    </Form.Item>
                  </Form>
                </Card>

                <Card type="inner" title="Step 2: Input Data">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Form.Item name="itemUniq" label="Uniq" rules={[{ required: true, message: "Select Uniq" }] }>
                      <Select placeholder="Select Uniq" options={uniqOptions} showSearch optionFilterProp="label" disabled={isReadOnly} />
                    </Form.Item>

                    <Form.Item name="calculationType" label="Calculation Type" rules={[{ required: true }] }>
                      <Select placeholder="Select Calculation Type" disabled={isReadOnly} options={[{ label: "Stockdays - PRL = Stock / (PRL/Working days)", value: "a" }, { label: "Stockdays - DailyUsage = Stock / Daily Usage (Data history)", value: "b" }]} />
                    </Form.Item>

                    <Form.Item name="constanta" label="Constanta">
                      <InputNumber className="w-full" min={0} placeholder="Input Constanta" disabled={isReadOnly} />
                    </Form.Item>
                  </div>

                  <div className="mt-4">
                    <Button type="primary" onClick={async () => {
                      try {
                        const vals = await form.validateFields();
                        await addEntryToList(vals as FormValues);
                        message.success("Parameter added");
                        form.resetFields(["itemUniq","calculationType","constanta","stockDays"]);
                      } catch (err) {
                        // validation handled by antd
                      }
                    }}>
                      + Create Stock days
                    </Button>
                  </div>
                </Card>

                <div className="flex justify-center">
                  <Button onClick={() => setEntries((p) => [...p, {}])}>+ Add Another Parameter</Button>
                </div>

                <Card title="Summary">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">{entries.length} Parameter ready to be saved</div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{entries.length}</div>
                      <div className="text-xs text-gray-500">Entries</div>
                    </div>
                  </div>
                </Card>
              </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
