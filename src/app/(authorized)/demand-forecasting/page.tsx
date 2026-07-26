"use client";

import React, { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Upload,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import {
  CaretRightOutlined,
  CheckOutlined,
  CloudUploadOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
} from "recharts";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useGetTrainingRunQuery,
  useListDatasetsQuery,
  useListDeploymentsQuery,
  useListModelVersionsQuery,
  useListTrainingRunsQuery,
  usePredictMutation,
  usePromoteModelMutation,
  useReloadModelMutation,
  useTrainCustomMutation,
  useTrainGlobalMutation,
  useUploadDatasetMutation,
  type DatasetRecord,
  type ForecastDomain,
  type ForecastScope,
  type ModelVersion,
  type SelectedModel,
  type SourceMode,
  type TrainingRun,
  type UploadDatasetResponse,
} from "@/lib/api/forecasting/api";

type DemandStepId = "dashboard" | "data-prl" | "data-delivery" | "train";

function formatNumber(value: number | undefined | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

const RUNNING_STATUSES = new Set(["PENDING", "RUNNING"]);

const statusColor = (status?: string) => {
  switch ((status ?? "").toUpperCase()) {
    case "SUCCEEDED":
      return "green";
    case "RUNNING":
      return "blue";
    case "PENDING":
      return "gold";
    case "FAILED":
      return "red";
    case "CANCELLED":
      return "default";
    default:
      return "default";
  }
};

export default function DemandForecastingPage() {
  const [activeStep, setActiveStep] = useState<DemandStepId>("dashboard");

  // -------------------------------------------------------------------------
  // Global config
  // -------------------------------------------------------------------------
  const [scope, setScope] = useState<ForecastScope>("global");
  const [tenant, setTenant] = useState<string>("mrp");
  const [uniq, setUniq] = useState<string>("");

  // -------------------------------------------------------------------------
  // Upload state (PRL + Delivery/DN)
  // -------------------------------------------------------------------------
  const [prlFiles, setPrlFiles] = useState<UploadFile[]>([]);
  const [deliveryFiles, setDeliveryFiles] = useState<UploadFile[]>([]);
  const [prlUpload, setPrlUpload] = useState<UploadDatasetResponse | null>(null);
  const [deliveryUpload, setDeliveryUpload] = useState<UploadDatasetResponse | null>(null);

  // -------------------------------------------------------------------------
  // Train state
  // -------------------------------------------------------------------------
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | undefined>(undefined);
  const [trainDomain, setTrainDomain] = useState<ForecastDomain>("dn");
  const [selectedModel, setSelectedModel] = useState<SelectedModel | undefined>(undefined);
  const [fineTune, setFineTune] = useState<boolean>(false);
  const [timeLimit, setTimeLimit] = useState<number>(3600);
  const [activeTrainingRunId, setActiveTrainingRunId] = useState<string | undefined>(undefined);
  const [selectedModelVersionId, setSelectedModelVersionId] = useState<string | undefined>(undefined);

  // -------------------------------------------------------------------------
  // Predict state
  // -------------------------------------------------------------------------
  const [predictItemId, setPredictItemId] = useState<string>("138");
  const [predictHorizon, setPredictHorizon] = useState<number>(30);
  const [predictDomain, setPredictDomain] = useState<ForecastDomain>("dn");

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------
  const datasetsQuery = useListDatasetsQuery();
  const trainingRunsQuery = useListTrainingRunsQuery(
    scope === "custom" ? { scope, tenant, uniq: uniq || undefined } : { scope }
  );
  const modelVersionsQuery = useListModelVersionsQuery(
    scope === "custom" ? { scope, tenant, uniq: uniq || undefined } : { scope }
  );
  const deploymentsQuery = useListDeploymentsQuery({ scope });

  const trainingRunQuery = useGetTrainingRunQuery(activeTrainingRunId as string, {
    skip: !activeTrainingRunId,
    pollingInterval: 5000,
  });
  const activeRun = trainingRunQuery.data;
  const isRunActive = activeRun ? RUNNING_STATUSES.has((activeRun.status ?? "").toUpperCase()) : false;

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------
  const [uploadDataset, uploadState] = useUploadDatasetMutation();
  const [trainGlobal, trainGlobalState] = useTrainGlobalMutation();
  const [trainCustom, trainCustomState] = useTrainCustomMutation();
  const [promoteModel, promoteState] = usePromoteModelMutation();
  const [reloadModel, reloadState] = useReloadModelMutation();
  const [predict, predictState] = usePredictMutation();

  const isTraining = trainGlobalState.isLoading || trainCustomState.isLoading;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleUpload = async (
    file: File,
    kind: "prl" | "delivery"
  ): Promise<void> => {
    const isPrl = kind === "prl";
    const domain: ForecastDomain = isPrl ? "prl" : "dn";
    const source_mode: SourceMode = isPrl ? "prl_excel_horizontal" : "v4_excel";

    if (scope === "custom" && (!tenant || !uniq)) {
      message.error("Scope custom requires both Tenant and Uniq");
      return;
    }

    try {
      const result = await uploadDataset({
        file,
        domain,
        source_mode,
        scope,
        name: file.name.replace(/\.[^.]+$/, ""),
        ...(scope === "custom" ? { tenant, uniq } : {}),
        ...(isPrl ? { freq: "M" } : {}),
      }).unwrap();

      if (isPrl) {
        setPrlUpload(result);
      } else {
        setDeliveryUpload(result);
        setTrainDomain("dn");
      }
      setSelectedDatasetId(result.dataset_id);
      message.success(`Dataset registered: ${result.name} (${formatNumber(result.row_count)} rows)`);
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to upload dataset"));
    }
  };

  const handleTrain = async (): Promise<void> => {
    if (!selectedDatasetId) {
      message.error("Select an uploaded dataset first");
      return;
    }
    if (scope === "custom" && (!tenant || !uniq)) {
      message.error("Scope custom requires both Tenant and Uniq");
      return;
    }

    try {
      const base = {
        domain: trainDomain,
        dataset_id: selectedDatasetId,
        fine_tune: fineTune,
        time_limit: timeLimit,
        selected_model: selectedModel ?? null,
      };
      const result =
        scope === "custom"
          ? await trainCustom({ ...base, tenant, uniq }).unwrap()
          : await trainGlobal(base).unwrap();

      setActiveTrainingRunId(result.training_run_id);
      message.success(`Training triggered (run ${result.training_run_id.slice(0, 8)}…)`);
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to trigger training"));
    }
  };

  const handlePromote = async (modelVersionId: string): Promise<void> => {
    try {
      await promoteModel({
        domain: trainDomain,
        model_version_id: modelVersionId,
        stage: "prod",
        scope,
        ...(scope === "custom" ? { tenant, uniq } : {}),
      }).unwrap();
      await reloadModel({ domain: trainDomain }).unwrap();
      message.success("Model promoted to prod and reloaded");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to promote model"));
    }
  };

  const handlePredict = async (): Promise<void> => {
    if (!predictItemId) {
      message.error("Enter an item / uniq to predict");
      return;
    }
    try {
      await predict({
        domain: predictDomain,
        tenant,
        auto_observations: true,
        item_id: predictItemId,
        horizon: predictHorizon,
        lookback_points: 30,
      }).unwrap();
      message.success("Forecast generated");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to generate forecast"));
    }
  };

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const datasetOptions = useMemo(() => {
    const datasets = datasetsQuery.data ?? [];
    const fromApi = datasets.map((d) => ({
      label: `${d.name ?? d.dataset_id} • ${d.domain ?? "?"} • ${d.scope ?? "?"}${
        d.row_count ? ` • ${formatNumber(d.row_count)} rows` : ""
      }`,
      value: d.dataset_id,
    }));
    const uploaded = [prlUpload, deliveryUpload]
      .filter((u): u is UploadDatasetResponse => Boolean(u))
      .filter((u) => !datasets.some((d) => d.dataset_id === u.dataset_id))
      .map((u) => ({
        label: `${u.name} • ${u.domain} • ${u.scope} • ${formatNumber(u.row_count)} rows (just uploaded)`,
        value: u.dataset_id,
      }));
    return [...uploaded, ...fromApi];
  }, [datasetsQuery.data, prlUpload, deliveryUpload]);

  const predictChartData = useMemo(() => {
    const forecasts = predictState.data?.forecasts ?? [];
    return forecasts.map((f) => ({
      name: (f.timestamp ?? "").slice(0, 10),
      mean: typeof f.mean === "number" ? f.mean : Number(f.mean) || 0,
      low: typeof f["0.1"] === "number" ? (f["0.1"] as number) : Number(f["0.1"]) || 0,
      high: typeof f["0.9"] === "number" ? (f["0.9"] as number) : Number(f["0.9"]) || 0,
    }));
  }, [predictState.data]);

  const steps: Array<{ id: DemandStepId; label: string }> = [
    { id: "dashboard", label: "Dashboard & Predict" },
    { id: "data-prl", label: "Data PRL" },
    { id: "data-delivery", label: "Data Delivery" },
    { id: "train", label: "Train, Monitor & Promote" },
  ];

  // -------------------------------------------------------------------------
  // Column defs
  // -------------------------------------------------------------------------
  const trainingRunColumns: ColumnsType<TrainingRun> = [
    {
      title: "Run ID",
      dataIndex: "training_run_id",
      key: "training_run_id",
      width: 140,
      render: (v: string) => (
        <span className="font-mono text-xs text-gray-700">{v ? `${v.slice(0, 8)}…` : "-"}</span>
      ),
    },
    { title: "Domain", dataIndex: "domain", key: "domain", width: 80 },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (v: string) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    { title: "Scope", dataIndex: "scope", key: "scope", width: 90 },
    {
      title: "Model Version",
      dataIndex: "model_version_id",
      key: "model_version_id",
      width: 150,
      render: (v: string | null) => (
        <span className="font-mono text-xs text-gray-600">{v ? `${v.slice(0, 8)}…` : "-"}</span>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      render: (_: unknown, record: TrainingRun) => (
        <Button size="small" onClick={() => setActiveTrainingRunId(record.training_run_id)}>
          Monitor
        </Button>
      ),
    },
  ];

  const modelVersionColumns: ColumnsType<ModelVersion> = [
    {
      title: "Version ID",
      dataIndex: "model_version_id",
      key: "model_version_id",
      width: 150,
      render: (v: string) => (
        <span className="font-mono text-xs text-gray-700">{v ? `${v.slice(0, 8)}…` : "-"}</span>
      ),
    },
    { title: "Name", dataIndex: "name", key: "name", width: 160, render: (v: string) => v ?? "-" },
    { title: "Scope", dataIndex: "scope", key: "scope", width: 90 },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: string) => <Tag color={statusColor(v)}>{v ?? "-"}</Tag>,
    },
    {
      title: "Accuracy",
      dataIndex: "accuracy",
      key: "accuracy",
      width: 160,
      render: (accuracy: number | null | undefined) =>
        accuracy !== undefined && accuracy !== null ? (
          <Tag color="blue">{Number(accuracy).toFixed(4)}</Tag>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      title: "Promote",
      key: "promote",
      width: 130,
      render: (_: unknown, record: ModelVersion) => (
        <Button
          size="small"
          type="primary"
          icon={<CheckOutlined />}
          loading={promoteState.isLoading || reloadState.isLoading}
          onClick={() => handlePromote(record.model_version_id)}
        >
          Promote
        </Button>
      ),
    },
  ];

  const datasetColumns: ColumnsType<DatasetRecord> = [
    { title: "Name", dataIndex: "name", key: "name", render: (v: string) => v ?? "-" },
    { title: "Domain", dataIndex: "domain", key: "domain", width: 90 },
    { title: "Scope", dataIndex: "scope", key: "scope", width: 90 },
    {
      title: "Rows",
      dataIndex: "row_count",
      key: "row_count",
      width: 110,
      render: (v: number) => formatNumber(v),
    },
    {
      title: "Items",
      dataIndex: "item_count",
      key: "item_count",
      width: 100,
      render: (v: number) => formatNumber(v),
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      render: (_: unknown, record: DatasetRecord) => (
        <Button
          size="small"
          onClick={() => {
            setSelectedDatasetId(record.dataset_id);
            if (record.domain) setTrainDomain(record.domain);
            setActiveStep("train");
            message.info("Dataset selected for training");
          }}
        >
          Use
        </Button>
      ),
    },
  ];

  // -------------------------------------------------------------------------
  // Renderers
  // -------------------------------------------------------------------------
  const renderUploadStep = (kind: "prl" | "delivery") => {
    const isPrl = kind === "prl";
    const files = isPrl ? prlFiles : deliveryFiles;
    const setFiles = isPrl ? setPrlFiles : setDeliveryFiles;
    const uploaded = isPrl ? prlUpload : deliveryUpload;

    return (
      <div className="space-y-6">
        <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-blue-700">
              {isPrl ? "Upload PRL Dataset" : "Upload Delivery (DN) Dataset"}
            </h2>
            <Tag color={isPrl ? "purple" : "blue"}>
              domain={isPrl ? "prl" : "dn"} • {isPrl ? "prl_excel_horizontal" : "v4_excel"}
            </Tag>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            {isPrl && (
              <Alert
                type="info"
                showIcon
                className="!mb-4"
                message="PRL horizontal upload runs ERP validation"
                description="Each Uniq is validated against BOM, PRL, and customer bom_codes. Rejected uniqs are dropped; upload fails (422) if all are rejected or ERP env is not configured."
              />
            )}
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs text-gray-500">
                Accepted: .xlsx / .xls{isPrl ? " (PRL horizontal)" : " (V4 Excel)"}
              </div>
              <Upload
                fileList={files}
                beforeUpload={(file) => {
                  const isXlsx =
                    file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
                  if (!isXlsx) {
                    message.error("Please upload an Excel file (.xlsx/.xls)");
                    return Upload.LIST_IGNORE;
                  }
                  setFiles([
                    {
                      uid: `${Date.now()}`,
                      name: file.name,
                      status: "done",
                      size: file.size,
                      type: file.type,
                    },
                  ]);
                  void handleUpload(file as File, kind);
                  return false;
                }}
                showUploadList={false}
              >
                <Button
                  type="primary"
                  className="!rounded-lg"
                  icon={<CloudUploadOutlined />}
                  loading={uploadState.isLoading}
                >
                  Upload &amp; Register
                </Button>
              </Upload>
            </div>

            {uploaded ? (
              <Descriptions
                className="!mt-4"
                bordered
                size="small"
                column={2}
                title="Registered dataset"
              >
                <Descriptions.Item label="Dataset ID">
                  <span className="font-mono text-xs">{uploaded.dataset_id}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color="green">{uploaded.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Name">{uploaded.name}</Descriptions.Item>
                <Descriptions.Item label="Version">{uploaded.version}</Descriptions.Item>
                <Descriptions.Item label="Rows">{formatNumber(uploaded.row_count)}</Descriptions.Item>
                <Descriptions.Item label="Items">{formatNumber(uploaded.item_count)}</Descriptions.Item>
              </Descriptions>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                No dataset uploaded in this session yet.
              </div>
            )}
          </div>
        </div>

        <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-blue-700">Registered Datasets</h2>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => datasetsQuery.refetch()}>
              Refresh
            </Button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <Table<DatasetRecord>
              columns={datasetColumns}
              dataSource={datasetsQuery.data ?? []}
              rowKey="dataset_id"
              loading={datasetsQuery.isFetching}
              size="middle"
              pagination={{ pageSize: 5 }}
              scroll={{ x: "max-content" }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Demand Forecasting</h1>
              <p className="text-sm text-gray-500">
                Forecasting pipeline: upload → train → monitor → promote → predict
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">API</div>
              <div className="font-mono text-xs text-gray-600 break-all max-w-[280px]">
                ERP backend · /api/v1/forecasting
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global scope config */}
      <div className="mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Scope</div>
              <Select
                value={scope}
                onChange={(v) => setScope(v)}
                style={{ width: 140 }}
                options={[
                  { label: "Global", value: "global" },
                  { label: "Custom", value: "custom" },
                ]}
              />
            </div>
            {scope === "custom" && (
              <>
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Tenant</div>
                  <Input value={tenant} onChange={(e) => setTenant(e.target.value)} style={{ width: 140 }} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Uniq</div>
                  <Input
                    value={uniq}
                    onChange={(e) => setUniq(e.target.value)}
                    placeholder="e.g. 138"
                    style={{ width: 140 }}
                  />
                </div>
              </>
            )}
            <div className="text-xs text-gray-400 ml-auto">
              Requests go through the ERP backend (auth + RBAC). Requires the
              &quot;forecasting&quot; permission.
            </div>
          </div>
        </div>
      </div>

      {/* Steps/Tabs */}
      <div className="mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {steps.map((s) => {
              const isActive = s.id === activeStep;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStep(s.id)}
                  className={
                    "w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors " +
                    (isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-100"
                      : "bg-white text-gray-600 hover:bg-gray-50 border border-transparent")
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dashboard & Predict */}
      {activeStep === "dashboard" && (
        <div className="space-y-6">
          <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-blue-700">Predict</h2>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Domain</div>
                  <Select
                    value={predictDomain}
                    onChange={(v) => setPredictDomain(v)}
                    style={{ width: 120 }}
                    options={[
                      { label: "DN", value: "dn" },
                      { label: "PRL", value: "prl" },
                    ]}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Item / Uniq</div>
                  <Input
                    value={predictItemId}
                    onChange={(e) => setPredictItemId(e.target.value)}
                    placeholder="item_id"
                    style={{ width: 160 }}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Horizon (max 30)</div>
                  <InputNumber
                    min={1}
                    max={30}
                    value={predictHorizon}
                    onChange={(v) => setPredictHorizon(v ?? 30)}
                    style={{ width: 140 }}
                  />
                </div>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  className="!rounded-lg"
                  loading={predictState.isLoading}
                  onClick={handlePredict}
                >
                  Generate Forecast
                </Button>
              </div>

              <div className="mt-6 h-72">
                {predictChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={predictChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="high"
                        stroke="#93C5FD"
                        fill="#DBEAFE"
                        name="P90"
                      />
                      <Area
                        type="monotone"
                        dataKey="mean"
                        stroke="#2563EB"
                        fill="#BFDBFE"
                        name="Mean"
                      />
                      <Area
                        type="monotone"
                        dataKey="low"
                        stroke="#60A5FA"
                        fill="#EFF6FF"
                        name="P10"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Empty description="Run a forecast to see predictions" />
                  </div>
                )}
              </div>

              {predictState.data && (
                <div className="mt-2 text-xs text-gray-500">
                  Model version:{" "}
                  <span className="font-mono">{predictState.data.model_version_id}</span> • request{" "}
                  <span className="font-mono">{predictState.data.request_id}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-blue-700">Active Deployments</h2>
                <Button size="small" icon={<ReloadOutlined />} onClick={() => deploymentsQuery.refetch()}>
                  Refresh
                </Button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <Table
                  size="small"
                  rowKey={(r) => r.deployment_id ?? r.model_version_id ?? Math.random().toString()}
                  loading={deploymentsQuery.isFetching}
                  dataSource={deploymentsQuery.data ?? []}
                  pagination={false}
                  columns={[
                    { title: "Stage", dataIndex: "stage", key: "stage" },
                    { title: "Domain", dataIndex: "domain", key: "domain" },
                    { title: "Scope", dataIndex: "scope", key: "scope" },
                    {
                      title: "Model Version",
                      dataIndex: "model_version_id",
                      key: "model_version_id",
                      render: (v: string) => (
                        <span className="font-mono text-xs">{v ? `${v.slice(0, 8)}…` : "-"}</span>
                      ),
                    },
                  ]}
                />
              </div>
            </div>

            <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-blue-700">Recent Training Runs</h2>
                <Button size="small" icon={<ReloadOutlined />} onClick={() => trainingRunsQuery.refetch()}>
                  Refresh
                </Button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <Table<TrainingRun>
                  size="small"
                  rowKey="training_run_id"
                  loading={trainingRunsQuery.isFetching}
                  dataSource={trainingRunsQuery.data ?? []}
                  pagination={{ pageSize: 5 }}
                  columns={trainingRunColumns}
                  scroll={{ x: "max-content" }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeStep === "data-prl" && renderUploadStep("prl")}
      {activeStep === "data-delivery" && renderUploadStep("delivery")}

      {/* Train, Monitor & Promote */}
      {activeStep === "train" && (
        <div className="space-y-6">
          <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-blue-700">Train Model</h2>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="lg:col-span-2">
                  <div className="text-xs font-semibold text-gray-700 mb-1">Dataset</div>
                  <Select
                    value={selectedDatasetId}
                    onChange={setSelectedDatasetId}
                    options={datasetOptions}
                    placeholder="Select an uploaded dataset"
                    className="w-full"
                    showSearch
                    optionFilterProp="label"
                    loading={datasetsQuery.isFetching}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Domain</div>
                  <Select
                    value={trainDomain}
                    onChange={(v) => setTrainDomain(v)}
                    className="w-full"
                    options={[
                      { label: "DN", value: "dn" },
                      { label: "PRL", value: "prl" },
                    ]}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Model (optional)</div>
                  <Select
                    value={selectedModel}
                    onChange={(v) => setSelectedModel(v)}
                    className="w-full"
                    allowClear
                    placeholder="Default: Chronos2"
                    options={[
                      { label: "Chronos2", value: "Chronos2" },
                      { label: "RandomForest", value: "RandomForest" },
                      { label: "Arima", value: "Arima" },
                    ]}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Time limit (seconds)</div>
                  <InputNumber
                    min={60}
                    value={timeLimit}
                    onChange={(v) => setTimeLimit(v ?? 3600)}
                    className="!w-full"
                  />
                </div>
                <div className="flex items-end">
                  <Checkbox checked={fineTune} onChange={(e) => setFineTune(e.target.checked)}>
                    Fine tune
                  </Checkbox>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end">
                <Button
                  type="primary"
                  className="!rounded-lg"
                  icon={<CaretRightOutlined />}
                  loading={isTraining}
                  onClick={handleTrain}
                >
                  Trigger Training ({scope})
                </Button>
              </div>
            </div>
          </div>

          {activeTrainingRunId && (
            <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-blue-700">Training Monitor</h2>
                  {isRunActive && <Spin size="small" />}
                </div>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => trainingRunQuery.refetch()}
                >
                  Refresh
                </Button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                {activeRun ? (
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Run ID">
                      <span className="font-mono text-xs">{activeRun.training_run_id}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Status">
                      <Tag color={statusColor(activeRun.status)}>{activeRun.status}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Model Version">
                      <span className="font-mono text-xs">{activeRun.model_version_id ?? "-"}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Domain">{activeRun.domain ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label="Last response" span={2}>
                      {activeRun.last_response ? (
                        <span className="font-mono text-xs break-all">
                          {JSON.stringify(activeRun.last_response)}
                        </span>
                      ) : (
                        <span className="text-gray-400">Available after training completes</span>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Spin />
                  </div>
                )}
                {activeRun?.model_version_id && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      loading={promoteState.isLoading || reloadState.isLoading}
                      onClick={() => handlePromote(activeRun.model_version_id as string)}
                    >
                      Promote this model to prod
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-blue-700">Model Versions</h2>
                <Badge count={modelVersionsQuery.data?.length ?? 0} showZero />
              </div>
              <Space>
                <Button size="small" icon={<ReloadOutlined />} onClick={() => modelVersionsQuery.refetch()}>
                  Refresh
                </Button>
              </Space>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <Table<ModelVersion>
                size="middle"
                rowKey="model_version_id"
                loading={modelVersionsQuery.isFetching}
                dataSource={modelVersionsQuery.data ?? []}
                pagination={{ pageSize: 8 }}
                columns={modelVersionColumns}
                scroll={{ x: "max-content" }}
                rowSelection={{
                  type: "radio",
                  selectedRowKeys: selectedModelVersionId ? [selectedModelVersionId] : [],
                  onChange: (keys) => setSelectedModelVersionId(keys[0] as string),
                }}
              />
            </div>
          </div>

          <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-blue-700">Training Runs</h2>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => trainingRunsQuery.refetch()}>
                Refresh
              </Button>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <Table<TrainingRun>
                size="middle"
                rowKey="training_run_id"
                loading={trainingRunsQuery.isFetching}
                dataSource={trainingRunsQuery.data ?? []}
                pagination={{ pageSize: 8 }}
                columns={trainingRunColumns}
                scroll={{ x: "max-content" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
