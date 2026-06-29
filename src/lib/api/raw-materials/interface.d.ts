import { MasterListSupplierRecord } from "../master-list/interface";
import { WarehouseRecord } from "../warehouse/interface";

export interface RawMaterialRecord {
  current_stock: any;
  master_list: any;
  id: string;
  warehouse_id?: string;
  master_list_supplier_id?: string;
  uniq: string;
  code: string;
  name: string;
  category?: string;
  part_name?: string;
  part_no?: string;
  model?: string;
  kanban_quantity?: number;
  total_kanban?: number;
  stock?: number;
  stock_days?: number;
  safety_stock?: number;
  price?: number;
  order_flag: boolean;
  description?: string;
  status: StatusStock;
  is_buyed: boolean;
  save_as?: SaveAs;
  received_quantity?: number;
  unit?: string;
  po_reference?: string;
  received_date?: string;
  batch_number?: string;
  expiry_date?: string;
  quality_status?: string;
  notes?: string;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  master_list_supplier?: MasterListSupplierRecord;
  warehouse?: WarehouseRecord;
  qr?: string;
}

export type StatusStock =
  | "Available"
  | "OutOfStock"
  | "LowStock"
  | "Reserved"
  | "Damaged";

export type SaveAs = "Draft" | "Published";

export interface MasterListSupplierRecord {
  id: string;
  name?: string;
  code?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateRawMaterialRequest {
  warehouse_id?: string;
  master_list_supplier_id?: string;
  uniq?: string;
  code: string;
  name: string;
  category?: string;
  part_name?: string;
  part_no?: string;
  model?: string;
  kanban_quantity?: number;
  total_kanban?: number;
  stock?: number;
  stock_days?: number;
  safety_stock?: number;
  price?: number;
  order_flag?: boolean;
  notes?: string;
  status?: StatusStock;
  is_buyed?: boolean;
  save_as?: SaveAs;
  unit?: string;
  po_reference?: string;
  received_date?: Dayjs;
  batch_number?: string;
  expiry_date?: Dayjs;
  quality_status?: string;

  //   created_by: string;
}

export interface UpdateRawMaterialRequest {
  warehouse_id?: string;
  master_list_supplier_id?: string;
  uniq?: string;
  code?: string;
  name?: string;
  category?: string;
  part_name?: string;
  part_no?: string;
  model?: string;
  unit?: string;
  po_reference?: string;
  received_date?: Dayjs;
  batch_number?: string;
  expiry_date?: Dayjs;
  quality_status?: string;
  kanban_quantity?: number;
  total_kanban?: number;
  stock?: number;
  stock_days?: number;
  safety_stock?: number;
  price?: number;
  order_flag?: boolean;
  notes?: string;
  status?: StatusStock;
  is_buyed?: boolean;
  save_as?: SaveAs;
  updated_by?: string;
}
