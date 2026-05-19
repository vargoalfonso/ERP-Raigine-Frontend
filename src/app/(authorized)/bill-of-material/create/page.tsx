"use client";

import { useMemo, useState } from "react";
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

type BomStatus = "Active" | "Inactive";

type ProcessRoute = {
  process_id?: number | string;
  machine_id?: number | string;
  sequence?: number;
  cycle_time_sec_per_pc?: number;
  setup_time_min?: number;
  tooling?: string;
  machine_stroke?: string;
};

type MaterialSpec = {
  material_code?: string;
  form?: string;
  supplier?: string;
  width_mm?: number;
  diameter_mm?: number;
  thickness_mm?: number;
  length_mm?: number;
  cycle_time_sec_per_pc?: number;
  dandori_setup_time_min?: number;
};

type ChildPart = {
  uniq?: string;
  part_name?: string;
  part_number?: string;
  model?: string;
  qpu?: number;
  version?: string;
  status?: BomStatus;
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
  status?: BomStatus;
  bom_status?: string;
  description?: string;
  process_routes?: ProcessRoute[];
  material_spec?: MaterialSpec;
  child_parts?: ChildPart[];
};

type FormPath = Array<string | number>;

const MAX_CHILDREN_PER_PARENT = 6;
const MAX_BOM_LEVEL = 6;

const createDefaultChildPart = (): ChildPart => ({
  status: "Active",
  version: "v1.0",
  qpu: 1,
  process_routes: [{ sequence: 1 }],
  material_spec: {},
  children: [],
});

const getLevelBadgeClass = (level: number): string => {
  const palette: Record<number, string> = {
    1: "bg-blue-50 text-blue-700",
    2: "bg-indigo-50 text-indigo-700",
    3: "bg-purple-50 text-purple-700",
    4: "bg-fuchsia-50 text-fuchsia-700",
    5: "bg-pink-50 text-pink-700",
    6: "bg-rose-50 text-rose-700",
  };

  return palette[level] ?? "bg-gray-100 text-gray-700";
};

const toApiStatus = (status?: BomStatus): string | undefined => {
  const s = typeof status === "string" ? status.trim() : "";
  if (s === "Active" || s === "Inactive") return s;
  const lower = s.toLowerCase();
  if (lower === "active") return "Active";
  if (lower === "inactive") return "Inactive";
  return undefined;
};

const asFile = (v: unknown): File | null => {
  if (v instanceof File) return v;
  return null;
};

