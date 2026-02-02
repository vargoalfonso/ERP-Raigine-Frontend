"use client";

import React, { useMemo, useState } from "react";
import StatsCard from "@/components/StatsCard";
import { Button, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";

type ProductionViewId =
  | "finished-goods"
  | "wip"
  | "output-per-machine"
  | "summary-stroke"
  | "runtime"
  | "issues"
  | "incoming-tasks";

type FinishedGoodsRow = {
  key: string;
  reportDate: string;
  uniq: string;
  productName: string;
  shift: string;
  woNumber: string;
  fgOutput: number;
  ngSetting: number;
  ngProcess: number;
  rework: number;
  scrap: number;
};

type WipRow = {
  key: string;
  reportDate: string;
  uniq: string;
  productName: string;
  shift: string;
  processName: string;
  woNumber: string;
  wipOutput: number;
  ngSetting: number;
  ngProcess: number;
  rework: number;
  scrap: number;
};

type OutputPerMachineRow = {
  key: string;
  reportDate: string;
  lineProcess: string;
  machineName: string;
  uniq: string;
  shift: string;
  woNumber: string;
  productOutput: number;
  ngSetting: number;
  ngProcess: number;
  rework: number;
  scrap: number;
};

type SummaryStrokeRow = {
  key: string;
  reportDate: string;
  productionLine: string;
  stroke: number;
  productionOutput: number;
  machineTimeMin: number;
  dandoriTimeMin: number;
  setQcTimeMin: number;
};

type RuntimeRow = {
  key: string;
  reportDate: string;
  woNumber: string;
  productionLine: string;
  machineNumber: string;
  totalMachineTimeMin: number;
  dandoriTimeMin: number;
  setQcTimeMin: number;
};

type IssueType = "Machine Breakdown" | "Material Shortage";

type IssuesRow = {
  key: string;
  reportDate: string;
  woNumber: string;
  productionLine: string;
  machineNumber: string;
  issue: IssueType;
  timeSpentMin: number;
};

type TaskPriority = "High" | "Medium";
type TaskStatus = "Pending" | "In Progress";
type TaskType = "Additional" | "Assembly";

type IncomingTaskRow = {
  key: string;
  taskDate: string;
  woNumber: string;
  productName: string;
  woType: TaskType;
  aging: string;
  targetQty: number;
  priority: TaskPriority;
  status: TaskStatus;
};

const views: Array<{ id: ProductionViewId; label: string; icon: React.ReactNode; activeIconBg: string }> = [
  {
    id: "finished-goods",
    label: "Finished Goods",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 16V8a2 2 0 00-1-1.732l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.732l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.27 6.96L12 12.01l8.73-5.05" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22.08V12" />
      </svg>
    ),
    activeIconBg: "bg-blue-100 text-blue-600",
  },
  {
    id: "wip",
    label: "WIP",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    ),
    activeIconBg: "bg-green-100 text-green-600",
  },
  {
    id: "output-per-machine",
    label: "Output Per Machine",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 17v-2a4 4 0 014-4h2a4 4 0 014 4v2M7 7h10M6 21h12"
        />
      </svg>
    ),
    activeIconBg: "bg-purple-100 text-purple-600",
  },
  {
    id: "summary-stroke",
    label: "Summary Stroke",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h13" />
      </svg>
    ),
    activeIconBg: "bg-cyan-100 text-cyan-600",
  },
  {
    id: "runtime",
    label: "Runtime",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22a10 10 0 110-20 10 10 0 010 20z" />
      </svg>
    ),
    activeIconBg: "bg-pink-100 text-pink-600",
  },
  {
    id: "issues",
    label: "Issues",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
    ),
    activeIconBg: "bg-red-100 text-red-600",
  },
  {
    id: "incoming-tasks",
    label: "Incoming Tasks",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10M7 17h6" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
      </svg>
    ),
    activeIconBg: "bg-indigo-100 text-indigo-600",
  },
];

const finishedGoodsData: FinishedGoodsRow[] = [
  {
    key: "1",
    reportDate: "10/1/2025",
    uniq: "LV7-001",
    productName: "Bracket Assembly",
    shift: "Shift 1",
    woNumber: "WO-FG-001",
    fgOutput: 500,
    ngSetting: 5,
    ngProcess: 3,
    rework: 2,
    scrap: 1,
  },
];

