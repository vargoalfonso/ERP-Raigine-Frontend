import type {
  BomSelectedNodePath,
  BomTreeNodeItem,
  ChildPartForm,
  EditValues,
  FormPath,
} from "./bom-edit.types";

export const toChildFileKey = (path: FormPath): string => path.join(".");

export const childPathToKey = (path: FormPath): BomSelectedNodePath => {
  return path.join(".") as BomSelectedNodePath;
};

export const keyToChildPath = (key: BomSelectedNodePath): FormPath => {
  if (key === "parent") return [];
  return key.split(".").map((segment) => {
    const asNumber = Number(segment);
    return Number.isFinite(asNumber) && String(asNumber) === segment ? asNumber : segment;
  });
};

export const getChildAtPath = (
  values: EditValues,
  key: BomSelectedNodePath
): ChildPartForm | undefined => {
  if (key === "parent") return undefined;

  let current: unknown = values;
  for (const segment of keyToChildPath(key)) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[String(segment)];
  }

  return current as ChildPartForm | undefined;
};

export const hasMaterialSpecData = (spec: ChildPartForm["material_spec"] | EditValues["material_spec"]): boolean => {
  if (!spec || typeof spec !== "object") return false;
  return Object.values(spec).some((value) => value !== undefined && value !== null && value !== "");
};

export const buildBomTreeItems = (values: EditValues): BomTreeNodeItem[] => {
  const out: BomTreeNodeItem[] = [];

  const walk = (
    children: ChildPartForm[] | undefined,
    basePath: FormPath,
    depth: number,
    ancestorLasts: boolean[]
  ) => {
    const list = children ?? [];
    for (let index = 0; index < list.length; index += 1) {
      const child = list[index];
      if (!child) continue;

      const isLast = index === list.length - 1;
      const path = [...basePath, index];
      const nestedChildren = Array.isArray(child.children) ? child.children : [];
      const routes = Array.isArray(child.process_routes) ? child.process_routes : [];
      const uom = String(child.uom ?? "").trim();
      const qty = child.qty_per_uniq ?? 1;

      out.push({
        key: childPathToKey(path),
        depth,
        isLast,
        ancestorLasts: [...ancestorLasts],
        label:
          child.part_name?.trim() ||
          child.part_number?.trim() ||
          child.uniq_code?.trim() ||
          `Child ${index + 1}`,
        uniqCode: child.uniq_code?.trim() || "—",
        qtyLabel: `${qty}${uom ? ` ${uom}` : ""}`,
        levelLabel: `L${child.level ?? depth}`,
        hasChildren: nestedChildren.length > 0,
        childCount: nestedChildren.length,
        path,
        childrenPath: [...path, "children"],
        assetUrl: child.asset_url ?? undefined,
        hasRoutes: routes.length > 0,
        hasMaterialSpec: hasMaterialSpecData(child.material_spec),
      });

      if (nestedChildren.length > 0) {
        walk(nestedChildren, [...path, "children"], depth + 1, [...ancestorLasts, isLast]);
      }
    }
  };

  walk(values.child_parts, ["child_parts"], 1, []);
  return out;
};