export default function CreateBomPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<Step1Values>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [childFileLists, setChildFileLists] = useState<
    Record<number, UploadFile[]>
  >({});
  const [openProcessRouteIndex, setOpenProcessRouteIndex] = useState<
    number | null
  >(0);

  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);

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

  const { data: suppliers = [], isLoading: isSuppliersLoading } =
    useListSuppliersQuery();

  const { data: processes = [], isLoading: isProcessesLoading } =
    useGetProcessesQuery(undefined, { skip: !apiEnabled });
  const { data: machines = [], isLoading: isMachinesLoading } =
    useGetMachinesQuery(undefined, { skip: !apiEnabled });

  const processOptions = useMemo<Array<{ value: string | number; label: string }>>(() => {
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
        };
      })
      .filter(
        (x): x is { value: string | number; label: string } =>
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
      .filter((u) => Boolean((u as any)?.id))
      .map((u) => {
        const id = String((u as any).id ?? "");
        const code = String((u as any).code ?? (u as any).unit_code ?? "").trim();
        const name = String((u as any).name ?? (u as any).unit_name ?? "").trim();
        if (!id) return null;
        // Backend expects UOM code string (e.g. "PCS"), not numeric ID.
        const value = code || id;
        return {
          value,
          label: code && name ? `${code} — ${name}` : code || name || id,
        };
      })
      .filter((x): x is { value: string; label: string } => Boolean(x));
  }, [uoms]);

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
    // If forbidden (403) or empty list, keep UX working with seeded options.
    if (uomIsForbidden) return seededUomOptions;
    if (isUomsLoading) return [];
    return seededUomOptions;
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
        width_mm: 200,
        diameter_mm: 25,
        thickness_mm: 5,
        length_mm: 300,
        cycle_time_sec_per_pc: 30,
        dandori_setup_time_min: 15,
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
  const childPartsCount = Array.isArray(childParts) ? childParts.length : 0;

  const addNestedChild = (path: Array<string | number>, level: number) => {
    if (level > MAX_BOM_LEVEL) {
      messageApi.warning(`Maximum nesting level is ${MAX_BOM_LEVEL}.`);
      return;
    }

    const current = (form as any).getFieldValue(path as any) ?? [];
    if ((current.length ?? 0) >= MAX_CHILDREN_PER_PARENT) {
      messageApi.warning(
        `Maximum ${MAX_CHILDREN_PER_PARENT} child parts allowed for each parent.`
      );
      return;
    }

    (form as any).setFieldValue(path as any, [
      ...current,
      createDefaultChildPart(),
    ]);
  };

  const addLevel1Child = () => {
    addNestedChild(["child_parts"], 1);
  };

  const renderChildProcessAndMaterial = (
    fieldPath: Array<string | number>,
    absolutePath: Array<string | number>,
    options?: {
      processTitle?: string;
      materialTitle?: string;
      className?: string;
    }
  ) => {
    const processTitle = options?.processTitle ?? "Process Routes";
    const materialTitle = options?.materialTitle ?? "Material List";
    const sectionClassName = options?.className ?? "mt-6";

    return (
      <div className={sectionClassName}>
        <div className="flex items-center justify-between mb-3">
          <Title level={5} className="!mb-0">
            {processTitle}
          </Title>
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

        <Form.List name={[...fieldPath, "process_routes"]}>
          {(procFields, { remove: removeProc }) => (
            <div className="space-y-3 mb-6">
              {procFields.map((pf) => (
                <div
                  key={pf.key}
                  className="grid grid-cols-1 md:grid-cols-8 gap-3 items-start"
                >
                  <Form.Item
                    {...pf}
                    name={[pf.name, "process_id"]}
                    label="Process"
                    rules={[{ required: true, message: "Process is required" }]}
                  >
                    <Select
                      showSearch
                      placeholder="Select process"
                      options={processOptions}
                      loading={isProcessesLoading}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item
                    {...pf}
                    name={[pf.name, "machine_id"]}
                    label="Machine"
                    rules={[{ required: true, message: "Machine is required" }]}
                  >
                    <Select
                      showSearch
                      placeholder="Select machine"
                      options={machineOptions}
                      loading={isMachinesLoading}
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item {...pf} name={[pf.name, "sequence"]} label="Sequence">
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item
                    {...pf}
                    name={[pf.name, "cycle_time_sec_per_pc"]}
                    label="Cycle Time"
                  >
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item
                    {...pf}
                    name={[pf.name, "setup_time_min"]}
                    label="Setup Time"
                  >
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item {...pf} name={[pf.name, "tooling"]} label="Tooling">
                    <Select
                      placeholder="Select tooling"
                      options={[
                        { label: "Dies", value: "Dies" },
                        { label: "JIG", value: "JIG" },
                        { label: "CF", value: "CF" },
                      ]}
                      allowClear
                    />
                  </Form.Item>
                  <Form.Item
                    {...pf}
                    name={[pf.name, "machine_stroke"]}
                    label="Machine Stroke"
                  >
                    <Input placeholder="machine stroke" />
                  </Form.Item>
                  <div className="flex items-center pt-7">
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => removeProc(pf.name)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Form.List>

        <Title level={5} className="!mb-3">
          {materialTitle}
        </Title>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item name={[...fieldPath, "material_spec", "material_code"]} label="Material Code">
            <Input placeholder="Material Code" />
          </Form.Item>
          <Form.Item name={[...fieldPath, "material_spec", "form"]} label="Form">
            <Select
              placeholder="Select form"
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
          <Form.Item name={[...fieldPath, "material_spec", "supplier"]} label="Supplier">
            <Select
              placeholder="Select supplier"
              options={supplierOptions}
              loading={isSuppliersLoading}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>
          <Form.Item name={[...fieldPath, "material_spec", "width_mm"]} label="Width (mm)">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item name={[...fieldPath, "material_spec", "diameter_mm"]} label="Ø (mm)">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name={[...fieldPath, "material_spec", "thickness_mm"]} label="Thickness (mm)">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name={[...fieldPath, "material_spec", "length_mm"]} label="Length (mm)">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name={[...fieldPath, "material_spec", "cycle_time_sec_per_pc"]}
            label="Cycle Time (sec/pc)"
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item
            name={[...fieldPath, "material_spec", "dandori_setup_time_min"]}
            label="Dandori/Setup Time (min)"
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </div>
      </div>
    );
  };

  const removeTopLevelChild = (index: number, remove: (index: number) => void) => {
    remove(index);
    setChildFileLists((prev) => {
      const next: Record<number, UploadFile[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        const currentIndex = Number(k);
        if (!Number.isFinite(currentIndex)) continue;
        if (currentIndex === index) continue;
        next[currentIndex > index ? currentIndex - 1 : currentIndex] = v;
      }
      return next;
    });
  };

  const renderChildList = (listPath: FormPath, level: number, parentNumbers: number[] = []) => (
    <Form.List name={listPath}>
      {(fields, { remove }) => {
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

        return (
          <div className={level === 1 ? "space-y-5" : "mt-5 space-y-4 border-l-2 border-gray-100 pl-4"}>
            {fields.map((field, idx) => {
              const numbering = [...parentNumbers, idx + 1];
              const itemPath = [...listPath, field.name];
              const canAddMoreLevels = level < MAX_BOM_LEVEL;

              return (
                <Card
                  key={field.key}
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
                      {canAddMoreLevels ? (
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => addNestedChild([...itemPath, "children"], level + 1)}
                        >
                          Add Child Level {level + 1}
                        </Button>
                      ) : null}
                      <Button
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          if (level === 1) {
                            removeTopLevelChild(Number(field.name), remove);
                            return;
                          }
                          remove(field.name);
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Form.Item
                      {...field}
                      name={[field.name, "uniq"]}
                      label="UNIQ"
                      rules={[{ required: true, message: "UNIQ is required" }]}
                    >
                      <Input placeholder={`e.g., LV7-001-${String.fromCharCode(64 + Math.min(level, 26))}`} size="large" />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, "part_name"]}
                      label="Part Name"
                      rules={[{ required: true, message: "Part name is required" }]}
                    >
                      <Input placeholder="Enter part name" size="large" />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, "part_number"]}
                      label="Part Number"
                      rules={[{ required: true, message: "Part number is required" }]}
                    >
                      <Input placeholder="Enter part number" size="large" />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, "model"]}
                      label="Product Model"
                      rules={[{ required: true, message: "Product model is required" }]}
                    >
                      <Input placeholder="Enter product model" size="large" />
                    </Form.Item>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Form.Item
                      {...field}
                      name={[field.name, "qpu"]}
                      label={level === 1 ? "QPU (Quantity Per Unit)" : "QPU"}
                      rules={[{ required: true, message: "QPU is required" }]}
                    >
                      <InputNumber min={0} size="large" style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, "version"]}
                      label="Version"
                    >
                      <Input placeholder="v1.0" size="large" />
                    </Form.Item>
                    <Form.Item
                      {...field}
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

                  {level === 1 ? (
                    <div className="mb-6">
                      <Text className="block mb-2">Add Picture for child UNIQ</Text>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <Upload
                          fileList={childFileLists[field.name] ?? []}
                          beforeUpload={() => false}
                          onChange={({ fileList: next }) =>
                            setChildFileLists((prev) => ({
                              ...prev,
                              [field.name]: next,
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
                  ) : null}

                  {renderChildProcessAndMaterial([field.name], itemPath)}
                  {canAddMoreLevels ? renderChildList([...itemPath, "children"], level + 1, numbering) : null}
                </Card>
              );
            })}
          </div>
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
        ["material_spec", "material_code"],
        ["material_spec", "form"],
        ["material_spec", "supplier"],
      ]);

      // `validateFields(names)` only returns those specific fields. We need the
      // full form state (including `child_parts`) to build the payload.
      const values = form.getFieldsValue(true) as Step1Values;

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

      const parentUom = toId(values.uom);
      if (parentUom === undefined) {
        messageApi.destroy("bom-save");
        messageApi.error("UOM is required.");
        return;
      }

      const parentUomValue = String(parentUom);

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
              cycle_time_sec:
                typeof r.cycle_time_sec_per_pc === "number" &&
                Number.isFinite(r.cycle_time_sec_per_pc)
                  ? r.cycle_time_sec_per_pc
                  : undefined,
              setup_time_min:
                typeof r.setup_time_min === "number" &&
                Number.isFinite(r.setup_time_min)
                  ? r.setup_time_min
                  : undefined,
              tooling_ref:
                typeof r.tooling === "string" && r.tooling.trim()
                  ? r.tooling.trim()
                  : undefined,
              machine_stroke:
                typeof r.machine_stroke === "string" && r.machine_stroke.trim()
                  ? r.machine_stroke.trim()
                  : undefined,
            };
          })
          .filter((r) => r.process_id !== undefined && r.machine_id !== undefined);

      const mapMaterialSpec = (spec?: MaterialSpec) => {
        const s = spec ?? {};
        const supplierId = toId(s.supplier);
        const form = normalizeMaterialForm(s.form);
        const raw: Record<string, unknown> = {
          material_grade: cleanText(s.material_code),
          form,
          width_mm: s.width_mm,
          diameter_mm: s.diameter_mm,
          thickness_mm: s.thickness_mm,
          length_mm: s.length_mm,
          ...(supplierId !== undefined ? { supplier_id: supplierId } : {}),
          cycle_time_sec: s.cycle_time_sec_per_pc,
          setup_time_min: s.dandori_setup_time_min,
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
              Boolean(model) ||
              (typeof c.qpu === "number" && Number.isFinite(c.qpu));

            if (!anyChildFieldFilled) return null;
            if (!uniq_code || !part_name || !part_number || !model) {
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
              scrap_factor: 0,
              status: toApiStatus(c.status) ?? "Active",
            };
            if (childRoutes.length > 0) childBody.process_routes = childRoutes;
            if (childSpec !== undefined) childBody.material_spec = childSpec;
            childBody.children = nested; // always send [], backend contract
            return childBody;
          })
          .filter(Boolean);
      };

      const childrenPayload = mapChildParts(values.child_parts, 1);

      const parentRoutes = mapProcessRoutes(values.process_routes);
      const parentSpec = mapMaterialSpec(values.material_spec);
      if (!parentSpec) {
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
        bom_status: cleanText(values.bom_status) ?? "Draft",
        qty_per_uniq: 1,
        scrap_factor: 0,
        description: cleanText(values.description),
        material_spec: parentSpec,
      };
      const parentStatus = toApiStatus(values.status);
      if (parentStatus) payload.status = parentStatus;
      if (parentRoutes.length > 0) payload.process_routes = parentRoutes;
      payload.children = childrenPayload; // always send [], backend contract

      if (skippedChildren.length > 0) {
        messageApi.warning(
          `Skipped incomplete child rows: ${skippedChildren.join(", ")}. Fill UNIQ/Name/Part No or remove the row.`
        );
      }

      // Helpful when backend returns generic "invalid request body".
      console.debug("[BOM] create payload", payload);

      const created = await createBom(payload as any).unwrap();
      // itemId = item's own ID → used as item_id in upload sessions
      // bomId  = BOM header ID → used in BOM GET/UPDATE URLs
      const itemId = (created as any)?.data?.id as string | undefined;
      const bomId = (created as any)?.data?.bom_id as string | undefined;

      const updateBomBody = async (id: string, body: Record<string, unknown>) => {
        const token = getCookiesFromBrowser("Authorization");
        const url = `${apiBaseUrl}/products/bom/${encodeURIComponent(id)}`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const tryUpdate = (method: "PATCH" | "PUT") =>
          fetch(url, { method, headers, body: JSON.stringify(body) });

        let res = await tryUpdate("PATCH");
        if (!res.ok && (res.status === 404 || res.status === 405)) {
          res = await tryUpdate("PUT");
        }

        const text = await res.text().catch(() => "");
        if (!res.ok) {
          throw new Error(
            `Update BOM failed (${res.status}): ${text || res.statusText}`
          );
        }

        return text;
      };

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

      // Upload child assets using child IDs (bom_child_id) from detail response.
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
        for (const c of childrenFromApi) {
          const uniq = typeof c?.uniq_code === "string" ? c.uniq_code : typeof c?.uniq === "string" ? c.uniq : "";
          // `id` is the item ID needed for upload sessions (numeric in API response)
          const childId = toStrId(c?.id) || toStrId(c?.uuid) || toStrId(c?.bom_child_id);
          if (uniq && childId) uniqToChildId.set(uniq, childId);
        }

        const childAssetPatches: Array<{ uniq_code?: string; bom_child_id?: string; asset: string }> = [];
        for (let idx = 0; idx < childrenPayload.length; idx++) {
          const child = childrenPayload[idx] as any;
          const uniqCode = child.uniq_code as string | undefined;
          const childFile = asFile(childFileLists?.[idx]?.[0]?.originFileObj);
          if (!uniqCode || !childFile) {
            continue;
          }

          const childItemId = uniqToChildId.get(uniqCode);
          if (!childItemId) {
            continue;
          }

          messageApi.open({
            key: `bom-upload-child-${idx}`,
            type: "loading",
            content: `Uploading child #${idx + 1} asset...`,
            duration: 0,
          });
          const sessionArgs: CreateUploadSessionArgs = {
            item_id: childItemId,
            asset_type: "drawing",
            file_name: childFile.name,
            mime_type: childFile.type || "application/octet-stream",
          };
          const uploaded = await uploadFileInChunks(childFile, {
            onProgress: (pct) => {
              messageApi.open({
                key: `bom-upload-child-${idx}`,
                type: "loading",
                content: `Uploading child #${idx + 1} asset... ${pct}%`,
                duration: 0,
              });
            },
            session: sessionArgs,
          });
          messageApi.destroy(`bom-upload-child-${idx}`);
          const asset = uploaded.asset || uploaded.url;
          if (asset) childAssetPatches.push({ uniq_code: uniqCode, bom_child_id: childItemId, asset });
        }

        if (childAssetPatches.length > 0) {
          await updateBomBody(bomId, { children: childAssetPatches });
        }
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

                      <Button
                        icon={<UploadOutlined />}
                        onClick={() =>
                          messageApi.info(
                            "File will be uploaded when you click Save BOM."
                          )
                        }
                      >
                        Upload
                      </Button>
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
                              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                                <Form.Item
                                  {...field}
                                  name={[field.name, "process_id"]}
                                  label="Process"
                                  rules={[{ required: true, message: "Process is required" }]}
                                >
                                  <Select
                                    showSearch
                                    placeholder="Select process"
                                    options={processOptions}
                                    loading={isProcessesLoading}
                                    optionFilterProp="label"
                                    filterOption={(input, opt) =>
                                      String(opt?.label ?? "")
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                    }
                                  />
                                </Form.Item>

                                <Form.Item
                                  {...field}
                                  name={[field.name, "machine_id"]}
                                  label="Machine"
                                  rules={[{ required: true, message: "Machine is required" }]}
                                >
                                  <Select
                                    showSearch
                                    placeholder="Select machine"
                                    options={machineOptions}
                                    loading={isMachinesLoading}
                                    optionFilterProp="label"
                                    filterOption={(input, opt) =>
                                      String(opt?.label ?? "")
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                    }
                                  />
                                </Form.Item>

                                <Form.Item
                                  {...field}
                                  name={[field.name, "sequence"]}
                                  label="Sequence"
                                >
                                  <InputNumber min={1} style={{ width: "100%" }} />
                                </Form.Item>

                                <Form.Item
                                  {...field}
                                  name={[field.name, "cycle_time_sec_per_pc"]}
                                  label="Cycle Time"
                                >
                                  <InputNumber
                                    min={0}
                                    style={{ width: "100%" }}
                                    placeholder="e.g., 30"
                                  />
                                </Form.Item>

                                <Form.Item
                                  {...field}
                                  name={[field.name, "setup_time_min"]}
                                  label="Setup Time"
                                >
                                  <InputNumber
                                    min={0}
                                    style={{ width: "100%" }}
                                    placeholder="e.g., 15"
                                  />
                                </Form.Item>

                                <Form.Item
                                  {...field}
                                  name={[field.name, "tooling"]}
                                  label="Add Tooling"
                                >
                                  <Select
                                    placeholder="Select tooling"
                                    options={[
                                      { label: "Dies", value: "Dies" },
                                      { label: "JIG", value: "JIG" },
                                      { label: "CF", value: "CF" },
                                    ]}
                                    allowClear
                                  />
                                </Form.Item>

                                <Form.Item
                                  {...field}
                                  name={[field.name, "machine_stroke"]}
                                  label="Machine Stroke"
                                >
                                  <Input placeholder="machine stroke" />
                                </Form.Item>
                              </div>
                            </div>
                          ),
                        }))}
                      />
                    )}
                  </Form.List>
                </Card>

                <Card
                  title="Material Specifications"
                  className="mb-6"
                  styles={{ body: { paddingTop: 16 } }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Form.Item
                      name={["material_spec", "material_code"]}
                      label="Material Code"
                      rules={[{ required: true, message: "Material Code is required" }]}
                    >
                      <Input placeholder="e.g., STKM550" size="large" />
                    </Form.Item>

                    <Form.Item
                      name={["material_spec", "form"]}
                      label="Form"
                      rules={[{ required: true, message: "Form is required" }]}
                    >
                      <Select
                        placeholder="Select form"
                        size="large"
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

                    <Form.Item
                      name={["material_spec", "supplier"]}
                      label="Supplier"
                      rules={[{ required: true, message: "Supplier is required" }]}
                    >
                      <Select
                        placeholder="Select supplier"
                        size="large"
                        options={supplierOptions}
                        loading={isSuppliersLoading}
                        showSearch
                        optionFilterProp="label"
                        allowClear
                      />
                    </Form.Item>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      <InputNumber min={0} size="large" style={{ width: "100%" }} />
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
                      <InputNumber min={0} size="large" style={{ width: "100%" }} />
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
                      <InputNumber min={0} size="large" style={{ width: "100%" }} />
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
                      <InputNumber min={0} size="large" style={{ width: "100%" }} />
                    </Form.Item>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Form.Item
                      name={["material_spec", "cycle_time_sec_per_pc"]}
                      label="Cycle Time (sec/pc)"
                    >
                      <InputNumber min={0} size="large" style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                      name={["material_spec", "dandori_setup_time_min"]}
                      label="Dandori/Setup Time (min)"
                    >
                      <InputNumber min={0} size="large" style={{ width: "100%" }} />
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
