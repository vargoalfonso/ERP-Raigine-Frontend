"use client";
import { apiBaseUrl, getCookiesFromBrowser } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import React, { useEffect, useMemo, useState } from "react";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import {
  useGetPoBudgetListQuery,
  useGetPoBudgetSummaryQuery,
  useAddPoBudgetEntryMutation,
  useAddPoBudgetBulkMutation,
  useGetPoBudgetDetailQuery,
  useLazyGetPoBudgetPrlDetailQuery,
  useUpdatePoBudgetEntryMutation,
  type PoBudgetRow as ApiPoBudgetRow,
  type PoBudgetType,
  type PoBudgetEntryRequest,
  type PoBudgetGroupedDetail,
  type PoBudgetPrlDetail,
  type PoBudgetUpdateRequest,
} from "@/lib/api/po-budget/api";
import type { ApiResponse } from "@/types";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import {
  buildBulkChildRowsFromPrlDetail,
  buildSingleChildRowsFromPrlDetail,
  buildSingleStoredDetailPayload,
  getChildSupplierLookupUniq,
  getStoredParents,
  isChildBudgetType,
  type PoBudgetChildRow,
  type PoBudgetChildRowSupplier,
} from "../../../components/po-budget/poBudgetChildAdapters";
import {
  useListSuppliersQuery,
  type SupplierRecord,
} from "@/lib/api/suppliers/api";
import {
  useListSupplierItemsQuery,
  type SupplierItemRecord,
} from "@/lib/api/supplier-items/api";
import {
  useListCustomersQuery,
  type CustomerRecord,
} from "@/lib/api/customers/api";
import {
  useListPrlsQuery,
  type PrlRecord,
  type PrlType,
} from "@/lib/api/prl/api";
import { useListCustomerPosQuery } from "@/lib/api/customer-orders/api";
import {
  useGetGlobalWorkingDaysQuery,
  useGetUomsQuery,
} from "@/lib/api/system-settings/api";
const useApi = Boolean(apiBaseUrl);
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  DatePicker,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CloseOutlined,
  DownOutlined,
  FileExcelOutlined,
  PlusOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import {
  MdDescription,
  MdOutlineShowChart,
  MdAttachMoney,
  MdQueryStats,
  MdInventory2,
  MdSchedule,
} from "react-icons/md";

import dayjs, { type Dayjs } from "dayjs";

type BudgetTabId = "raw" | "subcon" | "indirect";

type TabPaginationState = Record<
  BudgetTabId,
  { page: number; pageSize: number }
>;

const EMPTY_PO_BUDGET_RESPONSE: ApiResponse<ApiPoBudgetRow[]> = {
  message: "OK",
  status: "success",
  data: [],
};

type BulkBudgetType = "adhoc" | "kanban";

function budgetTypeToPrlType(budgetType: BulkBudgetType): PrlType {
  return budgetType === "adhoc" ? "additional" : "reguler";
}

const PRL_LAZY_PAGE_SIZE = 100;

type BulkSupplierLine = PoBudgetChildRowSupplier;

type BulkItemRow = PoBudgetChildRow;

type BomChildDetailRow = {
  key: string;
  uniq: string;
  childUniqCode?: string;
  partName: string;
  partNumber: string;
  quantityPerUniq: number;
  uom: string;
  weightKg: number;
  level: number;
};

type PoBudgetRow = {
  id?: string;
  key: string;
  uniq: string;
  prlRef?: string;
  customer: string;
  productModel: string;
  partName: string;
  partNumber?: string;
  supplier: string;
  type: string;
  salesPlan: number;
  pr: number;
  po1: number;
  po2: number;
  prl?: string | number;
  totalPo: number;
  apoPrl: number;
  period: string;
  detailJson?: ApiPoBudgetRow["detailJson"];
  status: "approved" | "pending";
  approval: "Approved" | "Pending";
};

type SupplierOption = {
  value: string;
  label: string;
  supplierName: string;
  supplierId?: number;
  uniqCode?: string;
  uom?: string;
  weight?: number;
  description?: string;
  percentage?: number;
};

type DetailState = {
  open: boolean;
  row: PoBudgetRow | null;
};

type AddFormState = {
  customer: string;
  customerId: number | null;
  uniq: string;
  productModel: string;
  partName: string;
  partNumber: string;
  uom: string;
  weightKg: string;
  description: string;
  supplier: string;
  supplierId: number | null;
  salesPlan: number;
  purchaseRequest: number;
  po1Pct: number;
  po2Pct: number;
  prl?: string | number;
  period: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getApiType(tab: BudgetTabId): PoBudgetType {
  if (tab === "raw") return "raw-material";
  if (tab === "subcon") return "subcon";
  return "indirect";
}

function getBudgetTypeLabel(tab: BudgetTabId) {
  if (tab === "raw") return "Raw Material";
  if (tab === "subcon") return "Subcon";
  return "Indirect";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Remove options sharing the same `value` so Ant Design Selects never render
// duplicate keys (which triggers the "two children with the same key" warning
// when a supplier appears in more than one supplier-item / UNIQ).
function dedupeSupplierOptions(options: SupplierOption[]): SupplierOption[] {
  const seen = new Set<string>();
  const result: SupplierOption[] = [];
  for (const option of options) {
    const key = String(option.value ?? option.label ?? "")
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(option);
  }
  return result;
}

function normalizeSupplierItemType(value: unknown): BudgetTabId | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw.includes("sub")) return "subcon";
  if (raw.includes("indirect")) return "indirect";
  if (raw.includes("raw")) return "raw";
  return null;
}

function normalizeCustomerName(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeLookupValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isIntegerId(value: string) {
  return /^\d+$/.test(value.trim());
}

function collectMaterialGrades(node: Record<string, any>) {
  const out: Array<{
    id?: number;
    uniq?: string;
    material_grade?: string | null;
  }> = [];

  function walk(n: Record<string, any>) {
    if (!n || typeof n !== "object") return;
    const ms = (n.material_spec ?? {}) as Record<string, any>;
    out.push({
      id: n.id,
      uniq: n.uniq ?? n.uniq_code,
      material_grade: ms.material_grade ?? null,
    });
    if (Array.isArray(n.children)) {
      for (const c of n.children) walk(c);
    }
  }

  walk(node);
  return out;
}

function toIntegerId(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!isIntegerId(text)) return null;
  const parsed = Number(text);
  return Number.isInteger(parsed) ? parsed : null;
}

function getPrlPeriodValue(prl: unknown): string {
  if (!isRecord(prl)) return "";
  return String(prl.forecast_period ?? prl.period ?? "").trim();
}

function getPrlRowId(prl: unknown): number | null {
  if (!isRecord(prl)) return null;
  // Try common fields that may contain the PRL row identifier. Some APIs
  // return `row_id`, others `id`, `prl_item_id`, or similar. Accept the
  // first integer-like value we can parse.
  const candidates = [
    (prl as any).row_id,
    (prl as any).id,
    (prl as any).prl_item_id,
    (prl as any).item_id,
    (prl as any).rowId,
    (prl as any).prl_row_id,
  ];

  for (const c of candidates) {
    const v = toIntegerId(c);
    if (v != null) return v;
  }

  return null;
}

function parsePeriodMonth(value: string | undefined): Dayjs | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;

  const isoMonth = text.match(/^(\d{4})-(\d{1,2})/);
  if (isoMonth) {
    const parsed = dayjs(`${isoMonth[1]}-${isoMonth[2].padStart(2, "0")}-01`);
    return parsed.isValid() ? parsed : undefined;
  }

  const namedMonth = text.match(/^([A-Za-z]+)[\s-]+(\d{4})$/);
  if (namedMonth) {
    const parsed = dayjs(`${namedMonth[1]} 1, ${namedMonth[2]}`);
    return parsed.isValid() ? parsed : undefined;
  }

  const parsed = dayjs(text);
  return parsed.isValid() ? parsed : undefined;
}

function formatPeriodMonth(value: Dayjs | null): string | undefined {
  return value?.isValid() ? value.format("MMMM YYYY") : undefined;
}

function normalizePeriodForApi(value: string | undefined): string {
  return (
    formatPeriodMonth(parsePeriodMonth(value) ?? null) ??
    String(value ?? "").trim()
  );
}

function StatCard(props: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  accent?: string;
}) {
  const { label, value, icon, accent } = props;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
      </div>
      <div
        className={
          "h-10 w-10 rounded-lg flex items-center justify-center " +
          (accent ?? "bg-blue-50 text-blue-600")
        }
      >
        {icon}
      </div>
    </div>
  );
}

