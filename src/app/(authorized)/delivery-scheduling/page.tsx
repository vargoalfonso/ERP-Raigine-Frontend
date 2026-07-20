"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Modal,
  Select,
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
import { useRouter, useSearchParams } from "next/navigation";
import {
  useApproveDeliveryScheduleMutation,
  useCreateDeliveryScheduleMutation,
  useGetDeliveryScheduleDnCreationListQuery,
  useGetDeliverySchedulesSummaryQuery,
  useGetDeliverySchedulesQuery,
  useScanDeliveryScheduleDnRobotMutation,
  type CreateDeliveryScheduleRequest,
} from "@/lib/api/delivery-schedule/api";
import {
  useListCustomerOrdersQuery,
  type CustomerOrderRecord,
} from "@/lib/api/customer-orders/api";
import { getApiErrorMessage } from "@/lib/api/error";

type TabKey = "schedule" | "dn";

type ScheduleStatus = "Scheduled" | "Approved";

type ScheduleRow = {
  key: string;
  scheduleId: string;
  orderId: string;
  itemId: string;
  customerId: number;
  docType: string;
  customer: string;
  poDnName: string;
  uniq: string;
  model: string;
  partNo: string;
  partName: string;
  quantity: number;
  cycle: string;
  deliveryDate: string;
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

const formatDateLabel = (iso: string) => {
  if (!iso) return "-";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatDateShort = (iso: string) => {
  if (!iso) return "-";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US").format(date);
};

// Only surface schedules whose delivery date falls within H-3..H+3 from today.
const DELIVERY_WINDOW_BACK_DAYS = 3;
const DELIVERY_WINDOW_AHEAD_DAYS = 3;

const isWithinDeliveryWindow = (
  iso: string,
  backDays = DELIVERY_WINDOW_BACK_DAYS,
  aheadDays = DELIVERY_WINDOW_AHEAD_DAYS,
): boolean => {
  if (!iso || iso === "-") return false;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - backDays);
  const end = new Date(today);
  end.setDate(today.getDate() + aheadDays);
  return date >= start && date <= end;
};

// Normalize a date/datetime string to a YYYY-MM-DD key.
const toDateKey = (value: string): string => {
  if (!value) return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDnStatus = (status: string): DnStatus => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "scanned") return "Scanned";
  if (normalized === "printed") return "Printed";
  return "Created";
};

const normalizeQrSrc = (value: string): string => {
  const qr = String(value ?? "").trim();
  if (!qr || qr === "-") return "";
  if (qr.startsWith("data:image/")) return qr;
  if (qr.startsWith("http://") || qr.startsWith("https://")) return qr;

  // If backend returns raw base64, convert to a data URL.
  const looksLikeBase64 = qr.length > 80 && /^[A-Za-z0-9+/=]+$/.test(qr);
  return looksLikeBase64 ? `data:image/png;base64,${qr}` : qr;
};

function DeliverySchedulingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>("schedule");
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<string>("");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "dn" || tab === "schedule") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [approveAllTargetGroupKey, setApproveAllTargetGroupKey] = useState<string>("");

  const [dnDetailOpen, setDnDetailOpen] = useState(false);
  const [selectedDn, setSelectedDn] = useState<DnRow | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanDnNumber, setScanDnNumber] = useState("");

  const schedulesQuery = useGetDeliverySchedulesQuery({ page: 1, limit: 200 });
  const schedulesSummaryQuery = useGetDeliverySchedulesSummaryQuery();
  const dnCreationQuery = useGetDeliveryScheduleDnCreationListQuery({ page: 1, limit: 20 });
  const poOrdersQuery = useListCustomerOrdersQuery({ document_type: "PO", page: 1, limit: 200 });
  const dnOrdersQuery = useListCustomerOrdersQuery({ document_type: "DN", page: 1, limit: 200 });
  const soOrdersQuery = useListCustomerOrdersQuery({ document_type: "SO", page: 1, limit: 200 });
  const [approveDeliverySchedule, approveState] = useApproveDeliveryScheduleMutation();
  const [createDeliverySchedule, createState] = useCreateDeliveryScheduleMutation();
  const [scanDeliveryScheduleDnRobot, scanState] = useScanDeliveryScheduleDnRobotMutation();

  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(new Set());
  const [rowApproving, setRowApproving] = useState<string>("");

  useEffect(() => {
    if (schedulesQuery.error) {
      message.error(getApiErrorMessage(schedulesQuery.error, "Failed to load delivery schedules"));
    }
  }, [schedulesQuery.error]);

  useEffect(() => {
    if (schedulesSummaryQuery.error) {
      message.error(getApiErrorMessage(schedulesSummaryQuery.error, "Failed to load delivery schedules summary"));
    }
  }, [schedulesSummaryQuery.error]);

  useEffect(() => {
    if (dnCreationQuery.error) {
      message.error(getApiErrorMessage(dnCreationQuery.error, "Failed to load DN creation list"));
    }
  }, [dnCreationQuery.error]);

  const buildCreateRequest = (row: ScheduleRow): CreateDeliveryScheduleRequest => ({
    customer_order_document_uuid: row.orderId,
    customer_order_reference: row.poDnName === "-" ? "" : row.poDnName,
    customer_id: row.customerId,
    customer_name: row.customer === "-" ? "" : row.customer,
    delivery_date: row.deliveryDate,
    cycle: row.cycle || "Daily",
    priority: "normal",
    transport_company: "",
    vehicle_number: "",
    driver_name: "",
    driver_contact: "",
    departure_at: "",
    arrival_at: "",
    delivery_instructions: "",
    items: [
      {
        customer_order_document_item_uuid: row.itemId,
        item_uniq_code: row.uniq === "-" ? "" : row.uniq,
        part_no: row.partNo === "-" ? "" : row.partNo,
        part_name: row.partName === "-" ? "" : row.partName,
        model: row.model === "-" ? "" : row.model,
        total_order: row.quantity,
        total_delivery: row.quantity,
        uom: "Pcs",
      },
    ],
  });

  // Reuse the delivery schedule module: generate a schedule from the order, then approve it.
  const approveRow = async (row: ScheduleRow): Promise<void> => {
    let scheduleId = row.scheduleId;
    if (!scheduleId) {
      const created = await createDeliverySchedule(buildCreateRequest(row)).unwrap();
      scheduleId = created.data.id;
    }
    if (!scheduleId) {
      throw new Error("Failed to generate delivery schedule");
    }
    await approveDeliverySchedule({
      schedule_id: scheduleId,
      notes: "",
      force_partial: false,
    }).unwrap();
    setApprovedKeys((prev) => {
      const next = new Set(prev);
      next.add(row.key);
      return next;
    });
  };

  const handleApproveRow = (row: ScheduleRow) => {
    setRowApproving(row.key);
    approveRow(row)
      .then(() => message.success(`Approved ${row.poDnName}`))
      .catch((error) =>
        message.error(getApiErrorMessage(error, "Failed to approve delivery schedule")),
      )
      .finally(() => setRowApproving(""));
  };

  const groups: DayGroup[] = useMemo(() => {
    const orders: CustomerOrderRecord[] = [
      ...(poOrdersQuery.data?.items ?? []),
      ...(dnOrdersQuery.data?.items ?? []),
      ...(soOrdersQuery.data?.items ?? []),
    ];

    // Documents already approved through the delivery schedule module.
    const approvedRefSet = new Set<string>();
    (schedulesQuery.data?.data ?? []).forEach((schedule) => {
      if (
        String(schedule.status).toLowerCase() === "approved" &&
        schedule.poDnName
      ) {
        approvedRefSet.add(schedule.poDnName);
      }
    });

    const grouped = new Map<string, DayGroup>();

    orders.forEach((order) => {
      order.items.forEach((item, index) => {
        // Target delivery is taken from each order item's delivery date.
        const dateKey = toDateKey(item.delivery_date ?? "");
        if (!dateKey || !isWithinDeliveryWindow(dateKey)) return;

        const rowKey = `${order.id}-${item.id || index}`;
        const approved =
          approvedKeys.has(rowKey) || approvedRefSet.has(order.document_number);

        const row: ScheduleRow = {
          key: rowKey,
          scheduleId: "",
          orderId: order.id,
          itemId: item.id,
          customerId: order.customer_id,
          docType: order.document_type,
          customer:
            order.customer_name ||
            (order.customer_id ? `Customer #${order.customer_id}` : "-"),
          poDnName: order.document_number || "-",
          uniq: item.item_uniq_code || "-",
          model: item.model || "-",
          partNo: item.part_number || "-",
          partName: item.part_name || "-",
          quantity: item.quantity,
          cycle: order.period_schedule || "Daily",
          deliveryDate: dateKey,
          dnNumber:
            approved && order.document_type === "DN"
              ? order.document_number || "-"
              : "-",
          status: approved ? "Approved" : "Scheduled",
        };

        const baseGroup = grouped.get(dateKey) ?? {
          key: dateKey,
          dayLabel: formatDateLabel(dateKey),
          itemsLabel: "0 items",
          rows: [],
        };
        baseGroup.rows.push(row);
        baseGroup.itemsLabel = `${baseGroup.rows.length} items`;
        grouped.set(dateKey, baseGroup);
      });
    });

    return Array.from(grouped.values()).sort((a, b) =>
      a.key.localeCompare(b.key),
    );
  }, [
    poOrdersQuery.data,
    dnOrdersQuery.data,
    soOrdersQuery.data,
    schedulesQuery.data,
    approvedKeys,
  ]);

  const dnRows: DnRow[] = useMemo(
    () =>
      (dnCreationQuery.data?.data ?? []).map((row, index) => ({
        key: row.id || row.dnNumber || `dn-${index}`,
        dnNumber: row.dnNumber || "-",
        dnDate: formatDateShort(row.dnDate),
        customer: row.customerName || "-",
        customerPo: row.customerPo || row.poDnName || "-",
        partTitle: row.partTitle || row.partName || row.partNo || "-",
        uniq: row.uniq || "-",
        partNo: row.partNo || "-",
        quantity: row.quantity,
        fgLocation: row.fgLocation || "-",
        qrCode: row.qrCode || "-",
        packingList: row.packingList || "-",
        status: toDnStatus(row.status),
        statusHint: row.statusHint || row.updatedAt || row.createdAt || "-",
      })),
    [dnCreationQuery.data]
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
      // Keep only deliveries scheduled within H-3..H+3 from today.
      .filter((g) => g.rows.length > 0 && isWithinDeliveryWindow(g.key));
  }, [activeTab, groups, query, customer]);

  const customerOptions = useMemo(() => {
    const names = new Set<string>();
    groups.forEach((g) => g.rows.forEach((r) => {
      const name = String(r.customer ?? "").trim();
      if (name && name !== "-") names.add(name);
    }));
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ label: name, value: name }));
  }, [groups]);

  const approveAllTargetGroup = useMemo(
    () => filteredGroups.find((group) => group.key === approveAllTargetGroupKey) ?? null,
    [approveAllTargetGroupKey, filteredGroups]
  );

  const dnCounts = useMemo(() => {
    const s = schedulesSummaryQuery.data?.data;
    if (s) {
      return {
        total: Number(s.total_deliveries ?? 0),
        inTransit: Number(s.in_transit ?? 0),
        pendingApproval: Number(s.pending_approval ?? 0),
        dnCreated: Number(s.dn_created ?? 0),
      };
    }

    const total = dnRows.length;
    const inTransit = dnRows.filter((r) => r.status === "Scanned").length;
    const pendingApproval = dnRows.filter((r) => r.status === "Created").length;
    const dnCreated = dnRows.length;
    return { total, inTransit, pendingApproval, dnCreated };
  }, [dnRows, schedulesSummaryQuery.data]);

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
            {record.uniq} • {record.partNo}
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
          {normalizeQrSrc(record.qrCode) ? (
            <div className="flex items-center gap-2">
              <img
                src={normalizeQrSrc(record.qrCode)}
                alt="QR"
                className="h-12 w-12 rounded-lg border border-gray-200 bg-white object-contain"
              />
              <div className="text-xs text-gray-500">QR</div>
            </div>
          ) : (
            <div className="text-xs text-gray-400">No QR</div>
          )}
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
                loading={rowApproving === record.key}
                onClick={() => handleApproveRow(record)}
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
              <Button className="!rounded-lg" icon={<QrcodeOutlined />} onClick={() => setScanOpen(true)}>Scan Mode</Button>
              <Button className="!rounded-lg" icon={<DownloadOutlined />} onClick={() => message.info("Reports (mock)")}>Reports</Button>
              <Button
                type="primary"
                className="!rounded-lg"
                icon={<PlusOutlined />}
                onClick={() => {
                  if (activeTab === "dn") {
                    router.push("/delivery-scheduling/dn-creation/create");
                    return;
                  }
                  router.push("/delivery-scheduling/add");
                }}
              >
                {activeTab === "dn" ? "+ DN Creation" : "+ Schedule Delivery"}
              </Button>
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
            <Select
              allowClear
              showSearch
              value={customer || undefined}
              onChange={(v) => setCustomer(String(v ?? ""))}
              placeholder="Customers"
              options={customerOptions}
              className="!rounded-lg"
              style={{ width: 180 }}
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.trim().toLowerCase())
              }
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
                loading={dnCreationQuery.isFetching || scanState.isLoading}
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
                        setApproveAllTargetGroupKey(group.key);
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
                  loading={poOrdersQuery.isFetching || dnOrdersQuery.isFetching || soOrdersQuery.isFetching || approveState.isLoading || createState.isLoading}
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
        onOk={async () => {
          if (!approveAllTargetGroup) return;

          const pendingRows = approveAllTargetGroup.rows.filter(
            (row) => row.status !== "Approved",
          );

          if (!pendingRows.length) {
            message.info("No pending schedules to approve");
            setApproveAllOpen(false);
            return;
          }

          try {
            for (const row of pendingRows) {
              // eslint-disable-next-line no-await-in-loop
              await approveRow(row);
            }
            setApproveAllOpen(false);
            message.success("All schedules approved");
          } catch (error) {
            message.error(
              getApiErrorMessage(error, "Failed to approve all delivery schedules"),
            );
          }
        }}
        okButtonProps={{ className: "!rounded-lg", loading: createState.isLoading || approveState.isLoading }}
        cancelButtonProps={{ className: "!rounded-lg" }}
      >
        <div className="text-sm text-gray-600">
          Confirm approval of all delivery schedules for <span className="font-semibold">{approveAllTargetGroup?.dayLabel ?? "-"}</span>
        </div>
      </Modal>

      <Modal
        open={scanOpen}
        onCancel={() => {
          setScanOpen(false);
          setScanDnNumber("");
        }}
        title={<div className="text-sm font-semibold">Scan DN Robot</div>}
        okText="Process"
        cancelText="Cancel"
        onOk={() => {
          if (!scanDnNumber.trim()) {
            message.error("DN Number is required");
            return;
          }

          scanDeliveryScheduleDnRobot({ dn_number: scanDnNumber.trim() })
            .unwrap()
            .then((response) => {
              message.success(response.message || `Processed ${scanDnNumber.trim()}`);
              setScanOpen(false);
              setScanDnNumber("");
            })
            .catch((error) =>
              message.error(getApiErrorMessage(error, "Failed to process DN robot scan"))
            );
        }}
        okButtonProps={{ className: "!rounded-lg", loading: scanState.isLoading }}
        cancelButtonProps={{ className: "!rounded-lg" }}
      >
        <div className="space-y-3">
          <div className="text-sm text-gray-600">Enter DN number to process robot scan mode.</div>
          <Input
            value={scanDnNumber}
            onChange={(event) => setScanDnNumber(event.target.value)}
            placeholder="DN-202604-807"
            className="!rounded-lg"
          />
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
                {selectedDn.uniq} • {selectedDn.partNo}
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
                {normalizeQrSrc(selectedDn.qrCode) ? (
                  <img
                    src={normalizeQrSrc(selectedDn.qrCode)}
                    alt="QR"
                    className="mt-2 h-40 w-40 rounded-xl border border-gray-200 bg-white object-contain"
                  />
                ) : (
                  <div className="font-semibold text-gray-400">-</div>
                )}
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

export default function DeliverySchedulingPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <DeliverySchedulingPageInner />
    </Suspense>
  );
}
