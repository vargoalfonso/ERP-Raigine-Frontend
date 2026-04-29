"use client";

import React, { useMemo, useState } from "react";
import StatsCard from "@/components/StatsCard";
import { Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined, PrinterOutlined } from "@ant-design/icons";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import { type MachineRecord, useGetMachinesQuery } from "@/lib/api/machines/api";
import {
  type ProductionDashboardSummaryCards,
  useGetFinishedGoodsDashboardQuery,
  useGetOutputMachineDashboardQuery,
  useGetRuntimeDashboardQuery,
  useGetSummaryStrokeDashboardQuery,
  useGetWipDashboardQuery,
} from "@/lib/api/production-dashboard/api";
import { useGetWorkOrdersQuery } from "@/lib/api/work-orders/api";

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

type IssueType = "Machine Breakdown" | "Material Shortage" | "Machine Shortage" | "Quality Issue" | "Setup Delay" | "Other";

type IssuesRow = {
  key: string;
  reportDate: string;
  reportMonth: string;
  woNumber: string;
  productionLine: string;
  machineId: string;
  machineNumber: string;
  issue: IssueType;
  timeSpentMin: number;
  woId?: string;
};

type TaskPriority = "High" | "Medium";
type TaskStatus = "Pending" | "In Progress" | "Completed";
type TaskType = "Additional" | "Assembly" | "New" | "Rework";

type IncomingTaskRow = {
  key: string;
  taskDate: string;
  reportMonth: string;
  woNumber: string;
  productName: string;
  woType: TaskType;
  aging: string;
  targetQty: number;
  priority: TaskPriority;
  status: TaskStatus;
  completionWo: string;
  productionLine: string;
  machineNumber: string;
  woId?: string;
  kanbanNumbers: string[];
};

type DashboardSummaryCardItem = {
  title: string;
  value: number;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
};

const toNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toText = (value: unknown, fallback = "-"): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const formatDateCell = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatMonthCell = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
};

const deriveMonthLabel = (value: string): string => {
  const isoMonth = formatMonthCell(value);
  if (isoMonth !== "-") return isoMonth;

  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "-";
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
};

const parseDateValue = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const fallback = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const getTodayInputValue = (): string =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