export default function PoBudgetPage() {
  const { data: bomTreeRes } = useGetBomTreeQuery();
  const bomTreeNodes = useMemo(() => {
    const items = bomTreeRes?.data?.items;
    if (Array.isArray(items)) return items;
    // some endpoints return a single BOM object in data
    const rawData = bomTreeRes?.data;
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (typeof rawData === "object") return [rawData as any];
    return [];
  }, [bomTreeRes?.data]);
  const materialGrades = useMemo(() => {
    const all: Array<{
      id?: number;
      uniq?: string;
      material_grade?: string | null;
    }> = [];
    for (const node of bomTreeNodes) {
      all.push(...collectMaterialGrades(node as Record<string, any>));
    }
    return all;
  }, [bomTreeNodes]);
  function resolveSupplierName(
    supplierValue: unknown,
    supplierNameByCode: Map<string, string>,
  ) {
    if (typeof supplierValue === "string") {
      return supplierNameByCode.get(supplierValue) ?? supplierValue;
    }

    if (isRecord(supplierValue)) {
      if (
        typeof supplierValue.supplier_name === "string" &&
        supplierValue.supplier_name.trim()
      ) {
        return supplierValue.supplier_name;
      }

      if (
        typeof supplierValue.supplier_code === "string" &&
        supplierValue.supplier_code.trim()
      ) {
        return (
          supplierNameByCode.get(supplierValue.supplier_code) ??
          supplierValue.supplier_code
        );
      }
    }

    return "-";
  }

  useEffect(() => {
    if (materialGrades.length > 0) {
      // temporary: log collected grades for debugging / verification
      // you can replace this with UI rendering as needed
      // eslint-disable-next-line no-console
      console.log("Collected material grades:", materialGrades);
    }
  }, [materialGrades]);

  const uniqueMaterialGrades = useMemo(() => {
    const set = new Set<string>();
    materialGrades.forEach((m) => {
      const v = String(m.material_grade ?? "").trim();
      if (v && v !== "-" && v.toLowerCase() !== "null") set.add(v);
    });
    return Array.from(set).sort();
  }, [materialGrades]);
  const bomIndex = useMemo(
    () => buildBomUniqIndex(bomTreeNodes),
    [bomTreeNodes],
  );

  const [activeTab, setActiveTab] = useState<BudgetTabId>("raw");
  const [paginationByTab, setPaginationByTab] = useState<TabPaginationState>({
    raw: { page: 1, pageSize: 20 },
    subcon: { page: 1, pageSize: 20 },
    indirect: { page: 1, pageSize: 20 },
  });

  const initialRawRows = useMemo<PoBudgetRow[]>(
    () => [
      {
        key: "RM-001",
        uniq: "RM-001",
        customer: "Toyota Motor Indonesia",
        productModel: "Avanza Model A",
        partName: "Steel Plate",
        supplier: "PT Steel Indonesia",
        type: "Adhoc",
        salesPlan: 12000,
        pr: 13000,
        po1: 7800,
        po2: 5200,
        prl: 12500,
        totalPo: 13000,
        apoPrl: 500,
        period: "October 2025",
        status: "approved",
        approval: "Approved",
      },
      {
        key: "RM-002",
        uniq: "RM-002",
        customer: "Honda Manufacturing",
        productModel: "CR-V Model B",
        partName: "Aluminum Sheet",
        supplier: "PT Metal Works",
        type: "",
        salesPlan: 8500,
        pr: 9000,
        po1: 5400,
        po2: 3600,
        prl: 8800,
        totalPo: 9000,
        apoPrl: 200,
        period: "October 2025",
        status: "pending",
        approval: "Pending",
      },
    ],
    [],
  );

  const initialSubconRows = useMemo<PoBudgetRow[]>(
    () => [
      {
        key: "SC-001",
        uniq: "SC-001",
        customer: "Daihatsu Motor",
        productModel: "Xenia Model C",
        partName: "Machining Service",
        supplier: "PT Precision Engineering",
        type: "",
        salesPlan: 5000,
        pr: 5200,
        po1: 3120,
        po2: 2080,
        prl: 5100,
        totalPo: 5200,
        apoPrl: 100,
        period: "October 2025",
        status: "approved",
        approval: "Approved",
      },
    ],
    [],
  );

  const initialIndirectRows = useMemo<PoBudgetRow[]>(
    () => [
      {
        key: "IND-001",
        uniq: "IND-001",
        customer: "Internal (Factory)",
        productModel: "Operations",
        partName: "Safety Gloves",
        supplier: "PT Indirect Supplies",
        type: "",
        salesPlan: 1200,
        pr: 1000,
        po1: 600,
        po2: 400,
        prl: 1100,
        totalPo: 1000,
        apoPrl: 100,
        period: "October 2025",
        status: "pending",
        approval: "Pending",
      },
      {
        key: "IND-002",
        uniq: "IND-002",
        customer: "Internal (Warehouse)",
        productModel: "Logistics",
        partName: "Packaging Box",
        supplier: "PT Packaging Nusantara",
        type: "",
        salesPlan: 3000,
        pr: 2800,
        po1: 1680,
        po2: 1120,
        prl: 2900,
        totalPo: 2800,
        apoPrl: 100,
        period: "October 2025",
        status: "approved",
        approval: "Approved",
      },
    ],
    [],
  );

  const { data: rawListRes = EMPTY_PO_BUDGET_RESPONSE } =
    useGetPoBudgetListQuery(
      {
        type: "raw-material" as PoBudgetType,
        limit: paginationByTab.raw.pageSize,
        page: paginationByTab.raw.page,
      },
      {
        skip: !useApi,
      },
    );
  const { data: subconListRes = EMPTY_PO_BUDGET_RESPONSE } =
    useGetPoBudgetListQuery(
      {
        type: "subcon" as PoBudgetType,
        limit: paginationByTab.subcon.pageSize,
        page: paginationByTab.subcon.page,
      },
      {
        skip: !useApi,
      },
    );
  const { data: indirectListRes = EMPTY_PO_BUDGET_RESPONSE } =
    useGetPoBudgetListQuery(
      {
        type: "indirect" as PoBudgetType,
        limit: paginationByTab.indirect.pageSize,
        page: paginationByTab.indirect.page,
      },
      {
        skip: !useApi,
      },
    );

  const [addEntry] = useAddPoBudgetEntryMutation();
  const [addBulk] = useAddPoBudgetBulkMutation();
  const [loadPoBudgetPrlDetail] = useLazyGetPoBudgetPrlDetailQuery();
  const [updateEntry] = useUpdatePoBudgetEntryMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPrlIds, setBulkPrlIds] = useState<string[]>([]);
  const [bulkPoIds, setBulkPoIds] = useState<string[]>([]);
  const [bulkSource, setBulkSource] = useState<"prl" | "po">("prl");
  const [bulkPrlSearch, setBulkPrlSearch] = useState("");
  const [bulkPrlPage, setBulkPrlPage] = useState(1);
  const [prlCache, setPrlCache] = useState<PrlRecord[]>([]);
  const [bulkBudgetType, setBulkBudgetType] = useState<BulkBudgetType>("adhoc");
  const [bulkPeriod, setBulkPeriod] = useState<string | undefined>(undefined);
  const [bulkPo1Pct, setBulkPo1Pct] = useState<number>(60);
  const [bulkPo2Pct, setBulkPo2Pct] = useState<number>(40);
  const [addBudgetType, setAddBudgetType] = useState<BulkBudgetType>("adhoc");
  const [selectedSinglePrlId, setSelectedSinglePrlId] = useState<
    string | undefined
  >(undefined);
  const [singleChildRows, setSingleChildRows] = useState<BulkItemRow[]>([]);
  const [bulkPrlDetailCache, setBulkPrlDetailCache] = useState<
    Record<string, PoBudgetPrlDetail>
  >({});
  const [expandedBudgetRowKeys, setExpandedBudgetRowKeys] = useState<string[]>(
    [],
  );
  const [, setExpandedBulkRowKeys] = useState<string[]>([]);
  // Material tree in the list: tracks EXPANDED keys (default = collapsed).
  const [expandedStoredParentKeys, setExpandedStoredParentKeys] = useState<
    string[]
  >([]);
  // Bulk modal groups: tracks COLLAPSED keys (default = expanded).
  const [collapsedBulkGroupKeys, setCollapsedBulkGroupKeys] = useState<
    string[]
  >([]);

  const { data: customers = [] } = useListCustomersQuery(undefined, {
    skip: !useApi,
  });
  const shouldFetchPrls = useApi && (addOpen || bulkOpen);
  const activePrlTypeFilter = budgetTypeToPrlType(
    bulkOpen ? bulkBudgetType : addBudgetType,
  );
  const {
    data: prlsResponse,
    isFetching: prlsFetching,
    refetch: refetchPrls,
  } = useListPrlsQuery(
    {
      page: bulkPrlPage,
      limit: PRL_LAZY_PAGE_SIZE,
      search: bulkPrlSearch.trim() || undefined,
      prl_type: activePrlTypeFilter,
    },
    { skip: !shouldFetchPrls },
  );
  const { data: customerPosResponse } = useListCustomerPosQuery(undefined, {
    skip: !useApi,
  });
  const { data: supplierItems = [] } = useListSupplierItemsQuery(undefined, {
    skip: !useApi,
  });
  const { data: globalParameters = [] } = useGetGlobalWorkingDaysQuery(
    undefined,
    { skip: !useApi },
  );
  const { data: uoms = [] } = useGetUomsQuery(undefined, { skip: !useApi });

  const rowsByTab = useMemo(
    () => ({
      raw: rawListRes.data,
      subcon: subconListRes.data,
      indirect: indirectListRes.data,
    }),
    [rawListRes.data, subconListRes.data, indirectListRes.data],
  );

  useEffect(() => {
    // Skip while no fetch is active for the current selector, so a response
    // left over from a previous prl_type/skip state never repopulates the
    // cache after switching PO Budget Type.
    if (!shouldFetchPrls) return;
    const incoming = prlsResponse?.items ?? [];
    if (incoming.length === 0) return;

    setPrlCache((prev) => {
      if (bulkPrlPage === 1) return incoming;

      const byKey = new Map<string, PrlRecord>();
      const getKey = (item: PrlRecord, index: number) =>
        String(
          item.row_id ??
            item.id ??
            `${item.prl_id ?? "prl"}-${item.uniq_code ?? item.item_uniq_code ?? index}`,
        );

      prev.forEach((item, index) => byKey.set(getKey(item, index), item));
      incoming.forEach((item, index) => byKey.set(getKey(item, index), item));
      return Array.from(byKey.values());
    });
  }, [bulkPrlPage, prlsResponse, shouldFetchPrls, activePrlTypeFilter]);

  const prls = prlCache;
  const bulkPrlPagination = prlsResponse?.pagination;
  const canLoadMoreBulkPrls = Boolean(
    bulkPrlPagination && bulkPrlPage < bulkPrlPagination.total_pages,
  );

  const handleBulkPrlSearch = (value: string) => {
    setBulkPrlSearch(value);
    setBulkPrlPage(1);
    setPrlCache([]);
  };

  useEffect(() => {
    setBulkPrlPage(1);
    setPrlCache([]);
    // RTK Query serves cached data instantly for an arg combo it has seen
    // before (e.g. switching additional -> reguler -> additional again), so
    // force a real refetch whenever the active PRL type changes.
    if (shouldFetchPrls) refetchPrls();
  }, [activePrlTypeFilter]);

  const handleBulkPrlPopupScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const nearBottom =
      target.scrollTop + target.clientHeight >= target.scrollHeight - 24;
    if (!nearBottom || prlsFetching || !canLoadMoreBulkPrls) return;
    setBulkPrlPage((prev) => prev + 1);
  };
  const customerPos = customerPosResponse ?? [];

  const paginationMetaByTab = useMemo(
    () => ({
      raw: rawListRes.pagination,
      subcon: subconListRes.pagination,
      indirect: indirectListRes.pagination,
    }),
    [
      rawListRes.pagination,
      subconListRes.pagination,
      indirectListRes.pagination,
    ],
  );

  const [detailState, setDetailState] = useState<DetailState>({
    open: false,
    row: null,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<PoBudgetRow | null>(null);
  const [addForm, setAddForm] = useState<AddFormState>({
    customer: "",
    customerId: null,
    uniq: "",
    productModel: "",
    partName: "",
    partNumber: "",
    uom: "",
    weightKg: "",
    description: "",
    supplier: "",
    supplierId: null,
    salesPlan: 0,
    purchaseRequest: 0,
    po1Pct: 60,
    po2Pct: 40,
    prl: 0,
    period: "",
  });

  const [editForm, setEditForm] = useState({
    purchaseRequest: 0,
    prl: 0,
    po1Pct: 50,
    po2Pct: 50,
    period: "",
  });

  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [addSupplierItemKey, setAddSupplierItemKey] = useState<string | null>(
    null,
  );
  const { data: supplierOnlyList = [] } = useListSuppliersQuery(undefined, {
    skip: !useApi,
  });
  const [addSupplierForm, setAddSupplierForm] = useState<{
    supplier?: string;
    qty?: number;
  }>({});

  const detailQuery = useGetPoBudgetDetailQuery(
    detailState.row?.id
      ? { type: getApiType(activeTab), id: detailState.row.id }
      : ({ type: "raw-material", id: "" } as any),
    { skip: !useApi || !detailState.open || !detailState.row?.id },
  );

  const supplierNameByCode = useMemo(
    () =>
      new Map(
        supplierOnlyList
          .flatMap((supplier) => {
            const supplierName =
              typeof supplier.supplier_name === "string"
                ? supplier.supplier_name
                : "";
            if (!supplierName) return [] as Array<readonly [string, string]>;

            return [supplier.supplier_code, supplier.id, supplier.supplier_name]
              .map((value) =>
                value === undefined || value === null ? "" : String(value),
              )
              .filter(Boolean)
              .map((value) => [value, supplierName] as const);
          })
          .filter(
            (entry): entry is readonly [string, string] =>
              Boolean(entry[0]) && Boolean(entry[1]),
          ),
      ),
    [supplierOnlyList],
  );

  const supplierRowIdByUuid = useMemo(() => {
    const map = new Map<string, number>();

    supplierOnlyList.forEach((supplier) => {
      const rowId = toIntegerId(supplier.row_id) ?? toIntegerId(supplier.id);
      const uuid = String(supplier.id ?? "").trim();
      if (rowId == null || !uuid) return;
      map.set(uuid, rowId);
    });

    return map;
  }, [supplierOnlyList]);

  const supplierRowIdByCode = useMemo(() => {
    const map = new Map<string, number>();

    supplierOnlyList.forEach((supplier) => {
      const rowId = toIntegerId(supplier.row_id) ?? toIntegerId(supplier.id);
      const code = String(supplier.supplier_code ?? "")
        .trim()
        .toLowerCase();
      if (rowId == null || !code) return;
      map.set(code, rowId);
    });

    return map;
  }, [supplierOnlyList]);

  const supplierRowIdByName = useMemo(() => {
    const map = new Map<string, number>();

    supplierOnlyList.forEach((supplier) => {
      const rowId = toIntegerId(supplier.row_id) ?? toIntegerId(supplier.id);
      const name = String(supplier.supplier_name ?? "")
        .trim()
        .toLowerCase();
      if (rowId == null || !name) return;
      map.set(name, rowId);
    });

    return map;
  }, [supplierOnlyList]);

  const resolveSupplierRowId = (input: {
    supplierUuid?: unknown;
    supplierCode?: unknown;
    supplierName?: unknown;
    fallbackValue?: unknown;
  }): number | undefined => {
    const supplierUuid = String(input.supplierUuid ?? "").trim();
    if (supplierUuid) {
      const byUuid = supplierRowIdByUuid.get(supplierUuid);
      if (byUuid != null) return byUuid;
    }

    const supplierCode = String(input.supplierCode ?? "")
      .trim()
      .toLowerCase();
    if (supplierCode) {
      const byCode = supplierRowIdByCode.get(supplierCode);
      if (byCode != null) return byCode;
    }

    const supplierName = String(input.supplierName ?? "")
      .trim()
      .toLowerCase();
    if (supplierName) {
      const byName = supplierRowIdByName.get(supplierName);
      if (byName != null) return byName;
    }

    // Some backends put the numeric supplier PK directly in supplier_uuid.
    const numericUuid = toIntegerId(input.supplierUuid);
    if (numericUuid != null) return numericUuid;

    const fallbackId = toIntegerId(input.fallbackValue);
    return fallbackId == null ? undefined : fallbackId;
  };

  const customerIdByName = useMemo(() => {
    const map = new Map<string, number>();

    customers.forEach((customer: CustomerRecord) => {
      const customerName = normalizeCustomerName(customer.customer_name);
      const customerId = toIntegerId(
        customer.row_id ?? customer.id ?? customer.customer_id,
      );
      if (!customerName || customerId == null) return;
      map.set(customerName, customerId);
    });

    return map;
  }, [customers]);

  const resolvePrlCustomerId = (item: Record<string, unknown>) => {
    const nestedCustomer = isRecord(item.customer) ? item.customer : undefined;
    const explicitRowId = toIntegerId(nestedCustomer?.row_id);
    if (explicitRowId != null) return explicitRowId;

    const customerName = normalizeCustomerName(
      item.customer_name ?? nestedCustomer?.customer_name,
    );
    const mappedCustomerId = customerIdByName.get(customerName);
    if (mappedCustomerId != null) return mappedCustomerId;

    const nestedId = toIntegerId(
      nestedCustomer?.id ?? nestedCustomer?.customer_id,
    );
    if (nestedId != null) return nestedId;

    const directId = toIntegerId(item.customer_id);
    if (directId != null) return directId;

    return null;
  };

  const supplierOptions = useMemo<SupplierOption[]>(() => {
    const deduped = new Map<string, SupplierOption>();

    const activeSupplierItems = supplierItems.filter(
      (item: SupplierItemRecord) => {
        const status = String(item.status ?? "active").toLowerCase();
        const itemTab = normalizeSupplierItemType(
          item.type ?? item.material_type,
        );
        return (
          (!status || status === "active") &&
          (!itemTab || itemTab === activeTab)
        );
      },
    );

    activeSupplierItems.forEach((item) => {
      const supplierName =
        typeof item.supplier_name === "string" ? item.supplier_name.trim() : "";
      const supplierId = resolveSupplierRowId({
        supplierUuid: item.supplier_uuid,
        supplierCode: item.supplier_code,
        supplierName,
        fallbackValue: item.supplier_uuid,
      });
      const supplierValue =
        item.supplier_uuid == null ? supplierName : String(item.supplier_uuid);
      const uniqCode =
        typeof item.uniq_code === "string" ? item.uniq_code.trim() : "";
      if (!supplierName) return;

      const key = [
        supplierValue || supplierName.toLowerCase(),
        uniqCode || "-",
      ].join("::");
      deduped.set(key, {
        value: supplierValue || supplierName,
        label: supplierName,
        supplierName,
        supplierId,
        uniqCode: uniqCode || undefined,
        uom: typeof item.uom === "string" ? item.uom.trim() : undefined,
        weight:
          typeof item.weight === "number"
            ? item.weight
            : Number(item.weight ?? 0) || undefined,
        description:
          typeof item.description === "string"
            ? item.description.trim()
            : undefined,
        percentage:
          typeof item.percentage === "number" ? item.percentage : undefined,
      });
    });

    if (deduped.size > 0) {
      return Array.from(deduped.values()).sort((a, b) =>
        a.label.localeCompare(b.label),
      );
    }

    supplierOnlyList
      .filter((supplier) => {
        const status = String(supplier.status ?? "active").toLowerCase();
        return status === "active" || !status;
      })
      .forEach((supplier) => {
        const supplierName =
          typeof supplier.supplier_name === "string"
            ? supplier.supplier_name.trim()
            : "";
        if (!supplierName) return;
        const supplierId = resolveSupplierRowId({
          supplierUuid: supplier.id,
          supplierCode: supplier.supplier_code,
          supplierName,
          fallbackValue: supplier.row_id,
        });
        const supplierValue =
          supplier.id == null ? supplierName : String(supplier.id);
        const key = supplierValue || supplierName.toLowerCase();
        deduped.set(key, {
          value: supplierValue,
          label: supplierName,
          supplierName,
          supplierId,
        });
      });

    return Array.from(deduped.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [
    activeTab,
    supplierItems,
    supplierOnlyList,
    supplierRowIdByCode,
    supplierRowIdByName,
    supplierRowIdByUuid,
  ]);

  const addSupplierOptions = useMemo<SupplierOption[]>(() => {
    const selectedUniq = String(addForm.uniq ?? "").trim();
    const selectedSebango = String(addForm.partNumber ?? "").trim();
    if (!selectedUniq && !selectedSebango) return supplierOptions;

    const related = supplierItems.filter((it) => {
      const uniqMatch =
        normalizeLookupValue(it.uniq_code ?? it.item_uniq_code) ===
        normalizeLookupValue(selectedUniq);
      const sebangoMatch =
        normalizeLookupValue(it.sebango_code) ===
        normalizeLookupValue(selectedSebango);
      return uniqMatch || sebangoMatch;
    });
    const relatedNames = new Set(
      related
        .map((r) => String(r.supplier_name ?? r.supplier ?? "").trim())
        .filter(Boolean),
    );
    const filtered = supplierOptions.filter((option) =>
      relatedNames.has(
        String(option.label ?? option.supplierName ?? "").trim(),
      ),
    );
    return dedupeSupplierOptions(
      filtered.length > 0 ? filtered : supplierOptions,
    );
  }, [addForm.partNumber, addForm.uniq, supplierItems, supplierOptions]);

  const approvedPrls = useMemo(
    () =>
      prls.filter((item) => {
        const status = String(item.approval_status ?? item.status ?? "")
          .trim()
          .toLowerCase();
        return status === "approved";
      }),
    [prls],
  );

  const supplierItemsByUniq = useMemo(() => {
    const grouped = new Map<string, SupplierItemRecord[]>();

    supplierItems.forEach((item) => {
      const uniqCode = String(item.uniq_code ?? "").trim();
      const status = String(item.status ?? "active").toLowerCase();
      const itemTab = normalizeSupplierItemType(
        item.type ?? item.material_type,
      );
      if (
        !uniqCode ||
        (status && status !== "active") ||
        (itemTab && itemTab !== activeTab)
      ) {
        return;
      }

      const current = grouped.get(uniqCode) ?? [];
      current.push(item);
      grouped.set(uniqCode, current);
    });

    return grouped;
  }, [activeTab, supplierItems]);

  // Tab-agnostic index of every active supplier item, keyed by BOTH its
  // uniq_code and sebango_code. Child rows (raw-material / indirect budgets)
  // can contain items of any procurement type — e.g. a subcon part registered
  // under its sebango code like "BC48-A" — so their registered suppliers must
  // resolve regardless of the currently active budget tab.
  const supplierItemsByCode = useMemo(() => {
    const grouped = new Map<string, SupplierItemRecord[]>();
    supplierItems.forEach((item) => {
      const status = String(item.status ?? "active").toLowerCase();
      if (status && status !== "active") return;
      const keys = Array.from(
        new Set(
          [
            normalizeLookupValue(item.uniq_code),
            normalizeLookupValue(item.sebango_code),
          ].filter(Boolean),
        ),
      );
      keys.forEach((key) => {
        const current = grouped.get(key) ?? [];
        current.push(item);
        grouped.set(key, current);
      });
    });
    return grouped;
  }, [supplierItems]);

  const supplierItemsByLookupKey = useMemo(() => {
    const grouped = new Map<string, SupplierItemRecord[]>();

    supplierItems.forEach((item) => {
      const status = String(item.status ?? "active").toLowerCase();
      const itemTab = normalizeSupplierItemType(
        item.type ?? item.material_type,
      );
      if (
        (status && status !== "active") ||
        (itemTab && itemTab !== activeTab)
      ) {
        return;
      }

      const lookupKeys = [
        normalizeLookupValue(item.uniq_code),
        normalizeLookupValue(item.sebango_code),
      ].filter(Boolean);

      lookupKeys.forEach((lookupKey) => {
        const current = grouped.get(lookupKey) ?? [];
        current.push(item);
        grouped.set(lookupKey, current);
      });
    });

    return grouped;
  }, [activeTab, supplierItems]);

  const findSupplierItemsForProduct = (
    uniqCode?: string,
    sebangoCode?: string,
  ) => {
    const matches = [
      ...(supplierItemsByLookupKey.get(normalizeLookupValue(uniqCode)) ?? []),
      ...(supplierItemsByLookupKey.get(normalizeLookupValue(sebangoCode)) ??
        []),
    ];

    const deduped = new Map<string, SupplierItemRecord>();
    matches.forEach((item, index) => {
      const key = String(
        item.id ??
          item.supplier_item_uuid ??
          item.row_id ??
          `${uniqCode ?? ""}-${sebangoCode ?? ""}-${index}`,
      );
      if (!deduped.has(key)) deduped.set(key, item);
    });

    return Array.from(deduped.values()).sort(
      (left, right) => Number(left.row_id ?? 0) - Number(right.row_id ?? 0),
    );
  };

  const getBomDefaultsForUniq = (uniqCode?: string) => {
    const uniq = String(uniqCode ?? "").trim();
    return {
      uom: uniq ? String(bomIndex.uomByUniq[uniq] ?? "") : "",
      weightKg:
        uniq && bomIndex.weightKgByUniq[uniq] != null
          ? String(bomIndex.weightKgByUniq[uniq])
          : "",
    };
  };

  const supplierOptionsByUniq = useMemo(() => {
    const map = new Map<string, SupplierOption[]>();
    supplierItemsByUniq.forEach((items, uniq) => {
      const names = new Set(
        items.map((i) => String(i.supplier_name ?? "").trim()).filter(Boolean),
      );
      const filtered = supplierOptions.filter((opt) =>
        names.has(String(opt.label ?? "").trim()),
      );
      if (filtered.length > 0) map.set(uniq, dedupeSupplierOptions(filtered));
    });
    return map;
  }, [supplierItemsByUniq, supplierOptions]);

  const findApprovedPrlMatch = (
    customerId: number | null | undefined,
    customerName: string | undefined,
    uniqCode: string | undefined,
  ) => {
    const normalizedUniq = String(uniqCode ?? "").trim();
    if (!normalizedUniq) return undefined;

    return approvedPrls.find((item) => {
      const resolvedCustomerId = resolvePrlCustomerId(
        item as Record<string, unknown>,
      );
      const itemUniq = String(
        item.uniq_code ?? item.item_uniq_code ?? "",
      ).trim();
      if (itemUniq !== normalizedUniq) return false;

      const matchesCustomerId =
        customerId != null && resolvedCustomerId === customerId;
      const matchesCustomerName =
        customerName &&
        String(item.customer_name ?? item.customer?.customer_name ?? "")
          .trim()
          .toLowerCase() === String(customerName).trim().toLowerCase();

      return Boolean(
        matchesCustomerId ||
        matchesCustomerName ||
        (!customerId && !customerName),
      );
    });
  };

  const customerOptions = useMemo(() => {
    const deduped = new Map<string, { value: number; label: string }>();

    approvedPrls.forEach((item) => {
      const value = resolvePrlCustomerId(item as Record<string, unknown>);
      const label = String(
        item.customer_name ?? item.customer?.customer_name ?? "",
      ).trim();
      if (!label || value == null) return;
      deduped.set(String(value), {
        value,
        label,
      });
    });

    return Array.from(deduped.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [approvedPrls, customerIdByName]);

  // UNIQ dropdown: always show all uniq_code from PRL management, no filter
  const uniqOptions = useMemo(() => {
    const deduped = new Map<string, { value: string; label: string }>();
    prls.forEach((item) => {
      const uniqCode = String(
        item.uniq_code ?? item.item_uniq_code ?? "",
      ).trim();
      if (!uniqCode) return;
      deduped.set(uniqCode, { value: uniqCode, label: uniqCode });
    });
    return Array.from(deduped.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [prls]);

  const filteredRows = useMemo(() => {
    const sourceRows = useApi
      ? rowsByTab[activeTab]
      : activeTab === "raw"
        ? initialRawRows
        : activeTab === "subcon"
          ? initialSubconRows
          : initialIndirectRows;

    return sourceRows.map((row, index) => ({
      ...row,
      productModel:
        row.productModel || bomIndex.assemblyCodeByUniq[row.uniq] || "-",
      partName: row.partName || bomIndex.partNameByUniq[row.uniq] || "-",
      supplier: resolveSupplierName(
        row.supplier as unknown,
        supplierNameByCode,
      ),
      key:
        row.key ||
        [
          activeTab,
          row.uniq || "item",
          row.customer || "customer",
          row.period || "period",
          index,
        ].join("-"),
    }));
  }, [
    rowsByTab,
    activeTab,
    supplierNameByCode,
    bomIndex.assemblyCodeByUniq,
    bomIndex.partNameByUniq,
    initialRawRows,
    initialSubconRows,
    initialIndirectRows,
  ]);

  const activeApiType = useMemo(() => getApiType(activeTab), [activeTab]);
  const activePagination = paginationByTab[activeTab];
  const activePaginationMeta = paginationMetaByTab[activeTab];

  const { data: summaryRes } = useGetPoBudgetSummaryQuery(
    { type: activeApiType },
    { skip: !useApi },
  );

  const fallbackSummary = useMemo(() => {
    const totalEntries = filteredRows.length;
    const totalSalesPlan = filteredRows.reduce(
      (sum, row) => sum + (Number(row.salesPlan) || 0),
      0,
    );
    const totalPo = filteredRows.reduce(
      (sum, row) => sum + (Number(row.totalPo) || 0),
      0,
    );
    const totalPrl = filteredRows.reduce(
      (sum, row) => sum + (Number(row.prl) || 0),
      0,
    );
    const deltaApoPrl = filteredRows.reduce(
      (sum, row) => sum + (Number(row.apoPrl) || 0),
      0,
    );
    const pendingApprovals = filteredRows.reduce(
      (sum, row) => sum + (row.status === "pending" ? 1 : 0),
      0,
    );

    return {
      total_entries: totalEntries,
      total_sales_plan: totalSalesPlan,
      total_po: totalPo,
      total_prl: totalPrl,
      delta_apo_prl: deltaApoPrl,
      pending_approvals: pendingApprovals,
    };
  }, [filteredRows]);

  const summary = useMemo(() => {
    if (useApi && summaryRes?.data) return summaryRes.data;
    return fallbackSummary;
  }, [fallbackSummary, summaryRes?.data]);

  const periodOptions = useMemo(
    () =>
      globalParameters
        .map((item) => String(item.period ?? "").trim())
        .filter(Boolean)
        .filter((value, index, arr) => arr.indexOf(value) === index)
        .map((value) => ({ label: value, value })),
    [globalParameters],
  );

  const uomOptions = useMemo(
    () =>
      uoms
        .map((uom) => {
          const value = String(
            uom.name ?? uom.unit_name ?? uom.code ?? uom.unit_code ?? "",
          ).trim();
          if (!value) return null;
          return { label: value, value };
        })
        .filter((item): item is { label: string; value: string } =>
          Boolean(item),
        ),
    [uoms],
  );

  const defaultUom = uomOptions[0]?.value ?? "";

  // approvedPrls already reflects the active PRL type filter, since
  // useListPrlsQuery sends prl_type derived from whichever modal (bulk or
  // single Add) is open — see activePrlTypeFilter.
  const bulkPrlOptions = useMemo(() => {
    const prlGroups = new Map<
      string,
      { customerName: string; uniqs: string[] }
    >();
    for (const item of approvedPrls) {
      const prlId = String(item.prl_id ?? item.id ?? "");
      if (!prlId) continue;
      const customerName = String(
        item.customer?.customer_name ?? item.customer_name ?? "-",
      );
      const uniqCode = String(
        item.uniq_code ?? item.item_uniq_code ?? "",
      ).trim();
      if (!prlGroups.has(prlId)) {
        prlGroups.set(prlId, { customerName, uniqs: [] });
      }
      const group = prlGroups.get(prlId)!;
      if (uniqCode && !group.uniqs.includes(uniqCode))
        group.uniqs.push(uniqCode);
    }
    return Array.from(prlGroups.entries()).map(([prlId, group]) => {
      const uniqSummary = group.uniqs.length > 0 ? group.uniqs.join(", ") : "-";
      return {
        label: `${prlId} — ${uniqSummary} (${group.customerName})`,
        value: `prl::${encodeURIComponent(prlId)}`,
      };
    });
  }, [approvedPrls]);

  const addPrlOptions = bulkPrlOptions;

  const prlOptions = useMemo(() => {
    const fromPo = (customerPos as any[])
      .map((po: any) => {
        const id = String(po.id ?? po.po_id ?? "");
        const poNumber = String(po.po_number ?? po.number ?? id);
        const customerName = String(
          po.customer?.customer_name ?? po.customer_name ?? "-",
        );
        return {
          label: `${poNumber} - ${customerName}`,
          value: `po:${id}`,
        };
      })
      .filter((x: any) => Boolean(x.value));

    return [...bulkPrlOptions, ...fromPo];
  }, [bulkPrlOptions, customerPos]);

  const matchedAddPrl = useMemo(() => {
    const effectiveCustomerId =
      addForm.customerId ??
      customerIdByName.get(normalizeCustomerName(addForm.customer)) ??
      null;

    return findApprovedPrlMatch(
      effectiveCustomerId,
      addForm.customer,
      addForm.uniq,
    );
  }, [
    addForm.customer,
    addForm.customerId,
    addForm.uniq,
    approvedPrls,
    customerIdByName,
  ]);

  const resolvedAddSupplierOption = useMemo(() => {
    const currentSupplier = String(addForm.supplier ?? "")
      .trim()
      .toLowerCase();
    if (!currentSupplier) return undefined;

    const options = addForm.uniq ? addSupplierOptions : supplierOptions;
    return options.find((option) => {
      const value = String(option.value ?? "")
        .trim()
        .toLowerCase();
      const label = String(option.label ?? "")
        .trim()
        .toLowerCase();
      const supplierName = String(option.supplierName ?? "")
        .trim()
        .toLowerCase();
      return (
        value === currentSupplier ||
        label === currentSupplier ||
        supplierName === currentSupplier
      );
    });
  }, [addForm.supplier, addForm.uniq, addSupplierOptions, supplierOptions]);

  const parsePrlSelection = (value: string) => {
    if (!value.startsWith("prl::")) return null;
    const parts = value.split("::");
    return {
      prlId: decodeURIComponent(parts[1] ?? ""),
      prlItemId: decodeURIComponent(parts[2] ?? ""),
    };
  };

  const selectedBulkPrl = useMemo(() => {
    const first = bulkPrlIds[0];
    const parsed = first ? parsePrlSelection(first) : null;
    if (parsed) {
      return approvedPrls.find((item) => {
        const itemPrlId = String(item.prl_id ?? item.id ?? "");
        if (itemPrlId !== parsed.prlId) return false;
        if (!parsed.prlItemId) return true;
        const itemRowId = String(
          getPrlRowId(item as Record<string, unknown>) ?? item.id ?? "",
        );
        return itemRowId === parsed.prlItemId;
      });
    }
    return approvedPrls.find(
      (item) => String(item.prl_id ?? item.id ?? "") === String(first ?? ""),
    );
  }, [approvedPrls, bulkPrlIds]);

  useEffect(() => {
    if (
      !useApi ||
      !selectedSinglePrlId ||
      !isChildBudgetType(getApiType(activeTab))
    ) {
      setSingleChildRows([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await loadPoBudgetPrlDetail(
          { id: selectedSinglePrlId, budgetType: getApiType(activeTab) },
          true,
        ).unwrap();
        if (cancelled) return;
        setSingleChildRows(buildSingleChildRowsFromPrlDetail(result.data));
      } catch (error) {
        if (cancelled) return;
        setSingleChildRows([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, loadPoBudgetPrlDetail, selectedSinglePrlId]);

  useEffect(() => {
    if (
      !useApi ||
      !bulkOpen ||
      !isChildBudgetType(getApiType(activeTab)) ||
      bulkPrlIds.length === 0
    ) {
      return;
    }

    let cancelled = false;
    const prlIds = Array.from(
      new Set(
        bulkPrlIds
          .map((value) => parsePrlSelection(String(value))?.prlId ?? "")
          .filter(Boolean),
      ),
    );

    (async () => {
      for (const prlId of prlIds) {
        if (cancelled || bulkPrlDetailCache[prlId]) continue;
        try {
          const result = await loadPoBudgetPrlDetail(
            { id: prlId, budgetType: getApiType(activeTab) },
            true,
          ).unwrap();
          if (cancelled) return;
          setBulkPrlDetailCache((prev) => ({
            ...prev,
            [prlId]: result.data,
          }));
        } catch (error) {
          if (cancelled) return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    bulkOpen,
    bulkPrlDetailCache,
    bulkPrlIds,
    loadPoBudgetPrlDetail,
  ]);

  const buildAutoSuppliers = (
    uniqCode: string,
    totalQty: number,
  ): BulkSupplierLine[] => {
    const items = (supplierItemsByUniq.get(uniqCode) ?? [])
      .slice()
      .sort((a, b) => (a.row_id ?? 0) - (b.row_id ?? 0));

    if (items.length === 0) {
      // No supplier-items registered for this uniq — show a single fallback entry
      // indicating missing data. This aligns with the UI requirement to show
      // "tidak ada data" when a uniq has no registered suppliers.
      return [
        {
          id: `auto-1`,
          supplier: "Tidak ada data",
          qty: totalQty,
          percentage: 100,
        },
      ];
    }

    return items
      .filter((si) => Boolean(si.supplier_name || si.supplier_uuid))
      .map((si, idx) => {
        const pct = Number(si.percentage ?? 0);
        const supplierValue = String(
          si.supplier_uuid ?? si.supplier_name ?? "",
        ).trim();
        return {
          id: `auto-${idx + 1}`,
          supplier: supplierValue,
          qty: pct > 0 ? Math.round((totalQty * pct) / 100) : 0,
          percentage: pct > 0 ? pct : undefined,
        };
      });
  };

  // Resolve the supplier-items registered for a specific child row by matching
  // on ANY of the row's codes (UNIQ or sebango/material code), ignoring the
  // active tab so subcon parts registered under their sebango still resolve.
  const getChildSupplierItems = (
    row: PoBudgetChildRow,
  ): SupplierItemRecord[] => {
    const codes = Array.from(
      new Set(
        [
          normalizeLookupValue(getChildSupplierLookupUniq(row)),
          normalizeLookupValue(row.uniq),
          normalizeLookupValue(row.childUniqCode),
        ].filter(Boolean),
      ),
    );
    const deduped = new Map<string, SupplierItemRecord>();
    codes.forEach((code) => {
      (supplierItemsByCode.get(code) ?? []).forEach((item, index) => {
        const key = String(
          item.id ??
            item.supplier_item_uuid ??
            item.row_id ??
            `${code}-${index}`,
        );
        if (!deduped.has(key)) deduped.set(key, item);
      });
    });
    return Array.from(deduped.values()).sort(
      (a, b) => Number(a.row_id ?? 0) - Number(b.row_id ?? 0),
    );
  };

  const buildSupplierOptionsFromItems = (
    items: SupplierItemRecord[],
  ): SupplierOption[] => {
    const deduped = new Map<string, SupplierOption>();
    items.forEach((item) => {
      const supplierName =
        typeof item.supplier_name === "string" ? item.supplier_name.trim() : "";
      if (!supplierName) return;
      const supplierId = resolveSupplierRowId({
        supplierUuid: item.supplier_uuid,
        supplierCode: item.supplier_code,
        supplierName,
        fallbackValue: item.supplier_uuid,
      });
      const supplierValue =
        item.supplier_uuid == null ? supplierName : String(item.supplier_uuid);
      const key = supplierValue || supplierName.toLowerCase();
      if (deduped.has(key)) return;
      deduped.set(key, {
        value: supplierValue || supplierName,
        label: supplierName,
        supplierName,
        supplierId,
        uniqCode:
          typeof item.uniq_code === "string"
            ? item.uniq_code.trim() || undefined
            : undefined,
        uom: typeof item.uom === "string" ? item.uom.trim() : undefined,
        weight:
          typeof item.weight === "number"
            ? item.weight
            : Number(item.weight ?? 0) || undefined,
        description:
          typeof item.description === "string"
            ? item.description.trim()
            : undefined,
        percentage:
          typeof item.percentage === "number" ? item.percentage : undefined,
      });
    });
    return Array.from(deduped.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  };

  const getChildSupplierOptions = (row: PoBudgetChildRow): SupplierOption[] =>
    dedupeSupplierOptions(
      buildSupplierOptionsFromItems(getChildSupplierItems(row)),
    );

  // Auto-fill suppliers for a child row from its registered supplier-items.
  const buildChildAutoSuppliers = (
    row: PoBudgetChildRow,
  ): BulkSupplierLine[] => {
    const totalQty = Number(row.quantity || 0);
    const usable = getChildSupplierItems(row).filter((si) =>
      Boolean(si.supplier_name || si.supplier_uuid),
    );
    if (usable.length === 0) {
      return [
        {
          id: `auto-1`,
          supplier: "Tidak ada data",
          qty: totalQty,
          percentage: 100,
        },
      ];
    }
    return usable.map((si, idx) => {
      const pct = Number(si.percentage ?? 0);
      const supplierValue = String(
        si.supplier_uuid ?? si.supplier_name ?? "",
      ).trim();
      const qty =
        pct > 0
          ? Math.round((totalQty * pct) / 100)
          : usable.length === 1
            ? totalQty
            : 0;
      return {
        id: `auto-${idx + 1}`,
        supplier: supplierValue,
        qty,
        percentage: pct > 0 ? pct : undefined,
      };
    });
  };

  const buildBulkItemsFromPrl = (
    selection?: string | string[],
  ): BulkItemRow[] => {
    const selectedValues = Array.isArray(selection)
      ? selection
      : selection
        ? [selection]
        : [];
    if (selectedValues.length === 0) return [];

    const rows: BulkItemRow[] = [];
    const activeBudgetType = getApiType(activeTab);
    const childBudget = isChildBudgetType(activeBudgetType);
    const usedChildPrlIds = new Set<string>();

    for (const selectedValue of selectedValues) {
      // support selecting a customer PO via `po:<id>` value
      if (String(selectedValue).startsWith("po:")) {
        const poId = String(selectedValue).slice(3);
        const po = (customerPos as any[]).find(
          (p: any) => String(p.id ?? p.po_id ?? "") === poId,
        );
        if (!po || !Array.isArray(po.items)) continue;
        rows.push(
          ...(po.items as any[]).map((it: any, index: number) => {
            const uniqCode = String(
              it.uniq_code ?? it.item_uniq_code ?? it.item_uniq ?? "",
            );
            const partNumber = String(
              it.part_number ?? bomIndex.partNumberByUniq[uniqCode] ?? "",
            );
            const supplierItemMatch = findSupplierItemsForProduct(
              uniqCode,
              partNumber,
            )[0];
            const bomDefaults = getBomDefaultsForUniq(uniqCode);
            return {
              key: `po-${poId}-${index}`,
              prlId: `po:${poId}`,
              prlItemId: null,
              uniq: uniqCode,
              childUniqCode: uniqCode,
              parentUniqCode: uniqCode,
              productModel: String(
                it.product_model ??
                  bomIndex.assemblyCodeByUniq[uniqCode] ??
                  "-",
              ),
              partName: String(
                it.part_name ?? bomIndex.partNameByUniq[uniqCode] ?? "-",
              ),
              partNumber: String(
                it.part_number ?? bomIndex.partNumberByUniq[uniqCode] ?? "-",
              ),
              weightKg: Number(
                bomDefaults.weightKg || supplierItemMatch?.weight || 0,
              ),
              uom: String(
                bomDefaults.uom || supplierItemMatch?.uom || defaultUom,
              ),
              quantity: Number(it.quantity ?? 0),
              existingRawMaterial: String(
                supplierItemMatch?.description ?? "-",
              ),
              suppliers: buildAutoSuppliers(uniqCode, Number(it.quantity ?? 0)),
            } as BulkItemRow;
          }),
        );
        continue;
      }

      const parsed = parsePrlSelection(String(selectedValue));
      if (childBudget && parsed?.prlId) {
        if (usedChildPrlIds.has(parsed.prlId)) continue;
        usedChildPrlIds.add(parsed.prlId);
        const detail = bulkPrlDetailCache[parsed.prlId];
        if (!detail) continue;
        const childRows = buildBulkChildRowsFromPrlDetail(detail).map(
          (row) => ({
            ...row,
            suppliers: buildChildAutoSuppliers(row),
          }),
        );
        rows.push(...childRows);
        continue;
      }

      const matchedRows = parsed
        ? approvedPrls.filter((item) => {
            const itemPrlId = String(item.prl_id ?? item.id ?? "");
            if (itemPrlId !== parsed.prlId) return false;
            // prlOptions groups by PRL only (no row segment), so an empty
            // prlItemId means "match every row under this PRL".
            if (!parsed.prlItemId) return true;
            const itemRowId = String(
              getPrlRowId(item as Record<string, unknown>) ?? item.id ?? "",
            );
            return itemRowId === parsed.prlItemId;
          })
        : approvedPrls.filter(
            (item) =>
              String(item.prl_id ?? item.id ?? "") ===
              String(selectedValue ?? ""),
          );

      rows.push(
        ...matchedRows.map((item, index) => {
          const uniqCode = String(item.uniq_code ?? item.item_uniq_code ?? "");
          const partNumber = String(
            item.part_number ?? bomIndex.partNumberByUniq[uniqCode] ?? "",
          );
          const supplierItemMatch = findSupplierItemsForProduct(
            uniqCode,
            partNumber,
          )[0];
          const bomDefaults = getBomDefaultsForUniq(uniqCode);
          const prlRowId = getPrlRowId(item as Record<string, unknown>);
          if (prlRowId == null) {
            try {
              // eslint-disable-next-line no-console
              console.debug("po-budget: unresolved PRL row_id", {
                uniqCode,
                prlSnippet: {
                  prl_id: (item as any).prl_id ?? (item as any).id,
                  row_id: (item as any).row_id,
                },
              });
            } catch (e) {
              /* ignore */
            }
          }

          return {
            key: String(
              prlRowId ?? item.id ?? `${item.prl_id ?? selectedValue}-${index}`,
            ),
            prlId: String(item.prl_id ?? item.id ?? ""),
            prlItemId: prlRowId,
            uniq: uniqCode,
            childUniqCode: uniqCode,
            parentUniqCode: uniqCode,
            productModel: String(
              item.product_model ??
                bomIndex.assemblyCodeByUniq[uniqCode] ??
                "-",
            ),
            partName: String(
              item.part_name ?? bomIndex.partNameByUniq[uniqCode] ?? "-",
            ),
            partNumber: String(
              item.part_number ?? bomIndex.partNumberByUniq[uniqCode] ?? "-",
            ),
            weightKg: Number(
              bomDefaults.weightKg || supplierItemMatch?.weight || 0,
            ),
            uom: String(
              bomDefaults.uom || supplierItemMatch?.uom || defaultUom,
            ),
            quantity: Number(item.quantity ?? 0),
            existingRawMaterial: String(supplierItemMatch?.description ?? "-"),
            suppliers: buildAutoSuppliers(uniqCode, Number(item.quantity ?? 0)),
          };
        }),
      );
    }

    const deduped = new Map<string, BulkItemRow>();
    rows.forEach((row) => deduped.set(row.key, row));
    return Array.from(deduped.values());
  };

  const flattenStoredChildTree = (
    children: PoBudgetPrlDetail["items"][number]["children"] | undefined,
    level = 1,
    parentKey = "child",
  ): BomChildDetailRow[] => {
    const source = Array.isArray(children) ? children : [];
    return source.flatMap((child, index) => {
      const row: BomChildDetailRow = {
        key: `${parentKey}-${String(child.uniq_code ?? child.uniq ?? index)}`,
        uniq: String(
          child.uniq ?? child.material_spec?.material_grade ?? "",
        ).trim(),
        childUniqCode: String(child.uniq_code ?? "").trim(),
        partName: String(child.part_name ?? "-"),
        partNumber: String(child.part_number ?? "-"),
        quantityPerUniq: Number(child.quantity ?? child.qty_per_uniq ?? 0),
        uom: String(child.uom ?? ""),
        weightKg: Number(
          child.weight_kg ?? child.material_spec?.weight_kg ?? 0,
        ),
        level,
      };
      const descendants = flattenStoredChildTree(
        child.children as PoBudgetPrlDetail["items"][number]["children"],
        level + 1,
        row.key,
      );
      return [row, ...descendants];
    });
  };

  const uniqueTextValues = (values: string[]) => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values
      .map((v) => String(v || "").trim())
      .filter(Boolean)) {
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
    return result;
  };

  const formatChildSummary = (labels: string[]) => {
    const visible = uniqueTextValues(labels);
    if (visible.length === 0) return "";
    const shown = visible.slice(0, 4).join(", ");
    const rest = visible.length - 4;
    return rest > 0 ? `${shown} +${rest} more` : shown;
  };

  const buildParentChildSummary = (
    children: PoBudgetPrlDetail["items"][number]["children"] | undefined,
  ) => {
    const source = Array.isArray(children) ? children : [];
    if (source.length === 0) return "";

    const gradeLabels = uniqueTextValues(
      source.map((child) =>
        String(
          child.uniq ??
            child.material_spec?.material_grade ??
            child.uniq_code ??
            "",
        ).trim(),
      ),
    );

    if (gradeLabels.length > 1) {
      return formatChildSummary(gradeLabels);
    }

    const uniqCodes = uniqueTextValues(
      source.map((child) => String(child.uniq_code ?? "").trim()),
    );

    if (uniqCodes.length > 0) {
      return formatChildSummary(uniqCodes);
    }

    return formatChildSummary(gradeLabels);
  };

  const hasStoredChildren = (row: PoBudgetRow) =>
    getStoredParents(row.detailJson).length > 0;

  const getAutoExpandedBulkKeys = (_items: BulkItemRow[]) => [];

  const initialBulkItems = useMemo<BulkItemRow[]>(
    () => buildBulkItemsFromPrl(prlOptions[0]?.value),
    [
      prlOptions,
      approvedPrls,
      bomIndex.assemblyCodeByUniq,
      bomIndex.partNameByUniq,
      bomIndex.partNumberByUniq,
      defaultUom,
      supplierItemsByUniq,
    ],
  );

  const [bulkItems, setBulkItems] = useState<BulkItemRow[]>(initialBulkItems);
  const syncBulkItemsFromPrl = (selection?: string | string[]) => {
    const nextItems = buildBulkItemsFromPrl(selection);
    setBulkItems(nextItems);
    setExpandedBulkRowKeys(getAutoExpandedBulkKeys(nextItems));
  };

  const bulkParentGroups = useMemo(() => {
    const order: string[] = [];
    const groups = new Map<
      string,
      {
        key: string;
        prlId: string;
        parentUniqCode: string;
        partName: string;
        partNumber: string;
        budgetQty: number;
        rows: BulkItemRow[];
      }
    >();

    for (const row of bulkItems) {
      const groupKey = `${row.prlId}::${row.parentUniqCode || row.prlItemId || row.key}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          prlId: row.prlId,
          parentUniqCode: row.parentUniqCode || row.uniq,
          partName: row.isHeader ? row.partName : "",
          partNumber: row.isHeader ? row.partNumber : "",
          budgetQty: row.isHeader ? Number(row.quantity || 0) : 0,
          rows: [],
        });
        order.push(groupKey);
      }

      const group = groups.get(groupKey)!;
      if (row.isHeader) {
        group.parentUniqCode = row.parentUniqCode || group.parentUniqCode;
        group.partName = row.partName || group.partName;
        group.partNumber = row.partNumber || group.partNumber;
        group.budgetQty = Number(row.quantity || group.budgetQty || 0);
      } else {
        group.rows.push(row);
        if (!group.partName) group.partName = row.partName;
        if (!group.partNumber) group.partNumber = row.partNumber;
        if (!group.budgetQty) group.budgetQty = Number(row.quantity || 0);
      }
    }

    return order
      .map((key) => groups.get(key))
      .filter(Boolean)
      .map((group) => ({
        ...group!,
        childLabels: group!.rows
          .map((row) => row.uniq || row.childUniqCode)
          .filter(Boolean),
        totalChildQty: group!.rows.reduce(
          (sum, row) => sum + Number(row.quantity || 0),
          0,
        ),
      }));
  }, [bulkItems]);

  const bulkPrlGroups = useMemo(() => {
    const order: string[] = [];
    const groups = new Map<
      string,
      {
        prlId: string;
        prlNumber: string;
        customerName: string;
        period: string;
        parents: typeof bulkParentGroups;
      }
    >();

    for (const group of bulkParentGroups) {
      const prlId = group.prlId;
      if (!groups.has(prlId)) {
        const detail = bulkPrlDetailCache[prlId];
        groups.set(prlId, {
          prlId,
          prlNumber: detail?.prl_number || prlId,
          customerName: detail?.customer_name || "-",
          period: detail?.period || "",
          parents: [],
        });
        order.push(prlId);
      }
      groups.get(prlId)!.parents.push(group);
    }

    return order.map((prlId) => groups.get(prlId)!);
  }, [bulkParentGroups, bulkPrlDetailCache]);

  useEffect(() => {
    if (!addForm.period && periodOptions[0]?.value) {
      setAddForm((prev) => ({ ...prev, period: periodOptions[0].value }));
    }
    if (!bulkPeriod && periodOptions[0]?.value) {
      setBulkPeriod(periodOptions[0].value);
    }
  }, [addForm.period, bulkPeriod, periodOptions]);

  useEffect(() => {
    const matchedPeriod = getPrlPeriodValue(matchedAddPrl);
    if (!matchedPeriod) return;

    setAddForm((prev) =>
      prev.period === matchedPeriod ? prev : { ...prev, period: matchedPeriod },
    );
  }, [matchedAddPrl]);

  useEffect(() => {
    const effectiveCustomerId =
      customerIdByName.get(normalizeCustomerName(addForm.customer)) ?? null;
    if (
      !addForm.customer ||
      effectiveCustomerId == null ||
      addForm.customerId === effectiveCustomerId
    ) {
      return;
    }

    setAddForm((prev) => ({
      ...prev,
      customerId: effectiveCustomerId,
    }));
  }, [addForm.customer, addForm.customerId, customerIdByName]);

  useEffect(() => {
    if (
      !addForm.supplier ||
      resolvedAddSupplierOption?.supplierId == null ||
      addForm.supplierId === resolvedAddSupplierOption.supplierId
    ) {
      return;
    }

    setAddForm((prev) => ({
      ...prev,
      supplierId: resolvedAddSupplierOption.supplierId ?? null,
      supplier: resolvedAddSupplierOption.supplierName ?? prev.supplier,
      uom: resolvedAddSupplierOption.uom ?? prev.uom,
      weightKg:
        resolvedAddSupplierOption.weight == null
          ? prev.weightKg
          : String(resolvedAddSupplierOption.weight),
      description: resolvedAddSupplierOption.description ?? prev.description,
    }));
  }, [addForm.supplier, addForm.supplierId, resolvedAddSupplierOption]);

  useEffect(() => {
    syncBulkItemsFromPrl(bulkPrlIds);
  }, [
    activeTab,
    bulkPrlIds,
    approvedPrls.length,
    defaultUom,
    bulkPrlDetailCache,
  ]);

  useEffect(() => {
    const selectedPeriod = getPrlPeriodValue(selectedBulkPrl);
    if (selectedPeriod) {
      setBulkPeriod((prev) =>
        prev === selectedPeriod ? prev : selectedPeriod,
      );
      return;
    }

    if (periodOptions[0]?.value) {
      setBulkPeriod((prev) =>
        prev === periodOptions[0].value ? prev : periodOptions[0].value,
      );
    }
  }, [selectedBulkPrl, periodOptions]);

  const activeAddSupplierItem = useMemo(
    () => bulkItems.find((it) => it.key === addSupplierItemKey),
    [bulkItems, addSupplierItemKey],
  );

  const addSupplierModalOptions = useMemo(() => {
    if (!activeAddSupplierItem) return dedupeSupplierOptions(supplierOptions);

    const uniq = String(
      isChildBudgetType(getApiType(activeTab))
        ? getChildSupplierLookupUniq(activeAddSupplierItem)
        : (activeAddSupplierItem.uniq ?? ""),
    ).trim();
    let related = supplierItemsByUniq.get(uniq) ?? [];
    if (!related.length) {
      related = supplierItems.filter(
        (it) => String(it.uniq_code ?? it.item_uniq_code ?? "").trim() === uniq,
      );
    }
    const relatedNames = new Set(
      related
        .map((r) => String(r.supplier_name ?? r.supplier ?? "").trim())
        .filter(Boolean),
    );
    const baseOptions = supplierOptions.filter((opt) =>
      relatedNames.has(String(opt.label ?? opt.value ?? "").trim()),
    );
    const finalBase = baseOptions.length ? baseOptions : supplierOptions;
    // NOTE: we intentionally do NOT filter out suppliers already assigned to
    // this item here.  confirmAddSupplier() handles the duplicate check with a
    // clearer warning instead of silently hiding options.
    return dedupeSupplierOptions(finalBase);
  }, [activeAddSupplierItem, supplierOptions]);

  const addSupplierBudget = activeAddSupplierItem?.quantity ?? 0;
  const addSupplierAllocated = useMemo(() => {
    if (!activeAddSupplierItem) return 0;
    return activeAddSupplierItem.suppliers.reduce(
      (sum, s) => sum + Number(s.qty || 0),
      0,
    );
  }, [activeAddSupplierItem]);

  const addSupplierRemaining = Math.max(
    0,
    addSupplierBudget - addSupplierAllocated,
  );

  const openBulkPoBudget = () => {
    setBulkPrlSearch("");
    setBulkPrlPage(1);
    setPrlCache([]);
    setBulkPrlDetailCache({});
    setBulkItems([]);
    setExpandedBulkRowKeys([]);
    setCollapsedBulkGroupKeys([]);
    setBulkPeriod(periodOptions[0]?.value);
    setBulkPrlIds([]);
    setBulkPoIds([]);
    setBulkBudgetType("adhoc");
    setBulkPo1Pct(60);
    setBulkPo2Pct(40);
    setBulkOpen(true);
  };

  const openAddBudget = () => {
    setSelectedSinglePrlId(undefined);
    setSingleChildRows([]);
    setAddBudgetType("adhoc");
    setAddForm((p) => ({ ...p, prl: "" }));
    setAddOpen(true);
  };

  const toggleExpandedRowKey = (
    rowKey: string,
    setExpandedKeys: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setExpandedKeys((prev) =>
      prev.includes(rowKey)
        ? prev.filter((key) => key !== rowKey)
        : [...prev, rowKey],
    );
  };

  const bomChildColumns = useMemo<ColumnsType<BomChildDetailRow>>(
    () => [
      {
        title: "Material Grade",
        dataIndex: "uniq",
        key: "uniq",
        width: 200,
        render: (value: string, record) => (
          <div className="flex items-center gap-2">
            <Tag color="blue" className="!m-0">
              {value || "-"}
            </Tag>
            {record.childUniqCode ? (
              <span className="text-xs text-gray-500">
                {record.childUniqCode}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        title: "Part Name",
        dataIndex: "partName",
        key: "partName",
        render: (value: string, record) => (
          <div
            className="text-sm text-gray-700"
            style={{ paddingLeft: `${Math.max(0, (record.level - 1) * 16)}px` }}
          >
            {record.level > 1 ? (
              <span className="text-gray-400 mr-1">↳</span>
            ) : null}
            {value}
          </div>
        ),
      },

      {
        title: "Part Number",
        dataIndex: "partNumber",
        key: "partNumber",
        width: 180,
        render: (value: string) => (
          <span className="text-sm text-gray-700">{value}</span>
        ),
      },
      {
        title: "Quantity",
        dataIndex: "quantityPerUniq",
        key: "quantityPerUniq",
        width: 110,
        align: "right",
        render: (value: number) => (
          <span className="text-sm text-gray-700">{formatNumber(value)}</span>
        ),
      },
      {
        title: "UOM",
        dataIndex: "uom",
        key: "uom",
        width: 100,
        render: (value: string) => (
          <span className="text-sm text-gray-700">{value || "-"}</span>
        ),
      },
      {
        title: "Weight (kg)",
        dataIndex: "weightKg",
        key: "weightKg",
        width: 110,
        align: "right",
        render: (value: number) => (
          <span className="text-sm text-gray-700">{formatNumber(value)}</span>
        ),
      },
    ],
    [],
  );

  const renderStoredChildren = (row: PoBudgetRow) => {
    const parents = getStoredParents(row.detailJson);
    if (parents.length === 0) return null;

    const allChildren = parents.flatMap((p) =>
      Array.isArray(p.children) ? p.children : [],
    );
    const totalQty = allChildren.reduce(
      (sum, r) => sum + Number(r.quantity ?? r.qty_per_uniq ?? 0),
      0,
    );

    return (
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
          <div className="text-[13px] font-semibold text-gray-700">
            Material Tree
          </div>
          <div className="text-xs text-gray-500">
            {parents.length} parent{parents.length !== 1 ? "s" : ""} ·{" "}
            {allChildren.length} material{allChildren.length !== 1 ? "s" : ""} ·
            qty {formatNumber(totalQty)}
          </div>
        </div>

        {parents.map((parent, pIdx) => {
          const parentChildren = Array.isArray(parent.children)
            ? parent.children
            : [];
          const parentRows: BomChildDetailRow[] = flattenStoredChildTree(
            parentChildren as PoBudgetPrlDetail["items"][number]["children"],
            1,
            `parent-${pIdx}`,
          );
          const parentTotal = parentRows.reduce(
            (sum, r) => sum + r.quantityPerUniq,
            0,
          );

          const collapseKey = `${row.key}::parent-${pIdx}`;
          const isCollapsed = !expandedStoredParentKeys.includes(collapseKey);

          return (
            <div
              key={`stored-parent-${pIdx}`}
              className="border-b border-gray-100 last:border-b-0"
            >
              <div
                className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-50/40 cursor-pointer select-none"
                onClick={() =>
                  toggleExpandedRowKey(collapseKey, setExpandedStoredParentKeys)
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Tag color="blue" className="!m-0">
                    {parent.uniq_code || "-"}
                  </Tag>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {parent.part_name || "-"}
                  </span>
                  {parent.part_number ? (
                    <span className="text-xs text-gray-400 shrink-0">
                      {parent.part_number}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-500">
                    {parentRows.length} item
                    {parentRows.length !== 1 ? "s" : ""} · qty{" "}
                    <span className="font-medium text-gray-700">
                      {formatNumber(parentTotal)}
                    </span>
                  </span>
                  <DownOutlined
                    className={`!text-[10px] !text-gray-400 transition-transform ${
                      isCollapsed ? "-rotate-90" : ""
                    }`}
                  />
                </div>
              </div>

              {isCollapsed ? null : parentRows.length > 0 ? (
                <Table<BomChildDetailRow>
                  dataSource={parentRows}
                  columns={bomChildColumns}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  bordered={false}
                />
              ) : (
                <div className="px-4 py-3 text-xs text-gray-400">
                  No child material found for this parent.
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const bulkUpdateSupplier = (
    itemKey: string,
    supplierId: string,
    patch: Partial<BulkSupplierLine>,
  ) => {
    setBulkItems((prev) =>
      prev.map((it) => {
        if (it.key !== itemKey) return it;
        let nextSuppliers = it.suppliers.map((s) =>
          s.id === supplierId ? { ...s, ...patch } : s,
        );

        // Cap per-supplier qty by its percentage limit.
        if (patch.qty != null) {
          nextSuppliers = nextSuppliers.map((s) => {
            if (s.id !== supplierId || !s.percentage) return s;
            const maxQty = Math.round((it.quantity * s.percentage) / 100);
            if (Number(s.qty) > maxQty) {
              message.warning(
                `Qty melebihi batas ${s.percentage}% (max: ${maxQty})`,
              );
              return { ...s, qty: maxQty };
            }
            return s;
          });
        }

        // Ensure total does not exceed item quantity.
        const total = nextSuppliers.reduce(
          (sum, s) => sum + Number(s.qty || 0),
          0,
        );
        if (total > it.quantity) {
          const over = total - it.quantity;
          const adjusted = nextSuppliers.map((s) => ({ ...s }));
          const idx = adjusted.findIndex((s) => s.id === supplierId);
          if (idx >= 0) {
            adjusted[idx].qty = Math.max(
              0,
              Number(adjusted[idx].qty || 0) - over,
            );
          }
          message.warning(
            "Total supplier quantities cannot exceed item quantity",
          );
          return { ...it, suppliers: adjusted };
        }

        return { ...it, suppliers: nextSuppliers };
      }),
    );
  };

  const bulkRemoveSupplier = (itemKey: string, supplierId: string) => {
    setBulkItems((prev) =>
      prev.map((it) =>
        it.key !== itemKey
          ? it
          : {
              ...it,
              suppliers: it.suppliers.filter((s) => s.id !== supplierId),
            },
      ),
    );
  };

  const bulkAddSupplierLine = (itemKey: string) => {
    const target = bulkItems.find((it) => it.key === itemKey);
    if (!target) return;
    const allocated = target.suppliers.reduce(
      (sum, s) => sum + Number(s.qty || 0),
      0,
    );
    const remaining = Math.max(0, target.quantity - allocated);
    setAddSupplierItemKey(itemKey);
    // Kalau remaining=0 (semua ter-alokasi), set qty undefined agar user input sendiri
    setAddSupplierForm({
      supplier: undefined,
      qty: remaining > 0 ? remaining : undefined,
    });
    setAddSupplierOpen(true);
  };

  const confirmAddSupplier = () => {
    if (!addSupplierItemKey) return;
    const supplier = addSupplierForm.supplier;
    const qty = addSupplierForm.qty != null ? Number(addSupplierForm.qty) : 0;
    if (!supplier) {
      message.warning("Please select supplier");
      return;
    }
    if (!qty || qty <= 0) {
      message.warning("Please enter quantity");
      return;
    }

    const target = bulkItems.find((it) => it.key === addSupplierItemKey);
    if (!target) return;
    const duplicateSupplier = target.suppliers.some(
      (item) => item.supplier === supplier,
    );
    if (duplicateSupplier) {
      message.warning("Supplier already added for this item");
      return;
    }
    const allocated = target.suppliers.reduce(
      (sum, s) => sum + Number(s.qty || 0),
      0,
    );
    if (allocated + qty > target.quantity) {
      const remaining = Math.max(0, target.quantity - allocated);
      message.warning(
        `Total quantity cannot exceed budget${remaining > 0 ? ` (remaining: ${remaining})` : ""}`,
      );
      return;
    }

    setBulkItems((prev) =>
      prev.map((it) => {
        if (it.key !== addSupplierItemKey) return it;
        const nextId = `s${it.suppliers.length + 1}`;
        const pct = (addSupplierForm as any).percentage as number | undefined;
        return {
          ...it,
          suppliers: [
            ...it.suppliers,
            { id: nextId, supplier, qty, percentage: pct },
          ],
        };
      }),
    );

    setAddSupplierOpen(false);
  };

  const bulkUpdateQuantity = (itemKey: string, nextQty: number) => {
    setBulkItems((prev) =>
      prev.map((it) => {
        if (it.key !== itemKey) return it;
        const qty = Math.max(0, Number(nextQty || 0));
        const total = it.suppliers.reduce(
          (sum, s) => sum + Number(s.qty || 0),
          0,
        );
        if (total > qty) {
          message.warning(
            "Total supplier quantities cannot exceed item quantity",
          );
        }
        return { ...it, quantity: qty };
      }),
    );
  };

  const bulkUpdateItem = (itemKey: string, patch: Partial<BulkItemRow>) => {
    setBulkItems((prev) =>
      prev.map((item) => (item.key === itemKey ? { ...item, ...patch } : item)),
    );
  };

  // Update total qty of one UNIQ group: header keeps the total, children get an
  // equal split, and each supplier line with a percentage is rescaled from it.
  const bulkUpdateGroupQty = (
    group: (typeof bulkParentGroups)[number],
    nextQty: number,
  ) => {
    const qty = Math.max(0, Number(nextQty || 0));
    const childKeys = new Set(group.rows.map((row) => row.key));
    const perChildQty = Math.round(qty / Math.max(1, group.rows.length));

    setBulkItems((prev) =>
      prev.map((it) => {
        const itemGroupKey = `${it.prlId}::${it.parentUniqCode || it.prlItemId || it.key}`;
        if (itemGroupKey !== group.key) return it;
        if (it.isHeader) return { ...it, quantity: qty };
        if (!childKeys.has(it.key)) return it;

        const suppliers = it.suppliers.map((s) =>
          s.percentage && s.percentage > 0
            ? { ...s, qty: Math.round((perChildQty * s.percentage) / 100) }
            : s,
        );
        return { ...it, quantity: perChildQty, suppliers };
      }),
    );
  };

  const computedPo1Units = useMemo(() => {
    const pr = Number(addForm.purchaseRequest || 0);
    const pct = Number(addForm.po1Pct || 0);
    return Math.round((pr * pct) / 100);
  }, [addForm.po1Pct, addForm.purchaseRequest]);

  const computedPo2Units = useMemo(() => {
    const pr = Number(addForm.purchaseRequest || 0);
    const pct = Number(addForm.po2Pct || 0);
    return Math.round((pr * pct) / 100);
  }, [addForm.po2Pct, addForm.purchaseRequest]);

  const derivedPrlAmount = useMemo(() => {
    return approvedPrls
      .filter((item) => {
        const resolvedCustomerId = resolvePrlCustomerId(
          item as Record<string, unknown>,
        );
        return (
          (addForm.customerId != null &&
            resolvedCustomerId === addForm.customerId) ||
          String(item.customer_name ?? "").toLowerCase() ===
            String(addForm.customer || "").toLowerCase()
        );
      })
      .filter(
        (item) =>
          String(item.uniq_code ?? item.item_uniq_code ?? "") ===
          String(addForm.uniq || ""),
      )
      .filter(
        (item) =>
          String(item.forecast_period ?? item.period ?? "") ===
          String(addForm.period || ""),
      )
      .reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  }, [
    addForm.customer,
    addForm.customerId,
    addForm.period,
    addForm.uniq,
    approvedPrls,
    customerIdByName,
  ]);

  const saveAddBudget = async () => {
    const effectiveCustomerId =
      addForm.customerId ??
      customerIdByName.get(normalizeCustomerName(addForm.customer)) ??
      toIntegerId(addForm.customer) ??
      // fallback: if matchedAddPrl exists, try to resolve from it
      (matchedAddPrl
        ? resolvePrlCustomerId(matchedAddPrl as Record<string, unknown>)
        : null) ??
      null;

    const effectiveSupplierId =
      addForm.supplierId ??
      resolvedAddSupplierOption?.supplierId ??
      // try to resolve by supplier name text
      resolveSupplierRowId({ supplierName: addForm.supplier }) ??
      null;

    // NOTE: Removed client-side blocking validation so backend responses
    // (success or detailed validation errors) are visible to the user.
    // The API will return validation messages which we surface in the catch.

    const payload: PoBudgetEntryRequest = {
      // Ensure customer_id matches expected `string | number` type.
      // Use resolved ID when available, otherwise fall back to the visible
      // customer text so the backend can attempt resolution and return
      // a helpful error if necessary.
      customer_id: (effectiveCustomerId ?? addForm.customer ?? "") as
        string | number,
      customer_name: addForm.customer,
      uniq_code: addForm.uniq,
      product_model: addForm.productModel,
      part_name: addForm.partName,
      part_number: addForm.partNumber,
      uom: addForm.uom,
      weight_kg: Number(addForm.weightKg || 0),
      description: addForm.description,
      supplier_id: (effectiveSupplierId ?? addForm.supplier ?? "") as
        string | number,
      supplier_name: addForm.supplier,
      period: normalizePeriodForApi(addForm.period),
      sales_plan: Number(addForm.salesPlan || 0),
      purchase_request: Number(addForm.purchaseRequest || 0),
      po1_pct: Number(addForm.po1Pct || 0),
      po2_pct: Number(addForm.po2Pct || 0),
      prl: Number(derivedPrlAmount || addForm.prl || 0),
      detail_jsonb: isChildBudgetType(getApiType(activeTab))
        ? buildSingleStoredDetailPayload({
            prlId: selectedSinglePrlId,
            parentUniqCode: addForm.uniq,
            parentPartName: addForm.partName,
            parentPartNumber: addForm.partNumber,
            purchaseRequest: Number(addForm.purchaseRequest || 0),
            supplierId: effectiveSupplierId,
            supplierName: addForm.supplier,
            rows: singleChildRows,
          })
        : undefined,
    };

    try {
      if (useApi) {
        await addEntry({ type: getApiType(activeTab), body: payload }).unwrap();
      }
      message.success("Budget entry saved");
      setAddOpen(false);
      setSelectedSinglePrlId(undefined);
      setSingleChildRows([]);
      setAddForm({
        customer: "",
        customerId: null,
        uniq: "",
        productModel: "",
        partName: "",
        partNumber: "",
        uom: "",
        weightKg: "",
        description: "",
        supplier: "",
        supplierId: null,
        salesPlan: 0,
        purchaseRequest: 0,
        po1Pct: 60,
        po2Pct: 40,
        prl: 0,
        period: "",
      });
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to save budget entry"));
      console.error(error);
    }
  };

  const bulkSave = async () => {
    if (bulkPrlIds.length === 0 || !bulkPeriod) {
      message.warning("Please select at least one PRL UNIQ and period");
      return;
    }

    const selectedPrl = selectedBulkPrl;

    // Only consider non-header (child) rows for validation and payload
    const nonHeaderItems = bulkItems.filter((item) => !item.isHeader);

    const missingSupplierItems = nonHeaderItems.filter(
      (item) => item.suppliers.length === 0,
    );
    if (missingSupplierItems.length > 0) {
      message.warning(
        `Add at least one supplier for UNIQ: ${missingSupplierItems
          .map((item) => item.uniq)
          .join(", ")}`,
      );
      return;
    }

    // Backend only requires supplier_name (supplier_id is optional). So we only
    // block when we cannot even determine a supplier name for a line.
    const supplierDisplayName = (value: string) => {
      const option = supplierOptions.find((opt) => opt.value === value);
      return String(
        option?.supplierName ?? option?.label ?? value ?? "",
      ).trim();
    };

    const unresolvedSupplier = nonHeaderItems.find((item) =>
      item.suppliers.some(
        (supplier) => !supplierDisplayName(supplier.supplier),
      ),
    );

    const unresolvedPrlItem = nonHeaderItems.find(
      (item) => item.prlItemId == null,
    );

    if (unresolvedSupplier) {
      message.warning(
        `Supplier name for UNIQ ${unresolvedSupplier.uniq} could not be determined`,
      );
      return;
    }

    if (unresolvedPrlItem) {
      message.warning(
        `PRL row_id for UNIQ ${unresolvedPrlItem.uniq} is not resolved yet`,
      );
      return;
    }

    const body = {
      prl_id: String(
        nonHeaderItems[0]?.prlId ||
          selectedPrl?.prl_id ||
          selectedPrl?.id ||
          "",
      ),
      budget_subtype: bulkBudgetType === "adhoc" ? "adhoc" : "regular",
      period: normalizePeriodForApi(bulkPeriod),
      po1_pct: Number(bulkPo1Pct || 0),
      po2_pct: Number(bulkPo2Pct || 0),
      items: nonHeaderItems.map((item) => ({
        prl_item_id: Number(item.prlItemId),
        uniq_code: item.uniq,
        child_uniq_code: item.childUniqCode,
        product_model: item.productModel,
        model: item.productModel,
        part_name: item.partName,
        part_number: item.partNumber,
        qty_per_uniq: Number(item.qtyPerUniq || 0),
        sales_plan: Number(item.quantity || 0),
        po1_pct: Number(bulkPo1Pct || 0),
        po2_pct: Number(bulkPo2Pct || 0),
        weight_kg: Number(item.weightKg || 0),
        uom: item.uom,
        existing_raw_material: item.existingRawMaterial,
        material_spec: item.materialSpec,
        suppliers: item.suppliers.map((supplier) => {
          const option = supplierOptions.find(
            (opt) => opt.value === supplier.supplier,
          );
          const resolvedId = option?.supplierId;
          return {
            supplier_id:
              resolvedId == null || Number.isNaN(Number(resolvedId))
                ? null
                : Number(resolvedId),
            supplier_name: String(
              option?.supplierName ?? option?.label ?? supplier.supplier ?? "",
            ).trim(),
            quantity: Number(supplier.qty || 0),
          };
        }),
      })),
    };

    try {
      let created = bulkItems.length > 0 ? 1 : 0;
      if (useApi) {
        const token = getCookiesFromBrowser("Authorization");
        if (!token) {
          message.error(
            "Session expired or missing token. Please login again.",
          );
          return;
        }
        const result = await addBulk({
          type: getApiType(activeTab),
          body,
        }).unwrap();
        created = Number(result.data?.created ?? 0);
        const errors = Array.isArray(result.data?.errors)
          ? result.data.errors.filter(Boolean)
          : [];

        if (errors.length > 0) {
          message.error(errors.join("; "));
          if (created <= 0) return;
        }

        if (created <= 0) {
          message.warning("No PO Budget entries were created.");
          return;
        }
      }
      message.success(
        `Bulk ${getBudgetTypeLabel(activeTab)} PO Budget saved successfully (${created} entr${created === 1 ? "y" : "ies"} created)`,
      );
      setBulkOpen(false);
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to save bulk PO Budget"));
      console.error(error);
    }
  };

  const addSubtitle = `Enter the PO budget details for ${getBudgetTypeLabel(activeTab).toLowerCase()}`;
  const groupedDetail = detailQuery.data?.data as
    PoBudgetGroupedDetail | undefined;

  const openDetail = (row: PoBudgetRow) => {
    if (!row.id && useApi) {
      message.warning("This row does not have a detail reference yet.");
      return;
    }
    setDetailState({ open: true, row });
  };

  const openEdit = (row: PoBudgetRow) => {
    if (!row.id) {
      message.warning("Only API rows can be updated.");
      return;
    }
    setEditRow(row);
    setEditForm({
      purchaseRequest: Number(row.pr || 0),
      prl: Number(row.prl || 0),
      po1Pct: Number(
        row.po1 && row.pr ? Math.round((row.po1 / row.pr) * 100) : 50,
      ),
      po2Pct: Number(
        row.po2 && row.pr ? Math.round((row.po2 / row.pr) * 100) : 50,
      ),
      period: row.period || "",
    });
    setEditOpen(true);
  };

  const saveEditBudget = async () => {
    if (!editRow?.id) return;

    const body: PoBudgetUpdateRequest = {
      purchase_request: Number(editForm.purchaseRequest || 0),
      prl: Number(editForm.prl || 0),
      po1_pct: Number(editForm.po1Pct || 0),
      po2_pct: Number(editForm.po2Pct || 0),
      period: editForm.period,
    };

    try {
      await updateEntry({
        type: getApiType(activeTab),
        id: editRow.id,
        body,
      }).unwrap();
      message.success("PO Budget updated successfully");
      setEditOpen(false);
      setEditRow(null);
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to update PO Budget"));
      console.error(error);
    }
  };

  const columns = useMemo<ColumnsType<PoBudgetRow>>(
    () => [
      {
        title: activeTab === "subcon" ? "Uniq" : "PRL ID",
        dataIndex: "uniq",
        key: "uniq",
        render: (value: string, record) => {
          const parentCount = getStoredParents(record.detailJson).length;
          const childCount = getStoredParents(record.detailJson).reduce(
            (sum, p) =>
              sum + (Array.isArray(p.children) ? p.children.length : 0),
            0,
          );
          const displayValue =
            activeTab !== "subcon" && record.prlRef ? record.prlRef : value;

          if (activeTab === "subcon" || childCount === 0) {
            return (
              <span className="text-sm font-medium text-gray-700">
                {displayValue}
              </span>
            );
          }

          const expanded = expandedBudgetRowKeys.includes(record.key);
          return (
            <button
              type="button"
              className="text-left group"
              onClick={() =>
                toggleExpandedRowKey(record.key, setExpandedBudgetRowKeys)
              }
            >
              <div className="text-sm font-semibold text-blue-700 group-hover:text-blue-800">
                {displayValue}
              </div>
              <div className="text-[11px] text-blue-500 mt-0.5">
                {expanded ? "Hide" : "Show"} {parentCount} parent group
                {parentCount > 1 ? "s" : ""}
              </div>
            </button>
          );
        },
      },
      {
        title: "Customer",
        dataIndex: "customer",
        key: "customer",
        render: (v: string) => (
          <span className="text-sm text-gray-700">{v}</span>
        ),
      },
      {
        title: "Product Model",
        dataIndex: "productModel",
        key: "productModel",
        render: (v: string) => (
          <span className="text-sm text-gray-700">{v}</span>
        ),
      },
      {
        title: "Part Name",
        dataIndex: "partName",
        key: "partName",
        render: (v: string) => (
          <span className="text-sm text-gray-700">{v}</span>
        ),
      },
      {
        title: "Supplier",
        dataIndex: "supplier",
        key: "supplier",
        render: (v: string) => (
          <span className="text-sm text-gray-700">{v}</span>
        ),
      },
      {
        title: "Type",
        dataIndex: "type",
        key: "type",
        render: (v: string) =>
          v ? (
            <Tag
              color="purple"
              className="!rounded-md !px-2 !py-0.5 !text-xs !font-semibold"
            >
              {v === "adhoc" ? "Additional" : v}
            </Tag>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          ),
      },
      {
        title: "Sales Plan",
        dataIndex: "salesPlan",
        key: "salesPlan",
        align: "right",
        render: (v: number) => (
          <span className="text-sm text-gray-700">
            {formatNumber(Math.ceil(Number(v) || 0))}
          </span>
        ),
      },
      {
        title: "PR",
        dataIndex: "pr",
        key: "pr",
        align: "right",
        render: (v: number) => (
          <span className="text-sm text-gray-700">
            {formatNumber(Math.ceil(Number(v) || 0))}
          </span>
        ),
      },
      {
        title: "PO1",
        dataIndex: "po1",
        key: "po1",
        align: "right",
        render: (v: number) => (
          <span className="text-sm text-gray-700">
            {formatNumber(Math.ceil(Number(v) || 0))}
          </span>
        ),
      },
      {
        title: "PO2",
        dataIndex: "po2",
        key: "po2",
        align: "right",
        render: (v: number) => (
          <span className="text-sm text-gray-700">
            {formatNumber(Math.ceil(Number(v) || 0))}
          </span>
        ),
      },
      {
        title: "PRL",
        dataIndex: "prl",
        key: "prl",
        align: "right",
        render: (v: number) => (
          <span className="text-sm text-gray-700">
            {formatNumber(Math.ceil(Number(v) || 0))}
          </span>
        ),
      },
      {
        title: "Total PO",
        dataIndex: "totalPo",
        key: "totalPo",
        align: "right",
        render: (v: number) => (
          <span className="text-sm text-gray-700">
            {formatNumber(Math.ceil(Number(v) || 0))}
          </span>
        ),
      },
      {
        title: "APO-PRL",
        dataIndex: "apoPrl",
        key: "apoPrl",
        align: "right",
        render: (v: number) => (
          <span className="text-sm font-semibold text-orange-600">
            {formatNumber(Math.ceil(Number(v) || 0))}
          </span>
        ),
      },
      {
        title: "Period",
        dataIndex: "period",
        key: "period",
        render: (v: string) => (
          <span className="text-sm text-gray-700">{v}</span>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (v: PoBudgetRow["status"]) => (
          <Tag
            color={v === "approved" ? "green" : "gold"}
            className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
          >
            {v}
          </Tag>
        ),
      },
      // {
      //   title: "Approval Actions",
      //   key: "approvalActions",
      //   render: (_, r) =>
      //     r.status === "approved" ? (
      //       <span className="text-xs text-gray-400">Approved</span>
      //     ) : (
      //       <div className="flex items-center gap-2">
      //         <Button
      //           size="small"
      //           type="primary"
      //           icon={<CheckOutlined />}
      //           className="!rounded-lg !bg-green-600"
      //           onClick={() => message.success(`Approved ${r.uniq}`)}
      //         >
      //           Approve
      //         </Button>
      //         <Button
      //           size="small"
      //           danger
      //           icon={<CloseOutlined />}
      //           className="!rounded-lg"
      //           onClick={() => message.error(`Rejected ${r.uniq}`)}
      //         >
      //           Reject
      //         </Button>
      //       </div>
      //     ),
      // },
      {
        title: "Actions",
        key: "actions",
        fixed: "right",
        render: (_, r) => (
          <div className="flex items-center gap-2">
            <Button
              size="small"
              icon={<EyeOutlined />}
              className="!rounded-lg"
              onClick={() => openDetail(r)}
            >
              Detail
            </Button>
            <Button
              size="small"
              className="!rounded-lg"
              disabled={!r.id || r.status === "approved"}
              onClick={() => openEdit(r)}
            >
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [activeTab, expandedBudgetRowKeys, openDetail, openEdit],
  );

  const tabOptions = useMemo(
    () => [
      { label: "Raw Material Budget", value: "raw" },
      { label: "Subcon Budget", value: "subcon" },
      { label: "Indirect Budget", value: "indirect" },
    ],
    [],
  );

  const bulkColumns = useMemo<ColumnsType<BulkItemRow>>(
    () => [
      {
        title: "#",
        key: "index",
        width: 48,
        align: "center",
        render: (_value, _record, index) => (
          <span className="text-xs text-gray-400">{index + 1}</span>
        ),
      },
      {
        title: "Child UNIQ",
        dataIndex: "uniq",
        key: "uniq",
        width: 160,
        render: (value: string, record) => (
          <div>
            {isChildBudgetType(getApiType(activeTab)) ? (
              <Tag
                color="blue"
                className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
              >
                {value || "-"}
              </Tag>
            ) : (
              <span className="text-sm text-gray-700">{value}</span>
            )}
            {isChildBudgetType(getApiType(activeTab)) &&
            record.childUniqCode ? (
              <div className="text-[11px] text-gray-500 mt-1">
                {record.childUniqCode}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: "Part Name",
        dataIndex: "partName",
        key: "partName",
        width: 160,
      },
      {
        title: "Part Number",
        dataIndex: "partNumber",
        key: "partNumber",
        width: 120,
      },
      {
        title: "Weight (kg)",
        dataIndex: "weightKg",
        key: "weightKg",
        width: 110,
        align: "right",
        render: (v: number, r) => (
          <InputNumber
            min={0}
            value={v}
            onChange={(next) =>
              bulkUpdateItem(r.key, { weightKg: Number(next || 0) })
            }
            className="w-[90px]"
            size="small"
          />
        ),
      },
      {
        title: "UOM",
        dataIndex: "uom",
        key: "uom",
        width: 120,
        render: (value: string, r) => (
          <Select
            value={value || undefined}
            onChange={(next) =>
              bulkUpdateItem(r.key, { uom: String(next ?? "") })
            }
            options={uomOptions}
            className="w-[100px]"
            size="small"
          />
        ),
      },
      {
        title: "Quantity",
        dataIndex: "quantity",
        key: "quantity",
        width: 140,
        render: (_: number, r) => (
          <InputNumber
            min={0}
            value={r.quantity}
            onChange={(v) => bulkUpdateQuantity(r.key, Number(v || 0))}
            className="w-[110px]"
          />
        ),
      },
      {
        title: "Existing RM",
        dataIndex: "existingRawMaterial",
        key: "existingRawMaterial",
        width: 140,
        render: (v: string) => (
          <span className="text-sm text-gray-700">{v}</span>
        ),
      },
      {
        title: "Suppliers",
        key: "suppliers",
        width: 320,
        render: (_, r) => {
          if (r.isHeader) return null;
          const total = r.suppliers.reduce(
            (sum, s) => sum + Number(s.qty || 0),
            0,
          );
          const over = total > r.quantity;
          return (
            <div className="space-y-2">
              {r.suppliers.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <Select
                    value={s.supplier}
                    onChange={(v) => {
                      const childOpts = isChildBudgetType(getApiType(activeTab))
                        ? getChildSupplierOptions(r)
                        : [];
                      const opts = isChildBudgetType(getApiType(activeTab))
                        ? childOpts.length
                          ? childOpts
                          : supplierOptions
                        : (supplierOptionsByUniq.get(r.uniq) ??
                          supplierOptions);
                      const opt = opts.find((o) => o.value === v);
                      const pct = opt?.percentage;
                      const autoQty =
                        pct != null && pct > 0
                          ? Math.round((r.quantity * pct) / 100)
                          : s.qty;
                      bulkUpdateSupplier(r.key, s.id, {
                        supplier: v,
                        qty: autoQty,
                        percentage: pct,
                      });
                    }}
                    options={(() => {
                      const childOpts = isChildBudgetType(getApiType(activeTab))
                        ? getChildSupplierOptions(r)
                        : [];
                      const source = isChildBudgetType(getApiType(activeTab))
                        ? childOpts.length
                          ? childOpts
                          : supplierOptions
                        : (supplierOptionsByUniq.get(r.uniq) ??
                          supplierOptions);
                      return dedupeSupplierOptions(source);
                    })()
                      .filter(
                        (opt) =>
                          opt.value === s.supplier ||
                          !r.suppliers.some(
                            (other) =>
                              other.id !== s.id && other.supplier === opt.value,
                          ),
                      )
                      .map((opt) => ({
                        value: opt.value,
                        label:
                          opt.percentage != null
                            ? `${opt.label} (${opt.percentage}%)`
                            : opt.label,
                      }))}
                    className="w-[200px]"
                    size="small"
                  />
                  <InputNumber
                    min={0}
                    max={
                      s.percentage != null && s.percentage > 0
                        ? Math.round((r.quantity * s.percentage) / 100)
                        : r.quantity
                    }
                    value={s.qty}
                    onChange={(v) =>
                      bulkUpdateSupplier(r.key, s.id, {
                        qty: Number(v || 0),
                      })
                    }
                    className="w-[90px]"
                    size="small"
                  />
                  {s.percentage != null && (
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {s.percentage}%
                    </span>
                  )}
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => bulkRemoveSupplier(r.key, s.id)}
                    className="!px-1"
                  />
                </div>
              ))}
              <div
                className={
                  "text-[11px] " + (over ? "text-red-600" : "text-gray-500")
                }
              >
                Total: {formatNumber(total)} / {formatNumber(r.quantity)}
              </div>
            </div>
          );
        },
      },
      {
        title: "Actions",
        key: "actions",
        width: 120,
        render: (_, r) => (
          <Button
            size="small"
            className="!rounded-lg"
            onClick={() => bulkAddSupplierLine(r.key)}
          >
            + Supplier
          </Button>
        ),
      },
    ],
    [activeTab, supplierOptions, supplierOptionsByUniq, uomOptions, bulkItems],
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              PR Budget Management
            </h1>
            <p className="text-sm text-gray-500">
              Manage PR budget for creating Purchase Orders across Raw Material,
              Subcon, and Indirect categories
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="!rounded-lg"
              icon={<FileExcelOutlined />}
              onClick={openBulkPoBudget}
            >
              Bulk PR Budget
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<PlusOutlined />}
              onClick={openAddBudget}
            >
              Add Budget Entry
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 mb-6">
        <StatCard
          label="Total Entries"
          value={formatNumber(summary.total_entries)}
          icon={<MdDescription size={18} />}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Sales Plan"
          value={formatNumber(summary.total_sales_plan)}
          icon={<MdOutlineShowChart size={18} />}
          accent="bg-pink-50 text-pink-600"
        />
        <StatCard
          label="Total PO"
          value={formatNumber(summary.total_po)}
          icon={<MdAttachMoney size={18} />}
          accent="bg-green-50 text-green-600"
        />
        <StatCard
          label="Total PRL"
          value={formatNumber(summary.total_prl)}
          icon={<MdQueryStats size={18} />}
          accent="bg-purple-50 text-purple-600"
        />
        {/* <div className="mb-6"> */}
        {/* <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Material Grades</div>
          <div className="text-xs text-gray-400 mb-2">Found {uniqueMaterialGrades.length} grades from {bomTreeNodes.length} BOM nodes</div>
          <div className="flex flex-wrap gap-2">
            {uniqueMaterialGrades.length === 0 ? (
              <div className="text-sm text-gray-400">No material grades found</div>
            ) : (
              uniqueMaterialGrades.map((g) => (
                <Tag key={g} color="blue">
                  {g}
                </Tag>
              ))
            )}
          </div>
        </div> */}
        {/* </div> */}
        <StatCard
          label="APO - PRL"
          value={formatNumber(summary.delta_apo_prl)}
          icon={<MdInventory2 size={18} />}
          accent="bg-orange-50 text-orange-600"
        />
        <StatCard
          label="Pending Approvals"
          value={formatNumber(summary.pending_approvals)}
          icon={<MdSchedule size={18} />}
          accent="bg-amber-50 text-amber-700"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="mb-4">
          <div className="inline-flex rounded-xl bg-gray-50 p-1 border border-gray-100">
            <Segmented
              value={activeTab}
              onChange={(v) => setActiveTab(v as BudgetTabId)}
              options={tabOptions}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100">
          <Table<PoBudgetRow>
            dataSource={filteredRows}
            columns={columns}
            rowKey="key"
            size="middle"
            expandable={{
              expandedRowKeys: expandedBudgetRowKeys,
              onExpandedRowsChange: (keys) =>
                setExpandedBudgetRowKeys(keys.map((key) => String(key))),
              expandedRowRender: (record) => renderStoredChildren(record),
              rowExpandable: (record) =>
                activeTab !== "subcon" && hasStoredChildren(record),
              showExpandColumn: false,
            }}
            pagination={{
              current: activePagination.page,
              pageSize: activePagination.pageSize,
              total: useApi
                ? (activePaginationMeta?.total ?? filteredRows.length)
                : filteredRows.length,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} items`,
              onChange: (page, pageSize) => {
                setPaginationByTab((prev) => ({
                  ...prev,
                  [activeTab]: {
                    page,
                    pageSize: pageSize ?? prev[activeTab].pageSize,
                  },
                }));
              },
              onShowSizeChange: (_current, size) => {
                setPaginationByTab((prev) => ({
                  ...prev,
                  [activeTab]: {
                    page: 1,
                    pageSize: size,
                  },
                }));
              },
            }}
            scroll={{ x: 1600 }}
          />
        </div>
      </div>

      <Modal
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        width={640}
        destroyOnHidden
        title={
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Add New PR Budget Entry
            </div>
            <div className="text-xs text-gray-500 mt-1">{addSubtitle}</div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button className="!rounded-lg" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              onClick={saveAddBudget}
            >
              Save Budget Entry
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-600 mb-1">PO Budget Type</div>
            <Select
              value={addBudgetType}
              onChange={(v) => {
                setAddBudgetType(v as BulkBudgetType);
                setSelectedSinglePrlId(undefined);
                setSingleChildRows([]);
                setAddForm((p) => ({ ...p, prl: "" }));
              }}
              options={[
                { label: "Additional", value: "adhoc" },
                { label: "Reguler", value: "kanban" },
              ]}
              className="w-full"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">PRL (Select)</div>
            <Select
              showSearch
              allowClear
              value={addForm.prl ?? undefined}
              options={addPrlOptions}
              placeholder="Select PRL to autofill"
              className="w-full"
              loading={prlsFetching}
              onChange={(v) => {
                const raw = String(v ?? "");
                const parsed = parsePrlSelection(raw);
                let matched;
                if (parsed) {
                  matched = approvedPrls.find((p) => {
                    const itemPrlId = String(p.prl_id ?? p.id ?? "");
                    if (itemPrlId !== parsed.prlId) return false;
                    if (!parsed.prlItemId) return true;
                    const itemRowId = String(
                      getPrlRowId(p as Record<string, unknown>) ?? p.id ?? "",
                    );
                    return itemRowId === parsed.prlItemId;
                  });
                } else {
                  const prlId = raw;
                  matched = approvedPrls.find(
                    (p) =>
                      String(p.prl_id ?? p.id ?? "") === prlId ||
                      String(p.id ?? p.prl_id ?? "") === prlId,
                  );
                }
                if (!matched) {
                  setSelectedSinglePrlId(undefined);
                  setSingleChildRows([]);
                  setAddForm((p) => ({ ...p, prl: "" }));
                  return;
                }
                const uniqCode = String(
                  matched.uniq_code ?? matched.item_uniq_code ?? "",
                ).trim();
                let supplierItemMatch = (supplierItemsByUniq.get(uniqCode) ??
                  [])[0];
                if (!supplierItemMatch) {
                  supplierItemMatch = supplierItems.find(
                    (it) =>
                      String(it.uniq_code ?? it.item_uniq_code ?? "").trim() ===
                      uniqCode,
                  ) as any;
                }
                if (activeTab !== "subcon" && parsed?.prlId) {
                  setSelectedSinglePrlId(parsed.prlId);
                } else {
                  setSelectedSinglePrlId(undefined);
                  setSingleChildRows([]);
                }
                const bomDefaults = getBomDefaultsForUniq(uniqCode);

                setAddForm((prev) => ({
                  ...prev,
                  prl: raw,
                  customer:
                    matched.customer_name ??
                    matched.customer?.customer_name ??
                    "",
                  customerId:
                    resolvePrlCustomerId(matched as Record<string, unknown>) ??
                    null,
                  uniq: uniqCode || "",
                  productModel: matched.product_model ?? "",
                  partName: matched.part_name ?? "",
                  partNumber: matched.part_number ?? "",
                  period: getPrlPeriodValue(matched) || "",
                  salesPlan: Number(matched.quantity ?? 0),
                  uom: bomDefaults.uom || String(supplierItemMatch?.uom ?? ""),
                  weightKg:
                    bomDefaults.weightKg ||
                    (supplierItemMatch?.weight == null
                      ? ""
                      : String(supplierItemMatch.weight)),
                  supplier: String(supplierItemMatch?.supplier_name ?? ""),
                  supplierId:
                    resolveSupplierRowId({
                      supplierUuid: supplierItemMatch?.supplier_uuid,
                      supplierCode: supplierItemMatch?.supplier_code,
                      supplierName: supplierItemMatch?.supplier_name,
                    }) ?? null,
                }));
              }}
            />
            {activeTab !== "subcon" && singleChildRows.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {singleChildRows.map((child) => (
                  <Tag
                    key={child.key}
                    color="blue"
                    className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
                  >
                    {child.uniq || "-"}
                    {child.childUniqCode ? ` • ${child.childUniqCode}` : ""}
                  </Tag>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Customer Name</div>
            <Select
              showSearch
              allowClear
              value={addForm.customer ?? undefined}
              options={customerOptions}
              placeholder="Select customer from approved PRL"
              className="w-full"
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              onChange={(value, option) => {
                const selected = Array.isArray(option)
                  ? undefined
                  : (option as { value?: number; label?: string } | undefined);
                const selectedCustomerId = toIntegerId(value);
                const matchedPrl = findApprovedPrlMatch(
                  selectedCustomerId,
                  String(selected?.label ?? ""),
                  addForm.uniq,
                );
                const resolvedUniq = String(
                  matchedPrl
                    ? (matchedPrl.uniq_code ?? matchedPrl.item_uniq_code ?? "")
                    : (addForm.uniq ?? ""),
                ).trim();
                const resolvedPartNumber = String(
                  matchedPrl?.part_number ?? addForm.partNumber ?? "",
                ).trim();
                const supplierItemMatch = findSupplierItemsForProduct(
                  resolvedUniq,
                  resolvedPartNumber,
                )[0];
                const bomDefaults = getBomDefaultsForUniq(resolvedUniq);
                setAddForm((prev) => ({
                  ...prev,
                  customerId: selectedCustomerId,
                  customer: String(selected?.label ?? ""),
                  uniq: matchedPrl
                    ? String(
                        matchedPrl.uniq_code ?? matchedPrl.item_uniq_code ?? "",
                      )
                    : prev.uniq,
                  productModel: matchedPrl?.product_model ?? prev.productModel,
                  partName: matchedPrl?.part_name ?? prev.partName,
                  partNumber: matchedPrl?.part_number ?? prev.partNumber,
                  period: getPrlPeriodValue(matchedPrl) || prev.period,
                  salesPlan: Number(
                    matchedPrl?.quantity ?? prev.salesPlan ?? 0,
                  ),
                  supplier: String(
                    supplierItemMatch?.supplier_name ?? prev.supplier ?? "",
                  ),
                  supplierId:
                    resolveSupplierRowId({
                      supplierUuid: supplierItemMatch?.supplier_uuid,
                      supplierCode: supplierItemMatch?.supplier_code,
                      supplierName: supplierItemMatch?.supplier_name,
                    }) ?? prev.supplierId,
                  uom:
                    bomDefaults.uom ||
                    String(supplierItemMatch?.uom ?? prev.uom ?? ""),
                  weightKg:
                    bomDefaults.weightKg ||
                    (supplierItemMatch?.weight == null
                      ? prev.weightKg
                      : String(supplierItemMatch.weight)),
                  description:
                    supplierItemMatch?.description ?? prev.description,
                }));
              }}
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">
              Customer ID (row_id)
            </div>
            <Input
              value={
                addForm.customerId == null ? "" : String(addForm.customerId)
              }
              disabled
              className="!rounded-lg"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">
              Uniq (Product Code)
            </div>
            <Select
              showSearch
              placeholder="Select UNIQ"
              className="rounded-lg w-full font-black"
              options={uniqOptions}
              value={addForm.uniq}
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              onChange={(value) => {
                const uniqCode = String(value ?? "");
                // Find the PRL entry for this uniq_code (no filter by status/customer)
                const matchedPrl = prls.find(
                  (item) =>
                    String(
                      item.uniq_code ?? item.item_uniq_code ?? "",
                    ).trim() === uniqCode,
                );
                const partName =
                  matchedPrl?.part_name ??
                  bomIndex.partNameByUniq[uniqCode] ??
                  "";
                const partNumber =
                  matchedPrl?.part_number ??
                  bomIndex.partNumberByUniq[uniqCode] ??
                  "";
                const productModel =
                  matchedPrl?.product_model ??
                  bomIndex.assemblyCodeByUniq[uniqCode] ??
                  "";
                const customerName =
                  matchedPrl?.customer_name ??
                  matchedPrl?.customer?.customer_name ??
                  "";
                const customerId =
                  matchedPrl?.customer_id ?? matchedPrl?.customer?.code ?? null;
                const relatedSupplierItems = findSupplierItemsForProduct(
                  uniqCode,
                  partNumber,
                );
                const supplierItemMatch = relatedSupplierItems[0];
                const bomDefaults = getBomDefaultsForUniq(uniqCode);

                setAddForm((prev) => ({
                  ...prev,
                  uniq: uniqCode,
                  customer: customerName,
                  customerId: customerId ? Number(customerId) : null,
                  productModel,
                  partName,
                  partNumber,
                  uom:
                    bomDefaults.uom ||
                    String(supplierItemMatch?.uom ?? prev.uom ?? ""),
                  weightKg:
                    bomDefaults.weightKg ||
                    (supplierItemMatch?.weight == null
                      ? prev.weightKg
                      : String(supplierItemMatch.weight)),
                  salesPlan: Number(
                    matchedPrl?.quantity ?? prev.salesPlan ?? 0,
                  ),
                  description:
                    supplierItemMatch?.description ?? prev.description,
                  supplier: String(
                    supplierItemMatch?.supplier_name ?? prev.supplier ?? "",
                  ),
                  supplierId:
                    resolveSupplierRowId({
                      supplierUuid: supplierItemMatch?.supplier_uuid,
                      supplierCode: supplierItemMatch?.supplier_code,
                      supplierName: supplierItemMatch?.supplier_name,
                    }) ?? prev.supplierId,
                  period: getPrlPeriodValue(matchedPrl) || prev.period,
                }));
              }}
            />
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">Product Model</div>
            <Input
              value={addForm.productModel}
              placeholder="Auto-filled from approved PRL"
              disabled
              className="!rounded-lg"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Part Name</div>
            <Input
              value={addForm.partName}
              placeholder="Auto-filled from approved PRL/BOM"
              disabled
              className="!rounded-lg"
            />
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">Part Number</div>
            <Input
              value={addForm.partNumber}
              placeholder="Auto-filled from approved PRL/BOM"
              disabled
              className="!rounded-lg"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">UOM</div>
            <Select
              value={addForm.uom || undefined}
              options={uomOptions}
              placeholder="Select UOM"
              className="w-full"
              onChange={(value) =>
                setAddForm((prev) => ({ ...prev, uom: String(value ?? "") }))
              }
            />
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">Weight (kg)</div>
            <Input
              value={addForm.weightKg}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, weightKg: e.target.value }))
              }
              placeholder="Enter weight"
              className="!rounded-lg"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Supplier Name</div>
            <Select
              value={addForm.supplier || undefined}
              onChange={(v, option) => {
                const selected = Array.isArray(option)
                  ? undefined
                  : (option as SupplierOption | undefined);
                setAddForm((p) => ({
                  ...p,
                  supplier:
                    selected?.supplierName ??
                    selected?.label ??
                    String(v ?? ""),
                  supplierId: selected?.supplierId ?? null,
                  uom: selected?.uom ?? p.uom,
                  weightKg:
                    selected?.weight == null
                      ? p.weightKg
                      : String(selected.weight),
                  description: selected?.description ?? p.description,
                }));
              }}
              options={addSupplierOptions}
              placeholder="Select supplier from supplier item"
              className="w-full"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Description</div>
            <Input
              value={addForm.description}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Optional description"
              className="!rounded-lg"
            />
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">Sales Plan (Units)</div>
            <InputNumber
              min={0}
              value={addForm.salesPlan}
              onChange={(v) =>
                setAddForm((p) => ({ ...p, salesPlan: Number(v || 0) }))
              }
              className="w-full !rounded-lg"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">
              Purchase Request (Units)
            </div>
            <InputNumber
              min={0}
              value={addForm.purchaseRequest}
              onChange={(v) =>
                setAddForm((p) => ({ ...p, purchaseRequest: Number(v || 0) }))
              }
              className="w-full !rounded-lg"
            />
          </div>

          <div className="md:col-span-2">
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <div className="text-sm font-semibold text-gray-900">
                Purchase Request Calculation
              </div>
              <div className="text-xs text-blue-700 mt-1">
                PO amounts are calculated based on parameterized % of PR (kanban
                packing logic)
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-600 mb-1">
                    PO1 (% of PR)
                  </div>
                  <div className="flex items-center gap-2">
                    <InputNumber
                      min={0}
                      max={100}
                      value={addForm.po1Pct}
                      onChange={(v) =>
                        setAddForm((p) => ({
                          ...p,
                          po1Pct: Number(v || 0),
                          po2Pct: Math.max(0, 100 - Number(v || 0)),
                        }))
                      }
                      className="w-full !rounded-lg"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Units: {formatNumber(computedPo1Units)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-600 mb-1">
                    PO2 (% of PR)
                  </div>
                  <div className="flex items-center gap-2">
                    <InputNumber
                      min={0}
                      max={100}
                      value={addForm.po2Pct}
                      onChange={(v) =>
                        setAddForm((p) => ({
                          ...p,
                          po2Pct: Number(v || 0),
                          po1Pct: Math.max(0, 100 - Number(v || 0)),
                        }))
                      }
                      className="w-full !rounded-lg"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Units: {formatNumber(computedPo2Units)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">
              PRL (from PRL & Master Data)
            </div>
            <Input value={derivedPrlAmount} disabled className="!rounded-lg" />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Period</div>
            <DatePicker
              picker="month"
              value={parsePeriodMonth(addForm.period)}
              onChange={(date) =>
                setAddForm((p) => ({
                  ...p,
                  period: formatPeriodMonth(date) ?? "",
                }))
              }
              className="w-full"
              format={(value) => (value ? value.format("MMMM YYYY") : "")}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkOpen}
        onCancel={() => setBulkOpen(false)}
        width={980}
        destroyOnHidden
        title={
          <div className="flex items-center gap-2">
            <span className="text-blue-600">+</span>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Add New PO Budget
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Select PRL, configure quantities and suppliers, then set period
                and PO calculation
              </div>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button className="!rounded-lg" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button type="primary" className="!rounded-lg" onClick={bulkSave}>
              Save PO Budget
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Step 1: Choose Source
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Select source for generating PO Budget (PRL or PO)
                </div>
              </div>
              <Tag className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
                Required
              </Tag>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">Source</div>
                <Select
                  value={bulkSource}
                  onChange={(v) => setBulkSource(v as "prl" | "po")}
                  options={[
                    { label: "PRL", value: "prl" },
                    { label: "Customer PO", value: "po" },
                  ]}
                  className="w-full mb-3"
                />

                {bulkSource === "prl" ? (
                  <>
                    <div className="text-xs text-gray-600 mb-1">Select PRL</div>
                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      value={bulkPrlIds}
                      onChange={(values) => {
                        setBulkPrlIds(values);
                        syncBulkItemsFromPrl(values);
                      }}
                      onSearch={handleBulkPrlSearch}
                      onPopupScroll={handleBulkPrlPopupScroll}
                      options={bulkPrlOptions}
                      className="w-full"
                      placeholder="Search and select one or more PRL UNIQ"
                      optionFilterProp="label"
                      filterOption={false}
                      loading={prlsFetching}
                      maxTagCount="responsive"
                    />
                  </>
                ) : (
                  <>
                    <div className="text-xs text-gray-600 mb-1">
                      Select Customer PO
                    </div>
                    <Select
                      mode="multiple"
                      showSearch
                      allowClear
                      options={(customerPos || []).map((p) => ({
                        label: `${p.po_number} — ${p.customer?.customer_name ?? ""}`,
                        value: String(p.id),
                      }))}
                      className="w-full"
                      placeholder="Search and select one or more Customer PO"
                      optionFilterProp="label"
                      filterOption={(input, option) =>
                        String(option?.label ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                      value={bulkPoIds}
                      onChange={(value) => {
                        const values = value
                          ? Array.isArray(value)
                            ? value
                            : [value]
                          : [];
                        setBulkPoIds(values as string[]);
                        // call sync with po:<id> tokens so existing builder handles PO items
                        const mapped = (values as string[]).map(
                          (v) => `po:${v}`,
                        );
                        syncBulkItemsFromPrl(mapped);
                      }}
                    />
                  </>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">
                  PO Budget Type:
                </div>
                <Select
                  value={bulkBudgetType}
                  onChange={(v) => setBulkBudgetType(v as BulkBudgetType)}
                  options={[
                    { label: "Additional", value: "adhoc" },
                    { label: "Reguler", value: "kanban" },
                  ]}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-green-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Step 2: Configure Items & Suppliers
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Expand a UNIQ to edit quantities and suppliers.
                </div>
              </div>
              <div className="text-xs text-gray-500 shrink-0 text-right">
                {bulkPrlGroups.length} PRL · {bulkParentGroups.length} UNIQ ·{" "}
                {bulkItems.filter((it) => !it.isHeader).length} material
                {bulkItems.filter((it) => !it.isHeader).length !== 1 ? "s" : ""}
              </div>
            </div>

            {bulkParentGroups.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Select a PRL in Step 1 to see its items here.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {bulkPrlGroups.map((prlGroup) => (
                  <div
                    key={prlGroup.prlId}
                    className="rounded-lg border border-gray-200 overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <div className="min-w-0 truncate">
                        <span className="text-sm font-semibold text-gray-800">
                          {prlGroup.prlNumber}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {prlGroup.customerName}
                          {prlGroup.period ? ` · ${prlGroup.period}` : ""}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 shrink-0">
                        {prlGroup.parents.length} UNIQ
                      </div>
                    </div>

                    {prlGroup.parents.map((group) => {
                      const isCollapsed = collapsedBulkGroupKeys.includes(
                        group.key,
                      );
                      return (
                        <div
                          key={group.key}
                          className="border-b border-gray-100 last:border-b-0"
                        >
                          <div
                            className="flex items-center justify-between gap-3 px-4 py-2 bg-blue-50/40 cursor-pointer select-none"
                            onClick={() =>
                              toggleExpandedRowKey(
                                group.key,
                                setCollapsedBulkGroupKeys,
                              )
                            }
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Tag color="blue" className="!m-0">
                                {group.parentUniqCode || "-"}
                              </Tag>
                              <span className="text-sm font-semibold text-gray-800 truncate">
                                {group.partName || "-"}
                              </span>
                              {group.partNumber ? (
                                <span className="text-xs text-gray-400 shrink-0">
                                  {group.partNumber}
                                </span>
                              ) : null}
                              {group.childLabels?.length ? (
                                <span className="text-xs text-gray-500 truncate hidden md:inline">
                                  · {formatChildSummary(group.childLabels)}
                                </span>
                              ) : null}
                            </div>
                            <div
                              className="flex items-center gap-2 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-xs text-gray-500">
                                Total Qty:
                              </span>
                              <InputNumber
                                min={0}
                                size="small"
                                value={group.budgetQty}
                                onChange={(v) =>
                                  bulkUpdateGroupQty(group, Number(v || 0))
                                }
                                className="w-[100px]"
                              />
                              <DownOutlined
                                className={`!text-[10px] !text-gray-400 transition-transform cursor-pointer ${
                                  isCollapsed ? "-rotate-90" : ""
                                }`}
                                onClick={() =>
                                  toggleExpandedRowKey(
                                    group.key,
                                    setCollapsedBulkGroupKeys,
                                  )
                                }
                              />
                            </div>
                          </div>

                          {isCollapsed ? null : (
                            <>
                              <Table<BulkItemRow>
                                dataSource={group.rows}
                                columns={bulkColumns}
                                rowKey="key"
                                pagination={false}
                                size="small"
                                scroll={{ x: 1000 }}
                              />
                              <div className="flex items-center justify-end gap-1.5 bg-blue-50/40 border-t border-gray-100 px-4 py-2 text-xs text-gray-600">
                                Total material to procure for{" "}
                                {group.parentUniqCode || "-"}:
                                <span className="text-sm font-semibold text-blue-700">
                                  {formatNumber(group.totalChildQty)}
                                </span>
                                <span className="text-gray-400">
                                  {group.rows[0]?.uom || ""}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-purple-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Step 3: Period & Purchase Request Calculation
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Set period and configure PO split percentages
                </div>
              </div>
              <Tag
                color="purple"
                className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
              >
                Final Step
              </Tag>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-600 mb-1">Period</div>
                <DatePicker
                  picker="month"
                  value={parsePeriodMonth(bulkPeriod)}
                  onChange={(date) => setBulkPeriod(formatPeriodMonth(date))}
                  className="w-full"
                  format={(value) => (value ? value.format("MMMM YYYY") : "")}
                  placeholder="Select period..."
                />
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <div className="text-sm font-semibold text-gray-900">
                  Purchase Request Calculation
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  PR amounts are calculated based on parameterized % of PR
                  (kanban packing logic)
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">
                      PO1 (% of PR)
                    </div>
                    <div className="flex items-center gap-2">
                      <InputNumber
                        min={0}
                        max={100}
                        value={bulkPo1Pct}
                        onChange={(v) => {
                          const next = Number(v || 0);
                          setBulkPo1Pct(next);
                          setBulkPo2Pct(Math.max(0, 100 - next));
                        }}
                        className="w-full"
                        size="small"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">
                      PO2 (% of PR)
                    </div>
                    <div className="flex items-center gap-2">
                      <InputNumber
                        min={0}
                        max={100}
                        value={bulkPo2Pct}
                        onChange={(v) => {
                          const next = Number(v || 0);
                          setBulkPo2Pct(next);
                          setBulkPo1Pct(Math.max(0, 100 - next));
                        }}
                        className="w-full"
                        size="small"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={detailState.open}
        onCancel={() => setDetailState({ open: false, row: null })}
        width={760}
        destroyOnHidden
        footer={null}
        title={
          <div>
            <div className="text-sm font-semibold text-gray-900">
              PO Budget Detail
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Grouped detail for {detailState.row?.uniq ?? "selected budget"}
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-gray-700">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-semibold text-gray-900 mb-4">
              Basic Information
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Customer Name
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.basic_information?.customer_name ??
                    detailState.row?.customer ??
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  UNIQ
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.basic_information?.uniq ??
                    detailState.row?.uniq ??
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-amber-600 uppercase">
                  Product Model
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.basic_information?.product_model ??
                    detailState.row?.productModel ??
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Part Name
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.basic_information?.part_name ??
                    detailState.row?.partName ??
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Part Number
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.basic_information?.part_number ??
                    detailState.row?.partNumber ??
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Supplier Name
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.basic_information?.supplier_name ??
                    detailState.row?.supplier ??
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Type
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.basic_information?.budget_type ??
                    detailState.row?.type ??
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Type Label
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.basic_information?.type_label ??
                    detailState.row?.type ??
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Period
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.basic_information?.period ??
                    detailState.row?.period ??
                    "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-semibold text-gray-900 mb-4">
              Budget Calculations
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Sales Plan
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {formatNumber(
                    Number(
                      groupedDetail?.budget_calculations?.sales_plan ??
                        detailState.row?.salesPlan ??
                        0,
                    ),
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Purchase Request (PR)
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {formatNumber(
                    Number(
                      groupedDetail?.budget_calculations?.purchase_request ??
                        detailState.row?.pr ??
                        0,
                    ),
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  PRL Amount
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {formatNumber(
                    Number(
                      groupedDetail?.budget_calculations?.prl_amount ??
                        detailState.row?.prl ??
                        0,
                    ),
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  PO1 Percentage
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {Number(groupedDetail?.budget_calculations?.po1_pct ?? 0)}%
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  PO2 Percentage
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {Number(groupedDetail?.budget_calculations?.po2_pct ?? 0)}%
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
            <div className="text-sm font-semibold text-gray-900 mb-4">
              Calculation Results
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs text-gray-500">PO1 Amount</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatNumber(
                    Math.ceil(
                      Number(
                        groupedDetail?.calculation_results?.po1_amount ??
                          detailState.row?.po1 ??
                          0,
                      ),
                    ),
                  )}
                </div>
                <div className="text-[11px] text-gray-400">PO1 of PR</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs text-gray-500">PO2 Amount</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatNumber(
                    Math.ceil(
                      Number(
                        groupedDetail?.calculation_results?.po2_amount ??
                          detailState.row?.po2 ??
                          0,
                      ),
                    ),
                  )}
                </div>
                <div className="text-[11px] text-gray-400">PO2 of PR</div>
              </div>
              <div className="rounded-xl border border-green-200 bg-white p-4">
                <div className="text-xs text-gray-500">Total PO</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatNumber(
                    Math.ceil(
                      Number(
                        groupedDetail?.calculation_results?.total_po ??
                          detailState.row?.totalPo ??
                          0,
                      ),
                    ),
                  )}
                </div>
                <div className="text-[11px] text-gray-400">PO1 + PO2</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-white p-4">
                <div className="text-xs text-gray-500">APO - PRL</div>
                <div className="mt-1 text-2xl font-semibold text-amber-600">
                  {formatNumber(
                    Math.ceil(
                      Number(
                        groupedDetail?.calculation_results?.apo_prl_abs ??
                          detailState.row?.apoPrl ??
                          0,
                      ),
                    ),
                  )}
                </div>
                <div className="text-[11px] text-amber-500">
                  {groupedDetail?.calculation_results?.apo_prl_state ?? "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-semibold text-gray-900 mb-4">
              Additional Information
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Submitted By
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.additional_information?.submitted_by_name ??
                    groupedDetail?.additional_information?.submitted_by ??
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Submitted Date
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.additional_information?.submitted_at ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Approved By
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.additional_information?.approved_by_name ??
                    groupedDetail?.additional_information?.approved_by ??
                    "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Approved Date
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  {groupedDetail?.additional_information?.approved_at ??
                    groupedDetail?.additional_information?.approval_date ??
                    "-"}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-[11px] font-medium text-gray-500 uppercase">
                  Notes
                </div>
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 min-h-[44px]">
                  {groupedDetail?.additional_information?.notes ?? "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-semibold text-gray-900 mb-4">
              History Log
            </div>
            {groupedDetail?.history?.length ? (
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(item, index) =>
                    `${item.date_time ?? "history"}-${index}`
                  }
                  dataSource={groupedDetail.history}
                  columns={[
                    {
                      title: "Date & Time",
                      dataIndex: "date_time",
                      key: "date_time",
                      render: (value: string) => value || "-",
                    },
                    {
                      title: "Action",
                      dataIndex: "action",
                      key: "action",
                      render: (value: string) => value || "-",
                    },
                    {
                      title: "User",
                      key: "user",
                      render: (_, item) => item.user ?? item.user_id ?? "-",
                    },
                    {
                      title: "Notes",
                      dataIndex: "notes",
                      key: "notes",
                      render: (value: string) => value || "-",
                    },
                  ]}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                No history available.
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditRow(null);
        }}
        width={560}
        destroyOnHidden
        title={
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Update PO Budget
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Update purchase request, PRL, percentages, and period
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              className="!rounded-lg"
              onClick={() => {
                setEditOpen(false);
                setEditRow(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              onClick={saveEditBudget}
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-600 mb-1">Purchase Request</div>
            <InputNumber
              min={0}
              value={editForm.purchaseRequest}
              onChange={(value) =>
                setEditForm((prev) => ({
                  ...prev,
                  purchaseRequest: Number(value || 0),
                }))
              }
              className="w-full"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">PRL</div>
            <InputNumber
              min={0}
              value={editForm.prl}
              onChange={(value) =>
                setEditForm((prev) => ({ ...prev, prl: Number(value || 0) }))
              }
              className="w-full"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">PO1 %</div>
            <InputNumber
              min={0}
              max={100}
              value={editForm.po1Pct}
              onChange={(value) =>
                setEditForm((prev) => ({
                  ...prev,
                  po1Pct: Number(value || 0),
                  po2Pct: Math.max(0, 100 - Number(value || 0)),
                }))
              }
              className="w-full"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">PO2 %</div>
            <InputNumber
              min={0}
              max={100}
              value={editForm.po2Pct}
              onChange={(value) =>
                setEditForm((prev) => ({
                  ...prev,
                  po2Pct: Number(value || 0),
                  po1Pct: Math.max(0, 100 - Number(value || 0)),
                }))
              }
              className="w-full"
            />
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-gray-600 mb-1">Period</div>
            <Select
              value={editForm.period || undefined}
              onChange={(value) =>
                setEditForm((prev) => ({
                  ...prev,
                  period: String(value ?? ""),
                }))
              }
              options={periodOptions}
              className="w-full"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={addSupplierOpen}
        onCancel={() => setAddSupplierOpen(false)}
        width={520}
        destroyOnHidden
        title={
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Add Supplier
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Add another supplier for this item. Total quantity cannot exceed
              budget.
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              className="!rounded-lg"
              onClick={() => setAddSupplierOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              onClick={confirmAddSupplier}
            >
              Add Supplier
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-600 mb-1">Supplier Name</div>
            <Select
              value={addSupplierForm.supplier}
              onChange={(v) => {
                const opt = addSupplierModalOptions.find((o) => o.value === v);
                const pct = opt?.percentage;
                const autoQty =
                  pct != null && pct > 0 && addSupplierBudget > 0
                    ? Math.round((addSupplierBudget * pct) / 100)
                    : addSupplierRemaining > 0
                      ? addSupplierRemaining
                      : undefined; // remaining=0 → biarkan user input sendiri
                setAddSupplierForm((p) => ({
                  ...p,
                  supplier: v,
                  // Hanya set qty otomatis jika ada nilai; jangan timpa 0 ke qty
                  ...(autoQty !== undefined ? { qty: autoQty } : {}),
                  percentage: pct,
                }));
              }}
              options={addSupplierModalOptions.map((opt) => ({
                value: opt.value,
                label:
                  opt.percentage != null
                    ? `${opt.label} (${opt.percentage}%)`
                    : opt.label,
              }))}
              placeholder="Select supplier"
              className="w-full"
            />
            {activeAddSupplierItem ? (
              <div className="text-[11px] text-gray-500 mt-1">
                Showing suppliers for UNIQ{" "}
                {isChildBudgetType(getApiType(activeTab))
                  ? getChildSupplierLookupUniq(activeAddSupplierItem)
                  : activeAddSupplierItem.uniq}
              </div>
            ) : null}
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">
              Quantity
              {(addSupplierForm as any).percentage != null && (
                <span className="ml-2 text-blue-600">
                  (auto: {(addSupplierForm as any).percentage}% of{" "}
                  {formatNumber(addSupplierBudget)})
                </span>
              )}
            </div>
            <InputNumber
              min={0}
              max={addSupplierBudget || undefined}
              value={addSupplierForm.qty}
              onChange={(v) =>
                setAddSupplierForm((p) => ({
                  ...p,
                  qty: v != null ? Number(v) : undefined,
                }))
              }
              placeholder="Enter quantity"
              className="w-full"
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Budget: {formatNumber(addSupplierBudget)} | Allocated:{" "}
              {formatNumber(addSupplierAllocated)} | Remaining:{" "}
              {formatNumber(addSupplierRemaining)}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
