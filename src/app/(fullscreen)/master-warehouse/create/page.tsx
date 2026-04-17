"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Select,
  Skeleton,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  useCreateWarehouseMutation,
  useGetWarehouseByIdQuery,
  useUpdateWarehouseMutation,
} from "@/lib/api/warehouse/api";

type FormValues = {
  warehouse_name?: string;
  type_warehouse?: string;
  plant_id?: string;
};

const WAREHOUSE_TYPE_OPTIONS = ["RM", "Finished Goods", "Indirect RM", "Subcon"];
const PLANT_OPTIONS = [
  { label: "Plant 1", value: "1" },
  { label: "Plant 2", value: "2" },
  { label: "Plant 3", value: "3" },
];

const pickText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const normalizePlantId = (value: unknown) => {
  const raw = pickText(value);
  if (raw === "Plant 1") return "1";
  if (raw === "Plant 2") return "2";
  if (raw === "Plant 3") return "3";
  return raw;
};

export default function CreateMasterWarehousePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<FormValues>();

  const apiEnabled = Boolean(apiBaseUrl);
  const isEditMode = searchParams.get("mode") === "edit";
  const itemId = String(searchParams.get("id") ?? "").trim();

  const detailQuery = useGetWarehouseByIdQuery(itemId, {
    skip: !apiEnabled || !isEditMode || !itemId,
  });
  const [createWarehouse, createState] = useCreateWarehouseMutation();
  const [updateWarehouse, updateState] = useUpdateWarehouseMutation();

  useEffect(() => {
    if (!detailQuery.data) return;

    form.setFieldsValue({
      warehouse_name: pickText(detailQuery.data.warehouse_name),
      type_warehouse: pickText(detailQuery.data.type_warehouse),
      plant_id: normalizePlantId(detailQuery.data.plant_id ?? detailQuery.data.plant_name),
    });
  }, [detailQuery.data, form]);

  const handleSave = async () => {
    if (!apiEnabled) {
      messageApi.warning("Set NEXT_PUBLIC_API_URL before saving warehouses.");
      return;
    }

    try {
      const values = await form.validateFields();
      const payload = {
        warehouse_name: pickText(values.warehouse_name),
        type_warehouse: pickText(values.type_warehouse),
        plant_id: pickText(values.plant_id),
      };

      if (isEditMode) {
        await updateWarehouse({ id: itemId, body: payload }).unwrap();
        messageApi.success("Warehouse updated");
      } else {
        await createWarehouse(payload).unwrap();
        messageApi.success("Warehouse created");
      }

      router.push("/master-warehouse");
    } catch (saveError) {
      if (typeof saveError === "object" && saveError && "errorFields" in saveError) {
        messageApi.error("Please complete all required fields");
        return;
      }
      messageApi.error(getApiErrorMessage(saveError, "Failed to save warehouse"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {contextHolder}

      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.push("/master-warehouse")}>
              Back to Master Warehouse
            </Button>
            <Typography.Title level={3} className="!mb-1 !mt-2">
              {isEditMode ? "Edit Warehouse" : "Create Warehouse"}
            </Typography.Title>
            <Typography.Text type="secondary">
              {isEditMode ? "Update warehouse master data" : "Add a new warehouse master record"}
            </Typography.Text>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => router.push("/master-warehouse")}>Cancel</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={createState.isLoading || updateState.isLoading}
              onClick={handleSave}
            >
              {isEditMode ? "Update Warehouse" : "Save Warehouse"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-6 space-y-6">
        {!apiEnabled ? (
          <Alert
            type="warning"
            showIcon
            message="Backend is not configured"
            description="Set NEXT_PUBLIC_API_URL to enable warehouse create and edit operations."
          />
        ) : null}

        {apiEnabled && detailQuery.error ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load warehouse detail"
            description={getApiErrorMessage(detailQuery.error, "Unable to fetch warehouse detail")}
          />
        ) : null}

        {apiEnabled && detailQuery.isLoading ? (
          <Card className="rounded-2xl border border-gray-100 shadow-sm">
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        ) : (
          <Card className="rounded-2xl border border-gray-100 shadow-sm">
            <Form form={form} layout="vertical">
              <Form.Item
                label="Warehouse Name"
                name="warehouse_name"
                rules={[{ required: true, message: "Please input warehouse name" }]}
              >
                <Input size="large" placeholder="e.g. Main Raw Material Warehouse" />
              </Form.Item>

              <Form.Item
                label="Type Warehouse"
                name="type_warehouse"
                rules={[{ required: true, message: "Please select warehouse type" }]}
              >
                <Select
                  size="large"
                  placeholder="Select warehouse type"
                  options={WAREHOUSE_TYPE_OPTIONS.map((value) => ({ label: value, value }))}
                />
              </Form.Item>

              <Form.Item
                label="Choose Plant"
                name="plant_id"
                rules={[{ required: true, message: "Please select plant" }]}
              >
                <Select size="large" placeholder="Select plant" options={PLANT_OPTIONS} />
              </Form.Item>
            </Form>
          </Card>
        )}
      </div>
    </div>
  );
}
