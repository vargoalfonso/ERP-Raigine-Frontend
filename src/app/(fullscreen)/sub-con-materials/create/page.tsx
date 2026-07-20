"use client";

import { Suspense, useEffect, useMemo, useState, type MutableRefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  DatePicker,
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
import { useCreateInventoryMutation } from "@/lib/api/inventory/api";
import { useListProcurementDnsQuery } from "@/lib/api/procurement-dn/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import {
  focusFirstInvalidField,
  getValidationMessage,
  isAntdFormValidationError,
} from "@/lib/utils/formValidation";
import { setFlashMessage } from "@/lib/utils/flashMessage";

const { Title, Text } = Typography;

const PERIOD_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((m) => ({ label: m, value: m }));

type SubConStockFormData = {
  deliveryNotesNumber?: string;
  uniq?: string;
  partNumber?: string;
  partName?: string;
  periodPo?: string;
  dateReceived?: any;
  quantityReceived?: number;
  subconVendorName?: string;
  addStock?: number;
};

type FormEntry = {
  id: number;
  key: string;
  formRef: MutableRefObject<FormInstance<SubConStockFormData> | null>;
};

type SelectOption = { label: string; value: string };

const SubConStockFormCard = ({
  entryNumber,
  formRef,
  showRemove,
  onRemove,
  uniqOptions,
  dnOptions,
  bomIndex,
  procurementDns,
  cardTitle,
  dateLabel,
  qtyLabel,
}: {
  entryNumber: number;
  formRef: MutableRefObject<FormInstance<SubConStockFormData> | null>;
  showRemove: boolean;
  onRemove: () => void;
  uniqOptions: SelectOption[];
  dnOptions: SelectOption[];
  bomIndex: ReturnType<typeof buildBomUniqIndex>;
  procurementDns: Array<{ dn_number?: string; po_number?: string; supplier_name?: string; items: Array<{ item_uniq_code?: string }> }>;
  cardTitle: string;
  dateLabel: string;
  qtyLabel: string;
}) => {
  const [form] = Form.useForm<SubConStockFormData>();

  useEffect(() => {
    formRef.current = form;
  }, [form, formRef]);

  const fillUniq = (uniq?: string) => {
    if (!uniq) return;
    form.setFieldsValue({
      uniq,
      partNumber: bomIndex.partNumberByUniq[uniq] ?? "",
      partName: bomIndex.partNameByUniq[uniq] ?? "",
    });
  };

  const onSelectDn = (dnNumber: string) => {
    const dn = procurementDns.find((item) => item.dn_number === dnNumber);
    const uniq = dn?.items?.[0]?.item_uniq_code;
    form.setFieldsValue({
      deliveryNotesNumber: dnNumber,
      subconVendorName: dn?.supplier_name,
    });
    fillUniq(uniq);
  };

  return (
    <Card>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <Title level={4} className="!mb-0">
            {cardTitle} #{entryNumber}
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
        <p className="text-gray-500">Add Sub Con raw material entry</p>
      </div>

      <Form form={form} layout="vertical">
        <Form.Item
          label="Delivery Notes Number"
          name="deliveryNotesNumber"
          rules={[{ required: true, message: "Please select delivery notes number!" }]}
        >
          <Select
            placeholder="Select Delivery Notes Number"
            size="large"
            allowClear
            options={dnOptions}
            onChange={onSelectDn}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item
            label="Uniq"
            name="uniq"
            rules={[{ required: true, message: "Please select uniq!" }]}
          >
            <Select
              placeholder="IRM-001"
              size="large"
              allowClear
              options={uniqOptions}
              onChange={fillUniq}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            label="Part Number"
            name="partNumber"
            rules={[{ required: true, message: "Please input part number!" }]}
          >
            <Input placeholder="Automatic filled" size="large" disabled />
          </Form.Item>

          <Form.Item
            label="Part Name"
            name="partName"
            rules={[{ required: true, message: "Please input part name!" }]}
          >
            <Input placeholder="Automatic Filled" size="large" disabled />
          </Form.Item>

          <Form.Item
            label="Period PO"
            name="periodPo"
            rules={[{ required: true, message: "Please select period!" }]}
          >
            <Select
              placeholder="Select Period"
              size="large"
              allowClear
              options={PERIOD_OPTIONS}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item
            label={dateLabel}
            name="dateReceived"
            rules={[{ required: true, message: `Please select ${dateLabel.toLowerCase()}!` }]}
          >
            <DatePicker className="w-full" size="large" format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item
            label={qtyLabel}
            name="quantityReceived"
            rules={[{ required: true, message: `Please input ${qtyLabel.toLowerCase()}!` }]}
          >
            <InputNumber placeholder="300" size="large" style={{ width: "100%" }} min={0} />
          </Form.Item>

          <Form.Item
            label="Subcon Vendor Name"
            name="subconVendorName"
            rules={[{ required: true, message: "Please input vendor name!" }]}
          >
            <Input placeholder="PT Subcon" size="large" />
          </Form.Item>

          <Form.Item
            label="Add Stock"
            name="addStock"
            rules={[{ required: true, message: "Please input add stock!" }]}
          >
            <InputNumber placeholder="300" size="large" style={{ width: "100%" }} min={0} />
          </Form.Item>
        </div>
      </Form>
    </Card>
  );
};

function CreateSubConStockContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReceived = (searchParams.get("type") ?? "in-vendor") === "received";

  const labels = {
    title: isReceived ? "Add Stock Received from Vendor" : "Add Stock In Vendor",
    save: isReceived ? "Save Stock Received" : "Save Stock In Vendor",
    cardTitle: isReceived ? "Add Stock Received from Vendor" : "Add Stock In Vendor",
    addAnother: isReceived ? "Add Another Stock Received" : "Add Another SubCon Material",
    dateLabel: isReceived ? "Date Received" : "Date Delivery",
    qtyLabel: isReceived ? "Quantity Received Items" : "Quantity Delivery Items",
    entryName: isReceived ? "Stock Received Entry" : "SubCon Material Entry",
  };

  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<FormEntry[]>([]);
  const [createInventory] = useCreateInventoryMutation();
  const apiEnabled = Boolean(apiBaseUrl);

  const bomTreeQuery = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const bomIndex = useMemo(() => buildBomUniqIndex(bomTreeQuery.data?.data ?? []), [bomTreeQuery.data]);
  const procurementDnsQuery = useListProcurementDnsQuery(undefined, { skip: !apiEnabled });

  const uniqOptions = useMemo<SelectOption[]>(
    () =>
      bomIndex.uniqs.map((uniq) => ({
        value: uniq,
        label: bomIndex.partNameByUniq[uniq] ? `${uniq} — ${bomIndex.partNameByUniq[uniq]}` : uniq,
      })),
    [bomIndex.partNameByUniq, bomIndex.uniqs]
  );

  const procurementDns = useMemo(
    () =>
      (procurementDnsQuery.data?.data ?? [])
        .filter((dn) => dn.type === "SC")
        .map((dn) => ({
          dn_number: dn.dn_number,
          po_number: dn.po_number,
          supplier_name: dn.supplier_name,
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
      const v = form.getFieldsValue() as SubConStockFormData;
      return (
        v.deliveryNotesNumber &&
        v.uniq &&
        v.partNumber &&
        v.partName &&
        v.periodPo &&
        v.dateReceived &&
        typeof v.quantityReceived === "number" &&
        v.subconVendorName &&
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
        try {
          await form.validateFields();
        } catch (error) {
          if (isAntdFormValidationError(error)) {
            focusFirstInvalidField(form, error);
            message.error(
              getValidationMessage(error, {
                prefix: `Entry ${entry.id}`,
                fallback: `Entry ${entry.id}: please complete all required fields.`,
              }),
            );
            return;
          }
          throw error;
        }

        const values = form.getFieldsValue() as SubConStockFormData;
        await createInventory({
          type: "subcon-materials",
          body: {
            uniq_code: String(values.uniq ?? ""),
            raw_material_type: "Subcon",
            rm_source: values.deliveryNotesNumber,
            part_name: values.partName,
            part_number: values.partNumber,
            stock_qty: Number(values.addStock ?? values.quantityReceived ?? 0),
          },
        }).unwrap();
      }
      setFlashMessage({
        type: "success",
        content: isReceived ? "Stock received saved" : "Stock in vendor saved",
        targetPath: "/sub-con-materials",
      });
      router.push(isReceived ? "/sub-con-materials?mode=received" : "/sub-con-materials");
    } catch (error) {
      message.error(
        (error as { data?: { message?: string } })?.data?.message ||
          "Failed to save stock."
      );
    } finally {
      setLoading(false);
    }
  };

  const backToList = () =>
    router.push(isReceived ? "/sub-con-materials?mode=received" : "/sub-con-materials");

  return (
    <div className="min-h-screen bg-gray-50 justify-center pb-32">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="border-r border-gray-300 pr-4">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={backToList}
                className="flex items-center gap-2"
                type="text"
              >
                Back to SubCon Material Database
              </Button>
            </div>
            <div>
              <Title level={3} className="!mb-0">
                {labels.title}
              </Title>
              <Text className="text-gray-500">
                Create Sub Con Material Database • {entries.length} entry
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={backToList}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={saveAll}>
              {labels.save}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mx-auto w-full max-w-6xl">
          {entries.map((entry, index) => (
            <div key={entry.key} className={index !== entries.length - 1 ? "mb-12" : ""}>
              <SubConStockFormCard
                entryNumber={entry.id}
                formRef={entry.formRef}
                showRemove={entries.length > 1}
                onRemove={() => removeEntry(entry.id)}
                uniqOptions={uniqOptions}
                dnOptions={dnOptions}
                bomIndex={bomIndex}
                procurementDns={procurementDns}
                cardTitle={labels.cardTitle}
                dateLabel={labels.dateLabel}
                qtyLabel={labels.qtyLabel}
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
              {labels.addAnother}
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
            <Title level={5} className="!mb-1">Summary</Title>
            <Text className="text-gray-600">
              {entries.length} {labels.entryName} ready to be saved
            </Text>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{entries.length}</div>
              <div className="text-sm text-gray-500">Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{completeCount}</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function CreateSubConStockPage() {
  return (
    <Suspense fallback={null}>
      <CreateSubConStockContent />
    </Suspense>
  );
}
