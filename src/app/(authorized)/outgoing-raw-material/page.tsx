"use client";

import React, { useMemo, useState } from "react";
import { Button, Descriptions, Form, Input, InputNumber, Modal, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { EyeOutlined, PlusOutlined } from "@ant-design/icons";

import { apiBaseUrl } from "@/lib/api/instance";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import {
  type OutgoingRawMaterial,
  useCreateOutgoingRawMaterialMutation,
  useGetOutgoingRawMaterialByIdQuery,
  useGetOutgoingRawMaterialsQuery,
} from "@/lib/api/outgoing-raw-material/api";
import { useListProcurementDnsQuery } from "@/lib/api/procurement-dn/api";
import { useListProcurementPosQuery, type ProcurementPoRecord } from "@/lib/api/procurement-po/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { formatWorkOrderDisplayNumber } from "@/lib/utils/workOrder";
import { useListWarehousesQuery } from "@/lib/api/warehouse/api";
import { useGetWorkOrdersQuery } from "@/lib/api/work-orders/api";

type OutgoingFormValues = {
  po_number?: string;
  dn_number?: string;
  packing_list_rm: string;
  uniq: string;
  unit: string;
  quantity_out: number;
  reason: string;
  purpose?: string;
  work_order_no?: string;
  destination_location?: string;
  requested_by?: string;
  remarks?: string;
};

const reasonOptions = [
  "Production Use",
  "Quality Testing",
  "Sample Request",
  "Rework",
  "Maintenance",
  "Others",
];

const getPoUniq = (po: ProcurementPoRecord | undefined): string | undefined => {
  if (!po) return undefined;
  if (po.uniq_code) return po.uniq_code;
  const firstItem = Array.isArray(po.items) ? po.items[0] : undefined;
  if (!firstItem || typeof firstItem !== "object" || firstItem === null) return undefined;
  const record = firstItem as Record<string, unknown>;
  return typeof record.uniq_code === "string"
    ? record.uniq_code
    : typeof record.item_uniq_code === "string"
      ? record.item_uniq_code
      : typeof record.uniq === "string"
        ? record.uniq
        : undefined;
};

export default function OutgoingRawMaterialPage() {
  const apiEnabled = Boolean(apiBaseUrl);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [reasonFilter, setReasonFilter] = useState<string>("ALL");
  const [trxOpen, setTrxOpen] = useState(false);
  const [form] = Form.useForm<OutgoingFormValues>();

  const listQuery = useGetOutgoingRawMaterialsQuery(
    { page: currentPage, limit: pageSize },
    { skip: !apiEnabled }
  );
  const [createOutgoingRawMaterial, createState] = useCreateOutgoingRawMaterialMutation();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const bomTreeQuery = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const bomIndex = useMemo(() => buildBomUniqIndex(bomTreeQuery.data?.data ?? []), [bomTreeQuery.data]);
  const warehousesQuery = useListWarehousesQuery(undefined, { skip: !apiEnabled });
  const procurementPosQuery = useListProcurementPosQuery({ po_type: "raw_material" }, { skip: !apiEnabled });
  const procurementDnsQuery = useListProcurementDnsQuery(undefined, { skip: !apiEnabled });
  const workOrdersQuery = useGetWorkOrdersQuery({ page: 1, limit: 200 }, { skip: !apiEnabled });

  const detailQuery = useGetOutgoingRawMaterialByIdQuery(
    { id: detailId ?? 0 },
    { skip: !apiEnabled || !detailOpen || !detailId }
  );

  const procurementPos = procurementPosQuery.data?.data ?? [];
  const procurementDns = (procurementDnsQuery.data?.data ?? []).filter((item) => item.type === "RM");
  const workOrders = workOrdersQuery.data?.items ?? [];

  const poOptions = useMemo(
    () =>
      procurementPos
        .filter((item) => Boolean(item.po_number))
        .map((item) => ({
          value: item.po_number ?? "",
          label: item.supplier_name ? `${item.po_number} — ${item.supplier_name}` : item.po_number ?? "",
        })),
    [procurementPos]
  );

  const dnOptions = useMemo(
    () =>
      procurementDns
        .filter((item) => Boolean(item.dn_number))
        .map((item) => ({
          value: item.dn_number ?? "",
          label: item.po_number ? `${item.dn_number} — ${item.po_number}` : item.dn_number ?? "",
        })),
    [procurementDns]
  );

  const uniqOptions = useMemo(
    () =>
      bomIndex.uniqs.map((uniq) => ({
        value: uniq,
        label: bomIndex.partNameByUniq[uniq] ? `${uniq} — ${bomIndex.partNameByUniq[uniq]}` : uniq,
      })),
    [bomIndex.partNameByUniq, bomIndex.uniqs]
  );

  const warehouseOptions = useMemo(
    () =>
      (warehousesQuery.data ?? [])
        .map((item) => ({
          value: item.warehouse_name ?? item.id ?? "",
          label: item.type_warehouse ? `${item.warehouse_name ?? item.id ?? "-"} — ${item.type_warehouse}` : item.warehouse_name ?? item.id ?? "-",
        }))
        .filter((item) => Boolean(item.value)),
    [warehousesQuery.data]
  );

  const workOrderOptions = useMemo(
    () =>
      workOrders
        .filter((item) => Boolean(item.wo_number))
        .map((item) => ({
          value: item.wo_number,
          label: formatWorkOrderDisplayNumber(item.wo_number),
        })),
    [workOrders]
  );

  const rows = listQuery.data?.items ?? [];
  const total = listQuery.data?.pagination.total ?? rows.length;

  const data = useMemo(() => {
    if (reasonFilter === "ALL") return rows;
    return rows.filter((r) => (r.reason || "").toLowerCase() === reasonFilter.toLowerCase());
  }, [reasonFilter, rows]);

  const openTrx = () => {
    setTrxOpen(true);
    form.setFieldsValue({
      unit: "g",
      quantity_out: 0,
      reason: "Production Use",
    });
  };

  const applyUniqAutofill = (uniq?: string) => {
    if (!uniq) return;
    form.setFieldsValue({
      uniq,
      unit: bomIndex.uomByUniq[uniq] || form.getFieldValue("unit") || "g",
      packing_list_rm: form.getFieldValue("packing_list_rm") || bomIndex.packingNumberByUniq[uniq] || "",
    });
  };

  const onSelectPo = (poNumber: string) => {
    const po = procurementPos.find((item) => item.po_number === poNumber);
    const uniq = getPoUniq(po);
    const relatedDn = procurementDns.find((item) => item.po_number === poNumber);

    form.setFieldsValue({
      po_number: poNumber,
      dn_number: relatedDn?.dn_number,
      purpose: form.getFieldValue("purpose") || `PO ${poNumber}`,
    });

    applyUniqAutofill(uniq);
  };

  const onSelectDn = (dnNumber: string) => {
    const dn = procurementDns.find((item) => item.dn_number === dnNumber);
    const firstItem = dn?.items?.[0];
    const uniq = firstItem?.item_uniq_code;

    form.setFieldsValue({
      dn_number: dnNumber,
      po_number: dn?.po_number,
      packing_list_rm: firstItem?.packing_number ?? dnNumber,
      purpose: form.getFieldValue("purpose") || `DN ${dnNumber}`,
    });

    applyUniqAutofill(uniq);
  };

  const onSelectWorkOrder = (woNumber: string) => {
    const workOrder = workOrders.find((item) => item.wo_number === woNumber);
    const firstItem = workOrder?.items?.[0];

    form.setFieldsValue({
      work_order_no: woNumber,
      purpose: form.getFieldValue("purpose") || `Work Order ${woNumber}`,
    });

    applyUniqAutofill(firstItem?.item_uniq_code);
  };

  const closeTrx = () => {
    setTrxOpen(false);
    form.resetFields();
  };

  const handleProcess = async () => {
    const values = await form.validateFields();

    if (!apiEnabled) {
      message.info("NEXT_PUBLIC_API_URL is not configured");
      return;
    }

    await createOutgoingRawMaterial({
      packing_list_rm: values.packing_list_rm,
      uniq: values.uniq,
      unit: values.unit,
      quantity_out: Number(values.quantity_out ?? 0),
      reason: values.reason,
      purpose: values.purpose,
      work_order_no: values.work_order_no,
      destination_location: values.destination_location,
      requested_by: values.requested_by,
      remarks: values.remarks,
    }).unwrap();

    message.success("Outgoing transaction created");
    listQuery.refetch();
    closeTrx();
  };

  const openDetail = (row: OutgoingRawMaterial) => {
    setDetailId(row.id);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailId(null);
  };

  const columns: ColumnsType<OutgoingRawMaterial> = [
    {
      title: "Transaction ID",
      dataIndex: "transaction_id",
      key: "transaction_id",
      width: 150,
      render: (v: string) => <span className="font-medium text-gray-900">{v || "-"}</span>,
    },
    {
      title: "Transaction Date",
      dataIndex: "transaction_date",
      key: "transaction_date",
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleDateString() : "-"),
    },
    { title: "UNIQ", dataIndex: "uniq", key: "uniq", width: 120 },
    { title: "RM Name", dataIndex: "rm_name", key: "rm_name", width: 240 },
    { title: "Packing List RM", dataIndex: "packing_list_rm", key: "packing_list_rm", width: 160 },
    { title: "Unit", dataIndex: "unit", key: "unit", width: 80 },
    {
      title: "Quantity Out",
      dataIndex: "quantity_out",
      key: "quantity_out",
      width: 130,
      align: "right",
      render: (_: number, r) => (
        <span className="text-red-600 font-medium">- {r.quantity_out} {r.unit}</span>
      ),
    },
    { title: "Stock Before", dataIndex: "stock_before", key: "stock_before", width: 120, align: "right" },
    { title: "Stock After", dataIndex: "stock_after", key: "stock_after", width: 120, align: "right" },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      width: 160,
      render: (v: string) => <Tag className="bg-blue-50 text-blue-700 border-blue-100">{v || "-"}</Tag>,
    },
    { title: "Purpose", dataIndex: "purpose", key: "purpose", width: 220 },
    { title: "WO", dataIndex: "work_order_no", key: "work_order_no", width: 140 },
    { title: "Destination", dataIndex: "destination_location", key: "destination_location", width: 180 },
    { title: "Requested By", dataIndex: "requested_by", key: "requested_by", width: 140 },
    {
      title: "Created At",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (v: string) => (v ? new Date(v).toLocaleString() : "-"),
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      fixed: "right",
      render: (_: unknown, r) => (
        <Button type="text" icon={<EyeOutlined />} className="text-gray-500" onClick={() => openDetail(r)} />
      ),
    },
  ];

  const detailItems = detailQuery.data ? buildDetailItems(detailQuery.data) : [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outgoing - Raw Material</h1>
          <p className="text-gray-600">Track outgoing raw material transactions</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openTrx}>
          New Outgoing
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-600">Filter by Reason:</span>
        <Select
          value={reasonFilter}
          onChange={(v) => setReasonFilter(v)}
          style={{ width: 240 }}
          options={[
            { label: "All Transactions", value: "ALL" },
            ...reasonOptions.map((r) => ({ label: r, value: r })),
          ]}
        />
      </div>

      <Table<OutgoingRawMaterial>
        rowKey={(r) => String(r.id)}
        columns={columns}
        dataSource={data}
        loading={apiEnabled ? listQuery.isFetching : false}
        scroll={{ x: 1900 }}
        pagination={{
          current: currentPage,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (page, size) => {
            setCurrentPage(page);
            if (typeof size === "number") setPageSize(size);
          },
        }}
      />

      <Modal
        title="Outgoing Raw Material Detail"
        open={detailOpen}
        onCancel={closeDetail}
        footer={null}
        width={860}
        destroyOnClose
      >
        {detailQuery.isFetching ? (
          <div className="text-gray-600">Loading…</div>
        ) : detailQuery.isError ? (
          <div className="text-red-600">Failed to load detail.</div>
        ) : !detailQuery.data ? (
          <div className="text-gray-500">No detail selected</div>
        ) : (
          <Descriptions bordered size="small" column={2} items={detailItems} />
        )}
      </Modal>

      <Modal
        title="Create Outgoing Raw Material"
        open={trxOpen}
        onCancel={closeTrx}
        onOk={handleProcess}
        okText="Create"
        confirmLoading={createState.isLoading}
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="PO Number" name="po_number">
              <Select placeholder="Select PO from procurement" options={poOptions} showSearch optionFilterProp="label" allowClear onChange={onSelectPo} />
            </Form.Item>

            <Form.Item label="DN Number" name="dn_number">
              <Select placeholder="Select related DN" options={dnOptions} showSearch optionFilterProp="label" allowClear onChange={onSelectDn} />
            </Form.Item>

            <Form.Item
              label="Packing List RM"
              name="packing_list_rm"
              rules={[{ required: true, message: "packing_list_rm wajib" }]}
            >
              <Input placeholder="PL-EMA-LV3-001" />
            </Form.Item>

            <Form.Item label="UNIQ" name="uniq" rules={[{ required: true, message: "uniq wajib" }]}>
              <Select placeholder="Select UNIQ from BOM" options={uniqOptions} showSearch optionFilterProp="label" allowClear onChange={applyUniqAutofill} />
            </Form.Item>

            <Form.Item label="Unit" name="unit" rules={[{ required: true, message: "unit wajib" }]}>
              <Input placeholder="g" />
            </Form.Item>

            <Form.Item
              label="Quantity Out"
              name="quantity_out"
              rules={[{ required: true, message: "quantity_out wajib" }]}
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>

            <Form.Item label="Reason" name="reason" rules={[{ required: true, message: "reason wajib" }]}>
              <Select options={reasonOptions.map((r) => ({ label: r, value: r }))} />
            </Form.Item>

            <Form.Item label="Work Order No" name="work_order_no">
              <Select placeholder="Select work order" options={workOrderOptions} showSearch optionFilterProp="label" allowClear onChange={onSelectWorkOrder} />
            </Form.Item>

            <Form.Item label="Purpose" name="purpose">
              <Input placeholder="Work Order WO-2024-045" />
            </Form.Item>

            <Form.Item label="Destination Location" name="destination_location">
              <Select placeholder="Select warehouse destination" options={warehouseOptions} showSearch optionFilterProp="label" allowClear />
            </Form.Item>

            <Form.Item label="Requested By" name="requested_by">
              <Input placeholder="John Doe" />
            </Form.Item>
          </div>

          <Form.Item label="Remarks" name="remarks">
            <Input.TextArea rows={3} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function buildDetailItems(row: OutgoingRawMaterial) {
  return [
    { key: "transaction_id", label: "Transaction ID", children: row.transaction_id || "-" },
    {
      key: "transaction_date",
      label: "Transaction Date",
      children: row.transaction_date ? new Date(row.transaction_date).toLocaleString() : "-",
    },
    { key: "uniq", label: "UNIQ", children: row.uniq || "-" },
    { key: "rm_name", label: "RM Name", children: row.rm_name || "-" },
    { key: "packing_list_rm", label: "Packing List RM", children: row.packing_list_rm || "-" },
    { key: "unit", label: "Unit", children: row.unit || "-" },
    { key: "quantity_out", label: "Quantity Out", children: row.quantity_out },
    { key: "stock_before", label: "Stock Before", children: row.stock_before },
    { key: "stock_after", label: "Stock After", children: row.stock_after },
    { key: "reason", label: "Reason", children: row.reason || "-" },
    { key: "purpose", label: "Purpose", children: row.purpose || "-" },
    { key: "work_order_no", label: "Work Order No", children: row.work_order_no || "-" },
    {
      key: "destination_location",
      label: "Destination Location",
      children: row.destination_location || "-",
    },
    { key: "requested_by", label: "Requested By", children: row.requested_by || "-" },
    { key: "remarks", label: "Remarks", children: row.remarks || "-" },
    {
      key: "created_at",
      label: "Created At",
      children: row.created_at ? new Date(row.created_at).toLocaleString() : "-",
    },
  ];
}
