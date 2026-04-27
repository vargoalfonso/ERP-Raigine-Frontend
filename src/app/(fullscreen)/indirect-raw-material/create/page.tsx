"use client";

import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  SaveOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { FormInstance } from "antd";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { useCreateInventoryMutation } from "@/lib/api/inventory/api";
import { useListProcurementDnsQuery } from "@/lib/api/procurement-dn/api";
import { useListProcurementPosQuery, type ProcurementPoRecord } from "@/lib/api/procurement-po/api";
import { useListWarehousesQuery, type WarehouseRecord } from "@/lib/api/warehouse/api";

const { Title, Text } = Typography;

type IndirectRawMaterialFormData = {
  uniq?: string;
  partNumber?: string;
  partName?: string;
  model?: string;
  warehouseDestination?: string;
  poNumber?: string;
  deliveryNotesNumber?: string;
  addStock?: number;
};

type FormEntry = {
  id: number;
  key: string;
  formRef: MutableRefObject<FormInstance<IndirectRawMaterialFormData> | null>;
};

type SelectOption = { label: string; value: string };

type DnLite = {
  dn_number?: string;
  po_number?: string;
  items: Array<{ item_uniq_code?: string }>;
};

const getPoUniq = (po: ProcurementPoRecord | undefined): string | undefined => {
  if (!po) return undefined;
  if (po.uniq_code) return po.uniq_code;
  const firstItem = Array.isArray(po.items) ? po.items[0] : undefined;
  if (!firstItem || typeof firstItem !== "object" || firstItem === null) return undefined;
  const record = firstItem as Record<string, unknown>;
  return typeof record.uniq_code === "string"
    ? record.uniq_code
    : typeof record.item_uniq_code === "string"
      ? record.item_uniq_code
      : typeof record.uniq === "string"
        ? record.uniq
        : undefined;
};

