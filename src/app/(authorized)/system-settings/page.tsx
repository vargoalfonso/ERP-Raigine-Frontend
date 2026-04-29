"use client";

import React, { useMemo, useState, useEffect } from "react";
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
  message,
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

import { getApiErrorMessage } from "@/lib/api/error";
import {
  useCreateAccessControlMatrixMutation,
  useCreateApprovalWorkflowMutation,
  useCreateKanbanStandardMutation,
  useCreateGlobalWorkingDaysMutation,
  useCreatePoSplitMutation,
  useCreateProcessMutation,
  useCreateSafetyStockMutation,
  useCreateStockdaysMutation,
  useCreateTypeParameterMutation,
  useDeleteAccessControlMatrixMutation,
  useDeleteApprovalWorkflowMutation,
  useDeleteGlobalWorkingDaysMutation,
  useDeletePoSplitMutation,
  useDeleteProcessMutation,
  useDeleteSafetyStockMutation,
  useDeleteStockdaysMutation,
  useDeleteTypeParameterMutation,
  useDeleteKanbanStandardMutation,
  useDeleteRoleMutation,
  useDeleteUomMutation,
  useGetAccessControlMatrixQuery,
  useGetApprovalWorkflowByIdQuery,
  useGetApprovalWorkflowsQuery,
  useGetDepartmentsQuery,
  useGetGlobalWorkingDaysByIdQuery,
  useGetGlobalWorkingDaysQuery,
  useGetProcessByIdQuery,
  useGetProcessesQuery,
  useGetSafetyStockByIdQuery,
  useGetSafetyStockQuery,
  useGetStockdaysQuery,
  useGetTypeParametersQuery,
  useGetUomsQuery,
  useGetKanbanStandardsQuery,
  useGetPoSplitSettingByIdQuery,
  useGetPoSplitSettingsQuery,
  useGetRolesQuery,
  useUpdateAccessControlMatrixMutation,
  useUpdateApprovalWorkflowMutation,
  useCreateUomMutation,
  useUpdateGlobalWorkingDaysMutation,
  useUpdatePoSplitMutation,
  useUpdateProcessMutation,
  useUpdateSafetyStockMutation,
  useUpdateStockdaysMutation,
  useUpdateTypeParameterMutation,
  useUpdateUomMutation,
  useUpdateKanbanStandardMutation,
} from "@/lib/api/system-settings/api";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { useListSuppliersQuery } from "@/lib/api/suppliers/api";

type StatusType = "Active" | "Inactive";

type ParameterRow = {
  id: string;
  name: string;
  empId: string;
  department: string;
  departmentId?: string;
  role: string;
  roleId?: string;
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
  itemUniqCode: string;
  parameter: string;
  constanta: number;
  status: StatusType;
  createdAt?: string;
  updatedAt?: string;
};

type StockdaysRow = {
  id: string;
  itemUniqCode: string;
  stockDays: number;
  calculationType?: string;
  status: StatusType;
};

type TypeParameterRow = {
  id: string;
  typeCode: string;
  typeName: string;
  description: string;
  status: StatusType;
};

type UomRow = {
  id: string;
  code: string;
  name: string;
  category?: string;
  status: StatusType;
};

type PurchaseOrderRow = {
  id: string;
  materialType: string;
  po1Pct: number;
  po2Pct: number;
  description?: string;
  minOrderQty: number;
  maxSplitLines: number;
  splitRule: string;
  poSplitSum?: number;
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
  parameterGroup?: string;
  period: string;
  workingDays: number;
  status: StatusType;
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

// const initialSafetyStockRows: SafetyStockRow[] = [
//   {
//     id: "SSP-001",
//     inventoryType: "Raw Material",
//     parameter: "PRL/Working days * days",
//     constanta: 7,
//     status: "Inactive",
//   },
//   {
//     id: "SSP-002",
//     inventoryType: "Indirect Raw Material",
//     parameter: "PRL/Working days * days",
//     constanta: 7,
//     status: "Active",
//   },
//   {
//     id: "SSP-003",
//     inventoryType: "SubCon",
//     parameter: "PRL/Working days * days",
//     constanta: 7,
//     status: "Active",
//   },
//   {
//     id: "SSP-004",
//     inventoryType: "Finished Goods",
//     parameter: "PRL/Working days * days",
//     constanta: 7,
//     status: "Active",
//   },
// ];

const initialStockdaysRows: StockdaysRow[] = [
  {
    id: "SDP-001",
    itemUniqCode: "ITEM001",
    stockDays: 30,
    calculationType: "a",
    status: "Inactive",
  },
  {
    id: "SDP-002",
    itemUniqCode: "ITEM002",
    stockDays: 45,
    calculationType: "b",
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
  { id: "UOM-PCS", code: "PCS", name: "Pieces", category: "Count", status: "Active" },
  { id: "UOM-KG", code: "KG", name: "Kilogram", category: "Weight", status: "Active" },
  { id: "UOM-M", code: "M", name: "Meter", category: "Length", status: "Active" },
];

const initialPurchaseOrderRows: PurchaseOrderRow[] = [
  {
    id: "PO-001",
    materialType: "Raw Material",
    po1Pct: 50,
    po2Pct: 50,
    description: "By Supplier Capacity",
    minOrderQty: 1000,
    maxSplitLines: 3,
    splitRule: "By Supplier Capacity",
    poSplitSum: 100,
    status: "Active",
  },
];

// const initialApprovalWorkflowRows: ApprovalWorkflowRow[] = [
//   {
//     id: "AW-001",
//     menuAction: "Update Budget for PO",
//     level1Role: "Procurement Manager",
//     level2Role: "Finance Manager",
//     level3Role: "Director",
//     level4Role: "CEO",
//     status: "Active",
//   },
//   {
//     id: "AW-002",
//     menuAction: "Approve Work Order",
//     level1Role: "Production Supervisor",
//     level2Role: "Production Manager",
//     level3Role: "Director",
//     level4Role: "-",
//     status: "Active",
//   },
// ];

const initialSafetyStockRows: SafetyStockRow[] = [];

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
    parameterGroup: "working_days",
    period: "January 2024",
    workingDays: 22,
    status: "Active",
    createdDate: "12/15/2023",
  },
  {
    id: "GWD-002",
    parameterGroup: "working_days",
    period: "February 2024",
    workingDays: 22,
    status: "Active",
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
  category?: string;
  status: StatusType;
};

type PurchaseOrderFormValues = {
  materialType: string;
  po1Pct: number;
  po2Pct: number;
  vendor?: string;
  description?: string;
  minOrderQty: number;
  maxSplitLines: number;
  splitRule: string;
  status: StatusType;
};

const PURCHASE_ORDER_DEFAULT_VALUES: PurchaseOrderFormValues = {
  materialType: "raw_material",
  po1Pct: 50,
  po2Pct: 50,
  vendor: undefined,
  description: "",
  minOrderQty: 10,
  maxSplitLines: 2,
  splitRule: "percentage",
  status: "Active",
};

const PURCHASE_ORDER_MATERIAL_OPTIONS = [
  { label: "Raw Material", value: "raw_material" },
  { label: "Indirect", value: "indirect" },
  { label: "Subcon", value: "subcon" },
  // { label: "CAPEX", value: "CAPEX" },
  // { label: "CAPEX1", value: "CAPEX1" },
  // { label: "CAPEX2", value: "CAPEX2" },
  // { label: "CAPEX3", value: "CAPEX3" },
];

const PURCHASE_ORDER_SPLIT_RULE_OPTIONS = [
  { label: "Equal", value: "equal" },
  { label: "Percentage", value: "percentage" },
  { label: "History", value: "history" },
];

const PURCHASE_ORDER_STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
];

