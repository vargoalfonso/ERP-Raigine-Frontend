"use client";

import { apiBaseUrl } from "@/lib/api/instance";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Form,
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
  useGetProductReturnListQuery,
  useUpdateProductReturnMutation,
} from "@/lib/api/product-return/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";

type ReturnTab = "pending" | "qc" | "history";

type ProductReturnRow = {
  key: string;
  id: string;
  returnId: string;
  date: string;
  uniq: string;
  dnNumber?: string;
  scrapQty: number;
  reworkQty: number;
  status: string;
  statusLabel: "Pending QC" | "QC Approved" | "Rework WO Created" | "Rejected" | "Unknown";
};

type SubmitFormValues = {
  uniqId: string;
  dnNumber: string;
  scrapQty: number;
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
  const apiEnabled = Boolean(apiBaseUrl);
  const [tab, setTab] = useState<ReturnTab>("pending");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = Form.useForm<SubmitFormValues>();
  const [createProductReturn] = useCreateProductReturnMutation();
  const [updateProductReturn, { isLoading: decisionLoading }] = useUpdateProductReturnMutation();

  const listQuery = useGetProductReturnListQuery(
    { page, limit },
    { skip: !apiEnabled },
  );
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data],
  );

  const apiErrorMessage = useMemo(() => {
    const err = listQuery.error;
    return err ? getApiErrorMessage(err, "Failed to load product returns") : "";
  }, [listQuery.error]);

  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | string>("all");

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

    const normalizeStatus = (value: string): { raw: string; label: ProductReturnRow["statusLabel"] } => {
      const raw = (value || "").trim();
      const v = raw.toUpperCase();
      if (v.includes("APPROV")) return { raw: "APPROVED", label: "QC Approved" };
      if (v.includes("REJECT")) return { raw: "REJECTED", label: "Rejected" };
      if (v.includes("REWORK")) return { raw: "REWORK_WO_CREATED", label: "Rework WO Created" };
      if (v.includes("PENDING")) return { raw: "PENDING", label: "Pending QC" };
      if (!raw) return { raw: "PENDING", label: "Pending QC" };
      return { raw: v, label: "Unknown" };
    };

    const items = listQuery.data?.data.items ?? [];

    return items.map((it, idx) => {
      const r = it as Record<string, unknown>;
      const backendId = pickStr(r.id, r.uuid, r.return_id, r.returnId);
      const returnId = pickStr(r.return_id, r.returnId, r.id, r.uuid) || `RET-${String(idx + 1).padStart(3, "0")}`;
      const date = normalizeDate(pickStr(r.date, r.date_received, r.dateReceived, r.created_at, r.createdAt));
      const status = normalizeStatus(pickStr(r.status, "PENDING"));
      const uniq = pickStr(r.uniq, r.uniq_id, r.uniqId) || "-";
      const dnNumber = pickStr(r.dn_number, r.dnNumber) || undefined;

      return {
        key: backendId || returnId,
        id: backendId || returnId,
        returnId,
        date,
        uniq,
        dnNumber,
        scrapQty: pickNum(r.quantity_scrap, r.scrap_qty, r.scrapQty, r.scrap_quantity),
        reworkQty: pickNum(r.quantity_rework, r.rework_qty, r.reworkQty, r.rework_quantity),
        status: status.raw,
        statusLabel: status.label,
      };
    });
  }, [listQuery.data?.data.items]);

  const uniqCatalog = useMemo(
    () => {
      if (bomIndex.uniqs.length > 0) {
        return bomIndex.uniqs.map((uniqId) => ({
          uniqId,
          partNo: bomIndex.partNumberByUniq[uniqId] ?? "",
          partName: bomIndex.partNameByUniq[uniqId] ?? "",
          model: bomIndex.assemblyCodeByUniq[uniqId] ?? "",
          packingNumber: bomIndex.packingNumberByUniq[uniqId] ?? "",
        }));
      }

      return [
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
      ];
    },
    [
      bomIndex.assemblyCodeByUniq,
      bomIndex.partNameByUniq,
      bomIndex.partNumberByUniq,
      bomIndex.packingNumberByUniq,
      bomIndex.uniqs,
    ],
  );

  const pendingRows = useMemo(() => rows.filter((r) => r.status === "PENDING"), [rows]);
  const qcRows = pendingRows;
  const historyRows = useMemo(() => {
    const base = [...rows];
    base.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const historyOnly = base.filter((r) => r.status !== "PENDING");
    return historyStatusFilter === "all" ? historyOnly : historyOnly.filter((r) => r.status === historyStatusFilter);
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
    const totalReturns = rows.length;
    const pendingQC = rows.filter((r) => r.status === "PENDING").length;
    const qcApproved = rows.filter((r) => r.status === "APPROVED").length;
    const reworkCreated = rows.filter((r) => r.status === "REWORK_WO_CREATED").length;
    return { totalReturns, pendingQC, qcApproved, reworkCreated };
  }, [rows]);

  const columns = useMemo<ColumnsType<ProductReturnRow>>(() => {
    const statusTag = (v: ProductReturnRow["statusLabel"]) => (
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
        title: "Uniq",
        dataIndex: "uniq",
        key: "uniq",
        render: (v: string) => <Tag className="!rounded-md !px-2 !py-0.5 !text-xs">{v}</Tag>,
      },
      {
        title: "DN Number",
        dataIndex: "dnNumber",
        key: "dnNumber",
        render: (v?: string) => (v ? <span className="text-sm text-slate-700">{v}</span> : <span className="text-sm text-slate-400">-</span>),
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
                  if (!r.uniq || r.uniq === "-" || !r.dnNumber) {
                    message.error("Missing uniq or DN number");
                    return;
                  }

                  updateProductReturn({
                    id: r.id,
                    body: {
                      uniq: r.uniq,
                      dn_number: r.dnNumber,
                      quantity_scrap: Number(r.scrapQty ?? 0),
                      quantity_rework: Number(r.reworkQty ?? 0),
                      status: "APPROVED",
                    },
                  })
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
                  if (!r.uniq || r.uniq === "-" || !r.dnNumber) {
                    message.error("Missing uniq or DN number");
                    return;
                  }

                  updateProductReturn({
                    id: r.id,
                    body: {
                      uniq: r.uniq,
                      dn_number: r.dnNumber,
                      quantity_scrap: Number(r.scrapQty ?? 0),
                      quantity_rework: Number(r.reworkQty ?? 0),
                      status: "REJECTED",
                    },
                  })
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
          dataIndex: "statusLabel",
          key: "status",
          render: (v: ProductReturnRow["statusLabel"]) => statusTag(v),
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
        dataIndex: "statusLabel",
        key: "status",
        render: (v: ProductReturnRow["statusLabel"]) => statusTag(v),
        width: 160,
      },
      ...base.slice(6),
    ];
  }, [decisionLoading, tab, updateProductReturn]);

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
                scrapQty: 0,
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
                  onClick={() => {
                    setTab(t.id);
                    setPage(1);
                  }}
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
                { label: "QC Approved", value: "APPROVED" },
                { label: "Rework WO Created", value: "REWORK_WO_CREATED" },
                { label: "Rejected", value: "REJECTED" },
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
            pagination={{
              current: page,
              pageSize: limit,
              total: listQuery.data?.data.pagination.total ?? listQuery.data?.data.items.length ?? 0,
              showSizeChanger: true,
              onChange: (nextPage, nextSize) => {
                setPage(nextPage);
                if (typeof nextSize === "number" && nextSize > 0) setLimit(nextSize);
              },
            }}
            loading={listQuery.isFetching}
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
            <div className="text-xs text-slate-500 mt-0.5">Create a new product return request</div>
          </div>
        }
        width={520}
        destroyOnHidden
        maskClosable={!submitLoading}
        okText="Submit to QC"
        cancelText="Cancel"
        okButtonProps={{ loading: submitLoading }}
        onOk={async () => {
          try {
            setSubmitLoading(true);
            const values = await form.validateFields();
            await createProductReturn({
              uniq: values.uniqId,
              dn_number: values.dnNumber,
              quantity_scrap: Number(values.scrapQty ?? 0),
              quantity_rework: Number(values.reworkQty ?? 0),
              status: "PENDING",
            }).unwrap();

            setTab("pending");
            setIsSubmitOpen(false);
            message.success("Submitted to QC");
            listQuery.refetch();
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
            <Form.Item label="Uniq ID" name="uniqId" rules={[{ required: true, message: "Select uniq" }]}>
              <Select
                placeholder="Choose uniq"
                allowClear
                options={uniqCatalog.map((u) => ({ label: u.uniqId, value: u.uniqId }))}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </Form.Item>

            <Form.Item label="DN Number" name="dnNumber" rules={[{ required: true, message: "Input DN number" }]}>
              <Select placeholder="Input DN number" options={[{ label: "DN-0001", value: "DN-0001" }, { label: "DN-0002", value: "DN-0002" }]} />
            </Form.Item>
          </div>

          <Form.Item label="Quantity of Scrap" name="scrapQty" rules={[{ required: true, message: "Enter scrap qty" }]}>
            <InputNumber min={0} className="!w-full" placeholder="Enter scrap quantity" />
          </Form.Item>

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
