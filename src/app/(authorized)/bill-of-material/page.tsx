"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Table, Tag, Typography, Upload, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BulbOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  RightOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import {
  useDeleteBomChildMutation,
  useDeleteBomParentMutation,
  useGetBomTreeQuery,
  useImportBomMutation,
} from "@/lib/api/bom/api";
import type { BackendBomNode } from "@/lib/api/bom/api";
import { apiBaseUrl, getCookiesFromBrowser } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";

type BomStatus = string;

type UnknownRecord = Record<string, unknown>;

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

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

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
    status: toStatusLabel((isRecord(node) ? node.bom_status : undefined) ?? node.status),
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
  const data = isRecord(json) && "data" in json ? json.data : json;
  const bomId = isRecord(data) ? data.bom_id : undefined;
  if (typeof bomId === "number" && Number.isFinite(bomId)) return String(bomId);
  if (typeof bomId === "string" && bomId.trim()) return bomId.trim();
  return "";
};

export default function BillOfMaterialPage() {
  const router = useRouter();
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [deleteTarget, setDeleteTarget] = useState<BomRow | null>(null);
  const [excelModalOpen, setExcelModalOpen] = useState(false);

  const { data: bomTreeRes, isLoading: isBomLoading, refetch } = useGetBomTreeQuery();
  const [deleteBomParent, { isLoading: isDeletingParent }] = useDeleteBomParentMutation();
  const [deleteBomChild, { isLoading: isDeletingChild }] = useDeleteBomChildMutation();
  const [importBom, importBomState] = useImportBomMutation();

  const bomRows = useMemo(() => {
    const tree = bomTreeRes?.data ?? [];
    return tree.map((n) => mapNodeToRow(n, { level: 0 }));
  }, [bomTreeRes?.data]);

  const expandableParentKeys = bomRows
    .filter((r) => (r.children?.length ?? 0) > 0)
    .map((r) => r.key);

  const handleDelete = async (record: BomRow): Promise<boolean> => {
    try {
      if (record.isParent) {
        const anyId = record.bomId || record.internalId;
        if (!anyId) {
          messageApi.error("Missing bom_id for parent item");
          return false;
        }

        const resolvedBomId = record.bomId || (await fetchBomIdByAnyId(anyId)) || anyId;
        await deleteBomParent({ bom_id: resolvedBomId }).unwrap();
        messageApi.success("Deleted");
        return true;
      }

      if (!record.parentBomId || !record.bomChildId) {
        messageApi.error("Missing bom_id/bom_child_id for child item");
        return false;
      }

      await deleteBomChild({
        bom_id: record.parentBomId,
        bom_child_id: record.bomChildId,
      }).unwrap();
      messageApi.success("Deleted");
      return true;
    } catch {
      messageApi.error("Delete failed");
      return false;
    }
  };

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
              setDeleteTarget(record);
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
            icon={<UploadOutlined />}
            className="flex items-center gap-2"
            onClick={() => setExcelModalOpen(true)}
          >
            Excel Upload
          </Button>
          
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
      <Modal
        open={excelModalOpen}
        title="Bulk Import BOM"
        footer={null}
        onCancel={() => setExcelModalOpen(false)}
        destroyOnHidden
      >
        <div className="mb-3 text-sm text-gray-500">
          Upload file Excel untuk import BOM.
        </div>
        <Upload.Dragger
          name="file"
          accept=".xlsx,.xls"
          multiple={false}
          showUploadList={false}
          disabled={importBomState.isLoading}
          beforeUpload={(file) => {
            const isExcel =
              file.name.toLowerCase().endsWith(".xlsx") ||
              file.name.toLowerCase().endsWith(".xls");

            if (!isExcel) {
              messageApi.error("Please upload an Excel file (.xlsx/.xls)");
              return Upload.LIST_IGNORE;
            }

            importBom(file as File)
              .unwrap()
              .then(async () => {
                messageApi.success(`Imported ${file.name}`);
                setExcelModalOpen(false);
                await refetch();
              })
              .catch((error) => {
                messageApi.error(getApiErrorMessage(error, "BOM import failed"));
              });

            return false;
          }}
        >
          <div className="py-6">
            <UploadOutlined className="text-3xl text-gray-400 mb-3" />
            <div className="text-sm font-semibold text-gray-900">Upload BOM Excel File</div>
            <div className="text-xs text-gray-500 mt-1">
              Drag and drop your Excel file here, or click to browse
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Endpoint: <span className="font-medium">/products/bom/import</span> • form-data key:
              <span className="font-medium"> file</span>
            </div>
            <Button className="mt-4" type="primary" loading={importBomState.isLoading}>
              Choose File
            </Button>
          </div>
        </Upload.Dragger>
      </Modal>
      <Modal
        open={Boolean(deleteTarget)}
        title="Delete BOM item?"
        okText="Delete"
        cancelText="Cancel"
        okButtonProps={{ danger: true, loading: isDeletingParent || isDeletingChild }}
        onCancel={() => setDeleteTarget(null)}
        onOk={async () => {
          if (!deleteTarget) return;
          const deleted = await handleDelete(deleteTarget);
          if (deleted) {
            setDeleteTarget(null);
          }
        }}
        destroyOnHidden
      >
        <p>Delete {deleteTarget?.uniq ?? "this BOM item"}?</p>
      </Modal>
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
