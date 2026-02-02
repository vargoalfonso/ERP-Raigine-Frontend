export interface WarehouseRecord {
  id: string;
  code?: string;
  name?: string;
  location?: string;
  type?: Type;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export type Type = "RAW" | "FINISHED" | "PACKAGING" | "OTHER";