const wipData: WipRow[] = [
  {
    key: "1",
    reportDate: "10/1/2025",
    uniq: "CR-002",
    productName: "Suspension Arm",
    shift: "Shift 2",
    processName: "Pressing",
    woNumber: "WO-WIP-002",
    wipOutput: 300,
    ngSetting: 8,
    ngProcess: 4,
    rework: 3,
    scrap: 2,
  },
];

const outputPerMachineData: OutputPerMachineRow[] = [
  {
    key: "1",
    reportDate: "10/1/2025",
    lineProcess: "Line A",
    machineName: "Press Machine A1",
    uniq: "CR-002",
    shift: "Shift 2",
    woNumber: "WO-WIP-002",
    productOutput: 300,
    ngSetting: 8,
    ngProcess: 4,
    rework: 3,
    scrap: 2,
  },
];

const summaryStrokeData: SummaryStrokeRow[] = [
  {
    key: "1",
    reportDate: "10/1/2025",
    productionLine: "Line A",
    stroke: 5000,
    productionOutput: 4800,
    machineTimeMin: 480,
    dandoriTimeMin: 30,
    setQcTimeMin: 15,
  },
  {
    key: "2",
    reportDate: "10/1/2025",
    productionLine: "Line B",
    stroke: 4500,
    productionOutput: 4200,
    machineTimeMin: 450,
    dandoriTimeMin: 25,
    setQcTimeMin: 12,
  },
];

const runtimeData: RuntimeRow[] = [
  {
    key: "1",
    reportDate: "10/1/2025",
    woNumber: "WO-001",
    productionLine: "Line A",
    machineNumber: "MCH-4",
    totalMachineTimeMin: 480,
    dandoriTimeMin: 30,
    setQcTimeMin: 15,
  },
  {
    key: "2",
    reportDate: "10/1/2025",
    woNumber: "WO-001",
    productionLine: "Line B",
    machineNumber: "MCH-3",
    totalMachineTimeMin: 450,
    dandoriTimeMin: 25,
    setQcTimeMin: 12,
  },
];

const initialIssuesData: IssuesRow[] = [
  {
    key: "1",
    reportDate: "10/1/2025",
    woNumber: "WO-001",
    productionLine: "Line A",
    machineNumber: "Press Machine A1",
    issue: "Machine Breakdown",
    timeSpentMin: 45,
  },
  {
    key: "2",
    reportDate: "10/1/2025",
    woNumber: "WO-003",
    productionLine: "Line B",
    machineNumber: "Welding Machine B2",
    issue: "Material Shortage",
    timeSpentMin: 30,
  },
];

const initialIncomingTasksData: IncomingTaskRow[] = [
  {
    key: "1",
    taskDate: "10/2/2025",
    woNumber: "WO-005",
    productName: "Control Arm",
    woType: "Additional",
    aging: "2 days",
    targetQty: 1000,
    priority: "High",
    status: "Pending",
  },
  {
    key: "2",
    taskDate: "10/2/2025",
    woNumber: "WO-006",
    productName: "Bracket Assembly",
    woType: "Assembly",
    aging: "5 days",
    targetQty: 500,
    priority: "Medium",
    status: "In Progress",
  },
];

