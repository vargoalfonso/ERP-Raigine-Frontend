"use client";

import React, { useMemo, useState } from "react";
import { Button, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CalendarOutlined, DeleteOutlined, EditOutlined, EyeOutlined, LineChartOutlined, PlusOutlined, RedoOutlined } from "@ant-design/icons";

import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import {
  type OutgoingRawMaterial,
  useCreateOutgoingRawMaterialMutation,
  useDeleteOutgoingRawMaterialMutation,
  useGetOutgoingRawMaterialByIdQuery,
  useGetOutgoingRawMaterialsQuery,
  useRestoreOutgoingRawMaterialStockMutation,
  useUpdateOutgoingRawMaterialMutation,
  useGetFormOptionsQuery,
} from "@/lib/api/outgoing-raw-material/api";
import { useListProcurementDnsQuery } from "@/lib/api/procurement-dn/api";
import { useListProcurementPosQuery, type ProcurementPoRecord } from "@/lib/api/procurement-po/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { formatWorkOrderDisplayNumber } from "@/lib/utils/workOrder";
import { useListWarehousesQuery } from "@/lib/api/warehouse/api";
import { useGetEmployeesQuery } from "@/lib/api/system-settings/api";
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
  "Quality Testing",
  "Sample Request",
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
  // When set, the transaction modal is in "edit" mode for this row id.
  const [editId, setEditId] = useState<number | null>(null);
  const [form] = Form.useForm<OutgoingFormValues>();

  const listQuery = useGetOutgoingRawMaterialsQuery(
    { page: currentPage, limit: pageSize },
    { skip: !apiEnabled }
  );
  const [createOutgoingRawMaterial, createState] = useCreateOutgoingRawMaterialMutation();
  const [updateOutgoingRawMaterial, updateState] = useUpdateOutgoingRawMaterialMutation();
  const [deleteOutgoingRawMaterial, deleteState] = useDeleteOutgoingRawMaterialMutation();
  const [restoreOutgoingRawMaterialStock, restoreState] = useRestoreOutgoingRawMaterialStockMutation();
  const [pendingRowId, setPendingRowId] = useState<number | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const bomTreeQuery = useGetBomTreeQuery(undefined, { skip: !apiEnabled || !trxOpen });
  const bomIndex = useMemo(() => buildBomUniqIndex(bomTreeQuery.data?.data ?? []), [bomTreeQuery.data]);
  const warehousesQuery = useListWarehousesQuery(undefined, { skip: !apiEnabled || !trxOpen });
  const employeesQuery = useGetEmployeesQuery(undefined, { skip: !apiEnabled || !trxOpen });
  const procurementPosQuery = useListProcurementPosQuery({ po_type: "raw_material" }, { skip: !apiEnabled || !trxOpen });
  const procurementDnsQuery = useListProcurementDnsQuery(undefined, { skip: !apiEnabled || !trxOpen });
  const workOrdersQuery = useGetWorkOrdersQuery({ page: 1, limit: 200 }, { skip: !apiEnabled || !trxOpen });

  const detailQuery = useGetOutgoingRawMaterialByIdQuery(
    { id: detailId ?? 0 },
    { skip: !apiEnabled || !detailOpen || !detailId }
  );

  const procurementPos = procurementPosQuery.data?.data ?? [];
  const procurementDns = (procurementDnsQuery.data?.data ?? []).filter(
    (item: any) => String(item.type ?? "").toUpperCase() === "RM"
  );
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

  const requestedByOptions = useMemo(
    () =>
      (employeesQuery.data ?? [])
        .map((item) => ({
          value: item.full_name ?? "",
          label: item.job_title ? `${item.full_name} — ${item.job_title}` : item.full_name ?? "",
        }))
        .filter((item) => Boolean(item.value)),
    [employeesQuery.data]
  );

  const packingOptions = useMemo(() => {
    const options: { value: string; label: string; item: any }[] = [];
    procurementDns.forEach((dn: any) => {
      (dn.items || []).forEach((item: any) => {
        if (item.packing_number) {
          options.push({
            value: item.packing_number,
            label: `${item.packing_number} — ${item.item_uniq_code}`,
            item: item,
          });
        }
      });
    });
    return options;
  }, [procurementDns]);

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

  const watchedUniq = Form.useWatch("uniq", form);
  const watchedPackingListRm = Form.useWatch("packing_list_rm", form);

  const formOptionsQuery = useGetFormOptionsQuery(
    { q: watchedUniq, limit: 1 },
    { skip: !apiEnabled || !trxOpen || !watchedUniq }
  );
  
  const stockQty = useMemo(() => {
    if (!formOptionsQuery.data || formOptionsQuery.data.length === 0) return 0;
    // Attempt exact match first
    const exact = formOptionsQuery.data.find(opt => opt.uniq_code === watchedUniq);
    if (exact) return exact.stock_qty;
    return formOptionsQuery.data[0].stock_qty;
  }, [formOptionsQuery.data, watchedUniq]);

  React.useEffect(() => {
    if (formOptionsQuery.data && formOptionsQuery.data.length > 0 && watchedUniq) {
      const exact = formOptionsQuery.data.find(opt => opt.uniq_code === watchedUniq) || formOptionsQuery.data[0];
      if (exact.warehouse_location && !form.getFieldValue("destination_location")) {
        form.setFieldsValue({ destination_location: exact.warehouse_location });
      }
    }
  }, [formOptionsQuery.data, watchedUniq, form]);

  const selectedIncomingItem = useMemo(() => {
    if (!watchedPackingListRm) return null;
    return packingOptions.find(o => o.value === watchedPackingListRm)?.item;
  }, [watchedPackingListRm, packingOptions]);

  const incomingQty = selectedIncomingItem?.quantity ?? 0;

  const rows = listQuery.data?.items ?? [];
  const total = listQuery.data?.pagination.total ?? rows.length;

  const data = useMemo(() => {
    if (reasonFilter === "ALL") return rows;
    return rows.filter((r) => (r.reason || "").toLowerCase() === reasonFilter.toLowerCase());
  }, [reasonFilter, rows]);

  const openTrx = () => {
    setTrxOpen(true);
    setTimeout(() => {
      form.setFieldsValue({
        unit: "g",
        quantity_out: 0,
        reason: "Quality Testing",
      });
    }, 0);
  };

  const applyUniqAutofill = (uniq?: string) => {
    if (!uniq) return;
    form.setFieldsValue({
      uniq,
      unit: bomIndex.uomByUniq[uniq] || form.getFieldValue("unit") || "g",
      packing_list_rm: form.getFieldValue("packing_list_rm") || bomIndex.packingNumberByUniq[uniq] || "",
    });
  };

  const onSelectPackingList = (packingNum: string) => {
    const option = packingOptions.find(o => o.value === packingNum);
    if (option) {
      const { item } = option;
      const uniq = item.item_uniq_code;
      form.setFieldsValue({
        uniq,
        unit: item.uom || bomIndex.uomByUniq[uniq] || form.getFieldValue("unit") || "g",
      });
    }
  };

  const onSelectPo = (poNumber: string) => {
    const po = procurementPos.find((item: ProcurementPoRecord) => item.po_number === poNumber);
    const uniq = getPoUniq(po);
    const relatedDn = procurementDns.find((item: any) => item.po_number === poNumber);

    form.setFieldsValue({
      po_number: poNumber,
      dn_number: relatedDn?.dn_number,
      purpose: form.getFieldValue("purpose") || `PO ${poNumber}`,
    });

    applyUniqAutofill(uniq);
  };

  const onSelectDn = (dnNumber: string) => {
    const dn = procurementDns.find((item: any) => item.dn_number === dnNumber);
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
    setEditId(null);
    form.resetFields();
  };

  const openEdit = (row: OutgoingRawMaterial) => {
    setEditId(row.id);
    setTrxOpen(true);
    setTimeout(() => {
      form.setFieldsValue({
        packing_list_rm: row.packing_list_rm,
        uniq: row.uniq,
        unit: row.unit,
        quantity_out: row.quantity_out,
        reason: row.reason,
        purpose: row.purpose,
        work_order_no: row.work_order_no || undefined,
        destination_location: row.destination_location || undefined,
        requested_by: row.requested_by,
        remarks: row.remarks,
      });
    }, 0);
  };

  const handleProcess = async () => {
    let values: OutgoingFormValues;
    try {
      values = await form.validateFields();
    } catch {
      // antd already highlights the invalid fields inline.
      return;
    }

    if (!apiEnabled) {
      message.info("NEXT_PUBLIC_API_URL is not configured");
      return;
    }

    if (stockQty !== null && Number(values.quantity_out) > stockQty) {
      message.error(`Quantity out (${values.quantity_out}) tidak boleh melebihi Available Stock RM (${stockQty})`);
      return;
    }

    const payload = {
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
    };

    try {
      if (editId) {
        await updateOutgoingRawMaterial({ id: editId, body: payload }).unwrap();
        message.success("Outgoing transaction updated");
      } else {
        await createOutgoingRawMaterial(payload).unwrap();
        message.success("Outgoing transaction created");
      }
      listQuery.refetch();
      closeTrx();
    } catch (err) {
      message.error(
        getApiErrorMessage(err, editId ? "Failed to update transaction" : "Failed to create transaction")
      );
    }
  };

  const handleDelete = async (row: OutgoingRawMaterial) => {
    if (!apiEnabled) {
      message.info("NEXT_PUBLIC_API_URL is not configured");
      return;
    }
    setPendingRowId(row.id);
    try {
      await deleteOutgoingRawMaterial({ id: row.id }).unwrap();
      message.success("Outgoing transaction deleted (stock not restored)");
      listQuery.refetch();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete transaction"));
    } finally {
      setPendingRowId(null);
    }
  };

  const handleRestoreStock = async (row: OutgoingRawMaterial) => {
    if (!apiEnabled) {
      message.info("NEXT_PUBLIC_API_URL is not configured");
      return;
    }
    setPendingRowId(row.id);
    try {
      await restoreOutgoingRawMaterialStock({ id: row.id }).unwrap();
      message.success(`Stock for ${row.quantity_out} ${row.unit} returned to inventory`);
      listQuery.refetch();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to restore stock"));
    } finally {
      setPendingRowId(null);
    }
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
      title: "Date",
      dataIndex: "transaction_date",
      key: "transaction_date",
      width: 160,
      render: (v: string) => (
        <Space size={6} className="text-gray-600">
          <CalendarOutlined />
          <span>{v ? v.substring(0, 10) : "-"}</span>
        </Space>
      ),
    },
    {
      title: "RM Info",
      key: "rm_info",
      width: 240,
      render: (_: unknown, r) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{r.uniq}</span>
          <span className="text-gray-500 text-sm">{r.rm_name}</span>
        </div>
      ),
    },
    {
      title: "Qty Out",
      dataIndex: "quantity_out",
      key: "quantity_out",
      width: 130,
      align: "right",
      render: (_: number, r) => (
        <span className="text-red-600 font-medium">
          <LineChartOutlined className="mr-1" /> -{r.quantity_out} {r.unit}
        </span>
      ),
    },
    { 
      title: "Stock Before", 
      dataIndex: "stock_before", 
      key: "stock_before", 
      width: 120,
      align: "right", 
      render: (v: number, r) => `${v} ${r.unit}` 
    },
    { 
      title: "Stock After", 
      dataIndex: "stock_after", 
      key: "stock_after", 
      width: 120,
      align: "right", 
      render: (v: number, r) => <span className="font-medium text-gray-900">{v} {r.unit}</span> 
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      width: 160,
      render: (v: string) => {
        let bgColor = "bg-gray-50";
        let textColor = "text-gray-700";
        let borderColor = "border-gray-200";
        if (v === "Production Use") {
          bgColor = "bg-blue-600";
          textColor = "text-white";
          borderColor = "border-blue-600";
        } else if (v === "Quality Testing") {
           bgColor = "bg-slate-100";
           textColor = "text-slate-600";
           borderColor = "border-slate-200";
        }
        return <Tag className={`border ${borderColor} ${bgColor} ${textColor} px-2 py-0.5 rounded-full font-medium`}>{v || "-"}</Tag>;
      },
    },
    { title: "Requested By", dataIndex: "requested_by", key: "requested_by", width: 140 },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      fixed: "right",
      align: "center",
      render: (_: unknown, r) => (
        <Tooltip title="View detail">
          <Button type="text" icon={<EyeOutlined />} className="text-gray-800" onClick={() => openDetail(r)} />
        </Tooltip>
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
        destroyOnHidden
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
        title={editId ? "Edit Outgoing Raw Material" : "Create Outgoing Raw Material"}
        open={trxOpen}
        onCancel={closeTrx}
        onOk={handleProcess}
        okText={editId ? "Save" : "Create"}
        confirmLoading={createState.isLoading || updateState.isLoading}
        width={680}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">


            <Form.Item
              label="Packing List RM"
              name="packing_list_rm"
              rules={[{ required: true, message: "packing_list_rm wajib" }]}
            >
              <Select placeholder="Select Packing List from Incoming DN" options={packingOptions} showSearch optionFilterProp="label" allowClear onChange={onSelectPackingList} />
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
              rules={[
                { required: true, message: "quantity_out wajib" },
                {
                  validator: async (_, value) => {
                    if (value > stockQty) {
                      message.error("Quantity Out cannot be more than current stock in raw material");
                      return Promise.reject(new Error("Exceeds stock"));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
              extra={
                watchedUniq ? (
                  <div className="text-xs text-gray-500 mt-1">
                    Current Stock: {stockQty} {form.getFieldValue("unit")}
                    {selectedIncomingItem ? ` | DN Incoming Qty: ${incomingQty}` : null}
                  </div>
                ) : null
              }
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>

            <Form.Item label="Reason" name="reason" rules={[{ required: true, message: "reason wajib" }]}>
              <Select options={reasonOptions.map((r) => ({ label: r, value: r }))} />
            </Form.Item>



            <Form.Item label="Purpose" name="purpose">
              <Input placeholder="Describe the Purpose" />
            </Form.Item>

            <Form.Item label="Destination Location" name="destination_location">
              <Select placeholder="Select warehouse destination" options={warehouseOptions} showSearch optionFilterProp="label" allowClear />
            </Form.Item>

            <Form.Item label="Requested By" name="requested_by">
              <Select
                placeholder="Select requester"
                options={requestedByOptions}
                showSearch
                optionFilterProp="label"
                allowClear
                loading={employeesQuery.isFetching}
              />
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
      key: "stock_restored_at",
      label: "Stock Restored At",
      children: row.stock_restored_at ? new Date(row.stock_restored_at).toLocaleString() : "-",
    },
    {
      key: "created_at",
      label: "Created At",
      children: row.created_at ? new Date(row.created_at).toLocaleString() : "-",
    },
  ];
}