const calculateAgingDays = (targetDate: string | undefined, createdAt: string | undefined): number | null => {
  const referenceDate = parseDateValue(targetDate) ?? parseDateValue(createdAt);
  if (!referenceDate) return null;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfReference = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diffMs = startOfToday.getTime() - startOfReference.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

const openPrintWindow = (title: string, body: string) => {
  if (typeof window === "undefined") return;
  const escapeHtml = (value: unknown): string =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!popup) {
    message.warning("Popup blocked. Izinkan popup untuk print.");
    return;
  }

  popup.document.write(`
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { font-size: 20px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        ${body}
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.addEventListener(
    "load",
    () => {
      popup.print();
    },
    { once: true }
  );
};

const emptySummaryCards: ProductionDashboardSummaryCards = {
  fg_output: 0,
  wip_output: 0,
  total_ng: 0,
  total_rework: 0,
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
    reportMonth: "October 2025",
    woNumber: "WO-001",
    productionLine: "Line A",
    machineId: "machine-1",
    machineNumber: "Press Machine A1",
    issue: "Machine Breakdown",
    timeSpentMin: 45,
  },
  {
    key: "2",
    reportDate: "10/1/2025",
    reportMonth: "October 2025",
    woNumber: "WO-003",
    productionLine: "Line B",
    machineId: "machine-2",
    machineNumber: "Welding Machine B2",
    issue: "Material Shortage",
    timeSpentMin: 30,
  },
];

const initialIncomingTasksData: IncomingTaskRow[] = [
  {
    key: "1",
    taskDate: "10/2/2025",
    reportMonth: "October 2025",
    woNumber: "WO-005",
    productName: "Control Arm",
    woType: "Additional",
    aging: "2 days",
    targetQty: 1000,
    priority: "High",
    status: "Pending",
    completionWo: "0%",
    productionLine: "Line A",
    machineNumber: "Press Machine A1",
    kanbanNumbers: [],
  },
  {
    key: "2",
    taskDate: "10/2/2025",
    reportMonth: "October 2025",
    woNumber: "WO-006",
    productName: "Bracket Assembly",
    woType: "Assembly",
    aging: "5 days",
    targetQty: 500,
    priority: "Medium",
    status: "In Progress",
    completionWo: "50%",
    productionLine: "Line B",
    machineNumber: "Welding Machine B2",
    kanbanNumbers: [],
  },
];

export default function ProductionDashboardPage() {
  const [selectedView, setSelectedView] = useState<ProductionViewId>("finished-goods");
  const [search, setSearch] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [lineFilter, setLineFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const apiEnabled = Boolean(apiBaseUrl);
  const fgDashboardQuery = useGetFinishedGoodsDashboardQuery(undefined, { skip: !apiEnabled });
  const wipDashboardQuery = useGetWipDashboardQuery(undefined, { skip: !apiEnabled });
  const outputMachineDashboardQuery = useGetOutputMachineDashboardQuery(undefined, { skip: !apiEnabled });
  const summaryStrokeDashboardQuery = useGetSummaryStrokeDashboardQuery(undefined, { skip: !apiEnabled });
  const runtimeDashboardQuery = useGetRuntimeDashboardQuery(undefined, { skip: !apiEnabled });
  const workOrdersQuery = useGetWorkOrdersQuery({ page: 1, limit: 200 }, { skip: !apiEnabled });
  const machinesQuery = useGetMachinesQuery(undefined, { skip: !apiEnabled });

  const workOrders = workOrdersQuery.data?.items ?? [];
  const machines = machinesQuery.data ?? [];

  const machinesById = useMemo(() => new Map(machines.map((machine) => [machine.id, machine])), [machines]);
  const firstMachineByProcess = useMemo(() => {
    const map = new Map<string, MachineRecord>();
    machines.forEach((machine) => {
      const process = toText(machine.process_name, "").toLowerCase();
      if (process && !map.has(process)) {
        map.set(process, machine);
      }
    });
    return map;
  }, [machines]);

  const fgSummaryCards = fgDashboardQuery.data?.data.summary_cards ?? emptySummaryCards;
  const wipSummaryCards = wipDashboardQuery.data?.data.summary_cards ?? fgSummaryCards;
  const outputSummaryCards = outputMachineDashboardQuery.data?.data.summary_cards ?? fgSummaryCards;
  const summaryStrokeCards = summaryStrokeDashboardQuery.data?.data.summary_cards ?? fgSummaryCards;
  const runtimeSummaryCards = runtimeDashboardQuery.data?.data.summary_cards ?? fgSummaryCards;

  const finishedGoodsRows = useMemo<FinishedGoodsRow[]>(() => {
    return (fgDashboardQuery.data?.data.table_data ?? []).map((row, index) => ({
      key: toText(row.id, String(index + 1)),
      reportDate: formatDateCell(row.report_date),
      uniq: toText(row.uniq),
      productName: toText(row.product_name, "Unknown Product"),
      shift: toText(row.shift, "-") ,
      woNumber: toText(row.wo_number),
      fgOutput: toNumber(row.fg_output),
      ngSetting: toNumber(row.ng_setting),
      ngProcess: toNumber(row.ng_process),
      rework: toNumber(row.rework),
      scrap: toNumber(row.scrap),
    }));
  }, [fgDashboardQuery.data?.data.table_data]);

  const wipRows = useMemo<WipRow[]>(() => {
    return (wipDashboardQuery.data?.data.table_data ?? []).map((row, index) => ({
      key: toText(row.id, String(index + 1)),
      reportDate: formatDateCell(row.report_date),
      uniq: toText(row.uniq),
      productName: toText(row.product_name, "Unknown Product"),
      shift: toText(row.shift, "-"),
      processName: toText(row.process_name),
      woNumber: toText(row.wo_number),
      wipOutput: toNumber(row.wip_output),
      ngSetting: toNumber(row.ng_setting),
      ngProcess: toNumber(row.ng_process),
      rework: toNumber(row.rework),
      scrap: toNumber(row.scrap),
    }));
  }, [wipDashboardQuery.data?.data.table_data]);

  const outputPerMachineRows = useMemo<OutputPerMachineRow[]>(() => {
    return (outputMachineDashboardQuery.data?.data.table_data ?? []).map((row, index) => ({
      key: toText(row.id, String(index + 1)),
      reportDate: formatDateCell(row.report_date),
      lineProcess: toText(row.line_process),
      machineName: toText(row.machine_name),
      uniq: toText(row.uniq),
      shift: toText(row.shift, "-"),
      woNumber: toText(row.wo_number),
      productOutput: toNumber(row.product_output),
      ngSetting: toNumber(row.ng_setting),
      ngProcess: toNumber(row.ng_process),
      rework: toNumber(row.rework),
      scrap: toNumber(row.scrap),
    }));
  }, [outputMachineDashboardQuery.data?.data.table_data]);

  const summaryStrokeRows = useMemo<SummaryStrokeRow[]>(() => {
    return (summaryStrokeDashboardQuery.data?.data.table_data ?? []).map((row, index) => ({
      key: toText(row.id, String(index + 1)),
      reportDate: formatDateCell(row.report_date),
      productionLine: toText(row.production_line),
      stroke: toNumber(row.stroke),
      productionOutput: toNumber(row.production_output),
      machineTimeMin: toNumber(row.machine_time_min),
      dandoriTimeMin: toNumber(row.dandori_time_min),
      setQcTimeMin: toNumber(row.set_qc_time_min),
    }));
  }, [summaryStrokeDashboardQuery.data?.data.table_data]);

  const runtimeRows = useMemo<RuntimeRow[]>(() => {
    return (runtimeDashboardQuery.data?.data.table_data ?? []).map((row, index) => ({
      key: toText(row.id, String(index + 1)),
      reportDate: formatDateCell(row.report_date),
      woNumber: toText(row.wo_number),
      productionLine: toText(row.production_line),
      machineNumber: toText(row.machine_number),
      totalMachineTimeMin: toNumber(row.total_machine_time_min),
      dandoriTimeMin: toNumber(row.dandori_time_min),
      setQcTimeMin: toNumber(row.set_qc_time_min),
    }));
  }, [runtimeDashboardQuery.data?.data.table_data]);

  const [issuesRows, setIssuesRows] = useState<IssuesRow[]>(initialIssuesData);
  const [isIssuesModalOpen, setIsIssuesModalOpen] = useState(false);
  const [editingIssueKey, setEditingIssueKey] = useState<string | null>(null);
  const [issuesForm] = Form.useForm<{
    woNumber: string;
    productionLine: string;
    machineId: string;
    issue: IssueType;
    timeSpentMin: number;
    reportDate: string;
  }>();

  const selectedIssueProductionLine = Form.useWatch("productionLine", issuesForm);

  const workOrderRelations = useMemo(() => {
    return new Map(
      workOrders.map((wo) => {
        const firstProcess = wo.items.find((item) => item.process_name)?.process_name?.trim().toLowerCase();
        const relatedMachine = firstProcess ? firstMachineByProcess.get(firstProcess) : undefined;

        return [
          wo.wo_number,
          {
            machineId: relatedMachine?.id ?? "",
            machineNumber: relatedMachine?.machine_number ?? "-",
            productionLine: relatedMachine?.production_line ?? "",
          },
        ] as const;
      })
    );
  }, [firstMachineByProcess, workOrders]);

  const workOrderOptions = useMemo(
    () =>
      workOrders
        .filter((wo) => wo.wo_number)
        .map((wo) => ({
          label: wo.wo_number,
          value: wo.wo_number,
        })),
    [workOrders]
  );

  const productionLineOptionsForIssues = useMemo(() => {
    const values = Array.from(new Set(machines.map((machine) => machine.production_line).filter(Boolean)));
    return values.map((value) => ({ label: value, value }));
  }, [machines]);

  const machineOptionsForIssues = useMemo(() => {
    const source = selectedIssueProductionLine
      ? machines.filter((machine) => machine.production_line === selectedIssueProductionLine)
      : machines;

    return source
      .filter((machine) => machine.id && machine.machine_number)
      .map((machine) => ({
        label: machine.machine_number,
        value: machine.id,
      }));
  }, [machines, selectedIssueProductionLine]);

  const issueTypeOptions: Array<{ label: string; value: IssueType }> = [
    { label: "Machine Breakdown", value: "Machine Breakdown" },
    { label: "Material Shortage", value: "Material Shortage" },
    { label: "Machine Shortage", value: "Machine Shortage" },
    { label: "Quality Issue", value: "Quality Issue" },
    { label: "Setup Delay", value: "Setup Delay" },
    { label: "Other", value: "Other" },
  ];

  const openCreateIssue = () => {
    setEditingIssueKey(null);
    issuesForm.resetFields();

    const defaultWoNumber = workOrderOptions[0]?.value ?? initialIssuesData[0]?.woNumber ?? "";
    const relatedWorkOrder = workOrderRelations.get(defaultWoNumber);
    const fallbackMachine = relatedWorkOrder?.machineId
      ? machinesById.get(relatedWorkOrder.machineId)
      : machines[0];

    issuesForm.setFieldsValue({
      woNumber: defaultWoNumber,
      productionLine: relatedWorkOrder?.productionLine ?? fallbackMachine?.production_line ?? "",
      machineId: relatedWorkOrder?.machineId ?? fallbackMachine?.id ?? "",
      issue: "Machine Breakdown",
      timeSpentMin: 0,
      reportDate: getTodayInputValue(),
    });
    setIsIssuesModalOpen(true);
  };

  const openEditIssue = (row: IssuesRow) => {
    setEditingIssueKey(row.key);
    issuesForm.setFieldsValue({
      woNumber: row.woNumber,
      productionLine: row.productionLine,
      machineId: row.machineId,
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
    const selectedMachine = machinesById.get(values.machineId);
    const reportMonth = deriveMonthLabel(values.reportDate);

    const nextRow: IssuesRow = {
      key: editingIssueKey ?? `${Date.now()}`,
      woNumber: values.woNumber,
      productionLine: values.productionLine,
      machineId: values.machineId,
      machineNumber: selectedMachine?.machine_number ?? "-",
      issue: values.issue,
      timeSpentMin: values.timeSpentMin,
      reportDate: values.reportDate,
      reportMonth,
    };

    if (editingIssueKey) {
      setIssuesRows((prev) => prev.map((row) => (row.key === editingIssueKey ? nextRow : row)));
      message.success("Issue updated");
    } else {
      setIssuesRows((prev) => [...prev, nextRow]);
      message.success("Issue created");
    }

    closeIssuesModal();
  };

  const incomingTasksRows = useMemo<IncomingTaskRow[]>(() => {
    if (!workOrders.length) return initialIncomingTasksData;

    return [...workOrders]
      .map((wo, index) => {
      const firstItem = wo.items[0];
      const processKey = firstItem?.process_name?.trim().toLowerCase();
      const relatedMachine = processKey ? firstMachineByProcess.get(processKey) : undefined;
      const taskDateValue = wo.target_date ?? wo.created_at ?? "";
      const taskDate = formatDateCell(taskDateValue);
      const reportMonth = deriveMonthLabel(taskDateValue);
      const uniqTotal = wo.uniq_total ?? wo.items.length;
      const uniqClosed = wo.uniq_closed ?? 0;
      const agingDays = typeof wo.aging_days === "number" ? wo.aging_days : calculateAgingDays(wo.target_date, wo.created_at);
      const kanbanNumbers = Array.from(
        new Set(wo.items.map((item) => item.kanban_number).filter((value): value is string => Boolean(value)))
      ).sort((left, right) => left.localeCompare(right));
      const productNames = Array.from(
        new Set(
          wo.items
            .map((item) => item.part_name?.trim() || item.item_uniq_code?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort((left, right) => left.localeCompare(right));
      const normalizedWoType = wo.wo_type.trim().toLowerCase();
      const normalizedStatus = (wo.status ?? "").trim().toLowerCase();
      const normalizedApprovalStatus = (wo.approval_status ?? "").trim().toLowerCase();
      const taskType: TaskType = normalizedWoType.includes("rework")
        ? "Rework"
        : normalizedWoType.includes("assembly")
          ? "Assembly"
          : normalizedWoType.includes("additional")
            ? "Additional"
            : "New";
      const status: TaskStatus =
        uniqTotal > 0 && uniqClosed >= uniqTotal
          ? "Completed"
          : normalizedStatus.includes("complete") || normalizedStatus.includes("closed") || normalizedStatus.includes("done")
          ? "Completed"
          : normalizedStatus.includes("progress")
            || normalizedStatus.includes("process")
            ? "In Progress"
            : "Pending";
      const priority: TaskPriority =
        status === "Completed"
          ? "Medium"
          : normalizedApprovalStatus.includes("pending") || normalizedApprovalStatus.includes("reject") || (agingDays ?? 0) >= 3
            ? "High"
            : "Medium";

      return {
        key: wo.id || `${index + 1}`,
        taskDate,
        reportMonth,
        woNumber: wo.wo_number,
        productName: productNames.join(", ") || "-",
        woType: taskType,
        aging: typeof agingDays === "number" ? `${agingDays} day${agingDays === 1 ? "" : "s"}` : "-",
        targetQty: wo.items.reduce((total, item) => total + item.quantity, 0),
        completionWo: `${uniqClosed}/${uniqTotal}`,
        productionLine: relatedMachine?.production_line ?? "-",
        machineNumber: relatedMachine?.machine_number ?? "-",
        priority,
        status,
        woId: wo.id,
        kanbanNumbers,
      };
    })
      .sort((left, right) => {
        const leftPriority = left.priority === "High" ? 0 : 1;
        const rightPriority = right.priority === "High" ? 0 : 1;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;

        const leftDate = parseDateValue(left.taskDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightDate = parseDateValue(right.taskDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
      });
  }, [firstMachineByProcess, workOrders]);

  const issuesSummaryCards = useMemo<ProductionDashboardSummaryCards>(() => {
    return {
      fg_output: issuesRows.length,
      wip_output: issuesRows.reduce((total, row) => total + row.timeSpentMin, 0),
      total_ng: new Set(issuesRows.map((row) => row.machineId).filter(Boolean)).size,
      total_rework: new Set(issuesRows.map((row) => row.woNumber).filter(Boolean)).size,
    };
  }, [issuesRows]);

  const incomingTasksSummaryCards = useMemo<ProductionDashboardSummaryCards>(() => {
    return {
      fg_output: incomingTasksRows.length,
      wip_output: incomingTasksRows.reduce((total, row) => total + row.targetQty, 0),
      total_ng: incomingTasksRows.filter((row) => row.priority === "High").length,
      total_rework: incomingTasksRows.filter((row) => row.status === "Completed").length,
    };
  }, [incomingTasksRows]);

  const issueDateOptions = useMemo(() => {
    const values = Array.from(new Set(issuesRows.map((row) => row.reportDate).filter(Boolean)));
    return [{ label: "All Date", value: "all" }, ...values.map((value) => ({ label: value, value }))];
  }, [issuesRows]);

  const issueMonthOptions = useMemo(() => {
    const values = Array.from(new Set(issuesRows.map((row) => row.reportMonth).filter((value) => value && value !== "-")));
    return [{ label: "All Month", value: "all" }, ...values.map((value) => ({ label: value, value }))];
  }, [issuesRows]);

  const issueLineOptions = useMemo(() => {
    const values = Array.from(new Set(issuesRows.map((row) => row.productionLine).filter((value) => value && value !== "-")));
    return [{ label: "All Line", value: "all" }, ...values.map((value) => ({ label: value, value }))];
  }, [issuesRows]);

  const issueMachineOptions = useMemo(() => {
    const values = Array.from(new Set(issuesRows.map((row) => row.machineNumber).filter((value) => value && value !== "-")));
    return [{ label: "All Machine", value: "all" }, ...values.map((value) => ({ label: value, value }))];
  }, [issuesRows]);

  const incomingDateOptions = useMemo(() => {
    const values = Array.from(new Set(incomingTasksRows.map((row) => row.taskDate).filter(Boolean)));
    return [{ label: "All Date", value: "all" }, ...values.map((value) => ({ label: value, value }))];
  }, [incomingTasksRows]);

  const incomingMonthOptions = useMemo(() => {
    const values = Array.from(
      new Set(incomingTasksRows.map((row) => row.reportMonth).filter((value) => value && value !== "-"))
    );
    return [{ label: "All Month", value: "all" }, ...values.map((value) => ({ label: value, value }))];
  }, [incomingTasksRows]);

  const incomingLineOptions = useMemo(() => {
    const values = Array.from(
      new Set(incomingTasksRows.map((row) => row.productionLine).filter((value) => value && value !== "-"))
    );
    return [{ label: "All Line", value: "all" }, ...values.map((value) => ({ label: value, value }))];
  }, [incomingTasksRows]);

  const incomingMachineOptions = useMemo(() => {
    const values = Array.from(
      new Set(incomingTasksRows.map((row) => row.machineNumber).filter((value) => value && value !== "-"))
    );
    return [{ label: "All Machine", value: "all" }, ...values.map((value) => ({ label: value, value }))];
  }, [incomingTasksRows]);

  const selectedViewLabel = useMemo(
    () => views.find((v) => v.id === selectedView)?.label ?? "Finished Goods",
    [selectedView]
  );

  const selectedSummaryCards = useMemo(() => {
    if (selectedView === "wip") return wipSummaryCards;
    if (selectedView === "output-per-machine") return outputSummaryCards;
    if (selectedView === "summary-stroke") return summaryStrokeCards;
    if (selectedView === "runtime") return runtimeSummaryCards;
    if (selectedView === "issues") return issuesSummaryCards;
    if (selectedView === "incoming-tasks") return incomingTasksSummaryCards;
    return fgSummaryCards;
  }, [fgSummaryCards, incomingTasksSummaryCards, issuesSummaryCards, outputSummaryCards, runtimeSummaryCards, selectedView, summaryStrokeCards, wipSummaryCards]);

  const currentApiMessage = useMemo(() => {
    if (!apiEnabled) return "NEXT_PUBLIC_API_URL belum dikonfigurasi.";
    if (selectedView === "finished-goods") {
      if (fgDashboardQuery.error) return getApiErrorMessage(fgDashboardQuery.error, "Failed to load FG dashboard");
      if (fgDashboardQuery.data?.status === "error") return fgDashboardQuery.data.message;
    }
    if (selectedView === "wip") {
      if (wipDashboardQuery.error) return getApiErrorMessage(wipDashboardQuery.error, "Failed to load WIP dashboard");
      if (wipDashboardQuery.data?.status === "error") return wipDashboardQuery.data.message;
    }
    if (selectedView === "output-per-machine") {
      if (outputMachineDashboardQuery.error) return getApiErrorMessage(outputMachineDashboardQuery.error, "Failed to load output per machine dashboard");
      if (outputMachineDashboardQuery.data?.status === "error") return outputMachineDashboardQuery.data.message;
    }
    if (selectedView === "summary-stroke") {
      if (summaryStrokeDashboardQuery.error) return getApiErrorMessage(summaryStrokeDashboardQuery.error, "Failed to load summary stroke dashboard");
      if (summaryStrokeDashboardQuery.data?.status === "error") return summaryStrokeDashboardQuery.data.message;
    }
    if (selectedView === "runtime") {
      if (runtimeDashboardQuery.error) return getApiErrorMessage(runtimeDashboardQuery.error, "Failed to load runtime dashboard");
      if (runtimeDashboardQuery.data?.status === "error") return runtimeDashboardQuery.data.message;
    }
    if (selectedView === "issues" || selectedView === "incoming-tasks") {
      if (workOrdersQuery.error) return getApiErrorMessage(workOrdersQuery.error, "Failed to load work orders");
      if (machinesQuery.error) return getApiErrorMessage(machinesQuery.error, "Failed to load machine master");
    }
    return "";
  }, [
    apiEnabled,
    fgDashboardQuery.data?.message,
    fgDashboardQuery.data?.status,
    fgDashboardQuery.error,
    outputMachineDashboardQuery.data?.message,
    outputMachineDashboardQuery.data?.status,
    outputMachineDashboardQuery.error,
    runtimeDashboardQuery.data?.message,
    runtimeDashboardQuery.data?.status,
    runtimeDashboardQuery.error,
    machinesQuery.error,
    selectedView,
    workOrdersQuery.error,
    summaryStrokeDashboardQuery.data?.message,
    summaryStrokeDashboardQuery.data?.status,
    summaryStrokeDashboardQuery.error,
    wipDashboardQuery.data?.message,
    wipDashboardQuery.data?.status,
    wipDashboardQuery.error,
  ]);

  const filteredFinishedGoods = useMemo(() => {
    const q = search.trim().toLowerCase();

    return finishedGoodsRows.filter((row) => {
      const matchesQuery =
        !q ||
        row.uniq.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q) ||
        row.woNumber.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : true;
      const matchesShift = shiftFilter === "all" ? true : row.shift === shiftFilter;

      return matchesQuery && matchesDate && matchesShift;
    });
  }, [finishedGoodsRows, search, dateFilter, shiftFilter]);

  const filteredWip = useMemo(() => {
    const q = search.trim().toLowerCase();

    return wipRows.filter((row) => {
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
  }, [wipRows, search, dateFilter, shiftFilter]);

  const filteredOutputPerMachine = useMemo(() => {
    const q = search.trim().toLowerCase();

    return outputPerMachineRows.filter((row) => {
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
  }, [outputPerMachineRows, search, dateFilter, shiftFilter]);

  const filteredSummaryStroke = useMemo(() => {
    const q = search.trim().toLowerCase();

    return summaryStrokeRows.filter((row) => {
      const matchesQuery =
        !q || row.productionLine.toLowerCase().includes(q) || row.reportDate.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : true;
      const matchesLine = lineFilter === "all" ? true : row.productionLine === lineFilter;

      return matchesQuery && matchesDate && matchesLine;
    });
  }, [summaryStrokeRows, search, dateFilter, lineFilter]);

  const filteredRuntime = useMemo(() => {
    const q = search.trim().toLowerCase();

    return runtimeRows.filter((row) => {
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
  }, [runtimeRows, search, dateFilter, lineFilter]);

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();

    return issuesRows.filter((row) => {
      const matchesQuery =
        !q ||
        row.woNumber.toLowerCase().includes(q) ||
        row.productionLine.toLowerCase().includes(q) ||
        row.machineNumber.toLowerCase().includes(q) ||
        row.issue.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : row.reportDate === dateFilter;
      const matchesMonth = typeFilter === "all" ? true : row.reportMonth === typeFilter;
      const matchesLine = lineFilter === "all" ? true : row.productionLine === lineFilter;
      const matchesMachine = shiftFilter === "all" ? true : row.machineNumber === shiftFilter;

      return matchesQuery && matchesDate && matchesMonth && matchesLine && matchesMachine;
    });
  }, [issuesRows, search, dateFilter, typeFilter, lineFilter, shiftFilter]);

  const filteredIncomingTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return incomingTasksRows.filter((row) => {
      const matchesQuery =
        !q ||
        row.woNumber.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q) ||
        row.taskDate.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : row.taskDate === dateFilter;
      const matchesMonth = typeFilter === "all" ? true : row.reportMonth === typeFilter;
      const matchesLine = lineFilter === "all" ? true : row.productionLine === lineFilter;
      const matchesMachine = shiftFilter === "all" ? true : row.machineNumber === shiftFilter;

      return matchesQuery && matchesDate && matchesMonth && matchesLine && matchesMachine;
    });
  }, [incomingTasksRows, search, dateFilter, typeFilter, lineFilter, shiftFilter]);

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
    { title: "Completion WO", dataIndex: "completionWo", key: "completionWo" },
    { title: "Production Line", dataIndex: "productionLine", key: "productionLine" },
    { title: "Machine Number", dataIndex: "machineNumber", key: "machineNumber" },
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
            className="text-blue-600 hover:text-blue-800"
            onClick={() => {
              openPrintWindow(
                `WO ${record.woNumber}`,
                [
                  `WO Number: ${record.woNumber}`,
                  `WO Type: ${record.woType}`,
                  `Task Date: ${record.taskDate}`,
                  `Product Name: ${record.productName}`,
                  `Production Line: ${record.productionLine}`,
                  `Machine Number: ${record.machineNumber}`,
                  `Target Qty: ${record.targetQty}`,
                  `Completion WO: ${record.completionWo}`,
                ].join("<br />")
              );
            }}
            aria-label="Print Work Order"
          >
            <PrinterOutlined />
          </button>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-800 disabled:text-gray-300"
            onClick={() => {
              if (!record.kanbanNumbers.length) {
                message.info("Kanban number belum tersedia untuk WO ini");
                return;
              }

              openPrintWindow(
                `Kanban ${record.woNumber}`,
                [
                  `WO Number: ${record.woNumber}`,
                  `Kanban: ${record.kanbanNumbers.join(", ")}`,
                  `Production Line: ${record.productionLine}`,
                  `Machine Number: ${record.machineNumber}`,
                ].join("<br />")
              );
            }}
            aria-label="Print Kanban"
            disabled={!record.kanbanNumbers.length}
          >
            <CopyOutlined />
          </button>
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

  const shiftOptions = useMemo(() => {
    const source =
      selectedView === "finished-goods"
        ? filteredFinishedGoods.map((row) => row.shift)
        : selectedView === "wip"
          ? filteredWip.map((row) => row.shift)
          : selectedView === "output-per-machine"
            ? filteredOutputPerMachine.map((row) => row.shift)
            : [];

    const values = Array.from(new Set(source.filter((value) => value && value !== "-")));
    return [{ label: "All Shifts", value: "all" }, ...values.map((value) => ({ label: value, value }))];
  }, [filteredFinishedGoods, filteredOutputPerMachine, filteredWip, selectedView]);

  const lineOptions = useMemo(() => {
    const source =
      selectedView === "summary-stroke"
        ? filteredSummaryStroke.map((row) => row.productionLine)
        : selectedView === "runtime"
          ? filteredRuntime.map((row) => row.productionLine)
          : filteredIssues.map((row) => row.productionLine);

    const values = Array.from(new Set(source.filter((value) => value && value !== "-")));
    return [{ label: "All Line", value: "all" }, ...values.map((value) => ({ label: value, value }))];
  }, [filteredIssues, filteredRuntime, filteredSummaryStroke, selectedView]);

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

  const summaryCardItems = useMemo<DashboardSummaryCardItem[]>(() => {
    if (selectedView === "issues") {
      return [
        { title: "Total Issues", value: toNumber(selectedSummaryCards.fg_output), icon: warningIcon, bgColor: "bg-red-50", textColor: "text-red-600" },
        { title: "Downtime (min)", value: toNumber(selectedSummaryCards.wip_output), icon: heartbeatIcon, bgColor: "bg-orange-50", textColor: "text-orange-600" },
        { title: "Affected Machines", value: toNumber(selectedSummaryCards.total_ng), icon: cubeIcon, bgColor: "bg-blue-50", textColor: "text-blue-600" },
        { title: "Affected WO", value: toNumber(selectedSummaryCards.total_rework), icon: trendIcon, bgColor: "bg-green-50", textColor: "text-green-600" },
      ];
    }

    if (selectedView === "incoming-tasks") {
      return [
        { title: "Total Tasks", value: toNumber(selectedSummaryCards.fg_output), icon: cubeIcon, bgColor: "bg-blue-50", textColor: "text-blue-600" },
        { title: "Target Qty", value: toNumber(selectedSummaryCards.wip_output), icon: heartbeatIcon, bgColor: "bg-green-50", textColor: "text-green-600" },
        { title: "High Priority", value: toNumber(selectedSummaryCards.total_ng), icon: warningIcon, bgColor: "bg-red-50", textColor: "text-red-600" },
        { title: "Completed WO", value: toNumber(selectedSummaryCards.total_rework), icon: trendIcon, bgColor: "bg-orange-50", textColor: "text-orange-600" },
      ];
    }

    return [
      { title: "FG Output", value: toNumber(selectedSummaryCards.fg_output), icon: cubeIcon, bgColor: "bg-blue-50", textColor: "text-blue-600" },
      { title: "WIP Output", value: toNumber(selectedSummaryCards.wip_output), icon: heartbeatIcon, bgColor: "bg-green-50", textColor: "text-green-600" },
      { title: "Total NG", value: toNumber(selectedSummaryCards.total_ng), icon: warningIcon, bgColor: "bg-red-50", textColor: "text-red-600" },
      { title: "Total Rework", value: toNumber(selectedSummaryCards.total_rework), icon: trendIcon, bgColor: "bg-orange-50", textColor: "text-orange-600" },
    ];
  }, [cubeIcon, heartbeatIcon, selectedSummaryCards, selectedView, trendIcon, warningIcon]);

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {summaryCardItems.map((card) => (
          <StatsCard
            key={card.title}
            title={card.title}
            value={card.value}
            subtitle=""
            icon={card.icon}
            bgColor={card.bgColor}
            textColor={card.textColor}
          />
        ))}
      </div>

      {currentApiMessage ? <Alert type="warning" showIcon className="mb-6 !rounded-xl" message={currentApiMessage} /> : null}

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
                    selectedView === "runtime") && (
                    <Select
                      value={dateFilter}
                      onChange={(v) => setDateFilter(v)}
                      options={[{ label: "All Date", value: "all" }]}
                      style={{ width: 140 }}
                    />
                  )}

                  {selectedView === "issues" ? (
                    <>
                      <Select
                        value={dateFilter}
                        onChange={(v) => setDateFilter(v)}
                        options={issueDateOptions}
                        style={{ width: 150 }}
                      />
                      <Select
                        value={typeFilter}
                        onChange={(v) => setTypeFilter(v)}
                        options={issueMonthOptions}
                        style={{ width: 170 }}
                      />
                      <Select
                        value={lineFilter}
                        onChange={(v) => setLineFilter(v)}
                        options={issueLineOptions}
                        style={{ width: 160 }}
                      />
                      <Select
                        value={shiftFilter}
                        onChange={(v) => setShiftFilter(v)}
                        options={issueMachineOptions}
                        style={{ width: 180 }}
                      />
                    </>
                  ) : selectedView === "incoming-tasks" ? (
                    <>
                      <Select
                        value={dateFilter}
                        onChange={(v) => setDateFilter(v)}
                        options={incomingDateOptions}
                        style={{ width: 150 }}
                      />
                      <Select
                        value={typeFilter}
                        onChange={(v) => setTypeFilter(v)}
                        options={incomingMonthOptions}
                        style={{ width: 170 }}
                      />
                      <Select
                        value={lineFilter}
                        onChange={(v) => setLineFilter(v)}
                        options={incomingLineOptions}
                        style={{ width: 160 }}
                      />
                      <Select
                        value={shiftFilter}
                        onChange={(v) => setShiftFilter(v)}
                        options={incomingMachineOptions}
                        style={{ width: 180 }}
                      />
                    </>
                  ) : (
                    <Select
                      value={selectedView === "summary-stroke" || selectedView === "runtime" ? lineFilter : shiftFilter}
                      onChange={(v) =>
                        selectedView === "summary-stroke" || selectedView === "runtime"
                          ? setLineFilter(v)
                          : setShiftFilter(v)
                      }
                      options={selectedView === "summary-stroke" || selectedView === "runtime" ? lineOptions : shiftOptions}
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
              destroyOnHidden
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
                    options={workOrderOptions}
                    onChange={(value) => {
                      const related = workOrderRelations.get(value);
                      if (!related) return;
                      issuesForm.setFieldsValue({
                        productionLine: related.productionLine,
                        machineId: related.machineId,
                      });
                    }}
                  />
                </Form.Item>

                <Form.Item
                  name="productionLine"
                  label="Production Line"
                  rules={[{ required: true, message: "Production Line is required" }]}
                >
                  <Select options={productionLineOptionsForIssues} />
                </Form.Item>

                <Form.Item
                  name="machineId"
                  label="Machine"
                  rules={[{ required: true, message: "Machine is required" }]}
                >
                  <Select options={machineOptionsForIssues} />
                </Form.Item>

                <Form.Item
                  name="issue"
                  label="Production Issue"
                  rules={[{ required: true, message: "Production Issue is required" }]}
                >
                  <Select options={issueTypeOptions} />
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

            <div className="px-5 pb-5">
              <Table
                columns={tableConfig.columns as unknown as ColumnsType<object>}
                dataSource={tableConfig.data as unknown as object[]}
                locale={{
                  emptyText: currentApiMessage
                    ? "No data available for this view"
                    : "No production dashboard data found",
                }}
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
