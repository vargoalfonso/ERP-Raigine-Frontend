"use client";

import { useEffect, useMemo } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Descriptions, Divider, Spin, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";

import { useGetBomByIdQuery } from "@/lib/api/bom/api";

const { Title, Text } = Typography;

type ProcessRouteRow = {
  key: string;
  op_seq?: number;
  process_name?: string;
  machine_name?: string;
  cycle_time_sec?: number | null;
  setup_time_min?: number | null;
  machine_stroke?: string | null;
  tooling_ref?: string | null;
};

type ChildRow = {
  key: string;
  uniq: string;
  partName: string;
  partNumber: string;
  levelLabel: string;
  status: string;
  imageSrc?: string;
  children?: ChildRow[];
};

const statusToColor = (value: string): string => {
  const s = value.trim().toLowerCase();
  if (s === "draft") return "gold";
  if (s === "released") return "green";
  if (s === "obsolete") return "default";
  if (s === "inactive") return "default";
  if (s === "active") return "green";
  return "blue";
};

const asNumber = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

const asString = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s : undefined;
};

export default function BomDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const [messageApi, contextHolder] = message.useMessage();

  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const queryArg = apiEnabled && id ? id : skipToken;

  const { data, isLoading, error, refetch } = useGetBomByIdQuery(queryArg);

  const bom = (data as any)?.data ?? data;

  const canonicalBomId = useMemo(() => {
    const bomId = (bom as any)?.bom_id;
    if (typeof bomId === "number" && Number.isFinite(bomId)) return String(bomId);
    if (typeof bomId === "string" && bomId.trim()) return bomId.trim();
    return id;
  }, [bom, id]);

  const resolvedBomId = canonicalBomId ?? id ?? "";

  useEffect(() => {
    if (canonicalBomId && id && canonicalBomId !== id) {
      router.replace(`/bill-of-material/${encodeURIComponent(canonicalBomId)}`);
    }
  }, [canonicalBomId, id, router]);

  const processRoutes = useMemo<ProcessRouteRow[]>(() => {
    const routes = (bom as any)?.process_routes;
    if (!Array.isArray(routes)) return [];
    return routes.map((r: any, idx: number) => ({
      key: String(r?.op_seq ?? idx),
      op_seq: asNumber(r?.op_seq),
      process_name: asString(r?.process_name) ?? asString(r?.processName),
      machine_name: asString(r?.machine_name) ?? asString(r?.machineName),
      cycle_time_sec: typeof r?.cycle_time_sec === "number" ? r.cycle_time_sec : null,
      setup_time_min: typeof r?.setup_time_min === "number" ? r.setup_time_min : null,
      machine_stroke: asString(r?.machine_stroke) ?? null,
      tooling_ref: asString(r?.tooling_ref) ?? null,
    }));
  }, [bom]);

  const columns: ColumnsType<ProcessRouteRow> = [
    { title: "Op Seq", dataIndex: "op_seq", key: "op_seq", width: 90 },
    { title: "Process", dataIndex: "process_name", key: "process_name", width: 220 },
    { title: "Machine", dataIndex: "machine_name", key: "machine_name", width: 220 },
    { title: "Cycle (sec)", dataIndex: "cycle_time_sec", key: "cycle_time_sec", width: 120 },
    { title: "Setup (min)", dataIndex: "setup_time_min", key: "setup_time_min", width: 120 },
    { title: "Stroke", dataIndex: "machine_stroke", key: "machine_stroke", width: 140 },
    { title: "Tooling", dataIndex: "tooling_ref", key: "tooling_ref", width: 140 },
  ];

  const assetUrl =
    (typeof (bom as any)?.asset === "string" ? (bom as any).asset : undefined) ||
    (typeof (bom as any)?.image_url === "string" ? (bom as any).image_url : undefined);

  const childRows = useMemo<ChildRow[]>(() => {
    const normalizeStatus = (v: unknown) => {
      const s = typeof v === "string" ? v.trim() : "";
      if (!s) return "Active";
      return s;
    };

    const pickImg = (node: any): string | undefined => {
      if (typeof node?.asset === "string" && node.asset.trim()) return node.asset.trim();
      if (typeof node?.image_url === "string" && node.image_url.trim()) return node.image_url.trim();
      return undefined;
    };

    const walk = (nodes: any[], depth: number): ChildRow[] => {
      return nodes
        .map((n) => {
          const uniq = String(n?.uniq_code ?? n?.uniq ?? "").trim();
          const children = Array.isArray(n?.children) ? walk(n.children, depth + 1) : undefined;
          const id = String(n?.id ?? n?.line_id ?? uniq).trim() || crypto.randomUUID();
          return {
            key: id,
            uniq: uniq || "-",
            partName: String(n?.part_name ?? "-") || "-",
            partNumber: String(n?.part_number ?? "-") || "-",
            levelLabel: `Level ${Math.max(1, depth)}`,
            status: normalizeStatus(n?.bom_status ?? n?.status),
            imageSrc: pickImg(n),
            children: children && children.length ? children : undefined,
          };
        })
        .filter(Boolean);
    };

    const rootChildren = Array.isArray((bom as any)?.children) ? (bom as any).children : [];
    return walk(rootChildren, 1);
  }, [bom]);

  const childColumns: ColumnsType<ChildRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      width: 160,
      render: (v: string, record) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
          {record.uniq}
        </span>
      ),
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      width: 260,
      render: (v: string) => <span className="font-semibold text-gray-900">{v}</span>,
    },
    {
      title: "Part Number",
      dataIndex: "partNumber",
      key: "partNumber",
      width: 160,
    },
    {
      title: "Image",
      dataIndex: "imageSrc",
      key: "image",
      width: 90,
      render: (_: unknown, r: ChildRow) => (
        <img
          src={r.imageSrc ?? "/mock/bom/placeholder.svg"}
          alt={r.partName}
          className="h-10 w-10 rounded-md border border-gray-200 bg-gray-50 object-cover"
          loading="lazy"
        />
      ),
    },
    {
      title: "Level",
      dataIndex: "levelLabel",
      key: "level",
      width: 110,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: string) => (
        <Tag color={statusToColor(v)}>{v}</Tag>
      ),
    },
  ];

  return (
    <div className="p-6">
      {contextHolder}

      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm mb-6">
        <div>
          <Title level={3} className="!mb-0">
            BOM Detail
          </Title>
          <Text type="secondary">/products/bom/{resolvedBomId}</Text>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/bill-of-material")}>
            Back
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => router.push(`/bill-of-material/${encodeURIComponent(resolvedBomId)}/edit`)}
            disabled={!resolvedBomId}
          >
            Edit
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        {isLoading ? (
          <div className="py-8 flex items-center justify-center">
            <Spin />
          </div>
        ) : error ? (
          <div className="py-6">
            <Text type="danger">Failed to load BOM detail.</Text>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => refetch()}>Retry</Button>
              <Button
                onClick={() =>
                  messageApi.info(
                    typeof error === "object" ? JSON.stringify(error) : String(error)
                  )
                }
              >
                Show Error
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <img
                src={assetUrl || "/mock/bom/placeholder.svg"}
                alt={String((bom as any)?.part_name ?? "BOM")}
                className="h-20 w-20 rounded-md border border-gray-200 bg-gray-50 object-cover"
              />
              <div className="flex-1">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="UNIQ">
                    <Text strong>{String((bom as any)?.uniq_code ?? "-")}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    {(() => {
                      const s = String((bom as any)?.bom_status ?? "-");
                      return <Tag color={statusToColor(s)}>{s}</Tag>;
                    })()}
                  </Descriptions.Item>
                  <Descriptions.Item label="Part Name">
                    {String((bom as any)?.part_name ?? "-")}
                  </Descriptions.Item>
                  <Descriptions.Item label="Part Number">
                    {String((bom as any)?.part_number ?? "-")}
                  </Descriptions.Item>
                  <Descriptions.Item label="Version">
                    {String((bom as any)?.version ?? "-")}
                  </Descriptions.Item>
                  <Descriptions.Item label="Description" span={2}>
                    {String((bom as any)?.description ?? "-")}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </div>

            <Divider />

            <Title level={5}>Process Routes</Title>
            <Table<ProcessRouteRow>
              columns={columns}
              dataSource={processRoutes}
              pagination={false}
              size="small"
              scroll={{ x: "max-content" }}
              locale={{ emptyText: "No process routes" }}
            />

            <Divider />

            <Title level={5}>Material Spec</Title>
            <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs overflow-auto">
              {JSON.stringify((bom as any)?.material_spec ?? null, null, 2)}
            </pre>

            <Divider />

            <Title level={5}>Children</Title>
            <Table<ChildRow>
              columns={childColumns}
              dataSource={childRows}
              pagination={false}
              size="small"
              rowKey="key"
              scroll={{ x: "max-content" }}
              locale={{ emptyText: "No children" }}
              expandable={{
                rowExpandable: (r) => (r.children?.length ?? 0) > 0,
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
