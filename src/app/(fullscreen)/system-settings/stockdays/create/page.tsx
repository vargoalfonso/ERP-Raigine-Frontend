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
  itemCode?: string;
  stockDays?: number;
  safetyStock?: number;
  status?: "Active" | "Inactive";
};

const toUiStatus = (value: unknown): "Active" | "Inactive" =>
  String(value ?? "active").toLowerCase().includes("inact") ? "Inactive" : "Active";

const toBackendStatus = (value: FormValues["status"]): string =>
  value === "Inactive" ? "inactive" : "active";

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
  const itemCodeOptions = useMemo(
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
      form.setFieldsValue({ status: "Active" });
      return;
    }

    const detail = stockdaysDetailQuery.data;
    if (!detail) return;

    form.setFieldsValue({
      itemCode: String(detail.item_code ?? ""),
      stockDays: Number(detail.stock_days ?? 0),
      safetyStock: Number(detail.safety_stock ?? 0),
      status: toUiStatus(detail.status),
    });
  }, [form, id, stockdaysDetailQuery.data]);

  const onSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        item_code: String(values.itemCode ?? "").trim(),
        stock_days: Number(values.stockDays ?? 0),
        safety_stock: Number(values.safetyStock ?? 0),
        status: toBackendStatus(values.status),
      };

      if (apiEnabled) {
        if (isEditMode && id) {
          await updateStockdays({
            id,
            body: {
              stock_days: payload.stock_days,
              safety_stock: payload.safety_stock,
              status: payload.status,
            },
          }).unwrap();
          message.success("Stockdays updated");
        } else {
          await createStockdays(payload).unwrap();
          message.success("Stockdays created");
        }
      } else {
        message.success(isEditMode ? "Stockdays updated" : "Stockdays created");
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

            <Form form={form} layout="vertical" requiredMark={false} className="mt-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Form.Item
                  label="Item Code"
                  name="itemCode"
                  rules={[{ required: true, message: "Item Code is required" }]}
                >
                  <Select
                    placeholder="Select Item Code"
                    options={itemCodeOptions}
                    showSearch
                    optionFilterProp="label"
                    disabled={isReadOnly || isEditMode}
                  />
                </Form.Item>

                <Form.Item label="Status" name="status" rules={[{ required: true, message: "Status is required" }]}>
                  <Select
                    disabled={isReadOnly}
                    options={[
                      { label: "Active", value: "Active" },
                      { label: "Inactive", value: "Inactive" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  label="Stock Days"
                  name="stockDays"
                  rules={[{ required: true, message: "Stock Days is required" }]}
                >
                  <InputNumber className="w-full" min={0} disabled={isReadOnly} />
                </Form.Item>

                <Form.Item
                  label="Safety Stock"
                  name="safetyStock"
                  rules={[{ required: true, message: "Safety Stock is required" }]}
                >
                  <InputNumber className="w-full" min={0} disabled={isReadOnly} />
                </Form.Item>
              </div>

              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                <InfoCircleOutlined className="text-blue-600" />
                <span>Item code akan dikirim menggunakan UNIQ code dari BOM.</span>
              </div>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  );
}
