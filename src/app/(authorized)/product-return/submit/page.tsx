"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Select, message } from "antd";
import { useRouter } from "next/navigation";
import { useCreateProductReturnMutation } from "@/lib/api/product-return/api";
import { getApiErrorMessage } from "@/lib/api/error";

type SubmitReturnValues = {
  uniq: string;
  dnNumber: string;
  scrapQty: number;
  reworkQty: number;
  status?: string;
  dateReceived?: string;
  scrapType?: string;
  weight?: number;
  uom?: string;
};

export default function SubmitProductReturnPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<SubmitReturnValues>();
  const [createProductReturn] = useCreateProductReturnMutation();

  const initialValues = useMemo(
    () => ({
      uniq: "KBN-001-2024",
      dnNumber: "DN-0001",
      scrapQty: 0,
      reworkQty: 0,
      status: "PENDING",
      dateReceived: new Date().toISOString().slice(0, 10),
      scrapType: "Product Return",
      weight: 0,
      uom: "KG",
    }),
    [],
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            Submit Product Return
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Create a new product return request for QC validation
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="!rounded-lg"
            onClick={() => router.push("/product-return")}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            className="!rounded-lg"
            loading={submitting}
            onClick={async () => {
              try {
                setSubmitting(true);
                const values = await form.validateFields();
                await createProductReturn({
                  uniq: values.uniq,
                  dn_number: values.dnNumber,
                  quantity_scrap: Number(values.scrapQty ?? 0),
                  quantity_rework: Number(values.reworkQty ?? 0),
                  status: values.status || "PENDING",
                  date_received: values.dateReceived || undefined,
                  scrap_type: values.scrapType || "Product Return",
                  weight: Number(values.weight ?? 0),
                  uom: values.uom || undefined,
                }).unwrap();

                message.success("Product return submitted");
                router.push("/product-return");
              } catch (e) {
                message.error(getApiErrorMessage(e, "Failed to submit"));
              } finally {
                setSubmitting(false);
              }
            }}
          >
            Submit
          </Button>
        </div>
      </div>

      <Card className="!rounded-xl" bordered>
        <Form form={form} layout="vertical" initialValues={initialValues}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item label="Status" name="status">
              <Select
                className="!rounded-lg"
                options={[
                  { label: "PENDING", value: "PENDING" },
                  { label: "APPROVED", value: "APPROVED" },
                  { label: "REJECTED", value: "REJECTED" },
                ]}
              />
            </Form.Item>
            <Form.Item
              label="Uniq ID"
              name="uniq"
              rules={[{ required: true, message: "Uniq is required" }]}
            >
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item
              label="DN Number"
              name="dnNumber"
              rules={[{ required: true, message: "DN number is required" }]}
            >
              <Input className="!rounded-lg" placeholder="DN-0001" />
            </Form.Item>
            <Form.Item
              label="Scrap Qty"
              name="scrapQty"
              rules={[{ required: true }]}
            >
              <InputNumber
                min={0}
                className="!w-full !rounded-lg"
                addonAfter="Pcs"
              />
            </Form.Item>
            <Form.Item
              label="Rework Qty"
              name="reworkQty"
              rules={[{ required: true }]}
            >
              <InputNumber
                min={0}
                className="!w-full !rounded-lg"
                addonAfter="Pcs"
              />
            </Form.Item>
            <Form.Item label="Date Received" name="dateReceived">
              <Input type="date" className="!rounded-lg" />
            </Form.Item>
            <Form.Item label="Scrap Type" name="scrapType">
              <Input className="!rounded-lg" readOnly />
            </Form.Item>
            <Form.Item label="Weight" name="weight">
              <InputNumber
                min={0}
                step={0.1}
                className="!w-full !rounded-lg"
                placeholder="Enter weight"
              />
            </Form.Item>
            <Form.Item label="UOM" name="uom">
              <Select
                className="!rounded-lg"
                options={[
                  { label: "KG", value: "KG" },
                  { label: "G", value: "G" },
                  { label: "PCS", value: "PCS" },
                  { label: "BOX", value: "BOX" },
                ]}
              />
            </Form.Item>
          </div>
        </Form>
      </Card>
    </div>
  );
}
