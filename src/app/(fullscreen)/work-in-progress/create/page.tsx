"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { useGetInventoryKanbanSummaryQuery } from "@/lib/api/inventory/api";
import { useGetProcessesQuery, useGetTypeParametersQuery } from "@/lib/api/system-settings/api";
import {
  useGetWorkOrderByIdQuery,
  useGetWorkOrdersQuery,
} from "@/lib/api/work-orders/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { formatWorkOrderDisplayNumber } from "@/lib/utils/workOrder";
import { useCreateWipMutation } from "@/lib/api/wip/api";

type WipType = string;
type Process = string;

type WipEntry = {
  id: string;
  groupId: string;
  woId: string | number | null;
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

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const toText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const uniqueStrings = (values: Array<string | undefined>): string[] =>
  Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));

const parseProcessFlowNames = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return uniqueStrings(
      value.flatMap((item) => {
        if (typeof item === "string") return [item];
        if (!isRecord(item)) return [];
        return [
          toText(item.process_name),
          toText(item.processName),
          toText(item.process),
          toText(item.machine_name),
          toText(item.machineName),
        ];
      })
    );
  }

  if (isRecord(value)) {
    return parseProcessFlowNames(value.processes ?? value.process_flow ?? value.steps ?? value.items ?? []);
  }

  return [];
};

