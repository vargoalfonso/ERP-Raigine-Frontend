"use client";

import { useMemo, useState } from "react";
import { Button, Input, Select, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BulbOutlined,
  DownloadOutlined,
  EditOutlined,
  PlayCircleOutlined,
  StopOutlined,
  SearchOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

type TabKey = "jobs" | "triggers";

type JobStatus = "In Progress" | "Completed" | "Terminated" | "Failed";

type JobPriority = "Low" | "Medium" | "High";

type JobRow = {
  key: string;
  type: "Production" | "Testing" | "Development";
  hostname: string;
  status: JobStatus;
  priority: JobPriority;
  started: string;
  ended: string;
  action: "Start" | "Stop";
};

type TriggerStatus = "Online" | "Offline";

type TriggerRow = {
  key: string;
  name: string;
  status: TriggerStatus;
  triggerDetails: string;
  priority: JobPriority;
  nextRunTime: string;
  stopAfter: string;
};

const statusTag = (status: JobStatus) => {
  const cls =
    status === "In Progress"
      ? "bg-green-50 text-green-700"
      : status === "Completed"
        ? "bg-blue-50 text-blue-700"
        : status === "Failed"
          ? "bg-red-50 text-red-700"
          : "bg-orange-50 text-orange-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{status}</span>;
};

const priorityBadge = (priority: JobPriority) => {
  const cls = priority === "High" ? "text-red-500" : priority === "Medium" ? "text-orange-500" : "text-gray-400";
  const label = priority;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm ${cls}`}>▴</span>
      <span className="text-sm text-gray-800">{label}</span>
    </div>
  );
};

const onlineTag = (status: TriggerStatus) => {
  const cls = status === "Online" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{status}</span>;
};

export default function RobotAutomationPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("jobs");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("All Types");

  const rows = useMemo<JobRow[]>(
    () => [
      {
        key: "1",
        type: "Production",
        hostname: "Cloud Robot - Serverless",
        status: "In Progress",
        priority: "Medium",
        started: "21 hours ago",
        ended: "21 hours ago",
        action: "Start",
      },
      {
        key: "2",
        type: "Testing",
        hostname: "Cloud Robot - Serverless",
        status: "Completed",
        priority: "High",
        started: "1 hours ago",
        ended: "1 hours ago",
        action: "Stop",
      },
      {
        key: "3",
        type: "Testing",
        hostname: "Cloud Robot - Serverless",
        status: "Terminated",
        priority: "High",
        started: "4 hours ago",
        ended: "4 hours ago",
        action: "Start",
      },
      {
        key: "4",
        type: "Development",
        hostname: "Cloud Robot - Serverless",
        status: "Failed",
        priority: "Medium",
        started: "10 hours ago",
        ended: "10 hours ago",
        action: "Stop",
      },
      {
        key: "5",
        type: "Development",
        hostname: "Cloud Robot - Serverless",
        status: "Terminated",
        priority: "Medium",
        started: "10 hours ago",
        ended: "10 hours ago",
        action: "Start",
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const typeOk = typeFilter === "All Types" || r.type === typeFilter;
      if (!typeOk) return false;
      if (!q) return true;
      const hay = `${r.type} ${r.hostname} ${r.status} ${r.priority}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, typeFilter]);

  const [triggers, setTriggers] = useState<TriggerRow[]>([
    {
      key: "t1",
      name: "showtrigger1",
      status: "Online",
      triggerDetails: "Every Hour",
      priority: "Medium",
      nextRunTime: "Jul 25, 2024 | 19:06",
      stopAfter: "N/A",
    },
    {
      key: "t2",
      name: "Testingbot123",
      status: "Offline",
      triggerDetails: "Every 5 Minutes",
      priority: "Low",
      nextRunTime: "May 19, 2024 | 16:40",
      stopAfter: "N/A",
    },
    {
      key: "t3",
      name: "phytonest3",
      status: "Offline",
      triggerDetails: "Every 3 Days",
      priority: "Medium",
      nextRunTime: "Jan 13, 2024 | 12:30",
      stopAfter: "N/A",
    },
    {
      key: "t4",
      name: "Robottest",
      status: "Online",
      triggerDetails: "N/A",
      priority: "High",
      nextRunTime: "N/A",
      stopAfter: "N/A",
    },
    {
      key: "t5",
      name: "automation file",
      status: "Online",
      triggerDetails: "N/A",
      priority: "High",
      nextRunTime: "N/A",
      stopAfter: "N/A",
    },
  ]);

  const filteredTriggers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return triggers.filter((t) => {
      if (!q) return true;
      return t.name.toLowerCase().includes(q);
    });
  }, [triggers, query]);

  const triggerColumns: ColumnsType<TriggerRow> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 220,
      render: (v: string, record) => (
        <div className="flex items-center gap-2">
          <span
            className={
              "inline-block h-2 w-2 rounded-full " +
              (record.status === "Online" ? "bg-green-500" : "bg-gray-400")
            }
          />
          <span className="text-sm text-gray-800">{v}</span>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (v: TriggerStatus) => onlineTag(v),
    },
    {
      title: "Trigger Details",
      dataIndex: "triggerDetails",
      key: "triggerDetails",
      width: 170,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Job Priority",
      dataIndex: "priority",
      key: "priority",
      width: 140,
      render: (v: JobPriority) => priorityBadge(v),
    },
    {
      title: "Next Run Time",
      dataIndex: "nextRunTime",
      key: "nextRunTime",
      width: 170,
      render: (v: string) => <span className="text-xs text-gray-600">{v}</span>,
    },
    {
      title: "Stop After",
      dataIndex: "stopAfter",
      key: "stopAfter",
      width: 120,
      render: (v: string) => <span className="text-xs text-gray-600">{v}</span>,
    },
    {
      title: "Action",
      key: "action",
      width: 160,
      fixed: "right",
      render: (_: unknown, record) => {
        const isOnline = record.status === "Online";
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="small"
              className={
                "!rounded-lg " +
                (isOnline
                  ? "!border-red-200 !text-red-600"
                  : "!border-green-200 !text-green-700")
              }
              onClick={() => {
                setTriggers((prev) =>
                  prev.map((t) =>
                    t.key === record.key
                      ? { ...t, status: t.status === "Online" ? "Offline" : "Online" }
                      : t
                  )
                );
                message.success(isOnline ? "Disabled" : "Enabled");
              }}
            >
              {isOnline ? "Disable" : "Enable"}
            </Button>
            <Button
              size="small"
              className="!rounded-lg"
              icon={<DeleteOutlined />}
              onClick={() => setTriggers((prev) => prev.filter((t) => t.key !== record.key))}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  const columns: ColumnsType<JobRow> = [
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 140,
      render: (v: JobRow["type"]) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Hostname",
      dataIndex: "hostname",
      key: "hostname",
      width: 260,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (v: JobStatus) => statusTag(v),
    },
    {
      title: "Job Priority",
      dataIndex: "priority",
      key: "priority",
      width: 140,
      render: (v: JobPriority) => priorityBadge(v),
    },
    {
      title: "Started",
      dataIndex: "started",
      key: "started",
      width: 120,
      render: (v: string) => <span className="text-xs text-gray-600">{v}</span>,
    },
    {
      title: "Ended",
      dataIndex: "ended",
      key: "ended",
      width: 120,
      render: (v: string) => <span className="text-xs text-gray-600">{v}</span>,
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      fixed: "right",
      render: (_: unknown, record) => {
        const isStart = record.action === "Start";
        return (
          <Button
            size="small"
            className={
              "!rounded-lg " +
              (isStart
                ? "!border-green-200 !text-green-700"
                : "!border-red-200 !text-red-600")
            }
            icon={isStart ? <PlayCircleOutlined /> : <StopOutlined />}
            onClick={() => message.info(`${record.action} job (${record.type}) (mock)`)}
          >
            {record.action}
          </Button>
        );
      },
    },
  ];

  const tabButtonClass = (on: boolean) =>
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors border " +
    (on ? "bg-white text-gray-900 border-gray-200 shadow-sm" : "bg-transparent text-gray-600 border-transparent hover:bg-white");

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Robot Automation</h1>
              <p className="text-sm text-gray-500">Control room platform for automation tasks and triggers</p>
            </div>
            <div className="flex items-center gap-2">
              <Button className="!rounded-lg" icon={<DownloadOutlined />} onClick={() => message.info("Export (mock)")}>
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-2 w-fit">
          <button type="button" className={tabButtonClass(activeTab === "jobs")} onClick={() => setActiveTab("jobs")}>
            Jobs
          </button>
          <button type="button" className={tabButtonClass(activeTab === "triggers")} onClick={() => setActiveTab("triggers")}>
            Triggers
          </button>
        </div>

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <Input
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder={activeTab === "triggers" ? "Search by Name" : "Search by Type or Hostname"}
            className="!rounded-lg md:max-w-xl"
          />

          <div className="flex items-center gap-2">
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              options={["All Types", "Production", "Testing", "Development"].map((v) => ({ label: v, value: v }))}
              className="!rounded-lg"
              style={{ width: 160 }}
            />
            {activeTab === "triggers" && (
              <Button
                type="primary"
                className="!rounded-lg"
                icon={<EditOutlined />}
                onClick={() => message.info("Clicking 'Add Trigger' will redirect to the Control Room platform. (mock)")}
              >
                Add Trigger
              </Button>
            )}
          </div>
        </div>

        {activeTab === "triggers" ? (
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-end">
              <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <BulbOutlined />
                <span>
                  Clicking <span className="font-semibold">&quot;Add Trigger&quot;</span> will redirect to the Control Room platform.
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100">
              <Table<TriggerRow>
                columns={triggerColumns}
                dataSource={filteredTriggers}
                rowKey="key"
                size="middle"
                pagination={false}
                scroll={{ x: "max-content" }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
            <Table<JobRow>
              columns={columns}
              dataSource={filtered}
              rowKey="key"
              size="middle"
              pagination={false}
              scroll={{ x: "max-content" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
