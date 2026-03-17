"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Select, message } from "antd";
import { useRouter } from "next/navigation";
import { useCreateProductReturnMutation } from "@/lib/api/product-return/api";
import { getApiErrorMessage } from "@/lib/api/error";

type SubmitReturnValues = {
  uniq: string;
  date: string;
  partNo: string;
  partName: string;
  kanban: string;
  scrapQty: number;
  reworkQty: number;
  submittedBy?: string;
  notes?: string;
  status?: string;
};

export default function SubmitProductReturnPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<SubmitReturnValues>();
  const [createProductReturn] = useCreateProductReturnMutation();

  const initialValues = useMemo(
    () => ({
      uniq: "KBN-001-2024",
      date: "2024-12-16",
      partNo: "PN-45678",
      partName: "Bearing Assembly",
      kanban: "KB-123456",
      scrapQty: 0,
      reworkQty: 0,
      submittedBy: "Admin PPIC",
      notes: "",
      status: "Pending QC",
    }),
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-gray-900">Submit Product Return</div>
          <div className="text-sm text-gray-500 mt-1">Create a new product return request for QC validation</div>
        </div>
        <div className="flex items-center gap-2">
          <Button className="!rounded-lg" onClick={() => router.push("/product-return")}>Cancel</Button>
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
                  kanban: values.kanban,
                  part_no: values.partNo,
                  part_name: values.partName,
                  date_received: values.date,
                  quantity_scrap: Number(values.scrapQty ?? 0),
                  unit: "Pcs",
                  quantity_rework: Number(values.reworkQty ?? 0),
                  submitted_by: values.submittedBy,
                  notes: values.notes,
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
            <Form.Item label="Date" name="date" rules={[{ required: true }]}
            >
              <Input className="!rounded-lg" placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item label="Status" name="status">
              <Select
                className="!rounded-lg"
                options={[
                  { label: "Pending QC", value: "Pending QC" },
                  { label: "QC Approved", value: "QC Approved" },
                  { label: "Rework Created", value: "Rework Created" },
                  { label: "Rejected", value: "Rejected" },
                ]}
              />
            </Form.Item>
            <Form.Item label="Uniq ID" name="uniq" rules={[{ required: true, message: "Uniq is required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item label="Part No" name="partNo" rules={[{ required: true }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item label="Part Name" name="partName" rules={[{ required: true }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item label="Kanban" name="kanban" rules={[{ required: true }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item label="Submitted By" name="submittedBy" rules={[{ required: true }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item label="Scrap Qty" name="scrapQty" rules={[{ required: true }]}>
              <InputNumber min={0} className="!w-full !rounded-lg" addonAfter="Pcs" />
            </Form.Item>
            <Form.Item label="Rework Qty" name="reworkQty" rules={[{ required: true }]}>
              <InputNumber min={0} className="!w-full !rounded-lg" addonAfter="Pcs" />
            </Form.Item>
          </div>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={4} className="!rounded-lg" placeholder="Add return notes / reason..." />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
