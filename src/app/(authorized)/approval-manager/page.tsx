"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Modal, Segmented, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
} from "@ant-design/icons";

import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  type ApprovalManagerItem,
  type ApprovalManagerDecision,
  type ApprovalManagerType,
  useGetApprovalManagerItemsQuery,
  useGetApprovalManagerSummaryQuery,
  useLazyGetApprovalManagerDetailByUrlQuery,
  useSubmitApprovalManagerDecisionMutation,
} from "@/lib/api/approval-manager/api";

type ApprovalTab = "All Items" | "BOM" | "PRL" | "PO Budget" | "Stock Opname";
type ApprovalStatus = "Pending" | "Approved" | "Rejected";
type ApprovalStatusFilter = "All Status" | ApprovalStatus;

type ApprovalRow = {
  key: string;
  id: string;
  tab: ApprovalTab;
  module: string;
  itemName: string;
  itemCode: string;
  submittedBy: string;
  submittedDate: string;
  approvalStatus: ApprovalStatus;
  backend?: ApprovalManagerItem;
};

const TAB_OPTIONS: ApprovalTab[] = ["All Items", "BOM", "PRL", "PO Budget", "Stock Opname"];

const MOCK_ROWS: ApprovalRow[] = [
  {
    key: "BOM-001",
    id: "BOM-001",
    tab: "BOM",
    module: "Bill of Material",
    itemName: "Bracket Plate",
    itemCode: "MB-001-LV7-A",
    submittedBy: "John Doe",
    submittedDate: "2024-04-10",
    approvalStatus: "Pending",
  },
  {
    key: "BOM-002",
    id: "BOM-002",
    tab: "BOM",
    module: "Bill of Material",
    itemName: "Bracket Bolt",
    itemCode: "MB-001-LV7-B",
    submittedBy: "Jane Smith",
    submittedDate: "2024-04-09",
    approvalStatus: "Pending",
  },
  {
    key: "BOM-003",
    id: "BOM-003",
    tab: "BOM",
    module: "Bill of Material",
    itemName: "Main Bracket",
    itemCode: "LV7-001-A",
    submittedBy: "Mike Johnson",
    submittedDate: "2024-04-01",
    approvalStatus: "Approved",
  },
  {
    key: "PRL-001",
    id: "PRL-001",
    tab: "PRL",
    module: "PRL Management",
    itemName: "Suspension Arm - Honda",
    itemCode: "LV8-002",
    submittedBy: "Sarah Lee",
    submittedDate: "2024-04-12",
    approvalStatus: "Pending",
  },
  {
    key: "PRL-002",
    id: "PRL-002",
    tab: "PRL",
    module: "PRL Management",
    itemName: "Brake Caliper - Nissan",
    itemCode: "LW0-003",
    submittedBy: "David Chen",
    submittedDate: "2024-04-11",
    approvalStatus: "Pending",
  },
  {
    key: "PRL-003",
    id: "PRL-003",
    tab: "PRL",
    module: "PRL Management",
    itemName: "Engine Mount - Toyota",
    itemCode: "LV7-001",
    submittedBy: "Emily Wang",
    submittedDate: "2024-04-05",
    approvalStatus: "Approved",
  },
  {
    key: "POB-001",
    id: "POB-001",
    tab: "PO Budget",
    module: "PO Budget",
    itemName: "PO Budget - Honda Civic Q1",
    itemCode: "POB-2024-001",
    submittedBy: "Robert Kim",
    submittedDate: "2024-04-13",
    approvalStatus: "Pending",
  },
  {
    key: "POB-002",
    id: "POB-002",
    tab: "PO Budget",
    module: "PO Budget",
    itemName: "PO Budget - Toyota Camry Q1",
    itemCode: "POB-2024-002",
    submittedBy: "Lisa Anderson",
    submittedDate: "2024-04-08",
    approvalStatus: "Approved",
  },
  {
    key: "SO-001",
    id: "SO-001",
    tab: "Stock Opname",
    module: "Stock Opname",
    itemName: "Stock Opname - WH-001 April",
    itemCode: "SO-2024-04-001",
    submittedBy: "Kevin Brown",
    submittedDate: "2024-04-12",
    approvalStatus: "Pending",
  },
  {
    key: "SO-002",
    id: "SO-002",
    tab: "Stock Opname",
    module: "Stock Opname",
    itemName: "Stock Opname - WH-002 April",
    itemCode: "SO-2024-04-002",
    submittedBy: "Anna Wilson",
    submittedDate: "2024-04-07",
    approvalStatus: "Rejected",
  },
  {
    key: "SO-003",
    id: "SO-003",
    tab: "Stock Opname",
    module: "Stock Opname",
    itemName: "Stock Opname - RM Area",
    itemCode: "SO-2024-04-003",
    submittedBy: "Chris Park",
    submittedDate: "2024-04-02",
    approvalStatus: "Rejected",
  },
];

const moduleTagClass: Record<string, string> = {
  "Bill of Material": "bg-blue-50 text-blue-600 border-blue-100",
  "PRL Management": "bg-green-50 text-green-600 border-green-100",
  "PO Budget": "bg-purple-50 text-purple-600 border-purple-100",
  "Stock Opname": "bg-orange-50 text-orange-600 border-orange-100",
  "Delivery Note": "bg-slate-50 text-slate-600 border-slate-200",
};

