import { apiSlice } from "@/lib/api/instance";
import { unwrapBackendData } from "@/lib/api/utils/unwrap";

/**
 * Forecasting endpoints.
 *
 * IMPORTANT: the browser does NOT call the forecasting Cloud Run service
 * directly. All calls go through the ERP Go backend under
 * `/api/v1/forecasting/*`, which enforces JWT auth + RBAC, proxies to the
 * forecasting service with BasicAuth, and persists training runs / inference
 * results in the database.
 *
 * That means:
 *  - No `NEXT_PUBLIC_FORECASTING_API_URL` is needed on the frontend. The base
 *    URL is the existing ERP API (`NEXT_PUBLIC_API_URL` / `/api/proxy`).
 *  - Auth + device headers are handled by the shared `apiSlice` baseQuery via
 *    `meta: { useAuthorization: true }`.
 *  - Responses are wrapped in the ERP envelope `{ request_id, status, message,
 *    data }`; we unwrap `data` here.
 */

const FORECASTING_BASE = "/api/v1/forecasting";

/** Generate a unique request_id (required by the backend on most endpoints). */
export const buildRequestId = (prefix = "req"): string => {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
};

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ForecastDomain = "dn" | "prl";
export type ForecastScope = "global" | "custom";
export type ForecastStage = "staging" | "prod" | string;
export type TrainingStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | string;
export type SelectedModel = "Chronos2" | "RandomForest" | "Arima" | string;
export type SourceMode =
  | "v4_excel"
  | "dn_excel_horizontal"
  | "prl_excel_horizontal"
  | "parquet_tar";

// ---------------------------------------------------------------------------
// Upload Dataset
// ---------------------------------------------------------------------------

export type UploadDatasetRequest = {
  file: File;
  request_id?: string;
  domain?: ForecastDomain;
  source_mode?: SourceMode;
  name?: string;
  version?: string;
  freq?: string;
  scope?: ForecastScope;
  tenant?: string; // required when scope=custom
  uniq?: string; // required when scope=custom
};

export type UploadDatasetResponse = {
  request_id: string;
  domain: ForecastDomain;
  status: string;
  dataset_id: string;
  name: string;
  version: string;
  source_mode: SourceMode;
  gcs_uri: string;
  sha256: string;
  row_count: number;
  item_count: number;
  scope: ForecastScope;
  tenant: string;
  uniq: string;
  training_run_id: string | null;
  operation_name: string | null;
};

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export type TrainGlobalRequest = {
  request_id?: string;
  domain: ForecastDomain;
  dataset_id: string;
  fine_tune?: boolean;
  time_limit?: number;
  presets?: string;
  selected_model?: SelectedModel | null;
};

export type TrainCustomRequest = TrainGlobalRequest & {
  tenant: string;
  uniq: string;
};

export type TrainResponse = {
  request_id: string;
  domain: ForecastDomain;
  status: string;
  training_run_id: string;
  job_name: string;
  region: string;
  scope: ForecastScope;
  tenant: string;
  uniq: string;
  operation_name: string;
};

// ---------------------------------------------------------------------------
// Training runs (DB-backed, paginated)
// ---------------------------------------------------------------------------

