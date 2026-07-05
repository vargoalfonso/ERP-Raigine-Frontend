"use client";

import {
  DeleteOutlined,
  FileImageOutlined,
  NodeExpandOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Tag, Tooltip, Typography } from "antd";
import type { BomSelectedNodePath, BomTreeNodeItem } from "./bom-edit.types";

const { Text } = Typography;

type BomTreeNodeProps = {
  item: BomTreeNodeItem;
  activeKey: BomSelectedNodePath;
  disabled?: boolean;
  onSelect: (key: BomSelectedNodePath) => void;
  onAddChild: (key: BomSelectedNodePath) => void;
  onRemove: (key: BomSelectedNodePath) => void;
};

const RAIL_WIDTH = 22; // px per hierarchy column

export default function BomTreeNode({ item, activeKey, disabled, onSelect, onAddChild, onRemove }: BomTreeNodeProps) {
  const active = item.key === activeKey;

  return (
    <div className="relative flex items-stretch">
      {/* Ancestor guide rails: a vertical line continues only when that ancestor still has siblings below. */}
      {item.ancestorLasts.map((ancestorLast, i) => (
        <span key={i} className="relative shrink-0" style={{ width: RAIL_WIDTH }} aria-hidden>
          {!ancestorLast ? (
            <span className="absolute left-1/2 -top-2 -bottom-2 w-px bg-slate-200" />
          ) : null}
        </span>
      ))}

      {/* Own connector column: elbow into this node (└ when last sibling, ├ otherwise). */}
      <span className="relative shrink-0" style={{ width: RAIL_WIDTH }} aria-hidden>
        <span className="absolute left-1/2 -top-2 h-[calc(50%+0.5rem)] w-px bg-slate-200" />
        {!item.isLast ? <span className="absolute left-1/2 top-1/2 -bottom-2 w-px bg-slate-200" /> : null}
        <span className="absolute left-1/2 right-1 top-1/2 h-px bg-slate-200" />
      </span>

      <div
        className={`min-w-0 flex-1 rounded-2xl border px-3 py-3 transition ${
          active ? "border-sky-300 bg-sky-50" : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(item.key)}>
          <div className="flex flex-wrap items-center gap-2">
            <Text strong className="truncate text-slate-900">
              {item.label}
            </Text>
            <Tag>{item.levelLabel}</Tag>
            {item.childCount > 0 ? <Tag color="purple">{item.childCount} child</Tag> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{item.uniqCode}</span>
            {item.qtyLabel ? <span>• {item.qtyLabel}</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {item.assetUrl ? (
              <Tooltip title="Has image">
                <FileImageOutlined />
              </Tooltip>
            ) : null}
            {item.hasRoutes ? (
              <Tooltip title="Has process routes">
                <NodeExpandOutlined />
              </Tooltip>
            ) : null}
            {item.hasMaterialSpec ? (
              <Tooltip title="Has material spec">
                <SettingOutlined />
              </Tooltip>
            ) : null}
          </div>
        </button>

        <div className="flex items-center gap-1">
          <Button type="text" size="small" icon={<PlusOutlined />} disabled={disabled} onClick={() => onAddChild(item.key)} />
          <Button danger type="text" size="small" icon={<DeleteOutlined />} disabled={disabled} onClick={() => onRemove(item.key)} />
        </div>
      </div>
      </div>
    </div>
  );
}
