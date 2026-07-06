type BomNodeLike = {
  uniq?: unknown;
  uniq_code?: unknown;
  material_spec?: unknown;
  material_specifications?: unknown;
  children?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

const asNodeLike = (value: unknown): BomNodeLike | null => {
  if (!isRecord(value)) return null;
  return value as BomNodeLike;
};

export type BomMaterialSpecIndex = {
  typeMaterialByUniq: Record<string, string>;
  weightKgByUniq: Record<string, number>;
  materialGradeByUniq: Record<string, string>;
  gradeByUniq: Record<string, string>;
};

export const buildBomMaterialSpecIndex = (tree: unknown): BomMaterialSpecIndex => {
  const typeMaterialByUniq: Record<string, string> = {};
  const weightKgByUniq: Record<string, number> = {};
  const materialGradeByUniq: Record<string, string> = {};
  const gradeByUniq: Record<string, string> = {};

  const pickString = (...values: unknown[]): string => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return "";
  };

  const pickNumber = (...values: unknown[]): number | undefined => {
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return undefined;
  };

  const visit = (node: unknown) => {
    const current = asNodeLike(node);
    if (!current) return;

    const uniq = pickString(current.uniq, current.uniq_code);
    const materialSpec = isRecord(current.material_spec)
      ? current.material_spec
      : isRecord(current.material_specifications)
        ? current.material_specifications
        : undefined;

    if (uniq && materialSpec) {
      const typeMaterial = pickString(materialSpec.type_material, materialSpec.material_type);
      const weightKg = pickNumber(materialSpec.weight_kg, materialSpec.weight, materialSpec.unit_weight);
      const materialGrade = pickString(materialSpec.material_grade, materialSpec.material_code);
      const grade = pickString(materialSpec.grade);

      if (typeMaterial && !typeMaterialByUniq[uniq]) typeMaterialByUniq[uniq] = typeMaterial;
      if (typeof weightKg === "number" && !(uniq in weightKgByUniq)) weightKgByUniq[uniq] = weightKg;
      if (materialGrade && !materialGradeByUniq[uniq]) materialGradeByUniq[uniq] = materialGrade;
      if (grade && !gradeByUniq[uniq]) gradeByUniq[uniq] = grade;
    }

    if (Array.isArray(current.children)) {
      for (const child of current.children) visit(child);
    }
  };

  if (Array.isArray(tree)) {
    for (const node of tree) visit(node);
  } else {
    visit(tree);
  }

  return {
    typeMaterialByUniq,
    weightKgByUniq,
    materialGradeByUniq,
    gradeByUniq,
  };
};
