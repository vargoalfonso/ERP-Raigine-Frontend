import { CreateWorkInProgressRequest } from "./interface";
import dayjs from "dayjs";

export const validateWorkInProgressData = (
  data: CreateWorkInProgressRequest
): string[] => {
  const errors: string[] = [];

  if (!data.product_uniq?.trim()) {
    errors.push("Product UNIQ is required");
  }

  if (!data.part_name?.trim()) {
    errors.push("Part name is required");
  }

  if (!data.work_order_reference?.trim()) {
    errors.push("Work order reference is required");
  }

  if (!data.batch_number?.trim()) {
    errors.push("Batch number is required");
  }

  if (!data.quantity_in_process || data.quantity_in_process <= 0) {
    errors.push("Quantity in process must be greater than 0");
  }

  if (!data.current_process?.trim()) {
    errors.push("Current process is required");
  }

  if (!data.process_station?.trim()) {
    errors.push("Process station is required");
  }

  if (!data.production_start_date?.trim()) {
    errors.push("Production start date is required");
  }

  if (!data.estimated_completion?.trim()) {
    errors.push("Estimated completion date is required");
  }

  if (!data.current_operator?.trim()) {
    errors.push("Current operator is required");
  }

  if (!data.process_priority?.trim()) {
    errors.push("Process priority is required");
  }

  // Validate date formats
  if (
    data.production_start_date &&
    !dayjs(data.production_start_date).isValid()
  ) {
    errors.push("Invalid production start date format");
  }

  if (
    data.estimated_completion &&
    !dayjs(data.estimated_completion).isValid()
  ) {
    errors.push("Invalid estimated completion date format");
  }

  // Validate that estimated completion is after start date
  if (data.production_start_date && data.estimated_completion) {
    const startDate = dayjs(data.production_start_date);
    const endDate = dayjs(data.estimated_completion);

    if (endDate.isBefore(startDate)) {
      errors.push(
        "Estimated completion date must be after production start date"
      );
    }
  }

  return errors;
};

export const calculateAgingDays = (startDate: string): number => {
  if (!startDate) return 0;

  const start = dayjs(startDate);
  const now = dayjs();

  return now.diff(start, "day");
};

export const getProcessStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case "in progress":
      return "blue";
    case "on hold":
      return "orange";
    case "completed":
      return "green";
    case "cancelled":
      return "red";
    default:
      return "gray";
  }
};

export const getPriorityColor = (priority: string): string => {
  switch (priority.toLowerCase()) {
    case "urgent":
      return "red";
    case "high":
      return "orange";
    case "medium":
      return "blue";
    case "low":
      return "green";
    default:
      return "gray";
  }
};

export const formatWorkInProgressData = (
  data: Record<string, unknown>
): CreateWorkInProgressRequest => {
  return {
    product_uniq: String(data.product_uniq || ""),
    part_name: String(data.part_name || ""),
    work_order_reference: String(data.work_order_reference || ""),
    batch_number: String(data.batch_number || ""),
    quantity_in_process: Number(data.quantity_in_process) || 0,
    current_process: String(data.current_process || ""),
    process_station: String(data.process_station || ""),
    production_start_date: data.production_start_date
      ? dayjs(data.production_start_date as string).format("YYYY-MM-DD")
      : "",
    estimated_completion: data.estimated_completion
      ? dayjs(data.estimated_completion as string).format("YYYY-MM-DD")
      : "",
    current_operator: String(data.current_operator || ""),
    process_priority:
      (data.process_priority as CreateWorkInProgressRequest["process_priority"]) ||
      "Medium",
    process_notes: String(data.process_notes || ""),
  };
};
