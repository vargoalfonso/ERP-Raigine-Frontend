"use client";

import { useMemo, useState } from "react";
import { Button, Card, DatePicker, InputNumber, message } from "antd";
import { LeftOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { Dayjs } from "dayjs";

type SplitMethod = "percentage" | "history";
type HistoryRange = {
  from?: Dayjs | null;
  to?: Dayjs | null;
};

type HistoryConfig = {
  po1: HistoryRange;
  po2: HistoryRange;
};

const DEFAULT_PERCENTAGE = {
  po1: 0,
  po2: 100,
};

const cardBaseClass = "rounded-[14px] border bg-white transition-all";
const labelClass = "mb-1 text-[12px] font-medium text-gray-700";

function formatDateRange(range: HistoryRange) {
  if (!range.from || !range.to) return "Not set";
  return `${range.from.format("DD MMM YYYY")} - ${range.to.format("DD MMM YYYY")}`;
}

export default function PurchaseOrderCreatePage() {
  const router = useRouter();
  const [method, setMethod] = useState<SplitMethod>("percentage");
  const [percentage, setPercentage] = useState(DEFAULT_PERCENTAGE);
  const [historyConfig, setHistoryConfig] = useState<HistoryConfig>({
    po1: { from: null, to: null },
    po2: { from: null, to: null },
  });

  const totalPercentage = useMemo(() => {
    return Number(percentage.po1 || 0) + Number(percentage.po2 || 0);
  }, [percentage]);

  const totalClassName =
    totalPercentage === 100
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : "border-red-300 bg-red-50 text-red-700";

  const resetDefaults = () => {
    if (method === "percentage") {
      setPercentage(DEFAULT_PERCENTAGE);
      return;
    }
    setHistoryConfig({
      po1: { from: null, to: null },
      po2: { from: null, to: null },
    });
  };

  const validateAndSave = () => {
    if (method === "percentage") {
      if (totalPercentage !== 100) {
        message.error("Total percentage must equal 100%.");
        return;
      }
      message.success("PO split configuration saved");
      router.push("/system-settings");
      return;
    }

    const invalidPo1 = !historyConfig.po1.from || !historyConfig.po1.to;
    const invalidPo2 = !historyConfig.po2.from || !historyConfig.po2.to;

    if (invalidPo1 || invalidPo2) {
      message.error("Please complete PO1 and PO2 history delivery date ranges.");
      return;
    }

    message.success("PO split configuration saved");
    router.push("/system-settings");
  };

  const updateHistoryRange = (
    bucket: keyof HistoryConfig,
    key: keyof HistoryRange,
    value: Dayjs | null
  ) => {
    setHistoryConfig((prev) => ({
      ...prev,
      [bucket]: {
        ...prev[bucket],
        [key]: value,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-[#EEF5FF] px-6 py-6">
      <div className="mx-auto max-w-[820px]">
        <div className="overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <PlusOutlined />
                  </div>
                  <div>
                    <div className="text-[18px] font-semibold text-gray-900">System Parameters</div>
                    <div className="text-[12px] text-gray-500">Comprehensive ERP parameter management and configuration</div>
                  </div>
                </div>
              </div>

              <Button type="primary" className="rounded-lg" icon={<PlusOutlined />}>
                19 Configuration Modules
              </Button>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-gray-600 transition hover:text-gray-900"
              onClick={() => router.push("/system-settings")}
            >
              <LeftOutlined />
              <span>Back to System Parameters</span>
            </button>

            <Card className="rounded-2xl border border-gray-200 shadow-none" bodyStyle={{ padding: 18 }}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[18px] font-semibold text-gray-900">PO - Split Settings</div>
                  <div className="text-[12px] text-gray-500">Configure purchase order split settings</div>
                </div>
                <Button type="primary" size="small" icon={<PlusOutlined />} className="rounded-md">
                  Add Parameter
                </Button>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-[#FCFCFD] p-4">
                <div className="mb-1 text-[15px] font-semibold text-gray-900">Purchase Order Split Method</div>
                <div className="mb-4 text-[12px] text-gray-500">
                  Choose how to split purchase orders between PO1 and PO2. Total must equal 100% of Purchase Request.
                </div>

                <div className="space-y-4">
                  <div
                    className={`${cardBaseClass} ${
                      method === "percentage"
                        ? "border-blue-400 bg-blue-50/40 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
                        : "border-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full p-4 text-left"
                      onClick={() => setMethod("percentage")}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-4 w-4 rounded-full border border-gray-400 p-[3px]">
                          <div
                            className={`h-full w-full rounded-full ${
                              method === "percentage" ? "bg-blue-600" : "bg-transparent"
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-semibold text-gray-900">Option 1: PO based on Percentage</div>
                          <div className="mt-1 text-[11px] text-gray-500">Applied for all UNIQ. Set fixed percentage split between PO1 and PO2.</div>

                          {method === "percentage" ? (
                            <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4">
                              <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] text-blue-700">
                                <div className="font-semibold">Information:</div>
                                <div>You can fill the percentage at menu PO Budget. Total percentage must equal 100%.</div>
                              </div>

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div>
                                  <div className={labelClass}>PO 1 Percentage <span className="text-red-500">*</span></div>
                                  <InputNumber
                                    min={0}
                                    max={100}
                                    value={percentage.po1}
                                    onChange={(value) => setPercentage((prev) => ({ ...prev, po1: value ?? 0 }))}
                                    className="w-full"
                                    addonAfter="%"
                                  />
                                </div>
                                <div>
                                  <div className={labelClass}>PO 2 Percentage <span className="text-red-500">*</span></div>
                                  <InputNumber
                                    min={0}
                                    max={100}
                                    value={percentage.po2}
                                    onChange={(value) => setPercentage((prev) => ({ ...prev, po2: value ?? 0 }))}
                                    className="w-full"
                                    addonAfter="%"
                                  />
                                </div>
                                <div>
                                  <div className={labelClass}>Total Percentage</div>
                                  <div className={`flex h-8 items-center rounded-md border px-3 text-sm font-semibold ${totalClassName}`}>
                                    {totalPercentage}%
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 rounded-lg bg-gray-50 p-3 text-[11px] text-gray-600">
                                <div><span className="font-semibold">Logic:</span> if percentage is created, then number of PR will be divided based on PO 1 and PO 2 percentage.</div>
                                <div className="mt-1">Example: if PR = 1000 pcs, PO1 (50%) = 500 pcs, PO2 (50%) = 500 pcs.</div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </div>

                  <div
                    className={`${cardBaseClass} ${
                      method === "history"
                        ? "border-fuchsia-400 bg-fuchsia-50/40 shadow-[0_0_0_1px_rgba(217,70,239,0.12)]"
                        : "border-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full p-4 text-left"
                      onClick={() => setMethod("history")}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-4 w-4 rounded-full border border-gray-400 p-[3px]">
                          <div
                            className={`h-full w-full rounded-full ${
                              method === "history" ? "bg-blue-600" : "bg-transparent"
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-semibold text-gray-900">Option 2: PO based on History Forecasting</div>
                          <div className="mt-1 text-[11px] text-gray-500">Can be applied per UNIQ. Based on historical delivery data from specific date ranges.</div>

                          {method === "history" ? (
                            <div className="mt-4 rounded-xl border border-fuchsia-200 bg-white p-4">
                              <div className="mb-4 rounded-lg border border-fuchsia-100 bg-fuchsia-50 p-3 text-[11px] text-fuchsia-700">
                                <div className="font-semibold">Information:</div>
                                <div>Set date ranges for historical delivery analysis. System will calculate optimal split based on historical data.</div>
                              </div>

                              <div className="space-y-4">
                                <div>
                                  <div className="mb-2 inline-flex rounded-md bg-[#EEE8FF] px-2 py-0.5 text-[10px] font-semibold text-[#6B46C1]">PO 1</div>
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                      <div className={labelClass}>From Date <span className="text-red-500">*</span></div>
                                      <DatePicker
                                        value={historyConfig.po1.from ?? null}
                                        onChange={(value) => updateHistoryRange("po1", "from", value)}
                                        className="w-full"
                                        format="DD MMM YYYY"
                                      />
                                    </div>
                                    <div>
                                      <div className={labelClass}>To Date <span className="text-red-500">*</span></div>
                                      <DatePicker
                                        value={historyConfig.po1.to ?? null}
                                        onChange={(value) => updateHistoryRange("po1", "to", value)}
                                        className="w-full"
                                        format="DD MMM YYYY"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <div className="mb-2 inline-flex rounded-md bg-[#F3E8FF] px-2 py-0.5 text-[10px] font-semibold text-[#A21CAF]">PO 2</div>
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                      <div className={labelClass}>From Date <span className="text-red-500">*</span></div>
                                      <DatePicker
                                        value={historyConfig.po2.from ?? null}
                                        onChange={(value) => updateHistoryRange("po2", "from", value)}
                                        className="w-full"
                                        format="DD MMM YYYY"
                                      />
                                    </div>
                                    <div>
                                      <div className={labelClass}>To Date <span className="text-red-500">*</span></div>
                                      <DatePicker
                                        value={historyConfig.po2.to ?? null}
                                        onChange={(value) => updateHistoryRange("po2", "to", value)}
                                        className="w-full"
                                        format="DD MMM YYYY"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 rounded-lg bg-gray-50 p-3 text-[11px] text-gray-600">
                                <div><span className="font-semibold">Logic:</span> System analyzes historical delivery data within specified date ranges to determine optimal split ratios for PO1 and PO2.</div>
                                <div className="mt-1">Example: PO1 based on Jan-Mar delivery history, PO2 based on Apr-Jun delivery history.</div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-3">
                  <Button onClick={resetDefaults}>Reset to Default</Button>
                  <Button type="primary" onClick={validateAndSave}>Save Configuration</Button>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border border-gray-200 shadow-none" bodyStyle={{ padding: 18 }}>
              <div className="mb-4 text-[14px] font-semibold text-gray-900">Configuration Summary</div>

              {method === "percentage" ? (
                <div className="space-y-2 text-[12px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">Selected Method:</span>
                    <span className="inline-flex rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">Percentage Based</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">PO 1 Percentage:</span>
                    <span className="font-medium text-gray-900">{percentage.po1}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">PO 2 Percentage:</span>
                    <span className="font-medium text-gray-900">{percentage.po2}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">Total:</span>
                    <span className={`font-semibold ${totalPercentage === 100 ? "text-emerald-600" : "text-red-600"}`}>{totalPercentage}%</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-[12px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">Selected Method:</span>
                    <span className="font-medium text-gray-900">History Forecasting</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">PO 1 Date Range:</span>
                    <span className="font-medium text-gray-900">{formatDateRange(historyConfig.po1)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">PO 2 Date Range:</span>
                    <span className="font-medium text-gray-900">{formatDateRange(historyConfig.po2)}</span>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
