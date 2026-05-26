"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Form,
  Input,
  InputNumber,
  Select,
  Spin,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import {
  useGetBomFullByIdQuery,
  useGetBomVersionsQuery,
  useReplaceBomMutation,
} from "@/lib/api/bom/api";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetProcessesQuery, useGetUomsQuery } from "@/lib/api/system-settings/api";
import { useListSuppliersQuery } from "@/lib/api/suppliers/api";

const { Title, Text } = Typography;
const { TextArea } = Input;

type ToolingForm = {
  tooling_type?: string;
  tooling_code?: string;
  tooling_name?: string;
};

type ProcessRouteForm = {
  op_seq?: number;
  process_id?: number | string;
  machine_id?: number | null;
  cycle_time_sec?: number;
  setup_time_min?: number;
  machine_stroke?: string;
  tooling_ref?: string;
  toolings?: ToolingForm[];
};

type MaterialSpecForm = {
  material_code?: string;
  form?: string;
  supplier?: string;
  weight_kg?: number;
  width_mm?: number;
  diameter_mm?: number;
  thickness_mm?: number;
  length_mm?: number;
  cycle_time_sec?: number;
  setup_time_min?: number;
  customer_cycle?: string;
};

type ChildPartForm = {
  child_id?: number | string | null;
  line_id?: number | string | null;
  uniq_code?: string;
  parent_uniq_code?: string;
  level?: number;
  qty_per_uniq?: number;
  scrap_factor?: number;
  is_phantom?: boolean;
  part_name?: string;
  part_number?: string;
  model?: string;
  uom?: string | number;
  asset_id?: number | string | null;
  asset_url?: string | null;
  material_spec?: MaterialSpecForm;
  process_routes?: ProcessRouteForm[];
  children?: ChildPartForm[];
};

type EditValues = {
  change_note?: string;
  parent_uniq?: string;
  part_name?: string;
  part_number?: string;
  model?: string;
  uom?: string | number;
  status?: string;
  description?: string;
  asset_id?: number | string | null;
  asset_url?: string | null;
  material_spec?: MaterialSpecForm;
  process_routes?: ProcessRouteForm[];
  child_parts?: ChildPartForm[];
};

type FormPath = Array<string | number>;

const MAX_CHILDREN_PER_PARENT = 6;
const MAX_BOM_LEVEL = 6;

const toNumberId = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) ? asNumber : undefined;
  }
  return undefined;
};

const cleanText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const cleanNullableText = (value: unknown): string | null => cleanText(value) ?? null;

const asFile = (value: unknown): File | null => (value instanceof File ? value : null);

const toChildFileKey = (path: Array<string | number>): string => path.join(".");

const normalizeMaterialForm = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  const allowed = new Set(["Plate", "Coil", "Pipe", "Rod", "Wire", "Other"]);
  if (allowed.has(raw)) return raw;
  const lower = raw.toLowerCase();
  if (lower === "sheet" || lower === "plate") return "Plate";
  if (lower === "round bar" || lower === "rod") return "Rod";
  if (lower === "pipe") return "Pipe";
  if (lower === "coil") return "Coil";
  if (lower === "wire") return "Wire";
  if (lower === "other") return "Other";
  return undefined;
};

const resolveAssetUrl = (url: unknown): string => {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // /uploads/ paths are proxied via Next.js rewrites — serve as-is
  if (trimmed.startsWith("/uploads/")) return trimmed;
  if (!apiBaseUrl) return trimmed;
  if (trimmed.startsWith("/")) return `${apiBaseUrl}${trimmed}`;
  return `${apiBaseUrl}/${trimmed}`;
};

const createDefaultChild = (): ChildPartForm => ({
  qty_per_uniq: 1,
  scrap_factor: 0,
  is_phantom: false,
  process_routes: [],
  material_spec: {},
  children: [],
});

function ChildCollapseHeader({
  form,
  itemPath,
  numbering,
  level,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: import("antd").FormInstance<any>;
  itemPath: Array<string | number>;
  numbering: number[];
  level: number;
}) {
  const uniqCode = Form.useWatch([...itemPath, "uniq_code"], form as any);
  const partName = Form.useWatch([...itemPath, "part_name"], form as any);
  const label = [uniqCode, partName].filter(Boolean).join(" — ");
  return (
    <span className="font-medium">
      Child #{numbering.join(".")}
      <span className="ml-2 text-xs font-normal text-gray-400">Level {level}</span>
      {label ? <span className="ml-2 text-sm text-blue-600">{label}</span> : null}
    </span>
  );
}

