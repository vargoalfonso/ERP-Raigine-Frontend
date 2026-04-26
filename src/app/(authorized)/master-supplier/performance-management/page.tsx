"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  DownloadOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import StatsCard from "@/components/StatsCard";
import {
  type SupplierPerformanceRow,
  useExportSupplierPerformanceMutation,
  useGetSupplierPerformanceChartsQuery,
  useGetSupplierPerformanceListQuery,
  useGetSupplierPerformanceSummaryQuery,
} from "@/lib/api/suppliers/performance";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const isMissingRouteError = (error: unknown): boolean => isRecord(error) && (error as UnknownRecord).status === 404;

const toText = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const currentMonth = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const statusColor = (label?: string) => {
  const v = (label ?? "").toLowerCase();
  if (v.includes("excellent")) return "green";
  if (v.includes("good")) return "blue";
  if (v.includes("review")) return "orange";
  return "default";
};

const gradeColor = (grade?: string) => {
  const g = (grade ?? "").toUpperCase();
  if (g === "A") return "green";
  if (g === "B") return "blue";
  if (g === "C") return "orange";
  return "default";
};

const numberOrZero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const percent = (v: unknown) => `${numberOrZero(v).toFixed(2).replace(/\.00$/, "")}%`;

const MOCK_ITEMS: SupplierPerformanceRow[] = [
  {
    supplier_id: "mock-1",
    supplier_code: "SUP-0001",
    supplier_name: "PT Example Supplier",
    evaluation_period_type: "monthly",
    evaluation_period_value: currentMonth(),
    total_deliveries: 48,
    on_time_deliveries: 42,
    late_deliveries: 6,
    otd_percentage: 87.5,
    average_delay_days: 2.3,
    rejected_quantity: 500,
    inspected_quantity: 48000,
    quality_percentage: 99,
    performance_grade: "B",
    status_label: "Good",
    formula_otd: "(on_time_deliveries / total_deliveries) * 100",
    formula_quality: "(accepted_quantity / (accepted_quantity + rejected_quantity)) * 100",
    formula_grade: "(quality_percentage * 0.5) + (otd_percentage * 0.5)",
    formula_notes: "Grade A >= 90, B 80-89.99, C < 80",
  },
];

