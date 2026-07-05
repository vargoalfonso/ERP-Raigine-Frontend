import type { FormInstance } from "antd";
import type { UploadFile } from "antd/es/upload/interface";

export type ProcessRouteForm = {
  op_seq?: number;
  process_id?: number | string;
  machine_id?: number | null;
  cycle_time_sec?: number;
  setup_time_min?: number;
  machine_stroke?: string;
  tooling_ref?: string;
  tooling_type?: string;
};

export type MaterialSpecForm = {
  material_code?: string;
  form?: string;
  grade?: string;
  type_material?: string;
  weight_kg?: number;
  width_mm?: number;
  diameter_mm?: number;
  thickness_mm?: number;
  length_mm?: number;
  cycle_time_sec?: number;
  setup_time_min?: number;
  customer_cycle?: string;
};

export type ChildPartForm = {
  child_id?: number | string | null;
  line_id?: number | string | null;
  uniq_code?: string;
  parent_uniq_code?: string;
  level?: number;
  category?: string;
  qty_per_uniq?: number;
  scrap_factor?: number;
  is_phantom?: boolean;
  part_name?: string;
  part_number?: string;
  model?: string;
  uom?: string | number;
  asset_id?: number | string | null;
  asset_url?: string | null;
  material_spec?: MaterialSpecForm;
  process_routes?: ProcessRouteForm[];
  children?: ChildPartForm[];
};

export type EditValues = {
  change_note?: string;
  parent_uniq?: string;
  part_name?: string;
  part_number?: string;
  model?: string;
  uom?: string | number;
  status?: string;
  description?: string;
  asset_id?: number | string | null;
  asset_url?: string | null;
  material_spec?: MaterialSpecForm;
  process_routes?: ProcessRouteForm[];
  child_parts?: ChildPartForm[];
};

export type FormPath = Array<string | number>;
export type BomSelectedNodePath = "parent" | `child_parts.${string}`;

export type BomTreeNodeItem = {
  key: BomSelectedNodePath;
  depth: number;
  /** True when this node is the last among its siblings (drives the └ vs ├ connector). */
  isLast: boolean;
  /** For each ancestor column, whether that ancestor was the last sibling (drives whether the guide rail continues). */
  ancestorLasts: boolean[];
  label: string;
  uniqCode: string;
  qtyLabel: string;
  levelLabel: string;
  hasChildren: boolean;
  childCount: number;
  path: FormPath;
  childrenPath: FormPath;
  assetUrl?: string;
  hasRoutes: boolean;
  hasMaterialSpec: boolean;
};

export type ChildFileMap = Record<string, UploadFile[]>;

export type CommonEditorProps = {
  form: FormInstance<EditValues>;
  disabled?: boolean;
};
