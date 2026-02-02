export interface MasterListRecord {
  id: string;
  uniq_code?: string;
  part_no?: string;
  part_name?: string;
  size?: string;
  model?: string;
  kanban_quantity?: number;
  threshold_kanban?: number;
  uom?: string;
  weight?: number;
  type?: string;
  status?: Status;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}
