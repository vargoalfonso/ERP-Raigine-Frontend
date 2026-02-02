import { User } from "../auth/interface";
import { MasterListRecord } from "../master-list/interface";
import { WarehouseRecord } from "../warehouse/interface";

export interface WorkOrderRecord {
  id: string;
  wo_number?: string;
  master_list_id?: string;
  quantity?: number;
  priority?: Priority;
  status?: Status;
  type?: WorkOrderType;
  notes?: string;
  start_date?: string;
  end_date?: string;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FinishedGoodsRecord {
  id: string;
  warehouse_id?: string;
  master_list_id?: string;
  work_order_id?: string;
  current_stock?: number;
  target_stock?: number;
  production_operator?: string;
  quality_inspector?: string;
  quality_status?: Priority;
  cost?: number;
  notes?: string;
  total_kanban?: number;
  stock_to_complete?: Decimal;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
  warehouse?: WarehouseRecord;
  master_list?: MasterListRecord;
  work_order?: WorkOrderRecord;
  production_operator_user?: User;
  quality_inspector_user?: User;
}

export type Priority = "Low" | "Medium" | "High";
