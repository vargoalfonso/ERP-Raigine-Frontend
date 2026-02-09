"use client";

import { useMemo, useState } from "react";
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
  CloudDownloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs, { type Dayjs } from "dayjs";

type WorkOrderType = "New" | "Assembly" | "Rework" | "Additional";

type PrlItem = {
  key: string;
  uniq: string;
  partName: string;
  partNumber: string;
  qty: number;
  kanbanCount: number;
  targetDate?: string; // DD/MM/YYYY
};

type PrlOption = {
  label: string;
  value: string;
};

const fmtDDMMYYYY = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const tabHint = () => {
  // Placeholder for future: if you want deep-linking to bulk tab.
  return "/work-orders";
};

export default function CreateBulkWorkOrderPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const { TextArea } = Input;

  const prlOptions: PrlOption[] = [
    { label: "PRL-2024-001 - Toyota (Camry 2024)", value: "PRL-2024-001" },
    { label: "PRL-2024-002 - Honda (Civic 2024)", value: "PRL-2024-002" },
  ];

  const approvalManagers = [
    { label: "Jane Smith - Operations Mgr", value: "Jane Smith - Operations Mgr" },
    { label: "Mike Johnson - Manufacturing Head", value: "Mike Johnson - Manufacturing Head" },
    { label: "John Smith - Production Manager", value: "John Smith - Production Manager" },
  ];

  const [items, setItems] = useState<PrlItem[]>([]);
  const [note, setNote] = useState("");

  const totals = useMemo(() => {
    const totalUniqs = items.length;
    const totalKanbans = items.reduce((acc, it) => acc + (it.kanbanCount || 0), 0);
    return { totalUniqs, totalKanbans };
  }, [items]);

  const loadPrlItems = () => {
    const prl = form.getFieldValue("prl");
    if (!prl) {
      message.error("Select PRL first");
      return;
    }

    // Mock PRL items
    const mock: PrlItem[] = [
      { key: "i-1", uniq: "LV7-001", partName: "Engine Mount Assembly", partNumber: "EM-001-A", qty: 500, kanbanCount: 5 },
      { key: "i-2", uniq: "LV8-002", partName: "Suspension Arm", partNumber: "SA-002-B", qty: 400, kanbanCount: 4 },
      { key: "i-3", uniq: "LW0-003", partName: "Brake Caliper", partNumber: "BC-003-C", qty: 600, kanbanCount: 6 },
      { key: "i-4", uniq: "MB6-004", partName: "Control Module", partNumber: "CM-004-D", qty: 300, kanbanCount: 3 },
    ];

    setItems(mock);
    message.success("PRL items loaded");
  };

  const updateItem = (key: string, patch: Partial<PrlItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const onGenerate = async () => {
    try {
      const values = await form.validateFields();
      const bulkTargetDate = values.targetDate as Dayjs;

      if (!items.length) {
        message.error("Load PRL items first");
        return;
      }

      const missingTarget = items.some(
        (it) => !(it.targetDate || (bulkTargetDate ? fmtDDMMYYYY(bulkTargetDate.toDate()) : ""))
      );
      if (missingTarget) {
        message.error("Fill target date for all items");
        return;
      }

      message.success("Bulk work order generated (mock)");
      router.push(tabHint());
    } catch {
      // validation handled by form
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
            <ArrowLeftOutlined />
            <span>Back to Work Orders</span>
          </button>

          <div className="flex items-center gap-2">
            <Button className="!rounded-lg" onClick={() => router.push("/work-orders")}>
              Cancel
            </Button>
            <Button type="primary" className="!rounded-lg" icon={<SaveOutlined />} onClick={onGenerate}>
              Generate Bulk WO
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">Create Bulk Work Order</div>
          <div className="text-sm text-gray-500">Generate multiple work orders from PRL (Production Requirement List)</div>
        </div>
      </div>

      <Form form={form} layout="vertical" initialValues={{ woType: "New" }}>
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Select PRL &amp; Date</div>
            <div className="text-xs text-gray-500 mt-1">Choose Production Requirement List and target date</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="prl"
                label="Production Requirement List (PRL) or Production Planning"
                rules={[{ required: true, message: "Select PRL" }]}
              >
                <Select
                  className="!rounded-lg"
                  placeholder="Select PRL"
                  options={prlOptions}
                />
              </Form.Item>

              <Form.Item name="targetDate" label="Target Date" rules={[{ required: true, message: "Select target date" }]}>
                <DatePicker className="!rounded-lg w-full" placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
              </Form.Item>

              <Form.Item name="woType" label="Work Order Type" rules={[{ required: true }]}>
                <Select
                  className="!rounded-lg"
                  options={[
                    { label: "New", value: "New" },
                    { label: "Assembly", value: "Assembly" },
                    { label: "Additional", value: "Additional" },
                    { label: "Rework", value: "Rework" },
                  ] satisfies Array<{ label: string; value: WorkOrderType }>}
                />
              </Form.Item>

              <div className="flex items-end justify-end">
                <Button className="!rounded-lg" type="primary" icon={<CloudDownloadOutlined />} onClick={loadPrlItems}>
                  Load PRL Items
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">PRL Items - Edit UNIQ &amp; Quantity</div>
            <div className="text-xs text-gray-500 mt-1">Each UNIQ equals 1 Kanban. Edit quantities and target dates as needed.</div>

            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              <span className="font-semibold">Note:</span> 1 UNIQ = 1 Kanban. Adjust quantities to generate appropriate number of Kanbans.
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-600 grid grid-cols-12 gap-3">
                <div className="col-span-2">UNIQ</div>
                <div className="col-span-3">Part Name</div>
                <div className="col-span-2">Part Number</div>
                <div className="col-span-2">Quantity (Editable)</div>
                <div className="col-span-1">Kanban Count</div>
                <div className="col-span-2">Target Date (Editable)</div>
              </div>

              {items.length ? (
                <div className="divide-y divide-gray-100">
                  {items.map((it) => (
                    <div key={it.key} className="px-4 py-3 grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-2 text-sm font-semibold text-gray-900">{it.uniq}</div>
                      <div className="col-span-3 text-sm text-gray-800">{it.partName}</div>
                      <div className="col-span-2 text-sm text-gray-700">{it.partNumber}</div>
                      <div className="col-span-2">
                        <InputNumber
                          className="!rounded-lg w-full"
                          min={0}
                          value={it.qty}
                          onChange={(v) => updateItem(it.key, { qty: typeof v === "number" ? v : 0 })}
                        />
                      </div>
                      <div className="col-span-1 text-sm text-gray-800">{it.kanbanCount} Kanban</div>
                      <div className="col-span-2">
                        <DatePicker
                          className="!rounded-lg w-full"
                          placeholder="dd/mm/yyyy"
                          format="DD/MM/YYYY"
                          value={it.targetDate ? dayjs(it.targetDate, "DD/MM/YYYY") : undefined}
                          onChange={(val) => {
                            if (!val) {
                              updateItem(it.key, { targetDate: undefined });
                              return;
                            }
                            const jsDate = (val as Dayjs).toDate();
                            updateItem(it.key, { targetDate: fmtDDMMYYYY(jsDate) });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-sm text-gray-500">No items loaded. Click “Load PRL Items”.</div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold text-green-800">Ready to Generate</div>
                <div className="text-xs text-green-700 mt-1">Total UNIQs: {totals.totalUniqs} | Total Kanbans: {totals.totalKanbans}</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-600">Approval Manager:</div>
                <Form.Item name="approvalManager" className="!mb-0" rules={[{ required: true, message: "Select approval manager" }]}>
                  <Select className="!rounded-lg w-64" options={approvalManagers} placeholder="Select manager" />
                </Form.Item>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-700">Internal Note (optional)</div>
              <TextArea
                className="!rounded-lg mt-2"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add note for approver / planning..."
              />
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}
