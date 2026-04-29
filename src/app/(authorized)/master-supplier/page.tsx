"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Input,
  Modal,
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
import {
  type SupplierRecord,
  useDeleteSupplierMutation,
  useGetSupplierByIdQuery,
  useListSuppliersQuery,
} from "@/lib/api/suppliers/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";

type SupplierSection = "supplier-only" | "raw-material" | "indirect-raw-material" | "subcon";
type SupplierItemSection = Exclude<SupplierSection, "supplier-only">;

type SupplierRow = {
  key: string;
  id?: string;
  section: SupplierItemSection;
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

type SupplierOnlyRow = {
  key: string;
  id?: string;
  supplierCode: string;
  supplierName: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress: string;
  materialCategory: string;
  city: string;
  paymentTerms: string;
  leadTimeDays: number;
  status: string;
  fullAddress: string;
};

const SECTION_OPTIONS: Array<{ label: string; value: SupplierSection }> = [
  { label: "Supplier Only", value: "supplier-only" },
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
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
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

const normalizeSection = (value: unknown): SupplierItemSection => {
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

const toSupplierOnlyRow = (record: SupplierRecord, index: number): SupplierOnlyRow => ({
  key: String(record.id ?? record.supplier_code ?? index),
  id: record.id == null ? undefined : String(record.id),
  supplierCode: String(record.supplier_code ?? "-"),
  supplierName: String(record.supplier_name ?? "-"),
  contactPerson: String(record.contact_person ?? "-"),
  contactNumber: String(record.contact_number ?? "-"),
  emailAddress: String(record.email_address ?? "-"),
  materialCategory: String(record.material_category ?? "-"),
  city: String(record.city ?? "-"),
  paymentTerms: String(record.payment_terms ?? "-"),
  leadTimeDays: Number(record.delivery_lead_time_days ?? 0),
  status: String(record.status ?? "Active"),
  fullAddress: String(record.full_address ?? "-"),
});

export default function MasterSupplierPage() {
  const router = useRouter();
  const apiEnabled = Boolean(apiBaseUrl);
  const [messageApi, contextHolder] = message.useMessage();
  const [activeSection, setActiveSection] = useState<SupplierSection>("supplier-only");
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>();
  const [selectedSupplierOnlyRow, setSelectedSupplierOnlyRow] = useState<SupplierOnlyRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const supplierItemsQuery = useListSupplierItemsQuery(undefined, { skip: !apiEnabled });
  const suppliersQuery = useListSuppliersQuery(undefined, { skip: !apiEnabled });
  const [deleteSupplierItem, deleteSupplierItemState] = useDeleteSupplierItemMutation();
  const [deleteSupplier, deleteSupplierState] = useDeleteSupplierMutation();

  const selectedSupplierId = selectedSupplierOnlyRow?.id;
  const supplierDetailQuery = useGetSupplierByIdQuery(selectedSupplierId ?? "", {
    skip: !apiEnabled || !detailOpen || !selectedSupplierId,
  });

  const supplierRows = useMemo(
    () => (supplierItemsQuery.data ?? []).map((record, index) => toSupplierRow(record, index)),
    [supplierItemsQuery.data]
  );
  const supplierOnlyRows = useMemo(
    () => (suppliersQuery.data ?? []).map((record, index) => toSupplierOnlyRow(record, index)),
    [suppliersQuery.data]
  );

  const typeOptions = useMemo(() => {
    if (activeSection === "supplier-only") return [];

    const uniqueTypes = new Set(
      supplierRows
        .filter((row) => row.section === activeSection)
        .map((row) => row.type)
        .filter((value) => value && value !== "-")
    );

    return Array.from(uniqueTypes)
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ label: value, value }));
  }, [activeSection, supplierRows]);

  const filteredSupplierRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return supplierRows
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
  }, [activeSection, supplierRows, searchValue, typeFilter]);

  const filteredSupplierOnlyRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return supplierOnlyRows;

    return supplierOnlyRows.filter((row) =>
      [
        row.supplierCode,
        row.supplierName,
        row.contactPerson,
        row.contactNumber,
        row.emailAddress,
        row.materialCategory,
        row.city,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [searchValue, supplierOnlyRows]);

  const openCreatePage = (mode: "create" | "edit" | "view", row?: SupplierRow) => {
    const targetSection = row?.section ?? (activeSection === "supplier-only" ? "raw-material" : activeSection);
    const params = new URLSearchParams({ section: targetSection });

    if (mode !== "create") params.set("mode", mode);
    if (row?.id) params.set("id", row.id);

    router.push(`/master-supplier/create?${params.toString()}`);
  };

  const handleDeleteSupplierItem = async (row: SupplierRow) => {
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

  const supplierColumns: ColumnsType<SupplierRow> = [
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
    { title: "Sebango", dataIndex: "sebangoCode", key: "sebangoCode", width: 150 },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 170,
      render: (value: string) => <Tag color="purple">{value}</Tag>,
    },
    { title: "Product Model", dataIndex: "productModel", key: "productModel", width: 160 },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      width: 220,
      render: (value: string) => <span className="font-semibold text-gray-900">{value}</span>,
    },
    { title: "Part Number", dataIndex: "partNumber", key: "partNumber", width: 160 },
    { title: "Grade / Size", dataIndex: "gradeSize", key: "gradeSize", width: 160 },
    { title: "Qty", dataIndex: "quantity", key: "quantity", width: 100 },
    { title: "Pcs / Kanban", dataIndex: "pcsPerKanban", key: "pcsPerKanban", width: 120 },
    {
      title: "Cycle",
      dataIndex: "customerCycle",
      key: "customerCycle",
      width: 100,
      render: (value: string) => value,
    },
    { title: "UOM", dataIndex: "uom", key: "uom", width: 100 },
    { title: "Weight", dataIndex: "weight", key: "weight", width: 100 },
    { title: "Warehouse", dataIndex: "warehouse", key: "warehouse", width: 180 },
    { title: "Supplier", dataIndex: "supplierName", key: "supplierName", width: 220 },
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
            okButtonProps={{ danger: true, loading: deleteSupplierItemState.isLoading }}
            onConfirm={() => handleDeleteSupplierItem(row)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  const supplierOnlyColumns: ColumnsType<SupplierOnlyRow> = [
    {
      title: "Supplier Code",
      dataIndex: "supplierCode",
      key: "supplierCode",
      width: 140,
      render: (value: string) => (
        <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
          {value}
        </span>
      ),
    },
    {
      title: "Supplier Name",
      dataIndex: "supplierName",
      key: "supplierName",
      width: 220,
      render: (value: string) => <span className="font-semibold text-gray-900">{value}</span>,
    },
    {
      title: "Contact",
      key: "contact",
      width: 220,
      render: (_value, row) => (
        <div className="text-sm text-gray-700">
          <div>{row.contactPerson}</div>
          <div className="text-xs text-gray-500">{row.contactNumber}</div>
        </div>
      ),
    },
    { title: "Email", dataIndex: "emailAddress", key: "emailAddress", width: 220 },
    { title: "Category", dataIndex: "materialCategory", key: "materialCategory", width: 180 },
    {
      title: "Lead Time",
      dataIndex: "leadTimeDays",
      key: "leadTimeDays",
      width: 120,
      render: (value: number) => <span className="text-gray-700">{value} days</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (value: string) => {
        const lowered = String(value ?? "").toLowerCase();
        const isActive = lowered === "active" || lowered === "1" || lowered === "true";
        return <Tag color={isActive ? "green" : "default"}>{value}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      fixed: "right",
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedSupplierOnlyRow(row);
              setDetailOpen(true);
            }}
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              if (!row.id) {
                messageApi.error("Missing supplier id");
                return;
              }
              router.push(`/master-supplier/only/${encodeURIComponent(String(row.id))}/edit`);
            }}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              setSelectedSupplierOnlyRow(row);
              setDeleteOpen(true);
            }}
          />
        </div>
      ),
    },
  ];

  const isSupplierOnly = activeSection === "supplier-only";
  const visibleCount = isSupplierOnly ? filteredSupplierOnlyRows.length : filteredSupplierRows.length;

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
              Manage supplier only and supplier item mappings for raw material, indirect raw material, and subcon.
            </Typography.Text>
          </div>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              if (isSupplierOnly) {
                router.push("/master-supplier/only/create");
                return;
              }
              openCreatePage("create");
            }}
          >
            {isSupplierOnly ? "Add Supplier Only" : "Add Supplier Item"}
          </Button>
        </div>
      </div>

      {!apiEnabled ? (
        <Alert
          type="warning"
          showIcon
          message="Backend is not configured"
          description="Set NEXT_PUBLIC_API_URL to enable supplier listing, detail, save, and delete operations."
        />
      ) : null}

      {apiEnabled && supplierItemsQuery.error ? (
        <Alert
          type="error"
          showIcon
          message="Failed to load supplier items"
          description={getApiErrorMessage(supplierItemsQuery.error, "Unable to load supplier item data")}
          action={<Button onClick={() => supplierItemsQuery.refetch()}>Retry</Button>}
        />
      ) : null}

      {apiEnabled && suppliersQuery.error ? (
        <Alert
          type="error"
          showIcon
          message="Failed to load supplier-only data"
          description={getApiErrorMessage(suppliersQuery.error, "Unable to load supplier-only data")}
          action={<Button onClick={() => suppliersQuery.refetch()}>Retry</Button>}
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

          <div className="text-sm text-gray-500">{visibleCount} {isSupplierOnly ? "suppliers" : "items"}</div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Input
            allowClear
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={isSupplierOnly ? "Search supplier name, code, contact..." : "Search by uniq, part, supplier, warehouse..."}
            prefix={<SearchOutlined />}
            className="w-full md:w-[360px]"
          />

          {!isSupplierOnly ? (
            <Select
              allowClear
              value={typeFilter}
              onChange={(value) => setTypeFilter(value)}
              placeholder="Filter by type"
              options={typeOptions}
              className="w-full md:w-[240px]"
            />
          ) : null}
        </div>

        {isSupplierOnly ? (
          <Table<SupplierOnlyRow>
            columns={supplierOnlyColumns}
            dataSource={apiEnabled ? filteredSupplierOnlyRows : []}
            rowKey="key"
            loading={apiEnabled && suppliersQuery.isLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1200 }}
          />
        ) : (
          <Table<SupplierRow>
            columns={supplierColumns}
            dataSource={apiEnabled ? filteredSupplierRows : []}
            rowKey="key"
            loading={apiEnabled && supplierItemsQuery.isLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1800 }}
          />
        )}
      </div>

      <Modal
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setSelectedSupplierOnlyRow(null);
        }}
        footer={
          <Button
            className="!rounded-lg"
            onClick={() => {
              setDetailOpen(false);
              setSelectedSupplierOnlyRow(null);
            }}
          >
            Close
          </Button>
        }
        title="Supplier Only Detail"
      >
        {selectedSupplierOnlyRow ? (
          supplierDetailQuery.isFetching ? (
            <div className="text-sm text-gray-500">Loading detail...</div>
          ) : supplierDetailQuery.isError ? (
            <div className="text-sm text-red-600">
              {getApiErrorMessage(supplierDetailQuery.error, "Failed to load supplier detail")}
            </div>
          ) : (
            (() => {
              const detail = supplierDetailQuery.data;
              const supplierCode = String(detail?.supplier_code ?? selectedSupplierOnlyRow.supplierCode ?? "-");
              const supplierName = String(detail?.supplier_name ?? selectedSupplierOnlyRow.supplierName ?? "-");
              const contactPerson = String(detail?.contact_person ?? selectedSupplierOnlyRow.contactPerson ?? "-");
              const contactNumber = String(detail?.contact_number ?? selectedSupplierOnlyRow.contactNumber ?? "-");
              const emailAddress = String(detail?.email_address ?? selectedSupplierOnlyRow.emailAddress ?? "-");
              const materialCategory = String(detail?.material_category ?? selectedSupplierOnlyRow.materialCategory ?? "-");
              const paymentTerms = String(detail?.payment_terms ?? selectedSupplierOnlyRow.paymentTerms ?? "-");
              const leadTimeDays = Number(detail?.delivery_lead_time_days ?? selectedSupplierOnlyRow.leadTimeDays ?? 0);
              const fullAddress = String(detail?.full_address ?? selectedSupplierOnlyRow.fullAddress ?? "-");
              const city = String(detail?.city ?? "-");
              const province = String(detail?.province ?? "-");
              const country = String(detail?.country ?? "-");
              const taxId = String(detail?.tax_id_npwp ?? "-");
              const bankName = String(detail?.bank_name ?? "-");
              const bankAccountNumber = String(detail?.bank_account_number ?? "-");
              const bankAccountName = String(detail?.bank_account_name ?? "-");

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><div className="text-gray-500">Supplier Code</div><div className="font-semibold text-gray-900">{supplierCode}</div></div>
                  <div><div className="text-gray-500">Supplier Name</div><div className="font-semibold text-gray-900">{supplierName}</div></div>
                  <div><div className="text-gray-500">Contact Person</div><div className="text-gray-900">{contactPerson}</div></div>
                  <div><div className="text-gray-500">Contact Number</div><div className="text-gray-900">{contactNumber}</div></div>
                  <div><div className="text-gray-500">Email</div><div className="text-gray-900">{emailAddress}</div></div>
                  <div><div className="text-gray-500">Category</div><div className="text-gray-900">{materialCategory}</div></div>
                  <div><div className="text-gray-500">Payment Terms</div><div className="text-gray-900">{paymentTerms}</div></div>
                  <div><div className="text-gray-500">Lead Time</div><div className="text-gray-900">{leadTimeDays} days</div></div>
                  <div><div className="text-gray-500">City</div><div className="text-gray-900">{city}</div></div>
                  <div><div className="text-gray-500">Province</div><div className="text-gray-900">{province}</div></div>
                  <div><div className="text-gray-500">Country</div><div className="text-gray-900">{country}</div></div>
                  <div><div className="text-gray-500">NPWP</div><div className="text-gray-900">{taxId}</div></div>
                  <div><div className="text-gray-500">Bank</div><div className="text-gray-900">{bankName}</div></div>
                  <div><div className="text-gray-500">Bank Account No</div><div className="text-gray-900">{bankAccountNumber}</div></div>
                  <div><div className="text-gray-500">Bank Account Name</div><div className="text-gray-900">{bankAccountName}</div></div>
                  <div className="md:col-span-2"><div className="text-gray-500">Address</div><div className="text-gray-900">{fullAddress}</div></div>
                </div>
              );
            })()
          )
        ) : null}
      </Modal>

      <Modal
        open={deleteOpen}
        onCancel={() => {
          setDeleteOpen(false);
          setSelectedSupplierOnlyRow(null);
        }}
        okText="Delete"
        okButtonProps={{ danger: true, className: "!rounded-lg", loading: deleteSupplierState.isLoading }}
        cancelButtonProps={{ className: "!rounded-lg" }}
        onOk={async () => {
          try {
            if (!selectedSupplierOnlyRow?.id) throw new Error("Missing supplier id");
            await deleteSupplier(selectedSupplierOnlyRow.id).unwrap();
            messageApi.success("Supplier deleted");
            setDeleteOpen(false);
            setSelectedSupplierOnlyRow(null);
            suppliersQuery.refetch();
          } catch (error) {
            messageApi.error(getApiErrorMessage(error, "Failed to delete supplier"));
          }
        }}
        title="Delete supplier?"
      >
        <div>Delete <span className="font-semibold">{selectedSupplierOnlyRow?.supplierName}</span> from Supplier Only?</div>
      </Modal>
    </div>
  );
}
