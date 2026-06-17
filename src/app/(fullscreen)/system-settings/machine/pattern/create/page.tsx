"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, InputNumber, Select, Tag, message } from "antd";
import { LeftOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { useListPrlsQuery } from "@/lib/api/prl/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetMachineParametersQuery } from "@/lib/api/machine-parameters/api";
import { useCreateMachinePatternMutation, useGetMachinePatternsQuery } from "@/lib/api/machine-patterns/api";

type MovementType = "Fast Moving" | "Slow Moving" | "Normal";
type StatusType = "Active" | "Inactive";

type Entry = {
  id: string;
  uniqCode?: string;
  machineId?: number;
  cycleTime?: number;
  patternValue?: number;
  workingDays?: number;
  movingType?: MovementType;
  minOutput?: number;
  prlReference?: number;
  status?: StatusType;
  created: boolean;
};

const MOVEMENT_OPTIONS = [
  { label: "Fast Moving", value: "Fast Moving" },
  { label: "Slow Moving", value: "Slow Moving" },
  { label: "Normal", value: "Normal" },
] as const;

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
] as const;

function makeEntry(idx: number): Entry {
  return {
    id: `entry-${idx}`,
    workingDays: idx === 1 ? 25 : undefined,
    movingType: idx === 1 ? "Fast Moving" : undefined,
    status: idx === 1 ? "Active" : undefined,
    created: false,
  };
}

