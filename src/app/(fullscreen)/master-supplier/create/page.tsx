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
  type SupplierItemPayloadBomOption,
  type SupplierItemPayloadDetail,
  type SupplierItemPayloadFormSnapshot,
  type SupplierItemPayloadJSON,
  type SupplierItemPayloadMaterialSpecDetail,
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
  material_form?: string;
  width_mm?: number;
  diameter_mm?: number;
  thickness_mm?: number;
  length_mm?: number;
  quantity?: number;
  weight?: number;
  pcs_per_kanban?: number;
  percentage?: number;
  customer_cycle?: string;
  cycle_time?: number;
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

// [bom-label] Format label dropdown UNIQ Code yang distandarkan:
//   raw material : uniq — partno — partname (spec material)
//   indirect     : uniq — partno — partname
//   FG           : uniq — partno — partname
//   CP           : uniq — partno — partname
//
// Sengaja hanya memakai field yang juga dicari di server
// (items.uniq_code, items.part_number, items.part_name) supaya tidak ada
// segmen yang tampil di label tapi tidak bisa dicari.
// [bom-label-matcode] Label dropdown UNIQ Code.
//
//   raw material : <material code> — <uniq> — <part no> — <part name> (<grade> <ukuran>)
//   lainnya      : <uniq> — <part no> — <part name>
//
// "Material Code" pada page detail BOM sebenarnya berasal dari kolom
// item_material_specs.material_grade, dan nilai itulah yang sudah
// dipetakan ke option.materialCode di toBomOption().
const buildBomOptionLabel = (option: BomOption): string => {
  const typeMaterial = (option.type ?? "").toLowerCase();
  // cocok untuk "raw", "raw_material", maupun "raw material"
  const isRaw = typeMaterial.startsWith("raw");

  const segments = isRaw
    ? [option.materialCode, option.value, option.partNumber, option.partName]
    : [option.value, option.partNumber, option.partName];

  const base = segments
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" — ");

  if (!isRaw) return base;

  // Grade + ukuran, mis. "SWM-B 4.5 mm". Material code tidak diulang
  // karena sudah menjadi segmen pertama.
  const matCode = (option.materialCode ?? "").trim().toLowerCase();
  const gradeText = (option.grade ?? "").trim();
  const spec = [
    gradeText.toLowerCase() === matCode ? "" : gradeText,
    option.size,
  ]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  return spec ? `${base} (${spec})` : base;
};

type JsonMap = Record<string, unknown>;

type SupplierOption = {
  value: string;
  label: string;
  supplierCode: string;
  queryValue: string;
  matchValues: string[];
  // [supplier-search] kategori dipakai untuk URUTAN, bukan untuk memfilter.
  // WAJIB (bukan opsional) supaya tipenya identik dengan objek hasil
  // .map(); kalau opsional, type predicate `option is SupplierOption`
  // pada .filter() ditolak dan hasilnya tetap dianggap `| null`.
  category: string;
};

