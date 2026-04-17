"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  type SupplierItemRecord,
  useDeleteSupplierItemMutation,
  useListSupplierItemsQuery,
} from "@/lib/api/supplier-items/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";

type SupplierSection = "raw-material" | "indirect-raw-material" | "subcon";

type SupplierRow = {
  key: string;
  id?: string;
  section: SupplierSection;
  supplierName: string;
  uniqCode: string;
  sebangoCode: string;
  type: string;
  productModel: string;
  partName: string;
  partNumber: string;
  gradeSize: string;
  quantity: number;
  pcsPerKanban: number;
  customerCycle: string;
  uom: string;
  weight: number;
  warehouse: string;
  status: string;
};

const SECTION_OPTIONS: Array<{ label: string; value: SupplierSection }> = [
  { label: "Raw Material", value: "raw-material" },
  { label: "Indirect Raw Material", value: "indirect-raw-material" },
  { label: "SubCon", value: "subcon" },
];

const pickText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
};

const pickNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
};

const normalizeSection = (value: unknown): SupplierSection => {
  const raw = pickText(value).toLowerCase();
  if (raw.includes("indirect")) return "indirect-raw-material";
  if (raw.includes("sub")) return "subcon";
  return "raw-material";
};

const sectionLabel = (section: SupplierSection) =>
  SECTION_OPTIONS.find((option) => option.value === section)?.label ?? "Raw Material";

const toSupplierRow = (record: SupplierItemRecord, index: number): SupplierRow => {
  const section = normalizeSection(record.material_type ?? record.type);
  const grade = pickText(record.grade);
  const size = pickText(record.size);

  return {
    key: String(record.id ?? record.supplier_item_uuid ?? record.uniq_code ?? index),
    id: pickText(record.id, record.supplier_item_uuid),
    section,
    supplierName: pickText(record.supplier_name, record.supplier_code) || "-",
    uniqCode: pickText(record.uniq_code) || "-",
    sebangoCode: pickText(record.sebango_code) || "-",
    type: pickText(record.type, record.material_type) || "-",
    productModel: pickText(record.product_model) || "-",
    partName: pickText(record.part_name, record.description, record.uniq_code) || "-",
    partNumber: pickText(record.part_number) || "-",
    gradeSize: [grade, size].filter(Boolean).join(" / ") || "-",
    quantity: pickNumber(record.quantity),
    pcsPerKanban: pickNumber(record.pcs_per_kanban),
    customerCycle: pickText(record.customer_cycle) || "-",
    uom: pickText(record.uom) || "-",
    weight: pickNumber(record.weight),
    warehouse: pickText(record.warehouse_name, record.warehouse_id) || "-",
    status: pickText(record.status) || "Active",
  };
};

