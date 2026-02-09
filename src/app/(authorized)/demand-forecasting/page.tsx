"use client";

import React, { useMemo, useState } from "react";
import { Badge, Button, Checkbox, Select, Table, Tag, Upload, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import { CaretRightOutlined, CheckOutlined, EditOutlined } from "@ant-design/icons";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from "recharts";

type DemandStepId = "dashboard" | "data-prl" | "data-delivery" | "train";

type ForecastRow = {
  key: string;
  uniq: string;
  julPrl: number;
  julDelivery: number;
  augPrl: number;
  augDelivery: number;
  sepForecastPrl: number;
  sepForecastDelivery: number;
  performanceQuality: number;
  model: "Arima" | "Regression";
};

type TrainingResultRow = ForecastRow & {
  realisticA: number;
  realisticB: number;
  selectedModel: "Arima" | "Regression";
};

const rows: ForecastRow[] = [
  {
    key: "1",
    uniq: "LV7-001",
    julPrl: 1200,
    julDelivery: 1180,
    augPrl: 1300,
    augDelivery: 1250,
    sepForecastPrl: 1400,
    sepForecastDelivery: 1350,
    performanceQuality: 95.8,
    model: "Arima",
  },
  {
    key: "2",
    uniq: "LV8-002",
    julPrl: 850,
    julDelivery: 820,
    augPrl: 900,
    augDelivery: 890,
    sepForecastPrl: 950,
    sepForecastDelivery: 920,
    performanceQuality: 97.2,
    model: "Regression",
  },
  {
    key: "3",
    uniq: "LV9-003",
    julPrl: 600,
    julDelivery: 580,
    augPrl: 650,
    augDelivery: 640,
    sepForecastPrl: 700,
    sepForecastDelivery: 680,
    performanceQuality: 96.5,
    model: "Arima",
  },
];

const uniqOptions = [{ label: "All", value: "all" }, ...rows.map((r) => ({ label: r.uniq, value: r.uniq }))];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function DemandForecastingPage() {
  const [activeStep, setActiveStep] = useState<DemandStepId>("dashboard");
  const [uniqFilter, setUniqFilter] = useState<string>("all");
  const [prlFiles, setPrlFiles] = useState<UploadFile[]>([
    {
      uid: "prl-1",
      name: "PRL_Data_Jan2025.xlsx",
      status: "done",
      size: 2500,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  ]);
  const [deliveryFiles, setDeliveryFiles] = useState<UploadFile[]>([
    {
      uid: "delivery-1",
      name: "Delivery_Data_Jan2025.xlsx",
      status: "done",
      size: 2450,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  ]);

  const [selectedPrlSources, setSelectedPrlSources] = useState<string[]>([]);
  const [selectedDeliverySources, setSelectedDeliverySources] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>(undefined);
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined);
  const [realisticDecade, setRealisticDecade] = useState<boolean>(false);
  const [trainingResultsVisible, setTrainingResultsVisible] = useState<boolean>(false);
  const [selectedTrainingRowKeys, setSelectedTrainingRowKeys] = useState<React.Key[]>([]);
  const [trainingRows, setTrainingRows] = useState<TrainingResultRow[]>(() =>
    rows.map((r) => ({
      ...r,
      realisticA: Math.max(90, Math.min(99.9, r.performanceQuality)),
      realisticB: Math.max(90, Math.min(99.9, r.performanceQuality - 1.6)),
      selectedModel: r.model,
    }))
  );

  const filteredRows = useMemo(() => {
    if (uniqFilter === "all") return rows;
    return rows.filter((r) => r.uniq === uniqFilter);
  }, [uniqFilter]);

  const activeRow = useMemo(() => {
    if (uniqFilter === "all") return rows[0];
    return rows.find((r) => r.uniq === uniqFilter) ?? rows[0];
  }, [uniqFilter]);

  const trendData = useMemo(() => {
    const base = activeRow;
    return [
      { name: "Jan", prl: Math.round(base.julPrl * 0.7), delivery: Math.round(base.julDelivery * 0.68) },
      { name: "Feb", prl: Math.round(base.julPrl * 0.62), delivery: Math.round(base.julDelivery * 0.6) },
      { name: "Mar", prl: Math.round(base.julPrl * 0.78), delivery: Math.round(base.julDelivery * 0.75) },
      { name: "Apr", prl: Math.round(base.augPrl * 0.72), delivery: Math.round(base.augDelivery * 0.7) },
      { name: "May", prl: Math.round(base.augPrl * 0.85), delivery: Math.round(base.augDelivery * 0.82) },
      { name: "Jun", prl: Math.round(base.augPrl * 0.8), delivery: Math.round(base.augDelivery * 0.78) },
      { name: "Jul", prl: base.julPrl, delivery: base.julDelivery },
    ];
  }, [activeRow]);

  const monthlyComparisonData = useMemo(() => {
    const base = activeRow;
    return [
      { name: "Jan", prl: Math.round(base.julPrl * 0.7), delivery: Math.round(base.julDelivery * 0.68) },
      { name: "Feb", prl: Math.round(base.julPrl * 0.62), delivery: Math.round(base.julDelivery * 0.6) },
      { name: "Mar", prl: Math.round(base.julPrl * 0.78), delivery: Math.round(base.julDelivery * 0.75) },
      { name: "Apr", prl: Math.round(base.augPrl * 0.72), delivery: Math.round(base.augDelivery * 0.7) },
      { name: "May", prl: Math.round(base.augPrl * 0.85), delivery: Math.round(base.augDelivery * 0.82) },
      { name: "Jun", prl: Math.round(base.augPrl * 0.8), delivery: Math.round(base.augDelivery * 0.78) },
      { name: "Jul", prl: base.julPrl, delivery: base.julDelivery },
    ];
  }, [activeRow]);

  const columns: ColumnsType<ForecastRow> = [
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      fixed: "left",
      width: 110,
      render: (value: string) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {value}
        </span>
      ),
    },
    {
      title: "Jul 25",
      key: "jul",
      children: [
        {
          title: "PRL",
          dataIndex: "julPrl",
          key: "julPrl",
          width: 90,
          render: (v: number) => <span className="text-gray-800">{formatNumber(v)}</span>,
        },
        {
          title: "Delivery",
          dataIndex: "julDelivery",
          key: "julDelivery",
          width: 100,
          render: (v: number) => <span className="text-gray-800">{formatNumber(v)}</span>,
        },
      ],
    },
    {
      title: "Aug 25",
      key: "aug",
      children: [
        {
          title: "PRL",
          dataIndex: "augPrl",
          key: "augPrl",
          width: 90,
          render: (v: number) => <span className="text-gray-800">{formatNumber(v)}</span>,
        },
        {
          title: "Delivery",
          dataIndex: "augDelivery",
          key: "augDelivery",
          width: 100,
          render: (v: number) => <span className="text-gray-800">{formatNumber(v)}</span>,
        },
      ],
    },
    {
      title: "Forecasting Sep 25",
      key: "sep",
      children: [
        {
          title: "PRL",
          dataIndex: "sepForecastPrl",
          key: "sepForecastPrl",
          width: 150,
          render: (v: number) => <span className="text-blue-600 font-semibold">{formatNumber(v)}</span>,
        },
        {
          title: "Delivery",
          dataIndex: "sepForecastDelivery",
          key: "sepForecastDelivery",
          width: 160,
          render: (v: number) => <span className="text-blue-600 font-semibold">{formatNumber(v)}</span>,
        },
      ],
    },
    {
      title: "Performance/Quality",
      dataIndex: "performanceQuality",
      key: "performanceQuality",
      width: 170,
      render: (v: number) => (
        <Tag color="green" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
          {v.toFixed(1)}%
        </Tag>
      ),
    },
    {
      title: "Model",
      dataIndex: "model",
      key: "model",
      width: 110,
      render: (v: string) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {v}
        </span>
      ),
    },
  ];

  const steps: Array<{ id: DemandStepId; label: string }> = [
    { id: "dashboard", label: "Dashboard" },
    { id: "data-prl", label: "Data PRL" },
    { id: "data-delivery", label: "Data Delivery" },
    { id: "train", label: "Train Data and Data Model" },
  ];

  const prlSourceOptions = useMemo(() => {
    const uploaded = prlFiles
      .filter((f) => !!f.name)
      .map((f) => ({ label: f.name, value: f.name }));
    const fallbackUploaded = [
      { label: "PRL_Data_Jan2025.xlsx", value: "PRL_Data_Jan2025.xlsx" },
      { label: "PRL_Data_Feb2025.xlsx", value: "PRL_Data_Feb2025.xlsx" },
    ];
    const directFromErp = [
      { label: "ERP Real-time Data", value: "ERP Real-time Data" },
      { label: "ERP Historical Data", value: "ERP Historical Data" },
    ];

    return [
      {
        label: "Data Uploaded",
        options: (uploaded.length > 0 ? uploaded : fallbackUploaded).map((o) => ({
          ...o,
          value: `PRL:${o.value}`,
        })),
      },
      {
        label: "Direct from ERP",
        options: directFromErp.map((o) => ({ ...o, value: `PRL:${o.value}` })),
      },
    ];
  }, [prlFiles]);

  const deliverySourceOptions = useMemo(() => {
    const uploaded = deliveryFiles
      .filter((f) => !!f.name)
      .map((f) => ({ label: f.name, value: f.name }));
    const fallbackUploaded = [
      { label: "Delivery_Data_Jan2025.xlsx", value: "Delivery_Data_Jan2025.xlsx" },
      { label: "Delivery_Data_Feb2025.xlsx", value: "Delivery_Data_Feb2025.xlsx" },
    ];
    const directFromErp = [
      { label: "ERP Real-time Data", value: "ERP Real-time Data" },
      { label: "ERP Historical Data", value: "ERP Historical Data" },
    ];

    return [
      {
        label: "Data Uploaded",
        options: (uploaded.length > 0 ? uploaded : fallbackUploaded).map((o) => ({
          ...o,
          value: `DELIVERY:${o.value}`,
        })),
      },
      {
        label: "Direct from ERP",
        options: directFromErp.map((o) => ({ ...o, value: `DELIVERY:${o.value}` })),
      },
    ];
  }, [deliveryFiles]);

  const periodOptions = useMemo(
    () => [
      { label: "Sep 25", value: "Sep 25" },
      { label: "Oct 25", value: "Oct 25" },
      { label: "Nov 25", value: "Nov 25" },
      { label: "Dec 25", value: "Dec 25" },
    ],
    []
  );

  const modelOptions = useMemo(
    () => [
      { label: "Arima", value: "Arima" },
      { label: "Regression", value: "Regression" },
      { label: "Neuro Decade", value: "Neuro Decade", disabled: true },
    ],
    []
  );

  const handleTrainModel = () => {
    if (!selectedModel) {
      message.error("Please select model");
      return;
    }
    if (!selectedPeriod) {
      message.error("Please select period");
      return;
    }
    if (selectedPrlSources.length === 0) {
      message.error("Please select Data PRL sources");
      return;
    }
    if (selectedDeliverySources.length === 0) {
      message.error("Please select Data Delivery sources");
      return;
    }

    message.success(
      `Training started: ${selectedModel} • ${selectedPeriod} • PRL(${selectedPrlSources.length}) • Delivery(${selectedDeliverySources.length})${
        realisticDecade ? " • Realistic Decade" : ""
      }`
    );

    setTrainingResultsVisible(true);
  };

  const handleBulkTrainSelected = () => {
    if (selectedTrainingRowKeys.length === 0) {
      message.warning("Select at least 1 UNIQ to bulk train");
      return;
    }
    message.success(`Bulk training ${selectedTrainingRowKeys.length} selected UNIQ`);
  };

  const handlePublishModel = () => {
    message.success("Model published");
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Demand Forecasting</h1>
          <p className="text-sm text-gray-500">AI-powered demand prediction and analysis</p>
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

      {/* Filter result */}
      {activeStep === "dashboard" && (
        <>
          <div className="mb-6">
            <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-blue-700">Filter result</h2>
                </div>
                <Select
                  value={uniqFilter}
                  onChange={(v) => setUniqFilter(v)}
                  options={uniqOptions}
                  style={{ width: 180 }}
                  placeholder="Filter by UNIQ"
                />
              </div>

              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <Table<ForecastRow>
                  columns={columns}
                  dataSource={filteredRows}
                  rowKey="key"
                  size="middle"
                  pagination={false}
                  scroll={{ x: "max-content" }}
                />
              </div>
            </div>
          </div>

          <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-blue-700">Charts</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="mb-2">
                  <div className="text-sm font-semibold text-gray-900">PRL vs Delivery Trend</div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="delivery"
                        stroke="#2563EB"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Delivery"
                      />
                      <Line type="monotone" dataKey="prl" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} name="PRL" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="mb-2">
                  <div className="text-sm font-semibold text-gray-900">Monthly Comparison</div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyComparisonData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="delivery" fill="#2563EB" name="Delivery" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="prl" fill="#7C3AED" name="PRL" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeStep === "data-prl" && (
        <div className="space-y-6">
          <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-blue-700">Upload data</h2>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50" />
                <Upload
                  fileList={prlFiles}
                  beforeUpload={(file) => {
                    const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
                    if (!isXlsx) {
                      message.error("Please upload an Excel file (.xlsx/.xls)");
                      return Upload.LIST_IGNORE;
                    }

                    setPrlFiles([
                      {
                        uid: `${Date.now()}`,
                        name: file.name,
                        status: "done",
                        size: file.size,
                        type: file.type,
                      },
                    ]);
                    message.success("PRL file uploaded");
                    return false;
                  }}
                  showUploadList={false}
                >
                  <Button type="primary" className="!rounded-lg" icon={<span className="mr-1">⬆</span>}>
                    Upload
                  </Button>
                </Upload>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-gray-100">
                <div className="grid grid-cols-3 bg-gray-50 text-xs font-semibold text-gray-600">
                  <div className="px-3 py-2">Data Uploaded</div>
                  <div className="px-3 py-2 text-center">Total Row Data</div>
                  <div className="px-3 py-2 text-right">Total Uniq</div>
                </div>
                <div className="grid grid-cols-3 text-sm">
                  <div className="px-3 py-3 text-gray-700">{prlFiles[0]?.name ?? "-"}</div>
                  <div className="px-3 py-3 text-center text-gray-700">2500</div>
                  <div className="px-3 py-3 text-right text-gray-700">45</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-blue-700">Current Data ERP</h2>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-10 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl text-gray-300 mb-3">∿</div>
                <div className="text-sm font-semibold text-gray-700">Connected to ERP System</div>
                <div className="text-xs text-gray-500 mt-1">Real-time data synchronization active</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeStep === "data-delivery" && (
        <div className="space-y-6">
          <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-blue-700">Upload data</h2>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50" />
                <Upload
                  fileList={deliveryFiles}
                  beforeUpload={(file) => {
                    const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
                    if (!isXlsx) {
                      message.error("Please upload an Excel file (.xlsx/.xls)");
                      return Upload.LIST_IGNORE;
                    }

                    setDeliveryFiles([
                      {
                        uid: `${Date.now()}`,
                        name: file.name,
                        status: "done",
                        size: file.size,
                        type: file.type,
                      },
                    ]);
                    message.success("Delivery file uploaded");
                    return false;
                  }}
                  showUploadList={false}
                >
                  <Button type="primary" className="!rounded-lg" icon={<span className="mr-1">⬆</span>}>
                    Upload
                  </Button>
                </Upload>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-gray-100">
                <div className="grid grid-cols-3 bg-gray-50 text-xs font-semibold text-gray-600">
                  <div className="px-3 py-2">Data Uploaded</div>
                  <div className="px-3 py-2 text-center">Total Row Data</div>
                  <div className="px-3 py-2 text-right">Total Uniq</div>
                </div>
                <div className="grid grid-cols-3 text-sm">
                  <div className="px-3 py-3 text-gray-700">{deliveryFiles[0]?.name ?? "-"}</div>
                  <div className="px-3 py-3 text-center text-gray-700">2450</div>
                  <div className="px-3 py-3 text-right text-gray-700">45</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-blue-700">Current Data ERP</h2>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-10 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl text-gray-300 mb-3">∿</div>
                <div className="text-sm font-semibold text-gray-700">Connected to ERP System</div>
                <div className="text-xs text-gray-500 mt-1">Real-time data synchronization active</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeStep === "train" && (
        <div className="space-y-6">
          <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-blue-700">Available Data Model</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Arima</div>
                <div className="text-xs text-gray-500">Active: yes</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Regression</div>
                <div className="text-xs text-gray-500">Active: yes</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Neuro Decade</div>
                <div className="text-xs text-gray-500">Active: no</div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-blue-700">Train Data</h2>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Select Data PRL (Multiple Selection)</div>
                  <Select
                    mode="multiple"
                    value={selectedPrlSources}
                    onChange={setSelectedPrlSources}
                    options={prlSourceOptions}
                    placeholder="Choose Data PRL sources"
                    className="w-full"
                    allowClear
                    maxTagCount="responsive"
                    optionFilterProp="label"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Select Period to predict</div>
                  <Select
                    value={selectedPeriod}
                    onChange={setSelectedPeriod}
                    options={periodOptions}
                    placeholder="Select period"
                    className="w-full"
                    allowClear
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Select Data Delivery (Multiple Selection)</div>
                  <Select
                    mode="multiple"
                    value={selectedDeliverySources}
                    onChange={setSelectedDeliverySources}
                    options={deliverySourceOptions}
                    placeholder="Choose Data Delivery sources"
                    className="w-full"
                    allowClear
                    maxTagCount="responsive"
                    optionFilterProp="label"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Select model</div>
                  <Select
                    value={selectedModel}
                    onChange={setSelectedModel}
                    options={modelOptions}
                    placeholder="Select model"
                    className="w-full"
                    allowClear
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Checkbox checked={realisticDecade} onChange={(e) => setRealisticDecade(e.target.checked)}>
                  Toggle Realistic Decade
                </Checkbox>

                <Button type="primary" className="!rounded-lg" icon={<CaretRightOutlined />} onClick={handleTrainModel}>
                  Train Model
                </Button>
              </div>
            </div>
          </div>

          {trainingResultsVisible && (
            <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-blue-700">Training Results</h2>
                  <Badge count={selectedTrainingRowKeys.length} showZero />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    className="!rounded-lg"
                    icon={<CaretRightOutlined />}
                    onClick={handleBulkTrainSelected}
                    disabled={selectedTrainingRowKeys.length === 0}
                  >
                    Bulk Train Selected
                  </Button>
                  <Button type="primary" className="!rounded-lg" icon={<CheckOutlined />} onClick={handlePublishModel}>
                    Publish Model
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <Table<TrainingResultRow>
                  size="middle"
                  dataSource={trainingRows}
                  rowKey="key"
                  pagination={false}
                  scroll={{ x: "max-content" }}
                  rowSelection={{
                    selectedRowKeys: selectedTrainingRowKeys,
                    onChange: (keys) => setSelectedTrainingRowKeys(keys),
                  }}
                  columns={([
                    {
                      title: "UNIQ",
                      dataIndex: "uniq",
                      key: "uniq",
                      fixed: "left",
                      width: 120,
                      render: (value: string) => (
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {value}
                        </span>
                      ),
                    },
                    {
                      title: "Jul 25",
                      key: "jul",
                      children: [
                        {
                          title: "PRL",
                          dataIndex: "julPrl",
                          key: "julPrl",
                          width: 90,
                          render: (v: number) => <span className="text-gray-800">{formatNumber(v)}</span>,
                        },
                        {
                          title: "Delivery",
                          dataIndex: "julDelivery",
                          key: "julDelivery",
                          width: 100,
                          render: (v: number) => <span className="text-gray-800">{formatNumber(v)}</span>,
                        },
                      ],
                    },
                    {
                      title: "Aug 25",
                      key: "aug",
                      children: [
                        {
                          title: "PRL",
                          dataIndex: "augPrl",
                          key: "augPrl",
                          width: 90,
                          render: (v: number) => <span className="text-gray-800">{formatNumber(v)}</span>,
                        },
                        {
                          title: "Delivery",
                          dataIndex: "augDelivery",
                          key: "augDelivery",
                          width: 100,
                          render: (v: number) => <span className="text-gray-800">{formatNumber(v)}</span>,
                        },
                      ],
                    },
                    {
                      title: "Forecasting Sep 25",
                      key: "sep",
                      children: [
                        {
                          title: "PRL",
                          dataIndex: "sepForecastPrl",
                          key: "sepForecastPrl",
                          width: 150,
                          render: (v: number) => <span className="text-blue-600 font-semibold">{formatNumber(v)}</span>,
                        },
                        {
                          title: "Delivery",
                          dataIndex: "sepForecastDelivery",
                          key: "sepForecastDelivery",
                          width: 160,
                          render: (v: number) => <span className="text-blue-600 font-semibold">{formatNumber(v)}</span>,
                        },
                      ],
                    },
                    {
                      title: "Realistic Performance",
                      key: "realistic",
                      children: [
                        {
                          title: "A",
                          dataIndex: "realisticA",
                          key: "realisticA",
                          width: 90,
                          render: (v: number) => (
                            <Tag color="green" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
                              {v.toFixed(1)}%
                            </Tag>
                          ),
                        },
                        {
                          title: "B",
                          dataIndex: "realisticB",
                          key: "realisticB",
                          width: 90,
                          render: (v: number) => (
                            <Tag color="green" className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
                              {v.toFixed(1)}%
                            </Tag>
                          ),
                        },
                      ],
                    },
                    {
                      title: "Model",
                      dataIndex: "selectedModel",
                      key: "selectedModel",
                      width: 140,
                      render: (_: string, record: TrainingResultRow) => (
                        <Select
                          value={record.selectedModel}
                          onChange={(v) =>
                            setTrainingRows((prev) =>
                              prev.map((row) => (row.key === record.key ? { ...row, selectedModel: v } : row))
                            )
                          }
                          options={[
                            { label: "Arima", value: "Arima" },
                            { label: "Regression", value: "Regression" },
                          ]}
                          size="small"
                          className="w-full"
                        />
                      ),
                    },
                    {
                      title: "Test",
                      key: "test",
                      width: 110,
                      render: (_: unknown, record: TrainingResultRow) => (
                        <Button
                          size="small"
                          className="!rounded-lg"
                          icon={<EditOutlined />}
                          onClick={() => message.info(`Test started for ${record.uniq}`)}
                        >
                          Test
                        </Button>
                      ),
                    },
                  ]) as ColumnsType<TrainingResultRow>}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeStep !== "dashboard" && activeStep !== "data-prl" && activeStep !== "data-delivery" && activeStep !== "train" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-sm font-semibold text-gray-900">{steps.find((s) => s.id === activeStep)?.label}</div>
          <div className="text-sm text-gray-500 mt-1">Coming soon.</div>
        </div>
      )}
    </div>
  );
}
