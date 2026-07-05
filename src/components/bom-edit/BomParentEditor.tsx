"use client";

import { Alert, Card, Form, Input, Select } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import AssetUploadField from "./AssetUploadField";
import MaterialSpecEditor from "./MaterialSpecEditor";
import ProcessRoutesEditor from "./ProcessRoutesEditor";
import type { EditValues } from "./bom-edit.types";

const { TextArea } = Input;

type ParentEditorProps = {
  form: import("antd").FormInstance<EditValues>;
  disabled?: boolean;
  isAssembly: boolean;
  existingAssetUrl?: string;
  fileList: UploadFile[];
  setFileList: (files: UploadFile[]) => void;
  processOptions: Array<{ value: string | number; label: string; isAssembly: boolean }>;
  machineOptions: Array<{ value: string | number; label: string }>;
  isProcessesLoading?: boolean;
  isMachinesLoading?: boolean;
  isUomsLoading?: boolean;
  uomOptions: Array<{ value: string; label: string; code: string }>;
};

export default function BomParentEditor(props: ParentEditorProps) {
  const {
    form,
    disabled,
    isAssembly,
    existingAssetUrl,
    fileList,
    setFileList,
    processOptions,
    machineOptions,
    isProcessesLoading,
    isMachinesLoading,
    isUomsLoading,
    uomOptions,
  } = props;

  return (
    <div className="space-y-6">
      {isAssembly ? (
        <Alert
          type="info"
          showIcon
          message="Assembly parent"
          description="Parent material stays disabled while process routes remain editable. Child parts must still satisfy the existing minimum requirement during save."
        />
      ) : null}

      <Card title="Overview" className="rounded-3xl border-slate-200 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Form.Item name="parent_uniq" label="Parent UNIQ">
            <Input disabled />
          </Form.Item>
          <Form.Item name="change_note" label="Change Note" rules={[{ required: true, message: "Change note is required" }]}>
            <Input disabled={disabled} placeholder="Describe what changed" />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true, message: "Status is required" }]}>
            <Select disabled={disabled} options={[{ label: "Draft", value: "Draft" }, { label: "Released", value: "Released" }, { label: "Obsolete", value: "Obsolete" }]} />
          </Form.Item>
          <Form.Item name="part_name" label="Part Name" rules={[{ required: true, message: "Part name is required" }]}>
            <Input disabled={disabled} />
          </Form.Item>
          <Form.Item name="part_number" label="Part Number" rules={[{ required: true, message: "Part number is required" }]}>
            <Input disabled={disabled} />
          </Form.Item>
          <Form.Item name="model" label="Model">
            <Input disabled={disabled} />
          </Form.Item>
          <Form.Item name="uom" label="UOM" rules={[{ required: true, message: "UOM is required" }]}>
            <Select showSearch disabled={disabled} loading={isUomsLoading} options={uomOptions} optionFilterProp="label" />
          </Form.Item>
        </div>

        <Form.Item name="asset_id" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="asset_url" hidden>
          <Input />
        </Form.Item>

        <AssetUploadField
          label="Header image"
          fileList={fileList}
          setFileList={setFileList}
          existingAssetUrl={existingAssetUrl}
          disabled={disabled}
        />

        <div className="mt-4">
          <Form.Item name="description" label="Description">
            <TextArea rows={4} disabled={disabled} />
          </Form.Item>
        </div>
      </Card>

      <Card title="Process routes" className="rounded-3xl border-slate-200 shadow-sm">
        <ProcessRoutesEditor
          form={form}
          fieldPath={[]}
          absolutePath={[]}
          processOptions={processOptions}
          machineOptions={machineOptions}
          isProcessesLoading={isProcessesLoading}
          isMachinesLoading={isMachinesLoading}
          hideAddWhenAssembly={false}
          isAssemblyMode={isAssembly}
          disabled={disabled}
        />
      </Card>

      <Card title="Material specification" className="rounded-3xl border-slate-200 shadow-sm">
        <MaterialSpecEditor fieldPath={[]} disabled={disabled || isAssembly} />
      </Card>
    </div>
  );
}
