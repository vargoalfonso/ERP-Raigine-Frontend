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
  Select,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import StatsCard from "@/components/StatsCard";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type QcReportFormOptionRecord,
  type QcReportLookupType,
  useCreateQcDashboardReportMutation,
  useCreateProductReturnReworkWoMutation,
  useGetDefectReportsQuery,
  useGetIncomingQcReportsQuery,
  useGetProductReturnQcReportsQuery,
  useGetProductionQcReportsQuery,
  useGetQcReportFormDetailQuery,
  useGetQcReportFormOptionsQuery,
} from "@/lib/api/qc-dashboard/api";

type QcTabId = "production-qc" | "incoming-qc" | "product-return" | "defect-report";

type DraftQcFormValues = {
  qcType: QcReportLookupType;
  recordId?: string;
  reportDate?: Dayjs;
  referenceNumber?: string;
  referenceType?: string;
  uniq?: string;
  itemsChecked?: number;
  issue?: string;
  defects?: number;
  scrap?: number;
  status?: string;
  supplierName?: string;
  partNumber?: string;
  partName?: string;
  numberOfProductReturn?: number;
  remarks?: string;
};

type ReworkFormValues = {
  quantity: number;
  targetDate?: Dayjs;
  notes?: string;
};

type ProductionTableRow = {
  key: string;
  reportDate: string;
  woNumber: string;
  uniq: string;
  kanbanNumber: string;
  supplierName: string;
  processName: string;
  itemsChecked: number;
  issue: string;
  defects: number;
  scrap: number;
  status: string;
};

type IncomingTableRow = {
  key: string;
  reportDate: string;
  kanbanScan: string;
  poNumber: string;
  supplierName: string;
  uniq: string;
  itemsChecked: number;
  issue: string;
  defects: number;
  scrap: number;
  status: string;
};

type ProductReturnTableRow = {
  key: string;
  reportDate: string;
  packingScan: string;
  previousDnNumber: string;
  supplierName: string;
  uniq: string;
  itemsChecked: number;
  issue: string;
  returnQty: number;
  scrap: number;
  defects: number;
  status: string;
};

type DefectTableRow = {
  key: string;
  sourceId: string;
  sourceType: string;
  reportDate: string;
  packingListOrKanban: string;
  poNumber: string;
  supplierName: string;
  uniq: string;
  productName: string;
  defectIssue: string;
  numberOfDefect: number;
  woReworkStatus: string;
  canCreateReworkWo: boolean;
  suggestedQuantity: number;
  reworkWoNumber: string;
};

const formatDisplayDate = (value?: string | null) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US");
  }

  return value;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
};

const toText = (value: unknown, fallback = "-") => {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
};

const buildSelectOptions = (values: Array<string | null | undefined>, allLabel: string) => {
  const uniqueValues = Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))
  ).sort((left, right) => left.localeCompare(right));

  return [{ label: allLabel, value: "all" }, ...uniqueValues.map((value) => ({ label: value, value }))];
};

const passedTagClass = "rounded-md bg-green-50 text-green-700 border border-green-100";
const failedTagClass = "rounded-md bg-red-50 text-red-700 border border-red-100";
const pendingTagClass = "rounded-md bg-yellow-50 text-yellow-800 border border-yellow-100";
const progressTagClass = "rounded-md bg-blue-50 text-blue-700 border border-blue-100";
const neutralTagClass = "rounded-md bg-gray-50 text-gray-700 border border-gray-200";

const getStatusTagClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes("pass") || normalized.includes("approved") || normalized.includes("completed")) return passedTagClass;
  if (normalized.includes("pending") || normalized.includes("ready")) return pendingTagClass;
  if (normalized.includes("progress")) return progressTagClass;
  if (normalized.includes("reject") || normalized.includes("fail") || normalized.includes("not passed")) return failedTagClass;
  return neutralTagClass;
};

const mapTabToLookupQcType = (tab: QcTabId): QcReportLookupType => {
  if (tab === "incoming-qc") return "incoming_qc";
  if (tab === "product-return") return "product_return_qc";
  return "production_qc";
};

const getLookupRecordId = (record?: QcReportFormOptionRecord | null) => {
  if (!record) return "";
  if (record.return_id) return String(record.return_id);
  if (record.qc_task_id != null) return String(record.qc_task_id);
  return "";
};

const getReferenceFieldLabel = (_qcType: QcReportLookupType) => "WO/PO/DN Number";

