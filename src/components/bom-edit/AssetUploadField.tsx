"use client";

import { Button, Typography, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";

const { Text } = Typography;

type AssetUploadFieldProps = {
  label: string;
  fileList: UploadFile[];
  setFileList: (files: UploadFile[]) => void;
  existingAssetUrl?: string;
  disabled?: boolean;
  previewSize?: "small" | "default";
};

export default function AssetUploadField({
  label,
  fileList,
  setFileList,
  existingAssetUrl,
  disabled,
  previewSize = "default",
}: AssetUploadFieldProps) {
  const imageClass =
    previewSize === "small"
      ? "h-14 w-14 rounded-xl border border-slate-200 object-cover"
      : "h-20 w-20 rounded-xl border border-slate-200 object-cover";

  return (
    <div className="space-y-2">
      <Text className="block text-sm font-medium text-slate-700">{label}</Text>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <Upload
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: next }) => setFileList(next)}
          maxCount={1}
          disabled={disabled}
        >
          <Button icon={<UploadOutlined />} disabled={disabled}>
            Choose File
          </Button>
        </Upload>

        {existingAssetUrl ? (
          <a href={existingAssetUrl} target="_blank" rel="noreferrer" className="inline-flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={existingAssetUrl} alt="Current asset" className={imageClass} />
            <span className="text-xs text-sky-600">View current</span>
          </a>
        ) : (
          <Text type="secondary">No existing asset</Text>
        )}
      </div>
    </div>
  );
}
