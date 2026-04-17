export type SelectOption = { label: string; value: string };

type BomNodeLike = {
  uniq?: unknown;
  uniq_code?: unknown;
  part_name?: unknown;
  part_number?: unknown;
  model?: unknown;
  product_model?: unknown;
  assembly_code?: unknown;
  raw_material_type?: unknown;
  rawMaterialType?: unknown;
  rm_source?: unknown;
  rmSource?: unknown;
  unit_measurement?: unknown;
  unitMeasurement?: unknown;
  uom?: unknown;
  uom_id?: unknown;
  uomId?: unknown;
  unit?: unknown;
  stock_weight_kg?: unknown;
  stockWeightKg?: unknown;
  weight_kg?: unknown;
  weightKg?: unknown;
  weight?: unknown;
  packing_number?: unknown;
  packingNumber?: unknown;
  packing_no?: unknown;
  packingNo?: unknown;
  kanban?: unknown;
  children?: unknown;
};

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object";

const asNodeLike = (v: unknown): BomNodeLike | null => {
  if (!isRecord(v)) return null;
  return v as BomNodeLike;
};

export type BomUniqIndex = {
  uniqs: string[];
  options: SelectOption[];
  partNameByUniq: Record<string, string>;
  partNumberByUniq: Record<string, string>;
  modelByUniq: Record<string, string>;
  assemblyCodeByUniq: Record<string, string>;
  packingNumberByUniq: Record<string, string>;
  uomByUniq: Record<string, string>;
  rawMaterialTypeByUniq: Record<string, string>;
  rmSourceByUniq: Record<string, string>;
  weightKgByUniq: Record<string, number>;
};

export const buildBomUniqIndex = (tree: unknown): BomUniqIndex => {
  const uniqSet = new Set<string>();
  const partNameByUniq: Record<string, string> = {};
  const partNumberByUniq: Record<string, string> = {};
  const modelByUniq: Record<string, string> = {};
  const assemblyCodeByUniq: Record<string, string> = {};
  const packingNumberByUniq: Record<string, string> = {};
  const uomByUniq: Record<string, string> = {};
  const rawMaterialTypeByUniq: Record<string, string> = {};
  const rmSourceByUniq: Record<string, string> = {};
  const weightKgByUniq: Record<string, number> = {};

  const pickString = (...values: unknown[]): string => {
    for (const v of values) {
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    return "";
  };

  const pickNumber = (...values: unknown[]): number | undefined => {
    for (const v of values) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim()) {
        const parsed = Number(v);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return undefined;
  };

  const visit = (node: unknown) => {
    const n = asNodeLike(node);
    if (!n) return;

    const uniqCandidate =
      typeof n.uniq === "string" && n.uniq.trim()
        ? n.uniq
        : typeof n.uniq_code === "string"
          ? n.uniq_code
          : "";
    const uniq = typeof uniqCandidate === "string" ? uniqCandidate.trim() : "";
    const partName = typeof n.part_name === "string" ? n.part_name.trim() : "";
    const partNumber = typeof n.part_number === "string" ? n.part_number.trim() : "";
    const modelCandidate =
      typeof n.model === "string" && n.model.trim()
        ? n.model
        : typeof n.product_model === "string" && n.product_model.trim()
          ? n.product_model
          : typeof n.assembly_code === "string"
            ? n.assembly_code
            : "";
    const model = typeof modelCandidate === "string" ? modelCandidate.trim() : "";
    const assemblyCode = typeof n.assembly_code === "string" ? n.assembly_code.trim() : "";
    const packingNumberCandidate = [
      n.packing_number,
      n.packingNumber,
      n.packing_no,
      n.packingNo,
      n.kanban,
    ].find((value) => typeof value === "string" && value.trim());
    const packingNumber =
      typeof packingNumberCandidate === "string" ? packingNumberCandidate.trim() : "";

    const uom = pickString(
      n.uom,
      n.unit_measurement,
      n.unitMeasurement,
      n.unit,
      n.uom_id,
      n.uomId
    );
    const rmType = pickString(n.raw_material_type, n.rawMaterialType);
    const rmSource = pickString(n.rm_source, n.rmSource);
    const weightKg = pickNumber(
      n.stock_weight_kg,
      n.stockWeightKg,
      n.weight_kg,
      n.weightKg,
      n.weight
    );
    if (uniq) {
      uniqSet.add(uniq);
      if (partName && !partNameByUniq[uniq]) partNameByUniq[uniq] = partName;
      if (partNumber && !partNumberByUniq[uniq]) partNumberByUniq[uniq] = partNumber;
      if (model && !modelByUniq[uniq]) modelByUniq[uniq] = model;
      if (assemblyCode && !assemblyCodeByUniq[uniq]) assemblyCodeByUniq[uniq] = assemblyCode;
      if (model && !assemblyCodeByUniq[uniq]) assemblyCodeByUniq[uniq] = model;
      if (packingNumber && !packingNumberByUniq[uniq]) {
        packingNumberByUniq[uniq] = packingNumber;
      }
      if (uom && !uomByUniq[uniq]) uomByUniq[uniq] = uom;
      if (rmType && !rawMaterialTypeByUniq[uniq]) rawMaterialTypeByUniq[uniq] = rmType;
      if (rmSource && !rmSourceByUniq[uniq]) rmSourceByUniq[uniq] = rmSource;
      if (typeof weightKg === "number" && !(uniq in weightKgByUniq)) weightKgByUniq[uniq] = weightKg;
    }

    const children = n.children;
    if (Array.isArray(children)) {
      for (const child of children) visit(child);
    }
  };

  if (Array.isArray(tree)) {
    for (const node of tree) visit(node);
  } else {
    visit(tree);
  }

  const uniqs = Array.from(uniqSet).sort((a, b) => a.localeCompare(b));
  const options = uniqs.map((u) => ({ label: u, value: u }));
  return {
    uniqs,
    options,
    partNameByUniq,
    partNumberByUniq,
    modelByUniq,
    assemblyCodeByUniq,
    packingNumberByUniq,
    uomByUniq,
    rawMaterialTypeByUniq,
    rmSourceByUniq,
    weightKgByUniq,
  };
};
