"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Input, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import {
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  MdDescription,
  MdInventory2,
  MdOutlineLocalShipping,
  MdPaid,
} from "react-icons/md";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useListCustomerPosQuery,
  useListDeliveryNotesQuery,
  useListSpecialOrdersQuery,
} from "@/lib/api/customer-orders/api";

type CustomerPoTabId = "dn" | "po" | "so";

type DnRow = {
  key: string;
  dnDate: string;
  dnNumber: string;
  customer: string;
  quantity: number;
  uom: string;
  deliveryDate: string;
  cycle: "Daily" | "Weekly" | "Monthly";
  status: string;
};

type PoRow = {
  key: string;
  poDate: string;
  poNumber: string;
  customer: string;
  quantity: number;
  uom: string;
  deliveryDate: string;
  cycle: "Daily" | "Weekly" | "Monthly";
  status: string;
};

type SoRow = {
  key: string;
  soDate: string;
  soNumber: string;
  customer: string;
  quantity: number;
  uom: string;
  deliveryDate: string;
  cycle: "Daily" | "Weekly" | "Monthly";
  status: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function StatCard(props: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  accent: string;
}) {
  const { label, value, icon, accent } = props;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
      </div>
      <div className={"h-10 w-10 rounded-lg flex items-center justify-center " + accent}>{icon}</div>
    </div>
  );
}

