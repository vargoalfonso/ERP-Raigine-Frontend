import type { DefaultOptionType } from "antd/es/select";
import type { BackendBomNode } from "@/lib/api/bom/api";

const pickText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

export const normalizeBomCodes = (codes?: string[]): string[] =>
  Array.from(
    new Set(
      (codes ?? [])
        .map((code) => String(code).trim())
        .filter(Boolean)
    )
  );

export const buildBomCodeSelectOptions = (nodes: BackendBomNode[] = []): DefaultOptionType[] => {
  const byCode = new Map<string, DefaultOptionType>();

  const walk = (items: BackendBomNode[]) => {
    for (const item of items) {
      // Add every uniq code found (no filtering). Label will show only the uniq code.
      const code = pickText(item.uniq_code, item.uniq);
      if (code && !byCode.has(code)) {
        byCode.set(code, { value: code, label: code });
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        walk(item.children);
      }
    }
  };

  walk(nodes);

  return Array.from(byCode.values()).sort((a, b) =>
    String(a.value ?? "").localeCompare(String(b.value ?? ""))
  );
};
