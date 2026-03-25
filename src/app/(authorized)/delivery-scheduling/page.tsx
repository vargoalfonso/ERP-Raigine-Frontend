"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Input,
  Modal,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FullscreenOutlined,
  EnvironmentOutlined,
  QrcodeOutlined,
  SearchOutlined,
  PlusOutlined,
  PrinterOutlined,
  TruckOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";

type TabKey = "schedule" | "dn";

type ScheduleStatus = "Scheduled" | "Approved";

type ScheduleRow = {
  key: string;
  customer: string;
  poDnName: string;
  uniq: string;
  model: string;
  partNo: string;
  partName: string;
  quantity: number;
  cycle: "Daily" | "Weekly";
  dnNumber: string;
  status: ScheduleStatus;
};

type DayGroup = {
  key: string;
  dayLabel: string;
  itemsLabel: string;
  rows: ScheduleRow[];
};

type DnStatus = "Printed" | "Scanned" | "Created";

type DnRow = {
  key: string;
  dnNumber: string;
  dnDate: string;
  customer: string;
  customerPo: string;
  partTitle: string;
  uniq: string;
  partNo: string;
  quantity: number;
  fgLocation: string;
  qrCode: string;
  packingList: string;
  status: DnStatus;
  statusHint: string;
};

const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export default function DeliverySchedulingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("schedule");
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<string>("");

  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [approveAllTargetDay, setApproveAllTargetDay] = useState<string>("");

  const [dnDetailOpen, setDnDetailOpen] = useState(false);
  const [selectedDn, setSelectedDn] = useState<DnRow | null>(null);

  const [groups, setGroups] = useState<DayGroup[]>([
    {
      key: "2025-10-15",
      dayLabel: "Wednesday, October 15, 2025",
      itemsLabel: "2 items",
      rows: [
        {
          key: "row-1",
          customer: "Toyota Motor Indonesia",
          poDnName: "DN-TMC-2025-001",
          uniq: "LV7-001",
          model: "Avanza Model A",
          partNo: "BRK-001-A",
          partName: "Bracket Assembly",
          quantity: 500,
          cycle: "Daily",
          dnNumber: "-",
          status: "Scheduled",
        },
        {
          key: "row-2",
          customer: "Toyota Motor Indonesia",
          poDnName: "DN-TMC-2025-002",
          uniq: "LV8-002",
          model: "Innova Model B",
          partNo: "SA-002-B",
          partName: "Suspension Arm",
          quantity: 300,
          cycle: "Daily",
          dnNumber: "DN-OUT-2025-001",
          status: "Approved",
        },
      ],
    },
    {
      key: "2025-10-16",
      dayLabel: "Thursday, October 16, 2025",
      itemsLabel: "1 items",
      rows: [
        {
          key: "row-3",
          customer: "Honda Prospect Motor",
          poDnName: "DN-HPM-2025-003",
          uniq: "HV1-003",
          model: "Brio Model C",
          partNo: "BRK-010-C",
          partName: "Brake Bracket",
          quantity: 200,
          cycle: "Daily",
          dnNumber: "-",
          status: "Scheduled",
        },
      ],
    },
  ]);

  const dnRows: DnRow[] = useMemo(
    () => [
      {
        key: "dn-1",
        dnNumber: "DN-2024-001",
        dnDate: "1/19/2024",
        customer: "Toyota Motor Corp",
        customerPo: "PO-TMC-2024-001",
        partTitle: "Engine Mount Assembly",
        uniq: "LV7-001",
        partNo: "EM-001-LV7",
        quantity: 500,
        fgLocation: "WH-FG-A01",
        qrCode: "QR-DN-2024-001",
        packingList: "PL-001",
        status: "Printed",
        statusHint: "Printed 3x",
      },
      {
        key: "dn-2",
        dnNumber: "DN-2024-002",
        dnDate: "1/19/2024",
        customer: "Honda Manufacturing",
        customerPo: "PO-HMC-2024-002",
        partTitle: "Suspension Arm",
        uniq: "LV8-002",
        partNo: "SA-002-LV8",
        quantity: 300,
        fgLocation: "WH-FG-B02",
        qrCode: "QR-DN-2024-002",
        packingList: "PL-002",
        status: "Scanned",
        statusHint: "Printed 2x",
      },
      {
        key: "dn-3",
        dnNumber: "DN-2024-003",
        dnDate: "1/20/2024",
        customer: "Ford Motor Company",
        customerPo: "PO-FMC-2024-003",
        partTitle: "Control Module",
        uniq: "MB6-004",
        partNo: "CM-004-MB6",
        quantity: 200,
        fgLocation: "WH-FG-C03",
        qrCode: "QR-DN-2024-003",
        packingList: "PL-003",
        status: "Created",
        statusHint: "Printed 1x",
      },
    ],
    []
  );

  const filteredGroups = useMemo(() => {
    if (activeTab !== "schedule") return [];

    const q = query.trim().toLowerCase();
    const customerQ = customer.trim().toLowerCase();
    return groups
      .map((g) => {
        const rows = g.rows.filter((r) => {
          const inCustomer = !customerQ || r.customer.toLowerCase().includes(customerQ);
          if (!inCustomer) return false;
          if (!q) return true;
          const haystack = `${r.customer} ${r.poDnName} ${r.uniq} ${r.partName} ${r.partNo} ${r.model} ${r.dnNumber}`.toLowerCase();
          return haystack.includes(q);
        });
        return { ...g, rows };
      })
      .filter((g) => g.rows.length > 0);
  }, [activeTab, groups, query, customer]);

  const dnCounts = useMemo(() => {
    const total = dnRows.length;
    const inTransit = dnRows.filter((r) => r.status === "Scanned").length;
    const pendingApproval = dnRows.filter((r) => r.status === "Created").length;
    const dnCreated = dnRows.length;
    return { total, inTransit, pendingApproval, dnCreated };
  }, [dnRows]);

  const filteredDnRows = useMemo(() => {
    if (activeTab !== "dn") return [];
    const q = query.trim().toLowerCase();
    const customerQ = customer.trim().toLowerCase();
    return dnRows.filter((r) => {
      const inCustomer = !customerQ || r.customer.toLowerCase().includes(customerQ);
      if (!inCustomer) return false;
      if (!q) return true;
      const haystack = `${r.dnNumber} ${r.customer} ${r.customerPo} ${r.uniq} ${r.partTitle} ${r.partNo} ${r.qrCode} ${r.packingList}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activeTab, dnRows, query, customer]);

  const dnColumns: ColumnsType<DnRow> = [
    {
      title: "DN Info",
      dataIndex: "dnNumber",
      key: "dnInfo",
      width: 150,
      render: (_: unknown, record) => (
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-900">{record.dnNumber}</div>
          <div className="text-xs text-gray-500">{record.dnDate}</div>
        </div>
      ),
    },
    {
      title: "Customer",
      dataIndex: "customer",
      key: "customer",
      width: 200,
      render: (_: unknown, record) => (
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-900">{record.customer}</div>
          <div className="text-xs text-gray-500">{record.customerPo}</div>
        </div>
      ),
    },
    {
      title: "Part Details",
      dataIndex: "partTitle",
      key: "partDetails",
      width: 240,
      render: (_: unknown, record) => (
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-900">{record.partTitle}</div>
          <div className="text-xs text-gray-500">
            {record.uniq}  {record.partNo}
          </div>
        </div>
      ),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      width: 90,
      render: (v: number) => <span className="text-base font-semibold text-gray-900">{formatNumber(v)}</span>,
    },
    {
      title: "FG Location",
      dataIndex: "fgLocation",
      key: "fgLocation",
      width: 130,
      render: (v: string) => (
        <div className="flex items-center gap-2">
          <EnvironmentOutlined className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-700">{v}</span>
        </div>
      ),
    },
    {
      title: "QR & Packing",
      key: "qrPacking",
      width: 170,
      render: (_: unknown, record) => (
        <div className="leading-tight">
          <div className="text-xs text-gray-600">{record.qrCode}</div>
          <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 mt-1">
            {record.packingList}
          </span>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (_: unknown, record) => {
        const color = record.status === "Printed" ? "default" : record.status === "Scanned" ? "blue" : "green";
        return (
          <div className="leading-tight">
            <Tag color={color} className="!rounded-full !px-3 !py-0.5 !text-xs">
              {record.status}
            </Tag>
            <div className="text-xs text-gray-500 mt-1">{record.statusHint}</div>
          </div>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, record) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedDn(record);
              setDnDetailOpen(true);
            }}
          />
          <Button
            size="small"
            type="text"
            icon={<PrinterOutlined />}
            onClick={() => message.info(`Print ${record.dnNumber} (mock)`)}
          />
          <Button
            size="small"
            type="text"
            icon={<FullscreenOutlined />}
            onClick={() => message.info(`Open ${record.dnNumber} fullscreen (mock)`)}
          />
        </div>
      ),
    },
  ];

  const columns: ColumnsType<ScheduleRow> = [
    {
      title: "Customer",
      dataIndex: "customer",
      key: "customer",
      width: 220,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "PO/DN Name",
      dataIndex: "poDnName",
      key: "poDnName",
      width: 170,
      render: (v: string) => <a className="text-sm text-blue-600 hover:underline">{v}</a>,
    },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      width: 90,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Model",
      dataIndex: "model",
      key: "model",
      width: 140,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Part No",
      dataIndex: "partNo",
      key: "partNo",
      width: 110,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      width: 160,
      render: (v: string) => <span className="text-sm text-gray-800">{v}</span>,
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      width: 90,
      render: (v: number) => <span className="text-sm text-gray-800">{formatNumber(v)}</span>,
    },
    {
      title: "Cycle",
      dataIndex: "cycle",
      key: "cycle",
      width: 80,
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "DN Number",
      dataIndex: "dnNumber",
      key: "dnNumber",
      width: 120,
      render: (v: string) =>
        v === "-" ? (
          <span className="text-sm text-gray-400">-</span>
        ) : (
          <span className="text-sm font-medium text-green-600">{v}</span>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: ScheduleStatus) => (
        <Tag
          color={v === "Approved" ? "green" : "blue"}
          className="!rounded-full !px-3 !py-0.5 !text-xs"
        >
          {v}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 170,
      fixed: "right",
      render: (_: unknown, record) => {
        const isApproved = record.status === "Approved";
        return (
          <div className="flex items-center justify-end gap-2">
            {isApproved ? (
              <Button
                size="small"
                className="!rounded-lg"
                icon={<PrinterOutlined />}
                onClick={() => message.info(`Print packing list for ${record.poDnName} (mock)`)}
              >
                Print
              </Button>
            ) : (
              <Button
                size="small"
                className="!rounded-lg"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  setGroups((prev) =>
                    prev.map((g) => ({
                      ...g,
                      rows: g.rows.map((r) => (r.key === record.key ? { ...r, status: "Approved" } : r)),
                    }))
                  );
                  message.success("Approved");
                }}
              >
                Approve
              </Button>
            )}
            <Button
              size="small"
              className="!rounded-lg"
              icon={<EditOutlined />}
              onClick={() => message.info(`Edit schedule for ${record.poDnName} (mock)`)}
            />
          </div>
        );
      },
    },
  ];

  const tabButtonClass = (on: boolean) =>
    "rounded-lg px-4 py-2 text-sm font-medium transition-colors border " +
    (on ? "bg-white text-gray-900 border-gray-200 shadow-sm" : "bg-transparent text-gray-600 border-transparent hover:bg-white");

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Delivery Scheduling</h1>
              <p className="text-sm text-gray-500">Create delivery notes, plan daily shipments, print packing lists with QR codes, and auto-adjust FG inventory on scan</p>
            </div>
            <div className="flex items-center gap-2">
              <Button className="!rounded-lg" icon={<QrcodeOutlined />} onClick={() => message.info("Scan Mode (mock)")}>Scan Mode</Button>
              <Button className="!rounded-lg" icon={<DownloadOutlined />} onClick={() => message.info("Reports (mock)")}>Reports</Button>
              <Button type="primary" className="!rounded-lg" icon={<PlusOutlined />} onClick={() => router.push("/delivery-scheduling/add")}>Schedule Delivery</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">Total Deliveries</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{dnCounts.total}</div>
            </div>
            <TruckOutlined className="text-blue-600 text-xl" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">In Transit</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{dnCounts.inTransit}</div>
            </div>
            <ClockCircleOutlined className="text-orange-500 text-xl" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">Pending Approval</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{dnCounts.pendingApproval}</div>
            </div>
            <CalendarOutlined className="text-red-500 text-xl" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500">DN Created</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{dnCounts.dnCreated}</div>
            </div>
            <FileTextOutlined className="text-green-600 text-xl" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-2 w-fit">
          <button type="button" className={tabButtonClass(activeTab === "schedule")} onClick={() => setActiveTab("schedule")}>
            Delivery Schedule
          </button>
          <button type="button" className={tabButtonClass(activeTab === "dn")} onClick={() => setActiveTab("dn")}>
            DN Creation
          </button>
        </div>

        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <Input
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Search by DN, Customer, Uniq, or Part Name..."
            className="!rounded-lg md:max-w-xl"
          />

          <div className="flex items-center gap-2">
            <Input
              allowClear
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Customer Name"
              className="!rounded-lg"
              style={{ width: 180 }}
            />
            <Button className="!rounded-lg" icon={<DownloadOutlined />} onClick={() => message.info("Export (mock)")}>Export</Button>
          </div>
        </div>

        {activeTab === "dn" ? (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-900">Delivery Note Creation & Management</div>
              <div className="text-xs text-gray-500">{filteredDnRows.length} DNs created</div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              <Table<DnRow>
                columns={dnColumns}
                dataSource={filteredDnRows}
                rowKey="key"
                size="middle"
                pagination={false}
                scroll={{ x: "max-content" }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {filteredGroups.map((group) => (
              <div key={group.key} className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-white">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{group.dayLabel}</span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                      {group.itemsLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      className="!rounded-lg !bg-green-600 !text-white hover:!bg-green-700"
                      icon={<CheckCircleOutlined />}
                      onClick={() => {
                        setApproveAllTargetDay(group.dayLabel);
                        setApproveAllOpen(true);
                      }}
                    >
                      Approve All
                    </Button>
                    <Button
                      size="small"
                      className="!rounded-lg !border-green-200 !text-green-700"
                      onClick={() => router.push(`/delivery-scheduling/approve-partial?group=${encodeURIComponent(group.key)}`)}
                    >
                      Approve Partial
                    </Button>
                  </div>
                </div>

                <Table<ScheduleRow>
                  columns={columns}
                  dataSource={group.rows}
                  rowKey="key"
                  size="middle"
                  pagination={false}
                  scroll={{ x: "max-content" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={approveAllOpen}
        onCancel={() => setApproveAllOpen(false)}
        title={<div className="text-sm font-semibold">Approve All</div>}
        okText="Yes"
        cancelText="Cancel"
        onOk={() => {
          setGroups((prev) =>
            prev.map((g) =>
              g.dayLabel === approveAllTargetDay
                ? { ...g, rows: g.rows.map((r) => ({ ...r, status: "Approved" })) }
                : g
            )
          );
          setApproveAllOpen(false);
          message.success("All schedules approved");
        }}
        okButtonProps={{ className: "!rounded-lg" }}
        cancelButtonProps={{ className: "!rounded-lg" }}
      >
        <div className="text-sm text-gray-600">
          Confirm approval of all delivery schedules for <span className="font-semibold">{approveAllTargetDay}</span>
        </div>
      </Modal>

      <Modal
        open={dnDetailOpen}
        onCancel={() => {
          setDnDetailOpen(false);
          setSelectedDn(null);
        }}
        title={<div className="text-sm font-semibold">DN Details</div>}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button className="!rounded-lg" onClick={() => setDnDetailOpen(false)}>
              Close
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<PrinterOutlined />}
              onClick={() => {
                if (!selectedDn) return;
                message.info(`Print ${selectedDn.dnNumber} (mock)`);
              }}
            >
              Print
            </Button>
          </div>
        }
      >
        {selectedDn && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">DN Number</div>
                <div className="font-semibold text-gray-900">{selectedDn.dnNumber}</div>
                <div className="text-xs text-gray-500 mt-1">{selectedDn.dnDate}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Status</div>
                <div className="mt-1">
                  <Tag className="!rounded-full !px-3 !py-0.5 !text-xs">{selectedDn.status}</Tag>
                  <div className="text-xs text-gray-500 mt-1">{selectedDn.statusHint}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 p-3">
              <div className="text-xs text-gray-500">Customer</div>
              <div className="font-semibold text-gray-900">{selectedDn.customer}</div>
              <div className="text-xs text-gray-500 mt-1">{selectedDn.customerPo}</div>
            </div>

            <div className="rounded-lg border border-gray-100 p-3">
              <div className="text-xs text-gray-500">Part Details</div>
              <div className="font-semibold text-gray-900">{selectedDn.partTitle}</div>
              <div className="text-xs text-gray-500 mt-1">
                {selectedDn.uniq}  {selectedDn.partNo}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Quantity</div>
                <div className="font-semibold text-gray-900">{formatNumber(selectedDn.quantity)}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">FG Location</div>
                <div className="font-semibold text-gray-900">{selectedDn.fgLocation}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">QR Code</div>
                <div className="font-semibold text-gray-900">{selectedDn.qrCode}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <div className="text-xs text-gray-500">Packing List</div>
                <div className="font-semibold text-gray-900">{selectedDn.packingList}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
