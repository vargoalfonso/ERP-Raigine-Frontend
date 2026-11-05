"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  useGetProcurementPoByIdQuery,
  useUpdateProcurementPoMutation,
  type ProcurementPoType,
} from "@/lib/api/procurement-po/api";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useGetBomTreeQuery,
  useLazyGetBomFullByIdQuery,
  type BomFullNode,
} from "@/lib/api/bom/api";
import {
  useLookupPoBudgetMaterialSpecsMutation,
  type PoBudgetMaterialSpecLookup,
  type PoBudgetType,
} from "@/lib/api/po-budget/api";
import { useAllPoBudgetEntries } from "@/lib/hooks/useAllPoBudgetEntries";
import { getStoredParents } from "@/components/po-budget/poBudgetChildAdapters";

type PoItemRow = {
  key: string;
  parentUniq: string;
  childUniq: string;
  materialGrade: string;
  partNumber: string;
  partName: string;
  form: string;
  /** Spesifikasi material (dari BOM) item ini. */
  gradeText: string;
  typeMaterial: string;
  widthMm: string;
  diameterMm: string;
  thicknessMm: string;
  lengthMm: string;
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

// Material spec dari detail BOM (field yang sama dengan halaman
// /bill-of-material/<id>) diubah ke bentuk PoBudgetMaterialSpecLookup.
const bomSpecToLookup = (
  spec: Record<string, unknown> | null | undefined,
): PoBudgetMaterialSpecLookup => {
  if (!spec || typeof spec !== "object") return {};
  const str = (v: unknown) => {
    const t = String(v ?? "").trim();
    return t && t !== "-" ? t : undefined;
  };
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    material_code: str(spec.material_grade) ?? str(spec.material_code),
    grade: str(spec.grade),
    type_material: str(spec.type_material) ?? str(spec.material_type),
    form: str(spec.form),
    width_mm: num(spec.width_mm),
    diameter_mm: num(spec.diameter_mm),
    thickness_mm: num(spec.thickness_mm),
    length_mm: num(spec.length_mm),
  };
};

