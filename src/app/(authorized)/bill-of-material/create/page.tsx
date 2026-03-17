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
import { apiBaseUrl } from "@/lib/api/instance";
import { useCreateBomMutation } from "@/lib/api/bom/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetProcessesQuery } from "@/lib/api/system-settings/api";

const { Title, Text } = Typography;
const { TextArea } = Input;

type BomStatus = "Active" | "Inactive";

type ProcessRoute = {
  process_name?: string;
  machine_no?: string;
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
  qpu?: number;
  version?: string;
  status?: BomStatus;
  process_routes?: ProcessRoute[];
  material_spec?: MaterialSpec;
  child_parts?: ChildPart[];
};

type Step1Values = {
  parent_uniq?: string;
  part_name?: string;
  part_number?: string;
  status?: BomStatus;
  description?: string;
  process_routes?: ProcessRoute[];
  material_spec?: MaterialSpec;
  child_parts?: ChildPart[];
};

const normalizeChildPartsForApi = (childParts: unknown): ChildPart[] => {
  if (!Array.isArray(childParts)) return [];
  return childParts
    .filter((p): p is ChildPart => Boolean(p) && typeof p === "object")
    .map((p) => ({
      ...p,
      uniq: typeof p.uniq === "string" ? p.uniq.trim() : p.uniq,
      part_name: typeof p.part_name === "string" ? p.part_name.trim() : p.part_name,
      part_number: typeof p.part_number === "string" ? p.part_number.trim() : p.part_number,
      child_parts: normalizeChildPartsForApi((p as ChildPart).child_parts),
    }));
};

