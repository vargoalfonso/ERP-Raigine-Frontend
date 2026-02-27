"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
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

type SupplierStatus = "Active" | "Inactive";

type SupplierTab = "Raw Material" | "Indirect Raw Material" | "SubCon";

type SupplierRow = {
  key: string;
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
  "Raw Material",
  "Indirect Raw Material",
  "SubCon",
];

export default function MasterSupplierPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<SupplierTab>("Raw Material");
  const [searchValue, setSearchValue] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  const apiEnabled = Boolean(apiBaseUrl);
  const { data: apiList = [] } = useListMasterSuppliersQuery(undefined, {
    skip: !apiEnabled,
  });
  const [deleteMasterSupplier] = useDeleteMasterSupplierMutation();
  const [updateMasterSupplier] = useUpdateMasterSupplierMutation();

  const rowsFromApi: SupplierRow[] = useMemo(() => {
    const toTab = (rawType?: unknown): SupplierTab => {
      const t = String(rawType ?? "").toLowerCase();
      if (t.includes("subcon") || t.includes("sub-con")) return "SubCon";
      if (t.includes("consum")) return "Indirect Raw Material";
      return "Raw Material";
    };

    return apiList.map((r, idx) => {
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
  }, [apiList]);

  const allRows = apiEnabled ? rowsFromApi : ALL_ROWS;

  const typeOptions = useMemo(() => {
    const unique = new Set(
      allRows.filter((r) => r.tab === activeTab)
        .map((r) => (activeTab === "Indirect Raw Material" ? r.type : r.rawMaterialType))
        .filter((v): v is string => Boolean(v && v !== "-"))
    );
    return Array.from(unique).sort();
  }, [activeTab, allRows]);

  const filteredRows = useMemo(() => {
    const q = searchValue.trim().toLowerCase();

    return allRows.filter((row) => row.tab === activeTab)
      .filter((row) => {
        if (!typeFilter) return true;
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
              const nextDescription = window.prompt(
                "Edit description",
                record.partName
              );
              if (nextDescription == null) return;
              try {
                await updateMasterSupplier({
                  id: record.key,
                  body: {
                    description: nextDescription,
                  },
                }).unwrap();
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
                await deleteMasterSupplier(record.key).unwrap();
                messageApi.success("Deleted");
              } catch {
                messageApi.error("Delete failed");
              }
            }}
          />
        </div>
      ),
    };

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
    messageApi,
    updateMasterSupplier,
  ]);

  return (
    <div className="p-6 space-y-6">
      {contextHolder}

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
              }}
            />

            <div className="flex items-center gap-3">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  const section =
                    activeTab === "Indirect Raw Material" ? "indirect" : "raw";
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
