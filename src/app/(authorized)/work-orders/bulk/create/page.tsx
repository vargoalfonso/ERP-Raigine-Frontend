"use client";

import { useMemo, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
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
import { useCreateBulkWorkOrdersMutation } from "@/lib/api/work-orders/bulk/api";
import {
  useLazyGetPoBudgetPrlDetailQuery,
  type PoBudgetPrlChild,
  type PoBudgetPrlDetail,
} from "@/lib/api/po-budget/api";
import { useListPrlsQuery } from "@/lib/api/prl/api";

type WorkOrderType = "New" | "Assembly" | "Rework" | "Additional";

/**
 * A row in the bulk work-order table.
 * - `isHeader` rows are non-editable group headers for each PRL parent UNIQ.
 * - non-header rows are the editable child/material lines (1 UNIQ = 1 Kanban set)
 *   that are actually submitted when generating the bulk work orders.
 */
type BulkRow = {
  key: string;
  isHeader?: boolean;
  childCount?: number;
  /** PRL parent item id -> used as source_line_id */
  prlItemId: string;
  parentUniq: string;
  uniq: string;
  partName: string;
  partNumber: string;
  model: string;
  materialGrade: string;
  uom: string;
  quantity: number;
  kanbanQty: number;
  kanbanCount: number;
  targetDate?: string; // YYYY-MM-DD
};

const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const text = (value: unknown, fallback = "") => String(value ?? fallback).trim();

const DEFAULT_KANBAN_QTY = 100;

const computeKanbanCount = (quantity: number, kanbanQty: number) => {
  const q = Number(quantity) || 0;
  const k = Number(kanbanQty) || 0;
  if (q <= 0) return 0;
  if (k <= 0) return 1;
  return Math.max(1, Math.ceil(q / k));
};

const gradeOf = (child: PoBudgetPrlChild) =>
  text(child.material_spec?.material_grade ?? child.material_spec?.grade);

/**
 * Flatten a PRL detail into table rows, expanding every parent UNIQ into its
 * child/material lines (the same PRL -> PO budget expansion pattern).
 * Parents without a BOM/children become a single editable leaf row so they can
 * still be generated.
 */
const buildRowsFromPrlDetail = (
  detail: PoBudgetPrlDetail | undefined,
): BulkRow[] => {
  const items = detail?.items ?? [];
  const rows: BulkRow[] = [];

  items.forEach((item, pIdx) => {
    const children = Array.isArray(item.children) ? item.children : [];
    const parentQty = num(item.remaining_qty ?? item.quantity);
    const prlItemId = text(item.id, `p${pIdx}`);
    const parentUniq = text(item.uniq_code, "-");

    if (children.length > 0) {
      // Group header for the parent UNIQ (display only)
      rows.push({
        key: `${text(detail?.id, "prl")}-parent-${prlItemId}`,
        isHeader: true,
        childCount: children.length,
        prlItemId,
        parentUniq,
        uniq: parentUniq,
        partName: text(item.part_name, "-"),
        partNumber: text(item.part_number, "-"),
        model: text(item.product_model, "-"),
        materialGrade: "",
        uom: text(item.uom),
        quantity: parentQty,
        kanbanQty: DEFAULT_KANBAN_QTY,
        kanbanCount: computeKanbanCount(parentQty, DEFAULT_KANBAN_QTY),
      });

      const perChildQty =
        children.length > 0 ? Math.round(parentQty / children.length) : parentQty;

      children.forEach((child, cIdx) => {
        const qty = num(child.quantity) || perChildQty;
        rows.push({
          key: `${text(detail?.id, "prl")}-${prlItemId}-${text(child.uniq_code, `c${cIdx}`)}-${cIdx}`,
          prlItemId,
          parentUniq,
          uniq: text(child.uniq_code || child.uniq, "-"),
          partName: text(child.part_name, "-"),
          partNumber: text(child.part_number, "-"),
          model: text(child.model ?? item.product_model, "-"),
          materialGrade: gradeOf(child),
          uom: text(child.uom),
          quantity: qty,
          kanbanQty: DEFAULT_KANBAN_QTY,
          kanbanCount: computeKanbanCount(qty, DEFAULT_KANBAN_QTY),
          targetDate: undefined,
        });
      });
    } else {
      // No BOM children -> generate for the parent UNIQ itself
      rows.push({
        key: `${text(detail?.id, "prl")}-leaf-${prlItemId}`,
        prlItemId,
        parentUniq,
        uniq: parentUniq,
        partName: text(item.part_name, "-"),
        partNumber: text(item.part_number, "-"),
        model: text(item.product_model, "-"),
        materialGrade: "",
        uom: text(item.uom),
        quantity: parentQty,
        kanbanQty: DEFAULT_KANBAN_QTY,
        kanbanCount: computeKanbanCount(parentQty, DEFAULT_KANBAN_QTY),
        targetDate: undefined,
      });
    }
  });

  return rows;
};

export default function CreateBulkWorkOrderPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const { TextArea } = Input;
  const apiEnabled = Boolean(apiBaseUrl);

  const [loadPrlDetail, prlDetailQuery] = useLazyGetPoBudgetPrlDetailQuery();
  const [createBulkWorkOrders, createBulkState] =
    useCreateBulkWorkOrdersMutation();

  const [prlSearch, setPrlSearch] = useState("");
  const { data: prlsResponse, isFetching: prlsFetching } = useListPrlsQuery(
    { page: 1, limit: 100, search: prlSearch.trim() || undefined },
    { skip: !apiEnabled },
  );

  const [rows, setRows] = useState<BulkRow[]>([]);
  const [loadedPrlId, setLoadedPrlId] = useState<string>("");
  const [note, setNote] = useState("");

  // PRL options grouped by PRL id (one PRL that covers many UNIQ = one option).
  const prlOptions = useMemo(() => {
    const groups = new Map<
      string,
      { customer: string; model: string; uniqs: string[] }
    >();
    for (const item of prlsResponse?.items ?? []) {
      const prlId = text(item.prl_id ?? item.id);
      if (!prlId) continue;
      const customer = text(
        item.customer?.customer_name ?? item.customer_name,
        "-",
      );
      const model = text(item.product_model);
      const uniq = text(item.uniq_code ?? item.item_uniq_code);
      if (!groups.has(prlId)) groups.set(prlId, { customer, model, uniqs: [] });
      const group = groups.get(prlId)!;
      if (uniq && !group.uniqs.includes(uniq)) group.uniqs.push(uniq);
    }
    return Array.from(groups.entries()).map(([prlId, group]) => ({
      value: prlId,
      label: group.model
        ? `${prlId} - ${group.customer} (${group.model})`
        : `${prlId} - ${group.customer}`,
    }));
  }, [prlsResponse]);

  const totals = useMemo(() => {
    const editable = rows.filter((r) => !r.isHeader);
    const totalUniqs = editable.length;
    const totalKanbans = editable.reduce(
      (acc, r) => acc + (r.kanbanCount || 0),
      0,
    );
    return { totalUniqs, totalKanbans };
  }, [rows]);

  const loadItemsFromPrl = async () => {
    const prlId = text(form.getFieldValue("prlId"));
    if (!prlId) {
      message.error("Pilih PRL terlebih dahulu");
      return;
    }

    if (!apiEnabled) {
      const mock: PoBudgetPrlDetail = {
        id: prlId,
        prl_number: prlId,
        customer_name: "Toyota",
        period: "June 2026",
        items: [
          {
            id: 1,
            uniq_code: "LV7-001",
            product_model: "Camry 2024",
            part_name: "Engine Mount Assembly",
            part_number: "EMA-001-LV7",
            quantity: 500,
            allocated_qty: 0,
            remaining_qty: 500,
            children: [
              {
                uniq: "RM-STEEL-01",
                uniq_code: "RM-STEEL-01",
                part_name: "Steel Plate",
                part_number: "SP-1020",
                quantity: 300,
                uom: "kg",
                material_spec: { material_grade: "SS400" },
              },
              {
                uniq: "RM-BOLT-01",
                uniq_code: "RM-BOLT-01",
                part_name: "Hex Bolt",
                part_number: "HB-M10",
                quantity: 200,
                uom: "pcs",
                material_spec: { material_grade: "Grade 8.8" },
              },
            ],
          },
        ],
      };
      setRows(buildRowsFromPrlDetail(mock));
      setLoadedPrlId(prlId);
      message.success("PRL items loaded (mock)");
      return;
    }

    try {
      const result = await loadPrlDetail(
        { id: prlId, budgetType: "raw-material" },
        true,
      ).unwrap();
      const built = buildRowsFromPrlDetail(result.data);
      setRows(built);
      setLoadedPrlId(prlId);
      if (built.length === 0) {
        message.warning("PRL tidak memiliki item / child material");
      } else {
        message.success("PRL items loaded");
      }
    } catch (err) {
      message.error(getApiErrorMessage(err, "Gagal memuat item PRL"));
    }
  };

  const updateRow = (key: string, patch: Partial<BulkRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.quantity != null || patch.kanbanQty != null) {
          next.kanbanCount = computeKanbanCount(next.quantity, next.kanbanQty);
        }
        return next;
      }),
    );
  };

  const onGenerate = async () => {
    try {
      const values = await form.validateFields();
      const bulkTargetDate = values.targetDate as Dayjs | undefined;
      const defaultTarget = bulkTargetDate
        ? dayjs(bulkTargetDate).format("YYYY-MM-DD")
        : "";

      const editable = rows.filter((r) => !r.isHeader);
      if (!editable.length) {
        message.error("Load item PRL terlebih dahulu");
        return;
      }

      const missingTarget = editable.some(
        (r) => !(r.targetDate || defaultTarget),
      );
      if (missingTarget) {
        message.error("Isi target date untuk semua item");
        return;
      }

      if (!apiEnabled) {
        message.success("Bulk work order generated (mock)");
        router.push("/work-orders");
        return;
      }

      await createBulkWorkOrders({
        source_document_id: loadedPrlId || text(values.prlId),
        source_document_type: "PRL",
        wo_type: String(values.woType),
        items: editable.map((r) => ({
          source_line_id: r.prlItemId,
          item_uniq_code: r.uniq,
          part_name: r.partName,
          part_number: r.partNumber,
          uom: r.uom ?? "",
          quantity: Number(r.quantity ?? 0),
          kanban_qty: Number(r.kanbanQty ?? 0),
          kanban_count: Number(r.kanbanCount ?? 0),
          target_date: r.targetDate || defaultTarget,
        })),
        notes: note.trim() || undefined,
      }).unwrap();

      message.success("Bulk work order created successfully");
      router.push("/work-orders");
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
            <Button
              className="!rounded-lg"
              onClick={() => router.push("/work-orders")}
            >
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
          <div className="text-2xl font-bold text-gray-900">
            Create Bulk Work Order
          </div>
          <div className="text-sm text-gray-500">
            Retrieve items from a PRL. Quantity &amp; target date are editable,
            and all child materials are expanded automatically.
          </div>
        </div>
      </div>

      <Form form={form} layout="vertical">
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">
              Select PRL &amp; Date
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Choose a Production Requirement List and default target date
              (optional)
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="prlId"
                label="PRL (Production Requirement List)"
                rules={[{ required: true, message: "Pilih PRL" }]}
              >
                <Select
                  className="!rounded-lg"
                  placeholder="Select PRL"
                  showSearch
                  filterOption={false}
                  onSearch={setPrlSearch}
                  loading={prlsFetching}
                  options={prlOptions}
                  notFoundContent={prlsFetching ? "Loading..." : "No PRL found"}
                />
              </Form.Item>

              <Form.Item
                name="woType"
                label="Work Order Type"
                rules={[{ required: true, message: "Select work order type" }]}
              >
                <Select
                  className="!rounded-lg"
                  placeholder="Select type"
                  options={[
                    { label: "New", value: "New" },
                    { label: "Assembly", value: "Assembly" },
                    { label: "Additional", value: "Additional" },
                    { label: "Rework", value: "Rework" },
                  ] satisfies Array<{ label: string; value: WorkOrderType }>}
                />
              </Form.Item>

              <Form.Item
                name="targetDate"
                label="Default Target Date (optional)"
              >
                <DatePicker
                  className="!rounded-lg w-full"
                  placeholder="yyyy-mm-dd"
                  format="YYYY-MM-DD"
                />
              </Form.Item>

              <div className="flex items-end justify-end">
                <Button
                  className="!rounded-lg"
                  type="primary"
                  icon={<CloudDownloadOutlined />}
                  onClick={loadItemsFromPrl}
                  loading={prlDetailQuery.isFetching}
                >
                  Load PRL Items
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">
              PRL Items - Edit UNIQ &amp; Quantity
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Every UNIQ (parent &amp; child material) is expanded from the PRL.
              Edit quantity and target date before generating.
            </div>

            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
              1 UNIQ = 1 Kanban. Kanban count is auto-calculated from quantity
              (per {DEFAULT_KANBAN_QTY} units).
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-600 grid grid-cols-12 gap-3">
                <div className="col-span-2">UNIQ</div>
                <div className="col-span-3">Part Name</div>
                <div className="col-span-2">Part Number</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-1">Kanban</div>
                <div className="col-span-2">Target Date</div>
              </div>

              {rows.length ? (
                <div className="divide-y divide-gray-100">
                  {rows.map((r) =>
                    r.isHeader ? (
                      <div
                        key={r.key}
                        className="px-4 py-2 bg-gray-50/70 grid grid-cols-12 gap-3 items-center"
                      >
                        <div className="col-span-5 text-sm font-semibold text-gray-900">
                          {r.parentUniq}
                          <span className="ml-2 font-normal text-gray-500">
                            {r.partName}
                          </span>
                        </div>
                        <div className="col-span-4 text-xs text-gray-500">
                          {r.partNumber}
                        </div>
                        <div className="col-span-3 flex justify-end">
                          <Tag color="blue">{r.childCount} material</Tag>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={r.key}
                        className="px-4 py-3 grid grid-cols-12 gap-3 items-center"
                      >
                        <div className="col-span-2">
                          <div className="text-sm font-semibold text-gray-900">
                            {r.uniq}
                          </div>
                          {r.materialGrade ? (
                            <div className="text-xs text-gray-400">
                              {r.materialGrade}
                            </div>
                          ) : null}
                        </div>
                        <div className="col-span-3 text-sm text-gray-800">
                          {r.partName}
                        </div>
                        <div className="col-span-2 text-sm text-gray-700">
                          {r.partNumber}
                        </div>
                        <div className="col-span-2">
                          <InputNumber
                            className="!rounded-lg w-full"
                            min={0}
                            value={r.quantity}
                            onChange={(v) =>
                              updateRow(r.key, {
                                quantity: typeof v === "number" ? v : 0,
                              })
                            }
                          />
                        </div>
                        <div className="col-span-1 text-sm text-gray-800">
                          {r.kanbanCount}
                        </div>
                        <div className="col-span-2">
                          <DatePicker
                            className="!rounded-lg w-full"
                            placeholder="yyyy-mm-dd"
                            format="YYYY-MM-DD"
                            value={
                              r.targetDate
                                ? dayjs(r.targetDate, "YYYY-MM-DD")
                                : undefined
                            }
                            onChange={(val) => {
                              if (!val) {
                                updateRow(r.key, { targetDate: undefined });
                                return;
                              }
                              updateRow(r.key, {
                                targetDate: dayjs(val as Dayjs).format(
                                  "YYYY-MM-DD",
                                ),
                              });
                            }}
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="p-10 text-center text-sm text-gray-500">
                  No items loaded. Select a PRL and click “Load PRL Items”.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <div className="text-xs font-semibold text-green-800">
                Ready to Generate
              </div>
              <div className="text-xs text-green-700 mt-1">
                Total UNIQs: {totals.totalUniqs} | Total Kanbans:{" "}
                {totals.totalKanbans}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-700">
                Internal Note (optional)
              </div>
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
