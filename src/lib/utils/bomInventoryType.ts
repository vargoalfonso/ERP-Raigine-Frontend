import type { BackendBomNode } from "@/lib/api/bom/api";

export type InventoryType =
  | "Raw Material"
  | "Indirect Raw Material"
  | "SubCon"
  | "Finished Goods";

export const INVENTORY_TYPE_OPTIONS: Array<{ label: string; value: InventoryType }> = [
  { label: "Raw Material", value: "Raw Material" },
  { label: "Indirect Raw Material", value: "Indirect Raw Material" },
  { label: "SubCon", value: "SubCon" },
  { label: "Finished Goods", value: "Finished Goods" },
];

const asChildren = (n: BackendBomNode): BackendBomNode[] => (Array.isArray(n.children) ? n.children : []);

const pickUniq = (n: BackendBomNode): string => {
  const uniq = typeof n.uniq === "string" ? n.uniq.trim() : "";
  if (uniq) return uniq;
  const ac = typeof n.assembly_code === "string" ? n.assembly_code.trim() : "";
  if (ac) return ac;
  return String(n.id ?? "").trim();
};

const isParentLike = (n: BackendBomNode): boolean => {
  const children = asChildren(n);
  return children.length > 0;
};

const isLeafLike = (n: BackendBomNode): boolean => !isParentLike(n);

export const collectBomUniqsForInventoryType = (
  tree: BackendBomNode[] | undefined,
  type: InventoryType
): string[] => {
  const uniqs: string[] = [];

  const visit = (node: BackendBomNode) => {
    const children = asChildren(node);

    const include =
      type === "Finished Goods" ? isParentLike(node) : isLeafLike(node);

    if (include) {
      const u = pickUniq(node);
      if (u) uniqs.push(u);
    }

    for (const c of children) visit(c);
  };

  for (const n of tree ?? []) visit(n);

  // If BOM doesn't have parent nodes (or type mapping is ambiguous), fall back to all uniqs.
  if (uniqs.length === 0) {
    const all: string[] = [];
    for (const n of tree ?? []) {
      const walk = (x: BackendBomNode) => {
        const u = pickUniq(x);
        if (u) all.push(u);
        for (const c of asChildren(x)) walk(c);
      };
      walk(n);
    }
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
  }

  return Array.from(new Set(uniqs)).sort((a, b) => a.localeCompare(b));
};
