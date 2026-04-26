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
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  type BulkDocumentItemOption,
  useCreateBulkWorkOrdersMutation,
  useLazyGetBulkDocumentItemsQuery,
} from "@/lib/api/work-orders/bulk/api";

type WorkOrderType = "New" | "Assembly" | "Rework" | "Additional";

type SourceDocumentType = "PO" | "SO" | "DN" | "OTHER";

type BulkItem = {
  key: string;
  sourceLineId: string;
  uniq: string;
  partName: string;
  partNumber: string;
  uom: string;
  quantity: number;
  kanbanQty: number;
  kanbanCount: number;
  targetDate?: string; // YYYY-MM-DD
};

const tabHint = () => {
  // Placeholder for future: if you want deep-linking to bulk tab.
  return "/work-orders";
};

const computeKanbanCount = (quantity: number, kanbanQty: number) => {
  const q = Number(quantity) || 0;
  const k = Number(kanbanQty) || 0;
  if (q <= 0) return 0;
  if (k <= 0) return 1;
  return Math.max(1, Math.ceil(q / k));
};

const mapDocumentItemsToBulkItems = (items: BulkDocumentItemOption[]): BulkItem[] => {
  return items.map((it, index) => {
    const quantity = Number(it.quantity ?? 0);
    const kanbanQty = Number(it.kanban_qty ?? 100);
    const kanbanCount = Number(it.kanban_count ?? computeKanbanCount(quantity, kanbanQty));

    return {
      key: `${it.source_line_id}-${it.item_uniq_code}-${index}`,
      sourceLineId: it.source_line_id,
      uniq: it.item_uniq_code,
      partName: it.part_name ?? "-",
      partNumber: it.part_number ?? "-",
      uom: it.uom ?? "",
      quantity,
      kanbanQty,
      kanbanCount,
      targetDate: it.target_date,
    };
  });
};

export default function CreateBulkWorkOrderPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const { TextArea } = Input;
  const apiEnabled = Boolean(apiBaseUrl);
  const [loadDocumentItems, documentItemsQuery] = useLazyGetBulkDocumentItemsQuery();
  const [createBulkWorkOrders, createBulkState] = useCreateBulkWorkOrdersMutation();

  const [items, setItems] = useState<BulkItem[]>([]);
  const [note, setNote] = useState("");

  const totals = useMemo(() => {
    const totalUniqs = items.length;
    const totalKanbans = items.reduce((acc, it) => acc + (it.kanbanCount || 0), 0);
    return { totalUniqs, totalKanbans };
  }, [items]);

  const loadItemsFromDocument = async () => {
    const sourceDocumentId = String(form.getFieldValue("sourceDocumentId") ?? "").trim();
    if (!sourceDocumentId) {
      message.error("Document ID is required");
      return;
    }

    if (!apiEnabled) {
      setItems(
        mapDocumentItemsToBulkItems([
          {
            source_line_id: "mock-line-1",
            item_uniq_code: "EMA-LV7-001",
            part_name: "Engine Mount Assembly",
            part_number: "EMA-001-LV7",
            uom: "",
            quantity: 60,
            kanban_qty: 100,
            kanban_count: 1,
            target_date: "2026-04-10",
          },
        ])
      );
      message.success("Document items loaded (mock)");
      return;
    }

    try {
      const options = await loadDocumentItems({ document_id: sourceDocumentId }).unwrap();
      setItems(mapDocumentItemsToBulkItems(options));
      message.success("Document items loaded");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to load document items"));
    }
  };

  const updateItem = (key: string, patch: Partial<BulkItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const next = { ...it, ...patch };
        if (patch.quantity != null || patch.kanbanQty != null) {
          next.kanbanCount = computeKanbanCount(next.quantity, next.kanbanQty);
        }
        return next;
      })
    );
  };

  const onGenerate = async () => {
    try {
      const values = await form.validateFields();
      const bulkTargetDate = values.targetDate as Dayjs | undefined;

      if (!items.length) {
        message.error("Load document items first");
        return;
      }

      const missingTarget = items.some(
        (it) => !(it.targetDate || (bulkTargetDate ? dayjs(bulkTargetDate).format("YYYY-MM-DD") : ""))
      );
      if (missingTarget) {
        message.error("Fill target date for all items");
        return;
      }

      if (!apiEnabled) {
        message.success("Bulk work order generated (mock)");
        router.push(tabHint());
        return;
      }

      const created = await createBulkWorkOrders({
        source_document_id: String(values.sourceDocumentId).trim(),
        source_document_type: String(values.sourceDocumentType),
        wo_type: String(values.woType),
        items: items.map((it) => ({
          source_line_id: it.sourceLineId,
          item_uniq_code: it.uniq,
          part_name: it.partName,
          part_number: it.partNumber,
          uom: it.uom ?? "",
          quantity: Number(it.quantity ?? 0),
          kanban_qty: Number(it.kanbanQty ?? 0),
          kanban_count: Number(it.kanbanCount ?? 0),
          target_date: it.targetDate
            ? it.targetDate
            : bulkTargetDate
              ? dayjs(bulkTargetDate).format("YYYY-MM-DD")
              : "",
        })),
        notes: note.trim() || undefined,
      }).unwrap();

      void created;
      message.success("Bulk work order created successfully");
      router.push(tabHint());
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to create bulk work order"));
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
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<SaveOutlined />}
              onClick={onGenerate}
              loading={createBulkState.isLoading}
            >
              Generate Bulk WO
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">Create Bulk Work Order</div>
          <div className="text-sm text-gray-500">Generate multiple work orders from a source document (PO / SO / etc.)</div>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{ woType: "New", sourceDocumentType: "PO" as SourceDocumentType }}
      >
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Select Document &amp; Date</div>
            <div className="text-xs text-gray-500 mt-1">Choose source document and default target date (optional)</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="sourceDocumentType"
                label="Source Document Type"
                rules={[{ required: true, message: "Select source document type" }]}
              >
                <Select
                  className="!rounded-lg"
                  placeholder="Select type"
                  options={[
                    { label: "PO", value: "PO" },
                    { label: "SO", value: "SO" },
                    { label: "DN", value: "DN" },
                    { label: "Other", value: "OTHER" },
                  ] satisfies Array<{ label: string; value: SourceDocumentType }>}
                />
              </Form.Item>

              <Form.Item
                name="sourceDocumentId"
                label="Source Document ID"
                rules={[{ required: true, message: "Enter source document id" }]}
              >
                <Input className="!rounded-lg" placeholder="Paste document UUID" />
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

              <Form.Item name="targetDate" label="Default Target Date (optional)">
                <DatePicker className="!rounded-lg w-full" placeholder="yyyy-mm-dd" format="YYYY-MM-DD" />
              </Form.Item>

              <div className="flex items-end justify-end">
                <Button
                  className="!rounded-lg"
                  type="primary"
                  icon={<CloudDownloadOutlined />}
                  onClick={loadItemsFromDocument}
                  loading={documentItemsQuery.isFetching}
                >
                  Load Document Items
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Document Items - Edit Qty &amp; Target Date</div>
            <div className="text-xs text-gray-500 mt-1">Edit quantities, kanban sizing, and target dates before generating bulk WOs.</div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-600 grid grid-cols-12 gap-3">
                <div className="col-span-2">UNIQ</div>
                <div className="col-span-3">Part Name</div>
                <div className="col-span-2">Part Number</div>
                <div className="col-span-2">Quantity</div>
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
                          value={it.quantity}
                          onChange={(v) => updateItem(it.key, { quantity: typeof v === "number" ? v : 0 })}
                        />
                      </div>
                      <div className="col-span-1 text-sm text-gray-800">{it.kanbanCount} Kanban</div>
                      <div className="col-span-2">
                        <DatePicker
                          className="!rounded-lg w-full"
                          placeholder="yyyy-mm-dd"
                          format="YYYY-MM-DD"
                          value={it.targetDate ? dayjs(it.targetDate, "YYYY-MM-DD") : undefined}
                          onChange={(val) => {
                            if (!val) {
                              updateItem(it.key, { targetDate: undefined });
                              return;
                            }
                            updateItem(it.key, { targetDate: dayjs(val as Dayjs).format("YYYY-MM-DD") });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-sm text-gray-500">No items loaded. Click “Load Document Items”.</div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <div className="text-xs font-semibold text-green-800">Ready to Generate</div>
              <div className="text-xs text-green-700 mt-1">Total Items: {totals.totalUniqs} | Total Kanbans: {totals.totalKanbans}</div>
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
