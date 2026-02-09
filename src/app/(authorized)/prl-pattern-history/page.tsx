"use client";

import React, { useMemo, useState } from "react";
import { Button, Modal, Segmented, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ClockCircleOutlined, FileTextOutlined } from "@ant-design/icons";
import { MdLightbulbOutline, MdSettings, MdSwapVert } from "react-icons/md";

type HistoryTabId = "prl-history" | "machine-pattern";

type PrlHistoryRow = {
  key: string;
  period: string;
  uniq: string;
  machinePattern: string;
  productionOutput: number;
};

type MachinePatternRow = {
  key: string;
  uniq: string;
  pattern: string;
  steps: string;
  avgCycleTime: string;
  output: number;
  status: "Stable" | "Watch";
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
  timeline: LogTimelineItem[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function PrlPatternHistoryPage() {
  const [activeTab, setActiveTab] = useState<HistoryTabId>("prl-history");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUniq, setSelectedUniq] = useState<string | null>(null);

  const prlHistoryRows = useMemo<PrlHistoryRow[]>(
    () => [
      {
        key: "1",
        period: "Jan 2025",
        uniq: "LV7-001",
        machinePattern: "Pattern A: Bending > Stamping > Assembly",
        productionOutput: 1180,
      },
      {
        key: "2",
        period: "Jan 2025",
        uniq: "LV8-002",
        machinePattern: "Pattern B: Machining > Assembly",
        productionOutput: 820,
      },
      {
        key: "3",
        period: "Dec 2024",
        uniq: "LV7-001",
        machinePattern: "Pattern A: Bending > Stamping > Assembly",
        productionOutput: 1130,
      },
      {
        key: "4",
        period: "Dec 2024",
        uniq: "LV9-003",
        machinePattern: "Pattern C: Bending > Welding > Assembly",
        productionOutput: 580,
      },
    ],
    []
  );

  const machinePatternRows = useMemo<MachinePatternRow[]>(
    () => [
      {
        key: "m1",
        uniq: "LV7-001",
        pattern: "Pattern A",
        steps: "Bending > Stamping > Assembly",
        avgCycleTime: "42s",
        output: 1180,
        status: "Stable",
      },
      {
        key: "m2",
        uniq: "LV8-002",
        pattern: "Pattern B",
        steps: "Machining > Assembly",
        avgCycleTime: "51s",
        output: 820,
        status: "Watch",
      },
      {
        key: "m3",
        uniq: "LV9-003",
        pattern: "Pattern C",
        steps: "Bending > Welding > Assembly",
        avgCycleTime: "39s",
        output: 580,
        status: "Stable",
      },
    ],
    []
  );

  const uniqLogDetailsMap = useMemo<Record<string, UniqLogDetails>>(
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

  const selectedDetails = selectedUniq ? uniqLogDetailsMap[selectedUniq] : undefined;

  const openUniqDetail = (uniq: string) => {
    setSelectedUniq(uniq);
    setDetailOpen(true);
  };

  const prlColumns = useMemo<ColumnsType<PrlHistoryRow>>(
    () => [
      {
        title: "Period",
        dataIndex: "period",
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
        render: (v: string) => (
          <button type="button" onClick={() => openUniqDetail(v)}>
            <Tag className="!rounded-md !px-2 !py-0.5 !text-xs !font-semibold !text-gray-700">{v}</Tag>
          </button>
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

  const machineColumns = useMemo<ColumnsType<MachinePatternRow>>(
    () => [
      {
        title: "Uniq",
        dataIndex: "uniq",
        key: "uniq",
        render: (v: string) => <span className="text-sm font-semibold text-gray-800">{v}</span>,
      },
      {
        title: "Pattern",
        dataIndex: "pattern",
        key: "pattern",
        render: (v: string) => <span className="text-sm font-semibold text-gray-800">{v}</span>,
      },
      {
        title: "Steps",
        dataIndex: "steps",
        key: "steps",
        render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
      },
      {
        title: "Avg Cycle Time",
        dataIndex: "avgCycleTime",
        key: "avgCycleTime",
        align: "right",
        render: (v: string) => <span className="text-sm text-gray-700">{v}</span>,
      },
      {
        title: "Output",
        dataIndex: "output",
        key: "output",
        align: "right",
        render: (v: number) => <span className="text-sm font-semibold text-green-600">{formatNumber(v)}</span>,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        align: "center",
        render: (v: MachinePatternRow["status"]) => (
          <Tag
            color={v === "Watch" ? "orange" : "default"}
            className={
              v === "Watch"
                ? "!rounded-md !px-2 !py-0.5 !text-xs !font-semibold"
                : "!rounded-md !px-2 !py-0.5 !text-xs !font-semibold !text-gray-700"
            }
          >
            {v}
          </Tag>
        ),
      },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {detailOpen && selectedUniq && (
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
        destroyOnClose
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-blue-600" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Log Details for {selectedUniq ?? "-"}</div>
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
                <div className="text-sm font-semibold text-gray-900">{selectedDetails?.uniq ?? selectedUniq ?? "-"}</div>
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
