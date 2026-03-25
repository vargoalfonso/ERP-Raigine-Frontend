"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Button, InputNumber, Pagination, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetProcurementPoBoardQuery } from "@/lib/api/procurement-po/api";
import { getApiErrorMessage } from "@/lib/api/error";

type ProcurementTab = "raw" | "indirect" | "subcon";

type PoRow = {
  key: string;
  period: string;
  poNumber: string;
  budgetIdr: number;
  qtyDelivered: number;
  uniq: string;
  supplier: string;
  dnCreated: number;
};

const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);
const formatIdr = (n: number) => `${formatNumber(n)} IDR`;

const makeRows = (prefix: string): PoRow[] => {
  if (prefix === "indirect") {
    return [
      {
        key: `${prefix}-1`,
        period: "2024-01",
        poNumber: "PO-IRM-2024-001",
        budgetIdr: 45_000_000,
        qtyDelivered: 120,
        uniq: "GLOVES-001",
        supplier: "PT Safety Supplies",
        dnCreated: 2,
      },
      {
        key: `${prefix}-2`,
        period: "2024-01",
        poNumber: "PO-IRM-2024-001",
        budgetIdr: 45_000_000,
        qtyDelivered: 60,
        uniq: "MASK-002",
        supplier: "PT Safety Supplies",
        dnCreated: 2,
      },
      {
        key: `${prefix}-3`,
        period: "2024-01",
        poNumber: "PO-IRM-2024-002",
        budgetIdr: 30_000_000,
        qtyDelivered: 0,
        uniq: "CLEANER-003",
        supplier: "Indo Chemical",
        dnCreated: 0,
      },
      {
        key: `${prefix}-4`,
        period: "2024-01",
        poNumber: "PO-IRM-2024-002",
        budgetIdr: 30_000_000,
        qtyDelivered: 10,
        uniq: "RAG-004",
        supplier: "Indo Chemical",
        dnCreated: 1,
      },
    ];
  }

  if (prefix === "subcon") {
    return [
      {
        key: `${prefix}-1`,
        period: "2024-01",
        poNumber: "PO-SC-2024-001",
        budgetIdr: 250_000_000,
        qtyDelivered: 0,
        uniq: "SC-PART-001",
        supplier: "PT Subcon Partner",
        dnCreated: 5,
      },
      {
        key: `${prefix}-2`,
        period: "2024-01",
        poNumber: "PO-SC-2024-002",
        budgetIdr: 250_000_000,
        qtyDelivered: 0,
        uniq: "SC-PART-002",
        supplier: "PT Subcon Partner",
        dnCreated: 5,
      },
      {
        key: `${prefix}-3`,
        period: "2024-01",
        poNumber: "PO-SC-2024-003",
        budgetIdr: 250_000_000,
        qtyDelivered: 0,
        uniq: "SC-PART-003",
        supplier: "PT Outsource Works",
        dnCreated: 5,
      },
      {
        key: `${prefix}-4`,
        period: "2024-01",
        poNumber: "PO-SC-2024-004",
        budgetIdr: 250_000_000,
        qtyDelivered: 0,
        uniq: "SC-PART-004",
        supplier: "PT Outsource Works",
        dnCreated: 5,
      },
    ];
  }

  return [
    {
      key: `${prefix}-1`,
      period: "2024-01",
      poNumber: "PO-RM-2024-001",
      budgetIdr: 250_000_000,
      qtyDelivered: 300,
      uniq: "STKM550-001",
      supplier: "PT Steel Manufacturing",
      dnCreated: 5,
    },
    {
      key: `${prefix}-2`,
      period: "2024-01",
      poNumber: "PO-RM-2024-001",
      budgetIdr: 250_000_000,
      qtyDelivered: 700,
      uniq: "NBR70-002",
      supplier: "ISTW Rubber Co",
      dnCreated: 5,
    },
    {
      key: `${prefix}-3`,
      period: "2024-01",
      poNumber: "PO-RM-2024-002",
      budgetIdr: 250_000_000,
      qtyDelivered: 100,
      uniq: "S45C-003",
      supplier: "PT Tri Centrum Fortuna",
      dnCreated: 5,
    },
    {
      key: `${prefix}-4`,
      period: "2024-01",
      poNumber: "PO-RM-2024-002",
      budgetIdr: 250_000_000,
      qtyDelivered: 0,
      uniq: "AL6061-004",
      supplier: "PT Aluminum Works",
      dnCreated: 5,
    },
  ];
};

export default function PoProcurementPage() {
  return (
    <Suspense fallback={null}>
      <PoProcurementPageContent />
    </Suspense>
  );
}

function PoProcurementPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ProcurementTab>("raw");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const apiEnabled = Boolean(apiBaseUrl);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "raw" || tab === "indirect" || tab === "subcon") {
      setActiveTab(tab);
      setPage(1);
    }
  }, [searchParams]);

  const pageTitle = useMemo(() => {
    if (activeTab === "raw") return "PO - Raw Material Management";
    if (activeTab === "indirect") return "PO - Indirect Raw Material Management";
    return "PO - SubCon Management";
  }, [activeTab]);

  const boardTitle = "RM Purchase Order Board";

  const rowsByTab = useMemo(
    () => ({
      raw: makeRows("raw"),
      indirect: makeRows("indirect"),
      subcon: makeRows("subcon"),
    }),
    []
  );

  const category = useMemo(() => {
    if (activeTab === "raw") return "RAW_MATERIAL" as const;
    if (activeTab === "indirect") return "INDIRECT_RAW_MATERIAL" as const;
    return "SUBCON" as const;
  }, [activeTab]);

  const monthFilter = searchParams.get("month") ?? undefined;
  const supplierFilter = searchParams.get("supplier") ?? undefined;
  const subconFilter = searchParams.get("subcon") ?? undefined;

  const poBoardQuery = useGetProcurementPoBoardQuery(
    { category, month: monthFilter, supplier: supplierFilter, subcon: subconFilter },
    { skip: !apiEnabled }
  );

  const rows = useMemo<PoRow[]>(() => {
    if (!apiEnabled) return rowsByTab[activeTab];
    const list = poBoardQuery.data?.data ?? [];
    return list.map((r) => {
      const supplierName = activeTab === "subcon" ? r.subcon_name ?? r.supplier_name : r.supplier_name;
      return {
        key: r.po_id ?? r.id,
        period: r.month ?? "-",
        poNumber: r.po_number ?? String(r.po_id ?? r.id),
        budgetIdr: Number(r.total_po ?? 0),
        qtyDelivered: Number(r.total_incoming ?? 0),
        uniq: r.data_order ?? r.po_category ?? "-",
        supplier: supplierName ?? "-",
        dnCreated: Number(r.dn_created ?? 0),
      };
    });
  }, [activeTab, apiEnabled, poBoardQuery.data?.data, rowsByTab]);

  const poBadgeByNumber = useMemo(() => {
    const map = new Map<string, number>();
    let next = 1;
    for (const row of rows) {
      if (!map.has(row.poNumber)) {
        map.set(row.poNumber, next);
        next += 1;
      }
    }
    return map;
  }, [rows]);

  const totalPOs = rows.length;
  const activeSuppliers = useMemo(() => new Set(rows.map((r) => r.supplier).filter((s) => s && s !== "-")).size, [rows]);
  const totalPoValue = useMemo(() => rows.reduce((sum, r) => sum + (r.budgetIdr || 0), 0), [rows]);
  const lateDeliveries = useMemo(() => {
    if (!apiEnabled) return 1;
    return (poBoardQuery.data?.data ?? []).filter((r) => Number(r.po_alert ?? 0) > 0).length;
  }, [apiEnabled, poBoardQuery.data?.data]);

  useEffect(() => {
    if (!apiEnabled) return;
    if (!poBoardQuery.error) return;
    message.error(getApiErrorMessage(poBoardQuery.error, "Failed to load PO board"));
  }, [apiEnabled, poBoardQuery.error]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return rows.slice(start, end);
  }, [rows, page, pageSize]);

  const columns: ColumnsType<PoRow> = [
    {
      title: "Period",
      dataIndex: "period",
      key: "period",
      width: 110,
      render: (v: string) => <span className="text-xs text-gray-600">{v}</span>,
    },
    {
      title: "PO Number",
      dataIndex: "poNumber",
      key: "poNumber",
      width: 170,
      render: (v: string) => {
        const badge = poBadgeByNumber.get(v);
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{v}</span>
            {activeTab === "indirect" && typeof badge === "number" && (
              <Tag color="blue" className="!rounded-full !px-2 !py-0 !text-xs">
                {badge}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "Total PO",
      dataIndex: "budgetIdr",
      key: "budgetIdr",
      width: 170,
      render: (v: number) => <span className="text-sm text-gray-800">{formatNumber(v)}</span>,
    },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      width: 130,
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: activeTab === "subcon" ? "SubCon" : "Supplier",
      dataIndex: "supplier",
      key: "supplier",
      width: 220,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "DN Created",
      dataIndex: "dnCreated",
      key: "dnCreated",
      width: 150,
      render: (v: number, record: PoRow) => (
        <div className="flex items-center gap-2">
          <span className="text-blue-600 font-semibold">{v}</span>
          <Button
            size="small"
            className="!rounded-lg"
            icon={<FileTextOutlined />}
            onClick={() => message.info(`View DNs for ${record.poNumber}`)}
          >
            View DNs
          </Button>
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_: unknown, record) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="small"
            className="!rounded-lg"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/po-procurement/detail/${encodeURIComponent(record.key)}`)}
          />
          <Button
            size="small"
            className="!rounded-lg"
            icon={<EditOutlined />}
            onClick={() => message.info(`Edit PO: ${record.poNumber}`)}
          />
        </div>
      ),
    },
  ];

  const setTab = (tab: ProcurementTab) => {
    setActiveTab(tab);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/po-procurement?${params.toString()}`);
  };

  const tabButtonClass = (on: boolean) =>
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors border " +
    (on ? "bg-white text-gray-900 border-gray-200 shadow-sm" : "bg-transparent text-gray-600 border-transparent hover:bg-white");

  const totalRows = rows.length;
  const startText = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const endText = Math.min(page * pageSize, totalRows);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{pageTitle}</h1>
              <p className="text-sm text-gray-500">
                Track incoming RM POs vs DN incoming and PO totals with supplier view and delivery monitoring
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button className="!rounded-lg" icon={<DownloadOutlined />} onClick={() => message.info("Generate report (mock)")}
              >
                Generate Report
              </Button>
              <Button
                type="primary"
                className="!rounded-lg"
                icon={<PlusOutlined />}
                onClick={() => router.push("/po-procurement/create")}
              >
                Create PO
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">Total POs</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{totalPOs}</div>
            </div>
            <ShoppingCartOutlined className="text-blue-600 text-xl" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">
                {activeTab === "subcon" ? "Active Subcon" : "Active Suppliers"}
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{activeSuppliers}</div>
            </div>
            <FileTextOutlined className="text-green-600 text-xl" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">Total PO Value</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">${formatNumber(totalPoValue)}</div>
            </div>
            <Tag color="purple" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
              ↗
            </Tag>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">Late Deliveries</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{lateDeliveries}</div>
            </div>
            <WarningOutlined className="text-red-500 text-xl" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-2 w-fit">
          <button
            type="button"
            className={tabButtonClass(activeTab === "raw")}
            onClick={() => {
              setTab("raw");
            }}
          >
            Raw Material
          </button>
          <button
            type="button"
            className={tabButtonClass(activeTab === "indirect")}
            onClick={() => {
              setTab("indirect");
            }}
          >
            Indirect Raw Material
          </button>
          <button
            type="button"
            className={tabButtonClass(activeTab === "subcon")}
            onClick={() => {
              setTab("subcon");
            }}
          >
            SubCon
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShoppingCartOutlined className="text-blue-600" />
                <div className="text-sm font-semibold text-gray-900">{boardTitle}</div>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Track PO totals, incoming deliveries, and supplier performance with DN monitoring
              </div>
              <div className="mt-2 text-xs text-gray-500">{rows.length} purchase orders</div>
              {apiEnabled && poBoardQuery.isFetching && <div className="mt-1 text-xs text-gray-400">Loading from API…</div>}
            </div>

            <Button
              className="!rounded-lg"
              icon={<FileTextOutlined />}
              onClick={() => message.info("View DNs (mock)")}
            >
              View DNs
            </Button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
            <Table<PoRow>
              columns={columns}
              dataSource={pagedRows}
              rowKey="key"
              size="middle"
              pagination={false}
              scroll={{ x: "max-content" }}
            />
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span>Show rows</span>
                <Select
                  value={pageSize}
                  onChange={(v) => {
                    setPageSize(v);
                    setPage(1);
                  }}
                  options={[10, 25, 50].map((n) => ({ label: n, value: n }))}
                  style={{ width: 86 }}
                />
              </div>
              <div>
                {startText}-{endText} of {formatNumber(totalRows)} Results
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Pagination
                current={page}
                pageSize={pageSize}
                total={totalRows}
                onChange={(p) => setPage(p)}
                showSizeChanger={false}
              />
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Go to Page</span>
                <InputNumber
                  min={1}
                  max={Math.max(1, Math.ceil(totalRows / pageSize))}
                  value={page}
                  onChange={(v) => {
                    if (!v) return;
                    setPage(Number(v));
                  }}
                  className="w-20"
                />
                <Button
                  className="!rounded-lg"
                  onClick={() => {
                    const max = Math.max(1, Math.ceil(totalRows / pageSize));
                    if (page < 1) setPage(1);
                    else if (page > max) setPage(max);
                  }}
                >
                  Go
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500 flex items-center gap-2">
          <FileTextOutlined />
          <span>Note: This page is mock UI for procurement PO monitoring.</span>
        </div>
      </div>
    </div>
  );
}
