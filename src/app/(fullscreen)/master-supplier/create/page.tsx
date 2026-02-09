"use client";

import React, { Suspense, useMemo, useState } from "react";
import { Button, Card, Input, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";

type SupplierOption = { label: string; value: string; supplierId: string };

type CycleType = "Daily" | "Weekly";

type SupplierItemRow = {
  key: string;
  sebanggo: string;
  uniq: string;
  materialInfo: {
    code: string;
    name: string;
    model: string;
  };
  type: string;
  gradeSize: string;
  quantity: number;
  uom: string;
  weight: number;
  cycle: CycleType;
  pcsPerKanban: string;
};

type Draft = {
  sebanggo?: string;
  uniq?: string;
  customerCycle?: string;
  quantity?: number;
  type?: string;
  description?: string;
};

type IndirectRow = {
  key: string;
  productModel: string;
  partName: string;
  partNumber: string;
  gradeSize: string;
  qtyPerKanban: number;
  uom: string;
  weightKg: number;
  location: string;
  type: string;
  cycleDays: number;
  status: "Active" | "Inactive";
};

type IndirectDraft = {
  productModel?: string;
  partName?: string;
  partNumber?: string;
  gradeSize?: string;
  qtyPerKanban?: number;
  uom?: string;
  weightKg?: number;
  location?: string;
  type?: string;
  cycleDays?: number;
};

const SUPPLIERS: SupplierOption[] = [
  { label: "PT Steel", value: "PT Steel", supplierId: "SUP-PT-STEEL" },
  { label: "PT Metal Works", value: "PT Metal Works", supplierId: "SUP-PT-METAL" },
  { label: "PT Chemical Solutions", value: "PT Chemical Solutions", supplierId: "SUP-PT-CHEM" },
];

const UNIQ_POOL = ["LV-001", "LV-002", "LV-003", "LV-004", "LV-005"]; // auto-generated mock

function nextUniq(used: Set<string>) {
  for (const u of UNIQ_POOL) {
    if (!used.has(u)) return u;
  }
  return `LV-${String(used.size + 1).padStart(3, "0")}`;
}

export default function MasterSupplierCreatePage() {
  return (
    <Suspense fallback={null}>
      <MasterSupplierCreatePageContent />
    </Suspense>
  );
}

function MasterSupplierCreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const section = useMemo(() => {
    const s = (searchParams.get("section") ?? "").toLowerCase();
    return s === "indirect" ? "indirect" : "raw";
  }, [searchParams]);

  const [selectedSupplier, setSelectedSupplier] = useState<string | undefined>(undefined);
  const supplierId = useMemo(() => SUPPLIERS.find((s) => s.value === selectedSupplier)?.supplierId, [selectedSupplier]);

  const [rows, setRows] = useState<SupplierItemRow[]>([
    {
      key: "ASM-LV-001",
      sebanggo: "ASM-LV-001",
      uniq: "LV-001",
      materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
      type: "Pipe",
      gradeSize: "STKM 550 - 5mm",
      quantity: 40,
      uom: "pcs",
      weight: 2.5,
      cycle: "Daily",
      pcsPerKanban: "WH-A1",
    },
    {
      key: "ASM-LV-002",
      sebanggo: "ASM-LV-002",
      uniq: "LV-002",
      materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
      type: "Steel Plate",
      gradeSize: "STKM 550 - 5mm",
      quantity: 100,
      uom: "pcs",
      weight: 18,
      cycle: "Weekly",
      pcsPerKanban: "WH-A1",
    },
    {
      key: "ASM-LV-003",
      sebanggo: "ASM-LV-003",
      uniq: "LV-003",
      materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
      type: "Coil",
      gradeSize: "STKM 550 - 5mm",
      quantity: 100,
      uom: "pcs",
      weight: 1,
      cycle: "Daily",
      pcsPerKanban: "WH-A1",
    },
    {
      key: "ASM-LV-004",
      sebanggo: "ASM-LV-004",
      uniq: "LV-004",
      materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
      type: "Wire",
      gradeSize: "STKM 550 - 5mm",
      quantity: 100,
      uom: "m",
      weight: 2.5,
      cycle: "Daily",
      pcsPerKanban: "WH-A1",
    },
  ]);

  const usedUniq = useMemo(() => new Set(rows.map((r) => r.uniq)), [rows]);

  const [draft, setDraft] = useState<Draft>(() => ({ uniq: nextUniq(new Set(["LV-001", "LV-002", "LV-003", "LV-004"])) }));
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const totalUniqAdded = useMemo(() => rows.length, [rows]);
  const totalQuantity = useMemo(() => rows.reduce((sum, r) => sum + r.quantity, 0), [rows]);

  const ensureUniqInDraft = () => {
    setDraft((prev) => ({
      ...prev,
      uniq: prev.uniq ?? nextUniq(usedUniq),
    }));
  };

  const startEdit = (row: SupplierItemRow) => {
    setEditingKey(row.key);
    setDraft({
      sebanggo: row.sebanggo,
      uniq: row.uniq,
      customerCycle: row.cycle,
      quantity: row.quantity,
      type: row.type,
      description: row.materialInfo.name,
    });
  };

  const removeRow = (key: string) => {
    const ok = window.confirm("Delete this item?");
    if (!ok) return;
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const upsertRow = () => {
    if (!selectedSupplier) {
      message.error("Supplier Name is required");
      return;
    }
    if (!draft.sebanggo || draft.sebanggo.trim().length === 0) {
      message.error("Sebanggo (Assembly Code) is required");
      return;
    }
    if (!draft.uniq) {
      message.error("Uniq is required");
      return;
    }
    if (!draft.customerCycle || draft.customerCycle.trim().length === 0) {
      message.error("Customer Cycle is required");
      return;
    }
    if (draft.quantity === undefined || draft.quantity === null) {
      message.error("Quantity is required");
      return;
    }

    const cycle = (draft.customerCycle === "Weekly" ? "Weekly" : "Daily") as CycleType;

    const newRow: SupplierItemRow = {
      key: editingKey ?? draft.sebanggo,
      sebanggo: draft.sebanggo,
      uniq: draft.uniq,
      materialInfo: { code: "SP-001-A", name: "Steel Plate", model: "Camry 2024" },
      type: draft.type ?? "-",
      gradeSize: "STKM 550 - 5mm",
      quantity: draft.quantity,
      uom: "pcs",
      weight: 2.5,
      cycle,
      pcsPerKanban: "WH-A1",
    };

    setRows((prev) => {
      const exists = prev.some((r) => r.key === (editingKey ?? draft.sebanggo));
      if (exists) {
        return prev.map((r) => (r.key === (editingKey ?? draft.sebanggo) ? newRow : r));
      }
      const uniqUsed = prev.some((r) => r.uniq === draft.uniq);
      if (uniqUsed) {
        message.warning("Uniq already exists in the table");
        return prev;
      }
      return [newRow, ...prev];
    });

    setEditingKey(null);
    setDraft({ uniq: nextUniq(new Set(rows.map((r) => r.uniq))) });
    message.success(editingKey ? "Item updated" : "Item added");
  };

  const onCreate = () => {
    if (!selectedSupplier) {
      message.error("Please select Supplier Name");
      return;
    }
    message.success("Master supplier item created");
    router.push("/master-supplier");
  };

  // Indirect Raw Material flow
  const [indirectRows, setIndirectRows] = useState<IndirectRow[]>([
    {
      key: "IND-001",
      productModel: "Universal",
      partName: "Cutting Oil",
      partNumber: "OIL-CUT-001",
      gradeSize: "Grade A - 20L",
      qtyPerKanban: 100,
      uom: "liter",
      weightKg: 18,
      location: "Chemical Storage",
      type: "Consumable",
      cycleDays: 14,
      status: "Active",
    },
    {
      key: "IND-002",
      productModel: "Universal",
      partName: "Welding Wire",
      partNumber: "WLD-WR-002",
      gradeSize: "ER70S-6 - 1.2mm",
      qtyPerKanban: 50,
      uom: "kg",
      weightKg: 15,
      location: "Welding Area",
      type: "Consumable",
      cycleDays: 7,
      status: "Active",
    },
  ]);

  const [indirectDraft, setIndirectDraft] = useState<IndirectDraft>({});
  const [indirectEditingKey, setIndirectEditingKey] = useState<string | null>(null);

  const indirectTotals = useMemo(() => {
    const totalQty = indirectRows.reduce((sum, r) => sum + r.qtyPerKanban, 0);
    return { totalItems: indirectRows.length, totalQty };
  }, [indirectRows]);

  const startIndirectEdit = (row: IndirectRow) => {
    setIndirectEditingKey(row.key);
    setIndirectDraft({
      productModel: row.productModel,
      partName: row.partName,
      partNumber: row.partNumber,
      gradeSize: row.gradeSize,
      qtyPerKanban: row.qtyPerKanban,
      uom: row.uom,
      weightKg: row.weightKg,
      location: row.location,
      type: row.type,
      cycleDays: row.cycleDays,
    });
  };

  const removeIndirectRow = (key: string) => {
    const ok = window.confirm("Delete this item?");
    if (!ok) return;
    setIndirectRows((prev) => prev.filter((r) => r.key !== key));
  };

  const upsertIndirectRow = () => {
    if (!selectedSupplier) {
      message.error("Supplier Name is required");
      return;
    }
    if (!indirectDraft.productModel?.trim()) return void message.error("Product Model is required");
    if (!indirectDraft.partName?.trim()) return void message.error("Part Name is required");
    if (!indirectDraft.partNumber?.trim()) return void message.error("Part Number is required");
    if (!indirectDraft.gradeSize?.trim()) return void message.error("Grade/Size is required");
    if (indirectDraft.qtyPerKanban === undefined || indirectDraft.qtyPerKanban === null) return void message.error("Qty/Kanban is required");
    if (!indirectDraft.uom?.trim()) return void message.error("UOM is required");
    if (indirectDraft.weightKg === undefined || indirectDraft.weightKg === null) return void message.error("Weight (kg) is required");
    if (!indirectDraft.location?.trim()) return void message.error("Lokasi is required");
    if (!indirectDraft.type?.trim()) return void message.error("Type is required");
    if (indirectDraft.cycleDays === undefined || indirectDraft.cycleDays === null) return void message.error("Cycle (days) is required");

    const newRow: IndirectRow = {
      key: indirectEditingKey ?? indirectDraft.partNumber,
      productModel: indirectDraft.productModel,
      partName: indirectDraft.partName,
      partNumber: indirectDraft.partNumber,
      gradeSize: indirectDraft.gradeSize,
      qtyPerKanban: indirectDraft.qtyPerKanban,
      uom: indirectDraft.uom,
      weightKg: indirectDraft.weightKg,
      location: indirectDraft.location,
      type: indirectDraft.type,
      cycleDays: indirectDraft.cycleDays,
      status: "Active",
    };

    setIndirectRows((prev) => {
      const keyToUse = indirectEditingKey ?? indirectDraft.partNumber;
      const exists = prev.some((r) => r.key === keyToUse);
      if (exists) return prev.map((r) => (r.key === keyToUse ? newRow : r));
      const partExists = prev.some((r) => r.partNumber === indirectDraft.partNumber);
      if (partExists) {
        message.warning("Part Number already exists in the table");
        return prev;
      }
      return [newRow, ...prev];
    });

    setIndirectEditingKey(null);
    setIndirectDraft({});
    message.success(indirectEditingKey ? "Item updated" : "Item added");
  };

  const onCreateIndirect = () => {
    if (!selectedSupplier) {
      message.error("Please select Supplier Name");
      return;
    }
    message.success("Master supplier item created");
    router.push("/master-supplier");
  };

  if (section === "indirect") {
    return (
      <div className="min-h-screen bg-[#EEF5FF]">
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <button
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                onClick={() => router.push("/master-supplier")}
              >
                <LeftOutlined />
                <span>Back to Master Supplier List</span>
              </button>

              <div className="flex items-center gap-2">
                <Button onClick={() => router.push("/master-supplier")}>Cancel</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={onCreateIndirect}>
                  Create Master Item
                </Button>
              </div>
            </div>

            <div className="mt-2">
              <div className="text-xl font-semibold text-gray-900">Add Master Supplier Item</div>
              <div className="text-sm text-gray-500">Indirect Raw Material</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="max-w-6xl mx-auto space-y-5">
            <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-gray-900">Step 1: Select Supplier</div>
                  <div className="text-sm text-gray-500">Configure supplier details</div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">Required</Tag>
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Supplier Name</div>
                  <Select
                    value={selectedSupplier}
                    onChange={(v) => setSelectedSupplier(v)}
                    placeholder="Select supplier"
                    options={SUPPLIERS.map((s) => ({ label: s.label, value: s.value }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="text-sm text-gray-700 mb-2">Supplier ID</div>
                  <Input value={supplierId} placeholder="Auto-filled from supplier selection" disabled />
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-gray-900">Step 2: Input Data</div>
                  <div className="text-sm text-gray-500">Indirect raw material specification</div>
                </div>
                <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">Required</Tag>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Product Model</div>
                    <Input
                      value={indirectDraft.productModel}
                      onChange={(e) => setIndirectDraft((p) => ({ ...p, productModel: e.target.value }))}
                      placeholder="Enter product model"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Part Name</div>
                    <Input
                      value={indirectDraft.partName}
                      onChange={(e) => setIndirectDraft((p) => ({ ...p, partName: e.target.value }))}
                      placeholder="Enter part name"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Part Number</div>
                    <Input
                      value={indirectDraft.partNumber}
                      onChange={(e) => setIndirectDraft((p) => ({ ...p, partNumber: e.target.value }))}
                      placeholder="Enter part number"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Grade/Size</div>
                    <Input
                      value={indirectDraft.gradeSize}
                      onChange={(e) => setIndirectDraft((p) => ({ ...p, gradeSize: e.target.value }))}
                      placeholder="Enter grade/size"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Qty/Kanban</div>
                    <InputNumber
                      value={indirectDraft.qtyPerKanban}
                      onChange={(v) => setIndirectDraft((p) => ({ ...p, qtyPerKanban: v ?? undefined }))}
                      className="w-full"
                      min={0}
                      placeholder="Enter qty"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-700 mb-2">UOM</div>
                    <Input
                      value={indirectDraft.uom}
                      onChange={(e) => setIndirectDraft((p) => ({ ...p, uom: e.target.value }))}
                      placeholder="e.g. kg, liter"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Weight (kg)</div>
                    <InputNumber
                      value={indirectDraft.weightKg}
                      onChange={(v) => setIndirectDraft((p) => ({ ...p, weightKg: v ?? undefined }))}
                      className="w-full"
                      min={0}
                      placeholder="Enter weight"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Lokasi</div>
                    <Input
                      value={indirectDraft.location}
                      onChange={(e) => setIndirectDraft((p) => ({ ...p, location: e.target.value }))}
                      placeholder="Enter location"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Type</div>
                    <Input
                      value={indirectDraft.type}
                      onChange={(e) => setIndirectDraft((p) => ({ ...p, type: e.target.value }))}
                      placeholder="e.g. Consumable"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-700 mb-2">Cycle (days)</div>
                    <InputNumber
                      value={indirectDraft.cycleDays}
                      onChange={(v) => setIndirectDraft((p) => ({ ...p, cycleDays: v ?? undefined }))}
                      className="w-full"
                      min={0}
                      placeholder="Enter cycle"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <Button type="primary" icon={<PlusOutlined />} onClick={upsertIndirectRow} className="w-full">
                      {indirectEditingKey ? "Update Data" : "Add Data"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  <div>
                    <div className="text-xs text-gray-500">Supplier Name</div>
                    <div className="text-sm font-medium text-gray-900">{selectedSupplier ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Items</div>
                    <div className="text-sm font-medium text-gray-900">{indirectTotals.totalItems}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Quantity</div>
                    <div className="text-sm font-medium text-gray-900">{indirectTotals.totalQty.toLocaleString()}</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left font-medium px-4 py-3">Product Model</th>
                          <th className="text-left font-medium px-4 py-3">Part Name</th>
                          <th className="text-left font-medium px-4 py-3">Part Number</th>
                          <th className="text-left font-medium px-4 py-3">Grade/Size</th>
                          <th className="text-left font-medium px-4 py-3">Qty/Kanban</th>
                          <th className="text-left font-medium px-4 py-3">UOM</th>
                          <th className="text-left font-medium px-4 py-3">Weight (kg)</th>
                          <th className="text-left font-medium px-4 py-3">Lokasi</th>
                          <th className="text-left font-medium px-4 py-3">Type</th>
                          <th className="text-left font-medium px-4 py-3">Cycle (days)</th>
                          <th className="text-left font-medium px-4 py-3">Status</th>
                          <th className="text-right font-medium px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {indirectRows.map((r) => (
                          <tr key={r.key} className="text-gray-800">
                            <td className="px-4 py-4 whitespace-nowrap">{r.productModel}</td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.partName}</td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.partNumber}</td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.gradeSize}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-blue-600 font-semibold">{r.qtyPerKanban}</td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.uom}</td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.weightKg}</td>
                            <td className="px-4 py-4 whitespace-nowrap">{r.location}</td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-100">
                                {r.type}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                {r.cycleDays}d
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 border border-green-100">
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-3 text-gray-500">
                                <button type="button" onClick={() => startIndirectEdit(r)} className="hover:text-gray-700" aria-label="Edit">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button type="button" onClick={() => removeIndirectRow(r.key)} className="hover:text-red-600" aria-label="Trash">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11v6M14 11v6" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              onClick={() => router.push("/master-supplier")}
            >
              <LeftOutlined />
              <span>Back to Master Supplier List</span>
            </button>

            <div className="flex items-center gap-2">
              <Button onClick={() => router.push("/master-supplier")}>Cancel</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
                Create Master Item
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">Add Master Supplier Item</div>
            <div className="text-sm text-gray-500">Create supplier master data with delivery cycles and specifications</div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-gray-900">Step 1: Select Supplier</div>
                <div className="text-sm text-gray-500">Configure supplier details</div>
              </div>
              <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">Required</Tag>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-700 mb-2">Supplier Name</div>
                <Select
                  value={selectedSupplier}
                  onChange={(v) => {
                    setSelectedSupplier(v);
                    ensureUniqInDraft();
                  }}
                  placeholder="Select supplier"
                  options={SUPPLIERS.map((s) => ({ label: s.label, value: s.value }))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="text-sm text-gray-700 mb-2">Supplier ID</div>
                <Input value={supplierId} placeholder="Auto-filled from supplier selection" disabled />
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl" bodyStyle={{ padding: 24 }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-gray-900">Step 2: Input Data</div>
                <div className="text-sm text-gray-500">Configure product codes and identification information</div>
              </div>
              <Tag className="rounded-full bg-blue-50 text-blue-700 border border-blue-100">Required</Tag>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Sebanggo (Assembly Code)</div>
                  <Input
                    value={draft.sebanggo}
                    onChange={(e) => setDraft((p) => ({ ...p, sebanggo: e.target.value }))}
                    placeholder="Enter assembly code (e.g., ASM-LV7-01)"
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-700 mb-2">Uniq</div>
                  <Input value={draft.uniq} placeholder="Auto-generated" disabled />
                </div>
                <div>
                  <div className="text-sm text-gray-700 mb-2">Customer Cycle</div>
                  <Input
                    value={draft.customerCycle}
                    onChange={(e) => setDraft((p) => ({ ...p, customerCycle: e.target.value }))}
                    placeholder="Enter Cycle"
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-700 mb-2">Quantity</div>
                  <InputNumber
                    value={draft.quantity}
                    onChange={(v) => setDraft((p) => ({ ...p, quantity: v ?? undefined }))}
                    placeholder="Enter Quantity"
                    className="w-full"
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <div className="text-sm text-gray-700 mb-2">Type</div>
                  <Input value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))} placeholder="Enter Type" />
                </div>
                <div className="lg:col-span-2">
                  <div className="text-sm text-gray-700 mb-2">Description</div>
                  <Input
                    value={draft.description}
                    onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Enter Description"
                  />
                </div>
                <div>
                  <Button type="primary" icon={<PlusOutlined />} onClick={upsertRow} className="w-full">
                    {editingKey ? "Update Data" : "Add Data"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div>
                  <div className="text-xs text-gray-500">Supplier Name</div>
                  <div className="text-sm font-medium text-gray-900">{selectedSupplier ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total Uniq Added</div>
                  <div className="text-sm font-medium text-gray-900">{totalUniqAdded}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total Quantity</div>
                  <div className="text-sm font-medium text-gray-900">{totalQuantity.toLocaleString()}</div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left font-medium px-4 py-3">Sebango</th>
                        <th className="text-left font-medium px-4 py-3">Uniq</th>
                        <th className="text-left font-medium px-4 py-3">Material Info</th>
                        <th className="text-left font-medium px-4 py-3">Type</th>
                        <th className="text-left font-medium px-4 py-3">Grade/Size</th>
                        <th className="text-left font-medium px-4 py-3">Quantity</th>
                        <th className="text-left font-medium px-4 py-3">UoM</th>
                        <th className="text-left font-medium px-4 py-3">Weight</th>
                        <th className="text-left font-medium px-4 py-3">Cycle</th>
                        <th className="text-left font-medium px-4 py-3">Pcs/Kanban</th>
                        <th className="text-right font-medium px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <tr key={r.key} className="text-gray-800">
                          <td className="px-4 py-4 whitespace-nowrap">{r.sebanggo}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.uniq}</td>
                          <td className="px-4 py-4 min-w-[200px]">
                            <div className="text-[11px] text-gray-500">{r.materialInfo.code}</div>
                            <div className="text-sm font-medium text-gray-900">{r.materialInfo.name}</div>
                            <div className="text-[11px] text-gray-500">{r.materialInfo.model}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.type}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.gradeSize}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.quantity}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.uom}</td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.weight}</td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${r.cycle === "Daily" ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-gray-50 text-gray-700 border-gray-200"}`}>
                              {r.cycle}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">{r.pcsPerKanban}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-3 text-gray-500">
                              <button type="button" onClick={() => startEdit(r)} className="hover:text-gray-700" aria-label="Edit">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button type="button" onClick={() => removeRow(r.key)} className="hover:text-red-600" aria-label="Trash">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11v6M14 11v6" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
