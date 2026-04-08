"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Spin, message } from "antd";
import StatsCard from "@/components/StatsCard";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type ShopFloorMachineDetail,
  type ShopFloorProductionIssue,
  type ShopFloorScanEvent,
  useGetShopFloorDeliveryReadinessQuery,
  useGetShopFloorLiveProductionQuery,
  useGetShopFloorProductionIssuesQuery,
  useGetShopFloorScanEventsQuery,
  useLazyGetShopFloorMachineDetailQuery,
} from "@/lib/api/shop-floor/api";

type ShopFloorTabId = "live-production" | "delivery-readiness" | "production-issues" | "scan-events";
type LineStatus = "Running" | "Changeover" | "Issue" | "Completed";

type DeliveryRisk = "Critical" | "At Risk" | "Ready";
type DeliveryItem = {
  key: string;
  productName: string;
  uniq: string;
  customer: string;
  dueDate: string;
  dueTime: string;
  hoursUntilDue: string;
  requiredQty: number;
  finishedGoods: number;
  wipStock: number;
  totalAvailable: number;
  shortfall: number;
  coveragePercent: number;
  risk: DeliveryRisk;
  priority: "Urgent" | "High" | "Medium";
};

type IssuePriority = "High" | "Medium" | "Low";
type IssueStatus = "Under Investigation" | "Scheduled Maintenance" | "Monitoring";
type ProductionIssueItem = {
  key: string;
  title: string;
  description: string;
  machine: string;
  reportedBy: string;
  time: string;
  priority: IssuePriority;
  status: IssueStatus;
  estResolution: string;
  productionImpact: string;
  issueId: string;
};

type ScanEventType = "Scan In" | "Scan Out" | "Quality Check";
type ScanEventRow = {
  key: string;
  time: string;
  event: ScanEventType;
  machine: string;
  uniq: string;
  workOrder: string;
  operator: string;
  process: string;
  qty: number;
};

type LineCard = {
  key: string;
  lineName: string;
  lineCode: string;
  status: LineStatus;
  currentProduction: {
    uniq: string;
    workOrder: string;
    part: string;
    lastScan: string;
  };
  operator: {
    name: string;
    time: string;
    shiftStart: string;
    shiftState: string;
    nextProcess: string;
    cycleTime: string;
  };
  progressPercent: number;
  progressLabel: string;
  bottomStats: {
    throughputToday: number;
    utilization: number;
    qualityRate: number;
    avgCycleTime: string;
  };
};

const tabs: Array<{ id: ShopFloorTabId; label: string }> = [
  { id: "live-production", label: "Live Production" },
  { id: "delivery-readiness", label: "Delivery Readiness" },
  { id: "production-issues", label: "Production Issues" },
  { id: "scan-events", label: "Scan Events" },
];

const lines: LineCard[] = [
  {
    key: "1",
    lineName: "Assembly Line Alpha",
    lineCode: "LINE-A1",
    status: "Running",
    currentProduction: {
      uniq: "LV7-e01",
      workOrder: "WO-2301-0037",
      part: "Engine Mount Bracket",
      lastScan: "2 min ago",
    },
    operator: {
      name: "Sarah Chen",
      time: "08:00",
      shiftStart: "06:00",
      shiftState: "Active",
      nextProcess: "Welding Station",
      cycleTime: "4.2 min",
    },
    progressPercent: 73,
    progressLabel: "In Progress",
    bottomStats: { throughputToday: 142, utilization: 87, qualityRate: 98.5, avgCycleTime: "4.2 min" },
  },
  {
    key: "2",
    lineName: "CNC Machining Center",
    lineCode: "LINE-B2",
    status: "Running",
    currentProduction: {
      uniq: "LV8-e02",
      workOrder: "WO-2204-0181",
      part: "Suspension Arm",
      lastScan: "11 min ago",
    },
    operator: {
      name: "Mike Rodriguez",
      time: "06:00",
      shiftStart: "06:00",
      shiftState: "Active",
      nextProcess: "Quality Check",
      cycleTime: "8.7 min",
    },
    progressPercent: 45,
    progressLabel: "In Progress",
    bottomStats: { throughputToday: 89, utilization: 92, qualityRate: 99.2, avgCycleTime: "8.7 min" },
  },
  {
    key: "3",
    lineName: "Brake Assembly Line",
    lineCode: "LINE-C3",
    status: "Changeover",
    currentProduction: {
      uniq: "LV8-e03",
      workOrder: "WO-2402-1063",
      part: "Brake Caliper",
      lastScan: "15 min ago",
    },
    operator: {
      name: "Jennifer Park",
      time: "06:00",
      shiftStart: "06:00",
      shiftState: "Changeover",
      nextProcess: "Setup Next WO",
      cycleTime: "6.1 min",
    },
    progressPercent: 100,
    progressLabel: "Completed",
    bottomStats: { throughputToday: 156, utilization: 78, qualityRate: 97.8, avgCycleTime: "6.1 min" },
  },
  {
    key: "4",
    lineName: "Stamping Press",
    lineCode: "LINE-D4",
    status: "Issue",
    currentProduction: {
      uniq: "LX1-e04",
      workOrder: "WO-2204-1009",
      part: "Door Panel",
      lastScan: "5 min ago",
    },
    operator: {
      name: "David Kim",
      time: "08:00",
      shiftStart: "08:00",
      shiftState: "Paused",
      nextProcess: "Maintenance Check",
      cycleTime: "3.8 min",
    },
    progressPercent: 88,
    progressLabel: "In Progress",
    bottomStats: { throughputToday: 98, utilization: 45, qualityRate: 94.2, avgCycleTime: "3.8 min" },
  },
];

