"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Table, Tag, Typography, message } from "antd";
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

type BomStatus = "Active" | "Inactive";

type BomRow = {
  key: string;
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

const bomData: BomRow[] = [
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

  const parentCount = bomData.length;
  const childCount = bomData.reduce(
    (acc, row) => acc + (row.children?.length ?? 0),
    0
  );
  const expandableParentKeys = bomData
    .filter((r) => (r.children?.length ?? 0) > 0)
    .map((r) => r.key);

  const columns: ColumnsType<BomRow> = [
    {
      title: "UNIQ",
      key: "uniq",
      width: 140,
      render: (_: unknown, record: BomRow) => {
        const isParent = record.levelLabel === "Parent";
        return (
          <span
            className={
              isParent
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
              messageApi.info(`Edit ${record.uniq}`);
            }}
          />
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              messageApi.info(`Delete ${record.uniq}`);
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
            dataSource={bomData}
            rowKey="key"
            bordered
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
