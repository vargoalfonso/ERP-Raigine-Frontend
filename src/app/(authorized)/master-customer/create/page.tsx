"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Select,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useCreateCustomerMutation } from "@/lib/api/customers/api";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { BANK_SELECT_OPTIONS } from "@/lib/constants/banks";
import { buildBomCodeSelectOptions, normalizeBomCodes } from "@/lib/utils/bomSelectOptions";

type CreateCustomerForm = {
  customerId?: string;
  customerName: string;
  phoneNumber: string;
  shippingAddress: string;
  billingSameAsShipping: boolean;
  billingAddress?: string;
  bankAccount?: string;
  bankAccountNumber?: string;
  bomCodes?: string[];
};

export default function CreateCustomerPage() {
  const router = useRouter();
  const [form] = Form.useForm<CreateCustomerForm>();
  const [messageApi, contextHolder] = message.useMessage();

  const apiEnabled = Boolean(apiBaseUrl);

  const [billingSame, setBillingSame] = useState(true);
  const [createCustomer, createState] = useCreateCustomerMutation();
  const bomQuery = useGetBomTreeQuery({ page: 1, limit: 1000 }, { skip: !apiEnabled });

  useEffect(() => {
    form.setFieldsValue({
      billingSameAsShipping: true,
    });
  }, [form]);

  useEffect(() => {
    if (billingSame) {
      form.setFieldsValue({ billingAddress: undefined });
    }
  }, [billingSame, form]);

  const backToList = () => router.push("/master-customer");

  const billingAddressRules = useMemo(
    () => (billingSame ? [] : [{ required: true, message: "Billing address is required" }]),
    [billingSame]
  );

  const bomOptions = useMemo(() => {
    // Prefer the root-level nodes returned by the API (these are parent-level BOMs).
    const rootNodes = Array.isArray(bomQuery.data?.data) ? bomQuery.data.data : [];
    const rootOpts: { label: string; value: string }[] = [];
    for (const n of rootNodes) {
      const uniq = typeof (n as any)?.uniq === "string" && (n as any).uniq.trim()
        ? (n as any).uniq.trim()
        : typeof (n as any)?.uniq_code === "string"
          ? (n as any).uniq_code.trim()
          : "";
      if (uniq) rootOpts.push({ label: uniq, value: uniq });
    }
    if (rootOpts.length) return rootOpts;

    // Fallback: if API returned a paginated shape, use only the top-level items array
    const data = bomQuery.data?.data;
    const arr = Array.isArray(data) ? data : Array.isArray((data as any)?.items) ? (data as any).items : [];
    const topLevelOpts: { label: string; value: string }[] = [];
    for (const n of arr) {
      const uniq = typeof (n as any)?.uniq === "string" && (n as any).uniq.trim()
        ? (n as any).uniq.trim()
        : typeof (n as any)?.uniq_code === "string"
          ? (n as any).uniq_code.trim()
          : "";
      if (uniq) topLevelOpts.push({ label: uniq, value: uniq });
    }
    return topLevelOpts;
  }, [bomQuery.data]);

  const onSave = async () => {
    try {
      const v = await form.validateFields();

      await createCustomer({
        customer_id: v.customerId?.trim() ? String(v.customerId).trim() : undefined,
        customer_name: v.customerName,
        phone_number: v.phoneNumber,
        shipping_address: v.shippingAddress,
        billing_same_as_shipping: Boolean(v.billingSameAsShipping),
        billing_address: v.billingSameAsShipping ? null : (v.billingAddress?.trim() || null),
        bank_account: v.bankAccount?.trim() ? v.bankAccount.trim() : null,
        bank_account_number: v.bankAccountNumber?.trim() ? v.bankAccountNumber.trim() : null,
        bom_codes: normalizeBomCodes(v.bomCodes),
      }).unwrap();

      messageApi.success("Customer created");
      backToList();
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, "Failed to create customer"));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {contextHolder}

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button className="!rounded-lg" icon={<ArrowLeftOutlined />} onClick={backToList}>
            Back
          </Button>
          <div>
            <div className="text-xl font-bold text-gray-900">Add New Customer</div>
            <div className="text-xs text-gray-500">Create a new customer profile</div>
          </div>
        </div>

        <Button
          type="primary"
          className="!rounded-lg"
          icon={<SaveOutlined />}
          loading={createState.isLoading}
          onClick={onSave}
          disabled={!apiEnabled}
        >
          Save Customer
        </Button>
      </div>

      {!apiEnabled ? (
        <Card className="!rounded-xl">
          <Typography.Text type="secondary">NEXT_PUBLIC_API_URL belum dikonfigurasi.</Typography.Text>
        </Card>
      ) : (
        <Form form={form} layout="vertical" requiredMark={false}>
          <div className="space-y-4">
            <Card
              className="!rounded-xl"
              title={
                <div>
                  <div className="font-semibold">Basic Information</div>
                  <div className="text-xs text-gray-500">Configure customer identification and contact details</div>
                </div>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Form.Item label="Customer ID" name="customerId">
                  <Input className="!rounded-lg"  />
                </Form.Item>

                <Form.Item
                  label="Customer Name"
                  name="customerName"
                  rules={[{ required: true, message: "Customer name is required" }]}
                >
                  <Input className="!rounded-lg" placeholder="Enter customer company name" />
                </Form.Item>

                <Form.Item
                  label="Phone Number"
                  name="phoneNumber"
                  rules={[{ required: true, message: "Phone number is required" }]}
                >
                  <Input className="!rounded-lg" placeholder="Enter phone number (e.g., +62-21-1234567)" />
                </Form.Item>

                <div />
              </div>
            </Card>

            <Card
              className="!rounded-xl"
              title={
                <div>
                  <div className="font-semibold">Address Information</div>
                  <div className="text-xs text-gray-500">Configure shipping and billing address</div>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4">
                <Form.Item
                  label="Shipping Address"
                  name="shippingAddress"
                  rules={[{ required: true, message: "Shipping address is required" }]}
                >
                  <Input className="!rounded-lg" placeholder="Enter complete shipping address" />
                </Form.Item>

                <Form.Item name="billingSameAsShipping" valuePropName="checked">
                  <Checkbox
                    checked={billingSame}
                    onChange={(e) => {
                      setBillingSame(e.target.checked);
                      form.setFieldsValue({ billingSameAsShipping: e.target.checked });
                    }}
                  >
                    Billing address is the same as shipping address
                  </Checkbox>
                </Form.Item>

                <Form.Item
                  label="Billing Address"
                  name="billingAddress"
                  rules={billingAddressRules}
                  help={billingSame ? "Optional (same as shipping)" : undefined}
                >
                  <Input
                    className="!rounded-lg"
                    placeholder="Enter complete billing address"
                    disabled={billingSame}
                  />
                </Form.Item>
              </div>
            </Card>

            <Card
              className="!rounded-xl"
              title={
                <div>
                  <div className="font-semibold">BOM Information</div>
                  <div className="text-xs text-gray-500">Select one or more BOM uniq codes for this customer</div>
                </div>
              }
            >
              <Form.Item label="BOM Codes" name="bomCodes">
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  className="!rounded-lg"
                  placeholder="Select BOM uniq codes"
                  loading={bomQuery.isFetching}
                  options={bomOptions}
                  optionFilterProp="label"
                  maxTagCount="responsive"
                />
              </Form.Item>
            </Card>

            <Card
              className="!rounded-xl"
              title={
                <div>
                  <div className="font-semibold">Banking Information</div>
                  <div className="text-xs text-gray-500">Configure bank account details (optional)</div>
                </div>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Form.Item label="Bank Account" name="bankAccount">
                  <Select
                    className="!rounded-lg"
                    showSearch
                    placeholder="Select bank"
                    options={BANK_SELECT_OPTIONS}
                    optionFilterProp="label"
                  />
                </Form.Item>

                <Form.Item label="Bank Account Number" name="bankAccountNumber">
                  <Input className="!rounded-lg" placeholder="Enter bank account number" />
                </Form.Item>
              </div>
            </Card>

            <div className="flex justify-end gap-2">
              <Button className="!rounded-lg" onClick={backToList}>
                Cancel
              </Button>
              <Button
                type="primary"
                className="!rounded-lg"
                icon={<SaveOutlined />}
                loading={createState.isLoading}
                onClick={onSave}
              >
                Save Customer
              </Button>
            </div>
          </div>
        </Form>
      )}
    </div>
  );
}