const SAFETY_STOCK_PARAMETER_OPTIONS = [
  { label: "Using PRL/working days * days (C)", value: "Using PRL/working days * days (C)" },
  { label: "Using PRL/working days * percentage (C)", value: "Using PRL/working days * percentage (C)" },
  { label: "Demand Forecasting result for each Uniq", value: "Demand Forecasting result for each Uniq" },
  { label: "Using PRL/working days * machine pattern", value: "Using PRL/working days * machine pattern" },
];

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
  parameterGroup?: string;
  period: string;
  workingDays: string | number;
  status: StatusType;
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
  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const CURRENT_YEAR = new Date().getFullYear();

  const PERIOD_OPTIONS = MONTH_NAMES.map((m) => ({ label: `${m} ${CURRENT_YEAR}`, value: `${m} ${CURRENT_YEAR}` }));

  const router = useRouter();

  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    "access-control-matrix"
  );
  const shouldLoadAccessControl = apiEnabled && selectedModuleId === "access-control-matrix";
  const shouldLoadRoles = apiEnabled && (selectedModuleId === "access-control-matrix" || selectedModuleId === "roles" || selectedModuleId === "approval-workflow");
  const shouldLoadDepartments = apiEnabled && selectedModuleId === "access-control-matrix";
  const shouldLoadSafetyStock = apiEnabled && selectedModuleId === "safety-stock";
  const shouldLoadStockdays = apiEnabled && selectedModuleId === "stockdays";
  const shouldLoadTypeParameters = apiEnabled && selectedModuleId === "type-parameters";
  const shouldLoadProcesses = apiEnabled && selectedModuleId === "process";
  const shouldLoadGlobalParameters = apiEnabled && selectedModuleId === "global";
  const shouldLoadSuppliers = apiEnabled && selectedModuleId === "purchase-order";
  const shouldLoadUoms = apiEnabled && selectedModuleId === "uom-global";
  const shouldLoadKanban = apiEnabled && selectedModuleId === "kanban";
  const shouldLoadPoSplit = apiEnabled && selectedModuleId === "purchase-order";
  const shouldLoadApprovalWorkflows = apiEnabled && selectedModuleId === "approval-workflow";
  const shouldLoadBomTree = apiEnabled && (selectedModuleId === "safety-stock" || selectedModuleId === "kanban");

  const toBackendStatus = (s: StatusType): string =>
    s === "Inactive" ? "inactive" : "active";

  const fromBackendStatus = (s: unknown): StatusType => {
    const raw = String(s ?? "active").toLowerCase();
    return raw.includes("inact") ? "Inactive" : "Active";
  };

  const { data: rolesApiData } = useGetRolesQuery(undefined, { skip: !shouldLoadRoles });
  const { data: departmentsApiData } = useGetDepartmentsQuery(undefined, { skip: !shouldLoadDepartments });
  const { data: accessControlApiData } = useGetAccessControlMatrixQuery(undefined, { skip: !shouldLoadAccessControl });
  const [createAccessControl] = useCreateAccessControlMatrixMutation();
  const [updateAccessControl] = useUpdateAccessControlMatrixMutation();
  const [deleteAccessControl] = useDeleteAccessControlMatrixMutation();
  const [deleteRole] = useDeleteRoleMutation();
  const { data: safetyStockApiData } = useGetSafetyStockQuery(undefined, { skip: !shouldLoadSafetyStock });
  const [createSafetyStock] = useCreateSafetyStockMutation();
  const [updateSafetyStock] = useUpdateSafetyStockMutation();
  const [deleteSafetyStock] = useDeleteSafetyStockMutation();
  const { data: stockdaysApiData } = useGetStockdaysQuery(undefined, { skip: !shouldLoadStockdays });
  const [createStockdays] = useCreateStockdaysMutation();
  const [updateStockdays] = useUpdateStockdaysMutation();
  const [deleteStockdays] = useDeleteStockdaysMutation();

  const { data: typeParametersApiData } = useGetTypeParametersQuery(undefined, { skip: !shouldLoadTypeParameters });
  const [createTypeParameter] = useCreateTypeParameterMutation();
  const [updateTypeParameter] = useUpdateTypeParameterMutation();
  const [deleteTypeParameter] = useDeleteTypeParameterMutation();

  const { data: processesApiData } = useGetProcessesQuery(undefined, { skip: !shouldLoadProcesses });
  const [createProcess] = useCreateProcessMutation();
  const [updateProcess] = useUpdateProcessMutation();
  const [deleteProcess] = useDeleteProcessMutation();

  const { data: globalParametersApiData } = useGetGlobalWorkingDaysQuery(undefined, { skip: !shouldLoadGlobalParameters });
  const [createGlobalWorkingDays] = useCreateGlobalWorkingDaysMutation();
  const [updateGlobalWorkingDays] = useUpdateGlobalWorkingDaysMutation();
  const [deleteGlobalWorkingDays] = useDeleteGlobalWorkingDaysMutation();
  const { data: suppliersApiData } = useListSuppliersQuery(undefined, { skip: !shouldLoadSuppliers });

  const { data: uomsApiData } = useGetUomsQuery(undefined, { skip: !shouldLoadUoms });
  const [createUom] = useCreateUomMutation();
  const [updateUom] = useUpdateUomMutation();
  const [deleteUom] = useDeleteUomMutation();

  const { data: kanbanApiData } = useGetKanbanStandardsQuery(undefined, { skip: !shouldLoadKanban });
  const [createKanbanStandard] = useCreateKanbanStandardMutation();
  const [updateKanbanStandard] = useUpdateKanbanStandardMutation();
  const [deleteKanbanStandard] = useDeleteKanbanStandardMutation();
  const { data: poSplitApiData } = useGetPoSplitSettingsQuery(undefined, { skip: !shouldLoadPoSplit });
  const [createPoSplit] = useCreatePoSplitMutation();
  const [updatePoSplit] = useUpdatePoSplitMutation();
  const [deletePoSplit] = useDeletePoSplitMutation();
  const { data: approvalWorkflowApiData } = useGetApprovalWorkflowsQuery(undefined, { skip: !shouldLoadApprovalWorkflows });
  const [createApprovalWorkflow] = useCreateApprovalWorkflowMutation();
  const [updateApprovalWorkflow] = useUpdateApprovalWorkflowMutation();
  const [deleteApprovalWorkflow] = useDeleteApprovalWorkflowMutation();

  const { data: bomTreeApiData } = useGetBomTreeQuery(undefined, { skip: !shouldLoadBomTree });
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
    []
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
  const { data: safetyStockDetailApiData } = useGetSafetyStockByIdQuery(safetyDetailRow?.id ?? "", {
    skip: !apiEnabled || !safetyDetailOpen || !safetyDetailRow?.id,
  });

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
  const { data: poSplitDetailApiData } = useGetPoSplitSettingByIdQuery(purchaseOrderDetailRow?.id ?? "", {
    skip: !apiEnabled || !purchaseOrderDetailOpen || !purchaseOrderDetailRow?.id,
  });

  const [approvalWorkflowDetailOpen, setApprovalWorkflowDetailOpen] = useState(false);
  const [approvalWorkflowDetailRow, setApprovalWorkflowDetailRow] = useState<ApprovalWorkflowRow | null>(
    null
  );
  const { data: approvalWorkflowDetailApiData } = useGetApprovalWorkflowByIdQuery(
    approvalWorkflowDetailRow?.id ?? "",
    { skip: !apiEnabled || !approvalWorkflowDetailOpen || !approvalWorkflowDetailRow?.id }
  );

  const [kanbanDetailOpen, setKanbanDetailOpen] = useState(false);
  const [kanbanDetailRow, setKanbanDetailRow] = useState<KanbanRow | null>(null);

  const [globalWorkingDaysDetailOpen, setGlobalWorkingDaysDetailOpen] = useState(false);
  const [globalWorkingDaysDetailRow, setGlobalWorkingDaysDetailRow] =
    useState<GlobalWorkingDaysRow | null>(null);
  const { data: globalParameterDetailApiData } = useGetGlobalWorkingDaysByIdQuery(
    globalWorkingDaysDetailRow?.id ?? "",
    { skip: !apiEnabled || !globalWorkingDaysDetailOpen || !globalWorkingDaysDetailRow?.id }
  );

  const [processDetailOpen, setProcessDetailOpen] = useState(false);
  const [processDetailRow, setProcessDetailRow] = useState<ProcessRow | null>(null);
  const { data: processDetailApiData } = useGetProcessByIdQuery(processDetailRow?.id ?? "", {
    skip: !apiEnabled || !processDetailOpen || !processDetailRow?.id,
  });

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
  const purchaseOrderSplitRule = Form.useWatch("splitRule", purchaseOrderForm) ?? "percentage";
  const purchaseOrderMaterialType = Form.useWatch("materialType", purchaseOrderForm) ?? "raw_material";
  const purchaseOrderStatus = Form.useWatch("status", purchaseOrderForm) ?? "Active";
  const purchaseOrderVendor = Form.useWatch("vendor", purchaseOrderForm) ?? "";
  const purchaseOrderDescription = Form.useWatch("description", purchaseOrderForm) ?? "";
  const purchaseOrderMinOrderQty = Form.useWatch("minOrderQty", purchaseOrderForm) ?? 0;
  const purchaseOrderMaxSplitLines = Form.useWatch("maxSplitLines", purchaseOrderForm) ?? 0;
  const purchaseOrderPo1Pct = Form.useWatch("po1Pct", purchaseOrderForm) ?? 0;
  const purchaseOrderPo2Pct = Form.useWatch("po2Pct", purchaseOrderForm) ?? 0;
  const purchaseOrderPctTotal = Number(purchaseOrderPo1Pct || 0) + Number(purchaseOrderPo2Pct || 0);
  const purchaseOrderIsHistory = String(purchaseOrderSplitRule).toLowerCase() === "history";
  const purchaseOrderVendorOptions = useMemo(
    () =>
      (suppliersApiData ?? [])
        .map((supplier) => ({
          label: String(supplier.supplier_name ?? supplier.supplier_code ?? ""),
          value: String(supplier.supplier_name ?? supplier.supplier_code ?? ""),
        }))
        .filter((option) => option.value.trim())
        .sort((a, b) => a.label.localeCompare(b.label)),
    [suppliersApiData]
  );

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

  const [stockdaysDeleteOpen, setStockdaysDeleteOpen] = useState(false);
  const [stockdaysDeletingRow, setStockdaysDeletingRow] = useState<StockdaysRow | null>(null);

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

  const departmentNameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const department of departmentsApiData ?? []) {
      const name = String(department.department_name ?? "").trim().toLowerCase();
      if (name) map.set(name, String(department.id));
    }
    return map;
  }, [departmentsApiData]);

  const departmentIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const department of departmentsApiData ?? []) {
      if (department.id != null) {
        map.set(String(department.id), String(department.department_name ?? department.id));
      }
    }
    return map;
  }, [departmentsApiData]);

  const roleNameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const role of rolesApiData ?? []) {
      const name = String(role.name ?? "").trim().toLowerCase();
      if (name) map.set(name, String(role.id));
    }
    return map;
  }, [rolesApiData]);

  const roleIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const role of rolesApiData ?? []) {
      if (role.id != null) {
        map.set(String(role.id), String(role.name ?? role.id));
      }
    }
    return map;
  }, [rolesApiData]);

  const departmentOptions = useMemo(
    () =>
      (departmentsApiData ?? [])
        .map((department) => ({
          label: String(department.department_name ?? department.id),
          value: String(department.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [departmentsApiData]
  );

  const roleOptions = useMemo(
    () =>
      (rolesApiData ?? [])
        .map((role) => ({
          label: String(role.name ?? role.id),
          value: String(role.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [rolesApiData]
  );

  const formatInventoryTypeLabel = (value: string) =>
    value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const normalizeInventoryTypeValue = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "_");

  const rowsView = useMemo<ParameterRow[]>(() => {
    if (!apiEnabled || !accessControlApiData) return rows;
    return accessControlApiData
      .filter((record) => Boolean(record?.id))
      .map((record) => {
        const departmentId =
          record.department_id == null ? undefined : String(record.department_id);
        const roleId = record.role_id == null ? undefined : String(record.role_id);
        return {
          id: String(record.id),
          name: String(record.full_name ?? "-"),
          empId: String(record.employee_id ?? "-"),
          department: record.department
            ? String(record.department)
            : departmentIdToName.get(String(departmentId ?? "")) ?? String(record.department_id ?? "-"),
          departmentId,
          role: roleId ? roleIdToName.get(roleId) ?? roleId : "-",
          roleId,
          team: "-",
          permissions: [],
          lastLogin: "-",
          status: fromBackendStatus(record.status),
        };
      });
  }, [accessControlApiData, apiEnabled, departmentIdToName, roleIdToName, rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rowsView
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.name, r.empId, r.department, r.role]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, rowsView, typeFilter]);

  const roleRowsView = useMemo<RoleRow[]>(() => {
    if (!apiEnabled || !rolesApiData) return roleRows;
    return rolesApiData
      .filter((r) => Boolean(r?.id))
      .map((r) => {
        const d = r.updated_at || r.created_at;
        const lastUpdated = d ? new Date(d).toLocaleDateString("en-US") : "-";
        return {
          id: r.id,
          roleName: r.name,
          numberOfPeople: 0,
          lastUpdated,
        };
      });
  }, [apiEnabled, roleRows, rolesApiData]);

  const kanbanRowsView = useMemo<KanbanRow[]>(() => {
    if (!apiEnabled || !kanbanApiData) return kanbanRows;
    return kanbanApiData
      .filter((k) => Boolean(k?.id))
      .map((k) => {
        const statusRaw = String(k.status ?? "Active").toLowerCase();
        const status: StatusType = statusRaw === "inactive" ? "Inactive" : "Active";
        return {
          id: k.id,
          productName: k.item_name,
          productCode: k.item_uniq_code,
          kanbanQty: Number(k.kanban_qty ?? 0),
          minStock: Number(k.min_stock ?? 0),
          maxStock: Number(k.max_stock ?? 0),
          status,
        };
      });
  }, [apiEnabled, kanbanApiData, kanbanRows]);

  const bomUniqOptions = useMemo(() => {
    const uniqMap = new Map<string, { uniq: string; partName?: string }>();

    const walk = (nodes: any[]) => {
      for (const n of nodes) {
        const uniq = String(n?.uniq_code ?? "").trim();
        if (uniq) {
          uniqMap.set(uniq, { uniq, partName: typeof n?.part_name === "string" ? n.part_name : undefined });
        }
        if (Array.isArray(n?.children) && n.children.length) walk(n.children);
      }
    };

    const nodes = (bomTreeApiData as any)?.data;
    if (Array.isArray(nodes)) walk(nodes);

    return Array.from(uniqMap.values())
      .sort((a, b) => a.uniq.localeCompare(b.uniq))
      .map((x) => ({
        label: x.partName ? `${x.uniq} — ${x.partName}` : x.uniq,
        value: x.uniq,
      }));
  }, [bomTreeApiData]);

  const selectedKanbanUniq = Form.useWatch("productCode", kanbanForm);

  useEffect(() => {
    if (!selectedKanbanUniq) return;
    const opt = bomUniqOptions.find((o) => o.value === selectedKanbanUniq);
    const name = opt && String(opt.label).includes("—") ? String(opt.label).split("—")[1].trim() : String(opt?.label ?? selectedKanbanUniq);
    kanbanForm.setFieldsValue({ productName: name });
  }, [selectedKanbanUniq, bomUniqOptions, kanbanForm]);

  const filteredRoles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roleRowsView;
    return roleRowsView.filter((r) =>
      [r.roleName, String(r.numberOfPeople), r.lastUpdated].join(" ").toLowerCase().includes(q)
    );
  }, [query, roleRowsView]);

  const safetyRowsView = useMemo<SafetyStockRow[]>(() => {
    if (!apiEnabled || !safetyStockApiData) return safetyRows;
    return safetyStockApiData
      .filter((record) => Boolean(record?.id))
      .map((record) => ({
        id: String(record.id),
        inventoryType: formatInventoryTypeLabel(String(record.inventory_type ?? "")),
        itemUniqCode: String(record.item_uniq_code ?? ""),
        parameter: String(record.calculation_type ?? ""),
        constanta: Number(record.constanta ?? 0),
        status: fromBackendStatus(record.status),
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      }));

  }, [apiEnabled, safetyRows, safetyStockApiData]);

  const uomRowsView = useMemo<UomRow[]>(() => {
    if (!apiEnabled || !uomsApiData) return uomRows;
    return uomsApiData
      .filter((u) => Boolean(u?.id))
      .map((u) => {
        const status = fromBackendStatus(u.status);
        return {
          id: String(u.id),
          code: String(u.code ?? u.unit_code ?? "").toUpperCase(),
          name: String(u.name ?? u.unit_name ?? ""),
          category:
            typeof u.category === "string" && u.category.trim()
              ? u.category.trim()
              : undefined,
          status,
        };
      });
  }, [apiEnabled, uomRows, uomsApiData]);

  const processRowsView = useMemo<ProcessRow[]>(() => {
    if (!apiEnabled || !processesApiData) return processRows;
    return processesApiData
      .filter((p) => Boolean(p?.id))
      .map((p) => ({
        id: String(p.id),
        processCode: String(p.process_code ?? ""),
        processName: String(p.process_name ?? ""),
        category: String(p.category ?? ""),
        sequence: Number(p.sequence ?? 0),
        status: fromBackendStatus(p.status),
      }));
  }, [apiEnabled, processRows, processesApiData]);

  const globalWorkingDaysRowsView = useMemo<GlobalWorkingDaysRow[]>(() => {
    if (!apiEnabled || !globalParametersApiData) return globalWorkingDaysRows;
    return globalParametersApiData
      .filter((g) => Boolean(g?.id))
      .map((g) => {
        const d = g.updated_at || g.created_at;
        const createdDate = d ? new Date(d).toLocaleDateString("en-US") : "-";
        return {
          id: String(g.id),
          parameterGroup:
            typeof g.parameter_group === "string" && g.parameter_group.trim()
              ? g.parameter_group
              : undefined,
          period: String(g.period ?? ""),
          workingDays: Number(g.working_days ?? 0),
          status: fromBackendStatus(g.status),
          createdDate,
        };
      });
  }, [apiEnabled, globalParametersApiData, globalWorkingDaysRows]);

  const typeParameterRowsView = useMemo<TypeParameterRow[]>(() => {
    if (!apiEnabled || !typeParametersApiData) return typeParameterRows;
    return typeParametersApiData
      .filter((record) => Boolean(record?.id))
      .map((record) => ({
        id: String(record.id),
        typeCode: String(record.type_code ?? ""),
        typeName: String(record.type_name ?? ""),
        description: String(record.description ?? ""),
        status: fromBackendStatus(record.status),
      }));
  }, [apiEnabled, typeParameterRows, typeParametersApiData]);

  const filteredSafety = useMemo(() => {
    const q = query.trim().toLowerCase();
    return safetyRowsView
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.inventoryType, r.itemUniqCode, r.parameter]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, safetyRowsView, typeFilter]);

  const stockdaysRowsView = useMemo<StockdaysRow[]>(() => {
    if (!apiEnabled || !stockdaysApiData) return stockdaysRows;
    return stockdaysApiData
      .filter((record) => Boolean(record?.id))
      .map((record) => ({
        id: String(record.id),
        itemUniqCode: String(record.item_uniq_code ?? ""),
        stockDays: Number(record.stock_days ?? 0),
        calculationType: String(record.calculation_type ?? ""),
        status: fromBackendStatus(record.status),
      }));
  }, [apiEnabled, stockdaysApiData, stockdaysRows]);

  const filteredStockdays = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stockdaysRowsView
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.itemUniqCode, String(r.stockDays), String(r.calculationType)]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, stockdaysRowsView, typeFilter]);

  const filteredTypeParameters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return typeParameterRowsView
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.typeCode, r.typeName, r.description]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, typeFilter, typeParameterRowsView]);

  const filteredUom = useMemo(() => {
    const q = query.trim().toLowerCase();
    return uomRowsView
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.code, r.name, r.category ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, typeFilter, uomRowsView]);

  const filteredPurchaseOrder = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = apiEnabled && poSplitApiData
      ? poSplitApiData
          .filter((record) => Boolean(record?.id))
          .map((record) => ({
            id: String(record.id),
            materialType: String(record.budget_type ?? ""),
            po1Pct: Number(record.po1_pct ?? 0),
            po2Pct: Number(record.po2_pct ?? 0),
            description: record.description ? String(record.description) : undefined,
            minOrderQty: Number(record.min_order_qty ?? 0),
            maxSplitLines: Number(record.max_split_lines ?? 0),
            splitRule: String(record.split_rule ?? ""),
            poSplitSum: Number(record.po_split_sum ?? 0),
            status: fromBackendStatus(record.status),
          }))
      : purchaseOrderRows;

    return source
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.materialType, r.splitRule, r.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [apiEnabled, poSplitApiData, purchaseOrderRows, query, typeFilter]);

  const filteredApprovalWorkflow = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = apiEnabled && approvalWorkflowApiData
      ? approvalWorkflowApiData
          .filter((record) => Boolean(record?.id))
          .map((record) => ({
            id: String(record.id),
            menuAction: String(record.action_name ?? ""),
            level1Role: String(record.level_1_role ?? ""),
            level2Role: String(record.level_2_role ?? ""),
            level3Role: String(record.level_3_role ?? ""),
            level4Role: String(record.level_4_role ?? ""),
            status: fromBackendStatus(record.status),
          }))
      : approvalWorkflowRows;

    return source
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
  }, [apiEnabled, approvalWorkflowApiData, approvalWorkflowRows, query, typeFilter]);

  const filteredKanban = useMemo(() => {
    const q = query.trim().toLowerCase();
    return kanbanRowsView
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.productName, r.productCode]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [query, kanbanRowsView, typeFilter]);

  const filteredGlobalWorkingDays = useMemo(() => {
    const q = query.trim().toLowerCase();
    return globalWorkingDaysRowsView
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
      if (!q) return true;
      return [r.period, r.parameterGroup ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [globalWorkingDaysRowsView, query, typeFilter]);

  const filteredProcess = useMemo(() => {
    const q = query.trim().toLowerCase();
    return processRowsView
      .filter((r) => (typeFilter === "All Types" ? true : r.status === typeFilter))
      .filter((r) => {
        if (!q) return true;
        return [r.processCode, r.processName, r.category]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [processRowsView, query, typeFilter]);

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
      parameter: SAFETY_STOCK_PARAMETER_OPTIONS[0]?.value,
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
      department: row.departmentId ?? row.department,
      role: row.roleId ?? row.role,
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

  const openCreateTypeParameter = () => {
    // open dedicated page for creating type parameter
    router.push("/system-settings/type-parameters/create");
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
    // open create page instead of side drawer
    router.push("/system-settings/uom/create");
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
    purchaseOrderForm.setFieldsValue(PURCHASE_ORDER_DEFAULT_VALUES);
    setPurchaseOrderEditOpen(true);
  };

  const openEditPurchaseOrder = (row: PurchaseOrderRow) => {
    setPurchaseOrderEditMode("edit");
    setPurchaseOrderEditingRow(row);
    purchaseOrderForm.setFieldsValue({
      materialType: row.materialType,
      po1Pct: row.po1Pct,
      po2Pct: row.po2Pct,
      vendor: row.description,
      description: row.description,
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
      parameterGroup: "planning",
      period: `${MONTH_NAMES[0]} ${CURRENT_YEAR}`,
      workingDays: 22,
      status: "Active",
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
      parameterGroup: row.parameterGroup,
      period: row.period,
      workingDays: row.workingDays,
      status: row.status,
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

  const resetPurchaseOrderEdit = () => {
    if (purchaseOrderEditMode === "edit" && purchaseOrderEditingRow) {
      purchaseOrderForm.setFieldsValue({
        materialType: purchaseOrderEditingRow.materialType,
        po1Pct: purchaseOrderEditingRow.po1Pct,
        po2Pct: purchaseOrderEditingRow.po2Pct,
        vendor: purchaseOrderEditingRow.description,
        description: purchaseOrderEditingRow.description,
        minOrderQty: purchaseOrderEditingRow.minOrderQty,
        maxSplitLines: purchaseOrderEditingRow.maxSplitLines,
        splitRule: purchaseOrderEditingRow.splitRule,
        status: purchaseOrderEditingRow.status,
      });
      return;
    }

    purchaseOrderForm.setFieldsValue(PURCHASE_ORDER_DEFAULT_VALUES);
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
    try {
      const values = await form.validateFields();

      if (apiEnabled) {
        const departmentValue = String(values.department ?? "").trim();
        const roleValue = String(values.role ?? "").trim();
        const departmentId =
          departmentOptions.find((option) => option.value === departmentValue)?.value ??
          departmentNameToId.get(departmentValue.toLowerCase()) ??
          editingRow?.departmentId;
        const roleId =
          roleOptions.find((option) => option.value === roleValue)?.value ??
          roleNameToId.get(roleValue.toLowerCase()) ??
          editingRow?.roleId;

        if (!departmentId) throw new Error("Department name must match existing department");
        if (!roleId) throw new Error("Role name must match existing role");

        const payload = {
          full_name: String(values.name ?? "").trim(),
          employee_id: String(values.empId ?? "").trim(),
          department_id: departmentId,
          role_id: roleId,
          status: toBackendStatus(values.status),
        };

        if (editMode === "edit") {
          if (!editingRow?.id) throw new Error("Missing access control id");
          await updateAccessControl({ id: editingRow.id, body: payload }).unwrap();
          message.success("Access control updated");
        } else {
          await createAccessControl(payload).unwrap();
          message.success("Access control created");
        }

        closeEdit();
        return;
      }

      const next: ParameterRow = {
        id:
          editMode === "create"
            ? `EMP-${String(values.empId || rows.length + 1)}`
            : (editingRow?.id ?? `EMP-${String(values.empId || rows.length + 1)}`),
        name: String(values.name ?? ""),
        empId: String(values.empId ?? ""),
        department:
          departmentIdToName.get(String(values.department ?? "")) ??
          String(values.department ?? editingRow?.department ?? ""),
        departmentId:
          departmentOptions.find((option) => option.value === String(values.department ?? ""))?.value ??
          departmentNameToId.get(String(values.department ?? "").trim().toLowerCase()) ??
          editingRow?.departmentId,
        role:
          roleIdToName.get(String(values.role ?? "")) ??
          String(values.role ?? editingRow?.role ?? ""),
        roleId:
          roleOptions.find((option) => option.value === String(values.role ?? ""))?.value ??
          roleNameToId.get(String(values.role ?? "").trim().toLowerCase()) ?? editingRow?.roleId,
        team: editingRow?.team ?? "",
        permissions: editingRow?.permissions ?? [],
        lastLogin: editingRow?.lastLogin ?? "-",
        status: values.status,
      };

      if (editMode === "create") {
        setRows((prev) => [next, ...prev]);
      } else {
        setRows((prev) => prev.map((r) => (r.id === editingRow?.id ? next : r)));
      }

      closeEdit();
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to save access control"));
    }
  };

  const saveSafetyEdit = async () => {
    try {
      const values = await safetyForm.validateFields();
      const inventoryTypeLabel = String(values.inventoryType ?? "").trim();
      const inventoryTypeValue = inventoryTypeLabel.toLowerCase().replace(/[\s-]+/g, "_");
      const calculationType = String(values.parameter ?? "").trim();
      const payload = {
        inventory_type: inventoryTypeValue,
        item_uniq_code: String(safetyEditingRow?.itemUniqCode ?? "").trim(),
        calculation_type: calculationType,
        constanta: Number(values.constanta ?? 0),
        status: toBackendStatus(values.status),
      };

      if (apiEnabled) {
        if (safetyEditMode === "edit") {
          if (!safetyEditingRow?.id) throw new Error("Missing safety stock id");
          await updateSafetyStock({ id: safetyEditingRow.id, body: payload }).unwrap();
          message.success("Safety stock updated");
        } else {
          await createSafetyStock(payload).unwrap();
          message.success("Safety stock created");
        }

        closeSafetyEdit();
        return;
      }

      const next: SafetyStockRow = {
        id:
          safetyEditMode === "create"
            ? `SS-${String(safetyRows.length + 1).padStart(3, "0")}`
            : (safetyEditingRow?.id ?? `SS-${String(safetyRows.length + 1).padStart(3, "0")}`),
        inventoryType: inventoryTypeLabel,
        itemUniqCode: String(safetyEditingRow?.itemUniqCode ?? ""),
        parameter: calculationType,
        constanta: Number(values.constanta ?? 0),
        status: values.status,
        createdAt: safetyEditingRow?.createdAt,
        updatedAt: new Date().toISOString(),
      };

      if (safetyEditMode === "create") {
        setSafetyRows((prev) => [next, ...prev]);
      } else {
        setSafetyRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
      }

      closeSafetyEdit();
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to save safety stock"));
    }
  };

  const saveTypeParameterEdit = async () => {
    try {
      const values = await typeParameterForm.validateFields();

      if (apiEnabled) {
        const payload = {
          type_code: String(values.typeCode ?? "").trim(),
          type_name: String(values.typeName ?? "").trim(),
          description: String(values.description ?? "").trim(),
          status: toBackendStatus(values.status),
        };

        if (typeParameterEditMode === "edit") {
          if (!typeParameterEditingRow?.id) throw new Error("Missing type parameter id");
          await updateTypeParameter({ id: typeParameterEditingRow.id, body: payload }).unwrap();
          message.success("Type parameter updated");
        } else {
          await createTypeParameter(payload).unwrap();
          message.success("Type parameter created");
        }

        closeTypeParameterEdit();
        return;
      }

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
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to save type parameter"));
    }
  };

  const saveUomEdit = async () => {
    const values = await uomForm.validateFields();

    try {
      if (apiEnabled) {
        if (uomEditMode === "edit") {
          if (!uomEditingRow?.id) throw new Error("Missing UOM id");
          await updateUom({
            id: uomEditingRow.id,
            body: {
              code: String(values.code ?? "").toUpperCase(),
              name: String(values.name ?? ""),
              category: values.category ? String(values.category) : "",
              status: toBackendStatus(values.status),
            },
          }).unwrap();
          message.success("UOM updated");
        } else {
          await createUom({
            code: String(values.code ?? "").toUpperCase(),
            name: String(values.name ?? ""),
            category: values.category ? String(values.category) : "",
            status: toBackendStatus(values.status),
          }).unwrap();
          message.success("UOM created");
        }

        closeUomEdit();
        return;
      }

      const next: UomRow = {
        id:
          uomEditMode === "create"
            ? `UOM-${String(values.code || "NEW").toUpperCase()}`
            : (uomEditingRow?.id ??
                `UOM-${String(values.code || "NEW").toUpperCase()}`),
        code: String(values.code || "").toUpperCase(),
        name: String(values.name || ""),
        category: values.category ? String(values.category) : undefined,
        status: values.status,
      };

      if (uomEditMode === "create") {
        setUomRows((prev) => [next, ...prev]);
      } else {
        setUomRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
      }

      closeUomEdit();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save UOM"));
    }
  };

  const savePurchaseOrderEdit = async () => {
    try {
      const values = await purchaseOrderForm.validateFields();

      if (apiEnabled) {
        const vendorValue = String(values.vendor ?? values.description ?? "").trim();
        const payload = {
          budget_type: String(values.materialType ?? "").trim(),
          po1_pct: Number(values.po1Pct ?? 0),
          po2_pct: Number(values.po2Pct ?? 0),
          description: vendorValue,
          min_order_qty: Number(values.minOrderQty ?? 0),
          max_split_lines: Number(values.maxSplitLines ?? 0),
          split_rule: String(values.splitRule ?? "").trim(),
          status: toBackendStatus(values.status),
        };

        if (purchaseOrderEditMode === "create") {
          await createPoSplit(payload).unwrap();
          message.success("PO split setting created");
        } else {
          if (!purchaseOrderEditingRow?.id) throw new Error("Missing PO split id");
          await updatePoSplit({ id: purchaseOrderEditingRow.id, body: payload }).unwrap();
          message.success("PO split setting updated");
        }

        closePurchaseOrderEdit();
        return;
      }

      const next: PurchaseOrderRow = {
        id:
          purchaseOrderEditMode === "create"
            ? `PO-${String(purchaseOrderRows.length + 1).padStart(3, "0")}`
            : (purchaseOrderEditingRow?.id ??
                `PO-${String(purchaseOrderRows.length + 1).padStart(3, "0")}`),
        materialType: values.materialType,
        po1Pct: Number(values.po1Pct ?? 0),
        po2Pct: Number(values.po2Pct ?? 0),
        description: String(values.vendor ?? values.description ?? "").trim(),
        minOrderQty: Number(values.minOrderQty ?? 0),
        maxSplitLines: Number(values.maxSplitLines ?? 0),
        splitRule: values.splitRule,
        poSplitSum: Number(values.po1Pct ?? 0) + Number(values.po2Pct ?? 0),
        status: values.status,
      };

      if (purchaseOrderEditMode === "create") {
        setPurchaseOrderRows((prev) => [next, ...prev]);
      } else {
        setPurchaseOrderRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
      }

      closePurchaseOrderEdit();
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to save PO split setting"));
    }
  };

  const saveApprovalWorkflowEdit = async () => {
    try {
      const values = await approvalWorkflowForm.validateFields();

      if (apiEnabled) {
        const payload = {
          action_name: String(values.menuAction ?? "").trim(),
          level_1_role: values.level1Role ? String(values.level1Role).trim() : null,
          level_2_role: values.level2Role ? String(values.level2Role).trim() : null,
          level_3_role: values.level3Role ? String(values.level3Role).trim() : null,
          level_4_role: values.level4Role ? String(values.level4Role).trim() : null,
          status: toBackendStatus(values.status),
        };

        if (approvalWorkflowEditMode === "create") {
          await createApprovalWorkflow(payload).unwrap();
          message.success("Approval workflow created");
        } else {
          if (!approvalWorkflowEditingRow?.id) throw new Error("Missing approval workflow id");
          await updateApprovalWorkflow({ id: approvalWorkflowEditingRow.id, body: payload }).unwrap();
          message.success("Approval workflow updated");
        }

        closeApprovalWorkflowEdit();
        return;
      }

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
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to save approval workflow"));
    }
  };

  const saveKanbanEdit = async () => {
    try {
      const values = await kanbanForm.validateFields();

      if (apiEnabled) {
        const payload = {
          item_name: values.productName,
          item_uniq_code: values.productCode,
          kanban_qty: Number(values.kanbanQty ?? 0),
          min_stock: Number(values.minStock ?? 0),
          max_stock: Number(values.maxStock ?? 0),
        };

        if (kanbanEditMode === "create") {
          await createKanbanStandard(payload).unwrap();
          message.success("Kanban standard created");
        } else {
          if (!kanbanEditingRow?.id) throw new Error("Missing kanban id");
          await updateKanbanStandard({ id: kanbanEditingRow.id, body: payload }).unwrap();
          message.success("Kanban standard updated");
        }

        closeKanbanEdit();
        return;
      }

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
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to save kanban standard"));
    }
  };

  const saveGlobalWorkingDaysEdit = async () => {
    try {
      const values = await globalWorkingDaysForm.validateFields();

      if (apiEnabled) {
        const payload = {
          parameter_group:
            values.parameterGroup && String(values.parameterGroup).trim()
              ? String(values.parameterGroup).trim()
              : undefined,
          period: String(values.period ?? ""),
          working_days: Number(values.workingDays ?? 0),
          status: toBackendStatus(values.status),
        };

        if (globalWorkingDaysEditMode === "edit") {
          if (!globalWorkingDaysEditingRow?.id) throw new Error("Missing global parameter id");
          await updateGlobalWorkingDays({ id: globalWorkingDaysEditingRow.id, body: payload }).unwrap();
          message.success("Global parameter updated");
        } else {
          await createGlobalWorkingDays(payload).unwrap();
          message.success("Global parameter created");
        }

        closeGlobalWorkingDaysEdit();
        return;
      }

      const createdDate = new Date().toLocaleDateString("en-US");

      const next: GlobalWorkingDaysRow = {
        id:
          globalWorkingDaysEditMode === "create"
            ? `GWD-${String(globalWorkingDaysRows.length + 1).padStart(3, "0")}`
            : (globalWorkingDaysEditingRow?.id ??
                `GWD-${String(globalWorkingDaysRows.length + 1).padStart(3, "0")}`),
        parameterGroup: values.parameterGroup,
        period: values.period,
        workingDays: Number(values.workingDays ?? 0),
        status: values.status,
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
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to save global parameters"));
    }
  };

  const saveProcessEdit = async () => {
    try {
      const values = await processForm.validateFields();

      if (apiEnabled) {
        const createPayload = {
          process_code: String(values.processCode ?? ""),
          process_name: String(values.processName ?? ""),
          category: String(values.category ?? ""),
          sequence: Number(values.sequence ?? 0),
          status: toBackendStatus(values.status),
        };

        if (processEditMode === "edit") {
          if (!processEditingRow?.id) throw new Error("Missing process id");
          await updateProcess({
            id: processEditingRow.id,
            body: {
              process_name: createPayload.process_name,
              sequence: createPayload.sequence,
              status: createPayload.status,
            },
          }).unwrap();
          message.success("Process updated");
        } else {
          await createProcess(createPayload).unwrap();
          message.success("Process created");
        }

        closeProcessEdit();
        return;
      }

      const next: ProcessRow = {
        id:
          processEditMode === "create"
            ? `PROC-${String(processRows.length + 1).padStart(3, "0")}`
            : (processEditingRow?.id ??
                `PROC-${String(processRows.length + 1).padStart(3, "0")}`),
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
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to save process"));
    }
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

  const openStockdaysDetail = (row: StockdaysRow) => {
    router.push(`/system-settings/stockdays/create?mode=detail&id=${encodeURIComponent(row.id)}`);
  };

  const openEditStockdays = (row: StockdaysRow) => {
    router.push(`/system-settings/stockdays/create?mode=edit&id=${encodeURIComponent(row.id)}`);
  };

  const openStockdaysDelete = (row: StockdaysRow) => {
    setStockdaysDeletingRow(row);
    setStockdaysDeleteOpen(true);
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

  const closeStockdaysDelete = () => {
    setStockdaysDeleteOpen(false);
    setStockdaysDeletingRow(null);
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

  const confirmDelete = async () => {
    if (!deletingRow) return;
    try {
      if (apiEnabled) {
        await deleteAccessControl(deletingRow.id).unwrap();
        message.success("Access control deleted");
      } else {
        setRows((prev) => prev.filter((r) => r.id !== deletingRow.id));
      }
      closeDelete();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete access control"));
    }
  };

  const confirmRoleDelete = async () => {
    if (!roleDeletingRow) return;
    try {
      if (apiEnabled) {
        await deleteRole(roleDeletingRow.id).unwrap();
        message.success("Role deleted");
      } else {
        setRoleRows((prev) => prev.filter((r) => r.id !== roleDeletingRow.id));
      }
      closeRoleDelete();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete role"));
    }
  };

  const confirmSafetyDelete = async () => {
    if (!safetyDeletingRow) return;
    try {
      if (apiEnabled) {
        await deleteSafetyStock(safetyDeletingRow.id).unwrap();
        message.success("Safety stock deleted");
      } else {
        setSafetyRows((prev) => prev.filter((r) => r.id !== safetyDeletingRow.id));
      }
      closeSafetyDelete();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete safety stock"));
    }
  };

  const confirmStockdaysDelete = async () => {
    if (!stockdaysDeletingRow) return;
    try {
      if (apiEnabled) {
        await deleteStockdays(stockdaysDeletingRow.id).unwrap();
        message.success("Stockdays deleted");
      } else {
        setStockdaysRows((prev) => prev.filter((r) => r.id !== stockdaysDeletingRow.id));
      }
      closeStockdaysDelete();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete stockdays"));
    }
  };

  const confirmTypeParameterDelete = async () => {
    if (!typeParameterDeletingRow) return;
    try {
      if (apiEnabled) {
        await deleteTypeParameter(typeParameterDeletingRow.id).unwrap();
        message.success("Type parameter deleted");
      } else {
        setTypeParameterRows((prev) => prev.filter((r) => r.id !== typeParameterDeletingRow.id));
      }
      closeTypeParameterDelete();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete type parameter"));
    }
  };

  const confirmUomDelete = async () => {
    if (!uomDeletingRow) return;
    try {
      if (apiEnabled) {
        await deleteUom(uomDeletingRow.id).unwrap();
        message.success("UOM deleted");
      } else {
        setUomRows((prev) => prev.filter((r) => r.id !== uomDeletingRow.id));
      }
      closeUomDelete();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete UOM"));
    }
  };

  const confirmPurchaseOrderDelete = async () => {
    if (!purchaseOrderDeletingRow) return;
    try {
      if (apiEnabled) {
        await deletePoSplit(purchaseOrderDeletingRow.id).unwrap();
        message.success("PO split setting deleted");
      } else {
        setPurchaseOrderRows((prev) => prev.filter((r) => r.id !== purchaseOrderDeletingRow.id));
      }
      closePurchaseOrderDelete();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete PO split setting"));
    }
  };

  const confirmApprovalWorkflowDelete = async () => {
    if (!approvalWorkflowDeletingRow) return;
    try {
      if (apiEnabled) {
        await deleteApprovalWorkflow(approvalWorkflowDeletingRow.id).unwrap();
        message.success("Approval workflow deleted");
      } else {
        setApprovalWorkflowRows((prev) => prev.filter((r) => r.id !== approvalWorkflowDeletingRow.id));
      }
      closeApprovalWorkflowDelete();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete approval workflow"));
    }
  };

  const confirmKanbanDelete = async () => {
    if (!kanbanDeletingRow) return;
    try {
      if (apiEnabled) {
        await deleteKanbanStandard(kanbanDeletingRow.id).unwrap();
        message.success("Kanban standard deleted");
      } else {
        setKanbanRows((prev) => prev.filter((r) => r.id !== kanbanDeletingRow.id));
      }
      closeKanbanDelete();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete kanban standard"));
    }
  };

  const confirmGlobalWorkingDaysDelete = async () => {
    if (!globalWorkingDaysDeletingRow) return;
    try {
      if (apiEnabled) {
        await deleteGlobalWorkingDays(globalWorkingDaysDeletingRow.id).unwrap();
        message.success("Global parameter deleted");
      } else {
        setGlobalWorkingDaysRows((prev) =>
          prev.filter((r) => r.id !== globalWorkingDaysDeletingRow.id)
        );
      }
      closeGlobalWorkingDaysDelete();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete global parameters"));
    }
  };

  const confirmProcessDelete = async () => {
    if (!processDeletingRow) return;
    try {
      if (apiEnabled) {
        await deleteProcess(processDeletingRow.id).unwrap();
        message.success("Process deleted");
      } else {
        setProcessRows((prev) => prev.filter((r) => r.id !== processDeletingRow.id));
      }
      closeProcessDelete();
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to delete process"));
    }
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
      title: "Item Code",
      dataIndex: "itemUniqCode",
      key: "itemUniqCode",
      width: 220,
      render: (v: string) => <div className="font-medium text-gray-900">{v}</div>,
    },
    {
      title: "Stock Days",
      dataIndex: "stockDays",
      key: "stockDays",
      width: 140,
      render: (v: number) => <div className="text-gray-700">{v}</div>,
    },
    {
      title: "Calculation Type",
      dataIndex: "calculationType",
      key: "calculationType",
      width: 260,
      render: (v: string) => (
        <div className="text-sm text-gray-700">
          {v === "a" ? "Stockdays - PRL = Stock / (PRL/Working days)" : v === "b" ? "Stockdays - DailyUsage = Stock / Daily Usage (Data history)" : v}
        </div>
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
      render: (_: unknown, r: StockdaysRow) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => openStockdaysDetail(r)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditStockdays(r)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => openStockdaysDelete(r)} />
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
      width: 220,
      render: (v?: string) => <div className="text-gray-700">{v || "-"}</div>,
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
      title: "PO Split",
      key: "poSplit",
      width: 150,
      render: (_: unknown, r: PurchaseOrderRow) => (
        <div className="text-gray-700">{r.po1Pct}% / {r.po2Pct}%</div>
      ),
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
    // {
    //   title: "Parameter Group",
    //   dataIndex: "parameterGroup",
    //   key: "parameterGroup",
    //   width: 180,
    //   render: (v?: string) => <span className="text-gray-700">{v || "-"}</span>,
    // },
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
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: StatusType) => (
        <Tag className="bg-blue-50 text-blue-700 border-blue-100">{s}</Tag>
      ),
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
        title="Delete stockdays parameter?"
        open={stockdaysDeleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={confirmStockdaysDelete}
        onCancel={closeStockdaysDelete}
      >
        <div className="text-gray-700">
          This will remove <span className="font-semibold">{stockdaysDeletingRow?.itemUniqCode}</span>.
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
              <div className="font-medium text-gray-900">
                {safetyStockDetailApiData?.inventory_type
                  ? formatInventoryTypeLabel(String(safetyStockDetailApiData.inventory_type))
                  : safetyDetailRow.inventoryType}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">UNIQ Code</div>
              <div className="font-medium text-gray-900">
                {safetyStockDetailApiData?.item_uniq_code || safetyDetailRow.itemUniqCode}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Constanta</div>
                <div className="font-medium text-gray-900">
                  {Number(safetyStockDetailApiData?.constanta ?? safetyDetailRow.constanta)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="font-medium text-gray-900">
                  {safetyStockDetailApiData ? fromBackendStatus(safetyStockDetailApiData.status) : safetyDetailRow.status}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Calculation Type</div>
                <div className="font-medium text-gray-900">
                  {safetyStockDetailApiData?.calculation_type || safetyDetailRow.parameter}
                </div>
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
              <div className="font-medium text-gray-900">{uomDetailRow.category || "-"}</div>
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
              <div className="font-medium text-gray-900">{poSplitDetailApiData?.budget_type || purchaseOrderDetailRow.materialType}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">PO 1 Percentage</div>
                <div className="font-medium text-gray-900">{Number(poSplitDetailApiData?.po1_pct ?? purchaseOrderDetailRow.po1Pct)}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">PO 2 Percentage</div>
                <div className="font-medium text-gray-900">{Number(poSplitDetailApiData?.po2_pct ?? purchaseOrderDetailRow.po2Pct)}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Min Order Qty</div>
                <div className="font-medium text-gray-900">
                  {Number(poSplitDetailApiData?.min_order_qty ?? purchaseOrderDetailRow.minOrderQty).toLocaleString("en-US")}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Max Split Lines</div>
                <div className="font-medium text-gray-900">{Number(poSplitDetailApiData?.max_split_lines ?? purchaseOrderDetailRow.maxSplitLines)}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Split Rule</div>
              <div className="font-medium text-gray-900">{poSplitDetailApiData?.split_rule || purchaseOrderDetailRow.splitRule}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Description</div>
              <div className="font-medium text-gray-900">{poSplitDetailApiData?.description || purchaseOrderDetailRow.description || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="font-medium text-gray-900">{poSplitDetailApiData ? fromBackendStatus(poSplitDetailApiData.status) : purchaseOrderDetailRow.status}</div>
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
              <div className="font-medium text-gray-900">{approvalWorkflowDetailApiData?.action_name || approvalWorkflowDetailRow.menuAction}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Level 1 Role</div>
                <div className="font-medium text-gray-900">{approvalWorkflowDetailApiData?.level_1_role || approvalWorkflowDetailRow.level1Role}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Level 2 Role</div>
                <div className="font-medium text-gray-900">{approvalWorkflowDetailApiData?.level_2_role || approvalWorkflowDetailRow.level2Role}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Level 3 Role</div>
                <div className="font-medium text-gray-900">{approvalWorkflowDetailApiData?.level_3_role || approvalWorkflowDetailRow.level3Role}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Level 4 Role</div>
                <div className="font-medium text-gray-900">{approvalWorkflowDetailApiData?.level_4_role || approvalWorkflowDetailRow.level4Role}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="font-medium text-gray-900">{approvalWorkflowDetailApiData ? fromBackendStatus(approvalWorkflowDetailApiData.status) : approvalWorkflowDetailRow.status}</div>
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
              <div className="text-xs text-gray-500">Parameter Group</div>
              <div className="font-medium text-gray-900">
                {globalParameterDetailApiData?.parameter_group || globalWorkingDaysDetailRow.parameterGroup || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Period</div>
              <div className="font-medium text-gray-900">{globalParameterDetailApiData?.period || globalWorkingDaysDetailRow.period}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Working Days</div>
                <div className="font-medium text-gray-900">
                  {Number(globalParameterDetailApiData?.working_days ?? globalWorkingDaysDetailRow.workingDays)} days
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="font-medium text-gray-900">
                  {globalParameterDetailApiData ? fromBackendStatus(globalParameterDetailApiData.status) : globalWorkingDaysDetailRow.status}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Created Date</div>
                <div className="font-medium text-gray-900">
                  {globalParameterDetailApiData?.updated_at || globalParameterDetailApiData?.created_at
                    ? new Date(globalParameterDetailApiData.updated_at || globalParameterDetailApiData.created_at || "").toLocaleDateString("en-US")
                    : globalWorkingDaysDetailRow.createdDate}
                </div>
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
                <div className="font-medium text-gray-900">{processDetailApiData?.process_code || processDetailRow.processCode}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Sequence</div>
                <div className="font-medium text-gray-900">{Number(processDetailApiData?.sequence ?? processDetailRow.sequence)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Process Name</div>
                <div className="font-medium text-gray-900">{processDetailApiData?.process_name || processDetailRow.processName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Category</div>
                <div className="font-medium text-gray-900">{processDetailApiData?.category || processDetailRow.category}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="font-medium text-gray-900">
                  {processDetailApiData ? fromBackendStatus(processDetailApiData.status) : processDetailRow.status}
                </div>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Form.Item label="Full Name" name="name" rules={[{ required: true }]}>
              <Input placeholder="Full name" disabled={editMode === "edit"} />
            </Form.Item>

            <Form.Item label="Employee ID" name="empId" rules={[{ required: true }]}>
              <Input placeholder="EMP-001" disabled={editMode === "edit"} />
            </Form.Item>

            <Form.Item label="Department" name="department" rules={[{ required: true }]}>
              {apiEnabled ? (
                <Select
                  placeholder="Select department"
                  options={departmentOptions}
                  disabled={editMode === "edit"}
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              ) : (
                <Input placeholder="Department" disabled={editMode === "edit"} />
              )}
            </Form.Item>

            <Form.Item label="Role" name="role" rules={[{ required: true }]}>
              {apiEnabled ? (
                <Select
                  placeholder="Select role"
                  options={roleOptions}
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              ) : (
                <Input placeholder="Role" />
              )}
            </Form.Item>
          </div>

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
            <Select
              placeholder="Select Type"
              options={SAFETY_STOCK_PARAMETER_OPTIONS}
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />
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
            <Input placeholder="Count" />
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

      <Modal
        title={purchaseOrderEditMode === "create" ? "Add Parameter" : "Edit Parameter"}
        open={purchaseOrderEditOpen}
        onCancel={closePurchaseOrderEdit}
        width={940}
        centered
        destroyOnClose
        styles={{ body: { padding: 24, background: "#f8fbff" } }}
        footer={null}
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#d6e5ff] bg-[#eef5ff] px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <SettingOutlined />
                </div>
                <div>
                  <div className="text-[22px] font-semibold text-gray-900">System Parameters</div>
                  <div className="text-sm text-gray-500">Comprehensive ERP parameter management and configuration</div>
                </div>
              </div>
              <Button type="primary" className="rounded-lg px-4">19 Configuration Modules</Button>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[28px] font-semibold leading-tight text-gray-900">PO - Split Settings</div>
              <div className="mt-1 text-sm text-gray-500">Configure purchase order split settings</div>
            </div>
            <Button type="primary" className="rounded-lg" icon={<PlusOutlined />}>Add Parameter</Button>
          </div>

          <Form form={purchaseOrderForm} layout="vertical" requiredMark={false} colon={false}>
            <Form.Item name="splitRule" hidden>
              <Input />
            </Form.Item>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold text-gray-900">Purchase Order Split Method</div>
              <div className="mt-1 text-sm text-gray-500">
                Choose how to split purchase orders between PO1 and PO2. Total must equal 100% of Purchase Request.
              </div>

              <div className="mt-5 space-y-4">
                <button
                  type="button"
                  className={`w-full rounded-2xl border p-4 text-left transition ${!purchaseOrderIsHistory ? "border-blue-500 bg-blue-50/50 shadow-[0_0_0_1px_rgba(59,130,246,0.16)]" : "border-gray-200 bg-white"}`}
                  onClick={() => purchaseOrderForm.setFieldsValue({ splitRule: "percentage" })}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-4 w-4 items-center justify-center rounded-full border border-blue-500">
                      <div className={`h-2 w-2 rounded-full ${!purchaseOrderIsHistory ? "bg-blue-600" : "bg-transparent"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[17px] font-semibold text-gray-900">Option 1: PO based on Percentage</div>
                      <div className="mt-1 text-sm text-gray-500">Applied for all UNIQ. Set fixed percentage split between PO1 and PO2.</div>

                      {!purchaseOrderIsHistory ? (
                        <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-4">
                          <div className="rounded-xl border border-blue-200 bg-[#f5f9ff] px-4 py-3 text-sm text-blue-700">
                            <div className="font-semibold">Information:</div>
                            <div className="mt-1">You can fill the percentage at menu PO Budget. Total percentage must equal 100%.</div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                            <Form.Item
                              label={<span className="text-sm font-medium text-gray-700">PO 1 Percentage <span className="text-red-500">*</span></span>}
                              name="po1Pct"
                              rules={[{ required: true, message: "PO 1 Percentage is required" }]}
                            >
                              <InputNumber className="w-full" size="large" min={0} max={100} addonAfter="%" />
                            </Form.Item>

                            <Form.Item
                              label={<span className="text-sm font-medium text-gray-700">PO 2 Percentage <span className="text-red-500">*</span></span>}
                              name="po2Pct"
                              rules={[{ required: true, message: "PO 2 Percentage is required" }]}
                            >
                              <InputNumber className="w-full" size="large" min={0} max={100} addonAfter="%" />
                            </Form.Item>

                            <div>
                              <div className="mb-2 text-sm font-medium text-gray-700">Total Percentage</div>
                              <div className={`flex h-10 items-center rounded-lg border px-4 text-lg font-semibold ${purchaseOrderPctTotal === 100 ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-amber-300 bg-amber-50 text-amber-600"}`}>
                                {purchaseOrderPctTotal}%
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                            <div><span className="font-semibold text-gray-700">Logic:</span> If percentage is created, then number of PR will be divided based on PO 1 and PO 2 percentage.</div>
                            <div className="mt-2">Example: If PR = 1000 pcs, PO1 (50%) = 500 pcs, PO2 (50%) = 500 pcs</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  className={`w-full rounded-2xl border p-4 text-left transition ${purchaseOrderIsHistory ? "border-fuchsia-400 bg-fuchsia-50/40 shadow-[0_0_0_1px_rgba(217,70,239,0.14)]" : "border-gray-200 bg-white"}`}
                  onClick={() => purchaseOrderForm.setFieldsValue({ splitRule: "history" })}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 flex h-4 w-4 items-center justify-center rounded-full border ${purchaseOrderIsHistory ? "border-blue-500" : "border-gray-400"}`}>
                      <div className={`h-2 w-2 rounded-full ${purchaseOrderIsHistory ? "bg-blue-600" : "bg-transparent"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[17px] font-semibold text-gray-900">Option 2: PO based on History Forecasting</div>
                      <div className="mt-1 text-sm text-gray-500">Can be applied per UNIQ. Based on historical delivery data from specific date ranges.</div>

                      {purchaseOrderIsHistory ? (
                        <div className="mt-4 rounded-2xl border border-fuchsia-200 bg-white p-4">
                          <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3 text-sm text-fuchsia-700">
                            <div className="font-semibold">Information:</div>
                            <div className="mt-1">Set date ranges for historical delivery analysis. System will calculate optimal split based on historical data.</div>
                          </div>

                          <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                            <div><span className="font-semibold text-gray-700">Logic:</span> System analyzes historical delivery data to determine optimal split ratios for PO1 and PO2.</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Form.Item
                  label={<span className="text-sm font-medium text-gray-700">Material Type <span className="text-red-500">*</span></span>}
                  name="materialType"
                  rules={[{ required: true, message: "Material Type is required" }]}
                >
                  <Select size="large" options={PURCHASE_ORDER_MATERIAL_OPTIONS} />
                </Form.Item>

                <Form.Item
                  label={<span className="text-sm font-medium text-gray-700">Vendor <span className="text-red-500">*</span></span>}
                  name="vendor"
                  rules={[{ required: true, message: "Vendor is required" }]}
                >
                  <Select
                    size="large"
                    placeholder="Select vendor"
                    options={purchaseOrderVendorOptions}
                    showSearch
                    filterOption={(input, option) =>
                      String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>

                <Form.Item
                  label={<span className="text-sm font-medium text-gray-700">Status <span className="text-red-500">*</span></span>}
                  name="status"
                  rules={[{ required: true, message: "Status is required" }]}
                >
                  <Select size="large" options={PURCHASE_ORDER_STATUS_OPTIONS} />
                </Form.Item>

                <Form.Item
                  label={<span className="text-sm font-medium text-gray-700">Description</span>}
                  name="description"
                  className="md:col-span-2"
                >
                  <Input size="large" placeholder="Optional note" />
                </Form.Item>

                <Form.Item
                  label={<span className="text-sm font-medium text-gray-700">Min Order Qty <span className="text-red-500">*</span></span>}
                  name="minOrderQty"
                  rules={[{ required: true, message: "Min Order Qty is required" }]}
                >
                  <InputNumber className="w-full" size="large" min={0} />
                </Form.Item>

                <Form.Item
                  label={<span className="text-sm font-medium text-gray-700">Max Split Lines <span className="text-red-500">*</span></span>}
                  name="maxSplitLines"
                  rules={[{ required: true, message: "Max Split Lines is required" }]}
                >
                  <InputNumber className="w-full" size="large" min={1} />
                </Form.Item>
              </div>

              <div className="mt-5 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <Button className="rounded-lg" onClick={resetPurchaseOrderEdit}>Reset to Default</Button>
                <Button type="primary" className="rounded-lg" onClick={savePurchaseOrderEdit}>Save Configuration</Button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold text-gray-900">Configuration Summary</div>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Selected Method:</span>
                  <span className="inline-flex rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    {purchaseOrderIsHistory ? "History Forecasting" : "Percentage Based"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">PO 1 Percentage:</span>
                  <span className="font-semibold text-gray-900">{Number(purchaseOrderPo1Pct || 0)}%</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">PO 2 Percentage:</span>
                  <span className="font-semibold text-gray-900">{Number(purchaseOrderPo2Pct || 0)}%</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Material Type:</span>
                  <span className="font-semibold text-gray-900">{PURCHASE_ORDER_MATERIAL_OPTIONS.find((option) => option.value === purchaseOrderMaterialType)?.label ?? purchaseOrderMaterialType}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Status:</span>
                  <span className="font-semibold text-gray-900">{purchaseOrderStatus}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Min / Max Split:</span>
                  <span className="font-semibold text-gray-900">{Number(purchaseOrderMinOrderQty || 0)} / {Number(purchaseOrderMaxSplitLines || 0)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Vendor:</span>
                  <span className="max-w-[55%] truncate text-right font-semibold text-gray-900">{purchaseOrderVendor || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Description:</span>
                  <span className="max-w-[55%] truncate text-right font-medium text-gray-900">{purchaseOrderDescription || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Total:</span>
                  <span className={`font-semibold ${purchaseOrderPctTotal === 100 ? "text-emerald-600" : "text-amber-600"}`}>{purchaseOrderPctTotal}%</span>
                </div>
              </div>
            </div>
          </Form>
        </div>
      </Modal>

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
            <Form.Item label="Level 1 Role" name="level1Role">
              <Select
                options={(shouldLoadRoles ? (rolesApiData ?? []) : []).map((r) => ({ label: String(r.name), value: String(r.name) }))}
                allowClear
              />
            </Form.Item>

            <Form.Item label="Level 2 Role" name="level2Role">
              <Select
                options={(shouldLoadRoles ? (rolesApiData ?? []) : []).map((r) => ({ label: String(r.name), value: String(r.name) }))}
                allowClear
              />
            </Form.Item>

            <Form.Item label="Level 3 Role" name="level3Role">
              <Select
                options={(shouldLoadRoles ? (rolesApiData ?? []) : []).map((r) => ({ label: String(r.name), value: String(r.name) }))}
                allowClear
              />
            </Form.Item>

            <Form.Item label="Level 4 Role" name="level4Role">
              <Select
                options={(shouldLoadRoles ? (rolesApiData ?? []) : []).map((r) => ({ label: String(r.name), value: String(r.name) }))}
                allowClear
              />
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
              <Select
                showSearch
                placeholder="Select BOM UNIQ"
                options={bomUniqOptions}
                optionFilterProp="label"
                filterOption={(input, opt) =>
                  String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
              />
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
        title={globalWorkingDaysEditMode === "create" ? "Add Global Parameter" : "Edit Global Parameter"}
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
          <Form.Item label="Parameter Group" name="parameterGroup">
            <Input placeholder="planning" />
          </Form.Item>
          <Form.Item label="Period" name="period" rules={[{ required: true }]}>
            <Select
              placeholder="Select period"
              options={PERIOD_OPTIONS as unknown as { label: string; value: string }[]}
              className="w-full"
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item label="Working Days" name="workingDays" rules={[{ required: true }]}>
            <Input className="w-full" placeholder="22" />
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
        title={processEditMode === "create" ? "Add Process" : "Edit Process"}
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
              <Input placeholder="PRC001" disabled={processEditMode === "edit" && apiEnabled} />
            </Form.Item>
            <Form.Item label="Sequence" name="sequence" rules={[{ required: true }]}>
              <InputNumber className="w-full" min={1} placeholder="1" />
            </Form.Item>
          </div>

          <Form.Item label="Process Name" name="processName" rules={[{ required: true }]}>
            <Input placeholder="Procurement" />
          </Form.Item>

          <Form.Item label="Category" name="category" rules={[{ required: true }]}>
            <Input placeholder="purchase" disabled={processEditMode === "edit" && apiEnabled} />
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
                    if (selectedModuleId === "scrap") {
                      router.push("/system-settings/scrap-type/create");
                      return;
                    }
                    if (selectedModuleId === "type-parameters") {
                      openCreateTypeParameter();
                      return;
                    }
                    if (selectedModuleId === "uom-global") {
                      openCreateUom();
                      return;
                    }
                    if (selectedModuleId === "purchase-order") {
                      openCreatePurchaseOrder();
                      return;
                    }
                    if (selectedModuleId === "approval-workflow") {
                      router.push("/system-settings/approval-workflow/create");
                      return;
                    }
                    if (selectedModuleId === "kanban") {
                      router.push("/system-settings/kanban/parameter/create-fullscreen");
                      return;
                    }
                    if (selectedModuleId === "global") {
                      router.push("/system-settings/global/create-fullscreen");
                      return;
                    }
                    if (selectedModuleId === "process") {
                      router.push("/system-settings/process/create-fullscreen");
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
