"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Form, Input, Modal, Select, Table, Tag, Typography, Upload, message } from "antd";
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
import { apiBaseUrl } from "@/lib/api/instance";
import { useDeleteBomMutation, useGetBomTreeQuery, useUpdateBomMutation, type BackendBomNode } from "@/lib/api/bom/api";
import { getApiErrorMessage } from "@/lib/api/error";

type BomStatus = "Active" | "Inactive";

type BomRow = {
  key: string;
  apiId?: string;
  uniq: string;
  partName: string;
  partNumber: string;
  imageSrc?: string;
  levelLabel: string;
  qpu: string;
  version: string;
  cadAvailable: boolean;
  status: BomStatus;
  children?: BomRow[];
};

type BomEditFormValues = {
  partName: string;
  partNumber?: string;
  status: BomStatus;
};

const getLevelNumber = (levelLabel: string): number => {
  if (levelLabel === "Parent") return 0;
  const m = /Level\s+(\d+)/i.exec(levelLabel);
  if (!m) return 1;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

const mockBomData: BomRow[] = [
  {
    key: "LV7-001",
    uniq: "LV7-001",
    partName: "Engine Mount Assembly",
    partNumber: "EMA-001-LV7",
    imageSrc: "/mock/bom/engine-mount.svg",
    levelLabel: "Parent",
    qpu: "-",
    version: "-",
    cadAvailable: true,
    status: "Active",
    children: [
      {
        key: "LV7-001-A",
        uniq: "LV7-001-A",
        partName: "Main Bracket",
        partNumber: "MB-001-LV7",
        imageSrc: "/mock/bom/bracket.svg",
        levelLabel: "Level 1",
        qpu: "1 pcs",
        version: "v2.1",
        cadAvailable: true,
        status: "Active",
      },
      {
        key: "LV7-001-B",
        uniq: "LV7-001-B",
        partName: "Rubber Insulator",
        partNumber: "RI-002-LV7",
        imageSrc: "/mock/bom/insulator.svg",
        levelLabel: "Level 1",
        qpu: "2 pcs",
        version: "v1.5",
        cadAvailable: true,
        status: "Active",
      },
      {
        key: "LV7-001-C",
        uniq: "LV7-001-C",
        partName: "Bolt Assembly",
        partNumber: "BA-003-LV7",
        imageSrc: "/mock/bom/bolt.svg",
        levelLabel: "Level 1",
        qpu: "4 pcs",
        version: "v1.2",
        cadAvailable: true,
        status: "Active",
      },
    ],
  },
  {
    key: "LV8-002",
    uniq: "LV8-002",
    partName: "Suspension Arm",
    partNumber: "SA-002-LV8",
    imageSrc: "/mock/bom/suspension.svg",
    levelLabel: "Parent",
    qpu: "-",
    version: "-",
    cadAvailable: true,
    status: "Active",
    children: [],
  },
  {
    key: "LV9-003",
    uniq: "LV9-003",
    partName: "Brake Assembly",
    partNumber: "BRA-003-LV9",
    imageSrc: "/mock/bom/brake.svg",
    levelLabel: "Parent",
    qpu: "-",
    version: "-",
    cadAvailable: true,
    status: "Active",
    children: [],
  },
];

export default function BillOfMaterialPage() {
  const router = useRouter();
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [messageApi, contextHolder] = message.useMessage();

  const useApi = Boolean(apiBaseUrl);
  const {
    data: bomTreeResponse,
    isSuccess: bomTreeSuccess,
    refetch: refetchBomTree,
    isFetching: bomTreeFetching,
  } = useGetBomTreeQuery(undefined, {
    skip: !useApi,
  });

  const [updateBom, { isLoading: updating }] = useUpdateBomMutation();
  const [deleteBom, { isLoading: deleting }] = useDeleteBomMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<BomRow | null>(null);
  const [editForm] = Form.useForm<BomEditFormValues>();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<BomRow | null>(null);

  const apiBase = apiBaseUrl.trim().replace(/\/+$/, "");

  const resolveImageSrc = (raw?: string): string | undefined => {
    const v = String(raw ?? "").trim();
    if (!v || v === "null" || v === "undefined") return undefined;

    const path = v.replace(/\\/g, "/");

    // Keep frontend-served assets as-is
    if (path.startsWith("/mock/") || path.startsWith("mock/")) {
      return path.startsWith("/") ? path : `/${path}`;
    }

    // Keep already-resolved URLs
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) {
      return path;
    }

    // Backend often returns `/uploads/...` or `uploads/...`
    if (!apiBase) {
      return path.startsWith("/") ? path : `/${path}`;
    }

    return `${apiBase}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const normalizeStatus = (v: string | undefined): BomStatus => {
    const s = (v ?? "").toLowerCase();
    return s.includes("inact") ? "Inactive" : "Active";
  };

  const pickBackendImage = (node: BackendBomNode): string | undefined => {
    const candidates = [
      node.image_url,
      (node as unknown as { image?: string }).image,
      (node as unknown as { imageUrl?: string }).imageUrl,
      (node as unknown as { image_path?: string }).image_path,
      (node as unknown as { imagePath?: string }).imagePath,
    ];
    for (const c of candidates) {
      const v = String(c ?? "").trim();
      if (v && v !== "null" && v !== "undefined") return v;
    }
    return undefined;
  };

  const toggleExpanded = (key: React.Key) => {
    setExpandedRowKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const mapNode = (node: BackendBomNode, level: number): BomRow => {
    const apiIdRaw = String(node.id ?? node.uuid ?? node._id ?? "").trim();
    const apiId = apiIdRaw || undefined;
    const uniqRaw = String(node.uniq ?? node.assembly_code ?? apiIdRaw ?? "").trim();
    const uniq = uniqRaw || "-";
    const partName = node.part_name ?? "-";
    const partNumber = node.part_number ?? "-";
    const qpu = level === 0 ? "-" : `${node.qpu ?? 1} pcs`;
    const levelLabel = level === 0 ? "Parent" : `Level ${level}`;
    const imageSrc = resolveImageSrc(pickBackendImage(node));

    return {
      key: apiId ?? uniq,
      apiId,
      uniq,
      partName,
      partNumber,
      imageSrc,
      levelLabel,
      qpu,
      version: node.version ?? "-",
      cadAvailable: Boolean(imageSrc),
      status: normalizeStatus(node.status),
      children: Array.isArray(node.children)
        ? node.children.map((c) => mapNode(c, level + 1))
        : undefined,
    };
  };

  const bomData: BomRow[] =
    useApi && bomTreeSuccess
      ? (bomTreeResponse?.data ?? []).map((n) => mapNode(n, 0))
      : mockBomData;

  const expandableParentKeys = bomData.filter((r) => (r.children?.length ?? 0) > 0).map((r) => r.key);

  const columns: ColumnsType<BomRow> = [
    {
      title: "UNIQ",
      key: "uniq",
      width: 140,
      render: (_: unknown, record: BomRow) => {
        const isParent = record.levelLabel === "Parent";
        const canExpand = (record.children?.length ?? 0) > 0;
        const isExpanded = expandedRowKeys.includes(record.key);
        return (
          <span className="inline-flex items-center gap-1">
            {canExpand ? (
              <button
                type="button"
                className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(record.key);
                }}
                aria-label={isExpanded ? "Collapse row" : "Expand row"}
              >
                <RightOutlined
                  className={
                    isExpanded
                      ? "text-gray-600 rotate-90 transition-transform"
                      : "text-gray-600 transition-transform"
                  }
                />
              </button>
            ) : (
              <span className="inline-block w-6" />
            )}
            <span
              className={
                isParent
                  ? "inline-flex items-center rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                  : "inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700"
              }
            >
              {record.uniq}
            </span>
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
          src={resolveImageSrc(record.imageSrc) ?? "/mock/bom/placeholder.svg"}
          alt={record.partName}
          className="h-10 w-10 rounded-md border border-gray-200 bg-gray-50 object-cover"
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            // prevent infinite loop if placeholder also fails
            img.onerror = null;
            img.src = "/mock/bom/placeholder.svg";
          }}
        />
      ),
    },
    {
      title: "Level",
      key: "level",
      width: 110,
      render: (_: unknown, record: BomRow) => {
        if (record.levelLabel === "Parent") {
          return <Tag color="gold">Parent</Tag>;
        }
        return <Tag color="blue">{record.levelLabel}</Tag>;
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
      render: (_: unknown, record: BomRow) => (
        <Button
          type="default"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            messageApi.info(`Open CAD viewer for ${record.uniq}`);
          }}
        >
          {record.cadAvailable ? "3D Available" : "Not Available"}
        </Button>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_: unknown, record: BomRow) => (
        <Tag color={record.status === "Active" ? "green" : "default"}>
          {record.status}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, record: BomRow) => (
        <div className="flex items-center gap-2">
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={(file) => {
              void uploadRowImage(record, file as File);
              return false;
            }}
          >
            <Button
              type="text"
              icon={<UploadOutlined />}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Upload image for ${record.uniq}`}
            />
          </Upload>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              messageApi.info(`View ${record.uniq}`);
            }}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              if (!useApi) {
                messageApi.info(`Edit ${record.uniq} (mock)`);
                return;
              }

              if (!record.apiId) {
                messageApi.error("Missing BOM id");
                return;
              }

              setEditingRow(record);
              editForm.setFieldsValue({
                partName: record.partName,
                partNumber: record.partNumber === "-" ? "" : record.partNumber,
                status: record.status,
              });
              setEditOpen(true);
            }}
          />
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              if (!useApi) {
                messageApi.info(`Delete ${record.uniq} (mock)`);
                return;
              }

              if (!record.apiId) {
                messageApi.error("Missing BOM id");
                return;
              }

              setDeletingRow(record);
              setDeleteOpen(true);
            }}
          />
        </div>
      ),
    },
  ];

  const closeEdit = () => {
    setEditOpen(false);
    setEditingRow(null);
    editForm.resetFields();
  };

  const saveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      if (!editingRow?.apiId) return;

      await updateBom({
        id: editingRow.apiId,
        body: {
          part_name: values.partName,
          part_number: values.partNumber,
          status: values.status,
        },
      }).unwrap();

      messageApi.success("Updated");
      await refetchBomTree();
      closeEdit();
    } catch (err) {
      messageApi.error(getApiErrorMessage(err, "Failed to update BOM"));
    }
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeletingRow(null);
  };

  const uploadRowImage = async (record: BomRow, file: File) => {
    if (!useApi) {
      messageApi.info("Upload image is available only when API is enabled");
      return;
    }

    if (!record.apiId) {
      messageApi.error("Missing BOM id");
      return;
    }

    try {
      await updateBom({
        id: record.apiId,
        body: { imageFile: file },
      }).unwrap();
      messageApi.success("Image uploaded");
      await refetchBomTree();
    } catch (err) {
      messageApi.error(getApiErrorMessage(err, "Failed to upload image"));
    }
  };

  const confirmDelete = async () => {
    if (!deletingRow?.apiId) return;
    try {
      await deleteBom(deletingRow.apiId).unwrap();
      messageApi.success("Deleted");
      await refetchBomTree();
      closeDelete();
    } catch (err) {
      messageApi.error(getApiErrorMessage(err, "Failed to delete BOM"));
    }
  };

  const editTitle = useMemo(() => {
    if (!editingRow) return "Edit";
    return `Edit ${editingRow.uniq}`;
  }, [editingRow]);

  return (
    <div className="p-6">
      <Modal
        title={editTitle}
        open={editOpen}
        onCancel={closeEdit}
        okText="Save"
        onOk={saveEdit}
        confirmLoading={updating}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-1">UNIQ</div>
            <Input value={editingRow?.uniq ?? ""} disabled />
          </div>
          <Form.Item label="Part Name" name="partName" rules={[{ required: true }]}>
            <Input placeholder="Part name" />
          </Form.Item>
          <Form.Item label="Part Number" name="partNumber">
            <Input placeholder="Part number" />
          </Form.Item>
          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Delete BOM item?"
        open={deleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        confirmLoading={deleting}
        onOk={confirmDelete}
        onCancel={closeDelete}
        destroyOnClose
      >
        <div className="text-gray-700">
          This will delete <span className="font-semibold">{deletingRow?.uniq}</span>.
        </div>
      </Modal>

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
            dataSource={bomData}
            rowKey="key"
            bordered
            loading={useApi ? bomTreeFetching : false}
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
              // Put expand arrow in the UNIQ column (next to the badge)
              showExpandColumn: false,
              // We render the icon ourselves in the UNIQ column.
              expandIcon: () => null,
              indentSize: 56,
            }}
            onRow={(record) => ({
              onClick: () => {
                messageApi.info(`Open CAD viewer for ${record.uniq}`);
              },
            })}
            rowClassName={(record) =>
              record.levelLabel === "Parent" ? "bg-blue-50" : ""
            }
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
