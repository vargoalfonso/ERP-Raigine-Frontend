"use client";

import React, { useMemo, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FilterOutlined,
  PlusOutlined,
  ToolOutlined,
} from "@ant-design/icons";

type ReturnTab = "pending" | "qc" | "history";

type ProductReturnRow = {
  key: string;
  returnId: string;
  date: string;
  partNo: string;
  partName: string;
  kanban: string;
  scrapQty: number;
  reworkQty: number;
  status: "Pending QC" | "QC Approved" | "Rework WO Created" | "Rejected";
  submittedBy: string;
  model?: string;
  dnNumber?: string;
  weight?: number;
  scrapType?: string;
};

type SubmitFormValues = {
  kanban: string;
  uniqId?: string;
  partNo?: string;
  partName?: string;
  model?: string;
  packingNumber?: string;
  dnNumber?: string;
  dateReceived?: unknown;
  scrapType: "Product Return";
  scrapQty: number;
  weight?: number;
  unit: "Pcs";
  reworkQty: number;
};

function StatCard(props: {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
  accent: string;
}) {
  const { label, value, hint, icon, accent } = props;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
        <div className="text-xs text-gray-400 mt-1">{hint}</div>
      </div>
      <div className={"h-10 w-10 rounded-lg flex items-center justify-center " + accent}>{icon}</div>
    </div>
  );
}

