"use client";

import React, { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckOutlined,
  CloseOutlined,
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

type BudgetTabId = "raw" | "subcon" | "indirect";

type BulkBudgetType = "adhoc" | "kanban";

type BulkSupplierLine = {
  id: string;
  supplier: string;
  qty: number;
};

type BulkItemRow = {
  key: string;
  prlId: string;
  uniq: string;
  partName: string;
  partNumber: string;
  weightKg: number;
  quantity: number;
  existingRawMaterial: string;
  suppliers: BulkSupplierLine[];
};

type PoBudgetRow = {
  key: string;
  uniq: string;
  customer: string;
  productModel: string;
  partName: string;
  supplier: string;
  type: string;
  salesPlan: number;
  pr: number;
  po1: number;
  po2: number;
  prl: number;
  totalPo: number;
  apoPrl: number;
  period: string;
  status: "approved" | "pending";
  approval: "Approved" | "Pending";
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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
  const [activeTab, setActiveTab] = useState<BudgetTabId>("raw");

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
    []
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
    []
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
    []
  );

  const [rowsByTab, setRowsByTab] = useState<Record<BudgetTabId, PoBudgetRow[]>>({
    raw: initialRawRows,
    subcon: initialSubconRows,
    indirect: initialIndirectRows,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    customer: "",
    uniq: "",
    productModel: "",
    partName: "",
    partNumber: "",
    supplier: "",
    salesPlan: 0,
    purchaseRequest: 0,
    po1Pct: 60,
    po2Pct: 40,
    prl: "Auto-retrieved",
    period: "October 2025",
  });

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPrlId, setBulkPrlId] = useState<string>("PRL-2024-001 - Toyota Motor Indonesia");
  const [bulkBudgetType, setBulkBudgetType] = useState<BulkBudgetType>("adhoc");
  const [bulkPeriod, setBulkPeriod] = useState<string | undefined>(undefined);
  const [bulkPo1Pct, setBulkPo1Pct] = useState<number>(60);
  const [bulkPo2Pct, setBulkPo2Pct] = useState<number>(40);

  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [addSupplierItemKey, setAddSupplierItemKey] = useState<string | null>(null);
  const [addSupplierForm, setAddSupplierForm] = useState<{ supplier?: string; qty?: number }>({});

  const filteredRows = useMemo(() => {
    return rowsByTab[activeTab];
  }, [rowsByTab, activeTab]);

  const customerOptions = useMemo(
    () => [
      { label: "Toyota Motor Indonesia", value: "Toyota Motor Indonesia" },
      { label: "Honda Manufacturing", value: "Honda Manufacturing" },
      { label: "Nissan Global", value: "Nissan Global" },
    ],
    []
  );

  const supplierOptions = useMemo(
    () => [
      { label: "PT Steel Indonesia", value: "PT Steel Indonesia" },
      { label: "PT Metal Works", value: "PT Metal Works" },
      { label: "PT Subcon Partner", value: "PT Subcon Partner" },
    ],
    []
  );

  const periodOptions = useMemo(
    () => [
      { label: "October 2025", value: "October 2025" },
      { label: "November 2025", value: "November 2025" },
      { label: "December 2025", value: "December 2025" },
      { label: "January 2026", value: "January 2026" },
    ],
    []
  );

  const prlOptions = useMemo(
    () => [
      { label: "PRL-2024-001 - Toyota Motor Indonesia", value: "PRL-2024-001 - Toyota Motor Indonesia" },
      { label: "PRL-2024-002 - Honda Manufacturing", value: "PRL-2024-002 - Honda Manufacturing" },
      { label: "PRL-2024-003 - Nissan Global", value: "PRL-2024-003 - Nissan Global" },
    ],
    []
  );

  const initialBulkItems = useMemo<BulkItemRow[]>(
    () => [
      {
        key: "RM-001",
        prlId: "PRL-2024-001",
        uniq: "RM-001",
        partName: "Steel Plate",
        partNumber: "SP-001-A",
        weightKg: 25.5,
        quantity: 1000,
        existingRawMaterial: "SPCC 1.2mm",
        suppliers: [{ id: "s1", supplier: "PT Steel Indonesia", qty: 1000 }],
      },
      {
        key: "RM-002",
        prlId: "PRL-2024-001",
        uniq: "RM-002",
        partName: "Aluminum Sheet",
        partNumber: "AS-002-B",
        weightKg: 15.3,
        quantity: 800,
        existingRawMaterial: "AL6061 2.0mm",
        suppliers: [{ id: "s1", supplier: "PT Auto Parts", qty: 800 }],
      },
      {
        key: "RM-003",
        prlId: "PRL-2024-001",
        uniq: "RM-003",
        partName: "Rubber Gasket",
        partNumber: "RG-003-C",
        weightKg: 2.1,
        quantity: 1500,
        existingRawMaterial: "NBR-70",
        suppliers: [{ id: "s1", supplier: "PT Steel Indonesia", qty: 1500 }],
      },
      {
        key: "RM-004",
        prlId: "PRL-2024-001",
        uniq: "RM-004",
        partName: "Bolt M8×20",
        partNumber: "BLT-004-D",
        weightKg: 0.05,
        quantity: 5000,
        existingRawMaterial: "S45C",
        suppliers: [{ id: "s1", supplier: "PT Steel Indonesia", qty: 5000 }],
      },
    ],
    []
  );

  const [bulkItems, setBulkItems] = useState<BulkItemRow[]>(initialBulkItems);

  const activeAddSupplierItem = useMemo(
    () => bulkItems.find((it) => it.key === addSupplierItemKey),
    [bulkItems, addSupplierItemKey]
  );

  const addSupplierBudget = activeAddSupplierItem?.quantity ?? 0;
  const addSupplierAllocated = useMemo(() => {
    if (!activeAddSupplierItem) return 0;
    return activeAddSupplierItem.suppliers.reduce((sum, s) => sum + Number(s.qty || 0), 0);
  }, [activeAddSupplierItem]);

  const addSupplierRemaining = Math.max(0, addSupplierBudget - addSupplierAllocated);

  const openBulkPoBudget = () => {
    setBulkItems(initialBulkItems);
    setBulkPeriod(undefined);
    setBulkPrlId("PRL-2024-001 - Toyota Motor Indonesia");
    setBulkBudgetType("adhoc");
    setBulkPo1Pct(60);
    setBulkPo2Pct(40);
    setBulkOpen(true);
  };

  const bulkUpdateSupplier = (itemKey: string, supplierId: string, patch: Partial<BulkSupplierLine>) => {
    setBulkItems((prev) =>
      prev.map((it) => {
        if (it.key !== itemKey) return it;
        const nextSuppliers = it.suppliers.map((s) => (s.id === supplierId ? { ...s, ...patch } : s));

        // Ensure supplier qty total cannot exceed item quantity.
        const total = nextSuppliers.reduce((sum, s) => sum + Number(s.qty || 0), 0);
        if (total > it.quantity) {
          const over = total - it.quantity;
          // Reduce the last edited supplier by the overage.
          const adjusted = nextSuppliers.map((s) => ({ ...s }));
          const idx = adjusted.findIndex((s) => s.id === supplierId);
          if (idx >= 0) {
            adjusted[idx].qty = Math.max(0, Number(adjusted[idx].qty || 0) - over);
          }
          message.warning("Total supplier quantities cannot exceed item quantity");
          return { ...it, suppliers: adjusted };
        }

        return { ...it, suppliers: nextSuppliers };
      })
    );
  };

  const bulkAddSupplierLine = (itemKey: string) => {
    const target = bulkItems.find((it) => it.key === itemKey);
    if (!target) return;
    const allocated = target.suppliers.reduce((sum, s) => sum + Number(s.qty || 0), 0);
    const remaining = Math.max(0, target.quantity - allocated);
    setAddSupplierItemKey(itemKey);
    setAddSupplierForm({ supplier: undefined, qty: remaining });
    setAddSupplierOpen(true);
  };

  const confirmAddSupplier = () => {
    if (!addSupplierItemKey) return;
    const supplier = addSupplierForm.supplier;
    const qty = Number(addSupplierForm.qty || 0);
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
    const allocated = target.suppliers.reduce((sum, s) => sum + Number(s.qty || 0), 0);
    if (allocated + qty > target.quantity) {
      message.warning("Total quantity cannot exceed budget");
      return;
    }

    setBulkItems((prev) =>
      prev.map((it) => {
        if (it.key !== addSupplierItemKey) return it;
        const nextId = `s${it.suppliers.length + 1}`;
        return { ...it, suppliers: [...it.suppliers, { id: nextId, supplier, qty }] };
      })
    );

    setAddSupplierOpen(false);
  };

  const bulkUpdateQuantity = (itemKey: string, nextQty: number) => {
    setBulkItems((prev) =>
      prev.map((it) => {
        if (it.key !== itemKey) return it;
        const qty = Math.max(0, Number(nextQty || 0));
        const total = it.suppliers.reduce((sum, s) => sum + Number(s.qty || 0), 0);
        if (total > qty) {
          message.warning("Total supplier quantities cannot exceed item quantity");
        }
        return { ...it, quantity: qty };
      })
    );
  };

  const bulkSave = () => {
    if (!bulkPeriod) {
      message.warning("Please select period");
      return;
    }
    message.success("Bulk PO Budget created");
    setBulkOpen(false);
  };

  const addSubtitle = useMemo(() => {
    if (activeTab === "raw") return "Enter the PO budget details for raw material";
    if (activeTab === "subcon") return "Enter the PO budget details for subcon";
    return "Enter the PO budget details for indirect";
  }, [activeTab]);

  const computedPo1Units = useMemo(() => {
    const pr = Number(addForm.purchaseRequest || 0);
    const pct = Number(addForm.po1Pct || 0);
    return Math.round((pr * pct) / 100);
  }, [addForm.purchaseRequest, addForm.po1Pct]);

  const computedPo2Units = useMemo(() => {
    const pr = Number(addForm.purchaseRequest || 0);
    const pct = Number(addForm.po2Pct || 0);
    return Math.round((pr * pct) / 100);
  }, [addForm.purchaseRequest, addForm.po2Pct]);

  const saveAddBudget = () => {
    if (!addForm.customer || !addForm.uniq) {
      message.warning("Please fill Customer Name and Uniq (Product Code)");
      return;
    }

    const prlGuess = Math.max(0, Math.round((Number(addForm.salesPlan || 0) + Number(addForm.purchaseRequest || 0)) / 2));
    const totalPo = computedPo1Units + computedPo2Units;
    const apoPrl = Math.max(0, Math.abs(totalPo - prlGuess));

    const newRow: PoBudgetRow = {
      key: `${addForm.uniq}-${Date.now()}`,
      uniq: addForm.uniq,
      customer: addForm.customer,
      productModel: addForm.productModel || "-",
      partName: addForm.partName || "-",
      supplier: addForm.supplier || "-",
      type: "Adhoc",
      salesPlan: Number(addForm.salesPlan || 0),
      pr: Number(addForm.purchaseRequest || 0),
      po1: computedPo1Units,
      po2: computedPo2Units,
      prl: prlGuess,
      totalPo,
      apoPrl,
      period: addForm.period,
      status: "pending",
      approval: "Pending",
    };

    setRowsByTab((prev) => ({
      ...prev,
      [activeTab]: [newRow, ...prev[activeTab]],
    }));
    message.success("Budget entry saved");
    setAddOpen(false);
  };

  const columns = useMemo<ColumnsType<PoBudgetRow>>(
    () => [
      {
        title: "Uniq",
        dataIndex: "uniq",
        key: "uniq",
        render: (v: string) => <span className="text-sm font-semibold text-gray-800">{v}</span>,
      },
      {
        title: "Customer",
        dataIndex: "customer",
        key: "customer",
        render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
      },
      {
        title: "Product Model",
        dataIndex: "productModel",
        key: "productModel",
        render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
      },
      {
        title: "Part Name",
        dataIndex: "partName",
        key: "partName",
        render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
      },
      {
        title: "Supplier",
        dataIndex: "supplier",
        key: "supplier",
        render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
      },
      {
        title: "Type",
        dataIndex: "type",
        key: "type",
        render: (v: string) =>
          v ? (
            <Tag color="purple" className="!rounded-md !px-2 !py-0.5 !text-xs !font-semibold">
              {v}
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
        render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
      },
      {
        title: "PR",
        dataIndex: "pr",
        key: "pr",
        align: "right",
        render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
      },
      {
        title: "PO1",
        dataIndex: "po1",
        key: "po1",
        align: "right",
        render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
      },
      {
        title: "PO2",
        dataIndex: "po2",
        key: "po2",
        align: "right",
        render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
      },
      {
        title: "PRL",
        dataIndex: "prl",
        key: "prl",
        align: "right",
        render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
      },
      {
        title: "Total PO",
        dataIndex: "totalPo",
        key: "totalPo",
        align: "right",
        render: (v: number) => <span className="text-sm text-gray-700">{formatNumber(v)}</span>,
      },
      {
        title: "APO-PRL",
        dataIndex: "apoPrl",
        key: "apoPrl",
        align: "right",
        render: (v: number) => <span className="text-sm font-semibold text-orange-600">{formatNumber(v)}</span>,
      },
      {
        title: "Period",
        dataIndex: "period",
        key: "period",
        render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
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
      {
        title: "Approval Actions",
        key: "approvalActions",
        render: (_, r) =>
          r.status === "approved" ? (
            <span className="text-xs text-gray-400">Approved</span>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                className="!rounded-lg !bg-green-600"
                onClick={() => message.success(`Approved ${r.uniq}`)}
              >
                Approve
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                className="!rounded-lg"
                onClick={() => message.error(`Rejected ${r.uniq}`)}
              >
                Reject
              </Button>
            </div>
          ),
      },
      {
        title: "Actions",
        key: "actions",
        fixed: "right",
        render: (_, r) => (
          <Button
            size="small"
            icon={<EyeOutlined />}
            className="!rounded-lg"
            onClick={() => message.info(`Open detail for ${r.uniq}`)}
          >
            Detail
          </Button>
        ),
      },
    ],
    []
  );

  const tabOptions = useMemo(
    () => [
      { label: "Raw Material Budget", value: "raw" },
      { label: "Subcon Budget", value: "subcon" },
      { label: "Indirect Budget", value: "indirect" },
    ],
    []
  );

  const bulkColumns = useMemo<ColumnsType<BulkItemRow>>(
    () => [
      { title: "PRL ID", dataIndex: "prlId", key: "prlId", width: 120 },
      { title: "UNIQ", dataIndex: "uniq", key: "uniq", width: 90 },
      { title: "Part Name", dataIndex: "partName", key: "partName", width: 160 },
      { title: "Part Number", dataIndex: "partNumber", key: "partNumber", width: 120 },
      {
        title: "Weight (kg)",
        dataIndex: "weightKg",
        key: "weightKg",
        width: 110,
        align: "right",
        render: (v: number) => <span className="text-sm text-gray-700">{v}</span>,
      },
      {
        title: "Quantity (Editable)",
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
        title: "Existing Raw Material",
        dataIndex: "existingRawMaterial",
        key: "existingRawMaterial",
        width: 140,
        render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
      },
      {
        title: "Suppliers",
        key: "suppliers",
        width: 320,
        render: (_, r) => {
          const total = r.suppliers.reduce((sum, s) => sum + Number(s.qty || 0), 0);
          const over = total > r.quantity;
          return (
            <div className="space-y-2">
              {r.suppliers.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <Select
                    value={s.supplier}
                    onChange={(v) => bulkUpdateSupplier(r.key, s.id, { supplier: v })}
                    options={supplierOptions}
                    className="w-[170px]"
                    size="small"
                  />
                  <InputNumber
                    min={0}
                    value={s.qty}
                    onChange={(v) => bulkUpdateSupplier(r.key, s.id, { qty: Number(v || 0) })}
                    className="w-[90px]"
                    size="small"
                  />
                </div>
              ))}
              <div className={"text-[11px] " + (over ? "text-red-600" : "text-gray-500")}>
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
          <Button size="small" className="!rounded-lg" onClick={() => bulkAddSupplierLine(r.key)}>
            + Add Supplier
          </Button>
        ),
      },
    ],
    [supplierOptions]
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">PO Budget Management</h1>
            <p className="text-sm text-gray-500">
              Manage PO budget for creating Purchase Orders across Raw Material, Subcon, and Indirect categories
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="!rounded-lg"
              icon={<FileExcelOutlined />}
              onClick={openBulkPoBudget}
            >
              Bulk PO Budget
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<PlusOutlined />}
              onClick={() => setAddOpen(true)}
            >
              Add Budget Entry
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 mb-6">
        <StatCard
          label="Total Entries"
          value={4}
          icon={<MdDescription size={18} />}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Sales Plan"
          value={"40,500"}
          icon={<MdOutlineShowChart size={18} />}
          accent="bg-pink-50 text-pink-600"
        />
        <StatCard
          label="Total PO"
          value={"43,200"}
          icon={<MdAttachMoney size={18} />}
          accent="bg-green-50 text-green-600"
        />
        <StatCard
          label="Total PRL"
          value={"41,900"}
          icon={<MdQueryStats size={18} />}
          accent="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="APO - PRL"
          value={"1,300"}
          icon={<MdInventory2 size={18} />}
          accent="bg-orange-50 text-orange-600"
        />
        <StatCard
          label="Pending Approvals"
          value={2}
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
            pagination={false}
            scroll={{ x: 1600 }}
          />
        </div>
      </div>

      <Modal
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        width={640}
        destroyOnClose
        title={
          <div>
            <div className="text-sm font-semibold text-gray-900">Add New PO Budget Entry</div>
            <div className="text-xs text-gray-500 mt-1">{addSubtitle}</div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button className="!rounded-lg" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="primary" className="!rounded-lg" onClick={saveAddBudget}>
              Save Budget Entry
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-600 mb-1">Customer Name</div>
            <Select
              value={addForm.customer || undefined}
              onChange={(v) => setAddForm((p) => ({ ...p, customer: v }))}
              options={customerOptions}
              placeholder="Select customer"
              className="w-full"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Uniq (Product Code)</div>
            <Input
              value={addForm.uniq}
              onChange={(e) => setAddForm((p) => ({ ...p, uniq: e.target.value }))}
              placeholder="e.g., RM-001"
              className="!rounded-lg"
            />
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">Product Model</div>
            <Input
              value={addForm.productModel}
              onChange={(e) => setAddForm((p) => ({ ...p, productModel: e.target.value }))}
              placeholder="Enter product model"
              className="!rounded-lg"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Part Name</div>
            <Input
              value={addForm.partName}
              onChange={(e) => setAddForm((p) => ({ ...p, partName: e.target.value }))}
              placeholder="Enter part name"
              className="!rounded-lg"
            />
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">Part Number</div>
            <Input
              value={addForm.partNumber}
              onChange={(e) => setAddForm((p) => ({ ...p, partNumber: e.target.value }))}
              placeholder="Enter part number"
              className="!rounded-lg"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Supplier Name</div>
            <Select
              value={addForm.supplier || undefined}
              onChange={(v) => setAddForm((p) => ({ ...p, supplier: v }))}
              options={supplierOptions}
              placeholder="Select supplier"
              className="w-full"
            />
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">Sales Plan (Units)</div>
            <InputNumber
              min={0}
              value={addForm.salesPlan}
              onChange={(v) => setAddForm((p) => ({ ...p, salesPlan: Number(v || 0) }))}
              className="w-full !rounded-lg"
            />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Purchase Request (Units)</div>
            <InputNumber
              min={0}
              value={addForm.purchaseRequest}
              onChange={(v) => setAddForm((p) => ({ ...p, purchaseRequest: Number(v || 0) }))}
              className="w-full !rounded-lg"
            />
          </div>

          <div className="md:col-span-2">
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <div className="text-sm font-semibold text-gray-900">Purchase Order Calculation</div>
              <div className="text-xs text-blue-700 mt-1">
                PO amounts are calculated based on parameterized % of PR (kanban packing logic)
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-600 mb-1">PO1 (% of PR)</div>
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
                  <div className="text-xs text-gray-500 mt-1">Units: {formatNumber(computedPo1Units)}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-600 mb-1">PO2 (% of PR)</div>
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
                  <div className="text-xs text-gray-500 mt-1">Units: {formatNumber(computedPo2Units)}</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">PRL (from PRL & Master Data)</div>
            <Input value={addForm.prl} disabled className="!rounded-lg" />
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Period</div>
            <Select
              value={addForm.period}
              onChange={(v) => setAddForm((p) => ({ ...p, period: v }))}
              options={periodOptions}
              className="w-full"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkOpen}
        onCancel={() => setBulkOpen(false)}
        width={980}
        destroyOnClose
        title={
          <div className="flex items-center gap-2">
            <span className="text-blue-600">+</span>
            <div>
              <div className="text-sm font-semibold text-gray-900">Add New PO Budget</div>
              <div className="text-xs text-gray-500 mt-1">
                Select PRL, configure quantities and suppliers, then set period and PO calculation
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
                <div className="text-sm font-semibold text-gray-900">Step 1: Choose PRL</div>
                <div className="text-xs text-gray-500 mt-1">
                  Select Production Requirement List to generate PO Budget
                </div>
              </div>
              <Tag className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">Required</Tag>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">Select PRL</div>
                <Select
                  value={bulkPrlId}
                  onChange={setBulkPrlId}
                  options={prlOptions}
                  className="w-full"
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">PO Budget Type:</div>
                <Select
                  value={bulkBudgetType}
                  onChange={(v) => setBulkBudgetType(v as BulkBudgetType)}
                  options={[
                    { label: "PO Adhoc", value: "adhoc" },
                    { label: "PO Kanban", value: "kanban" },
                  ]}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-green-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Step 2: Configure Items & Suppliers</div>
                <div className="text-xs text-gray-500 mt-1">
                  Edit quantities and add multiple suppliers for each item
                </div>
              </div>
              <Tag color="green" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
                {bulkItems.length} Items
              </Tag>
            </div>

            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-700">
              <b>Note:</b> You can edit quantity for each item and add multiple suppliers. Total supplier quantities
              cannot exceed item quantity.
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              <Table<BulkItemRow>
                dataSource={bulkItems}
                columns={bulkColumns}
                rowKey="key"
                pagination={false}
                size="small"
                scroll={{ x: 1200 }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-purple-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Step 3: Period & Purchase Order Calculation</div>
                <div className="text-xs text-gray-500 mt-1">Set period and configure PO split percentages</div>
              </div>
              <Tag color="purple" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
                Final Step
              </Tag>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-600 mb-1">Period</div>
                <Select
                  value={bulkPeriod}
                  onChange={(v) => setBulkPeriod(v)}
                  options={periodOptions}
                  placeholder="Select period..."
                  className="w-full"
                />
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <div className="text-sm font-semibold text-gray-900">Purchase Order Calculation</div>
                <div className="text-xs text-blue-700 mt-1">
                  PO amounts are calculated based on parameterized % of PR (kanban packing logic)
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">PO1 (% of PR)</div>
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
                    <div className="text-xs text-gray-600 mb-1">PO2 (% of PR)</div>
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
        open={addSupplierOpen}
        onCancel={() => setAddSupplierOpen(false)}
        width={520}
        destroyOnClose
        title={
          <div>
            <div className="text-sm font-semibold text-gray-900">Add Supplier</div>
            <div className="text-xs text-gray-500 mt-1">
              Add another supplier for this item. Total quantity cannot exceed budget.
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button className="!rounded-lg" onClick={() => setAddSupplierOpen(false)}>
              Cancel
            </Button>
            <Button type="primary" className="!rounded-lg" onClick={confirmAddSupplier}>
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
              onChange={(v) => setAddSupplierForm((p) => ({ ...p, supplier: v }))}
              options={supplierOptions}
              placeholder="Select supplier"
              className="w-full"
            />
          </div>

          <div>
            <div className="text-xs text-gray-600 mb-1">Quantity</div>
            <InputNumber
              min={0}
              max={addSupplierRemaining}
              value={addSupplierForm.qty}
              onChange={(v) => setAddSupplierForm((p) => ({ ...p, qty: Number(v || 0) }))}
              placeholder="Enter quantity"
              className="w-full"
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Budget: {formatNumber(addSupplierBudget)} | Allocated: {formatNumber(addSupplierAllocated)}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
