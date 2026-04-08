"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  LockOutlined,
  PlusOutlined,
  SearchOutlined,
  SafetyOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  WarningOutlined,
  AppstoreOutlined,
  SettingOutlined,
} from "@ant-design/icons";

type StatusType = "Active" | "Inactive";

type ParameterRow = {
  id: string;
  name: string;
  empId: string;
  department: string;
  role: string;
  team: string;
  permissions: string[];
  lastLogin: string;
  status: StatusType;
};

type RoleRow = {
  id: string;
  roleName: string;
  numberOfPeople: number;
  lastUpdated: string;
};

type SafetyStockRow = {
  id: string;
  inventoryType: string;
  parameter: string;
  constanta: number;
  status: StatusType;
};

type StockdaysRow = {
  id: string;
  inventoryType: string;
  parameter: string;
  constanta: number;
  status: StatusType;
};

type TypeParameterRow = {
  id: string;
  typeCode: string;
  typeName: string;
  description: string;
  status: StatusType;
};

type UomCategory = "Quantity" | "Weight" | "Length";

type UomRow = {
  id: string;
  code: string;
  name: string;
  category: UomCategory;
  status: StatusType;
};

type PurchaseOrderRow = {
  id: string;
  materialType: string;
  minOrderQty: number;
  maxSplitLines: number;
  splitRule: string;
  status: StatusType;
};

type ApprovalWorkflowRow = {
  id: string;
  menuAction: string;
  level1Role: string;
  level2Role: string;
  level3Role: string;
  level4Role: string;
  status: StatusType;
};

type KanbanRow = {
  id: string;
  productName: string;
  productCode: string;
  kanbanQty: number;
  minStock: number;
  maxStock: number;
  status: StatusType;
};

type ProcessRow = {
  id: string;
  processCode: string;
  processName: string;
  category: string;
  sequence: number;
  status: StatusType;
};

type MachinePatternRow = {
  id: string;
  patternName: string;
  machineCount: number;
  operatingHours: number;
  status: StatusType;
};

type GlobalWorkingDaysRow = {
  id: string;
  period: string;
  workingDays: number;
  createdDate: string;
};

type ModuleItem = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBgClass: string;
  iconTextClass: string;
};

const modules: ModuleItem[] = [
  {
    id: "access-control-matrix",
    name: "Access Control Matrix",
    description: "Configure Access Control Matrix",
    icon: <LockOutlined />,
    iconBgClass: "bg-blue-50",
    iconTextClass: "text-blue-700",
  },
  {
    id: "roles",
    name: "Roles",
    description: "Manage roles & permissions",
    icon: <UserOutlined />,
    iconBgClass: "bg-red-50",
    iconTextClass: "text-red-600",
  },
  {
    id: "safety-stock",
    name: "Safety Stock Parameters",
    description: "Safety stock configuration",
    icon: <SafetyOutlined />,
    iconBgClass: "bg-cyan-50",
    iconTextClass: "text-cyan-700",
  },
  {
    id: "stockdays",
    name: "Stockdays Parameters",
    description: "Stockdays configuration",
    icon: <AppstoreOutlined />,
    iconBgClass: "bg-purple-50",
    iconTextClass: "text-purple-700",
  },
  {
    id: "type-parameters",
    name: "Type Parameters",
    description: "Configure Type",
    icon: <AppstoreOutlined />,
    iconBgClass: "bg-pink-50",
    iconTextClass: "text-pink-700",
  },
  {
    id: "scrap",
    name: "Scrap",
    description: "Scrap parameters",
    icon: <WarningOutlined />,
    iconBgClass: "bg-red-50",
    iconTextClass: "text-red-600",
  },
  {
    id: "uom-global",
    name: "UoM Parameter (Global)",
    description: "Global unit of measure",
    icon: <SettingOutlined />,
    iconBgClass: "bg-gray-50",
    iconTextClass: "text-gray-700",
  },
  {
    id: "purchase-order",
    name: "Purchase Order",
    description: "Configure purchase order split settings",
    icon: <ShoppingCartOutlined />,
    iconBgClass: "bg-pink-50",
    iconTextClass: "text-pink-700",
  },
  {
    id: "machine",
    name: "Machine",
    description: "Define machine pattern configurations",
    icon: <SettingOutlined />,
    iconBgClass: "bg-pink-50",
    iconTextClass: "text-pink-700",
  },
  {
    id: "approval-workflow",
    name: "Approval Workflow",
    description: "Define approval workflow for actions",
    icon: <SafetyOutlined />,
    iconBgClass: "bg-green-50",
    iconTextClass: "text-green-700",
  },
  {
    id: "kanban",
    name: "Kanban",
    description: "Kanban rules",
    icon: <AppstoreOutlined />,
    iconBgClass: "bg-orange-50",
    iconTextClass: "text-orange-700",
  },
  {
    id: "global",
    name: "Global",
    description: "Configure working days per month",
    icon: <AppstoreOutlined />,
    iconBgClass: "bg-indigo-50",
    iconTextClass: "text-indigo-700",
  },
  // Keep a realistic count like the screenshot
  
  {
    id: "process",
    name: "Process",
    description: "Configure Process for Work In Progress",
    icon: <AppstoreOutlined />,
    iconBgClass: "bg-green-50",
    iconTextClass: "text-green-700",
  },
];

const initialRows: ParameterRow[] = [
  {
    id: "EMP-001",
    name: "John Smith",
    empId: "EMP-001",
    department: "Production",
    role: "Supervisor",
    team: "Manufacturing Team",
    permissions: ["Work Order Management", "WIP Tracking"],
    lastLogin: "1/15/2024",
    status: "Active",
  },
  {
    id: "EMP-002",
    name: "Sarah Wilson",
    empId: "EMP-002",
    department: "Quality",
    role: "QC Inspector",
    team: "Quality Assurance",
    permissions: ["Quality Control", "Scrap Management", "Inventory"],
    lastLogin: "1/15/2024",
    status: "Active",
  },
  {
    id: "EMP-003",
    name: "Mike Johnson",
    empId: "EMP-003",
    department: "Warehouse",
    role: "Warehouse Manager",
    team: "Logistics Team",
    permissions: ["Inventory Management", "Stock Opname", "DN Management"],
    lastLogin: "1/15/2024",
    status: "Active",
  },
  {
    id: "EMP-004",
    name: "Lisa Chen",
    empId: "EMP-004",
    department: "Planning",
    role: "Production Planner",
    team: "Planning Team",
    permissions: ["PRL Management", "Work Order Creation"],
    lastLogin: "1/15/2024",
    status: "Active",
  },
  {
    id: "EMP-005",
    name: "David Brown",
    empId: "EMP-005",
    department: "Procurement",
    role: "Buyer",
    team: "Procurement Team",
    permissions: ["PO Management", "Supplier Management"],
    lastLogin: "1/10/2024",
    status: "Inactive",
  },
];

const initialRoleRows: RoleRow[] = [
  { id: "ROLE-001", roleName: "Management", numberOfPeople: 10, lastUpdated: "1/15/2024" },
  { id: "ROLE-002", roleName: "Production Manager", numberOfPeople: 20, lastUpdated: "1/15/2024" },
  { id: "ROLE-003", roleName: "Production Staff", numberOfPeople: 200, lastUpdated: "1/15/2024" },
  { id: "ROLE-004", roleName: "Sales", numberOfPeople: 150, lastUpdated: "1/15/2024" },
  { id: "ROLE-005", roleName: "Finance", numberOfPeople: 8, lastUpdated: "1/15/2024" },
];

const initialSafetyStockRows: SafetyStockRow[] = [
  {
    id: "SSP-001",
    inventoryType: "Raw Material",
    parameter: "PRL/Working days * days",
    constanta: 7,
    status: "Inactive",
  },
  {
    id: "SSP-002",
    inventoryType: "Indirect Raw Material",
    parameter: "PRL/Working days * days",
    constanta: 7,
    status: "Active",
  },
  {
    id: "SSP-003",
    inventoryType: "SubCon",
    parameter: "PRL/Working days * days",
    constanta: 7,
    status: "Active",
  },
  {
    id: "SSP-004",
    inventoryType: "Finished Goods",
    parameter: "PRL/Working days * days",
    constanta: 7,
    status: "Active",
  },
];

const initialStockdaysRows: StockdaysRow[] = [
  {
    id: "SDP-001",
    inventoryType: "Raw Material",
    parameter: "PRL/Working days * days",
    constanta: 7,
    status: "Inactive",
  },
  {
    id: "SDP-002",
    inventoryType: "Indirect Raw Material",
    parameter: "PRL/Working days * days",
    constanta: 7,
    status: "Active",
  },
  {
    id: "SDP-003",
    inventoryType: "SubCon",
    parameter: "PRL/Working days * days",
    constanta: 7,
    status: "Active",
  },
  {
    id: "SDP-004",
    inventoryType: "Finished Goods",
    parameter: "PRL/Working days * days",
    constanta: 7,
    status: "Active",
  },
];

const initialTypeParameterRows: TypeParameterRow[] = [
  {
    id: "TP-001",
    typeCode: "WIP-A",
    typeName: "Semi-Finished Product A",
    description: "After pressing process",
    status: "Active",
  },
];

const initialUomRows: UomRow[] = [
  { id: "UOM-PCS", code: "PCS", name: "Pieces", category: "Quantity", status: "Active" },
  { id: "UOM-KG", code: "KG", name: "Kilogram", category: "Weight", status: "Active" },
  { id: "UOM-M", code: "M", name: "Meter", category: "Length", status: "Active" },
];

const initialPurchaseOrderRows: PurchaseOrderRow[] = [
  {
    id: "PO-001",
    materialType: "Raw Material",
    minOrderQty: 1000,
    maxSplitLines: 3,
    splitRule: "By Supplier Capacity",
    status: "Active",
  },
];

const initialApprovalWorkflowRows: ApprovalWorkflowRow[] = [
  {
    id: "AW-001",
    menuAction: "Update Budget for PO",
    level1Role: "Procurement Manager",
    level2Role: "Finance Manager",
    level3Role: "Director",
    level4Role: "CEO",
    status: "Active",
  },
  {
    id: "AW-002",
    menuAction: "Approve Work Order",
    level1Role: "Production Supervisor",
    level2Role: "Production Manager",
    level3Role: "Director",
    level4Role: "-",
    status: "Active",
  },
];

const initialKanbanRows: KanbanRow[] = [
  {
    id: "KB-001",
    productName: "Bracket Assembly",
    productCode: "FG-001",
    kanbanQty: 50,
    minStock: 100,
    maxStock: 500,
    status: "Active",
  },
];

const initialProcessRows: ProcessRow[] = [
  {
    id: "PROC-001",
    processCode: "PRESS-01",
    processName: "Pressing Process",
    category: "Metal Forming",
    sequence: 1,
    status: "Active",
  },
  {
    id: "PROC-002",
    processCode: "WELD-01",
    processName: "Welding Process",
    category: "Joining",
    sequence: 2,
    status: "Active",
  },
];

const initialMachinePatternRows: MachinePatternRow[] = [
  {
    id: "MP-001",
    patternName: "Standard Production",
    machineCount: 10,
    operatingHours: 8,
    status: "Active",
  },
];