// Nilai spesifikasi material: utamakan hasil lookup BOM (selalu lengkap),
// lalu spec yang tersimpan di detail budget/PO bila lookup tidak punya.
const specValue = (
  lookup: PoBudgetMaterialSpecLookup | undefined,
  stored: Record<string, unknown> | undefined,
  key: keyof PoBudgetMaterialSpecLookup,
): string => {
  const fromLookup = lookup?.[key];
  if (fromLookup != null && String(fromLookup).trim() !== "") {
    return typeof fromLookup === "number"
      ? String(Number(fromLookup.toFixed(4)))
      : String(fromLookup);
  }
  const value = stored?.[key];
  if (value == null || String(value).trim() === "" || Number(value) === 0) {
    return "-";
  }
  const num = Number(value);
  return Number.isFinite(num) && typeof value !== "string"
    ? String(Number(num.toFixed(4)))
    : String(value);
};

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
  const [updatePo, updatePoState] = useUpdateProcurementPoMutation();

  // Mode edit: /po-procurement/create?tab=raw&edit=<po_id>
  const editId = searchParams.get("edit");
  const isEdit = Boolean(editId);
  const poDetailQuery = useGetProcurementPoByIdQuery(editId ?? "", {
    skip: !isEdit || !apiEnabled,
  });

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

  // Prefill dari data PO yang pernah diinput (mode edit).
  const hydratedRef = useRef(false);
  // True setelah daftar budget termuat & entry lama dicocokkan; sebelum itu grup PO
  // yang tampil belum final, jadi External PO Number belum boleh diisi.
  const [editResolved, setEditResolved] = useState(false);
  const subtypeCheckedRef = useRef(false);
  const pendingExternalRef = useRef<{
    raw: string;
    stage?: number;
    supplier?: string;
  } | null>(null);
  const editBudgetIds = useRef<number[]>([]);
  const editBudgetRefs = useRef<string[]>([]);
  const editRefIds = useRef<number[]>([]);
  const editPeriodRaw = useRef<string>("");

  useEffect(() => {
    if (!isEdit || hydratedRef.current) return;
    const po = poDetailQuery.data?.data?.po;
    if (!po) return;
    hydratedRef.current = true;

    const rawPeriod = String(po.period ?? po.month ?? "").trim();
    if (rawPeriod) {
      const strict = dayjs(rawPeriod, ["MMMM YYYY", "YYYY-MM", "MM/YYYY"], true);
      const parsed = strict.isValid() ? strict : dayjs(rawPeriod);
      if (parsed.isValid()) setPeriod(parsed);
    }

    const ids = (po.po_budget_entry_ids ?? [])
      .map((v) => Number(v))
      .filter(Number.isFinite);
    editBudgetIds.current = ids;
    editBudgetRefs.current = String(po.po_budget_ref ?? "")
      .split(/[,|;]/)
      .map((v) => v.trim())
      .filter(Boolean);
    editPeriodRaw.current = rawPeriod;
    // Backend kadang hanya mengirim po_budget_ref (mis. POB-2026-RAW_MATERIAL-74)
    // tanpa po_budget_entry_ids; angka di akhir ref adalah id entry budget-nya.
    editRefIds.current = editBudgetRefs.current
      .map((ref) => Number(ref.match(/-(\d+)$/)?.[1]))
      .filter((n) => Number.isFinite(n) && n > 0);
    setSelectedBudgetIds(ids.length ? ids : editRefIds.current);

    if (po.generate_mode) setGenerateMode(po.generate_mode);
    if (po.external_system) setExternalSystem(po.external_system);
    if (po.external_po_number) {
      pendingExternalRef.current = {
        raw: po.external_po_number,
        stage: po.po_stage,
        supplier: po.supplier_name,
      };
    }
  }, [isEdit, poDetailQuery.data]);

  // Loads incrementally (100 at a time) instead of stopping at the first
  // page (limit=100), so the PR Budget dropdown eventually shows everything.
  const poBudgetEntries = useAllPoBudgetEntries(
    poBudgetType,
    budgetSubtype,
    apiEnabled,
  );

  // Edit: daftar budget jenis lainnya (adhoc/regular) dimuat juga, karena PO tidak
  // menyimpan jenis budget-nya. Dipakai untuk mencari entry yang dulu dipilih.
  const otherSubtype: BudgetSubtype = budgetSubtype === "adhoc" ? "regular" : "adhoc";
  const otherBudgetEntries = useAllPoBudgetEntries(
    poBudgetType,
    otherSubtype,
    apiEnabled && isEdit,
  );

  // Edit (tahap 2): setelah daftar budget termuat, cocokkan entry yang dulu dipilih
  // (lewat id, atau lewat po_budget_ref kalau id tidak dikirim backend), lalu set
  // jenis budget + period mengikuti entry tersebut supaya semuanya langsung tampil.
  useEffect(() => {
    if (!isEdit || !hydratedRef.current || subtypeCheckedRef.current) return;
    const lists = [
      { subtype: budgetSubtype, state: poBudgetEntries },
      { subtype: otherSubtype, state: otherBudgetEntries },
    ];
    if (lists.some((l) => l.state.isFetching || l.state.isFetchingMore)) return;
    subtypeCheckedRef.current = true;
    setEditResolved(true);

    const ids = new Set(
      editBudgetIds.current.length ? editBudgetIds.current : editRefIds.current,
    );
    const refs = new Set(editBudgetRefs.current);

    let found: { subtype: BudgetSubtype; rows: typeof poBudgetEntries.items } | null =
      null;
    for (const l of lists) {
      const rows = l.state.items.filter((row) => {
        const rowId = Number(row.id ?? row.key);
        if (ids.has(rowId)) return true;
        return Boolean(row.poBudgetRef) && refs.has(String(row.poBudgetRef));
      });
      if (rows.length > 0) {
        found = { subtype: l.subtype, rows };
        break;
      }
    }

    if (!found) {
      // Entry tidak ada di daftar budget (mis. sudah dipakai). Pilihan tetap diisi
      // dari data PO, dan preview diambil dari item PO itu sendiri.
      if (ids.size === 0) {
        message.warning(
          "Data budget PO sebelumnya tidak ditemukan, silakan pilih ulang.",
        );
      }
      return;
    }

    setBudgetSubtype(found.subtype);
    setSelectedBudgetIds(found.rows.map((row) => Number(row.id ?? row.key)));

    // Period mengikuti period entry budget agar entry tidak tersaring.
    const rowPeriod = String(found.rows[0].period ?? "").trim();
    if (rowPeriod) {
      const strict = dayjs(rowPeriod, ["MMMM YYYY", "YYYY-MM", "MM/YYYY"], true);
      const parsed = strict.isValid() ? strict : dayjs(rowPeriod);
      if (parsed.isValid()) setPeriod(parsed);
    }
  }, [
    isEdit,
    budgetSubtype,
    otherSubtype,
    poDetailQuery.data,
    poBudgetEntries,
    otherBudgetEntries,
  ]);

  // Only budget entries whose period matches the Period selected in Step 1 are
  // eligible — the backend generate call filters by period too, so surfacing
  // other periods here would let the user pick entries that can never generate.
  const periodKey = useMemo(
    () => (period ? period.format("MMMM YYYY") : ""),
    [period],
  );

  const budgetRowsForPeriod = useMemo(() => {
    const rows = poBudgetEntries.items;
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
  }, [budgetSubtype, poBudgetEntries.items, periodKey]);

  // Material Code (BOM) per uniq child. Nilai material_grade yang tersimpan di
  // detail budget/PO bisa berisi uniq sebagai pengganti grade, jadi diambil
  // dari backend (POST /po-budget/material-codes) dan dipakai bila ada.
  const [lookupMaterialSpecs] = useLookupPoBudgetMaterialSpecsMutation();
  const [materialSpecByUniq, setMaterialSpecByUniq] = useState<
    Record<string, PoBudgetMaterialSpecLookup>
  >({});
  const requestedMaterialUniqsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!apiEnabled) return;

    const wanted = new Set<string>();
    const addCode = (value: unknown) => {
      const code = String(value ?? "").trim();
      if (code && code !== "-") wanted.add(code);
    };

    budgetRowsForPeriod
      .filter((row) => selectedBudgetIds.includes(Number(row.id ?? row.key)))
      .forEach((row) =>
        getStoredParents(row.detailJson).forEach((parent) =>
          (Array.isArray(parent.children) ? parent.children : []).forEach(
            (child) => addCode(child.uniq_code),
          ),
        ),
      );
    (poDetailQuery.data?.data?.items ?? []).forEach((it) =>
      addCode(it.child_uniq_code),
    );

    const missing = Array.from(wanted).filter(
      (code) => !requestedMaterialUniqsRef.current.has(code),
    );
    if (missing.length === 0) return;
    missing.forEach((code) => requestedMaterialUniqsRef.current.add(code));

    lookupMaterialSpecs(missing)
      .unwrap()
      .then((map) => setMaterialSpecByUniq((prev) => ({ ...prev, ...map })))
      .catch((error) => {
        missing.forEach((code) =>
          requestedMaterialUniqsRef.current.delete(code),
        );
        console.error("[po-create] material code lookup failed", error);
      });
  }, [
    apiEnabled,
    budgetRowsForPeriod,
    selectedBudgetIds,
    poDetailQuery.data,
    lookupMaterialSpecs,
  ]);

  // ── Material spec dari detail BOM ────────────────────────────────────────
  // Sumber utama spesifikasi material: detail BOM TIAP uniq (parent dan setiap
  // item/child punya BOM sendiri; endpoint yang sama dengan halaman
  // /bill-of-material/<id>). material_spec node utama BOM itu dipakai untuk
  // uniq-nya. Spec dari node child di dalam BOM parent hanya cadangan, lalu
  // lookup backend.
  const { data: bomTreeRes } = useGetBomTreeQuery(undefined, {
    skip: !apiEnabled,
  });
  const [triggerBomFull] = useLazyGetBomFullByIdQuery();
  // Spec node utama BOM milik uniq itu sendiri (prioritas).
  const [bomSpecByUniq, setBomSpecByUniq] = useState<
    Record<string, PoBudgetMaterialSpecLookup>
  >({});
  // Spec node child di dalam BOM parent (cadangan).
  const [bomChildSpecByUniq, setBomChildSpecByUniq] = useState<
    Record<string, PoBudgetMaterialSpecLookup>
  >({});
  const bomRequestedRef = useRef<Set<string>>(new Set());

  const bomIdByUniq = useMemo(() => {
    const map: Record<string, string> = {};
    const raw = bomTreeRes?.data as unknown;
    const rootItems = (raw as { items?: unknown[] } | undefined)?.items;
    const nodes: unknown[] = Array.isArray(rootItems)
      ? rootItems
      : Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object"
          ? [raw]
          : [];
    const walk = (list: unknown[], top: boolean) => {
      for (const item of list) {
        const n = item as Record<string, unknown>;
        const uniq = String(n?.uniq_code ?? n?.uniq ?? "")
          .trim()
          .toLowerCase();
        const bomId =
          String(n?.bom_id ?? "").trim() ||
          (top ? String(n?.id ?? "").trim() : "");
        if (uniq && bomId && !map[uniq]) map[uniq] = bomId;
        if (!top && Array.isArray(n?.children)) {
          walk(n.children as unknown[], false);
        }
      }
    };
    // Node level atas = BOM milik uniq itu sendiri, jadi didahulukan. Node
    // bersarang hanya dipakai bila uniq tersebut tidak punya BOM level atas.
    walk(nodes, true);
    const nested = (list: unknown[]) => {
      for (const item of list) {
        const n = item as Record<string, unknown>;
        if (Array.isArray(n?.children)) {
          walk(n.children as unknown[], false);
        }
      }
    };
    nested(nodes);
    return map;
  }, [bomTreeRes?.data]);

  useEffect(() => {
    if (!apiEnabled || Object.keys(bomIdByUniq).length === 0) return;

    // Semua uniq yang spec-nya dibutuhkan: parent dan tiap item (child).
    const uniqs = new Set<string>();
    const add = (value: unknown) => {
      const code = String(value ?? "").trim();
      if (code && code !== "-") uniqs.add(code);
    };
    budgetRowsForPeriod
      .filter((row) => selectedBudgetIds.includes(Number(row.id ?? row.key)))
      .forEach((row) => {
        const stored = getStoredParents(row.detailJson);
        if (stored.length === 0) add(row.uniq);
        stored.forEach((parent) => {
          add(parent.uniq_code ?? row.uniq);
          (Array.isArray(parent.children) ? parent.children : []).forEach(
            (child) => add(child.uniq_code),
          );
        });
      });
    (poDetailQuery.data?.data?.items ?? []).forEach((it) => {
      add(it.uniq_code);
      add(it.child_uniq_code);
    });

    uniqs.forEach((uniq) => {
      const key = uniq.toLowerCase();
      const bomId = bomIdByUniq[key];
      if (!bomId || bomRequestedRef.current.has(key)) return;
      bomRequestedRef.current.add(key);

      triggerBomFull(bomId, true)
        .unwrap()
        .then((res) => {
          const root = ((res as { data?: BomFullNode })?.data ??
            res) as BomFullNode;
          const hasValue = (spec: PoBudgetMaterialSpecLookup) =>
            Object.values(spec).some((v) => v !== undefined);

          // Node utama BOM = spec milik uniq ini (sama dengan Material Spec
          // di halaman detail BOM).
          const own = bomSpecToLookup(root?.material_spec);
          const rootUniq = String(root?.uniq_code ?? "").trim().toLowerCase();
          // Pastikan BOM yang dimuat memang milik uniq ini.
          if (hasValue(own) && (!rootUniq || rootUniq === key)) {
            setBomSpecByUniq((prev) => ({ ...prev, [key]: own }));
          }

          // Node child di dalam BOM ini: cadangan untuk uniq yang tidak punya
          // BOM sendiri.
          const childFound: Record<string, PoBudgetMaterialSpecLookup> = {};
          const walk = (nodes: BomFullNode[] | undefined) => {
            (nodes ?? []).forEach((node) => {
              const childKey = String(node.uniq_code ?? "")
                .trim()
                .toLowerCase();
              const spec = bomSpecToLookup(node.material_spec);
              if (childKey && hasValue(spec)) childFound[childKey] = spec;
              walk(node.children);
            });
          };
          walk(root?.children);
          if (Object.keys(childFound).length > 0) {
            setBomChildSpecByUniq((prev) => ({ ...childFound, ...prev }));
          }
        })
        .catch((error) => {
          bomRequestedRef.current.delete(key);
          console.error("[po-create] BOM detail load failed", error);
        });
    });
  }, [
    apiEnabled,
    bomIdByUniq,
    budgetRowsForPeriod,
    selectedBudgetIds,
    poDetailQuery.data,
    triggerBomFull,
  ]);

  // Spec final per uniq. Urutan prioritas per field: detail BOM milik uniq itu
  // -> node child di BOM parent -> lookup backend.
  const resolveMaterialSpec = useCallback(
    (uniq: unknown): PoBudgetMaterialSpecLookup | undefined => {
      const key = String(uniq ?? "").trim();
      if (!key) return undefined;
      const layers = [
        materialSpecByUniq[key],
        bomChildSpecByUniq[key.toLowerCase()],
        bomSpecByUniq[key.toLowerCase()],
      ];
      if (!layers.some(Boolean)) return undefined;
      const merged: Record<string, unknown> = {};
      layers.forEach((layer) => {
        if (!layer) return;
        (Object.keys(layer) as (keyof PoBudgetMaterialSpecLookup)[]).forEach(
          (field) => {
            if (layer[field] !== undefined) merged[field] = layer[field];
          },
        );
      });
      return merged as PoBudgetMaterialSpecLookup;
    },
    [bomSpecByUniq, bomChildSpecByUniq, materialSpecByUniq],
  );

  const poBudgetOptions = useMemo<{ label: string; value: number }[]>(() => {
    if (!apiEnabled) {
      return [
        { label: "PO Budget Mock 1", value: 1 },
        { label: "PO Budget Mock 2", value: 2 },
      ];
    }

    const options = budgetRowsForPeriod.map((row) => ({
      label: `${row.poBudgetRef ?? row.id ?? row.key} - ${row.uniq} - ${row.supplier}`,
      value: Number(row.id ?? row.key),
    }));
    // Pilihan yang belum ada di daftar (mis. daftar masih dimuat) tetap tampil
    // dengan label sementara, bukan angka mentah.
    const known = new Set(options.map((o) => o.value));
    for (const id of selectedBudgetIds) {
      if (!known.has(id)) {
        const refs = editBudgetRefs.current;
        options.push({
          label: refs.length === 1 ? refs[0] : `Budget entry #${id}`,
          value: id,
        });
      }
    }
    return options;
  }, [apiEnabled, budgetRowsForPeriod, selectedBudgetIds]);

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
  const computedSupplierGroups: PoSupplierGroup[] = useMemo(() => {
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

        // Entry tanpa breakdown children (mis. subcon): backend memakai
        // po1_qty / po2_qty entry itu sendiri, jadi preview-nya juga satu
        // baris dari entry, bukan dari detail_jsonb.
        const hasChildren = parents.some(
          (p) => Array.isArray(p.children) && p.children.length > 0,
        );
        if (!hasChildren) {
          const flatQty = Math.round(
            (stage === 1 ? row.po1 : row.po2) ||
              ((row.pr || 0) * (pct || 0)) / 100,
          );
          if (flatQty > 0) {
            items.push({
              key: `s${stage}-${row.id ?? row.key}-${seq++}`,
              parentUniq: String(row.uniq ?? "-"),
              childUniq: "-",
              materialGrade: String(row.uniq ?? "-"),
              partNumber: String(row.partNumber ?? "-"),
              partName: String(row.partName ?? "-"),
              form: "-",
              gradeText: "-",
              typeMaterial: "-",
              widthMm: "-",
              diameterMm: "-",
              thicknessMm: "-",
              lengthMm: "-",
              supplier: String(row.supplier || "-"),
              qty: flatQty,
              uom: String(row.uom ?? "-"),
              weightKg: Number(row.weightKg ?? 0),
            });
          }
          continue;
        }

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

            const lookup = resolveMaterialSpec(child.uniq_code);
            items.push({
              key: `s${stage}-${row.id ?? row.key}-${seq++}`,
              parentUniq: String(parent.uniq_code ?? row.uniq ?? "-"),
              childUniq: String(child.uniq_code ?? "-"),
              materialGrade: String(
                lookup?.material_code ??
                  childSpec.material_grade ??
                  child.uniq ??
                  child.uniq_code ??
                  "-",
              ),
              partNumber: String(child.part_number ?? "-"),
              partName: String(child.part_name ?? "-"),
              form: specValue(lookup, childSpec, "form"),
              gradeText: specValue(lookup, childSpec, "grade"),
              typeMaterial: specValue(lookup, childSpec, "type_material"),
              widthMm: specValue(lookup, childSpec, "width_mm"),
              diameterMm: specValue(lookup, childSpec, "diameter_mm"),
              thicknessMm: specValue(lookup, childSpec, "thickness_mm"),
              lengthMm: specValue(lookup, childSpec, "length_mm"),
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
  }, [budgetRowsForPeriod, selectedBudgetIds, generateMode, resolveMaterialSpec]);

  // Edit: kalau entry budget tidak bisa dihitung ulang (tidak ada di daftar budget),
  // tampilkan item dari PO yang tersimpan supaya datanya tetap terisi.
  const poSupplierGroups: PoSupplierGroup[] = useMemo(() => {
    if (computedSupplierGroups.length > 0 || !isEdit) return computedSupplierGroups;
    if (!editResolved) return computedSupplierGroups;
    const detail = poDetailQuery.data?.data;
    if (!detail || detail.items.length === 0) return computedSupplierGroups;

    const stage: 1 | 2 = detail.po.po_stage === 2 ? 2 : 1;
    const supplier = detail.po.supplier_name ?? "-";
    const items: PoItemRow[] = detail.items.map((it, idx) => {
      const lookup = resolveMaterialSpec(it.child_uniq_code);
      const storedSpec = (it.material_spec ?? {}) as Record<string, unknown>;
      return {
      key: `po-${stage}-${idx}`,
      parentUniq: String(it.uniq_code ?? "-"),
      childUniq: String(it.child_uniq_code ?? "-"),
      materialGrade: String(
        lookup?.material_code ??
          it.material_grade ??
          it.child_uniq_code ??
          it.uniq_code ??
          "-",
      ),
      partNumber: String(it.part_number ?? "-"),
      partName: String(it.part_name ?? "-"),
      form: specValue(lookup, storedSpec, "form"),
      gradeText: specValue(lookup, storedSpec, "grade"),
      typeMaterial: specValue(lookup, storedSpec, "type_material"),
      widthMm: specValue(lookup, storedSpec, "width_mm"),
      diameterMm: specValue(lookup, storedSpec, "diameter_mm"),
      thicknessMm: specValue(lookup, storedSpec, "thickness_mm"),
      lengthMm: specValue(lookup, storedSpec, "length_mm"),
      supplier,
      qty: Number(it.qty ?? 0),
      uom: String(it.uom ?? "-"),
      weightKg: Number(it.weight_kg ?? 0),
      };
    });
    return [
      {
        key: `s${stage}::${supplier}`,
        stage,
        supplier,
        label: `PO ${stage} (${supplier})`,
        items,
        totalQty: items.reduce((sum, r) => sum + r.qty, 0),
      },
    ];
  }, [
    computedSupplierGroups,
    isEdit,
    editResolved,
    poDetailQuery.data,
    resolveMaterialSpec,
  ]);

  // Edit: isi kembali External PO Number (Zahir) ke grup stage+supplier yang sesuai.
  useEffect(() => {
    const pending = pendingExternalRef.current;
    if (!pending || poSupplierGroups.length === 0) return;
    if (isEdit && !editResolved) return;
    pendingExternalRef.current = null;

    const parts = pending.raw
      .split("|")
      .map((v) => v.trim())
      .filter(Boolean);
    const next: Record<string, string> = {};
    const ownKey =
      pending.stage && pending.supplier
        ? `s${pending.stage}::${pending.supplier}`
        : undefined;
    if (ownKey && parts.length <= 1 && poSupplierGroups.some((g) => g.key === ownKey)) {
      next[ownKey] = parts[0] ?? "";
    } else if (poSupplierGroups.length === 1) {
      // Satu grup tapi tersimpan beberapa nomor (digabung " | "): isi semuanya.
      next[poSupplierGroups[0].key] = parts.join(" | ");
    } else {
      poSupplierGroups.forEach((g, i) => {
        if (parts[i]) next[g.key] = parts[i];
      });
    }
    setExternalPoNumbers(next);
  }, [poSupplierGroups, isEdit, editResolved]);

  const columns: ColumnsType<PoItemRow> = [
    // Tab raw & indirect: kolom Parent UNIQ, Uniq, Part Name, dan Part Number
    // di-comment (tidak ditampilkan). Subcon tetap memakai Parent UNIQ,
    // Part Name, dan Part Number.
    ...(poType === "subcon"
      ? ([
          {
            title: "Parent UNIQ",
            dataIndex: "parentUniq",
            key: "parentUniq",
            width: 110,
          },
        ] as ColumnsType<PoItemRow>)
      : []),
    // {
    //   // Uniq tiap item (child) - raw & indirect.
    //   title: "Uniq",
    //   dataIndex: "childUniq",
    //   key: "childUniq",
    //   width: 90,
    //   render: (v: string) => (
    //     <span className="text-sm font-medium text-gray-800">{v}</span>
    //   ),
    // },
    {
      title: "Material Code",
      dataIndex: "materialGrade",
      key: "materialGrade",
      width: 130,
      render: (v: string, r) => (
        <div>
          <span className="text-sm font-medium text-gray-800">{v}</span>
          {r.childUniq && r.childUniq !== "-" ? (
            <div className="text-[11px] text-gray-400"></div>
          ) : null}
        </div>
      ),
    },
    // Part Name & Part Number: hanya subcon (raw & indirect di-comment).
    ...(poType === "subcon"
      ? ([
          { title: "Part Name", dataIndex: "partName", key: "partName", width: 160 },
          {
            title: "Part Number",
            dataIndex: "partNumber",
            key: "partNumber",
            width: 120,
          },
        ] as ColumnsType<PoItemRow>)
      : []),
    // { title: "Part Name", dataIndex: "partName", key: "partName", width: 160 },
    // {
    //   title: "Part Number",
    //   dataIndex: "partNumber",
    //   key: "partNumber",
    //   width: 120,
    // },
    { title: "Form", dataIndex: "form", key: "form", width: 90 },
    // Spesifikasi material item (raw & indirect). Subcon tidak memakainya.
    ...(poType === "subcon"
      ? []
      : ([
          { title: "Grade", dataIndex: "gradeText", key: "gradeText", width: 110 },
          {
            title: "Type Material",
            dataIndex: "typeMaterial",
            key: "typeMaterial",
            width: 120,
          },
          {
            title: "Width (mm)",
            dataIndex: "widthMm",
            key: "widthMm",
            width: 110,
            align: "right",
          },
          {
            title: "Diameter (mm)",
            dataIndex: "diameterMm",
            key: "diameterMm",
            width: 125,
            align: "right",
          },
          {
            title: "Thickness (mm)",
            dataIndex: "thicknessMm",
            key: "thicknessMm",
            width: 130,
            align: "right",
          },
          {
            title: "Length (mm)",
            dataIndex: "lengthMm",
            key: "lengthMm",
            width: 115,
            align: "right",
          },
        ] as ColumnsType<PoItemRow>)),
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
      message.success(isEdit ? "PO updated (mock)" : "PO saved (mock)");
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

      const body = {
        po_type: poType,
        period: period.format("MMMM YYYY"),
        po_budget_entry_ids: selectedBudgetIds,
        external_system: externalSystem,
        external_po_number: combinedExternalPoNumber,
        generate_mode: generateMode,
      };

      if (isEdit && editId) {
        await updatePo({ po_id: editId, body }).unwrap();
        message.success("PO updated successfully");
      } else {
        await generatePo(body).unwrap();
        message.success("PO generated successfully");
      }
      router.replace(returnUrl);
      router.refresh();
    } catch (e) {
      message.error(
        getApiErrorMessage(e, isEdit ? "Failed to update PO" : "Failed to generate PO"),
      );
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
            loading={generatePoState.isLoading || updatePoState.isLoading}
            disabled={isEdit && poDetailQuery.isFetching}
          >
            {isEdit ? "Update PO" : "Save PO"}
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-xl font-bold text-gray-900">
            {isEdit ? "Edit Purchase Order" : "PO Procurement Management"}
          </div>
          <div className="text-sm text-gray-500">
            {isEdit
              ? `Edit PO ${poDetailQuery.data?.data?.po?.po_number ?? editId} - data sebelumnya sudah terisi`
              : "Generate purchase order from PO Budget entries"}
          </div>
          {isEdit && poDetailQuery.isFetching ? (
            <div className="mt-1 text-xs text-gray-400">Loading PO data…</div>
          ) : null}
          {isEdit && poDetailQuery.isError ? (
            <div className="mt-1 text-xs text-red-500">
              Failed to load PO data
            </div>
          ) : null}
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
                loading={poBudgetEntries.isFetching}
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
