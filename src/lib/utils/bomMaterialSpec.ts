type BomNodeLike = {
  uniq?: unknown;
  uniq_code?: unknown;
  material_spec?: unknown;
  material_specifications?: unknown;
  product_model?: unknown;
  productModel?: unknown;
  model?: unknown;
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
  productModelByUniq: Record<string, string>;
  sizeByUniq: Record<string, string>;
};

export const buildBomMaterialSpecIndex = (tree: unknown): BomMaterialSpecIndex => {
  const typeMaterialByUniq: Record<string, string> = {};
  const weightKgByUniq: Record<string, number> = {};
  const materialGradeByUniq: Record<string, string> = {};
  const gradeByUniq: Record<string, string> = {};
  const productModelByUniq: Record<string, string> = {};
  const sizeByUniq: Record<string, string> = {};

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

    if (uniq) {
      const productModel = pickString(
        current.product_model,
        current.productModel,
        current.model,
        materialSpec?.product_model,
        materialSpec?.productModel,
        materialSpec?.product_model_name,
        materialSpec?.model,
      );
      if (productModel && !productModelByUniq[uniq]) productModelByUniq[uniq] = productModel;
      if (materialSpec) {
        const length = pickString(materialSpec.length_mm, materialSpec.length);
        const width = pickString(materialSpec.width_mm, materialSpec.width);
        const thickness = pickString(materialSpec.thickness_mm, materialSpec.thickness);
        const diameter = pickString(materialSpec.diameter_mm, materialSpec.diameter);
        const dims = [length, width, thickness].filter(Boolean).join(" x ");
        let size = dims;
        if (diameter) size = dims ? `${dims} / Ø${diameter}` : `Ø${diameter}`;
        if (size && !sizeByUniq[uniq]) sizeByUniq[uniq] = size;
      }
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
    productModelByUniq,
    sizeByUniq,
  };
};
