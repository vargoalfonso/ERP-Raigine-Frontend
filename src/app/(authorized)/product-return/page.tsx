"use client";

import { apiBaseUrl } from "@/lib/api/instance";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Button,
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
  LoadingOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import {
  useCreateProductReturnMutation,
  useGetProductReturnListQuery,
  useUpdateProductReturnMutation,
  useScanProductReturnMutation,
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
  weight?: number;
  uom?: string;
  dateReceived?: string;
  scrapType?: string;
  status: string;
  statusLabel:
    | "Pending QC"
    | "QC Approved"
    | "Rework WO Created"
    | "Rejected"
    | "Unknown";
  updatedAt?: string;
};

type SubmitFormValues = {
  kanban?: string;
  uniqId: string;
  partNumber?: string;
  partName?: string;
  model?: string;
  packingNumber?: string;
  dnNumber: string;
  scrapQty: number;
  reworkQty: number;
  dateReceived?: string;
  scrapType?: string;
  weight?: number;
  uom?: string;
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
      <div
        className={
          "h-10 w-10 rounded-lg flex items-center justify-center " + accent
        }
      >
        {icon}
      </div>
    </div>
  );
}

export default function ProductReturnPage() {
  const router = useRouter();
  const apiEnabled = Boolean(apiBaseUrl);
  const [tab, setTab] = useState<ReturnTab>("qc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = Form.useForm<SubmitFormValues>();
  const [createProductReturn] = useCreateProductReturnMutation();
  const [updateProductReturn, { isLoading: decisionLoading }] =
    useUpdateProductReturnMutation();
  const [scanProductReturn, { isLoading: scanLoading }] =
    useScanProductReturnMutation();

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

  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "all" | string
  >("all");
  const [historySortBy, setHistorySortBy] = useState<
    "date_approved_desc" | "date_approved_asc"
  >("date_approved_desc");

  const tabs = useMemo(
    () => [
      // { id: "pending" as const, label: "Pending Validation" },
      { id: "qc" as const, label: "QC Validation" },
      { id: "history" as const, label: "History Scrap Type" },
    ],
    [],
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
        if (typeof c === "string" && c.trim() && Number.isFinite(Number(c)))
          return Number(c);
      }
      return 0;
    };
    const pickId = (...candidates: unknown[]): string => {
      for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c;
        if (typeof c === "number" && Number.isFinite(c)) return String(c);
      }
      return "";
    };

    const normalizeDate = (value: string): string => {
      const v = value.trim();
      if (!v) return "-";
      // ISO-like values
      if (v.length >= 10 && v[4] === "-" && v[7] === "-") return v.slice(0, 10);
      return v;
    };

    const normalizeStatus = (
      value: string,
    ): { raw: string; label: ProductReturnRow["statusLabel"] } => {
      const raw = (value || "").trim();
      const v = raw.toUpperCase();
      if (v.includes("APPROV"))
        return { raw: "APPROVED", label: "QC Approved" };
      if (v.includes("REJECT")) return { raw: "REJECTED", label: "Rejected" };
      if (v.includes("REWORK"))
        return { raw: "REWORK_WO_CREATED", label: "Rework WO Created" };
      if (v.includes("PENDING")) return { raw: "PENDING", label: "Pending QC" };
      if (!raw) return { raw: "PENDING", label: "Pending QC" };
      return { raw: v, label: "Unknown" };
    };

    const items = listQuery.data?.data.items ?? [];

    return items.map((it, idx) => {
      const r = it as Record<string, unknown>;
      const backendId = pickId(r.id, r.uuid, r.return_id, r.returnId);
      const returnId =
        pickId(r.return_id, r.returnId, r.id, r.uuid) ||
        `RET-${String(idx + 1).padStart(3, "0")}`;
      const date = normalizeDate(
        pickStr(
          r.date,
          r.date_received,
          r.dateReceived,
          r.created_at,
          r.createdAt,
        ),
      );
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
        scrapQty: pickNum(
          r.quantity_scrap,
          r.scrap_qty,
          r.scrapQty,
          r.scrap_quantity,
        ),
        reworkQty: pickNum(
          r.quantity_rework,
          r.rework_qty,
          r.reworkQty,
          r.rework_quantity,
        ),
        weight: pickNum(r.weight),
        uom: pickStr(r.uom, r.unit) || undefined,
        dateReceived:
          pickStr(r.date_received, r.dateReceived, r.date) || undefined,
        scrapType: pickStr(r.scrap_type, r.scrapType) || "Product Return",
        status: status.raw,
        statusLabel: status.label,
        updatedAt: pickStr(r.updated_at, r.updatedAt, r.created_at, r.createdAt),
      };
    });
  }, [listQuery.data?.data.items]);

  const uniqCatalog = useMemo(() => {
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
  }, [
    bomIndex.assemblyCodeByUniq,
    bomIndex.partNameByUniq,
    bomIndex.partNumberByUniq,
    bomIndex.packingNumberByUniq,
    bomIndex.uniqs,
  ]);

  const pendingRows = useMemo(
    () => rows.filter((r) => r.status === "PENDING"),
    [rows],
  );
  const qcRows = pendingRows;
  const historyRows = useMemo(() => {
    const base = [...rows];
    base.sort((a, b) => {
      const da = a.updatedAt ?? "";
      const db = b.updatedAt ?? "";
      if (historySortBy === "date_approved_desc") {
        return da < db ? 1 : da > db ? -1 : 0;
      } else {
        return da > db ? 1 : da < db ? -1 : 0;
      }
    });
    const historyOnly = base.filter((r) => r.status !== "PENDING");
    return historyStatusFilter === "all"
      ? historyOnly
      : historyOnly.filter((r) => r.status === historyStatusFilter);
  }, [rows, historyStatusFilter, historySortBy]);

  const tableRows = useMemo(() => {
    // if (tab === "pending") return pendingRows;
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
    const reworkCreated = rows.filter(
      (r) => r.status === "REWORK_WO_CREATED",
    ).length;
    return { totalReturns, pendingQC, qcApproved, reworkCreated };
  }, [rows]);

  const columns = useMemo<ColumnsType<ProductReturnRow>>(() => {
    const statusTag = (v: ProductReturnRow["statusLabel"]) => {
      let colorClass = "bg-gray-100 text-gray-700 border-gray-200";
      if (v === "QC Approved") colorClass = "bg-blue-50 text-blue-700 border-blue-200";
      else if (v === "Pending QC") colorClass = "bg-yellow-50 text-yellow-700 border-yellow-200";
      else if (v === "Rework WO Created") colorClass = "bg-purple-50 text-purple-700 border-purple-200";
      else if (v === "Rejected") colorClass = "bg-red-50 text-red-700 border-red-200";

      return (
        <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${colorClass}`}>
          {v}
        </span>
      );
    };

    const base: ColumnsType<ProductReturnRow> = [
      // {
      //   title: "Return ID",
      //   dataIndex: "returnId",
      //   key: "returnId",
      //   render: (v: string) => (
      //     <span className="text-sm font-semibold text-slate-800">{v}</span>
      //   ),
      //   width: 110,
      // },
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
        render: (v: string) => (
          <span className="inline-block rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">{v}</span>
        ),
      },
      {
        title: "DN Number",
        dataIndex: "dnNumber",
        key: "dnNumber",
        render: (v?: string) =>
          v ? (
            <span className="text-sm text-slate-700">{v}</span>
          ) : (
            <span className="text-sm text-slate-400">-</span>
          ),
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
        title: "Scrap Type",
        dataIndex: "scrapType",
        key: "scrapType",
        render: (v?: string) => (
          <span className="text-sm text-slate-700">
            {v || "Product Return"}
          </span>
        ),
        width: 140,
      },
      {
        title: "Weight (Kg)",
        dataIndex: "weight",
        key: "weight",
        render: (v: number | undefined, r: ProductReturnRow) => (
          <span className="text-sm">{Number(v ?? 0)}</span>
        ),
        width: 110,
      },
      {
        title: "UOM",
        dataIndex: "uom",
        key: "uom",
        render: (v?: string) => (
          <span className="text-sm text-slate-700">{v || "-"}</span>
        ),
        width: 90,
      },
      {
        title: "Actions",
        key: "actions",
        align: "center",
        width: 80,
        render: (_, r) => (
          <Button
            size="small"
            className="!rounded-lg"
            icon={<EyeOutlined />}
            onClick={() => openDetail(r.id)}
          />
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
                      date_received: r.dateReceived,
                      scrap_type: r.scrapType,
                      weight: r.weight,
                      uom: r.uom,
                    },
                  })
                    .unwrap()
                    .then(() => message.success(`${r.returnId} approved`))
                    .catch((e) =>
                      message.error(getApiErrorMessage(e, "Failed to approve")),
                    );
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
                      date_received: r.dateReceived,
                      scrap_type: r.scrapType,
                      weight: r.weight,
                      uom: r.uom,
                    },
                  })
                    .unwrap()
                    .then(() => message.success(`${r.returnId} rejected`))
                    .catch((e) =>
                      message.error(getApiErrorMessage(e, "Failed to reject")),
                    );
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
      return [...base.slice(0, 9)];
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
          <div className="text-2xl font-bold text-gray-900">
            Product Return Management
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Submit product returns for QC validation and track return status
          </div>
        </div>
      </div>

      {apiErrorMessage ? (
        <div className="mb-4">
          <Alert
            type="error"
            showIcon
            message={apiErrorMessage}
            className="!rounded-xl"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Returns"
          value={kpis.totalReturns}
          hint="All product returns"
          icon={<ToolOutlined />}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Pending QC"
          value={kpis.pendingQC}
          hint="Awaiting validation"
          icon={<ClockCircleOutlined />}
          accent="bg-orange-50 text-orange-600"
        />
        <StatCard
          label="QC Approved"
          value={kpis.qcApproved}
          hint="Validated returns"
          icon={<CheckCircleOutlined />}
          accent="bg-green-50 text-green-600"
        />
        <StatCard
          label="Rework Created"
          value={kpis.reworkCreated}
          hint="WO generated"
          icon={<ToolOutlined />}
          accent="bg-gray-50 text-gray-700"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-base font-bold text-gray-900">
              Product Return Management
            </div>
            <div className="text-xs text-gray-500">
              Manage product returns and track QC validation status
            </div>
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
                dateReceived: new Date().toISOString().slice(0, 10),
                scrapType: "Product Return",
                weight: 0,
                uom: "KG",
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
                    (isActive
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-600 hover:text-gray-900")
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
              message={
                <span className="font-semibold">QC Validation Process</span>
              }
              description="Review pending returns and approve or reject based on quality inspection. Approved items can generate rework work orders."
              className="!rounded-xl"
            />
          </div>
        )}

        {tab === "history" && (
          <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <span className="font-medium">Sort by:</span>
              <Select
                value={historySortBy}
                onChange={setHistorySortBy}
                className="min-w-[180px]"
                options={[
                  { label: "Date Approved (Newest)", value: "date_approved_desc" },
                  { label: "Date Approved (Oldest)", value: "date_approved_asc" },
                ]}
              />
            </div>
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
              total:
                listQuery.data?.data.pagination.total ??
                listQuery.data?.data.items.length ??
                0,
              showSizeChanger: true,
              onChange: (nextPage, nextSize) => {
                setPage(nextPage);
                if (typeof nextSize === "number" && nextSize > 0)
                  setLimit(nextSize);
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
            <div className="text-sm font-bold text-slate-900">
              Submit Product Return
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Create a new product return request
            </div>
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
              date_received: values.dateReceived || undefined,
              scrap_type: values.scrapType || "Product Return",
              weight: Number(values.weight ?? 0),
              uom: values.uom || undefined,
            }).unwrap();

            setTab("qc");
            setIsSubmitOpen(false);
            message.success("Submitted to QC");
            listQuery.refetch();
          } catch (error) {
            message.error(getApiErrorMessage(error, "Failed to submit return"));
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
            <Form.Item label="Kanban / Packing List" name="kanban">
              <Input
                placeholder="Scan or input Kanban / DN"
                disabled={scanLoading}
                suffix={
                  scanLoading ? (
                    <LoadingOutlined className="text-blue-500" />
                  ) : null
                }
                onPressEnter={async (e) => {
                  e.preventDefault();
                  const val = (e.target as HTMLInputElement).value;
                  if (!val.trim()) return;
                  try {
                    const res = await scanProductReturn(val.trim()).unwrap();
                    const d = res.data;
                    if (!d) return;

                    const partNo = d.part_number || "";
                    if (!partNo) {
                      message.warning("Kanban/DN data not found!");
                      form.setFieldsValue({
                        uniqId: undefined,
                        partNumber: undefined,
                        partName: undefined,
                        model: undefined,
                        packingNumber: undefined,
                        dnNumber: undefined,
                      });
                      return;
                    }

                    const uniq = d.uniq_id || d.uniq || "";
                    const partNm = d.part_name || "";
                    const mod = d.model || "";
                    const packNo =
                      d.packing_number || d.kanban_packing_list || val.trim();
                    const sType = d.scrap_type || "Product Return";
                    const uom =
                      d.selected_unit || d.unit_measurement || d.unit || "KG";
                    const dnNo = d.dn_number || packNo || "-";

                    const uomOptions = ["KG", "G", "PCS", "BOX"];
                    const matchedUom =
                      uomOptions.find(
                        (o) => o.toLowerCase() === uom.toLowerCase(),
                      ) || "KG";

                    form.setFieldsValue({
                      uniqId: uniq,
                      partNumber: partNo,
                      partName: partNm,
                      model: mod,
                      packingNumber: packNo,
                      dnNumber: dnNo,
                      scrapType: sType,
                      uom: matchedUom,
                    });
                  } catch (err) {
                    message.error(getApiErrorMessage(err, "Scan failed"));
                  }
                }}
                onBlur={async (e) => {
                  const val = e.target.value;
                  if (!val.trim()) return;
                  try {
                    const res = await scanProductReturn(val.trim()).unwrap();
                    const d = res.data;
                    if (!d) return;

                    const partNo = d.part_number || "";
                    if (!partNo) {
                      message.warning("Kanban/DN data not found!");
                      form.setFieldsValue({
                        uniqId: undefined,
                        partNumber: undefined,
                        partName: undefined,
                        model: undefined,
                        packingNumber: undefined,
                        dnNumber: undefined,
                      });
                      return;
                    }

                    const uniq = d.uniq_id || d.uniq || "";
                    const partNm = d.part_name || "";
                    const mod = d.model || "";
                    const packNo =
                      d.packing_number || d.kanban_packing_list || val.trim();
                    const sType = d.scrap_type || "Product Return";
                    const uom =
                      d.selected_unit || d.unit_measurement || d.unit || "KG";
                    const dnNo = d.dn_number || "-";

                    const uomOptions = ["KG", "G", "PCS", "BOX"];
                    const matchedUom =
                      uomOptions.find(
                        (o) => o.toLowerCase() === uom.toLowerCase(),
                      ) || "KG";

                    form.setFieldsValue({
                      uniqId: uniq,
                      partNumber: partNo,
                      partName: partNm,
                      model: mod,
                      packingNumber: packNo,
                      dnNumber: dnNo,
                      scrapType: sType,
                      uom: matchedUom,
                    });
                  } catch (err) {
                    // silently fail on blur to not spam errors if they just tabbed out of an invalid input,
                    // or maybe just log it.
                    console.error("Scan on blur failed", err);
                  }
                }}
              />
            </Form.Item>

            <Form.Item
              label="Uniq ID"
              name="uniqId"
              rules={[{ required: true, message: "Input uniq" }]}
            >
              <Input placeholder="Input or auto-filled uniq" />
            </Form.Item>

            <Form.Item label="Part Number" name="partNumber">
              <Input
                readOnly
                placeholder="Auto-filled by uniq chosen"
                className="bg-gray-50"
              />
            </Form.Item>

            <Form.Item label="Part Name" name="partName">
              <Input
                readOnly
                placeholder="Auto-filled by uniq chosen"
                className="bg-gray-50"
              />
            </Form.Item>

            <Form.Item label="Model" name="model">
              <Input
                readOnly
                placeholder="Auto-filled by uniq chosen"
                className="bg-gray-50"
              />
            </Form.Item>

            <Form.Item label="Packing Number" name="packingNumber">
              <Input
                readOnly
                placeholder="Auto-filled by uniq chosen"
                className="bg-gray-50"
              />
            </Form.Item>

            <Form.Item label="DN Number" name="dnNumber">
              <Input placeholder="Auto-filled or -" className="bg-gray-50" />
            </Form.Item>
          </div>

          <div className="mt-4 mb-2 flex items-center gap-2 text-sm font-bold text-gray-800">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-500"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Return Details
          </div>

          <Form.Item label="Date Received" name="dateReceived">
            <Input type="date" />
          </Form.Item>

          <Form.Item label="Scrap Type" name="scrapType">
            <Select
              options={[
                { label: "Product Return", value: "Product Return" },
                { label: "Customer Return", value: "Customer Return" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Quantity of Scrap"
            name="scrapQty"
            rules={[{ required: true, message: "Enter scrap qty" }]}
          >
            <InputNumber
              min={0}
              className="!w-full"
              placeholder="Enter scrap quantity"
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item label="Weight" name="weight">
              <InputNumber
                min={0}
                step={0.1}
                className="!w-full"
                placeholder="Enter weight"
              />
            </Form.Item>
            <Form.Item label="Unit" name="uom">
              <Select
                options={[
                  { label: "KG", value: "KG" },
                  { label: "G", value: "G" },
                  { label: "PCS", value: "PCS" },
                  { label: "BOX", value: "BOX" },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item
            label="Quantity of Rework"
            name="reworkQty"
            rules={[{ required: true, message: "Enter rework qty" }]}
          >
            <InputNumber
              min={0}
              className="!w-full"
              placeholder="Enter items need to rework"
            />
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
