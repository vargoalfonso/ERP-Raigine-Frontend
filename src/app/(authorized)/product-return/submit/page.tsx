"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Select, message } from "antd";
import { useRouter } from "next/navigation";

export default function SubmitProductReturnPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const initialValues = useMemo(
    () => ({
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
            onClick={() => {
              setSubmitting(true);
              setTimeout(() => {
                message.success("Product return submitted");
                setSubmitting(false);
                router.push("/product-return");
              }, 600);
            }}
          >
            Submit
          </Button>
        </div>
      </div>

      <Card className="!rounded-xl" bordered>
        <Form layout="vertical" initialValues={initialValues}>
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