export default function MachinePatternCreatePage() {
  const router = useRouter();
  const apiEnabled = Boolean(apiBaseUrl);

  const [entries, setEntries] = useState<Entry[]>([makeEntry(1)]);
  const { data: machineParameters } = useGetMachineParametersQuery({ page: 1, limit: 100 }, { skip: !apiEnabled });
  const { data: bomTreeData } = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const { data: prlsResponse } = useListPrlsQuery(undefined, { skip: !apiEnabled });
  const [createMachinePattern, createState] = useCreateMachinePatternMutation();

  const machines = machineParameters?.items ?? [];
  const prls = prlsResponse?.items ?? [];

  const completeCount = useMemo(() => entries.filter((entry) => entry.created).length, [entries]);

  const uniqOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [];
    const seen = new Set<string>();

    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        const uniqCode = String(node?.uniq_code ?? "").trim();
        const partName = String(node?.part_name ?? node?.description ?? "").trim();
        if (uniqCode && !seen.has(uniqCode)) {
          seen.add(uniqCode);
          options.push({ label: partName ? `${uniqCode} — ${partName}` : uniqCode, value: uniqCode });
        }
        if (Array.isArray(node?.children)) walk(node.children);
      }
    };

    const nodes = (bomTreeData as any)?.data;
    if (Array.isArray(nodes)) walk(nodes);
    return options.sort((a, b) => a.value.localeCompare(b.value));
  }, [bomTreeData]);

  const { data: machinePatternsData } = useGetMachinePatternsQuery({ page: 1, limit: 200 }, { skip: !apiEnabled });

  const machineOptions = useMemo(() => {
    const used = new Set<number>();
    for (const p of machinePatternsData?.items ?? []) {
      const mid = Number(p.machine_id ?? 0);
      if (Number.isFinite(mid) && mid > 0) used.add(mid);
    }

    return machines
      .map((machine) => {
        const id = Number(machine.id ?? 0);
        const name = String(machine.machine_name ?? "").trim();
        if (!Number.isFinite(id) || !name) return null;
        if (used.has(id)) return null; // exclude machines already used in patterns
        return { label: name, value: id };
      })
      .filter((option): option is { label: string; value: number } => Boolean(option));
  }, [machines, machinePatternsData]);

  const updateEntry = (id: string, patch: Partial<Entry>) => {
    setEntries((prev) => {
      return prev.map((entry) => {
        if (entry.id !== id) return entry;
            const updated = { ...entry, ...patch };

            // If uniqCode changed, try to auto-fill cycleTime (from BOM) and prlReference (from PRL list)
            if (patch.uniqCode) {
              const uniq = String(patch.uniqCode ?? "").trim();
              // find node in bomTreeData
              const nodes = (bomTreeData as any)?.data;
              let foundNode: any = null;
              const walk = (arr: any[]) => {
                for (const n of arr) {
                  if (!n) continue;
                  const code = String(n?.uniq_code ?? n?.uniq ?? "").trim();
                  if (code === uniq) {
                    foundNode = n;
                    return true;
                  }
                  if (Array.isArray(n.children) && walk(n.children)) return true;
                }
                return false;
              };
              if (Array.isArray(nodes)) walk(nodes);

              // extract cycle time (seconds) from common BOM keys
              let cycleMinutes: number | undefined = undefined;
              if (foundNode) {
                const mat = foundNode.material_spec ?? foundNode.materialSpec ?? {};
                const tryNums = [mat.cycle_time_sec_per_pc, mat.cycle_time_sec, foundNode.cycle_time_sec, foundNode.cycle_time_sec_per_pc];
                for (const v of tryNums) {
                  const n = Number(v ?? NaN);
                  if (Number.isFinite(n) && n > 0) {
                    cycleMinutes = Math.max(1, Math.round(n / 60));
                    break;
                  }
                }
                // also check process_routes
                if (cycleMinutes === undefined && Array.isArray(foundNode.process_routes)) {
                  for (const r of foundNode.process_routes) {
                    const n = Number(r?.cycle_time_sec_per_pc ?? r?.cycle_time_sec ?? NaN);
                    if (Number.isFinite(n) && n > 0) {
                      cycleMinutes = Math.max(1, Math.round(n / 60));
                      break;
                    }
                  }
                }
              }

              if (cycleMinutes !== undefined) updated.cycleTime = cycleMinutes;

              // find PRL total for this uniq
              const matchedPrls = (prls ?? []).filter((p) => String(p.uniq_code ?? p.item_uniq_code ?? "").trim() === uniq);
              const prlSum = matchedPrls.reduce((s, r) => s + (Number(r.quantity ?? 0)), 0);
              if (prlSum > 0) updated.prlReference = prlSum;
            }

            // Derived calculations
            const prl = Number(updated.prlReference ?? 0);
            const wd = Number(updated.workingDays ?? 0) || 25; // fallback
            const cycle = Number(updated.cycleTime ?? 0);

            // fast moving threshold and slow cycle threshold are parameterized constants
            const FAST_THRESHOLD = 1000; // C — can be hooked to saved params later
            const SLOW_CYCLE_MINUTES = 48; // C — minutes

            const dailyReq = wd > 0 ? prl / wd : 0;

            let movingType: MovementType = updated.movingType ?? "Normal";
            if (dailyReq > FAST_THRESHOLD) movingType = "Fast Moving";
            if (cycle >= SLOW_CYCLE_MINUTES) movingType = "Slow Moving";

            let patternValue = Number(updated.patternValue ?? 0) || 1;
            if (movingType === "Slow Moving") patternValue = 1;

            // keep minOutput as user-provided (free text); do not overwrite here
            return { ...updated, movingType, patternValue };
      });
    });
  };

  const validateEntry = (entry: Entry) => {
    if (!entry.uniqCode) return "Uniq Code is required";
    if (entry.machineId === undefined || entry.machineId === null) return "Machine Name is required";
    if (entry.cycleTime === undefined || entry.cycleTime === null) return "Cycle Time is required";
    if (entry.patternValue === undefined || entry.patternValue === null) return "Pattern Value is required";
    if (entry.workingDays === undefined || entry.workingDays === null) return "Working Days is required";
    if (!entry.movingType) return "Moving Type is required";
    if (entry.minOutput === undefined || entry.minOutput === null) return "Min Output is required";
    if (entry.prlReference === undefined || entry.prlReference === null) return "PRL Reference is required";
    if (!entry.status) return "Status is required";
    return null;
  };

  const addAnother = () => {
    setEntries((prev) => [...prev, makeEntry(prev.length + 1)]);
  };

  const onSave = async () => {
    for (const entry of entries) {
      const error = validateEntry(entry);
      if (error) {
        message.error(`Entry ${entries.indexOf(entry) + 1}: ${error}`);
        return;
      }
    }

    try {
      if (apiEnabled) {
        for (const entry of entries) {
          await createMachinePattern({
            uniq_code: String(entry.uniqCode ?? "").trim(),
            machine_id: Number(entry.machineId),
            cycle_time: Number(entry.cycleTime),
            pattern_value: Number(entry.patternValue),
            working_days: Number(entry.workingDays),
            moving_type: entry.movingType ?? "Normal",
            min_output: Number(entry.minOutput),
            prl_reference: Number(entry.prlReference),
            status: entry.status ?? "Active",
          }).unwrap();
        }
      }

      setEntries((prev) => prev.map((entry) => ({ ...entry, created: true })));
      message.success("Machine pattern saved");
      router.push("/system-settings");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to save machine pattern"));
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF5FF]">
      <div className="border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              onClick={() => router.push("/system-settings")}
            >
              <LeftOutlined />
              <span>Back to System Parameters</span>
            </button>

            <div className="flex items-center gap-2">
              <Button onClick={() => router.push("/system-settings")}>Cancel</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={createState.isLoading}>
                Save Parameter
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-semibold text-gray-900">Add Machine Pattern</div>
            <div className="text-sm text-gray-500">
              Create Machine Pattern Configurations <span className="mx-2">•</span> {entries.length} entry
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="mx-auto max-w-6xl space-y-5">
          {entries.map((entry, idx) => (
            <Card key={entry.id} className="rounded-2xl" bodyStyle={{ padding: 24 }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-gray-900">Add New Parameter #{idx + 1}</div>
                  <div className="text-sm text-gray-500">Configure parameter for machine pattern configurations</div>
                </div>
                <Tag className="rounded-full border border-blue-100 bg-blue-50 text-blue-700">Entry {idx + 1}</Tag>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm text-gray-700">Uniq Code</div>
                    <Select
                      value={entry.uniqCode}
                      onChange={(value) => updateEntry(entry.id, { uniqCode: value, created: false })}
                      options={uniqOptions}
                      placeholder="Select uniq code"
                      className="w-full"
                      showSearch
                      optionFilterProp="label"
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-gray-700">Machine Name</div>
                    <Select
                      value={entry.machineId}
                      onChange={(value) => updateEntry(entry.id, { machineId: value, created: false })}
                      options={machineOptions}
                      placeholder="Select machine"
                      className="w-full"
                      showSearch
                      optionFilterProp="label"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm text-gray-700">Cycle Time</div>
                    <InputNumber
                      value={entry.cycleTime}
                      onChange={(value) => updateEntry(entry.id, { cycleTime: value ?? undefined, created: false })}
                      className="w-full"
                      min={0}
                      placeholder="45"
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-gray-700">Pattern Value</div>
                    <InputNumber
                      value={entry.patternValue}
                      onChange={(value) => updateEntry(entry.id, { patternValue: value ?? undefined, created: false })}
                      className="w-full"
                      min={0}
                      step={0.1}
                      placeholder="2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm text-gray-700">Working Days</div>
                    <InputNumber
                      value={entry.workingDays}
                      onChange={(value) => updateEntry(entry.id, { workingDays: value ?? undefined, created: false })}
                      className="w-full"
                      min={0}
                      placeholder="25"
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-gray-700">Moving Type</div>
                    <Select
                      value={entry.movingType}
                      disabled
                      placeholder="Auto-calculated"
                      options={MOVEMENT_OPTIONS as unknown as { label: string; value: string }[]}
                      className="w-full bg-gray-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm text-gray-700">Min Output</div>
                    <InputNumber
                      value={entry.minOutput}
                      onChange={(value) => updateEntry(entry.id, { minOutput: value ?? undefined, created: false })}
                      className="w-full"
                      min={0}
                      placeholder="4000"
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-gray-700">PRL Reference</div>
                    <InputNumber
                      value={entry.prlReference}
                      onChange={(value) => updateEntry(entry.id, { prlReference: value ?? undefined, created: false })}
                      className="w-full"
                      min={0}
                      placeholder="50000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm text-gray-700">Status</div>
                    <Select
                      value={entry.status}
                      onChange={(value) => updateEntry(entry.id, { status: value as StatusType, created: false })}
                      placeholder="Select status"
                      options={STATUS_OPTIONS as unknown as { label: string; value: string }[]}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <div className="flex items-center justify-center">
            <Button icon={<PlusOutlined />} onClick={addAnother}>
              Add Another Parameter
            </Button>
          </div>

          <Card className="rounded-2xl" bodyStyle={{ padding: 18 }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-gray-900">Summary</div>
                <div className="text-sm text-gray-500">{entries.length} Parameter ready to be saved</div>
              </div>
              <div className="flex items-center gap-10">
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">{entries.length}</div>
                  <div className="text-xs text-gray-500">Entries</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">{completeCount}</div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
