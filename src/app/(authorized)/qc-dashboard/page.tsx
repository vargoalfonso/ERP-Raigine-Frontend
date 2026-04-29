"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Collapse,
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

import StatsCard from "@/components/StatsCard";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type CreateQcDashboardReportRequest,
  type QcReportFormOptionRecord,
  type QcReportLookupType,
  type QcDashboardBySource,
  type QcDashboardDefectItem,
  type QcDashboardIncomingQcItem,
  type QcDashboardProductionQcItem,
  type QcDashboardTopIssue,
  useCreateQcDashboardReportMutation,
  useGetQcDashboardDefectsQuery,
  useGetQcDashboardIncomingQcQuery,
  useGetQcDashboardOverviewQuery,
  useGetQcDashboardProductionQcQuery,
  useGetQcReportFormDetailQuery,
  useGetQcReportFormOptionsQuery,
} from "@/lib/api/qc-dashboard/api";

type QcTabId = "production" | "incoming" | "defects";

type UiTabId = QcTabId | "product_return";

type PaginationState = Record<QcTabId, { page: number; limit: number }>;

type ManualReportFormValues = {
  qc_type: "production" | "incoming" | "product_return";
  report_date: Dayjs;
  record_id?: string;
  reference_number: string;
  uniq_code: string;
  number_of_item_check: number;
  issue?: string;
  number_of_defect?: number;
  number_of_scrap?: number;
  number_of_product_return?: number;
  status: string;
  remarks?: string;
};

const QC_TYPE_TO_LOOKUP: Record<ManualReportFormValues["qc_type"], QcReportLookupType> = {
  production: "production_qc",
  incoming: "incoming_qc",
  product_return: "product_return_qc",
};

const DEFAULT_ISSUE_OPTIONS = [
  { label: "Scratch", value: "scratch" },
  { label: "Dent", value: "dent" },
  { label: "Dimension NG", value: "dimension_ng" },
  { label: "Color NG", value: "color_ng" },
  { label: "Mixed Part", value: "mixed_part" },
  { label: "Other", value: "other" },
];

const getRecordId = (record: QcReportFormOptionRecord | undefined): string | undefined => {
  if (!record) return undefined;
  if (record.return_id != null && String(record.return_id).trim()) return String(record.return_id).trim();
  if (record.qc_task_id != null) return String(record.qc_task_id);
  return undefined;
};

const getReferenceLabel = (qcType: ManualReportFormValues["qc_type"] | undefined) => {
  if (qcType === "production") return "WO Number";
  if (qcType === "incoming") return "PO / DN Number";
  if (qcType === "product_return") return "DN Number";
  return "WO/PO/DN Number";
};

const formatNumber = (value: unknown) => {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-US").format(numeric);
};

const formatDate = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  if (raw.length >= 10 && raw[4] === "-" && raw[7] === "-") return raw.slice(0, 10);
  return raw;
};

const statusColor = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes("pass")) return "green";
  if (normalized.includes("fail") || normalized.includes("reject") || normalized.includes("not_pass")) return "red";
  return "gold";
};

const toCsvValue = (value: unknown) => {
  const text = String(value ?? "");
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
};

