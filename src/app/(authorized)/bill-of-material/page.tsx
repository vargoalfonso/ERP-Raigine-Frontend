"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BulbOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  RightOutlined,
  ScanOutlined,
} from "@ant-design/icons";

import {
  useDeleteBomChildMutation,
  useDeleteBomParentMutation,
  useGetBomTreeQuery,
} from "@/lib/api/bom/api";
import type { BackendBomNode } from "@/lib/api/bom/api";
import { apiBaseUrl, getCookiesFromBrowser } from "@/lib/api/instance";

type BomStatus = string;

type BomRow = {
  key: string;
  uniq: string;
  partName: string;
  partNumber: string;
  imageSrc?: string;
  assetLabel: string;
  assetType: string;
  cadViewable: boolean;
  levelLabel: string;
  isParent: boolean;
  qpu: string;
  version: string;
  status: BomStatus;
  children?: BomRow[];

  bomId?: string;
  internalId?: string;
  parentBomId?: string;
  bomChildId?: string;
};

const toStatusLabel = (value: unknown): BomStatus => {
  const s = typeof value === "string" ? value.trim() : "";
  return s || "-";
};

const statusToColor = (value: string): string => {
  const s = value.trim().toLowerCase();
  if (s === "draft") return "gold";
  if (s === "released") return "green";
  if (s === "obsolete") return "default";
  if (s === "active") return "green";
  if (s === "inactive") return "default";
  return "blue";
};

const mapNodeToRow = (
  node: BackendBomNode,
  opts: { parentBomId?: string; level?: number }
): BomRow => {
  const uniq = String(node.uniq ?? node.uniq_code ?? "").trim();
  const bomId = String(node.bom_id ?? "").trim() || undefined;
  const internalId = String(node.id ?? node.uuid ?? "").trim() || undefined;
  const bomChildId = String(node.bom_child_id ?? "").trim() || undefined;
  const depth = opts.level ?? 0; // 0 = parent, 1 = level 1, 2 = level 2 ...
  const isParent = depth === 0;

  const qpuNumber = typeof node.qpu === "number" && Number.isFinite(node.qpu) ? node.qpu : null;
  const qpu = !isParent && qpuNumber != null ? `${qpuNumber} pcs` : "-";
  const version = typeof node.version === "string" && node.version.trim() ? node.version : "-";
  const imageSrc = typeof node.asset === "string" && node.asset.trim() ? node.asset : node.image_url;
  const assetLabel = node.asset_label || (imageSrc ? "2D Available" : "-");
  const assetType = node.asset_type || "";
  const cadViewable = Boolean(node.cad_viewable);
  const children = Array.isArray(node.children)
    ? node.children.map((c) =>
        mapNodeToRow(c, {
          parentBomId: opts.parentBomId ?? bomId ?? internalId,
          level: depth + 1,
        })
      )
    : undefined;

  return {
    key: uniq || bomId || internalId || bomChildId || crypto.randomUUID(),
    uniq: uniq || "-",
    partName: String(node.part_name ?? "-") || "-",
    partNumber: String(node.part_number ?? "-") || "-",
    imageSrc: imageSrc || undefined,
    assetLabel,
    assetType,
    cadViewable,
    levelLabel: isParent ? "Parent" : `Level ${depth}`,
    isParent,
    qpu,
    version,
    status: toStatusLabel((node as any)?.bom_status ?? node.status),
    children,
    bomId,
    internalId,
    parentBomId: opts.parentBomId,
    bomChildId,
  };
};