const statusTagClass: Record<ApprovalStatus, string> = {
  Pending: "bg-amber-50 text-amber-600 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-600 border-emerald-200",
  Rejected: "bg-red-50 text-red-600 border-red-200",
};

export default function ApprovalManagerPage() {
  const apiEnabled = Boolean(apiBaseUrl);
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<ApprovalTab>("All Items");
  const [statusFilter, setStatusFilter] = useState<ApprovalStatusFilter>("All Status");

  const [selectedItem, setSelectedItem] = useState<ApprovalManagerItem | null>(null);
  const [remarks, setRemarks] = useState<string>("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState<ApprovalManagerDecision | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState<string>("Detail");
  const [detailPayload, setDetailPayload] = useState<unknown>(null);

  const [fetchDetail, fetchDetailState] = useLazyGetApprovalManagerDetailByUrlQuery();
  const [submitDecision, submitDecisionState] = useSubmitApprovalManagerDecisionMutation();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const type: ApprovalManagerType = useMemo(() => {
    switch (activeTab) {
      case "BOM":
        return "bom";
      case "PRL":
        return "prl";
      case "PO Budget":
        return "po_budget";
      case "Stock Opname":
        return "stock_opname";
      case "All Items":
      default:
        return "all";
    }
  }, [activeTab]);

  const listQuery = useGetApprovalManagerItemsQuery(
    { type, page, limit },
    { skip: !apiEnabled }
  );

  const summaryQuery = useGetApprovalManagerSummaryQuery({ type }, { skip: !apiEnabled });

  const toDateOnly = (value?: string): string => {
    const v = String(value ?? "").trim();
    if (!v) return "-";
    // "2026-04-25 04:54:19.761778+00" or ISO -> date part.
    if (v.length >= 10 && v[4] === "-" && v[7] === "-") return v.slice(0, 10);
    return v;
  };

  type ModuleKind = "stock_opname" | "bom" | "prl" | "po_budget" | "unknown";
  const getModuleKind = (item: ApprovalManagerItem | undefined): ModuleKind => {
    const label = String(item?.module_label ?? item?.module ?? "").toLowerCase();
    if (label.includes("opname")) return "stock_opname";
    if (label.includes("material") || label.includes("bom")) return "bom";
    if (label.includes("prl")) return "prl";
    if (label.includes("po budget") || label.includes("budget")) return "po_budget";
    return "unknown";
  };

  type UnknownRecord = Record<string, unknown>;
  const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;
  const toText = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return "-";
  };
  const toNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const kv = (label: string, value: React.ReactNode) => (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm font-medium text-gray-900 break-words">{value}</div>
    </div>
  );
  const formatNumber = (value: unknown): string => {
    const parsed = toNumber(value);
    if (parsed == null) return "-";
    return new Intl.NumberFormat("en-US").format(parsed);
  };
  const normalizePoBudgetPayload = (value: unknown) => {
    const payload = isRecord(value) ? (value as UnknownRecord) : {};
    const basic = isRecord(payload.basic_information)
      ? (payload.basic_information as UnknownRecord)
      : payload;
    const calc = isRecord(payload.budget_calculations)
      ? (payload.budget_calculations as UnknownRecord)
      : payload;
    const result = isRecord(payload.calculation_results)
      ? (payload.calculation_results as UnknownRecord)
      : payload;
    const additional = isRecord(payload.additional_information)
      ? (payload.additional_information as UnknownRecord)
      : payload;
    const history = Array.isArray(payload.history) ? payload.history : [];

    return { basic, calc, result, additional, history };
  };

  const rows = useMemo<ApprovalRow[]>(() => {
    if (!apiEnabled) return MOCK_ROWS;

    const normalizeStatus = (value: string): ApprovalStatus => {
      const v = (value || "").trim().toLowerCase();
      if (v.includes("approve")) return "Approved";
      if (v.includes("reject")) return "Rejected";
      return "Pending";
    };

    const normalizeTab = (moduleLabel: string): ApprovalTab => {
      const v = (moduleLabel || "").toLowerCase();
      if (v.includes("material") || v.includes("bom")) return "BOM";
      if (v.includes("prl")) return "PRL";
      if (v.includes("budget")) return "PO Budget";
      if (v.includes("opname")) return "Stock Opname";
      return "All Items";
    };

    const items = (listQuery.data?.data ?? []).filter((it) => it.can_view === true);
    return items.map((it) => {
      const id = String(it.document_id ?? it.item_code ?? it.reference_id ?? it.instance_id);
      const moduleLabel = String(it.module_label ?? it.module ?? "-");
      return {
        key: String(it.instance_id ?? id),
        id,
        tab: normalizeTab(moduleLabel),
        module: moduleLabel,
        itemName: String(it.item_name ?? "-") || "-",
        itemCode: String(it.item_code ?? it.document_id ?? "-") || "-",
        submittedBy: String(it.submitted_by_name ?? it.submitted_by ?? "-") || "-",
        submittedDate: toDateOnly(it.submitted_at),
        approvalStatus: normalizeStatus(String(it.status ?? "pending")),
        backend: it,
      };
    });
  }, [apiEnabled, listQuery.data?.data]);

  const filteredRows = useMemo(() => {
    const tabFiltered = activeTab === "All Items" ? rows : rows.filter((row) => row.tab === activeTab);
    if (statusFilter === "All Status") return tabFiltered;
    return tabFiltered.filter((row) => row.approvalStatus === statusFilter);
  }, [activeTab, rows, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, statusFilter]);

  useEffect(() => {
    setSelectedRowKeys((prev) => prev.filter((key) => filteredRows.some((row) => row.key === key)));
  }, [filteredRows]);

  const summary = useMemo(() => {
    if (!apiEnabled) {
      return MOCK_ROWS.reduce(
        (acc, row) => {
          acc[row.approvalStatus] += 1;
          return acc;
        },
        { Pending: 0, Approved: 0, Rejected: 0 } as Record<ApprovalStatus, number>
      );
    }

    const s = summaryQuery.data?.data;
    return {
      Pending: s?.pending ?? 0,
      Approved: s?.approved ?? 0,
      Rejected: s?.rejected ?? 0,
    } as Record<ApprovalStatus, number>;
  }, [apiEnabled, summaryQuery.data?.data]);

  const onView = async (item: ApprovalManagerItem | undefined) => {
    if (!item) return;
    if (item.can_view !== true) return;

    const title = String(item.item_name ?? item.item_code ?? item.document_id ?? "Detail").trim() || "Detail";
    setSelectedItem(item);
    setRemarks("");
    setDetailTitle(title);
    setDetailPayload(null);
    setDetailOpen(true);

    const detailUrl = String(item.detail_url ?? "").trim();
    if (!apiEnabled || !detailUrl) return;

    try {
      const payload = await fetchDetail({ detail_url: detailUrl }).unwrap();
      setDetailPayload(payload);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, "Failed to load detail"));
    }
  };

  const canActionable = (item: ApprovalManagerItem | undefined): boolean => {
    if (!apiEnabled || !item) return false;
    if ((item.status ?? "").toLowerCase() !== "pending") return false;
    if (item.is_my_turn !== true) return false;
    if ((item.view_mode ?? "").toLowerCase() !== "actionable") return false;
    return true;
  };

  const buildStockOpnameDecisionUrl = (
    item: ApprovalManagerItem,
    action: "approve" | "reject"
  ): string | null => {
    // FIX: Use reference_id first (session id), not instance_id
    const id =
      (typeof item.reference_id === "number" && item.reference_id > 0
        ? item.reference_id
        : undefined) ??
      (typeof item.instance_id === "number" && item.instance_id > 0
        ? item.instance_id
        : undefined);

    if (!id) return null;
    return `/stock-opname-sessions/${encodeURIComponent(String(id))}/${action}`;
  };

  const onApprove = async (
    item: ApprovalManagerItem | undefined,
    action: "approve" | "reject",
    nextRemarks?: string
  ) => {
    try {
      await submitDecisionForItem(item, action, nextRemarks);
      messageApi.success(action === "approve" ? "Approved" : "Rejected");
      await Promise.all([listQuery.refetch(), summaryQuery.refetch()]);
      setSelectedRowKeys([]);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, action === "approve" ? "Failed to approve" : "Failed to reject"));
    }
  };

  const submitDecisionForItem = async (
    item: ApprovalManagerItem | undefined,
    action: "approve" | "reject",
    nextRemarks?: string
  ) => {
    if (!item) return;
    if (!canActionable(item)) return;

    if (action === "approve" && item.can_approve !== true) return;
    if (action === "reject" && item.can_reject !== true) return;

    const approvalUrl = (() => {
      if (getModuleKind(item) === "stock_opname") {
        const built = buildStockOpnameDecisionUrl(item, action);
        if (built) return built;
      }
      return String(item.approval_url ?? "").trim();
    })();
    if (!approvalUrl) {
      throw new Error(
        getModuleKind(item) === "stock_opname"
          ? "Missing stock opname session id (instance_id/reference_id)"
          : "Missing approval_url from backend"
      );
    }

    await submitDecision({
      approval_url: approvalUrl,
      reference_id: item.reference_id,
      action,
      remarks: nextRemarks,
      module_kind: getModuleKind(item),
    }).unwrap();
  };

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedRowKeys.includes(row.key)),
    [filteredRows, selectedRowKeys]
  );

  const selectedActionableRows = useMemo(
    () => selectedRows.filter((row) => canActionable(row.backend)),
    [selectedRows]
  );

  const selectedApprovableRows = useMemo(
    () => selectedActionableRows.filter((row) => row.backend?.can_approve === true),
    [selectedActionableRows]
  );

  const selectedRejectableRows = useMemo(
    () => selectedActionableRows.filter((row) => row.backend?.can_reject === true),
    [selectedActionableRows]
  );

  const handleBulkDecision = async (action: ApprovalManagerDecision) => {
    const candidates = action === "approve" ? selectedApprovableRows : selectedRejectableRows;
    const skipped = selectedRows.length - candidates.length;

    if (candidates.length === 0) {
      messageApi.warning(
        action === "approve"
          ? "No selected rows can be bulk approved."
          : "No selected rows can be bulk rejected."
      );
      return;
    }

    setBulkActionLoading(action);
    const failures: string[] = [];

    try {
      for (const row of candidates) {
        try {
          await submitDecisionForItem(row.backend, action);
        } catch (error) {
          failures.push(`${row.itemCode}: ${getApiErrorMessage(error, `Failed to ${action}`)}`);
        }
      }

      await Promise.all([listQuery.refetch(), summaryQuery.refetch()]);
      setSelectedRowKeys([]);

      const successCount = candidates.length - failures.length;
      if (failures.length === 0) {
        messageApi.success(
          `${successCount} item${successCount > 1 ? "s" : ""} ${action === "approve" ? "approved" : "rejected"}${skipped > 0 ? `, ${skipped} skipped` : ""}.`
        );
        return;
      }

      messageApi.warning(
        `${successCount} succeeded, ${failures.length} failed${skipped > 0 ? `, ${skipped} skipped` : ""}.`
      );
    } finally {
      setBulkActionLoading(null);
    }
  };

  const statusColor = (value: ApprovalStatus) => {
    if (value === "Approved") return "green";
    if (value === "Rejected") return "red";
    return "gold";
  };

  const renderDetailBody = () => {
    const item = selectedItem;
    const kind = getModuleKind(item ?? undefined);

    const moduleLabel = String(item?.module_label ?? item?.module ?? "-") || "-";
    const itemId = String(item?.document_id ?? item?.item_code ?? item?.reference_id ?? item?.instance_id ?? "-");
    const itemName = String(item?.item_name ?? "-") || "-";
    const itemCode = String(item?.item_code ?? item?.document_id ?? "-") || "-";
    const submittedBy = String(item?.submitted_by_name ?? item?.submitted_by ?? "-") || "-";
    const submittedDate = toDateOnly(item?.submitted_at);
    const status = ((item?.status ?? "pending") as string).toLowerCase().includes("approve")
      ? ("Approved" as const)
      : ((item?.status ?? "pending") as string).toLowerCase().includes("reject")
        ? ("Rejected" as const)
        : ("Pending" as const);

    const payload = detailPayload;

    const header = (
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="text-sm text-gray-500">Review and approve or reject this item</div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {kv("Item ID", itemId)}
          {kv("Module", moduleLabel)}
          {kv("Item Name", itemName)}
          {kv("Item Code", itemCode)}
          {kv("Submitted By", submittedBy)}
          {kv("Submitted Date", submittedDate)}
        </div>
      </div>
    );

    const approvalStatus = (
      <div className="mt-4">
        <div className="text-sm font-semibold text-gray-900">Current Approval Status</div>
        <div className="mt-2">
          <Tag color={statusColor(status)} className="!rounded-full">{status}</Tag>
        </div>
      </div>
    );

    const comments = (
      <div className="mt-4">
        <div className="text-sm font-semibold text-gray-900">Manager Comments</div>
        <div className="mt-2">
          <Input.TextArea
            rows={3}
            placeholder="Add comments or notes for approval/rejection..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </div>
    );

    const missing = (
      <div className="mt-4 text-sm text-gray-500">No detail payload.</div>
    );

    const renderStockOpname = () => {
      if (!isRecord(payload)) return missing;
      const session = isRecord(payload.session) ? (payload.session as UnknownRecord) : null;
      const entries = Array.isArray(payload.entries) ? (payload.entries as unknown[]) : [];

      const detailsGrid = session ? (
        <div className="mt-4">
          <div className="text-sm font-semibold text-gray-900">Details</div>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            {kv("Session Number", toText(session.session_number))}
            {kv("Inventory Type", toText(session.inventory_type))}
            {kv("Method", toText(session.method))}
            {kv("Period", toText(session.period_label))}
            {kv("Schedule Date", toDateOnly(toText(session.schedule_date)))}
            {kv("Counted Date", toDateOnly(toText(session.counted_date)))}
            {kv("Total Entries", toText(session.total_entries))}
            {kv("Cost Impact", toText(session.cost_impact))}
            {kv("Status", toText(session.status_label ?? session.status))}
            {kv("Impact", toText(session.impact_label))}
          </div>
        </div>
      ) : null;

      const entryRows = entries
        .map((e) => (isRecord(e) ? (e as UnknownRecord) : {}))
        .map((e) => ({
          key: String(toText(e.uuid ?? e.id ?? "")),
          uniq_code: toText(e.uniq_code),
          part_name: toText(e.part_name),
          part_number: toText(e.part_number),
          uom: toText(e.uom),
          system_qty_snapshot: toNumber(e.system_qty_snapshot) ?? 0,
          counted_qty: toNumber(e.counted_qty) ?? 0,
          variance_qty: toNumber(e.variance_qty) ?? 0,
          user_counter: toText(e.user_counter),
          status: toText(e.status),
        }));

      const entryColumns: ColumnsType<(typeof entryRows)[number]> = [
        { title: "UNIQ", dataIndex: "uniq_code", key: "uniq_code", width: 160 },
        { title: "Part Name", dataIndex: "part_name", key: "part_name", width: 220 },
        { title: "Part Number", dataIndex: "part_number", key: "part_number", width: 150 },
        { title: "UoM", dataIndex: "uom", key: "uom", width: 80 },
        { title: "System Qty", dataIndex: "system_qty_snapshot", key: "system_qty_snapshot", width: 110 },
        { title: "Counted Qty", dataIndex: "counted_qty", key: "counted_qty", width: 110 },
        { title: "Variance", dataIndex: "variance_qty", key: "variance_qty", width: 90 },
        { title: "Counter", dataIndex: "user_counter", key: "user_counter", width: 140 },
        {
          title: "Status",
          dataIndex: "status",
          key: "status",
          width: 110,
          render: (v: unknown) => <Tag className="!rounded-full">{toText(v)}</Tag>,
        },
      ];

      return (
        <>
          {detailsGrid}
          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-900">Entries</div>
            <div className="mt-2">
              <Table
                size="small"
                columns={entryColumns}
                dataSource={entryRows}
                pagination={false}
                scroll={{ x: 1200 }}
              />
            </div>
          </div>
        </>
      );
    };

    const renderBom = () => {
      const rawObj = isRecord(payload) ? (payload as UnknownRecord) : null;
      const obj = rawObj && isRecord(rawObj.data) ? (rawObj.data as UnknownRecord) : rawObj;
      if (!obj) return missing;

      const processRoutes = Array.isArray(obj.process_routes) ? (obj.process_routes as unknown[]) : [];
      const processRows = processRoutes
        .map((r) => (isRecord(r) ? (r as UnknownRecord) : {}))
        .map((r) => ({
          key: String(toText(r.route_id ?? r.op_seq ?? "")),
          op_seq: toNumber(r.op_seq) ?? 0,
          process_name: toText(r.process_name),
          machine_name: toText(r.machine_name),
          cycle_time_sec: toNumber(r.cycle_time_sec) ?? null,
          setup_time_min: toNumber(r.setup_time_min) ?? null,
        }));

      const processColumns: ColumnsType<(typeof processRows)[number]> = [
        { title: "Op Seq", dataIndex: "op_seq", key: "op_seq", width: 90 },
        { title: "Process", dataIndex: "process_name", key: "process_name", width: 180 },
        { title: "Machine", dataIndex: "machine_name", key: "machine_name", width: 180 },
        { title: "Cycle (sec/pcs)", dataIndex: "cycle_time_sec", key: "cycle_time_sec", width: 110 },
        { title: "Setup (min)", dataIndex: "setup_time_min", key: "setup_time_min", width: 110 },
      ];

      const material = isRecord(obj.material_spec) ? (obj.material_spec as UnknownRecord) : null;
      const asset = isRecord(obj.asset) ? (obj.asset as UnknownRecord) : null;

      const renderBomNode = (node: UnknownRecord, depth = 0, numbering = ""): React.ReactNode => {
        const nodeMaterial = isRecord(node.material_spec) ? (node.material_spec as UnknownRecord) : null;
        const nodeAsset = isRecord(node.asset) ? (node.asset as UnknownRecord) : null;
        const nodeProcessRoutes = Array.isArray(node.process_routes)
          ? (node.process_routes as unknown[])
          : [];
        const childNodes = Array.isArray(node.children)
          ? node.children.filter(isRecord) as UnknownRecord[]
          : [];

        const nodeProcessRows = nodeProcessRoutes
          .map((r) => (isRecord(r) ? (r as UnknownRecord) : {}))
          .map((r) => ({
            key: String(toText(r.route_id ?? r.op_seq ?? `${numbering}-${Math.random()}`)),
            op_seq: toNumber(r.op_seq) ?? 0,
            process_name: toText(r.process_name),
            machine_name: toText(r.machine_name),
            cycle_time_sec: toNumber(r.cycle_time_sec) ?? null,
            setup_time_min: toNumber(r.setup_time_min) ?? null,
          }));

        return (
          <div
            key={String(toText(node.line_id ?? node.id ?? numbering) ?? depth)}
            className={depth === 0 ? "rounded-xl border border-gray-200 bg-white p-4" : "rounded-xl border border-gray-200 bg-gray-50 p-4"}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {depth === 0 ? "Root BOM" : `Child Level ${toText(node.level) !== "-" ? toText(node.level) : depth}`}
                  {numbering ? ` • ${numbering}` : ""}
                </div>
                <div className="text-xs text-gray-500">
                  {toText(node.part_name)}
                </div>
              </div>
              <Tag className="!rounded-full">{toText(node.status)}</Tag>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {kv("UNIQ", toText(node.uniq_code))}
              {kv("Part Name", toText(node.part_name))}
              {kv("Part Number", toText(node.part_number))}
              {kv("Model", toText(node.model))}
              {kv("Level", toText(node.level))}
              {kv("Qty per UNIQ", toText(node.qty_per_uniq))}
              {kv("Version", toText(node.version))}
              {kv("Asset", toText(nodeAsset?.label ?? nodeAsset?.asset_type))}
            </div>

            {nodeMaterial ? (
              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-900">Material Spec</div>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {kv("Grade", toText(nodeMaterial.material_grade))}
                  {kv("Form", toText(nodeMaterial.form))}
                  {kv("Width (mm)", toText(nodeMaterial.width_mm))}
                  {kv("Diameter (mm)", toText(nodeMaterial.diameter_mm))}
                  {kv("Thickness (mm)", toText(nodeMaterial.thickness_mm))}
                  {kv("Length (mm)", toText(nodeMaterial.length_mm))}
                  {kv("Weight (kg)", toText(nodeMaterial.weight_kg))}
                  {kv("Supplier", toText(nodeMaterial.supplier_name ?? nodeMaterial.supplier_id))}
                  {kv("Cycle (sec/pcs)", toText(nodeMaterial.cycle_time_sec))}
                  {kv("Setup (min)", toText(nodeMaterial.setup_time_min))}
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900">Process Routes</div>
              <div className="mt-2">
                {nodeProcessRows.length > 0 ? (
                  <Table
                    size="small"
                    columns={processColumns}
                    dataSource={nodeProcessRows}
                    pagination={false}
                    scroll={{ x: 800 }}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
                    No process routes.
                  </div>
                )}
              </div>
            </div>

            {childNodes.length > 0 ? (
              <div className="mt-4 space-y-3">
                <div className="text-sm font-semibold text-gray-900">Children</div>
                {childNodes.map((child, index) =>
                  renderBomNode(child, depth + 1, numbering ? `${numbering}.${index + 1}` : `${index + 1}`)
                )}
              </div>
            ) : null}
          </div>
        );
      };

      const childNodes = Array.isArray(obj.children)
        ? obj.children.filter(isRecord) as UnknownRecord[]
        : [];

      return (
        <>
          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-900">Details</div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              {kv("BOM ID", toText(obj.bom_id))}
              {kv("UNIQ", toText(obj.uniq_code))}
              {kv("Part Name", toText(obj.part_name))}
              {kv("Part Number", toText(obj.part_number))}
              {kv("Version", toText(obj.version))}
              {kv("BOM Status", toText(obj.bom_status))}
              {kv("BOM Version", toText(obj.bom_version))}
              {kv("Status", toText(obj.status))}
              {kv("Is Current", toText(obj.is_current))}
              {kv("Read Only", toText(obj.read_only))}
              {kv("Change Note", toText(obj.change_note))}
              {kv("Model", toText(obj.model))}
              {kv("Asset", toText(asset?.label ?? asset?.asset_type))}
              {kv("Description", toText(obj.description))}
            </div>
          </div>

          {material ? (
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900">Material Spec</div>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                {kv("Grade", toText(material.material_grade))}
                {kv("Form", toText(material.form))}
                {kv("Width (mm)", toText(material.width_mm))}
                {kv("Diameter (mm)", toText(material.diameter_mm))}
                {kv("Thickness (mm)", toText(material.thickness_mm))}
                {kv("Length (mm)", toText(material.length_mm))}
                {kv("Weight (kg)", toText(material.weight_kg))}
                {kv("Supplier", toText(material.supplier_name ?? material.supplier_id))}
                {kv("Cycle (sec/pcs)", toText(material.cycle_time_sec))}
                {kv("Setup (min)", toText(material.setup_time_min))}
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-900">Process Routes</div>
            <div className="mt-2">
              {processRows.length > 0 ? (
                <Table
                  size="small"
                  columns={processColumns}
                  dataSource={processRows}
                  pagination={false}
                  scroll={{ x: 800 }}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
                  No process routes.
                </div>
              )}
            </div>
          </div>

          {childNodes.length > 0 ? (
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900">BOM Structure / Children</div>
              <div className="mt-2 space-y-3">
                {childNodes.map((child, index) => renderBomNode(child, 1, `${index + 1}`))}
              </div>
            </div>
          ) : null}
        </>
      );
    };

    const renderPrl = () => {
      if (!isRecord(payload)) return missing;
      const prlObj = isRecord(payload.prl) ? (payload.prl as UnknownRecord) : null;
      const data = prlObj ?? (payload as UnknownRecord);

      return (
        <div className="mt-4">
          <div className="text-sm font-semibold text-gray-900">Details</div>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            {kv("PRL ID", toText(data.prl_id))}
            {kv("Customer", toText(data.customer_name))}
            {kv("UNIQ", toText(data.uniq_code))}
            {kv("Part Name", toText(data.part_name))}
            {kv("Part Number", toText(data.part_number))}
            {kv("Forecast Period", toText(data.forecast_period))}
            {kv("Quantity", toText(data.quantity))}
            {kv("Status", toText(data.status))}
            {kv("Approved At", toText(data.approved_at))}
            {kv("Created At", toText(data.created_at))}
          </div>
        </div>
      );
    };

    const renderPoBudget = () => {
      if (!isRecord(payload)) return missing;

      const { basic, calc, result, additional, history } = normalizePoBudgetPayload(payload);
      const historyRows = history
        .map((entry, index) => {
          const row = isRecord(entry) ? (entry as UnknownRecord) : {};
          return {
            key: String(toText(row.id ?? row.date_time ?? index)),
            date_time: toText(row.date_time ?? row.created_at),
            action: toText(row.action ?? row.status),
            user: toText(row.user ?? row.user_name ?? row.approved_by_name ?? row.submitted_by_name),
            notes: toText(row.notes ?? row.note ?? row.remarks),
          };
        })
        .filter((row) => row.date_time !== "-" || row.action !== "-" || row.user !== "-" || row.notes !== "-");

      const historyColumns: ColumnsType<(typeof historyRows)[number]> = [
        { title: "Date Time", dataIndex: "date_time", key: "date_time", width: 180 },
        {
          title: "Action",
          dataIndex: "action",
          key: "action",
          width: 120,
          render: (value: string) => {
            const lower = value.toLowerCase();
            const color = lower.includes("approve") ? "green" : lower.includes("reject") ? "red" : "blue";
            return <Tag color={color} className="!rounded-full">{value}</Tag>;
          },
        },
        { title: "User", dataIndex: "user", key: "user", width: 160 },
        { title: "Notes", dataIndex: "notes", key: "notes" },
      ];

      return (
        <>
          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-900">Basic Information</div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              {kv("PO Budget Ref", toText(basic.po_budget_ref ?? basic.poBudgetRef ?? basic.id))}
              {kv("Customer", toText(basic.customer_name ?? basic.customer))}
              {kv("UNIQ", toText(basic.uniq ?? basic.uniq_code))}
              {kv("Product Model", toText(basic.product_model))}
              {kv("Part Name", toText(basic.part_name))}
              {kv("Part Number", toText(basic.part_number))}
              {kv("Supplier", toText(basic.supplier_name))}
              {kv("Budget Type", toText(basic.type_label ?? basic.budget_type ?? basic.budget_subtype))}
              {kv("Period", toText(basic.period))}
              {kv("Status", toText(additional.status ?? result.apo_prl_state ?? basic.status))}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-900">Budget Calculations</div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              {kv("Sales Plan", formatNumber(calc.sales_plan))}
              {kv("Purchase Request", formatNumber(calc.purchase_request))}
              {kv("PRL Amount", formatNumber(calc.prl_amount ?? calc.prl))}
              {kv("PO1 %", toText(calc.po1_pct))}
              {kv("PO2 %", toText(calc.po2_pct))}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-900">Calculation Results</div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              {kv("PO1 Amount", formatNumber(result.po1_amount ?? result.po1))}
              {kv("PO2 Amount", formatNumber(result.po2_amount ?? result.po2))}
              {kv("Total PO", formatNumber(result.total_po))}
              {kv("APO vs PRL", formatNumber(result.apo_prl_abs ?? result.apo_prl))}
              {kv("APO/PRL State", toText(result.apo_prl_state))}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-900">Additional Information</div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              {kv("Submitted By", toText(additional.submitted_by_name ?? additional.submitted_by))}
              {kv("Submitted At", toText(additional.submitted_at))}
              {kv("Approved By", toText(additional.approved_by_name ?? additional.approved_by))}
              {kv("Approved At", toText(additional.approved_at ?? additional.approval_date))}
              {kv("Notes", toText(additional.notes ?? additional.note ?? additional.remarks))}
            </div>
          </div>

          {historyRows.length > 0 ? (
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900">Approval History</div>
              <div className="mt-2">
                <Table
                  size="small"
                  columns={historyColumns}
                  dataSource={historyRows}
                  pagination={false}
                  scroll={{ x: 760 }}
                />
              </div>
            </div>
          ) : null}
        </>
      );
    };

    const details = (() => {
      if (!payload) return missing;
      if (kind === "stock_opname") return renderStockOpname();
      if (kind === "bom") return renderBom();
      if (kind === "prl") return renderPrl();
      if (kind === "po_budget") return renderPoBudget();
      return (
        <div className="mt-4">
          <div className="text-sm text-gray-500">
            Detail mapping not available for this module yet.
          </div>
          <pre className="mt-2 max-h-[50vh] overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-800">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      );
    })();

    return (
      <div>
        {header}
        {details}
        {approvalStatus}
        {comments}
      </div>
    );
  };

  const columns: ColumnsType<ApprovalRow> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 110,
      render: (value: string) => (
        <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
          {value}
        </span>
      ),
    },
    {
      title: "Module",
      dataIndex: "module",
      key: "module",
      width: 170,
      render: (value: string) => {
        const klass = moduleTagClass[value] ?? "bg-gray-50 text-gray-700 border-gray-200";
        return (
          <Tag className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${klass}`}>{value}</Tag>
        );
      },
    },
    {
      title: "Item Name",
      dataIndex: "itemName",
      key: "itemName",
      width: 230,
      render: (value: string) => <span className="font-medium text-gray-900">{value}</span>,
    },
    {
      title: "Item Code",
      dataIndex: "itemCode",
      key: "itemCode",
      width: 150,
      render: (value: string) => <span className="text-gray-600">{value}</span>,
    },
    {
      title: "Submitted By",
      dataIndex: "submittedBy",
      key: "submittedBy",
      width: 140,
    },
    {
      title: "Submitted Date",
      dataIndex: "submittedDate",
      key: "submittedDate",
      width: 130,
    },
    {
      title: "Approval Status",
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      width: 150,
      render: (value: ApprovalStatus) => (
        <Tag className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTagClass[value]}`}>
          {value}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 130,
      fixed: "right",
      render: (_value, row) => (
        <div className="flex items-center gap-3 text-base">
          {row.backend?.can_view === true ? (
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              className="text-gray-600"
              onClick={() => onView(row.backend)}
            />
          ) : null}
          {row.approvalStatus === "Pending" ? (
            <>
              {row.backend?.can_approve === true ? (
                <Button
                  type="text"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  className="!text-emerald-600 hover:!text-emerald-700"
                  disabled={!canActionable(row.backend) || submitDecisionState.isLoading}
                  onClick={() => onApprove(row.backend, "approve")}
                />
              ) : null}
              {row.backend?.can_reject === true ? (
                <Button
                  type="text"
                  size="small"
                  icon={<CloseCircleOutlined />}
                  className="!text-red-600 hover:!text-red-700"
                  disabled={!canActionable(row.backend) || submitDecisionState.isLoading}
                  onClick={() => onApprove(row.backend, "reject")}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {contextHolder}
      <Card className="rounded-2xl border border-gray-100 shadow-sm" bodyStyle={{ padding: 24 }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Approval Manager</h1>
            <p className="mt-1 text-gray-500">Centralized approval workflow for all modules requiring manager authorization</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="min-w-[76px] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <div className="text-3xl font-bold text-amber-600">{summary.Pending}</div>
              <div className="text-xs font-medium text-amber-600">Pending</div>
            </div>
            <div className="min-w-[76px] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <div className="text-3xl font-bold text-emerald-600">{summary.Approved}</div>
              <div className="text-xs font-medium text-emerald-600">Approved</div>
            </div>
            <div className="min-w-[76px] rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center">
              <div className="text-3xl font-bold text-red-600">{summary.Rejected}</div>
              <div className="text-xs font-medium text-red-600">Rejected</div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border border-gray-100 shadow-sm" bodyStyle={{ padding: 24 }}>
        {apiEnabled && listQuery.error ? (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            message="Failed to load approval items"
            description={getApiErrorMessage(listQuery.error, "Failed to load approval items")}
          />
        ) : null}

        {apiEnabled && summaryQuery.error ? (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            message="Failed to load approval summary"
            description={getApiErrorMessage(summaryQuery.error, "Failed to load approval summary")}
          />
        ) : null}

        <div className="rounded-2xl bg-gray-100 p-1">
          <Segmented
            block
            options={TAB_OPTIONS}
            value={activeTab}
            onChange={(value) => {
              setActiveTab(value as ApprovalTab);
              setPage(1);
            }}
            className="approval-manager-segmented"
          />
        </div>

        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-500">
              {selectedRows.length > 0
                ? `${selectedRows.length} row selected${selectedRows.length > 1 ? "s" : ""}`
                : "Select pending rows to bulk approve or reject"}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select<ApprovalStatusFilter>
                value={statusFilter}
                onChange={(value) => setStatusFilter(value)}
                className="min-w-[180px]"
                options={[
                  { label: "All Status", value: "All Status" },
                  { label: "Pending", value: "Pending" },
                  { label: "Approved", value: "Approved" },
                  { label: "Rejected", value: "Rejected" },
                ]}
              />
              <Button
                danger
                icon={<CloseCircleOutlined />}
                className="!border-red-200 !bg-red-50 !text-red-600 hover:!border-red-300 hover:!bg-red-100 hover:!text-red-700"
                disabled={selectedRejectableRows.length === 0}
                loading={bulkActionLoading === "reject"}
                onClick={() => handleBulkDecision("reject")}
              >
                Bulk Reject
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                className="!border-emerald-600 !bg-emerald-600 hover:!border-emerald-700 hover:!bg-emerald-700"
                disabled={selectedApprovableRows.length === 0}
                loading={bulkActionLoading === "approve"}
                onClick={() => handleBulkDecision("approve")}
              >
                Bulk Approve
              </Button>
            </div>
          </div>

          <Modal
            title={detailTitle}
            open={detailOpen}
            onCancel={() => setDetailOpen(false)}
            footer={(() => {
              const item = selectedItem;
              const showApprove = item?.can_approve === true;
              const showReject = item?.can_reject === true;
              const disabled = !canActionable(item ?? undefined) || submitDecisionState.isLoading;

              return (
                <div className="flex items-center justify-end gap-2">
                  <Button onClick={() => setDetailOpen(false)}>Close</Button>
                  {showReject ? (
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      className="!border-red-200 !bg-red-50 !text-red-600 hover:!border-red-300 hover:!bg-red-100 hover:!text-red-700"
                      onClick={() => onApprove(item ?? undefined, "reject", remarks)}
                      disabled={disabled}
                      loading={submitDecisionState.isLoading}
                    >
                      Reject
                    </Button>
                  ) : null}
                  {showApprove ? (
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      className="!border-emerald-600 !bg-emerald-600 hover:!border-emerald-700 hover:!bg-emerald-700"
                      onClick={() => onApprove(item ?? undefined, "approve", remarks)}
                      disabled={disabled}
                      loading={submitDecisionState.isLoading}
                    >
                      Approve
                    </Button>
                  ) : null}
                </div>
              );
            })()}
            width={820}
          >
            {!apiEnabled ? (
              <div className="text-sm text-gray-500">API base url not configured.</div>
            ) : fetchDetailState.isFetching ? (
              <div className="text-sm text-gray-500">Loading detail…</div>
            ) : fetchDetailState.error ? (
              <Alert
                type="error"
                showIcon
                message="Failed to load detail"
                description={getApiErrorMessage(fetchDetailState.error, "Failed to load detail")}
              />
            ) : (
              renderDetailBody()
            )}
          </Modal>

          <Table<ApprovalRow>
            columns={columns}
            dataSource={filteredRows}
            loading={apiEnabled && (listQuery.isFetching || summaryQuery.isFetching)}
            rowSelection={{
              fixed: true,
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys.map((key) => String(key))),
              getCheckboxProps: (row) => ({
                disabled: !canActionable(row.backend),
              }),
            }}
            pagination={{
              current: page,
              pageSize: limit,
              total:
                apiEnabled && statusFilter === "All Status"
                  ? listQuery.data?.pagination?.total ?? filteredRows.length
                  : filteredRows.length,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage);
                if (typeof nextPageSize === "number" && nextPageSize !== limit) {
                  setLimit(nextPageSize);
                  setPage(1);
                }
              },
            }}
            rowKey="key"
            scroll={{ x: 1280 }}
          />
        </div>
      </Card>

      <style jsx global>{`
        .approval-manager-segmented .ant-segmented-group {
          gap: 8px;
        }
        .approval-manager-segmented .ant-segmented-item {
          min-height: 38px;
          border-radius: 9999px;
          color: #374151;
          font-weight: 600;
        }
        .approval-manager-segmented .ant-segmented-item-selected {
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
        }
      `}</style>
    </div>
  );
}
