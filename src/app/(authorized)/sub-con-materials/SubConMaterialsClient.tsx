"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  PlusOutlined,
  QrcodeOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

import { apiBaseUrl } from "@/lib/api/instance";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import {
  useGetAllSubconRawMaterialQuery,
  useUpdateSubconRawMaterialMutation,
} from "@/lib/api/subcon-raw-material/api";
import {
  useApproveSubconInventoryMutation,
  useDeleteSubconInventoryMutation,
  useGetSubconInventoryQuery,
  useGetSubconReceivedQuery,
  useRejectSubconInventoryMutation,
} from "@/lib/api/subcon-inventory/api";
import { useLazyGenerateQRSubconQuery } from "@/lib/api/inventory/api";
import PrintButton from "@/components/PrintButton";
import type { PrintCardOptions } from "@/lib/utils/printCard";

type ApprovalStatus = "pending" | "approved" | "rejected";

type ViewMode = "Stock In Vendor" | "Stock Received from Vendor";

type SubConRow = {
  id: string;
  deliveryNotesNumber?: string;
  uniq: string;
  partNumber?: string;
  partName: string;
  subconVendor: string;
  period: string;
  dateDelivery: string;
  stockDate: number;
  totalStock: number;
  totalPO: number;
  deltaPoStock: number;
  status: "NORMAL" | "LOW STOCK";
  dnLogs: number;
  approvalStatus?: ApprovalStatus;
};

const stockInVendorInitialRows: SubConRow[] = [
  {
    id: "SUB-001",
    deliveryNotesNumber: "DN-SUB-001",
    uniq: "SUB-001",
    partNumber: "PLT-MK-20mm",
    partName: "Plating Process - Bracket",
    subconVendor: "PT Subcon Plating",
    period: "2025-Q1",
    dateDelivery: "2025-09-25",
    stockDate: 500,
    totalStock: 2500,
    totalPO: 5000,
    deltaPoStock: 2500,
    status: "NORMAL",
    dnLogs: 2,
  },
];

const stockReceivedInitialRows: SubConRow[] = [
  {
    id: "SUB-RCV-001",
    deliveryNotesNumber: "DN-SUB-001",
    uniq: "SUB-001",
    partNumber: "PLT-MK-20mm",
    partName: "Plating Process - Bracket",
    subconVendor: "PT Subcon Plating",
    period: "2025-Q1",
    dateDelivery: "2025-09-28",
    stockDate: 500,
    totalStock: 1500,
    totalPO: 5000,
    deltaPoStock: 3500,
    status: "NORMAL",
    dnLogs: 2,
  },
];

