"use client";

import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Tag, Typography } from "antd";

const { Title, Text } = Typography;

type BomEditHeaderProps = {
  titlePartName: string;
  resolvedBomId: string;
  status?: string;
  isLatest: boolean;
  isSaving?: boolean;
  disabled?: boolean;
  onBack: () => void;
  onSave: () => void;
};

export default function BomEditHeader({
  titlePartName,
  resolvedBomId,
  status,
  isLatest,
  isSaving,
  disabled,
  onBack,
  onSave,
}: BomEditHeaderProps) {
  return (
    <div className="sticky top-0 z-20 mb-6 border-b border-slate-200 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80">
      <div className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={onBack} disabled={!resolvedBomId} />
          <div className="min-w-0">
            <Title level={3} className="!mb-1">
              Edit BOM
            </Title>
            <div className="flex flex-wrap items-center gap-2">
              <Text className="truncate text-sm text-slate-700">{titlePartName || "Unnamed BOM"}</Text>
              <Tag color="blue">BOM #{resolvedBomId}</Tag>
              <Tag color={isLatest ? "green" : "gold"}>{isLatest ? "Latest" : "Historical"}</Tag>
              {status ? <Tag>{status}</Tag> : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto">
          <Button type="primary" icon={<SaveOutlined />} loading={isSaving} onClick={onSave} disabled={disabled}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
