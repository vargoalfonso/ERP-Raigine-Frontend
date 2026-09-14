"use client";

import { Card, Checkbox, Form, Input, InputNumber, Select, Tag } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import AssetUploadField from "./AssetUploadField";
import MaterialSpecEditor from "./MaterialSpecEditor";
import ProcessRoutesEditor from "./ProcessRoutesEditor";
import type { FormPath } from "./bom-edit.types";

type ChildEditorProps = {
  form: import("antd").FormInstance;
  fieldPath: FormPath;
  absolutePath: FormPath;
  disabled?: boolean;
  title: string;
  levelLabel: string;
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

export default function BomChildEditor({
  form,
  fieldPath,
  absolutePath,
  disabled,
  title,
  levelLabel,
  existingAssetUrl,
  fileList,
  setFileList,
  processOptions,
  machineOptions,
  isProcessesLoading,
  isMachinesLoading,
  isUomsLoading,
  uomOptions,
}: ChildEditorProps) {
  return (
    <div className="space-y-6">
      <Card title={<div className="flex items-center gap-2"><span>{title}</span><Tag>{levelLabel}</Tag></div>} className="rounded-3xl border-slate-200 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Form.Item name={[...fieldPath, "uniq_code"]} label="UNIQ" rules={[{ required: true, message: "UNIQ is required" }]}>
            <Input disabled={disabled} />
          </Form.Item>
          <Form.Item name={[...fieldPath, "part_name"]} label="Part Name" rules={[{ required: true, message: "Part name is required" }]}>
            <Input disabled={disabled} />
          </Form.Item>
          <Form.Item name={[...fieldPath, "part_number"]} label="Part Number" rules={[{ required: true, message: "Part number is required" }]}>
            <Input disabled={disabled} />
          </Form.Item>
          <Form.Item name={[...fieldPath, "model"]} label="Model">
            <Input disabled={disabled} />
          </Form.Item>
          <Form.Item name={[...fieldPath, "uom"]} label="UOM" rules={[{ required: true, message: "UOM is required" }]}>
            <Select showSearch disabled={disabled} loading={isUomsLoading} options={uomOptions} optionFilterProp="label" />
          </Form.Item>
          <Form.Item name={[...fieldPath, "qty_per_uniq"]} label="Qty per UNIQ" rules={[{ required: true, message: "Qty per UNIQ is required" }]}>
            <InputNumber min={0} className="w-full" disabled={disabled} />
          </Form.Item>
          <Form.Item name={[...fieldPath, "scrap_factor"]} label="Scrap Factor">
            <InputNumber min={0} className="w-full" disabled={disabled} />
          </Form.Item>
          <Form.Item name={[...fieldPath, "is_phantom"]} valuePropName="checked" label=" ">
            <Checkbox disabled={disabled}>Is Phantom</Checkbox>
          </Form.Item>
          <Form.Item name={[...fieldPath, "is_phantom"]} valuePropName="checked" label=" ">
            <Checkbox disabled={disabled}>Is Phantom</Checkbox>
          </Form.Item>
        </div>

        <Form.Item name={[...fieldPath, "asset_id"]} hidden>
          <Input />
        </Form.Item>
        <Form.Item name={[...fieldPath, "asset_url"]} hidden>
          <Input />
        </Form.Item>

        <AssetUploadField
          label="Node image"
          fileList={fileList}
          setFileList={setFileList}
          existingAssetUrl={existingAssetUrl}
          disabled={disabled}
          previewSize="small"
        />
      </Card>

      <Card title="Process routes" className="rounded-3xl border-slate-200 shadow-sm">
        <ProcessRoutesEditor
          form={form}
          fieldPath={fieldPath}
          absolutePath={absolutePath}
          processOptions={processOptions}
          machineOptions={machineOptions}
          isProcessesLoading={isProcessesLoading}
          isMachinesLoading={isMachinesLoading}
          disabled={disabled}
        />
      </Card>

      <Card title="Material specification" className="rounded-3xl border-slate-200 shadow-sm">
        <MaterialSpecEditor fieldPath={fieldPath} disabled={disabled} />
      </Card>
    </div>
  );
}