const deliveryItems: DeliveryItem[] = [
  {
    key: "1",
    productName: "Door Panel",
    uniq: "LX1-004",
    customer: "Ford Motor Company",
    dueDate: "2024-09-19",
    dueTime: "08:00",
    hoursUntilDue: "16h",
    requiredQty: 1500,
    finishedGoods: 900,
    wipStock: 180,
    totalAvailable: 1080,
    shortfall: -420,
    coveragePercent: 72,
    risk: "Critical",
    priority: "Urgent",
  },
  {
    key: "2",
    productName: "Engine Mount Bracket",
    uniq: "LV7-001",
    customer: "Toyota Motor Corp",
    dueDate: "2024-09-20",
    dueTime: "14:00",
    hoursUntilDue: "22h",
    requiredQty: 2500,
    finishedGoods: 2100,
    wipStock: 450,
    totalAvailable: 2550,
    shortfall: 0,
    coveragePercent: 102,
    risk: "Ready",
    priority: "High",
  },
  {
    key: "3",
    productName: "Suspension Arm",
    uniq: "LV8-002",
    customer: "Honda Manufacturing",
    dueDate: "2024-09-21",
    dueTime: "10:00",
    hoursUntilDue: "42h",
    requiredQty: 1800,
    finishedGoods: 1200,
    wipStock: 320,
    totalAvailable: 1520,
    shortfall: -280,
    coveragePercent: 84,
    risk: "At Risk",
    priority: "High",
  },
  {
    key: "4",
    productName: "Brake Caliper",
    uniq: "LW0-003",
    customer: "Nissan Global",
    dueDate: "2024-09-22",
    dueTime: "16:00",
    hoursUntilDue: "72h",
    requiredQty: 3200,
    finishedGoods: 2800,
    wipStock: 520,
    totalAvailable: 3320,
    shortfall: 0,
    coveragePercent: 104,
    risk: "Ready",
    priority: "Medium",
  },
];

const productionIssues: ProductionIssueItem[] = [
  {
    key: "ISSUE-001",
    title: "Hydraulic Pressure Drop",
    description: "Stamping press showing inconsistent pressure readings",
    machine: "LINE-D4",
    reportedBy: "David Kim",
    time: "13:45",
    priority: "High",
    status: "Under Investigation",
    estResolution: "30 min",
    productionImpact: "Production Reduced 50%",
    issueId: "ISSUE-001",
  },
  {
    key: "ISSUE-002",
    title: "Tool Wear Warning",
    description: "CNC cutting tool approaching replacement threshold",
    machine: "LINE-B2",
    reportedBy: "Mike Rodriguez",
    time: "12:30",
    priority: "Medium",
    status: "Scheduled Maintenance",
    estResolution: "15 min",
    productionImpact: "No Impact",
    issueId: "ISSUE-002",
  },
  {
    key: "QUALITY-001",
    title: "Dimensional Variance",
    description: "Engine mount bracket showing slight dimensional drift",
    machine: "LINE-A1",
    reportedBy: "Quality Control",
    time: "11:15",
    priority: "Low",
    status: "Monitoring",
    estResolution: "Next Shift",
    productionImpact: "Quality Review Required",
    issueId: "QUALITY-001",
  },
];

const scanEvents: ScanEventRow[] = [
  {
    key: "1",
    time: "14:35:42",
    event: "Scan In",
    machine: "LINE-A1",
    uniq: "LV7-001",
    workOrder: "WO-2024-1057",
    operator: "Sarah Chen",
    process: "Assembly Start",
    qty: 1,
  },
  {
    key: "2",
    time: "14:34:18",
    event: "Scan Out",
    machine: "LINE-B2",
    uniq: "LV8-002",
    workOrder: "WO-2024-1061",
    operator: "Mike Rodriguez",
    process: "Machining Complete",
    qty: 1,
  },
  {
    key: "3",
    time: "14:20:55",
    event: "Quality Check",
    machine: "LINE-C3",
    uniq: "LW0-003",
    workOrder: "WO-2024-1063",
    operator: "Jennifer Park",
    process: "Final Inspection",
    qty: 1,
  },
  {
    key: "4",
    time: "14:18:33",
    event: "Scan In",
    machine: "LINE-D4",
    uniq: "LX1-004",
    workOrder: "WO-2024-1059",
    operator: "David Kim",
    process: "Stamping Process",
    qty: 1,
  },
];

const iconChip = (d: string) => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const toNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toText = (value: unknown, fallback = "—"): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const formatRelativeTime = (value?: string | null): string => {
  const ts = parseTimestamp(value);
  if (!ts) return "No recent scan";

  const diffMinutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

const formatDate = (value?: string | null): string => {
  if (!value) return "—";
  const ts = parseTimestamp(value);
  if (!ts) return toText(value);
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ts);
};

const formatClock = (value?: string | null): string => {
  if (!value) return "—";
  const ts = parseTimestamp(value);
  if (ts) {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(ts);
  }

  const match = value.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
  return match ? match[1] : toText(value);
};

const parseDurationMinutes = (value?: string | null): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]) + Number(match[3]) / 60;
};

const formatDuration = (minutes: number | null): string => {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 1) return `${Math.round(minutes * 60)} sec`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
};

const formatHoursUntilDue = (value?: string | null): string => {
  const ts = parseTimestamp(value);
  if (!ts) return "—";
  const diffHours = Math.round((ts - Date.now()) / 3600000);
  return diffHours < 0 ? `${Math.abs(diffHours)}h overdue` : `${diffHours}h`;
};

const mapLineStatus = (value?: string | null): LineStatus => {
  const normalized = toText(value, "").toUpperCase();
  if (normalized.includes("RUN")) return "Running";
  if (normalized.includes("ISSUE") || normalized.includes("BREAK") || normalized.includes("DOWN")) return "Issue";
  if (normalized.includes("COMPLETE") || normalized.includes("DONE")) return "Completed";
  return "Changeover";
};

const mapDeliveryRisk = (status?: string | null, shortage = 0, requiredQty = 0): DeliveryRisk => {
  const normalized = toText(status, "").toUpperCase();
  if (normalized.includes("READY") && shortage <= 0) return "Ready";
  if (shortage > 0 && shortage >= Math.max(1, requiredQty * 0.2)) return "Critical";
  if (shortage > 0 || normalized.includes("RISK")) return "At Risk";
  return "Ready";
};

const mapIssuePriority = (issue: ShopFloorProductionIssue): IssuePriority => {
  const raw = [issue.priority, issue.status, issue.issue_type, issue.production_impact]
    .map((value) => toText(value, ""))
    .join(" ")
    .toUpperCase();
  if (raw.includes("HIGH") || raw.includes("CRITICAL") || raw.includes("STOP")) return "High";
  if (raw.includes("MEDIUM") || raw.includes("MAINTENANCE") || raw.includes("WARNING")) return "Medium";
  return "Low";
};