export default function SupplierPerformanceManagementPage() {
  const apiEnabled = Boolean(apiBaseUrl);
  const [messageApi, contextHolder] = message.useMessage();

  const [periodType, setPeriodType] = useState<"monthly" | "yearly" | "specific">("monthly");
  const [periodValue, setPeriodValue] = useState<string>(currentMonth());

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const listQuery = useGetSupplierPerformanceListQuery(
    { page, limit, period_type: periodType, period_value: periodValue },
    { skip: !apiEnabled }
  );

  const summaryQuery = useGetSupplierPerformanceSummaryQuery(
    { period_type: periodType, period_value: periodValue },
    { skip: !apiEnabled }
  );

  const chartsQuery = useGetSupplierPerformanceChartsQuery(
    { period_type: periodType, period_value: periodValue },
    { skip: !apiEnabled }
  );

  const [exportSupplierPerformance, exportState] = useExportSupplierPerformanceMutation();

  const isRouteMissing =
    isMissingRouteError(listQuery.error) ||
    isMissingRouteError(summaryQuery.error) ||
    isMissingRouteError(chartsQuery.error);

  const rows = useMemo(() => {
    if (!apiEnabled || isRouteMissing) return MOCK_ITEMS;
    return listQuery.data?.data ?? [];
  }, [apiEnabled, isRouteMissing, listQuery.data]);

  const summary = useMemo(() => {
    if (!apiEnabled || isRouteMissing) {
      return {
        excellent_suppliers: 0,
        good_suppliers: 0,
        review_required_suppliers: rows.length,
        total_suppliers_evaluated: rows.length,
        total_purchase_value: 0,
        logic_version: "v1",
        formula_grade: "(quality_percentage * 0.5) + (otd_percentage * 0.5)",
      };
    }
    return summaryQuery.data?.data ?? {};
  }, [apiEnabled, isRouteMissing, rows.length, summaryQuery.data]);

  const charts = useMemo(() => {
    if (!apiEnabled || isRouteMissing) {
      return {
        trend: [{ period: periodValue || currentMonth(), avg_otd_percentage: 0, avg_quality_percentage: 0 }],
        scatter: rows.map((r) => ({
          supplier_id: r.supplier_id,
          supplier_name: r.supplier_name,
          otd_percentage: numberOrZero(r.otd_percentage),
          quality_percentage: numberOrZero(r.quality_percentage),
          status_label: r.status_label,
        })),
      };
    }
    return chartsQuery.data?.data ?? {};
  }, [apiEnabled, isRouteMissing, chartsQuery.data, periodValue, rows]);

  const formulaSource = rows[0];

  const handleReload = async () => {
    if (!apiEnabled) {
      messageApi.warning("API base url not configured");
      return;
    }
    try {
      await Promise.all([listQuery.refetch(), summaryQuery.refetch(), chartsQuery.refetch()]);
      messageApi.success("Refreshed");
    } catch {
      // ignore
    }
  };

  const handleExport = async () => {
    if (!apiEnabled) {
      messageApi.warning("API base url not configured");
      return;
    }

    if (!periodValue.trim()) {
      messageApi.error("Period value is required for export");
      return;
    }

    try {
      const result = await exportSupplierPerformance({
        period_type: periodType,
        period_value: periodValue.trim(),
        format: "xlsx",
      }).unwrap();

      downloadBlob(result.blob, result.filename);
      messageApi.success("Exported");
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, "Failed to export"));
    }
  };

  const columns: ColumnsType<SupplierPerformanceRow> = [
    {
      title: "Supplier",
      dataIndex: "supplier_name",
      key: "supplier_name",
      width: 360,
      render: (_: unknown, row) => (
        <div>
          <div className="font-semibold text-gray-900">{row.supplier_name}</div>
          <div className="text-xs text-gray-500">{row.supplier_code}</div>
        </div>
      ),
    },
    {
      title: "Total Deliveries",
      dataIndex: "total_deliveries",
      key: "total_deliveries",
      width: 130,
      render: (v: unknown, row) => (
        <div>
          <div className="font-semibold text-gray-900">{numberOrZero(v)}</div>
          <div className="text-xs text-gray-500">
            <span className="text-green-600">{numberOrZero(row.on_time_deliveries)} ✓</span>
            <span className="mx-2 text-gray-300">•</span>
            <span className="text-red-600">{numberOrZero(row.late_deliveries)} ✕</span>
          </div>
        </div>
      ),
    },
    {
      title: "OTD%",
      dataIndex: "otd_percentage",
      key: "otd_percentage",
      width: 110,
      render: (v: unknown) => <Tag color={numberOrZero(v) >= 90 ? "green" : numberOrZero(v) >= 80 ? "blue" : "red"}>{percent(v)}</Tag>,
    },
    {
      title: "Avg Delay",
      dataIndex: "average_delay_days",
      key: "average_delay_days",
      width: 120,
      render: (v: unknown) => (
        <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
          {numberOrZero(v).toFixed(1).replace(/\.0$/, "")} days
        </span>
      ),
    },
    {
      title: "Quality%",
      dataIndex: "quality_percentage",
      key: "quality_percentage",
      width: 110,
      render: (v: unknown) => <Tag color={numberOrZero(v) >= 90 ? "green" : numberOrZero(v) >= 80 ? "blue" : "red"}>{percent(v)}</Tag>,
    },
    {
      title: "Rejected Qty",
      dataIndex: "rejected_quantity",
      key: "rejected_quantity",
      width: 140,
      render: (v: unknown, row) => (
        <div>
          <div className="font-semibold text-red-600">{numberOrZero(v)}</div>
          <div className="text-xs text-gray-500">of {numberOrZero(row.inspected_quantity)}</div>
        </div>
      ),
    },
    {
      title: "Grade",
      dataIndex: "performance_grade",
      key: "performance_grade",
      width: 90,
      render: (v: unknown) => <Tag color={gradeColor(toText(v))}>{toText(v) ?? "-"}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status_label",
      key: "status_label",
      width: 160,
      render: (v: unknown) => <Tag color={statusColor(toText(v))}>{toText(v) ?? "-"}</Tag>,
    },
  ];

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize: limit,
    total: apiEnabled && !isRouteMissing ? listQuery.data?.pagination?.total ?? rows.length : rows.length,
    showSizeChanger: true,
    pageSizeOptions: ["10", "20", "50", "100"],
    onChange: (nextPage, nextSize) => {
      setPage(nextPage);
      if (nextSize && nextSize !== limit) {
        setLimit(nextSize);
        setPage(1);
      }
    },
  };

  const loading = apiEnabled && (listQuery.isLoading || summaryQuery.isLoading || chartsQuery.isLoading);

  const showWarning = apiEnabled && isRouteMissing;
  const showError = apiEnabled && !isRouteMissing && (listQuery.error || summaryQuery.error || chartsQuery.error);

  return (
    <div className="p-6">
      {contextHolder}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Supplier Performance Management
          </Typography.Title>
          <div className="mt-1 text-sm text-gray-500">
            Real-time supplier performance tracking with quality and delivery metrics
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={periodType}
            onChange={(value) => {
              setPeriodType(value);
              setPage(1);
              if (value === "monthly" && !periodValue) setPeriodValue(currentMonth());
            }}
            style={{ width: 140 }}
            options={[
              { label: "Monthly", value: "monthly" },
              { label: "Yearly", value: "yearly" },
              { label: "Specific", value: "specific" },
            ]}
          />
          <Input
            value={periodValue}
            onChange={(e) => {
              setPeriodValue(e.target.value);
              setPage(1);
            }}
            placeholder={periodType === "yearly" ? "YYYY" : "YYYY-MM"}
            style={{ width: 140 }}
          />
          <Button icon={<ReloadOutlined />} onClick={handleReload} disabled={!apiEnabled}>
            Reload
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exportState.isLoading}
            disabled={!apiEnabled}
          >
            Export Report
          </Button>
        </div>
      </div>

      {showWarning && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="Supplier performance API route not available yet"
          description="Showing mock data because the backend route returned 404."
        />
      )}

      {showError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Failed to load supplier performance"
          description={getApiErrorMessage(
            listQuery.error ?? summaryQuery.error ?? chartsQuery.error,
            "Failed to load supplier performance"
          )}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
        <StatsCard
          title="Excellent"
          value={numberOrZero(summary.excellent_suppliers)}
          subtitle="Grade A"
          icon={<span className="text-sm font-bold">A</span>}
          bgColor="bg-green-100"
          textColor="text-green-700"
        />
        <StatsCard
          title="Good"
          value={numberOrZero(summary.good_suppliers)}
          subtitle="Grade B"
          icon={<span className="text-sm font-bold">B</span>}
          bgColor="bg-blue-100"
          textColor="text-blue-700"
        />
        <StatsCard
          title="Review Required"
          value={numberOrZero(summary.review_required_suppliers)}
          subtitle="Needs attention"
          icon={<span className="text-sm font-bold">!</span>}
          bgColor="bg-orange-100"
          textColor="text-orange-700"
        />
        <StatsCard
          title="Total Evaluated"
          value={numberOrZero(summary.total_suppliers_evaluated)}
          subtitle="Suppliers"
          icon={<span className="text-sm font-bold">Σ</span>}
          bgColor="bg-gray-100"
          textColor="text-gray-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-6">
        <Card title="Performance Trend" loading={loading}>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={charts.trend ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="avg_otd_percentage" name="Avg OTD%" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="avg_quality_percentage" name="Avg Quality%" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="OTD vs Quality (Scatter)" loading={loading}>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="otd_percentage" name="OTD%" domain={[0, 100]} />
                <YAxis type="number" dataKey="quality_percentage" name="Quality%" domain={[0, 100]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter name="Suppliers" data={charts.scatter ?? []} fill="#f59e0b" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card
        title={
          <div>
            <div className="font-semibold">Detailed Supplier Performance</div>
            <div className="text-sm text-gray-500">Comprehensive performance metrics for all suppliers</div>
          </div>
        }
        extra={<div className="text-xs text-gray-500">Logic: {summary.logic_version ?? formulaSource?.logic_version ?? "-"}</div>}
      >
        {!loading && rows.length === 0 ? (
          <Empty description="No data" />
        ) : (
          <Table
            rowKey={(row) => row.supplier_id}
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={pagination}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      <div className="mt-6">
        <Card
          title="Performance Calculation Logic"
          className="bg-blue-50"
          styles={{ body: { background: "#eff6ff" } }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card size="small" title="Quality Performance (%)">
              <div className="text-xs text-gray-500 mb-1">Formula:</div>
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-mono">
                {formulaSource?.formula_quality ?? "(accepted_quantity / (accepted_quantity + rejected_quantity)) * 100"}
              </div>
              <div className="mt-2 text-xs text-gray-500">Alert: Quality% &lt; 90</div>
            </Card>

            <Card size="small" title="On-Time Delivery (%)">
              <div className="text-xs text-gray-500 mb-1">Formula:</div>
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-mono">
                {formulaSource?.formula_otd ?? "(on_time_deliveries / total_deliveries) * 100"}
              </div>
              <div className="mt-2 text-xs text-gray-500">Alert: OTD% &lt; 80</div>
            </Card>

            <Card size="small" title="Performance Grade">
              <div className="text-xs text-gray-500 mb-1">Weighted composite score:</div>
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-mono">
                {summary.formula_grade ?? formulaSource?.formula_grade ?? "(quality_percentage * 0.5) + (otd_percentage * 0.5)"}
              </div>
              <div className="mt-3 text-xs text-gray-500">
                <div>Grade A: ≥ 90%</div>
                <div>Grade B: 80-89%</div>
                <div>Grade C: &lt; 80%</div>
              </div>
            </Card>
          </div>

          {formulaSource?.formula_notes && (
            <div className="mt-4 text-xs text-gray-600">Notes: {formulaSource.formula_notes}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
