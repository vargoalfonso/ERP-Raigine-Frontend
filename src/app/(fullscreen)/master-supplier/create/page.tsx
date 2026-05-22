"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import {
  type BackendBomNode,
  useGetBomTreeQuery,
} from "@/lib/api/bom/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type SupplierItemMutationRequest,
  useCreateSupplierItemMutation,
  useGetSupplierItemByIdQuery,
  useUpdateSupplierItemMutation,
} from "@/lib/api/supplier-items/api";
import { useListSuppliersQuery } from "@/lib/api/suppliers/api";
import { useGetUomsQuery } from "@/lib/api/system-settings/api";
import { useListWarehousesQuery } from "@/lib/api/warehouse/api";

type SupplierSection = "raw-material" | "indirect-raw-material" | "subcon";
type PageMode = "create" | "edit" | "view";

type FormValues = {
  supplier_uuid?: string;
  warehouse_uuid?: string;
  uniq_code?: string;
  sebango_code?: string;
  type?: string;
  product_model?: string;
  part_name?: string;
  part_number?: string;
  grade?: string;
  size?: string;
  uom?: string;
  quantity?: number;
  weight?: number;
  pcs_per_kanban?: number;
  customer_cycle?: string;
  description?: string;
  status?: string;
};

type BomOption = {
  value: string;
  label: string;
  productModel?: string;
  partName?: string;
  partNumber?: string;
  type?: string;
  grade?: string;
  size?: string;
  uom?: string;
  weight?: number;
};

const SECTION_OPTIONS: Array<{ label: string; value: SupplierSection }> = [
  { label: "Raw Material", value: "raw-material" },
  { label: "Indirect Raw Material", value: "indirect-raw-material" },
  { label: "SubCon", value: "subcon" },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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

const normalizeSection = (value: string | null): SupplierSection => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "indirect" || raw === "indirect-raw-material") return "indirect-raw-material";
  if (raw === "subcon" || raw === "sub-con") return "subcon";
  return "raw-material";
};

const sectionLabel = (section: SupplierSection) =>
  SECTION_OPTIONS.find((option) => option.value === section)?.label ?? "Raw Material";

const sectionApiValue = (section: SupplierSection) => {
  if (section === "indirect-raw-material") return "indirect_raw_material";
  if (section === "subcon") return "subcon";
  return "raw_material";
};

const sectionPayloadTypeValue = (section: SupplierSection) => {
  if (section === "indirect-raw-material") return "indirect";
  if (section === "subcon") return "subcon";
  return "raw_material";
};

const normalizeSupplierCategory = (value: unknown): SupplierSection => {
  const raw = pickText(value).toLowerCase();
  if (raw.includes("indirect")) return "indirect-raw-material";
  if (raw.includes("sub")) return "subcon";
  return "raw-material";
};

const resolveSupplierCategory = (supplier: Record<string, unknown>): SupplierSection =>
  normalizeSupplierCategory(
    pickText(
      supplier.material_category,
      supplier.materialCategory,
      supplier.category,
      supplier.type,
    )
  );

const formatSizeFromMaterialSpec = (materialSpec?: Record<string, unknown>): string => {
  if (!materialSpec) return "";

  const diameter = pickText(materialSpec.diameter_mm);
  const thickness = pickText(materialSpec.thickness_mm);
  const length = pickText(materialSpec.length_mm);
  const width = pickText(materialSpec.width_mm);

  const parts = [
    diameter ? `Ø${diameter}` : "",
    width ? `W${width}` : "",
    thickness ? `T${thickness}` : "",
    length ? `L${length}` : "",
  ].filter(Boolean);

  return parts.join(" x ");
};

const extractWeightFromMaterialSpec = (materialSpec?: Record<string, unknown>): number | undefined => {
  if (!materialSpec) return undefined;

  const candidates = [materialSpec.weight_kg, materialSpec.weight, materialSpec.unit_weight];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === "string") {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
};

const flattenBomTree = (nodes: BackendBomNode[]): BackendBomNode[] => {
  const flattened: BackendBomNode[] = [];

  const walk = (items: BackendBomNode[]) => {
    items.forEach((item) => {
      flattened.push(item);
      if (Array.isArray(item.children) && item.children.length > 0) walk(item.children);
    });
  };

  walk(nodes);
  return flattened;
};

