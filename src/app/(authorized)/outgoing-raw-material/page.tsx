"use client";

import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";

import { apiBaseUrl } from "@/lib/api/instance";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { mockBomTree } from "@/lib/mock/bomTree";
import {
  useCreateOutgoingRawMaterialMutation,
  useDeleteOutgoingRawMaterialMutation,
  useGetAllOutgoingRawMaterialQuery,
  useUpdateOutgoingRawMaterialMutation,
} from "@/lib/api/outgoing-raw-material/api";
import { generateNextWorkOrderNumber } from "@/lib/utils/workOrder";

type ReasonOption =
  | "Production Use"
  | "Quality Testing"
  | "Sample Request"
  | "Rework"
  | "Maintenance"
  | "Others";

type Unit = "Kg" | "Pcs" | "Box" | "Pallet" | "Roll" | "Meter";

type OutgoingRow = {
  id: string;
  transactionId: string;
  date: string;
  uniq?: string;
  rmCode: string;
  rmName: string;
  packingList: string;
  qtyOutKg: number;
  stockBeforeKg: number;
  stockAfterKg: number;
  unit: Unit;
  reason: ReasonOption;
  requestedBy: string;
  approvedBy: string;
  destination: string;
  purpose: string;
  workOrder: string;
  remarks?: string;
};

type OutgoingApiRow = {
  id: string;
  date: string;
  uniq: string;
  partNumber: string;
  partName: string;
  warehouseCode: string;
  quantity: number;
  unit: string;
  referenceNo: string;
  reason?: ReasonOption;
  purpose?: string;
  workOrder?: string;
  destination?: string;
  remarks?: string;
  notes?: string;
};

const initialRows: OutgoingRow[] = [
  {
    id: "1",
    transactionId: "OUT-RM-001",
    date: "2024-12-16",
    uniq: "LV7-001-A",
    rmCode: "MB-001-LV7",
    rmName: "Main Bracket",
    packingList: "PL-345678",
    qtyOutKg: 150,
    stockBeforeKg: 500,
    stockAfterKg: 350,
    unit: "Kg",
    reason: "Production Use",
    requestedBy: "John Doe",
    approvedBy: "Manager A",
    destination: "Production Line A",
    purpose: "Work Order WO-110226-001",
    workOrder: "WO-110226-001",
  },
  {
    id: "2",
    transactionId: "OUT-RM-002",
    date: "2024-12-15",
    uniq: "LV7-001-B",
    rmCode: "RI-002-LV7",
    rmName: "Rubber Insulator",
    packingList: "PL-112233",
    qtyOutKg: 75,
    stockBeforeKg: 300,
    stockAfterKg: 225,
    unit: "Kg",
    reason: "Quality Testing",
    requestedBy: "Jane Smith",
    approvedBy: "Manager A",
    destination: "QC Lab",
    purpose: "Quality Testing",
    workOrder: "WO-110226-002",
  },
  {
    id: "3",
    transactionId: "OUT-RM-003",
    date: "2024-12-14",
    uniq: "LV7-001-C",
    rmCode: "BA-003-LV7",
    rmName: "Bolt Assembly",
    packingList: "PL-998877",
    qtyOutKg: 200,
    stockBeforeKg: 800,
    stockAfterKg: 600,
    unit: "Kg",
    reason: "Production Use",
    requestedBy: "Mike Johnson",
    approvedBy: "Manager A",
    destination: "Production Line B",
    purpose: "Work Order WO-110226-003",
    workOrder: "WO-110226-003",
  },
  {
    id: "4",
    transactionId: "OUT-RM-004",
    date: "2024-12-14",
    uniq: "LV8-002",
    rmCode: "SA-002-LV8",
    rmName: "Suspension Arm",
    packingList: "PL-556677",
    qtyOutKg: 50,
    stockBeforeKg: 250,
    stockAfterKg: 200,
    unit: "Kg",
    reason: "Sample Request",
    requestedBy: "Sarah Lee",
    approvedBy: "Manager A",
    destination: "R&D",
    purpose: "Sample Request",
    workOrder: "WO-110226-004",
  },
  {
    id: "5",
    transactionId: "OUT-RM-005",
    date: "2024-12-14",
    uniq: "LV9-003",
    rmCode: "BRA-003-LV9",
    rmName: "Brake Assembly",
    packingList: "PL-223344",
    qtyOutKg: 100,
    stockBeforeKg: 650,
    stockAfterKg: 550,
    unit: "Kg",
    reason: "Rework",
    requestedBy: "Tom Wilson",
    approvedBy: "Manager A",
    destination: "Rework Area",
    purpose: "Rework",
    workOrder: "WO-110226-005",
  },
];

const reasonOptions: ReasonOption[] = [
  "Production Use",
  "Quality Testing",
  "Sample Request",
  "Rework",
  "Maintenance",
  "Others",
];

