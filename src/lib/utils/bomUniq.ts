export type SelectOption = { label: string; value: string };

type BomNodeLike = {
  uniq?: unknown;
  part_name?: unknown;
  part_number?: unknown;
  assembly_code?: unknown;
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
  assemblyCodeByUniq: Record<string, string>;
};

export const buildBomUniqIndex = (tree: unknown): BomUniqIndex => {
  const uniqSet = new Set<string>();
  const partNameByUniq: Record<string, string> = {};
  const partNumberByUniq: Record<string, string> = {};
  const assemblyCodeByUniq: Record<string, string> = {};

  const visit = (node: unknown) => {
    const n = asNodeLike(node);
    if (!n) return;

    const uniq = typeof n.uniq === "string" ? n.uniq.trim() : "";
    const partName = typeof n.part_name === "string" ? n.part_name.trim() : "";
    const partNumber = typeof n.part_number === "string" ? n.part_number.trim() : "";
    const assemblyCode = typeof n.assembly_code === "string" ? n.assembly_code.trim() : "";
    if (uniq) {
      uniqSet.add(uniq);
      if (partName && !partNameByUniq[uniq]) partNameByUniq[uniq] = partName;
      if (partNumber && !partNumberByUniq[uniq]) partNumberByUniq[uniq] = partNumber;
      if (assemblyCode && !assemblyCodeByUniq[uniq]) assemblyCodeByUniq[uniq] = assemblyCode;
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
  return { uniqs, options, partNameByUniq, partNumberByUniq, assemblyCodeByUniq };
};
