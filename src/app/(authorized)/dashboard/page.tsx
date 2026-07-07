"use client";

import { useState } from "react";
import StatsCard from "@/components/StatsCard";
import { Alert, Card, Select, Button, Badge, Progress } from "antd";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  useGetMainDashboardSummaryQuery,
  useGetRawMaterialSummaryQuery,
  MainDashboardSummary,
  RawMaterialSummary,
} from "@/lib/api/dashboard/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  FiTruck,
  FiActivity,
  FiBox,
  FiShoppingCart,
  FiRefreshCw,
  FiDownload,
  FiChevronDown,
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiPackage,
} from "react-icons/fi";

// --- Components ---

const SectionHeader = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold text-gray-900 mb-0.5">{title}</h2>
    <p className="text-sm text-gray-400 font-medium">{subtitle}</p>
  </div>
);

const TrendIcon = ({ trend }: { trend: "up" | "down" | "flat" }) => {
  if (trend === "up")
    return <FiTrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === "down")
    return <FiTrendingDown className="w-4 h-4 text-red-500" />;
  return <FiMinus className="w-4 h-4 text-gray-400" />;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-lg text-sm">
        <p className="font-bold text-gray-700 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 py-0.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-500">{entry.name}:</span>
            <span className="font-bold text-gray-900">
              {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- Main Page ---

export default function Dashboard() {
  const [period, setPeriod] = useState("current_month");
  const apiEnabled = Boolean(apiBaseUrl);

  // API Queries
  const mainSummaryQuery = useGetMainDashboardSummaryQuery(
    { period, start_date: "2026-04-01", end_date: "2026-04-30" },
    { skip: !apiEnabled },
  );
  const rawMaterialQuery = useGetRawMaterialSummaryQuery(
    { period, start_date: "2026-04-01", end_date: "2026-04-30" },
    { skip: !apiEnabled },
  );

  const mainData = mainSummaryQuery.data?.data;
  const rawData = rawMaterialQuery.data?.data;

  const error = mainSummaryQuery.error || rawMaterialQuery.error;
  const isMainLoading =
    mainSummaryQuery.isLoading || mainSummaryQuery.isFetching;
  const isRawLoading =
    rawMaterialQuery.isLoading || rawMaterialQuery.isFetching;

  const errorMessage = error
    ? getApiErrorMessage(error, "Failed to load dashboard data")
    : "";

  // Colors for Pie Chart
  const COLORS = ["#437EF7", "#FFA600", "#FF4D4F", "#00C950", "#8884d8"];

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen">
      {/* Header & Filters Card */}
      <Card
        className="mb-8 rounded-2xl shadow-sm border-gray-100 p-0 overflow-hidden"
        styles={{ body: { padding: "24px" } }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              AI ERP Dashboard
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              Comprehensive manufacturing intelligence and real-time business
              insights
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] font-bold text-green-700 uppercase tracking-wider">
                Live Data
              </span>
            </div>
            <Button
              icon={
                <FiRefreshCw className={isMainLoading ? "animate-spin" : ""} />
              }
              className="rounded-xl border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center h-10 font-medium"
              onClick={() => mainSummaryQuery.refetch()}>
              Refresh
            </Button>
            <Button
              icon={<FiDownload />}
              className="rounded-xl border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center h-10 font-medium">
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-gray-50">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
              Period
            </label>
            <Select
              defaultValue="current_period"
              className="w-full custom-select"
              variant="filled"
              style={{ backgroundColor: "#F9FAFB", borderRadius: "12px" }}
              suffixIcon={<FiChevronDown className="w-4 h-4 text-gray-400" />}>
              <Select.Option value="current_period">
                Current Period
              </Select.Option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
              Summaries
            </label>
            <Select
              defaultValue="all_summaries"
              className="w-full custom-select"
              variant="filled"
              style={{ backgroundColor: "#F9FAFB", borderRadius: "12px" }}
              suffixIcon={<FiChevronDown className="w-4 h-4 text-gray-400" />}>
              <Select.Option value="all_summaries">All Summaries</Select.Option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
              Deliveries
            </label>
            <Select
              defaultValue="all_deliveries"
              className="w-full custom-select"
              variant="filled"
              style={{ backgroundColor: "#F9FAFB", borderRadius: "12px" }}
              suffixIcon={<FiChevronDown className="w-4 h-4 text-gray-400" />}>
              <Select.Option value="all_deliveries">
                All Deliveries
              </Select.Option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
              Production
            </label>
            <Select
              defaultValue="all_production"
              className="w-full custom-select"
              variant="filled"
              style={{ backgroundColor: "#F9FAFB", borderRadius: "12px" }}
              suffixIcon={<FiChevronDown className="w-4 h-4 text-gray-400" />}>
              <Select.Option value="all_production">
                All Production
              </Select.Option>
            </Select>
          </div>
        </div>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          message={errorMessage}
          className="mb-8 rounded-xl shadow-sm"
        />
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-4">
        <StatsCard
          title="Total Deliveries"
          value={mainData?.kpis.total_deliveries.value ?? 0}
          subtitle={mainData?.kpis.total_deliveries.subtitle ?? "0 on time"}
          change={
            mainData?.kpis.total_deliveries.delta_percent
              ? `+${mainData.kpis.total_deliveries.delta_percent}% ${mainData.kpis.total_deliveries.delta_label}`
              : undefined
          }
          changeType={
            mainData?.kpis.total_deliveries.trend === "down"
              ? "negative"
              : "positive"
          }
          icon={<FiTruck className="w-6 h-6 text-blue-600" />}
          bgColor="bg-blue-50"
          textColor="text-blue-600"
          className="shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        />
        <StatsCard
          title="Current Production"
          value={mainData?.kpis.current_production.value ?? 0}
          subtitle={
            mainData?.kpis.current_production.subtitle ?? "0 active WOs"
          }
          change={
            mainData?.kpis.current_production.delta_percent
              ? `+${mainData.kpis.current_production.delta_percent}% ${mainData.kpis.current_production.delta_label}`
              : undefined
          }
          changeType={
            mainData?.kpis.current_production.trend === "down"
              ? "negative"
              : "positive"
          }
          icon={<FiActivity className="w-6 h-6 text-green-600" />}
          bgColor="bg-green-50"
          textColor="text-green-600"
          className="shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        />
        <StatsCard
          title="Total Production"
          value={mainData?.kpis.total_production.value ?? 0}
          subtitle={
            mainData?.kpis.total_production.subtitle ?? "0 completed today"
          }
          change={
            mainData?.kpis.total_production.delta_percent
              ? `+${mainData.kpis.total_production.delta_percent}% ${mainData.kpis.total_production.delta_label}`
              : undefined
          }
          changeType={
            mainData?.kpis.total_production.trend === "down"
              ? "negative"
              : "positive"
          }
          icon={<FiPackage className="w-6 h-6 text-purple-600" />}
          bgColor="bg-purple-50"
          textColor="text-purple-600"
          className="shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        />
        <StatsCard
          title="PO & Raw Material"
          value={mainData?.kpis.po_raw_material.value ?? 0}
          subtitle={
            mainData?.kpis.po_raw_material.subtitle ?? "0 buy recommendations"
          }
          change={
            mainData?.kpis.po_raw_material.delta_value
              ? `+${mainData.kpis.po_raw_material.delta_value} ${mainData.kpis.po_raw_material.delta_label}`
              : undefined
          }
          changeType={
            mainData?.kpis.po_raw_material.trend === "down"
              ? "negative"
              : "positive"
          }
          icon={<FiShoppingCart className="w-6 h-6 text-orange-600" />}
          bgColor="bg-orange-50"
          textColor="text-orange-600"
          className="shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        />
      </div>

      {/* Main Performance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Delivery Performance Summary */}
        <Card className="rounded-2xl shadow-sm border-gray-100 overflow-hidden">
          <SectionHeader
            title="Delivery Performance Summary"
            subtitle="Comprehensive delivery metrics and customer performance"
          />

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-[#F9FAFB] rounded-xl bg-opacity-50">
              <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
                Total Deliveries
              </p>
              <h3 className="text-2xl font-black text-[#1C398E]">
                {mainData?.delivery_performance.total_deliveries ?? 0}
              </h3>
              <p className="text-blue-500 text-xs font-medium">
                $
                {(
                  mainData?.delivery_performance.total_value ?? 0
                ).toLocaleString()}{" "}
                value
              </p>
            </div>
            <div className="p-4 bg-[#F9FAFB] rounded-xl bg-opacity-50">
              <p className="text-green-600 text-xs font-bold uppercase tracking-wider mb-1">
                On-Time Rate
              </p>
              <h3 className="text-2xl font-black text-green-900">
                {mainData?.delivery_performance.on_time_rate_percent ?? 0}%
              </h3>
              <p className="text-green-500 text-xs font-medium">
                {mainData?.delivery_performance.on_time_count ?? 0} on time
              </p>
            </div>
          </div>

          <div className="h-64 w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mainData?.delivery_performance.trend}>
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#437EF7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#437EF7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#437EF7"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorActual)"
                  name="Actual"
                />
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke="#00C950"
                  strokeWidth={2}
                  fillOpacity={0}
                  name="Target"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-bold text-gray-700 mb-4 px-2">
              Top Customers by Delivery Volume
            </h4>
            <div className="space-y-2">
              {mainData?.top_customers.map((customer, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-50 rounded-md transition-colors">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {customer.customer_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {customer.delivery_count} deliveries
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      count={customer.status}
                      style={{
                        backgroundColor:
                          customer.status === "Excellent"
                            ? "#00C950"
                            : "#FFA600",
                        borderRadius: 4,
                      }}
                      className="mb-1 text-xs font-semibold"
                    />
                    <p className="text-xs font-bold text-gray-500">
                      {customer.share_percent}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Production Performance Summary */}
        <Card className="rounded-2xl shadow-sm border-gray-100 overflow-hidden">
          <SectionHeader
            title="Production Performance Summary"
            subtitle="Current production status and historical performance"
          />

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-[#F9FAFB] rounded-xl bg-opacity-50">
              <p className="text-green-600 text-xs font-bold uppercase tracking-wider mb-1">
                Current Production
              </p>
              <h3 className="text-2xl font-black text-green-900">
                {mainData?.production_performance.current_production ?? 0}
              </h3>
              <p className="text-green-500 text-xs font-medium">
                {mainData?.production_performance.capacity_percent ?? 0}%
                capacity
              </p>
            </div>
            <div className="p-4 bg-[#F9FAFB] rounded-xl bg-opacity-50">
              <p className="text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">
                Total Production
              </p>
              <h3 className="text-2xl font-black text-purple-900">
                {(
                  mainData?.production_performance.total_production ?? 0
                ).toLocaleString()}
              </h3>
              <p className="text-purple-500 text-xs font-medium">
                {mainData?.production_performance.quality_percent ?? 0}% quality
              </p>
            </div>
          </div>

          <div className="h-64 w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mainData?.production_performance.trend}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="produced"
                  stroke="#437EF7"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#437EF7", strokeWidth: 2 }}
                  name="Produced"
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#CBD5E1"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: "#CBD5E1" }}
                  name="Target"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6">
            <h4 className="text-sm font-bold text-gray-700 mb-4 px-2">
              Current UNIQ Production Progress
            </h4>
            <div className="space-y-4">
              {(mainData?.current_uniq_progress ?? []).length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm italic">
                  No active production progress
                </div>
              ) : (
                (mainData?.current_uniq_progress ?? []).map((item, idx) => (
                  <div key={idx} className="px-2">
                    <div className="flex justify-between items-end mb-1">
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          {item.uniq_code}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(item.produced_units ?? item.produced_qty ?? 0).toLocaleString()} /{" "}
                          {(item.total_units ?? item.target_qty ?? item.total_qty ?? 0).toLocaleString()} units
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">
                          {item.status}
                        </span>
                        <span className="text-sm font-black text-gray-900">
                          {item.progress_percent}%
                        </span>
                      </div>
                    </div>
                    <Progress
                      percent={item.progress_percent}
                      showInfo={false}
                      strokeColor="#00C950"
                      trailColor="#E2E8F0"
                      strokeWidth={8}
                      className="m-0"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Raw Material & Purchase Order Summary */}
        <Card className="rounded-2xl shadow-sm border-gray-100 overflow-hidden">
          <SectionHeader
            title="Raw Material & Purchase Order Summary"
            subtitle="Procurement status and inventory levels"
          />

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-[#F9FAFB] rounded-xl bg-opacity-50">
              <p className="text-orange-600 text-xs font-bold uppercase tracking-wider mb-1">
                Total POs
              </p>
              <h3 className="text-2xl font-black text-orange-900">
                {rawData?.po_summary.total_pos ?? 0}
              </h3>
              <p className="text-orange-500 text-xs font-medium">
                ${(rawData?.po_summary.total_value ?? 0).toLocaleString()} value
              </p>
            </div>
            <div className="p-4 bg-[#F9FAFB] rounded-xl bg-opacity-50">
              <p className="text-red-600 text-xs font-bold uppercase tracking-wider mb-1">
                Low Stock Alerts
              </p>
              <h3 className="text-2xl font-black text-red-900">
                {rawData?.po_summary.low_stock_alerts ?? 0}
              </h3>
              <p className="text-red-500 text-xs font-medium">
                {rawData?.po_summary.critical_alerts ?? 0} critical
              </p>
            </div>
          </div>

          <div className="h-72 w-full relative">
            {isRawLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 z-10">
                <FiRefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rawData?.po_summary?.monthly_trend ?? []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94A3B8", fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="ordered"
                  fill="#FFA600"
                  radius={[4, 4, 0, 0]}
                  name="Ordered"
                />
                <Bar
                  dataKey="received"
                  fill="#00C950"
                  radius={[4, 4, 0, 0]}
                  name="Received"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Raw Material Category Distribution */}
        <Card className="rounded-2xl shadow-sm border-gray-100 overflow-hidden">
          <SectionHeader
            title="Raw Material Category Distribution"
            subtitle="Supplier performance"
          />

          <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
            <div className="h-64 w-full md:w-1/2 relative">
              {isRawLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 z-10">
                  <FiRefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rawData?.category_distribution ?? []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="share_percent"
                    nameKey="category">
                    {(rawData?.category_distribution ?? []).map(
                      (entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ),
                    )}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-2">
              {(rawData?.category_distribution ?? []).map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-600 font-medium">
                      {item.category}
                    </span>
                  </div>
                  <span className="font-bold text-gray-900">
                    {item.share_percent}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-4 px-2">
              Top Supplier Performance
            </h4>
            <div className="space-y-2">
              {(rawData?.top_suppliers ?? []).map((supplier, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-50 rounded-md transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-sm">
                      {supplier.supplier_code.slice(-2)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {supplier.supplier_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        On-time:{" "}
                        <span className="text-blue-600 font-semibold">
                          {supplier.on_time_percent}%
                        </span>{" "}
                        | Quality:{" "}
                        <span className="text-green-600 font-semibold">
                          {supplier.quality_percent}%
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs">
                    {supplier.grade}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
