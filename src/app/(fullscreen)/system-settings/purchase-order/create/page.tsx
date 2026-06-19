"use client";

import { useMemo, useState } from "react";
import { Button, Card, DatePicker, InputNumber, message } from "antd";
import { LeftOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { Dayjs } from "dayjs";
import { getApiErrorMessage } from "@/lib/api/error";
import { useCreatePoSplitMutation } from "@/lib/api/system-settings/api";

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

const cardBaseClass = "rounded-[10px] border bg-white transition-all";
const labelClass = "mb-1 text-[10px] font-medium text-gray-700";

function formatDateRange(range: HistoryRange) {
  if (!range.from || !range.to) return "Not set";
  return `${range.from.format("DD MMM YYYY")} - ${range.to.format("DD MMM YYYY")}`;
}

export default function PurchaseOrderCreatePage() {
  const router = useRouter();
  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const [createPoSplit, createPoSplitState] = useCreatePoSplitMutation();
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

  const validateAndSave = async () => {
    try {
      if (method === "percentage") {
        if (totalPercentage !== 100) {
          message.error("Total percentage must equal 100%.");
          return;
        }

        if (apiEnabled) {
          await createPoSplit({
            budget_type: "all",
            po1_pct: Number(percentage.po1 || 0),
            po2_pct: Number(percentage.po2 || 0),
            description: `Global percentage split for all UNIQ. PO1 ${Number(
              percentage.po1 || 0
            )}% and PO2 ${Number(percentage.po2 || 0)}%.`,
            min_order_qty: 0,
            max_split_lines: 2,
            split_rule: "percentage",
            status: "active",
          }).unwrap();
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

      if (apiEnabled) {
        await createPoSplit({
          budget_type: "all",
          po1_pct: 0,
          po2_pct: 0,
          description:
            `History forecasting split. PO1 ${formatDateRange(historyConfig.po1)}; ` +
            `PO2 ${formatDateRange(historyConfig.po2)}.`,
          min_order_qty: 0,
          max_split_lines: 2,
          split_rule: "history",
          status: "active",
        }).unwrap();
      }

      message.success("PO split configuration saved");
      router.push("/system-settings");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to save PO split configuration"));
    }
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
    <div className="min-h-screen bg-[#EEF5FF] px-5 py-5">
      <div className="mx-auto max-w-[760px]">
        <div className="overflow-hidden rounded-[12px] border border-[#DCE3F0] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="border-b border-[#E8ECF4] px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <PlusOutlined />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-gray-900">System Parameters</div>
                    <div className="text-[10px] text-gray-500">Comprehensive ERP parameter management and configuration</div>
                  </div>
                </div>
              </div>

              <Button type="primary" size="small" className="rounded-md text-[11px]" icon={<PlusOutlined />}>
                19 Configuration Modules
              </Button>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4">
            <button
              type="button"
              className="flex items-center gap-2 text-[12px] text-gray-600 transition hover:text-gray-900"
              onClick={() => router.push("/system-settings")}
            >
              <LeftOutlined />
              <span>Back to System Parameters</span>
            </button>

            <Card className="rounded-xl border border-[#E5EAF3] shadow-none" bodyStyle={{ padding: 14 }}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[14px] font-semibold text-gray-900">PO - Split Settings</div>
                  <div className="text-[10px] text-gray-500">Configure purchase order split settings</div>
                </div>
                <Button type="primary" size="small" icon={<PlusOutlined />} className="rounded-md text-[11px]">
                  Add Parameter
                </Button>
              </div>

              <div className="rounded-xl border border-[#E5EAF3] bg-white p-3">
                <div className="mb-1 text-[12px] font-semibold text-gray-900">Purchase Order Split Method</div>
                <div className="mb-4 text-[10px] leading-4 text-gray-500">
                  Choose how to split purchase orders between PO1 and PO2. Total must equal 100% of Purchase Request.
                </div>

                <div className="space-y-4">
                  <div
                    className={`${cardBaseClass} ${
                      method === "percentage"
                        ? "border-[#7AA2FF] bg-[#F7FAFF] shadow-[0_0_0_1px_rgba(59,130,246,0.18)]"
                        : "border-[#E5E7EB]"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full p-3 text-left"
                      onClick={() => setMethod("percentage")}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-[2px] flex h-4 w-4 items-center justify-center rounded-full border ${method === "percentage" ? "border-blue-500" : "border-gray-300"}`}>
                          <div
                            className={`h-2 w-2 rounded-full ${
                              method === "percentage" ? "bg-blue-600" : "bg-transparent"
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-semibold text-gray-900">Option 1: PO based on Percentage</div>
                          <div className="mt-1 text-[10px] leading-4 text-gray-500">Applied for all UNIQ. Set fixed percentage split between PO1 and PO2.</div>

                          {method === "percentage" ? (
                            <div className="mt-3 rounded-lg border border-[#C9D8FF] bg-white p-3">
                              <div className="mb-3 rounded-md border border-[#DCE8FF] bg-[#F3F7FF] p-3 text-[10px] leading-4 text-[#3F6FD9]">
                                <div className="font-semibold">Information:</div>
                                <div>You can fill the percentage at menu PR Budget. Total percentage must equal 100%.</div>
                              </div>

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div>
                                  <div className={labelClass}>PO 1 Percentage <span className="text-red-500">*</span></div>
                                  <InputNumber
                                    size="small"
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
                                    size="small"
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
                                  <div className={`flex h-7 items-center rounded-md border px-3 text-[11px] font-semibold ${totalClassName}`}>
                                    {totalPercentage}%
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 rounded-md bg-[#F8FAFC] p-3 text-[10px] leading-4 text-gray-600">
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
                        ? "border-[#D980FA] bg-[#FFF9FF] shadow-[0_0_0_1px_rgba(217,70,239,0.16)]"
                        : "border-[#E5E7EB]"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full p-3 text-left"
                      onClick={() => setMethod("history")}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-[2px] flex h-4 w-4 items-center justify-center rounded-full border ${method === "history" ? "border-fuchsia-500" : "border-gray-300"}`}>
                          <div
                            className={`h-2 w-2 rounded-full ${
                              method === "history" ? "bg-blue-600" : "bg-transparent"
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-semibold text-gray-900">Option 2: PO based on History Forecasting</div>
                          <div className="mt-1 text-[10px] leading-4 text-gray-500">Can be applied per UNIQ. Based on historical delivery data from specific date ranges.</div>

                          {method === "history" ? (
                            <div className="mt-3 rounded-lg border border-[#EDC5FF] bg-white p-3">
                              <div className="mb-3 rounded-md border border-[#F1D9FF] bg-[#FFF5FF] p-3 text-[10px] leading-4 text-[#B14ED5]">
                                <div className="font-semibold">Information:</div>
                                <div>Set date ranges for historical delivery analysis. System will calculate optimal split based on historical data.</div>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <div className="mb-2 inline-flex rounded-md bg-[#F5EBFF] px-2 py-0.5 text-[9px] font-semibold text-[#A855F7]">PO 1</div>
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                      <div className={labelClass}>From Date <span className="text-red-500">*</span></div>
                                      <DatePicker
                                        size="small"
                                        value={historyConfig.po1.from ?? null}
                                        onChange={(value) => updateHistoryRange("po1", "from", value)}
                                        className="w-full"
                                        format="DD MMM YYYY"
                                      />
                                    </div>
                                    <div>
                                      <div className={labelClass}>To Date <span className="text-red-500">*</span></div>
                                      <DatePicker
                                        size="small"
                                        value={historyConfig.po1.to ?? null}
                                        onChange={(value) => updateHistoryRange("po1", "to", value)}
                                        className="w-full"
                                        format="DD MMM YYYY"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <div className="mb-2 inline-flex rounded-md bg-[#FDF0FF] px-2 py-0.5 text-[9px] font-semibold text-[#C026D3]">PO 2</div>
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                      <div className={labelClass}>From Date <span className="text-red-500">*</span></div>
                                      <DatePicker
                                        size="small"
                                        value={historyConfig.po2.from ?? null}
                                        onChange={(value) => updateHistoryRange("po2", "from", value)}
                                        className="w-full"
                                        format="DD MMM YYYY"
                                      />
                                    </div>
                                    <div>
                                      <div className={labelClass}>To Date <span className="text-red-500">*</span></div>
                                      <DatePicker
                                        size="small"
                                        value={historyConfig.po2.to ?? null}
                                        onChange={(value) => updateHistoryRange("po2", "to", value)}
                                        className="w-full"
                                        format="DD MMM YYYY"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 rounded-md bg-[#F8FAFC] p-3 text-[10px] leading-4 text-gray-600">
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

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#EEF2F7] pt-3">
                  <Button size="small" onClick={resetDefaults}>Reset to Default</Button>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => void validateAndSave()}
                    loading={createPoSplitState.isLoading}
                  >
                    Save Configuration
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="rounded-xl border border-[#E5EAF3] shadow-none" bodyStyle={{ padding: 14 }}>
              <div className="mb-4 text-[12px] font-semibold text-gray-900">Configuration Summary</div>

              {method === "percentage" ? (
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-500">Selected Method:</span>
                    <span className="inline-flex rounded-md bg-blue-600 px-2 py-0.5 text-[9px] font-semibold text-white">Percentage Based</span>
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
                <div className="space-y-2 text-[11px]">
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
