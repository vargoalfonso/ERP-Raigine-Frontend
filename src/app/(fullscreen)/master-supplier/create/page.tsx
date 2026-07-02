"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
  useGetBomByIdQuery,
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
import { setFlashMessage } from "@/lib/utils/flashMessage";
import {
  focusFirstInvalidField,
  getValidationMessage,
  isAntdFormValidationError,
} from "@/lib/utils/formValidation";

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
  percentage?: number;
  customer_cycle?: string;
  description?: string;
  status?: string;
};

type BomOption = {
  value: string;
  label: string;
  lookupId?: string;
  productModel?: string;
  partName?: string;
  partNumber?: string;
  type?: string;
  grade?: string;
  size?: string;
  uom?: string;
  weight?: number;
  quantity?: number;
  customerCycle?: string;
  description?: string;
  status?: string;
  materialCode?: string;
};

type SupplierOption = {
  value: string;
  label: string;
  supplierCode: string;
  queryValue: string;
  matchValues: string[];
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
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "indirect" || raw === "indirect-raw-material")
    return "indirect-raw-material";
  if (raw === "subcon" || raw === "sub-con") return "subcon";
  return "raw-material";
};

const sectionLabel = (section: SupplierSection) =>
  SECTION_OPTIONS.find((option) => option.value === section)?.label ??
  "Raw Material";

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

const sectionToMaterialCategory = (section: SupplierSection): string => {
  if (section === "indirect-raw-material") return "Indirect Raw Material";
  if (section === "subcon") return "Subcon";
  return "Raw Material";
};

const sectionToTypeMaterial = (section: SupplierSection): string => {
  if (section === "indirect-raw-material") return "indirect";
  if (section === "subcon") return "subcon";
  return "raw";
};

const sectionMatchesTypeMaterial = (section: SupplierSection, typeMaterial: string | undefined): boolean => {
  if (!typeMaterial) return false;
  const t = typeMaterial.toLowerCase();
  if (section === "raw-material") return t === "raw" || t === "raw_material";
  if (section === "indirect-raw-material") return t === "indirect" || t === "indirect_raw_material";
  if (section === "subcon") return t === "subcon";
  return false;
};

const normalizeSupplierCategory = (value: unknown): SupplierSection => {
  const raw = pickText(value).toLowerCase();
  if (raw.includes("indirect")) return "indirect-raw-material";
  if (raw.includes("sub")) return "subcon";
  return "raw-material";
};

const resolveSupplierCategory = (
  supplier: Record<string, unknown>,
): SupplierSection =>
  normalizeSupplierCategory(
    pickText(
      supplier.material_category,
      supplier.materialCategory,
      supplier.category,
      supplier.type,
    ),
  );