const SECTION_OPTIONS: Array<{ label: string; value: SupplierSection }> = [
  { label: "Raw Material", value: "raw-material" },
  { label: "Indirect Raw Material", value: "indirect-raw-material" },
  { label: "SubCon", value: "subcon" },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asRecord = (value: unknown): JsonMap | undefined => {
  if (isRecord(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};
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

const sectionMatchesTypeMaterial = (
  section: SupplierSection,
  typeMaterial: string | undefined,
): boolean => {
  if (!typeMaterial) return false;
  const t = typeMaterial.toLowerCase();
  if (section === "raw-material") return t === "raw" || t === "raw_material";
  if (section === "indirect-raw-material")
    return t === "indirect" || t === "indirect_raw_material";
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

const formatCompositeSizeFromMaterialSpec = (
  materialSpec?: Record<string, unknown>,
): string => {
  return formatSizeFromMaterialSpec(materialSpec);
};

const formatCompositeSizeFromDimensions = (values: {
  width_mm?: unknown;
  diameter_mm?: unknown;
  thickness_mm?: unknown;
  length_mm?: unknown;
}): string => {
  const parts = [
    pickText(values.diameter_mm) ? `Ø${pickText(values.diameter_mm)}` : "",
    pickText(values.width_mm) ? `W${pickText(values.width_mm)}` : "",
    pickText(values.thickness_mm) ? `T${pickText(values.thickness_mm)}` : "",
    pickText(values.length_mm) ? `L${pickText(values.length_mm)}` : "",
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

const extractNullableNumber = (...values: unknown[]): number | null => {
  const value = extractNumber(...values);
  return value === undefined ? null : value;
};

const getSupplierItemPayloadJson = (
  record: unknown,
): SupplierItemPayloadJSON | undefined => {
  if (!isRecord(record)) return undefined;
  return (asRecord(record.payload_json) ?? asRecord(record.payloadJson)) as
    | SupplierItemPayloadJSON
    | undefined;
};

const getSupplierItemPayloadDetail = (
  record: unknown,
): SupplierItemPayloadDetail | undefined => {
  const payloadJson = getSupplierItemPayloadJson(record);
  return (asRecord(payloadJson?.payload_detail) ??
    (isRecord(record) ? asRecord(record.payload_detail) : undefined)) as
    | SupplierItemPayloadDetail
    | undefined;
};

const getSupplierItemPayloadMaterialSpec = (
  record: unknown,
): SupplierItemPayloadMaterialSpecDetail | undefined => {
  const payloadDetail = getSupplierItemPayloadDetail(record);
  return (
    (asRecord(payloadDetail?.material_spec) as
      | SupplierItemPayloadMaterialSpecDetail
      | undefined) ??
    (asRecord(payloadDetail?.material_spec_detail) as
      | SupplierItemPayloadMaterialSpecDetail
      | undefined) ??
    payloadDetail?.material_spec ??
    payloadDetail?.material_spec_detail ??
    undefined
  );
};

const normalizeFormStatus = (value: unknown): string | undefined => {
  const raw = pickText(value).toLowerCase();
  if (raw === "active" || raw === "released") return "active";
  if (raw === "inactive" || raw === "obsolete") return "inactive";
  return undefined;
};

const normalizeMaterialSpecType = (
  materialSpec?: Record<string, unknown>,
): string | undefined => {
  const raw = pickText(
    materialSpec?.type,
    materialSpec?.item_type,
    materialSpec?.material_type,
    materialSpec?.form,
  ).toLowerCase();

  if (!raw) return undefined;
  if (raw === "rod" || raw === "round bar" || raw === "steel bar")
    return "steel_bar";
  if (raw === "pipe") return "pipe";
  if (raw === "coil") return "coil";
  if (raw === "wire") return "wire";
  if (raw === "plate" || raw === "steel plate" || raw === "sheet plate")
    return "steel_plate";
  return undefined;
};

const resolveMaterialSpec = (
  node: BackendBomNode,
): Record<string, unknown> | undefined => {
  return isRecord(node.material_specifications)
    ? node.material_specifications
    : isRecord((node as Record<string, unknown>).material_spec)
      ? ((node as Record<string, unknown>).material_spec as Record<
          string,
          unknown
        >)
      : undefined;
};

const buildMaterialSpecPayloadDetail = (
  materialSpec: Record<string, unknown> | undefined,
  values: Pick<
    FormValues,
    | "grade"
    | "material_form"
    | "width_mm"
    | "diameter_mm"
    | "thickness_mm"
    | "length_mm"
    | "weight"
  >,
  fallback?: SupplierItemPayloadMaterialSpecDetail | null,
): SupplierItemPayloadMaterialSpecDetail => ({
  material_grade:
    pickText(
      materialSpec?.material_grade,
      materialSpec?.material_code,
      fallback?.material_grade,
    ) || null,
  grade: pickText(values.grade, materialSpec?.grade, fallback?.grade) || null,
  form:
    pickText(values.material_form, materialSpec?.form, fallback?.form) || null,
  width_mm: extractNullableNumber(
    values.width_mm,
    materialSpec?.width_mm,
    fallback?.width_mm,
  ),
  diameter_mm: extractNullableNumber(
    values.diameter_mm,
    materialSpec?.diameter_mm,
    fallback?.diameter_mm,
  ),
  thickness_mm: extractNullableNumber(
    values.thickness_mm,
    materialSpec?.thickness_mm,
    fallback?.thickness_mm,
  ),
  length_mm: extractNullableNumber(
    values.length_mm,
    materialSpec?.length_mm,
    fallback?.length_mm,
  ),
  weight_kg:
    typeof values.weight === "number" && Number.isFinite(values.weight)
      ? values.weight
      : extractNullableNumber(
          materialSpec?.weight_kg,
          materialSpec?.weight,
          materialSpec?.unit_weight,
          fallback?.weight_kg,
        ),
});

const buildSupplierItemPayloadDetail = ({
  materialSpec,
  values,
  fallback,
}: {
  materialSpec?: Record<string, unknown>;
  values: FormValues;
  fallback?: SupplierItemPayloadDetail;
}): SupplierItemPayloadDetail => ({
  material_spec: buildMaterialSpecPayloadDetail(
    materialSpec,
    values,
    fallback?.material_spec ?? fallback?.material_spec_detail ?? null,
  ),
});

const findNodeByUniq = (
  node: BackendBomNode | undefined,
  uniqCode: string,
): BackendBomNode | null => {
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
  const typeMaterial = pickText(
    materialSpec?.type_material,
    materialSpec?.material_type,
    node.type_material,
  ).toLowerCase();
  const isRawOrIndirectNode =
    typeMaterial === "raw" ||
    typeMaterial === "raw_material" ||
    typeMaterial === "indirect" ||
    typeMaterial === "indirect_raw_material";
  const size = isRawOrIndirectNode
    ? formatCompositeSizeFromMaterialSpec(materialSpec) ||
      pickText(
        materialSpec?.size,
        materialSpec?.material_size,
        materialSpec?.thickness,
      )
    : pickText(
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
    grade: pickText(materialSpec?.grade, materialSpec?.material_grade),
    size,
    uom: pickText(node.unit_measurement, (node as Record<string, unknown>).uom),
    weight: extractWeightFromMaterialSpec(materialSpec),
    quantity: extractNumber(
      node.quantity,
      node.qpu,
      (node as Record<string, unknown>).qty_per_uniq,
    ),
    customerCycle: pickText(materialSpec?.customer_cycle),
    description: pickText(node.description, node.part_name),
    status: pickText(
      (node as Record<string, unknown>).status,
      (node as Record<string, unknown>).bom_status,
    ),
    // [supplier-search] utamakan material_code asli supaya field "UNIQ Code"
    // bisa dicari dari materialCode; grade tetap tersimpan di field `grade`.
    materialCode: pickText(
      materialSpec?.material_code,
      (node as Record<string, unknown>).material_code,
      materialSpec?.material_grade,
    ),
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
    const name =
      byCode.name ?? byCode.unit_name ?? byCode.code ?? byCode.unit_code ?? "";
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
  const [selectedSupplierId, setSelectedSupplierId] = useState<
    string | undefined
  >();
  const [selectedBomOption, setSelectedBomOption] = useState<BomOption | null>(
    null,
  );

  const apiEnabled = Boolean(apiBaseUrl);
  const section = normalizeSection(searchParams.get("section"));
  const rawMode = String(searchParams.get("mode") ?? "create").toLowerCase();
  const mode: PageMode =
    rawMode === "edit" || rawMode === "view" ? (rawMode as PageMode) : "create";
  const readOnly = mode === "view";
  const itemId = String(searchParams.get("id") ?? "").trim();
  const isEditing = mode === "edit";
  const useMaterialSpecOnlyAutofill =
    section === "raw-material" || section === "indirect-raw-material";
  const autofilled = Boolean(selectedUniqCode);

  const [uniqSearch, setUniqSearch] = useState("");
  const [debouncedUniqSearch, setDebouncedUniqSearch] = useState("");
  const [uniqPage, setUniqPage] = useState(1);
  const [accumulatedBomItems, setAccumulatedBomItems] = useState<
    BackendBomNode[]
  >([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUniqSearch(uniqSearch), 400);
    return () => clearTimeout(timer);
  }, [uniqSearch]);

  // Reset pagination whenever search term or supplier changes
  useEffect(() => {
    setUniqPage(1);
  }, [debouncedUniqSearch]);

  useEffect(() => {
    setUniqPage(1);
    setAccumulatedBomItems([]);
  }, [selectedSupplierId, section]);

  const { data: suppliers = [], isLoading: suppliersLoading } =
    useListSuppliersQuery(
      {
        // [supplier-search] semua supplier aktif ditampilkan. Filter
        // kategori dihapus supaya supplier lintas kategori tetap
        // ketemu saat dicari; urutannya diatur di supplierOptions.
        status: "Active",
        limit: 1000,
      },
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

  const BOM_PAGE_SIZE = 500;

  const { data: bomPageResult, isFetching: bomSearchFetching } =
    useGetBomTreeQuery(
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
    const allItems = flattenBomTree(bomPageResult?.data?.items ?? []);
    // [supplier-search] hasil server jangan dibuang hanya karena
    // type_material kosong atau beda penamaan. Kalau filter section
    // menyisakan nol padahal server mengembalikan data, pakai apa adanya.
    const sectionItems = allItems.filter((node) =>
      sectionMatchesTypeMaterial(section, node.type_material),
    );
    const newItems = sectionItems.length > 0 ? sectionItems : allItems;
    if (newItems.length === 0) {
      // [supplier-search] Kalau server balik kosong TAPI ada kata kunci aktif
      // (mis. user mengetik materialCode padahal server hanya mencari uniq),
      // jangan kosongkan daftar—biarkan filterOption di client menyaring dari
      // item yang sudah termuat. Kosongkan hanya ketika tanpa kata kunci.
      if (uniqPage === 1 && !debouncedUniqSearch) setAccumulatedBomItems([]);
      return;
    }
    setAccumulatedBomItems((prev) => {
      const existingCodes = new Set(
        prev.map((n) => pickText(n.uniq_code, n.uniq)),
      );
      return [
        ...prev,
        ...newItems.filter(
          (n) => !existingCodes.has(pickText(n.uniq_code, n.uniq)),
        ),
      ];
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
          const value = pickText(
            supplier.supplier_uuid,
            supplier.uuid,
            supplier.id,
          );
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
          return {
            value,
            label,
            supplierCode,
            queryValue: value,
            matchValues,
            category: pickText(supplier.material_category),
          };
        })
        .filter((option): option is SupplierOption => Boolean(option))
        .sort((left, right) => {
          // [supplier-search] kategori yang cocok dengan section naik ke
          // atas, sisanya tetap bisa dipilih dan dicari.
          const wanted = sectionToMaterialCategory(section).toLowerCase();
          const leftRank = left.category.toLowerCase() === wanted ? 0 : 1;
          const rightRank =
            right.category.toLowerCase() === wanted ? 0 : 1;
          if (leftRank !== rightRank) return leftRank - rightRank;
          return left.label.localeCompare(right.label);
        }),
    [suppliers, section],
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
        const hasParentPointer = Boolean(
          (node as any).parent_id ??
          (node as any).parentId ??
          (node as any).parent_uuid ??
          (node as any).parentUuid,
        );
        const levelNum =
          typeof (node as any).level === "number"
            ? (node as any).level
            : undefined;
        const isParent = !hasParentPointer || levelNum === 1;
        return {
          ...(opt as BomOption),
          _isParent: Boolean(isParent),
        } as BomOption & { _isParent: boolean };
      })
      .filter(
        (option): option is BomOption & { _isParent: boolean } =>
          option !== null,
      );
    const deduped = new Map<string, BomOption>();
    mapped.forEach((option) => {
      const key = option.materialCode ? option.materialCode : option.value;
      if (!deduped.has(key)) deduped.set(key, option);
    });
    return Array.from(deduped.values());
  }, [accumulatedBomItems]);

  const handleUniqPopupScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const nearBottom =
      target.scrollTop + target.offsetHeight >= target.scrollHeight - 40;
    const canLoadMore =
      !bomSearchFetching && uniqPage < (bomPageResult?.data?.totalPages ?? 1);
    if (nearBottom && canLoadMore) {
      setUniqPage((prev) => prev + 1);
    }
  };

  const selectedWarehouseId = Form.useWatch("warehouse_uuid", form);
  const formUniqCode = Form.useWatch("uniq_code", form);

  const selectedWarehouse = useMemo(
    () =>
      warehouseOptions.find((option) => option.value === selectedWarehouseId),
    [selectedWarehouseId, warehouseOptions],
  );

  const currentBomDetail = useMemo(() => {
    const root = bomDetailQuery.data?.data;
    if (!root || !selectedUniqCode) return null;
    return findNodeByUniq(root, selectedUniqCode);
  }, [bomDetailQuery.data, selectedUniqCode]);

  const currentMaterialSpec = useMemo(
    () =>
      currentBomDetail ? resolveMaterialSpec(currentBomDetail) : undefined,
    [currentBomDetail],
  );

  useEffect(() => {
    if (!detailQuery.data) return;

    const payloadMaterialSpec = getSupplierItemPayloadMaterialSpec(
      detailQuery.data,
    );

    setSelectedSupplierId(
      pickText(detailQuery.data.supplier_uuid) || undefined,
    );
    setSelectedUniqCode(pickText(detailQuery.data.uniq_code) || "");
    setSelectedBomLookupId("");

    form.setFieldsValue({
      supplier_uuid: pickText(detailQuery.data.supplier_uuid),
      warehouse_uuid: pickText(
        detailQuery.data.warehouse_uuid,
        detailQuery.data.warehouse_id,
      ),
      uniq_code: pickText(detailQuery.data.uniq_code),
      sebango_code: pickText(
        detailQuery.data.sebango_code,
        payloadMaterialSpec?.material_grade,
      ),
      type: pickText(detailQuery.data.material_type, detailQuery.data.type),
      product_model: pickText(detailQuery.data.product_model),
      part_name: pickText(detailQuery.data.part_name),
      part_number: pickText(detailQuery.data.part_number),
      grade: pickText(detailQuery.data.grade, payloadMaterialSpec?.grade),
      size: pickText(
        detailQuery.data.size,
        formatCompositeSizeFromDimensions(payloadMaterialSpec ?? {}),
      ),
      uom: pickText(detailQuery.data.uom),
      material_form: pickText(payloadMaterialSpec?.form),
      width_mm: extractNumber(payloadMaterialSpec?.width_mm),
      diameter_mm: extractNumber(payloadMaterialSpec?.diameter_mm),
      thickness_mm: extractNumber(payloadMaterialSpec?.thickness_mm),
      length_mm: extractNumber(payloadMaterialSpec?.length_mm),
      quantity: Number(detailQuery.data.quantity ?? 0),
      weight:
        extractNumber(
          detailQuery.data.weight,
          payloadMaterialSpec?.weight_kg,
        ) ?? 0,
      pcs_per_kanban: Number(detailQuery.data.pcs_per_kanban ?? 0),
      percentage:
        detailQuery.data.percentage !== undefined &&
        detailQuery.data.percentage !== null
          ? Number(detailQuery.data.percentage)
          : undefined,
      customer_cycle: pickText(detailQuery.data.customer_cycle),
      cycle_time:
        detailQuery.data.cycle_time !== undefined &&
        detailQuery.data.cycle_time !== null
          ? Number(detailQuery.data.cycle_time)
          : undefined,
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
      sebango_code: undefined,
      product_model: undefined,
      part_name: undefined,
      part_number: undefined,
      type: undefined,
      grade: undefined,
      size: undefined,
      uom: undefined,
      material_form: undefined,
      width_mm: undefined,
      diameter_mm: undefined,
      thickness_mm: undefined,
      length_mm: undefined,
      quantity: undefined,
      weight: undefined,
      customer_cycle: undefined,
      description: undefined,
    });
  };

  const handleUniqChange = (
    value: string,
    optionFromSelect?: BomOption | BomOption[],
  ) => {
    const opt = Array.isArray(optionFromSelect)
      ? optionFromSelect[0]
      : optionFromSelect;
    const matched = opt ?? bomOptions.find((option) => option.value === value);
    if (!matched) return;

    setSelectedUniqCode(value);
    setSelectedBomLookupId(matched.lookupId ?? "");
    setSelectedBomOption({ ...matched, label: matched.value });

    if (useMaterialSpecOnlyAutofill) {
      form.setFieldsValue({
        uniq_code: matched.value,
        sebango_code: matched.materialCode,
        product_model: undefined,
        part_name: undefined,
        part_number: undefined,
        type: matched.type,
        grade: matched.grade,
        size: matched.size,
        material_form: undefined,
        width_mm: undefined,
        diameter_mm: undefined,
        thickness_mm: undefined,
        length_mm: undefined,
        quantity: undefined,
        uom: matched.uom,
        weight: matched.weight,
        customer_cycle: matched.customerCycle,
        description: undefined,
      });
      return;
    }

    const rawUom = matched.uom?.trim() ?? "";
    const resolvedUom = resolveUomValue(rawUom, uoms, uomOptions);

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
      status:
        normalizeFormStatus(matched.status) ??
        form.getFieldValue("status") ??
        "active",
    });

    setTimeout(() => {
      if (resolvedUom) form.setFieldValue("uom", resolvedUom);
    }, 0);
  };

  useEffect(() => {
    const bomDetailRoot = bomDetailQuery.data?.data;
    if (!bomDetailRoot || !selectedUniqCode) return;

    const bomDetail = findNodeByUniq(bomDetailRoot, selectedUniqCode);
    if (!bomDetail) return;

    const materialSpec = resolveMaterialSpec(bomDetail);

    if (useMaterialSpecOnlyAutofill) {
      form.setFieldsValue({
        uniq_code: pickText(bomDetail.uniq_code, bomDetail.uniq),
        sebango_code: pickText(
          materialSpec?.material_grade,
          materialSpec?.material_code,
          bomDetail.material_code,
        ),
        product_model: undefined,
        part_name: undefined,
        part_number: undefined,
        type: normalizeMaterialSpecType(materialSpec),
        grade: pickText(materialSpec?.grade),
        size:
          formatCompositeSizeFromMaterialSpec(materialSpec) ||
          pickText(
            materialSpec?.size,
            materialSpec?.material_size,
            materialSpec?.thickness,
          ) ||
          formatSizeFromMaterialSpec(materialSpec),
        material_form: pickText(materialSpec?.form),
        width_mm: extractNumber(materialSpec?.width_mm),
        diameter_mm: extractNumber(materialSpec?.diameter_mm),
        thickness_mm: extractNumber(materialSpec?.thickness_mm),
        length_mm: extractNumber(materialSpec?.length_mm),
        quantity: undefined,
        uom: undefined,
        weight: extractWeightFromMaterialSpec(materialSpec),
        customer_cycle: pickText(materialSpec?.customer_cycle),
        description: undefined,
      });
      return;
    }

    form.setFieldsValue({
      uniq_code: pickText(bomDetail.uniq_code, bomDetail.uniq),
      product_model: pickText(
        (bomDetail as Record<string, unknown>).model,
        bomDetail.assembly_code,
      ),
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
      grade: pickText(materialSpec?.grade, materialSpec?.material_grade),
      size:
        pickText(
          materialSpec?.size,
          materialSpec?.material_size,
          materialSpec?.thickness,
        ) || formatSizeFromMaterialSpec(materialSpec),
      quantity: extractNumber(
        bomDetail.quantity,
        bomDetail.qpu,
        (bomDetail as Record<string, unknown>).qty_per_uniq,
      ),
      weight: extractWeightFromMaterialSpec(materialSpec),
      customer_cycle: pickText(materialSpec?.customer_cycle),
      description: pickText(
        bomDetail.description,
        bomDetail.part_name,
        bomDetail.uniq_code,
      ),
      status:
        normalizeFormStatus(
          (bomDetail as Record<string, unknown>).status ??
            (bomDetail as Record<string, unknown>).bom_status,
        ) ??
        form.getFieldValue("status") ??
        "active",
      sebango_code: pickText(
        bomDetail.material_code,
        materialSpec?.material_code,
        materialSpec?.materialCode,
      ),
    });
  }, [
    bomDetailQuery.data,
    form,
    selectedUniqCode,
    useMaterialSpecOnlyAutofill,
  ]);

  const handleSave = async () => {
    if (!apiEnabled) {
      messageApi.warning(
        "Set NEXT_PUBLIC_API_URL before saving supplier items.",
      );
      return;
    }

    try {
      const values = await form.validateFields();
      const existingPayloadDetail = getSupplierItemPayloadDetail(
        detailQuery.data,
      );
      const payloadDetail = useMaterialSpecOnlyAutofill
        ? buildSupplierItemPayloadDetail({
            values,
            materialSpec: currentMaterialSpec,
            fallback: existingPayloadDetail,
          })
        : undefined;

      const payload: SupplierItemMutationRequest = {
        supplier_uuid: pickText(values.supplier_uuid),
        // prefer explicit `sebango_code`, but fall back to material code when missing
        // prefer explicit `sebango_code`, then material code, then uniq_code as last resort
        sebango_code: pickText(
          values.sebango_code,
          (values as any).materialCode,
          (values as any).material_code,
          values.uniq_code,
        ),
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
        // Cycle Time (days): include it in the outgoing payload so it is
        // persisted to supplier_item.cycle_time. Without this the field was
        // rendered in the form but never sent, so the DB column stayed empty
        // and the value never showed up again on reload.
        cycle_time:
          values.cycle_time !== undefined &&
          values.cycle_time !== null &&
          `${values.cycle_time}`.trim() !== ""
            ? String(Math.trunc(Number(values.cycle_time)))
            : undefined,
        status:
          pickText(values.status) ||
          pickText(detailQuery.data?.status) ||
          "active",
        warehouse_uuid: pickText(values.warehouse_uuid),
        warehouse_name: selectedWarehouse?.label,
        product_model: pickText(values.product_model),
        part_name: pickText(values.part_name),
        part_number: pickText(values.part_number),
        material_type: pickText(values.type),
        grade: pickText(values.grade),
        size: pickText(values.size),
        payload_detail: payloadDetail,
      };

      // preserve optional `percentage` form field in outgoing payload when present
      const percentageValue =
        values.percentage !== undefined ? String(values.percentage) : undefined;
      const payloadAny =
        percentageValue !== undefined
          ? ({ ...payload, percentage: percentageValue } as any)
          : payload;

      if (isEditing) {
        await updateSupplierItem({
          id: itemId,
          body: payloadAny as SupplierItemMutationRequest,
        }).unwrap();
        setFlashMessage({
          type: "success",
          content: "Supplier item updated",
          targetPath: "/master-supplier",
        });
      } else {
        await createSupplierItem(
          payloadAny as SupplierItemMutationRequest,
        ).unwrap();
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
                            {
                              required: true,
                              message: "Please select a supplier",
                            },
                          ]}>
                          <Select
                            size="large"
                            showSearch
                            placeholder="Select supplier"
                            options={supplierOptions}
                            // [supplier-search] supplier bisa dicari lewat nama,
                            // kode (SUP-0034), maupun uuid-nya.
                            filterOption={(input, option) => {
                              const needle = input.trim().toLowerCase();
                              if (!needle) return true;
                              const opt = option as
                                | Partial<SupplierOption>
                                | undefined;
                              if (!opt) return false;
                              if (
                                (opt.matchValues ?? []).some((entry) =>
                                  entry.includes(needle),
                                )
                              ) {
                                return true;
                              }
                              return String(opt.label ?? "")
                                .toLowerCase()
                                .includes(needle);
                            }}
                            onChange={handleSupplierChange}
                          />
                        </Form.Item>

                        <Form.Item label="Supplier ID">
                          <Input
                            size="large"
                            value={
                              selectedSupplier?.supplierCode ||
                              selectedSupplier?.value ||
                              ""
                            }
                            placeholder="Auto-filled from supplier selection"
                            disabled
                          />
                        </Form.Item>

                        <Form.Item
                          label="Warehouse"
                          name="warehouse_uuid"
                          rules={[
                            {
                              required: true,
                              message: "Please select a warehouse",
                            },
                          ]}>
                          <Select
                            size="large"
                            showSearch
                            placeholder="Select warehouse"
                            options={warehouseOptions}
                            // [supplier-search] warehouse: nama atau tipe gudang.
                            filterOption={(input, option) => {
                              const needle = input.trim().toLowerCase();
                              if (!needle) return true;
                              const opt = option as
                                | { label?: string; type?: string }
                                | undefined;
                              return `${opt?.label ?? ""} ${opt?.type ?? ""}`
                                .toLowerCase()
                                .includes(needle);
                            }}
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
                      {useMaterialSpecOnlyAutofill ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
                            <Form.Item
                              className="md:col-span-2 xl:col-span-6"
                              label="UNIQ Code"
                              name="uniq_code"
                              rules={[
                                {
                                  required: true,
                                  message: "Please select a UNIQ Code",
                                },
                              ]}>
                              <Select
                                size="large"
                                showSearch
                                // [supplier-search] uniq: server tetap mencari,
                                // tapi daftar juga menyempit saat mengetik.
                                filterOption={(input, option) => {
                                  const needle = input.trim().toLowerCase();
                                  if (!needle) return true;
                                  const opt = option as unknown as BomOption & {
                                    materialCode?: string;
                                  } & { label?: string; value?: string };
                                  const label = String(opt.label ?? "").toLowerCase();
                                  const material = String(opt.materialCode ?? "").toLowerCase();
                                  const grade = String((opt as BomOption).grade ?? "").toLowerCase();
                                  const value = String(opt.value ?? "").toLowerCase();
                                  // [bom-label-matcode] part number / part name / model ikut dicocokkan
                                  // walau tidak selalu tampil di label.
                                  const partNumber = String(
                                    (opt as BomOption).partNumber ?? "",
                                  ).toLowerCase();
                                  const partName = String(
                                    (opt as BomOption).partName ?? "",
                                  ).toLowerCase();
                                  const model = String(
                                    (opt as BomOption).productModel ?? "",
                                  ).toLowerCase();
                                  return (
                                    label.includes(needle) ||
                                    material.includes(needle) ||
                                    grade.includes(needle) ||
                                    value.includes(needle) ||
                                    partNumber.includes(needle) ||
                                    partName.includes(needle) ||
                                    model.includes(needle)
                                  );
                                }}
                                placeholder="Search or scroll to browse..."
                                options={(() => {
                                  const toSelectOpt = (
                                    option: BomOption & { _isParent?: boolean },
                                  ) => ({
                                    ...option,
                                    label: buildBomOptionLabel(option),
                                  });

                                  const list = bomOptions.map(toSelectOpt);

                                  if (
                                    selectedBomOption &&
                                    !list.some(
                                      (o) =>
                                        o.value === selectedBomOption.value,
                                    )
                                  ) {
                                    list.unshift(
                                      toSelectOpt(
                                        selectedBomOption as BomOption & {
                                          _isParent?: boolean;
                                        },
                                      ),
                                    );
                                  }
                                  return list;
                                })()}
                                onSearch={setUniqSearch}
                                onChange={(val, opt) =>
                                  handleUniqChange(
                                    val as string,
                                    opt as BomOption | BomOption[],
                                  )
                                }
                                onPopupScroll={handleUniqPopupScroll}
                                loading={bomSearchFetching}
                                disabled={readOnly || !selectedSupplierId}
                                notFoundContent={
                                  bomSearchFetching
                                    ? "Loading..."
                                    : "No items found"
                                }
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-1 xl:col-span-2"
                              label="Grade"
                              name="grade">
                              <Input
                                size="large"
                                placeholder="Auto-filled from material spec"
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-1 xl:col-span-2"
                              label="Form"
                              name="material_form">
                              <Input
                                size="large"
                                placeholder="Auto-filled from material spec"
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-2 xl:col-span-2"
                              label="Supplier Cycle"
                              name="customer_cycle">
                              <Input
                                size="large"
                                placeholder="Auto-filled from material spec"
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-1 xl:col-span-3"
                              label="Width (mm)"
                              name="width_mm">
                              <InputNumber
                                style={{ width: "100%" }}
                                size="large"
                                className="w-full"
                                placeholder="Auto-filled from material spec"
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-1 xl:col-span-3"
                              label="Diameter (mm)"
                              name="diameter_mm">
                              <InputNumber
                                style={{ width: "100%" }}
                                size="large"
                                className="w-full"
                                placeholder="Auto-filled from material spec"
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-1 xl:col-span-3"
                              label="Thickness (mm)"
                              name="thickness_mm">
                              <InputNumber
                                style={{ width: "100%" }}
                                size="large"
                                className="w-full"
                                placeholder="Auto-filled from material spec"
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-1 xl:col-span-3"
                              label="Length (mm)"
                              name="length_mm">
                              <InputNumber
                                style={{ width: "100%" }}
                                size="large"
                                className="w-full"
                                placeholder="Auto-filled from material spec"
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-1 xl:col-span-3"
                              label="Weight (kg)"
                              name="weight">
                              <InputNumber
                                style={{ width: "100%" }}
                                size="large"
                                className="w-full"
                                placeholder="Auto-filled from material spec"
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-1 xl:col-span-3"
                              label="Quantity/Kanban"
                              name="pcs_per_kanban"
                              rules={[
                                {
                                  required: true,
                                  message: "Please input Quantity per kanban",
                                },
                              ]}>
                              <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                size="large"
                                className="w-full"
                                placeholder="qty/kanban"
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-1 xl:col-span-3"
                              label="Percentage (%)"
                              name="percentage"
                              rules={[
                                {
                                  type: "number",
                                  min: 0,
                                  max: 100,
                                  message:
                                    "Percentage must be between 0 and 100",
                                },
                              ]}>
                              <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                max={100}
                                precision={2}
                                size="large"
                                className="w-full"
                                placeholder="e.g. 30.00"
                                onChange={(val) => {
                                  if (typeof val === "number") {
                                    form.setFieldValue(
                                      "percentage",
                                      Math.min(100, Math.max(0, val)),
                                    );
                                  }
                                }}
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-1 xl:col-span-3"
                              label="Lead Time (days)"
                              name="cycle_time">
                              <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                step={1}
                                precision={0}
                                size="large"
                                className="w-full"
                                placeholder="e.g. 7"
                                addonAfter="days"
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-1 xl:col-span-3"
                              label="Status"
                              name="status"
                              initialValue="active">
                              <Select
                                size="large"
                                showSearch
                                // [supplier-search] status-1
                                optionFilterProp="label"
                                options={[
                                  { label: "Active", value: "active" },
                                  { label: "Inactive", value: "inactive" },
                                ]}
                              />
                            </Form.Item>

                            <Form.Item
                              className="md:col-span-2 xl:col-span-12"
                              label="Description"
                              name="description">
                              <Input
                                size="large"
                                placeholder="Optional description"
                              />
                            </Form.Item>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Form.Item
                              label={
                                section === "subcon"
                                  ? "Uniq / Sebanggo"
                                  : "UNIQ Code"
                              }
                              name="uniq_code"
                              rules={[
                                {
                                  required: true,
                                  message:
                                    section === "subcon"
                                      ? "Please select a Sebango Code"
                                      : "Please select a UNIQ Code",
                                },
                              ]}>
                              <Select
                                size="large"
                                showSearch
                                // [supplier-search] uniq: server tetap mencari,
                                // tapi daftar juga menyempit saat mengetik.
                                // [supplier-search] cari dari material code + uniq
                                // (+ label/part name/model yang sudah ada di label).
                                filterOption={(input, option) => {
                                  const needle = input.trim().toLowerCase();
                                  if (!needle) return true;
                                  const opt = option as unknown as BomOption & {
                                    materialCode?: string;
                                  } & { label?: string; value?: string };
                                  const label = String(opt.label ?? "").toLowerCase();
                                  const material = String(opt.materialCode ?? "").toLowerCase();
                                  const grade = String((opt as BomOption).grade ?? "").toLowerCase();
                                  const value = String(opt.value ?? "").toLowerCase();
                                  // [bom-label-matcode] part number / part name / model ikut dicocokkan
                                  // walau tidak selalu tampil di label.
                                  const partNumber = String(
                                    (opt as BomOption).partNumber ?? "",
                                  ).toLowerCase();
                                  const partName = String(
                                    (opt as BomOption).partName ?? "",
                                  ).toLowerCase();
                                  const model = String(
                                    (opt as BomOption).productModel ?? "",
                                  ).toLowerCase();
                                  return (
                                    label.includes(needle) ||
                                    material.includes(needle) ||
                                    grade.includes(needle) ||
                                    value.includes(needle) ||
                                    partNumber.includes(needle) ||
                                    partName.includes(needle) ||
                                    model.includes(needle)
                                  );
                                }}
                                placeholder="Search or scroll to browse..."
                                options={(() => {
                                  const toSelectOpt = (
                                    option: BomOption & { _isParent?: boolean },
                                  ) => ({
                                    ...option,
                                    label: buildBomOptionLabel(option),
                                  });

                                  const list = bomOptions
                                    .filter(
                                      (
                                        o: BomOption & { _isParent?: boolean },
                                      ) =>
                                        section === "subcon"
                                          ? Boolean((o as any)._isParent)
                                          : true,
                                    )
                                    .map(toSelectOpt);

                                  if (
                                    selectedBomOption &&
                                    !list.some(
                                      (o) =>
                                        o.value === selectedBomOption.value,
                                    )
                                  ) {
                                    list.unshift(
                                      toSelectOpt(
                                        selectedBomOption as BomOption & {
                                          _isParent?: boolean;
                                        },
                                      ),
                                    );
                                  }
                                  return list;
                                })()}
                                onSearch={setUniqSearch}
                                onChange={(val, opt) =>
                                  handleUniqChange(
                                    val as string,
                                    opt as BomOption | BomOption[],
                                  )
                                }
                                onPopupScroll={handleUniqPopupScroll}
                                loading={bomSearchFetching}
                                disabled={readOnly || !selectedSupplierId}
                                notFoundContent={
                                  bomSearchFetching
                                    ? "Loading..."
                                    : "No items found"
                                }
                              />
                            </Form.Item>

                            <Form.Item
                              label="Product Model"
                              name="product_model">
                              <Input
                                size="large"
                                placeholder="Auto-filled from BOM"
                                disabled={section === "subcon" && autofilled}
                              />
                            </Form.Item>

                            <Form.Item label="Part Name" name="part_name">
                              <Input
                                size="large"
                                placeholder="Auto-filled from BOM"
                                disabled={section === "subcon" && autofilled}
                              />
                            </Form.Item>

                            <Form.Item label="Part Number" name="part_number">
                              <Input
                                size="large"
                                placeholder="Auto-filled from BOM"
                                disabled={section === "subcon" && autofilled}
                              />
                            </Form.Item>
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Form.Item label="Grade" name="grade">
                              <Input
                                size="large"
                                placeholder="Auto-filled grade"
                                disabled={section === "subcon" && autofilled}
                              />
                            </Form.Item>

                            <Form.Item label="Size" name="size">
                              <Input
                                size="large"
                                placeholder="Auto-filled size"
                                disabled={section === "subcon" && autofilled}
                              />
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
                                showSearch
                                // [supplier-search] type
                                optionFilterProp="label"
                                placeholder="Select Type"
                                options={[
                                  { label: "Steel Bar", value: "steel_bar" },
                                  { label: "Pipe", value: "pipe" },
                                  { label: "Coil", value: "coil" },
                                  { label: "Wire", value: "wire" },
                                  {
                                    label: "Steel Plate",
                                    value: "steel_plate",
                                  },
                                ]}
                                disabled={section === "subcon" && autofilled}
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
                              ]}>
                              <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                size="large"
                                className="w-full"
                                placeholder="qty/kanban"
                              />
                            </Form.Item>

                            <Form.Item label="Weight" name="weight">
                              <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                size="large"
                                className="w-full"
                                placeholder="Weight (default 0)"
                                disabled={section === "subcon" && autofilled}
                              />
                            </Form.Item>
                          </div>
                        </>
                      )}

                      {!useMaterialSpecOnlyAutofill ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <Form.Item
                            label="Percentage (%)"
                            name="percentage"
                            rules={[
                              {
                                type: "number",
                                min: 0,
                                max: 100,
                                message: "Percentage must be between 0 and 100",
                              },
                            ]}>
                            <InputNumber
                              style={{ width: "100%" }}
                              min={0}
                              max={100}
                              precision={2}
                              size="large"
                              className="w-full"
                              placeholder="e.g. 30.00"
                              onChange={(val) => {
                                if (typeof val === "number") {
                                  form.setFieldValue(
                                    "percentage",
                                    Math.min(100, Math.max(0, val)),
                                  );
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
                            ]}>
                            <Input
                              size="large"
                              placeholder="e.g. Daily / Weekly / Monthly"
                            />
                          </Form.Item>

                          <Form.Item label="Lead Time (days)" name="cycle_time">
                            <InputNumber
                              style={{ width: "100%" }}
                              min={0}
                              step={1}
                              precision={0}
                              size="large"
                              className="w-full"
                              placeholder="e.g. 7"
                              addonAfter="days"
                            />
                          </Form.Item>

                          <Form.Item label="Description" name="description">
                            <Input
                              size="large"
                              placeholder="Optional description"
                            />
                          </Form.Item>

                          <Form.Item
                            label="Status"
                            name="status"
                            initialValue="active">
                            <Select
                              size="large"
                              showSearch
                              // [supplier-search] status-2
                              optionFilterProp="label"
                              options={[
                                { label: "Active", value: "active" },
                                { label: "Inactive", value: "inactive" },
                              ]}
                            />
                          </Form.Item>
                        </div>
                      ) : null}
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
                          {selectedUniqCode ||
                            formUniqCode ||
                            "-"}
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
