"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Drawer,
  Input,
  Modal,
  Progress,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  PrinterOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex, type BomUniqIndex } from "@/lib/utils/bomUniq";
import WorkOrderLineExportModal, {
  buildBomDetailIndex,
  type ReportItem as WorkOrderReportItem,
} from "@/components/work-orders/WorkOrderLineReport";
import WorkOrderImportModal from "@/components/WorkOrderImportModal";
import { formatWorkOrderDisplayNumber } from "@/lib/utils/workOrder";

import {
  type RmProcessingWorkOrderRecord,
  type WorkOrderRecord,
  useBulkApproveWorkOrdersMutation,
  useGetRmProcessingWorkOrdersQuery,
  useGetRmProcessingWorkOrdersSummaryQuery,
  useGetWorkOrdersQuery,
  useGetWorkOrdersSummaryQuery,
} from "@/lib/api/work-orders/api";
import {
  type BulkWorkOrderRecord as BulkWorkOrderRecordApi,
  useBulkApproveBulkWorkOrdersMutation,
  useGetBulkWorkOrdersSummaryQuery,
  useListBulkWorkOrdersQuery,
} from "@/lib/api/work-orders/bulk/api";
import { useListPrlsQuery, type PrlRecord } from "@/lib/api/prl/api";

const { TextArea } = Input;

/* Dipakai saat uniq belum punya process route di BOM, sehingga line tidak diketahui. */
const FALLBACK_EXPORT_LINE = "UNASSIGNED";

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;
const isMissingRouteError = (error: unknown): boolean => {
  if (!isRecord(error)) return false;
  const status = error["status"];
  return typeof status === "number" && status === 404;
};

type TabKey = "workOrder" | "bulkWo" | "rmProcessing" | "robotTask";

type RobotUserApproval = "Pending" | "Approved (User)" | "Rejected";
type RobotManagerApproval =
  "Not Started" | "Awaiting Manager" | "Approved (Manager)" | "N/A";

type ApprovalStatus = "Approved" | "Pending Approval" | "Rejected";

type WorkOrderStatus = "In Progress" | "Completed" | "Draft";

type UniqStatus = "Closed" | "In Progress";

type UniqRow = {
  key: string;
  uniq: string;
  productName: string;
  quantity: string;
  status: UniqStatus;
};

type WorkOrderRow = {
  key: string;
  id?: string;
  woNumber: string;
  type: "New" | "Assembly" | "Rework" | "Additional";
  status: WorkOrderStatus;
  approvalStatus: ApprovalStatus;
  createDate: string;
  targetDate: string;
  operator: string;
  uniqTotal: number;
  uniqClosed: number;
  agingDays: number;
  uniqDetails: UniqRow[];
};

type RmProcessingRow = {
  key: string;
  id: string;
  woNumber: string;
  approvalStatus: string;
  createdDate: string;
  createdByName: string;
  sourceMaterialUniq: string;
  targetMaterialUniq: string;
  model: string;
  gradeSize: string;
  inputQty: number;
  inputUom: string;
  outputQty: number;
  outputUom: string;
  dateIssued: string;
  remarks: string;
  status: string;
  agingDays: number;
  qrDataUrl?: string;
};

type RobotTaskRow = {
  key: string;
  woNumber: string;
  robotId: string;
  uniqCount: number;
  type: WorkOrderRow["type"];
  createdDate: string;
  targetDate: string;
  userApproval: RobotUserApproval;
  managerApproval: RobotManagerApproval;
};

type BulkWoRow = {
  key: string;
  id: string;
  woNumber: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  customer: string;
  model: string;
  uniqCount: number;
  kanbanCount: number;
  totalQty: number;
  woType: string;
  status: string;
  approvalStatus: string;
  createdDate: string;
  targetDate: string;
  totalItems: number;
  sourceUniqs: string[];
};

const bulkApprovalTag = (s: string) => {
  const v = (s ?? "").toLowerCase();
  if (v.includes("approve"))
    return (
      <Tag color="blue" className="!rounded-md">
        Approved
      </Tag>
    );
  if (v.includes("reject"))
    return (
      <Tag color="red" className="!rounded-md">
        Rejected
      </Tag>
    );
  return (
    <Tag color="default" className="!rounded-md">
      Pending
    </Tag>
  );
};

const tabButtonClass = (on: boolean) =>
  "rounded-lg px-6 py-2 text-sm font-medium transition-colors border " +
  (on
    ? "bg-white text-gray-900 border-gray-200 shadow-sm"
    : "bg-transparent text-gray-600 border-transparent hover:bg-white");

const approvalTag = (s: ApprovalStatus) => {
  if (s === "Approved")
    return (
      <Tag color="blue" className="!rounded-md">
        Approved
      </Tag>
    );
  if (s === "Rejected")
    return (
      <Tag color="red" className="!rounded-md">
        Rejected
      </Tag>
    );
  return (
    <Tag color="default" className="!rounded-md">
      Pending Approval
    </Tag>
  );
};

const typeTag = (t: WorkOrderRow["type"]) => {
  if (t === "New")
    return (
      <Tag color="default" className="!rounded-md">
        New
      </Tag>
    );
  if (t === "Additional")
    return (
      <Tag color="purple" className="!rounded-md">
        Additional
      </Tag>
    );
  if (t === "Assembly")
    return (
      <Tag color="blue" className="!rounded-md">
        Assembly
      </Tag>
    );
  return (
    <Tag color="red" className="!rounded-md">
      Rework
    </Tag>
  );
};

const statusTag = (s: WorkOrderStatus) => {
  if (s === "Completed")
    return (
      <Tag color="green" className="!rounded-md">
        Completed
      </Tag>
    );
  if (s === "In Progress")
    return (
      <Tag color="blue" className="!rounded-md">
        In Progress
      </Tag>
    );
  return (
    <Tag color="default" className="!rounded-md">
      Pending
    </Tag>
  );
};

const uniqStatusTag = (s: UniqStatus) => {
  if (s === "Closed")
    return (
      <Tag color="blue" className="!rounded-md">
        Closed
      </Tag>
    );
  return (
    <Tag color="default" className="!rounded-md">
      In Progress
    </Tag>
  );
};

const withQuery = (
  path: string,
  params: Record<string, string | number | undefined | null>,
) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

const robotUserApprovalTag = (s: RobotUserApproval) => {
  if (s === "Approved (User)")
    return (
      <Tag color="green" className="!rounded-md">
        Approved (User)
      </Tag>
    );
  if (s === "Rejected")
    return (
      <Tag color="red" className="!rounded-md">
        Rejected
      </Tag>
    );
  return (
    <Tag color="default" className="!rounded-md">
      Pending
    </Tag>
  );
};

const robotManagerApprovalTag = (s: RobotManagerApproval) => {
  if (s === "Approved (Manager)")
    return (
      <Tag color="green" className="!rounded-md">
        Approved (Manager)
      </Tag>
    );
  if (s === "Awaiting Manager")
    return (
      <Tag color="gold" className="!rounded-md">
        Awaiting Manager
      </Tag>
    );
  if (s === "N/A")
    return (
      <Tag color="default" className="!rounded-md">
        N/A
      </Tag>
    );
  return (
    <Tag color="default" className="!rounded-md">
      Not Started
    </Tag>
  );
};

const INITIAL_ROBOT_TASKS: RobotTaskRow[] = [
  {
    key: "rwo-1",
    woNumber: "WO-2024-001",
    robotId: "ROBOT-001",
    uniqCount: 5,
    type: "New",
    createdDate: "2024-01-23",
    targetDate: "2024-02-05",
    userApproval: "Pending",
    managerApproval: "Not Started",
  },
  {
    key: "rwo-2",
    woNumber: "WO-2024-002",
    robotId: "ROBOT-002",
    uniqCount: 3,
    type: "Assembly",
    createdDate: "2024-01-22",
    targetDate: "2024-02-03",
    userApproval: "Approved (User)",
    managerApproval: "Awaiting Manager",
  },
  {
    key: "rwo-3",
    woNumber: "WO-2024-003",
    robotId: "ROBOT-001",
    uniqCount: 8,
    type: "New",
    createdDate: "2024-01-21",
    targetDate: "2024-02-10",
    userApproval: "Approved (User)",
    managerApproval: "Approved (Manager)",
  },
  {
    key: "rwo-4",
    woNumber: "WO-2024-004",
    robotId: "ROBOT-003",
    uniqCount: 2,
    type: "Rework",
    createdDate: "2024-01-20",
    targetDate: "2024-01-28",
    userApproval: "Rejected",
    managerApproval: "N/A",
  },
];

