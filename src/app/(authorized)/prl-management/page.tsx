"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  Upload,
  message,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChartOutlined,
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  EyeOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  DownloadOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { apiBaseUrl, generateHeaders } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useDeletePrlMutation,
  useGetPrlGapAnalysisQuery,
  useGetPrlByIdQuery,
  useImportPrlsMutation,
  useListPrlsQuery,
  useUpdatePrlMutation,
} from "@/lib/api/prl/api";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { useGetGlobalWorkingDaysQuery } from "@/lib/api/system-settings/api";

type PrlTabId = "forecast-table" | "demand-gap" | "bulk-ops";

type AnalyticsTabId = "overview" | "trends" | "customers" | "performance" | "risk";

type CustomerPerformanceRow = {
  key: string;
  customer: string;
  forecastVolume: number;
  actualVolume: number;
  accuracyPct: number;
  revenueImpact: string;
  reliability: "A+" | "A" | "B";
};

type QuarterlyPerformanceRow = {
  key: string;
  quarter: string;
  plannedQty: number;
  actualQty: number;
  plannedRevenue: string;
  actualRevenue: string;
  accuracyPct: number;
};

type RiskAssessmentRow = {
  key: string;
  riskFactor: string;
  probability: "High" | "Medium" | "Low";
  impact: "High" | "Medium" | "Low";
  mitigationStrategy: string;
  status: "Monitoring" | "Action Needed";
};

type PrlStatus = string;

const normalizePrlStatus = (value: unknown): PrlStatus => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "-";

  const lowerCased = normalized.toLowerCase().replace(/[_-]+/g, " ");
  return lowerCased.replace(/\b\w/g, (char) => char.toUpperCase());
};

const getPrlStatusColor = (value: PrlStatus) => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized || normalized === "-") return "default";
  if (["active", "approved", "complete", "completed", "done"].includes(normalized)) return "blue";
  if (["inactive", "cancelled", "canceled", "rejected", "closed"].includes(normalized)) return "default";
  if (["pending", "draft", "waiting", "in progress", "processing", "monitoring"].includes(normalized)) return "gold";
  if (["urgent", "overdue", "failed", "error", "action needed"].includes(normalized)) return "red";

  return "default";
};

const canDeletePrlStatus = (value: PrlStatus) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "pending" || normalized === "rejected";
};

type ForecastRow = {
  key: string;
  prlId: string;
  customer: string;
  customerId?: string;
  uniq: string;
  productModel: string;
  partName: string;
  partNumber: string;
  quantity: number;
  period: string;
  status: PrlStatus;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  deliveryQuantity?: number;
};

type ForecastDetailState = {
  open: boolean;
  record: ForecastRow | null;
};

type DemandGapStatus = "Under" | "Over" | "On Track";

type DemandGapRow = {
  key: string;
  uniq: string;
  customerForecast: number;
  actualDelivery: number;
  gapUnits: number;
  gapPercent: number;
  status: DemandGapStatus;
};

const initialRows: ForecastRow[] = [
  {
    key: "PRL-001",
    prlId: "PRL-001",
    customer: "Toyota Motor Corp",
    uniq: "LV7-001",
    productModel: "Camry 2024",
    partName: "Engine Mount Bracket",
    partNumber: "EM-001-LV7",
    quantity: 2500,
    period: "2024-Q1",
    status: "Active",
  },
  {
    key: "PRL-002",
    prlId: "PRL-002",
    customer: "Honda Manufacturing",
    uniq: "LV8-002",
    productModel: "Civic 2024",
    partName: "Suspension Arm",
    partNumber: "SA-002-LV8",
    quantity: 1800,
    period: "2024-Q1",
    status: "Active",
  },
  {
    key: "PRL-003",
    prlId: "PRL-003",
    customer: "Nissan Global",
    uniq: "LV9-003",
    productModel: "Altima 2024",
    partName: "Brake Caliper",
    partNumber: "BC-003-LV9",
    quantity: 3200,
    period: "2024-Q2",
    status: "Active",
  },
];

