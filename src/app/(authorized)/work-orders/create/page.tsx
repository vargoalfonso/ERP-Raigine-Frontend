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
import dayjs, { type Dayjs } from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { useGetProcessesQuery } from "@/lib/api/system-settings/api";
import {
  useCreateWorkOrderMutation,
  useGetWorkOrderUniqOptionsQuery,
} from "@/lib/api/work-orders/api";
import { useLazyGetInventoryKanbanSummaryQuery } from "@/lib/api/inventory/api";
import { useGetFinishedGoodParameterizedSummaryQuery } from "@/lib/api/finished-goods/api";

type WorkOrderType = "New" | "Additional" | "Rework" | "Assembly";

type UniqOption = {
  uniq: string;
  partName: string;
  partNumber?: string;
  model?: string;
  uom: string;
  processes: string[];
};

type UniqLine = {
  id: string;
  uniq?: string;
  partName?: string;
  partNumber?: string;
  model?: string;
  qty?: number;
  uom?: string;
  process?: string;
  kanbanNumber: string;
  targetStock?: number | null;
  stockQty?: number | null;
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
  const { TextArea } = Input;
  const apiEnabled = Boolean(apiBaseUrl);
  const [createWorkOrder, createWorkOrderState] = useCreateWorkOrderMutation();

  const uniqOptionsQuery = useGetWorkOrderUniqOptionsQuery(
    { limit: 200, sources: ["raw_material", "indirect", "subcon"] },
    { skip: !apiEnabled }
  );

  const [woNumber] = useState(() => nextWoNumber());
  const [lines, setLines] = useState<UniqLine[]>([{ id: "l-1", kanbanNumber: nextKanbanNumber(0) }]);
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: processRecords = [] } = useGetProcessesQuery(undefined, {
    skip: !apiEnabled,
  });
  const [getInventoryKanbanSummary] = useLazyGetInventoryKanbanSummaryQuery();
  const [requestedFinished, setRequestedFinished] = useState<{ id: string; uniq: string } | null>(null);
  const finishedQuery = useGetFinishedGoodParameterizedSummaryQuery(
    requestedFinished ? { uniq_code: requestedFinished.uniq } : (null as any),
    { skip: !apiEnabled || !requestedFinished }
  );

  const fallbackUniqOptions: UniqOption[] = [
    { uniq: "LV7-001", partName: "Engine Mount Assembly", uom: "pcs", processes: ["Cutting", "Welding", "QC"] },
    { uniq: "LV7-002", partName: "Engine Mount Base", uom: "pcs", processes: ["Milling", "QC"] },
    { uniq: "LV8-003", partName: "Suspension Arm", uom: "pcs", processes: ["Forging", "Machining", "QC"] },
  ];

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data]
  );

  const processNameOptions = useMemo(() => {
    const names = processRecords
      .map((item) => item.process_name)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(names));
  }, [processRecords]);

  const uniqOptions = useMemo<UniqOption[]>(() => {
    if (apiEnabled && uniqOptionsQuery.data?.length) {
      return uniqOptionsQuery.data.map((o) => ({
        uniq: o.uniq_code,
        partName: o.part_name ?? bomIndex.partNameByUniq[o.uniq_code] ?? "",
        partNumber: o.part_number ?? bomIndex.partNumberByUniq[o.uniq_code] ?? "",
        model: o.model ?? bomIndex.assemblyCodeByUniq[o.uniq_code] ?? "",
        uom: o.uom ?? "pcs",
        processes: processNameOptions,
      }));
    }

    if (!bomIndex.options.length) return fallbackUniqOptions;
    return bomIndex.options.map((option) => ({
      uniq: option.value,
      partName: bomIndex.partNameByUniq[option.value] ?? "",
      partNumber: bomIndex.partNumberByUniq[option.value] ?? "",
      model: bomIndex.assemblyCodeByUniq[option.value] ?? "",
      uom: "pcs",
      processes: processNameOptions,
    }));
  }, [apiEnabled, bomIndex, processNameOptions, uniqOptionsQuery.data]);

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
      partNumber: found?.partNumber,
      model: found?.model,
      uom: found?.uom,
      process: undefined,
    });
    // try to find BOM node to extract process routes and BOM stock
    const findNode = (nodes: any[] | undefined): any | null => {
      if (!Array.isArray(nodes)) return null;
      for (const n of nodes) {
        const nodeUniq = (n?.uniq_code ?? n?.uniq ?? n?.uniqCode ?? n?.uniq_code) as any;
        if (String(nodeUniq)?.trim() === String(uniq)) return n;
        const child = findNode(Array.isArray(n?.children) ? n.children : undefined);
        if (child) return child;
      }
      return null;
    };
    const bomData = bomTreeRes?.data;
    const bomArray = Array.isArray(bomData)
      ? bomData
      : Array.isArray((bomData as any)?.items)
      ? (bomData as any).items
      : [];
    const bomNode = findNode(bomArray);
    if (bomNode) {
      const nodeProcessRoutes = Array.isArray(bomNode.process_routes)
        ? bomNode.process_routes
        : Array.isArray(bomNode.processRoutes)
        ? bomNode.processRoutes
        : [];
      let firstProcessName: string | null = null;
      if (nodeProcessRoutes.length) {
        firstProcessName = (nodeProcessRoutes[0]?.process_name ?? nodeProcessRoutes[0]?.processName ?? null) as string | null;
        if (!firstProcessName) {
          const pid = nodeProcessRoutes[0]?.process_id ?? nodeProcessRoutes[0]?.processId ?? nodeProcessRoutes[0]?.process ?? null;
          if (pid) {
            const pidStr = String(pid);
            const foundProc = processRecords.find((p) => String(p.id) === pidStr || String(p.process_code) === pidStr);
            if (foundProc) firstProcessName = foundProc.process_name ?? null;
          }
        }
      }
      if (firstProcessName) updateLine(id, { process: firstProcessName });
      const nodeStock = (bomNode.stock_qty ?? bomNode.stock ?? bomNode.stockQty ?? bomNode.quantity ?? null) as any;
      const stockFromBom = typeof nodeStock === "number" ? nodeStock : (typeof nodeStock === "string" && nodeStock.trim() ? Number(nodeStock) : null);
      updateLine(id, { stockQty: typeof stockFromBom === "number" ? stockFromBom : 0 });
    }
    // fetch kanban standard and finished goods summary for this uniq
    if (apiEnabled && uniq) {
      // trigger kanban fetch
      void (async () => {
        try {
          const kanbanPromise = getInventoryKanbanSummary({ uniq_code: uniq }).unwrap();
          const kanbanRes = await kanbanPromise.catch(() => null);
          const kanbanData = kanbanRes?.data ?? null;
          const kanbanPkg = kanbanData?.kanban_pkg_qty ?? null;
          const safety = kanbanData?.safety_stock_qty ?? null;
          const targetFromKanban = kanbanPkg ?? safety ?? null;
          if (targetFromKanban !== null && typeof targetFromKanban === "number") {
            updateLine(id, { targetStock: targetFromKanban });
          }
        } catch (e) {
          // ignore errors
        }
      })();

      // request finished goods summary via hook; effect will apply it to the line
      setRequestedFinished({ id, uniq });
    }
  };

  // apply finishedQuery result to the requested line when available
  useEffect(() => {
    if (!requestedFinished) return;
    if (finishedQuery.isError) {
      setRequestedFinished(null);
      return;
    }
    if (finishedQuery.data) {
      const finishedData = finishedQuery.data;
      const targetFromFinished = (finishedData as any)?.target_stock_qty ?? (finishedData as any)?.targetStockQty ?? null;
      const stockQty = (finishedData as any)?.stock_qty ?? (finishedData as any)?.stockQty ?? null;
      updateLine(requestedFinished.id, {
        targetStock: typeof targetFromFinished === "number" ? targetFromFinished : null,
        stockQty: typeof stockQty === "number" ? stockQty : null,
      });
      setRequestedFinished(null);
    }
  }, [finishedQuery.data, finishedQuery.isError, requestedFinished]);

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

      if (!apiEnabled) {
        message.success("Work order created (mock)");
        router.push("/work-orders");
        return;
      }

      const targetDate = values.woTargetDate as Dayjs;
      const createdDate = values.woCreatedDate as Dayjs;
      const created = await createWorkOrder({
        wo_type: String(values.woType),
        reference_wo: values.woReference ? String(values.woReference) : null,
        created_date: dayjs(createdDate).format("YYYY-MM-DD"),
        target_date: dayjs(targetDate).format("YYYY-MM-DD"),
        items: lines.map((line) => ({
          item_uniq_code: String(line.uniq ?? "").trim(),
          quantity: Number(line.qty ?? 0),
          uom: String(line.uom ?? "pcs"),
          process_name: String(line.process ?? ""),
        })),
        notes: values.woNotes ? String(values.woNotes) : null,
      }).unwrap();

      message.success("Work order created successfully");
      if (created.id) {
        router.push(`/work-orders/detail/${encodeURIComponent(created.id)}`);
        return;
      }

      router.push("/work-orders");

      // values + lines are available here if later you want persistence.
      void values;
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) {
        return;
      }
      if (err) {
        message.error(getApiErrorMessage(err, "Failed to create work order"));
      }
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
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<SaveOutlined />}
              onClick={onCreate}
              loading={createWorkOrderState.isLoading}
            >
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

              <Form.Item
                name="woCreatedDate"
                label="Created Date"
                rules={[{ required: true, message: "Select created date" }]}
                initialValue={dayjs()}
              >
                <DatePicker className="!rounded-lg w-full" placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
              </Form.Item>

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

              <div className="md:col-span-2">
                <Form.Item name="woNotes" label="Notes">
                  <TextArea className="!rounded-lg" rows={3} placeholder="WO harian shift 1" />
                </Form.Item>
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
                  const processOptions = (selectedUniq?.processes.length ? selectedUniq.processes : processNameOptions).map((p) => ({ label: p, value: p }));

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
                        <Input className="!rounded-lg" value={l.partName} placeholder="Auto-filled from BOM" disabled />
                        {l.partNumber || l.model ? (
                          <div className="mt-1 text-[11px] text-gray-400">
                            {[l.partNumber ? `Part No: ${l.partNumber}` : "", l.model ? `Model: ${l.model}` : ""]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        ) : null}
                      </div>
                      <div className="col-span-1">
                        <InputNumber
                          className="!rounded-lg w-full"
                          placeholder="Qty"
                          min={0}
                          value={l.qty}
                          onChange={(v) => updateLine(l.id, { qty: typeof v === "number" ? v : undefined })}
                        />
                        <div className="mt-1 text-[11px] text-gray-500">
                          <div>Target Stock: {l.targetStock !== undefined && l.targetStock !== null ? String(l.targetStock) : "-"}</div>
                          <div>Stock Qty: {l.stockQty !== undefined && l.stockQty !== null ? String(l.stockQty) : "0"}</div>
                        </div>
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
                          disabled={!l.uniq || !processOptions.length}
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