export default function ProductionDashboardPage() {
  const [selectedView, setSelectedView] = useState<ProductionViewId>("finished-goods");
  const [search, setSearch] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [lineFilter, setLineFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [issuesRows, setIssuesRows] = useState<IssuesRow[]>(initialIssuesData);
  const [isIssuesModalOpen, setIsIssuesModalOpen] = useState(false);
  const [editingIssueKey, setEditingIssueKey] = useState<string | null>(null);
  const [issuesForm] = Form.useForm<{
    woNumber: string;
    productionLine: string;
    machineNumber: string;
    issue: IssueType;
    timeSpentMin: number;
    reportDate: string;
  }>();

  const openCreateIssue = () => {
    setEditingIssueKey(null);
    issuesForm.resetFields();
    issuesForm.setFieldsValue({
      woNumber: "WO-1234",
      productionLine: "Line A - Prod",
      machineNumber: "Press Machine A1",
      issue: "Machine Breakdown",
      timeSpentMin: 0,
      reportDate: "",
    });
    setIsIssuesModalOpen(true);
  };

  const openEditIssue = (row: IssuesRow) => {
    setEditingIssueKey(row.key);
    issuesForm.setFieldsValue({
      woNumber: row.woNumber,
      productionLine: row.productionLine,
      machineNumber: row.machineNumber,
      issue: row.issue,
      timeSpentMin: row.timeSpentMin,
      reportDate: row.reportDate,
    });
    setIsIssuesModalOpen(true);
  };

  const closeIssuesModal = () => {
    setIsIssuesModalOpen(false);
  };

  const onSubmitIssue = async () => {
    const values = await issuesForm.validateFields();

    if (editingIssueKey) {
      setIssuesRows((prev) =>
        prev.map((r) =>
          r.key === editingIssueKey
            ? {
                ...r,
                woNumber: values.woNumber,
                productionLine: values.productionLine,
                machineNumber: values.machineNumber,
                issue: values.issue,
                timeSpentMin: values.timeSpentMin,
                reportDate: values.reportDate,
              }
            : r
        )
      );
      message.success("Issue updated");
    } else {
      const nextKey = `${Date.now()}`;
      setIssuesRows((prev) => [
        ...prev,
        {
          key: nextKey,
          woNumber: values.woNumber,
          productionLine: values.productionLine,
          machineNumber: values.machineNumber,
          issue: values.issue,
          timeSpentMin: values.timeSpentMin,
          reportDate: values.reportDate,
        },
      ]);
      message.success("Issue created");
    }

    closeIssuesModal();
  };

  const [incomingTasksRows, setIncomingTasksRows] = useState<IncomingTaskRow[]>(initialIncomingTasksData);
  const [isIncomingTasksDrawerOpen, setIsIncomingTasksDrawerOpen] = useState(false);
  const [editingIncomingTaskKey, setEditingIncomingTaskKey] = useState<string | null>(null);
  const [incomingTasksForm] = Form.useForm<{
    taskDate: string;
    woNumber: string;
    productName: string;
    woType: TaskType;
    aging: string;
    targetQty: number;
    priority: TaskPriority;
    status: TaskStatus;
  }>();

  const openCreateIncomingTask = () => {
    setEditingIncomingTaskKey(null);
    incomingTasksForm.resetFields();
    incomingTasksForm.setFieldsValue({
      taskDate: "",
      woNumber: "WO-005",
      productName: "",
      woType: "Additional",
      aging: "",
      targetQty: 0,
      priority: "High",
      status: "Pending",
    });
    setIsIncomingTasksDrawerOpen(true);
  };

  const openEditIncomingTask = (row: IncomingTaskRow) => {
    setEditingIncomingTaskKey(row.key);
    incomingTasksForm.setFieldsValue({
      taskDate: row.taskDate,
      woNumber: row.woNumber,
      productName: row.productName,
      woType: row.woType,
      aging: row.aging,
      targetQty: row.targetQty,
      priority: row.priority,
      status: row.status,
    });
    setIsIncomingTasksDrawerOpen(true);
  };

  const closeIncomingTasksDrawer = () => {
    setIsIncomingTasksDrawerOpen(false);
  };

  const onSubmitIncomingTask = async () => {
    const values = await incomingTasksForm.validateFields();

    if (editingIncomingTaskKey) {
      setIncomingTasksRows((prev) =>
        prev.map((r) =>
          r.key === editingIncomingTaskKey
            ? {
                ...r,
                taskDate: values.taskDate,
                woNumber: values.woNumber,
                productName: values.productName,
                woType: values.woType,
                aging: values.aging,
                targetQty: values.targetQty,
                priority: values.priority,
                status: values.status,
              }
            : r
        )
      );
      message.success("Task updated");
    } else {
      const nextKey = `${Date.now()}`;
      setIncomingTasksRows((prev) => [
        ...prev,
        {
          key: nextKey,
          taskDate: values.taskDate,
          woNumber: values.woNumber,
          productName: values.productName,
          woType: values.woType,
          aging: values.aging,
          targetQty: values.targetQty,
          priority: values.priority,
          status: values.status,
        },
      ]);
      message.success("Task created");
    }

    closeIncomingTasksDrawer();
  };

  const selectedViewLabel = useMemo(
    () => views.find((v) => v.id === selectedView)?.label ?? "Finished Goods",
    [selectedView]
  );

  const filteredFinishedGoods = useMemo(() => {
    const q = search.trim().toLowerCase();

    return finishedGoodsData.filter((row) => {
      const matchesQuery =
        !q ||
        row.uniq.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q) ||
        row.woNumber.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : true;
      const matchesShift = shiftFilter === "all" ? true : row.shift === shiftFilter;

      return matchesQuery && matchesDate && matchesShift;
    });
  }, [search, dateFilter, shiftFilter]);

  const filteredWip = useMemo(() => {
    const q = search.trim().toLowerCase();

    return wipData.filter((row) => {
      const matchesQuery =
        !q ||
        row.uniq.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q) ||
        row.woNumber.toLowerCase().includes(q) ||
        row.processName.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : true;
      const matchesShift = shiftFilter === "all" ? true : row.shift === shiftFilter;

      return matchesQuery && matchesDate && matchesShift;
    });
  }, [search, dateFilter, shiftFilter]);

  const filteredOutputPerMachine = useMemo(() => {
    const q = search.trim().toLowerCase();

    return outputPerMachineData.filter((row) => {
      const matchesQuery =
        !q ||
        row.uniq.toLowerCase().includes(q) ||
        row.machineName.toLowerCase().includes(q) ||
        row.lineProcess.toLowerCase().includes(q) ||
        row.woNumber.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : true;
      const matchesShift = shiftFilter === "all" ? true : row.shift === shiftFilter;

      return matchesQuery && matchesDate && matchesShift;
    });
  }, [search, dateFilter, shiftFilter]);

  const filteredSummaryStroke = useMemo(() => {
    const q = search.trim().toLowerCase();

    return summaryStrokeData.filter((row) => {
      const matchesQuery =
        !q || row.productionLine.toLowerCase().includes(q) || row.reportDate.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : true;
      const matchesLine = lineFilter === "all" ? true : row.productionLine === lineFilter;

      return matchesQuery && matchesDate && matchesLine;
    });
  }, [search, dateFilter, lineFilter]);

  const filteredRuntime = useMemo(() => {
    const q = search.trim().toLowerCase();

    return runtimeData.filter((row) => {
      const matchesQuery =
        !q ||
        row.woNumber.toLowerCase().includes(q) ||
        row.productionLine.toLowerCase().includes(q) ||
        row.machineNumber.toLowerCase().includes(q) ||
        row.reportDate.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : true;
      const matchesLine = lineFilter === "all" ? true : row.productionLine === lineFilter;

      return matchesQuery && matchesDate && matchesLine;
    });
  }, [search, dateFilter, lineFilter]);

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();

    return issuesRows.filter((row) => {
      const matchesQuery =
        !q ||
        row.woNumber.toLowerCase().includes(q) ||
        row.productionLine.toLowerCase().includes(q) ||
        row.machineNumber.toLowerCase().includes(q) ||
        row.issue.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : true;
      const matchesLine = lineFilter === "all" ? true : row.productionLine === lineFilter;

      return matchesQuery && matchesDate && matchesLine;
    });
  }, [issuesRows, search, dateFilter, lineFilter]);

  const filteredIncomingTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return incomingTasksRows.filter((row) => {
      const matchesQuery =
        !q ||
        row.woNumber.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q) ||
        row.taskDate.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : true;
      const matchesType = typeFilter === "all" ? true : row.woType === typeFilter;

      return matchesQuery && matchesDate && matchesType;
    });
  }, [incomingTasksRows, search, dateFilter, typeFilter]);

  const finishedGoodsColumns: ColumnsType<FinishedGoodsRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
    },
    { title: "Product Name", dataIndex: "productName", key: "productName" },
    {
      title: "Shift",
      dataIndex: "shift",
      key: "shift",
      render: (v: string) => (
        <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">{v}</Tag>
      ),
    },
    { title: "WO Number", dataIndex: "woNumber", key: "woNumber" },
    {
      title: "FG Output",
      dataIndex: "fgOutput",
      key: "fgOutput",
      render: (v: number) => <span className="text-green-600 font-semibold">{v}</span>,
    },
    {
      title: "NG Setting",
      dataIndex: "ngSetting",
      key: "ngSetting",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "NG Process",
      dataIndex: "ngProcess",
      key: "ngProcess",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "Rework",
      dataIndex: "rework",
      key: "rework",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    { title: "Scrap", dataIndex: "scrap", key: "scrap" },
  ];

  const wipColumns: ColumnsType<WipRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
    },
    { title: "Product Name", dataIndex: "productName", key: "productName" },
    {
      title: "Shift",
      dataIndex: "shift",
      key: "shift",
      render: (v: string) => (
        <Tag className="rounded-full bg-green-50 text-green-700 border border-green-100">{v}</Tag>
      ),
    },
    { title: "Process Name", dataIndex: "processName", key: "processName" },
    { title: "WO Number", dataIndex: "woNumber", key: "woNumber" },
    {
      title: "WIP Output",
      dataIndex: "wipOutput",
      key: "wipOutput",
      render: (v: number) => <span className="text-green-600 font-semibold">{v}</span>,
    },
    {
      title: "NG Setting",
      dataIndex: "ngSetting",
      key: "ngSetting",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "NG Process",
      dataIndex: "ngProcess",
      key: "ngProcess",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "Rework",
      dataIndex: "rework",
      key: "rework",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    { title: "Scrap", dataIndex: "scrap", key: "scrap" },
  ];

  const outputPerMachineColumns: ColumnsType<OutputPerMachineRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    { title: "Line Process", dataIndex: "lineProcess", key: "lineProcess" },
    { title: "Machine Name", dataIndex: "machineName", key: "machineName" },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
    },
    {
      title: "Shift",
      dataIndex: "shift",
      key: "shift",
      render: (v: string) => (
        <Tag className="rounded-full bg-green-50 text-green-700 border border-green-100">{v}</Tag>
      ),
    },
    { title: "WO Number", dataIndex: "woNumber", key: "woNumber" },
    {
      title: "Product Output",
      dataIndex: "productOutput",
      key: "productOutput",
      render: (v: number) => <span className="text-green-600 font-semibold">{v}</span>,
    },
    {
      title: "NG Setting",
      dataIndex: "ngSetting",
      key: "ngSetting",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "NG Process",
      dataIndex: "ngProcess",
      key: "ngProcess",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "Rework",
      dataIndex: "rework",
      key: "rework",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    { title: "Scrap", dataIndex: "scrap", key: "scrap" },
  ];

  const summaryStrokeColumns: ColumnsType<SummaryStrokeRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    { title: "Production Line", dataIndex: "productionLine", key: "productionLine" },
    {
      title: "Stroke",
      dataIndex: "stroke",
      key: "stroke",
      render: (v: number) => Intl.NumberFormat("en-US").format(v),
    },
    {
      title: "Production Output",
      dataIndex: "productionOutput",
      key: "productionOutput",
      render: (v: number) => (
        <span className="text-green-600 font-semibold">{Intl.NumberFormat("en-US").format(v)}</span>
      ),
    },
    {
      title: "Machine Time (min)",
      dataIndex: "machineTimeMin",
      key: "machineTimeMin",
      render: (v: number) => Intl.NumberFormat("en-US").format(v),
    },
    {
      title: "Dandori Time (min)",
      dataIndex: "dandoriTimeMin",
      key: "dandoriTimeMin",
      render: (v: number) => <span className="text-orange-600">{Intl.NumberFormat("en-US").format(v)}</span>,
    },
    {
      title: "Set QC Time (min)",
      dataIndex: "setQcTimeMin",
      key: "setQcTimeMin",
      render: (v: number) => <span className="text-blue-600">{Intl.NumberFormat("en-US").format(v)}</span>,
    },
  ];

  const runtimeColumns: ColumnsType<RuntimeRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    { title: "WO Number", dataIndex: "woNumber", key: "woNumber" },
    { title: "Production Line", dataIndex: "productionLine", key: "productionLine" },
    { title: "Machine Number", dataIndex: "machineNumber", key: "machineNumber" },
    {
      title: "Total Machine Time (min)",
      dataIndex: "totalMachineTimeMin",
      key: "totalMachineTimeMin",
      render: (v: number) => Intl.NumberFormat("en-US").format(v),
    },
    {
      title: "Dandori Time (min)",
      dataIndex: "dandoriTimeMin",
      key: "dandoriTimeMin",
      render: (v: number) => <span className="text-orange-600">{Intl.NumberFormat("en-US").format(v)}</span>,
    },
    {
      title: "Set QC Time (min)",
      dataIndex: "setQcTimeMin",
      key: "setQcTimeMin",
      render: (v: number) => <span className="text-blue-600">{Intl.NumberFormat("en-US").format(v)}</span>,
    },
  ];

  const issuesColumns: ColumnsType<IssuesRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    { title: "WO Number", dataIndex: "woNumber", key: "woNumber" },
    { title: "Production Line", dataIndex: "productionLine", key: "productionLine" },
    { title: "Machine Number", dataIndex: "machineNumber", key: "machineNumber" },
    {
      title: "Issue",
      dataIndex: "issue",
      key: "issue",
      render: (v: IssueType) => (
        <Tag className="rounded-full bg-red-50 text-red-700 border border-red-100">{v}</Tag>
      ),
    },
    {
      title: "Time Spent (min)",
      dataIndex: "timeSpentMin",
      key: "timeSpentMin",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record) => (
        <Space size={10}>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-800"
            onClick={() => openEditIssue(record)}
            aria-label="Edit"
          >
            <EditOutlined />
          </button>
          <Popconfirm
            title="Delete this issue?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => setIssuesRows((prev) => prev.filter((r) => r.key !== record.key))}
          >
            <button type="button" className="text-red-500 hover:text-red-700" aria-label="Delete">
              <DeleteOutlined />
            </button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const incomingTasksColumns: ColumnsType<IncomingTaskRow> = [
    { title: "Task Date", dataIndex: "taskDate", key: "taskDate" },
    { title: "WO Number", dataIndex: "woNumber", key: "woNumber" },
    { title: "Product Name", dataIndex: "productName", key: "productName" },
    { title: "WO Type", dataIndex: "woType", key: "woType" },
    { title: "Aging", dataIndex: "aging", key: "aging" },
    {
      title: "Target Qty",
      dataIndex: "targetQty",
      key: "targetQty",
      render: (v: number) => <span className="text-blue-600">{v.toLocaleString()}</span>,
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (v: TaskPriority) => (
        <Tag
          className={
            v === "High"
              ? "rounded-md bg-red-50 text-red-700 border border-red-100"
              : "rounded-md bg-orange-50 text-orange-700 border border-orange-100"
          }
        >
          {v}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: TaskStatus) => (
        <Tag
          className={
            v === "Pending"
              ? "rounded-md bg-yellow-50 text-yellow-800 border border-yellow-100"
              : "rounded-md bg-blue-50 text-blue-700 border border-blue-100"
          }
        >
          {v}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record) => (
        <Space size={10}>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-800"
            onClick={() => openEditIncomingTask(record)}
            aria-label="Edit"
          >
            <EditOutlined />
          </button>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-800"
            onClick={() => {
              const nextKey = `${Date.now()}`;
              setIncomingTasksRows((prev) => [
                ...prev,
                {
                  ...record,
                  key: nextKey,
                },
              ]);
              message.success("Task duplicated");
            }}
            aria-label="Duplicate"
          >
            <CopyOutlined />
          </button>
          <Popconfirm
            title="Delete this task?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => setIncomingTasksRows((prev) => prev.filter((r) => r.key !== record.key))}
          >
            <button type="button" className="text-red-500 hover:text-red-700" aria-label="Delete">
              <DeleteOutlined />
            </button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tableConfig = useMemo(() => {
    if (selectedView === "wip") {
      return {
        // TS doesn't infer well across unions here; we pass to Table as unknown below.
        columns: wipColumns,
        data: filteredWip,
      };
    }

    if (selectedView === "output-per-machine") {
      return {
        columns: outputPerMachineColumns,
        data: filteredOutputPerMachine,
      };
    }

    if (selectedView === "summary-stroke") {
      return {
        columns: summaryStrokeColumns,
        data: filteredSummaryStroke,
      };
    }

    if (selectedView === "runtime") {
      return {
        columns: runtimeColumns,
        data: filteredRuntime,
      };
    }

    if (selectedView === "issues") {
      return {
        columns: issuesColumns,
        data: filteredIssues,
      };
    }

    if (selectedView === "incoming-tasks") {
      return {
        columns: incomingTasksColumns,
        data: filteredIncomingTasks,
      };
    }

    if (selectedView === "finished-goods") {
      return {
        columns: finishedGoodsColumns,
        data: filteredFinishedGoods,
      };
    }

    return {
      columns: finishedGoodsColumns,
      data: [],
    };
  }, [
    selectedView,
    wipColumns,
    filteredWip,
    outputPerMachineColumns,
    filteredOutputPerMachine,
    summaryStrokeColumns,
    filteredSummaryStroke,
    runtimeColumns,
    filteredRuntime,
    issuesColumns,
    filteredIssues,
    incomingTasksColumns,
    filteredIncomingTasks,
    finishedGoodsColumns,
    filteredFinishedGoods,
  ]);

  const cubeIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  const heartbeatIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l2 6 4-12 2 6h6" />
    </svg>
  );

  const warningIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01" />
    </svg>
  );

  const trendIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatsCard
          title="FG Output"
          value={500}
          subtitle=""
          icon={cubeIcon}
          bgColor="bg-blue-50"
          textColor="text-blue-600"
        />
        <StatsCard
          title="WIP Output"
          value={300}
          subtitle=""
          icon={heartbeatIcon}
          bgColor="bg-green-50"
          textColor="text-green-600"
        />
        <StatsCard
          title="Total NG"
          value={20}
          subtitle=""
          icon={warningIcon}
          bgColor="bg-red-50"
          textColor="text-red-600"
        />
        <StatsCard
          title="Total Rework"
          value={5}
          subtitle=""
          icon={trendIcon}
          bgColor="bg-orange-50"
          textColor="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="text-base font-semibold text-gray-900">Production Views</div>
              <div className="text-sm text-gray-500">8 data views</div>
            </div>

            <div className="py-2">
              {views.map((v) => {
                const isActive = v.id === selectedView;

                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedView(v.id)}
                    className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                      isActive ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isActive ? v.activeIconBg : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {v.icon}
                    </div>
                    <div className={`text-sm ${isActive ? "text-gray-900 font-medium" : "text-gray-700"}`}>
                      {v.label}
                    </div>

                    {isActive && <div className="ml-auto w-1 h-8 bg-blue-600 rounded-full" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-gray-900">{selectedViewLabel}</div>
                <div className="text-sm text-gray-500">View and manage production data</div>
              </div>
              <div className="flex items-center gap-2">
                <Button>
                  <span className="inline-flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export
                  </span>
                </Button>
                {selectedView === "issues" && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateIssue}>
                    Add New
                  </Button>
                )}
                {selectedView === "incoming-tasks" && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateIncomingTask}>
                    Add New
                  </Button>
                )}
              </div>
            </div>

            <div className="px-5 pb-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by Uniq, Product Name, or WO Number..."
                    prefix={
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                        />
                      </svg>
                    }
                    allowClear
                  />
                </div>

                <div className="flex items-center gap-3">
                  {(selectedView === "finished-goods" ||
                    selectedView === "summary-stroke" ||
                    selectedView === "runtime" ||
                    selectedView === "issues" ||
                    selectedView === "incoming-tasks") && (
                    <Select
                      value={dateFilter}
                      onChange={(v) => setDateFilter(v)}
                      options={[{ label: "All Date", value: "all" }]}
                      style={{ width: 140 }}
                    />
                  )}

                  {selectedView === "incoming-tasks" ? (
                    <Select
                      value={typeFilter}
                      onChange={(v) => setTypeFilter(v)}
                      options={[
                        { label: "All Type", value: "all" },
                        { label: "Additional", value: "Additional" },
                        { label: "Assembly", value: "Assembly" },
                      ]}
                      style={{ width: 140 }}
                    />
                  ) : (
                    <Select
                      value={
                        selectedView === "summary-stroke" || selectedView === "runtime" || selectedView === "issues"
                          ? lineFilter
                          : shiftFilter
                      }
                      onChange={(v) =>
                        selectedView === "summary-stroke" || selectedView === "runtime" || selectedView === "issues"
                          ? setLineFilter(v)
                          : setShiftFilter(v)
                      }
                      options={
                        selectedView === "summary-stroke" || selectedView === "runtime" || selectedView === "issues"
                          ? [
                              { label: "All Line", value: "all" },
                              { label: "Line A", value: "Line A" },
                              { label: "Line B", value: "Line B" },
                            ]
                          : [
                              { label: "All Shifts", value: "all" },
                              { label: "Shift 1", value: "Shift 1" },
                              { label: "Shift 2", value: "Shift 2" },
                            ]
                      }
                      style={{ width: 140 }}
                    />
                  )}
                </div>
              </div>
            </div>

            <Modal
              title={
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {editingIssueKey ? "Edit - Issues" : "Add New - Issues"}
                  </div>
                  <div className="text-xs text-gray-500">Create a new record</div>
                </div>
              }
              open={isIssuesModalOpen}
              onCancel={closeIssuesModal}
              centered
              destroyOnClose
              okText={editingIssueKey ? "Save" : "Create"}
              cancelText="Cancel"
              onOk={onSubmitIssue}
              width={560}
            >
              <Form form={issuesForm} layout="vertical">
                <Form.Item
                  name="woNumber"
                  label="Work Order Number"
                  rules={[{ required: true, message: "Work Order Number is required" }]}
                >
                  <Select
                    options={[
                      { label: "WO-1234", value: "WO-1234" },
                      { label: "WO-001", value: "WO-001" },
                      { label: "WO-003", value: "WO-003" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  name="productionLine"
                  label="Production Line"
                  rules={[{ required: true, message: "Production Line is required" }]}
                >
                  <Select
                    options={[
                      { label: "Line A - Prod", value: "Line A - Prod" },
                      { label: "Line A", value: "Line A" },
                      { label: "Line B", value: "Line B" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  name="machineNumber"
                  label="Machine"
                  rules={[{ required: true, message: "Machine is required" }]}
                >
                  <Select
                    options={[
                      { label: "Press Machine A1", value: "Press Machine A1" },
                      { label: "Welding Machine B2", value: "Welding Machine B2" },
                      { label: "MCH-4", value: "MCH-4" },
                      { label: "MCH-3", value: "MCH-3" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  name="issue"
                  label="Production Issue"
                  rules={[{ required: true, message: "Production Issue is required" }]}
                >
                  <Select
                    options={[
                      { label: "Machine Breakdown", value: "Machine Breakdown" },
                      { label: "Material Shortage", value: "Material Shortage" },
                      { label: "Machine Shortage", value: "Machine Shortage" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  name="timeSpentMin"
                  label="Time Spent"
                  rules={[{ required: true, message: "Time Spent is required" }]}
                >
                  <InputNumber className="w-full" placeholder="minutes" min={0} />
                </Form.Item>

                <Form.Item
                  name="reportDate"
                  label="Date"
                  rules={[{ required: true, message: "Date is required" }]}
                >
                  <Input placeholder="dd/mm/yyyy" />
                </Form.Item>
              </Form>
            </Modal>

            <Drawer
              title={
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {editingIncomingTaskKey ? "Edit - Incoming Tasks" : "Add New - Incoming Tasks"}
                  </div>
                  <div className="text-xs text-gray-500">Create a new record</div>
                </div>
              }
              open={isIncomingTasksDrawerOpen}
              onClose={closeIncomingTasksDrawer}
              width={420}
              destroyOnClose
              footer={
                <div className="flex items-center justify-end gap-2">
                  <Button onClick={closeIncomingTasksDrawer}>Cancel</Button>
                  <Button type="primary" onClick={onSubmitIncomingTask}>
                    {editingIncomingTaskKey ? "Save" : "Create"}
                  </Button>
                </div>
              }
            >
              <Form form={incomingTasksForm} layout="vertical">
                <Form.Item
                  name="taskDate"
                  label="Task Date"
                  rules={[{ required: true, message: "Task Date is required" }]}
                >
                  <Input placeholder="dd/mm/yyyy" />
                </Form.Item>

                <Form.Item
                  name="woNumber"
                  label="WO Number"
                  rules={[{ required: true, message: "WO Number is required" }]}
                >
                  <Select
                    options={[
                      { label: "WO-005", value: "WO-005" },
                      { label: "WO-006", value: "WO-006" },
                      { label: "WO-001", value: "WO-001" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  name="productName"
                  label="Product Name"
                  rules={[{ required: true, message: "Product Name is required" }]}
                >
                  <Input />
                </Form.Item>

                <Form.Item name="woType" label="WO Type" rules={[{ required: true, message: "WO Type is required" }]}>
                  <Select
                    options={[
                      { label: "Additional", value: "Additional" },
                      { label: "Assembly", value: "Assembly" },
                    ]}
                  />
                </Form.Item>

                <Form.Item name="aging" label="Aging" rules={[{ required: true, message: "Aging is required" }]}>
                  <Input placeholder="e.g. 2 days" />
                </Form.Item>

                <Form.Item
                  name="targetQty"
                  label="Target Qty"
                  rules={[{ required: true, message: "Target Qty is required" }]}
                >
                  <InputNumber className="w-full" min={0} />
                </Form.Item>

                <Form.Item
                  name="priority"
                  label="Priority"
                  rules={[{ required: true, message: "Priority is required" }]}
                >
                  <Select
                    options={[
                      { label: "High", value: "High" },
                      { label: "Medium", value: "Medium" },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  name="status"
                  label="Status"
                  rules={[{ required: true, message: "Status is required" }]}
                >
                  <Select
                    options={[
                      { label: "Pending", value: "Pending" },
                      { label: "In Progress", value: "In Progress" },
                    ]}
                  />
                </Form.Item>
              </Form>
            </Drawer>

            <div className="px-5 pb-5">
              <Table
                columns={tableConfig.columns as unknown as ColumnsType<object>}
                dataSource={tableConfig.data as unknown as object[]}
                pagination={false}
                bordered
                size="middle"
                scroll={{ x: "max-content" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