export default function CreateBomPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<Step1Values>();
  const useApi = Boolean(apiBaseUrl);
  const { data: processes = [] } = useGetProcessesQuery(undefined, {
    skip: !useApi,
  });
  const processOptions = useMemo(() => {
    const active = processes.filter((p) => String(p.status ?? "").toLowerCase() !== "inactive");
    const sorted = active.slice().sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0));
    const seen = new Set<string>();

    return sorted
      .map((p) => {
        const name = String(p.process_name ?? "").trim();
        const category = String(p.category ?? "").trim();
        if (!name) return null;
        if (seen.has(name)) return null;
        seen.add(name);
        return { value: name, label: category ? `${name} (${category})` : name };
      })
      .filter((v): v is { value: string; label: string } => Boolean(v));
  }, [processes]);
  const [createBom] = useCreateBomMutation();
  const [saving, setSaving] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [childFileLists, setChildFileLists] = useState<
    Record<number, UploadFile[]>
  >({});
  const [parentPreviewUrl, setParentPreviewUrl] = useState<string>("");
  const [childPreviewUrls, setChildPreviewUrls] = useState<Record<number, string>>({});
  const parentPreviewUrlRef = useRef<string>("");
  const childPreviewUrlsRef = useRef<Record<number, string>>({});
  const [openProcessRouteIndex, setOpenProcessRouteIndex] = useState<
    number | null
  >(0);

  useEffect(() => {
    return () => {
      if (parentPreviewUrlRef.current) URL.revokeObjectURL(parentPreviewUrlRef.current);
      for (const url of Object.values(childPreviewUrlsRef.current)) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    parentPreviewUrlRef.current = parentPreviewUrl;
  }, [parentPreviewUrl]);

  useEffect(() => {
    childPreviewUrlsRef.current = childPreviewUrls;
  }, [childPreviewUrls]);

  const initialValues = useMemo<Step1Values>(
    () => ({
      status: "Active",
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

  const onNext = async () => {
    try {
      await form.validateFields([
        "parent_uniq",
        "part_name",
        "part_number",
        "status",
      ]);
      setStep(1);
    } catch {
      // antd will show validation errors
    }
  };

  const shiftChildMapsAfterRemove = (removedIndex: number) => {
    setChildFileLists((prev) => {
      const next: Record<number, UploadFile[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        if (!Number.isFinite(idx)) continue;
        if (idx < removedIndex) next[idx] = v;
        if (idx > removedIndex) next[idx - 1] = v;
      }
      return next;
    });

    setChildPreviewUrls((prev) => {
      const next: Record<number, string> = {};
      for (const [k, url] of Object.entries(prev)) {
        const idx = Number(k);
        if (!Number.isFinite(idx)) continue;
        if (idx < removedIndex) next[idx] = url;
        if (idx > removedIndex) next[idx - 1] = url;
        if (idx === removedIndex && url) URL.revokeObjectURL(url);
      }
      return next;
    });
  };

  const saveBom = async () => {
    try {
      setSaving(true);
      // When user is on Step 2, Step 1 fields are unmounted.
      // AntD Form preserves values, but `validateFields()` may not return them.
      await form.validateFields();
      const values = form.getFieldsValue(true) as Step1Values;

      const parentUniq = String(values.parent_uniq ?? "").trim();
      if (!parentUniq) {
        messageApi.error("Parent UNIQ is required");
        return;
      }

      if (useApi) {
        const imageFile = (fileList?.[0]?.originFileObj ?? null) as File | null;
        const normalizedChildParts = normalizeChildPartsForApi(values.child_parts);

        const createChildPartsRecursive = async (args: {
          parts: ChildPart[];
          parentId: string;
          level1IndexToImageFile?: (idx: number) => File | null;
        }) => {
          const { parts, parentId, level1IndexToImageFile } = args;
          for (const [idx, child] of parts.entries()) {
            const childUniq = String(child.uniq ?? "").trim();
            const childName = String(child.part_name ?? "").trim();

            // Form has validation for these, but keep guards for safety.
            if (!childUniq || !childName) continue;

            const childImageFile = level1IndexToImageFile
              ? level1IndexToImageFile(idx)
              : null;

            const childRes = await createBom({
              assembly_code: parentUniq,
              uniq: childUniq,
              part_name: childName,
              part_number: child.part_number,
              qpu: typeof child.qpu === "number" ? child.qpu : undefined,
              version: typeof child.version === "string" ? child.version : undefined,
              status: child.status,
              process_routes: child.process_routes,
              material_spec: child.material_spec,
              parent_id: parentId,
              imageFile: childImageFile,
            }).unwrap();

            const childId = String(childRes?.data?.id ?? "").trim();
            const nested = normalizeChildPartsForApi(child.child_parts);
            if (childId && nested.length > 0) {
              await createChildPartsRecursive({
                parts: nested,
                parentId: childId,
              });
            }
          }
        };

        // Create parent first so we can link children via `parent_id`.
        const parentRes = await createBom({
          assembly_code: parentUniq,
          uniq: parentUniq,
          part_name: values.part_name ?? "",
          part_number: values.part_number,
          status: values.status,
          description: values.description,
          process_routes: values.process_routes,
          material_spec: values.material_spec,
          imageFile,
        }).unwrap();

        const parentId = String(parentRes?.data?.id ?? "").trim();
        if (!parentId) {
          messageApi.error(
            "Parent saved, but backend did not return an id/uuid. Child parts cannot be linked (parent_id missing)."
          );
        } else if (normalizedChildParts.length > 0) {
          await createChildPartsRecursive({
            parts: normalizedChildParts,
            parentId,
            level1IndexToImageFile: (idx) =>
              (childFileLists?.[idx]?.[0]?.originFileObj ?? null) as File | null,
          });
        }

        messageApi.success("BOM saved to API");
      } else {
        messageApi.success("BOM saved (UI only)");
      }

      router.push("/bill-of-material");
    } catch (err) {
      messageApi.error(getApiErrorMessage(err, "Failed to save BOM"));
    } finally {
      setSaving(false);
    }
  };

  const addLevel1Child = () => {
    const current = form.getFieldValue("child_parts") ?? [];
    form.setFieldValue("child_parts", [
      ...current,
      {
        status: "Active",
        version: "v1.0",
        qpu: 1,
        process_routes: [{ sequence: 1 }],
        material_spec: {},
        child_parts: [],
      } satisfies ChildPart,
    ]);
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
            { title: "Step 2", description: "Add Child Parts (Up to Level 4)" },
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
                      name="status"
                      label="Status"
                      rules={[{ required: true, message: "Status is required" }]}
                    >
                      <Select
                        placeholder="Select status"
                        size="large"
                        options={[
                          { label: "Active", value: "Active" },
                          { label: "Inactive", value: "Inactive" },
                        ]}
                      />
                    </Form.Item>
                  </div>

                  <Form.Item label="Add Picture for Parent UNIQ">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                      <Upload
                        fileList={fileList}
                        beforeUpload={() => false}
                        accept="image/*"
                        onChange={({ fileList: next }) => {
                          setFileList(next);

                          const nextFile = next?.[0]?.originFileObj as File | undefined;
                          if (parentPreviewUrl) URL.revokeObjectURL(parentPreviewUrl);
                          if (nextFile) setParentPreviewUrl(URL.createObjectURL(nextFile));
                          else setParentPreviewUrl("");
                        }}
                        maxCount={1}
                      >
                        <Button icon={<UploadOutlined />}>Choose File</Button>
                      </Upload>

                      <Button
                        icon={<UploadOutlined />}
                        onClick={() =>
                          messageApi.info(
                            "Image attached. It will be uploaded when you click Save BOM."
                          )
                        }
                        disabled={fileList.length === 0}
                      >
                        Upload
                      </Button>
                    </div>

                    {parentPreviewUrl ? (
                      <div className="mt-3">
                        <img
                          src={parentPreviewUrl}
                          alt="Parent preview"
                          className="h-24 w-24 rounded-md border border-gray-200 bg-gray-50 object-cover"
                        />
                      </div>
                    ) : null}
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
                                  name={[field.name, "process_name"]}
                                  label="Process Name"
                                >
                                  <Select
                                    showSearch
                                    placeholder="Select process"
                                    options={processOptions}
                                    filterOption={(input, option) =>
                                      String(option?.label ?? "")
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                    }
                                  />
                                </Form.Item>

                                <Form.Item
                                  {...field}
                                  name={[field.name, "machine_no"]}
                                  label="Machine No"
                                >
                                  <Input placeholder="e.g., M-101" />
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
                                  <Input placeholder="Dies/JIG/CF" />
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
                      rules={[{ required: true, message: "Material code is required" }]}
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
                          { label: "Sheet", value: "Sheet" },
                          { label: "Round Bar", value: "Round Bar" },
                          { label: "Pipe", value: "Pipe" },
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
                        options={[
                          { label: "Supplier A", value: "Supplier A" },
                          { label: "Supplier B", value: "Supplier B" },
                        ]}
                      />
                    </Form.Item>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Form.Item name={["material_spec", "width_mm"]} label="Width (mm)">
                      <InputNumber min={0} size="large" style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                      name={["material_spec", "diameter_mm"]}
                      label="Diameter (mm)"
                    >
                      <InputNumber min={0} size="large" style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                      name={["material_spec", "thickness_mm"]}
                      label="Thickness (mm)"
                    >
                      <InputNumber min={0} size="large" style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item name={["material_spec", "length_mm"]} label="Length (mm)">
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
                      onClick={saveBom}
                      loading={saving}
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
                Step 2: Add child components with their own process routes and material specs (optional). You can create up to 4 levels of nested children.
              </div>

              <div className="flex items-center justify-between mb-4">
                <Title level={4} className="!mb-0">
                  Child Parts (Levels 1-4)
                </Title>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={addLevel1Child}
                >
                  Add Level 1 Child
                </Button>
              </div>

              <Form.List name="child_parts">
                {(childFields, { remove }) => {
                  if (childFields.length === 0) {
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
                            >
                              Add First Child Component
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  }

                  return (
                    <div className="space-y-5">
                      {childFields.map((childField, idx) => (
                        <Card
                          key={childField.key}
                          className="border border-gray-200"
                          styles={{ body: { paddingTop: 16 } }}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                                Level 1
                              </span>
                              <Title level={5} className="!mb-0">
                                Child #{idx + 1}
                              </Title>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                icon={<PlusOutlined />}
                                onClick={() => {
                                  const path: Array<string | number> = [
                                    "child_parts",
                                    childField.name,
                                    "child_parts",
                                  ];
                                  const current = form.getFieldValue(path) ?? [];
                                  form.setFieldValue(path, [
                                    ...current,
                                    {
                                      status: "Active",
                                      version: "v1.0",
                                      qpu: 1,
                                      process_routes: [{ sequence: 1 }],
                                      material_spec: {},
                                      child_parts: [],
                                    } satisfies ChildPart,
                                  ]);
                                }}
                              >
                                Add Child Level 2
                              </Button>
                              <Button
                                danger
                                type="text"
                                icon={<DeleteOutlined />}
                                onClick={() => {
                                  remove(childField.name);
                                  shiftChildMapsAfterRemove(childField.name);
                                }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Form.Item
                              {...childField}
                              name={[childField.name, "uniq"]}
                              label="UNIQ"
                              rules={[{ required: true, message: "UNIQ is required" }]}
                            >
                              <Input placeholder="e.g., LV7-001-A" size="large" />
                            </Form.Item>
                            <Form.Item
                              {...childField}
                              name={[childField.name, "part_name"]}
                              label="Part Name"
                              rules={[{ required: true, message: "Part name is required" }]}
                            >
                              <Input placeholder="Enter part name" size="large" />
                            </Form.Item>
                            <Form.Item
                              {...childField}
                              name={[childField.name, "part_number"]}
                              label="Part Number"
                              rules={[{ required: true, message: "Part number is required" }]}
                            >
                              <Input placeholder="Enter part number" size="large" />
                            </Form.Item>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Form.Item
                              {...childField}
                              name={[childField.name, "qpu"]}
                              label="QPU (Quantity Per Unit)"
                              rules={[{ required: true, message: "QPU is required" }]}
                            >
                              <InputNumber min={0} size="large" style={{ width: "100%" }} />
                            </Form.Item>
                            <Form.Item
                              {...childField}
                              name={[childField.name, "version"]}
                              label="Version"
                            >
                              <Input placeholder="v1.0" size="large" />
                            </Form.Item>
                            <Form.Item
                              {...childField}
                              name={[childField.name, "status"]}
                              label="Status"
                              initialValue="Active"
                            >
                              <Select
                                size="large"
                                options={[
                                  { label: "Active", value: "Active" },
                                  { label: "Inactive", value: "Inactive" },
                                ]}
                              />
                            </Form.Item>
                          </div>

                          <div className="mb-6">
                            <Text className="block mb-2">Add Picture for child UNIQ</Text>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                              <Upload
                                fileList={childFileLists[childField.name] ?? []}
                                beforeUpload={() => false}
                                accept="image/*"
                                onChange={({ fileList: next }) => {
                                  setChildFileLists((prev) => ({
                                    ...prev,
                                    [childField.name]: next,
                                  }));

                                  setChildPreviewUrls((prev) => {
                                    const nextMap = { ...prev };
                                    const currentUrl = nextMap[childField.name];
                                    if (currentUrl) URL.revokeObjectURL(currentUrl);

                                    const f = next?.[0]?.originFileObj as File | undefined;
                                    if (f) nextMap[childField.name] = URL.createObjectURL(f);
                                    else delete nextMap[childField.name];
                                    return nextMap;
                                  });
                                }}
                                maxCount={1}
                              >
                                <Button icon={<UploadOutlined />}>Choose File</Button>
                              </Upload>

                              {childPreviewUrls[childField.name] ? (
                                <img
                                  src={childPreviewUrls[childField.name]}
                                  alt="Child preview"
                                  className="h-24 w-24 rounded-md border border-gray-200 bg-gray-50 object-cover"
                                />
                              ) : (
                                <div className="h-24 w-24 rounded-md border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400">
                                  Preview
                                </div>
                              )}
                            </div>
                            <Text type="secondary" className="block mt-2">
                              Upload image for 3D/2D CAD reference
                            </Text>
                          </div>

                          <div className="flex items-center justify-between mb-3">
                            <Title level={5} className="!mb-0">
                              Process Routes
                            </Title>
                            <Button
                              icon={<PlusOutlined />}
                              onClick={() => {
                                const current =
                                  form.getFieldValue([
                                    "child_parts",
                                    childField.name,
                                    "process_routes",
                                  ]) ?? [];
                                form.setFieldValue(
                                  [
                                    "child_parts",
                                    childField.name,
                                    "process_routes",
                                  ],
                                  [...current, { sequence: (current.length ?? 0) + 1 }]
                                );
                              }}
                            >
                              Add Process
                            </Button>
                          </div>

                          <Form.List name={[childField.name, "process_routes"]}>
                            {(procFields, { remove: removeProc }) => (
                              <div className="space-y-3 mb-6">
                                {procFields.map((pf) => (
                                  <div
                                    key={pf.key}
                                    className="grid grid-cols-1 md:grid-cols-7 gap-3 items-start"
                                  >
                                    <Form.Item
                                      {...pf}
                                      name={[pf.name, "process_name"]}
                                      label="Process"
                                    >
                                      <Select
                                        showSearch
                                        placeholder="Select process"
                                        options={processOptions}
                                        filterOption={(input, option) =>
                                          String(option?.label ?? "")
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                        }
                                      />
                                    </Form.Item>
                                    <Form.Item
                                      {...pf}
                                      name={[pf.name, "machine_no"]}
                                      label="Machine"
                                    >
                                      <Input placeholder="Machine" />
                                    </Form.Item>
                                    <Form.Item
                                      {...pf}
                                      name={[pf.name, "sequence"]}
                                      label="Sequence"
                                    >
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
                                    <Form.Item
                                      {...pf}
                                      name={[pf.name, "tooling"]}
                                      label="Tooling"
                                    >
                                      <Input placeholder="Tooling" />
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
                            Material Specifications
                          </Title>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Form.Item
                              {...childField}
                              name={[childField.name, "material_spec", "material_code"]}
                              label="Material Code"
                            >
                              <Input placeholder="Material Code" />
                            </Form.Item>
                            <Form.Item
                              {...childField}
                              name={[childField.name, "material_spec", "form"]}
                              label="Form"
                            >
                              <Input placeholder="Form" />
                            </Form.Item>
                            <Form.Item
                              {...childField}
                              name={[childField.name, "material_spec", "width_mm"]}
                              label="Width (mm)"
                            >
                              <InputNumber min={0} style={{ width: "100%" }} />
                            </Form.Item>
                            <Form.Item
                              {...childField}
                              name={[childField.name, "material_spec", "diameter_mm"]}
                              label="Ø (mm)"
                            >
                              <InputNumber min={0} style={{ width: "100%" }} />
                            </Form.Item>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Form.Item
                              {...childField}
                              name={[childField.name, "material_spec", "thickness_mm"]}
                              label="Thickness (mm)"
                            >
                              <InputNumber min={0} style={{ width: "100%" }} />
                            </Form.Item>
                            <Form.Item
                              {...childField}
                              name={[childField.name, "material_spec", "length_mm"]}
                              label="Length (mm)"
                            >
                              <InputNumber min={0} style={{ width: "100%" }} />
                            </Form.Item>
                            <Form.Item
                              {...childField}
                              name={[childField.name, "material_spec", "supplier"]}
                              label="Supplier"
                            >
                              <Input placeholder="Supplier" />
                            </Form.Item>
                          </div>

                          <div className="mt-6">
                            <div className="flex items-center justify-between mb-3">
                              <Title level={5} className="!mb-0">
                                Child Parts (Level 2)
                              </Title>
                            </div>

                            <Form.List name={[childField.name, "child_parts"]}>
                              {(lvl2Fields, { remove: removeLvl2 }) => (
                                <div className="space-y-4">
                                  {lvl2Fields.map((lvl2Field, lvl2Idx) => (
                                    <Card
                                      key={lvl2Field.key}
                                      className="border border-gray-100"
                                      styles={{ body: { paddingTop: 16 } }}
                                    >
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                                            Level 2
                                          </span>
                                          <Text className="font-semibold">Child 2.{lvl2Idx + 1}</Text>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            icon={<PlusOutlined />}
                                            onClick={() => {
                                              const path: Array<string | number> = [
                                                "child_parts",
                                                childField.name,
                                                "child_parts",
                                                lvl2Field.name,
                                                "child_parts",
                                              ];
                                              const current = form.getFieldValue(path) ?? [];
                                              form.setFieldValue(path, [
                                                ...current,
                                                {
                                                  status: "Active",
                                                  version: "v1.0",
                                                  qpu: 1,
                                                  process_routes: [{ sequence: 1 }],
                                                  material_spec: {},
                                                  child_parts: [],
                                                } satisfies ChildPart,
                                              ]);
                                            }}
                                          >
                                            Add Child Level 3
                                          </Button>
                                          <Button
                                            danger
                                            type="text"
                                            icon={<DeleteOutlined />}
                                            onClick={() => removeLvl2(lvl2Field.name)}
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Form.Item
                                          {...lvl2Field}
                                          name={[lvl2Field.name, "uniq"]}
                                          label="UNIQ"
                                          rules={[{ required: true, message: "UNIQ is required" }]}
                                        >
                                          <Input placeholder="e.g., LV7-001-A" />
                                        </Form.Item>
                                        <Form.Item
                                          {...lvl2Field}
                                          name={[lvl2Field.name, "part_name"]}
                                          label="Part Name"
                                          rules={[{ required: true, message: "Part name is required" }]}
                                        >
                                          <Input placeholder="Enter part name" />
                                        </Form.Item>
                                        <Form.Item
                                          {...lvl2Field}
                                          name={[lvl2Field.name, "part_number"]}
                                          label="Part Number"
                                          rules={[{ required: true, message: "Part number is required" }]}
                                        >
                                          <Input placeholder="Enter part number" />
                                        </Form.Item>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Form.Item
                                          {...lvl2Field}
                                          name={[lvl2Field.name, "qpu"]}
                                          label="QPU"
                                          rules={[{ required: true, message: "QPU is required" }]}
                                        >
                                          <InputNumber min={0} style={{ width: "100%" }} />
                                        </Form.Item>
                                        <Form.Item
                                          {...lvl2Field}
                                          name={[lvl2Field.name, "version"]}
                                          label="Version"
                                        >
                                          <Input placeholder="v1.0" />
                                        </Form.Item>
                                        <Form.Item
                                          {...lvl2Field}
                                          name={[lvl2Field.name, "status"]}
                                          label="Status"
                                          initialValue="Active"
                                        >
                                          <Select
                                            options={[
                                              { label: "Active", value: "Active" },
                                              { label: "Inactive", value: "Inactive" },
                                            ]}
                                          />
                                        </Form.Item>
                                      </div>

                                      <div className="flex items-center justify-between mb-3">
                                        <Text className="font-semibold">Process Routes</Text>
                                        <Button
                                          icon={<PlusOutlined />}
                                          onClick={() => {
                                            const current =
                                              form.getFieldValue([
                                                "child_parts",
                                                childField.name,
                                                "child_parts",
                                                lvl2Field.name,
                                                "process_routes",
                                              ]) ?? [];
                                            form.setFieldValue(
                                              [
                                                "child_parts",
                                                childField.name,
                                                "child_parts",
                                                lvl2Field.name,
                                                "process_routes",
                                              ],
                                              [...current, { sequence: (current.length ?? 0) + 1 }]
                                            );
                                          }}
                                        >
                                          Add Process
                                        </Button>
                                      </div>

                                      <Form.List name={[lvl2Field.name, "process_routes"]}>
                                        {(procFields, { remove: removeProc }) => (
                                          <div className="space-y-3 mb-6">
                                            {procFields.map((pf) => (
                                              <div
                                                key={pf.key}
                                                className="grid grid-cols-1 md:grid-cols-7 gap-3 items-start"
                                              >
                                                <Form.Item
                                                  {...pf}
                                                  name={[pf.name, "process_name"]}
                                                  label="Process"
                                                >
                                                  <Select
                                                    showSearch
                                                    placeholder="Select process"
                                                    options={processOptions}
                                                    filterOption={(input, option) =>
                                                      String(option?.label ?? "")
                                                        .toLowerCase()
                                                        .includes(input.toLowerCase())
                                                    }
                                                  />
                                                </Form.Item>
                                                <Form.Item
                                                  {...pf}
                                                  name={[pf.name, "machine_no"]}
                                                  label="Machine"
                                                >
                                                  <Input placeholder="Machine" />
                                                </Form.Item>
                                                <Form.Item
                                                  {...pf}
                                                  name={[pf.name, "sequence"]}
                                                  label="Sequence"
                                                >
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
                                                <Form.Item
                                                  {...pf}
                                                  name={[pf.name, "tooling"]}
                                                  label="Tooling"
                                                >
                                                  <Input placeholder="Tooling" />
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

                                      <div className="mt-4">
                                        <div className="flex items-center justify-between mb-3">
                                          <Text className="font-semibold">Child Parts (Level 3)</Text>
                                        </div>

                                        <Form.List name={[lvl2Field.name, "child_parts"]}>
                                          {(lvl3Fields, { remove: removeLvl3 }) => (
                                            <div className="space-y-3">
                                              {lvl3Fields.map((lvl3Field, lvl3Idx) => (
                                                <Card
                                                  key={lvl3Field.key}
                                                  className="border border-gray-50"
                                                  styles={{ body: { paddingTop: 16 } }}
                                                >
                                                  <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                      <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700">
                                                        Level 3
                                                      </span>
                                                      <Text className="font-semibold">Child 3.{lvl3Idx + 1}</Text>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <Button
                                                        icon={<PlusOutlined />}
                                                        onClick={() => {
                                                          const path: Array<string | number> = [
                                                            "child_parts",
                                                            childField.name,
                                                            "child_parts",
                                                            lvl2Field.name,
                                                            "child_parts",
                                                            lvl3Field.name,
                                                            "child_parts",
                                                          ];
                                                          const current = form.getFieldValue(path) ?? [];
                                                          form.setFieldValue(path, [
                                                            ...current,
                                                            {
                                                              status: "Active",
                                                              version: "v1.0",
                                                              qpu: 1,
                                                              process_routes: [{ sequence: 1 }],
                                                              material_spec: {},
                                                              child_parts: [],
                                                            } satisfies ChildPart,
                                                          ]);
                                                        }}
                                                      >
                                                        Add Child Level 4
                                                      </Button>
                                                      <Button
                                                        danger
                                                        type="text"
                                                        icon={<DeleteOutlined />}
                                                        onClick={() => removeLvl3(lvl3Field.name)}
                                                      />
                                                    </div>
                                                  </div>

                                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <Form.Item
                                                      {...lvl3Field}
                                                      name={[lvl3Field.name, "uniq"]}
                                                      label="UNIQ"
                                                      rules={[{ required: true, message: "UNIQ is required" }]}
                                                    >
                                                      <Input placeholder="e.g., LV7-001-A" />
                                                    </Form.Item>
                                                    <Form.Item
                                                      {...lvl3Field}
                                                      name={[lvl3Field.name, "part_name"]}
                                                      label="Part Name"
                                                      rules={[{ required: true, message: "Part name is required" }]}
                                                    >
                                                      <Input placeholder="Enter part name" />
                                                    </Form.Item>
                                                    <Form.Item
                                                      {...lvl3Field}
                                                      name={[lvl3Field.name, "part_number"]}
                                                      label="Part Number"
                                                      rules={[{ required: true, message: "Part number is required" }]}
                                                    >
                                                      <Input placeholder="Enter part number" />
                                                    </Form.Item>
                                                  </div>

                                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <Form.Item
                                                      {...lvl3Field}
                                                      name={[lvl3Field.name, "qpu"]}
                                                      label="QPU"
                                                      rules={[{ required: true, message: "QPU is required" }]}
                                                    >
                                                      <InputNumber min={0} style={{ width: "100%" }} />
                                                    </Form.Item>
                                                    <Form.Item
                                                      {...lvl3Field}
                                                      name={[lvl3Field.name, "version"]}
                                                      label="Version"
                                                    >
                                                      <Input placeholder="v1.0" />
                                                    </Form.Item>
                                                    <Form.Item
                                                      {...lvl3Field}
                                                      name={[lvl3Field.name, "status"]}
                                                      label="Status"
                                                      initialValue="Active"
                                                    >
                                                      <Select
                                                        options={[
                                                          { label: "Active", value: "Active" },
                                                          { label: "Inactive", value: "Inactive" },
                                                        ]}
                                                      />
                                                    </Form.Item>
                                                  </div>

                                                  <div className="mt-4">
                                                    <Text className="font-semibold">Child Parts (Level 4)</Text>
                                                    <Form.List name={[lvl3Field.name, "child_parts"]}>
                                                      {(lvl4Fields, { remove: removeLvl4 }) => (
                                                        <div className="space-y-3 mt-3">
                                                          {lvl4Fields.map((lvl4Field, lvl4Idx) => (
                                                            <Card
                                                              key={lvl4Field.key}
                                                              className="border border-gray-50"
                                                              styles={{ body: { paddingTop: 16 } }}
                                                            >
                                                              <div className="flex items-center justify-between mb-3">
                                                                <div className="flex items-center gap-3">
                                                                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                                                                    Level 4
                                                                  </span>
                                                                  <Text className="font-semibold">Child 4.{lvl4Idx + 1}</Text>
                                                                </div>
                                                                <Button
                                                                  danger
                                                                  type="text"
                                                                  icon={<DeleteOutlined />}
                                                                  onClick={() => removeLvl4(lvl4Field.name)}
                                                                />
                                                              </div>

                                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                <Form.Item
                                                                  {...lvl4Field}
                                                                  name={[lvl4Field.name, "uniq"]}
                                                                  label="UNIQ"
                                                                  rules={[{ required: true, message: "UNIQ is required" }]}
                                                                >
                                                                  <Input placeholder="e.g., LV7-001-A" />
                                                                </Form.Item>
                                                                <Form.Item
                                                                  {...lvl4Field}
                                                                  name={[lvl4Field.name, "part_name"]}
                                                                  label="Part Name"
                                                                  rules={[{ required: true, message: "Part name is required" }]}
                                                                >
                                                                  <Input placeholder="Enter part name" />
                                                                </Form.Item>
                                                                <Form.Item
                                                                  {...lvl4Field}
                                                                  name={[lvl4Field.name, "part_number"]}
                                                                  label="Part Number"
                                                                  rules={[{ required: true, message: "Part number is required" }]}
                                                                >
                                                                  <Input placeholder="Enter part number" />
                                                                </Form.Item>
                                                              </div>
                                                            </Card>
                                                          ))}
                                                        </div>
                                                      )}
                                                    </Form.List>
                                                  </div>
                                                </Card>
                                              ))}
                                            </div>
                                          )}
                                        </Form.List>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </Form.List>
                          </div>
                        </Card>
                      ))}
                    </div>
                  );
                }}
              </Form.List>

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
                    loading={saving}
                    onClick={saveBom}
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
