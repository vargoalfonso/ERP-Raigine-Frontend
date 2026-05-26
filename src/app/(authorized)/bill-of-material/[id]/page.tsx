"use client";

import { useEffect, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  Collapse,
  Descriptions,
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";

import {
  useActivateBomMutation,
  useGetBomFullByIdQuery,
  useGetBomVersionsQuery,
} from "@/lib/api/bom/api";
import { apiBaseUrl } from "@/lib/api/instance";

const { Title, Text } = Typography;

// ─── types ───────────────────────────────────────────────────────────────────

type ToolingRow = {
  tooling_type?: string | null;
  tooling_code?: string | null;
  tooling_name?: string | null;
};

type ProcessRouteRow = {
  key: string;
  op_seq?: number;
  process_name?: string;
  machine_name?: string | null;
  cycle_time_sec?: number | null;
  setup_time_min?: number | null;
  machine_stroke?: string | null;
  toolings: ToolingRow[];
};

type MaterialSpec = {
  material_grade?: string | null;
  form?: string | null;
  width_mm?: number | null;
  diameter_mm?: number | null;
  thickness_mm?: number | null;
  length_mm?: number | null;
  weight_kg?: number | null;
  supplier_name?: string | null;
  cycle_time_sec?: number | null;
  setup_time_min?: number | null;
  customer_cycle?: string | null;
};

type ChildRow = {
  key: string;
  uniq: string;
  partName: string;
  partNumber: string;
  model?: string;
  qpu?: number;
  level: number;
  status: string;
  assetUrl?: string;
  materialSpec?: MaterialSpec | null;
  processRoutes: ProcessRouteRow[];
  children?: ChildRow[];
};

// ─── helpers ─────────────────────────────────────────────────────────────────

const statusToColor = (value: string): string => {
  const s = value.trim().toLowerCase();
  if (s === "draft") return "gold";
  if (s === "released") return "green";
  if (s === "obsolete" || s === "inactive") return "default";
  if (s === "active") return "green";
  return "blue";
};

const asNum = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const asStr = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s || undefined;
};

const resolveUrl = (url: unknown): string | undefined => {
  const raw = typeof url === "string" ? url.trim() : "";
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/uploads/")) return raw;
  if (!apiBaseUrl) return raw;
  return raw.startsWith("/") ? `${apiBaseUrl}${raw}` : `${apiBaseUrl}/${raw}`;
};

const pickAssetUrl = (asset: unknown): string | undefined => {
  if (typeof asset === "string") return resolveUrl(asset);
  if (asset && typeof asset === "object") {
    const url = (asset as any)?.url;
    return resolveUrl(url);
  }
  return undefined;
};

const parseToolings = (raw: unknown): ToolingRow[] => {
  if (Array.isArray(raw)) {
    return raw.map((t: any) => ({
      tooling_type: asStr(t?.tooling_type) ?? null,
      tooling_code: asStr(t?.tooling_code) ?? null,
      tooling_name: asStr(t?.tooling_name) ?? null,
    }));
  }

  if (raw && typeof raw === "object") {
    const route = raw as Record<string, unknown>;
    const fallbackTooling: ToolingRow = {
      tooling_type: asStr(route.tooling_type ?? route.tooling_ref) ?? null,
      tooling_code: asStr(route.tooling_code) ?? null,
      tooling_name: asStr(route.tooling_name) ?? null,
    };

    if (
      fallbackTooling.tooling_type ||
      fallbackTooling.tooling_code ||
      fallbackTooling.tooling_name
    ) {
      return [fallbackTooling];
    }
  }

  return [];
};

const resolveMaterialSpec = (bom: unknown): Record<string, unknown> | null => {
  if (!bom || typeof bom !== "object") return null;
  const record = bom as Record<string, unknown>;

  if (record.material_spec && typeof record.material_spec === "object") {
    return record.material_spec as Record<string, unknown>;
  }

  if (record.material_specifications && typeof record.material_specifications === "object") {
    return record.material_specifications as Record<string, unknown>;
  }

  return null;
};

const parseProcessRoutes = (raw: unknown): ProcessRouteRow[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any, idx: number) => ({
    key: String(r?.route_id ?? r?.op_seq ?? idx),
    op_seq: asNum(r?.op_seq) ?? undefined,
    process_name: asStr(r?.process_name) ?? asStr(r?.processName),
    machine_name: asStr(r?.machine_name) ?? null,
    cycle_time_sec: typeof r?.cycle_time_sec === "number" ? r.cycle_time_sec : null,
    setup_time_min: typeof r?.setup_time_min === "number" ? r.setup_time_min : null,
    machine_stroke: asStr(r?.machine_stroke) ?? null,
    toolings: parseToolings(Array.isArray(r?.toolings) ? r.toolings : r),
  }));
};