const initialGlobalWorkingDaysRows: GlobalWorkingDaysRow[] = [
  {
    id: "GWD-001",
    period: "January 2024",
    workingDays: 22,
    createdDate: "12/15/2023",
  },
  {
    id: "GWD-002",
    period: "February 2024",
    workingDays: 22,
    createdDate: "12/15/2023",
  },
];

type ParameterFormValues = {
  name: string;
  empId: string;
  department: string;
  role: string;
  team: string;
  permissions: string;
  status: StatusType;
};

type SafetyStockFormValues = {
  inventoryType: string;
  parameter: string;
  constanta: number;
  status: StatusType;
};

type TypeParameterFormValues = {
  typeCode: string;
  typeName: string;
  description: string;
  status: StatusType;
};

type UomFormValues = {
  code: string;
  name: string;
  category: UomCategory;
  status: StatusType;
};

type PurchaseOrderFormValues = {
  materialType: string;
  minOrderQty: number;
  maxSplitLines: number;
  splitRule: string;
  status: StatusType;
};

type ApprovalWorkflowFormValues = {
  menuAction: string;
  level1Role: string;
  level2Role: string;
  level3Role: string;
  level4Role: string;
  status: StatusType;
};

type KanbanFormValues = {
  productName: string;
  productCode: string;
  kanbanQty: number;
  minStock: number;
  maxStock: number;
  status: StatusType;
};

type GlobalWorkingDaysFormValues = {
  period: string;
  workingDays: number;
};

type ProcessFormValues = {
  processCode: string;
  processName: string;
  category: string;
  sequence: number;
  status: StatusType;
};

type MachinePatternFormValues = {
  patternName: string;
  machineCount: number;
  operatingHours: number;
  status: StatusType;
};

