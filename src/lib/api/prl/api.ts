import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";

export type PrlForecastStatus = "Draft" | "Active" | "Closed" | string;

export type PrlForecastDto = {
  id: string;
  prl_id?: string;
  customer_id?: number | string;
  item_uniq_code?: string;
  quantity?: number;
  delivery_quantity?: number;
  period?: string;
  status?: PrlForecastStatus;
  created_by?: string;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
  customer?: {
    customer_name?: string;
    code?: string;
  };
  product_details?: {
    part_name?: string;
    part_number?: string;
    description?: string;
    quantity?: number;
  };
};

export type PrlGapStatus = "Under" | "Over" | "On Track" | string;

export type PrlGapRowDto = {
  uniq: string;
  customer_forecast: number;
  actual_delivery: number;
  gap_units: string | number;
  gap_percentage: string;
  status: PrlGapStatus;
};

export type CreatePrlForecastRowRequest = {
  customer_id: number;
  item_uniq_code: string;
  quantity: number;
  period: string;
  full_name?: string;
};

export type UploadPrlExcelResponse = {
  success?: boolean;
  message?: string;
  data?: {
    total_rows?: number;
    inserted?: number;
    updated?: number;
    errors?: unknown[];
  };
};

export const prlApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listPrlForecasts: builder.query<PrlForecastDto[], void>({
      query: () => ({
        url: "/api/prl/",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const list = unwrapBackendData<PrlForecastDto[]>(response);
        return Array.isArray(list) ? list : [];
      },
    }),

    getPrlGapAnalysis: builder.query<PrlGapRowDto[], void>({
      query: () => ({
        url: "/api/prl/gap-analysis",
        method: "GET",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
      transformResponse: (response: unknown) => {
        const list = unwrapBackendData<PrlGapRowDto[]>(response);
        return Array.isArray(list) ? list : [];
      },
    }),

    bulkCreatePrlForecasts: builder.mutation<{ message?: string } & Record<string, unknown>, CreatePrlForecastRowRequest[]>({
      query: (body) => ({
        url: "/api/prl/bulk",
        method: "POST",
        meta: { useAuthorization: true, contentType: "application/json" },
        body,
      }),
    }),

    uploadPrlExcel: builder.mutation<UploadPrlExcelResponse, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append("file", file);

        return {
          url: "/api/prl/upload-excel",
          method: "POST",
          meta: { useAuthorization: true, contentType: "multipart/form-data" },
          body: formData,
        };
      },
    }),

    clearAllPrlForecasts: builder.mutation<unknown, void>({
      query: () => ({
        url: "/api/prl/clear-all",
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    clearPrlForecastsByUniq: builder.mutation<unknown, string>({
      query: (uniq) => ({
        url: `/api/prl/clear-by-uniq/${encodeURIComponent(uniq)}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),

    clearPrlForecastsByPeriod: builder.mutation<unknown, string>({
      query: (period) => ({
        url: `/api/prl/clear-by-period/${encodeURIComponent(period)}`,
        method: "DELETE",
        meta: { useAuthorization: true, contentType: "application/json" },
      }),
    }),
  }),
});

export const {
  useListPrlForecastsQuery,
  useGetPrlGapAnalysisQuery,
  useBulkCreatePrlForecastsMutation,
  useUploadPrlExcelMutation,
  useClearAllPrlForecastsMutation,
  useClearPrlForecastsByUniqMutation,
  useClearPrlForecastsByPeriodMutation,
} = prlApiSlice;
