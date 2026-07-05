"use client";

import { Card, Empty } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import BomChildEditor from "./BomChildEditor";
import BomParentEditor from "./BomParentEditor";
import type { BomSelectedNodePath, EditValues, FormPath } from "./bom-edit.types";

type BomDetailPanelProps = {
  selectedNodeKey: BomSelectedNodePath;
  selectedChildPath?: FormPath;
  selectedChildLabel?: string;
  selectedChildLevelLabel?: string;
  form: import("antd").FormInstance<EditValues>;
  disabled?: boolean;
  isParentAssembly: boolean;
  existingParentAssetUrl?: string;
  parentFileList: UploadFile[];
  setParentFileList: (files: UploadFile[]) => void;
  selectedChildAssetUrl?: string;
  selectedChildFileList: UploadFile[];
  setSelectedChildFileList: (files: UploadFile[]) => void;
  processOptions: Array<{ value: string | number; label: string; isAssembly: boolean }>;
  machineOptions: Array<{ value: string | number; label: string }>;
  isProcessesLoading?: boolean;
  isMachinesLoading?: boolean;
  isUomsLoading?: boolean;
  uomOptions: Array<{ value: string; label: string; code: string }>;
};

export default function BomDetailPanel(props: BomDetailPanelProps) {
  const {
    selectedNodeKey,
    selectedChildPath,
    selectedChildLabel,
    selectedChildLevelLabel,
    form,
    disabled,
    isParentAssembly,
    existingParentAssetUrl,
    parentFileList,
    setParentFileList,
    selectedChildAssetUrl,
    selectedChildFileList,
    setSelectedChildFileList,
    processOptions,
    machineOptions,
    isProcessesLoading,
    isMachinesLoading,
    isUomsLoading,
    uomOptions,
  } = props;

  if (selectedNodeKey === "parent") {
    return (
      <BomParentEditor
        form={form}
        disabled={disabled}
        isAssembly={isParentAssembly}
        existingAssetUrl={existingParentAssetUrl}
        fileList={parentFileList}
        setFileList={setParentFileList}
        processOptions={processOptions}
        machineOptions={machineOptions}
        isProcessesLoading={isProcessesLoading}
        isMachinesLoading={isMachinesLoading}
        isUomsLoading={isUomsLoading}
        uomOptions={uomOptions}
      />
    );
  }

  if (!selectedChildPath) {
    return (
      <Card className="rounded-3xl border-slate-200 shadow-sm">
        <Empty description="Select a BOM node from the structure panel" />
      </Card>
    );
  }

  return (
    <BomChildEditor
      form={form}
      fieldPath={selectedChildPath}
      absolutePath={selectedChildPath}
      disabled={disabled}
      title={selectedChildLabel || "Child node"}
      levelLabel={selectedChildLevelLabel || "L1"}
      existingAssetUrl={selectedChildAssetUrl}
      fileList={selectedChildFileList}
      setFileList={setSelectedChildFileList}
      processOptions={processOptions}
      machineOptions={machineOptions}
      isProcessesLoading={isProcessesLoading}
      isMachinesLoading={isMachinesLoading}
      isUomsLoading={isUomsLoading}
      uomOptions={uomOptions}
    />
  );
}
