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
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FilterOutlined,
  PlusOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import {
  useCreateProductReturnMutation,
  useDecideProductReturnMutation,
  useGetProductReturnHistoryQuery,
  useGetProductReturnPendingQuery,
} from "@/lib/api/product-return/api";
import { getApiErrorMessage } from "@/lib/api/error";

type ReturnTab = "pending" | "qc" | "history";

type ProductReturnRow = {
  key: string;
  id: string;
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
  uniqId: string;
  partNo?: string;
  partName?: string;
  model?: string;
  packingNumber?: string;
  dnNumber?: string;
  dateReceived?: unknown;
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
  const [createProductReturn] = useCreateProductReturnMutation();
  const [decideProductReturn, { isLoading: decisionLoading }] = useDecideProductReturnMutation();

  const pendingQuery = useGetProductReturnPendingQuery();
  const historyQuery = useGetProductReturnHistoryQuery();

  const apiErrorMessage = useMemo(() => {
    const err = pendingQuery.error ?? historyQuery.error;
    return err ? getApiErrorMessage(err, "Failed to load product returns") : "";
  }, [pendingQuery.error, historyQuery.error]);

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

  const rows = useMemo<ProductReturnRow[]>(() => {
    const pickStr = (...candidates: unknown[]): string => {
      for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c;
      }
      return "";
    };
    const pickNum = (...candidates: unknown[]): number => {
      for (const c of candidates) {
        if (typeof c === "number" && Number.isFinite(c)) return c;
        if (typeof c === "string" && c.trim() && Number.isFinite(Number(c))) return Number(c);
      }
      return 0;
    };

    const normalizeDate = (value: string): string => {
      const v = value.trim();
      if (!v) return "-";
      // ISO-like values
      if (v.length >= 10 && v[4] === "-" && v[7] === "-") return v.slice(0, 10);
      return v;
    };

    const normalizeStatus = (value: string): ProductReturnRow["status"] => {
      const v = value.toLowerCase();
      if (v.includes("approve")) return "QC Approved";
      if (v.includes("reject")) return "Rejected";
      if (v.includes("rework")) return "Rework WO Created";
      return "Pending QC";
    };

    const pendingItems = pendingQuery.data?.data ?? [];
    const historyItems = historyQuery.data?.data ?? [];
    const items = tab === "history" ? historyItems : pendingItems;

    return items.map((it, idx) => {
      const r = it as Record<string, unknown>;
      const backendId = pickStr(r.id, r.uuid, r.return_id, r.returnId);
      const returnId = pickStr(r.return_id, r.returnId, r.id, r.uuid) || `RET-${String(idx + 1).padStart(3, "0")}`;
      const date = normalizeDate(pickStr(r.date, r.date_received, r.dateReceived, r.created_at, r.createdAt));
      const status = normalizeStatus(pickStr(r.status, "pending"));

      return {
        key: backendId || returnId,
        id: backendId || returnId,
        returnId,
        date,
        partNo: pickStr(r.part_no, r.partNo, r.part_number, r.partNumber) || "-",
        partName: pickStr(r.part_name, r.partName) || "-",
        kanban: pickStr(r.kanban) || "-",
        scrapQty: pickNum(r.quantity_scrap, r.scrap_qty, r.scrapQty, r.scrap_quantity),
        reworkQty: pickNum(r.quantity_rework, r.rework_qty, r.reworkQty, r.rework_quantity),
        status,
        submittedBy: pickStr(r.submitted_by, r.submittedBy) || "-",
        model: pickStr(r.model) || undefined,
        dnNumber: pickStr(r.dn_number, r.dnNumber) || undefined,
        weight: (() => {
          const w = pickNum(r.weight);
          return w ? w : undefined;
        })(),
        scrapType: pickStr(r.scrap_type, r.scrapType) || undefined,
      };
    });
  }, [pendingQuery.data, historyQuery.data, tab]);

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
    return historyStatusFilter === "all" ? base : base.filter((r) => r.status === historyStatusFilter);
  }, [rows, historyStatusFilter]);

  const tableRows = useMemo(() => {
    if (tab === "pending") return pendingRows;
    if (tab === "qc") return qcRows;
    return historyRows;
  }, [historyRows, pendingRows, qcRows, tab]);

  const openDetail = (id: string) => {
    router.push(`/product-return/detail/${encodeURIComponent(id)}`);
  };

  const kpis = useMemo(() => {
    // If history isn't loaded yet, fall back to pending as a partial picture.
    const base = (historyQuery.data?.data?.length ? historyQuery.data.data : pendingQuery.data?.data) ?? [];
    const totalReturns = base.length;
    const mapped = rows;
    const pendingQC = mapped.filter((r) => r.status === "Pending QC").length;
    const qcApproved = mapped.filter((r) => r.status === "QC Approved").length;
    const reworkCreated = mapped.filter((r) => r.status === "Rework WO Created").length;
    return { totalReturns, pendingQC, qcApproved, reworkCreated };
  }, [historyQuery.data, pendingQuery.data, rows]);

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
          <Button size="small" className="!rounded-lg" icon={<EyeOutlined />} onClick={() => openDetail(r.id)} />
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
                loading={decisionLoading}
                onClick={() => {
                  decideProductReturn({ id: r.id, decision: "approve" })
                    .unwrap()
                    .then(() => message.success(`${r.returnId} approved`))
                    .catch((e) => message.error(getApiErrorMessage(e, "Failed to approve")));
                }}
              >
                ✓ Approve
              </Button>
              <Button
                size="small"
                danger
                className="!rounded-lg"
                loading={decisionLoading}
                onClick={() => {
                  decideProductReturn({ id: r.id, decision: "reject" })
                    .unwrap()
                    .then(() => message.success(`${r.returnId} rejected`))
                    .catch((e) => message.error(getApiErrorMessage(e, "Failed to reject")));
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

      {apiErrorMessage ? (
        <div className="mb-4">
          <Alert type="error" showIcon message={apiErrorMessage} className="!rounded-xl" />
        </div>
      ) : null}

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
            loading={pendingQuery.isFetching || historyQuery.isFetching}
            locale={{ emptyText: "No returns" }}
            onRow={(record) => ({
              onDoubleClick: () => {
                openDetail(record.id);
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

            await createProductReturn({
              kanban: values.kanban,
              uniq: values.uniqId,
              part_no: values.partNo,
              part_name: values.partName,
              model: values.model,
              packing_number: values.packingNumber,
              dn_number: values.dnNumber,
              date_received: dateStr,
              quantity_scrap: Number(values.scrapQty ?? 0),
              weight: values.weight,
              unit: values.unit,
              quantity_rework: Number(values.reworkQty ?? 0),
              submitted_by: "Admin PPIC",
            }).unwrap();

            setTab("pending");
            setIsSubmitOpen(false);
            message.success("Submitted to QC");
            pendingQuery.refetch();
            historyQuery.refetch();
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

            <Form.Item label="Uniq ID" name="uniqId" rules={[{ required: true, message: "Select uniq" }]}>
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

          <Form.Item label="Scrap Type">
            <Input value="Product Return" disabled />
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
    </div>
  );
}