export default function MasterSupplierPage() {
  const router = useRouter();
  const apiEnabled = Boolean(apiBaseUrl);
  const [messageApi, contextHolder] = message.useMessage();
  const [activeSection, setActiveSection] = useState<SupplierSection>("raw-material");
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>();

  const { data: supplierItems = [], isLoading, error, refetch } = useListSupplierItemsQuery(undefined, {
    skip: !apiEnabled,
  });
  const [deleteSupplierItem, deleteState] = useDeleteSupplierItemMutation();

  const rows = useMemo(
    () => supplierItems.map((record, index) => toSupplierRow(record, index)),
    [supplierItems]
  );

  const typeOptions = useMemo(() => {
    const uniqueTypes = new Set(
      rows
        .filter((row) => row.section === activeSection)
        .map((row) => row.type)
        .filter((value) => value && value !== "-")
    );

    return Array.from(uniqueTypes)
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ label: value, value }));
  }, [activeSection, rows]);

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return rows
      .filter((row) => row.section === activeSection)
      .filter((row) => (typeFilter ? row.type === typeFilter : true))
      .filter((row) => {
        if (!query) return true;
        return [
          row.supplierName,
          row.uniqCode,
          row.sebangoCode,
          row.type,
          row.productModel,
          row.partName,
          row.partNumber,
          row.gradeSize,
          row.warehouse,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [activeSection, rows, searchValue, typeFilter]);

  const openCreatePage = (mode: "create" | "edit" | "view", row?: SupplierRow) => {
    const params = new URLSearchParams({
      section: row?.section ?? activeSection,
    });

    if (mode !== "create") params.set("mode", mode);
    if (row?.id) params.set("id", row.id);

    router.push(`/master-supplier/create?${params.toString()}`);
  };

  const handleDelete = async (row: SupplierRow) => {
    if (!row.id) {
      messageApi.error("Missing supplier item id");
      return;
    }

    try {
      await deleteSupplierItem(row.id).unwrap();
      messageApi.success(`Deleted ${row.partName}`);
    } catch (deleteError) {
      messageApi.error(getApiErrorMessage(deleteError, "Failed to delete supplier item"));
    }
  };

  const columns: ColumnsType<SupplierRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniqCode",
      key: "uniqCode",
      width: 130,
      render: (value: string) => (
        <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
          {value}
        </span>
      ),
    },
    {
      title: "Sebango",
      dataIndex: "sebangoCode",
      key: "sebangoCode",
      width: 150,
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 170,
      render: (value: string) => <Tag color="purple">{value}</Tag>,
    },
    {
      title: "Product Model",
      dataIndex: "productModel",
      key: "productModel",
      width: 160,
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      width: 220,
      render: (value: string) => <span className="font-semibold text-gray-900">{value}</span>,
    },
    {
      title: "Part Number",
      dataIndex: "partNumber",
      key: "partNumber",
      width: 160,
    },
    {
      title: "Grade / Size",
      dataIndex: "gradeSize",
      key: "gradeSize",
      width: 160,
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      width: 100,
    },
    {
      title: "Pcs / Kanban",
      dataIndex: "pcsPerKanban",
      key: "pcsPerKanban",
      width: 120,
    },
    {
      title: "Cycle",
      dataIndex: "customerCycle",
      key: "customerCycle",
      width: 100,
      render: (value: number) => `${value} day(s)`,
    },
    {
      title: "UOM",
      dataIndex: "uom",
      key: "uom",
      width: 100,
    },
    {
      title: "Weight",
      dataIndex: "weight",
      key: "weight",
      width: 100,
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse",
      key: "warehouse",
      width: 180,
    },
    {
      title: "Supplier",
      dataIndex: "supplierName",
      key: "supplierName",
      width: 220,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (value: string) => {
        const lowered = value.toLowerCase();
        return <Tag color={lowered === "active" ? "green" : "default"}>{value}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      fixed: "right",
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openCreatePage("view", row)} />
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openCreatePage("edit", row)} />
          <Popconfirm
            title="Delete supplier item?"
            description={`Remove ${row.partName} from ${sectionLabel(row.section)}.`}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true, loading: deleteState.isLoading }}
            onConfirm={() => handleDelete(row)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {contextHolder}

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Typography.Title level={2} className="!mb-1">
              Master Supplier
            </Typography.Title>
            <Typography.Text type="secondary">
              Manage supplier item mappings for raw material, indirect raw material, and subcon.
            </Typography.Text>
          </div>

          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreatePage("create")}>
            Add Supplier Item
          </Button>
        </div>
      </div>

      {!apiEnabled ? (
        <Alert
          type="warning"
          showIcon
          message="Backend is not configured"
          description="Set NEXT_PUBLIC_API_URL to enable supplier item listing, detail, save, and delete operations."
        />
      ) : null}

      {apiEnabled && error ? (
        <Alert
          type="error"
          showIcon
          message="Failed to load supplier items"
          description={getApiErrorMessage(error, "Unable to load supplier item data")}
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      ) : null}

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Segmented
            options={SECTION_OPTIONS}
            value={activeSection}
            onChange={(value) => {
              setActiveSection(value as SupplierSection);
              setSearchValue("");
              setTypeFilter(undefined);
            }}
          />

          <div className="text-sm text-gray-500">{filteredRows.length} items</div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Input
            allowClear
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by uniq, part, supplier, warehouse..."
            prefix={<SearchOutlined />}
            className="w-full md:w-[360px]"
          />

          <Select
            allowClear
            value={typeFilter}
            onChange={(value) => setTypeFilter(value)}
            placeholder="Filter by type"
            options={typeOptions}
            className="w-full md:w-[240px]"
          />
        </div>

        <Table<SupplierRow>
          columns={columns}
          dataSource={apiEnabled ? filteredRows : []}
          rowKey="key"
          loading={apiEnabled && isLoading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1800 }}
        />
      </div>
    </div>
  );
}