const unitOptions: Unit[] = ["Kg", "Pcs", "Box", "Pallet", "Roll", "Meter"];

type MaterialType = "Raw Material" | "Indirect Raw Material" | "SubCon" | "Finished Goods";

const materialTypeOptions: MaterialType[] = [
  "Raw Material",
  "Indirect Raw Material",
  "SubCon",
  "Finished Goods",
];

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object";

const classifyBomUniqs = (tree: unknown) => {
  const leaf = new Set<string>();
  const parent = new Set<string>();

  const visit = (node: unknown) => {
    if (!isRecord(node)) return;
    const uniq = typeof node.uniq === "string" ? node.uniq.trim() : "";
    const children = (node as { children?: unknown }).children;
    const hasChildren = Array.isArray(children) && children.length > 0;
    if (uniq) {
      if (hasChildren) parent.add(uniq);
      else leaf.add(uniq);
    }
    if (Array.isArray(children)) for (const c of children) visit(c);
  };

  if (Array.isArray(tree)) for (const n of tree) visit(n);
  else visit(tree);

  return {
    leafUniqs: Array.from(leaf).sort((a, b) => a.localeCompare(b)),
    parentUniqs: Array.from(parent).sort((a, b) => a.localeCompare(b)),
  };
};

type OutgoingFormValues = {
  materialType: MaterialType;
  uniq: string;
  packingList: string;
  rmCode: string;
  rmName: string;
  currentStock: number;
  unit: Unit;
  qtyOut: number;
  reason: string;
  purpose?: string;
  workOrder?: string;
  destination?: string;
  remarks?: string;
};

type OutgoingApiFormValues = {
  materialType: MaterialType;
  uniq: string;
  warehouseCode: string;
  quantity: number;
  unit: string;
  referenceNo: string;
  reason: ReasonOption;
  purpose?: string;
  workOrder?: string;
  destination?: string;
  remarks?: string;
};

const parseNotes = (notes: string | undefined) => {
  const result: Partial<Pick<OutgoingApiRow, "reason" | "purpose" | "workOrder" | "destination" | "remarks">> = {};
  if (!notes) return result;

  const lines = String(notes)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!value) continue;

    if (key === "reason") result.reason = value as ReasonOption;
    if (key === "purpose") result.purpose = value;
    if (key === "work_order" || key === "workorder" || key === "work order") result.workOrder = value;
    if (key === "destination") result.destination = value;
    if (key === "remarks") result.remarks = value;
  }

  return result;
};

const buildNotes = (v: {
  reason?: string;
  purpose?: string;
  workOrder?: string;
  destination?: string;
  remarks?: string;
}) => {
  const lines = [
    v.reason ? `reason: ${v.reason}` : "",
    v.purpose ? `purpose: ${v.purpose}` : "",
    v.workOrder ? `work_order: ${v.workOrder}` : "",
    v.destination ? `destination: ${v.destination}` : "",
    v.remarks ? `remarks: ${v.remarks}` : "",
  ].filter(Boolean);
  return lines.join("\n");
};

