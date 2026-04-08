"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Button, InputNumber, Pagination, Select, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DownloadOutlined, FileTextOutlined, ShoppingCartOutlined, WarningOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { type DnManagementType, useGetDnManagementByTypeQuery } from "@/lib/api/dn-management/api";
import { getApiErrorMessage } from "@/lib/api/error";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

const isMissingRouteError = (error: unknown): boolean => {
  if (!isRecord(error)) return false;
  return (error as UnknownRecord).status === 404;
};

type ProcurementTab = "raw" | "indirect" | "subcon";

type DnRow = {
  key: string;
  period: string;
  poNumber: string;
  partner: string;
  dnCreated: number;
  dnIncoming: number;
  openDn: number;
  dnAlert?: number;
  status: "Open" | "Closed" | "In Transit";
};

const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

const makeRows = (tab: ProcurementTab): DnRow[] => {
  const partner = tab === "subcon" ? "PT Subcon Partner" : "PT Steel Manufacturing";
  return [
    {
      key: `${tab}-1`,
      period: "2024-01",
      poNumber: `PO-${tab.toUpperCase()}-2024-001`,
      partner,
      dnCreated: 10,
      dnIncoming: 3,
      openDn: 7,
      dnAlert: 0,
      status: "In Transit",
    },
    {
      key: `${tab}-2`,
      period: "2024-01",
      poNumber: `PO-${tab.toUpperCase()}-2024-002`,
      partner,
      dnCreated: 0,
      dnIncoming: 0,
      openDn: 0,
      dnAlert: 0,
      status: "Open",
    },
    {
      key: `${tab}-3`,
      period: "2024-01",
      poNumber: `PO-${tab.toUpperCase()}-2024-003`,
      partner,
      dnCreated: 5,
      dnIncoming: 5,
      openDn: 0,
      dnAlert: 0,
      status: "Closed",
    },
    {
      key: `${tab}-4`,
      period: "2024-01",
      poNumber: `PO-${tab.toUpperCase()}-2024-004`,
      partner,
      dnCreated: 2,
      dnIncoming: 0,
      openDn: 2,
      dnAlert: 0,
      status: "Open",
    },
  ];
};

const tabToType = (tab: ProcurementTab): DnManagementType => {
  if (tab === "raw") return "rm";
  if (tab === "indirect") return "indirect";
  return "subcon";
};

const computeStatus = (dnCreated: number, dnIncoming: number): DnRow["status"] => {
  if (dnCreated > 0 && dnIncoming >= dnCreated) return "Closed";
  if (dnCreated > 0 && dnIncoming > 0) return "In Transit";
  return "Open";
};

export default function DnProcurementPage() {
  return (
    <Suspense fallback={null}>
      <DnProcurementPageContent />
    </Suspense>
  );
}

function DnProcurementPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<ProcurementTab>("raw");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "raw" || tab === "indirect" || tab === "subcon") {
      setActiveTab(tab);
      setPage(1);
    }
  }, [searchParams]);

  const setTab = (tab: ProcurementTab) => {
    setActiveTab(tab);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/dn-procurement?${params.toString()}`);
  };

  const pageTitle = useMemo(() => {
    if (activeTab === "raw") return "DN - Raw Material";
    if (activeTab === "indirect") return "DN - Indirect";
    return "DN - Sub Con";
  }, [activeTab]);

  const apiEnabled = Boolean(apiBaseUrl);
  const boardQuery = useGetDnManagementByTypeQuery(
    apiEnabled ? tabToType(activeTab) : ("rm" as DnManagementType),
    { skip: !apiEnabled }
  );

  const procurementApiAvailable = apiEnabled && !isMissingRouteError(boardQuery.error);

  useEffect(() => {
    if (!apiEnabled) return;
    if (!boardQuery.error) return;
    if (isMissingRouteError(boardQuery.error)) {
      message.warning("Procurement DN API route is not available on this backend yet; showing mock data.");
      return;
    }
    message.error(getApiErrorMessage(boardQuery.error, "Failed to load DN board"));
  }, [apiEnabled, boardQuery.error]);

  const rows = useMemo<DnRow[]>(() => {
    if (!procurementApiAvailable) return makeRows(activeTab);
    const list = boardQuery.data ?? [];
    return list.map((r) => {
      const dnNumber = r.dn_number ?? r.id;
      const dnCreated = Number(r.total_dn_created ?? 0);
      const dnIncoming = r.items.reduce((total, item) => total + Number(item.qty_stated ?? 0), 0);
      const totalPo = Number(r.total_po_qty ?? 0);
      const openDn = Math.max(totalPo - dnCreated, 0);
      const partner = r.supplier_name ?? (r.supplier_id ? `Supplier #${r.supplier_id}` : "-");
      return {
        key: dnNumber,
        period: r.period ?? "-",
        poNumber: r.po_number ?? dnNumber,
        partner,
        dnCreated,
        dnIncoming,
        openDn,
        dnAlert: openDn > 0 ? 1 : 0,
        status: computeStatus(dnCreated, dnIncoming),
      };
    });
  }, [activeTab, procurementApiAvailable, boardQuery.data]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return rows.slice(start, end);
  }, [rows, page, pageSize]);

  const columns: ColumnsType<DnRow> = [
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
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: activeTab === "subcon" ? "SubCon" : "Supplier",
      dataIndex: "partner",
      key: "partner",
      width: 220,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "DN Created",
      dataIndex: "dnCreated",
      key: "dnCreated",
      width: 110,
      align: "right",
      render: (v: number) => <span className="text-sm text-gray-800">{formatNumber(v)}</span>,
    },
    {
      title: "DN Incoming",
      dataIndex: "dnIncoming",
      key: "dnIncoming",
      width: 110,
      align: "right",
      render: (v: number) => <span className="text-sm text-gray-800">{formatNumber(v)}</span>,
    },
    {
      title: "Open DN",
      dataIndex: "openDn",
      key: "openDn",
      width: 110,
      align: "right",
      render: (v: number) => <span className="text-sm font-semibold text-gray-900">{formatNumber(v)}</span>,
    },
    {
      title: "Alert",
      dataIndex: "dnAlert",
      key: "dnAlert",
      width: 110,
      render: (_: unknown, record) => {
        const hasAlert = Number(record.dnAlert ?? 0) > 0;
        if (!hasAlert) return <span className="text-xs text-gray-400">-</span>;
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
            <WarningOutlined />
            Late
          </span>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (v: DnRow["status"]) => {
        const cls =
          v === "Closed"
            ? "bg-green-50 text-green-700"
            : v === "In Transit"
              ? "bg-blue-50 text-blue-700"
              : "bg-amber-50 text-amber-700";
        return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{v}</span>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      fixed: "right",
      render: (_: unknown, record) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="small"
            className="!rounded-lg"
            icon={<FileTextOutlined />}
            onClick={() => router.push(`/dn-management/detail/${encodeURIComponent(record.key)}?tab=${encodeURIComponent(activeTab)}`)}
          >
            View
          </Button>
        </div>
      ),
    },
  ];

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
              <p className="text-sm text-gray-500">Track DN creation, receiving status, and link back to PO</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="primary"
                className="!rounded-lg"
                icon={<ShoppingCartOutlined />}
                onClick={() => router.push(`/dn-management/create?tab=${encodeURIComponent(activeTab)}`)}
              >
                Create DN
              </Button>
              <Button
                className="!rounded-lg"
                icon={<DownloadOutlined />}
                onClick={() => message.info("Generate DN report is not implemented yet")}
              >
                Generate Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-2 w-fit">
          <button type="button" className={tabButtonClass(activeTab === "raw")} onClick={() => setTab("raw")}>
            Raw Material
          </button>
          <button type="button" className={tabButtonClass(activeTab === "indirect")} onClick={() => setTab("indirect")}>
            Indirect Raw Material
          </button>
          <button type="button" className={tabButtonClass(activeTab === "subcon")} onClick={() => setTab("subcon")}>
            SubCon
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShoppingCartOutlined className="text-blue-600" />
                <div className="text-sm font-semibold text-gray-900">DN Monitoring Board</div>
              </div>
              <div className="text-sm text-gray-500 mt-1">Monitor delivery notes status and receiving progress</div>
              <div className="mt-2 text-xs text-gray-500">{rows.length} POs</div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
            <Table<DnRow>
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
              <Pagination current={page} pageSize={pageSize} total={totalRows} onChange={(p) => setPage(p)} showSizeChanger={false} />
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
          <span>
            Note: {apiEnabled ? "Using backend API (/api/dn-management/type/{rm|indirect|subcon})." : "Using mock data (NEXT_PUBLIC_API_URL is not set)."}
          </span>
        </div>
      </div>
    </div>
  );
}
