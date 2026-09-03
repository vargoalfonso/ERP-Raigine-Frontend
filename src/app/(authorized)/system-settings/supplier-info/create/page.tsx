"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Card, Form, Input, Select, Typography, message } from "antd";

import { getApiErrorMessage } from "@/lib/api/error";
import {
  useCreateSupplierInfoMutation,
} from "@/lib/api/system-settings/api";
import { useListSupplierItemsQuery } from "@/lib/api/supplier-items/api";

const { Title, Text } = Typography;

type SupplierInfoFormValues = {
  uniq: string;
  uniq_zahir?: string;
  status: string;
};

export default function CreateSupplierInfoPage() {
  const router = useRouter();
  const [form] = Form.useForm<SupplierInfoFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [createSupplierInfo, createState] = useCreateSupplierInfoMutation();
  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const { data: supplierItems = [], isLoading } = useListSupplierItemsQuery(undefined, {
    skip: !apiEnabled,
  });

  const uniqOptions = useMemo(() => {
    const seen = new Set<string>();
    return supplierItems
      .filter((item) => {
        const uniq = String(item.uniq_code ?? "").trim();
        if (!uniq || seen.has(uniq)) return false;
        seen.add(uniq);
        return true;
      })
      .map((item) => ({
        value: String(item.uniq_code ?? "").trim(),
        label: String(item.uniq_code ?? "").trim(),
        supplierName: String(item.supplier_name ?? "").trim(),
        type: String(item.type ?? "").trim(),
      }));
  }, [supplierItems]);

  const selectedUniq = Form.useWatch("uniq", form);
  const selectedItem = uniqOptions.find((item) => item.value === selectedUniq);
  const supplierName = selectedItem?.supplierName ?? "";
  const typeMap: Record<string, string> = {
    raw_material: "RM",
    indirect: "IRM",
    subcon: "SUBCON",
  };
  const type = typeMap[selectedItem?.type.toLowerCase() ?? ""] ?? selectedItem?.type.toUpperCase() ?? "";

  const handleSubmit = async (values: SupplierInfoFormValues) => {
    if (!selectedItem || !supplierName || !type) {
      messageApi.error("Supplier Name dan Type tidak ditemukan dari Supplier Item.");
      return;
    }

    try {
      await createSupplierInfo({
        uniq: values.uniq,
        uniq_zahir: values.uniq_zahir,
        supplier_name: supplierName,
        type,
        status: values.status ?? "active",
      }).unwrap();
      messageApi.success("Supplier Info berhasil ditambahkan");
      router.push("/system-settings");
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, "Gagal menambahkan Supplier Info"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 md:px-6">
      {contextHolder}
      <div className="mx-auto max-w-3xl">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/system-settings")}
          className="mb-4"
        >
          Back to System Settings
        </Button>

        <Card className="rounded-2xl shadow-sm">
          <div className="mb-6">
            <Title level={3} className="!mb-1">
              Add Supplier Info
            </Title>
            <Text type="secondary">Mapping UNIQ ke UNIQ Zahir supplier</Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            initialValues={{ status: "active" }}
            onFinish={handleSubmit}
          >
            <Form.Item
              label="UNIQ"
              name="uniq"
              rules={[{ required: true, message: "UNIQ wajib dipilih" }]}
            >
              <Select
                showSearch
                loading={isLoading}
                placeholder="Pilih UNIQ dari Supplier Item"
                optionFilterProp="label"
                options={uniqOptions}
              />
            </Form.Item>

            <div className="grid gap-4 md:grid-cols-2">
              <Form.Item label="Supplier Name">
                <Input value={supplierName} disabled placeholder="Otomatis dari UNIQ" />
              </Form.Item>
              <Form.Item label="Type">
                <Input value={type} disabled placeholder="Otomatis dari UNIQ" />
              </Form.Item>
            </div>

            <Form.Item label="UNIQ ZAHIR" name="uniq_zahir">
              <Input placeholder="Masukkan UNIQ ZAHIR secara manual" />
            </Form.Item>

            <Form.Item
              label="Status"
              name="status"
              rules={[{ required: true, message: "Status wajib diisi" }]}
            >
              <Select
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </Form.Item>

            <div className="flex justify-end gap-3">
              <Button onClick={() => router.push("/system-settings")}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={createState.isLoading}
              >
                Save Parameter
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}