export default function BomEditPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<EditValues>();
  const rootAddChildRef = useRef<(() => void) | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [childFileLists, setChildFileLists] = useState<Record<string, UploadFile[]>>({});

  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const queryArg = apiEnabled && id ? id : skipToken;

  const { data, isLoading, error } = useGetBomFullByIdQuery(queryArg);
  const { data: versionsRes } = useGetBomVersionsQuery(queryArg);
  const [replaceBom, replaceState] = useReplaceBomMutation();

  const bom = (data as any)?.data ?? data;
  const watchedPartName = Form.useWatch("part_name", form);
  const watchedParentProcessRoutes = Form.useWatch("process_routes", form);
  const childParts = Form.useWatch("child_parts", form);
  const childPartsCount = Array.isArray(childParts) ? childParts.length : 0;
  const existingParentAssetUrl = resolveAssetUrl(Form.useWatch("asset_url", form));

  const titlePartName = useMemo(() => {
    if (typeof watchedPartName === "string" && watchedPartName.trim()) {
      return watchedPartName.trim();
    }
    const bomPartName = (bom as any)?.part_name;
    return typeof bomPartName === "string" && bomPartName.trim() ? bomPartName.trim() : "";
  }, [bom, watchedPartName]);

  const canonicalBomId = useMemo(() => {
    const bomId = (bom as any)?.bom_id;
    if (typeof bomId === "number" && Number.isFinite(bomId)) return String(bomId);
    if (typeof bomId === "string" && bomId.trim()) return bomId.trim();
    return id;
  }, [bom, id]);

  const resolvedBomId = canonicalBomId ?? id ?? "";

  const versionsData = (versionsRes as any)?.data ?? versionsRes;
  const currentBomIdRaw = (versionsData as any)?.current_bom_id;
  const currentBomId =
    typeof currentBomIdRaw === "number" && Number.isFinite(currentBomIdRaw)
      ? String(currentBomIdRaw)
      : typeof currentBomIdRaw === "string" && currentBomIdRaw.trim()
        ? currentBomIdRaw.trim()
        : "";

  const isLatest = useMemo(() => {
    if (!currentBomId) return true;
    return String(resolvedBomId) === String(currentBomId);
  }, [currentBomId, resolvedBomId]);

  useEffect(() => {
    if (canonicalBomId && id && canonicalBomId !== id) {
      router.replace(`/bill-of-material/${encodeURIComponent(canonicalBomId)}/edit`);
    }
  }, [canonicalBomId, id, router]);

  const { data: processes = [], isLoading: isProcessesLoading } =
    useGetProcessesQuery(undefined, { skip: !apiEnabled });
  const { data: suppliers = [], isLoading: isSuppliersLoading } = useListSuppliersQuery();
  const {
    data: uoms = [],
    isLoading: isUomsLoading,
    error: uomsError,
  } = useGetUomsQuery(undefined, { skip: !apiEnabled });

  const processOptions = useMemo<Array<{ value: string | number; label: string; isAssembly: boolean }>>(() => {
    return (processes ?? [])
      .map((p: any) => {
        const rawId = p?.id ?? p?.ID;
        const idStr = typeof rawId === "string" ? rawId.trim() : String(rawId ?? "").trim();
        if (!idStr) return null;
        const asNumber = Number(idStr);
        const value: string | number = Number.isFinite(asNumber) ? asNumber : idStr;
        const code = String(p?.process_code ?? p?.ProcessCode ?? "").trim();
        const name = String(p?.process_name ?? p?.ProcessName ?? "").trim();
        return {
          value,
          label: code && name ? `${code} — ${name}` : name || code || idStr,
          isAssembly: Boolean(p?.is_assembly ?? p?.IsAssembly),
        };
      })
      .filter(
        (item): item is { value: string | number; label: string; isAssembly: boolean } => Boolean(item)
      );
  }, [processes]);

  const supplierOptions = useMemo(
    () =>
      suppliers
        .map((supplier) => {
          const rawId = supplier.id;
          const value = rawId === undefined || rawId === null ? "" : String(rawId);
          const label =
            typeof supplier.supplier_name === "string" && supplier.supplier_name.trim()
              ? supplier.supplier_name.trim()
              : value;
          if (!value) return null;
          return { value, label };
        })
        .filter((item): item is { value: string; label: string } => Boolean(item)),
    [suppliers]
  );

  const supplierNameByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of supplierOptions) {
      map.set(String(option.value), option.label);
    }
    return map;
  }, [supplierOptions]);

  const uomIsForbidden = useMemo(() => {
    const err = uomsError as any;
    const status = err?.status ?? err?.data?.status;
    return Number(status) === 403;
  }, [uomsError]);

  const seededUomOptions = useMemo<Array<{ value: string; label: string; code: string }>>(
    () => [
      { value: "PCS", label: "PCS — Pieces", code: "PCS" },
      { value: "KG", label: "KG — Kilogram", code: "KG" },
      { value: "M", label: "M — Meter", code: "M" },
      { value: "MM", label: "MM — Millimeter", code: "MM" },
    ],
    []
  );

  const uomOptions = useMemo<Array<{ value: string; label: string; code: string }>>(() => {
    if (!apiEnabled) return seededUomOptions;
    const mapped = (uoms ?? [])
      .map((uom) => {
        const idValue = String((uom as any).id ?? "").trim();
        const code = String((uom as any).code ?? (uom as any).unit_code ?? "").trim().toUpperCase();
        const name = String((uom as any).name ?? (uom as any).unit_name ?? "").trim();
        if (!idValue || !code) return null;
        return { value: idValue, label: code && name ? `${code} — ${name}` : code, code };
      })
      .filter((item): item is { value: string; label: string; code: string } => Boolean(item));
    if (mapped.length > 0) return mapped;
    return uomIsForbidden ? [] : seededUomOptions;
  }, [apiEnabled, seededUomOptions, uomIsForbidden, uoms]);

  const uomCodeByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of uomOptions) {
      map.set(String(option.value), option.code);
    }
    return map;
  }, [uomOptions]);

  const uomValueByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of uomOptions) {
      map.set(option.code, String(option.value));
    }
    return map;
  }, [uomOptions]);

  const isAssemblyProcessValue = (value: unknown) => {
    const key = String(value ?? "").trim();
    if (!key) return false;
    return processOptions.some(
      (option) => String(option.value).trim() === key && option.isAssembly === true
    );
  };

  const isParentAssembly = useMemo(() => {
    if (!Array.isArray(watchedParentProcessRoutes) || watchedParentProcessRoutes.length === 0) {
      return false;
    }
    return watchedParentProcessRoutes.some((route) => isAssemblyProcessValue(route?.process_id));
  }, [watchedParentProcessRoutes, processOptions]);

  useEffect(() => {
    if (!isParentAssembly) return;
    const currentRoutes = form.getFieldValue("process_routes");
    const currentFirst = Array.isArray(currentRoutes) && currentRoutes.length > 0 ? currentRoutes[0] : {};
    form.setFieldValue("process_routes", [
      {
        ...currentFirst,
        op_seq:
          typeof currentFirst?.op_seq === "number" && Number.isFinite(currentFirst.op_seq)
            ? currentFirst.op_seq
            : 10,
      },
    ]);
    form.setFieldValue("material_spec", {});
  }, [form, isParentAssembly]);

  useEffect(() => {
    if (!bom) return;
    const mapRouteFromApi = (route: any): ProcessRouteForm => ({
      op_seq: typeof route?.op_seq === "number" ? route.op_seq : undefined,
      process_id: route?.process_id ?? undefined,
      machine_id: route?.machine_id != null ? Number(route.machine_id) || null : null,
      cycle_time_sec: typeof route?.cycle_time_sec === "number" ? route.cycle_time_sec : undefined,
      setup_time_min: typeof route?.setup_time_min === "number" ? route.setup_time_min : undefined,
      machine_stroke: typeof route?.machine_stroke === "string" ? route.machine_stroke : undefined,
      tooling_ref: typeof route?.tooling_ref === "string" ? route.tooling_ref : undefined,
      toolings: Array.isArray(route?.toolings)
        ? route.toolings.map((t: any): ToolingForm => ({
            tooling_type: typeof t?.tooling_type === "string" ? t.tooling_type : undefined,
            tooling_code: typeof t?.tooling_code === "string" ? t.tooling_code : undefined,
            tooling_name: typeof t?.tooling_name === "string" ? t.tooling_name : undefined,
          }))
        : [],
    });

    const mapMaterialSpecFromApi = (spec: any): MaterialSpecForm | undefined => {
      if (!spec || typeof spec !== "object") return undefined;
      return {
        material_code:
          typeof spec.material_code === "string"
            ? spec.material_code
            : typeof spec.material_grade === "string"
              ? spec.material_grade
              : undefined,
        form: typeof spec.form === "string" ? spec.form : undefined,
        supplier:
          typeof spec.supplier_id === "string"
            ? spec.supplier_id
            : typeof spec.supplier_name === "string"
              ? spec.supplier_name
              : typeof spec.supplier === "string"
                ? spec.supplier
                : undefined,
        weight_kg: typeof spec.weight_kg === "number" ? spec.weight_kg : undefined,
        width_mm: typeof spec.width_mm === "number" ? spec.width_mm : undefined,
        diameter_mm: typeof spec.diameter_mm === "number" ? spec.diameter_mm : undefined,
        thickness_mm: typeof spec.thickness_mm === "number" ? spec.thickness_mm : undefined,
        length_mm: typeof spec.length_mm === "number" ? spec.length_mm : undefined,
        cycle_time_sec: typeof spec.cycle_time_sec === "number" ? spec.cycle_time_sec : undefined,
        setup_time_min: typeof spec.setup_time_min === "number" ? spec.setup_time_min : undefined,
        customer_cycle: typeof spec.customer_cycle === "string" ? spec.customer_cycle : undefined,
      };
    };

    const mapUomToFormValue = (rawUom: unknown) => {
      const code = typeof rawUom === "string" ? rawUom.trim().toUpperCase() : "";
      if (!code) return undefined;
      return uomValueByCode.get(code) ?? code;
    };

    const mapChildFromApi = (child: any): ChildPartForm => ({
      child_id: child?.child_id ?? null,
      line_id: child?.line_id ?? null,
      uniq_code: typeof child?.uniq_code === "string" ? child.uniq_code : undefined,
      parent_uniq_code: typeof child?.parent_uniq_code === "string" ? child.parent_uniq_code : undefined,
      level: typeof child?.level === "number" ? child.level : undefined,
      qty_per_uniq:
        typeof child?.qty_per_uniq === "number" ? child.qty_per_uniq : typeof child?.qpu === "number" ? child.qpu : 1,
      scrap_factor: typeof child?.scrap_factor === "number" ? child.scrap_factor : 0,
      is_phantom: Boolean(child?.is_phantom),
      part_name: typeof child?.part_name === "string" ? child.part_name : undefined,
      part_number: typeof child?.part_number === "string" ? child.part_number : undefined,
      model: typeof child?.model === "string" ? child.model : undefined,
      uom: mapUomToFormValue(child?.uom),
      asset_id: child?.asset?.id ?? null,
      asset_url: typeof child?.asset?.url === "string" ? child.asset.url : null,
      material_spec: mapMaterialSpecFromApi(child?.material_spec),
      process_routes: Array.isArray(child?.process_routes) ? child.process_routes.map(mapRouteFromApi) : [],
      children: Array.isArray(child?.children) ? child.children.map(mapChildFromApi) : [],
    });

    form.setFieldsValue({
      change_note: "",
      parent_uniq: typeof (bom as any)?.uniq_code === "string" ? (bom as any).uniq_code : undefined,
      part_name: typeof (bom as any)?.part_name === "string" ? (bom as any).part_name : undefined,
      part_number: typeof (bom as any)?.part_number === "string" ? (bom as any).part_number : undefined,
      model: typeof (bom as any)?.model === "string" ? (bom as any).model : undefined,
      uom: mapUomToFormValue((bom as any)?.uom),
      status: typeof (bom as any)?.status === "string" ? (bom as any).status : "Draft",
      description: typeof (bom as any)?.description === "string" ? (bom as any).description : undefined,
      asset_id: (bom as any)?.asset?.id ?? null,
      asset_url: typeof (bom as any)?.asset?.url === "string" ? (bom as any).asset.url : null,
      material_spec: mapMaterialSpecFromApi((bom as any)?.material_spec),
      process_routes: Array.isArray((bom as any)?.process_routes)
        ? (bom as any).process_routes.map(mapRouteFromApi)
        : [],
      child_parts: Array.isArray((bom as any)?.children)
        ? (bom as any).children.map(mapChildFromApi)
        : [],
    });
    setFileList([]);
    setChildFileLists({});
  }, [bom, form, uomValueByCode]);

  const addLevel1Child = () => {
    rootAddChildRef.current?.();
  };

  const renderProcessRoutesEditor = (
    fieldPath: FormPath,
    absolutePath: FormPath,
    options?: { hideAddWhenAssembly?: boolean; isAssemblyMode?: boolean }
  ) => {
    const isAssemblyMode = options?.isAssemblyMode === true;
    const hideAddWhenAssembly = options?.hideAddWhenAssembly === true;
    return (
      <div className="space-y-3">
        {!(hideAddWhenAssembly && isAssemblyMode) ? (
          <div className="flex items-center justify-between">
            <Text strong>Process Routes</Text>
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                const dynamicForm = form as any;
                const current = dynamicForm.getFieldValue([...absolutePath, "process_routes"]) ?? [];
                dynamicForm.setFieldValue([...absolutePath, "process_routes"], [
                  ...current,
                  {
                    op_seq:
                      typeof current?.[current.length - 1]?.op_seq === "number"
                        ? current[current.length - 1].op_seq + 10
                        : (current.length + 1) * 10,
                  },
                ]);
              }}
            >
              Add Process Route
            </Button>
          </div>
        ) : (
          <Text strong>Process Routes</Text>
        )}

        <Form.List name={[...fieldPath, "process_routes"]}>
          {(routeFields, { remove }) => (
            <div className="space-y-3">
              {routeFields.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                  No process route yet.
                </div>
              ) : null}

              {routeFields.map((routeField, idx) => (
                <div key={routeField.key} className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <Form.Item name={[routeField.name, "op_seq"]} label="Op Seq" rules={[{ required: true, message: "Op Seq is required" }]}>
                      <InputNumber min={1} step={10} style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item name={[routeField.name, "process_id"]} label="Process" rules={[{ required: true, message: "Process is required" }]}>
                      <Select
                        showSearch
                        placeholder="Select process"
                        options={processOptions}
                        loading={isProcessesLoading}
                        optionFilterProp="label"
                        filterOption={(input, option) =>
                          String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Form.Item>
                    <Form.Item name={[routeField.name, "machine_id"]} label="Machine ID">
                      <InputNumber min={0} style={{ width: "100%" }} placeholder="e.g. 1" />
                    </Form.Item>
                    <Form.Item name={[routeField.name, "cycle_time_sec"]} label="Cycle Time (sec)">
                      <InputNumber min={0} style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item name={[routeField.name, "setup_time_min"]} label="Setup Time (min)">
                      <InputNumber min={0} style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item name={[routeField.name, "machine_stroke"]} label="Machine Stroke" className="md:col-span-4">
                      <Input placeholder="Machine stroke" />
                    </Form.Item>
                    <div className="flex items-end justify-end md:col-span-1">
                      <Button danger type="text" icon={<DeleteOutlined />} disabled={isAssemblyMode && idx === 0} onClick={() => remove(routeField.name)}>
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Text className="text-sm font-medium">Toolings</Text>
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          const dynamicForm = form as any;
                          const current = dynamicForm.getFieldValue([...absolutePath, "process_routes", routeField.name, "toolings"]) ?? [];
                          dynamicForm.setFieldValue([...absolutePath, "process_routes", routeField.name, "toolings"], [...current, {}]);
                        }}
                      >
                        Add Tooling
                      </Button>
                    </div>
                    <Form.List name={[routeField.name, "toolings"]}>
                      {(toolingFields, { remove: removeTooling }) => (
                        <div className="space-y-2">
                          {toolingFields.length === 0 ? (
                            <div className="text-xs text-gray-400 py-1">No toolings</div>
                          ) : null}
                          {toolingFields.map((toolingField) => (
                            <div key={toolingField.key} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end rounded border border-gray-100 bg-gray-50 p-2">
                              <Form.Item name={[toolingField.name, "tooling_type"]} label="Type" className="!mb-0">
                                <Select
                                  placeholder="Type"
                                  options={[
                                    { label: "Dies", value: "Dies" },
                                    { label: "JIG", value: "JIG" },
                                    { label: "CF", value: "CF" },
                                  ]}
                                  allowClear
                                />
                              </Form.Item>
                              <Form.Item name={[toolingField.name, "tooling_code"]} label="Code" className="!mb-0">
                                <Input placeholder="e.g. DIE-EMA-001" />
                              </Form.Item>
                              <Form.Item name={[toolingField.name, "tooling_name"]} label="Name" className="!mb-0">
                                <Input placeholder="e.g. Stamp Die EMA-LV7" />
                              </Form.Item>
                              <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeTooling(toolingField.name)} />
                            </div>
                          ))}
                        </div>
                      )}
                    </Form.List>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Form.List>
      </div>
    );
  };

  const renderMaterialSpecEditor = (fieldPath: FormPath, disabled = false) => (
    <div className="space-y-3">
      <Text strong>Material Specifications</Text>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Form.Item name={[...fieldPath, "material_spec", "material_code"]} label="Material Code" rules={disabled ? [] : [{ required: true, message: "Material Code is required" }]}> 
          <Input placeholder="e.g., STKM550" disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "form"]} label="Form" rules={disabled ? [] : [{ required: true, message: "Form is required" }]}> 
          <Select
            placeholder="Select form"
            disabled={disabled}
            options={[
              { label: "Plate", value: "Plate" },
              { label: "Coil", value: "Coil" },
              { label: "Pipe", value: "Pipe" },
              { label: "Rod", value: "Rod" },
              { label: "Wire", value: "Wire" },
              { label: "Other", value: "Other" },
            ]}
            allowClear
          />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "supplier"]} label="Supplier" rules={disabled ? [] : [{ required: true, message: "Supplier is required" }]}> 
          <Select
            placeholder="Select supplier"
            disabled={disabled}
            options={supplierOptions}
            loading={isSuppliersLoading}
            showSearch
            optionFilterProp="label"
            allowClear
          />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "weight_kg"]} label="Weight (kg)">
          <InputNumber min={0} style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Form.Item name={[...fieldPath, "material_spec", "width_mm"]} label="Width (mm)">
          <InputNumber min={0} style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "diameter_mm"]} label="Diameter (mm)">
          <InputNumber min={0} style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "thickness_mm"]} label="Thickness (mm)">
          <InputNumber min={0} style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "length_mm"]} label="Length (mm)">
          <InputNumber min={0} style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "cycle_time_sec"]} label="Cycle Time (sec)">
          <InputNumber min={0} style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "setup_time_min"]} label="Setup Time (min)">
          <InputNumber min={0} style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "customer_cycle"]} label="Customer Cycle">
          <Input placeholder="e.g., Daily / Weekly / Monthly" disabled={disabled} />
        </Form.Item>
      </div>
    </div>
  );

  const renderChildProcessAndMaterial = (fieldPath: FormPath, absolutePath: FormPath) => (
    <div className="mt-6 space-y-6">
      {renderProcessRoutesEditor(fieldPath, absolutePath)}
      {renderMaterialSpecEditor(fieldPath)}
    </div>
  );

  const renderChildCards = (
    fields: Array<{ key: number; name: number }>,
    remove: (index: number | number[]) => void,
    listPath: FormPath,
    level: number,
    parentNumbers: number[] = []
  ) => (
    <div className={level === 1 ? "space-y-5" : "mt-5 space-y-4 border-l-2 border-gray-100 pl-4"}>
      {fields.map((field, idx) => {
        const numbering = [...parentNumbers, idx + 1];
        const itemPath = [...listPath, field.name];
        const childFileKey = toChildFileKey(itemPath);
        const canAddMoreLevels = level < MAX_BOM_LEVEL;
        const dynamicForm = form as any;
        const existingChildAssetUrl = resolveAssetUrl(dynamicForm.getFieldValue([...itemPath, "asset_url"]));

        const childContent = (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Form.Item name={[field.name, "uniq_code"]} label="UNIQ" rules={[{ required: true, message: "UNIQ is required" }]}>
                <Input placeholder="Child UNIQ" size="large" />
              </Form.Item>
              <Form.Item name={[field.name, "part_name"]} label="Part Name" rules={[{ required: true, message: "Part name is required" }]}>
                <Input placeholder="Part name" size="large" />
              </Form.Item>
              <Form.Item name={[field.name, "part_number"]} label="Part Number" rules={[{ required: true, message: "Part number is required" }]}>
                <Input placeholder="Part number" size="large" />
              </Form.Item>
              <Form.Item name={[field.name, "model"]} label="Model">
                <Input placeholder="Model" size="large" />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Form.Item name={[field.name, "uom"]} label="UOM" rules={[{ required: true, message: "UOM is required" }]}>
                <Select
                  showSearch
                  placeholder="Select UOM"
                  options={uomOptions}
                  loading={apiEnabled && isUomsLoading && !uomIsForbidden}
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item name={[field.name, "qty_per_uniq"]} label="Qty per UNIQ" rules={[{ required: true, message: "Qty per UNIQ is required" }]}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name={[field.name, "scrap_factor"]} label="Scrap Factor">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name={[field.name, "is_phantom"]} valuePropName="checked" label=" ">
                <Checkbox>Is Phantom</Checkbox>
              </Form.Item>
            </div>

            <Form.Item name={[field.name, "asset_id"]} hidden>
              <Input />
            </Form.Item>
            <Form.Item name={[field.name, "asset_url"]} hidden>
              <Input />
            </Form.Item>

            <div className="mb-6">
              <Text className="block mb-2">Add Picture for Child UNIQ</Text>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <Upload
                  fileList={childFileLists[childFileKey] ?? []}
                  beforeUpload={() => false}
                  onChange={({ fileList: next }) =>
                    setChildFileLists((prev) => ({ ...prev, [childFileKey]: next }))
                  }
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />}>Choose File</Button>
                </Upload>
                {existingChildAssetUrl ? (
                  <a href={existingChildAssetUrl} target="_blank" rel="noreferrer" className="inline-block">
                    <img
                      src={existingChildAssetUrl}
                      alt="Current asset"
                      className="h-16 w-16 rounded-lg border border-gray-200 object-cover hover:opacity-80 transition-opacity"
                    />
                    <div className="mt-1 text-xs text-blue-500">View full</div>
                  </a>
                ) : (
                  <Text type="secondary">No existing asset</Text>
                )}
              </div>
            </div>

            {renderChildProcessAndMaterial([field.name], itemPath)}

            {canAddMoreLevels ? (
              <Form.List name={[field.name, "children"]}>
                {(nestedFields, { add: addNestedField, remove: removeNestedField }) => (
                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Text strong>Level {level + 1} Children</Text>
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => {
                          if (nestedFields.length >= MAX_CHILDREN_PER_PARENT) {
                            messageApi.warning(`Maximum ${MAX_CHILDREN_PER_PARENT} child parts allowed for each parent.`);
                            return;
                          }
                          addNestedField(createDefaultChild());
                        }}
                      >
                        Add Child Level {level + 1}
                      </Button>
                    </div>
                    {nestedFields.length > 0 ? (
                      renderChildCards(nestedFields as Array<{ key: number; name: number }>, removeNestedField, [...itemPath, "children"], level + 1, numbering)
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500">No level {level + 1} child yet.</div>
                    )}
                  </div>
                )}
              </Form.List>
            ) : null}
          </div>
        );

        return (
          <Collapse
            key={field.key}
            defaultActiveKey={[]}
            className="border border-gray-200 rounded-lg overflow-hidden"
            items={[{
              key: "1",
              label: (
                <ChildCollapseHeader
                  form={form}
                  itemPath={itemPath}
                  numbering={numbering}
                  level={level}
                />
              ),
              extra: (
                <Button
                  danger
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => { e.stopPropagation(); remove(field.name); }}
                >
                  Remove
                </Button>
              ),
              children: childContent,
            }]}
          />
        );
      })}
    </div>
  );

  const renderChildList = (listPath: FormPath, level: number, parentNumbers: number[] = []) => (
    <Form.List name={listPath}>
      {(fields, { add, remove }) => {
        if (level === 1) {
          rootAddChildRef.current = () => {
            if (fields.length >= MAX_CHILDREN_PER_PARENT) {
              messageApi.warning(`Maximum ${MAX_CHILDREN_PER_PARENT} child parts allowed for each parent.`);
              return;
            }
            add(createDefaultChild());
          };
        }

        if (fields.length === 0) {
          if (level !== 1) return null;
          return (
            <Card styles={{ body: { paddingTop: 24, paddingBottom: 24 } }}>
              <div className="flex flex-col items-center justify-center text-center py-10">
                <Text type="secondary">No child components added yet</Text>
                <div className="mt-4">
                  <Button type="primary" icon={<PlusOutlined />} onClick={addLevel1Child} disabled={childPartsCount >= MAX_CHILDREN_PER_PARENT}>
                    Add First Child Component
                  </Button>
                </div>
              </div>
            </Card>
          );
        }

        return renderChildCards(fields as Array<{ key: number; name: number }>, remove, listPath, level, parentNumbers);
      }}
    </Form.List>
  );

  const onSave = async () => {
    try {
      if (!isLatest) {
        messageApi.error("Tidak bisa edit historical version. Pilih latest version dulu, lalu edit.");
        return;
      }

      await form.validateFields(["change_note", "part_name", "part_number", "uom", "status"]);
      const values = form.getFieldsValue(true) as EditValues;
      const assemblyMode = Array.isArray(values.process_routes) && values.process_routes.some((route) => isAssemblyProcessValue(route?.process_id));

      if (!assemblyMode) {
        await form.validateFields([["material_spec", "material_code"], ["material_spec", "form"], ["material_spec", "supplier"]]);
      }

      const rootUniq = cleanText(values.parent_uniq);
      if (!rootUniq) {
        messageApi.error("Missing parent UNIQ");
        return;
      }

      const resolveUomCode = (rawValue: unknown): string | null => {
        if (rawValue === undefined || rawValue === null) return null;
        const key = String(rawValue).trim();
        if (!key) return null;
        return uomCodeByValue.get(key) ?? key.toUpperCase();
      };

      const mapMaterialSpec = (spec?: MaterialSpecForm) => {
        const supplierRaw = cleanText(spec?.supplier);
        const normalizedForm = normalizeMaterialForm(spec?.form);
        const payload: Record<string, unknown> = {
          material_grade: cleanText(spec?.material_code) ?? null,
          form: normalizedForm ?? null,
          width_mm: typeof spec?.width_mm === "number" && Number.isFinite(spec.width_mm) ? spec.width_mm : null,
          diameter_mm: typeof spec?.diameter_mm === "number" && Number.isFinite(spec.diameter_mm) ? spec.diameter_mm : null,
          thickness_mm: typeof spec?.thickness_mm === "number" && Number.isFinite(spec.thickness_mm) ? spec.thickness_mm : null,
          length_mm: typeof spec?.length_mm === "number" && Number.isFinite(spec.length_mm) ? spec.length_mm : null,
          weight_kg: typeof spec?.weight_kg === "number" && Number.isFinite(spec.weight_kg) ? spec.weight_kg : null,
          cycle_time_sec: typeof spec?.cycle_time_sec === "number" && Number.isFinite(spec.cycle_time_sec) ? spec.cycle_time_sec : null,
          setup_time_min: typeof spec?.setup_time_min === "number" && Number.isFinite(spec.setup_time_min) ? spec.setup_time_min : null,
          customer_cycle: cleanText(spec?.customer_cycle) ?? null,
        };
        if (supplierRaw) {
          const supplierId = toNumberId(supplierRaw);
          if (supplierId !== undefined) {
            payload.supplier_id = supplierId;
          } else {
            payload.supplier_name = supplierNameByValue.get(supplierRaw) ?? supplierRaw;
          }
        } else {
          payload.supplier_id = null;
        }
        const hasMeaningfulValue = Object.values(payload).some((value) => value !== null && value !== undefined && value !== "");
        return hasMeaningfulValue ? payload : null;
      };

      const mapProcessRoutes = (routes?: ProcessRouteForm[]) =>
        (routes ?? [])
          .map((route, index) => {
            const processId = toNumberId(route.process_id);
            if (processId === undefined) return null;
            const body: Record<string, unknown> = {
              op_seq: typeof route.op_seq === "number" && Number.isFinite(route.op_seq) ? route.op_seq : (index + 1) * 10,
              process_id: processId,
              machine_id: route.machine_id != null && Number.isFinite(route.machine_id) ? route.machine_id : null,
            };
            if (typeof route.cycle_time_sec === "number" && Number.isFinite(route.cycle_time_sec)) body.cycle_time_sec = route.cycle_time_sec;
            if (typeof route.setup_time_min === "number" && Number.isFinite(route.setup_time_min)) body.setup_time_min = route.setup_time_min;
            if (cleanText(route.machine_stroke)) body.machine_stroke = cleanText(route.machine_stroke);
            if (cleanText(route.tooling_ref)) body.tooling_ref = cleanText(route.tooling_ref);
            body.toolings = Array.isArray(route.toolings)
              ? route.toolings
                  .map((t) => ({
                    tooling_type: cleanText(t.tooling_type) ?? null,
                    tooling_code: cleanText(t.tooling_code) ?? null,
                    tooling_name: cleanText(t.tooling_name) ?? null,
                  }))
                  .filter((t) => t.tooling_type || t.tooling_code || t.tooling_name)
              : [];
            return body;
          })
          .filter((item): item is Record<string, unknown> => Boolean(item));

      const mapAssemblyParentRoutes = (routes?: ProcessRouteForm[]) => {
        const first = Array.isArray(routes) ? routes[0] : undefined;
        const processId = toNumberId(first?.process_id);
        if (processId === undefined) return [];
        return [{ op_seq: typeof first?.op_seq === "number" && Number.isFinite(first.op_seq) ? first.op_seq : 10, process_id: processId }];
      };

      const files: Array<{ key: string; file: File }> = [];
      const seenUniqs = new Set<string>();

      const mapChildParts = (children: ChildPartForm[] | undefined, level: number, parentUniq: string, pathIndices: number[] = []): any[] => {
        const list = Array.isArray(children) ? children : [];
        return list.map((child, index) => {
          const currentPath = [...pathIndices, index];
          const uniqCode = cleanText(child.uniq_code);
          const partName = cleanText(child.part_name);
          const partNumber = cleanText(child.part_number);
          const childUom = resolveUomCode(child.uom);
          const pathLabel = currentPath.map((value) => value + 1).join(".");
          if (!uniqCode || !partName || !partNumber || !childUom) throw new Error(`Child #${pathLabel} belum lengkap.`);
          if (seenUniqs.has(uniqCode)) throw new Error(`Duplicate child UNIQ '${uniqCode}'.`);
          seenUniqs.add(uniqCode);

          const childFileKey = toChildFileKey(["child_parts", ...currentPath.flatMap((pathIndex, depth) => depth === 0 ? [pathIndex] : ["children", pathIndex])]);
          const childFile = asFile(childFileLists?.[childFileKey]?.[0]?.originFileObj);
          const childUploadKey = childFile
            ? childFile.name.replace(/\.[^.]+$/, "").replace(/\s+/g, "_").toLowerCase()
            : null;
          if (childFile && childUploadKey) files.push({ key: `upload_${childUploadKey}`, file: childFile });

          return {
            uniq_code: uniqCode,
            parent_uniq_code: parentUniq,
            level,
            qty_per_uniq: typeof child.qty_per_uniq === "number" && Number.isFinite(child.qty_per_uniq) ? child.qty_per_uniq : 1,
            scrap_factor: typeof child.scrap_factor === "number" && Number.isFinite(child.scrap_factor) ? child.scrap_factor : 0,
            is_phantom: child.is_phantom === true,
            part_name: partName,
            part_number: partNumber,
            model: cleanNullableText(child.model),
            uom: childUom,
            asset_id: childFile ? null : child.asset_id ?? null,
            upload_key: childUploadKey ?? null,
            material_spec: mapMaterialSpec(child.material_spec),
            process_routes: mapProcessRoutes(child.process_routes),
            children: mapChildParts(child.children, level + 1, uniqCode, currentPath),
          };
        });
      };

      const parentUom = resolveUomCode(values.uom);
      if (!parentUom) {
        messageApi.error("UOM is required.");
        return;
      }

      const parentFile = asFile(fileList?.[0]?.originFileObj);
      if (parentFile) files.push({ key: "upload_parent", file: parentFile });

      const parentRoutes = assemblyMode ? mapAssemblyParentRoutes(values.process_routes) : mapProcessRoutes(values.process_routes);
      const parentMaterialSpec = assemblyMode ? null : mapMaterialSpec(values.material_spec);
      const childrenPayload = mapChildParts(values.child_parts, 1, rootUniq);

      if (assemblyMode && childrenPayload.length < 2) {
        messageApi.error("Assembly parent must have at least 2 child parts.");
        return;
      }
      if (!assemblyMode && !parentMaterialSpec) {
        messageApi.error("Material specifications are required.");
        return;
      }

      const replaceResult = await replaceBom({
        bom_id: resolvedBomId,
        payload: {
          change_note: cleanText(values.change_note),
          part_name: cleanText(values.part_name),
          part_number: cleanText(values.part_number),
          model: cleanNullableText(values.model),
          uom: parentUom,
          status: cleanText(values.status) ?? "Draft",
          description: cleanNullableText(values.description),
          asset_id: parentFile ? null : values.asset_id ?? null,
          upload_key: parentFile ? "parent" : null,
          material_spec: parentMaterialSpec,
          process_routes: parentRoutes,
          children: childrenPayload,
        },
        files,
      }).unwrap();

      const newBomId =
        (replaceResult as any)?.data?.new_bom_id ??
        (replaceResult as any)?.data?.bom_id ??
        (replaceResult as any)?.new_bom_id ??
        resolvedBomId;

      messageApi.success("BOM updated");
      router.push(`/bill-of-material/${encodeURIComponent(String(newBomId))}`);
    } catch (err) {
      const anyErr = err as any;
      const data = anyErr?.data;
      const detail =
        typeof data === "string"
          ? data
          : data && typeof data === "object"
            ? JSON.stringify(data)
            : anyErr?.message
              ? String(anyErr.message)
              : "";
      if (detail) messageApi.error(detail);
    }
  };

  return (
    <div className="p-6">
      {contextHolder}

      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm mb-6">
        <div>
          <Title level={3} className="!mb-0">{titlePartName ? `Edit BOM (${titlePartName})` : "Edit BOM"}</Title>
          <Text type="secondary">/products/bom/{resolvedBomId}/full</Text>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(`/bill-of-material/${encodeURIComponent(resolvedBomId)}`)} disabled={!resolvedBomId}>
            Back
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={replaceState.isLoading} onClick={onSave}>
            Save
          </Button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="py-8 flex items-center justify-center"><Spin /></div>
        ) : error ? (
          <Text type="danger">Failed to load BOM full detail.</Text>
        ) : (
          <>
            {!isLatest && currentBomId ? (
              <Alert
                type="warning"
                showIcon
                className="mb-4"
                message="Historical version (read-only)"
                description={
                  <div>
                    Edit hanya boleh di latest version.
                    <div className="mt-2">
                      <Button size="small" type="primary" onClick={() => router.push(`/bill-of-material/${encodeURIComponent(currentBomId)}/edit`)}>
                        Go to Latest
                      </Button>
                    </div>
                  </div>
                }
              />
            ) : null}

            <Form layout="vertical" form={form} disabled={!isLatest} requiredMark={false}>
              <Card title="Parent Component Information" className="mb-6" styles={{ body: { paddingTop: 16 } }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Form.Item name="parent_uniq" label="Parent UNIQ"><Input size="large" disabled /></Form.Item>
                  <Form.Item name="change_note" label="Change Note" rules={[{ required: true, message: "Change note is required" }]}> 
                    <Input placeholder="Contoh: Tambah image header dan update children" size="large" />
                  </Form.Item>
                  <Form.Item name="part_name" label="Part Name" rules={[{ required: true, message: "Part name is required" }]}> 
                    <Input size="large" />
                  </Form.Item>
                  <Form.Item name="part_number" label="Part Number" rules={[{ required: true, message: "Part number is required" }]}> 
                    <Input size="large" />
                  </Form.Item>
                  <Form.Item name="model" label="Model"><Input size="large" /></Form.Item>
                  <Form.Item name="uom" label="UOM" rules={[{ required: true, message: "UOM is required" }]}> 
                    <Select showSearch placeholder="Select UOM" size="large" loading={apiEnabled && isUomsLoading && !uomIsForbidden} options={uomOptions} optionFilterProp="label" />
                  </Form.Item>
                  <Form.Item name="status" label="Status" rules={[{ required: true, message: "Status is required" }]}> 
                    <Select size="large" options={[{ label: "Draft", value: "Draft" }, { label: "Released", value: "Released" }, { label: "Obsolete", value: "Obsolete" }]} />
                  </Form.Item>
                </div>

                <Form.Item name="asset_id" hidden><Input /></Form.Item>
                <Form.Item name="asset_url" hidden><Input /></Form.Item>

                <Form.Item label="Header Image">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <Upload fileList={fileList} beforeUpload={() => false} onChange={({ fileList: next }) => setFileList(next)} maxCount={1}>
                      <Button icon={<UploadOutlined />}>Choose File</Button>
                    </Upload>
                    {existingParentAssetUrl ? (
                      <a href={existingParentAssetUrl} target="_blank" rel="noreferrer" className="inline-block">
                        <img
                          src={existingParentAssetUrl}
                          alt="Current asset"
                          className="h-20 w-20 rounded-lg border border-gray-200 object-cover hover:opacity-80 transition-opacity"
                        />
                        <div className="mt-1 text-xs text-blue-500">View full</div>
                      </a>
                    ) : (
                      <Text type="secondary">No existing asset</Text>
                    )}
                  </div>
                </Form.Item>

                <Form.Item name="description" label="Description"><TextArea rows={4} /></Form.Item>
              </Card>

              <Card
                title={
                  <div className="space-y-4">
                    {isParentAssembly ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                        Process yang dipilih bertipe <span className="font-semibold">Assembly</span>, sehingga material parent disabled dan child minimal 2 item.
                      </div>
                    ) : null}
                    <span>Parent Process & Material</span>
                  </div>
                }
                className="mb-6"
                styles={{ body: { paddingTop: 16 } }}
              >
                {renderProcessRoutesEditor([], [], { hideAddWhenAssembly: true, isAssemblyMode: isParentAssembly })}
                <div className="mt-6">{renderMaterialSpecEditor([], isParentAssembly)}</div>
              </Card>

              <Card title={`Child Parts (Levels 1-${MAX_BOM_LEVEL})`} styles={{ body: { paddingTop: 16 } }}>
                <div className="flex items-center justify-between mb-4">
                  <Text type="secondary">Children dari `/products/bom/:bomId/full` bisa diedit dan akan dikirim ulang ke endpoint replace.</Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={addLevel1Child} disabled={childPartsCount >= MAX_CHILDREN_PER_PARENT}>
                    Add Level 1 Child
                  </Button>
                </div>
                {renderChildList(["child_parts"], 1)}
              </Card>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
}
