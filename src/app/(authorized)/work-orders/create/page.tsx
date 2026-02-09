"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";

type WorkOrderType = "New" | "Additional" | "Rework" | "Assembly";

type UniqOption = {
  uniq: string;
  partName: string;
  uom: string;
  processes: string[];
};

type UniqLine = {
  id: string;
  uniq?: string;
  partName?: string;
  qty?: number;
  uom?: string;
  process?: string;
  kanbanNumber: string;
};

const nextWoNumber = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const seed = `${yyyy}${mm}${dd}`;
  const random = Math.floor(Math.random() * 900 + 100);
  return `WO-${seed}-${random}`;
};

const nextKanbanNumber = (index: number) => `KBN-AUTO-${String(index + 1).padStart(3, "0")}`;

export default function CreateWorkOrderPage() {
  const router = useRouter();
  const [form] = Form.useForm();

  const [woNumber] = useState(() => nextWoNumber());
  const [lines, setLines] = useState<UniqLine[]>([{ id: "l-1", kanbanNumber: nextKanbanNumber(0) }]);

  const uniqOptions: UniqOption[] = [
    { uniq: "LV7-001", partName: "Engine Mount Assembly", uom: "pcs", processes: ["Cutting", "Welding", "QC"] },
    { uniq: "LV7-002", partName: "Engine Mount Base", uom: "pcs", processes: ["Milling", "QC"] },
    { uniq: "LV8-003", partName: "Suspension Arm", uom: "pcs", processes: ["Forging", "Machining", "QC"] },
  ];

  const uniqSelectOptions = useMemo(
    () => uniqOptions.map((u) => ({ label: u.uniq, value: u.uniq })),
    [uniqOptions]
  );

  useEffect(() => {
    form.setFieldsValue({ woNumber });
  }, [form, woNumber]);

  const addLine = () => {
    setLines((prev) => {
      const next = [...prev, { id: `l-${Date.now()}`, kanbanNumber: nextKanbanNumber(prev.length) }];
      return next.map((l, idx) => ({ ...l, kanbanNumber: nextKanbanNumber(idx) }));
    });
  };

  const removeLine = (id: string) => {
    setLines((prev) => {
      const next = prev.filter((l) => l.id !== id);
      const ensured = next.length ? next : [{ id: `l-${Date.now()}`, kanbanNumber: nextKanbanNumber(0) }];
      return ensured.map((l, idx) => ({ ...l, kanbanNumber: nextKanbanNumber(idx) }));
    });
  };

  const updateLine = (id: string, patch: Partial<UniqLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const onSelectUniq = (id: string, uniq: string) => {
    const found = uniqOptions.find((u) => u.uniq === uniq);
    updateLine(id, {
      uniq,
      partName: found?.partName,
      uom: found?.uom,
      process: undefined,
    });
  };

  const validateLines = () => {
    for (const l of lines) {
      if (!l.uniq) return "Select UNIQ";
      if (!l.qty || l.qty <= 0) return "Enter Qty";
      if (!l.uom) return "Select UoM";
      if (!l.process) return "Select Process";
    }
    return null;
  };

  const onCreate = async () => {
    try {
      const values = await form.validateFields();
      const lineError = validateLines();
      if (lineError) {
        message.error(lineError);
        return;
      }

      message.success("Work order created (mock)");
      router.push("/work-orders");

      // values + lines are available here if later you want persistence.
      void values;
    } catch {
      // validation handled by form
    }
  };

  const selectedWoType = Form.useWatch("woType", form) as WorkOrderType | undefined;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => router.push("/work-orders")}
          >
            <ArrowLeftOutlined />
            <span>Back to Work Orders</span>
          </button>

          <div className="flex items-center gap-2">
            <Button className="!rounded-lg" onClick={() => router.push("/work-orders")}>
              Cancel
            </Button>
            <Button type="primary" className="!rounded-lg" icon={<SaveOutlined />} onClick={onCreate}>
              Create Work Order
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">Create New Work Order</div>
          <div className="text-sm text-gray-500">Generate work order with Kanban barcode integration</div>
        </div>
      </div>

      <Form form={form} layout="vertical">
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Work Order Details</div>
            <div className="text-xs text-gray-500 mt-1">Configure basic work order information and product details</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Form.Item name="woNumber" label="Work Order Number" rules={[{ required: true }]}>
                  <Input className="!rounded-lg" disabled placeholder="WO-2024-006" />
                </Form.Item>
                <div className="-mt-3 text-xs text-gray-400">Auto-generated on save</div>
              </div>

              <Form.Item name="woType" label="Work Order Type" rules={[{ required: true, message: "Select type" }]}>
                <Select
                  className="!rounded-lg"
                  placeholder="Select type"
                  options={[
                    { label: "New", value: "New" },
                    { label: "Additional", value: "Additional" },
                    { label: "Assembly", value: "Assembly" },
                    { label: "Rework", value: "Rework" },
                  ]}
                />
              </Form.Item>

              <div className="md:col-span-2">
                <Form.Item name="woReference" label="WO Reference (for Additional type)">
                  <Select
                    className="!rounded-lg"
                    placeholder="Select reference WO (only for Additional)"
                    disabled={selectedWoType !== "Additional"}
                    options={[
                      { label: "WO-2024-001", value: "WO-2024-001" },
                      { label: "WO-2024-002", value: "WO-2024-002" },
                      { label: "WO-2024-003", value: "WO-2024-003" },
                    ]}
                  />
                </Form.Item>
                <div className="-mt-3 text-xs text-gray-400">Only applicable when WO Type = Additional</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Products &amp; UNIQs</div>
                <div className="text-xs text-gray-500 mt-1">Add multiple UNIQs to this work order (1 UNIQ = 1 Kanban)</div>
              </div>
              <Button className="!rounded-lg" icon={<PlusOutlined />} onClick={addLine}>
                Add UNIQ
              </Button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-600 grid grid-cols-12 gap-3">
                <div className="col-span-2">UNIQ</div>
                <div className="col-span-3">Part Name</div>
                <div className="col-span-1">Quantity</div>
                <div className="col-span-1">UoM</div>
                <div className="col-span-2">Process Name</div>
                <div className="col-span-2">Kanban Number</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              <div className="divide-y divide-gray-100">
                {lines.map((l, idx) => {
                  const selectedUniq = uniqOptions.find((u) => u.uniq === l.uniq);
                  const processOptions = (selectedUniq?.processes || []).map((p) => ({ label: p, value: p }));

                  return (
                    <div key={l.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-2">
                        <Select
                          className="!rounded-lg w-full"
                          placeholder="Select"
                          value={l.uniq}
                          options={uniqSelectOptions}
                          onChange={(v) => onSelectUniq(l.id, v)}
                        />
                      </div>
                      <div className="col-span-3">
                        <Input className="!rounded-lg" value={l.partName} placeholder="Auto-filled" disabled />
                      </div>
                      <div className="col-span-1">
                        <InputNumber
                          className="!rounded-lg w-full"
                          placeholder="Qty"
                          min={0}
                          value={l.qty}
                          onChange={(v) => updateLine(l.id, { qty: typeof v === "number" ? v : undefined })}
                        />
                      </div>
                      <div className="col-span-1">
                        <Select
                          className="!rounded-lg w-full"
                          placeholder="UoM"
                          value={l.uom}
                          options={[
                            { label: "pcs", value: "pcs" },
                            { label: "set", value: "set" },
                            { label: "kg", value: "kg" },
                          ]}
                          onChange={(v) => updateLine(l.id, { uom: v })}
                        />
                      </div>
                      <div className="col-span-2">
                        <Select
                          className="!rounded-lg w-full"
                          placeholder="Process"
                          value={l.process}
                          options={processOptions}
                          onChange={(v) => updateLine(l.id, { process: v })}
                          disabled={!l.uniq}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input className="!rounded-lg" value={l.kanbanNumber} disabled />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeLine(l.id)}
                          aria-label={`delete-line-${idx}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Production Scheduling</div>
            <div className="text-xs text-gray-500 mt-1">Set production timeline and target dates</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="woCreatedDate" label="WO Created Date" rules={[{ required: true, message: "Select created date" }]}>
                <DatePicker className="!rounded-lg w-full" placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item name="woTargetDate" label="WO Target Date" rules={[{ required: true, message: "Select target date" }]}>
                <DatePicker className="!rounded-lg w-full" placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
              </Form.Item>

              <div>
                <Form.Item name="woScanStartDate" label="WO Scan Start Date">
                  <DatePicker className="!rounded-lg w-full" placeholder="dd/mm/yyyy" disabled format="DD/MM/YYYY" />
                </Form.Item>
                <div className="-mt-3 text-xs text-gray-400">Date when scanning started</div>
              </div>
              <div>
                <Form.Item name="woCloseDate" label="WO Close Date">
                  <DatePicker className="!rounded-lg w-full" placeholder="dd/mm/yyyy" disabled format="DD/MM/YYYY" />
                </Form.Item>
                <div className="-mt-3 text-xs text-gray-400">Date when WO completed</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              <span className="font-semibold">Aging Calculation:</span> WO Created Date - WO Scan Date = Aging (days)
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}