const demandGapRows: DemandGapRow[] = [
  {
    key: "LV7-001",
    uniq: "LV7-001",
    customerForecast: 2500,
    actualDelivery: 2350,
    gapUnits: -150,
    gapPercent: -6,
    status: "Under",
  },
  {
    key: "LV8-002",
    uniq: "LV8-002",
    customerForecast: 1800,
    actualDelivery: 1920,
    gapUnits: 120,
    gapPercent: 6.7,
    status: "Over",
  },
  {
    key: "LV9-003",
    uniq: "LV9-003",
    customerForecast: 3200,
    actualDelivery: 3180,
    gapUnits: -20,
    gapPercent: -0.6,
    status: "On Track",
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

// ============================================================
// Helper untuk Analytics View.
// Periode PRL bisa datang dalam beberapa format ("2026-07",
// "2026-Q3", "2026-07-29", "2026"). Semuanya dinormalkan ke
// satu kunci kuartal "YYYY-Qn" agar bisa diagregasi.
// ============================================================
function toQuarterKey(period: string): string | null {
  const raw = String(period ?? "").trim();
  if (!raw) return null;

  const quarterMatch = raw.match(/^(\d{4})\D*Q([1-4])$/i);
  if (quarterMatch) return `${quarterMatch[1]}-Q${quarterMatch[2]}`;

  const monthMatch = raw.match(/^(\d{4})-(\d{1,2})/);
  if (monthMatch) {
    const month = Number(monthMatch[2]);
    if (month >= 1 && month <= 12) {
      return `${monthMatch[1]}-Q${Math.floor((month - 1) / 3) + 1}`;
    }
  }

  return null;
}

// "2024-Q1" -> "Q1 2024"
function quarterLabel(quarterKey: string): string {
  const [year, quarter] = quarterKey.split("-Q");
  return year && quarter ? `Q${quarter} ${year}` : quarterKey;
}

// Reliability dinilai dari seberapa dekat realisasi ke forecast.
function reliabilityFromAccuracy(pct: number): "A+" | "A" | "B" {
  const deviation = Math.abs(100 - pct);
  if (deviation <= 5) return "A+";
  if (deviation <= 10) return "A";
  return "B";
}

function riskLevelFromPct(pct: number): "High" | "Medium" | "Low" {
  if (pct >= 30) return "High";
  if (pct >= 10) return "Medium";
  return "Low";
}

function signedPercent(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export default function PrlManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PrlTabId>("forecast-table");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState<string>("");
  const [periodFilter, setPeriodFilter] = useState<string>("current");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [prlIdFilter, setPrlIdFilter] = useState<string | undefined>(undefined);
  const [uniqFilter, setUniqFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [forecastDetail, setForecastDetail] = useState<ForecastDetailState>({
    open: false,
    record: null,
  });
  const [editPrlOpen, setEditPrlOpen] = useState(false);
  const [editingPrl, setEditingPrl] = useState<ForecastRow | null>(null);
  const [editForm] = Form.useForm();

  const apiEnabled = Boolean(apiBaseUrl);
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const { data: globalParameters = [] } = useGetGlobalWorkingDaysQuery(undefined, {
    skip: !apiEnabled,
  });

  const prlListQuery = useListPrlsQuery({ page: currentPage, limit: pageSize }, { skip: !apiEnabled });
  const prlDetailQuery = useGetPrlByIdQuery(forecastDetail.record?.key ?? "", {
    skip: !apiEnabled || !forecastDetail.open || !forecastDetail.record?.key,
  });
  // Gap analysis juga dipakai oleh Analytics View (tab Risk Analysis),
  // jadi jangan di-skip saat modal analytics dibuka.
  // Sumber data: GET /prls/history-vs-delivery (grouped per forecast_period + uniq_code).
  const gapQuery = useGetPrlGapAnalysisQuery(
    { page: 1, limit: 500 },
    { skip: !apiEnabled || (activeTab !== "demand-gap" && !analyticsOpen) }
  );

  const [importPrls, importPrlsState] = useImportPrlsMutation();
  const [updatePrl, updatePrlState] = useUpdatePrlMutation();
  const [deletePrl, deletePrlState] = useDeletePrlMutation();

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data]
  );

  const anyBulkLoading = importPrlsState.isLoading || updatePrlState.isLoading || deletePrlState.isLoading;

  const refetchDemandGapIfActive = () => {
    if (activeTab !== "demand-gap") return;
    gapQuery.refetch();
  };

  const openEditModal = (record: ForecastRow) => {
    setEditingPrl(record);
    editForm.setFieldsValue({
      forecastPeriod: record.period,
      quantity: record.quantity,
    });
    setEditPrlOpen(true);
  };

  const handleExport = async () => {
    if (!apiEnabled || !apiBaseUrl) {
      message.info("Export is only available in API mode");
      return;
    }

    try {
      const headers = await generateHeaders({ useAuthorization: true, contentType: "application/json" });
      const response = await fetch(`${apiBaseUrl}/prls/export`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "prls-export.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
      message.success("PRL export downloaded");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to export PRL data"));
    }
  };

  const handleDownloadTemplate = async () => {
    if (!apiEnabled || !apiBaseUrl) {
      message.info("Download template is only available in API mode");
      return;
    }

    try {
      const headers = await generateHeaders({ useAuthorization: true });
      const response = await fetch(`${apiBaseUrl}/template/prls`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Template download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "prls-template.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      message.success("Template downloaded");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to download template"));
    }
  };

  const resolvedForecastRows = useMemo<ForecastRow[]>(() => {
    if (!apiEnabled) return initialRows;
    const list = prlListQuery.data?.items;
    if (!list) return initialRows;

    return list.map((r) => {
      const customerName = r.customer?.customer_name ?? r.customer_name ?? (r.customer_uuid ? `Customer #${r.customer_uuid}` : "-");
      const uniq = r.uniq_code ?? r.item_uniq_code ?? "-";
      const normalizedStatus = normalizePrlStatus(r.status ?? r.approval_status);

      return {
        key: r.id,
        prlId: r.prl_id ?? r.id,
        customer: customerName,
        customerId: r.customer_uuid != null ? String(r.customer_uuid) : r.customer_id != null ? String(r.customer_id) : undefined,
        uniq,
        productModel: r.product_model ?? r.product_details?.model ?? r.product_details?.description ?? bomIndex.modelByUniq[uniq] ?? bomIndex.assemblyCodeByUniq[uniq] ?? "-",
        partName: r.part_name ?? r.product_details?.part_name ?? bomIndex.partNameByUniq[uniq] ?? "-",
        partNumber: r.part_number ?? r.product_details?.part_number ?? bomIndex.partNumberByUniq[uniq] ?? "-",
        quantity: Number(r.quantity ?? 0),
        period: r.forecast_period ?? r.period ?? "-",
        status: normalizedStatus as PrlStatus,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deliveryQuantity: Number(r.delivery_quantity ?? 0),
      };
    });
  }, [apiEnabled, bomIndex.assemblyCodeByUniq, bomIndex.modelByUniq, bomIndex.partNameByUniq, bomIndex.partNumberByUniq, prlListQuery.data]);

  const filteredForecastRows = useMemo(() => {
    let rows = resolvedForecastRows;
    if (prlIdFilter) rows = rows.filter((r) => String(r.prlId) === String(prlIdFilter));
    if (uniqFilter) rows = rows.filter((r) => String(r.uniq) === String(uniqFilter));
    if (search) {
      const s = search.trim().toLowerCase();
      rows = rows.filter((r) => (r.uniq ?? "").toLowerCase().includes(s) || (r.partName ?? "").toLowerCase().includes(s));
    }
    return rows;
  }, [resolvedForecastRows, prlIdFilter, uniqFilter, search]);

  // PRL grouping: map prlId -> uniq codes
  const prlGroups = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const list = prlListQuery.data?.items ?? [];
    for (const r of list) {
      const prlId = String(r.prl_id ?? r.id ?? "").trim();
      const uniq = String(r.uniq_code ?? r.item_uniq_code ?? "").trim();
      if (!prlId) continue;
      const s = map.get(prlId) ?? new Set<string>();
      if (uniq) s.add(uniq);
      map.set(prlId, s);
    }
    return map;
  }, [prlListQuery.data]);

  const prlIdOptions = useMemo(() => Array.from(prlGroups.keys()).map((id) => ({ label: id, value: id })), [prlGroups]);

  const uniqOptionsForSelectedPrl = useMemo(() => {
    if (prlIdFilter) {
      const set = prlGroups.get(prlIdFilter) ?? new Set();
      return Array.from(set).map((u) => ({ label: u, value: u }));
    }
    // all uniqs
    const all = new Set<string>();
    for (const s of prlGroups.values()) for (const u of s) all.add(u);
    return Array.from(all).map((u) => ({ label: u, value: u }));
  }, [prlGroups, prlIdFilter]);

  const selectedUniqRows = useMemo(() => {
    if (!forecastDetail.record) return [] as ForecastRow[];
    return resolvedForecastRows.filter((row) => row.uniq === forecastDetail.record?.uniq);
  }, [forecastDetail.record, resolvedForecastRows]);

  const selectedUniqSummary = useMemo(() => {
    if (!forecastDetail.record) return null;
    const rowsForUniq = selectedUniqRows;
    const quantity = rowsForUniq.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const deliveryQuantity = rowsForUniq.reduce(
      (sum, row) => sum + Number(row.deliveryQuantity || 0),
      0
    );

    return {
      uniq: forecastDetail.record.uniq,
      productModel: forecastDetail.record.productModel,
      partName: forecastDetail.record.partName,
      partNumber: forecastDetail.record.partNumber,
      totalForecastQty: quantity,
      totalDeliveryQty: deliveryQuantity,
      totalEntries: rowsForUniq.length,
    };
  }, [forecastDetail.record, selectedUniqRows]);

  // All uniq rows that belong to the same PRL ID as the opened detail record.
  // These share ONE prl_id but each keeps its own quantity.
  const detailUniqRows = useMemo(() => {
    if (!forecastDetail.record) return [] as ForecastRow[];
    const pid = String(forecastDetail.record.prlId ?? "");
    return resolvedForecastRows.filter((row) => String(row.prlId) === pid);
  }, [forecastDetail.record, resolvedForecastRows]);

  const resolvedDemandGapRows = useMemo<DemandGapRow[]>(() => {
    if (!apiEnabled) return demandGapRows;
    const list = gapQuery.data;
    if (!list) return demandGapRows;

    const parseUnits = (v: string | number) => {
      if (typeof v === "number") return v;
      const n = Number(String(v).replace(/[^0-9.+-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    const parsePercent = (v: string) => {
      const n = Number(String(v).replace(/[^0-9.+-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };

    return list.map((g) => ({
      // uniq yang sama bisa muncul di beberapa forecast_period, jadi rowKey harus gabungan
      // keduanya agar baris tidak saling menimpa di tabel.
      key: g.forecast_period ? `${g.forecast_period}::${g.uniq}` : g.uniq,
      uniq: g.uniq,
      customerForecast: Number(g.customer_forecast ?? 0),
      actualDelivery: Number(g.actual_delivery ?? 0),
      gapUnits: parseUnits(g.gap_units),
      gapPercent: parsePercent(g.gap_percentage),
      status: (g.status ?? "On Track") as DemandGapStatus,
    }));
  }, [apiEnabled, gapQuery.data]);

  React.useEffect(() => {
    if (!apiEnabled) return;
    const err = activeTab === "forecast-table" ? prlListQuery.error : activeTab === "demand-gap" ? gapQuery.error : undefined;
    if (!err) return;
    message.error(getApiErrorMessage(err, "Failed to load PRL data"));
  }, [apiEnabled, activeTab, prlListQuery.error, gapQuery.error]);
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTabId>("overview");

  const analyticsTabs: Array<{ id: AnalyticsTabId; label: string }> = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "trends", label: "Trends" },
      { id: "customers", label: "Customers" },
      { id: "performance", label: "Performance" },
      { id: "risk", label: "Risk Analysis" },
    ],
    []
  );

  // ============================================================
  // ANALYTICS VIEW - INTEGRASI DATA NYATA
  // Tampilan tidak diubah. Yang berubah hanya sumber angkanya:
  // sebelumnya hardcoded, sekarang dihitung dari prlListQuery
  // (forecast vs delivery) dan gapQuery (gap analysis).
  // ============================================================

  // Agregasi per kuartal.
  const quarterBuckets = useMemo(() => {
    const map = new Map<
      string,
      { forecast: number; actual: number; entries: number; customers: Set<string> }
    >();

    for (const row of resolvedForecastRows) {
      const key = toQuarterKey(row.period);
      if (!key) continue;

      const bucket =
        map.get(key) ?? { forecast: 0, actual: 0, entries: 0, customers: new Set<string>() };
      bucket.forecast += Number(row.quantity || 0);
      bucket.actual += Number(row.deliveryQuantity || 0);
      bucket.entries += 1;
      if (row.customer && row.customer !== "-") bucket.customers.add(row.customer);
      map.set(key, bucket);
    }

    return Array.from(map.entries())
      .map(([period, value]) => ({ period, ...value }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [resolvedForecastRows]);

  // Agregasi per customer.
  const customerAggregates = useMemo(() => {
    const map = new Map<string, { forecast: number; actual: number; uniqs: Set<string> }>();

    for (const row of resolvedForecastRows) {
      const name = row.customer && row.customer !== "-" ? row.customer : "Unknown";
      const bucket = map.get(name) ?? { forecast: 0, actual: 0, uniqs: new Set<string>() };
      bucket.forecast += Number(row.quantity || 0);
      bucket.actual += Number(row.deliveryQuantity || 0);
      if (row.uniq && row.uniq !== "-") bucket.uniqs.add(row.uniq);
      map.set(name, bucket);
    }

    return Array.from(map.entries())
      .map(([customer, value]) => ({ customer, ...value }))
      .sort((a, b) => b.forecast - a.forecast);
  }, [resolvedForecastRows]);

  // KPI kartu Overview.
  const analyticsKpi = useMemo(() => {
    const totalForecasts = prlListQuery.data?.pagination?.total ?? resolvedForecastRows.length;
    const totalForecastQty = resolvedForecastRows.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const totalActualQty = resolvedForecastRows.reduce(
      (s, r) => s + Number(r.deliveryQuantity || 0),
      0
    );
    const accuracyPct = totalForecastQty > 0 ? (totalActualQty / totalForecastQty) * 100 : 0;

    const activeCustomers = new Set(
      resolvedForecastRows.filter((r) => r.customer && r.customer !== "-").map((r) => r.customer)
    ).size;

    const last = quarterBuckets[quarterBuckets.length - 1];
    const prev = quarterBuckets[quarterBuckets.length - 2];

    const entriesDelta =
      last && prev && prev.entries > 0
        ? ((last.entries - prev.entries) / prev.entries) * 100
        : null;

    const lastAccuracy = last && last.forecast > 0 ? (last.actual / last.forecast) * 100 : null;
    const prevAccuracy = prev && prev.forecast > 0 ? (prev.actual / prev.forecast) * 100 : null;
    const accuracyDelta =
      lastAccuracy !== null && prevAccuracy !== null ? lastAccuracy - prevAccuracy : null;

    const customerDelta = last && prev ? last.customers.size - prev.customers.size : null;

    return {
      totalForecasts,
      totalForecastQty,
      accuracyPct,
      activeCustomers,
      entriesDelta,
      accuracyDelta,
      customerDelta,
    };
  }, [prlListQuery.data, resolvedForecastRows, quarterBuckets]);

  const trendSeries = useMemo(
    () =>
      quarterBuckets.slice(-5).map((b) => ({
        period: b.period,
        forecast: b.forecast,
        actual: b.actual,
      })),
    [quarterBuckets]
  );

  const accuracyTrendSeries = useMemo(
    () =>
      quarterBuckets.slice(-5).map((b) => ({
        period: b.period,
        planned: b.forecast,
        actual: b.actual,
      })),
    [quarterBuckets]
  );

  const customerDistribution = useMemo(() => {
    const palette = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"];
    const top = customerAggregates.slice(0, 5);
    const total = top.reduce((s, c) => s + c.forecast, 0);
    if (total <= 0) return [] as Array<{ name: string; value: number; color: string }>;

    return top.map((c, index) => ({
      name: c.customer,
      value: Math.round((c.forecast / total) * 100),
      color: palette[index % palette.length],
    }));
  }, [customerAggregates]);

  // Data PRL tidak punya kolom "kategori part", jadi pengelompokan
  // memakai product_model sebagai kategori terdekat yang tersedia.
  const partCategories = useMemo(() => {
    const map = new Map<string, { parts: Set<string>; units: number }>();

    for (const row of resolvedForecastRows) {
      const name =
        row.productModel && row.productModel !== "-" ? row.productModel : "Uncategorized";
      const bucket = map.get(name) ?? { parts: new Set<string>(), units: 0 };
      if (row.uniq && row.uniq !== "-") bucket.parts.add(row.uniq);
      bucket.units += Number(row.quantity || 0);
      map.set(name, bucket);
    }

    const list = Array.from(map.entries())
      .map(([name, value]) => ({ name, parts: value.parts.size, units: value.units }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    const total = list.reduce((s, c) => s + c.units, 0);
    return list.map((c) => ({
      ...c,
      percent: total > 0 ? Math.round((c.units / total) * 100) : 0,
    }));
  }, [resolvedForecastRows]);

  const customerPerformanceRows = useMemo<CustomerPerformanceRow[]>(
    () =>
      customerAggregates.map((c) => {
        const accuracyPct = c.forecast > 0 ? (c.actual / c.forecast) * 100 : 0;
        return {
          key: c.customer,
          customer: c.customer,
          forecastVolume: c.forecast,
          actualVolume: c.actual,
          accuracyPct: Number(accuracyPct.toFixed(1)),
          // Data PRL tidak menyimpan harga satuan, sehingga dampak
          // rupiah/dolar TIDAK bisa dihitung. Ditampilkan "-" daripada
          // menampilkan angka karangan.
          revenueImpact: "-",
          reliability: reliabilityFromAccuracy(accuracyPct),
        };
      }),
    [customerAggregates]
  );

  const quarterlyPerformanceRows = useMemo<QuarterlyPerformanceRow[]>(
    () =>
      quarterBuckets.slice(-8).map((b) => ({
        key: b.period,
        quarter: quarterLabel(b.period),
        plannedQty: b.forecast,
        actualQty: b.actual,
        // Tidak ada sumber harga pada data PRL.
        plannedRevenue: "-",
        actualRevenue: "-",
        accuracyPct: b.forecast > 0 ? Number(((b.actual / b.forecast) * 100).toFixed(1)) : 0,
      })),
    [quarterBuckets]
  );

  // Pola musiman dihitung dari rata-rata forecast tiap nomor kuartal
  // dibanding rata-rata keseluruhan.
  const seasonalPatterns = useMemo(() => {
    const byQuarterNo = new Map<number, number[]>();
    for (const b of quarterBuckets) {
      const quarterNo = Number(b.period.split("-Q")[1]);
      if (!Number.isFinite(quarterNo) || quarterNo < 1 || quarterNo > 4) continue;
      const list = byQuarterNo.get(quarterNo) ?? [];
      list.push(b.forecast);
      byQuarterNo.set(quarterNo, list);
    }

    const averages = new Map<number, number>();
    for (const [quarterNo, list] of byQuarterNo) {
      averages.set(quarterNo, list.reduce((s, v) => s + v, 0) / list.length);
    }

    const overall =
      averages.size > 0
        ? Array.from(averages.values()).reduce((s, v) => s + v, 0) / averages.size
        : 0;

    return [1, 2, 3, 4].map((quarterNo) => {
      const average = averages.get(quarterNo);
      if (average === undefined || overall <= 0) {
        return {
          key: `Q${quarterNo}`,
          title: `Q${quarterNo} - No Data`,
          tagText: "No data",
          highlight: false,
        };
      }

      const delta = ((average - overall) / overall) * 100;
      const seasonLabel =
        delta >= 20
          ? "High Season"
          : delta >= 5
            ? "Above Average"
            : delta > -5
              ? "Normal Season"
              : "Below Average";

      return {
        key: `Q${quarterNo}`,
        title: `Q${quarterNo} - ${seasonLabel}`,
        tagText: `${signedPercent(delta, 0)} vs average`,
        highlight: delta >= 5,
      };
    });
  }, [quarterBuckets]);

  const growthIndicators = useMemo(() => {
    const last = quarterBuckets[quarterBuckets.length - 1];
    const prev = quarterBuckets[quarterBuckets.length - 2];

    const qoq =
      last && prev && prev.forecast > 0
        ? ((last.forecast - prev.forecast) / prev.forecast) * 100
        : null;

    // YoY membandingkan kuartal yang sama pada tahun sebelumnya.
    let yoy: number | null = null;
    if (last) {
      const [yearStr, quarterStr] = last.period.split("-Q");
      const target = `${Number(yearStr) - 1}-Q${quarterStr}`;
      const sameQuarterLastYear = quarterBuckets.find((b) => b.period === target);
      if (sameQuarterLastYear && sameQuarterLastYear.forecast > 0) {
        yoy =
          ((last.forecast - sameQuarterLastYear.forecast) / sameQuarterLastYear.forecast) * 100;
      }
    }

    let retention: number | null = null;
    let newCustomers: number | null = null;
    if (last && prev) {
      const retained = Array.from(last.customers).filter((c) => prev.customers.has(c)).length;
      retention = prev.customers.size > 0 ? (retained / prev.customers.size) * 100 : null;
      newCustomers = Array.from(last.customers).filter((c) => !prev.customers.has(c)).length;
    }

    return { qoq, yoy, retention, newCustomers };
  }, [quarterBuckets]);

  // Risiko diturunkan dari sinyal nyata: hasil gap analysis, sebaran
  // forecast antar kuartal, dan kelengkapan master data part.
  const riskAssessmentRows = useMemo<RiskAssessmentRow[]>(() => {
    const rows: RiskAssessmentRow[] = [];
    const gapList = gapQuery.data ?? [];
    const totalGap = gapList.length;

    const countByStatus = (target: string) =>
      gapList.filter((g) => String(g.status ?? "").trim().toLowerCase() === target).length;

    const underPct = totalGap > 0 ? (countByStatus("under") / totalGap) * 100 : 0;
    const overPct = totalGap > 0 ? (countByStatus("over") / totalGap) * 100 : 0;

    rows.push({
      key: "under-delivery",
      riskFactor: `Under-Delivery vs Forecast (${countByStatus("under")}/${totalGap} items)`,
      probability: riskLevelFromPct(underPct),
      impact: "High",
      mitigationStrategy: "Review production capacity & supplier lead time",
      status: underPct >= 30 ? "Action Needed" : "Monitoring",
    });

    rows.push({
      key: "over-delivery",
      riskFactor: `Over-Delivery vs Forecast (${countByStatus("over")}/${totalGap} items)`,
      probability: riskLevelFromPct(overPct),
      impact: "Medium",
      mitigationStrategy: "Re-align forecast accuracy with customer",
      status: overPct >= 30 ? "Action Needed" : "Monitoring",
    });

    // Volatilitas permintaan = koefisien variasi forecast antar kuartal.
    let volatilityPct = 0;
    if (quarterBuckets.length >= 2) {
      const values = quarterBuckets.map((b) => b.forecast);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      if (mean > 0) {
        const variance =
          values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
        volatilityPct = (Math.sqrt(variance) / mean) * 100;
      }
    }

    rows.push({
      key: "demand-volatility",
      riskFactor: `Demand Volatility (CV ${volatilityPct.toFixed(1)}%)`,
      probability: riskLevelFromPct(volatilityPct),
      impact: "Medium",
      mitigationStrategy: "Flexible production capacity & buffer planning",
      status: volatilityPct >= 30 ? "Action Needed" : "Monitoring",
    });

    // Kelengkapan master data part.
    const incomplete = resolvedForecastRows.filter(
      (r) => r.partName === "-" || r.partNumber === "-" || r.productModel === "-"
    ).length;
    const incompletePct =
      resolvedForecastRows.length > 0 ? (incomplete / resolvedForecastRows.length) * 100 : 0;

    rows.push({
      key: "incomplete-master-data",
      riskFactor: `Incomplete Part Master Data (${incomplete}/${resolvedForecastRows.length} rows)`,
      probability: riskLevelFromPct(incompletePct),
      impact: "High",
      mitigationStrategy: "Complete BOM / item master mapping",
      status: incompletePct >= 30 ? "Action Needed" : "Monitoring",
    });

    return rows;
  }, [gapQuery.data, quarterBuckets, resolvedForecastRows]);

  const openAnalytics = (tab?: AnalyticsTabId) => {
    if (tab) setAnalyticsTab(tab);
    setAnalyticsOpen(true);
  };

  const filteredDemandGapRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resolvedDemandGapRows.filter((r) => {
      const matchesQuery = !q || r.uniq.toLowerCase().includes(q);
      // keep placeholders consistent with top filters
      const matchesType = typeFilter === "all" ? true : true;
      const matchesPeriod = periodFilter === "current" ? true : true;
      const matchesCustomer = customerFilter === "all" ? true : true;
      return matchesQuery && matchesType && matchesPeriod && matchesCustomer;
    });
  }, [resolvedDemandGapRows, search, typeFilter, periodFilter, customerFilter]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const customerQ = customerFilter.trim().toLowerCase();

    return filteredForecastRows.filter((r) => {
      const matchesQuery =
        !q ||
        r.uniq.toLowerCase().includes(q) ||
        r.partName.toLowerCase().includes(q) ||
        r.partNumber.toLowerCase().includes(q) ||
        r.productModel.toLowerCase().includes(q);

      const matchesCustomer = !customerQ || r.customer.toLowerCase().includes(customerQ);
      const matchesPeriod = periodFilter === "current" ? true : r.period === periodFilter;
      const matchesType = typeFilter === "all" ? true : true; // placeholder for future type mapping

      return matchesQuery && matchesCustomer && matchesPeriod && matchesType;
    });
  }, [filteredForecastRows, search, customerFilter, periodFilter, typeFilter]);

  // Group rows by PRL ID so table shows one row per PRL with uniq list
  const groupedRows = useMemo(() => {
    const map = new Map<string, {
      key: string;
      prlId: string;
      customer: string;
      uniqs: string[];
      productModel: string;
      partName: string;
      partNumber: string;
      quantity: number;
      period: string;
      status: PrlStatus;
    }>();

    for (const r of rows) {
      const id = String(r.prlId ?? r.key ?? "");
      const entry = map.get(id) ?? {
        key: id,
        prlId: id,
        customer: r.customer,
        uniqs: [],
        productModel: r.productModel,
        partName: r.partName,
        partNumber: r.partNumber,
        quantity: 0,
        period: r.period,
        status: r.status,
      };
      if (r.uniq && !entry.uniqs.includes(r.uniq)) entry.uniqs.push(r.uniq);
      entry.quantity += Number(r.quantity || 0);
      map.set(id, entry);
    }

    return Array.from(map.values()).map((e) => ({
      key: e.key,
      prlId: e.prlId,
      customer: e.customer,
      uniq: e.uniqs.join(", ") as any,
      productModel: e.productModel,
      partName: e.partName,
      partNumber: e.partNumber,
      quantity: e.quantity,
      period: e.period,
      status: e.status,
    }));
  }, [rows]);

  const forecastPaginationTotal = useMemo(() => {
    if (!apiEnabled) return rows.length;

    const hasClientFilters = Boolean(search.trim() || customerFilter.trim() || periodFilter !== "current" || typeFilter !== "all");
    if (hasClientFilters) return rows.length;

    return prlListQuery.data?.pagination.total ?? rows.length;
  }, [apiEnabled, customerFilter, periodFilter, prlListQuery.data?.pagination.total, rows.length, search, typeFilter]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, customerFilter, periodFilter, typeFilter]);

  const periodOptions = useMemo(
    () => {
      const activePlanningPeriods = globalParameters
        .filter((item) => String(item.status ?? "active").trim().toLowerCase() === "active")
        .filter((item) => {
          const group = String(item.parameter_group ?? "").trim().toLowerCase();
          return group === "planning";
        })
        .map((item) => String(item.period ?? "").trim())
        .filter(Boolean);

      const fallbackPeriodsFromRows = resolvedForecastRows
        .map((item) => String(item.period ?? "").trim())
        .filter(Boolean);

      const periods = (activePlanningPeriods.length ? activePlanningPeriods : globalParameters
        .filter((item) => String(item.status ?? "active").trim().toLowerCase() === "active")
        .map((item) => String(item.period ?? "").trim())
        .filter(Boolean).length
          ? globalParameters
              .filter((item) => String(item.status ?? "active").trim().toLowerCase() === "active")
              .map((item) => String(item.period ?? "").trim())
              .filter(Boolean)
          : fallbackPeriodsFromRows)
        .filter((value, index, array) => array.indexOf(value) === index);

      return [{ label: "Current Period", value: "current" }].concat(
        periods.map((value) => ({ label: value, value }))
      );
    },
    [globalParameters, resolvedForecastRows]
  );

  const typeOptions = useMemo(
    () => [
      { label: "All Types", value: "all" },
      { label: "Forecast", value: "forecast" },
      { label: "Master Data", value: "master" },
    ],
    []
  );

  const editablePeriodOptions = useMemo(() => {
    const options = periodOptions.filter((option) => option.value !== "current");
    if (editingPrl?.period && !options.some((option) => option.value === editingPrl.period)) {
      return [{ label: editingPrl.period, value: editingPrl.period }, ...options];
    }
    return options;
  }, [editingPrl?.period, periodOptions]);

  const columns: ColumnsType<ForecastRow> = [
    {
      title: "PRL ID",
      dataIndex: "prlId",
      key: "prlId",
      width: 110,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Customer",
      dataIndex: "customer",
      key: "customer",
      width: 180,
      render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
    },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      width: 120,
      render: (v: string | string[], record) => {
        const vals = Array.isArray(v) ? v : String(v ?? "").split(/,\s*/).filter(Boolean);
        if (vals.length === 0) return <span className="text-sm text-gray-500">-</span>;
        if (vals.length === 1) {
          return (
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
              {vals[0]}
            </span>
          );
        }

        const maxShow = 3;
        const visible = vals.slice(0, maxShow);
        const extra = vals.slice(maxShow);
        const extraCount = extra.length;

        return (
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {visible.map((u, i) => (
                <span key={u + i} className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                  {u}
                </span>
              ))}
            </div>
            {extraCount > 0 && (
              <Tooltip
                placement="top"
                title={
                  <div className="flex flex-row flex-wrap gap-2 max-w-xs" style={{ maxWidth: 320 }}>
                    {vals.slice(0, 10).map((u) => (
                      <Tag
                        key={u}
                        className="cursor-pointer inline-flex"
                        onClick={() => {
                          const match = resolvedForecastRows.find((rr) => String(rr.prlId) === String(record.prlId) && rr.uniq === u);
                          if (match) setForecastDetail({ open: true, record: match });
                        }}
                      >
                        {u}
                      </Tag>
                    ))}
                    {vals.length > 10 && (
                      <div className="text-xs text-gray-500 mt-1">and {vals.length - 10} more</div>
                    )}
                  </div>
                }
                overlayClassName="max-w-xs"
              >
                <Tag className="cursor-pointer">+{extraCount}</Tag>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: "Product Model",
      dataIndex: "productModel",
      key: "productModel",
      width: 150,
      render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      width: 200,
      render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
    },
    {
      title: "Part Number",
      dataIndex: "partNumber",
      key: "partNumber",
      width: 140,
      render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      width: 110,
      align: "right",
      render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
    },
    {
      title: "Period",
      dataIndex: "period",
      key: "period",
      width: 110,
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
          {v}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (v: PrlStatus) => (
        <Tag color={getPrlStatusColor(v)} className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
          {v}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_: unknown, record: ForecastRow) => (
        <div className="flex items-center gap-2">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() =>
              setForecastDetail({
                open: true,
                record,
              })
            }
          />
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            disabled={String(record.status || "").trim().toLowerCase() === "approved"}
            onClick={() => {
              if (String(record.status || "").trim().toLowerCase() === "approved") {
                message.info("Cannot edit an approved PRL entry");
                return;
              }
              openEditModal(record);
            }}
          />
          <Button
            size="small"
            type="text"
            danger
            disabled={!canDeletePrlStatus(record.status)}
            icon={<DeleteOutlined />}
            onClick={() => {
              let confirmModal: any = null;
              confirmModal = Modal.confirm({
                title: "Delete PRL entry?",
                content: `This will delete ${record.prlId}.`,
                okText: "Delete",
                okButtonProps: { danger: true },
                cancelText: "Cancel",
                onCancel: () => {
                  confirmModal?.destroy();
                },
                onOk: async () => {
                  if (!apiEnabled) {
                    message.info("Delete is only available in API mode");
                    confirmModal?.destroy();
                    return;
                  }

                  try {
                    await deletePrl(record.key).unwrap();
                    message.success("PRL entry deleted");
                    prlListQuery.refetch();
                    refetchDemandGapIfActive();
                  } catch (error) {
                    message.error(getApiErrorMessage(error, "Failed to delete PRL entry"));
                  } finally {
                    confirmModal?.destroy();
                  }
                },
              });
            }}
          />
          {/* <Button
            size="small"
            type="text"
            icon={<BarChartOutlined />}
            onClick={() => openAnalytics("overview")}
          /> */}
        </div>
      ),
    },
  ];

  const detailUniqColumns: ColumnsType<ForecastRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "Product Model",
      dataIndex: "productModel",
      key: "productModel",
      render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
    },
    {
      title: "Part Number",
      dataIndex: "partNumber",
      key: "partNumber",
      render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
      render: (v: number) => (
        <span className="text-sm font-semibold text-gray-900">{formatNumber(v)}</span>
      ),
    },
  ];

  const demandGapColumns: ColumnsType<DemandGapRow> = [
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      width: 120,
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "Customer Forecast",
      dataIndex: "customerForecast",
      key: "customerForecast",
      width: 170,
      align: "right",
      render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
    },
    {
      title: "Actual Delivery",
      dataIndex: "actualDelivery",
      key: "actualDelivery",
      width: 160,
      align: "right",
      render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
    },
    {
      title: "Gap (Units)",
      dataIndex: "gapUnits",
      key: "gapUnits",
      width: 120,
      align: "right",
      render: (v: number) => (
        <span className={v < 0 ? "text-red-600 font-semibold" : "text-green-700 font-semibold"}>
          {v > 0 ? `+${formatNumber(v)}` : formatNumber(v)}
        </span>
      ),
    },
    {
      title: "Gap (%)",
      dataIndex: "gapPercent",
      key: "gapPercent",
      width: 100,
      align: "right",
      render: (v: number) => (
        <span className={v < 0 ? "text-red-600 font-semibold" : "text-green-700 font-semibold"}>
          {v > 0 ? `+${v}%` : `${v}%`}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (v: DemandGapStatus) => {
        if (v === "Under") {
          return (
            <Tag color="red" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
              Under
            </Tag>
          );
        }
        if (v === "Over") {
          return (
            <Tag color="default" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
              Over
            </Tag>
          );
        }
        return (
          <Tag color="blue" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
            On Track
          </Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      render: (_: unknown, record: DemandGapRow) => (
        <Button
          size="small"
          className="!rounded-lg"
          icon={<BarChartOutlined />}
          onClick={() => message.info(`Analyze ${record.uniq}`)}
        >
          Analyze
        </Button>
      ),
    },
  ];

  const tabs: Array<{ id: PrlTabId; label: string }> = [
    { id: "forecast-table", label: "Forecast Table" },
    { id: "demand-gap", label: "Demand Gap Analysis" },
    { id: "bulk-ops", label: "Bulk Operations" },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">PRL Management & Master Data</h1>
            <p className="text-sm text-gray-500">Store forecasts by Uniq, Quantity, Model for Production Planning and Demand Analysis</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="!rounded-lg"
              icon={<HistoryOutlined />}
              onClick={() => router.push("/prl-pattern-history")}
            >
              View History Logs
            </Button>
            <Button className="!rounded-lg" icon={<UploadOutlined />} onClick={() => setExcelModalOpen(true)}>
              Excel Upload
            </Button>
            <Button className="!rounded-lg" icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
              Download Template
            </Button>
            <Button className="!rounded-lg" icon={<FileExcelOutlined />} onClick={handleExport}> 
              Export Data
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<PlusOutlined />}
              onClick={() => router.push("/prl-management/create")}
            >
              Add Forecast
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* Tabs */}
        <div className="mb-4">
          <div className="inline-flex rounded-lg bg-gray-50 p-1 border border-gray-100">
            {tabs.map((t) => {
              const isActive = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={
                    "px-4 py-2 text-sm font-medium rounded-md transition-colors " +
                    (isActive ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900")
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div className="flex-1 max-w-xl">
            <Input
              prefix={<span className="text-gray-400">⌕</span>}
              placeholder="Search by Uniq or Machine Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={periodFilter} onChange={setPeriodFilter} options={periodOptions} className="min-w-[160px]" />
            <Input
              allowClear
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="Customer Name"
              className="!rounded-lg min-w-[170px]"
            />
            <Select value={typeFilter} onChange={setTypeFilter} options={typeOptions} className="min-w-[130px]" />
          </div>
        </div>

        {/* Content */}
        {activeTab === "forecast-table" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-base font-semibold text-gray-900">Production Forecast by Uniq</div>
                <div className="min-w-[160px]">
                  <div className="text-xs text-gray-500 mb-1">PRL ID</div>
                  <Select
                    allowClear
                    showSearch
                    options={prlIdOptions}
                    value={prlIdFilter}
                    onChange={(v) => { setPrlIdFilter(v); setUniqFilter(undefined); }}
                    placeholder="Filter by PRL ID"
                    className="min-w-[160px]"
                  />
                </div>
                <div className="min-w-[200px]">
                  <div className="text-xs text-gray-500 mb-1">Uniq</div>
                  <Select
                    allowClear
                    showSearch
                    options={uniqOptionsForSelectedPrl}
                    value={uniqFilter}
                    onChange={(v) => setUniqFilter(v)}
                    placeholder="Filter by Uniq"
                    className="min-w-[200px]"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge count={`${forecastPaginationTotal} forecasts`} style={{ backgroundColor: "#EEF2FF", color: "#3730A3" }} />
                <Button className="!rounded-lg" icon={<BarChartOutlined />} onClick={() => openAnalytics("overview")}> 
                  Analytics View
                </Button>
              </div>
            </div>

            <Table<ForecastRow>
              columns={columns}
              dataSource={groupedRows}
              rowKey="key"
              size="middle"
              scroll={{ x: "max-content" }}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
              }}
              pagination={{
                current: currentPage,
                total: forecastPaginationTotal,
                pageSize,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50"],
                onChange: (page, nextPageSize) => {
                  setCurrentPage(page);
                  if (nextPageSize && nextPageSize !== pageSize) {
                    setPageSize(nextPageSize);
                    setCurrentPage(1);
                  }
                },
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} Results`,
              }}
            />
          </>
        )}

        {activeTab === "demand-gap" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-base font-semibold text-gray-900">Demand Forecasting Gap Analysis</div>
              </div>

              <div className="flex items-center gap-2">
                <Tag className="!rounded-full !px-3 !py-0.5" color="default">
                  Customer Planning vs Real Delivery
                </Tag>
              </div>
            </div>

            <Table<DemandGapRow>
              columns={demandGapColumns}
              dataSource={filteredDemandGapRows}
              rowKey="key"
              size="middle"
              scroll={{ x: "max-content" }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50"],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} Results`,
              }}
            />
          </>
        )}

        {activeTab === "bulk-ops" && (
          <div>
            <div className="mb-4">
              <div className="text-base font-semibold text-gray-900">Bulk Operations & Data Management</div>
            </div>

            {/* Excel Upload */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <div className="text-sm font-semibold text-gray-900">PRL Import</div>
              <div className="text-xs text-gray-500 mt-1">
                Upload PRL data directly from Excel using `POST /import/prls`.
              </div>

              <div className="mt-3">
                <Upload.Dragger
                  name="file"
                  multiple={false}
                  showUploadList={false}
                  beforeUpload={(file) => {
                    const isExcel = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
                    if (!isExcel) {
                      message.error("Please upload an Excel file (.xlsx/.xls)");
                      return Upload.LIST_IGNORE;
                    }
                    if (!apiEnabled) {
                      message.success(`Imported ${file.name}`);
                      return false;
                    }

                    importPrls(file as File)
                      .unwrap()
                      .then(() => {
                        message.success(`Imported ${file.name}`);
                        prlListQuery.refetch();
                        refetchDemandGapIfActive();
                      })
                      .catch((err) => {
                        message.error(getApiErrorMessage(err, "PRL import failed"));
                      });
                    return false;
                  }}
                >
                  <div className="py-6">
                    <div className="text-3xl text-gray-400 mb-2">⬆</div>
                    <div className="text-sm font-semibold text-gray-900">Upload PRL Excel File</div>
                    <div className="text-xs text-gray-500 mt-1">Drag and drop your Excel file here, or click to browse</div>
                    <Button className="!rounded-lg mt-3" type="primary">
                      Choose File
                    </Button>
                  </div>
                </Upload.Dragger>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <div className="text-sm font-semibold text-gray-900">PRL Export</div>
              <div className="text-xs text-gray-500 mt-1">
                Download current PRL data using `GET /prls/export`.
              </div>

              <div className="mt-4">
                <Button className="!rounded-lg" icon={<FileExcelOutlined />} onClick={handleExport}>
                  Export PRL Data
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="text-sm font-semibold text-gray-900">Notes</div>
              <div className="text-xs text-gray-500 mt-1">
                Create uses `POST /prls`, detail uses `GET /prls/:id`, update uses `PUT /prls/:id`, and delete uses `DELETE /prls/:id` from the table actions.
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={forecastDetail.open}
        onCancel={() => setForecastDetail({ open: false, record: null })}
        footer={null}
        width={720}
        title={
          <div>
            <div className="text-sm font-semibold text-gray-900">PRL Detail</div>
            <div className="text-xs text-gray-500 font-normal">
              View detail for the selected PRL entry.
            </div>
          </div>
        }
      >
        {forecastDetail.record ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">PRL ID</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{forecastDetail.record.prlId}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">Customer</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{prlDetailQuery.data?.customer?.customer_name ?? prlDetailQuery.data?.customer_name ?? forecastDetail.record.customer}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">UNIQ</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{detailUniqRows.length > 1 ? forecastDetail.record.uniq : (prlDetailQuery.data?.uniq_code ?? forecastDetail.record.uniq)}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">Forecast Period</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{prlDetailQuery.data?.forecast_period ?? forecastDetail.record.period}</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs text-gray-500">Product Model</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{prlDetailQuery.data?.product_model ?? prlDetailQuery.data?.product_details?.model ?? prlDetailQuery.data?.product_details?.description ?? forecastDetail.record.productModel}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Part Name</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{prlDetailQuery.data?.part_name ?? prlDetailQuery.data?.product_details?.part_name ?? forecastDetail.record.partName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Part Number</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{prlDetailQuery.data?.part_number ?? prlDetailQuery.data?.product_details?.part_number ?? forecastDetail.record.partNumber}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">{detailUniqRows.length > 1 ? "Quantity (Total)" : "Quantity"}</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{formatNumber(detailUniqRows.length > 1 ? Number(forecastDetail.record.quantity ?? 0) : Number(prlDetailQuery.data?.quantity ?? forecastDetail.record.quantity ?? 0))}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{forecastDetail.record.status}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Created At</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{prlDetailQuery.data?.created_at ?? forecastDetail.record.createdAt ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Updated At</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{prlDetailQuery.data?.updated_at ?? forecastDetail.record.updatedAt ?? "-"}</div>
                </div>
              </div>
            </div>

            {detailUniqRows.length > 1 ? (
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900 mb-1">Detail per UNIQ</div>
                <div className="text-xs text-gray-500 mb-3">
                  This PRL groups {detailUniqRows.length} UNIQ codes under one PRL ID. Each UNIQ keeps its own quantity.
                </div>
                <Table<ForecastRow>
                  columns={detailUniqColumns}
                  dataSource={detailUniqRows}
                  rowKey="key"
                  size="small"
                  pagination={false}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={editPrlOpen}
        onCancel={() => {
          setEditPrlOpen(false);
          setEditingPrl(null);
          editForm.resetFields();
        }}
        title="Edit PRL"
        okText="Save"
        okButtonProps={{ className: "!rounded-lg", loading: updatePrlState.isLoading }}
        cancelButtonProps={{ className: "!rounded-lg" }}
        onOk={async () => {
          if (!editingPrl) return;

          try {
            const values = await editForm.validateFields();
            if (!apiEnabled) {
              message.info("Edit is only available in API mode");
              return;
            }

            await updatePrl({
              id: editingPrl.key,
              body: {
                forecast_period: String(values.forecastPeriod),
                quantity: Number(values.quantity),
              },
            }).unwrap();

            message.success("PRL updated");
            setEditPrlOpen(false);
            setEditingPrl(null);
            editForm.resetFields();
            prlListQuery.refetch();
            refetchDemandGapIfActive();
          } catch (error) {
            message.error(getApiErrorMessage(error, "Failed to update PRL"));
          }
        }}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="Forecast Period" name="forecastPeriod" rules={[{ required: true }]}> 
            <Select
              className="!rounded-lg"
              options={editablePeriodOptions}
              placeholder="Select forecast period"
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item label="Quantity" name="quantity" rules={[{ required: true }]}> 
            <InputNumber className="!rounded-lg w-full" min={1} placeholder="e.g. 4200" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Excel Upload"
        open={excelModalOpen}
        onCancel={() => setExcelModalOpen(false)}
        onOk={() => setExcelModalOpen(false)}
        okText="Done"
      >
        <Upload
          beforeUpload={(file) => {
            const isExcel = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
            if (!isExcel) {
              message.error("Please upload an Excel file (.xlsx/.xls)");
              return Upload.LIST_IGNORE;
            }
            if (!apiEnabled) {
              message.success(`Imported ${file.name}`);
              return false;
            }

            importPrls(file as File)
              .unwrap()
              .then(() => {
                message.success(`Imported ${file.name}`);
                prlListQuery.refetch();
                refetchDemandGapIfActive();
              })
              .catch((err) => {
                message.error(getApiErrorMessage(err, "PRL import failed"));
              });
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>Select Excel File</Button>
        </Upload>
        <div className="text-xs text-gray-500 mt-3">
          {apiEnabled ? "Uses POST /import/prls." : "API disabled: UI-only mock."}
        </div>
      </Modal>

      <Modal
        open={analyticsOpen}
        onCancel={() => setAnalyticsOpen(false)}
        footer={null}
        width={980}
        title={
          <div>
            <div className="text-sm font-semibold text-gray-900">PRL Analytics & Intelligence Dashboard</div>
            <div className="text-xs text-gray-500 font-normal">
              Comprehensive analytics and insights for Production Resource Lifecycle Management
            </div>
          </div>
        }
      >
        <div className="mb-4">
          <div className="grid grid-cols-5 gap-2 bg-gray-50 border border-gray-100 rounded-lg p-1">
            {analyticsTabs.map((t) => {
              const isActive = t.id === analyticsTab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setAnalyticsTab(t.id)}
                  className={
                    "rounded-md px-3 py-2 text-xs font-semibold transition-colors " +
                    (isActive ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900")
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {analyticsTab === "overview" && (
          <div className="space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">Total Forecasts</div>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {formatNumber(analyticsKpi.totalForecasts)}
                </div>
                <div
                  className={
                    "text-xs mt-1 " +
                    (analyticsKpi.entriesDelta === null
                      ? "text-gray-500"
                      : analyticsKpi.entriesDelta >= 0
                        ? "text-green-700"
                        : "text-red-600")
                  }
                >
                  {analyticsKpi.entriesDelta === null
                    ? "No previous quarter to compare"
                    : `${signedPercent(analyticsKpi.entriesDelta, 0)} vs last quarter`}
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">Forecast Accuracy</div>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {formatPercent(analyticsKpi.accuracyPct)}
                </div>
                <div
                  className={
                    "text-xs mt-1 " +
                    (analyticsKpi.accuracyDelta === null
                      ? "text-gray-500"
                      : analyticsKpi.accuracyDelta >= 0
                        ? "text-green-700"
                        : "text-red-600")
                  }
                >
                  {analyticsKpi.accuracyDelta === null
                    ? "Delivery vs forecast quantity"
                    : `${signedPercent(analyticsKpi.accuracyDelta)} vs last quarter`}
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">Active Customers</div>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {formatNumber(analyticsKpi.activeCustomers)}
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  {analyticsKpi.customerDelta === null || analyticsKpi.customerDelta === 0
                    ? "Stable base"
                    : analyticsKpi.customerDelta > 0
                      ? `+${analyticsKpi.customerDelta} vs last quarter`
                      : `${analyticsKpi.customerDelta} vs last quarter`}
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">Planned Revenue</div>
                {/* Data PRL tidak menyimpan harga satuan, jadi nilai uang
                    tidak bisa dihitung. Ditampilkan total qty forecast
                    sebagai gantinya, bukan angka rupiah karangan. */}
                <div className="text-xl font-bold text-gray-900 mt-1">-</div>
                <div className="text-xs text-gray-500 mt-1">
                  No price source ({formatNumber(analyticsKpi.totalForecastQty)} units planned)
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900">Forecast vs Actual Delivery Trend</div>
                <div className="text-xs text-gray-500 mt-1">Quarterly comparison showing forecast accuracy over time</div>
                <div className="h-56 mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22C55E" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="forecast" stroke="#3B82F6" fill="url(#forecastFill)" name="Forecast" />
                      <Area type="monotone" dataKey="actual" stroke="#22C55E" fill="url(#actualFill)" name="Actual" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900">Customer Distribution</div>
                <div className="text-xs text-gray-500 mt-1">Forecast volume by customer percentage</div>
                <div className="h-56 mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie data={customerDistribution} dataKey="value" nameKey="name" outerRadius={70} label>
                        {customerDistribution.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Part category analysis */}
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Part Category Analysis</div>
              <div className="text-xs text-gray-500 mt-1">Breakdown of forecasts by part categories</div>

              <div className="mt-4 space-y-4">
                {partCategories.map((c) => (
                  <div key={c.name} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">
                        {c.parts} parts <span className="mx-2">•</span> {formatNumber(c.units)} units
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-4">
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${c.percent}%` }} />
                      </div>
                      <div className="text-xs font-semibold text-gray-700 w-10 text-right">{c.percent}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {analyticsTab === "trends" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Forecast Accuracy Trends</div>
              <div className="text-xs text-gray-500 mt-1">Historical accuracy and variance analysis</div>

              <div className="h-64 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accuracyTrendSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="planned" name="Planned" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="actual" name="Actual" fill="#22C55E" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900">Seasonal Patterns</div>
                <div className="text-xs text-gray-500 mt-1">Typical demand changes by quarter</div>

                <div className="mt-4 space-y-2">
                  {seasonalPatterns.map((s) => (
                    <div
                      key={s.key}
                      className={
                        "flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 " +
                        (s.highlight ? "bg-blue-50/40" : "bg-gray-50")
                      }
                    >
                      <div className="text-xs font-semibold text-gray-800">{s.title}</div>
                      <Tag
                        color={s.highlight ? "blue" : "default"}
                        className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
                      >
                        {s.tagText}
                      </Tag>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900">Growth Indicators</div>
                <div className="text-xs text-gray-500 mt-1">Key business movement metrics</div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">YoY Growth Rate</div>
                    <div
                      className={
                        "text-xs font-semibold " +
                        (growthIndicators.yoy === null
                          ? "text-gray-400"
                          : growthIndicators.yoy >= 0
                            ? "text-green-700"
                            : "text-red-600")
                      }
                    >
                      {growthIndicators.yoy === null ? "-" : signedPercent(growthIndicators.yoy)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">QoQ Growth Rate</div>
                    <div
                      className={
                        "text-xs font-semibold " +
                        (growthIndicators.qoq === null
                          ? "text-gray-400"
                          : growthIndicators.qoq >= 0
                            ? "text-blue-700"
                            : "text-red-600")
                      }
                    >
                      {growthIndicators.qoq === null ? "-" : signedPercent(growthIndicators.qoq)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">Customer Retention</div>
                    <div className="text-xs font-semibold text-purple-700">
                      {growthIndicators.retention === null
                        ? "-"
                        : formatPercent(growthIndicators.retention)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">New Customer Acquisition</div>
                    <div className="text-xs font-semibold text-red-600">
                      {growthIndicators.newCustomers === null
                        ? "-"
                        : `${growthIndicators.newCustomers} last quarter`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {analyticsTab === "customers" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Customer Performance Matrix</div>
              <div className="text-xs text-gray-500 mt-1">Volume vs accuracy analysis by customer</div>

              <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
                <Table<CustomerPerformanceRow>
                  dataSource={customerPerformanceRows}
                  rowKey="key"
                  size="middle"
                  pagination={false}
                  columns={([
                    {
                      title: "Customer",
                      dataIndex: "customer",
                      key: "customer",
                      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
                    },
                    {
                      title: "Forecast Volume",
                      dataIndex: "forecastVolume",
                      key: "forecastVolume",
                      align: "right",
                      render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
                    },
                    {
                      title: "Actual Volume",
                      dataIndex: "actualVolume",
                      key: "actualVolume",
                      align: "right",
                      render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
                    },
                    {
                      title: "Accuracy %",
                      dataIndex: "accuracyPct",
                      key: "accuracyPct",
                      align: "center",
                      render: (v: number) => (
                        <Tag color="blue" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
                          {v}%
                        </Tag>
                      ),
                    },
                    {
                      title: "Revenue Impact",
                      dataIndex: "revenueImpact",
                      key: "revenueImpact",
                      render: (v: string) => <span className="text-sm font-semibold text-green-700">{v}</span>,
                    },
                    {
                      title: "Reliability Score",
                      dataIndex: "reliability",
                      key: "reliability",
                      align: "center",
                      render: (v: CustomerPerformanceRow["reliability"]) => (
                        <Tag color="blue" className="!rounded-md !px-2 !py-0.5 !text-xs !font-semibold">
                          {v}
                        </Tag>
                      ),
                    },
                  ]) as ColumnsType<CustomerPerformanceRow>}
                />
              </div>
            </div>
          </div>
        )}

        {analyticsTab === "performance" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Quarterly Performance Summary</div>
              <div className="text-xs text-gray-500 mt-1">Comprehensive performance metrics by quarter</div>

              <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
                <Table<QuarterlyPerformanceRow>
                  dataSource={quarterlyPerformanceRows}
                  rowKey="key"
                  size="middle"
                  pagination={false}
                  columns={([
                    {
                      title: "Quarter",
                      dataIndex: "quarter",
                      key: "quarter",
                      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
                    },
                    {
                      title: "Planned Quantity",
                      dataIndex: "plannedQty",
                      key: "plannedQty",
                      align: "right",
                      render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
                    },
                    {
                      title: "Actual Quantity",
                      dataIndex: "actualQty",
                      key: "actualQty",
                      align: "right",
                      render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
                    },
                    {
                      title: "Planned Revenue",
                      dataIndex: "plannedRevenue",
                      key: "plannedRevenue",
                      render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
                    },
                    {
                      title: "Actual Revenue",
                      dataIndex: "actualRevenue",
                      key: "actualRevenue",
                      render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
                    },
                    {
                      title: "Accuracy %",
                      dataIndex: "accuracyPct",
                      key: "accuracyPct",
                      align: "center",
                      render: (v: number) => {
                        const isGood = v >= 100;
                        return (
                          <Tag
                            color={isGood ? "blue" : "default"}
                            className={
                              isGood
                                ? "!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
                                : "!rounded-md !px-2 !py-0.5 !text-xs !font-semibold !text-gray-700"
                            }
                          >
                            {v}%
                          </Tag>
                        );
                      },
                    },
                  ]) as ColumnsType<QuarterlyPerformanceRow>}
                />
              </div>
            </div>
          </div>
        )}

        {analyticsTab === "risk" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Risk Assessment Matrix</div>
              <div className="text-xs text-gray-500 mt-1">Identified risks and mitigation strategies</div>

              <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
                <Table<RiskAssessmentRow>
                  dataSource={riskAssessmentRows}
                  rowKey="key"
                  size="middle"
                  pagination={false}
                  columns={([
                    {
                      title: "Risk Factor",
                      dataIndex: "riskFactor",
                      key: "riskFactor",
                      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
                    },
                    {
                      title: "Probability",
                      dataIndex: "probability",
                      key: "probability",
                      align: "center",
                      render: (v: RiskAssessmentRow["probability"]) => (
                        <Tag
                          color={v === "High" ? "red" : "default"}
                          className={
                            v === "High"
                              ? "!rounded-md !px-2 !py-0.5 !text-xs !font-semibold"
                              : "!rounded-md !px-2 !py-0.5 !text-xs !font-semibold !text-gray-700"
                          }
                        >
                          {v}
                        </Tag>
                      ),
                    },
                    {
                      title: "Impact",
                      dataIndex: "impact",
                      key: "impact",
                      align: "center",
                      render: (v: RiskAssessmentRow["impact"]) => (
                        <Tag
                          color={v === "High" ? "red" : "default"}
                          className={
                            v === "High"
                              ? "!rounded-md !px-2 !py-0.5 !text-xs !font-semibold"
                              : "!rounded-md !px-2 !py-0.5 !text-xs !font-semibold !text-gray-700"
                          }
                        >
                          {v}
                        </Tag>
                      ),
                    },
                    {
                      title: "Mitigation Strategy",
                      dataIndex: "mitigationStrategy",
                      key: "mitigationStrategy",
                      render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
                    },
                    {
                      title: "Status",
                      dataIndex: "status",
                      key: "status",
                      align: "center",
                      render: (v: RiskAssessmentRow["status"]) => (
                        <Tag className="!rounded-md !px-2 !py-0.5 !text-xs !font-semibold !text-gray-700">
                          {v}
                        </Tag>
                      ),
                    },
                  ]) as ColumnsType<RiskAssessmentRow>}
                />
              </div>
            </div>
          </div>
        )}

        {analyticsTab !== "overview" &&
          analyticsTab !== "trends" &&
          analyticsTab !== "customers" &&
          analyticsTab !== "performance" &&
          analyticsTab !== "risk" && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-sm text-gray-600">
            {analyticsTabs.find((t) => t.id === analyticsTab)?.label} (coming soon).
          </div>
        )}
      </Modal>
    </div>
  );
}