export default function CreateWorkInProgressPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const apiEnabled = Boolean(apiBaseUrl);
  const [createWip] = useCreateWipMutation();
  const [woId, setWoId] = useState<string | number | null>(null);
  const [entries, setEntries] = useState<WipEntry[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [form] = Form.useForm<WipFormValues>();

  const selectedWoNumber = Form.useWatch("woNumber", form);
  const selectedUniq = Form.useWatch("uniq", form);
  const selectedPackingNumber = Form.useWatch("packingNumber", form);

  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const bomIndex = useMemo(() => buildBomUniqIndex(bomTreeRes?.data ?? []), [bomTreeRes?.data]);

  const workOrdersQuery = useGetWorkOrdersQuery({ page: 1, limit: 200 }, { skip: !apiEnabled });
  const workOrders = workOrdersQuery.data?.items ?? [];

  const { data: processRecords = [] } = useGetProcessesQuery(undefined, { skip: !apiEnabled });
  const { data: typeParameterRecords = [] } = useGetTypeParametersQuery(undefined, { skip: !apiEnabled });
  const processNameOptions = useMemo(
    () =>
      uniqueStrings(
        processRecords.map((item) => (item.process_name ? String(item.process_name) : undefined))
      ),
    [processRecords]
  );

  const wipTypeOptions = useMemo(() => {
    const options = Array.from(
      new Map(
        typeParameterRecords
          .map((item) => {
            const typeName = String(item.type_name ?? "").trim();
            if (!typeName) return null;
            return [
              typeName,
              {
                label: typeName,
                value: typeName,
              },
            ] as const;
          })
          .filter(
            (item): item is readonly [string, { label: string; value: string }] => Boolean(item)
          )
      ).values()
    );

    if (options.length > 0) return options;

    return [

          
    ];
  }, [typeParameterRecords]);

  const defaultWipType = wipTypeOptions[0]?.value ?? "";

  const workOrderByNumber = useMemo(
    () => new Map(workOrders.map((record) => [record.wo_number, record] as const)),
    [workOrders]
  );

  const selectedWorkOrderSummary = selectedWoNumber ? workOrderByNumber.get(selectedWoNumber) : undefined;
  const selectedWorkOrderId = selectedWorkOrderSummary?.id ?? "";
  const selectedWorkOrderDetailQuery = useGetWorkOrderByIdQuery(selectedWorkOrderId, {
    skip: !apiEnabled || !selectedWorkOrderId,
  });

  const selectedWorkOrder = selectedWorkOrderDetailQuery.data ?? selectedWorkOrderSummary;
  const selectedWorkOrderItems = selectedWorkOrder?.items ?? [];
  const selectedWorkOrderResolvedId =
    toText(selectedWorkOrder?.id) ??
    toText(selectedWorkOrderSummary?.id) ??
    toText(selectedWorkOrderId);

  const inventorySummaryQuery = useGetInventoryKanbanSummaryQuery(
    { uniq_code: String(selectedUniq ?? "") },
    { skip: !apiEnabled || !selectedUniq }
  );
  const inventorySummary = inventorySummaryQuery.data?.data;

  const workOrderOptions = useMemo(
    () =>
      workOrders
        .filter((record) => Boolean(record.wo_number))
        .map((record) => ({
          label: formatWorkOrderDisplayNumber(record.wo_number),
          value: record.wo_number,
        })),
    [workOrders]
  );

  const uniqOptions = useMemo(() => {
    if (selectedWorkOrderItems.length > 0) {
      return Array.from(
        new Map(
          selectedWorkOrderItems
            .filter((item) => Boolean(item.item_uniq_code))
            .map((item) => {
              const uniq = item.item_uniq_code;
              const partName = item.part_name ?? bomIndex.partNameByUniq[uniq] ?? "";
              return [
                uniq,
                {
                  label: partName ? `${uniq} — ${partName}` : uniq,
                  value: uniq,
                },
              ] as const;
            })
        ).values()
      );
    }

    return bomIndex.options.map((option) => ({
      label: bomIndex.partNameByUniq[option.value]
        ? `${option.value} — ${bomIndex.partNameByUniq[option.value]}`
        : option.label,
      value: option.value,
    }));
  }, [bomIndex.options, bomIndex.partNameByUniq, selectedWorkOrderItems]);

  const packingOptions = useMemo(() => {
    const fromWorkOrder = Array.from(
      new Map(
        selectedWorkOrderItems
          .filter((item) => !selectedUniq || item.item_uniq_code === selectedUniq)
          .map((item) => {
            const packingNumber = item.kanban_number?.trim();
            if (!packingNumber) return null;
            return [
              packingNumber,
              {
                label: packingNumber,
                value: packingNumber,
              },
            ] as const;
          })
          .filter((item): item is readonly [string, { label: string; value: string }] => Boolean(item))
      ).values()
    );

    if (fromWorkOrder.length > 0) return fromWorkOrder;

    const bomPacking = selectedUniq ? bomIndex.packingNumberByUniq[selectedUniq] : undefined;
    return bomPacking
      ? [
          {
            label: bomPacking,
            value: bomPacking,
          },
        ]
      : [];
  }, [bomIndex.packingNumberByUniq, selectedUniq, selectedWorkOrderItems]);

  const selectedWorkOrderItem = useMemo(() => {
    const itemsByUniq = selectedWorkOrderItems.filter((item) => !selectedUniq || item.item_uniq_code === selectedUniq);

    if (selectedPackingNumber) {
      const exact = itemsByUniq.find((item) => item.kanban_number === selectedPackingNumber);
      if (exact) return exact;
    }

    return itemsByUniq[0];
  }, [selectedPackingNumber, selectedUniq, selectedWorkOrderItems]);

  const selectedProcessNames = useMemo(() => {
    const flowNames = parseProcessFlowNames(selectedWorkOrderItem?.process_flow_json);
    if (flowNames.length > 0) return flowNames;

    const directProcess = uniqueStrings([selectedWorkOrderItem?.process_name]);
    if (directProcess.length > 0) return directProcess;

    return [];
  }, [selectedWorkOrderItem?.process_flow_json, selectedWorkOrderItem?.process_name]);

  const processDisplayValue = selectedProcessNames.join(", ");
  const stockValue = Number(selectedWorkOrderItem?.quantity ?? 0);
  const stockToCompleteValue = Number(
    inventorySummary?.stock_to_complete_kanban ?? Math.max(0, stockValue - Number(inventorySummary?.stock_qty ?? 0))
  );
  const pcsPerKanbanValue = Number(inventorySummary?.kanban_pkg_qty ?? 0);

  useEffect(() => {
    setWoId(selectedWorkOrderResolvedId ?? null);
  }, [selectedWorkOrderResolvedId]);

  useEffect(() => {
    if (!form.getFieldValue("wipType")) {
      form.setFieldsValue({ wipType: defaultWipType });
    }
  }, [defaultWipType, form]);

  useEffect(() => {
    if (!selectedWoNumber) {
      form.setFieldsValue({
        uniq: undefined,
        packingNumber: undefined,
        process: undefined,
        stock: undefined,
        stockToCompleteKanban: undefined,
      });
      return;
    }

    if (selectedUniq && !uniqOptions.some((option) => option.value === selectedUniq)) {
      form.setFieldsValue({
        uniq: undefined,
        packingNumber: undefined,
        process: undefined,
        stock: undefined,
        stockToCompleteKanban: undefined,
      });
    }
  }, [form, selectedUniq, selectedWoNumber, uniqOptions]);

  useEffect(() => {
    if (!selectedUniq) {
      form.setFieldsValue({
        packingNumber: undefined,
        process: undefined,
        stock: undefined,
        stockToCompleteKanban: undefined,
      });
      return;
    }

    const nextValues: Partial<WipFormValues> = {
      process: processDisplayValue || undefined,
      stock: stockValue,
      stockToCompleteKanban: stockToCompleteValue,
    };

    if (!selectedPackingNumber || !packingOptions.some((option) => option.value === selectedPackingNumber)) {
      nextValues.packingNumber = packingOptions[0]?.value;
    }

    form.setFieldsValue(nextValues);
  }, [
    form,
    packingOptions,
    processDisplayValue,
    selectedPackingNumber,
    selectedUniq,
    stockToCompleteValue,
    stockValue,
  ]);

  const handleAddOrUpdate = async () => {
    try {
      const values = await form.validateFields();

      const groupId = editingGroupId ?? `wip-${Date.now()}`;
      const resolvedProcesses = selectedProcessNames.length
        ? selectedProcessNames
        : uniqueStrings([values.process]);

      if (!resolvedProcesses.length) {
        message.error("Process is not available for the selected work order item");
        return;
      }

      const resolvedWoNumber = String(values.woNumber ?? "").trim();
      const resolvedUniq = String(values.uniq ?? "").trim();
      const resolvedPackingNumber = String(values.packingNumber ?? "").trim();
      const resolvedStock = Number(values.stock ?? stockValue ?? 0);
      const resolvedStockToComplete = Number(values.stockToCompleteKanban ?? stockToCompleteValue ?? 0);
      const resolvedWipType = String(values.wipType ?? defaultWipType) as WipType;

      const nextEntries = resolvedProcesses.map((processName, index) => ({
        id: `${groupId}-${index}`,
        groupId,
        woId: selectedWorkOrderResolvedId ?? null,
        uniq: resolvedUniq || "-",
        woNumber: resolvedWoNumber || "-",
        packingNumber: resolvedPackingNumber || bomIndex.packingNumberByUniq[resolvedUniq] || "-",
        wipType: resolvedWipType,
        process: processName,
        stock: resolvedStock,
        stockToCompleteKanban: resolvedStockToComplete,
        pcsPerKanban: pcsPerKanbanValue,
      } satisfies WipEntry));

      if (editingGroupId) {
        setEntries((prev) => {
          const startIndex = prev.findIndex((entry) => entry.groupId === editingGroupId);
          const remaining = prev.filter((entry) => entry.groupId !== editingGroupId);
          if (startIndex < 0) return [...nextEntries, ...remaining];
          const updated = [...remaining];
          updated.splice(startIndex, 0, ...nextEntries);
          return updated;
        });
        message.success("Updated");
      } else {
        setEntries((prev) => [...nextEntries, ...prev]);
        message.success("Added");
      }

      setEditingGroupId(null);
      form.resetFields();
      form.setFieldsValue({ wipType: defaultWipType });
    } catch {
      // validation errors shown by antd
    }
  };

  const handleEditRow = (row: WipEntry) => {
    const groupedEntries = entries.filter((entry) => entry.groupId === row.groupId);
    const firstEntry = groupedEntries[0] ?? row;

    setEditingGroupId(row.groupId);
    setWoId(firstEntry.woId);
    form.setFieldsValue({
      uniq: firstEntry.uniq,
      woNumber: firstEntry.woNumber,
      packingNumber: firstEntry.packingNumber,
      wipType: firstEntry.wipType,
      process: groupedEntries.map((entry) => entry.process).join(", "),
      stock: firstEntry.stock,
      stockToCompleteKanban: firstEntry.stockToCompleteKanban,
    });
  };

  const handleDeleteRow = (row: WipEntry) => {
    Modal.confirm({
      title: "Delete WIP entry group?",
      content: `This will remove ${row.uniq} (${row.packingNumber}) and all generated process rows from the list.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: () => {
        setEntries((prev) => prev.filter((entry) => entry.groupId !== row.groupId));
        if (editingGroupId === row.groupId) {
          setEditingGroupId(null);
          form.resetFields();
          form.setFieldsValue({ wipType: defaultWipType });
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
    const payloadWoId =
      entries[0]?.woId ??
      woId ??
      selectedWorkOrderResolvedId ??
      (selectedWoNumber ? workOrderByNumber.get(selectedWoNumber)?.id : null);
    if (payloadWoId === null || payloadWoId === undefined || String(payloadWoId).trim() === "") {
      message.error("WO ID is required");
      return;
    }
    try {
      setIsSubmitting(true);
      const woNumber = entries[0]?.woNumber;
      if (!woNumber) {
        message.error("WO Number is required");
        return;
      }

      const grouped = new Map<string, WipEntry[]>();
      for (const entry of entries) {
        const key = `${entry.woNumber}__${entry.uniq}__${entry.packingNumber}__${entry.wipType}`;
        grouped.set(key, [...(grouped.get(key) ?? []), entry]);
      }

      const items = Array.from(grouped.values()).map((groupEntries) => {
        const first = groupEntries[0];
        const process_flow = groupEntries.map((e, index) => ({
            op_seq: (index + 1) * 10,
            machine_name: `${e.process} Station`,
            process_name: e.process,
          }));

        return {
          uniq: first.uniq,
          kanban_number: first.packingNumber,
          wip_type: first.wipType,
          uom: bomIndex.uomByUniq[first.uniq] || "Piece",
          stock: Number(first.stock ?? 0),
          stock_kanban: Number(first.pcsPerKanban ?? 0),
          process_flow,
        };
      });

      if (apiEnabled) {
        await createWip({
          wo_id: payloadWoId,
          wo_number: woNumber,
          items,
        }).unwrap();
      } else {
        console.log("WIP payload:", { wo_id: payloadWoId, wo_number: woNumber, items });
      }

      message.success("Saved");
      router.push("/work-in-progress");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to save WIP"));
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
      render: (v: number) => <span className="text-xs text-gray-700">{v} pcs</span>,
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
                <div className="text-xs text-gray-500">Select WO and UNIQ first, then process, stock, and kanban values fill automatically</div>
              </div>
              <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">Required</span>
            </div>

            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={{ wipType: defaultWipType }}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Form.Item label="Uniq" name="uniq" rules={[{ required: true, message: "Uniq is required" }]}>
                  <Select
                    placeholder="Select Uniq"
                    options={uniqOptions}
                    disabled={!selectedWoNumber && uniqOptions.length === 0}
                    loading={apiEnabled && (workOrdersQuery.isFetching || selectedWorkOrderDetailQuery.isFetching)}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>

                <Form.Item
                  label="Work Order Number"
                  name="woNumber"
                  rules={[{ required: true, message: "Work Order Number is required" }]}
                >
                  <Select
                    placeholder="Select WO"
                    options={workOrderOptions}
                    loading={apiEnabled && workOrdersQuery.isFetching}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>

                <Form.Item
                  label="Packing Number"
                  name="packingNumber"
                  rules={[{ required: true, message: "Packing Number is required" }]}
                >
                  <Select
                    placeholder="Select Packing"
                    options={packingOptions}
                    disabled={!selectedUniq}
                    loading={apiEnabled && selectedWorkOrderDetailQuery.isFetching}
                  />
                </Form.Item>

                <Form.Item
                  label="WIP Type"
                  name="wipType"
                  rules={[{ required: true, message: "WIP Type is required" }]}
                >
                  <Select
                    placeholder="Select Type"
                    options={wipTypeOptions}
                  />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <Form.Item
                  label="Process"
                  name="process"
                  rules={[{ required: true, message: "Process is required" }]}
                >
                  <Input disabled placeholder="Auto-filled from selected work order process flow" />
                </Form.Item>

                <Form.Item
                  label="Stock"
                  name="stock"
                  rules={[{ required: true, message: "Stock is required" }]}
                >
                  <InputNumber className="w-full" min={0} placeholder="Auto-filled from selected WO qty" disabled />
                </Form.Item>

                <Form.Item label="Stock to Complete Kanban" name="stockToCompleteKanban">
                  <Input disabled placeholder="Automatically filled." />
                </Form.Item>

                <div className="pb-[24px]">
                  <Button type="primary" className="w-full" onClick={handleAddOrUpdate}>
                    {editingGroupId ? "Update WIP" : "+ Add WIP"}
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
                locale={{ emptyText: "No WIP rows yet. Select a work order and add generated process rows." }}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
