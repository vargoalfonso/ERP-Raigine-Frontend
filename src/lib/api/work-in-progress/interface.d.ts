import { User } from "../auth/interface";
import { MasterListRecord } from "../master-list/interface";
import { WarehouseRecord } from "../warehouse/interface";

export interface WorkInProgressRecord {
  id: string;
  warehouse_id?: string;
  master_list_id?: string;
  work_order_id?: string;
  product_uniq?: string;
  part_name?: string;
  work_order_reference?: string;
  batch_number?: string;
  quantity_in_process?: number;
  current_process?: string;
  process_station?: string;
  production_start_date?: string;
  estimated_completion?: string;
  current_operator?: string;
  process_priority?: ProcessPriority;
  process_notes?: string;
  aging_days?: number;
  process_status?: ProcessStatus;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
  warehouse?: WarehouseRecord;
  master_list?: MasterListRecord;
  work_order?: WorkOrderRecord;
  current_operator_user?: User;
}

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

export type ProcessPriority = "Low" | "Medium" | "High" | "Urgent";
export type ProcessStatus =
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Cancelled";
export type Priority = "Low" | "Medium" | "High";
export type Status = "Pending" | "In Progress" | "Completed" | "Cancelled";
export type WorkOrderType = "Production" | "Maintenance" | "Quality Check";

// Request interfaces for API calls
export interface CreateWorkInProgressRequest {
  warehouse_id?: string;
  master_list_id?: string;
  work_order_id?: string;
  product_uniq: string;
  part_name: string;
  work_order_reference: string;
  batch_number: string;
  quantity_in_process: number;
  current_process: string;
  process_station: string;
  production_start_date: string;
  estimated_completion: string;
  current_operator: string;
  process_priority: ProcessPriority;
  process_notes?: string;
}

export interface UpdateWorkInProgressRequest {
  id: string;
  warehouse_id?: string;
  master_list_id?: string;
  work_order_id?: string;
  product_uniq?: string;
  part_name?: string;
  work_order_reference?: string;
  batch_number?: string;
  quantity_in_process?: number;
  current_process?: string;
  process_station?: string;
  production_start_date?: string;
  estimated_completion?: string;
  current_operator?: string;
  process_priority?: ProcessPriority;
  process_notes?: string;
  process_status?: ProcessStatus;
}
