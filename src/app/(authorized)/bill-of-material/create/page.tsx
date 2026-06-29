"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  Select,
  Steps,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  RightOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import { useCreateBomMutation, useGetBomTreeQuery } from "@/lib/api/bom/api";
import { useGetProcessesQuery, useGetUomsQuery } from "@/lib/api/system-settings/api";
import {
  uploadFileInChunks,
  type CreateUploadSessionArgs,
} from "@/lib/api/uploads/chunkUpload";
import { apiBaseUrl, getCookiesFromBrowser } from "@/lib/api/instance";
import { useListSuppliersQuery } from "@/lib/api/suppliers/api";
import { useGetMachinesQuery } from "@/lib/api/machines/api";

const { Title, Text } = Typography;
const { TextArea } = Input;

type ProcessRoute = {
  remark?: string;
  sequence?: number;
  process_id?: number | string;
  machine_id?: number | string;
  cycle_time_sec_per_pc?: number;
  setup_time_min?: number;
  tooling?: string;
  machine_stroke?: string;
};

type MaterialSpec = {
  material_code?: string;
  form?: string;
  grade?: string;
  type_material?: string;
  weight_kg?: number;
  width_mm?: number;
  diameter_mm?: number;
  thickness_mm?: number;
  length_mm?: number;
  cycle_time_sec?: number;
  setup_time_min?: number;
  customer_cycle?: string;
};

type ChildPart = {
  uniq?: string;
  part_name?: string;
  part_number?: string;
  model?: string;
  category?: string;
  qpu?: number;
  version?: string;
  status?: string;
  process_routes?: ProcessRoute[];
  material_spec?: MaterialSpec;
  children?: ChildPart[];
};

type Step1Values = {
  parent_uniq?: string;
  part_name?: string;
  part_number?: string;
  model?: string;
  uom?: string | number;
  status?: string;
  bom_status?: string;
  description?: string;
  process_routes?: ProcessRoute[];
  material_spec?: MaterialSpec;
  child_parts?: ChildPart[];
};

type FormPath = Array<string | number>;

const MAX_CHILDREN_PER_PARENT = 6;
const MAX_BOM_LEVEL = 6;

type ChildUniqSelectProps = {
  itemPath: Array<string | number>;
  level: number;
  form: any;
  getOptions: (category?: string) => Array<{ label: string; value: string }>;
};

const ChildUniqSelect = ({ itemPath, level, form, getOptions }: ChildUniqSelectProps) => {
  const watchedCat = Form.useWatch([...itemPath, "category"], form) as string | undefined;
  const opts = getOptions(watchedCat);
  return (
    <Select
      showSearch
      placeholder={`Select or type UNIQ (e.g., LV7-001-${String.fromCharCode(64 + Math.min(level, 26))})`}
      size="large"
      options={opts}
      allowClear
      showArrow
    />
  );
};

const getLevelBadgeClass = (level: number) => {
  if (level <= 1) return "bg-blue-50 text-blue-700";
  if (level === 2) return "bg-emerald-50 text-emerald-700";
  if (level === 3) return "bg-amber-50 text-amber-700";
  if (level === 4) return "bg-purple-50 text-purple-700";
  return "bg-gray-100 text-gray-700";
};

const toApiStatus = (value: unknown) => (String(value ?? "").trim() === "Inactive" ? "Inactive" : "Active");

const asFile = (v: unknown): File | null => (v instanceof File ? v : null);

const toChildFileKey = (path: Array<string | number>): string => path.join(".");

const createDefaultChildPart = (): ChildPart => ({
  uniq: "",
  part_name: "",
  part_number: "",
  model: "",
  qpu: 1,
  version: "",
  status: "Active",
  process_routes: [],
  material_spec: {},
  children: [],
});

