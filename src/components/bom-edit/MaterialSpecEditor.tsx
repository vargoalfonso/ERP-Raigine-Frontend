"use client";

import { Form, Input, InputNumber, Select, Typography } from "antd";
import type { FormPath } from "./bom-edit.types";

const { Text } = Typography;

type MaterialSpecEditorProps = {
  fieldPath: FormPath;
  disabled?: boolean;
};

export default function MaterialSpecEditor({ fieldPath, disabled }: MaterialSpecEditorProps) {
  return (
    <div className="space-y-4">
      <Text strong>Material specification</Text>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Form.Item
          name={[...fieldPath, "material_spec", "material_grade"]}
          label="Material Grade"
          rules={disabled ? [] : [{ required: true, message: "Material Grade is required" }]}
        >
          <Input placeholder="e.g., STKM550" disabled={disabled} />
        </Form.Item>
        <Form.Item
          name={[...fieldPath, "material_spec", "form"]}
          label="Form"
          rules={disabled ? [] : [{ required: true, message: "Form is required" }]}
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
          rules={disabled ? [] : [{ required: true, message: "Grade is required" }]}
        >
          <Input placeholder="e.g., STKM550" disabled={disabled} />
        </Form.Item>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Form.Item name={[...fieldPath, "material_spec", "type_material"]} label="Category">
          <Select
            disabled={disabled}
            allowClear
            placeholder="Select type"
            options={[
              { label: "Raw", value: "raw" },
              { label: "Indirect", value: "indirect" },
            ]}
          />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "weight_kg"]} label="Weight (kg)">
          <InputNumber min={0} className="w-full" disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "width_mm"]} label="Width (mm)">
          <InputNumber min={0} className="w-full" disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "diameter_mm"]} label="Diameter (mm)">
          <InputNumber min={0} className="w-full" disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "thickness_mm"]} label="Thickness (mm)">
          <InputNumber min={0} className="w-full" disabled={disabled} />
        </Form.Item>
        <Form.Item name={[...fieldPath, "material_spec", "length_mm"]} label="Length (mm)">
          <InputNumber min={0} className="w-full" disabled={disabled} />
        </Form.Item>
      </div>
    </div>
  );
}