export default function SubConMaterialsClient() {
  const router = useRouter();
  const [generateQRSubcon] = useLazyGenerateQRSubconQuery();

  // Builds the print-card options and fetches the QR (packing list / kanban
  // list from DN management) on demand. 1 uniq = 1 QR.
  const handleGenerateQR = async (
    r: SubConRow,
    received: boolean,
  ): Promise<PrintCardOptions | null> => {
    if (!r.uniq) {
      message.error("Uniq code tidak ditemukan");
      return null;
    }

    let qrDataUrl: string | undefined;
    try {
      const result = await generateQRSubcon(r.uniq).unwrap();
      const qr = result?.data?.qr ?? "";
      qrDataUrl = qr
        ? qr.startsWith("data:image")
          ? qr
          : `data:image/png;base64,${qr}`
        : undefined;
      if (!qrDataUrl) {
        message.error(
          `QR untuk uniq ${r.uniq} belum tersedia di DN management`,
        );
      }
    } catch (err) {
      console.error(err);
      const detail =
        (err as { data?: { message?: string } })?.data?.message ??
        (err as { error?: string })?.error ??
        "Gagal mengambil QR dari DN management";
      message.error(`Gagal mengambil QR (${r.uniq}): ${detail}`);
    }

    return {
      documentTitle: received
        ? `SubCon Material (Received) - ${r.uniq}`
        : `SubCon Material - ${r.uniq}`,
      heading: "SUBCON MATERIAL",
      subheading: r.uniq,
      fields: [
        { label: "Part Name", value: r.partName, full: true },
        { label: "Subcon Vendor", value: r.subconVendor },
        { label: "Period", value: r.period },
        {
          label: received ? "Date Received" : "Date Delivery",
          value: r.dateDelivery,
        },
        {
          label: received ? "Received/Date" : "Stock/Date",
          value: r.stockDate.toLocaleString("en-US"),
        },
        {
          label: received ? "Total Received" : "Total Stock",
          value: r.totalStock.toLocaleString("en-US"),
        },
        { label: "Total PO", value: r.totalPO.toLocaleString("en-US") },
        {
          label: received ? "\u0394PO-Received" : "\u0394PO-Stock",
          value: r.deltaPoStock.toLocaleString("en-US"),
        },
        { label: "Status", value: r.status },
      ],
      qrDataUrl,
      bottomCode: r.uniq,
      onError: (msg) => message.error(msg),
    };
  };

  const searchParams = useSearchParams();
  const [mode, setMode] = useState<ViewMode>("Stock In Vendor");
  const [query, setQuery] = useState("");
  const [rowsVendor, setRowsVendor] = useState<SubConRow[]>(stockInVendorInitialRows);
  const [rowsReceived, setRowsReceived] = useState<SubConRow[]>(stockReceivedInitialRows);

  const useApi = Boolean(apiBaseUrl);
  const [currentPage] = useState(1);
  const [pageSize] = useState(10);

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "received") setMode("Stock Received from Vendor");
  }, [searchParams]);

  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, { skip: !useApi });
  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data]
  );

  const { refetch: refetchApiRows } = useGetAllSubconRawMaterialQuery(
    { currentPage, pageSize },
    { skip: !useApi }
  );

  // Stock Received from Vendor is auto-populated from subcon DN Management on the backend
  // (any DN status — "apapun statusnya bisa masuk yang penting subcon") and requires approval.
  const {
    data: apiReceivedRes,
    isSuccess: apiReceivedSuccess,
    isFetching: apiReceivedLoading,
    refetch: refetchReceivedRows,
  } = useGetSubconReceivedQuery({ page: 1, limit: 100 }, { skip: !useApi });

  const [deleteSubconInventory] = useDeleteSubconInventoryMutation();
  const [updateSubcon] = useUpdateSubconRawMaterialMutation();

  // Stock In Vendor is auto-populated from subcon PO on the backend and requires approval.
  const {
    data: apiVendorRes,
    isSuccess: apiVendorSuccess,
    isFetching: apiVendorLoading,
    refetch: refetchVendorRows,
  } = useGetSubconInventoryQuery({ page: 1, limit: 100 }, { skip: !useApi });

  const [approveSubcon, { isLoading: approving }] =
    useApproveSubconInventoryMutation();
  const [rejectSubcon, { isLoading: rejecting }] =
    useRejectSubconInventoryMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<SubConRow | null>(null);
  const [editingMode, setEditingMode] = useState<ViewMode>("Stock In Vendor");
  const [editForm] = Form.useForm();

  const [periodFilter, setPeriodFilter] = useState<string | null>(null);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<SubConRow | null>(null);
  const [deletingMode, setDeletingMode] = useState<ViewMode>("Stock In Vendor");

  const apiVendorRows = useMemo((): SubConRow[] => {
    if (!useApi || !apiVendorSuccess) return [];
    const raw = apiVendorRes?.data ?? [];
    return raw.map((r) => {
      const uniq = r.uniq_code ?? "-";
      const partNumber = bomIndex.partNumberByUniq?.[uniq] ?? r.part_number ?? "-";
      const partName = bomIndex.partNameByUniq?.[uniq] ?? r.part_name ?? "-";
      const totalStock = Number(r.stock_at_vendor_qty ?? 0);
      const totalPO = Number(r.total_po_qty ?? 0);
      const deltaPoStock = Number(r.delta_po ?? Math.max(0, totalPO - totalStock));
      const status: SubConRow["status"] =
        String(r.status).toLowerCase() === "low_on_stock" || totalStock <= 0
          ? "LOW STOCK"
          : "NORMAL";
      return {
        id: r.id,
        deliveryNotesNumber: r.po_number,
        uniq,
        partNumber,
        partName,
        subconVendor: r.subcon_vendor_name ?? "-",
        period: r.po_period ?? "-",
        dateDelivery: r.date_delivery ?? "-",
        stockDate: totalStock,
        totalStock,
        totalPO,
        deltaPoStock,
        status,
        dnLogs: 0,
        approvalStatus: r.approval_status,
      };
    });
  }, [apiVendorRes?.data, apiVendorSuccess, bomIndex.partNameByUniq, bomIndex.partNumberByUniq, useApi]);

  const apiReceivedRows = useMemo((): SubConRow[] => {
    if (!useApi || !apiReceivedSuccess) return [];
    const raw = apiReceivedRes?.data ?? [];
    return raw.map((r) => {
      const uniq = r.uniq_code ?? "-";
      const partNumber = bomIndex.partNumberByUniq?.[uniq] ?? r.part_number ?? "-";
      const partName = bomIndex.partNameByUniq?.[uniq] ?? r.part_name ?? "-";
      const totalReceived = Number(r.total_received_qty ?? 0);
      const totalPO = Number(r.total_po_qty ?? 0);
      const deltaPoStock = Number(r.delta_po ?? Math.max(0, totalPO - totalReceived));
      const status: SubConRow["status"] =
        String(r.status).toLowerCase() === "low_on_stock" || totalReceived <= 0
          ? "LOW STOCK"
          : "NORMAL";
      return {
        id: r.id,
        deliveryNotesNumber: r.po_number,
        uniq,
        partNumber,
        partName,
        subconVendor: r.subcon_vendor_name ?? "-",
        period: r.po_period ?? "-",
        dateDelivery: r.date_delivery ?? "-",
        stockDate: totalReceived,
        totalStock: totalReceived,
        totalPO,
        deltaPoStock,
        status,
        dnLogs: 0,
        approvalStatus: r.approval_status,
      };
    });
  }, [apiReceivedRes?.data, apiReceivedSuccess, bomIndex.partNameByUniq, bomIndex.partNumberByUniq, useApi]);

  const activeRows = useMemo(() => {
    if (mode === "Stock In Vendor") {
      if (useApi && apiVendorSuccess) return apiVendorRows;
      return rowsVendor;
    }
    if (useApi && apiReceivedSuccess) return apiReceivedRows;
    return rowsReceived;
  }, [apiReceivedRows, apiVendorRows, apiReceivedSuccess, apiVendorSuccess, mode, rowsReceived, rowsVendor, useApi]);

  const handleApprove = async (row: SubConRow) => {
    try {
      await approveSubcon(row.id).unwrap();
      message.success(`Approved ${row.uniq}`);
      await Promise.all([refetchVendorRows(), refetchReceivedRows()]);
    } catch {
      message.error("Failed to approve");
    }
  };

  const handleReject = async (row: SubConRow) => {
    try {
      await rejectSubcon(row.id).unwrap();
      message.success(`Rejected ${row.uniq}`);
      await Promise.all([refetchVendorRows(), refetchReceivedRows()]);
    } catch {
      message.error("Failed to reject");
    }
  };

  const availablePeriods = useMemo(() => {
    const periods = new Set(activeRows.map((r) => r.period));
    return Array.from(periods);
  }, [activeRows]);

  const uniqOptions = useMemo(() => {
    const uniqs = new Set([...rowsVendor, ...rowsReceived].map((r) => r.uniq));
    return Array.from(uniqs).map((u) => ({ label: u, value: u }));
  }, [rowsVendor, rowsReceived]);

  const dnOptions = useMemo(() => {
    const dns = new Set(
      [...rowsVendor, ...rowsReceived]
        .map((r) => r.deliveryNotesNumber)
        .filter(Boolean) as string[]
    );
    return Array.from(dns).map((dn) => ({ label: dn, value: dn }));
  }, [rowsVendor, rowsReceived]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = activeRows
      .filter((r) => (periodFilter ? r.period === periodFilter : true))
      .filter((r) => {
        if (!q) return true;
        return [r.uniq, r.partName, r.subconVendor].some((v) => v.toLowerCase().includes(q));
      });
    return base;
  }, [activeRows, periodFilter, query]);

  const openDelete = (row: SubConRow) => {
    setDeletingRow(row);
    setDeletingMode(mode);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeletingRow(null);
  };

  const confirmDelete = () => {
    if (!deletingRow) return;
    // [subcon-del] Sebelumnya tab Stock In Vendor hanya membuang baris dari
    // state lokal sehingga data kembali muncul setelah refresh. Kedua tab
    // kini memanggil endpoint soft delete subcon inventory.
    if (useApi) {
      deleteSubconInventory(deletingRow.id)
        .unwrap()
        .then(() => Promise.all([refetchVendorRows(), refetchReceivedRows()]))
        .catch(() => undefined)
        .finally(() => closeDelete());
      return;
    }
    if (deletingMode === "Stock In Vendor") {
      setRowsVendor((prev) => prev.filter((r) => r.id !== deletingRow.id));
    } else {
      setRowsReceived((prev) => prev.filter((r) => r.id !== deletingRow.id));
    }
    closeDelete();
  };

  const openEdit = (row: SubConRow) => {
    setEditingRow(row);
    setEditingMode(mode);
    setEditOpen(true);
    editForm.setFieldsValue({
      deliveryNotesNumber: row.deliveryNotesNumber,
      uniq: row.uniq,
      partNumber: row.partNumber,
      partName: row.partName,
      period: row.period,
      dateDelivery: row.dateDelivery,
      subconVendor: row.subconVendor,
      stockDate: row.stockDate,
      totalStock: row.totalStock,
      totalPO: row.totalPO,
    });
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditingRow(null);
    editForm.resetFields();
  };

  const saveEdit = async () => {
    if (!editingRow) return;
    const values = await editForm.validateFields();
    const next: SubConRow = {
      ...editingRow,
      deliveryNotesNumber: values.deliveryNotesNumber,
      uniq: values.uniq,
      partNumber: values.partNumber,
      partName: values.partName,
      period: values.period,
      dateDelivery: values.dateDelivery,
      subconVendor: values.subconVendor,
      stockDate: Number(values.stockDate ?? 0),
      totalStock: Number(values.totalStock ?? 0),
      totalPO: Number(values.totalPO ?? editingRow.totalPO ?? 0),
    };

    next.deltaPoStock = Math.max(0, next.totalPO - next.totalStock);

    if (useApi && editingMode === "Stock Received from Vendor") {
      try {
        await updateSubcon({
          id: editingRow.id,
          body: {
            uniq: next.uniq,
            item_name: next.partName,
            quantity: Number(next.totalStock ?? next.stockDate ?? 0),
            reference_no: next.deliveryNotesNumber,
          },
        }).unwrap();
        await refetchApiRows();
      } finally {
        closeEdit();
      }
      return;
    }

    if (editingMode === "Stock In Vendor") {
      setRowsVendor((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    } else {
      setRowsReceived((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    }
    closeEdit();
  };

  const stockInVendorColumns: ColumnsType<SubConRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      width: 100,
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      width: 220,
    },
    {
      title: "Subcon Vendor",
      dataIndex: "subconVendor",
      key: "subconVendor",
      width: 180,
    },
    {
      title: "Period",
      dataIndex: "period",
      key: "period",
      width: 110,
    },
    {
      title: "Date Delivery",
      dataIndex: "dateDelivery",
      key: "dateDelivery",
      width: 130,
    },
    {
      title: "Stock/Date",
      dataIndex: "stockDate",
      key: "stockDate",
      width: 110,
      align: "right",
    },
    {
      title: "Total Stock",
      dataIndex: "totalStock",
      key: "totalStock",
      width: 110,
      align: "right",
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "Total PO",
      dataIndex: "totalPO",
      key: "totalPO",
      width: 100,
      align: "right",
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "ΔPO-Stock",
      dataIndex: "deltaPoStock",
      key: "deltaPoStock",
      width: 120,
      align: "right",
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: SubConRow["status"]) =>
        v === "LOW STOCK" ? (
          <Tag className="bg-red-50 text-red-600">LOW STOCK</Tag>
        ) : (
          <Tag className="bg-green-50 text-green-600">NORMAL</Tag>
        ),
    },
    // {
    //   title: "DN Logs",
    //   key: "dnLogs",
    //   width: 110,
    //   render: (_: unknown, r: SubConRow) => (
    //     <Button type="link" className="px-0">
    //       View ({r.dnLogs})
    //     </Button>
    //   ),
    // },
    {
      title: "Approval",
      key: "approval",
      width: 120,
      render: (_: unknown, r: SubConRow) => {
        const s = r.approvalStatus ?? "approved";
        if (s === "approved")
          return <Tag className="bg-green-50 text-green-600">APPROVED</Tag>;
        if (s === "rejected")
          return <Tag className="bg-red-50 text-red-600">REJECTED</Tag>;
        return <Tag className="bg-amber-50 text-amber-600">PENDING</Tag>;
      },
    },
    {
      title: "Action",
      key: "action",
      width: 170,
      fixed: "right",
      render: (_: unknown, r: SubConRow) => (
        <div className="flex items-center gap-1">
          {(r.approvalStatus ?? "approved") === "pending" && (
            <>
              <Popconfirm
                title="Approve this item?"
                okText="Approve"
                cancelText="Cancel"
                onConfirm={() => handleApprove(r)}
              >
                <Button
                  type="text"
                  icon={<CheckOutlined />}
                  title="Approve"
                  loading={approving}
                  className="text-green-600 hover:text-green-800"
                />
              </Popconfirm>
              <Popconfirm
                title="Reject this item?"
                okText="Reject"
                okButtonProps={{ danger: true }}
                cancelText="Cancel"
                onConfirm={() => handleReject(r)}
              >
                <Button
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  title="Reject"
                  loading={rejecting}
                />
              </Popconfirm>
            </>
          )}
          <Button
            type="text"
            icon={<EyeOutlined />}
            className="text-blue-600 hover:text-blue-800"
            onClick={() =>
              router.push(`/sub-con-materials/detail?id=${encodeURIComponent(String(r.id))}&uniq=${encodeURIComponent(r.uniq)}`)
            }
          />
          <PrintButton
            type="text"
            icon={<QrcodeOutlined />}
            title="Print"
            className="text-gray-600 hover:text-blue-600"
            loadOptions={() => handleGenerateQR(r, false)}
          />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => openDelete(r)} />
        </div>
      ),
    },
  ];

  const stockReceivedColumns: ColumnsType<SubConRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      width: 100,
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      width: 220,
    },
    {
      title: "Subcon Vendor",
      dataIndex: "subconVendor",
      key: "subconVendor",
      width: 180,
    },
    {
      title: "Period",
      dataIndex: "period",
      key: "period",
      width: 110,
    },
    {
      title: "Date Received",
      dataIndex: "dateDelivery",
      key: "dateReceived",
      width: 130,
    },
    {
      title: "Received/Date",
      dataIndex: "stockDate",
      key: "receivedDate",
      width: 130,
      align: "right",
    },
    {
      title: "Total Received",
      dataIndex: "totalStock",
      key: "totalReceived",
      width: 130,
      align: "right",
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "Total PO",
      dataIndex: "totalPO",
      key: "totalPO",
      width: 110,
      align: "right",
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "ΔPO-Received",
      dataIndex: "deltaPoStock",
      key: "deltaPoReceived",
      width: 140,
      align: "right",
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: SubConRow["status"]) =>
        v === "LOW STOCK" ? (
          <Tag className="bg-red-50 text-red-600">LOW STOCK</Tag>
        ) : (
          <Tag className="bg-green-50 text-green-600">NORMAL</Tag>
        ),
    },
    {
      title: "Approval",
      key: "approval",
      width: 120,
      render: (_: unknown, r: SubConRow) => {
        const s = r.approvalStatus ?? "approved";
        if (s === "approved")
          return <Tag className="bg-green-50 text-green-600">APPROVED</Tag>;
        if (s === "rejected")
          return <Tag className="bg-red-50 text-red-600">REJECTED</Tag>;
        return <Tag className="bg-amber-50 text-amber-600">PENDING</Tag>;
      },
    },
    {
      title: "Action",
      key: "action",
      width: 170,
      fixed: "right",
      render: (_: unknown, r: SubConRow) => (
        <div className="flex items-center gap-1">
          {(r.approvalStatus ?? "approved") === "pending" && (
            <>
              <Popconfirm
                title="Approve this item?"
                okText="Approve"
                cancelText="Cancel"
                onConfirm={() => handleApprove(r)}
              >
                <Button
                  type="text"
                  icon={<CheckOutlined />}
                  title="Approve"
                  loading={approving}
                  className="text-green-600 hover:text-green-800"
                />
              </Popconfirm>
              <Popconfirm
                title="Reject this item?"
                okText="Reject"
                okButtonProps={{ danger: true }}
                cancelText="Cancel"
                onConfirm={() => handleReject(r)}
              >
                <Button
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  title="Reject"
                  loading={rejecting}
                />
              </Popconfirm>
            </>
          )}
          <Button
            type="text"
            icon={<EyeOutlined />}
            className="text-blue-600 hover:text-blue-800"
            onClick={() =>
              router.push(`/sub-con-materials/detail?id=${encodeURIComponent(String(r.id))}&uniq=${encodeURIComponent(r.uniq)}`)
            }
          />
          <PrintButton
            type="text"
            icon={<QrcodeOutlined />}
            title="Print"
            className="text-gray-600 hover:text-blue-600"
            loadOptions={() => handleGenerateQR(r, true)}
          />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => openDelete(r)} />
        </div>
      ),
    },
  ];

  const columns = mode === "Stock In Vendor" ? stockInVendorColumns : stockReceivedColumns;

  return (
    <div className="p-6 space-y-4">
      <Modal
        title="Delete item?"
        open={deleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmDelete}
        onCancel={closeDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{deletingRow?.uniq}</span>.
        </div>
      </Modal>

      <Drawer
        title="Edit"
        placement="right"
        open={editOpen}
        onClose={closeEdit}
        width={420}
        destroyOnHidden
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeEdit}>Cancel</Button>
            <Button type="primary" onClick={saveEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="Delivery Notes Number" name="deliveryNotesNumber">
            <Select
              placeholder="Select delivery note"
              options={dnOptions}
              showSearch
              allowClear
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item label="Uniq" name="uniq" rules={[{ required: true }]}>
            <Select
              placeholder="Select uniq"
              options={uniqOptions}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item label="Part Number" name="partNumber" rules={[{ required: true }]}>
            <Input placeholder="Part number" />
          </Form.Item>

          <Form.Item label="Part Name" name="partName" rules={[{ required: true }]}>
            <Input placeholder="Part name" />
          </Form.Item>

          <Form.Item label="Period PO" name="period" rules={[{ required: true }]}>
            <Select
              placeholder="Select period"
              options={availablePeriods.map((p) => ({ label: p, value: p }))}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item label="Date Delivery" name="dateDelivery" rules={[{ required: true }]}>
            <Input placeholder="Date delivery" />
          </Form.Item>

          <Form.Item label="Quantity Delivery Items" name="stockDate" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={0} />
          </Form.Item>

          <Form.Item label="Subcon Vendor Name" name="subconVendor" rules={[{ required: true }]}>
            <Input placeholder="Vendor" />
          </Form.Item>

          <Form.Item label="Add Stock" name="totalStock" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={0} />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title="Filter by Period"
        open={periodModalOpen}
        okText="Apply"
        cancelText="Cancel"
        onOk={() => setPeriodModalOpen(false)}
        onCancel={() => setPeriodModalOpen(false)}
      >
        <div className="space-y-3">
          <div className="text-gray-600">Select a period to filter the list.</div>
          <Select
            placeholder="Choose period"
            value={periodFilter ?? undefined}
            allowClear
            className="w-full"
            options={availablePeriods.map((p) => ({ label: p, value: p }))}
            onChange={(v) => setPeriodFilter(v ?? null)}
          />
        </div>
      </Modal>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sub Con Material Database</h1>
          <p className="text-gray-600">Track inventory managed by subcontractors</p>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            router.push("/sub-con-materials/create");
          }}
        >
          Add Stock Data
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4">
          <Segmented
            value={mode}
            onChange={(v) => {
              setMode(v as ViewMode);
              setPeriodFilter(null);
            }}
            options={["Stock In Vendor", "Stock Received from Vendor"]}
            block
          />

          <div className="mt-4 flex items-center gap-3 justify-between flex-wrap">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by UNIQ, part name, or vendor..."
              prefix={<SearchOutlined className="text-gray-400" />}
              className="max-w-xl"
            />

            <div className="flex items-center gap-2">
              {mode === "Stock Received from Vendor" ? (
                <Button icon={<FilterOutlined />} onClick={() => setPeriodModalOpen(true)}>
                  Filter by Period
                </Button>
              ) : (
                <>
                  <Button icon={<FilterOutlined />}>Filter by PO</Button>
                  <Button>Create DN for Subcon</Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 pt-0">
          <Table<SubConRow>
            columns={columns}
            dataSource={filtered}
            rowKey="id"
            loading={mode === "Stock In Vendor" ? apiVendorLoading : apiReceivedLoading}
            pagination={false}
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>
    </div>
  );
}