export default function Page() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<Step1Values>();
  const rootAddChildRef = useRef<(() => void) | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [childFileLists, setChildFileLists] = useState<Record<string, UploadFile[]>>({});
  const [step, setStep] = useState<number>(0);
  const [openProcessRouteIndex, setOpenProcessRouteIndex] = useState<number | null>(null);
  const apiEnabled = Boolean(apiBaseUrl);


 

  const [createBom, { isLoading: isCreating }] = useCreateBomMutation();

  const { data: existingBomTree } = useGetBomTreeQuery();

  const existingUniqs = useMemo(() => {
    const uniqs = new Set<string>();
    const nodes = (existingBomTree as any)?.data;

    const walk = (arr: any[]) => {
      for (const n of arr) {
        const uniq = typeof n?.uniq_code === "string" ? n.uniq_code.trim() : "";
        if (uniq) uniqs.add(uniq);
        const children = n?.children;
        if (Array.isArray(children) && children.length) walk(children);
      }
    };

    if (Array.isArray(nodes)) walk(nodes);
    return uniqs;
  }, [existingBomTree]);

  const getUniqOptionsForCategory = (category?: string) => {
    const desired = typeof category === "string" ? category.trim().toLowerCase() : "";
    const mapCategory = (c: string) => {
      const s = c.trim().toLowerCase();
      if (s === "rm") return "raw";
      return s;
    };
    const desiredNormalized = desired ? mapCategory(desired) : "";

    const nodes = (existingBomTree as any)?.data;
    const out: Array<{ label: string; value: string }> = [];
    const walk = (arr: any[]) => {
      for (const n of arr) {
        const uniq = typeof n?.uniq_code === "string" ? n.uniq_code.trim() : "";
        const spec = n?.material_spec || n?.material_specifications || {};
        const type = typeof spec?.type_material === "string" ? spec.type_material.trim().toLowerCase() : typeof n?.raw_material_type === "string" ? n.raw_material_type.trim().toLowerCase() : "";
        if (uniq && (!desiredNormalized || type === desiredNormalized)) {
          out.push({ label: uniq, value: uniq });
        }
        if (Array.isArray(n?.children) && n.children.length) walk(n.children);
      }
    };
    if (Array.isArray(nodes)) walk(nodes);
    // fallback to unique set of existingUniqs if none matched
    if (out.length === 0) {
      for (const u of Array.from(existingUniqs)) out.push({ label: u, value: u });
    }
    return out;
  };

  const { data: suppliers = [], isLoading: isSuppliersLoading } =
    useListSuppliersQuery();

  const { data: processes = [], isLoading: isProcessesLoading } =
    useGetProcessesQuery(undefined, { skip: !apiEnabled });
  const { data: machines = [], isLoading: isMachinesLoading } =
    useGetMachinesQuery(undefined, { skip: !apiEnabled });

  const processOptions = useMemo<Array<{ value: string | number; label: string; isAssembly: boolean; subCon: boolean }>>(() => {
    return (processes ?? [])
      .map((p: any) => {
        // Handle both snake_case (normalized) and PascalCase (raw Go response)
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
          subCon: Boolean(p?.sub_con ?? p?.subcon ?? p?.SubCon),
        };
      })
      .filter(
        (x): x is { value: string | number; label: string; isAssembly: boolean; subCon: boolean } =>
          Boolean(x) && typeof (x as any).label === "string"
      );
  }, [processes]);

  const machineOptions = useMemo<Array<{ value: string | number; label: string }>>(() => {
    return (machines ?? [])
      .map((m: any) => {
        const rawId = m?.id;
        const idStr = typeof rawId === "string" ? rawId.trim() : String(rawId ?? "").trim();
        if (!idStr) return null;
        const asNumber = Number(idStr);
        const value: string | number = Number.isFinite(asNumber) ? asNumber : idStr;
        const name = typeof m?.machine_name === "string" ? m.machine_name.trim() : "";
        const number = typeof m?.machine_number === "string" ? m.machine_number.trim() : "";
        return {
          value,
          label: number && name ? `${number} — ${name}` : name || number || idStr,
        };
      })
      .filter(
        (x): x is { value: string | number; label: string } =>
          Boolean(x) && typeof (x as any).label === "string"
      );
  }, [machines]);

  const {
    data: uoms = [],
    isLoading: isUomsLoading,
    error: uomsError,
  } = useGetUomsQuery(undefined, {
    skip: !apiEnabled,
  });

  const uomIsForbidden = useMemo(() => {
    const err = uomsError as any;
    const status = err?.status ?? err?.data?.status;
    return Number(status) === 403;
  }, [uomsError]);

  const uomOptions = useMemo(() => {
    return (uoms ?? [])
      .map((u) => {
        const id = String((u as any).id ?? "").trim();
        const code = String((u as any).code ?? (u as any).unit_code ?? "").trim().toUpperCase();
        const name = String((u as any).name ?? (u as any).unit_name ?? "").trim();
        if (!id || !code) return null;

        return {
          value: id,
          label: code && name ? `${code} — ${name}` : code,
          code,
        };
      })
      .filter((x): x is { value: string; label: string; code: string } => Boolean(x));
  }, [uoms]);

  const uomCodeByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of uomOptions) {
      map.set(String(option.value), option.code);
    }
    return map;
  }, [uomOptions]);

  const seededUomOptions = useMemo<Array<{ value: string; label: string }>>(
    () => [
      { value: "PCS", label: "PCS — Pieces" },
      { value: "KG", label: "KG — Kilogram" },
      { value: "M", label: "M — Meter" },
    ],
    []
  );

  const effectiveUomOptions = useMemo<Array<{ value: string; label: string }>>(() => {
    if (!apiEnabled) return seededUomOptions;
    if (uomOptions.length > 0) return uomOptions;
    if (uomIsForbidden) return [];
    if (isUomsLoading) return [];
    return [];
  }, [apiEnabled, isUomsLoading, seededUomOptions, uomIsForbidden, uomOptions]);

  const supplierOptions = useMemo(
    () =>
      suppliers
        .map((s) => {
          const id = s.id;
          const supplierId = id === undefined || id === null ? "" : String(id);
          const name =
            typeof s.supplier_name === "string" && s.supplier_name.trim()
              ? s.supplier_name.trim()
              : supplierId;
          if (!supplierId) return null;
          return { label: name, value: supplierId };
        })
        .filter((x): x is { label: string; value: string } => Boolean(x)),
    [suppliers]
  );

  const supplierNameByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of supplierOptions) {
      map.set(String(option.value), option.label);
    }
    return map;
  }, [supplierOptions]);

  const initialValues = useMemo<Step1Values>(
    () => ({
      status: "Active",
      bom_status: "Draft",
      process_routes: [
        {
          sequence: 1,
        },
      ],
      child_parts: [],
      material_spec: {
        // width_mm: 200,
        // diameter_mm: 25,
        // thickness_mm: 5,
        // length_mm: 300,
      },
    }),
    []
  );

  const requirePositiveNumberForForms = (
    forms: string[],
    label: string
  ) =>
    async (_: unknown, value: unknown) => {
      const currentForm = form.getFieldValue(["material_spec", "form"]);
      if (!forms.includes(String(currentForm ?? ""))) return;
      const num = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(num) || num <= 0) {
        throw new Error(`${label} is required for form ${currentForm}`);
      }
    };

  const onNext = async () => {
    try {
      await form.validateFields([
        "parent_uniq",
        "part_name",
        "part_number",
        "model",
        "uom",
      ]);
      setStep(1);
    } catch {
      // antd will show validation errors
    }
  };

  const childParts = Form.useWatch("child_parts", form);
  const watchedParentProcessRoutes = Form.useWatch("process_routes", form);
  const childPartsCount = Array.isArray(childParts) ? childParts.length : 0;

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

  const addLevel1Child = () => {
    rootAddChildRef.current?.();
  };

  const renderProcessRoutesEditor = (
    fieldPath: Array<string | number>,
    absolutePath: Array<string | number>,
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
                  { sequence: (current.length ?? 0) + 1 },
                ]);
              }}
            >
              Add Process
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

              {routeFields.map((routeField) => (
                <div key={routeField.key} className="rounded-lg border border-gray-200 p-4">
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Form.Item name={[routeField.name, "process_id"]} label="Process" rules={[{ required: true, message: "Process is required" }]}> 
                        <Select
                          size="large"
                          showSearch
                          placeholder="Select process"
                          options={processOptions}
                          loading={isProcessesLoading}
                          optionFilterProp="label"
                          filterOption={(input, option) =>
                            String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                          }
                          style={{ width: "100%" }}
                        />
                      </Form.Item>

                      <Form.Item name={[routeField.name, "machine_id"]} label="Machine" rules={[{ required: true, message: "Machine is required" }]}> 
                        <Select
                          size="large"
                          showSearch
                          placeholder="Select machine"
                          options={machineOptions}
                          loading={isMachinesLoading}
                          optionFilterProp="label"
                          filterOption={(input, option) =>
                            String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                          }
                          style={{ width: "100%" }}
                        />
                      </Form.Item>

                      <Form.Item name={[routeField.name, "sequence"]} label="Sequence">
                        <InputNumber size="large" min={1} style={{ width: "100%" }} />
                      </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Form.Item name={[routeField.name, "tooling"]} label="Add Tooling">
                        <Select size="large" placeholder="Select tooling" options={[{ label: "Dies", value: "Dies" },{ label: "JIG", value: "JIG" },{ label: "CF", value: "CF" }]} allowClear style={{ width: "100%" }} />
                      </Form.Item>
                      <Form.Item name={[routeField.name, "machine_stroke"]} label="Machine Stroke">
                        <Input size="large" placeholder="machine stroke" style={{ width: "100%" }} />
                      </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <Form.Item name={[routeField.name, "remark"]} label="Remark / Catatan">
                        <Input.TextArea rows={2} placeholder="Optional remark for this process route (Catatan)" />
                      </Form.Item>
                    </div>

                    <div className="flex items-end justify-end">
                      <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(routeField.name)}>Remove</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Form.List>
      </div>
    );
  };

  const renderMaterialSpecEditor = (fieldPath: Array<string | number>, disabled = false) => (
    <div className="space-y-3">
      <Text strong>Material Specifications</Text>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Form.Item name={[...fieldPath, "material_spec", "material_code"]} label="Material Code" rules={disabled ? [] : [{ required: true, message: "Material Code is required" }]}>
          <Input placeholder="e.g., STKM550" size="large" disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "form"]} label="Form" rules={disabled ? [] : [{ required: true, message: "Form is required" }]}>
          <Select placeholder="Select form" size="large" disabled={disabled} options={[{ label: "Plate", value: "Plate" },{ label: "Coil", value: "Coil" },{ label: "Pipe", value: "Pipe" },{ label: "Rod", value: "Rod" },{ label: "Wire", value: "Wire" },{ label: "Other", value: "Other" }]} allowClear />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "weight_kg"]} label="Weight (kg)">
          <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "grade"]} label="Grade" rules={disabled ? [] : [{ required: true, message: "Grade is required" }]}>
          <Input placeholder="e.g., Grade A" size="large" disabled={disabled} />
        </Form.Item>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Form.Item name={[...fieldPath, "material_spec", "width_mm"]} label="Width (mm)">
          <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "diameter_mm"]} label="Diameter (mm)">
          <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "thickness_mm"]} label="Thickness (mm)">
          <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "length_mm"]} label="Length (mm)">
          <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "type_material"]} label="Category">
          <Select placeholder="Category" size="large" disabled={disabled} allowClear>
            <Select.Option value="raw">Raw</Select.Option>
            <Select.Option value="indirect">Indirect</Select.Option>
          </Select>
        </Form.Item>
      </div>
    </div>
  );

  const renderChildProcessAndMaterial = (fieldPath: Array<string | number>, absolutePath: Array<string | number>) => (
    <div className="mt-6 space-y-6">
      {renderProcessRoutesEditor(fieldPath, absolutePath, { hideAddWhenAssembly: false, isAssemblyMode: isParentAssembly })}
      {renderMaterialSpecEditor(fieldPath, isParentAssembly)}
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
        const childFieldKey = field.key;
        const numbering = [...parentNumbers, idx + 1];
        const itemPath = [...listPath, field.name];
        const childFileKey = toChildFileKey(itemPath);
        const canAddMoreLevels = level < MAX_BOM_LEVEL;

        return (
          <Card
            key={childFieldKey}
            className={level <= 2 ? "border border-gray-200" : "border border-gray-100"}
            styles={{ body: { paddingTop: 16 } }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${getLevelBadgeClass(level)}`}
                >
                  Level {level}
                </span>
                <Title level={5} className="!mb-0">
                  Child #{numbering.join(".")}
                </Title>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => remove(field.name)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Form.Item
                name={[field.name, "uniq"]}
                label="UNIQ"
                rules={[{ required: true, message: "UNIQ is required" }]}
              >
                <Input placeholder={`e.g., LV7-001-${String.fromCharCode(64 + Math.min(level, 26))}`} size="large" />
              </Form.Item>
              <Form.Item
                name={[field.name, "part_name"]}
                label="Part Name"
                rules={[{ required: true, message: "Part name is required" }]}
              >
                <Input placeholder="Enter part name" size="large" />
              </Form.Item>
              <Form.Item
                name={[field.name, "part_number"]}
                label="Part Number"
                rules={[{ required: true, message: "Part number is required" }]}
              >
                <Input placeholder="Enter part number" size="large" />
              </Form.Item>
              <Form.Item
                name={[field.name, "model"]}
                label="Product Model"
                rules={[{ required: true, message: "Product model is required" }]}
              >
                <Input placeholder="Enter product model" size="large" />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Form.Item
                name={[field.name, "qpu"]}
                label={level === 1 ? "QPU (Quantity Per Unit)" : "QPU"}
                rules={[{ required: true, message: "QPU is required" }]}
              >
                <InputNumber min={0} size="large" style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name={[field.name, "version"]}
                label="Version"
              >
                <Input placeholder="v1.0" size="large" />
              </Form.Item>
              <Form.Item
                name={[field.name, "status"]}
                label="Status"
                initialValue="Active"
                hidden
              >
                <Input />
              </Form.Item>
              <Form.Item label="Status">
                <Input value="Active" size="large" disabled />
              </Form.Item>
            </div>

            <div className="mb-6">
              <Text className="block mb-2">Add Picture for child UNIQ</Text>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <Upload
                  fileList={childFileLists[childFileKey] ?? []}
                  beforeUpload={() => false}
                  onChange={({ fileList: next }) =>
                    setChildFileLists((prev) => ({
                      ...prev,
                      [childFileKey]: next,
                    }))
                  }
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />}>Choose File</Button>
                </Upload>
              </div>
              <Text type="secondary" className="block mt-2">
                Upload image for 3D/2D CAD reference
              </Text>
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
                            messageApi.warning(
                              `Maximum ${MAX_CHILDREN_PER_PARENT} child parts allowed for each parent.`
                            );
                            return;
                          }
                          addNestedField(createDefaultChildPart());
                        }}
                      >
                        Add Child Level {level + 1}
                      </Button>
                    </div>

                    {nestedFields.length > 0 ? (
                      renderChildCards(
                        nestedFields as Array<{ key: number; name: number }>,
                        removeNestedField,
                        [...itemPath, "children"],
                        level + 1,
                        numbering
                      )
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                        No level {level + 1} child yet. Klik <span className="font-medium">Add Child Level {level + 1}</span> untuk menambahkan UNIQ, Part Name, Part Number, Product Model, upload gambar, Process Routes, dan Material List.
                      </div>
                    )}
                  </div>
                )}
              </Form.List>
            ) : null}
          </Card>
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
              messageApi.warning(
                `Maximum ${MAX_CHILDREN_PER_PARENT} child parts allowed for each parent.`
              );
              return;
            }
            add(createDefaultChildPart());
          };
        }

        if (fields.length === 0) {
          if (level !== 1) return null;

          return (
            <Card styles={{ body: { paddingTop: 24, paddingBottom: 24 } }}>
              <div className="flex flex-col items-center justify-center text-center py-10">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-gray-500"
                  >
                    <path
                      d="M12 2L20 6V18L12 22L4 18V6L12 2Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 6L12 10L20 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 10V22"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <Text type="secondary">No child components added yet</Text>
                <div className="mt-4">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={addLevel1Child}
                    disabled={childPartsCount >= MAX_CHILDREN_PER_PARENT}
                  >
                    Add First Child Component
                  </Button>
                </div>
              </div>
            </Card>
          );
        }

        return renderChildCards(
          fields as Array<{ key: number; name: number }>,
          remove,
          listPath,
          level,
          parentNumbers
        );
      }}
    </Form.List>
  );

  const onSaveBom = async () => {
    try {
      // Ensure Step 1 required fields are validated even when user is on Step 2
      // (because unmounted Form.Items won't be validated automatically).
      await form.validateFields([
        "parent_uniq",
        "part_name",
        "part_number",
        "model",
        "uom",
      ]);

      // `validateFields(names)` only returns those specific fields. We need the
      // full form state (including `child_parts`) to build the payload.
      const values = form.getFieldsValue(true) as Step1Values;
      const assemblyMode =
        Array.isArray(values.process_routes) &&
        values.process_routes.some((route) => isAssemblyProcessValue(route?.process_id));

      if (!assemblyMode) {
        await form.validateFields([
          ["material_spec", "material_code"],
          ["material_spec", "form"],
          ["material_spec", "grade"],
        ]);
      }

      messageApi.open({
        key: "bom-save",
        type: "loading",
        content: "Saving BOM...",
        duration: 0,
      });

      const toId = (v: unknown): string | number | undefined => {
        if (v === undefined || v === null) return undefined;
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") {
          const trimmed = v.trim();
          if (!trimmed) return undefined;
          const asNumber = Number(trimmed);
          return Number.isFinite(asNumber) ? asNumber : trimmed;
        }
        return undefined;
      };

      const toNumberId = (v: unknown): number | undefined => {
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") {
          const trimmed = v.trim();
          if (!trimmed) return undefined;
          const asNumber = Number(trimmed);
          return Number.isFinite(asNumber) ? asNumber : undefined;
        }
        return undefined;
      };

      const cleanText = (v: unknown): string | undefined => {
        if (typeof v !== "string") return undefined;
        const s = v.trim();
        return s ? s : undefined;
      };

      const parentUomSelection = toId(values.uom);
      const parentUomValue =
        parentUomSelection === undefined
          ? undefined
          : uomCodeByValue.get(String(parentUomSelection)) ?? String(parentUomSelection);

      if (!parentUomValue) {
        messageApi.destroy("bom-save");
        messageApi.error("UOM is required.");
        return;
      }

      const normalizeMaterialForm = (v: unknown): string | undefined => {
        if (typeof v !== "string") return undefined;
        const raw = v.trim();
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

      const mapProcessRoutes = (routes?: ProcessRoute[]) =>
        (routes ?? [])
          .map((r, idx) => {
            const process_id = toNumberId(r.process_id);
            const machine_id = toNumberId(r.machine_id);
            const baseSeq =
              typeof r.sequence === "number" && Number.isFinite(r.sequence)
                ? r.sequence
                : idx + 1;
            // Backend examples commonly use 10,20,...
            const op_seq = baseSeq * 10;
            return {
              op_seq,
              process_id,
              machine_id,
              cycle_time_sec: 0,
              setup_time_min: 0,
              tooling_ref:
                typeof r.tooling === "string" && r.tooling.trim()
                  ? r.tooling.trim()
                  : undefined,
              machine_stroke:
                typeof r.machine_stroke === "string" && r.machine_stroke.trim()
                  ? r.machine_stroke.trim()
                  : undefined,
              remark: typeof r.remark === "string" && r.remark.trim() ? r.remark.trim() : undefined,
            };
          })
          .filter((r) => r.process_id !== undefined && r.machine_id !== undefined);

      const mapMaterialSpec = (spec?: MaterialSpec) => {
        const s = spec ?? {};
        const form = normalizeMaterialForm(s.form);
        const raw: Record<string, unknown> = {
          grade: cleanText(s.grade),
          material_grade: cleanText(s.material_code),
          type_material: cleanText(s.type_material),
          form,
          width_mm: s.width_mm,
          diameter_mm: s.diameter_mm,
          thickness_mm: s.thickness_mm,
          length_mm: s.length_mm,
          weight_kg: s.weight_kg,
          cycle_time_sec: s.cycle_time_sec,
          setup_time_min: s.setup_time_min,
          customer_cycle: cleanText(s.customer_cycle),
        };
        const cleanedEntries = Object.entries(raw).filter(
          ([, v]) => v !== undefined && v !== null && v !== ""
        );
        if (cleanedEntries.length === 0) return undefined;
        return Object.fromEntries(cleanedEntries);
      };

      const skippedChildren: string[] = [];
      const mapChildParts = (parts: ChildPart[] | undefined, level: number): any[] => {
        const arr = Array.isArray(parts) ? parts : [];
        return arr
          .map((c, idx) => {
            const uniq_code = cleanText(c.uniq);
            const part_name = cleanText(c.part_name);
            const part_number = cleanText(c.part_number);
            const model = cleanText(c.model);

            const anyChildFieldFilled =
              Boolean(uniq_code) ||
              Boolean(part_name) ||
              Boolean(part_number) ||
              (typeof c.qpu === "number" && Number.isFinite(c.qpu));

            if (!anyChildFieldFilled) return null;
            if (!uniq_code || !part_name || !part_number) {
              skippedChildren.push(`L${level} #${idx + 1}`);
              return null;
            }

            const childRoutes = mapProcessRoutes(c.process_routes);
            const childSpec = mapMaterialSpec(c.material_spec);
            const nested = mapChildParts(c.children, level + 1);

            const childBody: Record<string, unknown> = {
              uniq_code,
              part_name,
              part_number,
              model,
              uom: parentUomValue,
              level,
              qty_per_uniq:
                typeof c.qpu === "number" && Number.isFinite(c.qpu) ? c.qpu : 1,
            };
            const rawMatType = c.material_spec?.type_material ?? c.category;
            if (rawMatType) childBody.raw_material_type = rawMatType;
            if (childRoutes.length > 0) childBody.process_routes = childRoutes;
            if (childSpec !== undefined) childBody.material_spec = childSpec;
            if (nested.length > 0) childBody.children = nested;
            return childBody;
          })
          .filter(Boolean);
      };

      const childrenPayload = mapChildParts(values.child_parts, 1);

      if (assemblyMode && childrenPayload.length < 2) {
        messageApi.destroy("bom-save");
        messageApi.error("Assembly parent must have at least 2 child parts.");
        return;
      }

      const parentRoutes = mapProcessRoutes(values.process_routes);
      const parentSpec = assemblyMode ? undefined : mapMaterialSpec(values.material_spec);
      if (!assemblyMode && !parentSpec) {
        messageApi.destroy("bom-save");
        messageApi.error("Material specifications are required.");
        return;
      }
      const parentUniq = cleanText(values.parent_uniq);
      if (parentUniq && existingUniqs.has(parentUniq)) {
        messageApi.destroy("bom-save");
        messageApi.error(`UNIQ '${parentUniq}' already exists. Please choose another UNIQ.`);
        return;
      }

      for (const c of childrenPayload as any[]) {
        const uniq = typeof c?.uniq_code === "string" ? c.uniq_code : "";
        if (uniq && existingUniqs.has(uniq)) {
          messageApi.destroy("bom-save");
          messageApi.error(`Child UNIQ '${uniq}' already exists. Please change it.`);
          return;
        }
      }

      const payload: Record<string, unknown> = {
        uniq_code: parentUniq,
        part_name: cleanText(values.part_name),
        part_number: cleanText(values.part_number),
        model: cleanText(values.model),
        uom: parentUomValue,
        description: cleanText(values.description),
      };
      const parentStatus = toApiStatus(values.status);
      if (parentStatus) payload.status = parentStatus;
      if (parentSpec !== undefined) payload.material_spec = parentSpec;
      if (parentRoutes.length > 0) payload.process_routes = parentRoutes;
      if (childrenPayload.length > 0) payload.children = childrenPayload;

      if (skippedChildren.length > 0) {
        messageApi.warning(
          `Skipped incomplete child rows: ${skippedChildren.join(", ")}. Fill UNIQ, Part Name, Part Number or remove the row.`
        );
      }

      // Helpful when backend returns generic "invalid request body".
      console.debug("[BOM] create payload", payload);

      const created = await createBom(payload as any).unwrap();
      // itemId = item's own ID → used as item_id in upload sessions
      // bomId  = BOM header ID → used in BOM GET/UPDATE URLs
      const itemId = (created as any)?.data?.id as string | undefined;
      const bomId = (created as any)?.data?.bom_id as string | undefined;

      const parentFile = asFile(fileList?.[0]?.originFileObj);
      if (itemId && parentFile) {
        messageApi.open({
          key: "bom-upload-parent",
          type: "loading",
          content: "Uploading parent asset...",
          duration: 0,
        });

        const sessionArgs: CreateUploadSessionArgs = {
          item_id: itemId,
          asset_type: "drawing",
          file_name: parentFile.name,
          mime_type: parentFile.type || "application/octet-stream",
        };
        const uploaded = await uploadFileInChunks(parentFile, {
          onProgress: (pct) => {
            messageApi.open({
              key: "bom-upload-parent",
              type: "loading",
              content: `Uploading parent asset... ${pct}%`,
              duration: 0,
            });
          },
          session: sessionArgs,
        });

        messageApi.destroy("bom-upload-parent");
      }

      // Upload child assets using item IDs from detail response.
      // Avoid PATCH/PUT after create because backend can mark the new BOM version read-only.
      // The upload session already receives item_id so the file can be attached server-side.
      if (bomId) {
        const token = getCookiesFromBrowser("Authorization");
        const res = await fetch(`${apiBaseUrl}/products/bom/${encodeURIComponent(bomId)}`, {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const detailJson = await res.json().catch(() => null);
        const detailData =
          detailJson && typeof detailJson === "object" && (detailJson as any).data
            ? (detailJson as any).data
            : detailJson;
        const childrenFromApi = Array.isArray(detailData?.children)
          ? detailData.children
          : [];

        const toStrId = (v: unknown): string => {
          if (v === undefined || v === null) return "";
          const s = String(v).trim();
          return s !== "0" ? s : "";
        };

        const uniqToChildId = new Map<string, string>();
        const collectChildIds = (nodes: any[]) => {
          for (const childNode of nodes) {
            const uniq =
              typeof childNode?.uniq_code === "string"
                ? childNode.uniq_code.trim()
                : typeof childNode?.uniq === "string"
                  ? childNode.uniq.trim()
                  : "";
            const childId =
              toStrId(childNode?.id) ||
              toStrId(childNode?.uuid) ||
              toStrId(childNode?.bom_child_id);
            if (uniq && childId) uniqToChildId.set(uniq, childId);

            if (Array.isArray(childNode?.children) && childNode.children.length > 0) {
              collectChildIds(childNode.children);
            }
          }
        };
        collectChildIds(childrenFromApi);

        const uploadChildAssets = async (
          parts: ChildPart[] | undefined,
          indexPath: number[] = []
        ): Promise<void> => {
          const arr = Array.isArray(parts) ? parts : [];
          for (let idx = 0; idx < arr.length; idx++) {
            const child = arr[idx];
            const currentPath = [...indexPath, idx];
            const childFileKey = toChildFileKey([
              "child_parts",
              ...currentPath.flatMap((pathIndex, depth) =>
                depth === 0 ? [pathIndex] : ["children", pathIndex]
              ),
            ]);
            const childFile = asFile(childFileLists?.[childFileKey]?.[0]?.originFileObj);
            const uniqCode = cleanText(child?.uniq);
            const childItemId = uniqCode ? uniqToChildId.get(uniqCode) : undefined;

            if (childFile && uniqCode && childItemId) {
              const childLabel = currentPath.map((n) => n + 1).join(".");
              const uploadKey = `bom-upload-child-${childLabel}`;

              messageApi.open({
                key: uploadKey,
                type: "loading",
                content: `Uploading child #${childLabel} asset...`,
                duration: 0,
              });

              const sessionArgs: CreateUploadSessionArgs = {
                item_id: childItemId,
                asset_type: "drawing",
                file_name: childFile.name,
                mime_type: childFile.type || "application/octet-stream",
              };

              await uploadFileInChunks(childFile, {
                onProgress: (pct) => {
                  messageApi.open({
                    key: uploadKey,
                    type: "loading",
                    content: `Uploading child #${childLabel} asset... ${pct}%`,
                    duration: 0,
                  });
                },
                session: sessionArgs,
              });
              messageApi.destroy(uploadKey);
            }

            if (Array.isArray(child?.children) && child.children.length > 0) {
              await uploadChildAssets(child.children, currentPath);
            }
          }
        };

        await uploadChildAssets(values.child_parts, []);
      }

      messageApi.destroy("bom-save");
      messageApi.success("BOM saved");
      router.push("/bill-of-material");
    } catch (err) {
      // antd handles validation errors; show backend details for request failures
      messageApi.destroy("bom-save");
      const anyErr = err as any;

      const data = anyErr?.data;
      const detail =
        typeof data === "string"
          ? data
          : data && typeof data === "object"
            ? JSON.stringify(data)
            : anyErr?.error
              ? String(anyErr.error)
              : anyErr?.message
                ? String(anyErr.message)
              : "";

      if (data && typeof data === "object" && (data as any).request_id) {
        const reqId = String((data as any).request_id);
        const status = (data as any).status;
        const msg = (data as any).message;
        messageApi.error(
          `Failed to save BOM (request_id: ${reqId}${status ? `, status: ${status}` : ""})${msg ? `: ${msg}` : ""}`
        );
      } else {
        messageApi.error(detail ? `Failed to save BOM: ${detail}` : "Failed to save BOM");
      }
    }
  };

  return (
    <div className="p-6">
      {contextHolder}

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          className="px-0"
          onClick={() => router.push("/bill-of-material")}
        >
          Back to BOM List
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <Title level={3} className="!mb-0">
              Add BOM Component
            </Title>
            <Text type="secondary">Step {step + 1} of 2</Text>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <Steps
          current={step}
          items={[
            { title: "Step 1", description: "Parent Info & Specs" },
            { title: "Step 2", description: `Add Child Parts (Up to Level ${MAX_BOM_LEVEL})` },
          ]}
        />

        <div className="mt-6">
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={initialValues}
          >
            {step === 0 ? (
              <>
                <div className="bg-blue-50 border border-blue-100 text-blue-700 px-4 py-3 rounded-md mb-6 text-sm">
                  Step 1: Enter the parent UNIQ information, define process routes,
                  and specify material specifications
                </div>

                <Card
                  title="Parent Component Information"
                  className="mb-6"
                  styles={{ body: { paddingTop: 16 } }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Form.Item
                      name="parent_uniq"
                      label="Parent UNIQ"
                      rules={[{ required: true, message: "Parent UNIQ is required" }]}
                    >
                      <Input placeholder="e.g., LV7-001" size="large" />
                    </Form.Item>

                    <Form.Item
                      name="part_name"
                      label="Part Name"
                      rules={[{ required: true, message: "Part name is required" }]}
                    >
                      <Input
                        placeholder="e.g., Engine Mount Assembly"
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      name="part_number"
                      label="Part Number"
                      rules={[{ required: true, message: "Part number is required" }]}
                    >
                      <Input placeholder="e.g., EMA-001-LV7" size="large" />
                    </Form.Item>

                    <Form.Item
                      name="model"
                      label="Product Model"
                      rules={[{ required: true, message: "Product model is required" }]}
                    >
                      <Input placeholder="e.g., Model A" size="large" />
                    </Form.Item>

                    <Form.Item
                      name="uom"
                      label="UOM"
                      rules={[{ required: true, message: "UOM is required" }]}
                    >
                      <Select
                        showSearch
                        placeholder="Select UOM"
                        size="large"
                        loading={apiEnabled && isUomsLoading && !uomIsForbidden}
                        options={effectiveUomOptions}
                        virtual={false}
                        notFoundContent={
                          apiEnabled
                            ? isUomsLoading
                              ? "Loading UOM..."
                              : "No UOM found from System Settings"
                            : "No UOM available"
                        }
                        optionFilterProp="label"
                        filterOption={(input, opt) =>
                          String(opt?.label ?? "")
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                      />
                    </Form.Item>

                    <Form.Item name="status" hidden initialValue="Active">
                      <Input />
                    </Form.Item>
                    <Form.Item label="Status">
                      <Input value="Active" size="large" disabled />
                    </Form.Item>

                    <Form.Item name="bom_status" hidden initialValue="Draft">
                      <Input />
                    </Form.Item>
                    <Form.Item label="BOM Status">
                      <Input value="Draft" size="large" disabled />
                    </Form.Item>
                  </div>

                  <Form.Item label="Add Picture for Parent UNIQ">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                      <Upload
                        fileList={fileList}
                        beforeUpload={() => false}
                        onChange={({ fileList: next }) => setFileList(next)}
                        maxCount={1}
                      >
                        <Button icon={<UploadOutlined />}>Choose File</Button>
                      </Upload>

                      {/* <Button
                        icon={<UploadOutlined />}
                        onClick={() =>
                          messageApi.info(
                            "File will be uploaded when you click Save BOM."
                          )
                        }
                      >
                        Upload
                      </Button> */}
                    </div>
                    <Text type="secondary" className="block mt-2">
                      Upload image for 3D/2D CAD reference
                    </Text>
                  </Form.Item>

                  <Form.Item name="description" label="Description">
                    <TextArea placeholder="Enter component description" rows={4} />
                  </Form.Item>
                </Card>

                <Card
                  title={
                    <div className="space-y-4">
                      {isParentAssembly ? (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                          Process yang dipilih bertipe <span className="font-semibold">Assembly</span>, parent tetap bisa menambah process route, material parent disabled, dan child minimal 2 item.
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between">
                        <span>Process Routes</span>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            const current = form.getFieldValue("process_routes") ?? [];
                            form.setFieldValue("process_routes", [
                              ...current,
                              { sequence: (current.length ?? 0) + 1 },
                            ]);
                            setOpenProcessRouteIndex(current.length ?? 0);
                          }}
                        >
                          Add Process Route
                        </Button>
                      </div>
                    </div>
                  }
                  className="mb-6"
                  styles={{ body: { paddingTop: 16 } }}
                >
                  <Form.List name="process_routes">
                    {(fields, { remove }) => (
                      <Collapse
                        accordion
                        bordered={false}
                        activeKey={
                          openProcessRouteIndex === null
                            ? undefined
                            : [String(openProcessRouteIndex)]
                        }
                        onChange={(key) => {
                          const next = Array.isArray(key) ? key[0] : key;
                          setOpenProcessRouteIndex(
                            next === undefined ? null : Number(next)
                          );
                        }}
                        expandIcon={({ isActive }) => (
                          <RightOutlined
                            className={
                              isActive
                                ? "text-gray-600 rotate-90 transition-transform"
                                : "text-gray-600 transition-transform"
                            }
                          />
                        )}
                        className="!bg-transparent"
                        items={fields.map((field, idx) => ({
                          key: String(idx),
                          label: (
                            <div className="flex items-center justify-between w-full pr-2">
                              <Text className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs">
                                Process #{idx + 1}
                              </Text>
                              {fields.length > 1 ? (
                                <Button
                                  type="text"
                                  danger
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    remove(field.name);

                                    setOpenProcessRouteIndex((prev) => {
                                      if (prev === null) return null;
                                      if (prev === idx) return null;
                                      if (prev > idx) return prev - 1;
                                      return prev;
                                    });
                                  }}
                                >
                                  Remove
                                </Button>
                              ) : null}
                            </div>
                          ),
                          children: (
                            <div className="border border-gray-200 rounded-lg p-4">
                              {(() => {
                                const { key: _ignoredKey, ...routeField } = field;
                                return (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      <Form.Item
                                        {...routeField}
                                        name={[field.name, "process_id"]}
                                        label="Process"
                                        rules={[{ required: true, message: "Process is required" }]}
                                      >
                                        <Select
                                          size="large"
                                          showSearch
                                          placeholder="Select process"
                                          options={processOptions}
                                          loading={isProcessesLoading}
                                          optionFilterProp="label"
                                          style={{ width: "100%" }}
                                          filterOption={(input, opt) =>
                                            String(opt?.label ?? "")
                                              .toLowerCase()
                                              .includes(input.toLowerCase())
                                          }
                                        />
                                      </Form.Item>

                                      <Form.Item
                                        {...routeField}
                                        name={[field.name, "machine_id"]}
                                        label="Machine"
                                        rules={[{ required: true, message: "Machine is required" }]}
                                      >
                                        <Select
                                          size="large"
                                          showSearch
                                          placeholder="Select machine"
                                          options={machineOptions}
                                          loading={isMachinesLoading}
                                          optionFilterProp="label"
                                          style={{ width: "100%" }}
                                          filterOption={(input, opt) =>
                                            String(opt?.label ?? "")
                                              .toLowerCase()
                                              .includes(input.toLowerCase())
                                          }
                                        />
                                      </Form.Item>

                                      <Form.Item
                                        {...routeField}
                                        name={[field.name, "sequence"]}
                                        label="Sequence"
                                      >
                                        <InputNumber size="large" min={1} style={{ width: "100%" }} />
                                      </Form.Item>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <Form.Item
                                        {...routeField}
                                        name={[field.name, "tooling"]}
                                        label="Add Tooling"
                                      >
                                        <Select
                                          size="large"
                                          placeholder="Select tooling"
                                          options={[
                                            { label: "Dies", value: "Dies" },
                                            { label: "JIG", value: "JIG" },
                                            { label: "CF", value: "CF" },
                                          ]}
                                          allowClear
                                          style={{ width: "100%" }}
                                        />
                                      </Form.Item>

                                      <Form.Item
                                        {...routeField}
                                        name={[field.name, "machine_stroke"]}
                                        label="Machine Stroke"
                                      >
                                        <Input size="large" placeholder="machine stroke" style={{ width: "100%" }} />
                                      </Form.Item>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                      <Form.Item
                                        {...routeField}
                                        name={[field.name, "remark"]}
                                        label="Remark / Catatan"
                                      >
                                        <Input.TextArea rows={2} placeholder="Optional remark for this process route (Catatan)" />
                                      </Form.Item>
                                    </div>

                                    <div className="flex items-end justify-end">
                                      <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)}>
                                        Remove
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          ),
                        }))}
                      />
                    )}
                  </Form.List>
                </Card>

                <Card
                  title={
                    <div className="flex items-center justify-between gap-3">
                      <span>Material Specifications</span>
                      {isParentAssembly ? (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          Disabled for Assembly parent
                        </span>
                      ) : null}
                    </div>
                  }
                  className="mb-6"
                  styles={{ body: { paddingTop: 16 } }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Form.Item
                      name={["material_spec", "material_code"]}
                      label="Material Code"
                      rules={isParentAssembly ? [] : [{ required: true, message: "Material Code is required" }]}
                    >
                      <Input placeholder="e.g., STKM550" size="large" disabled={isParentAssembly} />
                    </Form.Item>

                    <Form.Item
                      name={["material_spec", "form"]}
                      label="Form"
                      rules={isParentAssembly ? [] : [{ required: true, message: "Form is required" }]}
                    >
                      <Select
                        placeholder="Select form"
                        size="large"
                        disabled={isParentAssembly}
                        options={[
                          { label: "Plate", value: "Plate" },
                          { label: "Coil", value: "Coil" },
                          { label: "Pipe", value: "Pipe" },
                          { label: "Rod", value: "Rod" },
                          { label: "Wire", value: "Wire" },
                          { label: "Other", value: "Other" },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item name={["material_spec", "weight_kg"]} label="Weight (kg)">
                      <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={isParentAssembly} />
                    </Form.Item>
                    {/* <Form.Item name={[
                      "material_spec",
                      "cycle_time_sec",
                    ]} label="Cycle Time (sec)">
                      <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={isParentAssembly} />
                    </Form.Item>
                    <Form.Item name={[
                      "material_spec",
                      "setup_time_min",
                    ]} label="Setup Time (min)">
                      <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={isParentAssembly} />
                    </Form.Item> */}
                    {/* <Form.Item name={["material_spec", "customer_cycle"]} label="Customer Cycle">
                      <Input placeholder="e.g., Daily / Weekly / Monthly" size="large" disabled={isParentAssembly} />
                    </Form.Item> */}
                    <Form.Item
                      name={["material_spec", "grade"]}
                      label="Grade"
                      rules={isParentAssembly ? [] : [{ required: true, message: "Grade is required" }]}
                    >
                      <Input placeholder="e.g., STKM550" size="large" disabled={isParentAssembly} />
                    </Form.Item>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <Form.Item
                      name={["material_spec", "width_mm"]}
                      label="Width (mm)"
                      dependencies={[["material_spec", "form"]]}
                      rules={[
                        {
                          validator: requirePositiveNumberForForms(
                            ["Plate", "Coil"],
                            "Width (mm)"
                          ),
                        },
                      ]}
                    >
                      <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={isParentAssembly} />
                    </Form.Item>

                    <Form.Item
                      name={["material_spec", "diameter_mm"]}
                      label="Diameter (mm)"
                      dependencies={[["material_spec", "form"]]}
                      rules={[
                        {
                          validator: requirePositiveNumberForForms(
                            ["Pipe", "Rod", "Wire"],
                            "Diameter (mm)"
                          ),
                        },
                      ]}
                    >
                      <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={isParentAssembly} />
                    </Form.Item>
                    <Form.Item
                      name={["material_spec", "thickness_mm"]}
                      label="Thickness (mm)"
                      dependencies={[["material_spec", "form"]]}
                      rules={[
                        {
                          validator: requirePositiveNumberForForms(
                            ["Plate", "Coil", "Pipe"],
                            "Thickness (mm)"
                          ),
                        },
                      ]}
                    >
                      <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={isParentAssembly} />
                    </Form.Item>
                    <Form.Item
                      name={["material_spec", "length_mm"]}
                      label="Length (mm)"
                      dependencies={[["material_spec", "form"]]}
                      rules={[
                        {
                          validator: requirePositiveNumberForForms(
                            ["Plate", "Pipe", "Rod"],
                            "Length (mm)"
                          ),
                        },
                      ]}
                    >
                      <InputNumber min={0} size="large" style={{ width: "100%" }} disabled={isParentAssembly} />
                    </Form.Item>
                    <Form.Item
                      name={["material_spec", "type_material"]}
                      label="Category"
                    >
                      <Select
                        size="large"
                        placeholder="Category"
                        disabled={isParentAssembly}
                        allowClear
                      >
                        <Select.Option value="raw">Raw</Select.Option>
                        <Select.Option value="indirect">Indirect</Select.Option>
                      </Select>
                    </Form.Item>
                  </div>

                </Card>

                <div className="flex items-center justify-between">
                  <Button onClick={() => router.push("/bill-of-material")}>Cancel</Button>
                  <div className="flex items-center gap-3">
                    <Button
                      type="primary"
                      ghost
                      loading={isCreating}
                      onClick={onSaveBom}
                    >
                      Save BOM
                    </Button>
                    <Button type="primary" onClick={onNext}>
                      Next: Add Child Parts
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
              <div className="bg-blue-50 border border-blue-100 text-blue-700 px-4 py-3 rounded-md mb-6 text-sm">
                Step 2: Add child components with their own process routes and material specs. Maksimal {MAX_CHILDREN_PER_PARENT} child per parent dan level maksimal {MAX_BOM_LEVEL}.
              </div>

              <div className="flex items-center justify-between mb-4">
                <Title level={4} className="!mb-0">
                  Child Parts (Levels 1-{MAX_BOM_LEVEL})
                </Title>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={addLevel1Child}
                  disabled={childPartsCount >= MAX_CHILDREN_PER_PARENT}
                >
                  Add Level 1 Child
                </Button>
              </div>

              {renderChildList(["child_parts"], 1)}

              <div className="flex items-center justify-between mt-6">
                <Button onClick={() => setStep(0)} icon={<ArrowLeftOutlined />}
                >
                  Previous
                </Button>

                <div className="flex items-center gap-3">
                  <Button onClick={() => router.push("/bill-of-material")}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    disabled={isCreating}
                    loading={isCreating}
                    onClick={onSaveBom}
                  >
                    Save BOM
                  </Button>
                </div>
              </div>
            </>
            )}
          </Form>
        </div>
      </div>
    </div>
  );
}
