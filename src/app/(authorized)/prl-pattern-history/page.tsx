"use client";

import React, { useMemo, useState } from "react";
import { Button, Modal, Segmented, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ClockCircleOutlined, FileTextOutlined } from "@ant-design/icons";
import { MdLightbulbOutline, MdSettings, MdSwapVert } from "react-icons/md";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";
import {
  useGetPrlHistoryVsDeliveryDetailQuery,
  useGetPrlHistoryVsDeliveryQuery,
  useGetPrlMachinePatternsQuery,
} from "@/lib/api/prl-log/api";

type HistoryTabId = "prl-history" | "machine-pattern";

type PrlHistoryRow = {
  key: string;
  forecastPeriod: string;
  uniq: string;
  prlQuantity: number;
  deliveryQty: number;
};

type MachinePatternRow = {
  key: string;
  uniq: string;
  forecastPeriod: string;
  machinePattern: string;
  productionOutput: number;
};

type LogTimelineItem = {
  key: string;
  title: string;
  timestamp: string;
  description: string;
  actor: string;
  oldValue?: string;
  newValue?: string;
};

type UniqLogDetails = {
  uniq: string;
  totalLogs: number;
  lastUpdated: string;
  forecastPeriod?: string;
  machinePattern?: string;
  timeline: LogTimelineItem[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function PrlPatternHistoryPage() {
  const [activeTab, setActiveTab] = useState<HistoryTabId>("prl-history");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<{ uniq: string; forecastPeriod: string } | null>(null);
  const apiEnabled = Boolean(apiBaseUrl);

  const prlHistoryQuery = useGetPrlHistoryVsDeliveryQuery({ page: 1, limit: 20 }, {
    skip: !apiEnabled,
  });
  const machinePatternQuery = useGetPrlMachinePatternsQuery({ page: 1, limit: 20 }, {
    skip: !apiEnabled,
  });
  const uniqLogsQuery = useGetPrlHistoryVsDeliveryDetailQuery({
    uniq_code: selectedTarget?.uniq ?? "",
    forecast_period: selectedTarget?.forecastPeriod ?? "",
    limit: 50,
  }, {
    skip: !apiEnabled || !detailOpen || !selectedTarget?.uniq || !selectedTarget?.forecastPeriod,
  });

  const fallbackPrlHistoryRows = useMemo<PrlHistoryRow[]>(
    () => [
      {
        key: "1",
        forecastPeriod: "Jan 2025",
        uniq: "LV7-001",
        prlQuantity: 1200,
        deliveryQty: 1180,
      },
      {
        key: "2",
        forecastPeriod: "Jan 2025",
        uniq: "LV8-002",
        prlQuantity: 850,
        deliveryQty: 820,
      },
      {
        key: "3",
        forecastPeriod: "Dec 2024",
        uniq: "LV7-001",
        prlQuantity: 1150,
        deliveryQty: 1130,
      },
      {
        key: "4",
        forecastPeriod: "Dec 2024",
        uniq: "LV9-003",
        prlQuantity: 600,
        deliveryQty: 580,
      },
    ],
    []
  );

  const fallbackMachinePatternRows = useMemo<MachinePatternRow[]>(
    () => [
      {
        key: "m1",
        uniq: "LV7-001",
        forecastPeriod: "Jan 2025",
        machinePattern: "Pattern A: Bending > Stamping > Assembly",
        productionOutput: 1180,
      },
      {
        key: "m2",
        uniq: "LV8-002",
        forecastPeriod: "Jan 2025",
        machinePattern: "Pattern B: Machining > Assembly",
        productionOutput: 820,
      },
      {
        key: "m3",
        uniq: "LV9-003",
        forecastPeriod: "Dec 2024",
        machinePattern: "Pattern C: Bending > Welding > Assembly",
        productionOutput: 580,
      },
    ],
    []
  );

  const fallbackUniqLogDetailsMap = useMemo<Record<string, UniqLogDetails>>(
    () => ({
      "LV7-001": {
        uniq: "LV7-001",
        totalLogs: 3,
        lastUpdated: "2025-01-15",
        timeline: [
          {
            key: "t1",
            title: "Updated PRL",
            timestamp: "2025-01-15 14:30:00",
            description: "Updated PRL quantity from 1150 to 1200 for January 2025",
            actor: "John Doe",
            oldValue: "1150",
            newValue: "1200",
          },
          {
            key: "t2",
            title: "Updated Delivery",
            timestamp: "2025-01-15 14:25:00",
            description: "Updated delivery quantity from 1130 to 1180",
            actor: "John Doe",
            oldValue: "1130",
            newValue: "1180",
          },
          {
            key: "t3",
            title: "Created PRL Entry",
            timestamp: "2024-12-20 09:15:00",
            description: "Created new PRL entry for December 2024",
            actor: "Jane Smith",
          },
        ],
      },
      "LV8-002": {
        uniq: "LV8-002",
        totalLogs: 2,
        lastUpdated: "2025-01-10",
        timeline: [
          {
            key: "t1",
            title: "Updated PRL",
            timestamp: "2025-01-10 11:20:00",
            description: "Updated PRL quantity from 800 to 850 for January 2025",
            actor: "Mike Johnson",
            oldValue: "800",
            newValue: "850",
          },
          {
            key: "t2",
            title: "Updated Delivery",
            timestamp: "2025-01-10 11:15:00",
            description: "Updated delivery quantity from 780 to 820",
            actor: "Mike Johnson",
            oldValue: "780",
            newValue: "820",
          },
        ],
      },
      "LV9-003": {
        uniq: "LV9-003",
        totalLogs: 1,
        lastUpdated: "2024-12-20",
        timeline: [
          {
            key: "t1",
            title: "Created PRL Entry",
            timestamp: "2024-12-20 09:15:00",
            description: "Created new PRL entry for December 2024",
            actor: "Jane Smith",
          },
        ],
      },
    }),
    []
  );

  const prlHistoryRows = useMemo<PrlHistoryRow[]>(() => {
    if (!apiEnabled) return fallbackPrlHistoryRows;
    const list = prlHistoryQuery.data?.items;
    if (!list?.length) return fallbackPrlHistoryRows;

    return list.map((row, index) => ({
      key: `${row.uniq_code ?? "uniq"}-${row.forecast_period ?? index}-${index}`,
      forecastPeriod: row.forecast_period ?? "-",
      uniq: row.uniq_code ?? "-",
      prlQuantity: Number(row.prl_quantity ?? 0),
      deliveryQty: Number(row.delivery_qty ?? 0),
    }));
  }, [apiEnabled, fallbackPrlHistoryRows, prlHistoryQuery.data]);

  const machinePatternRows = useMemo<MachinePatternRow[]>(() => {
    if (!apiEnabled) return fallbackMachinePatternRows;
    const list = machinePatternQuery.data?.items;
    if (!list?.length) return fallbackMachinePatternRows;

    return list.map((row, index) => {
      return {
        key: `${row.uniq_code ?? "machine"}-${row.forecast_period ?? index}-${index}`,
        uniq: row.uniq_code ?? "-",
        forecastPeriod: row.forecast_period ?? "-",
        machinePattern: row.machine_pattern ?? "-",
        productionOutput: Number(row.production_output ?? 0),
      };
    });
  }, [apiEnabled, fallbackMachinePatternRows, machinePatternQuery.data]);

  const uniqLogDetailsMap = useMemo<Record<string, UniqLogDetails>>(() => {
    if (!apiEnabled) return fallbackUniqLogDetailsMap;
    if (!selectedTarget?.uniq) return fallbackUniqLogDetailsMap;

    const details = uniqLogsQuery.data;
    if (!details?.timeline?.length && !details?.summary) return fallbackUniqLogDetailsMap;

    const timeline: LogTimelineItem[] = (details.timeline ?? []).map((log, index) => ({
      key: `${selectedTarget.uniq}-${selectedTarget.forecastPeriod}-${index}`,
      title: log.activity ?? "Activity",
      timestamp: log.event_time ?? "-",
      description: log.description ?? log.activity ?? "No description available",
      actor: log.actor ?? "System",
      newValue: log.new_value == null ? undefined : String(log.new_value),
    }));

    const lastUpdated = details.summary?.last_updated ?? "-";

    return {
      ...fallbackUniqLogDetailsMap,
      [selectedTarget.uniq]: {
        uniq: details.summary?.uniq_code ?? selectedTarget.uniq,
        totalLogs: Number(details.summary?.total_logs ?? timeline.length ?? 0),
        lastUpdated,
        forecastPeriod: details.summary?.forecast_period ?? selectedTarget.forecastPeriod,
        machinePattern: details.summary?.machine_pattern ?? "-",
        timeline,
      },
    };
  }, [apiEnabled, fallbackUniqLogDetailsMap, selectedTarget, uniqLogsQuery.data]);

  const selectedDetails = selectedTarget?.uniq ? uniqLogDetailsMap[selectedTarget.uniq] : undefined;

  React.useEffect(() => {
    if (!apiEnabled) return;
    const activeError = activeTab === "prl-history" ? prlHistoryQuery.error : machinePatternQuery.error;
    if (!activeError) return;
    message.error(getApiErrorMessage(activeError, "Failed to load PRL pattern history"));
  }, [activeTab, apiEnabled, machinePatternQuery.error, prlHistoryQuery.error]);

  React.useEffect(() => {
    if (!apiEnabled || !uniqLogsQuery.error || !detailOpen) return;
    message.error(getApiErrorMessage(uniqLogsQuery.error, "Failed to load UNIQ log details"));
  }, [apiEnabled, detailOpen, uniqLogsQuery.error]);

  const openUniqDetail = (uniq: string, forecastPeriod: string) => {
    setSelectedTarget({ uniq, forecastPeriod });
    setDetailOpen(true);
  };

  const prlColumns = useMemo<ColumnsType<PrlHistoryRow>>(
    () => [
      {
        title: "Period",
        dataIndex: "forecastPeriod",
        key: "period",
        render: (v: string) => (
          <Tag color="purple" className="!rounded-md !px-2 !py-0.5 !text-xs !font-semibold">
            {v}
          </Tag>
        ),
      },
      {
        title: "Uniq",
        dataIndex: "uniq",
        key: "uniq",
        render: (v: string, row) => (
          <button type="button" onClick={() => openUniqDetail(v, row.forecastPeriod)}>
            <Tag className="!rounded-md !px-2 !py-0.5 !text-xs !font-semibold !text-gray-700">{v}</Tag>
          </button>
        ),
      },
      {
        title: "PRL Quantity",
        dataIndex: "prlQuantity",
        key: "prlQuantity",
        align: "right",
        render: (v: number) => <span className="text-sm font-semibold text-gray-900">{formatNumber(v)}</span>,
      },
      {
        title: "Delivery Qty",
        dataIndex: "deliveryQty",
        key: "deliveryQty",
        align: "right",
        render: (v: number) => <span className="text-sm font-semibold text-green-600">{formatNumber(v)}</span>,
      },
    ],
    []
  );

  const machineColumns = useMemo<ColumnsType<MachinePatternRow>>(
    () => [
      {
        title: "Uniq",
        dataIndex: "uniq",
        key: "uniq",
        render: (v: string) => (
          <span className="text-sm font-semibold text-gray-800">{v}</span>
        ),
      },
      {
        title: "Period",
        dataIndex: "forecastPeriod",
        key: "forecastPeriod",
        render: (v: string) => (
          <Tag color="purple" className="!rounded-md !px-2 !py-0.5 !text-xs !font-semibold">
            {v}
          </Tag>
        ),
      },
      {
        title: "Machine Pattern",
        dataIndex: "machinePattern",
        key: "machinePattern",
        render: (v: string) => (
          <div className="flex items-center gap-2">
            <MdSettings className="text-orange-500" size={16} />
            <span className="text-sm text-gray-700">{v}</span>
          </div>
        ),
      },
      {
        title: "Production Output",
        dataIndex: "productionOutput",
        key: "productionOutput",
        align: "right",
        render: (v: number) => <span className="text-sm font-semibold text-green-600">{formatNumber(v)}</span>,
      },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {detailOpen && selectedTarget?.uniq && (
        <div className="text-sm text-gray-400 mb-3">PRL & Pattern History / PRL History / Log Details</div>
      )}

      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">PRL & Machine Pattern History Logs</h1>
          <p className="text-sm text-gray-500">Historical data and production pattern analysis</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="mb-5">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-1">
            <Segmented
              block
              value={activeTab}
              onChange={(v) => setActiveTab(v as HistoryTabId)}
              options={[
                { label: "PRL History", value: "prl-history" },
                { label: "Machine Pattern", value: "machine-pattern" },
              ]}
            />
          </div>
        </div>

        {activeTab === "prl-history" && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="text-sm font-semibold text-blue-700">Filter result</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-blue-700">
              <MdLightbulbOutline className="text-blue-600" size={16} />
              <span>Click on any UNIQ to view detailed logs</span>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100 bg-white">
              <Table<PrlHistoryRow>
                dataSource={prlHistoryRows}
                columns={prlColumns}
                rowKey="key"
                pagination={false}
                size="middle"
              />
            </div>
          </div>
        )}

        {activeTab === "machine-pattern" && (
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Machine Pattern</div>
            <div className="text-xs text-gray-500 mt-1">Production behavior summary by Uniq & pattern flow</div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
              <Table<MachinePatternRow>
                dataSource={machinePatternRows}
                columns={machineColumns}
                rowKey="key"
                pagination={false}
                size="middle"
              />
            </div>
          </div>
        )}
      </div>

      <Modal
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          <div className="flex justify-end">
            <Button className="!rounded-lg" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </div>
        }
        width={560}
        destroyOnHidden
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-blue-600" />
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Log Details for {selectedTarget?.uniq ?? "-"}
              </div>
              <div className="text-xs text-gray-500">Detailed history of all changes and activities for this UNIQ</div>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500">UNIQ</div>
                <div className="text-sm font-semibold text-gray-900">{selectedDetails?.uniq ?? selectedTarget?.uniq ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Logs</div>
                <div className="text-sm font-semibold text-gray-900">{selectedDetails?.totalLogs ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Last Updated</div>
                <div className="text-sm font-semibold text-gray-900">{selectedDetails?.lastUpdated ?? "-"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Activity Timeline</div>

            <div className="mt-4 space-y-3">
              {(selectedDetails?.timeline ?? []).map((item) => (
                <div key={item.key} className="flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="h-9 w-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <MdSwapVert className="text-blue-600" size={18} />
                    </div>
                  </div>

                  <div className="flex-1 rounded-xl border border-gray-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                      <Tag className="!rounded-md !px-2 !py-0.5 !text-xs !text-gray-700">
                        <span className="inline-flex items-center gap-1">
                          <ClockCircleOutlined className="text-gray-400" />
                          {item.timestamp}
                        </span>
                      </Tag>
                    </div>

                    <div className="mt-1 text-xs text-gray-500">{item.description}</div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-gray-400">👤</span> {item.actor}
                      </span>

                      {item.oldValue && item.newValue && (
                        <>
                          <Tag color="red" className="!rounded-md !px-2 !py-0.5 !text-xs !font-semibold">
                            Old: {item.oldValue}
                          </Tag>
                          <span className="text-gray-300">→</span>
                          <Tag color="green" className="!rounded-md !px-2 !py-0.5 !text-xs !font-semibold">
                            New: {item.newValue}
                          </Tag>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {!selectedDetails && (
                <div className="text-sm text-gray-500">No details available for this UNIQ.</div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