export default function QcDashboardPage() {
  const [draftForm] = Form.useForm<DraftQcFormValues>();
  const [reworkForm] = Form.useForm<ReworkFormValues>();
  const apiEnabled = Boolean(apiBaseUrl);

  const [activeTab, setActiveTab] = useState<QcTabId>("production-qc");
  const [uniqFilter, setUniqFilter] = useState<string>("all");
  const [reportDateFilter, setReportDateFilter] = useState<Dayjs | null>(null);
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [poNumberFilter, setPoNumberFilter] = useState<string>("");
  const [previousDnFilter, setPreviousDnFilter] = useState<string>("");
  const [defectFromFilter, setDefectFromFilter] = useState<string>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDefectRow, setSelectedDefectRow] = useState<DefectTableRow | null>(null);

  const selectedQcType = Form.useWatch("qcType", draftForm) ?? mapTabToLookupQcType(activeTab);
  const selectedDraftUniq = Form.useWatch("uniq", draftForm);
  const selectedDraftRecordId = Form.useWatch("recordId", draftForm);
  const reportDateParam = reportDateFilter?.format("YYYY-MM-DD");

  const productionAllQuery = useGetProductionQcReportsQuery(undefined, { skip: !apiEnabled });
  const incomingAllQuery = useGetIncomingQcReportsQuery(undefined, { skip: !apiEnabled });
  const productReturnAllQuery = useGetProductReturnQcReportsQuery(undefined, { skip: !apiEnabled });
  const defectAllQuery = useGetDefectReportsQuery(undefined, { skip: !apiEnabled });
  const formOptionsQuery = useGetQcReportFormOptionsQuery(
    {
      qc_type: selectedQcType,
      uniq: selectedDraftUniq || undefined,
    },
    {
      skip: !apiEnabled || !isAddModalOpen,
    }
  );
  const formDetailQuery = useGetQcReportFormDetailQuery(
    {
      qc_type: selectedQcType,
      record_id: selectedDraftRecordId || "",
    },
    {
      skip: !apiEnabled || !isAddModalOpen || !selectedDraftRecordId,
    }
  );
  const [createQcDashboardReport, createQcDashboardReportState] = useCreateQcDashboardReportMutation();
  const [createProductReturnReworkWo, createReworkState] = useCreateProductReturnReworkWoMutation();

  const productionFilters = useMemo(
    () => ({
      uniq: uniqFilter !== "all" ? uniqFilter : undefined,
      report_date: reportDateParam,
    }),
    [reportDateParam, uniqFilter]
  );

  const incomingFilters = useMemo(
    () => ({
      uniq: uniqFilter !== "all" ? uniqFilter : undefined,
      report_date: reportDateParam,
      po_number: poNumberFilter.trim() || undefined,
      supplier: supplierFilter !== "all" ? supplierFilter : undefined,
    }),
    [poNumberFilter, reportDateParam, supplierFilter, uniqFilter]
  );

  const productReturnFilters = useMemo(
    () => ({
      uniq: uniqFilter !== "all" ? uniqFilter : undefined,
      report_date: reportDateParam,
      supplier: supplierFilter !== "all" ? supplierFilter : undefined,
      previous_dn_number: previousDnFilter.trim() || undefined,
    }),
    [previousDnFilter, reportDateParam, supplierFilter, uniqFilter]
  );

  const defectFilters = useMemo(
    () => ({
      uniq: uniqFilter !== "all" ? uniqFilter : undefined,
      report_date: reportDateParam,
      po_number: poNumberFilter.trim() || undefined,
      supplier: supplierFilter !== "all" ? supplierFilter : undefined,
      defect_from: defectFromFilter !== "all" ? defectFromFilter : undefined,
    }),
    [defectFromFilter, poNumberFilter, reportDateParam, supplierFilter, uniqFilter]
  );

  const hasProductionFilters = Boolean(productionFilters.uniq || productionFilters.report_date);
  const hasIncomingFilters = Boolean(
    incomingFilters.uniq || incomingFilters.report_date || incomingFilters.po_number || incomingFilters.supplier
  );
  const hasProductReturnFilters = Boolean(
    productReturnFilters.uniq ||
      productReturnFilters.report_date ||
      productReturnFilters.supplier ||
      productReturnFilters.previous_dn_number
  );
  const hasDefectFilters = Boolean(
    defectFilters.uniq || defectFilters.report_date || defectFilters.po_number || defectFilters.supplier || defectFilters.defect_from
  );

  const productionFilteredQuery = useGetProductionQcReportsQuery(productionFilters, {
    skip: !apiEnabled || activeTab !== "production-qc" || !hasProductionFilters,
  });
  const incomingFilteredQuery = useGetIncomingQcReportsQuery(incomingFilters, {
    skip: !apiEnabled || activeTab !== "incoming-qc" || !hasIncomingFilters,
  });
  const productReturnFilteredQuery = useGetProductReturnQcReportsQuery(productReturnFilters, {
    skip: !apiEnabled || activeTab !== "product-return" || !hasProductReturnFilters,
  });
  const defectFilteredQuery = useGetDefectReportsQuery(defectFilters, {
    skip: !apiEnabled || activeTab !== "defect-report" || !hasDefectFilters,
  });

  const productionReports =
    activeTab === "production-qc" && hasProductionFilters
      ? productionFilteredQuery.data?.data ?? []
      : productionAllQuery.data?.data ?? [];
  const incomingReports =
    activeTab === "incoming-qc" && hasIncomingFilters ? incomingFilteredQuery.data?.data ?? [] : incomingAllQuery.data?.data ?? [];
  const productReturnReports =
    activeTab === "product-return" && hasProductReturnFilters
      ? productReturnFilteredQuery.data?.data ?? []
      : productReturnAllQuery.data?.data ?? [];
  const defectReports =
    activeTab === "defect-report" && hasDefectFilters ? defectFilteredQuery.data?.data ?? [] : defectAllQuery.data?.data ?? [];

  const productionRows = useMemo<ProductionTableRow[]>(
    () =>
      productionReports.map((row, index) => ({
        key: String(row.qc_task_id ?? `${row.wo_number ?? "production"}-${index}`),
        reportDate: formatDisplayDate(row.report_date),
        woNumber: toText(row.wo_number),
        uniq: toText(row.uniq),
        kanbanNumber: toText(row.kanban_number),
        supplierName: toText(row.supplier_name),
        processName: toText(row.process_name),
        itemsChecked: toNumber(row.number_of_item_check),
        issue: toText(row.issue),
        defects: toNumber(row.number_of_defect),
        scrap: toNumber(row.number_of_scrap),
        status: toText(row.passed_or_not_passed || row.status),
      })),
    [productionReports]
  );

  const incomingRows = useMemo<IncomingTableRow[]>(
    () =>
      incomingReports.map((row, index) => ({
        key: String(row.qc_task_id ?? `${row.po_number ?? "incoming"}-${index}`),
        reportDate: formatDisplayDate(row.report_date),
        kanbanScan: toText(row.kanban_scan_or_packing_list_scan),
        poNumber: toText(row.po_number),
        supplierName: toText(row.supplier_name),
        uniq: toText(row.uniq),
        itemsChecked: toNumber(row.number_of_item_check),
        issue: toText(row.issue),
        defects: toNumber(row.number_of_defect),
        scrap: toNumber(row.number_of_scrap),
        status: toText(row.passed_or_not_passed || row.status),
      })),
    [incomingReports]
  );

  const productReturnRows = useMemo<ProductReturnTableRow[]>(
    () =>
      productReturnReports.map((row, index) => ({
        key: String(row.return_id ?? `${row.previous_dn_number ?? "return"}-${index}`),
        reportDate: formatDisplayDate(row.report_date),
        packingScan: toText(row.kanban_scan_or_packing_list_scan),
        previousDnNumber: toText(row.previous_dn_number),
        supplierName: toText(row.supplier_name),
        uniq: toText(row.uniq),
        itemsChecked: toNumber(row.number_of_item_check),
        issue: toText(row.issue),
        returnQty: toNumber(row.number_of_product_return),
        scrap: toNumber(row.number_of_scrap),
        defects: toNumber(row.number_of_defect),
        status: toText(row.passed_or_not_passed || row.status),
      })),
    [productReturnReports]
  );

  const defectRows = useMemo<DefectTableRow[]>(
    () =>
      defectReports.map((row, index) => ({
        key: String(row.source_id ?? `${row.source_type ?? "defect"}-${index}`),
        sourceId: String(row.source_id ?? ""),
        sourceType: toText(row.source_type),
        reportDate: formatDisplayDate(row.report_date),
        packingListOrKanban: toText(row.packing_list_or_kanban),
        poNumber: toText(row.po_number),
        supplierName: toText(row.supplier_name),
        uniq: toText(row.uniq),
        productName: toText(row.product_name),
        defectIssue: toText(row.defect_issue),
        numberOfDefect: toNumber(row.number_of_defect),
        woReworkStatus: toText(row.wo_rework_status),
        canCreateReworkWo: Boolean(row.can_create_rework_wo),
        suggestedQuantity: toNumber(row.create_rework_wo_payload?.suggested_quantity ?? row.number_of_defect),
        reworkWoNumber: toText(row.rework_work_order?.wo_number, ""),
      })),
    [defectReports]
  );

  const totalReports =
    (productionAllQuery.data?.data.length ?? 0) +
    (incomingAllQuery.data?.data.length ?? 0) +
    (productReturnAllQuery.data?.data.length ?? 0) +
    (defectAllQuery.data?.data.length ?? 0);

  const totalDefects =
    (productionAllQuery.data?.data ?? []).reduce((sum, row) => sum + toNumber(row.number_of_defect), 0) +
    (incomingAllQuery.data?.data ?? []).reduce((sum, row) => sum + toNumber(row.number_of_defect), 0) +
    (productReturnAllQuery.data?.data ?? []).reduce((sum, row) => sum + toNumber(row.number_of_defect), 0) +
    (defectAllQuery.data?.data ?? []).reduce((sum, row) => sum + toNumber(row.number_of_defect), 0);

  const totalScrap =
    (productionAllQuery.data?.data ?? []).reduce((sum, row) => sum + toNumber(row.number_of_scrap), 0) +
    (incomingAllQuery.data?.data ?? []).reduce((sum, row) => sum + toNumber(row.number_of_scrap), 0) +
    (productReturnAllQuery.data?.data ?? []).reduce((sum, row) => sum + toNumber(row.number_of_scrap), 0);

  const pendingRework = (defectAllQuery.data?.data ?? []).filter((row) => {
    const status = toText(row.wo_rework_status, "").toLowerCase();
    return status === "pending" || status === "ready to create" || status === "in progress";
  }).length;

  const productionUniqOptions = useMemo(
    () => buildSelectOptions((productionAllQuery.data?.data ?? []).map((row) => row.uniq), "All Uniq"),
    [productionAllQuery.data?.data]
  );
  const incomingUniqOptions = useMemo(
    () => buildSelectOptions((incomingAllQuery.data?.data ?? []).map((row) => row.uniq), "All Uniq"),
    [incomingAllQuery.data?.data]
  );
  const incomingSupplierOptions = useMemo(
    () => buildSelectOptions((incomingAllQuery.data?.data ?? []).map((row) => row.supplier_name), "All Supplier"),
    [incomingAllQuery.data?.data]
  );
  const productReturnUniqOptions = useMemo(
    () => buildSelectOptions((productReturnAllQuery.data?.data ?? []).map((row) => row.uniq), "All Uniq"),
    [productReturnAllQuery.data?.data]
  );
  const productReturnSupplierOptions = useMemo(
    () => buildSelectOptions((productReturnAllQuery.data?.data ?? []).map((row) => row.supplier_name ?? undefined), "All Supplier"),
    [productReturnAllQuery.data?.data]
  );
  const defectUniqOptions = useMemo(
    () => buildSelectOptions((defectAllQuery.data?.data ?? []).map((row) => row.uniq), "All Uniq"),
    [defectAllQuery.data?.data]
  );
  const defectSupplierOptions = useMemo(
    () => buildSelectOptions((defectAllQuery.data?.data ?? []).map((row) => row.supplier_name ?? undefined), "All Supplier"),
    [defectAllQuery.data?.data]
  );
  const defectFromOptions = useMemo(
    () => buildSelectOptions((defectAllQuery.data?.data ?? []).map((row) => row.source_type), "All Defect Source"),
    [defectAllQuery.data?.data]
  );

  const activeUniqOptions =
    activeTab === "incoming-qc"
      ? incomingUniqOptions
      : activeTab === "product-return"
        ? productReturnUniqOptions
        : activeTab === "defect-report"
          ? defectUniqOptions
          : productionUniqOptions;

  const activeTableLoading =
    activeTab === "incoming-qc"
      ? hasIncomingFilters
        ? incomingFilteredQuery.isFetching
        : incomingAllQuery.isFetching
      : activeTab === "product-return"
        ? hasProductReturnFilters
          ? productReturnFilteredQuery.isFetching
          : productReturnAllQuery.isFetching
        : activeTab === "defect-report"
          ? hasDefectFilters
            ? defectFilteredQuery.isFetching
            : defectAllQuery.isFetching
          : hasProductionFilters
            ? productionFilteredQuery.isFetching
            : productionAllQuery.isFetching;

  const dashboardError = useMemo(() => {
    const activeError =
      activeTab === "incoming-qc"
        ? hasIncomingFilters
          ? incomingFilteredQuery.error
          : incomingAllQuery.error
        : activeTab === "product-return"
          ? hasProductReturnFilters
            ? productReturnFilteredQuery.error
            : productReturnAllQuery.error
          : activeTab === "defect-report"
            ? hasDefectFilters
              ? defectFilteredQuery.error
              : defectAllQuery.error
            : hasProductionFilters
              ? productionFilteredQuery.error
              : productionAllQuery.error;

    return activeError ? getApiErrorMessage(activeError, "Failed to load QC dashboard data") : "";
  }, [
    activeTab,
    defectAllQuery.error,
    defectFilteredQuery.error,
    hasDefectFilters,
    hasIncomingFilters,
    hasProductReturnFilters,
    hasProductionFilters,
    incomingAllQuery.error,
    incomingFilteredQuery.error,
    productReturnAllQuery.error,
    productReturnFilteredQuery.error,
    productionAllQuery.error,
    productionFilteredQuery.error,
  ]);

  const productionColumns: ColumnsType<ProductionTableRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    {
      title: "WO Number",
      dataIndex: "woNumber",
      key: "woNumber",
      render: (value: string) => <span className="font-medium text-blue-600">{value}</span>,
    },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      render: (value: string) => <span className="font-medium text-blue-600">{value}</span>,
    },
    {
      title: "Kanban Number",
      dataIndex: "kanbanNumber",
      key: "kanbanNumber",
      render: (value: string) => <Tag className={neutralTagClass}>{value}</Tag>,
    },
    { title: "Supplier", dataIndex: "supplierName", key: "supplierName" },
    { title: "Process", dataIndex: "processName", key: "processName" },
    { title: "Items Checked", dataIndex: "itemsChecked", key: "itemsChecked" },
    {
      title: "Issue",
      dataIndex: "issue",
      key: "issue",
      render: (value: string) => <Tag className={neutralTagClass}>{value}</Tag>,
    },
    {
      title: "Defects",
      dataIndex: "defects",
      key: "defects",
      render: (value: number) => <span className="text-red-600">{value}</span>,
    },
    {
      title: "Scrap",
      dataIndex: "scrap",
      key: "scrap",
      render: (value: number) => <span className="text-orange-600">{value}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value: string) => <Tag className={getStatusTagClass(value)}>{value}</Tag>,
    },
  ];

  const incomingColumns: ColumnsType<IncomingTableRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    {
      title: "Kanban/PL Scan",
      dataIndex: "kanbanScan",
      key: "kanbanScan",
      render: (value: string) => <Tag className={neutralTagClass}>{value}</Tag>,
    },
    {
      title: "PO Number",
      dataIndex: "poNumber",
      key: "poNumber",
      render: (value: string) => <span className="font-medium text-blue-600">{value}</span>,
    },
    { title: "Supplier", dataIndex: "supplierName", key: "supplierName" },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      render: (value: string) => <span className="font-medium text-blue-600">{value}</span>,
    },
    { title: "Items Checked", dataIndex: "itemsChecked", key: "itemsChecked" },
    {
      title: "Issue",
      dataIndex: "issue",
      key: "issue",
      render: (value: string) => <Tag className={neutralTagClass}>{value}</Tag>,
    },
    {
      title: "Defects",
      dataIndex: "defects",
      key: "defects",
      render: (value: number) => <span className="text-red-600">{value}</span>,
    },
    {
      title: "Scrap",
      dataIndex: "scrap",
      key: "scrap",
      render: (value: number) => <span className="text-orange-600">{value}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value: string) => <Tag className={getStatusTagClass(value)}>{value}</Tag>,
    },
  ];

  const productReturnColumns: ColumnsType<ProductReturnTableRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    {
      title: "Kanban/PL Scan",
      dataIndex: "packingScan",
      key: "packingScan",
      render: (value: string) => <Tag className={neutralTagClass}>{value}</Tag>,
    },
    {
      title: "Previous DN Number",
      dataIndex: "previousDnNumber",
      key: "previousDnNumber",
      render: (value: string) => <span className="font-medium text-blue-600">{value}</span>,
    },
    { title: "Supplier", dataIndex: "supplierName", key: "supplierName" },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      render: (value: string) => <span className="font-medium text-blue-600">{value}</span>,
    },
    { title: "Items Checked", dataIndex: "itemsChecked", key: "itemsChecked" },
    {
      title: "Issue",
      dataIndex: "issue",
      key: "issue",
      render: (value: string) => <Tag className={neutralTagClass}>{value}</Tag>,
    },
    {
      title: "Return Qty",
      dataIndex: "returnQty",
      key: "returnQty",
      render: (value: number) => <span className="text-red-600">{value}</span>,
    },
    {
      title: "Scrap",
      dataIndex: "scrap",
      key: "scrap",
      render: (value: number) => <span className="text-orange-600">{value}</span>,
    },
    {
      title: "Defects",
      dataIndex: "defects",
      key: "defects",
      render: (value: number) => <span className="text-red-600">{value}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value: string) => <Tag className={getStatusTagClass(value)}>{value}</Tag>,
    },
  ];

  const defectColumns: ColumnsType<DefectTableRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    {
      title: "Defect Source",
      dataIndex: "sourceType",
      key: "sourceType",
      render: (value: string) => <Tag className={getStatusTagClass(value)}>{value}</Tag>,
    },
    {
      title: "Packing List / Kanban",
      dataIndex: "packingListOrKanban",
      key: "packingListOrKanban",
      render: (value: string) => <Tag className={neutralTagClass}>{value}</Tag>,
    },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      render: (value: string) => <span className="font-medium text-blue-600">{value}</span>,
    },
    { title: "Product Name", dataIndex: "productName", key: "productName" },
    { title: "Supplier", dataIndex: "supplierName", key: "supplierName" },
    {
      title: "Number of Defect",
      dataIndex: "numberOfDefect",
      key: "numberOfDefect",
      render: (value: number) => <span className="text-red-600">{value}</span>,
    },
    {
      title: "WO Rework Status",
      dataIndex: "woReworkStatus",
      key: "woReworkStatus",
      render: (value: string) => <Tag className={getStatusTagClass(value)}>{value}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record) => {
        if (record.canCreateReworkWo && record.sourceType.toLowerCase() === "product return" && record.sourceId) {
          return (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                setSelectedDefectRow(record);
                reworkForm.setFieldsValue({ quantity: record.suggestedQuantity || record.numberOfDefect, notes: "" });
              }}
            >
              Create WO Rework
            </Button>
          );
        }

        if (record.reworkWoNumber) {
          return (
            <Button size="small" onClick={() => message.info(`WO Rework: ${record.reworkWoNumber}`)}>
              View WO
            </Button>
          );
        }

        return (
          <Button size="small" disabled>
            {record.woReworkStatus}
          </Button>
        );
      },
    },
  ];

  const currentColumns =
    activeTab === "incoming-qc"
      ? incomingColumns
      : activeTab === "product-return"
        ? productReturnColumns
        : activeTab === "defect-report"
          ? defectColumns
          : productionColumns;

  const currentRows =
    activeTab === "incoming-qc"
      ? incomingRows
      : activeTab === "product-return"
        ? productReturnRows
        : activeTab === "defect-report"
          ? defectRows
          : productionRows;

  const clearFilters = () => {
    setUniqFilter("all");
    setReportDateFilter(null);
    setSupplierFilter("all");
    setPoNumberFilter("");
    setPreviousDnFilter("");
    setDefectFromFilter("all");
  };

  const openAddModal = () => {
    const defaultQcType = mapTabToLookupQcType(activeTab);
    draftForm.resetFields();
    draftForm.setFieldsValue({
      qcType: defaultQcType,
    });
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    draftForm.resetFields();
  };

  const handleDraftSubmit = async () => {
    try {
      const values = await draftForm.validateFields();

      if (!values.recordId) {
        message.error("Select WO/PO/DN Number first");
        return;
      }

      const response = await createQcDashboardReport({
        qc_type: values.qcType,
        record_id: values.recordId,
        report_date: values.reportDate ? values.reportDate.toISOString() : new Date().toISOString(),
        wo_po_dn_number: values.referenceNumber,
        reference_type: values.referenceType,
        uniq: values.uniq,
        supplier_name: values.supplierName,
        part_number: values.partNumber,
        part_name: values.partName,
        number_of_item_check: toNumber(values.itemsChecked),
        issue: values.issue,
        number_of_defect: toNumber(values.defects),
        number_of_scrap: toNumber(values.scrap),
        number_of_product_return: values.numberOfProductReturn != null ? toNumber(values.numberOfProductReturn) : undefined,
        status: values.status ?? "approved",
        remarks: values.remarks,
      }).unwrap();

      message.success(response.message || "QC report created successfully");
      closeAddModal();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to create QC report"));
    }
  };

  const resetDraftSourceFields = (nextQcType: QcReportLookupType) => {
    draftForm.setFieldsValue({
      qcType: nextQcType,
      recordId: undefined,
      reportDate: undefined,
      referenceNumber: undefined,
      referenceType: undefined,
      uniq: undefined,
      itemsChecked: undefined,
      issue: undefined,
      defects: undefined,
      scrap: undefined,
      status: undefined,
      supplierName: undefined,
      partNumber: undefined,
      partName: undefined,
      numberOfProductReturn: undefined,
      remarks: undefined,
    });
  };

  const handleDraftQcTypeChange = (value: QcReportLookupType) => {
    resetDraftSourceFields(value);
  };

  const handleDraftUniqChange = (value: string) => {
    draftForm.setFieldsValue({
      uniq: value,
      recordId: undefined,
      referenceNumber: undefined,
      reportDate: undefined,
      referenceType: undefined,
      itemsChecked: undefined,
      issue: undefined,
      defects: undefined,
      scrap: undefined,
      status: undefined,
      supplierName: undefined,
      partNumber: undefined,
      partName: undefined,
      numberOfProductReturn: undefined,
      remarks: undefined,
    });
  };

  const handleDraftReferenceChange = (value: string) => {
    const matchedRecord =
      draftRecords.find((record) => record.wo_po_dn_number === value && (!selectedDraftUniq || record.uniq === selectedDraftUniq)) ??
      draftRecords.find((record) => record.wo_po_dn_number === value);

    draftForm.setFieldsValue({
      referenceNumber: value,
      recordId: getLookupRecordId(matchedRecord),
      uniq: matchedRecord?.uniq ?? selectedDraftUniq,
      referenceType: matchedRecord?.reference_type,
    });
  };

  const closeReworkModal = () => {
    setSelectedDefectRow(null);
    reworkForm.resetFields();
  };

  const handleCreateReworkWo = async () => {
    if (!selectedDefectRow?.sourceId) return;

    try {
      const values = await reworkForm.validateFields();
      const response = await createProductReturnReworkWo({
        returnId: selectedDefectRow.sourceId,
        quantity: values.quantity,
        target_date: values.targetDate?.format("YYYY-MM-DD"),
        notes: values.notes?.trim() || undefined,
      }).unwrap();

      message.success(response.message || "WO rework created successfully");
      closeReworkModal();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to create WO rework"));
    }
  };

  const clipboardIcon = (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h6M9 3h6a2 2 0 012 2v16a2 2 0 01-2 2H9a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6m-6 4h6m-6 4h4" />
    </svg>
  );

  const crossIcon = (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22a10 10 0 110-20 10 10 0 010 20z" />
    </svg>
  );

  const warningIcon = (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );

  const cubeIcon = (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 16V8a2 2 0 00-1-1.732l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.732l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22.08V12" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.27 6.96L12 12.01l8.73-5.05" />
    </svg>
  );

  const tabs: Array<{ id: QcTabId; label: string }> = [
    { id: "production-qc", label: "Production QC" },
    { id: "incoming-qc", label: "Incoming QC" },
    { id: "product-return", label: "Product Return" },
    { id: "defect-report", label: "Defect Report" },
  ];

  const supplierOptions =
    activeTab === "incoming-qc"
      ? incomingSupplierOptions
      : activeTab === "product-return"
        ? productReturnSupplierOptions
        : defectSupplierOptions;

  const draftUniqOptions = formOptionsQuery.data?.data.uniq_options ?? [];
  const draftReferenceOptions = formOptionsQuery.data?.data.wo_po_dn_options ?? [];
  const draftRecords = formOptionsQuery.data?.data.records ?? [];
  const draftIssueOptions = (formDetailQuery.data?.data.issue_options ?? []).map((option) => ({
    label: option.label,
    value: option.value,
  }));
  const draftStatusOptions = (formDetailQuery.data?.data.status_options ?? []).map((option) => ({
    label: option.label,
    value: option.value,
  }));
  const addFormError = useMemo(() => {
    const error = formOptionsQuery.error ?? formDetailQuery.error;
    return error ? getApiErrorMessage(error, "Failed to load Add QC Report form data") : "";
  }, [formDetailQuery.error, formOptionsQuery.error]);

  useEffect(() => {
    const detail = formDetailQuery.data?.data;
    if (!detail) return;

    draftForm.setFieldsValue({
      recordId: detail.record_id != null ? String(detail.record_id) : undefined,
      reportDate: detail.report_date ? dayjs(detail.report_date) : undefined,
      referenceNumber: detail.wo_po_dn_number,
      referenceType: detail.reference_type,
      uniq: detail.uniq,
      itemsChecked: toNumber(detail.number_of_item_check),
      issue: detail.issue,
      defects: toNumber(detail.number_of_defect),
      scrap: toNumber(detail.number_of_scrap),
      status: detail.status,
      supplierName: detail.supplier_name,
      partNumber: detail.part_number,
      partName: detail.part_name,
      numberOfProductReturn: detail.number_of_product_return != null ? toNumber(detail.number_of_product_return) : undefined,
      remarks: detail.remarks,
    });
  }, [draftForm, formDetailQuery.data]);

  return (
    <div className="min-h-full bg-gray-50 p-6">
      <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div>
          <div className="text-base font-semibold text-gray-900">QC Dashboard</div>
          <div className="text-sm text-gray-500">
            Monitoring report QC production, incoming, product return, dan defect berdasarkan endpoint qc-dashboard.
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
          Add QC Report
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Reports" value={totalReports} subtitle="" icon={clipboardIcon} bgColor="bg-blue-50" textColor="text-blue-600" />
        <StatsCard title="Total Defects" value={totalDefects} subtitle="" icon={crossIcon} bgColor="bg-red-50" textColor="text-red-600" />
        <StatsCard title="Total Scrap" value={totalScrap} subtitle="" icon={warningIcon} bgColor="bg-orange-50" textColor="text-orange-600" />
        <StatsCard title="Pending Rework" value={pendingRework} subtitle="" icon={cubeIcon} bgColor="bg-yellow-50" textColor="text-yellow-700" />
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="px-5 pt-5">
          <div className="flex items-center gap-2 rounded-xl bg-gray-100 p-2">
            {tabs.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    clearFilters();
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-white font-medium text-gray-900" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <div className="mb-1 text-xs font-medium text-gray-500">Uniq</div>
              <Select value={uniqFilter} onChange={setUniqFilter} options={activeUniqOptions} />
            </div>

            <div className="min-w-[180px]">
              <div className="mb-1 text-xs font-medium text-gray-500">Report Date</div>
              <DatePicker
                value={reportDateFilter}
                onChange={(value) => setReportDateFilter(value)}
                format="YYYY-MM-DD"
                className="w-full"
                placeholder="Select date"
              />
            </div>

            {(activeTab === "incoming-qc" || activeTab === "defect-report") && (
              <div className="min-w-[180px] flex-1">
                <div className="mb-1 text-xs font-medium text-gray-500">PO Number</div>
                <Input value={poNumberFilter} onChange={(event) => setPoNumberFilter(event.target.value)} placeholder="Filter PO Number" />
              </div>
            )}

            {activeTab === "product-return" && (
              <div className="min-w-[220px] flex-1">
                <div className="mb-1 text-xs font-medium text-gray-500">Previous DN Number</div>
                <Input
                  value={previousDnFilter}
                  onChange={(event) => setPreviousDnFilter(event.target.value)}
                  placeholder="Filter previous DN number"
                />
              </div>
            )}

            {(activeTab === "incoming-qc" || activeTab === "product-return" || activeTab === "defect-report") && (
              <div className="min-w-[180px] flex-1">
                <div className="mb-1 text-xs font-medium text-gray-500">Supplier</div>
                <Select value={supplierFilter} onChange={setSupplierFilter} options={supplierOptions} />
              </div>
            )}

            {activeTab === "defect-report" && (
              <div className="min-w-[180px] flex-1">
                <div className="mb-1 text-xs font-medium text-gray-500">Defect From</div>
                <Select value={defectFromFilter} onChange={setDefectFromFilter} options={defectFromOptions} />
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button onClick={clearFilters}>Reset</Button>
              <Button onClick={() => message.info("Export belum dihubungkan ke endpoint khusus.")}>Export</Button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          {!apiEnabled ? (
            <Alert
              type="warning"
              showIcon
              message="QC Dashboard API is not configured. Set NEXT_PUBLIC_API_URL to your backend base URL."
              className="mb-4"
            />
          ) : dashboardError ? (
            <Alert type="error" showIcon message={dashboardError} className="mb-4" />
          ) : null}

          <Table
            columns={currentColumns as unknown as ColumnsType<object>}
            dataSource={currentRows as unknown as object[]}
            rowKey="key"
            loading={activeTableLoading}
            pagination={false}
            className="overflow-hidden rounded-xl"
            locale={{ emptyText: "No QC records found" }}
            scroll={{ x: 1100 }}
          />
        </div>
      </div>

      <Modal
        open={isAddModalOpen}
        onCancel={closeAddModal}
        footer={null}
        width={640}
        destroyOnHidden
        centered
        title={<div className="text-[28px] font-semibold text-gray-900">Add QC Report</div>}
      >
        <Form<DraftQcFormValues> form={draftForm} layout="vertical" preserve={false} requiredMark={false} className="pt-2">
          <Form.Item name="recordId" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="referenceType" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="supplierName" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="partNumber" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="partName" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="numberOfProductReturn" hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item name="remarks" hidden>
            <Input />
          </Form.Item>

          <div className="grid grid-cols-1 gap-x-4 gap-y-1 md:grid-cols-2">
            <Form.Item label="QC Type" name="qcType" rules={[{ required: true, message: "Select QC type" }]} className="mb-3 md:col-span-2">
              <Select
                placeholder="Select QC type"
                onChange={handleDraftQcTypeChange}
                options={[
                  { label: "Production QC", value: "production_qc" },
                  { label: "Incoming QC", value: "incoming_qc" },
                  { label: "Product Return QC", value: "product_return_qc" },
                ]}
              />
            </Form.Item>

            <Form.Item label="Report Date" name="reportDate" rules={[{ required: true, message: "Select report date" }]} className="mb-3">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="dd/mm/yyyy" />
            </Form.Item>

            <Form.Item
              label={getReferenceFieldLabel(selectedQcType)}
              name="referenceNumber"
              rules={[{ required: true, message: "Select WO/PO/DN Number" }]}
              className="mb-3"
            >
              <Select
                placeholder="Select WO/PO/DN Number"
                loading={formOptionsQuery.isFetching}
                disabled={draftReferenceOptions.length === 0}
                options={draftReferenceOptions}
                onChange={handleDraftReferenceChange}
              />
            </Form.Item>

            <Form.Item label="Uniq" name="uniq" rules={[{ required: true, message: "Select uniq" }]} className="mb-3">
              <Select placeholder="Select uniq" loading={formOptionsQuery.isFetching} options={draftUniqOptions} onChange={handleDraftUniqChange} />
            </Form.Item>

            <Form.Item
              label="Number of Item Check"
              name="itemsChecked"
              rules={[{ required: true, message: "Enter item count" }]}
              className="mb-3"
            >
              <InputNumber className="w-full" min={0} placeholder="50" />
            </Form.Item>

            <Form.Item label="Issue" name="issue" rules={[{ required: true, message: "Select issue type" }]} className="mb-3 md:col-span-2">
              <Select placeholder="Select issue type" loading={formDetailQuery.isFetching} options={draftIssueOptions} />
            </Form.Item>

            <Form.Item label="Number of Defect" name="defects" rules={[{ required: true, message: "Enter defect count" }]} className="mb-3">
              <InputNumber className="w-full" min={0} placeholder="0" />
            </Form.Item>

            <Form.Item label="Number of Scrap" name="scrap" rules={[{ required: true, message: "Enter scrap count" }]} className="mb-3">
              <InputNumber className="w-full" min={0} placeholder="0" />
            </Form.Item>

            <Form.Item label="Status" name="status" rules={[{ required: true, message: "Select status" }]} className="mb-3">
              <Select placeholder="Select status" loading={formDetailQuery.isFetching} options={draftStatusOptions} />
            </Form.Item>
          </div>

          {addFormError ? <Alert type="error" showIcon className="mb-4" message={addFormError} /> : null}

          <div className="mt-2 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button onClick={closeAddModal}>Cancel</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleDraftSubmit} loading={createQcDashboardReportState.isLoading}>
              Add QC Report
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        open={Boolean(selectedDefectRow)}
        onCancel={closeReworkModal}
        onOk={handleCreateReworkWo}
        okText="Create WO Rework"
        cancelText="Cancel"
        confirmLoading={createReworkState.isLoading}
        destroyOnHidden
        title="Create WO Rework"
      >
        <div className="mb-4 text-sm text-gray-500">
          {selectedDefectRow ? `Create rework WO untuk ${selectedDefectRow.uniq} - ${selectedDefectRow.productName}` : ""}
        </div>

        <Form<ReworkFormValues> form={reworkForm} layout="vertical" preserve={false} requiredMark={false}>
          <Form.Item label="Quantity" name="quantity" rules={[{ required: true, message: "Enter quantity" }]}>
            <InputNumber className="w-full" min={1} />
          </Form.Item>

          <Form.Item label="Target Date" name="targetDate">
            <DatePicker className="w-full" format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={3} placeholder="Create manual rework WO from QC Dashboard" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
