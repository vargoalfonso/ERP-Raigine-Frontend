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
  grade_size?: unknown;
  gradeSize?: unknown;
  model_grade?: unknown;
  modelGrade?: unknown;
  size?: unknown;
  material_code?: unknown;
  material_specifications?: unknown;
  material_spec?: unknown;
  children?: unknown;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object";

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
  gradeSizeByUniq: Record<string, string>;
  packingNumberByUniq: Record<string, string>;
  uomByUniq: Record<string, string>;
  rawMaterialTypeByUniq: Record<string, string>;
  rmSourceByUniq: Record<string, string>;
  weightKgByUniq: Record<string, number>;
  qtyPerUniqByUniq: Record<string, number>;
  childUniqsByUniq: Record<string, string[]>;
  materialSpecByUniq: Record<string, Record<string, unknown>>;
  materialCodeByUniq: Record<string, string>;
  gradeByUniq: Record<string, string>;
  sizeByUniq: Record<string, string>;
  cycleTimeByUniq: Record<string, number>;
  customerCycleByUniq: Record<string, string>;
  // uniq-uniq yang dikelompokkan per material code (dari material specification
  // di BOM). Key = material code (lowercase), value = daftar uniq_code.
  uniqsByMaterialCode: Record<string, string[]>;
};

export const buildBomUniqIndex = (tree: unknown): BomUniqIndex => {
  const uniqSet = new Set<string>();
  const partNameByUniq: Record<string, string> = {};
  const partNumberByUniq: Record<string, string> = {};
  const modelByUniq: Record<string, string> = {};
  const assemblyCodeByUniq: Record<string, string> = {};
  const gradeSizeByUniq: Record<string, string> = {};
  const packingNumberByUniq: Record<string, string> = {};
  const uomByUniq: Record<string, string> = {};
  const rawMaterialTypeByUniq: Record<string, string> = {};
  const rmSourceByUniq: Record<string, string> = {};
  const weightKgByUniq: Record<string, number> = {};
  const qtyPerUniqByUniq: Record<string, number> = {};
  const childUniqsByUniq: Record<string, string[]> = {};
  const materialSpecByUniq: Record<string, Record<string, unknown>> = {};
  const materialCodeByUniq: Record<string, string> = {};
  const gradeByUniq: Record<string, string> = {};
  const sizeByUniq: Record<string, string> = {};
  const cycleTimeByUniq: Record<string, number> = {};
  const customerCycleByUniq: Record<string, string> = {};
  const uniqsByMaterialCode: Record<string, string[]> = {};

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
    const partNumber =
      typeof n.part_number === "string" ? n.part_number.trim() : "";
    const modelCandidate =
      typeof n.model === "string" && n.model.trim()
        ? n.model
        : typeof n.product_model === "string" && n.product_model.trim()
          ? n.product_model
          : typeof n.assembly_code === "string"
            ? n.assembly_code
            : "";
    const model =
      typeof modelCandidate === "string" ? modelCandidate.trim() : "";
    const assemblyCode =
      typeof n.assembly_code === "string" ? n.assembly_code.trim() : "";
    const gradeSize = pickString(
      n.grade_size,
      n.gradeSize,
      n.model_grade,
      n.modelGrade,
      n.size,
    );
    const packingNumberCandidate = [
      n.packing_number,
      n.packingNumber,
      n.packing_no,
      n.packingNo,
      n.kanban,
    ].find((value) => typeof value === "string" && value.trim());
    const packingNumber =
      typeof packingNumberCandidate === "string"
        ? packingNumberCandidate.trim()
        : "";

    const uom = pickString(
      n.uom,
      n.unit_measurement,
      n.unitMeasurement,
      n.unit,
      n.uom_id,
      n.uomId,
    );
    const rmType = pickString(n.raw_material_type, n.rawMaterialType);
    const rmSource = pickString(n.rm_source, n.rmSource);
    const weightKg = pickNumber(
      n.stock_weight_kg,
      n.stockWeightKg,
      n.weight_kg,
      n.weightKg,
      n.weight,
    );
    const qtyPerUniq = pickNumber(
      (n as Record<string, unknown>).qty_per_uniq,
      (n as Record<string, unknown>).qpu,
      (n as Record<string, unknown>).quantity,
    );
    // "Child Uniq" = uniq-uniq yang material code-nya (di material specification)
    // sama dengan material code baris ini. Ambil langsung dari BOM: cek
    // material_code / material_grade di material spec tiap node, lalu
    // kelompokkan uniq_code-nya per material code.
    const specRecord = isRecord(n.material_specifications)
      ? (n.material_specifications as Record<string, unknown>)
      : isRecord(n.material_spec)
        ? (n.material_spec as Record<string, unknown>)
        : undefined;
    const materialCode = pickString(
      specRecord?.material_code,
      n.material_code,
      specRecord?.material_grade,
      (n as Record<string, unknown>).materialCode,
    );
    const grade = pickString(
      specRecord?.grade,
      (n as Record<string, unknown>).grade,
      n.grade_size,
      n.gradeSize,
    );
    const diameter = pickString(
      specRecord?.diameter_mm,
      (n as Record<string, unknown>).diameter_mm,
    );
    const thickness = pickString(
      specRecord?.thickness_mm,
      (n as Record<string, unknown>).thickness_mm,
    );
    const width = pickString(
      specRecord?.width_mm,
      (n as Record<string, unknown>).width_mm,
    );
    const length = pickString(
      specRecord?.length_mm,
      (n as Record<string, unknown>).length_mm,
    );
    const dimParts = [
      diameter ? `Ø${diameter}` : "",
      width ? `W${width}` : "",
      thickness ? `T${thickness}` : "",
      length ? `L${length}` : "",
    ].filter(Boolean);
    const computedSize = dimParts.join(" x ");
    const size = pickString(
      specRecord?.size,
      computedSize,
      (n as Record<string, unknown>).size,
    );
    const cycleTime = pickNumber(
      specRecord?.cycle_time_sec,
      specRecord?.cycle_time,
      specRecord?.cycleTime,
      (n as Record<string, unknown>).cycle_time,
    );
    const customerCycle = pickString(
      specRecord?.customer_cycle,
      specRecord?.customerCycle,
      (n as Record<string, unknown>).customer_cycle,
    );
    const specWeight = pickNumber(
      specRecord?.weight_kg,
      specRecord?.weight,
      weightKg,
    );

    if (uniq) {
      uniqSet.add(uniq);
      if (partName && !partNameByUniq[uniq]) partNameByUniq[uniq] = partName;
      if (partNumber && !partNumberByUniq[uniq])
        partNumberByUniq[uniq] = partNumber;
      if (model && !modelByUniq[uniq]) modelByUniq[uniq] = model;
      if (assemblyCode && !assemblyCodeByUniq[uniq])
        assemblyCodeByUniq[uniq] = assemblyCode;
      if (model && !assemblyCodeByUniq[uniq]) assemblyCodeByUniq[uniq] = model;
      if (gradeSize && !gradeSizeByUniq[uniq])
        gradeSizeByUniq[uniq] = gradeSize;
      else if (grade && !gradeSizeByUniq[uniq])
        gradeSizeByUniq[uniq] = [grade, size].filter(Boolean).join(" / ");
      if (materialCode && !materialCodeByUniq[uniq])
        materialCodeByUniq[uniq] = materialCode;
      if (grade && !gradeByUniq[uniq]) gradeByUniq[uniq] = grade;
      if (size && !sizeByUniq[uniq]) sizeByUniq[uniq] = size;
      if (packingNumber && !packingNumberByUniq[uniq]) {
        packingNumberByUniq[uniq] = packingNumber;
      }
      if (uom && !uomByUniq[uniq]) uomByUniq[uniq] = uom;
      if (rmType && !rawMaterialTypeByUniq[uniq])
        rawMaterialTypeByUniq[uniq] = rmType;
      if (rmSource && !rmSourceByUniq[uniq]) rmSourceByUniq[uniq] = rmSource;
      if (typeof specWeight === "number" && !(uniq in weightKgByUniq))
        weightKgByUniq[uniq] = specWeight;
      else if (typeof weightKg === "number" && !(uniq in weightKgByUniq))
        weightKgByUniq[uniq] = weightKg;
      if (typeof qtyPerUniq === "number" && !(uniq in qtyPerUniqByUniq))
        qtyPerUniqByUniq[uniq] = qtyPerUniq;
      if (typeof cycleTime === "number" && !(uniq in cycleTimeByUniq))
        cycleTimeByUniq[uniq] = cycleTime;
      if (customerCycle && !customerCycleByUniq[uniq])
        customerCycleByUniq[uniq] = customerCycle;
      if (specRecord && !materialSpecByUniq[uniq]) {
        materialSpecByUniq[uniq] = specRecord;
      }
    }

    if (uniq && materialCode) {
      const key = materialCode.toLowerCase();
      if (!uniqsByMaterialCode[key]) uniqsByMaterialCode[key] = [];
      if (!uniqsByMaterialCode[key].includes(uniq)) {
        uniqsByMaterialCode[key].push(uniq);
      }
    }

    const children = n.children;
    if (Array.isArray(children)) {
      if (uniq && !childUniqsByUniq[uniq]) {
        const childUniqs: string[] = [];
        for (const child of children) {
          const cn = asNodeLike(child);
          if (!cn) continue;
          const cu =
            typeof cn.uniq === "string" && cn.uniq.trim()
              ? cn.uniq.trim()
              : typeof cn.uniq_code === "string"
                ? cn.uniq_code.trim()
                : "";
          if (cu) childUniqs.push(cu);
        }
        if (childUniqs.length) childUniqsByUniq[uniq] = childUniqs;
      }
      for (const child of children) visit(child);
    }
  };

  // The BOM tree query wraps nodes as { data: { items: [...] } } (see ok() in
  // bom/api.ts). Normalize any of: array, { items }, { data: [...] },
  // { data: { items } }, or a single node, before traversing.
  const toNodeArray = (input: unknown): unknown[] => {
    if (Array.isArray(input)) return input;
    if (isRecord(input)) {
      if (Array.isArray((input as { items?: unknown }).items)) {
        return (input as { items: unknown[] }).items;
      }
      const data = (input as { data?: unknown }).data;
      if (Array.isArray(data)) return data;
      if (
        isRecord(data) &&
        Array.isArray((data as { items?: unknown }).items)
      ) {
        return (data as { items: unknown[] }).items;
      }
      return [input];
    }
    return [];
  };

  for (const node of toNodeArray(tree)) visit(node);

  const uniqs = Array.from(uniqSet).sort((a, b) => a.localeCompare(b));
  const options = uniqs.map((u) => ({ label: u, value: u }));
  return {
    uniqs,
    options,
    partNameByUniq,
    partNumberByUniq,
    modelByUniq,
    assemblyCodeByUniq,
    gradeSizeByUniq,
    packingNumberByUniq,
    uomByUniq,
    rawMaterialTypeByUniq,
    rmSourceByUniq,
    weightKgByUniq,
    qtyPerUniqByUniq,
    childUniqsByUniq,
    materialSpecByUniq,
    materialCodeByUniq,
    gradeByUniq,
    sizeByUniq,
    cycleTimeByUniq,
    customerCycleByUniq,
    uniqsByMaterialCode,
  };
};