export type TrainingRun = {
  id: string;
  request_id: string;
  training_run_id?: string;
  domain: ForecastDomain;
  scope: ForecastScope;
  tenant?: string;
  uniq?: string;
  dataset_id?: string;
  dataset_name?: string;
  dataset_version?: string;
  source_mode?: SourceMode;
  gcs_uri?: string;
  row_count?: number;
  item_count?: number;
  fine_tune?: boolean;
  time_limit?: number;
  presets?: string;
  job_name?: string;
  region?: string;
  operation_name?: string;
  status: TrainingStatus;
  model_version_id?: string;
  last_response?: Record<string, unknown> | null;
  error_message?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type ListTrainingRunsRequest = {
  scope?: ForecastScope;
  tenant?: string;
  uniq?: string;
  domain?: ForecastDomain;
  status?: TrainingStatus;
  page?: number;
  limit?: number;
};

// ---------------------------------------------------------------------------
// Proxy lookups (arrays)
// ---------------------------------------------------------------------------

export type DatasetRecord = {
  dataset_id: string;
  name?: string;
  version?: string;
  domain?: ForecastDomain;
  scope?: ForecastScope;
  row_count?: number;
  item_count?: number;
  source_mode?: SourceMode;
  created_at?: string;
};

export type ListDatasetsRequest = {
  name?: string;
  limit?: number;
};

export type ModelVersion = {
  model_version_id: string;
  domain?: ForecastDomain;
  scope?: ForecastScope;
  tenant?: string;
  uniq?: string;
  status?: string;
  accuracy?: number;
  created_at?: string;
};

export type ListModelVersionsRequest = {
  scope?: ForecastScope;
  tenant?: string;
  uniq?: string;
  status?: string;
  limit?: number;
};

export type Deployment = {
  deployment_id?: string;
  model_version_id?: string;
  domain?: ForecastDomain;
  scope?: ForecastScope;
  tenant?: string;
  uniq?: string;
  stage?: ForecastStage;
  created_at?: string;
};

export type ListDeploymentsRequest = {
  stage?: ForecastStage;
  scope?: ForecastScope;
  tenant?: string;
  uniq?: string;
  limit?: number;
};

// ---------------------------------------------------------------------------
// Inference results (DB-backed, paginated)
// ---------------------------------------------------------------------------

export type InferenceForecastPoint = {
  item_id: string;
  timestamp: string;
  mean: number;
  [quantile: string]: string | number;
};

export type InferenceResult = {
  id: string;
  request_id: string;
  domain: ForecastDomain;
  tenant?: string;
  item_id?: string;
  model_version_id: string;
  horizon: number;
  lookback_points?: number;
  mode?: string;
  avg_mean?: number;
  request_payload?: Record<string, unknown>;
  response_payload?: Record<string, unknown>;
  status?: string;
  error_message?: string;
  created_by?: string;
  created_at?: string;
};

export type ListInferenceResultsRequest = {
  domain?: ForecastDomain;
  tenant?: string;
  item_id?: string;
  status?: string;
  model_version_id?: string;
  page?: number;
  limit?: number;
};

// ---------------------------------------------------------------------------
// Promote / Reload
// ---------------------------------------------------------------------------

export type PromoteRequest = {
  request_id?: string;
  domain: ForecastDomain;
  model_version_id: string;
  stage: ForecastStage;
  scope?: ForecastScope;
  tenant?: string;
  uniq?: string;
};

export type PromoteResponse = {
  request_id: string;
  domain: ForecastDomain;
  model_version_id: string;
  stage: ForecastStage;
  status: string;
  deployed_at?: string;
};

export type ReloadResponse = {
  message?: string;
  domain?: string;
};

// ---------------------------------------------------------------------------
// Predict
// ---------------------------------------------------------------------------

export type PredictObservation = {
  item_id: string;
  timestamp: string;
  target: number;
  covariates?: Record<string, unknown>;
};

export type PredictFutureCovariate = {
  covariate_name: string;
  values: number[];
};

export type PredictRequest = {
  request_id?: string;
  domain: ForecastDomain;
  tenant?: string;
  auto_observations?: boolean;
  item_id?: string;
  horizon: number;
  lookback_points?: number;
  observations?: PredictObservation[];
  future_covariates?: PredictFutureCovariate[];
};

export type PredictResponse = {
  request_id: string;
  model_version_id: string;
  forecasts: InferenceForecastPoint[];
  avg_mean?: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_META = { useAuthorization: true } as const;

const cleanParams = (params: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      out[key] = value;
    }
  });
  return out;
};

