"use client";

import React, { useMemo, useState } from "react";
import { Button, Input, Select, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined } from "@ant-design/icons";
import StatsCard from "@/components/StatsCard";

type QcTabId = "production-qc" | "incoming-qc" | "product-return" | "defect-report";

type QcRow = {
  key: string;
  reportDate: string;
  woNumber: string;
  uniq: string;
  kanbanNumber: string;
  itemsChecked: number;
  issue: string;
  defects: number;
  scrap: number;
  qualityRate: string;
  status: "Passed" | "Failed";
};

type IncomingQcRow = {
  key: string;
  reportDate: string;
  dnNumber: string;
  kanbanPlScan: string;
  supplier: string;
  itemsChecked: number;
  issue: string;
  defects: number;
  scrap: number;
  qualityRate: string;
  status: "Not Passed" | "Passed";
};

type WoReworkStatus = "Pending" | "Created";

type ProductReturnRow = {
  key: string;
  reportDate: string;
  dnNumber: string;
  customer: string;
  kanbanPlScan: string;
  uniq: string;
  itemsChecked: number;
  issue: string;
  returnQty: number;
  scrap: number;
  defects: number;
  woReworkStatus: WoReworkStatus;
};

type DefectSource = "Product Return" | "Process" | "Setting Machine";
type DefectWoReworkStatus = "Pending" | "In Progress" | "Completed";

type DefectReportRow = {
  key: string;
  reportDate: string;
  defectSource: DefectSource;
  kanbanPl: string;
  uniq: string;
  productName: string;
  numberOfDefect: number;
  woReworkStatus: DefectWoReworkStatus;
  supplier: string;
};

const initialRows: QcRow[] = [
  {
    key: "1",
    reportDate: "10/1/2025",
    woNumber: "WO-FG-001",
    uniq: "LV7-001",
    kanbanNumber: "KBN-004-2024",
    itemsChecked: 50,
    issue: "Surface Defect",
    defects: 3,
    scrap: 1,
    qualityRate: "3/100",
    status: "Passed",
  },
];

const initialIncomingRows: IncomingQcRow[] = [
  {
    key: "1",
    reportDate: "10/1/2025",
    dnNumber: "DN-2025-001",
    kanbanPlScan: "PL-RM-001",
    supplier: "PT Steel Indonesia",
    itemsChecked: 100,
    issue: "Dimension Out of Spec",
    defects: 5,
    scrap: 2,
    qualityRate: "5/100",
    status: "Not Passed",
  },
];

const initialProductReturnRows: ProductReturnRow[] = [
  {
    key: "1",
    reportDate: "10/1/2025",
    dnNumber: "DN-OUT-2025-001",
    customer: "PT. Toyota",
    kanbanPlScan: "KBN-001",
    uniq: "LV7-001",
    itemsChecked: 20,
    issue: "Paint Defect",
    returnQty: 8,
    scrap: 3,
    defects: 8,
    woReworkStatus: "Pending",
  },
];

const initialDefectReportRows: DefectReportRow[] = [
  {
    key: "1",
    reportDate: "10/1/2025",
    defectSource: "Product Return",
    kanbanPl: "KBN-001",
    uniq: "LV7-001",
    productName: "Bracket Assembly",
    numberOfDefect: 8,
    woReworkStatus: "Pending",
    supplier: "PT Steel Indonesia",
  },
  {
    key: "2",
    reportDate: "10/1/2025",
    defectSource: "Process",
    kanbanPl: "WO-WIP-002",
    uniq: "CR-002",
    productName: "Suspension Arm",
    numberOfDefect: 3,
    woReworkStatus: "In Progress",
    supplier: "PT Steel Indonesia",
  },
  {
    key: "3",
    reportDate: "9/30/2025",
    defectSource: "Setting Machine",
    kanbanPl: "WO-FG-003",
    uniq: "LV8-003",
    productName: "Control Arm",
    numberOfDefect: 5,
    woReworkStatus: "Completed",
    supplier: "PT Steel Indonesia",
  },
];

