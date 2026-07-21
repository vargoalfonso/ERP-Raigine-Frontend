"use client";

import { useMemo, useState } from "react";
import { AutoComplete, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, message } from "antd";
import { useRouter } from "next/navigation";
import dayjs, { type Dayjs } from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { useGetInventoryListQuery } from "@/lib/api/inventory/api";
import { buildBomUniqIndex } from "@/lib/utils/bomUniq";
import { buildBomMaterialSpecIndex } from "@/lib/utils/bomMaterialSpec";
import {
  useCreateRmProcessingWorkOrderMutation,
} from "@/lib/api/work-orders/api";

type RmOption = {
  uniq: string;
  name: string;
  partName: string;
  partNumber: string;
  model?: string;
  gradeSize?: string;
  unit?: string;
  label: string;
  value: string;
};

const buildPackingNumber = () => {
  const suffix = String(Date.now()).slice(-3);
  return `KBN-RM-AUTO-${suffix}`;
};

export default function CreateRmProcessingWoPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [packingNumber] = useState(buildPackingNumber);
  const [qrModal, setQrModal] = useState<{
    woNumber: string;
    kanban: string;
    size: string;
    qr: string;
  } | null>(null);
  const { TextArea } = Input;
  const apiEnabled = Boolean(apiBaseUrl);

  const inventoryQuery = useGetInventoryListQuery(
    { type: "raw-materials", page: 1, limit: 200 },
    { skip: !apiEnabled }
  );
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });
  const [createRmProcessingWorkOrder, createState] = useCreateRmProcessingWorkOrderMutation();
  const bomIndex = useMemo(() => buildBomUniqIndex(bomTreeRes?.data ?? []), [bomTreeRes?.data]);
  const specIndex = useMemo(() => buildBomMaterialSpecIndex(bomTreeRes?.data ?? []), [bomTreeRes?.data]);

  // Model auto-fill comes from the BOM node product model (outside material spec).
  const resolveModel = (uniq: string, fallback?: string) =>
    specIndex.productModelByUniq[uniq] ||
    (fallback ?? "") ||
    bomIndex.modelByUniq[uniq] ||
    bomIndex.assemblyCodeByUniq[uniq] ||
    "";

  // Grade/Size auto-fill = grade + (length x width x thickness) from material spec,
  // with the BOM child uniq/name appended in parentheses for detailing only.
  const resolveGradeSize = (uniq: string, fallback?: string) => {
    const grade = specIndex.gradeByUniq[uniq] || specIndex.materialGradeByUniq[uniq] || "";
    const size = specIndex.sizeByUniq[uniq] || "";
    const base =
      [grade, size].filter(Boolean).join(" ") ||
      (fallback ?? "") ||
      bomIndex.gradeSizeByUniq[uniq] ||
      "";
    if (!uniq) return base;
    const partName = bomIndex.partNameByUniq[uniq] || "";
    const detail = partName ? `${uniq} - ${partName}` : uniq;
    return base ? `${base} (${detail})` : `(${detail})`;
  };

  const applyUniqMapping = (value: string, fields?: { source?: boolean; target?: boolean }) => {
    const uniq = String(value ?? "").trim();
    if (!uniq) return;

    const found = rmOptions.find((option) => option.value === uniq);
    const mappedModel = resolveModel(uniq, found?.model);
    const mappedGradeSize = resolveGradeSize(uniq, found?.gradeSize);
    const mappedPartName = found?.partName ?? bomIndex.partNameByUniq[uniq];
    const mappedPartNumber = found?.partNumber ?? bomIndex.partNumberByUniq[uniq];
    const mappedUom = found?.unit ?? bomIndex.uomByUniq[uniq];

    const currentValues = form.getFieldsValue();
    const nextValues: Record<string, unknown> = {};

    if (fields?.source) {
      nextValues.sourceMaterialUniq = uniq;
      nextValues.partName = mappedPartName ?? currentValues.partName;
      nextValues.partNumber = mappedPartNumber ?? currentValues.partNumber;
      nextValues.inputUom = mappedUom ?? currentValues.inputUom;
    }

    if (fields?.target) {
      nextValues.targetMaterialUniq = uniq;
      nextValues.outputUom = mappedUom ?? currentValues.outputUom;
    }

    if (mappedModel && !String(currentValues.model ?? "").trim()) {
      nextValues.model = mappedModel;
    } else if (mappedModel && fields?.source) {
      nextValues.model = mappedModel;
    }

    if (mappedGradeSize && !String(currentValues.gradeSize ?? "").trim()) {
      nextValues.gradeSize = mappedGradeSize;
    } else if (mappedGradeSize && fields?.source) {
      nextValues.gradeSize = mappedGradeSize;
    }

    if (Object.keys(nextValues).length) {
      form.setFieldsValue(nextValues);
    }
  };

  const fallbackOptions: RmOption[] = useMemo(
    () => [
      {
        uniq: "UNIQ-1234",
        name: "Steel Coil SPHC 1.2mm",
        partName: "Steel Coil",
        partNumber: "RM-ST-001",
        model: "SPHC",
        gradeSize: "SPHC 1.2 mm x 4 ft x 8 ft",
        unit: "pcs",
        label: "UNIQ-1234 - Steel Coil SPHC 1.2mm",
        value: "UNIQ-1234",
      },
      {
        uniq: "UNIQ-2231",
        name: "Base Resin (PP) 25kg",
        partName: "Polypropylene Resin",
        partNumber: "RM-RS-011",
        model: "PP",
        gradeSize: null as unknown as string,
        unit: "kg",
        label: "UNIQ-2231 - Base Resin (PP) 25kg",
        value: "UNIQ-2231",
      },
      {
        uniq: "UNIQ-7781",
        name: "Rubber Compound A",
        partName: "Rubber Compound",
        partNumber: "RM-RB-007",
        model: "Compound A",
        gradeSize: null as unknown as string,
        unit: "kg",
        label: "UNIQ-7781 - Rubber Compound A",
        value: "UNIQ-7781",
      },
    ],
    []
  );

  const rmOptions: RmOption[] = useMemo(() => {
    const inv = inventoryQuery.data?.data ?? [];
    const fromInventory = apiEnabled && inv.length
      ? inv
          .filter((r) => (Number(r.stock_qty ?? 0) || 0) > 0 && String(r.uniq_code ?? "").trim())
          .map((r) => {
            const uniq = String(r.uniq_code ?? "").trim();
            const partName = String(r.part_name ?? r.item_name ?? bomIndex.partNameByUniq[uniq] ?? "-").trim() || "-";
            const partNumber = String(r.part_number ?? bomIndex.partNumberByUniq[uniq] ?? "-").trim() || "-";
            const unit = String(r.uom ?? bomIndex.uomByUniq[uniq] ?? "pcs").trim() || "pcs";
            const stockQty = Number(r.stock_qty ?? 0) || 0;
            return {
              uniq,
              name: partName === "-" ? uniq : partName,
              partName,
              partNumber,
              model: bomIndex.modelByUniq[uniq] ?? bomIndex.assemblyCodeByUniq[uniq] ?? undefined,
              gradeSize: bomIndex.gradeSizeByUniq[uniq] ?? undefined,
              unit,
              label: `${uniq}${partName && partName !== "-" ? ` - ${partName}` : ""} (stock: ${stockQty} ${unit})`,
              value: uniq,
            };
          })
          .filter((o) => Boolean(o.value))
      : [];

    const fromBom = bomIndex.options.map((option) => ({
      uniq: option.value,
      name: bomIndex.partNameByUniq[option.value] || option.value,
      partName: bomIndex.partNameByUniq[option.value] || "-",
      partNumber: bomIndex.partNumberByUniq[option.value] || "-",
      model: bomIndex.modelByUniq[option.value] || bomIndex.assemblyCodeByUniq[option.value] || undefined,
      gradeSize: bomIndex.gradeSizeByUniq[option.value] || undefined,
      unit: bomIndex.uomByUniq[option.value] || "pcs",
      label: `${option.value}${bomIndex.partNameByUniq[option.value] ? ` - ${bomIndex.partNameByUniq[option.value]}` : ""}`,
      value: option.value,
    }));

    const merged = [...fromInventory, ...fromBom];
    const deduped = new Map<string, RmOption>();
    for (const option of merged) {
      if (!option.value) continue;
      if (!deduped.has(option.value)) {
        deduped.set(option.value, option);
        continue;
      }

      const current = deduped.get(option.value)!;
      deduped.set(option.value, {
        ...current,
        partName: current.partName !== "-" ? current.partName : option.partName,
        partNumber: current.partNumber !== "-" ? current.partNumber : option.partNumber,
        model: current.model ?? option.model,
        gradeSize: current.gradeSize ?? option.gradeSize,
        unit: current.unit ?? option.unit,
        label: current.label || option.label,
      });
    }

    if (deduped.size) {
      return Array.from(deduped.values());
    }

    return fallbackOptions;
  }, [apiEnabled, bomIndex, fallbackOptions, inventoryQuery.data]);

  const onSelectSourceRm = (value: string) => {
    const found = rmOptions.find((o) => o.value === value);
    if (!found) return;

    const currentTarget = form.getFieldValue("targetMaterialUniq");

    const nextValues: Record<string, unknown> = {
      partName: found.partName,
      partNumber: found.partNumber,
      model: resolveModel(value, found.model),
      gradeSize: resolveGradeSize(value, found.gradeSize),
      sourceMaterialUniq: value,
      inputUom: found.unit ?? form.getFieldValue("inputUom"),
    };

    if (currentTarget && String(currentTarget) === value) {
      nextValues.targetMaterialUniq = undefined;
    }

    nextValues.outputUom = found.unit ?? form.getFieldValue("outputUom");

    form.setFieldsValue(nextValues);
    applyUniqMapping(value, { source: true });
  };

  const onCreate = async () => {
    try {
      const values = await form.validateFields();
      if (!apiEnabled) {
        message.success("RM Processing WO created locally");
        router.push("/work-orders");
        return;
      }

      const dateIssued = values.dateIssued as Dayjs;
      const res = await createRmProcessingWorkOrder({
        source_material_uniq: String(values.sourceMaterialUniq),
        target_material_uniq: String(values.targetMaterialUniq),
        model: String(values.model),
        grade_size: String(values.gradeSize),
        input_qty: Number(values.qtyInput),
        input_uom: String(form.getFieldValue("inputUom") ?? values.outputUom ?? "pcs"),
        output_qty: Number(values.qtyOutput),
        output_uom: String(values.outputUom ?? "pcs"),
        date_issued: dayjs(dateIssued).format("YYYY-MM-DD"),
        remarks: values.remarks ? String(values.remarks) : null,
        pre_processing: Boolean(values.preProcessing),
      }).unwrap();

      message.success("RM Processing WO created");
      const qr = res.kanban_qr_data_url || res.qr_data_url || "";
      if (qr) {
        setQrModal({
          woNumber: res.wo_number ?? "",
          kanban: res.kanban_number ?? String(values.packingNumber ?? ""),
          size: res.size_breakdown ?? "",
          qr,
        });
      } else {
        router.push("/work-orders");
      }
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(getApiErrorMessage(err, "Failed to create RM processing work order"));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Modal
        open={Boolean(qrModal)}
        title="QR Kanban / Packing List"
        onCancel={() => {
          setQrModal(null);
          router.push("/work-orders");
        }}
        footer={[
          <Button
            key="print"
            onClick={() => {
              if (!qrModal?.qr) return;
              const w = window.open("", "_blank");
              if (!w) return;
              w.document.write(
                `<html><head><title>${qrModal.kanban || "QR"}</title></head>` +
                  `<body style="text-align:center;font-family:sans-serif;padding:24px">` +
                  `<img src="${qrModal.qr}" style="width:260px;height:260px;image-rendering:pixelated" />` +
                  `<div style="margin-top:12px;font-size:14px"><b>${qrModal.kanban || ""}</b></div>` +
                  `<div style="font-size:12px;color:#555">${qrModal.size || ""}</div>` +
                  `</body></html>`,
              );
              w.document.close();
              w.focus();
              w.print();
            }}
          >
            Print
          </Button>,
          <Button
            key="done"
            type="primary"
            onClick={() => {
              setQrModal(null);
              router.push("/work-orders");
            }}
          >
            Done
          </Button>,
        ]}
      >
        {qrModal ? (
          <div className="flex flex-col items-center gap-3">
            {qrModal.qr ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrModal.qr}
                alt="QR Kanban"
                className="w-56 h-56"
                style={{ imageRendering: "pixelated" }}
              />
            ) : null}
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-900">{qrModal.woNumber || "-"}</div>
              <div className="text-sm text-gray-700">Kanban: {qrModal.kanban || "-"}</div>
              {qrModal.size ? (
                <div className="text-xs text-gray-500">Size: {qrModal.size}</div>
              ) : null}
            </div>
            <details className="w-full">
              <summary className="cursor-pointer text-xs text-gray-500">Detail base64</summary>
              <textarea
                readOnly
                value={qrModal.qr}
                className="mt-2 w-full h-24 text-[10px] font-mono border border-gray-200 rounded p-2"
              />
            </details>
          </div>
        ) : null}
      </Modal>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => router.push("/work-orders")}
          >
            <span className="text-base leading-none">←</span>
            <span>Back to Work Orders</span>
          </button>

          <div className="flex items-center gap-2">
            <Button className="!rounded-lg" onClick={() => router.push("/work-orders")}>
              Cancel
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              onClick={onCreate}
              loading={createState.isLoading}
            >
              Create RM Processing WO
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-2xl font-bold text-gray-900">Work Order - Raw Material Processing</div>
          <div className="text-sm text-gray-500">Transform base raw materials into semi-finished materials</div>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          woType: "RM Processing",
          packingNumber,
          inputUom: "pcs",
          outputUom: "pcs",
          preProcessing: false,
        }}
      >
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Material Identification</div>
            <div className="text-xs text-gray-500 mt-1">Select raw material and define processing details</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="sourceMaterialUniq"
                label="Source Material UNIQ / Name"
                rules={[{ required: true, message: "Select raw material" }]}
              >
                <Select
                  className="!rounded-lg"
                  placeholder="Select raw material"
                  options={rmOptions.map((o) => ({ label: o.label, value: o.value }))}
                  onChange={onSelectSourceRm}
                  loading={inventoryQuery.isFetching}
                />
              </Form.Item>

              <Form.Item name="woType" label="WO Type">
                <Input className="!rounded-lg" disabled />
              </Form.Item>

              <Form.Item name="partName" label="Part Name">
                <Input className="!rounded-lg" disabled placeholder="Auto-filled from RM selection" />
              </Form.Item>

              <Form.Item name="partNumber" label="Part Number">
                <Input className="!rounded-lg" disabled placeholder="Auto-filled from RM Master Data" />
              </Form.Item>

              <Form.Item name="model" label="Model" rules={[{ message: "Enter model" }]}>
                <Input className="!rounded-lg" disabled placeholder="Auto-filled from RM selection" />
              </Form.Item>

              <Form.Item name="gradeSize" label="Grade / Size" rules={[{ message: "Enter grade/size" }]}>
                <Input className="!rounded-lg" disabled placeholder="e.g., SPHC 1.2 mm × 4 ft × 8 ft" />
              </Form.Item>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">UNIQ Identification</div>
            <div className="text-xs text-gray-500 mt-1">Source and target material UNIQ tracking</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="targetMaterialUniq"
                label="Target Material Uniq"
                rules={[
                  { required: true, message: "Select target material uniq" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || value !== getFieldValue("sourceMaterialUniq")) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("Target UNIQ must be different from source UNIQ"));
                    },
                  }),
                ]}
              >
                <AutoComplete
                  className="!rounded-lg"
                  placeholder="e.g. EMA-LV7-001111"
                  options={rmOptions.map((o) => ({ label: o.label, value: o.value }))}
                  onSelect={(value) => applyUniqMapping(String(value), { target: true })}
                  onChange={(value) => {
                    if (typeof value === "string" && value.trim()) {
                      applyUniqMapping(value, { target: true });
                    }
                  }}
                  filterOption={(inputValue, option) =>
                    String(option?.label ?? "").toLowerCase().includes(inputValue.toLowerCase())
                  }
                />
              </Form.Item>
              <div className="md:col-span-2 -mt-2 text-xs text-gray-400">
                Default follows input RM UNIQ; defines deduction source for RM
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Quantity &amp; Processing Details</div>
            <div className="text-xs text-gray-500 mt-1">Input and output quantities for the processing operation</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Form.Item
                name="qtyInput"
                label="Quantity Input"
                rules={[{ required: true, message: "Enter quantity input" }]}
                extra={<span className="text-xs text-gray-400">Raw material used</span>}
              >
                <InputNumber className="!rounded-lg w-full" min={0} placeholder="e.g 100 Sheet / Coil / kg" />
              </Form.Item>

              <Form.Item
                label="Size Breakdown"
                shouldUpdate={(prev, cur) => prev.qtyInput !== cur.qtyInput || prev.qtyOutput !== cur.qtyOutput}
                extra={<span className="text-xs text-gray-400">Ukuran per unit × qty output (mis. 0.2 × 5)</span>}
              >
                {() => {
                  const qi = Number(form.getFieldValue("qtyInput")) || 0;
                  const qo = Number(form.getFieldValue("qtyOutput")) || 0;
                  const perUnit = qo > 0 ? Math.round((qi / qo) * 10000) / 10000 : 0;
                  const text = qo > 0 ? `${perUnit} × ${qo}` : "-";
                  return <Input className="!rounded-lg" value={text} disabled />;
                }}
              </Form.Item>

              <Form.Item
                name="qtyOutput"
                label="Quantity Output"
                rules={[{ required: true, message: "Enter quantity output" }]}
                extra={<span className="text-xs text-gray-400">Semi-finished produced</span>}
              >
                <InputNumber className="!rounded-lg w-full" min={0} placeholder="e.g 50 ccPieces / kg" />
              </Form.Item>

              <Form.Item name="outputUom" label="Output UoM" rules={[{ required: true }]}>
                <Input className="!rounded-lg" placeholder="e.g. pcs" />
              </Form.Item>

              <Form.Item
                name="packingNumber"
                label="Packing Number / Kanban"
                extra={<span className="text-xs text-gray-400">Auto-generated</span>}
              >
                <Input className="!rounded-lg" disabled />
              </Form.Item>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 bg-gradient-to-r from-blue-50/60 to-white">
            <div className="text-sm font-semibold text-gray-900">Processing Schedule</div>
            <div className="text-xs text-gray-500 mt-1">Set dates for the RM processing operation</div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="dateIssued" label="Date Issued" rules={[{ required: true, message: "Select date issued" }]}>
                <DatePicker className="!rounded-lg w-full" placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
              </Form.Item>

              <Form.Item
                name="dateCompleted"
                label="Date Completed"
                extra={<span className="text-xs text-gray-400">Used to measure cycle time</span>}
              >
                <DatePicker className="!rounded-lg w-full" placeholder="dd/mm/yyyy" format="DD/MM/YYYY" />
              </Form.Item>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="text-sm font-semibold text-gray-900">Approval &amp; Remarks</div>
            <div className="text-xs text-gray-500 mt-1">Manager approval and special instructions</div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              <Form.Item
                name="preProcessing"
                label="Pre-Processing Flag"
                valuePropName="checked"
                extra={<span className="text-xs text-gray-400">Tandai agar hasil olahan masuk ke inventory raw material saat scan selesai (stok sumber berkurang)</span>}
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="remarks"
                label="Remarks"
                extra={<span className="text-xs text-gray-400">Optional field for shop-floor comments</span>}
              >
                <TextArea className="!rounded-lg" rows={3} placeholder="Notes or special instructions for shop-floor..." />
              </Form.Item>
            </div>
          </div>
        </div>
      </Form>
    </div>
  );
}

