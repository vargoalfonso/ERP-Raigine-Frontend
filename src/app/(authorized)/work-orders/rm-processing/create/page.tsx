"use client";

import { useMemo, useState } from "react";
import { Button, DatePicker, Form, Input, InputNumber, Select, message } from "antd";
import { useRouter } from "next/navigation";
import dayjs, { type Dayjs } from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetAllRawMaterialsQuery } from "@/lib/api/raw-materials/api";
import { useCreateRmProcessingWorkOrderMutation } from "@/lib/api/work-orders/api";

type RmOption = {
  uniq: string;
  name: string;
  partName: string;
  partNumber: string;
  model?: string;
  gradeSize?: string;
  unit?: string;
  label: string;
  value: string;
};

const buildPackingNumber = () => {
  const suffix = String(Date.now()).slice(-3);
  return `KBN-RM-AUTO-${suffix}`;
};

export default function CreateRmProcessingWoPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const apiEnabled = Boolean(apiBaseUrl);
  const [packingNumber] = useState(buildPackingNumber);
  const { TextArea } = Input;
  const [createRmProcessingWorkOrder, createRmProcessingState] = useCreateRmProcessingWorkOrderMutation();
  const { data: rawMaterialsRes } = useGetAllRawMaterialsQuery(
    { currentPage: 1, pageSize: 200 },
    { skip: !apiEnabled, refetchOnMountOrArgChange: true }
  );

  const fallbackOptions: RmOption[] = useMemo(
    () => [
      {
        uniq: "UNIQ-1234",
        name: "Steel Coil SPHC 1.2mm",
        partName: "Steel Coil",
        partNumber: "RM-ST-001",
        model: "SPHC",
        gradeSize: "SPHC 1.2 mm x 4 ft x 8 ft",
        unit: "pcs",
        label: "UNIQ-1234 - Steel Coil SPHC 1.2mm",
        value: "UNIQ-1234",
      },
      {
        uniq: "UNIQ-2231",
        name: "Base Resin (PP) 25kg",
        partName: "Polypropylene Resin",
        partNumber: "RM-RS-011",
        model: "PP",
        gradeSize: null as unknown as string,
        unit: "kg",
        label: "UNIQ-2231 - Base Resin (PP) 25kg",
        value: "UNIQ-2231",
      },
      {
        uniq: "UNIQ-7781",
        name: "Rubber Compound A",
        partName: "Rubber Compound",
        partNumber: "RM-RB-007",
        model: "Compound A",
        gradeSize: null as unknown as string,
        unit: "kg",
        label: "UNIQ-7781 - Rubber Compound A",
        value: "UNIQ-7781",
      },
    ],
    []
  );

  const rmOptions: RmOption[] = useMemo(() => {
    const list = rawMaterialsRes?.data ?? [];
    if (!list.length) return fallbackOptions;
    return list.map((item) => ({
      uniq: item.uniq,
      name: item.name,
      partName: item.part_name ?? item.name,
      partNumber: item.part_no ?? item.code,
      model: item.model ?? undefined,
      gradeSize: item.notes ?? undefined,
      unit: item.unit ?? "pcs",
      label: `${item.uniq} - ${item.name}`,
      value: item.uniq,
    }));
  }, [fallbackOptions, rawMaterialsRes?.data]);

  const modelOptions = [
    { label: "SPHC", value: "SPHC" },
    { label: "PP", value: "PP" },
    { label: "Compound A", value: "Compound A" },
  ];

  const approvalManagers = [
    { label: "Jane Smith - Operations Mgr", value: "Jane Smith - Operations Mgr" },
    { label: "John Smith - Production Manager", value: "John Smith - Production Manager" },
    { label: "Mike Johnson - Manufacturing Head", value: "Mike Johnson - Manufacturing Head" },
  ];

  const onSelectSourceRm = (value: string) => {
    const found = rmOptions.find((o) => o.value === value);
    if (!found) return;
    form.setFieldsValue({
      partName: found.partName,
      partNumber: found.partNumber,
      model: found.model,
      gradeSize: found.gradeSize,
      targetMaterialUniq: value,
    });
  };

  const onCreate = async () => {
    try {
      const values = await form.validateFields();
      if (!apiEnabled) {
        message.success("RM Processing WO created (mock)");
        void values;
        router.push("/work-orders");
        return;
      }

      await createRmProcessingWorkOrder({
        source_material_uniq: values.sourceMaterial ?? null,
        target_material_uniq: values.targetMaterialUniq ?? null,
        part_name: values.partName ?? null,
        model_grade: values.gradeSize ?? values.model ?? null,
        input_qty: values.qtyInput != null ? Number(values.qtyInput) : null,
        output_qty: values.qtyOutput != null ? Number(values.qtyOutput) : null,
        date_issued: values.dateIssued ? dayjs(values.dateIssued as Dayjs).format("YYYY-MM-DD") : null,
        remarks: values.remarks ?? null,
      }).unwrap();

      message.success("RM Processing WO created successfully");
      router.push("/work-orders");
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to create RM processing work order"));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => router.push("/work-orders")}
          >
            <span className="text-base leading-none">←</span>
            <span>Back to Work Orders</span>
          </button>

          <div className="flex items-center gap-2">
            <Button className="!rounded-lg" onClick={() => router.push("/work-orders")}>
              Cancel
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              onClick={onCreate}
              loading={createRmProcessingState.isLoading}
            >
              Create RM Processing WO
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">Work Order - Raw Material Processing</div>
          <div className="text-sm text-gray-500">Transform base raw materials into semi-finished materials</div>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          woType: "RM Processing",
          packingNumber,
        }}
      >
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Material Identification</div>
            <div className="text-xs text-gray-500 mt-1">Select raw material and define processing details</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="sourceMaterial"
                label="Source Material UNIQ / Name"
                rules={[{ required: true, message: "Select raw material" }]}
              >
                <Select
                  className="!rounded-lg"
                  placeholder="Select raw material"
                  options={rmOptions.map((o) => ({ label: o.label, value: o.value }))}
                  onChange={onSelectSourceRm}
                />
              </Form.Item>

              <Form.Item name="woType" label="WO Type">
                <Input className="!rounded-lg" disabled />
              </Form.Item>

              <Form.Item name="partName" label="Part Name">
                <Input className="!rounded-lg" disabled placeholder="Auto-filled from RM selection" />
              </Form.Item>

              <Form.Item name="partNumber" label="Part Number">
                <Input className="!rounded-lg" disabled placeholder="Auto-filled from RM Master Data" />
              </Form.Item>

              <Form.Item name="model" label="Model" rules={[{ required: true, message: "Select model/type" }]}>
                <Select className="!rounded-lg" placeholder="Select model/type" options={modelOptions} allowClear />
              </Form.Item>

              <Form.Item name="gradeSize" label="Grade / Size" rules={[{ required: true, message: "Enter grade/size" }]}>
                <Input className="!rounded-lg" placeholder="e.g., SPHC 1.2 mm × 4 ft × 8 ft" />
              </Form.Item>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">UNIQ Identification</div>
            <div className="text-xs text-gray-500 mt-1">Source and target material UNIQ tracking</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="targetMaterialUniq"
                label="Target Material Uniq"
                rules={[{ required: true, message: "Select target material uniq" }]}
              >
                <Select
                  className="!rounded-lg"
                  placeholder="Select target UNIQ"
                  options={rmOptions.map((o) => ({ label: o.label, value: o.value }))}
                />
              </Form.Item>
              <div className="md:col-span-2 -mt-2 text-xs text-gray-400">Will be deducted from RM stock</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Quantity &amp; Processing Details</div>
            <div className="text-xs text-gray-500 mt-1">Input and output quantities for the processing operation</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Form.Item
                name="qtyInput"
                label="Quantity Input"
                rules={[{ required: true, message: "Enter quantity input" }]}
                extra={<span className="text-xs text-gray-400">Raw material used</span>}
              >
                <InputNumber className="!rounded-lg w-full" min={0} placeholder="e.g 100 Sheet / Coil / kg" />
              </Form.Item>

              <Form.Item
                name="qtyOutput"
                label="Quantity Output"
                rules={[{ required: true, message: "Enter quantity output" }]}
                extra={<span className="text-xs text-gray-400">Semi-finished produced</span>}
              >
                <InputNumber className="!rounded-lg w-full" min={0} placeholder="e.g 50 ccPieces / kg" />
              </Form.Item>

              <Form.Item
                name="packingNumber"
                label="Packing Number / Kanban"
                extra={<span className="text-xs text-gray-400">Auto-generated</span>}
              >
                <Input className="!rounded-lg" disabled />
              </Form.Item>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 bg-gradient-to-r from-blue-50/60 to-white">
            <div className="text-sm font-semibold text-gray-900">Processing Schedule</div>
            <div className="text-xs text-gray-500 mt-1">Set dates for the RM processing operation</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="dateIssued" label="Date Issued" rules={[{ required: true, message: "Select date issued" }]}>
                <DatePicker className="!rounded-lg w-full" placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
              </Form.Item>

              <Form.Item
                name="dateCompleted"
                label="Date Completed"
                extra={<span className="text-xs text-gray-400">Used to measure cycle time</span>}
              >
                <DatePicker className="!rounded-lg w-full" placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
              </Form.Item>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Approval &amp; Remarks</div>
            <div className="text-xs text-gray-500 mt-1">Manager approval and special instructions</div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              <Form.Item
                name="approvalManager"
                label="Approval Manager"
                rules={[{ required: true, message: "Select approver" }]}
                extra={<span className="text-xs text-gray-400">Required before inventory update</span>}
              >
                <Select className="!rounded-lg" placeholder="Select approver" options={approvalManagers} />
              </Form.Item>

              <Form.Item
                name="remarks"
                label="Remarks"
                extra={<span className="text-xs text-gray-400">Optional field for shop-floor comments</span>}
              >
                <TextArea className="!rounded-lg" rows={3} placeholder="Notes or special instructions for shop-floor..." />
              </Form.Item>
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}

