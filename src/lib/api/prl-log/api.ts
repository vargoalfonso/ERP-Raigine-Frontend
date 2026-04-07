import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";

export type PrlLogRowDto = {
  id: number;
  item_uniq_code?: string;
  action?: string;
  old_value?: string;
  new_value?: string;
  user_name?: string;
  created_at?: string;
};

export type PrlHistoryRowDto = {
  period?: string;
  item_uniq_code?: string;
  quantity?: number;
  delivery_quantity?: number;
  status?: string;
  customer?: { customer_name?: string };
  product_details?: { part_name?: string; part_number?: string };
  gap?: number;
};

export type MachinePatternRowDto = {
  period?: string;
  uniq?: string;
  machine_pattern?: string;
  production_output?: number;
};

export const prlLogApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPrlLogsByUniq: builder.query<PrlLogRowDto[], string>({
      query: (uniq) => ({
        url: `/api/prl-log/logs/${encodeURIComponent(uniq)}`,
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const list = unwrapBackendData<PrlLogRowDto[]>(response);
        return Array.isArray(list) ? list : [];
      },
    }),

    getPrlHistory: builder.query<PrlHistoryRowDto[], void>({
      query: () => ({
        url: "/api/prl-log/history",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const list = unwrapBackendData<PrlHistoryRowDto[]>(response);
        return Array.isArray(list) ? list : [];
      },
    }),

    getMachinePatterns: builder.query<MachinePatternRowDto[], void>({
      query: () => ({
        url: "/api/prl-log/machine-patterns",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const list = unwrapBackendData<MachinePatternRowDto[]>(response);
        return Array.isArray(list) ? list : [];
      },
    }),
  }),
});

export const { useGetPrlLogsByUniqQuery, useGetPrlHistoryQuery, useGetMachinePatternsQuery } = prlLogApiSlice;