export default function QcDashboardPage() {
  const [activeTab, setActiveTab] = useState<QcTabId>("production-qc");
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  const filteredProductionRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return initialRows.filter((row) => {
      const matchesQuery =
        !q ||
        row.woNumber.toLowerCase().includes(q) ||
        row.uniq.toLowerCase().includes(q) ||
        row.kanbanNumber.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" ? true : row.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [search, statusFilter]);

  const filteredIncomingRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return initialIncomingRows.filter((row) => {
      const matchesQuery =
        !q ||
        row.dnNumber.toLowerCase().includes(q) ||
        row.kanbanPlScan.toLowerCase().includes(q) ||
        row.supplier.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : true;
      const matchesSupplier = supplierFilter === "all" ? true : row.supplier === supplierFilter;

      return matchesQuery && matchesDate && matchesSupplier;
    });
  }, [search, dateFilter, supplierFilter]);

  const filteredProductReturnRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return initialProductReturnRows.filter((row) => {
      const matchesQuery =
        !q ||
        row.dnNumber.toLowerCase().includes(q) ||
        row.customer.toLowerCase().includes(q) ||
        row.uniq.toLowerCase().includes(q) ||
        row.kanbanPlScan.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" ? true : row.woReworkStatus === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [search, statusFilter]);

  const filteredDefectReportRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return initialDefectReportRows.filter((row) => {
      const matchesQuery =
        !q ||
        row.kanbanPl.toLowerCase().includes(q) ||
        row.uniq.toLowerCase().includes(q) ||
        row.productName.toLowerCase().includes(q);

      const matchesDate = dateFilter === "all" ? true : true;
      const matchesSupplier = supplierFilter === "all" ? true : row.supplier === supplierFilter;

      return matchesQuery && matchesDate && matchesSupplier;
    });
  }, [search, dateFilter, supplierFilter]);

  const productionColumns: ColumnsType<QcRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    {
      title: "WO Number",
      dataIndex: "woNumber",
      key: "woNumber",
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
    },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
    },
    {
      title: "Kanban Number",
      dataIndex: "kanbanNumber",
      key: "kanbanNumber",
      render: (v: string) => <Tag className="rounded-md bg-gray-50 text-gray-700 border border-gray-200">{v}</Tag>,
    },
    { title: "Items Checked", dataIndex: "itemsChecked", key: "itemsChecked" },
    {
      title: "Issue",
      dataIndex: "issue",
      key: "issue",
      render: (v: string) => <Tag className="rounded-md bg-gray-50 text-gray-700 border border-gray-200">{v}</Tag>,
    },
    {
      title: "Defects",
      dataIndex: "defects",
      key: "defects",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "Scrap",
      dataIndex: "scrap",
      key: "scrap",
      render: (v: number) => <span className="text-orange-600">{v}</span>,
    },
    {
      title: "Quality Rate",
      dataIndex: "qualityRate",
      key: "qualityRate",
      render: (v: string) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: QcRow["status"]) => (
        <Tag
          className={
            v === "Passed"
              ? "rounded-md bg-green-50 text-green-700 border border-green-100"
              : "rounded-md bg-red-50 text-red-700 border border-red-100"
          }
        >
          {v}
        </Tag>
      ),
    },
  ];

  const incomingColumns: ColumnsType<IncomingQcRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    {
      title: "DN Number",
      dataIndex: "dnNumber",
      key: "dnNumber",
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
    },
    { title: "Kanban/PL Scan", dataIndex: "kanbanPlScan", key: "kanbanPlScan" },
    { title: "Supplier", dataIndex: "supplier", key: "supplier" },
    { title: "Items Checked", dataIndex: "itemsChecked", key: "itemsChecked" },
    {
      title: "Issue",
      dataIndex: "issue",
      key: "issue",
      render: (v: string) => <Tag className="rounded-md bg-gray-50 text-gray-700 border border-gray-200">{v}</Tag>,
    },
    {
      title: "Defects",
      dataIndex: "defects",
      key: "defects",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "Scrap",
      dataIndex: "scrap",
      key: "scrap",
      render: (v: number) => <span className="text-orange-600">{v}</span>,
    },
    {
      title: "Quality Rate",
      dataIndex: "qualityRate",
      key: "qualityRate",
      render: (v: string) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: IncomingQcRow["status"]) => (
        <Tag
          className={
            v === "Not Passed"
              ? "rounded-md bg-red-50 text-red-700 border border-red-100"
              : "rounded-md bg-green-50 text-green-700 border border-green-100"
          }
        >
          {v}
        </Tag>
      ),
    },
  ];

  const productReturnColumns: ColumnsType<ProductReturnRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    {
      title: "DN Number",
      dataIndex: "dnNumber",
      key: "dnNumber",
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
    },
    { title: "Customer", dataIndex: "customer", key: "customer" },
    { title: "Kanban/PL Scan", dataIndex: "kanbanPlScan", key: "kanbanPlScan" },
    { title: "Uniq", dataIndex: "uniq", key: "uniq" },
    { title: "Items Checked", dataIndex: "itemsChecked", key: "itemsChecked" },
    {
      title: "Issue",
      dataIndex: "issue",
      key: "issue",
      render: (v: string) => <Tag className="rounded-md bg-gray-50 text-gray-700 border border-gray-200">{v}</Tag>,
    },
    {
      title: "Return Qty",
      dataIndex: "returnQty",
      key: "returnQty",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "Scrap",
      dataIndex: "scrap",
      key: "scrap",
      render: (v: number) => <span className="text-orange-600">{v}</span>,
    },
    {
      title: "Defects",
      dataIndex: "defects",
      key: "defects",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "WO Rework",
      dataIndex: "woReworkStatus",
      key: "woReworkStatus",
      render: (v: WoReworkStatus) => (
        <Tag
          className={
            v === "Pending"
              ? "rounded-md bg-yellow-50 text-yellow-800 border border-yellow-100"
              : "rounded-md bg-green-50 text-green-700 border border-green-100"
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
        <Button
          type="primary"
          size="small"
          onClick={() => {
            message.success(`Create WO Rework for ${record.dnNumber}`);
          }}
        >
          Create WO Rework
        </Button>
      ),
    },
  ];

  const defectReportColumns: ColumnsType<DefectReportRow> = [
    { title: "Report Date", dataIndex: "reportDate", key: "reportDate" },
    {
      title: "Defect Source",
      dataIndex: "defectSource",
      key: "defectSource",
      render: (v: DefectSource) => (
        <Tag
          className={
            v === "Product Return"
              ? "rounded-md bg-red-50 text-red-700 border border-red-100"
              : v === "Process"
                ? "rounded-md bg-orange-50 text-orange-700 border border-orange-100"
                : "rounded-md bg-yellow-50 text-yellow-800 border border-yellow-100"
          }
        >
          {v}
        </Tag>
      ),
    },
    { title: "Kanban/PL", dataIndex: "kanbanPl", key: "kanbanPl" },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
    },
    { title: "Product Name", dataIndex: "productName", key: "productName" },
    {
      title: "Number of Defect",
      dataIndex: "numberOfDefect",
      key: "numberOfDefect",
      render: (v: number) => <span className="text-red-600">{v}</span>,
    },
    {
      title: "WO Rework Status",
      dataIndex: "woReworkStatus",
      key: "woReworkStatus",
      render: (v: DefectWoReworkStatus) => (
        <Tag
          className={
            v === "Pending"
              ? "rounded-md bg-yellow-50 text-yellow-800 border border-yellow-100"
              : v === "In Progress"
                ? "rounded-md bg-blue-50 text-blue-700 border border-blue-100"
                : "rounded-md bg-green-50 text-green-700 border border-green-100"
          }
        >
          {v}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record) => {
        if (record.woReworkStatus === "Pending") {
          return (
            <Button
              type="primary"
              size="small"
              onClick={() => message.success(`Create WO Rework for ${record.uniq}`)}
            >
              Create WO Rework
            </Button>
          );
        }

        if (record.woReworkStatus === "In Progress") {
          return (
            <Button size="small" onClick={() => message.info(`View WO for ${record.uniq}`)}>
              View WO
            </Button>
          );
        }

        return (
          <Button
            size="small"
            className="bg-green-50 text-green-700 border border-green-100"
            onClick={() => message.success("Completed")}
          >
            Completed
          </Button>
        );
      },
    },
  ];

  const tableConfig = useMemo(() => {
    if (activeTab === "incoming-qc") {
      return { columns: incomingColumns, data: filteredIncomingRows };
    }

    if (activeTab === "product-return") {
      return { columns: productReturnColumns, data: filteredProductReturnRows };
    }

    if (activeTab === "defect-report") {
      return { columns: defectReportColumns, data: filteredDefectReportRows };
    }

    return { columns: productionColumns, data: filteredProductionRows };
  }, [
    activeTab,
    incomingColumns,
    filteredIncomingRows,
    productReturnColumns,
    filteredProductReturnRows,
    defectReportColumns,
    filteredDefectReportRows,
    productionColumns,
    filteredProductionRows,
  ]);

  const clipboardIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h6M9 3h6a2 2 0 012 2v16a2 2 0 01-2 2H9a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6m-6 4h6m-6 4h4" />
    </svg>
  );

  const crossIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22a10 10 0 110-20 10 10 0 010 20z" />
    </svg>
  );

  const warningIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );

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

  const tabs: Array<{ id: QcTabId; label: string }> = [
    { id: "production-qc", label: "Production QC" },
    { id: "incoming-qc", label: "Incoming QC" },
    { id: "product-return", label: "Product Return" },
    { id: "defect-report", label: "Defect Report" },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-gray-900">QC Dashboard</div>
          <div className="text-sm text-gray-500">
            Quality Control monitoring for production, incoming materials, product returns, and defect tracking
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />}>
          Add QC Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatsCard title="Total Reports" value={3} subtitle="" icon={clipboardIcon} bgColor="bg-blue-50" textColor="text-blue-600" />
        <StatsCard title="Total Defects" value={16} subtitle="" icon={crossIcon} bgColor="bg-red-50" textColor="text-red-600" />
        <StatsCard title="Total Scrap" value={6} subtitle="" icon={warningIcon} bgColor="bg-orange-50" textColor="text-orange-600" />
        <StatsCard title="Pending Rework" value={1} subtitle="" icon={cubeIcon} bgColor="bg-yellow-50" textColor="text-yellow-700" />
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
                  className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? "bg-white text-gray-900 font-medium" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by WO, PO, Uniq, or Supplier..."
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
              {activeTab === "incoming-qc" || activeTab === "defect-report" ? (
                <>
                  <Select
                    value={dateFilter}
                    onChange={(v) => setDateFilter(v)}
                    options={[{ label: "Date", value: "all" }]}
                    style={{ width: 120 }}
                  />
                  <Select
                    value={supplierFilter}
                    onChange={(v) => setSupplierFilter(v)}
                    options={[
                      { label: "Supplier", value: "all" },
                      { label: "PT Steel Indonesia", value: "PT Steel Indonesia" },
                    ]}
                    style={{ width: 140 }}
                  />
                </>
              ) : (
                <Select
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v)}
                  options={
                    activeTab === "product-return"
                      ? [
                          { label: "All Status", value: "all" },
                          { label: "Pending", value: "Pending" },
                          { label: "Created", value: "Created" },
                        ]
                      : [
                          { label: "All Status", value: "all" },
                          { label: "Passed", value: "Passed" },
                          { label: "Failed", value: "Failed" },
                        ]
                  }
                  style={{ width: 140 }}
                />
              )}
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
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <Table
            columns={tableConfig.columns as unknown as ColumnsType<object>}
            dataSource={tableConfig.data as unknown as object[]}
            pagination={false}
            className="rounded-xl overflow-hidden"
          />
        </div>
      </div>
    </div>
  );
}
