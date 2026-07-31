"use client";

import { useEffect, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Spin,
  Select,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useGetCustomerByIdQuery,
  useUpdateCustomerMutation,
} from "@/lib/api/customers/api";
import { useGetBomListQuery } from "@/lib/api/bom/api";
import { BANK_SELECT_OPTIONS } from "@/lib/constants/banks";
import { normalizeBomCodes } from "@/lib/utils/bomSelectOptions";

type EditCustomerForm = {
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

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const [form] = Form.useForm<EditCustomerForm>();
  const [messageApi, contextHolder] = message.useMessage();

  const apiEnabled = Boolean(apiBaseUrl);
  const customerId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const customerQueryArg = apiEnabled && customerId ? customerId : skipToken;

  const customerQuery = useGetCustomerByIdQuery(customerQueryArg);
  const bomQuery = useGetBomListQuery({ page: 1, limit: 1000 }, { skip: !apiEnabled });

  const [billingSame, setBillingSame] = useState(true);
  const [updateCustomer, updateState] = useUpdateCustomerMutation();

  const initialValues = useMemo<Partial<EditCustomerForm>>(() => {
    const d = customerQuery.data;
    if (!d) return {};

    const same = Boolean(d.billing_same_as_shipping);

    return {
      customerId: String(d.customer_id ?? d.customer_code ?? d.id ?? ""),
      customerName: String(d.customer_name ?? ""),
      phoneNumber: String(d.phone_number ?? ""),
      shippingAddress: String(d.shipping_address ?? ""),
      billingSameAsShipping: same,
      billingAddress: same ? undefined : String(d.billing_address ?? ""),
      bankAccount: d.bank_account == null ? undefined : String(d.bank_account),
      bankAccountNumber: d.bank_account_number == null ? undefined : String(d.bank_account_number),
      bomCodes: Array.isArray(d.bom_codes) ? normalizeBomCodes(d.bom_codes.map(String)) : [],
    };
  }, [customerQuery.data]);

  useEffect(() => {
    const d = customerQuery.data;
    if (!d) return;
    const same = Boolean(d.billing_same_as_shipping);
    setBillingSame(same);
    form.setFieldsValue(initialValues as EditCustomerForm);
  }, [customerQuery.data, form, initialValues]);

  const backToList = () => router.push("/master-customer");

  const billingAddressRules = useMemo(
    () => (billingSame ? [] : [{ required: true, message: "Billing address is required" }]),
    [billingSame]
  );

  const bomOptions = useMemo(() => {
    const rootNodes = Array.isArray(bomQuery.data?.data) ? bomQuery.data.data : [];
    return rootNodes
      .map((node) => {
        const uniq = typeof (node as any)?.uniq === "string" && (node as any).uniq.trim()
          ? (node as any).uniq.trim()
          : typeof (node as any)?.uniq_code === "string"
            ? (node as any).uniq_code.trim()
            : "";
        return uniq ? { label: uniq, value: uniq } : null;
      })
      .filter((option): option is { label: string; value: string } => Boolean(option))
      .sort((left, right) => left.value.localeCompare(right.value));
  }, [bomQuery.data]);

  const bomOptionsLoading = bomQuery.isLoading || bomQuery.isFetching;

  const onSave = async () => {
    try {
      const v = await form.validateFields();

      if (!customerId) {
        messageApi.error("Missing customer id");
        return;
      }

      await updateCustomer({
        id: customerId,
        body: {
          customer_name: v.customerName,
          phone_number: v.phoneNumber,
          shipping_address: v.shippingAddress,
          billing_same_as_shipping: Boolean(v.billingSameAsShipping),
          billing_address: v.billingSameAsShipping ? null : (v.billingAddress?.trim() || null),
          bank_account: v.bankAccount?.trim() ? v.bankAccount.trim() : null,
          bank_account_number: v.bankAccountNumber?.trim() ? v.bankAccountNumber.trim() : null,
          bom_codes: normalizeBomCodes(v.bomCodes),
        },
      }).unwrap();

      messageApi.success("Customer updated");
      backToList();
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, "Failed to update customer"));
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
            <div className="text-xl font-bold text-gray-900">Edit Customer</div>
            <div className="text-xs text-gray-500">Update customer profile</div>
          </div>
        </div>

        <Button
          type="primary"
          className="!rounded-lg"
          icon={<SaveOutlined />}
          loading={updateState.isLoading}
          onClick={onSave}
          disabled={!apiEnabled || customerQuery.isFetching || customerQuery.isError}
        >
          Save Customer
        </Button>
      </div>

      {!apiEnabled ? (
        <Card className="!rounded-xl">
          <Typography.Text type="secondary">NEXT_PUBLIC_API_URL belum dikonfigurasi.</Typography.Text>
        </Card>
      ) : customerQuery.isFetching ? (
        <Card className="!rounded-xl">
          <Typography.Text type="secondary">Loading customer...</Typography.Text>
        </Card>
      ) : customerQuery.isError ? (
        <Card className="!rounded-xl">
          <Typography.Text type="danger">
            {getApiErrorMessage(customerQuery.error, "Failed to load customer")}
          </Typography.Text>
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
                  <Input className="!rounded-lg" disabled />
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
                      form.setFieldsValue({
                        billingSameAsShipping: e.target.checked,
                        ...(e.target.checked ? { billingAddress: undefined } : {}),
                      });
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
              <Form.Item label="Parent Codes/ Sebango" name="bomCodes">
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  className="!rounded-lg"
                  placeholder="Select BOM uniq codes"
                  loading={bomOptionsLoading}
                  disabled={bomOptionsLoading && bomOptions.length === 0}
                  options={bomOptions}
                  optionFilterProp="label"
                  maxTagCount="responsive"
                  notFoundContent={
                    bomOptionsLoading ? (
                      <div className="flex items-center justify-center py-3">
                        <Spin size="small" />
                        <span className="ml-2 text-xs text-gray-500">
                          Loading parent UNIQ data...
                        </span>
                      </div>
                    ) : undefined
                  }
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
                loading={updateState.isLoading}
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
