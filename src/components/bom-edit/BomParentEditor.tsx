"use client";

import { useMemo } from "react";
import { Alert, Card, Form, Input, InputNumber, Select, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import AssetUploadField from "./AssetUploadField";
import MaterialSpecEditor from "./MaterialSpecEditor";
import ProcessRoutesEditor from "./ProcessRoutesEditor";
import type { ChildPartForm, EditValues } from "./bom-edit.types";

const { TextArea } = Input;
const { Text } = Typography;

type QpuDetailRow = {
  key: string;
  level: number;
  uniq: string;
  partName: string;
  parentUniq: string;
  qpu: number | null;
  uom: string;
};

// Ratakan semua child (semua level) untuk tabel ringkasan QPU.
const flattenQpuRows = (
  nodes: ChildPartForm[] | undefined,
  parentUniq: string,
  level = 1,
  out: QpuDetailRow[] = [],
): QpuDetailRow[] => {
  (Array.isArray(nodes) ? nodes : []).forEach((node, index) => {
    const uniq = String(node?.uniq_code ?? "").trim();
    out.push({
      key: `${level}-${out.length}-${index}`,
      level,
      uniq: uniq || "-",
      partName: String(node?.part_name ?? "").trim() || "-",
      parentUniq: String(node?.parent_uniq_code ?? parentUniq).trim() || "-",
      qpu: typeof node?.qty_per_uniq === "number" ? node.qty_per_uniq : null,
      uom: typeof node?.uom === "string" ? node.uom : node?.uom != null ? String(node.uom) : "",
    });
    flattenQpuRows(node?.children, uniq || parentUniq, level + 1, out);
  });
  return out;
};

const qpuColumns: ColumnsType<QpuDetailRow> = [
  { title: "Level", dataIndex: "level", key: "level", width: 70, render: (v: number) => <Tag>L{v}</Tag> },
  { title: "UNIQ", dataIndex: "uniq", key: "uniq", width: 150 },
  { title: "Part Name", dataIndex: "partName", key: "partName" },
  { title: "Parent UNIQ", dataIndex: "parentUniq", key: "parentUniq", width: 150 },
  {
    title: "QPU",
    dataIndex: "qpu",
    key: "qpu",
    width: 90,
    align: "right",
    render: (v: number | null) => (v != null ? v : "-"),
  },
  { title: "UOM", dataIndex: "uom", key: "uom", width: 90 },
];

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

  // Ringkasan QPU seluruh child di bawah parent ini (read-only).
  const childParts = Form.useWatch("child_parts", form) as ChildPartForm[] | undefined;
  const parentUniq = String(Form.useWatch("parent_uniq", form) ?? "").trim();
  const qpuRows = useMemo(() => flattenQpuRows(childParts, parentUniq), [childParts, parentUniq]);

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
          
          {/* <Form.Item name={["material_spec", "cycle_time_sec"]} label="Cycle Time (s)">
            <InputNumber min={0} className="w-full" disabled={disabled} />
          </Form.Item> */}
 
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

      <Card
        title={
          <div className="flex items-center gap-2">
            <span>QPU Detail</span>
            <Tag>{qpuRows.length} child</Tag>
          </div>
        }
        className="rounded-3xl border-slate-200 shadow-sm"
      >
        <Text type="secondary" className="block mb-3">
          Jumlah tiap child per 1 unit parent{parentUniq ? ` ${parentUniq}` : ""}. Ubah nilainya di panel child yang
          bersangkutan.
        </Text>
        {qpuRows.length === 0 ? (
          <Text type="secondary">Belum ada child.</Text>
        ) : (
          <Table<QpuDetailRow>
            size="small"
            pagination={false}
            rowKey="key"
            dataSource={qpuRows}
            columns={qpuColumns}
            scroll={{ x: 640 }}
          />
        )}
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
