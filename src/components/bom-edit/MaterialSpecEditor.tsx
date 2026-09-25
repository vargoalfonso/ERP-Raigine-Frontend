"use client";

import { Checkbox, Form, Input, InputNumber, Select, Typography } from "antd";
import type { FormPath } from "./bom-edit.types";
import { useAllRawMaterialMasters } from "@/lib/hooks/useAllRawMaterialMasters";

const { Text } = Typography;

type MaterialSpecEditorProps = {
  fieldPath: FormPath;
  disabled?: boolean;
};

export default function MaterialSpecEditor({
  fieldPath,
  disabled,
}: MaterialSpecEditorProps) {
  const form = Form.useFormInstance();
  // Loads incrementally (100 at a time) instead of one big request.
  const { items, isFetching } = useAllRawMaterialMasters();

  const handleMasterSelect = (masterId: number | undefined) => {
    if (masterId == null) return;
    const item = items.find((m) => m.id === masterId);
    if (!item) return;
    const base = [...fieldPath, "material_spec"] as const;
    form.setFieldValue(
      [...base, "material_grade"],
      item.material_grade ?? undefined,
    );
    form.setFieldValue([...base, "grade"], item.material_grade ?? undefined);
    form.setFieldValue([...base, "form"], item.form ?? undefined);
    form.setFieldValue(
      [...base, "weight_kg"],
      item.weight_kg ?? undefined,
    );
    form.setFieldValue([...base, "width_mm"], item.width_mm ?? undefined);
    form.setFieldValue(
      [...base, "diameter_mm"],
      item.diameter_mm ?? undefined,
    );
    form.setFieldValue(
      [...base, "thickness_mm"],
      item.thickness_mm ?? undefined,
    );
    form.setFieldValue([...base, "length_mm"], item.length_mm ?? undefined);
    if (item.type_material === "raw" || item.type_material === "indirect") {
      form.setFieldValue([...base, "type_material"], item.type_material);
      form.setFieldValue([...base, "is_subcon"], false);
    } else if (item.type_material === "subcon") {
      form.setFieldValue([...base, "is_subcon"], true);
    }
  };

  return (
    <div className="space-y-4">
      <Text strong>Material specification</Text>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Form.Item
          name={[...fieldPath, "material_spec", "raw_material_master_id"]}
          label="Raw Material Master"
          tooltip="BOM dengan spesifikasi yang sama harus memilih master yang sama. Pilih master untuk mengisi otomatis spesifikasi di bawah."
        >
          <Select
            showSearch
            allowClear
            disabled={disabled}
            loading={isFetching}
            placeholder="Select canonical material"
            optionFilterProp="label"
            onChange={handleMasterSelect}
            options={items
              .filter((item) => item.status === "Active")
              .map((item) => ({
                value: item.id,
                label: `${item.material_code} — ${item.material_name}`,
              }))}
          />
        </Form.Item>
        <Form.Item
          name={[...fieldPath, "material_spec", "material_grade"]}
          label="Material Grade"
          rules={
            disabled
              ? []
              : [{ required: true, message: "Material Grade is required" }]
          }
        >
          <Input placeholder="e.g., STKM550" disabled={disabled} />
        </Form.Item>
        <Form.Item
          name={[...fieldPath, "material_spec", "form"]}
          label="Form"
          rules={
            disabled ? [] : [{ required: true, message: "Form is required" }]
          }
        >
          <Select
            allowClear
            disabled={disabled}
            placeholder="Select form"
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
          name={[...fieldPath, "material_spec", "grade"]}
          label="Grade"
          rules={
            disabled ? [] : [{ required: true, message: "Grade is required" }]
          }
        >
          <Input placeholder="e.g., STKM550" disabled={disabled} />
        </Form.Item>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Form.Item
          name={[...fieldPath, "material_spec", "type_material"]}
          label="Category"
        >
          <Select
            disabled={disabled}
            allowClear
            placeholder="Select type"
            options={[
              { label: "Raw Material", value: "raw" },
              { label: "Indirect Raw Material", value: "indirect" },
            ]}
          />
        </Form.Item>
        <Form.Item
          name={[...fieldPath, "material_spec", "is_subcon"]}
          valuePropName="checked"
          className="mt-8"
        >
          <Checkbox disabled={disabled}>Subcon</Checkbox>
        </Form.Item>
        <Form.Item
          name={[...fieldPath, "material_spec", "weight_kg"]}
          label="Weight (kg)"
        >
          <InputNumber min={0} className="w-full" disabled={disabled} />
        </Form.Item>
        <Form.Item
          name={[...fieldPath, "material_spec", "width_mm"]}
          label="Width (mm)"
        >
          <InputNumber min={0} className="w-full" disabled={disabled} />
        </Form.Item>
        <Form.Item
          name={[...fieldPath, "material_spec", "diameter_mm"]}
          label="Diameter (mm)"
        >
          <InputNumber min={0} className="w-full" disabled={disabled} />
        </Form.Item>
        <Form.Item
          name={[...fieldPath, "material_spec", "thickness_mm"]}
          label="Thickness (mm)"
        >
          <InputNumber min={0} className="w-full" disabled={disabled} />
        </Form.Item>
        <Form.Item
          name={[...fieldPath, "material_spec", "length_mm"]}
          label="Length (mm)"
        >
          <InputNumber min={0} className="w-full" disabled={disabled} />
        </Form.Item>
      </div>
    </div>
  );
}