const downloadCsv = (filename: string, headers: string[], rows: Array<Record<string, unknown>>) => {
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

  const [activeTab, setActiveTab] = useState<UiTabId>("production");
  const [pagination, setPagination] = useState<PaginationState>({
    production: { page: 1, limit: 20 },
    incoming: { page: 1, limit: 20 },
    defects: { page: 1, limit: 20 },
  });
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const overviewQuery = useGetQcDashboardOverviewQuery(undefined, { skip: !apiEnabled });
  const productionQuery = useGetQcDashboardProductionQcQuery(pagination.production, {
    skip: !apiEnabled || activeTab !== "production",
  });
  const incomingQuery = useGetQcDashboardIncomingQcQuery(pagination.incoming, {
    skip: !apiEnabled || activeTab !== "incoming",
  });
  const defectsQuery = useGetQcDashboardDefectsQuery(pagination.defects, {
    skip: !apiEnabled || activeTab !== "defects",
  });

  const [createQcReport, createQcReportState] = useCreateQcDashboardReportMutation();
  const selectedQcType = Form.useWatch("qc_type", manualForm);
  const selectedReferenceNumber = Form.useWatch("reference_number", manualForm);
  const selectedLookupType = selectedQcType ? QC_TYPE_TO_LOOKUP[selectedQcType] : undefined;

  const formOptionsQuery = useGetQcReportFormOptionsQuery(
    { qc_type: selectedLookupType ?? "production_qc" },
    { skip: !apiEnabled || !isManualOpen || !selectedLookupType }
  );

  const selectedRecord = useMemo(() => {
    const records = formOptionsQuery.data?.data.records ?? [];
    const selected = String(selectedReferenceNumber ?? "").trim();
    if (!selected) return undefined;
    return records.find((record) => {
      const candidates = [
        record.wo_po_dn_number,
        record.po_number,
        record.dn_number,
        record.previous_dn_number,
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);
      return candidates.includes(selected);
    });
  }, [formOptionsQuery.data?.data.records, selectedReferenceNumber]);

  const selectedRecordId = getRecordId(selectedRecord);

  const formDetailQuery = useGetQcReportFormDetailQuery(
    {
      qc_type: selectedLookupType ?? "production_qc",
      record_id: selectedRecordId ?? "",
    },
    { skip: !apiEnabled || !isManualOpen || !selectedLookupType || !selectedRecordId }
  );

  const referenceOptions = useMemo(() => {
    const direct = formOptionsQuery.data?.data.wo_po_dn_options ?? [];
    if (direct.length) return direct;
    const records = formOptionsQuery.data?.data.records ?? [];
    return records
      .map((record) => {
        const label =
          record.wo_po_dn_number ??
          record.po_number ??
          record.dn_number ??
          record.previous_dn_number ??
          "";
        const text = String(label ?? "").trim();
        return text ? { label: text, value: text } : null;
      })
      .filter((item): item is { label: string; value: string } => Boolean(item));
  }, [formOptionsQuery.data?.data.records, formOptionsQuery.data?.data.wo_po_dn_options]);

  const issueOptions = useMemo(() => {
    const options = formDetailQuery.data?.data.issue_options ?? [];
    if (options.length) {
      return options.map((option) => ({
        label: option.label || option.name || option.value,
        value: option.value,
      }));
    }
    return DEFAULT_ISSUE_OPTIONS;
  }, [formDetailQuery.data?.data.issue_options]);

  useEffect(() => {
    if (!isManualOpen) return;
    manualForm.setFieldsValue({
      reference_number: undefined,
      record_id: undefined,
      uniq_code: undefined,
      issue: undefined,
      remarks: undefined,
    });
  }, [manualForm, isManualOpen, selectedQcType]);

  useEffect(() => {
    if (!selectedRecord) return;
    manualForm.setFieldsValue({
      record_id: selectedRecordId,
      uniq_code: selectedRecord?.uniq ? String(selectedRecord.uniq) : undefined,
    });
  }, [manualForm, selectedRecord, selectedRecordId]);

  useEffect(() => {
    const detail = formDetailQuery.data?.data;
    if (!detail) return;
    manualForm.setFieldsValue({
      uniq_code: detail.uniq ?? manualForm.getFieldValue("uniq_code"),
      issue: detail.issue ?? manualForm.getFieldValue("issue"),
      report_date: detail.report_date ? dayjs(detail.report_date) : manualForm.getFieldValue("report_date"),
      number_of_item_check: detail.number_of_item_check ?? manualForm.getFieldValue("number_of_item_check") ?? 0,
      number_of_defect: detail.number_of_defect ?? manualForm.getFieldValue("number_of_defect") ?? 0,
      number_of_scrap: detail.number_of_scrap ?? manualForm.getFieldValue("number_of_scrap") ?? 0,
      number_of_product_return:
        detail.number_of_product_return ?? manualForm.getFieldValue("number_of_product_return") ?? 0,
      status: detail.status ?? manualForm.getFieldValue("status") ?? "failed",
      remarks: detail.remarks ?? manualForm.getFieldValue("remarks"),
    });
  }, [formDetailQuery.data?.data, manualForm]);

  const overview = overviewQuery.data?.data;
  const cards = overview?.cards;
  const implementationNote = String(overview?.implementation_note ?? "").trim();

  const bySourceRows = useMemo((): Array<QcDashboardBySource & { key: string }> => {
    const rows = overview?.by_source ?? [];
    return rows.map((row, index) => ({ ...row, key: `${row.defect_source}-${index}` }));
  }, [overview?.by_source]);

  const topIssueRows = useMemo((): Array<QcDashboardTopIssue & { key: string }> => {
    const rows = overview?.top_issues ?? [];
    return rows.map((row, index) => ({ ...row, key: `${row.reason_code}-${index}` }));
  }, [overview?.top_issues]);

  const activeTable = useMemo(() => {
    if (activeTab === "incoming") return incomingQuery;
    if (activeTab === "defects") return defectsQuery;
    if (activeTab === "production") return productionQuery;
    return null;
  }, [activeTab, defectsQuery, incomingQuery, productionQuery]);

  const tableLoading = Boolean(activeTable?.isFetching);
  const tableError = activeTable?.error;
  const tableRows = ((activeTable?.data?.data ?? []) as unknown[]) ?? [];
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
      number_of_product_return: 0,
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

    if (!values.record_id && !selectedRecordId) {
      message.error("Select WO / PO / DN number first");
      return;
    }

    const detail = formDetailQuery.data?.data;
    const payload: CreateQcDashboardReportRequest = {
      qc_type: QC_TYPE_TO_LOOKUP[values.qc_type],
      record_id: values.record_id ?? selectedRecordId ?? "",
      report_date: values.report_date.format("YYYY-MM-DD"),
      wo_po_dn_number: String(values.reference_number ?? "").trim(),
      reference_type: detail?.reference_type,
      uniq: String(values.uniq_code ?? "").trim(),
      supplier_name: detail?.supplier_name,
      part_number: detail?.part_number,
      part_name: detail?.part_name,
      number_of_item_check: Number(values.number_of_item_check ?? 0),
      issue: values.issue ? String(values.issue).trim() : undefined,
      number_of_defect: values.number_of_defect != null ? Number(values.number_of_defect ?? 0) : undefined,
      number_of_scrap: values.number_of_scrap != null ? Number(values.number_of_scrap ?? 0) : undefined,
      number_of_product_return:
        values.number_of_product_return != null ? Number(values.number_of_product_return ?? 0) : undefined,
      status: String(values.status ?? "").trim(),
      remarks: values.remarks ? String(values.remarks).trim() : undefined,
    };

    try {
      await createQcReport(payload).unwrap();
      message.success("QC report created");
      closeManual();
      overviewQuery.refetch();
      if (activeTab === "production") productionQuery.refetch();
      if (activeTab === "incoming") incomingQuery.refetch();
      if (activeTab === "defects") defectsQuery.refetch();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to create QC report"));
    }
  };

  const productionColumns = useMemo<ColumnsType<QcDashboardProductionQcItem>>(
    () => [
      { title: "Report Date", dataIndex: "report_date", key: "report_date", render: (v) => formatDate(String(v ?? "")) },
      { title: "WO Number", dataIndex: "wo_number", key: "wo_number" },
      { title: "UNIQ", dataIndex: "uniq_code", key: "uniq_code" },
      { title: "Kanban", dataIndex: "kanban_number", key: "kanban_number" },
      { title: "Checked", dataIndex: "items_checked", key: "items_checked", align: "right", render: (v) => formatNumber(v) },
      { title: "Issue", dataIndex: "issue_label", key: "issue_label", render: (v) => (v ? String(v) : "-") },
      { title: "Defect", dataIndex: "qty_defect", key: "qty_defect", align: "right", render: (v) => formatNumber(v) },
      { title: "Scrap", dataIndex: "qty_scrap", key: "qty_scrap", align: "right", render: (v) => formatNumber(v) },
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
        render: (v) => <Tag color={statusColor(String(v ?? ""))}>{String(v ?? "-")}</Tag>,
      },
    ],
    []
  );

  const incomingColumns = useMemo<ColumnsType<QcDashboardIncomingQcItem>>(
    () => [
      { title: "Report Date", dataIndex: "report_date", key: "report_date", render: (v) => formatDate(String(v ?? "")) },
      { title: "DN Number", dataIndex: "dn_number", key: "dn_number" },
      { title: "PO Number", dataIndex: "po_number", key: "po_number" },
      { title: "Supplier", dataIndex: "supplier_name", key: "supplier_name" },
      { title: "UNIQ", dataIndex: "uniq_code", key: "uniq_code" },
      { title: "Checked", dataIndex: "items_checked", key: "items_checked", align: "right", render: (v) => formatNumber(v) },
      { title: "Issue", dataIndex: "issue_label", key: "issue_label", render: (v) => (v ? String(v) : "-") },
      { title: "Defect", dataIndex: "qty_defect", key: "qty_defect", align: "right", render: (v) => formatNumber(v) },
      { title: "Scrap", dataIndex: "qty_scrap", key: "qty_scrap", align: "right", render: (v) => formatNumber(v) },
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
        render: (v) => <Tag color={statusColor(String(v ?? ""))}>{String(v ?? "-")}</Tag>,
      },
    ],
    []
  );

  const defectColumns = useMemo<ColumnsType<QcDashboardDefectItem>>(
    () => [
      { title: "Report Date", dataIndex: "report_date", key: "report_date", render: (v) => formatDate(String(v ?? "")) },
      { title: "Source", dataIndex: "defect_source", key: "defect_source" },
      { title: "Kanban/PL", dataIndex: "kanban_pl", key: "kanban_pl" },
      { title: "UNIQ", dataIndex: "uniq_code", key: "uniq_code" },
      { title: "Product", dataIndex: "product_name", key: "product_name" },
      { title: "Reason", dataIndex: "reason_text", key: "reason_text" },
      { title: "Defect", dataIndex: "qty_defect", key: "qty_defect", align: "right", render: (v) => formatNumber(v) },
      { title: "Scrap", dataIndex: "qty_scrap", key: "qty_scrap", align: "right", render: (v) => formatNumber(v) },
      {
        title: "Repairable",
        dataIndex: "is_repairable",
        key: "is_repairable",
        render: (v) => <Tag color={v ? "blue" : "default"}>{v ? "Yes" : "No"}</Tag>,
      },
      { title: "Rework Status", dataIndex: "wo_rework_status", key: "wo_rework_status" },
    ],
    []
  );

  const columns = useMemo(() => {
    if (activeTab === "incoming") return incomingColumns as ColumnsType<object>;
    if (activeTab === "defects") return defectColumns as ColumnsType<object>;
    return productionColumns as ColumnsType<object>;
  }, [activeTab, defectColumns, incomingColumns, productionColumns]);

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    const matchesKeyword = (row: any) => {
      if (!keyword) return true;
      if (activeTab === "production") {
        return [row.wo_number, row.uniq_code, row.kanban_number, row.issue_label]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      }
      if (activeTab === "incoming") {
        return [row.dn_number, row.po_number, row.supplier_name, row.uniq_code, row.issue_label]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      }
      if (activeTab === "defects") {
        return [row.defect_source, row.kanban_pl, row.uniq_code, row.product_name, row.reason_text]
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

    if (activeTab === "product_return") return [];
    return (tableRows as any[]).filter((row) => matchesKeyword(row) && matchesStatus(row));
  }, [activeTab, searchText, statusFilter, tableRows]);

  const onExport = () => {
    if (activeTab === "product_return") {
      message.info("Product Return export is not available yet");
      return;
    }
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
      downloadCsv(`production-qc-${timestamp}.csv`, headers, filteredRows as any);
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
            <div className="text-base font-semibold text-gray-900">QC Dashboard</div>
            <div className="text-sm text-gray-500">
              Quality Control monitoring for production, incoming materials, product returns, and defect tracking
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
          subtitle={overview?.as_of ? `As of ${formatDate(overview.as_of)}` : undefined}
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

      <div className="mb-6">
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
      </div>

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
                ]}
                disabled={activeTab === "defects" || activeTab === "product_return"}
              />
              <Button icon={<DownloadOutlined />} onClick={onExport}>
                Export
              </Button>
            </Space>
          </div>
        </div>

        <div className="px-5 pb-5">
          {activeTab === "product_return" ? (
            <Alert
              type="info"
              showIcon
              message="Product Return is not implemented yet (no backend endpoint provided)."
            />
          ) : null}

          {tableError ? (
            <Alert
              type="error"
              showIcon
              message={getApiErrorMessage(tableError, "Failed to load QC reports")}
              className="mb-4"
            />
          ) : null}

          <Table
            columns={columns}
            dataSource={filteredRows as object[]}
            loading={activeTab === "product_return" ? false : tableLoading}
            rowKey={(row) => {
              const r = row as any;
              return String(r.qc_log_id ?? r.defect_id ?? r.id ?? "row");
            }}
            scroll={{ x: 1200 }}
            pagination={
              activeTab === "product_return"
                ? false
                : {
                    current: tablePagination?.page ?? pagination[activeTab as QcTabId].page,
                    pageSize: tablePagination?.perPage ?? pagination[activeTab as QcTabId].limit,
                    total: tablePagination?.total ?? 0,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50", "100"],
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                    onChange: (page, pageSize) => {
                      const tab = activeTab as QcTabId;
                      setPagination((prev) => ({
                        ...prev,
                        [tab]: { page, limit: pageSize ?? prev[tab].limit },
                      }));
                    },
                    onShowSizeChange: (_current, size) => {
                      const tab = activeTab as QcTabId;
                      setPagination((prev) => ({
                        ...prev,
                        [tab]: { page: 1, limit: size },
                      }));
                    },
                  }
            }
            locale={{ emptyText: activeTab === "product_return" ? "Coming soon" : "No records" }}
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
        title={<div className="text-lg font-semibold text-gray-900">Create QC Report</div>}
      >
        <Form<ManualReportFormValues>
          form={manualForm}
          layout="vertical"
          requiredMark={false}
          preserve={false}
          className="pt-2"
        >
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item label="QC Type" name="qc_type" rules={[{ required: true, message: "Select QC type" }]}>
              <Segmented
                options={[
                  { label: "Production", value: "production" },
                  { label: "Incoming", value: "incoming" },
                  { label: "Product Return", value: "product_return" },
                ]}
              />
            </Form.Item>

            <Form.Item label="Report Date" name="report_date" rules={[{ required: true, message: "Select report date" }]}>
              <DatePicker className="w-full" format="YYYY-MM-DD" />
            </Form.Item>

            <Form.Item label={getReferenceLabel(selectedQcType)} name="reference_number" rules={[{ required: true, message: "Select reference number" }]}> 
              <Select
                showSearch
                placeholder="Select from master list"
                options={referenceOptions}
                loading={formOptionsQuery.isFetching}
                filterOption={(input, option) => String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>

            <Form.Item name="record_id" hidden>
              <Input />
            </Form.Item>

            <Form.Item label="UNIQ Code" name="uniq_code" rules={[{ required: true, message: "UNIQ will be filled automatically" }]}> 
              <Input placeholder="Auto-filled from selected number" disabled />
            </Form.Item>

            <Form.Item
              label="Items Checked"
              name="number_of_item_check"
              rules={[{ required: true, message: "Enter items checked" }]}
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>

            <Form.Item label="Status" name="status" rules={[{ required: true, message: "Select status" }]}>
              <Segmented
                options={[
                  { label: "Passed", value: "passed" },
                  { label: "Not Passed", value: "not_passed" },
                  { label: "Failed", value: "failed" },
                ]}
              />
            </Form.Item>

            <Form.Item label="Issue" name="issue">
              <Select
                showSearch
                placeholder="Select issue"
                options={issueOptions}
                loading={formDetailQuery.isFetching}
                filterOption={(input, option) => String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>

            <Form.Item label="Number of Defect" name="number_of_defect">
              <InputNumber className="w-full" min={0} />
            </Form.Item>

            <Form.Item label="Number of Scrap" name="number_of_scrap">
              <InputNumber className="w-full" min={0} />
            </Form.Item>

            <Form.Item label="Number of Product Return" name="number_of_product_return">
              <InputNumber className="w-full" min={0} />
            </Form.Item>

            {/* <Form.Item label="Remarks" name="remarks" className="md:col-span-2">
              <Input.TextArea rows={3} placeholder="Additional QC remarks" />
            </Form.Item> */}
          </div>
        </Form>
      </Modal>
    </div>
  );
}