const mapIssueStatus = (value?: string | null): IssueStatus => {
  const normalized = toText(value, "").toUpperCase();
  if (normalized.includes("MAINTENANCE")) return "Scheduled Maintenance";
  if (normalized.includes("MONITOR")) return "Monitoring";
  return "Under Investigation";
};

const mapScanEventType = (value?: string | null): ScanEventType => {
  const normalized = toText(value, "").toLowerCase();
  if (normalized === "scan_out") return "Scan Out";
  if (normalized === "quality_check") return "Quality Check";
  return "Scan In";
};

const getEventTimestamp = (event?: ShopFloorScanEvent | null): number =>
  parseTimestamp(event?.createdAt ?? event?.updatedAt ?? event?.report_date ?? undefined);

const getMachineLabel = (event?: ShopFloorScanEvent | null): string =>
  toText(event?.master_machine?.machine_number ?? event?.master_machine?.machine_name ?? event?.production_line, "Unknown Machine");

const getNextProcess = (event?: ShopFloorScanEvent | null): string => {
  const routes = event?.wo_item?.product_details?.process_routes ?? [];
  const currentProcess = toText(event?.process_name, "");
  if (routes.length && currentProcess) {
    const currentIndex = routes.findIndex((route) => toText(route.process_name, "") === currentProcess);
    if (currentIndex >= 0 && currentIndex < routes.length - 1) {
      return toText(routes[currentIndex + 1]?.process_name);
    }
  }
  return toText(event?.wo_item?.process_name ?? event?.process_name);
};

const emptyState = (title: string, description: string) => (
  <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
    <div className="text-sm font-semibold text-gray-900">{title}</div>
    <div className="mt-1 text-sm text-gray-500">{description}</div>
  </div>
);

