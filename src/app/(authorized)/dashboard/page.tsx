"use client";

import StatsCard from "@/components/StatsCard";
import { Card } from "antd";
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

const data = [
  {
    name: "Jan",
    uv: 4000,
    pv: 4400,
    amt: 2400,
  },
  {
    name: "Feb",
    uv: 8000,
    pv: 5398,
    amt: 2210,
  },
  {
    name: "Mar",
    uv: 7000,
    pv: 9800,
    amt: 2290,
  },
  {
    name: "Apr",
    uv: 6780,
    pv: 6908,
    amt: 2000,
  },
  {
    name: "May",
    uv: 5890,
    pv: 6800,
    amt: 2181,
  },
  {
    name: "Jun",
    uv: 6390,
    pv: 7800,
    amt: 2500,
  },
];

export default function Dashboard() {
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Deliveries"
          value="156"
          subtitle="148 on time"
          change="+12% vs last month"
          changeType="positive"
          icon={truckIcon}
          bgColor="bg-blue-50"
          textColor="text-blue-600"
        />
        <StatsCard
          title="Current Production"
          value="145"
          subtitle="12 active WOs"
          change="+21% vs last month"
          changeType="positive"
          icon={productionIcon}
          bgColor="bg-green-50"
          textColor="text-green-600"
        />
        <StatsCard
          title="Total Production"
          value="2340"
          subtitle="87 completed today"
          change="+8.5% vs last month"
          changeType="positive"
          icon={totalProductionIcon}
          bgColor="bg-purple-50"
          textColor="text-purple-600"
        />
        <StatsCard
          title="PO & Raw Material"
          value="48"
          subtitle="15 buy recommendations"
          change="+4 vs last month"
          changeType="positive"
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
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="uv" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pv" fill="#00C950" radius={[4, 4, 0, 0]} />
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
              data={[
                { name: "Mon", plan: 200, actual: 180 },
                { name: "Tue", plan: 210, actual: 190 },
                { name: "Wed", plan: 190, actual: 185 },
                { name: "Thu", plan: 220, actual: 195 },
                { name: "Fri", plan: 240, actual: 230 },
                { name: "Sat", plan: 180, actual: 160 },
              ]}
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