export default function OutgoingRawMaterialPage() {
  const useApi = Boolean(apiBaseUrl);

  const [rows, setRows] = useState<OutgoingRow[]>(initialRows);
  const [reasonFilter, setReasonFilter] = useState<ReasonOption | "ALL">("ALL");
  const [trxOpen, setTrxOpen] = useState(false);
  const [form] = Form.useForm<OutgoingFormValues>();
  const [apiForm] = Form.useForm<OutgoingApiFormValues>();

  const [currentPage] = useState(1);
  const [pageSize] = useState(100);

  const {
    data: bomTreeRes,
    isFetching: bomFetching,
    isSuccess: bomSuccess,
    isError: bomError,
  } = useGetBomTreeQuery(undefined, { skip: !useApi });

  const bomSource = useMemo(() => {
    if (!useApi) return mockBomTree;

    const apiTree = bomTreeRes?.data;
    const hasApiTree = Array.isArray(apiTree) && apiTree.length > 0;
    if (hasApiTree) return apiTree;

    // If API is enabled but BOM endpoint fails / returns empty, keep UX working.
    if (bomError || (bomSuccess && !hasApiTree)) return mockBomTree;

    // While loading, keep empty and show loading state in Select.
    return [];
  }, [bomError, bomSuccess, bomTreeRes?.data, useApi]);

  const bomIndex = useMemo(() => buildBomUniqIndex(bomSource), [bomSource]);
  const bomUniqGroups = useMemo(() => classifyBomUniqs(bomSource), [bomSource]);

  const uniqOptionsByType = useMemo(() => {
    const toOptions = (uniqs: string[]) => uniqs.map((u) => ({ label: u, value: u }));

    return {
      finishedGoods: toOptions(bomUniqGroups.parentUniqs),
      materials: toOptions(bomUniqGroups.leafUniqs),
    };
  }, [bomUniqGroups.leafUniqs, bomUniqGroups.parentUniqs]);

  const getUniqOptionsForType = (t: MaterialType | undefined) => {
    if (t === "Finished Goods") return uniqOptionsByType.finishedGoods;
    return uniqOptionsByType.materials;
  };

  const {
    data: apiRows,
    isSuccess: apiSuccess,
    isFetching: apiFetching,
    refetch: refetchApiRows,
  } = useGetAllOutgoingRawMaterialQuery(
    { currentPage, pageSize },
    { skip: !useApi, refetchOnMountOrArgChange: true }
  );

  const [createOutgoing, { isLoading: creating }] = useCreateOutgoingRawMaterialMutation();
  const [deleteOutgoing, { isLoading: deleting }] = useDeleteOutgoingRawMaterialMutation();
  const [updateOutgoing, { isLoading: updating }] = useUpdateOutgoingRawMaterialMutation();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMode, setDetailMode] = useState<"mock" | "api">("mock");
  const [detailRow, setDetailRow] = useState<OutgoingRow | null>(null);
  const [detailApiRow, setDetailApiRow] = useState<OutgoingApiRow | null>(null);

  const [editApiOpen, setEditApiOpen] = useState(false);
  const [editingApiRow, setEditingApiRow] = useState<OutgoingApiRow | null>(null);
  const [editApiForm] = Form.useForm<OutgoingApiFormValues>();
  const editApiMaterialType = Form.useWatch("materialType", editApiForm) as
    | MaterialType
    | undefined;

  const watchedUniq = Form.useWatch("uniq", apiForm);
  const watchedMockUniq = Form.useWatch("uniq", form);
  const watchedTypeApi = Form.useWatch("materialType", apiForm) as MaterialType | undefined;
  const watchedTypeMock = Form.useWatch("materialType", form) as MaterialType | undefined;

  const data = useMemo(() => {
    if (reasonFilter === "ALL") return rows;
    return rows.filter((r) => r.reason === reasonFilter);
  }, [reasonFilter, rows]);

  const apiData: OutgoingApiRow[] = useMemo(() => {
    if (!useApi || !apiSuccess) return [];

    const raw = apiRows?.data ?? [];
    const toTime = (value: string | undefined): number => {
      if (!value) return 0;
      const t = new Date(value).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    const sorted = [...raw].sort((a, b) => {
      const bt = toTime(b.created_at) || toTime(b.updated_at);
      const at = toTime(a.created_at) || toTime(a.updated_at);
      if (bt !== at) return bt - at;
      return String(b.id).localeCompare(String(a.id));
    });

    return sorted.map((r) => {
      const uniq = String(r.uniq ?? "");
      const partNumber = bomIndex.partNumberByUniq[uniq] ?? "";
      const partName = bomIndex.partNameByUniq[uniq] ?? String(r.item_name ?? "");
      const parsed = parseNotes(r.notes);
      const date = String(r.date ?? "") || String(r.created_at ?? "").slice(0, 10) || "-";

      return {
        id: String(r.id ?? ""),
        date,
        uniq,
        partNumber,
        partName,
        warehouseCode: String(r.warehouse_code ?? ""),
        quantity: Number(r.quantity ?? 0),
        unit: String(r.unit_measurement ?? ""),
        referenceNo: String(r.reference_no ?? ""),
        notes: String(r.notes ?? ""),
        reason: parsed.reason,
        purpose: parsed.purpose,
        workOrder: parsed.workOrder,
        destination: parsed.destination,
        remarks: parsed.remarks,
      };
    });
  }, [apiRows?.data, apiSuccess, bomIndex.partNameByUniq, bomIndex.partNumberByUniq, useApi]);

  const filteredApiData = useMemo(() => {
    if (reasonFilter === "ALL") return apiData;
    return apiData.filter((r) => r.reason === reasonFilter);
  }, [apiData, reasonFilter]);

  const openTrx = () => {
    setTrxOpen(true);
    const wo = generateNextWorkOrderNumber();
    if (useApi) {
      apiForm.setFieldsValue({
        materialType: "Raw Material",
        unit: "Kg",
        warehouseCode: "WH-001",
        quantity: 0,
        workOrder: wo,
        purpose: `Work Order ${wo}`,
        reason: "Production Use",
        referenceNo: "",
      });
      return;
    }

    form.setFieldsValue({
      materialType: "Raw Material",
      unit: "Kg",
      currentStock: 0,
      qtyOut: 0,
      workOrder: wo,
      purpose: `Work Order ${wo}`,
      reason: "Production Use",
    });
  };

  const closeTrx = () => {
    setTrxOpen(false);
    form.resetFields();
    apiForm.resetFields();
  };

  const handleProcessApi = async () => {
    try {
      const values = await apiForm.validateFields();

      const today = new Date().toISOString().slice(0, 10);
      const uniq = String(values.uniq ?? "");
      const itemName = bomIndex.partNameByUniq[uniq] || bomIndex.assemblyCodeByUniq[uniq] || "";

      const notes = buildNotes({
        reason: values.reason,
        purpose: values.purpose,
        workOrder: values.workOrder,
        destination: values.destination,
        remarks: values.remarks,
      });

      await createOutgoing({
        uniq,
        item_name: itemName,
        warehouse_code: values.warehouseCode,
        quantity: Number(values.quantity ?? 0),
        unit_measurement: values.unit,
        date: today,
        reference_no: values.referenceNo,
        notes,
      }).unwrap();

      message.success("Outgoing transaction created");
      closeTrx();
      refetchApiRows();
    } catch (err) {
      message.error("Failed to create outgoing transaction");
      return;
    }
  };

  const handleProcessMock = async () => {
    const values = await form.validateFields();

    const now = new Date();
    const date = now.toISOString().slice(0, 10);

    const nextId = String(rows.length + 1);
    const txNumber = `OUT-RM-${String(rows.length + 1).padStart(3, "0")}`;

    const stockBefore = Number(values.currentStock ?? 0);
    const qtyOut = Number(values.qtyOut ?? 0);
    const stockAfter = Math.max(0, stockBefore - qtyOut);

    const uniq = String(values.uniq ?? "");
    const rmCode = bomIndex.partNumberByUniq[uniq] || values.rmCode;
    const rmName = bomIndex.partNameByUniq[uniq] || values.rmName;

    const nextRow: OutgoingRow = {
      id: nextId,
      transactionId: txNumber,
      date,
      uniq,
      rmCode,
      rmName,
      packingList: values.packingList,
      qtyOutKg: qtyOut,
      stockBeforeKg: stockBefore,
      stockAfterKg: stockAfter,
      unit: values.unit,
      reason: (values.reason as ReasonOption) ?? "Production Use",
      requestedBy: "Admin PPIC",
      approvedBy: "Manager A",
      destination: values.destination || "-",
      purpose: values.purpose || "-",
      workOrder: values.workOrder || "-",
      remarks: values.remarks,
    };

    setRows((prev) => [nextRow, ...prev]);
    message.success("Outgoing transaction created");
    closeTrx();
  };

  const openDetail = (row: OutgoingRow) => {
    setDetailMode("mock");
    setDetailApiRow(null);
    setDetailRow(row);
    setDetailOpen(true);
  };

  const openDetailApi = (row: OutgoingApiRow) => {
    setDetailMode("api");
    setDetailRow(null);
    setDetailApiRow(row);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailRow(null);
    setDetailApiRow(null);
  };

  const openEditApi = (row: OutgoingApiRow) => {
    setEditingApiRow(row);
    editApiForm.setFieldsValue({
      materialType: "Raw Material",
      uniq: row.uniq,
      warehouseCode: row.warehouseCode,
      quantity: row.quantity,
      unit: (row.unit as Unit) ?? "Kg",
      referenceNo: row.referenceNo,
      reason: (row.reason as ReasonOption) ?? "Production Use",
      purpose: row.purpose,
      workOrder: row.workOrder,
      destination: row.destination,
      remarks: row.remarks,
    });
    setEditApiOpen(true);
  };

  const closeEditApi = () => {
    setEditApiOpen(false);
    setEditingApiRow(null);
    editApiForm.resetFields();
  };

  const saveEditApi = async () => {
    if (!editingApiRow) return;
    try {
      const values = await editApiForm.validateFields();
      const uniq = String(values.uniq ?? "");
      const itemName = bomIndex.partNameByUniq[uniq] || bomIndex.assemblyCodeByUniq[uniq] || "";

      const notes = buildNotes({
        reason: values.reason,
        purpose: values.purpose,
        workOrder: values.workOrder,
        destination: values.destination,
        remarks: values.remarks,
      });

      await updateOutgoing({
        id: editingApiRow.id,
        body: {
          uniq,
          item_name: itemName,
          warehouse_code: values.warehouseCode,
          quantity: Number(values.quantity ?? 0),
          unit_measurement: values.unit,
          reference_no: values.referenceNo,
          notes,
        },
      }).unwrap();

      message.success("Updated");
      closeEditApi();
      refetchApiRows();
    } catch (_err) {
      message.error("Failed to update transaction");
    }
  };

  const handleDeleteApi = async (id: string) => {
    try {
      await deleteOutgoing(id).unwrap();
      message.success("Deleted");
      refetchApiRows();
      if (detailMode === "api" && detailApiRow?.id === id) closeDetail();
    } catch (err) {
      message.error("Failed to delete transaction");
      return;
    }
  };

  const columns: ColumnsType<OutgoingRow> = [
    {
      title: "Transaction ID",
      dataIndex: "transactionId",
      key: "transactionId",
      width: 140,
      render: (v: string) => <span className="font-medium text-gray-900">{v}</span>,
    },
    { title: "Date", dataIndex: "date", key: "date", width: 120 },
    {
      title: "RM Info",
      dataIndex: "rmName",
      key: "rmInfo",
      width: 260,
      render: (_: unknown, r: OutgoingRow) => (
        <div className="text-gray-800">
          <div className="font-medium">{r.rmCode}</div>
          <div className="text-gray-500">{r.rmName}</div>
        </div>
      ),
    },
    {
      title: "Qty Out",
      dataIndex: "qtyOutKg",
      key: "qtyOutKg",
      width: 110,
      align: "right",
      render: (_: number, r: OutgoingRow) => (
        <span className="text-red-600 font-medium">- {r.qtyOutKg} {r.unit}</span>
      ),
    },
    {
      title: "Stock Before",
      dataIndex: "stockBeforeKg",
      key: "stockBeforeKg",
      width: 120,
      align: "right",
      render: (_: number, r: OutgoingRow) => `${r.stockBeforeKg} ${r.unit}`,
    },
    {
      title: "Stock After",
      dataIndex: "stockAfterKg",
      key: "stockAfterKg",
      width: 110,
      align: "right",
      render: (_: number, r: OutgoingRow) => `${r.stockAfterKg} ${r.unit}`,
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      width: 140,
      render: (v: ReasonOption) => (
        <Tag className="bg-blue-50 text-blue-700 border-blue-100">{v}</Tag>
      ),
    },
    { title: "Requested By", dataIndex: "requestedBy", key: "requestedBy", width: 140 },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      fixed: "right",
      render: (_: unknown, r: OutgoingRow) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          className="text-gray-500"
          onClick={() => openDetail(r)}
        />
      ),
    },
  ];

  const apiColumns: ColumnsType<OutgoingApiRow> = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 120,
    },
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      width: 150,
      render: (v: string) => <Tag className="bg-slate-50 text-slate-700 border-slate-200">{v || "-"}</Tag>,
    },
    {
      title: "RM Info",
      key: "rmInfo",
      width: 280,
      render: (_: unknown, r: OutgoingApiRow) => (
        <div className="text-gray-800">
          <div className="font-medium">{r.partNumber || "-"}</div>
          <div className="text-gray-500">{r.partName || "-"}</div>
        </div>
      ),
    },
    {
      title: "Warehouse",
      dataIndex: "warehouseCode",
      key: "warehouseCode",
      width: 140,
      render: (v: string) => v || "-",
    },
    {
      title: "Qty Out",
      key: "quantity",
      width: 130,
      align: "right",
      render: (_: unknown, r: OutgoingApiRow) => (
        <span className="text-red-600 font-medium">- {r.quantity} {r.unit || ""}</span>
      ),
    },
    {
      title: "Reference",
      dataIndex: "referenceNo",
      key: "referenceNo",
      width: 160,
      render: (v: string) => v || "-",
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      width: 160,
      render: (v: ReasonOption | undefined) =>
        v ? <Tag className="bg-blue-50 text-blue-700 border-blue-100">{v}</Tag> : "-",
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: OutgoingApiRow) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            type="text"
            icon={<EyeOutlined />}
            className="text-gray-500"
            onClick={() => openDetailApi(r)}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditApi(r)}
            disabled={updating}
          />
          <Popconfirm
            title="Delete transaction?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDeleteApi(r.id)}
            disabled={deleting}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={deleting}
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <Modal
        title="Edit Outgoing Transaction"
        open={editApiOpen}
        onCancel={closeEditApi}
        onOk={saveEditApi}
        okButtonProps={{ loading: updating }}
        destroyOnClose
      >
        <Form form={editApiForm} layout="vertical">
          <Form.Item name="materialType" label="Material Type" rules={[{ required: true }]}>
            <Select options={materialTypeOptions.map((t) => ({ label: t, value: t }))} />
          </Form.Item>

          <Form.Item name="uniq" label="UNIQ" rules={[{ required: true }]}>
            <Select
              showSearch
              loading={useApi && bomFetching}
              options={getUniqOptionsForType(editApiMaterialType)}
            />
          </Form.Item>

          <Form.Item name="warehouseCode" label="Warehouse Code" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={0} />
          </Form.Item>

          <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
            <Select options={unitOptions.map((u) => ({ label: u, value: u }))} />
          </Form.Item>

          <Form.Item name="referenceNo" label="Reference No" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Select options={reasonOptions.map((r) => ({ label: r, value: r }))} />
          </Form.Item>

          <Form.Item name="purpose" label="Purpose">
            <Input />
          </Form.Item>

          <Form.Item name="workOrder" label="Work Order">
            <Input />
          </Form.Item>

          <Form.Item name="destination" label="Destination">
            <Input />
          </Form.Item>

          <Form.Item name="remarks" label="Remarks">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div>
            <div className="text-sm font-bold text-slate-900">
              {detailMode === "mock"
                ? `Outgoing RM Transaction - ${detailRow?.transactionId ?? ""}`
                : `Outgoing RM Transaction - ${detailApiRow?.id ?? ""}`}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Complete information about this outgoing transaction</div>
          </div>
        }
        open={detailOpen}
        onCancel={closeDetail}
        footer={null}
        width={560}
        destroyOnClose
      >
        {detailMode === "mock" && detailRow && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Transaction Date</div>
                <div className="text-sm text-slate-900 mt-1">{detailRow.date}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Reason</div>
                <Tag className="!mt-1 !rounded-md !border-blue-200 !bg-blue-600 !text-white">{detailRow.reason}</Tag>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Raw Material Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">RM Code</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.rmCode}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">RM Name</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.rmName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Packing List</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.packingList}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Transaction Details</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Quantity Out</div>
                  <div className="text-sm font-semibold text-red-600 mt-1">- {detailRow.qtyOutKg} {detailRow.unit}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Purpose</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.purpose}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Stock Before</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.stockBeforeKg} {detailRow.unit}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Stock After</div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">{detailRow.stockAfterKg} {detailRow.unit}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Destination</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.destination}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Work Order</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.workOrder}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Approval Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Requested By</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.requestedBy}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Approved By</div>
                  <div className="text-sm text-slate-900 mt-1">{detailRow.approvedBy}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {detailMode === "api" && detailApiRow && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Transaction Date</div>
                <div className="text-sm text-slate-900 mt-1">{detailApiRow.date}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Reason</div>
                {detailApiRow.reason ? (
                  <Tag className="!mt-1 !rounded-md !border-blue-200 !bg-blue-600 !text-white">{detailApiRow.reason}</Tag>
                ) : (
                  <div className="text-sm text-slate-900 mt-1">-</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Raw Material Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">UNIQ</div>
                  <div className="text-sm text-slate-900 mt-1">{detailApiRow.uniq || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Warehouse</div>
                  <div className="text-sm text-slate-900 mt-1">{detailApiRow.warehouseCode || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Part Number</div>
                  <div className="text-sm text-slate-900 mt-1">{detailApiRow.partNumber || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Part Name</div>
                  <div className="text-sm text-slate-900 mt-1">{detailApiRow.partName || "-"}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Transaction Details</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Quantity Out</div>
                  <div className="text-sm font-semibold text-red-600 mt-1">- {detailApiRow.quantity} {detailApiRow.unit}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Reference No</div>
                  <div className="text-sm text-slate-900 mt-1">{detailApiRow.referenceNo || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Work Order</div>
                  <div className="text-sm text-slate-900 mt-1">{detailApiRow.workOrder || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Destination</div>
                  <div className="text-sm text-slate-900 mt-1">{detailApiRow.destination || "-"}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Notes</div>
              <div className="text-sm text-slate-900 whitespace-pre-wrap break-words">{detailApiRow.notes || "-"}</div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Process Outgoing Raw Material"
        open={trxOpen}
        onCancel={closeTrx}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeTrx}>Cancel</Button>
            <Button
              type="primary"
              onClick={() => (useApi ? handleProcessApi() : handleProcessMock())}
              loading={useApi ? creating : false}
            >
              Process Outgoing RM
            </Button>
          </div>
        }
        width={560}
        destroyOnClose
      >
        <div className="text-gray-500 text-sm mb-3">
          {useApi
            ? "Select UNIQ from BOM and enter outgoing details"
            : "Select UNIQ from BOM and enter outgoing details"}
        </div>

        {useApi ? (
          <Form form={apiForm} layout="vertical">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Form.Item
                label="Type"
                name="materialType"
                rules={[{ required: true, message: "Type is required" }]}
              >
                <Select
                  placeholder="Select Type"
                  options={materialTypeOptions.map((t) => ({ label: t, value: t }))}
                  onChange={() => {
                    apiForm.setFieldsValue({ uniq: "" });
                  }}
                />
              </Form.Item>

              <Form.Item label="UNIQ (from BOM)" name="uniq" rules={[{ required: true, message: "UNIQ is required" }]}>
                <Select
                  showSearch
                  placeholder="Select UNIQ"
                  options={getUniqOptionsForType(watchedTypeApi ?? "Raw Material")}
                  optionFilterProp="label"
                  loading={bomFetching}
                  notFoundContent={
                    bomFetching
                      ? "Loading BOM..."
                      : getUniqOptionsForType(watchedTypeApi ?? "Raw Material").length === 0
                        ? "No BOM data"
                        : null
                  }
                />
              </Form.Item>
            </div>

            <Form.Item
              label="Warehouse"
              name="warehouseCode"
              rules={[{ required: true, message: "Warehouse is required" }]}
            >
              <Select
                placeholder="WH-001"
                options={[
                  { label: "WH-001", value: "WH-001" },
                  { label: "WH-002", value: "WH-002" },
                  { label: "WH-003", value: "WH-003" },
                ]}
              />
            </Form.Item>

            {watchedUniq ? (
              <div className="mb-3 text-sm text-slate-600">
                <div>
                  <span className="font-medium">Part Number:</span>{" "}
                  {bomIndex.partNumberByUniq[String(watchedUniq)] || "-"}
                </div>
                <div>
                  <span className="font-medium">Part Name:</span>{" "}
                  {bomIndex.partNameByUniq[String(watchedUniq)] ||
                    bomIndex.assemblyCodeByUniq[String(watchedUniq)] ||
                    "-"}
                </div>
              </div>
            ) : null}

            <div className="text-gray-900 font-semibold mb-2">Outgoing Transaction Details</div>

            <Form.Item
              label="Reference No (Packing List / DN / DO)"
              name="referenceNo"
              rules={[{ required: true, message: "Reference No is required" }]}
            >
              <Input placeholder="e.g., PL-123456" />
            </Form.Item>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Form.Item
                label="Quantity Out"
                name="quantity"
                rules={[{ required: true, message: "Quantity is required" }]}
              >
                <InputNumber className="w-full" min={0} placeholder="Enter quantity to decrease" />
              </Form.Item>

              <Form.Item label="Unit" name="unit" rules={[{ required: true, message: "Unit is required" }]}>
                <Select
                  placeholder="Select Unit"
                  options={unitOptions.map((u) => ({ label: u, value: u }))}
                />
              </Form.Item>
            </div>

            <Form.Item label="Reason" name="reason" rules={[{ required: true, message: "Select reason" }]}>
              <Select
                placeholder="Select reason"
                options={reasonOptions.map((r) => ({ label: r, value: r }))}
              />
            </Form.Item>

            <Form.Item label="Purpose" name="purpose" rules={[{ required: true, message: "Purpose is required" }]}>
              <Input placeholder="Describe the purpose (e.g., Work Order WO-ddmmyy-001)" />
            </Form.Item>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Form.Item label="Work Order Number" name="workOrder">
                <Input
                  placeholder="WO-ddmmyy-001"
                  addonAfter={
                    <button
                      type="button"
                      className="text-blue-600"
                      onClick={() => {
                        const next = generateNextWorkOrderNumber();
                        apiForm.setFieldsValue({
                          workOrder: next,
                          purpose: String(apiForm.getFieldValue("purpose") ?? "").includes("Work Order")
                            ? `Work Order ${next}`
                            : apiForm.getFieldValue("purpose"),
                        });
                      }}
                    >
                      Generate
                    </button>
                  }
                />
              </Form.Item>

              <Form.Item label="Destination Location" name="destination">
                <Input placeholder="e.g., Production Line A, QC Lab" />
              </Form.Item>
            </div>

            <Form.Item label="Remarks" name="remarks">
              <Input.TextArea rows={3} placeholder="Additional notes or comments" />
            </Form.Item>

            <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-sm">
              <div className="text-red-700 font-medium mb-1">Important:</div>
              <div className="text-red-700">
                This transaction will immediately decrease the raw material stock quantity.
                The database will be updated and logged for tracking purposes.
              </div>
            </div>
          </Form>
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item
              label="Type"
              name="materialType"
              rules={[{ required: true, message: "Type is required" }]}
            >
              <Select
                placeholder="Select Type"
                options={materialTypeOptions.map((t) => ({ label: t, value: t }))}
                onChange={() => {
                  form.setFieldsValue({ uniq: "", rmCode: "", rmName: "" });
                }}
              />
            </Form.Item>

            <Form.Item label="UNIQ (from BOM)" name="uniq" rules={[{ required: true, message: "UNIQ is required" }]}>
              <Select
                showSearch
                placeholder="Select UNIQ"
                options={getUniqOptionsForType(watchedTypeMock ?? "Raw Material")}
                optionFilterProp="label"
                loading={bomFetching}
                notFoundContent={
                  bomFetching
                    ? "Loading BOM..."
                    : getUniqOptionsForType(watchedTypeMock ?? "Raw Material").length === 0
                      ? "No BOM data"
                      : null
                }
                onChange={(v) => {
                  const uniq = String(v ?? "");
                  form.setFieldsValue({
                    rmCode: bomIndex.partNumberByUniq[uniq] || "",
                    rmName: bomIndex.partNameByUniq[uniq] || bomIndex.assemblyCodeByUniq[uniq] || "",
                  });
                }}
              />
            </Form.Item>

            {watchedMockUniq ? (
              <div className="mb-3 text-sm text-slate-600">
                <div>
                  <span className="font-medium">Part Number:</span>{" "}
                  {bomIndex.partNumberByUniq[String(watchedMockUniq)] || "-"}
                </div>
                <div>
                  <span className="font-medium">Part Name:</span>{" "}
                  {bomIndex.partNameByUniq[String(watchedMockUniq)] ||
                    bomIndex.assemblyCodeByUniq[String(watchedMockUniq)] ||
                    "-"}
                </div>
              </div>
            ) : null}

            <Form.Item label="Reference No (Packing List / DN / DO)" name="packingList" rules={[{ required: true }]}>
              <Input placeholder="e.g., PL-123456" />
            </Form.Item>

            <div className="text-gray-900 font-semibold mb-2">Raw Material Information</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Form.Item label="RM Code" name="rmCode" rules={[{ required: true }]}>
                <Input placeholder="Auto-filled from BOM" disabled />
              </Form.Item>

              <Form.Item label="RM Name" name="rmName" rules={[{ required: true }]}>
                <Input placeholder="Auto-filled from BOM" disabled />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Form.Item label="Current Stock" name="currentStock" rules={[{ required: true }]}>
                <InputNumber className="w-full" min={0} placeholder="Auto-filled" />
              </Form.Item>

              <Form.Item label="Unit" name="unit" rules={[{ required: true }]}>
                <Select
                  placeholder="Select Unit"
                  options={unitOptions.map((u) => ({ label: u, value: u }))}
                />
              </Form.Item>
            </div>

            <div className="text-gray-900 font-semibold mb-2">Outgoing Transaction Details</div>

            <Form.Item
              label="Quantity Out"
              name="qtyOut"
              rules={[
                { required: true },
                {
                  validator: async (_, value) => {
                    const stock = Number(form.getFieldValue("currentStock") ?? 0);
                    const qty = Number(value ?? 0);
                    if (qty > stock) throw new Error("Quantity out cannot exceed current stock");
                  },
                },
              ]}
            >
              <InputNumber className="w-full" min={0} placeholder="Enter quantity to decrease" />
            </Form.Item>

            <Form.Item label="Reason" name="reason" rules={[{ required: true, message: "Select reason" }]}>
              <Select
                placeholder="Select reason"
                options={reasonOptions.map((r) => ({ label: r, value: r }))}
              />
            </Form.Item>

            <Form.Item label="Purpose" name="purpose" rules={[{ required: true, message: "Purpose is required" }]}
            >
              <Input placeholder="Describe the purpose (e.g., Work Order WO-ddmmyy-001)" />
            </Form.Item>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Form.Item label="Work Order Number" name="workOrder">
                <Input
                  placeholder="WO-ddmmyy-001"
                  addonAfter={
                    <button
                      type="button"
                      className="text-blue-600"
                      onClick={() => {
                        const next = generateNextWorkOrderNumber();
                        form.setFieldsValue({
                          workOrder: next,
                          purpose: String(form.getFieldValue("purpose") ?? "").includes("Work Order")
                            ? `Work Order ${next}`
                            : form.getFieldValue("purpose"),
                        });
                      }}
                    >
                      Generate
                    </button>
                  }
                />
              </Form.Item>

              <Form.Item label="Destination Location" name="destination">
                <Input placeholder="e.g., Production Line A, QC Lab" />
              </Form.Item>
            </div>

            <Form.Item label="Remarks" name="remarks">
              <Input.TextArea rows={3} placeholder="Additional notes or comments" />
            </Form.Item>

            <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-sm">
              <div className="text-red-700 font-medium mb-1">Important:</div>
              <div className="text-red-700">
                This transaction will immediately decrease the raw material stock quantity.
                The database will be updated and logged for tracking purposes.
              </div>
            </div>
          </Form>
        )}
      </Modal>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outgoing - Raw Material</h1>
          <p className="text-gray-600">
            Track and manage raw material quantity decrements with detailed history logs
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openTrx}>
          New Outgoing Transaction
        </Button>
      </div>

      <Card className="rounded-lg shadow-sm" styles={{ body: { padding: 16 } }}>
        <div className="flex items-center gap-2 text-sm text-gray-700 mb-4">
          <span className="font-medium">Outgoing Raw Material Management</span>
          <span className="text-gray-400">—</span>
          <span className="text-gray-500">Process outgoing raw materials and track all quantity decrements</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Filter by Reason:</span>
            <Select
              value={reasonFilter}
              onChange={(v) => setReasonFilter(v as ReasonOption | "ALL")}
              style={{ width: 200 }}
              options={[
                { label: "All Transactions", value: "ALL" },
                ...reasonOptions.map((r) => ({ label: r, value: r })),
              ]}
            />
          </div>
        </div>

        <div className="mt-4" style={{ overflowX: "auto" }}>
          {useApi ? (
            <Table<OutgoingApiRow>
              columns={apiColumns}
              dataSource={filteredApiData}
              rowKey="id"
              loading={apiFetching}
              pagination={false}
              scroll={{ x: "max-content" }}
            />
          ) : (
            <Table<OutgoingRow>
              columns={columns}
              dataSource={data}
              rowKey="id"
              pagination={false}
              scroll={{ x: "max-content" }}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
