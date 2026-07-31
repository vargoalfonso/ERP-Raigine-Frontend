import { apiSlice } from "@/lib/api/instance";
import type { ApiResponse } from "@/types";

const TAG = "WorkOrdersImport" as const;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

export type WorkOrderImportResponse = {
  import_status?: string;
  total?: number;
  imported?: number;
  success_count?: number;
  failed?: number;
  failed_count?: number;
  download_url?: string;
  errors?: unknown[];
  message?: string;
};

export type WorkOrderImportHistoryDto = {
  id: number | string;
  file_name: string;
  file_size_kb: number;
  row_count: number;
  uploaded_by: string;
  status: string; // "success" | "partial" | "error"
  summary: string;
  imported_count: number;
  failed_count: number;
  request_id?: string;
  has_error_file: boolean;
  preview_rows?: Array<Record<string, unknown>>;
  created_at: string;
  updated_at?: string;
};

const normalizeImportResponse = (response: unknown): WorkOrderImportResponse => {
  if (!isRecord(response)) return {};
  const data = isRecord(response.data) ? response.data : response;
  return {
    import_status: typeof data.import_status === "string" ? data.import_status : undefined,
    total: typeof data.total === "number" ? data.total : undefined,
    imported: typeof data.imported === "number" ? data.imported : undefined,
    success_count: typeof data.success_count === "number" ? data.success_count : undefined,
    failed: typeof data.failed === "number" ? data.failed : undefined,
    failed_count: typeof data.failed_count === "number" ? data.failed_count : undefined,
    download_url: typeof data.download_url === "string" ? data.download_url : undefined,
    errors: Array.isArray(data.errors) ? data.errors : undefined,
    message: typeof data.message === "string" ? data.message : undefined,
  };
};

export const workOrdersImportApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: [TAG] })
  .injectEndpoints({
    endpoints: (builder) => ({
      importWorkOrders: builder.mutation<ApiResponse<WorkOrderImportResponse>, File>({
        query: (file) => {
          const formData = new FormData();
          formData.append("file", file, file.name);
          return {
            url: "/working-order/work-orders/import",
            method: "POST",
            body: formData,
            meta: { useAuthorization: true, contentType: "multipart/form-data" },
          };
        },
        transformResponse: (response: unknown) => {
          const data = normalizeImportResponse(response);
          return { data, message: "Imported" } as ApiResponse<WorkOrderImportResponse>;
        },
        invalidatesTags: [{ type: TAG, id: "LIST" }],
      }),

      getWorkOrderImportHistory: builder.query<ApiResponse<WorkOrderImportHistoryDto[]>, void>({
        query: () => ({
          url: "/working-order/work-orders/import/history",
          method: "GET",
          meta: { useAuthorization: true, contentType: "application/json" },
        }),
        transformResponse: (response: unknown) => {
          let arr: unknown[] = [];
          if (Array.isArray(response)) {
            arr = response;
          } else if (isRecord(response) && Array.isArray(response.data)) {
            arr = response.data;
          }
          return {
            data: arr as WorkOrderImportHistoryDto[],
            message: "OK",
          } as ApiResponse<WorkOrderImportHistoryDto[]>;
        },
        providesTags: [{ type: TAG, id: "LIST" }],
      }),
    }),
  });

export const {
  useImportWorkOrdersMutation,
  useGetWorkOrderImportHistoryQuery,
} = workOrdersImportApiSlice;
