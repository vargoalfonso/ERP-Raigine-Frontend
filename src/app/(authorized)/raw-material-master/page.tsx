"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DatabaseOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  type RawMaterialMaster,
  type RawMaterialMasterInput,
  useCreateRawMaterialMasterMutation,
  useGetRawMaterialMastersQuery,
  useUpdateRawMaterialMasterMutation,
} from "@/lib/api/raw-material-master/api";
import { getApiErrorMessage } from "@/lib/api/error";
import DateRangeFilter from "@/components/DateRangeFilter";
import ExportExcelButton from "@/components/ExportExcelButton";
import {
  exportRowsToExcel,
  filterByDateRange,
  formatDateTimeForExport,
  pickDateValue,
  type DateRangeValue,
} from "@/lib/utils/dateRange";
import { useLazyGetBomTreeQuery, type BackendBomNode } from "@/lib/api/bom/api";

const number = (value: number | null | undefined) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(
    value ?? 0,
  );

export default function RawMaterialMasterPage() {
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterialMaster | null>(null);
  const [form] = Form.useForm<RawMaterialMasterInput>();
  const masters = useGetRawMaterialMastersQuery({ search, limit: 5000 });
  const [createMaster, createState] = useCreateRawMaterialMasterMutation();
  const [updateMaster, updateState] = useUpdateRawMaterialMasterMutation();
  const [findBomReference, findBomReferenceState] = useLazyGetBomTreeQuery();

  // Filter tanggal diterapkan pada record master sebelum dikelompokkan.
  const dateFilteredMasters = useMemo(
    () =>
      filterByDateRange(masters.data?.items ?? [], dateRange, (r) =>
        pickDateValue(r, ["created_at", "updated_at"]),
      ),
    [masters.data?.items, dateRange],
  );

  const items = useMemo(() => {
    const groups = new Map<
      string,
      RawMaterialMaster & { variants: RawMaterialMaster[] }
    >();
    for (const item of dateFilteredMasters) {
      const key = item.material_name.trim().replace(/\s+/g, " ").toUpperCase();
      const current = groups.get(key);
      if (!current) groups.set(key, { ...item, variants: [item] });
      else {
        current.variants.push(item);
        current.bom_usage_count += item.bom_usage_count ?? 0;
        current.inventory_qty += item.inventory_qty ?? 0;
        if (
          /^RM-\d+$/i.test(current.material_code) &&
          !/^RM-\d+$/i.test(item.material_code)
        ) {
          current.material_code = item.material_code;
          current.id = item.id;
        }
      }
    }
    return Array.from(groups.values());
  }, [dateFilteredMasters]);

  const handleExport = () => {
    const count = exportRowsToExcel(
      dateFilteredMasters.map((r) => ({
        "Material Code": r.material_code,
        "Material Name": r.material_name,
        Grade: r.material_grade ?? r.grade ?? "",
        Form: r.form ?? "",
        Type: r.type_material,
        "Thickness (mm)": r.thickness_mm ?? "",
        "Width (mm)": r.width_mm ?? "",
        "Length (mm)": r.length_mm ?? "",
        "Diameter (mm)": r.diameter_mm ?? "",
        UOM: r.uom ?? "",
        "BOM Links": r.bom_usage_count ?? 0,
        "Stock Pool": r.inventory_qty ?? 0,
        Status: r.status,
        "Created At": formatDateTimeForExport(r.created_at),
        "Updated At": formatDateTimeForExport(r.updated_at),
      })),
      {
        sheetName: "Raw Material Master",
        fileNamePrefix: "raw-material-master",
        range: dateRange,
      },
    );
    if (count === 0) {
      message.warning("Tidak ada data untuk diekspor");
      return;
    }
    message.success(`Berhasil mengekspor ${count} baris`);
  };
  const activeCount = items.filter((item) => item.status === "Active").length;
  const linkedBOMs = items.reduce(
    (sum, item) => sum + (item.bom_usage_count ?? 0),
    0,
  );

  const openBomReference = async (variant: RawMaterialMaster) => {
    try {
      const response = await findBomReference({
        page: 1,
        limit: 50,
        search: variant.material_name,
        type_material: "raw",
      }).unwrap();
      const stack: BackendBomNode[] = [...(response.data?.items ?? [])];
      while (stack.length) {
        const node = stack.shift();
        if (!node) continue;
        const bomId = node.bom_id;
        if (bomId) {
          window.location.assign(
            `/bill-of-material/${encodeURIComponent(String(bomId))}`,
          );
          return;
        }
        if (node.children?.length) stack.push(...node.children);
      }
      message.warning("Referensi BOM tidak ditemukan");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Gagal membuka referensi BOM"));
    }
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ type_material: "raw", status: "Active" });
    setModalOpen(true);
  };

  const openEdit = (record: RawMaterialMaster) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      if (editing)
        await updateMaster({ id: editing.id, body: values }).unwrap();
      else await createMaster(values).unwrap();
      message.success(
        editing ? "Master material diperbarui" : "Master material dibuat",
      );
      setModalOpen(false);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(
        getApiErrorMessage(error, "Gagal menyimpan master material"),
      );
    }
  };

  const masterColumns: ColumnsType<
    RawMaterialMaster & { variants: RawMaterialMaster[] }
  > = useMemo(
    () => [
      {
        title: "Material",
        key: "material",
        fixed: "left",
        width: 260,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{row.material_code}</Typography.Text>
            <Typography.Text type="secondary">
              {row.material_name}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "Grade",
        dataIndex: "material_grade",
        width: 120,
        render: (v) => v || "—",
      },
      { title: "Form", dataIndex: "form", width: 100, render: (v) => v || "—" },
      {
        title: "Dimension (mm)",
        width: 220,
        render: (_, row) =>
          [
            row.thickness_mm && `T ${number(row.thickness_mm)}`,
            row.width_mm && `W ${number(row.width_mm)}`,
            row.length_mm && `L ${number(row.length_mm)}`,
            row.diameter_mm && `Ø ${number(row.diameter_mm)}`,
          ]
            .filter(Boolean)
            .join(" · ") || "—",
      },
      { title: "UOM", dataIndex: "uom", width: 80, render: (v) => v || "—" },
      {
        title: "BOM links",
        dataIndex: "bom_usage_count",
        width: 100,
        align: "right",
      },
      {
        title: "Stock pool",
        dataIndex: "inventory_qty",
        width: 120,
        align: "right",
        render: number,
      },
      {
        title: "Status",
        dataIndex: "status",
        width: 100,
        render: (v) => (
          <Tag color={v === "Active" ? "success" : "default"}>{v}</Tag>
        ),
      },
      {
        title: "",
        width: 90,
        fixed: "right",
        render: (_, row) => (
          <Button type="link" onClick={() => openEdit(row)}>
            Edit
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div style={{ padding: 24, background: "#f9f8f7", minHeight: "100%" }}>
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Raw Material Master
          </Typography.Title>
          <Typography.Text type="secondary">
            Satu spesifikasi material untuk banyak BOM dan satu pool inventory.
          </Typography.Text>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered>
              <Statistic
                title="Master aktif"
                value={activeCount}
                prefix={<DatabaseOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered>
              <Statistic
                title="Relasi spesifikasi BOM"
                value={linkedBOMs}
                prefix={<LinkOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card bordered>
              <Statistic title="Total master" value={items.length} />
            </Card>
          </Col>
        </Row>

        <Card bordered>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Space
              wrap
              style={{ justifyContent: "space-between", width: "100%" }}
            >
              <Input.Search
                allowClear
                placeholder="Cari kode, nama, grade, atau dimensi"
                style={{ width: 360 }}
                onSearch={setSearch}
              />
              <Space wrap>
                <DateRangeFilter value={dateRange} onChange={setDateRange} />
                <ExportExcelButton
                  onClick={handleExport}
                  hasDateRange={dateRange !== null}
                />
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => masters.refetch()}
                >
                  Refresh
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreate}
                >
                  New material
                </Button>
              </Space>
            </Space>
            <Table
              rowKey="id"
              columns={masterColumns}
              dataSource={items}
              loading={masters.isFetching}
              scroll={{ x: 1200 }}
              pagination={{ pageSize: 20 }}
              expandable={{
                expandedRowRender: (record) => (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={record.variants}
                    columns={[
                      { title: "Material code", dataIndex: "material_code" },
                      {
                        title: "Grade",
                        dataIndex: "material_grade",
                        render: (value) => value || "—",
                      },
                      {
                        title: "Form",
                        dataIndex: "form",
                        render: (value) => value || "—",
                      },
                      {
                        title: "Dimensions (mm)",
                        render: (_, variant) =>
                          [
                            variant.thickness_mm &&
                              `T ${number(variant.thickness_mm)}`,
                            variant.width_mm && `W ${number(variant.width_mm)}`,
                            variant.length_mm &&
                              `L ${number(variant.length_mm)}`,
                            variant.diameter_mm &&
                              `Ø ${number(variant.diameter_mm)}`,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—",
                      },
                      {
                        title: "BOM references",
                        render: (_, variant) => (
                          <Button
                            type="link"
                            loading={findBomReferenceState.isFetching}
                            onClick={() => openBomReference(variant)}
                          >
                            {variant.bom_usage_count ?? 0} references
                          </Button>
                        ),
                      },
                    ]}
                  />
                ),
              }}
            />
          </Space>
        </Card>
      </Space>

      <Modal
        title={editing ? "Edit raw material master" : "New raw material master"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        confirmLoading={createState.isLoading || updateState.isLoading}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item
                name="material_code"
                label="Material code"
                rules={[{ required: true }]}
              >
                <Input placeholder="RM-BR60" />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item
                name="material_name"
                label="Material name"
                rules={[{ required: true }]}
              >
                <Input placeholder="BR60 Steel Sheet" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="material_grade" label="Material grade">
                <Input placeholder="BR60" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="form" label="Form">
                <Select
                  allowClear
                  options={[
                    "Plate",
                    "Coil",
                    "Pipe",
                    "Rod",
                    "Wire",
                    "Other",
                  ].map((value) => ({ value, label: value }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="uom" label="UOM">
                <Input placeholder="kg" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="thickness_mm" label="Thickness (mm)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="width_mm" label="Width (mm)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="length_mm" label="Length (mm)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="diameter_mm" label="Diameter (mm)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="weight_kg" label="Weight (kg)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="type_material"
                label="Material type"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { value: "raw", label: "Raw" },
                    { value: "indirect", label: "Indirect" },
                    { value: "subcon", label: "Subcon" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status">
                <Select
                  options={[
                    { value: "Active", label: "Active" },
                    { value: "Inactive", label: "Inactive" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