export default function ProductReturnPage() {
  const router = useRouter();
  const [tab, setTab] = useState<ReturnTab>("pending");
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = Form.useForm<SubmitFormValues>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailReturnId, setDetailReturnId] = useState<string | null>(null);

  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "all" | ProductReturnRow["status"]
  >("all");

  const tabs = useMemo(
    () => [
      { id: "pending" as const, label: "Pending Validation" },
      { id: "qc" as const, label: "QC Validation" },
      { id: "history" as const, label: "Return History" },
    ],
    []
  );

  const [rows, setRows] = useState<ProductReturnRow[]>([
    {
      key: "ret-001",
      returnId: "RET-001",
      date: "2024-12-15",
      partNo: "PN-45678",
      partName: "Bearing Assembly",
      kanban: "KB-123456",
      scrapQty: 25,
      reworkQty: 20,
      status: "Pending QC",
      submittedBy: "John Doe",
      model: "Model-XYZ",
      dnNumber: "DN-123456",
      weight: 500,
      scrapType: "Product Return",
    },
    {
      key: "ret-002",
      returnId: "RET-002",
      date: "2024-12-14",
      partNo: "PN-56789",
      partName: "Gear Housing",
      kanban: "KB-234567",
      scrapQty: 10,
      reworkQty: 8,
      status: "QC Approved",
      submittedBy: "Jane Smith",
      model: "Model-GH",
      dnNumber: "DN-234567",
      weight: 350,
      scrapType: "Product Return",
    },
    {
      key: "ret-003",
      returnId: "RET-003",
      date: "2024-12-13",
      partNo: "PN-67890",
      partName: "Motor Shaft",
      kanban: "KB-345678",
      scrapQty: 15,
      reworkQty: 12,
      status: "Rework WO Created",
      submittedBy: "Mike Johnson",
      model: "Model-MS",
      dnNumber: "DN-345678",
      weight: 420,
      scrapType: "Product Return",
    },
    {
      key: "ret-004",
      returnId: "RET-004",
      date: "2024-12-16",
      partNo: "PN-78901",
      partName: "Hydraulic Cylinder",
      kanban: "KB-456789",
      scrapQty: 5,
      reworkQty: 3,
      status: "Pending QC",
      submittedBy: "Sarah Williams",
      model: "Model-HC",
      dnNumber: "DN-456789",
      weight: 250,
      scrapType: "Product Return",
    },
    {
      key: "ret-005",
      returnId: "RET-005",
      date: "2024-12-12",
      partNo: "PN-89012",
      partName: "Valve Assembly",
      kanban: "KB-567890",
      scrapQty: 8,
      reworkQty: 6,
      status: "Rejected",
      submittedBy: "Tom Davis",
      model: "Model-VA",
      dnNumber: "DN-567890",
      weight: 200,
      scrapType: "Product Return",
    },
  ]);

  const uniqCatalog = useMemo(
    () =>
      [
        {
          uniqId: "KBN-001-2024",
          partNo: "PN-45678",
          partName: "Bearing Assembly",
          model: "MDL-BA-01",
          packingNumber: "PK-001122",
        },
        {
          uniqId: "KBN-002-2024",
          partNo: "PN-78901",
          partName: "Hydraulic Cylinder",
          model: "MDL-HC-02",
          packingNumber: "PK-003344",
        },
      ] as const,
    []
  );

  const pendingRows = useMemo(() => rows.filter((r) => r.status === "Pending QC"), [rows]);
  const qcRows = pendingRows;
  const historyRows = useMemo(() => {
    const base = [...rows];
    base.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const filtered = historyStatusFilter === "all" ? base : base.filter((r) => r.status === historyStatusFilter);
    return filtered;
  }, [rows, historyStatusFilter]);

  const tableRows = useMemo(() => {
    if (tab === "pending") return pendingRows;
    if (tab === "qc") return qcRows;
    return historyRows;
  }, [historyRows, pendingRows, qcRows, tab]);
  const detailRow = useMemo(() => {
    if (!detailReturnId) return null;
    return rows.find((r) => r.returnId === detailReturnId) ?? null;
  }, [rows, detailReturnId]);

  const openDetail = (returnId: string) => {
    setDetailReturnId(returnId);
    setDetailOpen(true);
  };

  const kpis = useMemo(() => {
    const totalReturns = rows.length;
    const pendingQC = rows.filter((r) => r.status === "Pending QC").length;
    const qcApproved = rows.filter((r) => r.status === "QC Approved").length;
    const reworkCreated = rows.filter((r) => r.status === "Rework WO Created").length;
    return { totalReturns, pendingQC, qcApproved, reworkCreated };
  }, [rows]);

  const columns = useMemo<ColumnsType<ProductReturnRow>>(() => {
    const statusTag = (v: ProductReturnRow["status"]) => (
      <Tag
        color={v === "QC Approved" ? "blue" : v === "Pending QC" ? "gold" : v === "Rework WO Created" ? "purple" : "red"}
        className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
      >
        {v}
      </Tag>
    );

    const base: ColumnsType<ProductReturnRow> = [
      {
        title: "Return ID",
        dataIndex: "returnId",
        key: "returnId",
        render: (v: string) => <span className="text-sm font-semibold text-slate-800">{v}</span>,
        width: 110,
      },
      {
        title: "Date",
        dataIndex: "date",
        key: "date",
        render: (v: string) => (
          <span className="text-sm text-slate-700 inline-flex items-center gap-2">
            <CalendarOutlined className="text-slate-400" /> {v}
          </span>
        ),
        width: 140,
      },
      {
        title: "Part Info",
        key: "part",
        render: (_, r) => (
          <div className="leading-5">
            <div className="text-sm font-semibold text-slate-800">{r.partNo}</div>
            <div className="text-xs text-slate-500">{r.partName}</div>
          </div>
        ),
      },
      {
        title: "Kanban",
        dataIndex: "kanban",
        key: "kanban",
        render: (v: string) => <Tag className="!rounded-md !px-2 !py-0.5 !text-xs">{v}</Tag>,
        width: 140,
      },
      {
        title: "Scrap Qty",
        dataIndex: "scrapQty",
        key: "scrapQty",
        render: (v: number) => <span className="text-sm">{v} Pcs</span>,
        width: 120,
      },
      {
        title: "Rework Qty",
        dataIndex: "reworkQty",
        key: "reworkQty",
        render: (v: number) => <span className="text-sm">{v} Pcs</span>,
        width: 120,
      },
      { title: "Submitted By", dataIndex: "submittedBy", key: "submittedBy", width: 140 },
      {
        title: "Actions",
        key: "actions",
        align: "center",
        width: 80,
        render: (_, r) => (
          <Button size="small" className="!rounded-lg" icon={<EyeOutlined />} onClick={() => openDetail(r.returnId)} />
        ),
      },
    ];

    if (tab === "qc") {
      return [
        ...base,
        {
          title: "QC Actions",
          key: "qcActions",
          width: 200,
          render: (_, r) => (
            <div className="flex items-center justify-end gap-2">
              <Button
                size="small"
                className="!rounded-lg !border-green-200 !text-green-700"
                onClick={() => {
                  setRows((prev) => prev.map((x) => (x.returnId === r.returnId ? { ...x, status: "QC Approved" } : x)));
                  message.success(`${r.returnId} approved`);
                }}
              >
                ✓ Approve
              </Button>
              <Button
                size="small"
                danger
                className="!rounded-lg"
                onClick={() => {
                  setRows((prev) => prev.map((x) => (x.returnId === r.returnId ? { ...x, status: "Rejected" } : x)));
                  message.error(`${r.returnId} rejected`);
                }}
              >
                × Reject
              </Button>
            </div>
          ),
        },
      ];
    }

    if (tab === "history") {
      return [
        ...base.slice(0, 6),
        {
          title: "Status",
          dataIndex: "status",
          key: "status",
          render: (v: ProductReturnRow["status"]) => statusTag(v),
          width: 160,
        },
        ...base.slice(6),
      ];
    }

    // Pending Validation
    return [
      ...base.slice(0, 6),
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (v: ProductReturnRow["status"]) => statusTag(v),
        width: 160,
      },
      ...base.slice(6),
    ];
  }, [tab]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div>
          <div className="text-2xl font-bold text-gray-900">Product Return Management</div>
          <div className="text-sm text-gray-500 mt-1">Submit product returns for QC validation and track return status</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Returns" value={kpis.totalReturns} hint="All product returns" icon={<ToolOutlined />} accent="bg-blue-50 text-blue-600" />
        <StatCard label="Pending QC" value={kpis.pendingQC} hint="Awaiting validation" icon={<ClockCircleOutlined />} accent="bg-orange-50 text-orange-600" />
        <StatCard label="QC Approved" value={kpis.qcApproved} hint="Validated returns" icon={<CheckCircleOutlined />} accent="bg-green-50 text-green-600" />
        <StatCard label="Rework Created" value={kpis.reworkCreated} hint="WO generated" icon={<ToolOutlined />} accent="bg-gray-50 text-gray-700" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-base font-bold text-gray-900">Product Return Management</div>
            <div className="text-xs text-gray-500">Manage product returns and track QC validation status</div>
          </div>
          <Button
            type="primary"
            className="!rounded-lg"
            icon={<PlusOutlined />}
            onClick={() => {
              setIsSubmitOpen(true);
              form.setFieldsValue({
                kanban: "KB-123456",
                scrapType: "Product Return",
                scrapQty: 0,
                unit: "Pcs",
                reworkQty: 0,
              });
            }}
          >
            Submit New Return
          </Button>
        </div>

        <div className="mb-4">
          <div className="w-full inline-flex rounded-xl bg-gray-50 p-1 border border-gray-100">
            {tabs.map((t) => {
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={
                    "flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors " +
                    (isActive ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900")
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "qc" && (
          <div className="mb-4">
            <Alert
              type="info"
              showIcon
              message={<span className="font-semibold">QC Validation Process</span>}
              description="Review pending returns and approve or reject based on quality inspection. Approved items can generate rework work orders."
              className="!rounded-xl"
            />
          </div>
        )}

        {tab === "history" && (
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-600">
            <FilterOutlined className="text-slate-400" />
            <span className="font-medium">Filter by Status:</span>
            <Select
              value={historyStatusFilter}
              onChange={setHistoryStatusFilter}
              className="min-w-[160px]"
              options={[
                { label: "All Returns", value: "all" },
                { label: "Pending QC", value: "Pending QC" },
                { label: "QC Approved", value: "QC Approved" },
                { label: "Rework WO Created", value: "Rework WO Created" },
                { label: "Rejected", value: "Rejected" },
              ]}
            />
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-100">
          <Table<ProductReturnRow>
            dataSource={tableRows}
            columns={columns}
            rowKey="key"
            size="middle"
            pagination={false}
            locale={{ emptyText: "No returns" }}
            onRow={(record) => ({
              onDoubleClick: () => {
                openDetail(record.returnId);
              },
            })}
          />
        </div>
      </div>

      <Modal
        open={isSubmitOpen}
        onCancel={() => setIsSubmitOpen(false)}
        title={
          <div>
            <div className="text-sm font-bold text-slate-900">Submit Product Return</div>
            <div className="text-xs text-slate-500 mt-0.5">Scan kanban or manually enter product return information</div>
          </div>
        }
        width={520}
        destroyOnClose
        maskClosable={!submitLoading}
        okText="Submit to QC"
        cancelText="Cancel"
        okButtonProps={{ loading: submitLoading }}
        onOk={async () => {
          try {
            setSubmitLoading(true);
            const values = await form.validateFields();

            const nextNo = rows.length + 1;
            const nextReturnId = `RET-${String(nextNo).padStart(3, "0")}`;
            const dateReceived: unknown = values.dateReceived;
            let dateStr = "2024-12-16";
            if (dateReceived) {
              const maybeDayjs = dateReceived as { toDate?: () => Date };
              const dateObj =
                dateReceived instanceof Date
                  ? dateReceived
                  : typeof maybeDayjs.toDate === "function"
                    ? maybeDayjs.toDate()
                    : null;
              if (dateObj) {
                dateStr = dateObj.toISOString().slice(0, 10);
              }
            }

            const newRow: ProductReturnRow = {
              key: nextReturnId.toLowerCase(),
              returnId: nextReturnId,
              date: dateStr,
              partNo: values.partNo ?? "-",
              partName: values.partName ?? "-",
              kanban: values.kanban,
              scrapQty: Number(values.scrapQty ?? 0),
              reworkQty: Number(values.reworkQty ?? 0),
              status: "Pending QC",
              submittedBy: "Admin PPIC",
              model: values.model,
              dnNumber: values.dnNumber,
              weight: values.weight,
              scrapType: values.scrapType,
            };

            setRows((prev) => [newRow, ...prev]);
            setTab("pending");
            setIsSubmitOpen(false);
            message.success("Submitted to QC");
          } finally {
            setSubmitLoading(false);
          }
        }}
        footer={(_, { OkBtn, CancelBtn }) => (
          <div className="flex items-center justify-between gap-3">
            <div />
            <div className="flex items-center gap-2">
              <CancelBtn />
              <OkBtn />
            </div>
          </div>
        )}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item label="Kanban / Packing List" name="kanban" rules={[{ required: true, message: "Select kanban" }]}>
              <Select
                placeholder="Select kanban"
                options={[
                  { label: "KB-123456", value: "KB-123456" },
                  { label: "KB-456789", value: "KB-456789" },
                  { label: "KB-330012", value: "KB-330012" },
                ]}
              />
            </Form.Item>

            <Form.Item label="Uniq ID" name="uniqId">
              <Select
                placeholder="Choose uniq"
                allowClear
                options={uniqCatalog.map((u) => ({ label: u.uniqId, value: u.uniqId }))}
                onChange={(v) => {
                  const found = uniqCatalog.find((x) => x.uniqId === v);
                  if (!found) {
                    form.setFieldsValue({ partNo: undefined, partName: undefined, model: undefined, packingNumber: undefined });
                    return;
                  }
                  form.setFieldsValue({
                    partNo: found.partNo,
                    partName: found.partName,
                    model: found.model,
                    packingNumber: found.packingNumber,
                  });
                }}
              />
            </Form.Item>

            <Form.Item label="Part Number" name="partNo">
              <Input placeholder="Auto-filled by uniq chosen" />
            </Form.Item>
            <Form.Item label="Part Name" name="partName">
              <Input placeholder="Auto-filled by uniq chosen" />
            </Form.Item>
            <Form.Item label="Model" name="model">
              <Input placeholder="Auto-filled by uniq chosen" />
            </Form.Item>
            <Form.Item label="Packing Number" name="packingNumber">
              <Input placeholder="Auto-filled by uniq chosen" />
            </Form.Item>
            <Form.Item label="DN Number" name="dnNumber">
              <Select placeholder="Input DN number" options={[{ label: "DN-0001", value: "DN-0001" }, { label: "DN-0002", value: "DN-0002" }]} />
            </Form.Item>
          </div>

          <div className="mt-2 mb-2 text-sm font-semibold text-slate-800">Return Details</div>

          <Form.Item label="Date Received" name="dateReceived" rules={[{ required: true, message: "Choose date" }]}>
            <DatePicker className="!w-full" />
          </Form.Item>

          <Form.Item label="Scrap Type" name="scrapType" rules={[{ required: true }]}>
            <Select disabled options={[{ label: "Product Return", value: "Product Return" }]} />
          </Form.Item>

          <Form.Item label="Quantity of Scrap" name="scrapQty" rules={[{ required: true, message: "Enter scrap qty" }]}>
            <InputNumber min={0} className="!w-full" placeholder="Enter scrap quantity" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item label="Weight" name="weight">
              <InputNumber min={0} className="!w-full" placeholder="500" />
            </Form.Item>
            <Form.Item label="Unit" name="unit" rules={[{ required: true }]}>
              <Select options={[{ label: "Pcs", value: "Pcs" }]} />
            </Form.Item>
          </div>

          <Form.Item label="Quantity of Rework" name="reworkQty" rules={[{ required: true, message: "Enter rework qty" }]}>
            <InputNumber min={0} className="!w-full" placeholder="Enter items need to rework" />
          </Form.Item>

          <Alert
            type="warning"
            showIcon
            message={<span className="font-semibold">Note:</span>}
            description="This return will be sent to QC for validation. Defect and scrap databases will be updated after QC approval."
            className="!rounded-lg"
          />
        </Form>
      </Modal>

      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={520}
        footer={null}
        destroyOnClose
        title={
          <div>
            <div className="text-sm font-bold text-slate-900">
              Product Return Details{detailRow ? ` - ${detailRow.returnId}` : ""}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Complete information about this product return</div>
          </div>
        }
      >
        {!detailRow ? (
          <div className="text-sm text-slate-500">No detail found</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Status</div>
                <div className="text-sm text-slate-800 mt-1">{detailRow.status}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Return Date</div>
                <div className="text-sm text-slate-800 mt-1">{detailRow.date}</div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Product Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Part Name</div>
                  <div className="text-sm text-slate-800 mt-1">{detailRow.partName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Part Number</div>
                  <div className="text-sm text-slate-800 mt-1">{detailRow.partNo}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Kanban</div>
                  <div className="text-sm text-slate-800 mt-1">{detailRow.kanban}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Model</div>
                  <div className="text-sm text-slate-800 mt-1">{detailRow.model ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">DN Number</div>
                  <div className="text-sm text-slate-800 mt-1">{detailRow.dnNumber ?? "-"}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Return Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Scrap Quantity</div>
                  <div className="text-sm text-slate-800 mt-1">{detailRow.scrapQty} Pcs</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Rework Quantity</div>
                  <div className="text-sm text-slate-800 mt-1">{detailRow.reworkQty} Pcs</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Weight</div>
                  <div className="text-sm text-slate-800 mt-1">{typeof detailRow.weight === "number" ? `${detailRow.weight} Pcs` : "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Scrap Type</div>
                  <div className="text-sm text-slate-800 mt-1">{detailRow.scrapType ?? "Product Return"}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900 mb-2">Validation Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Submitted By</div>
                  <div className="text-sm text-slate-800 mt-1">{detailRow.submittedBy}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
