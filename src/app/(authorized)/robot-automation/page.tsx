"use client";

import { useMemo, useState } from "react";
import { Button, Input, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  useGetAutomationJobsQuery,
  useGetAutomationProcessesQuery,
  useRunAutomationProcessMutation,
  useStopAutomationProcessMutation,
  type AutomationJob,
  type AutomationProcess,
} from "@/lib/api/automation/api";

type TabKey = "jobs" | "processes";

const statusColor = (status?: string) => {
  const s = (status ?? "").toLowerCase();
  if (s.includes("progress") || s.includes("running")) return "green";
  if (s.includes("complete") || s.includes("success")) return "blue";
  if (s.includes("fail") || s.includes("error")) return "red";
  if (s.includes("terminat") || s.includes("stop")) return "orange";
  return "default";
};

export default function RobotAutomationPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("jobs");
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");

  const {
    data: jobs = [],
    isFetching: jobsLoading,
    refetch: refetchJobs,
  } = useGetAutomationJobsQuery({ page: 1, limit: 50 });

  const {
    data: processes = [],
    isFetching: processesLoading,
    refetch: refetchProcesses,
  } = useGetAutomationProcessesQuery({ page: 1, limit: 50 });

  const [runProcess, { isLoading: running }] = useRunAutomationProcessMutation();
  const [stopProcess, { isLoading: stopping }] = useStopAutomationProcessMutation();

  const handleRun = async (id: string, name?: string) => {
    try {
      await runProcess({ id }).unwrap();
      message.success(`Automation "${name ?? id}" dijalankan`);
      refetchJobs();
    } catch (e) {
      message.error("Gagal menjalankan automation");
    }
  };

  const handleStop = async (id: string, name?: string) => {
    try {
      await stopProcess({ id }).unwrap();
      message.success(`Automation "${name ?? id}" dihentikan`);
      refetchJobs();
    } catch (e) {
      message.error("Gagal menghentikan automation");
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      const matchesQuery =
        !query ||
        (j.processName ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (j.robotName ?? "").toLowerCase().includes(query.toLowerCase());
      const matchesPriority =
        priorityFilter === "All" ||
        (j.priority ?? "").toLowerCase() === priorityFilter.toLowerCase();
      return matchesQuery && matchesPriority;
    });
  }, [jobs, query, priorityFilter]);

  const filteredProcesses = useMemo(() => {
    return processes.filter(
      (p) => !query || p.name.toLowerCase().includes(query.toLowerCase()),
    );
  }, [processes, query]);

  const jobColumns: ColumnsType<AutomationJob> = [
    { title: "Process", dataIndex: "processName", key: "processName", render: (v) => v ?? "-" },
    { title: "Robot / Host", dataIndex: "robotName", key: "robotName", render: (v) => v ?? "Cloud Robot" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v) => <Tag color={statusColor(v)}>{v ?? "Unknown"}</Tag>,
    },
    { title: "Priority", dataIndex: "priority", key: "priority", render: (v) => v ?? "-" },
    { title: "Started", dataIndex: "startedAt", key: "startedAt", render: (v) => v ?? "-" },
    { title: "Ended", dataIndex: "endedAt", key: "endedAt", render: (v) => v ?? "-" },
  ];

  const processColumns: ColumnsType<AutomationProcess> = [
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Mode", dataIndex: "executionMode", key: "executionMode", render: (v) => v ?? "-" },
    { title: "Robot", dataIndex: "robotName", key: "robotName", render: (v) => v ?? "-" },
    { title: "Folder", dataIndex: "folderName", key: "folderName", render: (v) => v ?? "-" },
    { title: "Priority", dataIndex: "priority", key: "priority", render: (v) => v ?? "-" },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            loading={running}
            disabled={!record.id}
            onClick={() => handleRun(record.id, record.name)}
          >
            Run
          </Button>
          <Button
            danger
            size="small"
            icon={<StopOutlined />}
            loading={stopping}
            disabled={!record.id}
            onClick={() => handleStop(record.id, record.name)}
          >
            Stop
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Robot Automation</h1>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            refetchJobs();
            refetchProcesses();
          }}
        >
          Refresh
        </Button>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            activeTab === "jobs" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
          onClick={() => setActiveTab("jobs")}
        >
          Jobs
        </button>
        <button
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            activeTab === "processes" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
          onClick={() => setActiveTab("processes")}
        >
          Processes
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Cari process / robot..."
          className="max-w-xs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {activeTab === "jobs" && (
          <Select
            value={priorityFilter}
            onChange={setPriorityFilter}
            className="w-40"
            options={[
              { value: "All", label: "All Priorities" },
              { value: "Low", label: "Low" },
              { value: "Medium", label: "Medium" },
              { value: "High", label: "High" },
            ]}
          />
        )}
      </div>

      {activeTab === "jobs" ? (
        <Table
          rowKey={(r) => r.id || Math.random().toString(36)}
          columns={jobColumns}
          dataSource={filteredJobs}
          loading={jobsLoading}
          pagination={{ pageSize: 10 }}
        />
      ) : (
        <Table
          rowKey={(r) => r.id || Math.random().toString(36)}
          columns={processColumns}
          dataSource={filteredProcesses}
          loading={processesLoading}
          pagination={{ pageSize: 10 }}
        />
      )}
    </div>
  );
}
