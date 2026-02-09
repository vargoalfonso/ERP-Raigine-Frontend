"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Form,
  Card,
  Button,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Table,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import { useCreateWorkInProgressMutation } from "@/lib/api/work-in-progress/api";
import type { CreateWorkInProgressRequest, ProcessPriority } from "@/lib/api/work-in-progress/interface";
type WipType = "Child Part" | "Warehouse FG";
type Process = "Welding" | "CNC Machine" | "Quality Check";

type WipEntry = {
  id: string;
  uniq: string;
  woNumber: string;
  packingNumber: string;
  wipType: WipType;
  process: Process;
  stock: number;
  stockToCompleteKanban: number;
  pcsPerKanban: number;
};

type WipFormValues = {
  uniq?: string;
  woNumber?: string;
  packingNumber?: string;
  wipType?: WipType;
  process?: Process;
  stock?: number;
  stockToCompleteKanban?: number;
};

export default function CreateWorkInProgressPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const useApi = Boolean(apiBaseUrl);
  const [createWorkInProgress] = useCreateWorkInProgressMutation();
  const [entries, setEntries] = useState<WipEntry[]>([
    {
      id: "1",
      uniq: "LV-001",
      woNumber: "WO-2024-0239",
      packingNumber: "KBN-004-2024",
      wipType: "Child Part",
      process: "Welding",
      stock: 100,
      stockToCompleteKanban: 100,
      pcsPerKanban: 20,
    },
    {
      id: "2",
      uniq: "LV-001",
      woNumber: "WO-2024-0239",
      packingNumber: "KBN-004-2024",
      wipType: "Warehouse FG",
      process: "CNC Machine",
      stock: 100,
      stockToCompleteKanban: 100,
      pcsPerKanban: 20,
    },
    {
      id: "3",
      uniq: "LV-001",
      woNumber: "WO-2024-0239",
      packingNumber: "KBN-004-2024",
      wipType: "Child Part",
      process: "Quality Check",
      stock: 100,
      stockToCompleteKanban: 100,
      pcsPerKanban: 20,
    },
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<WipFormValues>();

  const uniqTargets = useMemo(() => {
    return new Map<string, number>([
      ["LV-001", 250],
      ["LV-002", 250],
      ["LV-003", 250],
    ]);
  }, []);

  const updateAutoFill = () => {
    const uniq = form.getFieldValue("uniq");
    const stock = form.getFieldValue("stock");
    const target = uniq ? uniqTargets.get(uniq) ?? 250 : 250;
    const next = Math.max(0, target - (Number(stock) || 0));
    form.setFieldValue("stockToCompleteKanban", next);
  };

  const handleAddOrUpdate = async () => {
    try {
      const values = await form.validateFields();

      const newEntry: WipEntry = {
        id: editingId ?? `${Date.now()}`,
        uniq: values.uniq ?? "-",
        woNumber: values.woNumber ?? "-",
        packingNumber: values.packingNumber ?? "-",
        wipType: (values.wipType ?? "Child Part") as WipType,
        process: (values.process ?? "Welding") as Process,
        stock: Number(values.stock ?? 0),
        stockToCompleteKanban: Number(values.stockToCompleteKanban ?? 0),
        pcsPerKanban: 20,
      };

      if (editingId) {
        setEntries((prev) => prev.map((e) => (e.id === editingId ? newEntry : e)));
        message.success("Updated");
      } else {
        setEntries((prev) => [newEntry, ...prev]);
        message.success("Added");
      }

      setEditingId(null);
      form.resetFields();
    } catch {
      // validation errors shown by antd
    }
  };

  const handleEditRow = (row: WipEntry) => {
    setEditingId(row.id);
    form.setFieldsValue({
      uniq: row.uniq,
      woNumber: row.woNumber,
      packingNumber: row.packingNumber,
      wipType: row.wipType,
      process: row.process,
      stock: row.stock,
      stockToCompleteKanban: row.stockToCompleteKanban,
    });
  };

  const handleDeleteRow = (row: WipEntry) => {
    Modal.confirm({
      title: "Delete WIP entry?",
      content: `This will remove ${row.uniq} (${row.process}) from the list.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: () => {
        setEntries((prev) => prev.filter((e) => e.id !== row.id));
        if (editingId === row.id) {
          setEditingId(null);
          form.resetFields();
        }
        message.success("Deleted");
      },
    });
  };

  const handleSave = async () => {
    if (entries.length === 0) {
      message.warning("No entries to save");
      return;
    }
    try {
      setIsSubmitting(true);
      if (useApi) {
        const nowIso = new Date().toISOString();
        const estimatedIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const defaultPriority: ProcessPriority = "Medium";

        const requests: CreateWorkInProgressRequest[] = entries.map((e) => ({
          product_uniq: e.uniq,
          part_name: e.wipType === "Warehouse FG" ? "Warehouse FG" : "Child Part",
          work_order_reference: e.woNumber,
          batch_number: e.packingNumber,
          quantity_in_process: e.stock,
          current_process: e.process,
          process_station: "Default Station",
          production_start_date: nowIso,
          estimated_completion: estimatedIso,
          current_operator: "System",
          process_priority: defaultPriority,
          process_notes: `wipType=${e.wipType}; stockToCompleteKanban=${e.stockToCompleteKanban}; pcsPerKanban=${e.pcsPerKanban}`,
        }));

        for (const req of requests) {
          await createWorkInProgress(req).unwrap();
        }

        message.success("Saved to API");
      } else {
        console.log("Save WIP Entries:", entries);
        message.success("Saved (mock)");
      }

      router.push("/work-in-progress");
    } catch (err) {
      console.error(err);
      message.error("Failed to save WIP entries");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/work-in-progress");
  };

  const columns = [
    { title: "Uniq", dataIndex: "uniq", key: "uniq", width: 90 },
    { title: "WO Number", dataIndex: "woNumber", key: "woNumber", width: 130 },
    {
      title: "Packing Number",
      dataIndex: "packingNumber",
      key: "packingNumber",
      width: 140,
      render: (v: string) => (
        <span className="inline-flex rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
          {v}
        </span>
      ),
    },
    { title: "WIP Type", dataIndex: "wipType", key: "wipType", width: 120 },
    { title: "Process", dataIndex: "process", key: "process", width: 120 },
    { title: "Stock", dataIndex: "stock", key: "stock", width: 80 },
    {
      title: "Stock to Complete KanBan",
      dataIndex: "stockToCompleteKanban",
      key: "stockToCompleteKanban",
      width: 160,
      render: (v: number) => <span className="text-xs text-gray-700">pcs</span>,
    },
    {
      title: "Pcs/Kanban",
      dataIndex: "pcsPerKanban",
      key: "pcsPerKanban",
      width: 110,
    },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      render: (_: unknown, row: WipEntry) => (
        <div className="flex items-center gap-2">
          <Button type="text" size="small" icon={<SaveOutlined />} onClick={() => handleEditRow(row)} />
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteRow(row)} />
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-white shadow-sm fixed top-0 left-0 w-full z-50 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="text-sm text-gray-700 hover:text-gray-900"
              onClick={handleCancel}
            >
              <span className="inline-flex items-center gap-2">
                <ArrowLeftOutlined /> Back to Work In-Progress
              </span>
            </button>
            <div className="h-6 w-px bg-gray-200" />
            <div>
              <div className="text-lg font-semibold text-gray-900">Work In-Progress</div>
              <div className="text-xs text-gray-500">Create Work In-Progress • {entries.length} entry</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleCancel}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={isSubmitting} onClick={handleSave}>
              Save WIP Entries
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 mt-20 flex justify-center">
        <div className="w-full max-w-6xl space-y-6">
          <Card className="rounded-xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Step 1: Input WIP Data</div>
                <div className="text-xs text-gray-500">Input WIP Data based on each uniq and process</div>
              </div>
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">Required</span>
            </div>

            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              onValuesChange={() => updateAutoFill()}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Form.Item label="Uniq" name="uniq" rules={[{ required: true, message: "Uniq is required" }]}>
                  <Select
                    placeholder="Select Uniq"
                    options={[
                      { label: "LV-001", value: "LV-001" },
                      { label: "LV-002", value: "LV-002" },
                      { label: "LV-003", value: "LV-003" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  label="Work Order Number"
                  name="woNumber"
                  rules={[{ required: true, message: "Work Order Number is required" }]}
                >
                  <Select
                    placeholder="Select WO"
                    options={[
                      { label: "WO-2024-0239", value: "WO-2024-0239" },
                      { label: "WO-2024-0240", value: "WO-2024-0240" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  label="Packing Number"
                  name="packingNumber"
                  rules={[{ required: true, message: "Packing Number is required" }]}
                >
                  <Select
                    placeholder="Select Packing"
                    options={[
                      { label: "WH-FG-029", value: "WH-FG-029" },
                      { label: "KBN-004-2024", value: "KBN-004-2024" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  label="WIP Type"
                  name="wipType"
                  rules={[{ required: true, message: "WIP Type is required" }]}
                >
                  <Select
                    placeholder="Select Type"
                    options={[
                      { label: "Child Part", value: "Child Part" },
                      { label: "Warehouse FG", value: "Warehouse FG" },
                    ]}
                  />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <Form.Item
                  label="Process"
                  name="process"
                  rules={[{ required: true, message: "Process is required" }]}
                >
                  <Select
                    placeholder="Select Process or Add new"
                    options={[
                      { label: "Welding", value: "Welding" },
                      { label: "CNC Machine", value: "CNC Machine" },
                      { label: "Quality Check", value: "Quality Check" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  label="Stock"
                  name="stock"
                  rules={[{ required: true, message: "Stock is required" }]}
                >
                  <InputNumber className="w-full" min={0} placeholder="Input Stock" />
                </Form.Item>

                <Form.Item label="Stock to Complete Kanban" name="stockToCompleteKanban">
                  <Input disabled placeholder="Automatically filled." />
                </Form.Item>

                <div className="pb-[24px]">
                  <Button type="primary" className="w-full" onClick={handleAddOrUpdate}>
                    + Add WIP
                  </Button>
                </div>
              </div>
            </Form>
          </Card>

          <Card className="rounded-xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Step 2: Check Data</div>
                <div className="text-xs text-gray-500">Check all data input, you can edit or delete it</div>
              </div>
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">Required</span>
            </div>

            <div className="overflow-x-auto">
              <Table<WipEntry>
                columns={columns}
                dataSource={entries}
                rowKey="id"
                pagination={false}
                bordered
                scroll={{ x: "max-content" }}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