// const INITIAL_WORK_ORDERS: WorkOrderRow[] = [
//   {
//     key: "wo-1",
//     woNumber: "WO-2024-001",
//     type: "New",
//     status: "In Progress",
//     approvalStatus: "Approved",
//     createDate: "1/10/2024",
//     targetDate: "1/25/2024",
//     operator: "John Smith",
//     uniqTotal: 3,
//     uniqClosed: 2,
//     agingDays: 2,
//     uniqDetails: [
//       { key: "u-1", uniq: "LV7-001", productName: "Engine Mount Assembly", quantity: "100 pcs", status: "Closed" },
//       { key: "u-2", uniq: "LV7-002", productName: "Engine Mount Base", quantity: "150 pcs", status: "Closed" },
//       { key: "u-3", uniq: "LV8-003", productName: "Suspension Arm", quantity: "80 pcs", status: "In Progress" },
//     ],
//   },
//   {
//     key: "wo-2",
//     woNumber: "WO-2024-002",
//     type: "New",
//     status: "Completed",
//     approvalStatus: "Approved",
//     createDate: "1/5/2024",
//     targetDate: "1/18/2024",
//     operator: "Maria Garcia",
//     uniqTotal: 5,
//     uniqClosed: 5,
//     agingDays: 11,
//     uniqDetails: [
//       { key: "u-21", uniq: "LV9-001", productName: "Bracket A", quantity: "50 pcs", status: "Closed" },
//       { key: "u-22", uniq: "LV9-002", productName: "Bracket B", quantity: "50 pcs", status: "Closed" },
//       { key: "u-23", uniq: "LV9-003", productName: "Bracket C", quantity: "50 pcs", status: "Closed" },
//       { key: "u-24", uniq: "LV9-004", productName: "Bracket D", quantity: "50 pcs", status: "Closed" },
//       { key: "u-25", uniq: "LV9-005", productName: "Bracket E", quantity: "50 pcs", status: "Closed" },
//     ],
//   },
//   {
//     key: "wo-3",
//     woNumber: "WO-2024-003",
//     type: "Assembly",
//     status: "Draft",
//     approvalStatus: "Pending Approval",
//     createDate: "1/20/2024",
//     targetDate: "2/5/2024",
//     operator: "Not Assigned",
//     uniqTotal: 2,
//     uniqClosed: 0,
//     agingDays: 0,
//     uniqDetails: [
//       { key: "u-31", uniq: "LV2-001", productName: "Harness", quantity: "20 pcs", status: "In Progress" },
//       { key: "u-32", uniq: "LV2-002", productName: "Connector", quantity: "20 pcs", status: "In Progress" },
//     ],
//   },
//   {
//     key: "wo-4",
//     woNumber: "WO-2024-004",
//     type: "New",
//     status: "In Progress",
//     approvalStatus: "Approved",
//     createDate: "1/8/2024",
//     targetDate: "2/10/2024",
//     operator: "Ahmad Rahman",
//     uniqTotal: 150,
//     uniqClosed: 75,
//     agingDays: 2,
//     uniqDetails: [
//       { key: "u-41", uniq: "LV1-001", productName: "Component A", quantity: "100 pcs", status: "In Progress" },
//       { key: "u-42", uniq: "LV1-002", productName: "Component B", quantity: "50 pcs", status: "Closed" },
//     ],
//   },
//   {
//     key: "wo-5",
//     woNumber: "WO-2024-005",
//     type: "Rework",
//     status: "Draft",
//     approvalStatus: "Rejected",
//     createDate: "1/22/2024",
//     targetDate: "2/1/2024",
//     operator: "Not Assigned",
//     uniqTotal: 1,
//     uniqClosed: 0,
//     agingDays: 0,
//     uniqDetails: [
//       { key: "u-51", uniq: "LV3-001", productName: "Rework Item", quantity: "1 lot", status: "In Progress" },
//     ],
//   },
// ];

const INITIAL_RM_PROCESSING_ROWS: RmProcessingRow[] = [];

const formatDisplayDate = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US");
};

const normalizeType = (value?: string): WorkOrderRow["type"] => {
  const lower = String(value ?? "")
    .trim()
    .toLowerCase();
  if (lower === "assembly") return "Assembly";
  if (lower === "rework") return "Rework";
  if (lower === "additional") return "Additional";
  return "New";
};

const normalizeStatus = (value?: string): WorkOrderStatus => {
  const lower = String(value ?? "")
    .trim()
    .toLowerCase();
  if (lower.includes("complete")) return "Completed";
  if (lower.includes("progress") || lower.includes("process"))
    return "In Progress";
  return "Draft";
};

const normalizeApproval = (value?: string): ApprovalStatus => {
  const lower = String(value ?? "")
    .trim()
    .toLowerCase();
  if (lower.includes("reject")) return "Rejected";
  if (lower.includes("approve")) return "Approved";
  return "Pending Approval";
};

const normalizeUniqItemStatus = (value?: string): UniqStatus => {
  const lower = String(value ?? "")
    .trim()
    .toLowerCase();
  if (lower.includes("close") || lower.includes("complete")) return "Closed";
  return "In Progress";
};

const toWorkOrderRow = (
  record: WorkOrderRecord,
  bomIndex: BomUniqIndex,
): WorkOrderRow => {
  const uniqDetails = record.items.map((item, index) => ({
    key: item.id || `${record.id}-item-${index}`,
    uniq: item.item_uniq_code,
    productName:
      item.part_name ?? bomIndex.partNameByUniq[item.item_uniq_code] ?? "-",
    quantity: `${item.quantity} ${item.uom || "pcs"}`,
    status: normalizeUniqItemStatus(item.status),
  }));

  const uniqClosed =
    typeof record.uniq_closed === "number"
      ? record.uniq_closed
      : uniqDetails.filter((item) => item.status === "Closed").length;

  return {
    key: record.id || record.wo_number,
    id: record.id,
    woNumber: formatWorkOrderDisplayNumber(record.wo_number) || "-",
    type: normalizeType(record.wo_type),
    status: normalizeStatus(record.status),
    approvalStatus: normalizeApproval(record.approval_status),
    createDate: formatDisplayDate(record.created_at),
    targetDate: formatDisplayDate(record.target_date),
    operator: record.operator_name || "Not Assigned",
    uniqTotal:
      typeof record.uniq_total === "number"
        ? record.uniq_total
        : uniqDetails.length,
    uniqClosed,
    agingDays: Number(record.aging_days ?? 0),
    uniqDetails,
  };
};

const toRmProcessingRow = (
  record: RmProcessingWorkOrderRecord,
): RmProcessingRow => ({
  key: record.id,
  id: record.id,
  woNumber: formatWorkOrderDisplayNumber(record.wo_number) || "-",
  approvalStatus: record.approval_status ?? "-",
  createdDate: formatDisplayDate(record.created_date ?? record.created_at),
  createdByName: record.created_by_name ?? "-",
  sourceMaterialUniq: record.source_material_uniq ?? "-",
  targetMaterialUniq: record.target_material_uniq ?? "-",
  model: record.model ?? "-",
  gradeSize: record.grade_size ?? "-",
  inputQty: Number(record.input_qty ?? 0),
  inputUom: record.input_uom ?? "-",
  outputQty: Number(record.output_qty ?? 0),
  outputUom: record.output_uom ?? "-",
  dateIssued: formatDisplayDate(record.date_issued),
  remarks: record.remarks ?? "-",
  status: record.status ?? "Pending",
  agingDays: Number(record.aging_days ?? 0),
  qrDataUrl: record.qr_data_url ?? undefined,
});