export default function CustomerPoDnSoPage() {
  const router = useRouter();
  const [tab, setTab] = useState<CustomerPoTabId>("dn");
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string>("");

  const apiEnabled = Boolean(apiBaseUrl);

  const dnQuery = useListDeliveryNotesQuery(undefined, { skip: !apiEnabled });
  const poQuery = useListCustomerPosQuery(undefined, { skip: !apiEnabled });
  const soQuery = useListSpecialOrdersQuery(undefined, { skip: !apiEnabled });

  const dnRows = useMemo<DnRow[]>(
    () => [
      {
        key: "DN-001",
        dnDate: "10/1/2025",
        dnNumber: "PO-TMC-2025-001",
        customer: "Toyota Motor Company",
        quantity: 5000,
        uom: "Pcs",
        deliveryDate: "10/15/2025",
        cycle: "Daily",
        status: "Active",
      },
      {
        key: "DN-002",
        dnDate: "10/2/2025",
        dnNumber: "PO-HM-2025-002",
        customer: "Honda Motor",
        quantity: 3000,
        uom: "Pcs",
        deliveryDate: "10/18/2025",
        cycle: "Weekly",
        status: "Active",
      },
      {
        key: "DN-003",
        dnDate: "10/5/2025",
        dnNumber: "PO-NG-2025-003",
        customer: "Nissan Global",
        quantity: 2200,
        uom: "Pcs",
        deliveryDate: "10/25/2025",
        cycle: "Monthly",
        status: "Draft",
      },
    ],
    []
  );

  const poRows = useMemo<PoRow[]>(
    () => [
      {
        key: "PO-001",
        poDate: "10/1/2025",
        poNumber: "PO-FMC-2025-001",
        customer: "Ford Motor Company",
        quantity: 5000,
        uom: "Pcs",
        deliveryDate: "10/15/2025",
        cycle: "Daily",
        status: "Active",
      },
      {
        key: "PO-002",
        poDate: "10/2/2025",
        poNumber: "PO-GM-2025-002",
        customer: "General Motors",
        quantity: 3000,
        uom: "Pcs",
        deliveryDate: "10/18/2025",
        cycle: "Weekly",
        status: "Active",
      },
      {
        key: "PO-003",
        poDate: "10/5/2025",
        poNumber: "PO-TMC-2025-003",
        customer: "Toyota Motor Company",
        quantity: 2200,
        uom: "Pcs",
        deliveryDate: "10/25/2025",
        cycle: "Monthly",
        status: "Draft",
      },
    ],
    []
  );

  const soRows = useMemo<SoRow[]>(
    () => [
      {
        key: "SO-001",
        soDate: "10/1/2025",
        soNumber: "SO-FMC-2025-001",
        customer: "Ford Motor Company",
        quantity: 5000,
        uom: "Pcs",
        deliveryDate: "10/15/2025",
        cycle: "Daily",
        status: "Active",
      },
      {
        key: "SO-002",
        soDate: "10/2/2025",
        soNumber: "SO-GM-2025-002",
        customer: "General Motors",
        quantity: 3000,
        uom: "Pcs",
        deliveryDate: "10/18/2025",
        cycle: "Weekly",
        status: "Active",
      },
      {
        key: "SO-003",
        soDate: "10/5/2025",
        soNumber: "SO-TMC-2025-003",
        customer: "Toyota Motor Company",
        quantity: 2200,
        uom: "Pcs",
        deliveryDate: "10/25/2025",
        cycle: "Monthly",
        status: "Draft",
      },
    ],
    []
  );

  const resolvedDnRows = useMemo<DnRow[]>(() => {
    if (!apiEnabled) return dnRows;
    const list = dnQuery.data;
    if (!list) return dnRows;

    return list.map((dn) => {
      const firstItem = dn.items?.[0];
      return {
        key: dn.id,
        dnDate: dn.delivery_date ?? "-",
        dnNumber: dn.dn_number ?? dn.id,
        customer: dn.customer?.customer_name ?? (dn.customer_id ? `Customer #${dn.customer_id}` : "-"),
        quantity: Number(firstItem?.quantity ?? 0),
        uom: firstItem?.uom ?? "Pcs",
        deliveryDate: dn.delivery_date ?? "-",
        cycle: "Monthly",
        status: dn.status ?? "-",
      };
    });
  }, [apiEnabled, dnQuery.data, dnRows]);

  const resolvedPoRows = useMemo<PoRow[]>(() => {
    if (!apiEnabled) return poRows;
    const list = poQuery.data;
    if (!list) return poRows;

    return list.map((po) => {
      const firstItem = po.items?.[0];
      return {
        key: po.id,
        poDate: firstItem?.delivery_date ?? "-",
        poNumber: po.po_number ?? po.id,
        customer: po.customer?.customer_name ?? (po.customer_id ? `Customer #${po.customer_id}` : "-"),
        quantity: Number(firstItem?.quantity ?? 0),
        uom: firstItem?.uom ?? "Pcs",
        deliveryDate: firstItem?.delivery_date ?? "-",
        cycle: "Monthly",
        status: po.status ?? "-",
      };
    });
  }, [apiEnabled, poQuery.data, poRows]);

  const resolvedSoRows = useMemo<SoRow[]>(() => {
    if (!apiEnabled) return soRows;
    const list = soQuery.data;
    if (!list) return soRows;

    return list.map((so) => {
      const firstItem = so.items?.[0];
      return {
        key: so.id,
        soDate: so.order_date ?? "-",
        soNumber: so.so_number ?? so.id,
        customer: so.customer?.customer_name ?? (so.customer_id ? `Customer #${so.customer_id}` : "-"),
        quantity: Number(firstItem?.quantity ?? 0),
        uom: firstItem?.uom ?? "Pcs",
        deliveryDate: firstItem?.target_date ?? "-",
        cycle: "Monthly",
        status: so.status ?? "-",
      };
    });
  }, [apiEnabled, soQuery.data, soRows]);

  const kpis = useMemo(
    () => ({
      activeDns: resolvedDnRows.filter((r) => String(r.status).toLowerCase() === "active").length,
      customerPos: resolvedPoRows.length,
      specialOrders: resolvedSoRows.length,
    }),
    [resolvedDnRows, resolvedPoRows, resolvedSoRows]
  );

  const filteredDnRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const customerQ = customerFilter.trim().toLowerCase();
    return resolvedDnRows.filter((r) => {
      const passCustomer = !customerQ || r.customer.toLowerCase().includes(customerQ);
      const passSearch =
        !q ||
        r.dnNumber.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q) ||
        r.uom.toLowerCase().includes(q);
      return passCustomer && passSearch;
    });
  }, [resolvedDnRows, search, customerFilter]);

  const filteredPoRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const customerQ = customerFilter.trim().toLowerCase();
    return resolvedPoRows.filter((r) => {
      const passCustomer = !customerQ || r.customer.toLowerCase().includes(customerQ);
      const passSearch = !q || r.poNumber.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q);
      return passCustomer && passSearch;
    });
  }, [resolvedPoRows, search, customerFilter]);

  const filteredSoRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const customerQ = customerFilter.trim().toLowerCase();
    return resolvedSoRows.filter((r) => {
      const passCustomer = !customerQ || r.customer.toLowerCase().includes(customerQ);
      const passSearch = !q || r.soNumber.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q);
      return passCustomer && passSearch;
    });
  }, [resolvedSoRows, search, customerFilter]);

  useEffect(() => {
    if (!apiEnabled) return;
    const activeError = tab === "dn" ? dnQuery.error : tab === "po" ? poQuery.error : soQuery.error;
    if (!activeError) return;
    message.error(getApiErrorMessage(activeError, "Failed to load customer orders"));
  }, [apiEnabled, tab, dnQuery.error, poQuery.error, soQuery.error]);

  const dnColumns = useMemo<ColumnsType<DnRow>>(
    () => [
      { title: "DN Date", dataIndex: "dnDate", key: "dnDate", width: 110 },
      {
        title: "DN Number",
        dataIndex: "dnNumber",
        key: "dnNumber",
        render: (v: string) => (
          <button type="button" className="text-sm font-semibold text-blue-600 hover:underline" onClick={() => message.info(v)}>
            {v}
          </button>
        ),
      },
      { title: "Customer", dataIndex: "customer", key: "customer" },
      {
        title: "Quantity",
        dataIndex: "quantity",
        key: "quantity",
        align: "right",
        render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
      },
      {
        title: "UoM",
        dataIndex: "uom",
        key: "uom",
        render: (v: string) => <span className="text-sm font-semibold text-orange-600">{v}</span>,
      },
      { title: "Tanggal Delivery", dataIndex: "deliveryDate", key: "deliveryDate", width: 130 },
      {
        title: "Cycle",
        dataIndex: "cycle",
        key: "cycle",
        render: (v: DnRow["cycle"]) => (
          <Tag className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold !text-gray-700">{v}</Tag>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (v: DnRow["status"]) => (
          <Tag
            color={v === "Active" ? "green" : v === "Draft" ? "gold" : "default"}
            className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
          >
            {v}
          </Tag>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        align: "center",
        width: 90,
        render: (_, r) => (
          <div className="flex items-center justify-center gap-2">
            <Button
              size="small"
              icon={<EyeOutlined />}
              className="!rounded-lg"
              onClick={() => router.push(`/customer-po/detail/${encodeURIComponent(r.key)}`)}
            />
            <Button
              size="small"
              icon={<EditOutlined />}
              className="!rounded-lg"
              onClick={() => router.push("/customer-po/create")}
            />
          </div>
        ),
      },
    ],
    [router]
  );

  const poColumns = useMemo<ColumnsType<PoRow>>(
    () => [
      { title: "PO Date", dataIndex: "poDate", key: "poDate", width: 110 },
      {
        title: "Nomor PO",
        dataIndex: "poNumber",
        key: "poNumber",
        render: (v: string) => (
          <button type="button" className="text-sm font-semibold text-blue-600 hover:underline" onClick={() => message.info(v)}>
            {v}
          </button>
        ),
      },
      { title: "Customer", dataIndex: "customer", key: "customer" },
      {
        title: "Quantity",
        dataIndex: "quantity",
        key: "quantity",
        align: "right",
        render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
      },
      { title: "UoM", dataIndex: "uom", key: "uom" },
      { title: "Tanggal Delivery", dataIndex: "deliveryDate", key: "deliveryDate", width: 130 },
      {
        title: "Cycle",
        dataIndex: "cycle",
        key: "cycle",
        render: (v: PoRow["cycle"]) => (
          <Tag className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold !text-gray-700">{v}</Tag>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (v: PoRow["status"]) => (
          <Tag
            color={v === "Active" ? "green" : v === "Draft" ? "gold" : "default"}
            className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
          >
            {v}
          </Tag>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        align: "center",
        width: 90,
        render: (_, r) => (
          <div className="flex items-center justify-center gap-2">
            <Button
              size="small"
              icon={<EyeOutlined />}
              className="!rounded-lg"
              onClick={() => router.push(`/customer-po/detail/${encodeURIComponent(r.key)}`)}
            />
            <Button
              size="small"
              icon={<EditOutlined />}
              className="!rounded-lg"
              onClick={() => router.push("/customer-po/create")}
            />
          </div>
        ),
      },
    ],
    [router]
  );

  const soColumns = useMemo<ColumnsType<SoRow>>(
    () => [
      { title: "PO Date", dataIndex: "soDate", key: "soDate", width: 110 },
      {
        title: "Nomor PO",
        dataIndex: "soNumber",
        key: "soNumber",
        render: (v: string) => (
          <button type="button" className="text-sm font-semibold text-blue-600 hover:underline" onClick={() => message.info(v)}>
            {v}
          </button>
        ),
      },
      { title: "Customer", dataIndex: "customer", key: "customer" },
      {
        title: "Quantity",
        dataIndex: "quantity",
        key: "quantity",
        align: "right",
        render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
      },
      {
        title: "UoM",
        dataIndex: "uom",
        key: "uom",
        render: (v: string) => <span className="text-sm font-semibold text-orange-600">{v}</span>,
      },
      { title: "Tanggal Delivery", dataIndex: "deliveryDate", key: "deliveryDate", width: 130 },
      {
        title: "Cycle",
        dataIndex: "cycle",
        key: "cycle",
        render: (v: SoRow["cycle"]) => (
          <Tag className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold !text-gray-700">{v}</Tag>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (v: SoRow["status"]) => (
          <Tag
            color={v === "Active" ? "green" : v === "Draft" ? "gold" : "default"}
            className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
          >
            {v}
          </Tag>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        align: "center",
        width: 90,
        render: (_, r) => (
          <div className="flex items-center justify-center gap-2">
            <Button
              size="small"
              icon={<EyeOutlined />}
              className="!rounded-lg"
              onClick={() => router.push(`/customer-po/detail/${encodeURIComponent(r.key)}`)}
            />
            <Button
              size="small"
              icon={<EditOutlined />}
              className="!rounded-lg"
              onClick={() => router.push("/customer-po/create")}
            />
          </div>
        ),
      },
    ],
    [router]
  );

  const tabs = useMemo(
    () => [
      { id: "dn" as const, label: "Delivery Notes" },
      { id: "po" as const, label: "Purchase Order" },
      { id: "so" as const, label: "Special Order" },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Customer PO & DN Management</h1>
            <p className="text-sm text-gray-500">
              Centralize customer Purchase Orders and Delivery Notes for production planning and delivery coordination
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button className="!rounded-lg" icon={<FileTextOutlined />} onClick={() => message.info("Generate Report")}
            >
              Generate Report
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<PlusOutlined />}
              onClick={() => router.push("/customer-po/create")}
            >
              Add Order
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <StatCard label="Active DNs" value={kpis.activeDns} icon={<MdOutlineLocalShipping size={18} />} accent="bg-blue-50 text-blue-600" />
        <StatCard label="Customer POs" value={kpis.customerPos} icon={<MdInventory2 size={18} />} accent="bg-green-50 text-green-600" />
        <StatCard label="Special Orders" value={kpis.specialOrders} icon={<MdDescription size={18} />} accent="bg-purple-50 text-purple-600" />
        {/*<StatCard label="Total Value" value={"$351,700"} icon={<MdPaid size={18} />} accent="bg-orange-50 text-orange-600" /> */}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* Tabs */}
        <div className="mb-4">
          <div className="inline-flex rounded-xl bg-gray-50 p-1 border border-gray-100">
            {tabs.map((t) => {
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors " +
                    (isActive ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900")
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div className="flex-1 max-w-2xl">
            <Input
              prefix={<span className="text-gray-400">⌕</span>}
              placeholder="Search by Number, Customer, Uniq, or Part Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2">
            <Input
              allowClear
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="Customer Name"
              className="!rounded-lg min-w-[180px]"
            />
            <Button className="!rounded-lg" icon={<DownloadOutlined />} onClick={() => message.info("Export")}
            >
              Export
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100">
          {tab === "dn" && (
            <Table<DnRow>
              dataSource={filteredDnRows}
              columns={dnColumns}
              rowKey="key"
              pagination={false}
              size="middle"
            />
          )}

          {tab === "po" && (
            <Table<PoRow>
              dataSource={filteredPoRows}
              columns={poColumns}
              rowKey="key"
              pagination={false}
              size="middle"
            />
          )}

          {tab === "so" && (
            <Table<SoRow>
              dataSource={filteredSoRows}
              columns={soColumns}
              rowKey="key"
              pagination={false}
              size="middle"
            />
          )}
        </div>
      </div>
    </div>
  );
}
