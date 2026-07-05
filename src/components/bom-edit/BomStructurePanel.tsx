"use client";

import { ApartmentOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Typography } from "antd";
import BomTreeNode from "./BomTreeNode";
import type { BomSelectedNodePath, BomTreeNodeItem } from "./bom-edit.types";

const { Text, Title } = Typography;

type BomStructurePanelProps = {
  activeKey: BomSelectedNodePath;
  items: BomTreeNodeItem[];
  rootLabel: string;
  rootUniq: string;
  rootQtyLabel: string;
  disabled?: boolean;
  onSelect: (key: BomSelectedNodePath) => void;
  onAddLevel1Child: () => void;
  onAddChild: (key: BomSelectedNodePath) => void;
  onRemove: (key: BomSelectedNodePath) => void;
};

export default function BomStructurePanel({
  activeKey,
  items,
  rootLabel,
  rootUniq,
  rootQtyLabel,
  disabled,
  onSelect,
  onAddLevel1Child,
  onAddChild,
  onRemove,
}: BomStructurePanelProps) {
  return (
    <aside className="min-w-0 xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
      <Card className="h-full rounded-3xl border-slate-200 shadow-sm" styles={{ body: { padding: 20 } }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Title level={5} className="!mb-1">
              BOM structure
            </Title>
            <Text type="secondary">Select one node to edit at a time</Text>
          </div>
          <Button type="primary" ghost icon={<PlusOutlined />} disabled={disabled} onClick={onAddLevel1Child}>
            Add child
          </Button>
        </div>

        <button
          type="button"
          onClick={() => onSelect("parent")}
          className={`mb-4 block w-full rounded-2xl border px-4 py-4 text-left transition ${
            activeKey === "parent" ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <ApartmentOutlined className="text-slate-500" />
            <span className="font-semibold text-slate-900">{rootLabel}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {rootUniq}
            {rootQtyLabel ? ` • ${rootQtyLabel}` : ""}
          </div>
        </button>

        <div className="space-y-2 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No child components yet.
            </div>
          ) : (
            items.map((item) => (
              <BomTreeNode
                key={item.key}
                item={item}
                activeKey={activeKey}
                disabled={disabled}
                onSelect={onSelect}
                onAddChild={onAddChild}
                onRemove={onRemove}
              />
            ))
          )}
        </div>
      </Card>
    </aside>
  );
}