const fetchBomIdByAnyId = async (anyId: string): Promise<string> => {
  const token = getCookiesFromBrowser("Authorization");
  if (!apiBaseUrl || !anyId) return "";
  const res = await fetch(`${apiBaseUrl}/products/bom/${encodeURIComponent(anyId)}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return "";
  const json = await res.json().catch(() => null);
  const data = json && typeof json === "object" && (json as any).data ? (json as any).data : json;
  const bomId = data?.bom_id;
  if (typeof bomId === "number" && Number.isFinite(bomId)) return String(bomId);
  if (typeof bomId === "string" && bomId.trim()) return bomId.trim();
  return "";
};

export default function BillOfMaterialPage() {
  const router = useRouter();
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [messageApi, contextHolder] = message.useMessage();

  const { data: bomTreeRes, isLoading: isBomLoading } = useGetBomTreeQuery();
  const [deleteBomParent, { isLoading: isDeletingParent }] = useDeleteBomParentMutation();
  const [deleteBomChild, { isLoading: isDeletingChild }] = useDeleteBomChildMutation();

  const bomRows = useMemo(() => {
    const tree = bomTreeRes?.data ?? [];
    return tree.map((n) => mapNodeToRow(n, { level: 0 }));
  }, [bomTreeRes?.data]);

  const parentCount = bomRows.length;
  const childCount = bomRows.reduce(
    (acc, row) => acc + (row.children?.length ?? 0),
    0
  );
  const expandableParentKeys = bomRows
    .filter((r) => (r.children?.length ?? 0) > 0)
    .map((r) => r.key);

  const columns: ColumnsType<BomRow> = [
    {
      title: "UNIQ",
      key: "uniq",
      width: 140,
      render: (_: unknown, record: BomRow) => {
        return (
          <span
            className={
              record.isParent
                ? "inline-flex items-center rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                : "inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700"
            }
          >
            {record.uniq}
          </span>
        );
      },
    },
    {
      title: "Part Name",
      key: "partName",
      width: 260,
      render: (_: unknown, record: BomRow) => (
        <div className="font-semibold text-gray-900">{record.partName}</div>
      ),
    },
    {
      title: "Part Number",
      key: "partNumber",
      width: 160,
      render: (_: unknown, record: BomRow) => (
        <span className="text-gray-700">{record.partNumber}</span>
      ),
    },
    {
      title: "Image",
      key: "image",
      width: 90,
      render: (_: unknown, record: BomRow) => (
        <img
          src={record.imageSrc ?? "/mock/bom/placeholder.svg"}
          alt={record.partName}
          className="h-10 w-10 rounded-md border border-gray-200 bg-gray-50 object-cover"
          loading="lazy"
        />
      ),
    },
    {
      title: "Level",
      key: "level",
      width: 110,
      render: (_: unknown, record: BomRow) => {
        return <Tag color={record.isParent ? "gold" : "blue"}>{record.levelLabel}</Tag>;
      },
    },
    {
      title: "QPU",
      key: "qpu",
      width: 90,
      render: (_: unknown, record: BomRow) => (
        <span className="text-gray-700">{record.qpu}</span>
      ),
    },
    {
      title: "Version",
      key: "version",
      width: 90,
      render: (_: unknown, record: BomRow) => (
        <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
          {record.version}
        </span>
      ),
    },
    {
      title: "2D/3D CAD",
      key: "cad",
      width: 160,
      render: (_: unknown, record: BomRow) => {
        const hasAsset = record.assetLabel !== "-";
        return (
          <Button
            type={hasAsset ? "default" : "text"}
            size="small"
            icon={<EyeOutlined />}
            disabled={!hasAsset}
            onClick={(e) => {
              e.stopPropagation();
              if (record.cadViewable) {
                messageApi.info(`Open CAD viewer for ${record.uniq}`);
              } else if (record.imageSrc) {
                window.open(record.imageSrc, "_blank");
              }
            }}
          >
            {record.assetLabel}
          </Button>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_: unknown, record: BomRow) => (
        <Tag color={statusToColor(record.status)}>{record.status}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, record: BomRow) => (
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              const targetId = record.isParent
                ? record.bomId || record.internalId
                : record.parentBomId;
              if (!targetId) {
                messageApi.error("Missing BOM id");
                return;
              }
              router.push(`/bill-of-material/${encodeURIComponent(targetId)}`);
            }}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              const targetId = record.isParent
                ? record.bomId || record.internalId
                : record.parentBomId;
              if (!targetId) {
                messageApi.error("Missing BOM id");
                return;
              }
              router.push(
                `/bill-of-material/${encodeURIComponent(targetId)}/edit`
              );
            }}
          />
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              Modal.confirm({
                title: "Delete BOM item?",
                content: `Delete ${record.uniq}?`,
                okText: "Delete",
                okButtonProps: { danger: true },
                cancelText: "Cancel",
                onOk: async () => {
                  try {
                    if (record.isParent) {
                      const anyId = record.bomId || record.internalId;
                      if (!anyId) {
                        messageApi.error("Missing bom_id for parent item");
                        return;
                      }

                      // Ensure we delete by bom_id when possible.
                      const resolvedBomId = record.bomId || (await fetchBomIdByAnyId(anyId)) || anyId;
                      await deleteBomParent({ bom_id: resolvedBomId }).unwrap();
                      messageApi.success("Deleted");
                      return;
                    }

                    if (!record.parentBomId || !record.bomChildId) {
                      messageApi.error("Missing bom_id/bom_child_id for child item");
                      return;
                    }
                    await deleteBomChild({
                      bom_id: record.parentBomId,
                      bom_child_id: record.bomChildId,
                    }).unwrap();
                    messageApi.success("Deleted");
                  } catch (err) {
                    messageApi.error("Delete failed");
                  }
                },
              });
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm mb-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Bill of Material Management
          </h1>
          <p className="text-gray-600">
           Define parent-child structure, process routes, and material specifications per Uniq
          </p>
        </div>
        <div className="flex items-center gap-3">
          
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="flex items-center gap-2"
            onClick={() => router.push("/bill-of-material/create")}
          >
            Add BOM Item
          </Button>
        </div>
      </div>
      {contextHolder}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">BOM Structure</h1>
              <p>Expandable Parent & Child Parts</p>
            </div>
          </div>

          <Typography.Link
            onClick={() => messageApi.info("Tip: Click any row to view CAD")}
            className="text-sm"
          >
            <BulbOutlined /> Click any row to view 3D CAD model
          </Typography.Link>
        </div>

        <div className="px-5 pb-5">
          <Table<BomRow>
            columns={columns}
            dataSource={bomRows}
            rowKey="key"
            bordered
            loading={isBomLoading || isDeletingParent || isDeletingChild}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ["5", "10", "20", "50", "100"],
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} Results`,
            }}
            expandable={{
              expandedRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
              rowExpandable: (record) => (record.children?.length ?? 0) > 0,
              expandIcon: ({ expanded, onExpand, record }) => {
                const canExpand = (record.children?.length ?? 0) > 0;
                if (!canExpand) return <span className="inline-block w-4" />;

                return (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpand(record, e);
                    }}
                    aria-label={expanded ? "Collapse row" : "Expand row"}
                  >
                    <RightOutlined
                      className={
                        expanded
                          ? "text-gray-600 rotate-90 transition-transform"
                          : "text-gray-600 transition-transform"
                      }
                    />
                  </button>
                );
              },
              indentSize: 20,
            }}
            onRow={(record) => ({
              onClick: () => {
                messageApi.info(`Open CAD viewer for ${record.uniq}`);
              },
            })}
              rowClassName={(record) => (record.isParent ? "bg-blue-50" : "")}
            scroll={{ x: "max-content" }}
          />

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setExpandedRowKeys(expandableParentKeys)}
                disabled={expandableParentKeys.length === 0}
              >
                Expand All
              </Button>
              <Button
                onClick={() => setExpandedRowKeys([])}
                disabled={expandedRowKeys.length === 0}
              >
                Collapse All
              </Button>
            </div>
            <div className="text-sm text-gray-500">
              {expandedRowKeys.length} parent items expanded
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
