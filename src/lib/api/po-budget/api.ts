import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

export type PoBudgetType = "raw-material" | "subcon" | "indirect";

export interface PoBudgetEntryRequest {
  customer_name: string;
  item_uniq_code: string;
  supplier_name: string;
  supplier_id: number;
  period: string;
  sales_plan_qty: number;
  pr_qty: number;
  prl_qty: number;
  po1_percent: number;
  po2_percent: number;
}

export type PoBudgetRow = {
  key: string;
  uniq: string;
  customer: string;
  productModel: string;
  partName: string;
  supplier: string;
  type: string;
  salesPlan: number;
  pr: number;
  po1: number;
  po2: number;
  prl: number;
  totalPo: number;
  apoPrl: number;
  period: string;
  status: "approved" | "pending";
  approval: "Approved" | "Pending";
};

const ok = <T,>(data: T, message = "OK"): ApiResponse<T> => ({
  message,
  status: "success",
  data,
});

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const getString = (record: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
};

const getNumber = (record: UnknownRecord, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const normalizeListResponse = (response: unknown): unknown[] => {
  if (Array.isArray(response)) return response;
  if (!isRecord(response)) return [];

  const directData = response.data;
  if (Array.isArray(directData)) return directData;
  if (isRecord(directData) && Array.isArray(directData.data)) return directData.data;

  return [];
};

const normalizeObjectResponse = (response: unknown): unknown => {
  if (!isRecord(response)) return response;

  const directData = response.data;
  if (isRecord(directData)) return directData;
  if (isRecord(directData) && isRecord(directData.data)) return directData.data;

  return response;
};

const toPoBudgetRow = (item: unknown, index: number): PoBudgetRow => {
  const record = isRecord(item) ? item : {};
  const uniq = getString(record, ["item_uniq_code", "uniq", "itemUniqCode"]) ?? `ITEM-${index + 1}`;
  const customer = getString(record, ["customer_name", "customer", "full_name"]) ?? "-";
  const supplier =
    getString(record, ["supplier_name", "supplier", "subcon_name", "supplierName"]) ?? "-";
  const productModel = getString(record, ["product_model", "productModel", "model"]) ?? "";
  const partName = getString(record, ["part_name", "partName", "description"]) ?? "";
  const type = getString(record, ["type", "budget_type", "budgetType"]) ?? "";
  const salesPlan = getNumber(record, ["sales_plan_qty", "salesPlan", "sales_plan"]) ?? 0;
  const pr = getNumber(record, ["pr_qty", "purchase_request_qty", "pr", "purchaseRequest"]) ?? 0;
  const prl = getNumber(record, ["prl_qty", "prl", "prlQty"]) ?? 0;
  const po1Percent = getNumber(record, ["po1_percent", "po1Percent"]) ?? 0;
  const po2Percent = getNumber(record, ["po2_percent", "po2Percent"]) ?? 0;
  const po1 =
    getNumber(record, ["po1_qty", "po1", "po_1_qty"]) ?? Math.round((pr * po1Percent) / 100);
  const po2 =
    getNumber(record, ["po2_qty", "po2", "po_2_qty"]) ?? Math.round((pr * po2Percent) / 100);
  const totalPo = getNumber(record, ["total_po", "totalPo"]) ?? po1 + po2;
  const apoPrl = getNumber(record, ["apo_prl", "apoPrl"]) ?? Math.max(0, Math.abs(totalPo - prl));
  const period = getString(record, ["period"]) ?? "-";
  const rawStatus = getString(record, ["status", "approval_status", "approvalStatus"]);
  const status: PoBudgetRow["status"] =
    String(rawStatus ?? "pending").toLowerCase() === "approved" ? "approved" : "pending";
  const approval: PoBudgetRow["approval"] = status === "approved" ? "Approved" : "Pending";

  return {
    key:
      getString(record, ["id", "key"]) ??
      [uniq || "item", customer || "customer", period || "period", index].join("-"),
    uniq,
    customer,
    productModel,
    partName,
    supplier,
    type,
    salesPlan,
    pr,
    po1,
    po2,
    prl,
    totalPo,
    apoPrl,
    period,
    status,
    approval,
  };
};

export const poBudgetSlice = apiSlice
  .enhanceEndpoints({
    addTagTypes: ["PoBudget"],
  })
  .injectEndpoints({
    endpoints: (builder) => ({
      getPoBudgetList: builder.query<ApiResponse<PoBudgetRow[]>, PoBudgetType>({
        query: (type) => ({
          url: `/api/po-budget/list/${type}`,
          method: "GET",
          meta: { useAuthorization: true },
        }),
        transformResponse: (response: unknown) =>
          ok(normalizeListResponse(response).map((item, index) => toPoBudgetRow(item, index))),
        providesTags: (result, error, arg) => [{ type: "PoBudget", id: arg }],
      }),

      addPoBudgetEntry: builder.mutation<
        ApiResponse<PoBudgetRow>,
        { type: PoBudgetType; body: PoBudgetEntryRequest }
      >({
        query: ({ type, body }) => ({
          url: `/api/po-budget/add-entry/${type}`,
          method: "POST",
          body,
          meta: { useAuthorization: true },
        }),
        transformResponse: (response: unknown) =>
          ok(toPoBudgetRow(normalizeObjectResponse(response), 0)),
        invalidatesTags: (result, error, { type }) => [{ type: "PoBudget", id: type }],
      }),
    }),
  });

export const {
  useGetPoBudgetListQuery,
  useAddPoBudgetEntryMutation,
} = poBudgetSlice;