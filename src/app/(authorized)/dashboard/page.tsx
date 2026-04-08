"use client";

import StatsCard from "@/components/StatsCard";
import { Alert, Card } from "antd";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetDashboardOverviewQuery } from "@/lib/api/dashboard/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const formatDelta = (delta?: number | null, direction?: string) => {
  if (typeof delta === "number" && Number.isFinite(delta)) {
    const prefix = delta > 0 ? "+" : "";
    return `${prefix}${delta}% vs last period`;
  }

  if (direction === "flat") return "Flat vs last period";
  return undefined;
};

const toMonthLabel = (bucket?: string) => {
  if (!bucket) return "-";
  const parsed = new Date(`${bucket}-01T00:00:00`);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", { month: "short" });
  }
  return bucket;
};

export default function Dashboard() {
  const apiEnabled = Boolean(apiBaseUrl);
  const dashboardQuery = useGetDashboardOverviewQuery(undefined, { skip: !apiEnabled });
  const overview = dashboardQuery.data?.data;
  const delivery = overview?.delivery;
  const production = overview?.production;
  const currentProduction = overview?.current_production;
  const procurement = overview?.procurement;
  const dashboardError = dashboardQuery.error ? getApiErrorMessage(dashboardQuery.error, "Failed to load dashboard overview") : "";

  const deliveryChartData =
    delivery?.series?.map((item) => ({
      name: toMonthLabel(item.bucket),
      scheduled: item.scheduled ?? item.total ?? 0,
      shipped: item.shipped ?? item.scheduled ?? 0,
    })) ?? [];

  const productionChartData =
    production?.uniq_progress?.slice(0, 6).map((item) => ({
      name: item.uniq ?? "-",
      plan: item.target_qty ?? 0,
      actual: item.produced_qty ?? 0,
    })) ?? [];

  // Icons for stats cards
  const truckIcon = (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );

  const productionIcon = (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );

  const totalProductionIcon = (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );

  const rawMaterialIcon = (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 13v4a2 2 0 01-2 2H9a2 2 0 01-2-2v-4m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01"
      />
    </svg>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-white  p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              AI ERP Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Intelligent analytics and real-time manufacturing insights
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select className="px-3 py-1 border border-gray-300 rounded-md text-sm">
              <option>Current Period</option>
            </select>
            <select className="px-3 py-1 border border-gray-300 rounded-md text-sm">
              <option>All Summaries</option>
            </select>
            <button className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export
            </button>
          </div>
        </div>
      </div>

      {!apiEnabled ? (
        <Alert
          type="warning"
          showIcon
          className="mb-6"
          message="Dashboard API is not configured. Set NEXT_PUBLIC_API_URL to your backend base URL."
        />
      ) : dashboardError ? (
        <Alert type="error" showIcon className="mb-6" message={dashboardError} />
      ) : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Deliveries"
          value={delivery?.total ?? 0}
          subtitle={`${delivery?.on_time ?? 0} on time`}
          change={formatDelta(delivery?.trend?.delta_pct, delivery?.trend?.direction)}
          changeType={(delivery?.trend?.delta_pct ?? 0) < 0 ? "negative" : "positive"}
          icon={truckIcon}
          bgColor="bg-blue-50"
          textColor="text-blue-600"
        />
        <StatsCard
          title="Current Production"
          value={currentProduction?.running_machines ?? 0}
          subtitle={`${currentProduction?.active_wo_count ?? 0} active WOs`}
          change={formatDelta(currentProduction?.trend?.delta_pct, currentProduction?.trend?.direction)}
          changeType={(currentProduction?.trend?.delta_pct ?? 0) < 0 ? "negative" : "positive"}
          icon={productionIcon}
          bgColor="bg-green-50"
          textColor="text-green-600"
        />
        <StatsCard
          title="Total Production"
          value={production?.good_qty ?? 0}
          subtitle={`${production?.completed_today ?? 0} completed today`}
          change={formatDelta(production?.trend?.delta_pct, production?.trend?.direction)}
          changeType={(production?.trend?.delta_pct ?? 0) < 0 ? "negative" : "positive"}
          icon={totalProductionIcon}
          bgColor="bg-purple-50"
          textColor="text-purple-600"
        />
        <StatsCard
          title="PO & Raw Material"
          value={procurement?.open_po_count ?? 0}
          subtitle={`${procurement?.buy_recommendations ?? 0} buy recommendations`}
          change={formatDelta(procurement?.trend?.delta_pct, procurement?.trend?.direction)}
          changeType={(procurement?.trend?.delta_pct ?? 0) < 0 ? "negative" : "positive"}
          icon={rawMaterialIcon}
          bgColor="bg-orange-50"
          textColor="text-orange-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Performance Chart */}
        <Card
          title={
            <div className="p-2">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>Delivery Performance</div>
              </div>
              <div className="text-gray-500 font-normal">
                Monthly delivery trends and on-time performance
              </div>
            </div>
          }
          className="rounded-xl shadow-md"
        >
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={deliveryChartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="scheduled" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Scheduled" />
              <Bar dataKey="shipped" fill="#00C950" radius={[4, 4, 0, 0]} name="Shipped" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Production vs Plan Chart */}
        <Card
          title={
            <div className="p-2">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <span>Production vs Plan</span>
              </div>
              <span className="text-gray-500 font-normal">
                Weekly production performance against targets
              </span>
            </div>
          }
          className="rounded-xl shadow-md"
        >
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={productionChartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="plan"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                name="Plan"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#6b7280"
                strokeWidth={3}
                dot={{ fill: "#6b7280", strokeWidth: 2, r: 4 }}
                name="Actual"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
