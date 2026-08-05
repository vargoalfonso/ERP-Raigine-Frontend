"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BugOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useRouter } from "next/navigation";

import StatsCard from "@/components/StatsCard";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type CreateQcDashboardReportRequest,
  type ManualReferenceOptionItem,
  type QcReportLookupType,
  type QcDashboardBySource,
  type QcDashboardDefectItem,
  type QcDashboardIncomingQcItem,
  type QcDashboardProductReturnQcItem,
  type QcDashboardProductionQcItem,
  type QcDashboardProductionQcIssue,
  type QcDashboardTopIssue,
  useCreateQcDashboardReportMutation,
  useGetQcDashboardDefectsQuery,
  useGetQcDashboardIncomingQcQuery,
  useGetQcDashboardOverviewQuery,
  useGetQcDashboardProductReturnQcQuery,
  useGetQcDashboardProductionQcQuery,
  useGetQcDashboardProductionQcDetailQuery,
  useGetManualReferenceOptionsQuery,
} from "@/lib/api/qc-dashboard/api";

type QcTabId = "production" | "incoming" | "product_return" | "defects";

type UiTabId = QcTabId;

type PaginationState = Record<QcTabId, { page: number; limit: number }>;

type ManualReportFormValues = {
  qc_type: "production" | "incoming" | "product_return";
  report_date: Dayjs;
  reference_number: string;
  uniq_code: string;
  number_of_item_check: number;
  issue_reason_code?: string;
  issue_reason_text?: string;
  number_of_defect?: number;
  number_of_scrap?: number;
  status: string;
};

const getReferenceLabel = (
  qcType: ManualReportFormValues["qc_type"] | undefined,
) => {
  if (qcType === "production") return "WO Number";
  if (qcType === "incoming") return "DN / PO Number";
  if (qcType === "product_return") return "PR / DN Number";
  return "WO/PO/DN Number";
};

const getReferencePlaceholder = (
  qcType: ManualReportFormValues["qc_type"] | undefined,
) => {
  if (qcType === "production") return "Search WO Number...";
  if (qcType === "incoming") return "Search DN / PO Number...";
  if (qcType === "product_return") return "Search PR / DN Number...";
  return "Search...";
};

const formatNumber = (value: unknown) => {
  const numeric =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-US").format(numeric);
};

const formatDate = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  if (raw.length >= 10 && raw[4] === "-" && raw[7] === "-")
    return raw.slice(0, 10);
  return raw;
};

const statusColor = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes("pass")) return "green";
  if (
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("not_pass")
  )
    return "red";
  return "gold";
};

const toCsvValue = (value: unknown) => {
  const text = String(value ?? "");
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
};