const toBomOption = (node: BackendBomNode): BomOption | null => {
  const uniqCode = pickText(node.uniq_code, node.uniq);
  if (!uniqCode) return null;

  const materialSpec = isRecord(node.material_specifications)
    ? node.material_specifications
    : undefined;
  const size =
    pickText(
      materialSpec?.size,
      materialSpec?.material_size,
      materialSpec?.thickness,
    ) || formatSizeFromMaterialSpec(materialSpec);

  return {
    value: uniqCode,
    label: uniqCode,
    productModel: pickText((node as any).model, node.assembly_code),
    partName: pickText(node.part_name, node.description),
    partNumber: pickText(node.part_number),
    type: pickText(
      materialSpec?.material_type,
      materialSpec?.type,
      materialSpec?.item_type,
      materialSpec?.form,
      node.material_code,
    ),
    grade: pickText(materialSpec?.material_grade, materialSpec?.grade),
    size,
    uom: pickText(node.unit_measurement),
    weight: extractWeightFromMaterialSpec(materialSpec),
  };
};

function MasterSupplierCreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<FormValues>();

  const apiEnabled = Boolean(apiBaseUrl);
  const section = normalizeSection(searchParams.get("section"));
  const rawMode = String(searchParams.get("mode") ?? "create").toLowerCase();
  const mode: PageMode = rawMode === "edit" || rawMode === "view" ? (rawMode as PageMode) : "create";
  const readOnly = mode === "view";
  const itemId = String(searchParams.get("id") ?? "").trim();
  const isEditing = mode === "edit";

  const { data: suppliers = [], isLoading: suppliersLoading } = useListSuppliersQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: warehouses = [], isLoading: warehousesLoading } = useListWarehousesQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: uoms = [], isLoading: uomsLoading } = useGetUomsQuery(undefined, {
    skip: !apiEnabled,
  });
  const { data: bomTree } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });
  const detailQuery = useGetSupplierItemByIdQuery(itemId, {
    skip: !apiEnabled || mode === "create" || !itemId,
  });

  const [createSupplierItem, createState] = useCreateSupplierItemMutation();
  const [updateSupplierItem, updateState] = useUpdateSupplierItemMutation();

  const supplierOptions = useMemo(
    () =>
      suppliers
        .filter((supplier) => {
          const status = String(supplier.status ?? "active").trim().toLowerCase();
          const category = resolveSupplierCategory(supplier as Record<string, unknown>);
          return (!status || status === "active") && category === section;
        })
        .map((supplier) => {
          const value = pickText(
            supplier.supplier_uuid,
            supplier.uuid,
            supplier.id,
          );
          const supplierName = pickText(supplier.supplier_name);
          const supplierCode = pickText(supplier.supplier_code);
          const label =
            supplierCode && supplierName
              ? `${supplierCode} — ${supplierName}`
              : pickText(supplierName, supplierCode);
          if (!value || !label) return null;
          return {
            value,
            label,
            supplierCode,
          };
        })
        .filter((option): option is { value: string; label: string; supplierCode: string } => Boolean(option))
        .sort((left, right) => left.label.localeCompare(right.label)),
      [section, suppliers]
  );

  const uomOptions = useMemo(
    () =>
      uoms
        .map((uom) => {
          const value = pickText(uom.name, uom.unit_name, uom.code, uom.unit_code);
          if (!value) return null;
          return { label: value, value };
        })
        .filter((option): option is { label: string; value: string } => Boolean(option))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [uoms],
  );

  const warehouseOptions = useMemo(
    () =>
      warehouses
        .map((warehouse) => {
          const value = pickText(warehouse.id, warehouse.warehouse_uuid);
          const label = pickText(warehouse.warehouse_name);
          if (!value || !label) return null;
          return {
            value,
            label,
            type: pickText(warehouse.type_warehouse),
          };
        })
        .filter((option): option is { value: string; label: string; type: string } => Boolean(option))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [warehouses]
  );

  const bomOptions = useMemo(() => {
    const items = flattenBomTree(bomTree?.data ?? []);
    const mapped = items.map(toBomOption).filter((option): option is BomOption => Boolean(option));
    const deduped = new Map<string, BomOption>();

    mapped.forEach((option) => {
      if (!deduped.has(option.value)) deduped.set(option.value, option);
    });

    return Array.from(deduped.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [bomTree]);

  const selectedSupplierId = Form.useWatch("supplier_uuid", form);
  const selectedWarehouseId = Form.useWatch("warehouse_uuid", form);

  const selectedSupplier = useMemo(
    () => supplierOptions.find((option) => option.value === selectedSupplierId),
    [selectedSupplierId, supplierOptions]
  );
  const selectedWarehouse = useMemo(
    () => warehouseOptions.find((option) => option.value === selectedWarehouseId),
    [selectedWarehouseId, warehouseOptions]
  );

  useEffect(() => {
    if (!detailQuery.data) return;

    form.setFieldsValue({
      supplier_uuid: pickText(detailQuery.data.supplier_uuid),
      warehouse_uuid: pickText(detailQuery.data.warehouse_uuid, detailQuery.data.warehouse_id),
      uniq_code: pickText(detailQuery.data.uniq_code),
      sebango_code: pickText(detailQuery.data.sebango_code),
      type: pickText(detailQuery.data.type),
      product_model: pickText(detailQuery.data.product_model),
      part_name: pickText(detailQuery.data.part_name),
      part_number: pickText(detailQuery.data.part_number),
      grade: pickText(detailQuery.data.grade),
      size: pickText(detailQuery.data.size),
      uom: pickText(detailQuery.data.uom),
      quantity: Number(detailQuery.data.quantity ?? 0),
      weight: Number(detailQuery.data.weight ?? 0),
      pcs_per_kanban: Number(detailQuery.data.pcs_per_kanban ?? 0),
      customer_cycle: pickText(detailQuery.data.customer_cycle),
      description: pickText(detailQuery.data.description),
      status: pickText(detailQuery.data.status) || "active",
    });
  }, [detailQuery.data, form]);

  const handleUniqChange = (value: string) => {
    const matched = bomOptions.find((option) => option.value === value);
    if (!matched) return;

    const matchedUom = matched.uom
      ? uomOptions.find((option) => option.value.toLowerCase() === matched.uom?.toLowerCase())
      : undefined;

    form.setFieldsValue({
      uniq_code: matched.value,
      product_model: matched.productModel,
      part_name: matched.partName,
      part_number: matched.partNumber,
      type: matched.type,
      grade: matched.grade,
      size: matched.size,
      uom: matchedUom?.value,
      weight: matched.weight,
      description: form.getFieldValue("description") || matched.partName,
    });
  };

  const handleSave = async () => {
    if (!apiEnabled) {
      messageApi.warning("Set NEXT_PUBLIC_API_URL before saving supplier items.");
      return;
    }

    try {
      const values = await form.validateFields();
      const payload: SupplierItemMutationRequest = {
        supplier_uuid: pickText(values.supplier_uuid),
        sebango_code: pickText(values.sebango_code),
        uniq_code: pickText(values.uniq_code),
        type: sectionPayloadTypeValue(section),
        description: pickText(values.description, values.part_name, values.uniq_code),
        quantity: String(values.quantity ?? 0),
        uom: pickText(values.uom),
        weight: String(values.weight ?? 0),
        pcs_per_kanban: String(values.pcs_per_kanban ?? 0),
        customer_cycle: pickText(values.customer_cycle),
        status: pickText(values.status) || pickText(detailQuery.data?.status) || "active",
      };

      if (isEditing) {
        await updateSupplierItem({ id: itemId, body: payload }).unwrap();
        messageApi.success("Supplier item updated");
      } else {
        await createSupplierItem(payload).unwrap();
        messageApi.success("Supplier item created");
      }

      router.push("/master-supplier");
    } catch (saveError) {
      if (isRecord(saveError) && Array.isArray(saveError.errorFields)) {
        messageApi.error("Please complete all required fields");
        return;
      }
      messageApi.error(getApiErrorMessage(saveError, "Failed to save supplier item"));
    }
  };

  const pageTitle =
    mode === "view" ? "View Supplier Item" : mode === "edit" ? "Edit Supplier Item" : "Create Supplier Item";
  const pageSubtitle = `${sectionLabel(section)} • ${mode === "create" ? "new entry" : `mode: ${mode}`}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {contextHolder}

      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.push("/master-supplier")}>
              Back to Master Supplier
            </Button>
            <Typography.Title level={3} className="!mb-1 !mt-2">
              {pageTitle}
            </Typography.Title>
            <Space wrap>
              <Typography.Text type="secondary">{pageSubtitle}</Typography.Text>
              <Tag color={section === "subcon" ? "orange" : section === "indirect-raw-material" ? "purple" : "blue"}>
                {sectionLabel(section)}
              </Tag>
              {readOnly ? <Tag>Read only</Tag> : null}
            </Space>
          </div>

          <Space>
            <Button onClick={() => router.push("/master-supplier")}>Cancel</Button>
            {!readOnly ? (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={createState.isLoading || updateState.isLoading}
                onClick={handleSave}
              >
                {isEditing ? "Update" : "Save"}
              </Button>
            ) : null}
          </Space>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-6 space-y-6">
        {!apiEnabled ? (
          <Alert
            type="warning"
            showIcon
            message="Backend is not configured"
            description="Set NEXT_PUBLIC_API_URL to enable supplier item create, edit, and view operations."
          />
        ) : null}

        {apiEnabled && detailQuery.error ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load supplier item"
            description={getApiErrorMessage(detailQuery.error, "Unable to fetch supplier item detail")}
          />
        ) : null}

        {apiEnabled && (detailQuery.isLoading || (suppliersLoading && mode !== "view") || warehousesLoading || uomsLoading) ? (
          <Card className="rounded-2xl border border-gray-100 shadow-sm">
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        ) : null}

        {(!apiEnabled || !detailQuery.isLoading) && (!apiEnabled || !detailQuery.error) ? (
          <>
            <Card className="rounded-2xl border border-gray-100 shadow-sm">
              <Descriptions title="Selection Summary" column={{ xs: 1, md: 3 }}>
                <Descriptions.Item label="Supplier">{selectedSupplier?.label ?? "-"}</Descriptions.Item>
                <Descriptions.Item label="Warehouse">{selectedWarehouse?.label ?? "-"}</Descriptions.Item>
                <Descriptions.Item label="Material Section">{sectionLabel(section)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card className="rounded-2xl border border-gray-100 shadow-sm">
              <Form form={form} layout="vertical" disabled={readOnly}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Form.Item
                    label="Supplier"
                    name="supplier_uuid"
                    rules={[{ required: true, message: "Please select a supplier" }]}
                  >
                    <Select
                      showSearch
                      placeholder="Select supplier"
                      options={supplierOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>

                  <Form.Item
                    label="Warehouse"
                    name="warehouse_uuid"
                    rules={[{ required: true, message: "Please select a warehouse" }]}
                  >
                    <Select
                      showSearch
                      placeholder="Select warehouse"
                      options={warehouseOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>

                  <Form.Item
                    label="Sebango Code"
                    name="uniq_code"
                    rules={[{ required: true, message: "Please select a Sebango Code" }]}
                  >
                    <Select
                      showSearch
                      placeholder="Select UNIQ code from BOM"
                      options={bomOptions}
                      optionFilterProp="label"
                      onChange={handleUniqChange}
                    />
                  </Form.Item>

                  <Form.Item
                    label="Material Code"
                    name="sebango_code"
                    rules={[{ required: true, message: "Please input material code" }]}
                  >
                    <Input placeholder="Enter material code" />
                  </Form.Item>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Form.Item label="Type of Material" name="type">
                    <Input placeholder="Auto-filled from BOM material spec" />
                  </Form.Item>
                  <Form.Item label="Product Model" name="product_model">
                    <Input placeholder="Auto-filled from BOM" />
                  </Form.Item>
                  <Form.Item label="Part Name" name="part_name">
                    <Input placeholder="Auto-filled from BOM" />
                  </Form.Item>
                  <Form.Item label="Part Number" name="part_number">
                    <Input placeholder="Auto-filled from BOM" />
                  </Form.Item>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Form.Item label="Grade" name="grade">
                    <Input placeholder="Auto-filled from BOM" />
                  </Form.Item>
                  <Form.Item label="Size" name="size">
                    <Input placeholder="Auto-filled from BOM" />
                  </Form.Item>
                  <Form.Item label="UOM" name="uom">
                    <Select
                      showSearch
                      placeholder="Select UOM from system setting"
                      options={uomOptions}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item
                    label="Quantity"
                    name="quantity"
                    rules={[{ required: true, message: "Please input quantity" }]}
                  >
                    <InputNumber min={0} className="w-full" placeholder="Enter quantity" />
                  </Form.Item>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Form.Item
                    label="Weight"
                    name="weight"
                    rules={[{ required: true, message: "Please input weight" }]}
                  >
                    <InputNumber min={0} className="w-full" placeholder="Enter weight" />
                  </Form.Item>
                  <Form.Item
                    label="Pcs per Kanban"
                    name="pcs_per_kanban"
                    rules={[{ required: true, message: "Please input pcs per kanban" }]}
                  >
                    <InputNumber min={0} className="w-full" placeholder="Enter pcs per kanban" />
                  </Form.Item>
                  <Form.Item
                    label="Customer Cycle"
                    name="customer_cycle"
                    rules={[{ required: true, message: "Please input customer cycle" }]}
                  >
                    <Input placeholder="e.g. Daily / Weekly / Monthly" />
                  </Form.Item>
                  <Form.Item label="Description" name="description">
                    <Input placeholder="Optional description" />
                  </Form.Item>
                  <Form.Item label="Status" name="status" initialValue="active">
                    <Select
                      options={[
                        { label: "Active", value: "active" },
                        { label: "Inactive", value: "inactive" },
                      ]}
                    />
                  </Form.Item>
                </div>
              </Form>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function MasterSupplierCreatePage() {
  return (
    <Suspense fallback={null}>
      <MasterSupplierCreatePageContent />
    </Suspense>
  );
}
