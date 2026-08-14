"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Select, Typography } from "antd";
import type { FormInstance } from "antd";
import type { FormPath, ProcessRouteForm } from "./bom-edit.types";

const { Text } = Typography;

type ProcessOption = { value: string | number; label: string; isAssembly: boolean };
type MachineOption = { value: string | number; label: string };

type ProcessRoutesEditorProps = {
  form: FormInstance;
  fieldPath: FormPath;
  absolutePath: FormPath;
  processOptions: ProcessOption[];
  machineOptions: MachineOption[];
  isProcessesLoading?: boolean;
  isMachinesLoading?: boolean;
  hideAddWhenAssembly?: boolean;
  isAssemblyMode?: boolean;
  disabled?: boolean;
};

export default function ProcessRoutesEditor({
  form,
  fieldPath,
  absolutePath,
  processOptions,
  machineOptions,
  isProcessesLoading,
  isMachinesLoading,
  hideAddWhenAssembly,
  isAssemblyMode,
  disabled,
}: ProcessRoutesEditorProps) {
  const showAdd = !(hideAddWhenAssembly && isAssemblyMode);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Text strong>Process routes</Text>
        {showAdd ? (
          <Button
            icon={<PlusOutlined />}
            disabled={disabled}
            onClick={() => {
              const current = form.getFieldValue([...absolutePath, "process_routes"]) ?? [];
              form.setFieldValue([...absolutePath, "process_routes"], [
                ...current,
                {
                  op_seq:
                    typeof current?.[current.length - 1]?.op_seq === "number"
                      ? current[current.length - 1].op_seq + 10
                      : (current.length + 1) * 10,
                } satisfies ProcessRouteForm,
              ]);
            }}
          >
            Add process route
          </Button>
        ) : null}
      </div>

      <Form.List name={[...fieldPath, "process_routes"]}>
        {(fields, { remove }) => (
          <div className="space-y-3">
            {fields.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                No process route added.
              </div>
            ) : null}

            {fields.map((field, index) => (
              <div key={field.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Text strong>{`Route ${index + 1}`}</Text>
                  <Button
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    disabled={disabled}
                    onClick={() => remove(field.name)}
                  >
                    Remove
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Form.Item name={[field.name, "op_seq"]} label="Op Seq" rules={[{ required: true, message: "Op Seq is required" }]}>
                    <InputNumber min={1} step={10} className="w-full" />
                  </Form.Item>
                  <Form.Item name={[field.name, "process_id"]} label="Process" rules={[{ required: true, message: "Process is required" }]}>
                    <Select showSearch placeholder="Select process" options={processOptions} loading={isProcessesLoading} optionFilterProp="label" />
                  </Form.Item>
                  <Form.Item name={[field.name, "machine_id"]} label="Machine" rules={[{ required: true, message: "Machine is required" }]}>
                    <Select showSearch placeholder="Select machine" options={machineOptions} loading={isMachinesLoading} optionFilterProp="label" />
                  </Form.Item>
                  <Form.Item name={[field.name, "tooling_type"]} label="Tooling Type">
                    <Select
                      allowClear
                      placeholder="Select tooling type"
                      options={[
                        { label: "Dies", value: "Dies" },
                        { label: "JIG", value: "JIG" },
                        { label: "CF", value: "CF" },
                      ]}
                    />
                  </Form.Item>
                  
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Form.Item name={[field.name, "cycle_time_sec"]} label="Cycle Time (s)">
                    <InputNumber min={0} step={0.1} className="w-full" disabled={disabled} placeholder="detik / pcs" />
                  </Form.Item>
                  <Form.Item name={[field.name, "setup_time_min"]} label="Setup Time (min)">
                    <InputNumber min={0} step={0.1} className="w-full" disabled={disabled} placeholder="menit" />
                  </Form.Item>
                  <Form.Item name={[field.name, "machine_stroke"]} label="Machine Stroke">
                    <Input placeholder="Machine stroke" disabled={disabled} />
                  </Form.Item>
                   <Form.Item name={["material_spec", "cycle_time_sec"]} label="Cycle Time (s)">
            <InputNumber min={0} className="w-full" disabled={disabled} />
          </Form.Item>
                </div>
              </div>
            ))}
          </div>
        )}
      </Form.List>
    </div>
  );
}