export default function ShopFloor() {
  const [activeTab, setActiveTab] = useState<ShopFloorTabId>("live-production");
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);

  const apiEnabled = Boolean(apiBaseUrl);
  const liveProductionQuery = useGetShopFloorLiveProductionQuery(undefined, { skip: !apiEnabled });
  const deliveryReadinessQuery = useGetShopFloorDeliveryReadinessQuery(undefined, { skip: !apiEnabled });
  const productionIssuesQuery = useGetShopFloorProductionIssuesQuery(undefined, { skip: !apiEnabled });
  const scanEventsQuery = useGetShopFloorScanEventsQuery(undefined, { skip: !apiEnabled });
  const [fetchMachineDetail, machineDetailQuery] = useLazyGetShopFloorMachineDetailQuery();

  const liveProductionData = liveProductionQuery.data?.data ?? [];
  const deliveryReadinessData = deliveryReadinessQuery.data?.data ?? [];
  const productionIssuesData = productionIssuesQuery.data?.data ?? [];
  const scanEventData = useMemo(
    () => [...(scanEventsQuery.data?.data ?? [])].sort((left, right) => getEventTimestamp(right) - getEventTimestamp(left) || toNumber(right.id) - toNumber(left.id)),
    [scanEventsQuery.data?.data]
  );

  const latestReportDate = useMemo(() => {
    const dates = scanEventData.map((event) => toText(event.report_date, "")).filter(Boolean);
    if (!dates.length) return null;
    return [...dates].sort().at(-1) ?? null;
  }, [scanEventData]);

  const machineEventsMap = useMemo(() => {
    const map = new Map<string, ShopFloorScanEvent[]>();
    scanEventData.forEach((event) => {
      const machineId = toText(event.machine_id, "");
      if (!machineId) return;
      const existing = map.get(machineId) ?? [];
      existing.push(event);
      map.set(machineId, existing);
    });
    return map;
  }, [scanEventData]);

  const uniqEventsMap = useMemo(() => {
    const map = new Map<string, ShopFloorScanEvent[]>();
    scanEventData.forEach((event) => {
      const uniq = toText(event.item_uniq_code ?? event.wo_item?.product_details?.uniq, "");
      if (!uniq) return;
      const existing = map.get(uniq) ?? [];
      existing.push(event);
      map.set(uniq, existing);
    });
    return map;
  }, [scanEventData]);

  const liveLines = useMemo<LineCard[]>(() => {
    const machineRows =
      liveProductionData.length > 0
        ? liveProductionData
        : Array.from(machineEventsMap.entries()).map(([machineId, events]) => {
            const latest = events[0];
            return {
              machine_id: machineId,
              machine_name: latest?.master_machine?.machine_name,
              machine_number: latest?.master_machine?.machine_number,
              production_line: latest?.master_machine?.production_line,
              status: latest?.master_machine?.status,
              current_wo: latest?.work_order?.wo_number,
              current_uniq: latest?.item_uniq_code ?? latest?.wo_item?.product_details?.uniq,
              operator: latest?.operator_name,
              last_update: latest?.updatedAt ?? latest?.createdAt,
            };
          });

    return machineRows.map((machine, index) => {
      const machineId = toText(machine.machine_id, `machine-${index + 1}`);
      const events = machineEventsMap.get(machineId) ?? [];
      const latestEvent = events[0];
      const targetQty = toNumber(latestEvent?.wo_item?.quantity);
      const scanOutQty = events
        .filter((event) => toText(event.scan_type, "").toLowerCase() === "scan_out")
        .reduce((sum, event) => sum + toNumber(event.good_quantity || event.quantity), 0);
      const progressPercent = targetQty > 0 ? clamp(Math.round((scanOutQty / targetQty) * 100), 0, 100) : 0;
      const latestDayEvents = latestReportDate ? events.filter((event) => toText(event.report_date, "") === latestReportDate) : events;
      const throughputToday = latestDayEvents
        .filter((event) => toText(event.scan_type, "").toLowerCase() === "scan_out")
        .reduce((sum, event) => sum + toNumber(event.good_quantity || event.quantity), 0);
      const processedQty = latestDayEvents.reduce((sum, event) => sum + toNumber(event.quantity), 0);
      const status = mapLineStatus(machine.status ?? latestEvent?.master_machine?.status);
      const machineCapacity = toNumber(latestEvent?.master_machine?.machine_capacity);
      const utilization = machineCapacity > 0
        ? clamp(Math.round((processedQty / machineCapacity) * 100), 0, 100)
        : status === "Running"
          ? 100
          : status === "Issue"
            ? 25
            : 60;
      const goodQty = latestDayEvents.reduce((sum, event) => sum + toNumber(event.good_quantity), 0);
      const rejectQty = latestDayEvents.reduce(
        (sum, event) => sum + toNumber(event.ng_setting_machine) + toNumber(event.ng_process) + toNumber(event.scrap_quantity),
        0
      );
      const qualityBase = goodQty + rejectQty;
      const qualityRate = qualityBase > 0 ? Number(((goodQty / qualityBase) * 100).toFixed(1)) : 100;
      const durationValues = latestDayEvents
        .map((event) => parseDurationMinutes(event.dandori_time ?? event.setup_qc_time ?? null))
        .filter((value): value is number => value != null && Number.isFinite(value));
      const avgDuration = durationValues.length
        ? durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length
        : null;

      return {
        key: machineId,
        machineId,
        lineName: toText(machine.machine_name, toText(latestEvent?.master_machine?.machine_name, `Machine ${index + 1}`)),
        lineCode: toText(machine.machine_number ?? latestEvent?.master_machine?.machine_number ?? machine.production_line, `LINE-${index + 1}`),
        status,
        currentProduction: {
          uniq: toText(machine.current_uniq ?? latestEvent?.item_uniq_code ?? latestEvent?.wo_item?.product_details?.uniq),
          workOrder: toText(machine.current_wo ?? latestEvent?.work_order?.wo_number),
          part: toText(latestEvent?.wo_item?.product_details?.part_name ?? latestEvent?.wo_item?.process_name, "Part not available"),
          lastScan: formatRelativeTime(machine.last_update ?? latestEvent?.updatedAt ?? latestEvent?.createdAt ?? null),
        },
        operator: {
          name: toText(machine.operator ?? latestEvent?.operator_name, "Operator not assigned"),
          time: formatClock(latestEvent?.createdAt ?? latestEvent?.updatedAt ?? null),
          shiftStart: toText(latestEvent?.shift, "—"),
          shiftState: status,
          nextProcess: getNextProcess(latestEvent),
          cycleTime: formatDuration(avgDuration),
        },
        progressPercent,
        progressLabel: progressPercent >= 100 ? "Completed" : "In Progress",
        bottomStats: {
          throughputToday,
          utilization,
          qualityRate,
          avgCycleTime: formatDuration(avgDuration),
        },
      };
    });
  }, [latestReportDate, liveProductionData, machineEventsMap]);

  useEffect(() => {
    if (!liveLines.length) {
      setSelectedMachineId(null);
      return;
    }

    if (!selectedMachineId || !liveLines.some((line) => line.machineId === selectedMachineId)) {
      setSelectedMachineId(liveLines[0].machineId);
    }
  }, [liveLines, selectedMachineId]);

  const mappedDeliveryItems = useMemo<DeliveryItem[]>(() => {
    return deliveryReadinessData.map((item, index) => {
      const uniq = toText(item.uniq, `UNIQ-${index + 1}`);
      const relatedEvents = uniqEventsMap.get(uniq) ?? [];
      const latestEvent = relatedEvents[0];
      const stock = toNumber(item.stock);
      const scanInQty = relatedEvents
        .filter((event) => toText(event.scan_type, "").toLowerCase() === "scan_in")
        .reduce((sum, event) => sum + toNumber(event.quantity), 0);
      const scanOutQty = relatedEvents
        .filter((event) => toText(event.scan_type, "").toLowerCase() === "scan_out")
        .reduce((sum, event) => sum + toNumber(event.good_quantity || event.quantity), 0);
      const wipStock = Math.max(0, scanInQty - scanOutQty);
      const totalAvailable = stock + wipStock;
      const shortage = toNumber(item.shortage);
      const requiredQty = Math.max(totalAvailable + shortage, toNumber(latestEvent?.wo_item?.quantity));
      const risk = mapDeliveryRisk(item.status, shortage, requiredQty);
      return {
        key: `${uniq}-${index}`,
        productName: toText(latestEvent?.wo_item?.product_details?.part_name, uniq),
        uniq,
        customer: toText(latestEvent?.work_order?.wo_type, "—"),
        dueDate: formatDate(latestEvent?.work_order?.target_date ?? null),
        dueTime: latestEvent?.work_order?.target_date ? "23:59" : "—",
        hoursUntilDue: formatHoursUntilDue(latestEvent?.work_order?.target_date ?? null),
        requiredQty,
        finishedGoods: stock,
        wipStock,
        totalAvailable,
        shortfall: shortage > 0 ? -shortage : 0,
        coveragePercent: requiredQty > 0 ? clamp(Math.round((totalAvailable / requiredQty) * 100), 0, 999) : risk === "Ready" ? 100 : 0,
        risk,
        priority: shortage > 0 ? (shortage > 20 ? "Urgent" : "High") : "Medium",
      };
    });
  }, [deliveryReadinessData, uniqEventsMap]);

  const mappedProductionIssues = useMemo<ProductionIssueItem[]>(() => {
    const derivedIssues: ShopFloorProductionIssue[] = scanEventData
      .filter((event) => toText(event.issue_type, "") || toText(event.issue_description, ""))
      .map((event) => ({
        id: event.issue_id ?? event.id,
        issue_id: event.issue_id ?? event.id,
        title: event.issue_type ?? undefined,
        issue_type: event.issue_type,
        issue_description: event.issue_description,
        machine_name: event.master_machine?.machine_name,
        machine_id: event.machine_id,
        production_line: event.master_machine?.production_line ?? event.production_line,
        process_name: event.process_name,
        operator_name: event.operator_name,
        status: event.issue_type ? "Under Investigation" : undefined,
        issue_time: event.issue_time ?? event.createdAt,
      }));

    const source = productionIssuesData.length ? productionIssuesData : derivedIssues;
    return source.map((issue, index) => ({
      key: String(issue.id ?? issue.issue_id ?? index + 1),
      title: toText(issue.title ?? issue.issue_type, `Issue ${index + 1}`),
      description: toText(issue.issue_description ?? issue.description, "No issue description provided"),
      machine: toText(issue.machine_name ?? issue.production_line ?? issue.process_name ?? issue.machine_id, "Unknown machine"),
      reportedBy: toText(issue.reported_by ?? issue.operator_name, "System"),
      time: formatClock(issue.issue_time ?? issue.createdAt ?? issue.updatedAt ?? null),
      priority: mapIssuePriority(issue),
      status: mapIssueStatus(issue.status),
      estResolution: toText(issue.estimated_resolution, "TBD"),
      productionImpact: toText(issue.production_impact ?? issue.impact, "Needs review"),
      issueId: toText(issue.issue_id ?? issue.id, `ISSUE-${index + 1}`),
    }));
  }, [productionIssuesData, scanEventData]);

  const mappedScanEvents = useMemo<ScanEventRow[]>(() => {
    return scanEventData.map((event, index) => ({
      key: String(event.id ?? index + 1),
      time: formatClock(event.createdAt ?? event.updatedAt ?? event.report_date ?? null),
      event: mapScanEventType(event.scan_type),
      machine: getMachineLabel(event),
      uniq: toText(event.item_uniq_code ?? event.wo_item?.product_details?.uniq),
      workOrder: toText(event.work_order?.wo_number),
      operator: toText(event.operator_name, "System"),
      process: toText(event.process_name),
      qty: toNumber(event.good_quantity || event.quantity),
    }));
  }, [scanEventData]);

  const activeLinesCount = useMemo(() => liveLines.filter((line) => line.status === "Running").length, [liveLines]);
  const criticalCount = useMemo(() => mappedDeliveryItems.filter((item) => item.risk === "Critical").length, [mappedDeliveryItems]);
  const atRiskCount = useMemo(() => mappedDeliveryItems.filter((item) => item.risk === "At Risk").length, [mappedDeliveryItems]);
  const highPriorityCount = useMemo(() => mappedProductionIssues.filter((item) => item.priority === "High").length, [mappedProductionIssues]);
  const throughputToday = useMemo(() => liveLines.reduce((sum, line) => sum + line.bottomStats.throughputToday, 0), [liveLines]);
  const lineEfficiency = useMemo(() => {
    if (!liveLines.length) return 0;
    return Math.round(liveLines.reduce((sum, line) => sum + line.bottomStats.utilization, 0) / liveLines.length);
  }, [liveLines]);
  const qualityRate = useMemo(() => {
    const totalGood = scanEventData.reduce((sum, event) => sum + toNumber(event.good_quantity), 0);
    const totalReject = scanEventData.reduce(
      (sum, event) => sum + toNumber(event.ng_setting_machine) + toNumber(event.ng_process) + toNumber(event.scrap_quantity),
      0
    );
    const total = totalGood + totalReject;
    return total > 0 ? Number(((totalGood / total) * 100).toFixed(1)) : 0;
  }, [scanEventData]);
  const lastUpdatedText = useMemo(() => {
    const latestTs = Math.max(
      ...liveProductionData.map((row) => parseTimestamp(row.last_update)),
      ...scanEventData.map((row) => getEventTimestamp(row)),
      0
    );
    return latestTs ? formatRelativeTime(new Date(latestTs).toISOString()) : "No updates yet";
  }, [liveProductionData, scanEventData]);
  const selectedLine = useMemo(() => liveLines.find((line) => line.machineId === selectedMachineId) ?? null, [liveLines, selectedMachineId]);
  const pageError = useMemo(() => {
    const firstError = [
      liveProductionQuery.error,
      deliveryReadinessQuery.error,
      productionIssuesQuery.error,
      scanEventsQuery.error,
    ].find(Boolean);
    return firstError ? getApiErrorMessage(firstError, "Failed to load shop floor data") : "";
  }, [deliveryReadinessQuery.error, liveProductionQuery.error, productionIssuesQuery.error, scanEventsQuery.error]);
  const machineDetail = machineDetailQuery.data?.data as ShopFloorMachineDetail | undefined;

  const handleRefresh = async () => {
    if (!apiEnabled) {
      message.warning("NEXT_PUBLIC_API_URL belum dikonfigurasi.");
      return;
    }

    await Promise.all([
      liveProductionQuery.refetch(),
      deliveryReadinessQuery.refetch(),
      productionIssuesQuery.refetch(),
      scanEventsQuery.refetch(),
      isMachineModalOpen && selectedMachineId ? fetchMachineDetail(selectedMachineId, true) : Promise.resolve(),
    ]);
    message.success("Shop floor refreshed");
  };

  const openMachineDetail = async () => {
    if (!selectedMachineId) {
      message.info("Pilih mesin dulu dari kartu live production.");
      return;
    }

    setIsMachineModalOpen(true);
    await fetchMachineDetail(selectedMachineId, true);
  };

  const throughputIcon = iconChip(
    "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
  );
  const efficiencyIcon = iconChip(
    "M3 3v18h18M7 15l3-3 4 4 6-6"
  );
  const machinesIcon = iconChip(
    "M9 17v-2a4 4 0 014-4h2a4 4 0 014 4v2M7 7h10M6 21h12"
  );
  const qualityIcon = iconChip(
    "M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
  );

  const statusPill = (status: LineStatus) => {
    if (status === "Running") {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-100">Running</span>;
    }
    if (status === "Changeover") {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-800 border border-yellow-100">Changeover</span>;
    }
    if (status === "Issue") {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-700 border border-red-100">Issue</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100">Completed</span>;
  };

  const deliveryRiskPill = (risk: DeliveryRisk) => {
    if (risk === "Critical") {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-red-50 text-red-700 border border-red-100">Critical</span>;
    }
    if (risk === "At Risk") {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-orange-50 text-orange-700 border border-orange-100">At Risk</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-green-50 text-green-700 border border-green-100">Ready</span>;
  };

  const deliveryPriorityPill = (p: DeliveryItem["priority"]) => {
    if (p === "Urgent") {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-red-50 text-red-700 border border-red-100">Urgent</span>;
    }
    if (p === "High") {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-100">High</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-50 text-gray-700 border border-gray-200">Medium</span>;
  };

  const issuePriorityPill = (p: IssuePriority) => {
    if (p === "High") {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-red-50 text-red-700 border border-red-100">High</span>;
    }
    if (p === "Medium") {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-yellow-50 text-yellow-700 border border-yellow-100">Medium</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-green-50 text-green-700 border border-green-100">Low</span>;
  };

  const issueStatusPill = (s: IssueStatus) => {
    if (s === "Under Investigation") {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-50 text-gray-700 border border-gray-200">Under Investigation</span>;
    }
    if (s === "Scheduled Maintenance") {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-50 text-gray-700 border border-gray-200">Scheduled Maintenance</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-50 text-gray-700 border border-gray-200">Monitoring</span>;
  };

  const issueIcon = (p: IssuePriority) => {
    if (p === "High") {
      return (
        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
      );
    }
    if (p === "Medium") {
      return (
        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 4h.01M12 2a10 10 0 1010 10A10 10 0 0012 2z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center border border-green-100">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  };

  const scanEventPill = (e: ScanEventType) => {
    if (e === "Scan In") {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-100">Scan In</span>;
    }
    if (e === "Scan Out") {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-gray-50 text-gray-700 border border-gray-200">Scan Out</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-gray-50 text-gray-700 border border-gray-200">Quality Check</span>;
  };

  return (
    <>
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-gray-900">Shop Floor Control</div>
            <div className="text-sm text-gray-500">Live visibility of production: machines, UNIQs, work orders, and inventory status</div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-100 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Live Tracking
            </button>
            <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-sm">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Updated {lastUpdatedText}
            </button>
            <button type="button" onClick={handleRefresh} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 text-sm hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 9A8 8 0 006.34 6.34L4 10m0 5a8 8 0 0013.66 2.66L20 14" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {!apiEnabled ? (
        <Alert
          type="warning"
          showIcon
          className="mb-6 !rounded-xl"
          message="NEXT_PUBLIC_API_URL belum dikonfigurasi. Shop floor memakai data API lokal."
        />
      ) : null}

      {pageError ? <Alert type="error" showIcon className="mb-6 !rounded-xl" message={pageError} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatsCard
          title="Total Throughput Today"
          value={throughputToday}
          subtitle={latestReportDate ? `units • ${formatDate(latestReportDate)}` : "units"}
          icon={throughputIcon}
          bgColor="bg-blue-50"
          textColor="text-blue-600"
          change={`${mappedScanEvents.length} scan events`}
          changeType="positive"
        />
        <StatsCard
          title="Overall Line Efficiency"
          value={`${lineEfficiency}%`}
          icon={efficiencyIcon}
          bgColor="bg-green-50"
          textColor="text-green-600"
          change={`${activeLinesCount} running lines`}
          changeType="positive"
        />
        <StatsCard
          title="Active Machines"
          value={`${activeLinesCount}/${liveLines.length || liveProductionData.length || 0}`}
          subtitle="running"
          icon={machinesIcon}
          bgColor="bg-red-50"
          textColor="text-red-600"
          change={selectedLine?.lineName ?? "No machine selected"}
          changeType="negative"
        />
        <StatsCard
          title="Quality Rate"
          value={`${qualityRate}%`}
          icon={qualityIcon}
          bgColor="bg-purple-50"
          textColor="text-purple-600"
          change={`${mappedProductionIssues.length} active issues`}
          changeType={mappedProductionIssues.length > 0 ? "negative" : "positive"}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 pt-5">
          <div className="bg-gray-100 rounded-xl p-2 flex items-center gap-2">
            {tabs.map((t) => {
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? "bg-white text-gray-900 font-medium" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-gray-900">
              {activeTab === "delivery-readiness"
                ? "Delivery Schedule vs Inventory Status"
                : activeTab === "production-issues"
                  ? "Production Issues & Quality Reports"
                  : activeTab === "scan-events"
                    ? "Recent Scan In/Out Events"
                  : "Real-Time Machine Status"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === "delivery-readiness" ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-red-50 text-red-700 border border-red-100">{criticalCount} Critical</span>
                  <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-orange-50 text-orange-700 border border-orange-100">{atRiskCount} At Risk</span>
                </div>
                <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 text-sm hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h2a4 4 0 014 4v2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M6 21h12" />
                  </svg>
                  Delivery Planning
                </button>
              </>
            ) : activeTab === "production-issues" ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-red-50 text-red-700 border border-red-100">
                    {highPriorityCount} High Priority
                  </span>
                </div>
                <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 text-sm hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Report Issue
                </button>
              </>
            ) : activeTab === "scan-events" ? (
              <>
                <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-50 text-gray-700 border border-gray-200">Real-time Updates</span>
                <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 text-sm hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4h.01M8 6h8M7 10h10M6 14h12M5 18h14" />
                  </svg>
                  Scan QR Code
                </button>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-500">
                  {activeLinesCount} of {liveLines.length} Lines Active
                </div>
                <button type="button" onClick={openMachineDetail} disabled={!selectedMachineId} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-700 border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-60">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h2a4 4 0 014 4v2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M6 21h12" />
                  </svg>
                  Machine Details
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {activeTab === "delivery-readiness" ? (
            <>
              {mappedDeliveryItems.length ? mappedDeliveryItems.map((d) => (
                <div key={d.key} className="bg-white rounded-xl border border-gray-100">
                  <div className="px-4 py-3 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 16V8a2 2 0 00-1-1.732l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.732l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
                          />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22.08V12" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{d.productName}</div>
                        <div className="text-xs text-gray-500">
                          {d.uniq} 
 {d.customer}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {deliveryPriorityPill(d.priority)}
                      {deliveryRiskPill(d.risk)}
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="rounded-xl bg-white border border-gray-100 p-4">
                        <div className="text-sm font-semibold text-gray-900 mb-3">Delivery Schedule</div>
                        <div className="grid grid-cols-2 gap-y-2 text-sm">
                          <div className="text-gray-500">Due Date:</div>
                          <div className="text-gray-900">{d.dueDate}</div>
                          <div className="text-gray-500">Due Time:</div>
                          <div className="text-gray-900">{d.dueTime}</div>
                          <div className="text-gray-500">Hours Until Due:</div>
                          <div className={d.risk === "Critical" ? "text-red-600 font-medium" : "text-gray-900"}>{d.hoursUntilDue}</div>
                          <div className="text-gray-500">Required Qty:</div>
                          <div className="text-gray-900">{d.requiredQty.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                        <div className="text-sm font-semibold text-gray-900 mb-3">Inventory Status</div>
                        <div className="grid grid-cols-2 gap-y-2 text-sm">
                          <div className="text-blue-700">Finished Goods:</div>
                          <div className="text-blue-700 font-medium text-right">{d.finishedGoods.toLocaleString()}</div>
                          <div className="text-blue-700">WIP Stock:</div>
                          <div className="text-blue-700 font-medium text-right">{d.wipStock.toLocaleString()}</div>
                          <div className="text-blue-700">Total Available:</div>
                          <div className="text-blue-700 font-medium text-right">{d.totalAvailable.toLocaleString()}</div>
                          <div className="text-red-600">Shortfall:</div>
                          <div className="text-red-600 font-medium text-right">{d.shortfall.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className={`rounded-xl border p-4 ${d.risk === "Ready" ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
                        <div className="text-sm font-semibold text-gray-900 mb-3">Readiness Analysis</div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <div className="text-gray-500">Coverage:</div>
                          <div className={d.risk === "Ready" ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>{d.coveragePercent}%</div>
                        </div>
                        {d.risk === "Ready" ? (
                          <div className="text-xs rounded-md px-2 py-2 bg-green-100 text-green-700">
                            

 Sufficient inventory available
                          </div>
                        ) : (
                          <div className="text-xs rounded-md px-2 py-2 bg-red-100 text-red-700">
                            

 Need to produce {Math.abs(d.shortfall).toLocaleString()} more units
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )) : emptyState("No delivery readiness data", "Belum ada data delivery readiness dari endpoint shop-floor.")}
            </>
          ) : activeTab === "production-issues" ? (
            <>
              {mappedProductionIssues.length ? mappedProductionIssues.map((i) => (
                <div key={i.key} className="bg-white rounded-xl border border-gray-100">
                  <div className="px-4 py-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {issueIcon(i.priority)}
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{i.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{i.description}</div>
                        <div className="text-xs text-gray-400 mt-2">
                          Machine: {i.machine} 


 Reported by: {i.reportedBy} 


 Time: {i.time}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {issuePriorityPill(i.priority)}
                      {issueStatusPill(i.status)}
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-[11px] text-gray-500">Est. Resolution</div>
                          <div className="text-sm font-semibold text-gray-900">{i.estResolution}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-gray-500">Production Impact</div>
                          <div className="text-sm font-semibold text-gray-900">{i.productionImpact}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-gray-500">Issue ID</div>
                          <div className="text-sm font-semibold text-gray-900">{i.issueId}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )) : emptyState("No production issues", "Endpoint `production-issues` belum mengembalikan issue aktif.")}
            </>
          ) : activeTab === "scan-events" ? (
            <>
              {mappedScanEvents.length ? <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">Time</th>
                        <th className="text-left font-medium px-4 py-3">Event</th>
                        <th className="text-left font-medium px-4 py-3">Machine</th>
                        <th className="text-left font-medium px-4 py-3">UNIQ</th>
                        <th className="text-left font-medium px-4 py-3">Work Order</th>
                        <th className="text-left font-medium px-4 py-3">Operator</th>
                        <th className="text-left font-medium px-4 py-3">Process</th>
                        <th className="text-right font-medium px-4 py-3">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mappedScanEvents.map((r) => (
                        <tr key={r.key} className="text-gray-800">
                          <td className="px-4 py-3 whitespace-nowrap">{r.time}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{scanEventPill(r.event)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h2a4 4 0 014 4v2" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M6 21h12" />
                                </svg>
                              </span>
                              {r.machine}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-blue-600 font-medium">{r.uniq}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium">{r.workOrder}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1119.5 6.5" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </span>
                              {r.operator}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{r.process}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">{r.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-gray-100 bg-white">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Show rows</span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 bg-white text-gray-700">
                      10
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                    <span>1-{Math.min(10, mappedScanEvents.length)} of {mappedScanEvents.length} Results</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button type="button" className="w-8 h-8 rounded-md border border-gray-200 bg-gray-50 text-gray-400">&lt;</button>
                    <button type="button" className="w-8 h-8 rounded-md border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium">1</button>
                    <button type="button" className="w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-600 text-sm">2</button>
                    <span className="px-1 text-gray-400">…</span>
                    <button type="button" className="px-2 h-8 rounded-md border border-gray-200 bg-white text-gray-600 text-sm">12345</button>
                    <button type="button" className="w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-600">&gt;</button>
                    <span className="ml-3 text-xs text-gray-500">Go to Page</span>
                    <input className="w-14 h-8 rounded-md border border-gray-200 px-2 text-sm" defaultValue="" />
                    <button type="button" className="h-8 px-3 rounded-md border border-blue-500 bg-white text-blue-600 text-sm font-medium">Go</button>
                  </div>
                </div>
              </div> : emptyState("No scan events", "Belum ada scan event yang dikirim dari endpoint shop-floor.")}
            </>
          ) : (
            <>
              {liveLines.length ? liveLines.map((line) => (
                <button key={line.key} type="button" onClick={() => setSelectedMachineId(line.machineId)} className={`w-full text-left bg-white rounded-xl border shadow-sm transition ${line.machineId === selectedMachineId ? "border-blue-300 ring-2 ring-blue-100" : "border-gray-100 hover:border-blue-200"}`}>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h2a4 4 0 014 4v2M7 7h10M6 21h12" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{line.lineName}</div>
                        <div className="text-xs text-gray-500">{line.lineCode}{line.machineId === selectedMachineId ? " • Selected" : ""}</div>
                      </div>
                    </div>
                    {statusPill(line.status)}
                  </div>

                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                        <div className="text-sm font-semibold text-gray-900 mb-3">Current Production</div>
                        <div className="grid grid-cols-2 gap-y-2 text-sm">
                          <div className="text-gray-500">UNIQ:</div>
                          <div className="text-blue-600 font-medium">{line.currentProduction.uniq}</div>
                          <div className="text-gray-500">Work Order:</div>
                          <div className="text-blue-600 font-medium">{line.currentProduction.workOrder}</div>
                          <div className="text-gray-500">Part:</div>
                          <div className="text-gray-900">{line.currentProduction.part}</div>
                          <div className="text-gray-500">Last Scan:</div>
                          <div className="text-gray-900">{line.currentProduction.lastScan}</div>
                        </div>
                      </div>

                      <div className="rounded-xl bg-white border border-gray-100 p-4">
                        <div className="text-sm font-semibold text-gray-900 mb-3">Operator & Shift</div>
                        <div className="grid grid-cols-2 gap-y-2 text-sm">
                          <div className="text-gray-500">Operator:</div>
                          <div className="text-gray-900">{line.operator.name}</div>
                          <div className="text-gray-500">Shift Start:</div>
                          <div className="text-gray-900">{line.operator.shiftStart}</div>
                          <div className="text-gray-500">Shift State:</div>
                          <div className="text-gray-900">{line.operator.shiftState}</div>
                          <div className="text-gray-500">Next Process:</div>
                          <div className="text-gray-900">{line.operator.nextProcess}</div>
                          <div className="text-gray-500">Cycle Time:</div>
                          <div className="text-gray-900">{line.operator.cycleTime}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <div>Work Order Progress</div>
                        <div className="flex items-center gap-3">
                          <div>{line.progressPercent}% Complete</div>
                          <div className="text-gray-600">{line.progressLabel}</div>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${line.progressPercent}%` }} />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white border border-gray-100 rounded-lg p-3 text-center">
                        <div className="text-xs text-green-600">Throughput Today</div>
                        <div className="text-sm font-semibold text-gray-900">{line.bottomStats.throughputToday}</div>
                        <div className="text-xs text-gray-400">units</div>
                      </div>
                      <div className="bg-white border border-gray-100 rounded-lg p-3 text-center">
                        <div className="text-xs text-blue-600">Utilization</div>
                        <div className="text-sm font-semibold text-gray-900">{line.bottomStats.utilization}%</div>
                      </div>
                      <div className="bg-white border border-gray-100 rounded-lg p-3 text-center">
                        <div className="text-xs text-purple-600">Quality Rate</div>
                        <div className="text-sm font-semibold text-gray-900">{line.bottomStats.qualityRate}%</div>
                      </div>
                      <div className="bg-white border border-gray-100 rounded-lg p-3 text-center">
                        <div className="text-xs text-orange-600">Avg Cycle</div>
                        <div className="text-sm font-semibold text-gray-900">{line.bottomStats.avgCycleTime}</div>
                      </div>
                    </div>
                  </div>
                </button>
              )) : emptyState("No live production data", "Endpoint `live-production` belum mengembalikan mesin aktif.")}
            </>
          )}
        </div>
      </div>
    </div>
      <Modal
        open={isMachineModalOpen}
        onCancel={() => setIsMachineModalOpen(false)}
        footer={null}
        width={880}
        title={selectedLine ? `Machine Detail • ${selectedLine.lineName}` : "Machine Detail"}
      >
        {machineDetailQuery.isFetching ? (
          <div className="py-16 flex justify-center"><Spin size="large" /></div>
        ) : machineDetailQuery.error ? (
          <Alert type="error" showIcon message={getApiErrorMessage(machineDetailQuery.error, "Failed to load machine detail")} />
        ) : machineDetail ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">Machine Information</div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-gray-500">Machine Name:</div>
                  <div className="text-gray-900">{toText(machineDetail.machine_name)}</div>
                  <div className="text-gray-500">Machine Number:</div>
                  <div className="text-gray-900">{toText(machineDetail.machine_number)}</div>
                  <div className="text-gray-500">Production Line:</div>
                  <div className="text-gray-900">{toText(machineDetail.production_line)}</div>
                  <div className="text-gray-500">Capacity:</div>
                  <div className="text-gray-900">{toNumber(machineDetail.machine_capacity)}</div>
                  <div className="text-gray-500">Status:</div>
                  <div className="text-gray-900">{toText(machineDetail.status)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-blue-50 p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">Activity Summary</div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-blue-700">Open Issues:</div>
                  <div className="text-blue-700 font-medium">{machineDetail.issues?.length ?? 0}</div>
                  <div className="text-blue-700">Scan Logs:</div>
                  <div className="text-blue-700 font-medium">{machineDetail.scan_logs?.length ?? 0}</div>
                  <div className="text-blue-700">Last Updated:</div>
                  <div className="text-blue-700 font-medium">{formatRelativeTime(machineDetail.updatedAt)}</div>
                  <div className="text-blue-700">Created:</div>
                  <div className="text-blue-700 font-medium">{formatDate(machineDetail.createdAt)}</div>
                </div>
              </div>
            </div>

            {machineDetail.issues?.length ? (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">Current Issues</div>
                <div className="space-y-2">
                  {machineDetail.issues.map((issue, index) => (
                    <div key={String(issue.id ?? index)} className="rounded-lg border border-red-100 bg-white px-3 py-2 text-sm">
                      <div className="font-medium text-gray-900">{toText(issue.title ?? issue.issue_type, `Issue ${index + 1}`)}</div>
                      <div className="text-gray-500">{toText(issue.issue_description ?? issue.description, "No description")}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-900">Recent Scan Logs</div>
              {machineDetail.scan_logs?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white text-gray-600">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">Time</th>
                        <th className="text-left font-medium px-4 py-3">WO</th>
                        <th className="text-left font-medium px-4 py-3">UNIQ</th>
                        <th className="text-left font-medium px-4 py-3">Process</th>
                        <th className="text-left font-medium px-4 py-3">Operator</th>
                        <th className="text-right font-medium px-4 py-3">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {machineDetail.scan_logs.slice(0, 8).map((log, index) => (
                        <tr key={String(log.id ?? index)}>
                          <td className="px-4 py-3 whitespace-nowrap">{formatClock(log.createdAt ?? log.updatedAt ?? log.report_date ?? null)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{toText(log.work_order?.wo_number)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-blue-600 font-medium">{toText(log.item_uniq_code ?? log.wo_item?.product_details?.uniq)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{toText(log.process_name)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{toText(log.operator_name, "System")}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">{toNumber(log.good_quantity || log.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-4 py-10 text-center text-sm text-gray-500">No scan logs for this machine.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-gray-500">Select a machine to view detail.</div>
        )}
      </Modal>
    </>
  );
}
