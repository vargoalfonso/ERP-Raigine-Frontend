"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Segmented,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DownloadOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  useDeleteMasterSupplierMutation,
  useListMasterSuppliersQuery,
  useUpdateMasterSupplierMutation,
} from "@/lib/api/master-supplier/api";
import {
  type SupplierRecord as SupplierOnlyRecord,
  useDeleteSupplierMutation,
  useEditSupplierMutation,
  useListSuppliersQuery,
} from "@/lib/api/suppliers/api";

type SupplierStatus = "Active" | "Inactive";

type SupplierTab = "Supplier Only" | "Raw Material" | "Indirect Raw Material" | "SubCon";

type SupplierRow = {
  key: string;
  supplierId?: string | number;
  supplierCode?: string;
  site: string;
  uniq: string;
  rawMaterialType: string;
  type?: string;
  productModel: string;
  partName: string;
  partNumber: string;
  gradeSize: string;
  qtyPerKanban: number;
  uom: string;
  weightKg: number;
  location: string;
  supplierName: string;
  cycleDays: number;
  status: SupplierStatus;
  tab: SupplierTab;

  // Supplier-only fields (from /api/suppliers)
  contactPerson?: string;
  contactNumber?: string;
  emailAddress?: string;
  materialCategory?: string;
  city?: string;
  province?: string;
  country?: string;
  fullAddress?: string;
  taxIdNpwp?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  paymentTerms?: string;
  deliveryLeadTimeDays?: number;
};

type SupplierOnlyEditForm = {
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress: string;
  materialCategory: string;
  fullAddress: string;
  city: string;
  province: string;
  country: string;
  taxIdNpwp: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  paymentTerms: string;
  deliveryLeadTimeDays: number;
  status: SupplierStatus;
};

const ALL_ROWS: SupplierRow[] = [
  {
    key: "SUP-001",
    site: "Sebanggo",
    uniq: "LV-001",
    rawMaterialType: "Metal",
    productModel: "Model A",
    partName: "Steel Plate 10mm",
    partNumber: "RM-ST-001",
    gradeSize: "A / 10mm",
    qtyPerKanban: 250,
    uom: "pcs",
    weightKg: 12.5,
    location: "WH-001",
    supplierName: "PT. Sumber Baja",
    cycleDays: 15,
    status: "Active",
    tab: "Raw Material",
  },
  {
    key: "SUP-002",
    site: "Sebanggo",
    uniq: "LV-002",
    rawMaterialType: "Plastic",
    productModel: "Model B",
    partName: "Plastic Sheet 5mm",
    partNumber: "RM-PL-002",
    gradeSize: "B / 5mm",
    qtyPerKanban: 100,
    uom: "pcs",
    weightKg: 4.2,
    location: "WH-002",
    supplierName: "CV. Polymer Indo",
    cycleDays: 8,
    status: "Active",
    tab: "Raw Material",
  },
  {
    key: "IND-001",
    site: "-",
    uniq: "-",
    rawMaterialType: "-",
    type: "Consumable",
    productModel: "Universal",
    partName: "Cutting Oil",
    partNumber: "OIL-CUT-001",
    gradeSize: "Grade A - 20L",
    qtyPerKanban: 100,
    uom: "liter",
    weightKg: 18,
    location: "Chemical Storage",
    supplierName: "PT Chemical Supply",
    cycleDays: 14,
    status: "Active",
    tab: "Indirect Raw Material",
  },
  {
    key: "IND-002",
    site: "-",
    uniq: "-",
    rawMaterialType: "-",
    type: "Consumable",
    productModel: "Universal",
    partName: "Welding Wire",
    partNumber: "WLD-WR-002",
    gradeSize: "ER70S-6 - 1.2mm",
    qtyPerKanban: 50,
    uom: "kg",
    weightKg: 15,
    location: "Welding Area",
    supplierName: "PT Welding Tech",
    cycleDays: 7,
    status: "Active",
    tab: "Indirect Raw Material",
  },
];

const TAB_OPTIONS: SupplierTab[] = [
  "Supplier Only",
  "Raw Material",
  "Indirect Raw Material",
  "SubCon",
];

export default function MasterSupplierPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <MasterSupplierClient />
    </Suspense>
  );
}

function MasterSupplierClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<SupplierTab>("Supplier Only");
  const [searchValue, setSearchValue] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<SupplierRow | null>(null);
  const [editForm] = Form.useForm<SupplierOnlyEditForm>();

  useEffect(() => {
    const tab = String(searchParams.get("tab") ?? "").toLowerCase();
    if (!tab) return;
    if (tab === "only") {
      setActiveTab("Supplier Only");
      return;
    }
    if (tab === "raw") {
      setActiveTab("Raw Material");
      return;
    }
    if (tab === "indirect") {
      setActiveTab("Indirect Raw Material");
      return;
    }
    if (tab === "subcon" || tab === "sub-con") {
      setActiveTab("SubCon");
    }
  }, [searchParams]);

  const apiEnabled = Boolean(apiBaseUrl);
  const useSupplierOnlyApi = apiEnabled && activeTab === "Supplier Only";

  const { data: apiListMaster = [] } = useListMasterSuppliersQuery(undefined, {
    skip: !apiEnabled || useSupplierOnlyApi,
  });
  const { data: apiListSuppliers = [] } = useListSuppliersQuery(undefined, {
    skip: !apiEnabled || !useSupplierOnlyApi,
  });

  const [deleteMasterSupplier] = useDeleteMasterSupplierMutation();
  const [updateMasterSupplier] = useUpdateMasterSupplierMutation();
  const [deleteSupplier] = useDeleteSupplierMutation();
  const [editSupplier, { isLoading: isEditingSupplier }] = useEditSupplierMutation();

  const closeView = () => setViewOpen(false);
  const closeEdit = () => setEditOpen(false);

  const openView = useCallback((row: SupplierRow) => {
    setSelectedRow(row);
    setViewOpen(true);
  }, []);

  const openEdit = useCallback(
    (row: SupplierRow) => {
      setSelectedRow(row);
      editForm.setFieldsValue({
        supplierName: row.supplierName ?? "",
        contactPerson: row.contactPerson ?? "",
        contactNumber: row.contactNumber ?? "",
        emailAddress: row.emailAddress ?? "",
        materialCategory: row.materialCategory ?? row.rawMaterialType ?? "Raw Material",
        fullAddress: row.fullAddress ?? "",
        city: row.city ?? "",
        province: row.province ?? "",
        country: row.country ?? "Indonesia",
        taxIdNpwp: row.taxIdNpwp ?? "",
        bankName: row.bankName ?? "",
        bankAccountNumber: row.bankAccountNumber ?? "",
        bankAccountName: row.bankAccountName ?? "",
        paymentTerms: row.paymentTerms ?? "",
        deliveryLeadTimeDays: row.deliveryLeadTimeDays ?? row.cycleDays ?? 0,
        status: row.status ?? "Active",
      });
      setEditOpen(true);
    },
    [editForm]
  );

  const rowsFromApiMaster: SupplierRow[] = useMemo(() => {
    const toTab = (rawType?: unknown): SupplierTab => {
      const t = String(rawType ?? "").toLowerCase();
      if (t.includes("subcon") || t.includes("sub-con")) return "SubCon";
      if (t.includes("consum")) return "Indirect Raw Material";
      return "Raw Material";
    };

    return apiListMaster.map((r, idx) => {
      const key = String(
        (r.id ?? r.supplier_code ?? r.sebango ?? idx) as string | number
      );

      const cycleRaw = (r.customer_cycle ?? "") as string;
      const cycleDays = Number.parseInt(cycleRaw, 10);

      return {
        key,
        site: "Sebanggo",
        uniq: String((r.uniq_code ?? r.uniq ?? "-") as string),
        rawMaterialType: String((r.rawMaterialType ?? r.type ?? "-") as string),
        type: String((r.type ?? "-") as string),
        productModel: String((r.model ?? r.productModel ?? "-") as string),
        partName: String((r.part_name ?? r.description ?? "-") as string),
        partNumber: String((r.part_no ?? r.sebango ?? r.supplier_code ?? "-") as string),
        gradeSize: String((r.size ?? r.gradeSize ?? "-") as string),
        qtyPerKanban: Number((r.kanban_quantity ?? r.quantity ?? 0) as number),
        uom: String((r.uom ?? "-") as string),
        weightKg: Number((r.weight ?? r.weightKg ?? 0) as number),
        location: String((r.location ?? "-") as string),
        supplierName: String((r.supplier_name ?? r.supplierName ?? "-") as string),
        cycleDays: Number.isFinite(cycleDays) ? cycleDays : 0,
        status: (String(r.status ?? "Active") as SupplierStatus) ?? "Active",
        tab: toTab(r.type),
      } satisfies SupplierRow;
    });
  }, [apiListMaster]);

  const rowsFromApiSuppliers: SupplierRow[] = useMemo(() => {
    const toStatus = (s: unknown): SupplierStatus => {
      const v = String(s ?? "Active");
      return v.toLowerCase() === "inactive" ? "Inactive" : "Active";
    };

    return (apiListSuppliers as SupplierOnlyRecord[]).map((r, idx) => {
      const id = (r.id ?? r.supplier_code ?? idx) as string | number;
      const key = String(id);

      const leadTime =
        typeof r.delivery_lead_time_days === "number"
          ? r.delivery_lead_time_days
          : Number.parseInt(String(r.delivery_lead_time_days ?? ""), 10);

      return {
        key,
        supplierId: r.id ?? r.supplier_code,
        supplierCode: typeof r.supplier_code === "string" ? r.supplier_code : undefined,
        site: "-",
        uniq: "-",
        rawMaterialType: String(r.material_category ?? "-") as string,
        type: String(r.material_category ?? "-") as string,
        productModel: "-",
        partName: "-",
        partNumber: String(r.supplier_code ?? r.id ?? "-") as string,
        gradeSize: "-",
        qtyPerKanban: 0,
        uom: "-",
        weightKg: 0,
        location: "-",
        supplierName: String(r.supplier_name ?? "-") as string,
        cycleDays: Number.isFinite(leadTime) ? leadTime : 0,
        status: toStatus(r.status),
        tab: "Supplier Only",

        contactPerson: typeof r.contact_person === "string" ? r.contact_person : undefined,
        contactNumber: typeof r.contact_number === "string" ? r.contact_number : undefined,
        emailAddress: typeof r.email_address === "string" ? r.email_address : undefined,
        materialCategory: typeof r.material_category === "string" ? r.material_category : undefined,
        city: typeof r.city === "string" ? r.city : undefined,
        province: typeof r.province === "string" ? r.province : undefined,
        country: typeof r.country === "string" ? r.country : undefined,
        fullAddress: typeof r.full_address === "string" ? r.full_address : undefined,
        taxIdNpwp: typeof r.tax_id_npwp === "string" ? r.tax_id_npwp : undefined,
        bankName: typeof r.bank_name === "string" ? r.bank_name : undefined,
        bankAccountNumber: typeof r.bank_account_number === "string" ? r.bank_account_number : undefined,
        bankAccountName: typeof r.bank_account_name === "string" ? r.bank_account_name : undefined,
        paymentTerms: typeof r.payment_terms === "string" ? r.payment_terms : undefined,
        deliveryLeadTimeDays: Number.isFinite(leadTime) ? leadTime : undefined,
      } satisfies SupplierRow;
    });
  }, [apiListSuppliers]);

  const allRows = apiEnabled
    ? activeTab === "Supplier Only"
      ? rowsFromApiSuppliers
      : rowsFromApiMaster
    : ALL_ROWS;

  const typeOptions = useMemo(() => {
    const scoped = activeTab === "Supplier Only" ? allRows : allRows.filter((r) => r.tab === activeTab);
    const unique = new Set(
      scoped
        .flatMap((r) => {
          if (activeTab === "Supplier Only") return [r.rawMaterialType, r.type];
          if (activeTab === "Indirect Raw Material") return [r.type];
          return [r.rawMaterialType];
        })
        .filter((v): v is string => Boolean(v && v !== "-"))
    );
    return Array.from(unique).sort();
  }, [activeTab, allRows]);

  const filteredRows = useMemo(() => {
    const q = searchValue.trim().toLowerCase();

    const scoped = activeTab === "Supplier Only" ? allRows : allRows.filter((row) => row.tab === activeTab);

    return scoped
      .filter((row) => {
        if (!typeFilter) return true;
        if (activeTab === "Supplier Only") return row.type === typeFilter || row.rawMaterialType === typeFilter;
        if (activeTab === "Indirect Raw Material") return row.type === typeFilter;
        return row.rawMaterialType === typeFilter;
      })
      .filter((row) => {
        if (!q) return true;
        const haystack = [
          row.uniq,
          row.rawMaterialType,
          row.type,
          row.productModel,
          row.partName,
          row.partNumber,
          row.gradeSize,
          row.location,
          row.supplierName,
          row.site,
          row.contactPerson,
          row.contactNumber,
          row.emailAddress,
          row.city,
          row.province,
          row.country,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
  }, [activeTab, searchValue, typeFilter, allRows]);

  const columns: ColumnsType<SupplierRow> = useMemo(() => {
    const commonActionsCol: ColumnsType<SupplierRow>[number] = {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_: unknown, record: SupplierRow) => (
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            className="text-blue-600 hover:text-blue-800"
            onClick={() => {
              if (!apiEnabled) {
                messageApi.info(`View ${record.partNumber}`);
                return;
              }
              if (activeTab === "Supplier Only") {
                openView(record);
                return;
              }
              messageApi.info(
                `Supplier: ${record.supplierName} | Code: ${record.key} | Sebango/Part: ${record.partNumber}`
              );
            }}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            className="text-green-600 hover:text-green-800"
            onClick={async () => {
              if (!apiEnabled) {
                messageApi.info(`Edit ${record.partNumber}`);
                return;
              }

              if (activeTab === "Supplier Only") {
                openEdit(record);
                return;
              }

              const nextDescription = window.prompt("Edit description", record.partName);
              if (nextDescription == null) return;
              try {
                await updateMasterSupplier({ id: record.key, body: { description: nextDescription } }).unwrap();
                messageApi.success("Updated");
              } catch {
                messageApi.error("Update failed");
              }
            }}
          />
          <Button
            type="text"
            icon={<DeleteOutlined />}
            size="small"
            className="text-red-600 hover:text-red-800"
            onClick={async () => {
              if (!apiEnabled) {
                messageApi.info(`Delete ${record.partNumber}`);
                return;
              }
              const ok = window.confirm("Delete this item?");
              if (!ok) return;
              try {
                if (activeTab === "Supplier Only") {
                  await deleteSupplier(record.supplierId ?? record.key).unwrap();
                } else {
                  await deleteMasterSupplier(record.key).unwrap();
                }
                messageApi.success("Deleted");
              } catch {
                messageApi.error("Delete failed");
              }
            }}
          />
        </div>
      ),
    };

    if (activeTab === "Supplier Only") {
      return [
        {
          title: "Supplier Code",
          dataIndex: "supplierCode",
          key: "supplierCode",
          width: 140,
          render: (value: string) => <span className="text-gray-700">{value || "-"}</span>,
        },
        {
          title: "Supplier Name",
          dataIndex: "supplierName",
          key: "supplierName",
          width: 220,
          render: (value: string) => <span className="text-gray-900">{value}</span>,
        },
        {
          title: "Category",
          dataIndex: "materialCategory",
          key: "materialCategory",
          width: 160,
          render: (value: string) => <span className="text-gray-700">{value || "-"}</span>,
        },
        {
          title: "Contact",
          dataIndex: "contactPerson",
          key: "contactPerson",
          width: 180,
          render: (value: string, r: SupplierRow) => (
            <div>
              <div className="text-gray-900">{value || "-"}</div>
              <div className="text-xs text-gray-500">{r.contactNumber || ""}</div>
            </div>
          ),
        },
        {
          title: "Email",
          dataIndex: "emailAddress",
          key: "emailAddress",
          width: 220,
          render: (value: string) => <span className="text-gray-700">{value || "-"}</span>,
        },
        {
          title: "Location",
          key: "location",
          width: 180,
          render: (_: unknown, r: SupplierRow) => (
            <span className="text-gray-700">{[r.city, r.province, r.country].filter(Boolean).join(", ") || "-"}</span>
          ),
        },
        {
          title: "Lead Time (Days)",
          dataIndex: "deliveryLeadTimeDays",
          key: "deliveryLeadTimeDays",
          width: 140,
          render: (value: number) => <span className="text-blue-600 font-semibold">{Number.isFinite(value) ? value : 0}</span>,
        },
        {
          title: "Status",
          dataIndex: "status",
          key: "status",
          width: 110,
          render: (value: SupplierStatus) => (
            <Tag color={value === "Active" ? "green" : "red"} className="!rounded-full">
              {value}
            </Tag>
          ),
        },
        commonActionsCol,
      ];
    }

    if (activeTab === "Indirect Raw Material") {
      return [
        {
          title: "Product Model",
          dataIndex: "productModel",
          key: "productModel",
          width: 140,
          render: (value: string) => <span className="text-gray-700">{value}</span>,
        },
        {
          title: "Part Name",
          dataIndex: "partName",
          key: "partName",
          width: 200,
          render: (value: string) => <span className="text-gray-900">{value}</span>,
        },
        {
          title: "Part Number",
          dataIndex: "partNumber",
          key: "partNumber",
          width: 140,
          render: (value: string) => <span className="text-gray-700">{value}</span>,
        },
        {
          title: "Grade/Size",
          dataIndex: "gradeSize",
          key: "gradeSize",
          width: 150,
          render: (value: string) => <span className="text-gray-700">{value}</span>,
        },
        {
          title: "Qty/Kanban",
          dataIndex: "qtyPerKanban",
          key: "qtyPerKanban",
          width: 120,
          render: (value: number) => <span className="text-blue-600 font-semibold">{value}</span>,
        },
        {
          title: "UOM",
          dataIndex: "uom",
          key: "uom",
          width: 90,
          render: (value: string) => <span className="text-gray-700">{value}</span>,
        },
        {
          title: "Weight (kg)",
          dataIndex: "weightKg",
          key: "weightKg",
          width: 110,
          render: (value: number) => <span className="text-gray-700">{value}</span>,
        },
        {
          title: "Lokasi",
          dataIndex: "location",
          key: "location",
          width: 150,
          render: (value: string) => <span className="text-gray-700">{value}</span>,
        },
        {
          title: "Type",
          dataIndex: "type",
          key: "type",
          width: 110,
          render: (value?: string) => (
            <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700 border border-purple-100">
              {value ?? "-"}
            </span>
          ),
        },
        {
          title: "Supplier Name",
          dataIndex: "supplierName",
          key: "supplierName",
          width: 180,
          render: (value: string) => <span className="text-gray-700">{value}</span>,
        },
        {
          title: "Cycle (days)",
          dataIndex: "cycleDays",
          key: "cycleDays",
          width: 110,
          render: (value: number) => (
            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
              {value}d
            </span>
          ),
        },
        {
          title: "Status",
          dataIndex: "status",
          key: "status",
          width: 100,
          render: (value: SupplierStatus) => (
            <Tag color={value === "Active" ? "green" : "default"}>{value}</Tag>
          ),
        },
        commonActionsCol,
      ];
    }

    return [
      {
        title: "Sebanggo",
        dataIndex: "site",
        key: "site",
        width: 120,
        render: (value: string) => (
          <span className="text-gray-700 font-medium">{value}</span>
        ),
      },
      {
        title: "UNIQ",
        dataIndex: "uniq",
        key: "uniq",
        width: 120,
        render: (value: string) => (
          <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
            {value}
          </span>
        ),
      },
      {
        title: "Type of Raw Material",
        dataIndex: "rawMaterialType",
        key: "rawMaterialType",
        width: 170,
        render: (value: string) => <span className="text-gray-700">{value}</span>,
      },
      {
        title: "Product Model",
        dataIndex: "productModel",
        key: "productModel",
        width: 140,
        render: (value: string) => <span className="text-gray-700">{value}</span>,
      },
      {
        title: "Part Name",
        dataIndex: "partName",
        key: "partName",
        width: 220,
        render: (value: string) => (
          <span className="text-gray-900 font-semibold">{value}</span>
        ),
      },
      {
        title: "Part Number",
        dataIndex: "partNumber",
        key: "partNumber",
        width: 140,
        render: (value: string) => <span className="text-gray-700">{value}</span>,
      },
      {
        title: "Grade / Size",
        dataIndex: "gradeSize",
        key: "gradeSize",
        width: 130,
        render: (value: string) => <span className="text-gray-700">{value}</span>,
      },
      {
        title: "Qty / Kanban",
        dataIndex: "qtyPerKanban",
        key: "qtyPerKanban",
        width: 120,
        render: (value: number) => <span className="text-gray-700">{value}</span>,
      },
      {
        title: "UOM",
        dataIndex: "uom",
        key: "uom",
        width: 80,
        render: (value: string) => <span className="text-gray-700">{value}</span>,
      },
      {
        title: "Weight (kg)",
        dataIndex: "weightKg",
        key: "weightKg",
        width: 110,
        render: (value: number) => <span className="text-gray-700">{value}</span>,
      },
      {
        title: "Lokasi",
        dataIndex: "location",
        key: "location",
        width: 110,
        render: (value: string) => <span className="text-gray-700">{value}</span>,
      },
      {
        title: "Supplier Name",
        dataIndex: "supplierName",
        key: "supplierName",
        width: 180,
        render: (value: string) => <span className="text-gray-700">{value}</span>,
      },
      {
        title: "Cycle (days)",
        dataIndex: "cycleDays",
        key: "cycleDays",
        width: 110,
        render: (value: number) => <span className="text-gray-700">{value}</span>,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 100,
        render: (value: SupplierStatus) => (
          <Tag color={value === "Active" ? "green" : "default"}>{value}</Tag>
        ),
      },
      commonActionsCol,
    ];
  }, [
    activeTab,
    apiEnabled,
    deleteMasterSupplier,
    deleteSupplier,
    messageApi,
    openEdit,
    openView,
    updateMasterSupplier,
  ]);

  const onSaveSupplierOnlyEdit = async () => {
    if (!selectedRow) return;
    try {
      const v = await editForm.validateFields();
      await editSupplier({
        id: selectedRow.supplierId ?? selectedRow.key,
        body: {
          supplier_name: v.supplierName,
          contact_person: v.contactPerson,
          contact_number: v.contactNumber,
          email_address: v.emailAddress,
          material_category: v.materialCategory,
          full_address: v.fullAddress,
          city: v.city,
          province: v.province,
          country: v.country,
          tax_id_npwp: v.taxIdNpwp,
          bank_name: v.bankName,
          bank_account_number: v.bankAccountNumber,
          bank_account_name: v.bankAccountName,
          payment_terms: v.paymentTerms,
          delivery_lead_time_days: v.deliveryLeadTimeDays,
          status: v.status,
        },
      }).unwrap();
      messageApi.success("Updated");
      closeEdit();
    } catch {
      messageApi.error("Update failed");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {contextHolder}

      <Modal
        open={viewOpen}
        title="Supplier Details"
        onCancel={closeView}
        footer={[
          <Button key="close" onClick={closeView}>
            Close
          </Button>,
        ]}
        width={720}
      >
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="Supplier Code">{selectedRow?.supplierCode ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Supplier Name">{selectedRow?.supplierName ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Category">{selectedRow?.materialCategory ?? selectedRow?.rawMaterialType ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Status">{selectedRow?.status ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Contact Person">{selectedRow?.contactPerson ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Contact Number">{selectedRow?.contactNumber ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Email">{selectedRow?.emailAddress ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Address">{selectedRow?.fullAddress ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="City / Province / Country">
            {[selectedRow?.city, selectedRow?.province, selectedRow?.country].filter(Boolean).join(", ") || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Tax ID (NPWP)">{selectedRow?.taxIdNpwp ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Bank Name">{selectedRow?.bankName ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Bank Account Number">{selectedRow?.bankAccountNumber ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Bank Account Name">{selectedRow?.bankAccountName ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Payment Terms">{selectedRow?.paymentTerms ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="Delivery Lead Time (Days)">
            {typeof selectedRow?.deliveryLeadTimeDays === "number" ? selectedRow.deliveryLeadTimeDays : selectedRow?.cycleDays ?? 0}
          </Descriptions.Item>
        </Descriptions>
      </Modal>

      <Modal
        open={editOpen}
        title="Edit Supplier"
        onCancel={closeEdit}
        onOk={onSaveSupplierOnlyEdit}
        okText="Save"
        confirmLoading={isEditingSupplier}
        width={720}
      >
        <Form form={editForm} layout="vertical" requiredMark={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item label="Supplier Name" name="supplierName" rules={[{ required: true, message: "Supplier name is required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>

            <Form.Item label="Category" name="materialCategory" rules={[{ required: true, message: "Category is required" }]}>
              <Select
                className="!rounded-lg"
                options={[
                  { label: "Raw Materials", value: "Raw Material" },
                  { label: "Indirect Material Raw", value: "Indirect Material Raw" },
                  { label: "Sub Con Materials", value: "Sub Con Materials" },
                ]}
              />
            </Form.Item>

            <Form.Item label="Contact Person" name="contactPerson" rules={[{ required: true, message: "Contact person is required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>

            <Form.Item label="Contact Number" name="contactNumber" rules={[{ required: true, message: "Contact number is required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>

            <Form.Item label="Email Address" name="emailAddress" rules={[{ required: true, type: "email", message: "Valid email is required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>

            <Form.Item label="Status" name="status" rules={[{ required: true }]}
            >
              <Select
                className="!rounded-lg"
                options={[
                  { label: "Active", value: "Active" },
                  { label: "Inactive", value: "Inactive" },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item label="Full Address" name="fullAddress" rules={[{ required: true, message: "Address is required" }]}>
            <Input className="!rounded-lg" />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Form.Item label="City" name="city" rules={[{ required: true, message: "City is required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item label="Province" name="province" rules={[{ required: true, message: "Province is required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item label="Country" name="country" rules={[{ required: true, message: "Country is required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item label="Tax ID (NPWP)" name="taxIdNpwp" rules={[{ required: true, message: "Tax ID is required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item label="Bank Name" name="bankName" rules={[{ required: true, message: "Bank name is required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item
              label="Bank Account Number"
              name="bankAccountNumber"
              rules={[{ required: true, message: "Bank account number is required" }]}
            >
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item
              label="Bank Account Name"
              name="bankAccountName"
              rules={[{ required: true, message: "Bank account name is required" }]}
            >
              <Input className="!rounded-lg" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item label="Payment Terms" name="paymentTerms">
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item label="Delivery Lead Time (Days)" name="deliveryLeadTimeDays" rules={[{ required: true, message: "Lead time is required" }]}>
              <InputNumber className="!rounded-lg w-full" min={0} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Master List Supplier
          </h1>
          <p className="text-gray-600">
            Supplier Directory and Master List Table for procurement and
            planning
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            icon={<UploadOutlined />}
            onClick={() => messageApi.info("Import Excel (coming soon)")}
          >
            Import Excel
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => messageApi.info("Export Data (coming soon)")}
          >
            Export Data
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <Typography.Title level={4} className="!mb-0">
                Supplier Directory
              </Typography.Title>
              <Typography.Text type="secondary">
                Track supplier mapping by raw material type, model, and location
              </Typography.Text>
            </div>
            <Tag color="blue">{activeTab}</Tag>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Segmented
              options={TAB_OPTIONS}
              value={activeTab}
              onChange={(val) => {
                const tab = val as SupplierTab;
                setActiveTab(tab);
                setSearchValue("");
                setTypeFilter(undefined);

                const tabParam =
                  tab === "Supplier Only"
                    ? "only"
                    : tab === "Raw Material"
                      ? "raw"
                      : tab === "Indirect Raw Material"
                        ? "indirect"
                        : "subcon";
                router.replace(`/master-supplier?tab=${tabParam}`);
              }}
            />

            <div className="flex items-center gap-3">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  if (activeTab === "Supplier Only") {
                    router.push("/master-supplier/only/create");
                    return;
                  }

                  const section = activeTab === "Indirect Raw Material" ? "indirect" : "raw";
                  router.push(`/master-supplier/create?section=${section}`);
                }}
              >
                Add Supplier
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => messageApi.info("Export (coming soon)")}
              >
                Export
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Input
              allowClear
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by Uniq or Machine Name..."
              prefix={<SearchOutlined />}
              className="w-full md:w-[360px]"
            />

            <Select
              allowClear
              value={typeFilter}
              onChange={(v) => setTypeFilter(v)}
              placeholder="All Types"
              className="w-full md:w-[180px]"
              options={typeOptions.map((t) => ({ label: t, value: t }))}
            />
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="min-w-[240px]">
              <p className="text-gray-600 font-medium">Master List Table</p>
              <p className="text-sm text-gray-500">
                View by Assembly name, Uniq and cycle
              </p>
            </div>
            <div className="flex items-center justify-end">
              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                {filteredRows.length} items
              </span>
            </div>
          </div>
          <Table<SupplierRow>
            columns={columns}
            dataSource={filteredRows}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1500 }}
            size="middle"
          />
        </div>
      </div>
    </div>
  );
}