const parseMaterialSpec = (raw: unknown): MaterialSpec | null => {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as any;
  return {
    material_grade: asStr(s.material_grade) ?? null,
    form: asStr(s.form) ?? null,
    width_mm: asNum(s.width_mm),
    diameter_mm: asNum(s.diameter_mm),
    thickness_mm: asNum(s.thickness_mm),
    length_mm: asNum(s.length_mm),
    weight_kg: asNum(s.weight_kg),
    supplier_name: asStr(s.supplier_name) ?? null,
    cycle_time_sec: asNum(s.cycle_time_sec),
    setup_time_min: asNum(s.setup_time_min),
    customer_cycle:
      asStr(s.customer_cycle) ??
      asStr(s.customerCycle) ??
      asStr(s.cycle) ??
      asStr(s.cycle_days) ??
      null,
  };
};

// ─── sub-components ──────────────────────────────────────────────────────────

const RouteTable = ({ routes }: { routes: ProcessRouteRow[] }) => {
  const cols: ColumnsType<ProcessRouteRow> = [
    { title: "Op", dataIndex: "op_seq", key: "op_seq", width: 60 },
    { title: "Process", dataIndex: "process_name", key: "process_name", width: 160 },
    { title: "Machine", dataIndex: "machine_name", key: "machine_name", width: 140 },
    { title: "Cycle (s)", dataIndex: "cycle_time_sec", key: "cycle_time_sec", width: 90 },
    { title: "Setup (m)", dataIndex: "setup_time_min", key: "setup_time_min", width: 90 },
    { title: "Stroke", dataIndex: "machine_stroke", key: "machine_stroke", width: 120 },
    {
      title: "Toolings",
      key: "toolings",
      render: (_: unknown, r: ProcessRouteRow) => {
        if (!r.toolings.length) return <Text type="secondary">—</Text>;
        return (
          <div className="space-y-1">
            {r.toolings.map((t, i) => (
              <div key={i} className="text-xs leading-tight">
                <Tag className="mr-1">{t.tooling_type ?? "—"}</Tag>
                <span className="font-mono">{t.tooling_code}</span>
                {t.tooling_name ? <span className="ml-1 text-gray-500">({t.tooling_name})</span> : null}
              </div>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <Table<ProcessRouteRow>
      columns={cols}
      dataSource={routes}
      pagination={false}
      size="small"
      scroll={{ x: "max-content" }}
      locale={{ emptyText: "No process routes" }}
    />
  );
};

const MaterialSpecDesc = ({ spec }: { spec: MaterialSpec | null | undefined }) => {
  if (!spec) return <Text type="secondary">No material spec</Text>;
  const fmt = (v: number | null | undefined, unit?: string) =>
    v != null ? `${v}${unit ? ` ${unit}` : ""}` : "—";

  return (
    <Descriptions size="small" column={{ xs: 2, md: 4 }} bordered>
      <Descriptions.Item label="Grade">{spec.material_grade ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Form">{spec.form ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Supplier">{spec.supplier_name ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Weight">{fmt(spec.weight_kg, "kg")}</Descriptions.Item>
      <Descriptions.Item label="Customer Cycle">{spec.customer_cycle ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Width">{fmt(spec.width_mm, "mm")}</Descriptions.Item>
      <Descriptions.Item label="Diameter">{fmt(spec.diameter_mm, "mm")}</Descriptions.Item>
      <Descriptions.Item label="Thickness">{fmt(spec.thickness_mm, "mm")}</Descriptions.Item>
      <Descriptions.Item label="Length">{fmt(spec.length_mm, "mm")}</Descriptions.Item>
      <Descriptions.Item label="Cycle Time">{fmt(spec.cycle_time_sec, "sec")}</Descriptions.Item>
      <Descriptions.Item label="Setup Time">{fmt(spec.setup_time_min, "min")}</Descriptions.Item>
    </Descriptions>
  );
};

// ─── page ─────────────────────────────────────────────────────────────────────
export default function BomDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const [messageApi, contextHolder] = message.useMessage();
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateForm] = Form.useForm<{ change_note: string }>();

  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const queryArg = apiEnabled && id ? id : skipToken;

  const { data, isLoading, error, refetch } = useGetBomFullByIdQuery(queryArg);
  const { data: versionsRes, isLoading: isVersionsLoading } = useGetBomVersionsQuery(queryArg);
  const [activateBom, activateState] = useActivateBomMutation();

  const bom = (data as any)?.data ?? data;

  const canonicalBomId = useMemo(() => {
    const bomId = (bom as any)?.bom_id;
    if (typeof bomId === "number" && Number.isFinite(bomId)) return String(bomId);
    if (typeof bomId === "string" && bomId.trim()) return bomId.trim();
    return id;
  }, [bom, id]);

  const resolvedBomId = canonicalBomId ?? id ?? "";

  const versionsData = (versionsRes as any)?.data ?? versionsRes;
  const versions = Array.isArray((versionsData as any)?.versions)
    ? ((versionsData as any).versions as Array<any>)
    : [];
  const currentBomIdRaw = (versionsData as any)?.current_bom_id;
  const currentBomId =
    typeof currentBomIdRaw === "number" && Number.isFinite(currentBomIdRaw)
      ? String(currentBomIdRaw)
      : typeof currentBomIdRaw === "string" && currentBomIdRaw.trim()
        ? currentBomIdRaw.trim()
        : "";

  const selectedVersion = useMemo(
    () => versions.find((v) => String(v?.bom_id) === String(resolvedBomId || id || "").trim()),
    [id, resolvedBomId, versions],
  );

  const isLatest = useMemo(() => {
    if (selectedVersion && typeof selectedVersion.is_current === "boolean") {
      return Boolean(selectedVersion.is_current);
    }
    if (currentBomId) return String(resolvedBomId) === String(currentBomId);
    return true;
  }, [currentBomId, resolvedBomId, selectedVersion]);

  useEffect(() => {
    if (canonicalBomId && id && canonicalBomId !== id) {
      router.replace(`/bill-of-material/${encodeURIComponent(canonicalBomId)}`);
    }
  }, [canonicalBomId, id, router]);

  const openActivate = () => {
    activateForm.setFieldsValue({ change_note: "" });
    setActivateOpen(true);
  };

  const submitActivate = async () => {
    try {
      const values = await activateForm.validateFields();
      const change_note = String(values.change_note ?? "").trim();
      if (!change_note || !resolvedBomId) return;
      const res = await activateBom({ bom_id: resolvedBomId, body: { change_note } }).unwrap();
      const nextId =
        (res as any)?.data?.current_bom_id ?? (res as any)?.data?.bom_id ?? currentBomId ?? resolvedBomId;
      setActivateOpen(false);
      messageApi.success("Activated");
      router.push(`/bill-of-material/${encodeURIComponent(String(nextId))}`);
    } catch {
      // antd shows validation errors
    }
  };

  // ── derived data ────────────────────────────────────────────────────────────

  const parentAssetUrl = pickAssetUrl((bom as any)?.asset) ?? pickAssetUrl((bom as any)?.image_url);
  const processRoutes = useMemo(() => parseProcessRoutes((bom as any)?.process_routes), [bom]);
  const materialSpec = useMemo(() => parseMaterialSpec(resolveMaterialSpec(bom)), [bom]);

  const childRows = useMemo<ChildRow[]>(() => {
    const walk = (nodes: any[], depth: number): ChildRow[] =>
      nodes.map((n) => {
        const uniq = asStr(n?.uniq_code) ?? asStr(n?.uniq) ?? "—";
        const rowId = String(n?.id ?? n?.line_id ?? uniq).trim() || crypto.randomUUID();
        const nested = Array.isArray(n?.children) ? walk(n.children, depth + 1) : [];
        return {
          key: rowId,
          uniq,
          partName: asStr(n?.part_name) ?? "—",
          partNumber: asStr(n?.part_number) ?? "—",
          model: asStr(n?.model),
          qpu: asNum(n?.qty_per_uniq) ?? undefined,
          level: depth,
          status: asStr(n?.bom_status ?? n?.status) ?? "—",
          assetUrl: pickAssetUrl(n?.asset) ?? pickAssetUrl(n?.image_url),
          materialSpec: parseMaterialSpec(resolveMaterialSpec(n)),
          processRoutes: parseProcessRoutes(n?.process_routes),
          children: nested.length ? nested : undefined,
        };
      });

    return walk(Array.isArray((bom as any)?.children) ? (bom as any).children : [], 1);
  }, [bom]);

  // ── columns ─────────────────────────────────────────────────────────────────

  const childColumns: ColumnsType<ChildRow> = [
    {
      title: "UNIQ",
      dataIndex: "uniq",
      key: "uniq",
      width: 160,
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
          {v}
        </span>
      ),
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      width: 240,
      render: (v: string) => <span className="font-semibold text-gray-900">{v}</span>,
    },
    { title: "Part Number", dataIndex: "partNumber", key: "partNumber", width: 150 },
    { title: "Product Model", dataIndex: "model", key: "model", width: 120 },
    {
      title: "Qty/UNIQ",
      dataIndex: "qpu",
      key: "qpu",
      width: 90,
      render: (v: number | undefined) => v ?? "—",
    },
    {
      title: "Level",
      dataIndex: "level",
      key: "level",
      width: 90,
      render: (v: number) => <Tag color="blue">Lv {v}</Tag>,
    },
    {
      title: "Image",
      key: "image",
      width: 70,
      render: (_: unknown, r: ChildRow) =>
        r.assetUrl ? (
          <img
            src={r.assetUrl}
            alt={r.partName}
            className="h-9 w-9 rounded border border-gray-200 object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-xs text-gray-300">—</span>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (v: string) => <Tag color={statusToColor(v)}>{v}</Tag>,
    },
  ];

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {contextHolder}

      {/* ── header bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm mb-6 flex-wrap gap-3">
        <div>
          <Title level={3} className="!mb-0">BOM Detail</Title>
          <Text type="secondary">/products/bom/{resolvedBomId}/full</Text>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/bill-of-material")}>
            Back
          </Button>

          <Select
            style={{ minWidth: 200 }}
            loading={isVersionsLoading}
            value={resolvedBomId}
            placeholder="Select version"
            options={versions.map((v) => ({
              value: String(v?.bom_id),
              label: `${v?.label ?? `v${v?.bom_version ?? ""}`} — ${v?.bom_status ?? ""}`.trim(),
            }))}
            onChange={(value) => {
              const bomId = String(value ?? "").trim();
              if (bomId) router.push(`/bill-of-material/${encodeURIComponent(bomId)}`);
            }}
          />

          {!isLatest ? <Tag color="default">Historical</Tag> : <Tag color="green">Latest</Tag>}

          {!isLatest ? (
            <Button onClick={openActivate} loading={activateState.isLoading}>
              Activate
            </Button>
          ) : null}

          <Button
            type="primary"
            icon={<EditOutlined />}
            disabled={!resolvedBomId}
            onClick={() => {
              if (!isLatest) {
                messageApi.warning("Bukan latest version. Pilih latest dulu untuk edit.");
                if (currentBomId) router.push(`/bill-of-material/${encodeURIComponent(currentBomId)}`);
                return;
              }
              router.push(`/bill-of-material/${encodeURIComponent(resolvedBomId)}/edit`);
            }}
          >
            Edit
          </Button>
        </div>
      </div>

      {/* ── activate modal ─────────────────────────────────────────────────── */}
      <Modal
        title="Activate BOM Version"
        open={activateOpen}
        onCancel={() => setActivateOpen(false)}
        onOk={submitActivate}
        okText="Activate"
        confirmLoading={activateState.isLoading}
      >
        <Form form={activateForm} layout="vertical">
          <Form.Item name="change_note" label="Change Note" rules={[{ required: true, message: "Change note is required" }]}>
            <Input.TextArea rows={4} placeholder="e.g. back to version 1" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── main content ───────────────────────────────────────────────────── */}
      <Card>
        {isLoading ? (
          <div className="py-12 flex items-center justify-center"><Spin /></div>
        ) : error ? (
          <div className="py-6">
            <Text type="danger">Failed to load BOM detail.</Text>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => refetch()}>Retry</Button>
              <Button onClick={() => messageApi.info(typeof error === "object" ? JSON.stringify(error) : String(error))}>
                Show Error
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* ── header image + info ──────────────────────────────────────── */}
            <div className="flex items-start gap-5">
              <div className="shrink-0">
                {parentAssetUrl ? (
                  <img
                    src={parentAssetUrl}
                    alt={asStr((bom as any)?.part_name) ?? "BOM"}
                    className="h-24 w-24 rounded-lg border border-gray-200 object-cover"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                    No image
                  </div>
                )}
                {asStr((bom as any)?.asset?.label) && (bom as any)?.asset?.label !== "-" ? (
                  <div className="mt-1 text-center">
                    <Tag color="geekblue" className="text-xs">{(bom as any).asset.label}</Tag>
                  </div>
                ) : null}
              </div>

              <div className="flex-1 min-w-0">
                <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                  <Descriptions.Item label="UNIQ">
                    <Text strong className="font-mono">{asStr((bom as any)?.uniq_code) ?? "—"}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Part Name">
                    <Text strong>{asStr((bom as any)?.part_name) ?? "—"}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Part Number">
                    {asStr((bom as any)?.part_number) ?? "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Product Model">
                    {asStr((bom as any)?.model) ?? "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="UOM">
                    {asStr((bom as any)?.uom) ?? "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Version">
                    {asStr((bom as any)?.version) ?? "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Item Status">
                    {(() => {
                      const s = asStr((bom as any)?.status) ?? "—";
                      return <Tag color={statusToColor(s)}>{s}</Tag>;
                    })()}
                  </Descriptions.Item>
                  <Descriptions.Item label="BOM Status">
                    {(() => {
                      const s = asStr((bom as any)?.bom_status) ?? "—";
                      return <Tag color={statusToColor(s)}>{s}</Tag>;
                    })()}
                  </Descriptions.Item>
                  <Descriptions.Item label="BOM Version">
                    {(bom as any)?.bom_version != null ? `v${(bom as any).bom_version}` : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Change Note" span={3}>
                    {asStr((bom as any)?.change_note) ?? "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Description" span={3}>
                    {asStr((bom as any)?.description) ?? "—"}
                  </Descriptions.Item>
                </Descriptions>

                <div className="flex gap-2 mt-2">
                  {(bom as any)?.is_current === true && <Tag color="green">Current</Tag>}
                  {(bom as any)?.read_only === true && <Tag color="orange">Read Only</Tag>}
                  {(bom as any)?.is_archived === true && <Tag color="default">Archived</Tag>}
                </div>
              </div>
            </div>

            <Divider />

            {/* ── process routes ───────────────────────────────────────────── */}
            <Title level={5} className="!mb-3">Process Routes</Title>
            <RouteTable routes={processRoutes} />

            <Divider />

            {/* ── material spec ────────────────────────────────────────────── */}
            <Title level={5} className="!mb-3">Material Spec</Title>
            <MaterialSpecDesc spec={materialSpec} />

            <Divider />

            {/* ── children ─────────────────────────────────────────────────── */}
            <Title level={5} className="!mb-3">
              Children
              {childRows.length ? (
                <Text type="secondary" className="ml-2 text-sm font-normal">
                  ({childRows.length} level-1 part{childRows.length !== 1 ? "s" : ""})
                </Text>
              ) : null}
            </Title>

            <Table<ChildRow>
              columns={childColumns}
              dataSource={childRows}
              pagination={false}
              size="small"
              rowKey="key"
              scroll={{ x: "max-content" }}
              locale={{ emptyText: "No children" }}
              expandable={{
                rowExpandable: (r) =>
                  (r.children?.length ?? 0) > 0 ||
                  (r.processRoutes?.length ?? 0) > 0 ||
                  r.materialSpec != null,
                expandedRowRender: (r) => (
                  <div className="px-2 py-3 space-y-4 bg-gray-50 rounded">
                    {/* nested children */}
                    {r.children && r.children.length > 0 ? (
                      <div>
                        <Text strong className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
                          Sub-children
                        </Text>
                        <Table<ChildRow>
                          columns={childColumns}
                          dataSource={r.children}
                          pagination={false}
                          size="small"
                          rowKey="key"
                          scroll={{ x: "max-content" }}
                          expandable={{
                            rowExpandable: (c) =>
                              (c.processRoutes?.length ?? 0) > 0 || c.materialSpec != null,
                            expandedRowRender: (c) => (
                              <div className="px-2 py-3 space-y-4 bg-white rounded">
                                {c.processRoutes.length > 0 ? (
                                  <Collapse
                                    size="small"
                                    items={[{
                                      key: "routes",
                                      label: <Text strong>Process Routes ({c.processRoutes.length})</Text>,
                                      children: <RouteTable routes={c.processRoutes} />,
                                    }]}
                                  />
                                ) : null}
                                <Collapse
                                  size="small"
                                  items={[{
                                    key: "spec",
                                    label: <Text strong>Material Spec</Text>,
                                    children: <MaterialSpecDesc spec={c.materialSpec} />,
                                  }]}
                                />
                              </div>
                            ),
                          }}
                        />
                      </div>
                    ) : null}

                    {/* process routes for this child */}
                    {r.processRoutes.length > 0 ? (
                      <Collapse
                        size="small"
                        items={[{
                          key: "routes",
                          label: <Text strong>Process Routes ({r.processRoutes.length})</Text>,
                          children: <RouteTable routes={r.processRoutes} />,
                        }]}
                      />
                    ) : null}

                    {/* material spec for this child */}
                    <Collapse
                      size="small"
                      items={[{
                        key: "spec",
                        label: <Text strong>Material Spec</Text>,
                        children: <MaterialSpecDesc spec={r.materialSpec} />,
                      }]}
                    />
                  </div>
                ),
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
