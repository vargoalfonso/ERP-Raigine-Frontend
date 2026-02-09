"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Button, InputNumber, Pagination, Select, Table, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DownloadOutlined, FileTextOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";

type ProcurementTab = "raw" | "indirect" | "subcon";

type DnRow = {
  key: string;
  period: string;
  dnNumber: string;
  poNumber: string;
  uniq: string;
  partner: string;
  status: "Open" | "Closed" | "In Transit";
};

const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

const makeRows = (tab: ProcurementTab): DnRow[] => {
  const prefix = tab === "raw" ? "RM" : tab === "indirect" ? "IRM" : "SC";
  const partner = tab === "subcon" ? "PT Subcon Partner" : "PT Steel Manufacturing";
  return [
    {
      key: `${tab}-1`,
      period: "2024-01",
      dnNumber: `DN-${prefix}-2024-001`,
      poNumber: `PO-${prefix}-2024-001`,
      uniq: tab === "raw" ? "STKM550-001" : tab === "indirect" ? "GLOVES-001" : "SC-PART-001",
      partner,
      status: "In Transit",
    },
    {
      key: `${tab}-2`,
      period: "2024-01",
      dnNumber: `DN-${prefix}-2024-002`,
      poNumber: `PO-${prefix}-2024-002`,
      uniq: tab === "raw" ? "NBR70-002" : tab === "indirect" ? "MASK-002" : "SC-PART-002",
      partner,
      status: "Open",
    },
    {
      key: `${tab}-3`,
      period: "2024-01",
      dnNumber: `DN-${prefix}-2024-003`,
      poNumber: `PO-${prefix}-2024-003`,
      uniq: tab === "raw" ? "S45C-003" : tab === "indirect" ? "CLEANER-003" : "SC-PART-003",
      partner,
      status: "Closed",
    },
    {
      key: `${tab}-4`,
      period: "2024-01",
      dnNumber: `DN-${prefix}-2024-004`,
      poNumber: `PO-${prefix}-2024-004`,
      uniq: tab === "raw" ? "AL6061-004" : tab === "indirect" ? "RAG-004" : "SC-PART-004",
      partner,
      status: "Open",
    },
  ];
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

  const rows = useMemo(() => makeRows(activeTab), [activeTab]);

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
      title: "DN Number",
      dataIndex: "dnNumber",
      key: "dnNumber",
      width: 170,
      render: (v: string) => <span className="text-sm font-medium text-gray-800">{v}</span>,
    },
    {
      title: "PO Number",
      dataIndex: "poNumber",
      key: "poNumber",
      width: 170,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
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
      dataIndex: "partner",
      key: "partner",
      width: 220,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
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
            onClick={() => message.info(`View DN: ${record.dnNumber}`)}
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
              <p className="text-sm text-gray-500">Track DN creation, receiving status, and link back to PO (mock)</p>
            </div>
            <div className="flex items-center gap-2">
              <Button className="!rounded-lg" icon={<DownloadOutlined />} onClick={() => message.info("Generate DN report (mock)")}>
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
              <div className="mt-2 text-xs text-gray-500">{rows.length} delivery notes</div>
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
          <span>Note: This page is mock UI for procurement DN monitoring.</span>
        </div>
      </div>
    </div>
  );
}
