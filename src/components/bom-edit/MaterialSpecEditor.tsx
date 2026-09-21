"use client";

import { Checkbox, Form, Input, InputNumber, Select, Typography } from "antd";
import type { FormPath } from "./bom-edit.types";
import { useGetRawMaterialMastersQuery } from "@/lib/api/raw-material-master/api";

const { Text } = Typography;

type MaterialSpecEditorProps = {
  fieldPath: FormPath;
  disabled?: boolean;
};

export default function MaterialSpecEditor({
  fieldPath,
  disabled,
}: MaterialSpecEditorProps) {
  const { data, isFetching } = useGetRawMaterialMastersQuery({ limit: 100 });
  return (
    <div className="space-y-4">
      <Text strong>Material specification</Text>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Form.Item
          name={[...fieldPath, "material_spec", "raw_material_master_id"]}
          label="Raw Material Master"
          tooltip="BOM dengan spesifikasi yang sama harus memilih master yang sama."
        >
          <Select
            showSearch
            allowClear
            disabled={disabled}
            loading={isFetching}
            placeholder="Select canonical material"
            optionFilterProp="label"
            options={(data?.items ?? [])
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
