"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  useCreateSupplierMutation,
  useGetNextSupplierCodeQuery,
} from "@/lib/api/suppliers/api";
import { getApiErrorMessage } from "@/lib/api/error";

type SupplierStatus = "Active" | "Inactive";

type CreateSupplierOnlyForm = {
  supplierCode: string;
  supplierName: string;

  contactPerson: string;
  contactNumber: string;
  email: string;

  materialCategory: string;

  fullAddress: string;
  city: string;
  province: string;
  country: string;

  taxId: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;

  paymentTerms: string;
  deliveryLeadTimeDays: number;
  status: SupplierStatus;
};

const generateSupplierCode = (): string => {
  const n = Date.now() % 10000;
  return `SUP-${String(n).padStart(4, "0")}`;
};

export default function CreateSupplierOnlyPage() {
  const router = useRouter();
  const [form] = Form.useForm<CreateSupplierOnlyForm>();
  const apiEnabled = Boolean(apiBaseUrl);
  const { data: nextCode } = useGetNextSupplierCodeQuery(undefined, {
    skip: !apiEnabled,
  });
  const [createSupplier, { isLoading }] = useCreateSupplierMutation();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    form.setFieldsValue({
      supplierCode: typeof nextCode === "string" && nextCode.trim() ? nextCode.trim() : generateSupplierCode(),
      country: "Indonesia",
      status: "Active",
      paymentTerms: "30D",
      deliveryLeadTimeDays: 7,
      materialCategory: "Raw Material",
    });
  }, [form, nextCode]);

  const backToList = () => {
    router.push("/master-supplier?tab=only");
  };

  const onSave = async () => {
    try {
      const v = await form.validateFields();

      const supplierCode = v.supplierCode?.trim();

      await createSupplier({
        ...(supplierCode ? { supplier_code: supplierCode } : {}),
        supplier_name: v.supplierName,
        contact_person: v.contactPerson,
        contact_number: v.contactNumber,
        email_address: v.email,
        material_category: v.materialCategory,
        full_address: v.fullAddress,
        city: v.city,
        province: v.province,
        country: v.country,
        tax_id_npwp: v.taxId,
        bank_name: v.bankName,
        bank_account_number: v.bankAccountNumber,
        bank_account_name: v.bankAccountName,
        payment_terms: v.paymentTerms,
        delivery_lead_time_days: v.deliveryLeadTimeDays,
        status: v.status,
      }).unwrap();

      messageApi.success("Supplier created");
      backToList();
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, "Failed to create supplier"));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {contextHolder}

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button className="!rounded-lg" icon={<ArrowLeftOutlined />} onClick={backToList}>
            Back to Supplier List
          </Button>
          <div>
            <div className="text-xl font-bold text-gray-900">Add New Supplier</div>
            <div className="text-xs text-gray-500">
              Create a comprehensive supplier profile for{" "}
              <Tag color="blue" className="!rounded-full !text-xs !px-2">
                Supplier Only
              </Tag>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button className="!rounded-lg" onClick={backToList}>
            Cancel
          </Button>
          <Button
            type="primary"
            className="!rounded-lg"
            icon={<SaveOutlined />}
            loading={isLoading}
            onClick={onSave}
          >
            Save Supplier
          </Button>
        </div>
      </div>

      <Form form={form} layout="vertical" requiredMark={false}>
        <div className="space-y-4">
          <Card
            className="!rounded-xl"
            title={
              <div>
                <div className="font-semibold">Basic Information</div>
                <div className="text-xs text-gray-500">Supplier identification and contact details</div>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item label="Supplier Code (Auto-generated)" name="supplierCode" rules={[{ required: true }]}>
                <Input className="!rounded-lg" disabled />
              </Form.Item>

              <Form.Item
                label="Supplier Name"
                name="supplierName"
                rules={[{ required: true, message: "Supplier name is required" }]}
              >
                <Input className="!rounded-lg" placeholder="Enter registered legal name" />
              </Form.Item>

              <Form.Item
                label="Contact Person"
                name="contactPerson"
                rules={[{ required: true, message: "Contact person is required" }]}
              >
                <Input className="!rounded-lg" placeholder="Main contact person name" />
              </Form.Item>

              <Form.Item
                label="Contact Number"
                name="contactNumber"
                rules={[{ required: true, message: "Contact number is required" }]}
              >
                <Input className="!rounded-lg" placeholder="+62 ..." />
              </Form.Item>

              <Form.Item
                label="Email Address"
                name="email"
                rules={[{ required: true, type: "email", message: "Valid email is required" }]}
              >
                <Input className="!rounded-lg" placeholder="supplier@company.com" />
              </Form.Item>

              <Form.Item
                label="Category"
                name="materialCategory"
                rules={[{ required: true, message: "Category is required" }]}
              >
                <Select
                  className="!rounded-lg"
                  options={[
                    { label: "Raw Materials", value: "Raw Material" },
                    { label: "Indirect Material Raw", value: "Indirect Material Raw" },
                    { label: "Sub Con Materials", value: "Sub Con Materials" },
                  ]}
                />
              </Form.Item>
            </div>
          </Card>

          <Card
            className="!rounded-xl"
            title={
              <div>
                <div className="font-semibold">Address Information</div>
                <div className="text-xs text-gray-500">Supplier location and logistics details</div>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-4">
              <Form.Item
                label="Full Address"
                name="fullAddress"
                rules={[{ required: true, message: "Address is required" }]}
              >
                <Input className="!rounded-lg" placeholder="Street address, building number, area" />
              </Form.Item>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Form.Item label="City" name="city" rules={[{ required: true, message: "City is required" }]}>
                  <Input className="!rounded-lg" placeholder="City name" />
                </Form.Item>
                <Form.Item
                  label="Province"
                  name="province"
                  rules={[{ required: true, message: "Province is required" }]}
                >
                  <Input className="!rounded-lg" placeholder="Province name" />
                </Form.Item>
                <Form.Item
                  label="Country"
                  name="country"
                  rules={[{ required: true, message: "Country is required" }]}
                >
                  <Select className="!rounded-lg" options={[{ label: "Indonesia", value: "Indonesia" }]} />
                </Form.Item>
              </div>
            </div>
          </Card>

          <Card
            className="!rounded-xl"
            title={
              <div>
                <div className="font-semibold">Financial Information</div>
                <div className="text-xs text-gray-500">Tax registration and bank account details</div>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item label="Tax ID (NPWP)" name="taxId" rules={[{ required: true, message: "Tax ID is required" }]}>
                <Input className="!rounded-lg" placeholder="01.234.567.8-901.000" />
              </Form.Item>

              <Form.Item label="Bank Name" name="bankName" rules={[{ required: true, message: "Bank name is required" }]}>
                <Select
                  className="!rounded-lg"
                  placeholder="Select bank"
                  options={[
                    { label: "BCA", value: "BCA" },
                    { label: "Mandiri", value: "Mandiri" },
                    { label: "BRI", value: "BRI" },
                    { label: "BNI", value: "BNI" },
                    { label: "Other", value: "Other" },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="Bank Account Number"
                name="bankAccountNumber"
                rules={[{ required: true, message: "Account number is required" }]}
              >
                <Input className="!rounded-lg" placeholder="Account number" />
              </Form.Item>

              <Form.Item
                label="Bank Account Name"
                name="bankAccountName"
                rules={[{ required: true, message: "Account name is required" }]}
              >
                <Input className="!rounded-lg" placeholder="Registered account holder (must match NPWP)" />
              </Form.Item>
            </div>
          </Card>

          <Card
            className="!rounded-xl"
            title={
              <div>
                <div className="font-semibold">Payment & Delivery Terms</div>
                <div className="text-xs text-gray-500">Configure payment schedule and delivery lead time</div>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                label="Payment Terms"
                name="paymentTerms"
                rules={[{ required: true, message: "Payment terms is required" }]}
              >
                <Select
                  className="!rounded-lg"
                  options={[
                    { label: "Cash", value: "Cash" },
                    { label: "7D", value: "7D" },
                    { label: "30D", value: "30D" },
                    { label: "60D", value: "60D" },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="Delivery Lead Time (Days)"
                name="deliveryLeadTimeDays"
                rules={[{ required: true, message: "Lead time is required" }]}
              >
                <InputNumber className="!w-full !rounded-lg" min={0} placeholder="Average days from PO to delivery" />
              </Form.Item>

              <Form.Item label="Status" name="status" rules={[{ required: true }]}>
                <Select
                  className="!rounded-lg"
                  options={[
                    { label: "Active", value: "Active" },
                    { label: "Inactive", value: "Inactive" },
                  ]}
                />
              </Form.Item>

              <div />
            </div>
          </Card>

          <div className="text-xs text-gray-500">
            <Typography.Text type="secondary">
              Note: Some fields may be stored as extended supplier metadata depending on backend support.
            </Typography.Text>
          </div>
        </div>
      </Form>
    </div>
  );
}