const formatSizeFromMaterialSpec = (
  materialSpec?: Record<string, unknown>,
): string => {
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

const extractWeightFromMaterialSpec = (
  materialSpec?: Record<string, unknown>,
): number | undefined => {
  if (!materialSpec) return undefined;

  const candidates = [
    materialSpec.weight_kg,
    materialSpec.weight,
    materialSpec.unit_weight,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate))
      return candidate;
    if (typeof candidate === "string") {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
};

const extractNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const normalizeFormStatus = (value: unknown): string | undefined => {
  const raw = pickText(value).toLowerCase();
  if (raw === "active" || raw === "released") return "active";
  if (raw === "inactive" || raw === "obsolete") return "inactive";
  return undefined;
};

const resolveMaterialSpec = (node: BackendBomNode): Record<string, unknown> | undefined => {
  return isRecord(node.material_specifications)
    ? node.material_specifications
    : isRecord((node as Record<string, unknown>).material_spec)
      ? ((node as Record<string, unknown>).material_spec as Record<string, unknown>)
      : undefined;
};


const findNodeByUniq = (node: BackendBomNode | undefined, uniqCode: string): BackendBomNode | null => {
  if (!node) return null;
  if (pickText(node.uniq_code, node.uniq) === uniqCode) return node;

  if (!Array.isArray(node.children)) return null;
  for (const child of node.children) {
    const found = findNodeByUniq(child, uniqCode);
    if (found) return found;
  }

  return null;
};

const flattenBomTree = (nodes: BackendBomNode[]): BackendBomNode[] => {
  const flattened: BackendBomNode[] = [];

  const walk = (items: BackendBomNode[]) => {
    items.forEach((item) => {
      flattened.push(item);
      if (Array.isArray(item.children) && item.children.length > 0)
        walk(item.children);
    });
  };

  walk(nodes);
  return flattened;
};


const toBomOption = (node: BackendBomNode): BomOption | null => {
  const uniqCode = pickText(node.uniq_code, node.uniq);
  if (!uniqCode) return null;

  const materialSpec = resolveMaterialSpec(node);
  const size =
    pickText(
      materialSpec?.size,
      materialSpec?.material_size,
      materialSpec?.thickness,
    ) || formatSizeFromMaterialSpec(materialSpec);

  return {
    value: uniqCode,
    label: uniqCode,
    lookupId: pickText(node.bom_id) || undefined,
    productModel: pickText((node as any).model, node.assembly_code),
    partName: pickText(node.part_name, node.description),
    partNumber: pickText(node.part_number),
    type: pickText(
      materialSpec?.type_material,
      materialSpec?.material_type,
      materialSpec?.type,
      materialSpec?.item_type,
      materialSpec?.form,
      node.material_code,
    ),
    grade: pickText(materialSpec?.material_grade, materialSpec?.grade),
    size,
    uom: pickText(node.unit_measurement, (node as Record<string, unknown>).uom),
    weight: extractWeightFromMaterialSpec(materialSpec),
    quantity: extractNumber(node.quantity, node.qpu, (node as Record<string, unknown>).qty_per_uniq),
    customerCycle: pickText(materialSpec?.customer_cycle),
    description: pickText(node.description, node.part_name),
    status: pickText((node as Record<string, unknown>).status, (node as Record<string, unknown>).bom_status),
    materialCode: pickText(materialSpec?.material_code, materialSpec?.material_grade, (node as Record<string, unknown>).material_code),
  };
};

// Match BOM's uom string (e.g. "PCS") against UOM options by name first, then by code.
const resolveUomValue = (
  raw: string,
  uoms: import("@/lib/api/system-settings/api").UomRecord[],
  uomOptions: { value: string; label: string }[],
): string | undefined => {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  // 1. Direct match on option value or label (e.g. "Pieces" === "Pieces")
  const byName = uomOptions.find(
    (o) => o.value.toLowerCase() === lower || o.label.toLowerCase() === lower,
  );
  if (byName) return byName.value;
  // 2. Match by UOM code field (e.g. "PCS" → code "PCS" → name "Pieces")
  const byCode = uoms.find(
    (u) =>
      u.code?.toLowerCase() === lower || u.unit_code?.toLowerCase() === lower,
  );
  if (byCode) {
    const name = byCode.name ?? byCode.unit_name ?? byCode.code ?? byCode.unit_code ?? "";
    const opt = uomOptions.find((o) => o.value === name);
    if (opt) return opt.value;
  }
  return undefined;
};

function MasterSupplierCreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<FormValues>();
  const [selectedBomLookupId, setSelectedBomLookupId] = useState("");
  const [selectedUniqCode, setSelectedUniqCode] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>();
  const [selectedBomOption, setSelectedBomOption] = useState<BomOption | null>(null);

  const apiEnabled = Boolean(apiBaseUrl);
  const section = normalizeSection(searchParams.get("section"));
  const rawMode = String(searchParams.get("mode") ?? "create").toLowerCase();
  const mode: PageMode =
    rawMode === "edit" || rawMode === "view" ? (rawMode as PageMode) : "create";
  const readOnly = mode === "view";
  const itemId = String(searchParams.get("id") ?? "").trim();
  const isEditing = mode === "edit";
  const autofilled = Boolean(selectedUniqCode);

  const [uniqSearch, setUniqSearch] = useState("");
  const [debouncedUniqSearch, setDebouncedUniqSearch] = useState("");
  const [uniqPage, setUniqPage] = useState(1);
  const [accumulatedBomItems, setAccumulatedBomItems] = useState<BackendBomNode[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUniqSearch(uniqSearch), 400);
    return () => clearTimeout(timer);
  }, [uniqSearch]);

  // Reset pagination whenever search term or supplier changes
  useEffect(() => {
    setUniqPage(1);
    setAccumulatedBomItems([]);
  }, [debouncedUniqSearch, selectedSupplierId]);

  const { data: suppliers = [], isLoading: suppliersLoading } =
    useListSuppliersQuery(
      { material_category: sectionToMaterialCategory(section), status: "Active", limit: 1000 },
      { skip: !apiEnabled },
    );
  const { data: warehouses = [], isLoading: warehousesLoading } =
    useListWarehousesQuery(undefined, {
      skip: !apiEnabled,
    });
  const { data: uoms = [], isLoading: uomsLoading } = useGetUomsQuery(
    undefined,
    {
      skip: !apiEnabled,
    },
  );

  const BOM_PAGE_SIZE = 10;

  const { data: bomPageResult, isFetching: bomSearchFetching } = useGetBomTreeQuery(
    {
      search: debouncedUniqSearch || undefined,
      type_material: sectionToTypeMaterial(section),
      exclude_supplier_uuid: selectedSupplierId || undefined,
      page: uniqPage,
      limit: BOM_PAGE_SIZE,
    },
    { skip: !apiEnabled },
  );

  // Accumulate pages — replace on page 1, append on subsequent pages
  useEffect(() => {
    const newItems = flattenBomTree(bomPageResult?.data?.items ?? []).filter(
      (node) => sectionMatchesTypeMaterial(section, node.type_material),
    );
    if (newItems.length === 0) return;
    setAccumulatedBomItems((prev) => {
      if (uniqPage === 1) return newItems;
      const existingCodes = new Set(prev.map((n) => pickText(n.uniq_code, n.uniq)));
      return [...prev, ...newItems.filter((n) => !existingCodes.has(pickText(n.uniq_code, n.uniq)))];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomPageResult?.data?.items]);

  const bomDetailQuery = useGetBomByIdQuery(selectedBomLookupId, {
    skip: !apiEnabled || !selectedBomLookupId,
  });
  const detailQuery = useGetSupplierItemByIdQuery(itemId, {
    skip: !apiEnabled || mode === "create" || !itemId,
  });

  const [createSupplierItem, createState] = useCreateSupplierItemMutation();
  const [updateSupplierItem, updateState] = useUpdateSupplierItemMutation();

  const supplierOptions = useMemo<SupplierOption[]>(
    () =>
      suppliers
        .map((supplier) => {
          const value = pickText(supplier.supplier_uuid, supplier.uuid, supplier.id);
          const supplierName = pickText(supplier.supplier_name);
          const supplierCode = pickText(supplier.supplier_code);
          const matchValues = [
            pickText(supplier.supplier_uuid, supplier.uuid, supplier.id),
            supplierName,
            supplierCode,
          ]
            .filter(Boolean)
            .map((entry) => entry.toLowerCase());
          const label =
            supplierCode && supplierName
              ? `${supplierCode} — ${supplierName}`
              : pickText(supplierName, supplierCode);
          if (!value || !label) return null;
          return { value, label, supplierCode, queryValue: value, matchValues };
        })
        .filter((option): option is SupplierOption => Boolean(option))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [suppliers],
  );

  const selectedSupplier = useMemo(
    () => supplierOptions.find((option) => option.value === selectedSupplierId),
    [selectedSupplierId, supplierOptions],
  );

  const uomOptions = useMemo(
    () =>
      uoms
        .map((uom) => {
          const value = pickText(
            uom.name,
            uom.unit_name,
            uom.code,
            uom.unit_code,
          );
          if (!value) return null;
          return { label: value, value };
        })
        .filter((option): option is { label: string; value: string } =>
          Boolean(option),
        )
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
        .filter(
          (option): option is { value: string; label: string; type: string } =>
            Boolean(option),
        )
        .sort((left, right) => left.label.localeCompare(right.label)),
    [warehouses],
  );

  const bomOptions = useMemo(() => {
    const mapped = accumulatedBomItems
      .map((node) => {
        const opt = toBomOption(node as any);
        if (!opt) return null;
        // Consider node a parent/top-level when it has no parent pointer or level indicates top (1)
        const hasParentPointer = Boolean((node as any).parent_id ?? (node as any).parentId ?? (node as any).parent_uuid ?? (node as any).parentUuid);
        const levelNum = typeof (node as any).level === "number" ? (node as any).level : undefined;
        const isParent = !hasParentPointer || levelNum === 1;
        return { ...(opt as BomOption), _isParent: Boolean(isParent) } as BomOption & { _isParent: boolean };
      })
      .filter((option): option is BomOption & { _isParent: boolean } => option !== null);
    const deduped = new Map<string, BomOption>();
    mapped.forEach((option) => {
      if (!deduped.has(option.value)) deduped.set(option.value, option);
    });
    return Array.from(deduped.values());
  }, [accumulatedBomItems]);

  const handleUniqPopupScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const nearBottom = target.scrollTop + target.offsetHeight >= target.scrollHeight - 40;
    const canLoadMore = !bomSearchFetching && uniqPage < (bomPageResult?.data?.totalPages ?? 1);
    if (nearBottom && canLoadMore) {
      setUniqPage((prev) => prev + 1);
    }
  };

  const selectedWarehouseId = Form.useWatch("warehouse_uuid", form);

  const selectedWarehouse = useMemo(
    () =>
      warehouseOptions.find((option) => option.value === selectedWarehouseId),
    [selectedWarehouseId, warehouseOptions],
  );

  useEffect(() => {
    if (!detailQuery.data) return;

    setSelectedSupplierId(pickText(detailQuery.data.supplier_uuid) || undefined);
    form.setFieldsValue({
      supplier_uuid: pickText(detailQuery.data.supplier_uuid),
      warehouse_uuid: pickText(
        detailQuery.data.warehouse_uuid,
        detailQuery.data.warehouse_id,
      ),
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
      percentage: detailQuery.data.percentage !== undefined && detailQuery.data.percentage !== null
        ? Number(detailQuery.data.percentage)
        : undefined,
      customer_cycle: pickText(detailQuery.data.customer_cycle),
      description: pickText(detailQuery.data.description),
      status: pickText(detailQuery.data.status) || "active",
    });
  }, [detailQuery.data, form]);

  const handleSupplierChange = (value?: string) => {
    setSelectedSupplierId(value);
    setSelectedUniqCode("");
    setSelectedBomOption(null);
    setSelectedBomLookupId("");
    form.setFieldsValue({
      uniq_code: undefined,
      product_model: undefined,
      part_name: undefined,
      part_number: undefined,
      type: undefined,
      grade: undefined,
      size: undefined,
      uom: undefined,
      weight: undefined,
      customer_cycle: undefined,
    });
  };

  const handleUniqChange = (value: string, optionFromSelect?: BomOption | BomOption[]) => {
    const opt = Array.isArray(optionFromSelect) ? optionFromSelect[0] : optionFromSelect;
    const matched = opt ?? bomOptions.find((option) => option.value === value);
    if (!matched) return;

    setSelectedUniqCode(value);
    setSelectedBomLookupId(matched.lookupId ?? "");
    setSelectedBomOption({ ...matched, label: matched.value });

    const rawUom = matched.uom?.trim() ?? "";
    const resolvedUom = resolveUomValue(rawUom, uoms, uomOptions);

    console.log("[handleUniqChange] selected:", {
      value,
      rawUom,
      resolvedUom,
      lookupId: matched.lookupId,
      option_value: matched.value,
      option_label: matched.label,
      type: matched.type,
      productModel: matched.productModel,
      partName: matched.partName,
      uom: matched.uom,
      currentFormUniq: form.getFieldValue("uniq_code"),
    });

    form.setFieldsValue({
      uniq_code: matched.value,
      product_model: matched.productModel,
      part_name: matched.partName,
      part_number: matched.partNumber,
      type: matched.type,
      grade: matched.grade,
      size: matched.size,
      quantity: matched.quantity,
      weight: matched.weight,
      customer_cycle: matched.customerCycle,
      description: matched.description || matched.partName,
      status: normalizeFormStatus(matched.status) ?? form.getFieldValue("status") ?? "active",
    });

    // Also set material code (sebango) when available for raw/indirect sections only
    try {
      const matCode = matched.materialCode ?? "";
      if (matCode && section !== "subcon") form.setFieldValue("sebango_code", matCode);
    } catch (e) {
      // ignore
    }

    // Defer UOM so it runs after React effects (bomDetailQuery effect may override if not deferred)
    setTimeout(() => {
      console.log("[handleUniqChange] setFieldValue uom (deferred):", resolvedUom);
      if (resolvedUom) form.setFieldValue("uom", resolvedUom);
    }, 0);
  };

  useEffect(() => {
    const bomDetailRoot = bomDetailQuery.data?.data;
    if (!bomDetailRoot || !selectedUniqCode) return;

    const bomDetail = findNodeByUniq(bomDetailRoot, selectedUniqCode);
    if (!bomDetail) return;

    const materialSpec = resolveMaterialSpec(bomDetail);

    form.setFieldsValue({
      uniq_code: pickText(bomDetail.uniq_code, bomDetail.uniq),
      product_model: pickText((bomDetail as Record<string, unknown>).model, bomDetail.assembly_code),
      part_name: pickText(bomDetail.part_name, bomDetail.description),
      part_number: pickText(bomDetail.part_number),
      type: pickText(
        materialSpec?.type_material,
        materialSpec?.material_type,
        materialSpec?.type,
        materialSpec?.item_type,
        materialSpec?.form,
        bomDetail.material_code,
      ),
      grade: pickText(materialSpec?.material_grade, materialSpec?.grade),
      size:
        pickText(materialSpec?.size, materialSpec?.material_size, materialSpec?.thickness) ||
        formatSizeFromMaterialSpec(materialSpec),
      quantity: extractNumber(bomDetail.quantity, bomDetail.qpu, (bomDetail as Record<string, unknown>).qty_per_uniq),
      weight: extractWeightFromMaterialSpec(materialSpec),
      customer_cycle: pickText(materialSpec?.customer_cycle),
      description: pickText(bomDetail.description, bomDetail.part_name, bomDetail.uniq_code),
      status: normalizeFormStatus((bomDetail as Record<string, unknown>).status ?? (bomDetail as Record<string, unknown>).bom_status) ?? form.getFieldValue("status") ?? "active",
    });
  }, [bomDetailQuery.data, form, selectedUniqCode]);

  const handleSave = async () => {
    if (!apiEnabled) {
      messageApi.warning(
        "Set NEXT_PUBLIC_API_URL before saving supplier items.",
      );
      return;
    }

    try {
      const values = await form.validateFields();
      const payload: SupplierItemMutationRequest = {
        supplier_uuid: pickText(values.supplier_uuid),
        sebango_code: pickText(values.sebango_code),
        uniq_code: pickText(values.uniq_code),
        type: sectionPayloadTypeValue(section),
        description: pickText(
          values.description,
          values.part_name,
          values.uniq_code,
        ),
        quantity: String(values.quantity ?? 0),
        uom: pickText(values.uom),
        weight: String(values.weight ?? 0),
        pcs_per_kanban: String(values.pcs_per_kanban ?? 0),
        customer_cycle: pickText(values.customer_cycle),
        status:
          pickText(values.status) ||
          pickText(detailQuery.data?.status) ||
          "active",
      };

      // preserve optional `percentage` form field in outgoing payload when present
      const percentageValue = values.percentage !== undefined ? String(values.percentage) : undefined;
      const payloadAny = percentageValue !== undefined ? ({ ...payload, percentage: percentageValue } as any) : payload;

      if (isEditing) {
        await updateSupplierItem({ id: itemId, body: payloadAny as SupplierItemMutationRequest }).unwrap();
        setFlashMessage({
          type: "success",
          content: "Supplier item updated",
          targetPath: "/master-supplier",
        });
      } else {
        await createSupplierItem(payloadAny as SupplierItemMutationRequest).unwrap();
        setFlashMessage({
          type: "success",
          content: "Supplier item created",
          targetPath: "/master-supplier",
        });
      }

      router.push("/master-supplier");
    } catch (saveError) {
      if (isAntdFormValidationError(saveError)) {
        focusFirstInvalidField(form, saveError);
        messageApi.error(
          getValidationMessage(saveError, {
            fallback: "Please complete all required fields.",
          }),
        );
        return;
      }
      messageApi.error(
        getApiErrorMessage(saveError, "Failed to save supplier item"),
      );
    }
  };

  const pageTitle =
    mode === "view"
      ? "View Supplier Item"
      : mode === "edit"
        ? "Edit Supplier Item"
        : "Create Supplier Item";
  const pageSubtitle = `${sectionLabel(section)} • ${mode === "create" ? "new entry" : `mode: ${mode}`}`;

  return (
    <div className="min-h-screen bg-[#eef4ff] pb-10">
      {contextHolder}

      <div className="border-b border-[#dbe5f3] bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 flex-wrap">
          <div>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push("/master-supplier")}>
              Back to Master Supplier
            </Button>
            <Typography.Title level={3} className="!mb-1 !mt-2">
              {pageTitle}
            </Typography.Title>
            <Space wrap>
              <Typography.Text type="secondary">{pageSubtitle}</Typography.Text>
              <Tag
                color={
                  section === "subcon"
                    ? "orange"
                    : section === "indirect-raw-material"
                      ? "purple"
                      : "blue"
                }>
                {sectionLabel(section)}
              </Tag>
              {readOnly ? <Tag>Read only</Tag> : null}
            </Space>
          </div>

          <Space>
            <Button onClick={() => router.push("/master-supplier")}>
              Cancel
            </Button>
            {!readOnly ? (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={createState.isLoading || updateState.isLoading}
                onClick={handleSave}>
                {isEditing ? "Update" : "Save"}
              </Button>
            ) : null}
          </Space>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-6 space-y-6">
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
            description={getApiErrorMessage(
              detailQuery.error,
              "Unable to fetch supplier item detail",
            )}
          />
        ) : null}

        {apiEnabled &&
        (detailQuery.isLoading ||
          (suppliersLoading && mode !== "view") ||
          warehousesLoading ||
          uomsLoading) ? (
          <Card className="rounded-2xl border border-gray-100 shadow-sm">
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        ) : null}

        <Form form={form} layout="vertical" disabled={readOnly}>
        {(!apiEnabled || !detailQuery.isLoading) &&
        (!apiEnabled || !detailQuery.error) ? (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-6">
                <Card className="overflow-hidden rounded-2xl border border-[#dfe8f5] shadow-sm">
                  <div className="flex items-start justify-between gap-4 border-b border-[#eef2f6] pb-5">
                    <div>
                      <Typography.Title level={4} className="!mb-1">
                        Step 1: Select Supplier
                      </Typography.Title>
                      <Typography.Text type="secondary">
                        Configure supplier details
                      </Typography.Text>
                    </div>
                    <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#316cff]">
                      Required
                    </span>
                  </div>

                  <div className="mt-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Form.Item
                        label="Supplier Name"
                        name="supplier_uuid"
                        rules={[
                          { required: true, message: "Please select a supplier" },
                        ]}
                      >
                        <Select
                          size="large"
                          showSearch
                          placeholder="Select supplier"
                          options={supplierOptions}
                          optionFilterProp="label"
                          onChange={handleSupplierChange}
                        />
                      </Form.Item>

                      <Form.Item label="Supplier ID">
                        <Input
                          size="large"
                          value={selectedSupplier?.supplierCode || selectedSupplier?.value || ""}
                          placeholder="Auto-filled from supplier selection"
                          disabled
                        />
                      </Form.Item>

                      <Form.Item
                        label="Warehouse"
                        name="warehouse_uuid"
                        rules={[
                          { required: true, message: "Please select a warehouse" },
                        ]}
                      >
                        <Select
                          size="large"
                          showSearch
                          placeholder="Select warehouse"
                          options={warehouseOptions}
                          optionFilterProp="label"
                        />
                      </Form.Item>
                    </div>
                  </div>
                </Card>

                <Card className="overflow-hidden rounded-2xl border border-[#dfe8f5] shadow-sm">
                  <div className="flex items-start justify-between gap-4 border-b border-[#eef2f6] pb-5">
                    <div>
                      <Typography.Title level={4} className="!mb-1">
                        Step 2: Input Data
                      </Typography.Title>
                      <Typography.Text type="secondary">
                        Configure product codes and identification information
                      </Typography.Text>
                    </div>
                    <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#316cff]">
                      Required
                    </span>
                  </div>

                  <div className="mt-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Form.Item
                        label="Uniq / Sebanggo"
                        name="uniq_code"
                        rules={[
                          {
                            required: true,
                            message: "Please select a Sebango Code",
                          },
                        ]}
                      >
                        <Select
                          size="large"
                          showSearch
                          filterOption={false}
                          placeholder="Search or scroll to browse..."
                          options={(() => {
                            const toSelectOpt = (option: BomOption & { _isParent?: boolean }) => ({
                              ...option,
                              label:
                                section === "subcon"
                                  ? [option.label, option.partName, option.productModel].filter(Boolean).join(" — ")
                                  : [option.materialCode || "tidak ada", option.partName, option.productModel]
                                      .filter(Boolean)
                                      .join(" — "),
                            });

                            const list = bomOptions
                              .filter((o: BomOption & { _isParent?: boolean }) =>
                                section === "subcon" ? Boolean((o as any)._isParent) : true
                              )
                              .map(toSelectOpt);

                            if (
                              selectedBomOption &&
                              !list.some((o) => o.value === selectedBomOption.value)
                            ) {
                              // include selected option even if filtered out
                              list.unshift(toSelectOpt(selectedBomOption as BomOption & { _isParent?: boolean }));
                            }
                            return list;
                          })()}
                          onSearch={setUniqSearch}
                          onChange={(val, opt) => handleUniqChange(val as string, opt as BomOption | BomOption[])}
                          onPopupScroll={handleUniqPopupScroll}
                          loading={bomSearchFetching}
                          disabled={readOnly || !selectedSupplierId}
                          
                          notFoundContent={bomSearchFetching ? "Loading..." : "No items found"}
                        />
                      </Form.Item>

                      <Form.Item label="Product Model" name="product_model">
                        <Input size="large" placeholder="Auto-filled from BOM" disabled={autofilled} />
                      </Form.Item>

                      <Form.Item label="Part Name" name="part_name">
                        <Input size="large" placeholder="Auto-filled from BOM" disabled={autofilled} />
                      </Form.Item>

                      <Form.Item label="Part Number" name="part_number">
                        <Input size="large" placeholder="Auto-filled from BOM" disabled={autofilled} />
                      </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Form.Item
                        label="Material Code"
                        name="sebango_code"
                        rules={[
                          { required: true, message: "Please input material code" },
                        ]}
                      >
                        <Input
                          size="large"
                          placeholder="Enter material code"
                          onChange={(e) => console.log("[sebango_code] onChange:", e.target.value)}
                        />
                      </Form.Item>

                      <Form.Item label="Grade" name="grade">
                        <Input size="large" placeholder="Auto-filled grade" disabled={autofilled} />
                      </Form.Item>

                      <Form.Item label="Size" name="size">
                        <Input size="large" placeholder="Auto-filled size" disabled={autofilled} />
                      </Form.Item>

                      <Form.Item label="UOM" name="uom">
                        <Select
                          size="large"
                          showSearch
                          placeholder="Select UOM"
                          options={uomOptions}
                          optionFilterProp="label"
                        />
                      </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Form.Item label="Type" name="type">
                        <Select
                          size="large"
                          placeholder="Select Type"
                          options={[
                            { label: "Steel Bar", value: "steel_bar" },
                            { label: "Pipe", value: "pipe" },
                            { label: "Coil", value: "coil" },
                            { label: "Wire", value: "wire" },
                            { label: "Steel Plate", value: "steel_plate" },
                          ]}
                          disabled={autofilled}
                        />
                      </Form.Item>

                      <Form.Item
                        label="Quantity/Kanban"
                        name="pcs_per_kanban"
                        rules={[
                          {
                            required: true,
                            message: "Please input Quantity per kanban",
                          },
                        ]}
                      >
                        <InputNumber
                          min={0}
                          size="large"
                          className="w-full"
                          placeholder="qty/kanban"
                        />
                      </Form.Item>

                      {/* <Form.Item
                        label="Quantity"
                        name="quantity"
                        rules={[
                          {  message: "Please input quantity" },
                        ]}
                      >
                        <InputNumber
                          min={0}
                          size="large"
                          className="w-full"
                          placeholder="Enter quantity"
                          disabled={autofilled}
                        />
                      </Form.Item> */}

                      <Form.Item
                        label="Weight"
                        name="weight"
                      >
                        <InputNumber
                          min={0}
                          size="large"
                          className="w-full"
                          placeholder="Weight (default 0)"
                          disabled={autofilled}
                        />
                      </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Form.Item
                        label="Percentage (%)"
                        name="percentage"
                        rules={[
                          { type: "number", min: 0, max: 100, message: "Percentage must be between 0 and 100" },
                        ]}
                      >
                        <InputNumber
                          min={0}
                          max={100}
                          precision={2}
                          size="large"
                          className="w-full"
                          placeholder="e.g. 30.00"
                          onChange={(val) => {
                            if (typeof val === "number") {
                              form.setFieldValue("percentage", Math.min(100, Math.max(0, val)));
                            }
                          }}
                        />
                      </Form.Item>

                      <Form.Item
                        label="Supplier Cycle"
                        name="customer_cycle"
                        rules={[
                          {
                            // required: true,
                            message: "Please input Supplier cycle",
                          },
                        ]}
                      >
                        <Input size="large" placeholder="e.g. Daily / Weekly / Monthly"/>
                      </Form.Item>

                      <Form.Item label="Description" name="description">
                        <Input size="large" placeholder="Optional description" />
                      </Form.Item>

                      <Form.Item label="Status" name="status" initialValue="active">
                        <Select
                          size="large"
                          options={[
                            { label: "Active", value: "active" },
                            { label: "Inactive", value: "inactive" },
                          ]}
                        />
                      </Form.Item>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="rounded-2xl border border-[#dfe8f5] shadow-sm">
                  <Typography.Title level={5} className="!mb-4">
                    Summary
                  </Typography.Title>
                  <div className="space-y-4">
                    <div className="rounded-xl bg-[#f8fbff] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#7a8ca8]">
                        Supplier
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#1f2d3d]">
                        {selectedSupplier?.label ?? "-"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#f8fbff] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#7a8ca8]">
                        Warehouse
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#1f2d3d]">
                        {selectedWarehouse?.label ?? "-"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#f8fbff] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#7a8ca8]">
                        Material Section
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#1f2d3d]">
                        {sectionLabel(section)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#f8fbff] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#7a8ca8]">
                        Selected Uniq
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#1f2d3d]">
                        {selectedUniqCode || form.getFieldValue("uniq_code") || "-"}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </>
        ) : null}
        </Form>
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
