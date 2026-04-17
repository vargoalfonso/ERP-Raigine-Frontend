"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  Select,
  Spin,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, PlusOutlined, SaveOutlined, DeleteOutlined } from "@ant-design/icons";

import { useGetBomByIdQuery, useUpdateBomMutation } from "@/lib/api/bom/api";
import { useGetProcessesQuery } from "@/lib/api/system-settings/api";
import { useGetMachinesQuery } from "@/lib/api/machines/api";

const { Title, Text } = Typography;

type RouteParams = { id: string };

type ProcessRouteForm = {
  op_seq?: number;
  process_id?: number | string;
  machine_id?: number | string;
  cycle_time_sec?: number;
  setup_time_min?: number;
  machine_stroke?: string;
  tooling_ref?: string;
};

type MaterialSpecForm = {
  material_grade?: string;
  form?: string;
  width_mm?: number;
  diameter_mm?: number;
  thickness_mm?: number;
  length_mm?: number;
  weight_kg?: number;
  supplier_id?: string;
};

type EditValues = {
  part_name?: string;
  description?: string;
  bom_status?: string;
  process_routes?: ProcessRouteForm[];
  material_spec?: MaterialSpecForm;
};

const toNumberId = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

const cleanText = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s : undefined;
};

export default function BomEditPage({ params }: { params: RouteParams }) {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<EditValues>();

  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const id = params?.id;

  const { data, isLoading, error } = useGetBomByIdQuery(id, {
    skip: !apiEnabled || !id,
  });
  const [updateBom, updateState] = useUpdateBomMutation();

  const bom = (data as any)?.data ?? data;

  const canonicalBomId = useMemo(() => {
    const bomId = (bom as any)?.bom_id;
    if (typeof bomId === "number" && Number.isFinite(bomId)) return String(bomId);
    if (typeof bomId === "string" && bomId.trim()) return bomId.trim();
    return id;
  }, [bom, id]);

  useEffect(() => {
    if (canonicalBomId && id && canonicalBomId !== id) {
      router.replace(`/bill-of-material/${encodeURIComponent(canonicalBomId)}/edit`);
    }
  }, [canonicalBomId, id, router]);

  const { data: processes = [], isLoading: isProcessesLoading } =
    useGetProcessesQuery(undefined, { skip: !apiEnabled });
  const { data: machines = [], isLoading: isMachinesLoading } =
    useGetMachinesQuery(undefined, { skip: !apiEnabled });

  const processOptions = useMemo<Array<{ value: string | number; label: string }>>(() => {
    return (processes ?? [])
      .map((p: any) => {
        const rawId = p?.id;
        const idStr = typeof rawId === "string" ? rawId.trim() : String(rawId ?? "").trim();
        if (!idStr) return null;
        const asNumber = Number(idStr);
        const value: string | number = Number.isFinite(asNumber) ? asNumber : idStr;
        const code = typeof p?.process_code === "string" ? p.process_code.trim() : "";
        const name = typeof p?.process_name === "string" ? p.process_name.trim() : "";
        return { value, label: code && name ? `${code} — ${name}` : name || code || idStr };
      })
      .filter((x): x is { value: string | number; label: string } => Boolean(x));
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
        return { value, label: number && name ? `${number} — ${name}` : name || number || idStr };
      })
      .filter((x): x is { value: string | number; label: string } => Boolean(x));
  }, [machines]);

  useEffect(() => {
    if (!bom) return;
    const initial: EditValues = {
      part_name: typeof (bom as any).part_name === "string" ? (bom as any).part_name : undefined,
      description:
        typeof (bom as any).description === "string" ? (bom as any).description : undefined,
      bom_status:
        typeof (bom as any).bom_status === "string" ? (bom as any).bom_status : undefined,
      process_routes: Array.isArray((bom as any).process_routes)
        ? (bom as any).process_routes.map((r: any) => ({
            op_seq: typeof r?.op_seq === "number" ? r.op_seq : undefined,
            process_id: r?.process_id ?? undefined,
            machine_id: r?.machine_id ?? undefined,
            cycle_time_sec: typeof r?.cycle_time_sec === "number" ? r.cycle_time_sec : undefined,
            setup_time_min: typeof r?.setup_time_min === "number" ? r.setup_time_min : undefined,
            machine_stroke: typeof r?.machine_stroke === "string" ? r.machine_stroke : undefined,
            tooling_ref: typeof r?.tooling_ref === "string" ? r.tooling_ref : undefined,
          }))
        : [],
      material_spec:
        (bom as any).material_spec && typeof (bom as any).material_spec === "object"
          ? {
              material_grade:
                typeof (bom as any).material_spec.material_grade === "string"
                  ? (bom as any).material_spec.material_grade
                  : undefined,
              form:
                typeof (bom as any).material_spec.form === "string"
                  ? (bom as any).material_spec.form
                  : undefined,
              width_mm:
                typeof (bom as any).material_spec.width_mm === "number"
                  ? (bom as any).material_spec.width_mm
                  : undefined,
              diameter_mm:
                typeof (bom as any).material_spec.diameter_mm === "number"
                  ? (bom as any).material_spec.diameter_mm
                  : undefined,
              thickness_mm:
                typeof (bom as any).material_spec.thickness_mm === "number"
                  ? (bom as any).material_spec.thickness_mm
                  : undefined,
              length_mm:
                typeof (bom as any).material_spec.length_mm === "number"
                  ? (bom as any).material_spec.length_mm
                  : undefined,
              weight_kg:
                typeof (bom as any).material_spec.weight_kg === "number"
                  ? (bom as any).material_spec.weight_kg
                  : undefined,
              supplier_id:
                typeof (bom as any).material_spec.supplier_id === "string"
                  ? (bom as any).material_spec.supplier_id
                  : undefined,
            }
          : undefined,
    };
    form.setFieldsValue(initial);
  }, [bom, form]);

  const onSave = async () => {
    try {
      const values = (await form.validateFields()) as EditValues;

      const routes = (values.process_routes ?? [])
        .map((r, idx) => {
          const baseSeq = typeof r.op_seq === "number" ? r.op_seq : (idx + 1) * 10;
          const process_id = toNumberId(r.process_id);
          const machine_id = toNumberId(r.machine_id);
          if (!process_id || !machine_id) return null;
          const body: any = {
            op_seq: baseSeq,
            process_id,
            machine_id,
          };
          if (typeof r.cycle_time_sec === "number") body.cycle_time_sec = r.cycle_time_sec;
          if (typeof r.setup_time_min === "number") body.setup_time_min = r.setup_time_min;
          if (typeof r.machine_stroke === "string" && r.machine_stroke.trim()) body.machine_stroke = r.machine_stroke.trim();
          if (typeof r.tooling_ref === "string" && r.tooling_ref.trim()) body.tooling_ref = r.tooling_ref.trim();
          return body;
        })
        .filter(Boolean);

      const materialSpec = values.material_spec ?? {};
      const materialBody: any = {
        material_grade: cleanText(materialSpec.material_grade),
        form: cleanText(materialSpec.form),
        width_mm: materialSpec.width_mm,
        diameter_mm: materialSpec.diameter_mm,
        thickness_mm: materialSpec.thickness_mm,
        length_mm: materialSpec.length_mm,
        weight_kg: materialSpec.weight_kg,
        supplier_id: cleanText(materialSpec.supplier_id),
      };
      Object.keys(materialBody).forEach((k) => {
        const v = materialBody[k];
        if (v === undefined || v === null || v === "") delete materialBody[k];
      });

      const body: any = {
        part_name: cleanText(values.part_name),
        description: cleanText(values.description),
        bom_status: cleanText(values.bom_status),
      };
      Object.keys(body).forEach((k) => {
        const v = body[k];
        if (v === undefined || v === null || v === "") delete body[k];
      });

      // Only send if user has them.
      if (routes.length > 0) body.process_routes = routes;
      if (Object.keys(materialBody).length > 0) body.material_spec = materialBody;

      if (Object.keys(body).length === 0) {
        messageApi.info("No changes to save.");
        return;
      }

      await updateBom({ bom_id: canonicalBomId, body }).unwrap();
      messageApi.success("Updated");
      router.push(`/bill-of-material/${encodeURIComponent(canonicalBomId)}`);
    } catch {
      // antd shows errors
    }
  };

  return (
    <div className="p-6">
      {contextHolder}

      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm mb-6">
        <div>
          <Title level={3} className="!mb-0">
            Edit BOM
          </Title>
          <Text type="secondary">/products/bom/{canonicalBomId}</Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push(`/bill-of-material/${encodeURIComponent(canonicalBomId)}`)}
          >
            Back
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={updateState.isLoading}
            onClick={onSave}
          >
            Save
          </Button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="py-8 flex items-center justify-center">
            <Spin />
          </div>
        ) : error ? (
          <Text type="danger">Failed to load BOM.</Text>
        ) : (
          <Form layout="vertical" form={form}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="part_name" label="Part Name" rules={[{ required: true, message: "Part name is required" }]}>
                <Input size="large" />
              </Form.Item>
              <Form.Item label="Status">
                <Input value={String((bom as any)?.bom_status ?? "Draft")} size="large" disabled />
              </Form.Item>
            </div>

            <Form.Item name="description" label="Description">
              <Input.TextArea rows={4} />
            </Form.Item>

            <Form.Item name="bom_status" label="BOM Status">
              <Select
                placeholder="Select BOM Status"
                options={[
                  { label: "Draft", value: "Draft" },
                  { label: "Released", value: "Released" },
                  { label: "Obsolete", value: "Obsolete" },
                ]}
                allowClear
              />
            </Form.Item>

            <DividerLine title="Process Routes" />

            <Form.List name="process_routes">
              {(fields, { add, remove }) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Text strong>Routes</Text>
                    <Button icon={<PlusOutlined />} onClick={() => add({})}>
                      Add Route
                    </Button>
                  </div>

                  <Collapse
                    accordion
                    bordered={false}
                    className="!bg-transparent"
                    items={fields.map((f, idx) => ({
                      key: String(f.key),
                      label: `Route #${idx + 1}`,
                      children: (
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                          <Form.Item {...f} name={[f.name, "op_seq"]} label="Op Seq">
                            <InputNumber min={1} style={{ width: "100%" }} />
                          </Form.Item>
                          <Form.Item {...f} name={[f.name, "process_id"]} label="Process" rules={[{ required: true, message: "Process is required" }]}>
                            <Select
                              showSearch
                              options={processOptions}
                              loading={isProcessesLoading}
                              optionFilterProp="label"
                              placeholder="Select process"
                            />
                          </Form.Item>
                          <Form.Item {...f} name={[f.name, "machine_id"]} label="Machine" rules={[{ required: true, message: "Machine is required" }]}>
                            <Select
                              showSearch
                              options={machineOptions}
                              loading={isMachinesLoading}
                              optionFilterProp="label"
                              placeholder="Select machine"
                            />
                          </Form.Item>
                          <Form.Item {...f} name={[f.name, "cycle_time_sec"]} label="Cycle (sec)">
                            <InputNumber min={0} style={{ width: "100%" }} />
                          </Form.Item>
                          <Form.Item {...f} name={[f.name, "setup_time_min"]} label="Setup (min)">
                            <InputNumber min={0} style={{ width: "100%" }} />
                          </Form.Item>
                          <Form.Item {...f} name={[f.name, "tooling_ref"]} label="Tooling">
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
                          <div className="md:col-span-6">
                            <Button
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(f.name)}
                            >
                              Remove Route
                            </Button>
                          </div>
                        </div>
                      ),
                    }))}
                  />
                </div>
              )}
            </Form.List>

            <DividerLine title="Material Spec" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Form.Item name={["material_spec", "material_grade"]} label="Material Grade">
                <Input />
              </Form.Item>
              <Form.Item name={["material_spec", "form"]} label="Form">
                <Select
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
              <Form.Item name={["material_spec", "supplier_id"]} label="Supplier ID">
                <Input />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Form.Item name={["material_spec", "width_mm"]} label="Width (mm)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name={["material_spec", "diameter_mm"]} label="Diameter (mm)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name={["material_spec", "thickness_mm"]} label="Thickness (mm)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name={["material_spec", "length_mm"]} label="Length (mm)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name={["material_spec", "weight_kg"]} label="Weight (kg)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
}

function DividerLine({ title }: { title: string }) {
  return (
    <div className="mt-6 mb-3">
      <div className="h-px bg-gray-200 mb-2" />
      <Text strong>{title}</Text>
    </div>
  );
}
