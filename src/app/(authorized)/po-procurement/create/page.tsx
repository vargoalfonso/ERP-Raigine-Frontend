"use client";

import { Suspense, useMemo, useState } from "react";
import {
  Button,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { LeftOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs, { Dayjs } from "dayjs";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  useGenerateProcurementPoMutation,
  type ProcurementPoType,
} from "@/lib/api/procurement-po/api";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useGetPoBudgetListQuery,
  type PoBudgetType,
} from "@/lib/api/po-budget/api";
import { getStoredParents } from "@/components/po-budget/poBudgetChildAdapters";

type PoItemRow = {
  key: string;
  parentUniq: string;
  childUniq: string;
  materialGrade: string;
  partNumber: string;
  partName: string;
  form: string;
  supplier: string;
  qty: number;
  uom: string;
  weightKg: number;
};

type PoSupplierGroup = {
  key: string;
  stage: 1 | 2;
  supplier: string;
  label: string;
  items: PoItemRow[];
  totalQty: number;
};

type BudgetSubtype = "adhoc" | "regular";

const specText = (
  spec: Record<string, unknown> | undefined,
  key: string,
): string => {
  const value = spec?.[key];
  if (value == null || value === "") return "-";
  return String(value);
};

const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

const tabToPoType = (tab: string | null): ProcurementPoType => {
  if (tab === "indirect") return "indirect";
  if (tab === "subcon") return "subcon";
  return "raw_material";
};

const procurementTypeToBudgetType = (type: ProcurementPoType): PoBudgetType => {
  if (type === "raw_material") return "raw-material";
  if (type === "subcon") return "subcon";
  return "indirect";
};

const isBudgetSubtype = (value: string | undefined, subtype: BudgetSubtype) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (subtype === "adhoc")
    return normalized === "adhoc" || normalized === "additional";
  return (
    normalized === "regular" || normalized === "kanban" || normalized === ""
  );
};

function CreatePoProcurementPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apiEnabled = Boolean(apiBaseUrl);
  const [generatePo, generatePoState] = useGenerateProcurementPoMutation();

  const poType = useMemo(
    () => tabToPoType(searchParams.get("tab")),
    [searchParams],
  );
  const poBudgetType = useMemo(
    () => procurementTypeToBudgetType(poType),
    [poType],
  );
  const returnUrl = useMemo(() => {
    const tab = searchParams.get("tab");
    if (!tab) return "/po-procurement";
    return `/po-procurement?tab=${encodeURIComponent(tab)}`;
  }, [searchParams]);

  const [period, setPeriod] = useState<Dayjs | null>(dayjs(new Date()));
  const [totalIncoming, setTotalIncoming] = useState<number>(0);
  const [dnCreated, setDnCreated] = useState<number>(0);
  const [dnIncoming, setDnIncoming] = useState<number>(0);

  const [selectedBudgetIds, setSelectedBudgetIds] = useState<number[]>([]);
  const [budgetSubtype, setBudgetSubtype] = useState<BudgetSubtype>("adhoc");
  const [externalSystem, setExternalSystem] = useState<string>("zahir");
  // External PO (Zahir) number per PO-stage + supplier group, keyed by group key.
  const [externalPoNumbers, setExternalPoNumbers] = useState<
    Record<string, string>
  >({});
  const [generateMode, setGenerateMode] = useState<string>("both_stages");

  const poBudgetQuery = useGetPoBudgetListQuery(
    { type: poBudgetType, page: 1, limit: 100, budgetSubtype },
    { skip: !apiEnabled },
  );

  // Only budget entries whose period matches the Period selected in Step 1 are
  // eligible — the backend generate call filters by period too, so surfacing
  // other periods here would let the user pick entries that can never generate.
  const periodKey = useMemo(
    () => (period ? period.format("MMMM YYYY") : ""),
    [period],
  );

  const budgetRowsForPeriod = useMemo(() => {
    const rows = poBudgetQuery.data?.data ?? [];
    if (!periodKey) return rows;
    return rows.filter((row) => {
      if (!isBudgetSubtype(row.budgetSubtype || row.type, budgetSubtype))
        return false;

      const rowPeriod = String(row.period ?? "").trim();
      if (!rowPeriod) return false;
      // Compare on month+year so "July 2026" and "2026-07" both line up.
      const rowMonth = dayjs(
        rowPeriod,
        ["MMMM YYYY", "YYYY-MM", "MM/YYYY"],
        true,
      );
      const parsed = rowMonth.isValid() ? rowMonth : dayjs(rowPeriod);
      return parsed.isValid()
        ? parsed.format("MMMM YYYY") === periodKey
        : rowPeriod === periodKey;
    });
  }, [budgetSubtype, poBudgetQuery.data?.data, periodKey]);

  const poBudgetOptions = useMemo<{ label: string; value: number }[]>(() => {
    if (!apiEnabled) {
      return [
        { label: "PO Budget Mock 1", value: 1 },
        { label: "PO Budget Mock 2", value: 2 },
      ];
    }

    return budgetRowsForPeriod.map((row) => ({
      label: `${row.poBudgetRef ?? row.id ?? row.key} - ${row.uniq} - ${row.supplier}`,
      value: Number(row.id ?? row.key),
    }));
  }, [apiEnabled, budgetRowsForPeriod]);

  const poSequenceOptions = useMemo(
    () => [
      { label: "Both Stages", value: "both_stages" },
      { label: "Stage 1", value: "stage_1" },
      { label: "Stage 2", value: "stage_2" },
    ],
    [],
  );

  const budgetSubtypeOptions = useMemo(
    () => [
      { label: "Additional (Adhoc)", value: "adhoc" },
      { label: "Regular / Kanban", value: "regular" },
    ],
    [],
  );

  // Split every selected budget entry's detail_jsonb children into PO1 / PO2
  // preview rows (childQty * pct / 100), then break each stage down per supplier
  // so mixed suppliers render as separate "PO n (Supplier)" groups.
  const poSupplierGroups: PoSupplierGroup[] = useMemo(() => {
    const selectedRows = budgetRowsForPeriod.filter((row) =>
      selectedBudgetIds.includes(Number(row.id ?? row.key)),
    );
    if (!selectedRows.length) return [];

    const buildStageItems = (stage: 1 | 2): PoItemRow[] => {
      const items: PoItemRow[] = [];
      let seq = 0;

      for (const row of selectedRows) {
        const pct = stage === 1 ? row.po1Pct : row.po2Pct;
        const parents = getStoredParents(row.detailJson);

        for (const parent of parents) {
          const children = Array.isArray(parent.children)
            ? parent.children
            : [];
          for (const child of children) {
            const childSpec = (child.material_spec ?? {}) as Record<
              string,
              unknown
            >;
            const childQty = Number(child.quantity ?? child.qty_per_uniq ?? 0);
            const stageQty = Math.round((childQty * (pct || 0)) / 100);
            if (stageQty <= 0) continue;

            const suppliers = Array.isArray(child.suppliers)
              ? child.suppliers
              : [];
            const supplierName =
              suppliers[0]?.supplier_name ?? row.supplier ?? "-";

            items.push({
              key: `s${stage}-${row.id ?? row.key}-${seq++}`,
              parentUniq: String(parent.uniq_code ?? row.uniq ?? "-"),
              childUniq: String(child.uniq_code ?? "-"),
              materialGrade: String(
                child.uniq ??
                  childSpec.material_grade ??
                  child.uniq_code ??
                  "-",
              ),
              partNumber: String(child.part_number ?? "-"),
              partName: String(child.part_name ?? "-"),
              form: specText(childSpec, "form"),
              supplier: String(supplierName),
              qty: stageQty,
              uom: String(child.uom ?? row.uom ?? "-"),
              weightKg: Number(child.weight_kg ?? childSpec.weight_kg ?? 0),
            });
          }
        }
      }

      return items;
    };

    const stages: (1 | 2)[] =
      generateMode === "stage_1"
        ? [1]
        : generateMode === "stage_2"
          ? [2]
          : [1, 2];

    // Build per-stage items once, then order by supplier first and stage second
    // so each supplier's PO1/PO2 stay together:
    // PO1 (Supplier 1), PO2 (Supplier 1), PO1 (Supplier 2), PO2 (Supplier 2)...
    const itemsByStage = new Map<1 | 2, Map<string, PoItemRow[]>>();
    const supplierOrder: string[] = [];
    for (const stage of stages) {
      const bySupplier = new Map<string, PoItemRow[]>();
      for (const item of buildStageItems(stage)) {
        const supplier = item.supplier || "-";
        if (!bySupplier.has(supplier)) bySupplier.set(supplier, []);
        bySupplier.get(supplier)!.push(item);
        // Track first-seen supplier order across all stages.
        if (!supplierOrder.includes(supplier)) supplierOrder.push(supplier);
      }
      itemsByStage.set(stage, bySupplier);
    }

    const groups: PoSupplierGroup[] = [];
    for (const supplier of supplierOrder) {
      for (const stage of stages) {
        const items = itemsByStage.get(stage)?.get(supplier) ?? [];
        if (!items.length) continue;
        groups.push({
          key: `s${stage}::${supplier}`,
          stage,
          supplier,
          label: `PO ${stage} (${supplier})`,
          items,
          totalQty: items.reduce((sum, r) => sum + r.qty, 0),
        });
      }
    }

    return groups;
  }, [budgetRowsForPeriod, selectedBudgetIds, generateMode]);

  const columns: ColumnsType<PoItemRow> = [
    {
      title: "Parent UNIQ",
      dataIndex: "parentUniq",
      key: "parentUniq",
      width: 110,
    },
    {
      title: "Material Grade",
      dataIndex: "materialGrade",
      key: "materialGrade",
      width: 130,
      render: (v: string, r) => (
        <div>
          <span className="text-sm font-medium text-gray-800">{v}</span>
          {r.childUniq && r.childUniq !== "-" ? (
            <div className="text-[11px] text-gray-400">{r.childUniq}</div>
          ) : null}
        </div>
      ),
    },
    { title: "Part Name", dataIndex: "partName", key: "partName", width: 160 },
    {
      title: "Part Number",
      dataIndex: "partNumber",
      key: "partNumber",
      width: 120,
    },
    { title: "Form", dataIndex: "form", key: "form", width: 90 },
    { title: "Supplier", dataIndex: "supplier", key: "supplier", width: 150 },
    {
      title: "Qty",
      dataIndex: "qty",
      key: "qty",
      width: 90,
      align: "right",
      render: (v: number) => (
        <span className="font-medium text-gray-800">{formatNumber(v)}</span>
      ),
    },
    { title: "UoM", dataIndex: "uom", key: "uom", width: 70 },
    {
      title: "Weight (kg)",
      dataIndex: "weightKg",
      key: "weightKg",
      width: 100,
      align: "right",
      render: (v: number) => (
        <span className="text-xs text-gray-700">{formatNumber(v)}</span>
      ),
    },
  ];

  const handleSave = async () => {
    if (!period) {
      message.error("Period is required");
      return;
    }

    if (!selectedBudgetIds.length) {
      message.error("PO Budget entries are required");
      return;
    }

    if (!apiEnabled) {
      message.success("PO saved (mock)");
      router.replace(returnUrl);
      router.refresh();
      return;
    }

    try {
      const combinedExternalPoNumber =
        Object.values(externalPoNumbers)
          .map((value) => value.trim())
          .filter(Boolean)
          .join(" | ") || undefined;

      await generatePo({
        po_type: poType,
        period: period.format("MMMM YYYY"),
        po_budget_entry_ids: selectedBudgetIds,
        external_system: externalSystem,
        external_po_number: combinedExternalPoNumber,
        generate_mode: generateMode,
      }).unwrap();

      message.success("PO generated successfully");
      router.replace(returnUrl);
      router.refresh();
    } catch (e) {
      message.error(getApiErrorMessage(e, "Failed to generate PO"));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.push(returnUrl)}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <LeftOutlined />
          Back to PO Raw Material
        </button>

        <div className="flex items-center gap-2">
          <Button
            className="!rounded-lg"
            onClick={() => router.push(returnUrl)}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            className="!rounded-lg"
            onClick={handleSave}
            loading={generatePoState.isLoading}
          >
            Save PO
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-xl font-bold text-gray-900">
            PO Procurement Management
          </div>
          <div className="text-sm text-gray-500">
            Generate purchase order from PO Budget entries
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Step 1: Input General Data
              </div>
              <div className="text-xs text-gray-500">Input General Data</div>
            </div>
            <Tag
              color="blue"
              className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
            >
              Required
            </Tag>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">
                Period
              </div>
              <DatePicker
                picker="month"
                format="MM/YYYY"
                value={period}
                onChange={(v) => {
                  setPeriod(v);
                  // Entries are period-scoped; clear any selection from the old period.
                  setSelectedBudgetIds([]);
                }}
                className="w-full !rounded-lg"
              />
            </div>

            {/* <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">
                Total Incoming
              </div>
              <InputNumber
                value={totalIncoming}
                onChange={(v) => setTotalIncoming(Number(v ?? 0))}
                className="w-full !rounded-lg"
                min={0}
              />
            </div> */}

            {/* <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">
                DN Created
              </div>
              <InputNumber
                value={dnCreated}
                onChange={(v) => setDnCreated(Number(v ?? 0))}
                className="w-full !rounded-lg"
                min={0}
              />
            </div> */}

            {/* <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">
                DN Incoming
              </div>
              <InputNumber
                value={dnIncoming}
                onChange={(v) => setDnIncoming(Number(v ?? 0))}
                className="w-full !rounded-lg"
                min={0}
              />
            </div> */}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Step 2: Input Data
              </div>
              <div className="text-xs text-gray-500">
                Input Data for each items
              </div>
            </div>
            <Tag
              color="blue"
              className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
            >
              Entry 1
            </Tag>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">
                Budget source
              </div>
              <Select
                value={budgetSubtype}
                onChange={(value) => {
                  setBudgetSubtype(value);
                  setSelectedBudgetIds([]);
                }}
                options={budgetSubtypeOptions}
                placeholder="Select budget source"
                className="w-full"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">
                {budgetSubtype === "adhoc" ? "PRL Adhoc" : "PR Budget"}
              </div>
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                value={selectedBudgetIds}
                onChange={(values) =>
                  setSelectedBudgetIds(
                    values
                      .map((value) => Number(value))
                      .filter(Number.isFinite),
                  )
                }
                options={poBudgetOptions}
                placeholder={
                  budgetSubtype === "adhoc"
                    ? "Select PRL Adhoc entries"
                    : "Select PR Budget entries"
                }
                className="w-full"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">
                Generate Mode
              </div>
              <Select
                value={generateMode}
                onChange={setGenerateMode}
                options={poSequenceOptions}
                placeholder="Select generate mode"
                className="w-full"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">
                External System
              </div>
              <Select
                value={externalSystem}
                onChange={setExternalSystem}
                options={[{ label: "Zahir", value: "zahir" }]}
                placeholder="External system"
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {poSupplierGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Select {budgetSubtype === "adhoc" ? "PRL Adhoc" : "PR Budget"}{" "}
                entries above to preview the PO1 / PO2 child split.
              </div>
            ) : (
              poSupplierGroups.map((g) => (
                <div key={g.key}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold text-gray-900">
                        {g.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {g.items.length} material
                        {g.items.length !== 1 ? "s" : ""} · total qty{" "}
                        <span className="font-semibold text-gray-800">
                          {formatNumber(g.totalQty)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                        External PO Number (Zahir)
                      </div>
                      <Input
                        value={externalPoNumbers[g.key] ?? ""}
                        onChange={(event) =>
                          setExternalPoNumbers((prev) => ({
                            ...prev,
                            [g.key]: event.target.value,
                          }))
                        }
                        placeholder="e.g. ZH-PO-000123"
                        className="!rounded-lg"
                        style={{ width: 220 }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-xl border border-gray-100">
                    <Table<PoItemRow>
                      columns={columns}
                      dataSource={g.items}
                      rowKey="key"
                      size="middle"
                      pagination={false}
                      scroll={{ x: "max-content" }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreatePoProcurementPage() {
  return (
    <Suspense fallback={null}>
      <CreatePoProcurementPageContent />
    </Suspense>
  );
}