const downloadCsv = (
  filename: string,
  headers: string[],
  rows: Array<Record<string, unknown>>,
) => {
  const lines: string[] = [];
  lines.push(headers.map(toCsvValue).join(","));
  for (const row of rows) {
    lines.push(headers.map((key) => toCsvValue(row[key])).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export default function QcDashboardPage() {
  const [manualForm] = Form.useForm<ManualReportFormValues>();
  const apiEnabled = Boolean(apiBaseUrl);

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<UiTabId>("production");
  const [pagination, setPagination] = useState<PaginationState>({
    production: { page: 1, limit: 20 },
    incoming: { page: 1, limit: 20 },
    product_return: { page: 1, limit: 20 },
    defects: { page: 1, limit: 20 },
  });
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const overviewQuery = useGetQcDashboardOverviewQuery(undefined, {
    skip: !apiEnabled,
  });
  const productionQuery = useGetQcDashboardProductionQcQuery(
    pagination.production,
    {
      skip: !apiEnabled || activeTab !== "production",
    },
  );
  const incomingQuery = useGetQcDashboardIncomingQcQuery(pagination.incoming, {
    skip: !apiEnabled || activeTab !== "incoming",
  });
  const defectsQuery = useGetQcDashboardDefectsQuery(pagination.defects, {
    skip: !apiEnabled || activeTab !== "defects",
  });
  const productReturnQuery = useGetQcDashboardProductReturnQcQuery(
    pagination.product_return,
    {
      skip: !apiEnabled || activeTab !== "product_return",
    },
  );

  const [createQcReport, createQcReportState] =
    useCreateQcDashboardReportMutation();
  const selectedQcType = Form.useWatch("qc_type", manualForm);
  const selectedReferenceNumber = Form.useWatch("reference_number", manualForm);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  const formOptionsQuery = useGetManualReferenceOptionsQuery(
    {
      qc_type: selectedQcType ?? "production",
      q: debouncedSearch,
      limit: 20,
    },
    { skip: !apiEnabled || !isManualOpen },
  );

  const selectedItem = useMemo(() => {
    const items = formOptionsQuery.data?.data?.items ?? [];
    const selected = String(selectedReferenceNumber ?? "").trim();
    if (!selected) return undefined;
    return items.find((item) =>
      [item.reference_number, item.secondary_reference, item.uniq_code]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
        .includes(selected),
    );
  }, [formOptionsQuery.data?.data?.items, selectedReferenceNumber]);

  useEffect(() => {
    if (!isManualOpen) return;
    manualForm.setFieldsValue({
      reference_number: undefined,
      uniq_code: undefined,
      number_of_item_check: 0,
      number_of_defect: 0,
      number_of_scrap: 0,
      issue_reason_code: undefined,
      issue_reason_text: undefined,
    });
  }, [manualForm, isManualOpen, selectedQcType]);

  useEffect(() => {
    if (!selectedItem) return;
    manualForm.setFieldsValue({
      uniq_code: selectedItem.uniq_code || undefined,
    });
  }, [manualForm, selectedItem]);

  const overview = overviewQuery.data?.data;
  const cards = overview?.cards;
  const implementationNote = String(overview?.implementation_note ?? "").trim();

  const bySourceRows = useMemo((): Array<
    QcDashboardBySource & { key: string }
  > => {
    const rows = overview?.by_source ?? [];
    return rows.map((row, index) => ({
      ...row,
      key: `${row.defect_source}-${index}`,
    }));
  }, [overview?.by_source]);

  const topIssueRows = useMemo((): Array<
    QcDashboardTopIssue & { key: string }
  > => {
    const rows = overview?.top_issues ?? [];
    return rows.map((row, index) => ({
      ...row,
      key: `${row.reason_code}-${index}`,
    }));
  }, [overview?.top_issues]);

  const activeTable = useMemo(() => {
    if (activeTab === "incoming") return incomingQuery;
    if (activeTab === "product_return") return productReturnQuery;
    if (activeTab === "defects") return defectsQuery;
    if (activeTab === "production") return productionQuery;
    return null;
  }, [
    activeTab,
    defectsQuery,
    incomingQuery,
    productReturnQuery,
    productionQuery,
  ]);

  const tableLoading = Boolean(activeTable?.isFetching);
  const tableError = activeTable?.error;
  const tableRows = (activeTable?.data?.data as unknown[]) ?? [];
  const tablePagination = activeTable?.data?.pagination;

  const openManual = () => {
    manualForm.setFieldsValue({
      qc_type:
        activeTab === "incoming"
          ? "incoming"
          : activeTab === "product_return"
            ? "product_return"
            : "production",
      report_date: dayjs(),
      status: "failed",
      number_of_item_check: 0,
      number_of_defect: 0,
      number_of_scrap: 0,
    });
    setIsManualOpen(true);
  };

  const closeManual = () => {
    setIsManualOpen(false);
    manualForm.resetFields();
  };

  const submitManual = async () => {
    let values: ManualReportFormValues;
    try {
      values = await manualForm.validateFields();
    } catch {
      return;
    }

    if (!selectedItem && !values.reference_number) {
      message.error("Please select a reference number from the list");
      return;
    }

    const payload: CreateQcDashboardReportRequest = {
      qc_type: values.qc_type,
      report_date: values.report_date.format("YYYY-MM-DD"),
      reference_number: values.reference_number || "",
      uniq_code: values.uniq_code || "",
      number_of_item_check: values.number_of_item_check,
      issue_reason_code: values.issue_reason_code || undefined,
      issue_reason_text: values.issue_reason_text || undefined,
      number_of_defect: values.number_of_defect ?? undefined,
      number_of_scrap: values.number_of_scrap ?? undefined,
      status: values.status,
    };

    try {
      await createQcReport(payload).unwrap();
      message.success("QC report created successfully");
      closeManual();
      overviewQuery.refetch();
      if (activeTab === "production") productionQuery.refetch();
      if (activeTab === "incoming") incomingQuery.refetch();
      if (activeTab === "product_return") productReturnQuery.refetch();
      if (activeTab === "defects") defectsQuery.refetch();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to create QC report"));
    }
  };

  const productionColumns = useMemo<ColumnsType<QcDashboardProductionQcItem>>(
    () => [
      {
        title: "Report Date",
        dataIndex: "report_date",
        key: "report_date",
        render: (v) => formatDate(String(v ?? "")),
      },
      { title: "WO Number", dataIndex: "wo_number", key: "wo_number" },
      { title: "UNIQ", dataIndex: "uniq_code", key: "uniq_code" },
      { title: "Kanban", dataIndex: "kanban_number", key: "kanban_number" },
      {
        title: "Checked",
        dataIndex: "items_checked",
        key: "items_checked",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Issue",
        dataIndex: "issue_label",
        key: "issue_label",
        render: (v, record) => {
          const issues =
            (record as { issues?: QcDashboardProductionQcIssue[] }).issues ?? [];
          const label = v
            ? String(v)
            : issues.length > 0
              ? issues[0].reason_text
              : "-";
          if (issues.length === 0) return label || "-";
          return (
            <Tooltip
              title={
                <div className="space-y-1">
                  {issues.map((it, i) => (
                    <div key={i}>
                      {it.reason_code || it.source || "issue"}
                      {it.reason_text ? `: ${it.reason_text}` : ""} (Qty:{" "}
                      {it.qty || it.qty_defect || it.qty_scrap})
                    </div>
                  ))}
                </div>
              }
            >
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                {label || "-"}
                {issues.length > 1 ? ` +${issues.length - 1}` : ""}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: "Defect",
        dataIndex: "qty_defect",
        key: "qty_defect",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Scrap",
        dataIndex: "qty_scrap",
        key: "qty_scrap",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Quality %",
        dataIndex: "quality_rate_percent",
        key: "quality_rate_percent",
        align: "right",
        render: (v) => `${formatNumber(v)}%`,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        fixed: "right",
        render: (v) => (
          <Tag color={statusColor(String(v ?? ""))}>{String(v ?? "-")}</Tag>
        ),
      },
      {
        title: "Detail",
        key: "detail",
        fixed: "right",
        width: 90,
        render: (_v, record) => (
          <Button
            type="link"
            size="small"
            className="!px-0"
            onClick={() =>
              router.push(`/qc-dashboard/production/${record.qc_log_id}`)
            }
          >
            Detail
          </Button>
        ),
      },
    ],
    [router],
  );

  const incomingColumns = useMemo<ColumnsType<QcDashboardIncomingQcItem>>(
    () => [
      {
        title: "Report Date",
        dataIndex: "report_date",
        key: "report_date",
        render: (v) => formatDate(String(v ?? "")),
      },
      { title: "DN Number", dataIndex: "dn_number", key: "dn_number" },
      { title: "PO Number", dataIndex: "po_number", key: "po_number" },
      { title: "Supplier", dataIndex: "supplier_name", key: "supplier_name" },
      { title: "UNIQ", dataIndex: "uniq_code", key: "uniq_code" },
      {
        title: "Checked",
        dataIndex: "items_checked",
        key: "items_checked",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Issue",
        dataIndex: "issue_label",
        key: "issue_label",
        render: (v, record) => {
          const issues =
            (record as { issues?: QcDashboardProductionQcIssue[] }).issues ?? [];
          const label = v
            ? String(v)
            : issues.length > 0
              ? issues[0].reason_text
              : "-";
          if (issues.length === 0) return label || "-";
          return (
            <Tooltip
              title={
                <div className="space-y-1">
                  {issues.map((it, i) => (
                    <div key={i}>
                      {it.reason_code || it.source || "issue"}
                      {it.reason_text ? `: ${it.reason_text}` : ""} (Qty:{" "}
                      {it.qty || it.qty_defect || it.qty_scrap})
                    </div>
                  ))}
                </div>
              }
            >
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                {label || "-"}
                {issues.length > 1 ? ` +${issues.length - 1}` : ""}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: "Defect",
        dataIndex: "qty_defect",
        key: "qty_defect",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Scrap",
        dataIndex: "qty_scrap",
        key: "qty_scrap",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Quality %",
        dataIndex: "quality_rate_percent",
        key: "quality_rate_percent",
        align: "right",
        render: (v) => `${formatNumber(v)}%`,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        fixed: "right",
        render: (v) => (
          <Tag color={statusColor(String(v ?? ""))}>{String(v ?? "-")}</Tag>
        ),
      },
    ],
    [],
  );

  const productReturnColumns = useMemo<
    ColumnsType<QcDashboardProductReturnQcItem>
  >(
    () => [
      {
        title: "Report Date",
        dataIndex: "report_date",
        key: "report_date",
        render: (v) => formatDate(String(v ?? "")),
      },
      {
        title: "Product Return",
        dataIndex: "product_return_number",
        key: "product_return_number",
      },
      { title: "DN Number", dataIndex: "dn_number", key: "dn_number" },
      {
        title: "Partner Type",
        dataIndex: "partner_type",
        key: "partner_type",
        render: (v) => (v ? String(v) : "-"),
      },
      { title: "Partner", dataIndex: "partner_name", key: "partner_name" },
      {
        title: "Checked",
        dataIndex: "items_checked",
        key: "items_checked",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Issue",
        dataIndex: "issue_label",
        key: "issue_label",
        render: (v, record) => {
          const issues =
            (record as { issues?: QcDashboardProductionQcIssue[] }).issues ?? [];
          const label = v
            ? String(v)
            : issues.length > 0
              ? issues[0].reason_text
              : "-";
          if (issues.length === 0) return label || "-";
          return (
            <Tooltip
              title={
                <div className="space-y-1">
                  {issues.map((it, i) => (
                    <div key={i}>
                      {it.reason_code || it.source || "issue"}
                      {it.reason_text ? `: ${it.reason_text}` : ""} (Qty:{" "}
                      {it.qty || it.qty_defect || it.qty_scrap})
                    </div>
                  ))}
                </div>
              }
            >
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                {label || "-"}
                {issues.length > 1 ? ` +${issues.length - 1}` : ""}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: "Rework",
        dataIndex: "qty_rework",
        key: "qty_rework",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Defect",
        dataIndex: "qty_defect",
        key: "qty_defect",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Scrap",
        dataIndex: "qty_scrap",
        key: "qty_scrap",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Quality %",
        dataIndex: "quality_rate_percent",
        key: "quality_rate_percent",
        align: "right",
        render: (v) => `${formatNumber(v)}%`,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        fixed: "right",
        render: (v) => (
          <Tag color={statusColor(String(v ?? ""))}>{String(v ?? "-")}</Tag>
        ),
      },
    ],
    [],
  );

  const defectColumns = useMemo<ColumnsType<QcDashboardDefectItem>>(
    () => [
      {
        title: "Report Date",
        dataIndex: "report_date",
        key: "report_date",
        render: (v) => formatDate(String(v ?? "")),
      },
      { title: "Source", dataIndex: "defect_source", key: "defect_source" },
      { title: "Kanban/PL", dataIndex: "kanban_pl", key: "kanban_pl" },
      { title: "UNIQ", dataIndex: "uniq_code", key: "uniq_code" },
      { title: "Product", dataIndex: "product_name", key: "product_name" },
      { title: "Reason", dataIndex: "reason_text", key: "reason_text" },
      {
        title: "Defect",
        dataIndex: "qty_defect",
        key: "qty_defect",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Scrap",
        dataIndex: "qty_scrap",
        key: "qty_scrap",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Repairable",
        dataIndex: "is_repairable",
        key: "is_repairable",
        render: (v) => (
          <Tag color={v ? "blue" : "default"}>{v ? "Yes" : "No"}</Tag>
        ),
      },
      {
        title: "Rework Status",
        dataIndex: "wo_rework_status",
        key: "wo_rework_status",
      },
    ],
    [],
  );

  const columns = useMemo(() => {
    if (activeTab === "incoming") return incomingColumns as ColumnsType<object>;
    if (activeTab === "product_return")
      return productReturnColumns as ColumnsType<object>;
    if (activeTab === "defects") return defectColumns as ColumnsType<object>;
    return productionColumns as ColumnsType<object>;
  }, [
    activeTab,
    defectColumns,
    incomingColumns,
    productReturnColumns,
    productionColumns,
  ]);

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    const matchesKeyword = (row: any) => {
      if (!keyword) return true;
      if (activeTab === "production") {
        return [
          row.wo_number,
          row.uniq_code,
          row.kanban_number,
          row.issue_label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      }
      if (activeTab === "incoming") {
        return [
          row.dn_number,
          row.po_number,
          row.supplier_name,
          row.uniq_code,
          row.issue_label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      }
      if (activeTab === "product_return") {
        return [
          row.product_return_number,
          row.dn_number,
          row.partner_type,
          row.partner_name,
          row.issue_label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      }
      if (activeTab === "defects") {
        return [
          row.defect_source,
          row.kanban_pl,
          row.uniq_code,
          row.product_name,
          row.reason_text,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      }
      return true;
    };

    const matchesStatus = (row: any) => {
      if (statusFilter === "all") return true;
      const status = String(row.status ?? "").toLowerCase();
      return status.includes(statusFilter);
    };

    return (tableRows as any[]).filter(
      (row) => matchesKeyword(row) && matchesStatus(row),
    );
  }, [activeTab, searchText, statusFilter, tableRows]);

  const onExport = () => {
    const timestamp = dayjs().format("YYYYMMDD-HHmmss");

    if (activeTab === "production") {
      const headers = [
        "report_date",
        "wo_number",
        "uniq_code",
        "kanban_number",
        "items_checked",
        "issue_label",
        "qty_defect",
        "qty_scrap",
        "quality_rate_percent",
        "status",
      ];
      downloadCsv(
        `production-qc-${timestamp}.csv`,
        headers,
        filteredRows as any,
      );
      return;
    }
    if (activeTab === "incoming") {
      const headers = [
        "report_date",
        "dn_number",
        "po_number",
        "supplier_name",
        "uniq_code",
        "items_checked",
        "issue_label",
        "qty_defect",
        "qty_scrap",
        "quality_rate_percent",
        "status",
      ];
      downloadCsv(`incoming-qc-${timestamp}.csv`, headers, filteredRows as any);
      return;
    }
    if (activeTab === "product_return") {
      const headers = [
        "report_date",
        "product_return_number",
        "dn_number",
        "partner_type",
        "partner_name",
        "items_checked",
        "issue_label",
        "qty_rework",
        "qty_defect",
        "qty_scrap",
        "quality_rate_percent",
        "status",
      ];
      downloadCsv(
        `product-return-qc-${timestamp}.csv`,
        headers,
        filteredRows as any,
      );
      return;
    }
    const headers = [
      "report_date",
      "defect_source",
      "kanban_pl",
      "uniq_code",
      "product_name",
      "reason_text",
      "qty_defect",
      "qty_scrap",
      "is_repairable",
      "wo_rework_status",
    ];
    downloadCsv(`defects-${timestamp}.csv`, headers, filteredRows as any);
  };

  return (
    <div className="min-h-full bg-[#f5f7fb] p-6">
      <div className="mb-5">
        <div className="text-xl font-semibold text-gray-900">QC Dashboard</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{dayjs().format("dddd, MMMM D, YYYY")}</span>
          <span className="mx-1">•</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>System Online</span>
          </span>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-gray-900">
              QC Dashboard
            </div>
            <div className="text-sm text-gray-500">
              Quality Control monitoring for production, incoming materials,
              product returns, and defect tracking
            </div>
          </div>

          <Button type="primary" icon={<PlusOutlined />} onClick={openManual}>
            Add QC Report
          </Button>
        </div>

        {!apiEnabled ? (
          <Alert
            type="warning"
            showIcon
            message="QC Dashboard API is not configured (NEXT_PUBLIC_API_URL)."
            className="mt-4"
          />
        ) : null}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Reports"
          value={cards?.total_reports ?? 0}
          icon={<FileTextOutlined className="text-xl" />}
          bgColor="bg-blue-50"
          textColor="text-blue-600"
          subtitle={
            overview?.as_of ? `As of ${formatDate(overview.as_of)}` : undefined
          }
        />
        <StatsCard
          title="Total Defects"
          value={cards?.total_defects ?? 0}
          icon={<BugOutlined className="text-xl" />}
          bgColor="bg-red-50"
          textColor="text-red-600"
        />
        <StatsCard
          title="Total Scrap"
          value={cards?.total_scrap ?? 0}
          icon={<DeleteOutlined className="text-xl" />}
          bgColor="bg-orange-50"
          textColor="text-orange-600"
        />
        <StatsCard
          title="Pending Rework"
          value={cards?.pending_rework ?? 0}
          icon={<ClockCircleOutlined className="text-xl" />}
          bgColor="bg-yellow-50"
          textColor="text-yellow-700"
        />
      </div>

      {implementationNote ? (
        <Alert
          type="info"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={implementationNote}
          className="mb-6"
        />
      ) : null}

      {/* <div className="mb-6">
        <Collapse
          size="small"
          items={[
            {
              key: "analytics",
              label: "Analytics",
              children: (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-3 text-sm font-semibold text-gray-900">By Source</div>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={bySourceRows}
                      rowKey="key"
                      columns={[
                        { title: "Source", dataIndex: "defect_source", key: "defect_source" },
                        {
                          title: "Defect",
                          dataIndex: "qty_defect",
                          key: "qty_defect",
                          align: "right",
                          render: (v) => formatNumber(v),
                        },
                        {
                          title: "Scrap",
                          dataIndex: "qty_scrap",
                          key: "qty_scrap",
                          align: "right",
                          render: (v) => formatNumber(v),
                        },
                      ]}
                      loading={overviewQuery.isFetching}
                      locale={{ emptyText: "No data" }}
                    />
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-3 text-sm font-semibold text-gray-900">Top Issues</div>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={topIssueRows}
                      rowKey="key"
                      columns={[
                        { title: "Code", dataIndex: "reason_code", key: "reason_code" },
                        { title: "Reason", dataIndex: "reason_text", key: "reason_text" },
                        {
                          title: "Defect",
                          dataIndex: "qty_defect",
                          key: "qty_defect",
                          align: "right",
                          render: (v) => formatNumber(v),
                        },
                      ]}
                      loading={overviewQuery.isFetching}
                      locale={{ emptyText: "No data" }}
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div> */}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="px-5 pt-5">
          <div className="mb-4 rounded-xl bg-gray-50 p-1">
            <Segmented
              block
              value={activeTab}
              onChange={(v) => {
                setActiveTab(v as UiTabId);
                setSearchText("");
                setStatusFilter("all");
              }}
              options={[
                { label: "Production QC", value: "production" },
                { label: "Incoming QC", value: "incoming" },
                { label: "Product Return", value: "product_return" },
                { label: "Defect Report", value: "defects" },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <Input
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined className="text-gray-400" />}
              placeholder="Search by WO, PO, Uniq, or Supplier..."
              className="max-w-lg"
            />

            <Space size={10}>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 140 }}
                options={[
                  { label: "All Status", value: "all" },
                  { label: "Passed", value: "pass" },
                  { label: "Not Passed", value: "not_pass" },
                  { label: "Failed", value: "fail" },
                  { label: "Pending", value: "pending" },
                ]}
                disabled={activeTab === "defects"}
              />
              <Button icon={<DownloadOutlined />} onClick={onExport}>
                Export
              </Button>
            </Space>
          </div>
        </div>

        <div className="px-5 pb-5">
          {tableError ? (
            <Alert
              type="error"
              showIcon
              message={getApiErrorMessage(
                tableError,
                "Failed to load QC reports",
              )}
              className="mb-4"
            />
          ) : null}

          <Table
            columns={columns}
            dataSource={filteredRows as object[]}
            loading={tableLoading}
            rowKey={(row) => {
              const r = row as any;
              return String(
                r.qc_log_id ??
                  r.product_return_id ??
                  r.defect_id ??
                  r.id ??
                  "row",
              );
            }}
            scroll={{ x: 1200 }}
            pagination={{
              current: tablePagination?.page ?? pagination[activeTab].page,
              pageSize: tablePagination?.perPage ?? pagination[activeTab].limit,
              total: tablePagination?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} items`,
              onChange: (page, pageSize) => {
                const tab = activeTab;
                setPagination((prev) => ({
                  ...prev,
                  [tab]: { page, limit: pageSize ?? prev[tab].limit },
                }));
              },
              onShowSizeChange: (_current, size) => {
                const tab = activeTab;
                setPagination((prev) => ({
                  ...prev,
                  [tab]: { page: 1, limit: size },
                }));
              },
            }}
            locale={{ emptyText: "No records" }}
            className="overflow-hidden rounded-xl"
          />

          <div className="mt-2 text-xs text-gray-500">
            Window: {overview?.window_hours ?? 0} hours
          </div>
        </div>
      </div>

      <Modal
        open={isManualOpen}
        onCancel={closeManual}
        onOk={submitManual}
        okText="Submit"
        confirmLoading={createQcReportState.isLoading}
        width={720}
        destroyOnHidden
        title={
          <div className="text-lg font-semibold text-gray-900">
            Create QC Report
          </div>
        }>
        <Form<ManualReportFormValues>
          form={manualForm}
          layout="vertical"
          requiredMark={false}
          preserve={false}
          className="pt-2">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item
              label="QC Type"
              name="qc_type"
              initialValue="production"
              rules={[{ required: true, message: "Select QC type" }]}>
              <Segmented
                options={[
                  { label: "Production", value: "production" },
                  { label: "Incoming", value: "incoming" },
                  { label: "Product Return", value: "product_return" },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="Report Date"
              name="report_date"
              rules={[{ required: true, message: "Select report date" }]}>
              <DatePicker className="w-full" format="YYYY-MM-DD" />
            </Form.Item>

            <Form.Item
              label={getReferenceLabel(selectedQcType)}
              name="reference_number"
              rules={[
                {
                  required: true,
                  message: "Select or search reference number",
                },
              ]}
              className="md:col-span-2">
              <Select
                showSearch
                placeholder={getReferencePlaceholder(selectedQcType)}
                onSearch={(value) => {
                  setSearchKeyword(value);
                }}
                onChange={(value, option) => {
                  const item = (option as any)?.record;
                  if (item) {
                    manualForm.setFieldsValue({
                      reference_number: value,
                      uniq_code: item.uniq_code || "",
                    });
                  }
                }}
                onClear={() => {
                  setSearchKeyword("");
                  manualForm.setFieldsValue({
                    reference_number: undefined,
                    uniq_code: undefined,
                  });
                }}
                loading={formOptionsQuery.isFetching}
                filterOption={(input, option) => {
                  const item = (option as any)?.record;
                  const searchText = input.toLowerCase();
                  return (
                    (item?.reference_number?.toLowerCase() ?? "").includes(
                      searchText,
                    ) ||
                    (item?.uniq_code?.toLowerCase() ?? "").includes(
                      searchText,
                    ) ||
                    (item?.part_name?.toLowerCase() ?? "").includes(searchText)
                  );
                }}
                notFoundContent={
                  formOptionsQuery.isFetching
                    ? "Loading..."
                    : "No results found"
                }
                allowClear
                options={formOptionsQuery.data?.data?.items?.map(
                  (item: ManualReferenceOptionItem) => ({
                    value: item.reference_number,
                    label: item.reference_number,
                    record: item,
                  }),
                )}
              />
            </Form.Item>

            <Form.Item
              label="UNIQ Code"
              name="uniq_code"
              rules={[
                {
                  required: true,
                  message: "UNIQ will be filled automatically",
                },
              ]}>
              <Input
                placeholder="Auto-filled from selected reference"
                disabled
              />
            </Form.Item>

            <Form.Item
              label="Items Checked"
              name="number_of_item_check"
              rules={[{ required: true, message: "Enter items checked" }]}>
              <InputNumber className="w-full" min={0} />
            </Form.Item>

            <Form.Item
              label="Status"
              name="status"
              rules={[{ required: true, message: "Select status" }]}>
              <Segmented
                options={[
                  { label: "Passed", value: "passed" },
                  { label: "Not Passed", value: "not_passed" },
                  { label: "Failed", value: "failed" },
                ]}
              />
            </Form.Item>

            <Form.Item label="Issue Reason Code" name="issue_reason_code">
              <Input placeholder="e.g., SURFACE_DEFECT" />
            </Form.Item>

            <Form.Item label="Issue Reason Text" name="issue_reason_text">
              <Input placeholder="e.g., Scratch, Dent, etc." />
            </Form.Item>

            <Form.Item label="Number of Defect" name="number_of_defect">
              <InputNumber className="w-full" min={0} />
            </Form.Item>

            <Form.Item label="Number of Scrap" name="number_of_scrap">
              <InputNumber className="w-full" min={0} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
