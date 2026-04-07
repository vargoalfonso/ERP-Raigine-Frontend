"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  Upload,
  message,
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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChartOutlined,
  CalendarOutlined,
  DeleteOutlined,
  FilterOutlined,
  EyeOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useClearAllPrlForecastsMutation,
  useClearPrlForecastsByPeriodMutation,
  useClearPrlForecastsByUniqMutation,
  useGetPrlGapAnalysisQuery,
  useListPrlForecastsQuery,
  useUploadPrlExcelMutation,
} from "@/lib/api/prl/api";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";

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

type PrlStatus = "Active" | "Draft" | "Closed";

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
    status: "Draft",
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

export default function PrlManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PrlTabId>("forecast-table");
  const [search, setSearch] = useState<string>("");
  const [periodFilter, setPeriodFilter] = useState<string>("current");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [forecastDetail, setForecastDetail] = useState<ForecastDetailState>({
    open: false,
    record: null,
  });

  const apiEnabled = Boolean(apiBaseUrl);
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, { skip: !apiEnabled });

  const prlListQuery = useListPrlForecastsQuery(undefined, { skip: !apiEnabled });
  const gapQuery = useGetPrlGapAnalysisQuery(undefined, {
    skip: !apiEnabled || activeTab !== "demand-gap",
  });

  const [uploadExcel, uploadExcelState] = useUploadPrlExcelMutation();
  const [clearAll, clearAllState] = useClearAllPrlForecastsMutation();
  const [clearByUniq, clearByUniqState] = useClearPrlForecastsByUniqMutation();
  const [clearByPeriod, clearByPeriodState] = useClearPrlForecastsByPeriodMutation();

  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data]
  );

  const anyBulkLoading =
    uploadExcelState.isLoading ||
    clearAllState.isLoading ||
    clearByUniqState.isLoading ||
    clearByPeriodState.isLoading;

  const refetchDemandGapIfActive = () => {
    if (activeTab !== "demand-gap") return;
    gapQuery.refetch();
  };

  const resolvedForecastRows = useMemo<ForecastRow[]>(() => {
    if (!apiEnabled) return initialRows;
    const list = prlListQuery.data;
    if (!list) return initialRows;

    return list.map((r) => {
      const customerName = r.customer?.customer_name ?? (r.customer_id != null ? `Customer #${r.customer_id}` : "-");
      const uniq = r.item_uniq_code ?? "-";

      return {
        key: r.id,
        prlId: r.prl_id ?? r.id,
        customer: customerName,
        customerId: r.customer_id != null ? String(r.customer_id) : undefined,
        uniq,
        productModel: r.product_details?.description ?? bomIndex.assemblyCodeByUniq[uniq] ?? "-",
        partName: r.product_details?.part_name ?? bomIndex.partNameByUniq[uniq] ?? "-",
        partNumber: r.product_details?.part_number ?? bomIndex.partNumberByUniq[uniq] ?? "-",
        quantity: Number(r.quantity ?? 0),
        period: r.period ?? "-",
        status: (r.status ?? "Draft") as PrlStatus,
        createdBy: r.created_by,
        createdAt: r.createdAt ?? r.created_at,
        updatedAt: r.updatedAt ?? r.updated_at,
        deliveryQuantity: Number(r.delivery_quantity ?? 0),
      };
    });
  }, [apiEnabled, bomIndex.assemblyCodeByUniq, bomIndex.partNameByUniq, bomIndex.partNumberByUniq, prlListQuery.data]);

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
      key: g.uniq,
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

  const trendSeries = useMemo(
    () => [
      { period: "2023-Q4", forecast: 6500, actual: 6200 },
      { period: "2024-Q1", forecast: 7200, actual: 7000 },
      { period: "2024-Q2", forecast: 8200, actual: 8100 },
      { period: "2024-Q3", forecast: 7800, actual: 7900 },
      { period: "2024-Q4", forecast: 9800, actual: 5200 },
    ],
    []
  );

  const accuracyTrendSeries = useMemo(
    () => [
      { period: "2023-Q4", planned: 6800, actual: 6500 },
      { period: "2024-Q1", planned: 7500, actual: 7200 },
      { period: "2024-Q2", planned: 8300, actual: 8500 },
      { period: "2024-Q3", planned: 7800, actual: 8000 },
      { period: "2024-Q4", planned: 9200, actual: 9000 },
    ],
    []
  );

  const customerDistribution = useMemo(
    () => [
      { name: "Toyota Motor Corp", value: 35, color: "#3B82F6" },
      { name: "Honda Manufacturing", value: 28, color: "#22C55E" },
      { name: "Nissan Global", value: 20, color: "#F59E0B" },
      { name: "Ford Motor Company", value: 12, color: "#EF4444" },
      { name: "General Motors", value: 5, color: "#8B5CF6" },
    ],
    []
  );

  const partCategories = useMemo(
    () => [
      { name: "Engine Components", parts: 45, percent: 32, units: 12500 },
      { name: "Suspension Parts", parts: 38, percent: 27, units: 9800 },
      { name: "Brake Systems", parts: 26, percent: 20, units: 8200 },
      { name: "Electrical Components", parts: 20, percent: 14, units: 5500 },
      { name: "Body Parts", parts: 10, percent: 7, units: 2800 },
    ],
    []
  );

  const customerPerformanceRows = useMemo<CustomerPerformanceRow[]>(
    () => [
      {
        key: "Toyota Motor Corp",
        customer: "Toyota Motor Corp",
        forecastVolume: 2500,
        actualVolume: 2350,
        accuracyPct: 94,
        revenueImpact: "$2.1M",
        reliability: "A+",
      },
      {
        key: "Honda Manufacturing",
        customer: "Honda Manufacturing",
        forecastVolume: 1800,
        actualVolume: 1920,
        accuracyPct: 107,
        revenueImpact: "$1.8M",
        reliability: "A",
      },
      {
        key: "Nissan Global",
        customer: "Nissan Global",
        forecastVolume: 3200,
        actualVolume: 3180,
        accuracyPct: 99,
        revenueImpact: "$2.8M",
        reliability: "A+",
      },
    ],
    []
  );

  const quarterlyPerformanceRows = useMemo<QuarterlyPerformanceRow[]>(
    () => [
      {
        key: "Q1 2024",
        quarter: "Q1 2024",
        plannedQty: 7500,
        actualQty: 7250,
        plannedRevenue: "$2.25M",
        actualRevenue: "$2.17M",
        accuracyPct: 96.7,
      },
      {
        key: "Q2 2024",
        quarter: "Q2 2024",
        plannedQty: 8200,
        actualQty: 8450,
        plannedRevenue: "$2.46M",
        actualRevenue: "$2.54M",
        accuracyPct: 103,
      },
      {
        key: "Q3 2024",
        quarter: "Q3 2024",
        plannedQty: 7800,
        actualQty: 7920,
        plannedRevenue: "$2.34M",
        actualRevenue: "$2.38M",
        accuracyPct: 101.5,
      },
    ],
    []
  );

  const riskAssessmentRows = useMemo<RiskAssessmentRow[]>(
    () => [
      {
        key: "Supply Chain Disruption",
        riskFactor: "Supply Chain Disruption",
        probability: "Medium",
        impact: "High",
        mitigationStrategy: "Diversify suppliers",
        status: "Monitoring",
      },
      {
        key: "Demand Volatility",
        riskFactor: "Demand Volatility",
        probability: "High",
        impact: "Medium",
        mitigationStrategy: "Flexible production capacity",
        status: "Monitoring",
      },
      {
        key: "Quality Issues",
        riskFactor: "Quality Issues",
        probability: "Low",
        impact: "High",
        mitigationStrategy: "Enhanced QC processes",
        status: "Monitoring",
      },
      {
        key: "Currency Fluctuation",
        riskFactor: "Currency Fluctuation",
        probability: "Medium",
        impact: "Medium",
        mitigationStrategy: "Hedging strategies",
        status: "Monitoring",
      },
    ],
    []
  );

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

    return resolvedForecastRows.filter((r) => {
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
  }, [resolvedForecastRows, search, customerFilter, periodFilter, typeFilter]);

  const periodOptions = useMemo(
    () => [
      { label: "Current Period", value: "current" },
      { label: "2024-Q1", value: "2024-Q1" },
      { label: "2024-Q2", value: "2024-Q2" },
    ],
    []
  );

  const typeOptions = useMemo(
    () => [
      { label: "All Types", value: "all" },
      { label: "Forecast", value: "forecast" },
      { label: "Master Data", value: "master" },
    ],
    []
  );

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
        <Tag color={v === "Active" ? "blue" : "default"} className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
          {v}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
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
            icon={<BarChartOutlined />}
            onClick={() => openAnalytics("overview")}
          />
        </div>
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
            <Button className="!rounded-lg" icon={<FileExcelOutlined />} onClick={() => message.info("Export data")}> 
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
              </div>
              <div className="flex items-center gap-2">
                <Badge count={`${rows.length} forecasts`} style={{ backgroundColor: "#EEF2FF", color: "#3730A3" }} />
                <Button className="!rounded-lg" icon={<BarChartOutlined />} onClick={() => openAnalytics("overview")}> 
                  Analytics View
                </Button>
              </div>
            </div>

            <Table<ForecastRow>
              columns={columns}
              dataSource={rows}
              rowKey="key"
              size="middle"
              scroll={{ x: "max-content" }}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50"],
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
              <div className="text-sm font-semibold text-gray-900">Excel Upload</div>
              <div className="text-xs text-gray-500 mt-1">
                Upload forecast data directly from Excel sheet with columns: Customer, Uniq, Product Model, Part Name, Part Number, Quantity
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
                      message.success(`Uploaded ${file.name}`);
                      return false;
                    }

                    uploadExcel(file as File)
                      .unwrap()
                      .then(() => {
                        message.success(`Uploaded ${file.name}`);
                        prlListQuery.refetch();
                        refetchDemandGapIfActive();
                      })
                      .catch((err) => {
                        message.error(getApiErrorMessage(err, "Excel upload failed"));
                      });
                    return false;
                  }}
                >
                  <div className="py-6">
                    <div className="text-3xl text-gray-400 mb-2">⬆</div>
                    <div className="text-sm font-semibold text-gray-900">Upload Excel File</div>
                    <div className="text-xs text-gray-500 mt-1">Drag and drop your Excel file here, or click to browse</div>
                    <Button className="!rounded-lg mt-3" type="primary">
                      Choose File
                    </Button>
                  </div>
                </Upload.Dragger>
              </div>
            </div>

            {/* Aggregation Logic */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <div className="text-sm font-semibold text-gray-900">Data Aggregation Logic</div>
              <div className="text-xs text-gray-500 mt-1">
                When multiple PRL rows exist for same Uniq in a period, the system will sum them automatically
              </div>

              <div className="mt-3 bg-blue-50/60 rounded-xl border border-blue-100 p-4">
                <div className="text-xs font-semibold text-blue-800 mb-2">Current Aggregation Rules:</div>
                <ul className="text-xs text-blue-700 space-y-1 list-disc pl-5">
                  <li>Same Uniq + Same Period → Quantities summed</li>
                  <li>Customer data preserved from latest entry</li>
                  <li>Part specifications updated to most recent</li>
                  <li>Audit trail maintained for all aggregations</li>
                </ul>
              </div>
            </div>

            {/* Clear Operations */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="text-sm font-semibold text-gray-900">Clear Operations</div>
              <div className="text-xs text-gray-500 mt-1">Clear forecast data by various criteria</div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  className="!rounded-xl !h-auto !py-4"
                  disabled={anyBulkLoading}
                  onClick={() => {
                    if (!apiEnabled) {
                      message.info("Clear All Table (mock)");
                      return;
                    }

                    Modal.confirm({
                      title: "Clear all PRL forecasts?",
                      content: "This will delete all forecast rows.",
                      okText: "Clear All",
                      okButtonProps: { danger: true },
                      cancelText: "Cancel",
                      onOk: async () => {
                        try {
                          await clearAll().unwrap();
                          message.success("Cleared all forecasts");
                          prlListQuery.refetch();
                          refetchDemandGapIfActive();
                        } catch (err) {
                          message.error(getApiErrorMessage(err, "Clear all failed"));
                        }
                      },
                    });
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <DeleteOutlined className="text-red-500" />
                    <div className="text-sm font-semibold">Clear All Table</div>
                  </div>
                </Button>

                <Button
                  className="!rounded-xl !h-auto !py-4"
                  disabled={anyBulkLoading}
                  onClick={() => {
                    if (!apiEnabled) {
                      message.info("Clear by Uniq (mock)");
                      return;
                    }

                    const uniq = window.prompt("Input UNIQ to clear (e.g., FG-ABC-001)");
                    if (!uniq) return;

                    clearByUniq(uniq)
                      .unwrap()
                      .then(() => {
                        message.success(`Cleared forecasts for UNIQ ${uniq}`);
                        prlListQuery.refetch();
                        refetchDemandGapIfActive();
                      })
                      .catch((err) => {
                        message.error(getApiErrorMessage(err, "Clear by uniq failed"));
                      });
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <FilterOutlined className="text-amber-500" />
                    <div className="text-sm font-semibold">Clear by Uniq</div>
                  </div>
                </Button>

                <Button
                  className="!rounded-xl !h-auto !py-4"
                  disabled={anyBulkLoading}
                  onClick={() => {
                    if (!apiEnabled) {
                      message.info("Clear by Period (mock)");
                      return;
                    }

                    const period = window.prompt("Input period to clear (e.g., 2025-Q1)");
                    if (!period) return;

                    clearByPeriod(period)
                      .unwrap()
                      .then(() => {
                        message.success(`Cleared forecasts for period ${period}`);
                        prlListQuery.refetch();
                        refetchDemandGapIfActive();
                      })
                      .catch((err) => {
                        message.error(getApiErrorMessage(err, "Clear by period failed"));
                      });
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <CalendarOutlined className="text-blue-600" />
                    <div className="text-sm font-semibold">Clear by Period</div>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={forecastDetail.open}
        onCancel={() => setForecastDetail({ open: false, record: null })}
        footer={null}
        width={860}
        title={
          <div>
            <div className="text-sm font-semibold text-gray-900">Forecast Detail by Uniq</div>
            <div className="text-xs text-gray-500 font-normal">
              View detail and all forecast entries for the selected uniq.
            </div>
          </div>
        }
      >
        {selectedUniqSummary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">UNIQ</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{selectedUniqSummary.uniq}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">Total Forecast Qty</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{formatNumber(selectedUniqSummary.totalForecastQty)}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">Total Entries</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{selectedUniqSummary.totalEntries}</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs text-gray-500">Product Model</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{selectedUniqSummary.productModel}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Part Name</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{selectedUniqSummary.partName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Part Number</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{selectedUniqSummary.partNumber}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total Delivery Qty</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{formatNumber(selectedUniqSummary.totalDeliveryQty)}</div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100">
              <Table<ForecastRow>
                dataSource={selectedUniqRows}
                rowKey="key"
                size="small"
                pagination={false}
                columns={([
                  {
                    title: "PRL ID",
                    dataIndex: "prlId",
                    key: "prlId",
                    render: (value: string) => <span className="text-sm text-gray-800">{value}</span>,
                  },
                  {
                    title: "Customer",
                    dataIndex: "customer",
                    key: "customer",
                    render: (value: string) => <span className="text-sm text-gray-700">{value}</span>,
                  },
                  {
                    title: "Quantity",
                    dataIndex: "quantity",
                    key: "quantity",
                    align: "right",
                    render: (value: number) => <span className="text-sm text-gray-700">{formatNumber(value)}</span>,
                  },
                  {
                    title: "Delivery Qty",
                    dataIndex: "deliveryQuantity",
                    key: "deliveryQuantity",
                    align: "right",
                    render: (value: number | undefined) => <span className="text-sm text-gray-700">{formatNumber(Number(value ?? 0))}</span>,
                  },
                  {
                    title: "Period",
                    dataIndex: "period",
                    key: "period",
                    render: (value: string) => <span className="text-sm text-gray-700">{value}</span>,
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    key: "status",
                    render: (value: PrlStatus) => (
                      <Tag color={value === "Active" ? "blue" : "default"} className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
                        {value}
                      </Tag>
                    ),
                  },
                  {
                    title: "Created By",
                    dataIndex: "createdBy",
                    key: "createdBy",
                    render: (value?: string) => <span className="text-sm text-gray-700">{value ?? "-"}</span>,
                  },
                ]) as ColumnsType<ForecastRow>}
              />
            </div>
          </div>
        ) : null}
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
              message.success(`Uploaded ${file.name}`);
              return false;
            }

            uploadExcel(file as File)
              .unwrap()
              .then(() => {
                message.success(`Uploaded ${file.name}`);
                prlListQuery.refetch();
                refetchDemandGapIfActive();
              })
              .catch((err) => {
                message.error(getApiErrorMessage(err, "Excel upload failed"));
              });
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>Select Excel File</Button>
        </Upload>
        <div className="text-xs text-gray-500 mt-3">
          {apiEnabled ? "Uses /api/prl/upload-excel." : "API disabled: UI-only mock."}
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
                <div className="text-xl font-bold text-gray-900 mt-1">142</div>
                <div className="text-xs text-green-700 mt-1">+12% vs last quarter</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">Forecast Accuracy</div>
                <div className="text-xl font-bold text-gray-900 mt-1">94.2%</div>
                <div className="text-xs text-green-700 mt-1">+2.1% improvement</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">Active Customers</div>
                <div className="text-xl font-bold text-gray-900 mt-1">5</div>
                <div className="text-xs text-blue-700 mt-1">Stable base</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs text-gray-500">Planned Revenue</div>
                <div className="text-xl font-bold text-gray-900 mt-1">$7.2M</div>
                <div className="text-xs text-green-700 mt-1">+18% growth</div>
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
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-blue-50/40 px-3 py-2">
                    <div className="text-xs font-semibold text-gray-800">Q1 - High Season</div>
                    <Tag color="blue" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
                      +25% above average
                    </Tag>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-blue-50/40 px-3 py-2">
                    <div className="text-xs font-semibold text-gray-800">Q2 - Peak Season</div>
                    <Tag color="blue" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
                      +35% above average
                    </Tag>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-amber-50/40 px-3 py-2">
                    <div className="text-xs font-semibold text-gray-800">Q3 - Normal Season</div>
                    <Tag color="default" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
                      Average demand
                    </Tag>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-semibold text-gray-800">Q4 - Variable Season</div>
                    <Tag color="default" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
                      -10% to +20%
                    </Tag>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900">Growth Indicators</div>
                <div className="text-xs text-gray-500 mt-1">Key business movement metrics</div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">YoY Growth Rate</div>
                    <div className="text-xs font-semibold text-green-700">+18.5%</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">QoQ Growth Rate</div>
                    <div className="text-xs font-semibold text-blue-700">+6.2%</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">Customer Retention</div>
                    <div className="text-xs font-semibold text-purple-700">{formatPercent(96.8)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">New Customer Acquisition</div>
                    <div className="text-xs font-semibold text-red-600">2 per quarter</div>
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