/** Unwrap the ERP `{ data }` envelope and return the inner list ([] or { items }). */
const unwrapList = <T,>(response: unknown): T[] => {
  const data = unwrapBackendData<unknown>(response);
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).items)) {
    return (data as Record<string, unknown>).items as T[];
  }
  return [];
};

// ---------------------------------------------------------------------------
// Endpoints (injected into the shared apiSlice)
// ---------------------------------------------------------------------------

const forecastingApi = apiSlice
  .enhanceEndpoints({
    addTagTypes: [
      "ForecastingDataset",
      "ForecastingTrainingRun",
      "ForecastingModelVersion",
      "ForecastingDeployment",
      "ForecastingInferenceResult",
    ],
  })
  .injectEndpoints({
    overrideExisting: false,
    endpoints: (builder) => ({
      // --- Upload Dataset ---------------------------------------------------
      uploadDataset: builder.mutation<UploadDatasetResponse, UploadDatasetRequest>({
        query: ({ file, ...fields }) => {
          const formData = new FormData();
          formData.append("request_id", fields.request_id ?? buildRequestId("upload"));
          formData.append("file", file);
          if (fields.domain) formData.append("domain", fields.domain);
          if (fields.source_mode) formData.append("source_mode", fields.source_mode);
          if (fields.name) formData.append("name", fields.name);
          if (fields.version) formData.append("version", fields.version);
          if (fields.freq) formData.append("freq", fields.freq);
          if (fields.scope) formData.append("scope", fields.scope);
          if (fields.tenant) formData.append("tenant", fields.tenant);
          if (fields.uniq) formData.append("uniq", fields.uniq);
          return {
            url: `${FORECASTING_BASE}/datasets/upload`,
            method: "POST",
            body: formData,
            meta: AUTH_META,
          };
        },
        transformResponse: (response: unknown) => unwrapBackendData<UploadDatasetResponse>(response),
        invalidatesTags: [{ type: "ForecastingDataset", id: "LIST" }],
      }),

      // --- Training ---------------------------------------------------------
      trainGlobal: builder.mutation<TrainResponse, TrainGlobalRequest>({
        query: (body) => ({
          url: `${FORECASTING_BASE}/train/global`,
          method: "POST",
          body: {
            request_id: buildRequestId("train-global"),
            fine_tune: false,
            time_limit: 3600,
            ...body,
          },
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapBackendData<TrainResponse>(response),
        invalidatesTags: [{ type: "ForecastingTrainingRun", id: "LIST" }],
      }),

      trainCustom: builder.mutation<TrainResponse, TrainCustomRequest>({
        query: (body) => ({
          url: `${FORECASTING_BASE}/train/custom`,
          method: "POST",
          body: {
            request_id: buildRequestId("train-custom"),
            fine_tune: false,
            time_limit: 3600,
            ...body,
          },
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapBackendData<TrainResponse>(response),
        invalidatesTags: [{ type: "ForecastingTrainingRun", id: "LIST" }],
      }),

      // --- Monitor & Listing ------------------------------------------------
      getTrainingRun: builder.query<TrainingRun, string>({
        query: (trainingRunId) => ({
          url: `${FORECASTING_BASE}/training-runs/${encodeURIComponent(trainingRunId)}`,
          method: "GET",
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapBackendData<TrainingRun>(response),
        providesTags: (_result, _error, id) => [{ type: "ForecastingTrainingRun", id }],
      }),

      listTrainingRuns: builder.query<TrainingRun[], ListTrainingRunsRequest | void>({
        query: (params) => ({
          url: `${FORECASTING_BASE}/training-runs`,
          method: "GET",
          params: cleanParams({ limit: 50, page: 1, ...(params ?? {}) }),
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapList<TrainingRun>(response),
        providesTags: [{ type: "ForecastingTrainingRun", id: "LIST" }],
      }),

      listDatasets: builder.query<DatasetRecord[], ListDatasetsRequest | void>({
        query: (params) => ({
          url: `${FORECASTING_BASE}/datasets`,
          method: "GET",
          params: cleanParams({ limit: 100, ...(params ?? {}) }),
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapList<DatasetRecord>(response),
        providesTags: [{ type: "ForecastingDataset", id: "LIST" }],
      }),

      listModelVersions: builder.query<ModelVersion[], ListModelVersionsRequest | void>({
        query: (params) => ({
          url: `${FORECASTING_BASE}/model-versions`,
          method: "GET",
          params: cleanParams({ limit: 50, ...(params ?? {}) }),
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapList<ModelVersion>(response),
        providesTags: [{ type: "ForecastingModelVersion", id: "LIST" }],
      }),

      listDeployments: builder.query<Deployment[], ListDeploymentsRequest | void>({
        query: (params) => ({
          url: `${FORECASTING_BASE}/deployments`,
          method: "GET",
          params: cleanParams({ limit: 50, ...(params ?? {}) }),
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapList<Deployment>(response),
        providesTags: [{ type: "ForecastingDeployment", id: "LIST" }],
      }),

      getInferenceResult: builder.query<InferenceResult, string>({
        query: (id) => ({
          url: `${FORECASTING_BASE}/inference-results/${encodeURIComponent(id)}`,
          method: "GET",
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapBackendData<InferenceResult>(response),
        providesTags: (_result, _error, id) => [{ type: "ForecastingInferenceResult", id }],
      }),

      listInferenceResults: builder.query<InferenceResult[], ListInferenceResultsRequest | void>({
        query: (params) => ({
          url: `${FORECASTING_BASE}/inference-results`,
          method: "GET",
          params: cleanParams({ limit: 50, page: 1, ...(params ?? {}) }),
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapList<InferenceResult>(response),
        providesTags: [{ type: "ForecastingInferenceResult", id: "LIST" }],
      }),

      // --- Promote / Reload -------------------------------------------------
      promoteModel: builder.mutation<PromoteResponse, PromoteRequest>({
        query: (body) => ({
          url: `${FORECASTING_BASE}/promote`,
          method: "POST",
          body: {
            request_id: buildRequestId("promote"),
            ...body,
          },
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapBackendData<PromoteResponse>(response),
        invalidatesTags: [
          { type: "ForecastingDeployment", id: "LIST" },
          { type: "ForecastingModelVersion", id: "LIST" },
        ],
      }),

      reloadModel: builder.mutation<ReloadResponse, { domain: ForecastDomain }>({
        query: ({ domain }) => ({
          url: `${FORECASTING_BASE}/reload`,
          method: "POST",
          params: { domain },
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapBackendData<ReloadResponse>(response),
        invalidatesTags: [{ type: "ForecastingDeployment", id: "LIST" }],
      }),

      // --- Predict ----------------------------------------------------------
      predict: builder.mutation<PredictResponse, PredictRequest>({
        query: (body) => ({
          url: `${FORECASTING_BASE}/predict`,
          method: "POST",
          body: {
            request_id: buildRequestId("pred"),
            ...body,
          },
          meta: AUTH_META,
        }),
        transformResponse: (response: unknown) => unwrapBackendData<PredictResponse>(response),
        invalidatesTags: [{ type: "ForecastingInferenceResult", id: "LIST" }],
      }),
    }),
  });

export const {
  useUploadDatasetMutation,
  useTrainGlobalMutation,
  useTrainCustomMutation,
  useGetTrainingRunQuery,
  useLazyGetTrainingRunQuery,
  useListTrainingRunsQuery,
  useListDatasetsQuery,
  useListModelVersionsQuery,
  useListDeploymentsQuery,
  useGetInferenceResultQuery,
  useListInferenceResultsQuery,
  usePromoteModelMutation,
  useReloadModelMutation,
  usePredictMutation,
} = forecastingApi;

export { forecastingApi };