export default function SystemSettingsPage() {
  const router = useRouter();
  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    "access-control-matrix"
  );
  const selectedModule = useMemo(
    () => modules.find((m) => m.id === selectedModuleId) ?? modules[0],
    [selectedModuleId]
  );

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All Types" | StatusType>(
    "All Types"
  );

  const [rows, setRows] = useState<ParameterRow[]>(initialRows);
  const [roleRows, setRoleRows] = useState<RoleRow[]>(initialRoleRows);
  const [safetyRows, setSafetyRows] = useState<SafetyStockRow[]>(initialSafetyStockRows);
  const [stockdaysRows, setStockdaysRows] = useState<StockdaysRow[]>(initialStockdaysRows);
  const [typeParameterRows, setTypeParameterRows] = useState<TypeParameterRow[]>(
    initialTypeParameterRows
  );
  const [uomRows, setUomRows] = useState<UomRow[]>(initialUomRows);
  const [purchaseOrderRows, setPurchaseOrderRows] = useState<PurchaseOrderRow[]>(
    initialPurchaseOrderRows
  );
  const [approvalWorkflowRows, setApprovalWorkflowRows] = useState<ApprovalWorkflowRow[]>(
    initialApprovalWorkflowRows
  );
  const [kanbanRows, setKanbanRows] = useState<KanbanRow[]>(initialKanbanRows);
  const [globalWorkingDaysRows, setGlobalWorkingDaysRows] = useState<GlobalWorkingDaysRow[]>(
    initialGlobalWorkingDaysRows
  );
  const [processRows, setProcessRows] = useState<ProcessRow[]>(initialProcessRows);
  const [machinePatternRows, setMachinePatternRows] = useState<MachinePatternRow[]>(
    initialMachinePatternRows
  );

  const [machineTab, setMachineTab] = useState<"pattern" | "fast-slow">("pattern");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<ParameterRow | null>(null);

  const [safetyDetailOpen, setSafetyDetailOpen] = useState(false);
  const [safetyDetailRow, setSafetyDetailRow] = useState<SafetyStockRow | null>(null);

  const [typeParameterDetailOpen, setTypeParameterDetailOpen] = useState(false);
  const [typeParameterDetailRow, setTypeParameterDetailRow] = useState<TypeParameterRow | null>(
    null
  );

  const [uomDetailOpen, setUomDetailOpen] = useState(false);
  const [uomDetailRow, setUomDetailRow] = useState<UomRow | null>(null);

  const [purchaseOrderDetailOpen, setPurchaseOrderDetailOpen] = useState(false);
  const [purchaseOrderDetailRow, setPurchaseOrderDetailRow] = useState<PurchaseOrderRow | null>(
    null
  );

  const [approvalWorkflowDetailOpen, setApprovalWorkflowDetailOpen] = useState(false);
  const [approvalWorkflowDetailRow, setApprovalWorkflowDetailRow] = useState<ApprovalWorkflowRow | null>(
    null
  );

  const [kanbanDetailOpen, setKanbanDetailOpen] = useState(false);
  const [kanbanDetailRow, setKanbanDetailRow] = useState<KanbanRow | null>(null);

  const [globalWorkingDaysDetailOpen, setGlobalWorkingDaysDetailOpen] = useState(false);
  const [globalWorkingDaysDetailRow, setGlobalWorkingDaysDetailRow] =
    useState<GlobalWorkingDaysRow | null>(null);

  const [processDetailOpen, setProcessDetailOpen] = useState(false);
  const [processDetailRow, setProcessDetailRow] = useState<ProcessRow | null>(null);

  const [machinePatternDetailOpen, setMachinePatternDetailOpen] = useState(false);
  const [machinePatternDetailRow, setMachinePatternDetailRow] =
    useState<MachinePatternRow | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ParameterRow | null>(null);
  const [editMode, setEditMode] = useState<"create" | "edit">("edit");
  const [form] = Form.useForm<ParameterFormValues>();

  const [safetyEditOpen, setSafetyEditOpen] = useState(false);
  const [safetyEditingRow, setSafetyEditingRow] = useState<SafetyStockRow | null>(null);
  const [safetyEditMode, setSafetyEditMode] = useState<"create" | "edit">("edit");
  const [safetyForm] = Form.useForm<SafetyStockFormValues>();

  const [typeParameterEditOpen, setTypeParameterEditOpen] = useState(false);
  const [typeParameterEditingRow, setTypeParameterEditingRow] = useState<TypeParameterRow | null>(
    null
  );
  const [typeParameterEditMode, setTypeParameterEditMode] = useState<"create" | "edit">(
    "edit"
  );
  const [typeParameterForm] = Form.useForm<TypeParameterFormValues>();

  const [uomEditOpen, setUomEditOpen] = useState(false);
  const [uomEditingRow, setUomEditingRow] = useState<UomRow | null>(null);
  const [uomEditMode, setUomEditMode] = useState<"create" | "edit">("edit");
  const [uomForm] = Form.useForm<UomFormValues>();

  const [purchaseOrderEditOpen, setPurchaseOrderEditOpen] = useState(false);
  const [purchaseOrderEditingRow, setPurchaseOrderEditingRow] = useState<PurchaseOrderRow | null>(
    null
  );
  const [purchaseOrderEditMode, setPurchaseOrderEditMode] = useState<"create" | "edit">(
    "edit"
  );
  const [purchaseOrderForm] = Form.useForm<PurchaseOrderFormValues>();

  const [approvalWorkflowEditOpen, setApprovalWorkflowEditOpen] = useState(false);
  const [approvalWorkflowEditingRow, setApprovalWorkflowEditingRow] = useState<ApprovalWorkflowRow | null>(
    null
  );
  const [approvalWorkflowEditMode, setApprovalWorkflowEditMode] = useState<"create" | "edit">(
    "edit"
  );
  const [approvalWorkflowForm] = Form.useForm<ApprovalWorkflowFormValues>();

  const [kanbanEditOpen, setKanbanEditOpen] = useState(false);
  const [kanbanEditingRow, setKanbanEditingRow] = useState<KanbanRow | null>(null);
  const [kanbanEditMode, setKanbanEditMode] = useState<"create" | "edit">("edit");
  const [kanbanForm] = Form.useForm<KanbanFormValues>();

  const [globalWorkingDaysEditOpen, setGlobalWorkingDaysEditOpen] = useState(false);
  const [globalWorkingDaysEditingRow, setGlobalWorkingDaysEditingRow] =
    useState<GlobalWorkingDaysRow | null>(null);
  const [globalWorkingDaysEditMode, setGlobalWorkingDaysEditMode] = useState<"create" | "edit">(
    "edit"
  );
  const [globalWorkingDaysForm] = Form.useForm<GlobalWorkingDaysFormValues>();

  const [processEditOpen, setProcessEditOpen] = useState(false);
  const [processEditingRow, setProcessEditingRow] = useState<ProcessRow | null>(null);
  const [processEditMode, setProcessEditMode] = useState<"create" | "edit">("edit");
  const [processForm] = Form.useForm<ProcessFormValues>();

  const [machinePatternEditOpen, setMachinePatternEditOpen] = useState(false);
  const [machinePatternEditingRow, setMachinePatternEditingRow] =
    useState<MachinePatternRow | null>(null);
  const [machinePatternEditMode, setMachinePatternEditMode] = useState<"create" | "edit">(
    "edit"
  );
  const [machinePatternForm] = Form.useForm<MachinePatternFormValues>();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<ParameterRow | null>(null);

  const [roleDeleteOpen, setRoleDeleteOpen] = useState(false);
  const [roleDeletingRow, setRoleDeletingRow] = useState<RoleRow | null>(null);

  const [safetyDeleteOpen, setSafetyDeleteOpen] = useState(false);
  const [safetyDeletingRow, setSafetyDeletingRow] = useState<SafetyStockRow | null>(null);

  const [typeParameterDeleteOpen, setTypeParameterDeleteOpen] = useState(false);
  const [typeParameterDeletingRow, setTypeParameterDeletingRow] = useState<TypeParameterRow | null>(
    null
  );

  const [uomDeleteOpen, setUomDeleteOpen] = useState(false);
  const [uomDeletingRow, setUomDeletingRow] = useState<UomRow | null>(null);

  const [purchaseOrderDeleteOpen, setPurchaseOrderDeleteOpen] = useState(false);
  const [purchaseOrderDeletingRow, setPurchaseOrderDeletingRow] = useState<PurchaseOrderRow | null>(
    null
  );

  const [approvalWorkflowDeleteOpen, setApprovalWorkflowDeleteOpen] = useState(false);
  const [approvalWorkflowDeletingRow, setApprovalWorkflowDeletingRow] = useState<ApprovalWorkflowRow | null>(
    null
  );

  const [kanbanDeleteOpen, setKanbanDeleteOpen] = useState(false);
  const [kanbanDeletingRow, setKanbanDeletingRow] = useState<KanbanRow | null>(null);

  const [globalWorkingDaysDeleteOpen, setGlobalWorkingDaysDeleteOpen] = useState(false);
  const [globalWorkingDaysDeletingRow, setGlobalWorkingDaysDeletingRow] =
    useState<GlobalWorkingDaysRow | null>(null);

  const [processDeleteOpen, setProcessDeleteOpen] = useState(false);
  const [processDeletingRow, setProcessDeletingRow] = useState<ProcessRow | null>(null);

  const [machinePatternDeleteOpen, setMachinePatternDeleteOpen] = useState(false);
  const [machinePatternDeletingRow, setMachinePatternDeletingRow] =
    useState<MachinePatternRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.name, r.empId, r.department, r.role]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, rows, typeFilter]);

  const filteredRoles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roleRows;
    return roleRows.filter((r) => r.roleName.toLowerCase().includes(q));
  }, [query, roleRows]);

  const filteredSafety = useMemo(() => {
    const q = query.trim().toLowerCase();
    return safetyRows
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.inventoryType, r.parameter]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, safetyRows, typeFilter]);

  const filteredStockdays = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stockdaysRows
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.inventoryType, r.parameter]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, stockdaysRows, typeFilter]);

  const filteredTypeParameters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return typeParameterRows
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.typeCode, r.typeName, r.description]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, typeParameterRows, typeFilter]);

  const filteredUom = useMemo(() => {
    const q = query.trim().toLowerCase();
    return uomRows
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.code, r.name, r.category].join(" ").toLowerCase().includes(q);
      });
  }, [query, uomRows, typeFilter]);

  const filteredPurchaseOrder = useMemo(() => {
    const q = query.trim().toLowerCase();
    return purchaseOrderRows
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.materialType, r.splitRule]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, purchaseOrderRows, typeFilter]);

  const filteredApprovalWorkflow = useMemo(() => {
    const q = query.trim().toLowerCase();
    return approvalWorkflowRows
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [
          r.menuAction,
          r.level1Role,
          r.level2Role,
          r.level3Role,
          r.level4Role,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, approvalWorkflowRows, typeFilter]);

  const filteredKanban = useMemo(() => {
    const q = query.trim().toLowerCase();
    return kanbanRows
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.productName, r.productCode]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, kanbanRows, typeFilter]);

  const filteredGlobalWorkingDays = useMemo(() => {
    const q = query.trim().toLowerCase();
    return globalWorkingDaysRows.filter((r) => {
      if (!q) return true;
      return r.period.toLowerCase().includes(q);
    });
  }, [query, globalWorkingDaysRows]);

  const filteredProcess = useMemo(() => {
    const q = query.trim().toLowerCase();
    return processRows
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.processCode, r.processName, r.category]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, processRows, typeFilter]);

  const filteredMachinePattern = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machinePatternRows
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return r.patternName.toLowerCase().includes(q);
      });
  }, [query, machinePatternRows, typeFilter]);

  const openCreate = () => {
    setEditMode("create");
    setEditingRow(null);
    form.setFieldsValue({
      status: "Active",
    });
    setEditOpen(true);
  };

  const openCreateSafety = () => {
    setSafetyEditMode("create");
    setSafetyEditingRow(null);
    safetyForm.resetFields();
    safetyForm.setFieldsValue({
      parameter: "PRL/Working days * days",
      constanta: 7,
      status: "Active",
    });
    setSafetyEditOpen(true);
  };

  const openCreateRole = () => {
    router.push("/system-settings/roles/create");
  };

  const openEdit = (row: ParameterRow) => {
    setEditMode("edit");
    setEditingRow(row);
    form.setFieldsValue({
      name: row.name,
      empId: row.empId,
      department: row.department,
      role: row.role,
      team: row.team,
      permissions: row.permissions.join(", "),
      status: row.status,
    });
    setEditOpen(true);
  };

  const openEditRole = (row: RoleRow) => {
    router.push(
      `/system-settings/roles/create?mode=edit&id=${encodeURIComponent(
        row.id
      )}&name=${encodeURIComponent(row.roleName)}`
    );
  };

  const openEditSafety = (row: SafetyStockRow) => {
    setSafetyEditMode("edit");
    setSafetyEditingRow(row);
    safetyForm.setFieldsValue({
      inventoryType: row.inventoryType,
      parameter: row.parameter,
      constanta: row.constanta,
      status: row.status,
    });
    setSafetyEditOpen(true);
  };

  const openEditTypeParameter = (row: TypeParameterRow) => {
    setTypeParameterEditMode("edit");
    setTypeParameterEditingRow(row);
    typeParameterForm.setFieldsValue({
      typeCode: row.typeCode,
      typeName: row.typeName,
      description: row.description,
      status: row.status,
    });
    setTypeParameterEditOpen(true);
  };

  const openCreateUom = () => {
    setUomEditMode("create");
    setUomEditingRow(null);
    uomForm.resetFields();
    uomForm.setFieldsValue({
      status: "Active",
    });
    setUomEditOpen(true);
  };

  const openEditUom = (row: UomRow) => {
    setUomEditMode("edit");
    setUomEditingRow(row);
    uomForm.setFieldsValue({
      code: row.code,
      name: row.name,
      category: row.category,
      status: row.status,
    });
    setUomEditOpen(true);
  };

  const openCreatePurchaseOrder = () => {
    setPurchaseOrderEditMode("create");
    setPurchaseOrderEditingRow(null);
    purchaseOrderForm.resetFields();
    purchaseOrderForm.setFieldsValue({
      materialType: "Raw Material",
      minOrderQty: 1000,
      maxSplitLines: 3,
      splitRule: "By Supplier Capacity",
      status: "Active",
    });
    setPurchaseOrderEditOpen(true);
  };

  const openEditPurchaseOrder = (row: PurchaseOrderRow) => {
    setPurchaseOrderEditMode("edit");
    setPurchaseOrderEditingRow(row);
    purchaseOrderForm.setFieldsValue({
      materialType: row.materialType,
      minOrderQty: row.minOrderQty,
      maxSplitLines: row.maxSplitLines,
      splitRule: row.splitRule,
      status: row.status,
    });
    setPurchaseOrderEditOpen(true);
  };

  const openCreateApprovalWorkflow = () => {
    setApprovalWorkflowEditMode("create");
    setApprovalWorkflowEditingRow(null);
    approvalWorkflowForm.resetFields();
    approvalWorkflowForm.setFieldsValue({
      status: "Active",
      level4Role: "-",
    });
    setApprovalWorkflowEditOpen(true);
  };

  const openEditApprovalWorkflow = (row: ApprovalWorkflowRow) => {
    setApprovalWorkflowEditMode("edit");
    setApprovalWorkflowEditingRow(row);
    approvalWorkflowForm.setFieldsValue({
      menuAction: row.menuAction,
      level1Role: row.level1Role,
      level2Role: row.level2Role,
      level3Role: row.level3Role,
      level4Role: row.level4Role,
      status: row.status,
    });
    setApprovalWorkflowEditOpen(true);
  };

  const openCreateKanban = () => {
    setKanbanEditMode("create");
    setKanbanEditingRow(null);
    kanbanForm.resetFields();
    kanbanForm.setFieldsValue({
      status: "Active",
      kanbanQty: 50,
      minStock: 100,
      maxStock: 500,
    });
    setKanbanEditOpen(true);
  };

  const openCreateGlobalWorkingDays = () => {
    setGlobalWorkingDaysEditMode("create");
    setGlobalWorkingDaysEditingRow(null);
    globalWorkingDaysForm.resetFields();
    globalWorkingDaysForm.setFieldsValue({
      workingDays: 22,
    });
    setGlobalWorkingDaysEditOpen(true);
  };

  const openCreateProcess = () => {
    setProcessEditMode("create");
    setProcessEditingRow(null);
    processForm.resetFields();
    processForm.setFieldsValue({ status: "Active" });
    setProcessEditOpen(true);
  };

  const openCreateMachinePattern = () => {
    setMachinePatternEditMode("create");
    setMachinePatternEditingRow(null);
    machinePatternForm.resetFields();
    machinePatternForm.setFieldsValue({
      status: "Active",
      machineCount: 10,
      operatingHours: 8,
    });
    setMachinePatternEditOpen(true);
  };

  const openEditKanban = (row: KanbanRow) => {
    setKanbanEditMode("edit");
    setKanbanEditingRow(row);
    kanbanForm.setFieldsValue({
      productName: row.productName,
      productCode: row.productCode,
      kanbanQty: row.kanbanQty,
      minStock: row.minStock,
      maxStock: row.maxStock,
      status: row.status,
    });
    setKanbanEditOpen(true);
  };

  const openEditGlobalWorkingDays = (row: GlobalWorkingDaysRow) => {
    setGlobalWorkingDaysEditMode("edit");
    setGlobalWorkingDaysEditingRow(row);
    globalWorkingDaysForm.setFieldsValue({
      period: row.period,
      workingDays: row.workingDays,
    });
    setGlobalWorkingDaysEditOpen(true);
  };

  const openEditProcess = (row: ProcessRow) => {
    setProcessEditMode("edit");
    setProcessEditingRow(row);
    processForm.setFieldsValue({
      processCode: row.processCode,
      processName: row.processName,
      category: row.category,
      sequence: row.sequence,
      status: row.status,
    });
    setProcessEditOpen(true);
  };

  const openEditMachinePattern = (row: MachinePatternRow) => {
    setMachinePatternEditMode("edit");
    setMachinePatternEditingRow(row);
    machinePatternForm.setFieldsValue({
      patternName: row.patternName,
      machineCount: row.machineCount,
      operatingHours: row.operatingHours,
      status: row.status,
    });
    setMachinePatternEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditingRow(null);
    form.resetFields();
  };

  const closeSafetyEdit = () => {
    setSafetyEditOpen(false);
    setSafetyEditingRow(null);
    safetyForm.resetFields();
  };

  const closeTypeParameterEdit = () => {
    setTypeParameterEditOpen(false);
    setTypeParameterEditingRow(null);
    typeParameterForm.resetFields();
  };

  const closeUomEdit = () => {
    setUomEditOpen(false);
    setUomEditingRow(null);
    uomForm.resetFields();
  };

  const closePurchaseOrderEdit = () => {
    setPurchaseOrderEditOpen(false);
    setPurchaseOrderEditingRow(null);
    purchaseOrderForm.resetFields();
  };

  const closeApprovalWorkflowEdit = () => {
    setApprovalWorkflowEditOpen(false);
    setApprovalWorkflowEditingRow(null);
    approvalWorkflowForm.resetFields();
  };

  const closeKanbanEdit = () => {
    setKanbanEditOpen(false);
    setKanbanEditingRow(null);
    kanbanForm.resetFields();
  };

  const closeGlobalWorkingDaysEdit = () => {
    setGlobalWorkingDaysEditOpen(false);
    setGlobalWorkingDaysEditingRow(null);
    globalWorkingDaysForm.resetFields();
  };

  const closeProcessEdit = () => {
    setProcessEditOpen(false);
    setProcessEditingRow(null);
    processForm.resetFields();
  };

  const closeMachinePatternEdit = () => {
    setMachinePatternEditOpen(false);
    setMachinePatternEditingRow(null);
    machinePatternForm.resetFields();
  };

  const saveEdit = async () => {
    const values = await form.validateFields();

    const next: ParameterRow = {
      id: values.empId,
      name: values.name,
      empId: values.empId,
      department: values.department,
      role: values.role,
      team: values.team,
      permissions: String(values.permissions || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      lastLogin: editMode === "create" ? "-" : (editingRow?.lastLogin ?? "-"),
      status: values.status,
    };

    if (editMode === "create") {
      setRows((prev) => [next, ...prev]);
    } else {
      setRows((prev) => prev.map((r) => (r.id === editingRow?.id ? next : r)));
    }

    closeEdit();
  };

  const saveSafetyEdit = async () => {
    const values = await safetyForm.validateFields();

    const next: SafetyStockRow = {
      id:
        safetyEditMode === "create"
          ? `SSP-${String(safetyRows.length + 1).padStart(3, "0")}`
          : (safetyEditingRow?.id ?? `SSP-${String(safetyRows.length + 1).padStart(3, "0")}`),
      inventoryType: values.inventoryType,
      parameter: values.parameter,
      constanta: Number(values.constanta ?? 0),
      status: values.status,
    };

    if (safetyEditMode === "create") {
      setSafetyRows((prev) => [next, ...prev]);
    } else {
      setSafetyRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    }

    closeSafetyEdit();
  };

  const saveTypeParameterEdit = async () => {
    const values = await typeParameterForm.validateFields();

    const next: TypeParameterRow = {
      id:
        typeParameterEditMode === "create"
          ? `TP-${String(typeParameterRows.length + 1).padStart(3, "0")}`
          : (typeParameterEditingRow?.id ??
              `TP-${String(typeParameterRows.length + 1).padStart(3, "0")}`),
      typeCode: values.typeCode,
      typeName: values.typeName,
      description: values.description,
      status: values.status,
    };

    if (typeParameterEditMode === "create") {
      setTypeParameterRows((prev) => [next, ...prev]);
    } else {
      setTypeParameterRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    }

    closeTypeParameterEdit();
  };

  const saveUomEdit = async () => {
    const values = await uomForm.validateFields();

    const next: UomRow = {
      id:
        uomEditMode === "create"
          ? `UOM-${String(values.code || "NEW").toUpperCase()}`
          : (uomEditingRow?.id ?? `UOM-${String(values.code || "NEW").toUpperCase()}`),
      code: String(values.code || "").toUpperCase(),
      name: values.name,
      category: values.category,
      status: values.status,
    };

    if (uomEditMode === "create") {
      setUomRows((prev) => [next, ...prev]);
    } else {
      setUomRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    }

    closeUomEdit();
  };

  const savePurchaseOrderEdit = async () => {
    const values = await purchaseOrderForm.validateFields();

    const next: PurchaseOrderRow = {
      id:
        purchaseOrderEditMode === "create"
          ? `PO-${String(purchaseOrderRows.length + 1).padStart(3, "0")}`
          : (purchaseOrderEditingRow?.id ??
              `PO-${String(purchaseOrderRows.length + 1).padStart(3, "0")}`),
      materialType: values.materialType,
      minOrderQty: Number(values.minOrderQty ?? 0),
      maxSplitLines: Number(values.maxSplitLines ?? 0),
      splitRule: values.splitRule,
      status: values.status,
    };

    if (purchaseOrderEditMode === "create") {
      setPurchaseOrderRows((prev) => [next, ...prev]);
    } else {
      setPurchaseOrderRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    }

    closePurchaseOrderEdit();
  };

  const saveApprovalWorkflowEdit = async () => {
    const values = await approvalWorkflowForm.validateFields();

    const next: ApprovalWorkflowRow = {
      id:
        approvalWorkflowEditMode === "create"
          ? `AW-${String(approvalWorkflowRows.length + 1).padStart(3, "0")}`
          : (approvalWorkflowEditingRow?.id ??
              `AW-${String(approvalWorkflowRows.length + 1).padStart(3, "0")}`),
      menuAction: values.menuAction,
      level1Role: values.level1Role,
      level2Role: values.level2Role,
      level3Role: values.level3Role,
      level4Role: values.level4Role,
      status: values.status,
    };

    if (approvalWorkflowEditMode === "create") {
      setApprovalWorkflowRows((prev) => [next, ...prev]);
    } else {
      setApprovalWorkflowRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    }

    closeApprovalWorkflowEdit();
  };

  const saveKanbanEdit = async () => {
    const values = await kanbanForm.validateFields();

    const next: KanbanRow = {
      id:
        kanbanEditMode === "create"
          ? `KB-${String(kanbanRows.length + 1).padStart(3, "0")}`
          : (kanbanEditingRow?.id ?? `KB-${String(kanbanRows.length + 1).padStart(3, "0")}`),
      productName: values.productName,
      productCode: values.productCode,
      kanbanQty: Number(values.kanbanQty ?? 0),
      minStock: Number(values.minStock ?? 0),
      maxStock: Number(values.maxStock ?? 0),
      status: values.status,
    };

    if (kanbanEditMode === "create") {
      setKanbanRows((prev) => [next, ...prev]);
    } else {
      setKanbanRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    }

    closeKanbanEdit();
  };

  const saveGlobalWorkingDaysEdit = async () => {
    const values = await globalWorkingDaysForm.validateFields();

    const createdDate = new Date().toLocaleDateString("en-US");

    const next: GlobalWorkingDaysRow = {
      id:
        globalWorkingDaysEditMode === "create"
          ? `GWD-${String(globalWorkingDaysRows.length + 1).padStart(3, "0")}`
          : (globalWorkingDaysEditingRow?.id ??
              `GWD-${String(globalWorkingDaysRows.length + 1).padStart(3, "0")}`),
      period: values.period,
      workingDays: Number(values.workingDays ?? 0),
      createdDate:
        globalWorkingDaysEditMode === "create"
          ? createdDate
          : (globalWorkingDaysEditingRow?.createdDate ?? createdDate),
    };

    if (globalWorkingDaysEditMode === "create") {
      setGlobalWorkingDaysRows((prev) => [next, ...prev]);
    } else {
      setGlobalWorkingDaysRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    }

    closeGlobalWorkingDaysEdit();
  };

  const saveProcessEdit = async () => {
    const values = await processForm.validateFields();

    const next: ProcessRow = {
      id:
        processEditMode === "create"
          ? `PROC-${String(processRows.length + 1).padStart(3, "0")}`
          : (processEditingRow?.id ?? `PROC-${String(processRows.length + 1).padStart(3, "0")}`),
      processCode: values.processCode,
      processName: values.processName,
      category: values.category,
      sequence: Number(values.sequence ?? 0),
      status: values.status,
    };

    if (processEditMode === "create") {
      setProcessRows((prev) => [next, ...prev]);
    } else {
      setProcessRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    }

    closeProcessEdit();
  };

  const saveMachinePatternEdit = async () => {
    const values = await machinePatternForm.validateFields();

    const next: MachinePatternRow = {
      id:
        machinePatternEditMode === "create"
          ? `MP-${String(machinePatternRows.length + 1).padStart(3, "0")}`
          : (machinePatternEditingRow?.id ??
              `MP-${String(machinePatternRows.length + 1).padStart(3, "0")}`),
      patternName: values.patternName,
      machineCount: Number(values.machineCount ?? 0),
      operatingHours: Number(values.operatingHours ?? 0),
      status: values.status,
    };

    if (machinePatternEditMode === "create") {
      setMachinePatternRows((prev) => [next, ...prev]);
    } else {
      setMachinePatternRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
    }

    closeMachinePatternEdit();
  };

  const openDetail = (row: ParameterRow) => {
    setDetailRow(row);
    setDetailOpen(true);
  };

  const openSafetyDetail = (row: SafetyStockRow) => {
    setSafetyDetailRow(row);
    setSafetyDetailOpen(true);
  };

  const openTypeParameterDetail = (row: TypeParameterRow) => {
    setTypeParameterDetailRow(row);
    setTypeParameterDetailOpen(true);
  };

  const openUomDetail = (row: UomRow) => {
    setUomDetailRow(row);
    setUomDetailOpen(true);
  };

  const openPurchaseOrderDetail = (row: PurchaseOrderRow) => {
    setPurchaseOrderDetailRow(row);
    setPurchaseOrderDetailOpen(true);
  };

  const openApprovalWorkflowDetail = (row: ApprovalWorkflowRow) => {
    setApprovalWorkflowDetailRow(row);
    setApprovalWorkflowDetailOpen(true);
  };

  const openKanbanDetail = (row: KanbanRow) => {
    setKanbanDetailRow(row);
    setKanbanDetailOpen(true);
  };

  const openGlobalWorkingDaysDetail = (row: GlobalWorkingDaysRow) => {
    setGlobalWorkingDaysDetailRow(row);
    setGlobalWorkingDaysDetailOpen(true);
  };

  const openProcessDetail = (row: ProcessRow) => {
    setProcessDetailRow(row);
    setProcessDetailOpen(true);
  };

  const openMachinePatternDetail = (row: MachinePatternRow) => {
    setMachinePatternDetailRow(row);
    setMachinePatternDetailOpen(true);
  };

  const openRoleDetail = (row: RoleRow) => {
    router.push(
      `/system-settings/roles/create?mode=detail&id=${encodeURIComponent(
        row.id
      )}&name=${encodeURIComponent(row.roleName)}`
    );
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailRow(null);
  };

  const closeSafetyDetail = () => {
    setSafetyDetailOpen(false);
    setSafetyDetailRow(null);
  };

  const closeTypeParameterDetail = () => {
    setTypeParameterDetailOpen(false);
    setTypeParameterDetailRow(null);
  };

  const closeUomDetail = () => {
    setUomDetailOpen(false);
    setUomDetailRow(null);
  };

  const closePurchaseOrderDetail = () => {
    setPurchaseOrderDetailOpen(false);
    setPurchaseOrderDetailRow(null);
  };

  const closeApprovalWorkflowDetail = () => {
    setApprovalWorkflowDetailOpen(false);
    setApprovalWorkflowDetailRow(null);
  };

  const closeKanbanDetail = () => {
    setKanbanDetailOpen(false);
    setKanbanDetailRow(null);
  };

  const closeGlobalWorkingDaysDetail = () => {
    setGlobalWorkingDaysDetailOpen(false);
    setGlobalWorkingDaysDetailRow(null);
  };

  const closeProcessDetail = () => {
    setProcessDetailOpen(false);
    setProcessDetailRow(null);
  };

  const closeMachinePatternDetail = () => {
    setMachinePatternDetailOpen(false);
    setMachinePatternDetailRow(null);
  };


  const openDelete = (row: ParameterRow) => {
    setDeletingRow(row);
    setDeleteOpen(true);
  };

  const openSafetyDelete = (row: SafetyStockRow) => {
    setSafetyDeletingRow(row);
    setSafetyDeleteOpen(true);
  };

  const openTypeParameterDelete = (row: TypeParameterRow) => {
    setTypeParameterDeletingRow(row);
    setTypeParameterDeleteOpen(true);
  };

  const openUomDelete = (row: UomRow) => {
    setUomDeletingRow(row);
    setUomDeleteOpen(true);
  };

  const openPurchaseOrderDelete = (row: PurchaseOrderRow) => {
    setPurchaseOrderDeletingRow(row);
    setPurchaseOrderDeleteOpen(true);
  };

  const openApprovalWorkflowDelete = (row: ApprovalWorkflowRow) => {
    setApprovalWorkflowDeletingRow(row);
    setApprovalWorkflowDeleteOpen(true);
  };

  const openKanbanDelete = (row: KanbanRow) => {
    setKanbanDeletingRow(row);
    setKanbanDeleteOpen(true);
  };

  const openGlobalWorkingDaysDelete = (row: GlobalWorkingDaysRow) => {
    setGlobalWorkingDaysDeletingRow(row);
    setGlobalWorkingDaysDeleteOpen(true);
  };

  const openProcessDelete = (row: ProcessRow) => {
    setProcessDeletingRow(row);
    setProcessDeleteOpen(true);
  };

  const openMachinePatternDelete = (row: MachinePatternRow) => {
    setMachinePatternDeletingRow(row);
    setMachinePatternDeleteOpen(true);
  };

  const openRoleDelete = (row: RoleRow) => {
    setRoleDeletingRow(row);
    setRoleDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeletingRow(null);
  };

  const closeRoleDelete = () => {
    setRoleDeleteOpen(false);
    setRoleDeletingRow(null);
  };

  const closeSafetyDelete = () => {
    setSafetyDeleteOpen(false);
    setSafetyDeletingRow(null);
  };

  const closeTypeParameterDelete = () => {
    setTypeParameterDeleteOpen(false);
    setTypeParameterDeletingRow(null);
  };

  const closeUomDelete = () => {
    setUomDeleteOpen(false);
    setUomDeletingRow(null);
  };

  const closePurchaseOrderDelete = () => {
    setPurchaseOrderDeleteOpen(false);
    setPurchaseOrderDeletingRow(null);
  };

  const closeApprovalWorkflowDelete = () => {
    setApprovalWorkflowDeleteOpen(false);
    setApprovalWorkflowDeletingRow(null);
  };

  const closeKanbanDelete = () => {
    setKanbanDeleteOpen(false);
    setKanbanDeletingRow(null);
  };

  const closeGlobalWorkingDaysDelete = () => {
    setGlobalWorkingDaysDeleteOpen(false);
    setGlobalWorkingDaysDeletingRow(null);
  };

  const closeProcessDelete = () => {
    setProcessDeleteOpen(false);
    setProcessDeletingRow(null);
  };

  const closeMachinePatternDelete = () => {
    setMachinePatternDeleteOpen(false);
    setMachinePatternDeletingRow(null);
  };

  const confirmDelete = () => {
    if (!deletingRow) return;
    setRows((prev) => prev.filter((r) => r.id !== deletingRow.id));
    closeDelete();
  };

  const confirmRoleDelete = () => {
    if (!roleDeletingRow) return;
    setRoleRows((prev) => prev.filter((r) => r.id !== roleDeletingRow.id));
    closeRoleDelete();
  };

  const confirmSafetyDelete = () => {
    if (!safetyDeletingRow) return;
    setSafetyRows((prev) => prev.filter((r) => r.id !== safetyDeletingRow.id));
    closeSafetyDelete();
  };

  const confirmTypeParameterDelete = () => {
    if (!typeParameterDeletingRow) return;
    setTypeParameterRows((prev) =>
      prev.filter((r) => r.id !== typeParameterDeletingRow.id)
    );
    closeTypeParameterDelete();
  };

  const confirmUomDelete = () => {
    if (!uomDeletingRow) return;
    setUomRows((prev) => prev.filter((r) => r.id !== uomDeletingRow.id));
    closeUomDelete();
  };

  const confirmPurchaseOrderDelete = () => {
    if (!purchaseOrderDeletingRow) return;
    setPurchaseOrderRows((prev) => prev.filter((r) => r.id !== purchaseOrderDeletingRow.id));
    closePurchaseOrderDelete();
  };

  const confirmApprovalWorkflowDelete = () => {
    if (!approvalWorkflowDeletingRow) return;
    setApprovalWorkflowRows((prev) => prev.filter((r) => r.id !== approvalWorkflowDeletingRow.id));
    closeApprovalWorkflowDelete();
  };

  const confirmKanbanDelete = () => {
    if (!kanbanDeletingRow) return;
    setKanbanRows((prev) => prev.filter((r) => r.id !== kanbanDeletingRow.id));
    closeKanbanDelete();
  };

  const confirmGlobalWorkingDaysDelete = () => {
    if (!globalWorkingDaysDeletingRow) return;
    setGlobalWorkingDaysRows((prev) => prev.filter((r) => r.id !== globalWorkingDaysDeletingRow.id));
    closeGlobalWorkingDaysDelete();
  };

  const confirmProcessDelete = () => {
    if (!processDeletingRow) return;
    setProcessRows((prev) => prev.filter((r) => r.id !== processDeletingRow.id));
    closeProcessDelete();
  };

  const confirmMachinePatternDelete = () => {
    if (!machinePatternDeletingRow) return;
    setMachinePatternRows((prev) => prev.filter((r) => r.id !== machinePatternDeletingRow.id));
    closeMachinePatternDelete();
  };

  const columns: ColumnsType<ParameterRow> = [
    {
      title: "User Info",
      key: "userInfo",
      width: 180,
      render: (_: unknown, r: ParameterRow) => (
        <div>
          <div className="font-medium text-gray-900">{r.name}</div>
          <div className="text-xs text-gray-500">{r.empId}</div>
        </div>
      ),
    },
    {
      title: "Department & Role",
      key: "deptRole",
      width: 210,
      render: (_: unknown, r: ParameterRow) => (
        <div>
          <div className="font-medium text-gray-900">{r.department}</div>
          <div className="text-xs text-gray-500">{r.role}</div>
          <Tag className="mt-1">{r.team}</Tag>
        </div>
      ),
    },
    {
      title: "Permissions",
      key: "permissions",
      width: 260,
      render: (_: unknown, r: ParameterRow) => {
        const first = r.permissions.slice(0, 2);
        const restCount = Math.max(0, r.permissions.length - first.length);
        return (
          <div className="flex flex-wrap gap-2">
            {first.map((p) => (
              <Tag key={p} className="bg-gray-50">
                {p}
              </Tag>
            ))}
            {restCount > 0 && <Tag className="bg-gray-50">+{restCount} more</Tag>}
          </div>
        );
      },
    },
    {
      title: "Last Login",
      dataIndex: "lastLogin",
      key: "lastLogin",
      width: 110,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (v: StatusType) =>
        v === "Active" ? (
          <Tag className="bg-blue-50 text-blue-700 border-blue-100">Active</Tag>
        ) : (
          <Tag className="bg-red-50 text-red-700 border-red-100">Inactive</Tag>
        ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: ParameterRow) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => openDetail(r)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => openDelete(r)} />
        </div>
      ),
    },
  ];

  const roleColumns: ColumnsType<RoleRow> = [
    {
      title: "Role Name",
      dataIndex: "roleName",
      key: "roleName",
      width: 260,
    },
    {
      title: "Number of People",
      dataIndex: "numberOfPeople",
      key: "numberOfPeople",
      width: 160,
      render: (v: number) => v.toLocaleString("en-US"),
    },
    {
      title: "Last Updated",
      dataIndex: "lastUpdated",
      key: "lastUpdated",
      width: 140,
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: RoleRow) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => openRoleDetail(r)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditRole(r)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => openRoleDelete(r)} />
        </div>
      ),
    },
  ];

  const safetyColumns: ColumnsType<SafetyStockRow> = [
    {
      title: "Inventory Type",
      dataIndex: "inventoryType",
      key: "inventoryType",
      width: 210,
      render: (v: string) => <div className="font-medium text-gray-900">{v}</div>,
    },
    {
      title: "Parameter",
      dataIndex: "parameter",
      key: "parameter",
      width: 320,
      render: (v: string) => <div className="text-gray-700">{v}</div>,
    },
    {
      title: "Constanta",
      dataIndex: "constanta",
      key: "constanta",
      width: 120,
      render: (v: number) => (
        <span className="inline-flex items-center justify-center min-w-7 px-2 py-0.5 text-xs border border-gray-200 rounded-md bg-white text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: StatusType) => {
        const cls =
          s === "Active"
            ? "bg-blue-50 text-blue-700 border-blue-100"
            : "bg-red-50 text-red-700 border-red-100";
        return (
          <Tag className={`rounded-full px-3 py-0.5 border ${cls}`}>{s}</Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: SafetyStockRow) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => openSafetyDetail(r)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditSafety(r)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => openSafetyDelete(r)} />
        </div>
      ),
    },
  ];

  const stockdaysColumns: ColumnsType<StockdaysRow> = [
    {
      title: "Inventory Type",
      dataIndex: "inventoryType",
      key: "inventoryType",
      width: 210,
      render: (v: string) => <div className="font-medium text-gray-900">{v}</div>,
    },
    {
      title: "Parameter",
      dataIndex: "parameter",
      key: "parameter",
      width: 320,
      render: (v: string) => (
        <div>
          <div className="text-gray-700">{v}</div>
          <div className="text-xs text-gray-400">Parameter: 7</div>
        </div>
      ),
    },
    {
      title: "Constanta",
      dataIndex: "constanta",
      key: "constanta",
      width: 120,
      render: (v: number) => (
        <span className="inline-flex items-center justify-center min-w-7 px-2 py-0.5 text-xs border border-gray-200 rounded-md bg-white text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: StatusType) => {
        const cls =
          s === "Active"
            ? "bg-blue-50 text-blue-700 border-blue-100"
            : "bg-red-50 text-red-700 border-red-100";
        return (
          <Tag className={`rounded-full px-3 py-0.5 border ${cls}`}>{s}</Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: () => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} />
          <Button type="text" icon={<EditOutlined />} />
          <Button type="text" danger icon={<DeleteOutlined />} />
        </div>
      ),
    },
  ];

  const typeParameterColumns: ColumnsType<TypeParameterRow> = [
    {
      title: "Type Code",
      dataIndex: "typeCode",
      key: "typeCode",
      width: 120,
      render: (v: string) => <div className="font-medium text-gray-900">{v}</div>,
    },
    {
      title: "Type Name",
      dataIndex: "typeName",
      key: "typeName",
      width: 220,
      render: (v: string) => <div className="text-gray-900">{v}</div>,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      width: 240,
      render: (v: string) => <div className="text-gray-700">{v}</div>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: StatusType) => {
        const cls =
          s === "Active"
            ? "bg-blue-50 text-blue-700 border-blue-100"
            : "bg-red-50 text-red-700 border-red-100";
        return (
          <Tag className={`rounded-full px-3 py-0.5 border ${cls}`}>{s}</Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: TypeParameterRow) => (
        <div className="flex items-center gap-1">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openTypeParameterDetail(r)}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditTypeParameter(r)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => openTypeParameterDelete(r)}
          />
        </div>
      ),
    },
  ];

  const uomColumns: ColumnsType<UomRow> = [
    {
      title: "Code",
      dataIndex: "code",
      key: "code",
      width: 90,
      render: (v: string) => <div className="font-medium text-gray-900">{v}</div>,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 180,
      render: (v: string) => <div className="text-gray-900">{v}</div>,
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 140,
      render: (v: UomCategory) => (
        <Tag className="rounded-md bg-white border border-gray-200 text-gray-700">
          {v}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: StatusType) => {
        const cls =
          s === "Active"
            ? "bg-blue-50 text-blue-700 border-blue-100"
            : "bg-red-50 text-red-700 border-red-100";
        return (
          <Tag className={`rounded-full px-3 py-0.5 border ${cls}`}>{s}</Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: UomRow) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => openUomDetail(r)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditUom(r)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => openUomDelete(r)} />
        </div>
      ),
    },
  ];

  const purchaseOrderColumns: ColumnsType<PurchaseOrderRow> = [
    {
      title: "Material Type",
      dataIndex: "materialType",
      key: "materialType",
      width: 160,
      render: (v: string) => <div className="font-medium text-gray-900">{v}</div>,
    },
    {
      title: "Min Order Qty",
      dataIndex: "minOrderQty",
      key: "minOrderQty",
      width: 140,
      render: (v: number) => <div className="text-gray-900">{v.toLocaleString("en-US")}</div>,
    },
    {
      title: "Max Split Lines",
      dataIndex: "maxSplitLines",
      key: "maxSplitLines",
      width: 140,
      render: (v: number) => (
        <span className="inline-flex items-center justify-center min-w-7 px-2 py-0.5 text-xs border border-gray-200 rounded-md bg-white text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "Split Rule",
      dataIndex: "splitRule",
      key: "splitRule",
      width: 200,
      render: (v: string) => <div className="text-gray-700">{v}</div>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: StatusType) => (
        <Tag className="bg-blue-50 text-blue-700 border-blue-100">{s}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: PurchaseOrderRow) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => openPurchaseOrderDetail(r)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditPurchaseOrder(r)} />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => openPurchaseOrderDelete(r)}
          />
        </div>
      ),
    },
  ];

  const approvalWorkflowColumns: ColumnsType<ApprovalWorkflowRow> = [
    {
      title: "Menu/Action",
      dataIndex: "menuAction",
      key: "menuAction",
      width: 200,
      render: (v: string) => <div className="font-medium text-gray-900">{v}</div>,
    },
    {
      title: "Level 1 Role",
      dataIndex: "level1Role",
      key: "level1Role",
      width: 180,
      render: (v: string) => <div className="text-gray-900">{v}</div>,
    },
    {
      title: "Level 2 Role",
      dataIndex: "level2Role",
      key: "level2Role",
      width: 160,
      render: (v: string) => <div className="text-gray-900">{v}</div>,
    },
    {
      title: "Level 3 Role",
      dataIndex: "level3Role",
      key: "level3Role",
      width: 140,
      render: (v: string) => <div className="text-gray-900">{v}</div>,
    },
    {
      title: "Level 4 Role",
      dataIndex: "level4Role",
      key: "level4Role",
      width: 120,
      render: (v: string) => <div className="text-gray-900">{v}</div>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: StatusType) => (
        <Tag className="bg-blue-50 text-blue-700 border-blue-100">{s}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: ApprovalWorkflowRow) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => openApprovalWorkflowDetail(r)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditApprovalWorkflow(r)} />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => openApprovalWorkflowDelete(r)}
          />
        </div>
      ),
    },
  ];

  const kanbanColumns: ColumnsType<KanbanRow> = [
    {
      title: "Product Info",
      key: "productInfo",
      width: 200,
      render: (_: unknown, r: KanbanRow) => (
        <div>
          <div className="font-medium text-gray-900">{r.productName}</div>
          <div className="text-xs text-gray-500">{r.productCode}</div>
        </div>
      ),
    },
    {
      title: "Kanban Qty",
      dataIndex: "kanbanQty",
      key: "kanbanQty",
      width: 120,
      render: (v: number) => (
        <span className="inline-flex items-center justify-center min-w-16 px-2 py-0.5 text-xs border border-gray-200 rounded-md bg-white text-gray-700">
          {v} units
        </span>
      ),
    },
    {
      title: "Min Stock",
      dataIndex: "minStock",
      key: "minStock",
      width: 120,
      render: (v: number) => <span className="text-red-500">{v} units</span>,
    },
    {
      title: "Max Stock",
      dataIndex: "maxStock",
      key: "maxStock",
      width: 120,
      render: (v: number) => <span className="text-blue-600">{v} units</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: StatusType) => (
        <Tag className="bg-blue-50 text-blue-700 border-blue-100">{s}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: KanbanRow) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => openKanbanDetail(r)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditKanban(r)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => openKanbanDelete(r)} />
        </div>
      ),
    },
  ];

  const globalWorkingDaysColumns: ColumnsType<GlobalWorkingDaysRow> = [
    {
      title: "Period",
      dataIndex: "period",
      key: "period",
      width: 220,
    },
    {
      title: "Working Days",
      dataIndex: "workingDays",
      key: "workingDays",
      width: 160,
      render: (v: number) => <span className="text-blue-600">{v} days</span>,
    },
    {
      title: "Created Date",
      dataIndex: "createdDate",
      key: "createdDate",
      width: 180,
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: GlobalWorkingDaysRow) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => openGlobalWorkingDaysDetail(r)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditGlobalWorkingDays(r)} />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => openGlobalWorkingDaysDelete(r)}
          />
        </div>
      ),
    },
  ];

  const processColumns: ColumnsType<ProcessRow> = [
    {
      title: "Process Code",
      dataIndex: "processCode",
      key: "processCode",
      width: 140,
    },
    {
      title: "Process Name",
      dataIndex: "processName",
      key: "processName",
      width: 200,
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 160,
    },
    {
      title: "Sequence",
      dataIndex: "sequence",
      key: "sequence",
      width: 120,
      render: (v: number) => (
        <span className="inline-flex items-center justify-center min-w-7 px-2 py-0.5 text-xs border border-gray-200 rounded-md bg-white text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: StatusType) => (
        <Tag className="bg-blue-50 text-blue-700 border-blue-100">{s}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: ProcessRow) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => openProcessDetail(r)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditProcess(r)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => openProcessDelete(r)} />
        </div>
      ),
    },
  ];

  const machinePatternColumns: ColumnsType<MachinePatternRow> = [
    {
      title: "Pattern Name",
      dataIndex: "patternName",
      key: "patternName",
      width: 220,
      render: (v: string) => <span className="font-medium text-gray-900">{v}</span>,
    },
    {
      title: "Machine Count",
      dataIndex: "machineCount",
      key: "machineCount",
      width: 160,
      render: (v: number) => (
        <span className="inline-flex items-center justify-center min-w-20 px-2 py-0.5 text-xs border border-gray-200 rounded-md bg-white text-gray-700">
          {v} machines
        </span>
      ),
    },
    {
      title: "Operating Hours",
      dataIndex: "operatingHours",
      key: "operatingHours",
      width: 160,
      render: (v: number) => <span className="text-gray-700">{v} hours</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: StatusType) => (
        <Tag className="bg-blue-50 text-blue-700 border-blue-100">{s}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, r: MachinePatternRow) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => openMachinePatternDetail(r)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditMachinePattern(r)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => openMachinePatternDelete(r)} />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Modal
        title="Delete parameter?"
        open={deleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmDelete}
        onCancel={closeDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{deletingRow?.empId}</span>.
        </div>
      </Modal>

      <Modal
        title="Delete role?"
        open={roleDeleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmRoleDelete}
        onCancel={closeRoleDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{roleDeletingRow?.roleName}</span>.
        </div>
      </Modal>

      <Modal
        title="Delete safety stock parameter?"
        open={safetyDeleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmSafetyDelete}
        onCancel={closeSafetyDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{safetyDeletingRow?.inventoryType}</span>.
        </div>
      </Modal>

      <Modal
        title="Delete type parameter?"
        open={typeParameterDeleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmTypeParameterDelete}
        onCancel={closeTypeParameterDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{typeParameterDeletingRow?.typeCode}</span>.
        </div>
      </Modal>

      <Modal
        title="Delete UoM parameter?"
        open={uomDeleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmUomDelete}
        onCancel={closeUomDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{uomDeletingRow?.code}</span>.
        </div>
      </Modal>

      <Modal
        title="Delete PO split setting?"
        open={purchaseOrderDeleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmPurchaseOrderDelete}
        onCancel={closePurchaseOrderDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{purchaseOrderDeletingRow?.materialType}</span>.
        </div>
      </Modal>

      <Modal
        title="Delete approval workflow?"
        open={approvalWorkflowDeleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmApprovalWorkflowDelete}
        onCancel={closeApprovalWorkflowDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{approvalWorkflowDeletingRow?.menuAction}</span>.
        </div>
      </Modal>

      <Modal
        title="Delete kanban standard?"
        open={kanbanDeleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmKanbanDelete}
        onCancel={closeKanbanDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{kanbanDeletingRow?.productName}</span>.
        </div>
      </Modal>

      <Modal
        title="Delete working days?"
        open={globalWorkingDaysDeleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmGlobalWorkingDaysDelete}
        onCancel={closeGlobalWorkingDaysDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{globalWorkingDaysDeletingRow?.period}</span>.
        </div>
      </Modal>

      <Modal
        title="Delete process?"
        open={processDeleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmProcessDelete}
        onCancel={closeProcessDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{processDeletingRow?.processName}</span>.
        </div>
      </Modal>

      <Modal
        title="Delete machine pattern?"
        open={machinePatternDeleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmMachinePatternDelete}
        onCancel={closeMachinePatternDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{machinePatternDeletingRow?.patternName}</span>.
        </div>
      </Modal>

      <Modal
        title="Parameter Details"
        open={detailOpen}
        footer={null}
        onCancel={closeDetail}
        width={520}
        destroyOnClose
      >
        {detailRow && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">User</div>
              <div className="font-medium text-gray-900">{detailRow.name}</div>
              <div className="text-xs text-gray-500">{detailRow.empId}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Department</div>
                <div className="font-medium text-gray-900">{detailRow.department}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Role</div>
                <div className="font-medium text-gray-900">{detailRow.role}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Permissions</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {detailRow.permissions.map((p) => (
                  <Tag key={p} className="bg-gray-50">
                    {p}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Safety Stock Parameter Details"
        open={safetyDetailOpen}
        footer={null}
        onCancel={closeSafetyDetail}
        width={520}
        destroyOnClose
      >
        {safetyDetailRow && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Inventory Type</div>
              <div className="font-medium text-gray-900">{safetyDetailRow.inventoryType}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Parameter</div>
              <div className="font-medium text-gray-900">{safetyDetailRow.parameter}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Constanta</div>
                <div className="font-medium text-gray-900">{safetyDetailRow.constanta}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="font-medium text-gray-900">{safetyDetailRow.status}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Type Parameter Details"
        open={typeParameterDetailOpen}
        footer={null}
        onCancel={closeTypeParameterDetail}
        width={520}
        destroyOnClose
      >
        {typeParameterDetailRow && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Type Code</div>
              <div className="font-medium text-gray-900">{typeParameterDetailRow.typeCode}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Type Name</div>
              <div className="font-medium text-gray-900">{typeParameterDetailRow.typeName}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Description</div>
              <div className="font-medium text-gray-900">{typeParameterDetailRow.description}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="font-medium text-gray-900">{typeParameterDetailRow.status}</div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="UoM Parameter Details"
        open={uomDetailOpen}
        footer={null}
        onCancel={closeUomDetail}
        width={520}
        destroyOnClose
      >
        {uomDetailRow && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Code</div>
              <div className="font-medium text-gray-900">{uomDetailRow.code}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Name</div>
              <div className="font-medium text-gray-900">{uomDetailRow.name}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Category</div>
              <div className="font-medium text-gray-900">{uomDetailRow.category}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="font-medium text-gray-900">{uomDetailRow.status}</div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="PO - Split Setting Details"
        open={purchaseOrderDetailOpen}
        footer={null}
        onCancel={closePurchaseOrderDetail}
        width={520}
        destroyOnClose
      >
        {purchaseOrderDetailRow && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Material Type</div>
              <div className="font-medium text-gray-900">{purchaseOrderDetailRow.materialType}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Min Order Qty</div>
                <div className="font-medium text-gray-900">
                  {purchaseOrderDetailRow.minOrderQty.toLocaleString("en-US")}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Max Split Lines</div>
                <div className="font-medium text-gray-900">{purchaseOrderDetailRow.maxSplitLines}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Split Rule</div>
              <div className="font-medium text-gray-900">{purchaseOrderDetailRow.splitRule}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="font-medium text-gray-900">{purchaseOrderDetailRow.status}</div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Approval Workflow Details"
        open={approvalWorkflowDetailOpen}
        footer={null}
        onCancel={closeApprovalWorkflowDetail}
        width={560}
        destroyOnClose
      >
        {approvalWorkflowDetailRow && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Menu/Action</div>
              <div className="font-medium text-gray-900">{approvalWorkflowDetailRow.menuAction}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Level 1 Role</div>
                <div className="font-medium text-gray-900">{approvalWorkflowDetailRow.level1Role}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Level 2 Role</div>
                <div className="font-medium text-gray-900">{approvalWorkflowDetailRow.level2Role}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Level 3 Role</div>
                <div className="font-medium text-gray-900">{approvalWorkflowDetailRow.level3Role}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Level 4 Role</div>
                <div className="font-medium text-gray-900">{approvalWorkflowDetailRow.level4Role}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="font-medium text-gray-900">{approvalWorkflowDetailRow.status}</div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Kanban Standard Details"
        open={kanbanDetailOpen}
        footer={null}
        onCancel={closeKanbanDetail}
        width={560}
        destroyOnClose
      >
        {kanbanDetailRow && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Product</div>
              <div className="font-medium text-gray-900">{kanbanDetailRow.productName}</div>
              <div className="text-xs text-gray-500">{kanbanDetailRow.productCode}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Kanban Qty</div>
                <div className="font-medium text-gray-900">{kanbanDetailRow.kanbanQty} units</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="font-medium text-gray-900">{kanbanDetailRow.status}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Min Stock</div>
                <div className="font-medium text-gray-900">{kanbanDetailRow.minStock} units</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Max Stock</div>
                <div className="font-medium text-gray-900">{kanbanDetailRow.maxStock} units</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Working Days Details"
        open={globalWorkingDaysDetailOpen}
        footer={null}
        onCancel={closeGlobalWorkingDaysDetail}
        width={560}
        destroyOnClose
      >
        {globalWorkingDaysDetailRow && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Period</div>
              <div className="font-medium text-gray-900">{globalWorkingDaysDetailRow.period}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Working Days</div>
                <div className="font-medium text-gray-900">{globalWorkingDaysDetailRow.workingDays} days</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Created Date</div>
                <div className="font-medium text-gray-900">{globalWorkingDaysDetailRow.createdDate}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Process Details"
        open={processDetailOpen}
        footer={null}
        onCancel={closeProcessDetail}
        width={560}
        destroyOnClose
      >
        {processDetailRow && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Process Code</div>
                <div className="font-medium text-gray-900">{processDetailRow.processCode}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Sequence</div>
                <div className="font-medium text-gray-900">{processDetailRow.sequence}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Process Name</div>
                <div className="font-medium text-gray-900">{processDetailRow.processName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Category</div>
                <div className="font-medium text-gray-900">{processDetailRow.category}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="font-medium text-gray-900">{processDetailRow.status}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Machine Pattern Details"
        open={machinePatternDetailOpen}
        footer={null}
        onCancel={closeMachinePatternDetail}
        width={560}
        destroyOnClose
      >
        {machinePatternDetailRow && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Pattern Name</div>
              <div className="font-medium text-gray-900">{machinePatternDetailRow.patternName}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Machine Count</div>
                <div className="font-medium text-gray-900">{machinePatternDetailRow.machineCount} machines</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Operating Hours</div>
                <div className="font-medium text-gray-900">{machinePatternDetailRow.operatingHours} hours</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="font-medium text-gray-900">{machinePatternDetailRow.status}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>


      <Drawer
        title={editMode === "create" ? "Add Parameter" : "Edit"}
        placement="right"
        open={editOpen}
        onClose={closeEdit}
        width={420}
        destroyOnClose
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeEdit}>Cancel</Button>
            <Button type="primary" onClick={saveEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="Full name" />
          </Form.Item>

          <Form.Item label="EMP ID" name="empId" rules={[{ required: true }]}>
            <Input placeholder="EMP-001" />
          </Form.Item>

          <Form.Item label="Department" name="department" rules={[{ required: true }]}>
            <Input placeholder="Department" />
          </Form.Item>

          <Form.Item label="Role" name="role" rules={[{ required: true }]}>
            <Input placeholder="Role" />
          </Form.Item>

          <Form.Item label="Team" name="team" rules={[{ required: true }]}>
            <Input placeholder="Team" />
          </Form.Item>

          <Form.Item
            label="Permissions"
            name="permissions"
            rules={[{ required: true, message: "Enter at least one permission" }]}
          >
            <Input placeholder="Comma separated (e.g., Inventory, Stock Opname)" />
          </Form.Item>

          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={safetyEditMode === "create" ? "Add Parameter" : "Edit"}
        placement="right"
        open={safetyEditOpen}
        onClose={closeSafetyEdit}
        width={420}
        destroyOnClose
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeSafetyEdit}>Cancel</Button>
            <Button type="primary" onClick={saveSafetyEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={safetyForm} layout="vertical">
          <Form.Item
            label="Inventory Type"
            name="inventoryType"
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Select inventory type"
              options={[
                { label: "Raw Material", value: "Raw Material" },
                { label: "Indirect Raw Material", value: "Indirect Raw Material" },
                { label: "SubCon", value: "SubCon" },
                { label: "Finished Goods", value: "Finished Goods" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Parameter" name="parameter" rules={[{ required: true }]}>
            <Input placeholder="PRL/Working days * days" />
          </Form.Item>

          <Form.Item
            label="Constanta"
            name="constanta"
            rules={[{ required: true }]}
          >
            <InputNumber className="w-full" min={0} placeholder="7" />
          </Form.Item>

          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={typeParameterEditMode === "create" ? "Add Parameter" : "Edit"}
        placement="right"
        open={typeParameterEditOpen}
        onClose={closeTypeParameterEdit}
        width={420}
        destroyOnClose
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeTypeParameterEdit}>Cancel</Button>
            <Button type="primary" onClick={saveTypeParameterEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={typeParameterForm} layout="vertical">
          <Form.Item label="Type Code" name="typeCode" rules={[{ required: true }]}>
            <Input placeholder="WIP-A" />
          </Form.Item>

          <Form.Item label="Type Name" name="typeName" rules={[{ required: true }]}>
            <Input placeholder="Semi-Finished Product A" />
          </Form.Item>

          <Form.Item label="Description" name="description" rules={[{ required: true }]}>
            <Input placeholder="After pressing process" />
          </Form.Item>

          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={uomEditMode === "create" ? "Add Parameter" : "Edit"}
        placement="right"
        open={uomEditOpen}
        onClose={closeUomEdit}
        width={420}
        destroyOnClose
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeUomEdit}>Cancel</Button>
            <Button type="primary" onClick={saveUomEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={uomForm} layout="vertical">
          <Form.Item label="Code" name="code" rules={[{ required: true }]}>
            <Input placeholder="PCS" />
          </Form.Item>

          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="Pieces" />
          </Form.Item>

          <Form.Item label="Category" name="category" rules={[{ required: true }]}>
            <Select
              placeholder="Select category"
              options={[
                { label: "Quantity", value: "Quantity" },
                { label: "Weight", value: "Weight" },
                { label: "Length", value: "Length" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              placeholder="Select Status"
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={purchaseOrderEditMode === "create" ? "Add Parameter" : "Edit"}
        placement="right"
        open={purchaseOrderEditOpen}
        onClose={closePurchaseOrderEdit}
        width={460}
        destroyOnClose
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closePurchaseOrderEdit}>Cancel</Button>
            <Button type="primary" onClick={savePurchaseOrderEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={purchaseOrderForm} layout="vertical">
          <Form.Item label="Material Type" name="materialType" rules={[{ required: true }]}>
            <Select
              placeholder="Select Material Type"
              options={[
                { label: "Raw Material", value: "Raw Material" },
                { label: "Indirect Raw Material", value: "Indirect Raw Material" },
                { label: "Finished Goods", value: "Finished Goods" },
                { label: "Work In Process", value: "Work In Process" },
                { label: "SubCon", value: "SubCon" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Min Order Qty" name="minOrderQty" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={0} placeholder="1000" />
          </Form.Item>

          <Form.Item label="Max Split Lines" name="maxSplitLines" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={1} placeholder="3" />
          </Form.Item>

          <Form.Item label="Split Rule" name="splitRule" rules={[{ required: true }]}>
            <Select
              placeholder="Select Split Rule"
              options={[
                { label: "By Supplier Capacity", value: "By Supplier Capacity" },
                { label: "Equal Split", value: "Equal Split" },
                { label: "Manual", value: "Manual" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              placeholder="Select Status"
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={approvalWorkflowEditMode === "create" ? "Add Parameter" : "Edit"}
        placement="right"
        open={approvalWorkflowEditOpen}
        onClose={closeApprovalWorkflowEdit}
        width={520}
        destroyOnClose
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeApprovalWorkflowEdit}>Cancel</Button>
            <Button type="primary" onClick={saveApprovalWorkflowEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={approvalWorkflowForm} layout="vertical">
          <Form.Item label="Menu/Action" name="menuAction" rules={[{ required: true }]}>
            <Input placeholder="Approve Work Order" />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item label="Level 1 Role" name="level1Role" rules={[{ required: true }]}>
              <Input placeholder="Production Supervisor" />
            </Form.Item>

            <Form.Item label="Level 2 Role" name="level2Role" rules={[{ required: true }]}>
              <Input placeholder="Production Manager" />
            </Form.Item>

            <Form.Item label="Level 3 Role" name="level3Role" rules={[{ required: true }]}>
              <Input placeholder="Director" />
            </Form.Item>

            <Form.Item label="Level 4 Role" name="level4Role" rules={[{ required: true }]}>
              <Input placeholder="CEO" />
            </Form.Item>
          </div>

          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              placeholder="Select Status"
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={kanbanEditMode === "create" ? "Add Parameter" : "Edit"}
        placement="right"
        open={kanbanEditOpen}
        onClose={closeKanbanEdit}
        width={520}
        destroyOnClose
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeKanbanEdit}>Cancel</Button>
            <Button type="primary" onClick={saveKanbanEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={kanbanForm} layout="vertical">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item label="Product Name" name="productName" rules={[{ required: true }]}>
              <Input placeholder="Bracket Assembly" />
            </Form.Item>
            <Form.Item label="Product Code" name="productCode" rules={[{ required: true }]}>
              <Input placeholder="FG-001" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Form.Item label="Kanban Qty" name="kanbanQty" rules={[{ required: true }]}>
              <InputNumber className="w-full" min={0} placeholder="50" />
            </Form.Item>
            <Form.Item label="Min Stock" name="minStock" rules={[{ required: true }]}>
              <InputNumber className="w-full" min={0} placeholder="100" />
            </Form.Item>
            <Form.Item label="Max Stock" name="maxStock" rules={[{ required: true }]}>
              <InputNumber className="w-full" min={0} placeholder="500" />
            </Form.Item>
          </div>

          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              placeholder="Select Status"
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={globalWorkingDaysEditMode === "create" ? "Add Parameter" : "Edit"}
        placement="right"
        open={globalWorkingDaysEditOpen}
        onClose={closeGlobalWorkingDaysEdit}
        width={520}
        destroyOnClose
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeGlobalWorkingDaysEdit}>Cancel</Button>
            <Button type="primary" onClick={saveGlobalWorkingDaysEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={globalWorkingDaysForm} layout="vertical">
          <Form.Item label="Period" name="period" rules={[{ required: true }]}>
            <Input placeholder="January 2024" />
          </Form.Item>
          <Form.Item label="Working Days" name="workingDays" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={0} placeholder="22" />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={processEditMode === "create" ? "Add Parameter" : "Edit"}
        placement="right"
        open={processEditOpen}
        onClose={closeProcessEdit}
        width={520}
        destroyOnClose
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeProcessEdit}>Cancel</Button>
            <Button type="primary" onClick={saveProcessEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={processForm} layout="vertical">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item label="Process Code" name="processCode" rules={[{ required: true }]}>
              <Input placeholder="PRESS-01" />
            </Form.Item>
            <Form.Item label="Sequence" name="sequence" rules={[{ required: true }]}>
              <InputNumber className="w-full" min={1} placeholder="1" />
            </Form.Item>
          </div>

          <Form.Item label="Process Name" name="processName" rules={[{ required: true }]}>
            <Input placeholder="Pressing Process" />
          </Form.Item>

          <Form.Item label="Category" name="category" rules={[{ required: true }]}>
            <Input placeholder="Metal Forming" />
          </Form.Item>

          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              placeholder="Select Status"
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={machinePatternEditMode === "create" ? "Add Parameter" : "Edit"}
        placement="right"
        open={machinePatternEditOpen}
        onClose={closeMachinePatternEdit}
        width={520}
        destroyOnClose
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeMachinePatternEdit}>Cancel</Button>
            <Button type="primary" onClick={saveMachinePatternEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form form={machinePatternForm} layout="vertical">
          <Form.Item label="Pattern Name" name="patternName" rules={[{ required: true }]}>
            <Input placeholder="Standard Production" />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item label="Machine Count" name="machineCount" rules={[{ required: true }]}>
              <InputNumber className="w-full" min={0} placeholder="10" />
            </Form.Item>
            <Form.Item label="Operating Hours" name="operatingHours" rules={[{ required: true }]}>
              <InputNumber className="w-full" min={0} placeholder="8" />
            </Form.Item>
          </div>

          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              placeholder="Select Status"
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4 rounded-2xl shadow-sm" styles={{ body: { padding: 0 } }}>
          <div className="p-4 border-b">
            <div className="font-semibold text-gray-900">Configuration Modules</div>
          </div>
          <div className="p-2 max-h-[620px] overflow-y-auto">
            {modules.map((m) => {
              const selected = m.id === selectedModuleId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModuleId(m.id)}
                  className={
                    "relative w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors " +
                    (selected
                      ? "bg-blue-50 border border-blue-100"
                      : "hover:bg-gray-50")
                  }
                >
                  {selected && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-r" />
                  )}
                  <div
                    className={
                      "w-8 h-8 rounded-lg flex items-center justify-center border " +
                      (selected
                        ? "bg-blue-100 text-blue-700 border-blue-100"
                        : `${m.iconBgClass} ${m.iconTextClass} border-transparent`)
                    }
                  >
                    {m.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{m.name}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="lg:col-span-8 space-y-4">
          <Card className="rounded-2xl shadow-sm" styles={{ body: { padding: 0 } }}>
            <div className="bg-blue-50 rounded-t-2xl px-5 py-4 border-b">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-lg font-semibold text-gray-900">System Parameters</div>
                  <div className="text-sm text-gray-500">
                    Comprehensive ERP parameter management and configuration
                  </div>
                </div>
                <Button className="bg-blue-100 text-blue-700 border-blue-100" icon={<InfoCircleOutlined />}>
                  {modules.length} Configuration Modules
                </Button>
              </div>
            </div>

            <div className="px-5 py-4 border-b">
              {selectedModuleId === "machine" && (
                <div className="mb-3">
                  <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setMachineTab("pattern")}
                      className={
                        "px-4 py-2 text-sm rounded-md transition-colors " +
                        (machineTab === "pattern"
                          ? "bg-gray-100 text-gray-900 font-medium"
                          : "text-gray-500 hover:text-gray-900")
                      }
                    >
                      Pattern
                    </button>
                    <button
                      type="button"
                      onClick={() => setMachineTab("fast-slow")}
                      className={
                        "px-4 py-2 text-sm rounded-md transition-colors " +
                        (machineTab === "fast-slow"
                          ? "bg-gray-100 text-gray-900 font-medium"
                          : "text-gray-500 hover:text-gray-900")
                      }
                    >
                      Fast/Slow
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by Uniq or Machine Name..."
                  prefix={<SearchOutlined className="text-gray-400" />}
                  className="flex-1 min-w-[260px]"
                />
                <Select
                  value={typeFilter}
                  onChange={(v) => setTypeFilter(v as "All Types" | StatusType)}
                  style={{ width: 140 }}
                  options={[
                    { label: "All Types", value: "All Types" },
                    { label: "Active", value: "Active" },
                    { label: "Inactive", value: "Inactive" },
                  ]}
                />
                <Button icon={<DownloadOutlined />}>Export</Button>
              </div>
            </div>

            <div className="px-5 py-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-base font-semibold text-gray-900">
                    {selectedModuleId === "purchase-order"
                      ? "PO - Split Settings"
                      : selectedModuleId === "kanban"
                        ? "Kanban - FG Standards"
                        : selectedModuleId === "global"
                          ? "Global - Working Days"
                          : selectedModuleId === "process"
                            ? "Process"
                            : selectedModuleId === "machine"
                              ? machineTab === "fast-slow"
                                ? "Machine - Fast/Slow"
                                : "Machine - Pattern"
                        : selectedModule.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedModuleId === "purchase-order"
                      ? "Configure purchase order split settings"
                      : selectedModuleId === "kanban"
                        ? "Set kanban standards for finished goods"
                        : selectedModuleId === "global"
                          ? "Configure working days per month"
                          : selectedModuleId === "process"
                            ? "Configure Process for Work In Progress"
                            : selectedModuleId === "machine"
                              ? "Define machine pattern configurations"
                      : selectedModule.description}
                  </div>
                </div>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    if (selectedModuleId === "access-control-matrix") {
                      router.push("/system-settings/access-control-matrix/create");
                      return;
                    }
                    if (selectedModuleId === "roles") {
                      openCreateRole();
                      return;
                    }
                    if (selectedModuleId === "safety-stock") {
                      router.push("/system-settings/safety-stock/create");
                      return;
                    }
                    if (selectedModuleId === "stockdays") {
                      router.push("/system-settings/stockdays/create");
                      return;
                    }
                    if (selectedModuleId === "type-parameters") {
                      router.push("/system-settings/type-parameters/create");
                      return;
                    }
                    if (selectedModuleId === "uom-global") {
                      router.push("/system-settings/uom-global/create");
                      return;
                    }
                    if (selectedModuleId === "purchase-order") {
                      router.push("/system-settings/purchase-order/create");
                      return;
                    }
                    if (selectedModuleId === "approval-workflow") {
                      router.push("/system-settings/approval-workflow/create");
                      return;
                    }
                    if (selectedModuleId === "kanban") {
                      router.push("/system-settings/kanban/create");
                      return;
                    }
                    if (selectedModuleId === "global") {
                      router.push("/system-settings/global/create");
                      return;
                    }
                    if (selectedModuleId === "process") {
                      router.push("/system-settings/process/create");
                      return;
                    }
                    if (selectedModuleId === "machine") {
                      if (machineTab === "pattern") {
                        router.push("/system-settings/machine/pattern/create");
                      }
                      return;
                    }
                    openCreate();
                  }}
                >
                  Add Parameter
                </Button>
              </div>

              <div className="mt-4 border rounded-xl overflow-hidden">
                {selectedModuleId === "roles" ? (
                  <Table<RoleRow>
                    columns={roleColumns}
                    dataSource={filteredRoles}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                ) : selectedModuleId === "safety-stock" ? (
                  <Table<SafetyStockRow>
                    columns={safetyColumns}
                    dataSource={filteredSafety}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                ) : selectedModuleId === "stockdays" ? (
                  <Table<StockdaysRow>
                    columns={stockdaysColumns}
                    dataSource={filteredStockdays}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                ) : selectedModuleId === "type-parameters" ? (
                  <Table<TypeParameterRow>
                    columns={typeParameterColumns}
                    dataSource={filteredTypeParameters}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                ) : selectedModuleId === "uom-global" ? (
                  <Table<UomRow>
                    columns={uomColumns}
                    dataSource={filteredUom}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                ) : selectedModuleId === "purchase-order" ? (
                  <Table<PurchaseOrderRow>
                    columns={purchaseOrderColumns}
                    dataSource={filteredPurchaseOrder}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                ) : selectedModuleId === "approval-workflow" ? (
                  <Table<ApprovalWorkflowRow>
                    columns={approvalWorkflowColumns}
                    dataSource={filteredApprovalWorkflow}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                ) : selectedModuleId === "kanban" ? (
                  <Table<KanbanRow>
                    columns={kanbanColumns}
                    dataSource={filteredKanban}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                ) : selectedModuleId === "global" ? (
                  <Table<GlobalWorkingDaysRow>
                    columns={globalWorkingDaysColumns}
                    dataSource={filteredGlobalWorkingDays}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                ) : selectedModuleId === "process" ? (
                  <Table<ProcessRow>
                    columns={processColumns}
                    dataSource={filteredProcess}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                ) : selectedModuleId === "machine" ? (
                  <Table<MachinePatternRow>
                    columns={machinePatternColumns}
                    dataSource={machineTab === "pattern" ? filteredMachinePattern : []}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                ) : (
                  <Table<ParameterRow>
                    columns={columns}
                    dataSource={filtered}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: "max-content" }}
                  />
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