const IndirectRawMaterialFormCard = ({
  entryNumber,
  formRef,
  showRemove,
  onRemove,
  uniqOptions,
  warehouseOptions,
  poOptions,
  dnOptions,
  bomIndex,
  procurementPos,
  procurementDns,
}: {
  entryNumber: number;
  formRef: MutableRefObject<FormInstance<IndirectRawMaterialFormData> | null>;
  showRemove: boolean;
  onRemove: () => void;
  uniqOptions: SelectOption[];
  warehouseOptions: SelectOption[];
  poOptions: SelectOption[];
  dnOptions: SelectOption[];
  bomIndex: ReturnType<typeof buildBomUniqIndex>;
  procurementPos: ProcurementPoRecord[];
  procurementDns: DnLite[];
}) => {
  const [form] = Form.useForm<IndirectRawMaterialFormData>();

  useEffect(() => {
    formRef.current = form;
  }, [form, formRef]);

  const fillUniq = (uniq?: string) => {
    if (!uniq) return;
    form.setFieldsValue({
      uniq,
      partNumber: bomIndex.partNumberByUniq[uniq] ?? "",
      partName: bomIndex.partNameByUniq[uniq] ?? "",
      model: bomIndex.modelByUniq[uniq] ?? bomIndex.assemblyCodeByUniq[uniq] ?? "",
    });
  };

  const onSelectPo = (poNumber: string) => {
    const po = procurementPos.find((item) => item.po_number === poNumber);
    const uniq = getPoUniq(po);
    const relatedDn = procurementDns.find((item) => item.po_number === poNumber);

    form.setFieldsValue({
      poNumber,
      deliveryNotesNumber: relatedDn?.dn_number,
    });

    fillUniq(uniq);
  };

  const onSelectDn = (dnNumber: string) => {
    const dn = procurementDns.find((item) => item.dn_number === dnNumber);
    const uniq = dn?.items?.[0]?.item_uniq_code;

    form.setFieldsValue({
      deliveryNotesNumber: dnNumber,
      poNumber: dn?.po_number,
    });

    fillUniq(uniq);
  };

  return (
    <Card>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <Title level={4} className="!mb-0">
            Add Indirect Raw Material #{entryNumber}
          </Title>
          <div className="flex items-center gap-2">
            <Text className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm">
              Entry {entryNumber}
            </Text>
            {showRemove && (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={onRemove}
                size="small"
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        <p className="text-gray-500">Add indirect raw material entry</p>
      </div>

      <Form form={form} layout="vertical">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item
            label="PO Number"
            name="poNumber"
            rules={[{ required: true, message: "Please select PO Number!" }]}
          >
            <Select
              placeholder="Select PO from procurement"
              size="large"
              allowClear
              options={poOptions}
              onChange={onSelectPo}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            label="Delivery Notes Number"
            name="deliveryNotesNumber"
            rules={[{ required: true, message: "Please select delivery notes!" }]}
          >
            <Select
              placeholder="Select DN number"
              size="large"
              allowClear
              options={dnOptions}
              onChange={onSelectDn}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            label="Uniq"
            name="uniq"
            rules={[{ required: true, message: "Please select uniq!" }]}
          >
            <Select
              placeholder="Select UNIQ from BOM"
              size="large"
              allowClear
              options={uniqOptions}
              onChange={fillUniq}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            label="Warehouse Destination"
            name="warehouseDestination"
            rules={[{ required: true, message: "Please select warehouse!" }]}
          >
            <Select
              placeholder="Select warehouse destination"
              size="large"
              allowClear
              options={warehouseOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item
            label="Part Number"
            name="partNumber"
            rules={[{ required: true, message: "Please input part number!" }]}
          >
            <Input placeholder="Auto-filled from BOM / PO / DN" size="large" disabled />
          </Form.Item>

          <Form.Item
            label="Part Name"
            name="partName"
            rules={[{ required: true, message: "Please input part name!" }]}
          >
            <Input placeholder="Auto-filled from BOM / PO / DN" size="large" disabled />
          </Form.Item>

          <Form.Item label="Model" name="model">
            <Input placeholder="Auto-filled from BOM / UNIQ" size="large" disabled />
          </Form.Item>

          <Form.Item
            label="Add Stock"
            name="addStock"
            rules={[{ required: true, message: "Please input stock!" }]}
          >
            <InputNumber
              placeholder="10,000"
              size="large"
              style={{ width: "100%" }}
              min={0}
            />
          </Form.Item>
        </div>
      </Form>
    </Card>
  );
};

export default function CreateIndirectRawMaterialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<FormEntry[]>([]);
  const [createInventory] = useCreateInventoryMutation();
  const apiEnabled = Boolean(apiBaseUrl);

  const bomTreeQuery = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const warehousesQuery = useListWarehousesQuery(undefined, { skip: !apiEnabled });
  const procurementPosQuery = useListProcurementPosQuery({ po_type: "indirect" }, { skip: !apiEnabled });
  const procurementDnsQuery = useListProcurementDnsQuery(undefined, { skip: !apiEnabled });

  const bomIndex = useMemo(() => buildBomUniqIndex(bomTreeQuery.data?.data ?? []), [bomTreeQuery.data]);

  const uniqOptions = useMemo<SelectOption[]>(
    () =>
      bomIndex.uniqs.map((uniq) => ({
        value: uniq,
        label: bomIndex.partNameByUniq[uniq] ? `${uniq} — ${bomIndex.partNameByUniq[uniq]}` : uniq,
      })),
    [bomIndex.partNameByUniq, bomIndex.uniqs]
  );

  const warehouseOptions = useMemo<SelectOption[]>(
    () =>
      (warehousesQuery.data ?? [])
        .map((warehouse: WarehouseRecord) => ({
          value: warehouse.warehouse_name ?? warehouse.id ?? "",
          label: warehouse.type_warehouse
            ? `${warehouse.warehouse_name ?? warehouse.id ?? "-"} — ${warehouse.type_warehouse}`
            : warehouse.warehouse_name ?? warehouse.id ?? "-",
        }))
        .filter((item) => Boolean(item.value)),
    [warehousesQuery.data]
  );

  const procurementPos = procurementPosQuery.data?.data ?? [];
  const poOptions = useMemo<SelectOption[]>(
    () =>
      procurementPos
        .filter((po) => Boolean(po.po_number))
        .map((po) => ({
          value: po.po_number ?? "",
          label: po.supplier_name ? `${po.po_number} — ${po.supplier_name}` : po.po_number ?? "",
        })),
    [procurementPos]
  );

  const procurementDns = useMemo<DnLite[]>(
    () =>
      (procurementDnsQuery.data?.data ?? [])
        .filter((dn) => dn.type === "IRM")
        .map((dn) => ({
          dn_number: dn.dn_number,
          po_number: dn.po_number,
          items: (dn.items ?? []).map((item) => ({ item_uniq_code: item.item_uniq_code })),
        })),
    [procurementDnsQuery.data]
  );

  const dnOptions = useMemo<SelectOption[]>(
    () =>
      procurementDns
        .filter((dn) => Boolean(dn.dn_number))
        .map((dn) => ({
          value: dn.dn_number ?? "",
          label: dn.po_number ? `${dn.dn_number} — ${dn.po_number}` : dn.dn_number ?? "",
        })),
    [procurementDns]
  );

  useEffect(() => {
    if (entries.length === 0) {
      setEntries([{ id: 1, key: "entry-1", formRef: { current: null } }]);
    }
  }, [entries.length]);

  const completeCount = useMemo(() => {
    return entries.filter((e) => {
      const form = e.formRef.current;
      if (!form) return false;
      const v = form.getFieldsValue();
      return (
        v.uniq &&
        v.partNumber &&
        v.partName &&
        v.warehouseDestination &&
        v.poNumber &&
        v.deliveryNotesNumber &&
        typeof v.addStock === "number"
      );
    }).length;
  }, [entries]);

  const addEntry = () => {
    const nextId = entries.length + 1;
    setEntries((prev) => [
      ...prev,
      { id: nextId, key: `entry-${nextId}`, formRef: { current: null } },
    ]);
  };

  const removeEntry = (id: number) => {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const saveAll = async () => {
    setLoading(true);
    try {
      for (const entry of entries) {
        const form = entry.formRef.current;
        if (!form) continue;
        await form.validateFields();
        const values = form.getFieldsValue();
        await createInventory({
          type: "indirect-materials",
          body: {
            uniq_code: String(values.uniq ?? ""),
            raw_material_type: "Indirect",
            rm_source: [values.poNumber, values.deliveryNotesNumber].filter(Boolean).join(" / "),
            warehouse_location: String(values.warehouseDestination ?? ""),
            stock_qty: Number(values.addStock ?? 0),
            part_name: String(values.partName ?? ""),
            part_number: String(values.partNumber ?? ""),
          },
        }).unwrap();
      }

      message.success("Indirect raw material saved");
      router.push("/indirect-raw-materials");
    } catch (error) {
      message.error((error as { data?: { message?: string } })?.data?.message || "Please complete all required fields");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 justify-center pb-32">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="border-r border-gray-300">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push("/indirect-raw-materials")}
                className="flex items-center gap-2"
                type="text"
              >
                Back to Indirect Raw Material Database
              </Button>
            </div>
            <div>
              <Title level={3} className="!mb-0">
                Add Indirect Raw Material
              </Title>
              <Text className="text-gray-500">
                Create Raw Material Database • Indirect
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => router.push("/indirect-raw-materials")}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={loading}
              onClick={saveAll}
            >
              Save Raw Material
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mx-auto w-full max-w-6xl">
          {entries.map((entry, index) => (
            <div
              key={entry.key}
              className={index !== entries.length - 1 ? "mb-12" : ""}
            >
              <IndirectRawMaterialFormCard
                entryNumber={entry.id}
                formRef={entry.formRef}
                showRemove={entries.length > 1}
                onRemove={() => removeEntry(entry.id)}
                uniqOptions={uniqOptions}
                warehouseOptions={warehouseOptions}
                poOptions={poOptions}
                dnOptions={dnOptions}
                bomIndex={bomIndex}
                procurementPos={procurementPos}
                procurementDns={procurementDns}
              />
            </div>
          ))}

          <div className="text-center my-6">
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              size="large"
              onClick={addEntry}
              className="w-full max-w-md"
            >
              Add Another Indirect Raw Material
            </Button>
          </div>
        </div>
      </div>

      <Card
        className="mt-6"
        style={{
          position: "fixed",
          left: 0,
          bottom: 0,
          width: "100vw",
          maxWidth: "100vw",
          zIndex: 50,
          borderRadius: 0,
          boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
          margin: 0,
          padding: 0,
        }}
        styles={{ body: { padding: "16px 48px" } }}
      >
        <div className="flex items-center justify-between">
          <div>
            <Title level={5} className="!mb-1">
              Summary
            </Title>
            <Text className="text-gray-600">
              {entries.length} Indirect Raw Material Entry ready to be saved
            </Text>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {entries.length}
              </div>
              <div className="text-sm text-gray-500">Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {completeCount}
              </div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