const toBulkWoRow = (record: BulkWorkOrderRecordApi): BulkWoRow => ({
  key: record.id,
  id: record.id,
  woNumber: formatWorkOrderDisplayNumber(record.wo_number) || "-",
  sourceDocumentType: record.source_document_type ?? "-",
  sourceDocumentId: record.source_document_id ?? "-",
  customer: record.customer_name ?? "-",
  model: record.model ?? "-",
  uniqCount: Number(record.uniq_count ?? 0),
  kanbanCount: Number(record.kanban_count ?? record.total_items ?? 0),
  totalQty: Number(record.total_qty ?? 0),
  woType: record.wo_type ?? "-",
  status: record.status ?? "-",
  approvalStatus: record.approval_status ?? "-",
  createdDate: formatDisplayDate(record.created_date),
  targetDate: formatDisplayDate(record.target_date),
  totalItems: Number(record.total_items ?? 0),
  sourceUniqs: record.source_uniqs ?? [],
});

export default function WorkOrdersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("workOrder");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    const validTabs: TabKey[] = [
      "workOrder",
      "bulkWo",
      "rmProcessing",
      "robotTask",
    ];
    if (tab && (validTabs as string[]).includes(tab)) {
      setActiveTab(tab as TabKey);
    }
  }, []);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [rmPage, setRmPage] = useState(1);
  const [rmLimit, setRmLimit] = useState(20);
  const [rmQrModal, setRmQrModal] = useState<RmProcessingRow | null>(null);
  const [bulkWoPage, setBulkWoPage] = useState(1);
  const [bulkWoLimit, setBulkWoLimit] = useState(20);
  const [bulkWoSearch, setBulkWoSearch] = useState("");
  const apiEnabled = Boolean(apiBaseUrl);

  const [mockWorkOrders, setMockWorkOrders] = useState<WorkOrderRow[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string>>([]);
  const [selectedRows, setSelectedRows] = useState<WorkOrderRow[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkNote, setBulkNote] = useState("");
  /* Modal export "Work Order per Line" (format PDF acuan). */
  const [lineExportOpen, setLineExportOpen] = useState(false);
  const [importBulkOpen, setImportBulkOpen] = useState(false);

  const [bulkApproveWorkOrders, bulkApproveState] =
    useBulkApproveWorkOrdersMutation();

  const [bulkWoSelectedRowKeys, setBulkWoSelectedRowKeys] = useState<
    Array<string>
  >([]);
  const [bulkWoSelectedRows, setBulkWoSelectedRows] = useState<BulkWoRow[]>([]);
  const [bulkWoBulkOpen, setBulkWoBulkOpen] = useState(false);
  const [bulkWoBulkNote, setBulkWoBulkNote] = useState("");

  const bulkWoListQuery = useListBulkWorkOrdersQuery(
    { page: bulkWoPage, limit: bulkWoLimit },
    { skip: !apiEnabled || activeTab !== "bulkWo" },
  );
  const bulkWoSummaryQuery = useGetBulkWorkOrdersSummaryQuery(undefined, {
    skip: !apiEnabled || activeTab !== "bulkWo",
  });
  const [bulkApproveBulkWos, bulkApproveBulkWosState] =
    useBulkApproveBulkWorkOrdersMutation();

  // Fallback enrichment: the running backend may not yet return
  // source_document_id/customer_name on the bulk list. Derive PRL Reference and
  // Customer from the PRL list (match by uniq, then uniquely by model) so the
  // columns populate on the frontend. Backend-provided values always win.
  const bulkWoPrlQuery = useListPrlsQuery(
    { page: 1, limit: 1000 },
    { skip: !apiEnabled || activeTab !== "bulkWo" },
  );

  const bulkWoPrlIndex = useMemo(() => {
    const list: PrlRecord[] = Array.isArray(bulkWoPrlQuery.data)
      ? bulkWoPrlQuery.data
      : [];
    const byUniq = new Map<string, { prlId: string; customer: string }>();
    const byModel = new Map<
      string,
      { prlIds: Set<string>; customers: Set<string> }
    >();
    for (const p of list) {
      const prlId = (p.prl_id ?? "").trim();
      const customer = (
        p.customer_name ??
        p.customer?.customer_name ??
        ""
      ).trim();
      for (const u of [p.uniq_code, p.item_uniq_code]) {
        const key = (u ?? "").trim().toLowerCase();
        if (key) byUniq.set(key, { prlId, customer });
      }
      const model = (p.product_model ?? "").trim().toLowerCase();
      if (model) {
        const entry = byModel.get(model) ?? {
          prlIds: new Set<string>(),
          customers: new Set<string>(),
        };
        if (prlId) entry.prlIds.add(prlId);
        if (customer) entry.customers.add(customer);
        byModel.set(model, entry);
      }
    }
    return { byUniq, byModel };
  }, [bulkWoPrlQuery.data]);

  const bulkWoRowsAll = useMemo(() => {
    const rows = bulkWoListQuery.data?.items?.map(toBulkWoRow) ?? [];
    const { byUniq, byModel } = bulkWoPrlIndex;
    return rows.map((row) => {
      let prlId =
        row.sourceDocumentId && row.sourceDocumentId !== "-"
          ? row.sourceDocumentId
          : "";
      let customer = row.customer && row.customer !== "-" ? row.customer : "";
      if (!prlId || !customer) {
        for (const u of row.sourceUniqs) {
          const hit = byUniq.get((u ?? "").trim().toLowerCase());
          if (hit) {
            if (!prlId && hit.prlId) prlId = hit.prlId;
            if (!customer && hit.customer) customer = hit.customer;
            break;
          }
        }
      }
      if (!prlId || !customer) {
        const model = (row.model ?? "").trim().toLowerCase();
        const entry = model ? byModel.get(model) : undefined;
        if (entry) {
          if (!prlId && entry.prlIds.size === 1) prlId = [...entry.prlIds][0];
          if (!customer && entry.customers.size === 1)
            customer = [...entry.customers][0];
        }
      }
      return {
        ...row,
        sourceDocumentId: prlId || "-",
        customer: customer || "-",
      };
    });
  }, [bulkWoListQuery.data, bulkWoPrlIndex]);

  const bulkWoRows = useMemo(() => {
    const q = bulkWoSearch.trim().toLowerCase();
    if (!q) return bulkWoRowsAll;
    return bulkWoRowsAll.filter((r) =>
      [
        r.woNumber,
        r.sourceDocumentType,
        r.sourceDocumentId,
        r.woType,
        r.status,
        r.approvalStatus,
      ]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [bulkWoRowsAll, bulkWoSearch]);
  const [robotTasks, setRobotTasks] =
    useState<RobotTaskRow[]>(INITIAL_ROBOT_TASKS);
  const [mockRmProcessingRows] = useState<RmProcessingRow[]>(
    INITIAL_RM_PROCESSING_ROWS,
  );

  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });
  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data],
  );
  /**
   * Index tambahan dari BOM tree yang SAMA (tidak ada request baru).
   * buildBomUniqIndex membuang quantity dan process_routes, padahal keduanya
   * dibutuhkan untuk daftar material + machine/cycle time di laporan per line.
   */
  const bomDetail = useMemo(
    () => buildBomDetailIndex(bomTreeRes?.data ?? []),
    [bomTreeRes?.data],
  );
  const workOrdersPagedQuery = useGetWorkOrdersQuery(
    { page, limit },
    {
      skip: !apiEnabled,
    },
  );
  const workOrdersSummaryQuery = useGetWorkOrdersSummaryQuery(undefined, {
    skip: !apiEnabled,
  });
  const rmProcessingQuery = useGetRmProcessingWorkOrdersQuery(
    { page: rmPage, limit: rmLimit },
    {
      skip: !apiEnabled,
    },
  );
  const rmProcessingSummaryQuery = useGetRmProcessingWorkOrdersSummaryQuery(
    undefined,
    {
      skip: !apiEnabled,
    },
  );

  const liveWorkOrders = useMemo(
    () =>
      workOrdersPagedQuery.data?.items.map((item) =>
        toWorkOrderRow(item, bomIndex),
      ) ?? [],
    [bomIndex, workOrdersPagedQuery.data],
  );

  const workOrders = useMemo(() => {
    if (apiEnabled && !workOrdersPagedQuery.isError) {
      return liveWorkOrders;
    }
    return mockWorkOrders;
  }, [
    apiEnabled,
    liveWorkOrders,
    mockWorkOrders,
    workOrdersPagedQuery.isError,
  ]);

  const rmProcessingRows = useMemo(() => {
    if (apiEnabled && !rmProcessingQuery.isError) {
      return rmProcessingQuery.data?.items?.map(toRmProcessingRow) ?? [];
    }
    return mockRmProcessingRows;
  }, [
    apiEnabled,
    mockRmProcessingRows,
    rmProcessingQuery.data,
    rmProcessingQuery.isError,
  ]);

  console.log(workOrders, "AKSJDN");

  const openPrintDetail = (url: string) => {
    window.open(
      withQuery(url, { autoPrint: 1 }),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const buildBulkWoDetailUrl = (row: BulkWoRow) =>
    withQuery(`/work-orders/bulk/detail/${encodeURIComponent(row.id)}`, {
      woNumber: row.woNumber,
      sourceDocumentType: row.sourceDocumentType,
      sourceDocumentId: row.sourceDocumentId,
      woType: row.woType,
      status: row.status,
      approvalStatus: row.approvalStatus,
      createdDate: row.createdDate,
      targetDate: row.targetDate,
      totalItems: row.totalItems,
    });

  const buildRmProcessingDetailUrl = (row: RmProcessingRow) =>
    withQuery(
      `/work-orders/rm-processing/detail/${encodeURIComponent(row.id)}`,
      {
        woNumber: row.woNumber,
        approvalStatus: row.approvalStatus,
        createdDate: row.createdDate,
        createdByName: row.createdByName,
        sourceMaterialUniq: row.sourceMaterialUniq,
        targetMaterialUniq: row.targetMaterialUniq,
        model: row.model,
        gradeSize: row.gradeSize,
        inputQty: row.inputQty,
        inputUom: row.inputUom,
        outputQty: row.outputQty,
        outputUom: row.outputUom,
        dateIssued: row.dateIssued,
        remarks: row.remarks,
        status: row.status,
        agingDays: row.agingDays,
      },
    );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const byTab = workOrders.filter((r) => {
      if (activeTab === "rmProcessing") return r.type === "Assembly";
      return true;
    });

    if (!q) return byTab;
    return byTab.filter((r) =>
      [r.woNumber, r.operator, r.type, r.status, r.approvalStatus].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [activeTab, search, workOrders]);

  /**
   * Ubah WO yang dicentang di tabel menjadi baris laporan per line.
   * Satu WO bisa punya beberapa uniq, dan tiap uniq jadi satu baris laporan.
   */
  const lineExportItems = useMemo<WorkOrderReportItem[]>(() => {
    const items: WorkOrderReportItem[] = [];

    for (const row of selectedRows) {
      for (const detail of row.uniqDetails) {
        const uniq = (detail.uniq ?? "").trim();
        /* uniqDetails.quantity berbentuk string "60 pcs", ambil angkanya. */
        const woQty = Number.parseFloat(String(detail.quantity)) || 0;

        const routes = bomDetail.routesByUniq[uniq] ?? [];
        const primaryRoute = routes[0];
        const cycleSec = routes.reduce(
          (acc, route) => acc + (route.cycleTimeSec || 0),
          0,
        );

        const snpRaw = bomDetail.snpByUniq[uniq];
        const snp = snpRaw && snpRaw > 0 ? snpRaw : woQty;
        const labelCount = snp > 0 ? Math.ceil(woQty / snp) : 1;

        const materials = (bomDetail.materialsByUniq[uniq] ?? []).map(
          (material) => ({
            code: material.code,
            name: material.name,
            reqQty: (material.qtyPerUniq || 0) * woQty,
            uom: material.uom,
            /* Tidak ada sumber data lokasi rak per material di database. */
            position: "-",
          }),
        );

        items.push({
          key: `${row.key}::${detail.key}`,
          woNumber: row.woNumber,
          requestCode: uniq ? `KR/${uniq}` : row.woNumber,
          fgCode: uniq || "-",
          partNo: bomIndex.partNumberByUniq[uniq] ?? "",
          itemName: detail.productName || "-",
          woQty,
          actualQty: woQty,
          line: primaryRoute?.processName || FALLBACK_EXPORT_LINE,
          machine: primaryRoute?.machineName || "",
          cycleSec,
          labelCount,
          snp,
          productionDate: row.targetDate || row.createDate || "-",
          /* Plant/location belum ada sumbernya di data work order. */
          location: "-",
          materials,
        });
      }
    }

    return items;
  }, [bomDetail, bomIndex, selectedRows]);

  const metrics = useMemo(() => {
    const isRm = activeTab === "rmProcessing";

    if (isRm) {
      if (apiEnabled && rmProcessingSummaryQuery.data) {
        return {
          active: rmProcessingSummaryQuery.data.active_wos,
          completed: rmProcessingSummaryQuery.data.completed,
          pending: rmProcessingSummaryQuery.data.pending_wos,
          uniqs: rmProcessingSummaryQuery.data.total_uniqs,
        };
      }

      const completed = rmProcessingRows.filter(
        (r) => r.status.toLowerCase() === "completed",
      ).length;
      const pending = rmProcessingRows.filter(
        (r) =>
          r.status.toLowerCase() === "draft" ||
          r.status.toLowerCase() === "pending",
      ).length;
      const active = Math.max(0, rmProcessingRows.length - completed - pending);
      const uniqs = new Set(
        rmProcessingRows.map((r) => r.sourceMaterialUniq).filter(Boolean),
      ).size;
      return { active, completed, pending, uniqs };
    }

    if (apiEnabled && workOrdersSummaryQuery.data) {
      return {
        active: workOrdersSummaryQuery.data.active_wos,
        completed: workOrdersSummaryQuery.data.completed,
        pending: workOrdersSummaryQuery.data.pending_wos,
        uniqs: workOrdersSummaryQuery.data.total_uniqs,
      };
    }
    const active = workOrders.filter((r) => r.status === "In Progress").length;
    const completed = workOrders.filter((r) => r.status === "Completed").length;
    const pending = workOrders.filter((r) => r.status === "Draft").length;
    const uniqs = workOrders.reduce((acc, r) => acc + r.uniqTotal, 0);
    return { active, completed, pending, uniqs };
  }, [
    activeTab,
    apiEnabled,
    rmProcessingRows,
    rmProcessingSummaryQuery.data,
    workOrders,
    workOrdersSummaryQuery.data,
  ]);

  const bulkTotalUniqs = useMemo(
    () => selectedRows.reduce((acc, r) => acc + r.uniqTotal, 0),
    [selectedRows],
  );

  const applyBulk = async (nextStatus: ApprovalStatus) => {
    if (!selectedRows.length) return;

    if (!apiEnabled) {
      setMockWorkOrders((prev) =>
        prev.map((w) =>
          selectedRowKeys.includes(w.key)
            ? {
                ...w,
                approvalStatus: nextStatus,
              }
            : w,
        ),
      );

      message.success(`Bulk ${nextStatus.toLowerCase()} applied (mock)`);
      setBulkOpen(false);
      setBulkNote("");
      setSelectedRowKeys([]);
      setSelectedRows([]);
      return;
    }

    const decision = nextStatus === "Approved" ? "approve" : "reject";
    const wo_numbers = selectedRows.map((r) => r.woNumber).filter(Boolean);
    if (!wo_numbers.length) {
      message.error("No WO selected");
      return;
    }

    try {
      await bulkApproveWorkOrders({
        decision,
        wo_numbers,
        notes: bulkNote.trim() ? bulkNote.trim() : null,
      }).unwrap();
      message.success("Bulk approval submitted");
      setBulkOpen(false);
      setBulkNote("");
      setSelectedRowKeys([]);
      setSelectedRows([]);
    } catch {
      message.error("Failed to submit bulk approval");
    }
  };

  const applyBulkWoApproval = async (decision: "approve" | "reject") => {
    if (!bulkWoSelectedRows.length) return;

    if (!apiEnabled) {
      message.warning("Bulk WO approval requires API connection");
      return;
    }

    const wo_numbers = bulkWoSelectedRows
      .map((r) => r.woNumber)
      .filter(Boolean);
    if (!wo_numbers.length) {
      message.error("No WO selected");
      return;
    }

    try {
      await bulkApproveBulkWos({
        decision,
        wo_numbers,
        notes: bulkWoBulkNote.trim() ? bulkWoBulkNote.trim() : null,
      }).unwrap();
      message.success("Bulk WO approval submitted");
      setBulkWoBulkOpen(false);
      setBulkWoBulkNote("");
      setBulkWoSelectedRowKeys([]);
      setBulkWoSelectedRows([]);
    } catch {
      message.error("Failed to submit bulk WO approval");
    }
  };

  const isWorkOrderTab = activeTab === "workOrder";
  const isBulkWoTab = activeTab === "bulkWo";
  const isRmProcessingTab = activeTab === "rmProcessing";
  const isRobotTaskTab = activeTab === "robotTask";

  const robotMetrics = useMemo(() => {
    const pendingUser = robotTasks.filter(
      (r) => r.userApproval === "Pending",
    ).length;
    const pendingManager = robotTasks.filter(
      (r) => r.managerApproval === "Awaiting Manager",
    ).length;
    const fullyApproved = robotTasks.filter(
      (r) =>
        r.userApproval === "Approved (User)" &&
        r.managerApproval === "Approved (Manager)",
    ).length;
    const rejected = robotTasks.filter(
      (r) => r.userApproval === "Rejected",
    ).length;
    return { pendingUser, pendingManager, fullyApproved, rejected };
  }, [robotTasks]);

  const approveRobotUser = (key: string) => {
    setRobotTasks((prev) =>
      prev.map((r) =>
        r.key !== key
          ? r
          : {
              ...r,
              userApproval: "Approved (User)",
              managerApproval:
                r.managerApproval === "N/A"
                  ? "Not Started"
                  : "Awaiting Manager",
            },
      ),
    );
    message.success("User approval applied (mock)");
  };

  const rejectRobotUser = (key: string) => {
    setRobotTasks((prev) =>
      prev.map((r) =>
        r.key !== key
          ? r
          : {
              ...r,
              userApproval: "Rejected",
              managerApproval: "N/A",
            },
      ),
    );
    message.success("Rejected (mock)");
  };

  const approveRobotManager = (key: string) => {
    setRobotTasks((prev) =>
      prev.map((r) =>
        r.key !== key
          ? r
          : {
              ...r,
              managerApproval: "Approved (Manager)",
            },
      ),
    );
    message.success("Manager approval applied (mock)");
  };

  const moveRobotWoToMain = (key: string) => {
    const row = robotTasks.find((r) => r.key === key);
    if (!row) return;
    if (
      row.userApproval !== "Approved (User)" ||
      row.managerApproval !== "Approved (Manager)"
    ) {
      message.warning("WO must be fully approved first");
      return;
    }

    setMockWorkOrders((prev) => [
      {
        key: `wo-robot-${Date.now()}`,
        woNumber: row.woNumber,
        type: row.type,
        status: "Draft",
        approvalStatus: "Approved",
        createDate: row.createdDate,
        targetDate: row.targetDate,
        operator: "Not Assigned",
        uniqTotal: row.uniqCount,
        uniqClosed: 0,
        agingDays: 0,
        uniqDetails: [],
      },
      ...prev,
    ]);

    setRobotTasks((prev) => prev.filter((r) => r.key !== key));
    message.success("Moved to main Work Order table (mock)");
  };

  const uniqColumns: ColumnsType<UniqRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      width: 120,
      render: (v: string) => (
        <span className="text-sm font-semibold text-gray-900">{v}</span>
      ),
    },
    {
      title: "Product Name",
      dataIndex: "productName",
      key: "productName",
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      width: 120,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (v: UniqStatus) => uniqStatusTag(v),
    },
  ];

  const columns: ColumnsType<WorkOrderRow> = [
    {
      title: "WO Number",
      dataIndex: "woNumber",
      key: "woNumber",
      width: 140,
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "UNIQs (Count)",
      key: "uniqCount",
      width: 120,
      render: (_: unknown, r) => (
        <div className="text-sm text-gray-800">
          <span className="font-semibold">{r.uniqTotal}</span> UNIQs
        </div>
      ),
    },
    {
      title: "Progress",
      key: "progress",
      width: 170,
      render: (_: unknown, r) => {
        const pct = r.uniqTotal
          ? Math.round((r.uniqClosed / r.uniqTotal) * 100)
          : 0;
        return (
          <div className="min-w-[160px]">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>
                <span className="font-semibold text-gray-900">
                  {r.uniqClosed}
                </span>
                /{r.uniqTotal} Closed
              </span>
              <span className="text-gray-500">{pct}%</span>
            </div>
            <Progress
              percent={pct}
              showInfo={false}
              strokeColor="#3b82f6"
              trailColor="#e5e7eb"
            />
          </div>
        );
      },
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 110,
      render: (v: WorkOrderRow["type"]) => typeTag(v),
    },
    // {
    //   title: "Status",
    //   dataIndex: "status",
    //   key: "status",
    //   width: 120,
    //   render: (v: WorkOrderStatus) => statusTag(v),
    // },
    {
      title: "Approval Status",
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      width: 150,
      render: (v: ApprovalStatus) => approvalTag(v),
    },
    {
      title: "Create Date",
      dataIndex: "createDate",
      key: "createDate",
      width: 110,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Target Date",
      dataIndex: "targetDate",
      key: "targetDate",
      width: 110,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Aging (Days)",
      dataIndex: "agingDays",
      key: "agingDays",
      width: 110,
      render: (v: number) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
          {v} days
        </span>
      ),
    },
    {
      title: "Operator",
      dataIndex: "operator",
      key: "operator",
      width: 140,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      fixed: "right",
      render: (_: unknown, r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              const target = r.id
                ? `/work-orders/detail/${encodeURIComponent(r.id)}`
                : undefined;
              if (target) {
                router.push(target);
                return;
              }
              message.info(`View ${r.woNumber} (mock)`);
            }}
          />
          <Button
            size="small"
            type="text"
            icon={<PrinterOutlined />}
            onClick={() => {
              if (!r.id) {
                message.info(`Print ${r.woNumber} (mock)`);
                return;
              }
              openPrintDetail(
                `/work-orders/detail/${encodeURIComponent(r.id)}`,
              );
            }}
          />
        </div>
      ),
    },
  ];

  const robotColumns: ColumnsType<RobotTaskRow> = [
    {
      title: "WO Number",
      dataIndex: "woNumber",
      key: "woNumber",
      width: 140,
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "Robot ID",
      dataIndex: "robotId",
      key: "robotId",
      width: 120,
      render: (v: string) => (
        <span className="inline-flex items-center gap-2 text-sm text-gray-800">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 text-xs font-bold">
            R
          </span>
          {v}
        </span>
      ),
    },
    {
      title: "UNIQs (Count)",
      dataIndex: "uniqCount",
      key: "uniqCount",
      width: 120,
      render: (v: number) => (
        <div className="text-sm text-gray-800">
          <span className="font-semibold">{v}</span> UNIQs
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 110,
      render: (v: RobotTaskRow["type"]) => typeTag(v),
    },
    {
      title: "Created Date",
      dataIndex: "createdDate",
      key: "createdDate",
      width: 120,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Target Date",
      dataIndex: "targetDate",
      key: "targetDate",
      width: 120,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "User Approval",
      dataIndex: "userApproval",
      key: "userApproval",
      width: 140,
      render: (v: RobotUserApproval) => robotUserApprovalTag(v),
    },
    {
      title: "Manager Approval",
      dataIndex: "managerApproval",
      key: "managerApproval",
      width: 150,
      render: (v: RobotManagerApproval) => robotManagerApprovalTag(v),
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      fixed: "right",
      render: (_: unknown, r) => {
        const canUserApprove = r.userApproval === "Pending";
        const canManagerApprove =
          r.userApproval === "Approved (User)" &&
          r.managerApproval === "Awaiting Manager";
        const canMove =
          r.userApproval === "Approved (User)" &&
          r.managerApproval === "Approved (Manager)";

        return (
          <div className="flex items-center justify-end gap-2">
            {canUserApprove ? (
              <>
                <Button
                  size="small"
                  type="primary"
                  className="!rounded-lg"
                  onClick={() => approveRobotUser(r.key)}
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  danger
                  className="!rounded-lg"
                  onClick={() => rejectRobotUser(r.key)}
                >
                  Reject
                </Button>
              </>
            ) : null}

            {canManagerApprove ? (
              <Button
                size="small"
                className="!rounded-lg"
                onClick={() => approveRobotManager(r.key)}
              >
                Manager Review
              </Button>
            ) : null}

            {canMove ? (
              <Button
                size="small"
                className="!rounded-lg"
                onClick={() => moveRobotWoToMain(r.key)}
              >
                Move to Main WO
              </Button>
            ) : null}

            {!canUserApprove && !canManagerApprove && !canMove ? (
              <Button
                size="small"
                type="text"
                onClick={() => message.info(`View ${r.woNumber} (mock)`)}
              >
                View
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  const rmProcessingColumns: ColumnsType<RmProcessingRow> = [
    { title: "WO Number", dataIndex: "woNumber", key: "woNumber", width: 170 },
    {
      title: "Created Date",
      dataIndex: "createdDate",
      key: "createdDate",
      width: 120,
    },
    {
      title: "Created By",
      dataIndex: "createdByName",
      key: "createdByName",
      width: 140,
    },
    {
      title: "Approval",
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      width: 120,
      render: (value: string) => {
        const v = String(value || "-");
        const lowered = v.toLowerCase();
        const color = lowered.includes("approved")
          ? "green"
          : lowered.includes("reject")
            ? "red"
            : "gold";
        return (
          <Tag color={color} className="!rounded-md">
            {v}
          </Tag>
        );
      },
    },
    {
      title: "Source UNIQ",
      dataIndex: "sourceMaterialUniq",
      key: "sourceMaterialUniq",
      width: 150,
    },
    {
      title: "Target UNIQ",
      dataIndex: "targetMaterialUniq",
      key: "targetMaterialUniq",
      width: 150,
    },
    { title: "Model", dataIndex: "model", key: "model", width: 160 },
    {
      title: "Grade / Size",
      dataIndex: "gradeSize",
      key: "gradeSize",
      width: 200,
    },
    {
      title: "Input",
      key: "input",
      width: 120,
      render: (_: unknown, r) => (
        <span className="text-sm text-gray-800">
          {r.inputQty} {r.inputUom}
        </span>
      ),
    },
    {
      title: "Output",
      key: "output",
      width: 120,
      render: (_: unknown, r) => (
        <span className="text-sm text-gray-800">
          {r.outputQty} {r.outputUom}
        </span>
      ),
    },
    {
      title: "Date Issued",
      dataIndex: "dateIssued",
      key: "dateIssued",
      width: 120,
    },
    {
      title: "Aging (Days)",
      dataIndex: "agingDays",
      key: "agingDays",
      width: 110,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string) => (
        <Tag color="blue" className="!rounded-md">
          {value}
        </Tag>
      ),
    },
    {
      title: "Remarks",
      dataIndex: "remarks",
      key: "remarks",
      render: (value: string) => (
        <span className="text-sm text-gray-700">{value}</span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      fixed: "right",
      render: (_: unknown, row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => setRmQrModal(row)}
          />
          <Button
            size="small"
            type="text"
            icon={<PrinterOutlined />}
            onClick={() => openPrintDetail(buildRmProcessingDetailUrl(row))}
          />
        </div>
      ),
    },
  ];

  const bulkStatusText = (v: string) => {
    const low = (v || "").toLowerCase();
    let cls = "text-gray-600";
    if (low.includes("progress")) cls = "text-blue-600";
    else if (low.includes("complete") || low.includes("done"))
      cls = "text-green-600";
    else if (low.includes("generat")) cls = "text-blue-600";
    return <span className={`text-sm ${cls}`}>{v || "-"}</span>;
  };

  const bulkWoColumns: ColumnsType<BulkWoRow> = [
    {
      title: "Bulk WO ID",
      dataIndex: "woNumber",
      key: "woNumber",
      width: 160,
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "PRL Reference",
      dataIndex: "sourceDocumentId",
      key: "prlReference",
      width: 150,
      render: (v: string) => (
        <span className="text-sm font-medium text-blue-600">{v || "-"}</span>
      ),
    },
    {
      title: "Customer",
      dataIndex: "customer",
      key: "customer",
      width: 130,
      render: (v: string) => (
        <span className="text-sm text-gray-800">{v || "-"}</span>
      ),
    },
    {
      title: "Model",
      dataIndex: "model",
      key: "model",
      width: 140,
      render: (v: string) => (
        <span className="text-sm text-gray-800">{v || "-"}</span>
      ),
    },
    {
      title: "UNIQs",
      dataIndex: "uniqCount",
      key: "uniqCount",
      width: 100,
      render: (v: number) => (
        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
          {Number(v || 0)} UNIQs
        </span>
      ),
    },
    {
      title: "Kanbans",
      dataIndex: "kanbanCount",
      key: "kanbanCount",
      width: 110,
      render: (v: number) => (
        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
          {Number(v || 0)} Kanbans
        </span>
      ),
    },
    {
      title: "Total Qty",
      dataIndex: "totalQty",
      key: "totalQty",
      width: 110,
      render: (v: number) => (
        <span className="text-sm font-medium text-gray-900">
          {Number(v || 0).toLocaleString()}
        </span>
      ),
    },
    {
      title: "Type",
      dataIndex: "woType",
      key: "woType",
      width: 110,
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700">
          {v || "-"}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: string) => bulkStatusText(value),
    },
    {
      title: "Approval",
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      width: 130,
      render: (value: string) => bulkApprovalTag(value),
    },
    {
      title: "Created",
      dataIndex: "createdDate",
      key: "createdDate",
      width: 110,
    },
    { title: "Target", dataIndex: "targetDate", key: "targetDate", width: 110 },
    {
      title: "Actions",
      key: "actions",
      width: 90,
      fixed: "right",
      render: (_: unknown, row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => router.push(buildBulkWoDetailUrl(row))}
          />
          <Button
            size="small"
            type="text"
            icon={<PrinterOutlined />}
            onClick={() => openPrintDetail(buildBulkWoDetailUrl(row))}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              Work Order Management
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Create, print, and track work orders with inventory effects and
              Kanban integration
            </div>
            {activeTab === "workOrder" && apiEnabled ? (
              <div className="text-xs text-gray-400 mt-2">
                {workOrdersPagedQuery.isFetching
                  ? "Loading data from /working-order/work-orders..."
                  : "Live data connected to /working-order/work-orders"}
              </div>
            ) : null}
          </div>
          {/* <Button
            className="!rounded-lg"
            icon={<PrinterOutlined />}
            onClick={() => message.info("Print Kanban (mock)")}
          >
            Print Kanban
          </Button> */}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Active WOs
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.active}
              </div>
            </div>
            <PlayCircleOutlined className="text-green-500 text-xl" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Completed
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.completed}
              </div>
            </div>
            <CheckCircleOutlined className="text-blue-500 text-xl" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Pending WOs
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.pending}
              </div>
            </div>
            <ClockCircleOutlined className="text-orange-500 text-xl" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">
                Total UNIQs
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.uniqs}
              </div>
            </div>
            <AppstoreOutlined className="text-purple-500 text-xl" />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-xl bg-gray-50 p-2 w-fit">
          <button
            type="button"
            className={tabButtonClass(activeTab === "workOrder")}
            onClick={() => setActiveTab("workOrder")}
          >
            Work Order
          </button>
          <button
            type="button"
            className={tabButtonClass(activeTab === "bulkWo")}
            onClick={() => setActiveTab("bulkWo")}
          >
            Bulk WO
          </button>
          <button
            type="button"
            className={tabButtonClass(activeTab === "rmProcessing")}
            onClick={() => setActiveTab("rmProcessing")}
          >
            RM Processing
          </button>
          <button
            type="button"
            className={tabButtonClass(activeTab === "robotTask")}
            onClick={() => setActiveTab("robotTask")}
          >
            Robot Task
          </button>
        </div>

        {isBulkWoTab ? (
          <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Bulk Work Orders from Production Planning
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Create multiple WOs from PRL with editable UNIQs and
                  quantities
                </div>
              </div>
              <Button
                type="primary"
                className="!rounded-lg"
                icon={<PlusOutlined />}
                onClick={() => router.push("/work-orders/bulk/create")}
              >
                Create Bulk WO
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              <span className="font-semibold">Workflow:</span> Select PRL → View
              PRL items → Edit UNIQ & Qty → Set target dates → Generate WOs (1
              UNIQ = 1 Kanban)
            </div>

            {apiEnabled ? (
              <div className="mt-4 text-xs text-gray-400">
                {bulkWoListQuery.isFetching
                  ? "Loading data from /working-order/bulk/work-orders..."
                  : bulkWoListQuery.isError &&
                      isMissingRouteError(bulkWoListQuery.error)
                    ? "Bulk WO API route not found (404): /working-order/bulk/work-orders"
                    : "Live data connected to /working-order/bulk/work-orders"}
              </div>
            ) : (
              <div className="mt-4 text-xs text-amber-600">
                API base URL not configured; Bulk WO list/approval disabled.
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              {(() => {
                const s = bulkWoSummaryQuery.data;
                const total =
                  typeof s?.total === "number" ? s.total : bulkWoRowsAll.length;
                const pending =
                  typeof s?.pending === "number"
                    ? s.pending
                    : bulkWoRowsAll.filter((r) =>
                        (r.approvalStatus ?? "")
                          .toLowerCase()
                          .includes("pending"),
                      ).length;
                const approved =
                  typeof s?.approved === "number"
                    ? s.approved
                    : bulkWoRowsAll.filter((r) =>
                        (r.approvalStatus ?? "")
                          .toLowerCase()
                          .includes("approve"),
                      ).length;
                const rejected =
                  typeof s?.rejected === "number"
                    ? s.rejected
                    : bulkWoRowsAll.filter((r) =>
                        (r.approvalStatus ?? "")
                          .toLowerCase()
                          .includes("reject"),
                      ).length;

                return (
                  <>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-gray-500">
                          Total Bulk WOs
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {total}
                        </div>
                      </div>
                      <AppstoreOutlined className="text-purple-500 text-xl" />
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-gray-500">
                          Pending
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {pending}
                        </div>
                      </div>
                      <ClockCircleOutlined className="text-orange-500 text-xl" />
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-gray-500">
                          Approved
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {approved}
                        </div>
                      </div>
                      <CheckCircleOutlined className="text-blue-500 text-xl" />
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-gray-500">
                          Rejected
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {rejected}
                        </div>
                      </div>
                      <ClockCircleOutlined className="text-red-500 text-xl" />
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Input
                allowClear
                value={bulkWoSearch}
                onChange={(e) => setBulkWoSearch(e.target.value)}
                placeholder="Search WO number / source document / status"
                className="!rounded-lg max-w-md"
                prefix={<SearchOutlined className="text-gray-400" />}
              />

              <div className="flex items-center gap-2">
                <Button
                  className="!rounded-lg"
                  disabled={!bulkWoSelectedRowKeys.length}
                  onClick={() => setBulkWoBulkOpen(true)}
                >
                  Bulk Approval ({bulkWoSelectedRowKeys.length})
                </Button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              <Table<BulkWoRow>
                columns={bulkWoColumns}
                dataSource={bulkWoRows}
                rowKey="key"
                rowSelection={{
                  selectedRowKeys: bulkWoSelectedRowKeys,
                  onChange: (nextKeys, nextRows) => {
                    setBulkWoSelectedRowKeys(nextKeys.map((k) => String(k)));
                    setBulkWoSelectedRows(nextRows);
                  },
                }}
                loading={apiEnabled && bulkWoListQuery.isFetching}
                pagination={{
                  current: bulkWoPage,
                  pageSize: bulkWoLimit,
                  total:
                    bulkWoListQuery.data?.pagination?.total ??
                    bulkWoRowsAll.length,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 20, 50, 100],
                  onChange: (nextPage, nextPageSize) => {
                    setBulkWoPage(nextPage);
                    setBulkWoLimit(nextPageSize);
                  },
                }}
                scroll={{ x: "max-content" }}
              />
            </div>

            {!bulkWoRows.length ? (
              <div className="mt-10 flex flex-col items-center justify-center text-center text-gray-500">
                <div className="h-10 w-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500">
                  <AppstoreOutlined />
                </div>
                <div className="text-sm font-semibold text-gray-700 mt-3">
                  No bulk work orders found.
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Create one using “Create Bulk WO”.
                </div>
              </div>
            ) : null}
          </div>
        ) : isRmProcessingTab ? (
          <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Raw Material Processing Work Orders
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Transform base raw materials into semi-finished materials
                </div>
              </div>
              <Button
                type="primary"
                className="!rounded-lg"
                icon={<PlusOutlined />}
                onClick={() => router.push("/work-orders/rm-processing/create")}
              >
                Create RM Processing WO
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-xs text-purple-700">
              <span className="font-semibold">Process:</span> Select source RM →
              Define output semi-RM → Set quantities → Complete processing →
              Update inventory
            </div>

            {apiEnabled ? (
              <div className="mt-4 text-xs text-gray-400">
                {rmProcessingQuery.isFetching
                  ? "Loading data from /working-order/rm-processing/work-orders..."
                  : "Live data connected to /working-order/rm-processing/work-orders"}
              </div>
            ) : null}

            {rmProcessingRows.length ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
                <Table<RmProcessingRow>
                  columns={rmProcessingColumns}
                  dataSource={rmProcessingRows}
                  rowKey="key"
                  pagination={{
                    current: rmPage,
                    pageSize: rmLimit,
                    total:
                      rmProcessingQuery.data?.pagination?.total ??
                      rmProcessingRows.length,
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50, 100],
                    onChange: (nextPage, nextPageSize) => {
                      setRmPage(nextPage);
                      setRmLimit(nextPageSize);
                    },
                  }}
                  scroll={{ x: "max-content" }}
                />
              </div>
            ) : (
              <div className="mt-10 flex flex-col items-center justify-center text-center text-gray-500">
                <div className="h-10 w-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500">
                  <AppstoreOutlined />
                </div>
                <div className="text-sm font-semibold text-gray-700 mt-3">
                  No RM processing work orders created yet.
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Click “Create RM Processing WO” to start material
                  transformation.
                </div>
              </div>
            )}
          </div>
        ) : isRobotTaskTab ? (
          <div className="mt-6 rounded-xl border border-gray-100 bg-white p-6">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Robot-Created Work Orders
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Review and approve work orders created by automation robots
                (2-layer approval required)
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              <span className="font-semibold">Approval Workflow:</span> Robot
              creates WO → User approval → Manager approval → Moves to main Work
              Order table
            </div>

            <div className="mt-4">
              <Table
                columns={robotColumns}
                dataSource={robotTasks}
                pagination={false}
                rowKey="key"
                scroll={{ x: 1100 }}
              />
            </div>

            <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500">
                  Pending User Approval
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {robotMetrics.pendingUser}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">
                  Pending Manager Approval
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {robotMetrics.pendingManager}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Fully Approved</div>
                <div className="text-lg font-bold text-gray-900">
                  {robotMetrics.fullyApproved}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Rejected</div>
                <div className="text-lg font-bold text-gray-900">
                  {robotMetrics.rejected}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-gray-100 bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg font-semibold text-gray-900">
                  All Work Orders
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {rows.length} work orders
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  className="!rounded-lg w-72"
                  prefix={<SearchOutlined className="text-gray-400" />}
                  placeholder="Search work order..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  allowClear
                />
                {isWorkOrderTab ? (
                  <Button
                    className="!rounded-lg"
                    disabled={!selectedRowKeys.length}
                    onClick={() => setBulkOpen(true)}
                  >
                    Bulk Approval{" "}
                    {selectedRowKeys.length
                      ? `(${selectedRowKeys.length})`
                      : ""}
                  </Button>
                ) : null}
                {isWorkOrderTab ? (
                  <Button
                    className="!rounded-lg"
                    icon={<PrinterOutlined />}
                    disabled={!selectedRowKeys.length}
                    onClick={() => setLineExportOpen(true)}
                  >
                    Export per Line{" "}
                    {selectedRowKeys.length
                      ? `(${selectedRowKeys.length})`
                      : ""}
                  </Button>
                ) : null}
                {isWorkOrderTab ? (
                  <Button
                    className="!rounded-lg"
                    icon={<UploadOutlined />}
                    onClick={() => setImportBulkOpen(true)}
                  >
                    Import Bulk WO
                  </Button>
                ) : null}
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => router.push("/work-orders/create")}
                >
                  Create Work Order
                </Button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              <Table<WorkOrderRow>
                columns={columns}
                dataSource={rows}
                rowKey="key"
                size="middle"
                loading={apiEnabled ? workOrdersPagedQuery.isFetching : false}
                pagination={
                  apiEnabled
                    ? {
                        current: page,
                        pageSize: limit,
                        total: workOrdersPagedQuery.data?.pagination.total ?? 0,
                        showSizeChanger: true,
                      }
                    : false
                }
                onChange={(pagination) => {
                  if (!apiEnabled) return;
                  const nextPage = pagination.current ?? 1;
                  const nextLimit = pagination.pageSize ?? limit;
                  setPage(nextPage);
                  setLimit(nextLimit);
                }}
                scroll={{ x: "max-content" }}
                rowSelection={
                  isWorkOrderTab
                    ? {
                        selectedRowKeys,
                        onChange: (keys, selected) => {
                          setSelectedRowKeys(keys as string[]);
                          setSelectedRows(selected);
                        },
                      }
                    : undefined
                }
                expandable={{
                  expandedRowRender: (record) => (
                    <div className="p-4 bg-white">
                      <div className="text-sm font-semibold text-gray-900">
                        UNIQ Details ({record.uniqDetails.length} items)
                      </div>
                      <div className="mt-3 overflow-hidden rounded-xl border border-gray-100">
                        <Table<UniqRow>
                          columns={uniqColumns}
                          dataSource={record.uniqDetails}
                          rowKey="key"
                          size="small"
                          pagination={false}
                          showHeader={true}
                        />
                      </div>
                    </div>
                  ),
                }}
              />
            </div>
          </div>
        )}
      </div>

      <Drawer
        title={<div className="text-sm font-semibold">Bulk Approval</div>}
        placement="right"
        width={420}
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button className="!rounded-lg" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              danger
              className="!rounded-lg"
              onClick={() => applyBulk("Rejected")}
              loading={bulkApproveState.isLoading}
            >
              Reject
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              onClick={() => applyBulk("Approved")}
              loading={bulkApproveState.isLoading}
            >
              Approve
            </Button>
          </div>
        }
      >
        <div className="text-xs text-gray-500">
          {selectedRows.length} items selected
        </div>

        <div className="mt-3 rounded-xl border border-gray-100 bg-white p-3">
          <div className="text-xs font-semibold text-gray-700">WO Number</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedRows.map((r) => (
              <span
                key={r.key}
                className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700"
              >
                {r.woNumber}
              </span>
            ))}
            {!selectedRows.length ? (
              <div className="text-xs text-gray-400">
                Select rows to bulk approve/reject
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
            <span>Total UNIQs</span>
            <span className="font-semibold text-gray-900">
              {bulkTotalUniqs}
            </span>
          </div>

          {selectedRows.length ? (
            <div className="mt-4 space-y-2">
              {selectedRows.map((row) => (
                <div
                  key={row.key}
                  className="rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-600"
                >
                  <div className="font-semibold text-gray-900">
                    {row.woNumber}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Type: {row.type}</span>
                    <span>Status: {row.status}</span>
                    <span>Approval: {row.approvalStatus}</span>
                    <span>Target: {row.targetDate}</span>
                    <span>UNIQ: {row.uniqTotal}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-700">
            Approval Note
          </div>
          <TextArea
            className="!rounded-lg mt-2"
            rows={4}
            value={bulkNote}
            onChange={(e) => setBulkNote(e.target.value)}
            placeholder="Enter approval note or rejection reason..."
          />
        </div>
      </Drawer>

      <Drawer
        title={<div className="text-sm font-semibold">Bulk WO Approval</div>}
        placement="right"
        width={420}
        open={bulkWoBulkOpen}
        onClose={() => setBulkWoBulkOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              className="!rounded-lg"
              onClick={() => setBulkWoBulkOpen(false)}
            >
              Cancel
            </Button>
            <Button
              danger
              className="!rounded-lg"
              onClick={() => applyBulkWoApproval("reject")}
              loading={bulkApproveBulkWosState.isLoading}
              disabled={!bulkWoSelectedRowKeys.length}
            >
              Reject
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              onClick={() => applyBulkWoApproval("approve")}
              loading={bulkApproveBulkWosState.isLoading}
              disabled={!bulkWoSelectedRowKeys.length}
            >
              Approve
            </Button>
          </div>
        }
      >
        <div className="text-xs text-gray-500">
          {bulkWoSelectedRows.length} items selected
        </div>

        <div className="mt-3 rounded-xl border border-gray-100 bg-white p-3">
          <div className="text-xs font-semibold text-gray-700">WO Number</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {bulkWoSelectedRows.map((r) => (
              <span
                key={r.key}
                className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700"
              >
                {r.woNumber}
              </span>
            ))}
            {!bulkWoSelectedRows.length ? (
              <div className="text-xs text-gray-400">
                Select rows to bulk approve/reject
              </div>
            ) : null}
          </div>

          {bulkWoSelectedRows.length ? (
            <div className="mt-4 space-y-2">
              {bulkWoSelectedRows.map((row) => (
                <div
                  key={row.key}
                  className="rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-600"
                >
                  <div className="font-semibold text-gray-900">
                    {row.woNumber}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Source: {row.sourceDocumentType}</span>
                    <span>Document: {row.sourceDocumentId}</span>
                    <span>Type: {row.woType}</span>
                    <span>Status: {row.status}</span>
                    <span>Approval: {row.approvalStatus}</span>
                    <span>Items: {row.totalItems}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-700">
            Approval Note
          </div>
          <TextArea
            className="!rounded-lg mt-2"
            rows={4}
            value={bulkWoBulkNote}
            onChange={(e) => setBulkWoBulkNote(e.target.value)}
            placeholder="Enter approval note or rejection reason..."
          />
        </div>
      </Drawer>
      <Modal
        open={Boolean(rmQrModal)}
        title="QR / Kanban - RM Processing"
        onCancel={() => setRmQrModal(null)}
        footer={[
          <Button
            key="detail"
            onClick={() => {
              if (rmQrModal) router.push(buildRmProcessingDetailUrl(rmQrModal));
            }}
          >
            Open Detail
          </Button>,
          <Button
            key="print"
            icon={<PrinterOutlined />}
            onClick={() => {
              if (rmQrModal)
                openPrintDetail(buildRmProcessingDetailUrl(rmQrModal));
            }}
          >
            Print
          </Button>,
          <Button key="close" type="primary" onClick={() => setRmQrModal(null)}>
            Close
          </Button>,
        ]}
      >
        {rmQrModal ? (
          <div className="flex flex-col items-center gap-3">
            {rmQrModal.qrDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={rmQrModal.qrDataUrl}
                alt="QR"
                className="w-56 h-56"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <div className="text-sm text-gray-500">QR belum tersedia</div>
            )}
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-900">
                {rmQrModal.woNumber}
              </div>
              <div className="text-xs text-gray-500">
                {rmQrModal.model} · {rmQrModal.gradeSize}
              </div>
              <div className="text-xs text-gray-400">
                {rmQrModal.sourceMaterialUniq} → {rmQrModal.targetMaterialUniq}
              </div>
            </div>
            {rmQrModal.qrDataUrl ? (
              <details className="w-full">
                <summary className="cursor-pointer text-xs text-gray-500">
                  Detail base64
                </summary>
                <textarea
                  readOnly
                  value={rmQrModal.qrDataUrl}
                  className="mt-2 w-full h-24 text-[10px] font-mono border border-gray-200 rounded p-2"
                />
              </details>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <WorkOrderLineExportModal
        open={lineExportOpen}
        items={lineExportItems}
        onClose={() => setLineExportOpen(false)}
      />

      <WorkOrderImportModal
        open={importBulkOpen}
        onClose={() => setImportBulkOpen(false)}
      />
    </div>
  );
}
