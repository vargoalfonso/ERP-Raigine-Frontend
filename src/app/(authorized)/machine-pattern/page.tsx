"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { MdSettings, MdTrendingUp } from "react-icons/md";
import { useGetBomListQuery, useLazyGetBomFullByIdQuery } from "@/lib/api/bom/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import { useGetGlobalWorkingDaysQuery } from "@/lib/api/system-settings/api";
import {
  useCreateMachinePatternMutation,
  useDeleteMachinePatternMutation,
  useGetMachinePatternsQuery,
  useGetMachinePatternSummaryQuery,
  useLazyCalculateMachinePatternQuery,
  useUpdateMachinePatternMutation,
} from "@/lib/api/machine-patterns/api";
import { useGetMachineParametersQuery } from "@/lib/api/machine-parameters/api";
import { useGetMachinesQuery } from "@/lib/api/machines/api";
import { useListPrlsQuery } from "@/lib/api/prl/api";

type MovementType = "Fast Moving" | "Slow Moving" | "Normal";
type StatusType = "Active" | "Inactive";

type MachinePatternRow = {
  key: string;
  id: string;
  uniqCode: string;
  machineId: number;
  machineName: string;
  cycleTime: number;
  patternValue: number;
  workingDays: number;
  movingType: MovementType;
  minOutput: number;
  prlReference: number;
  status: StatusType;
};

type PatternFormValues = {
  uniqCode: string;
  machineId: number;
  cycleTime: number;
  patternValue: number;
  workingDays: number;
  movingType: MovementType;
  minOutput: number;
  prlReference: number;
  status: StatusType;
};

type AddPatternFormValues = {
  uniqCode: string;
  machineId: number;
  period: string;
  cycleTime: number;
};

type AutoCalcResult = {
  prlReference: number;
  workingDays: number;
  dailyRequirement: number;
  cycleTimeMin: number;
  patternValue: number;
  minOutput: number;
  movingType: MovementType;
};

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const toUiStatus = (value: unknown): StatusType => {
  const normalized = String(value ?? "active").trim().toLowerCase();
  return normalized.includes("inact") ? "Inactive" : "Active";
};

const toApiStatus = (value: StatusType) => (value === "Inactive" ? "Inactive" : "Active");

const toUiMovingType = (value: unknown): MovementType => {
  const normalized = String(value ?? "normal").trim().toLowerCase();
  if (normalized.includes("fast")) return "Fast Moving";
  if (normalized.includes("slow")) return "Slow Moving";
  return "Normal";
};

const mockRows: MachinePatternRow[] = [
  {
    key: "1",
    id: "1",
    uniqCode: "LV7-001",
    machineId: 1,
    machineName: "Press Machine A1",
    cycleTime: 45,
    patternValue: 2,
    workingDays: 25,
    movingType: "Fast Moving",
    minOutput: 4000,
    prlReference: 50000,
    status: "Active",
  },
  {
    key: "2",
    id: "2",
    uniqCode: "CR-002",
    machineId: 2,
    machineName: "Welding Robot B2",
    cycleTime: 60,
    patternValue: 1,
    workingDays: 25,
    movingType: "Slow Moving",
    minOutput: 600,
    prlReference: 15000,
    status: "Inactive",
  },
];

export default function MachinePatternPage() {
  const apiEnabled = Boolean(apiBaseUrl);
  const [activeTab, setActiveTab] = useState<"pattern" | "parameters">("pattern");
  const [paramWorkingDays, setParamWorkingDays] = useState(25);
  const [paramFastMovingThreshold, setParamFastMovingThreshold] = useState(1000);
  const [paramPatternCycleThresholdMinutes, setParamPatternCycleThresholdMinutes] = useState(48);
  const [movementFilter, setMovementFilter] = useState<"All" | MovementType>("All");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<MachinePatternRow | null>(null);
  const [autoCalc, setAutoCalc] = useState<AutoCalcResult | null>(null);

  const [addForm] = Form.useForm<AddPatternFormValues>();
  const [editForm] = Form.useForm<PatternFormValues>();

  const { data: patternList } = useGetMachinePatternsQuery({ page: 1, limit: 20 }, { skip: !apiEnabled });
  // debug: log raw response to help trace empty-table issue
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug("patternList", patternList);
  }, [patternList]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug("apiEnabled", apiEnabled, "apiBaseUrl", apiBaseUrl);
  }, [apiEnabled]);
  const { data: summary } = useGetMachinePatternSummaryQuery(undefined, { skip: !apiEnabled });
  const { data: machineParameters } = useGetMachineParametersQuery({ page: 1, limit: 1000 }, { skip: !apiEnabled });
  const { data: apiMachines = [] } = useGetMachinesQuery(undefined, { skip: !apiEnabled });
  // Load the FULL uniq set for the dropdown. getBomList loops through every
  // page at the max backend-allowed limit (200/page) and accumulates all rows,
  // so the Uniq options are not capped at a single clamped page.
  const { data: bomTreeData } = useGetBomListQuery({ limit: 200 }, { skip: !apiEnabled });
  const [createMachinePattern, createState] = useCreateMachinePatternMutation();
  const [updateMachinePattern, updateState] = useUpdateMachinePatternMutation();
  const [deleteMachinePattern, deleteState] = useDeleteMachinePatternMutation();

  const machines = (apiMachines && apiMachines.length > 0) ? apiMachines : (machineParameters?.items ?? []);

  const machineNameById = useMemo(() => {
    const result = new Map<number, string>();
    for (const machine of machines) {
      const id = Number(machine.id ?? 0);
      if (!Number.isFinite(id)) continue;
      const label = String(machine.machine_name ?? id);
      result.set(id, label);
    }
    return result;
  }, [machines]);

  const machineOptions = useMemo(
    () =>
      machines
        .map((machine) => {
          const id = Number(machine.id ?? 0);
          const name = String(machine.machine_name ?? "").trim();
          if (!Number.isFinite(id) || !name) return null;
          return { label: name, value: id };
        })
        .filter((option): option is { label: string; value: number } => Boolean(option)),
    [machines],
  );

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

    const root = (bomTreeData as any)?.data;
    const nodes = Array.isArray(root)
      ? root
      : Array.isArray(root?.items)
        ? root.items
        : Array.isArray(root?.data)
          ? root.data
          : [];
    if (Array.isArray(nodes)) walk(nodes);

    return options.sort((a, b) => a.value.localeCompare(b.value));
  }, [bomTreeData]);

  const bomMetaByUniq = useMemo(() => {
    const map = new Map<string, { bomId: string; cycleTime: number }>();
    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        const uniqCode = String(node?.uniq_code ?? node?.uniq ?? "").trim();
        const bomId = String(node?.bom_id ?? node?.id ?? node?.uuid ?? "").trim();
        let cycle = 0;
        const routes = node?.process_routes;
        if (Array.isArray(routes)) {
          for (const route of routes) {
            const value = Number(route?.cycle_time_sec ?? 0);
            if (Number.isFinite(value) && value > 0) {
              cycle = value;
              break;
            }
          }
        }
        if (uniqCode && !map.has(uniqCode)) map.set(uniqCode, { bomId, cycleTime: cycle });
        if (Array.isArray(node?.children)) walk(node.children);
      }
    };
    const root = (bomTreeData as any)?.data;
    const nodes = Array.isArray(root) ? root : Array.isArray(root?.items) ? root.items : [];
    if (Array.isArray(nodes)) walk(nodes);
    return map;
  }, [bomTreeData]);

  const { data: prlData } = useListPrlsQuery({ page: 1, limit: 1000 }, { skip: !apiEnabled });
  const [triggerBomFull] = useLazyGetBomFullByIdQuery();
  const [triggerCalc] = useLazyCalculateMachinePatternQuery();

  const watchUniq = Form.useWatch("uniqCode", addForm);
  const watchPeriod = Form.useWatch("period", addForm);
  const watchCycle = Form.useWatch("cycleTime", addForm);
  const periodLabel = useMemo(() => String(watchPeriod ?? "").trim(), [watchPeriod]);
  const { data: globalWorkingDaysData } = useGetGlobalWorkingDaysQuery(undefined, {
    skip: !apiEnabled,
  });
  const settingsWorkingDays = useMemo(() => {
    const records = globalWorkingDaysData ?? [];
    if (!records.length) return 0;
    const target = periodLabel.trim().toLowerCase();
    const byPeriod = target
      ? records.find((r) => String(r.period ?? "").trim().toLowerCase() === target)
      : undefined;
    const active = records.find((r) => String(r.status ?? "").toLowerCase() === "active");
    const chosen = byPeriod ?? active ?? records[0];
    return Number(chosen?.working_days ?? 0);
  }, [globalWorkingDaysData, periodLabel]);
const effectiveWorkingDays = settingsWorkingDays > 0 ? settingsWorkingDays : paramWorkingDays;
  const prlReference = useMemo(() => {
    if (!watchUniq) return 0;
    const items = prlData?.items ?? [];
    const period = String(watchPeriod ?? "").trim().toLowerCase();
    const matches = items.filter((item) => {
      const uniq = String(item.uniq_code ?? item.item_uniq_code ?? "").trim();
      if (uniq !== watchUniq) return false;
      if (!period) return true;
      const itemPeriod = String(item.forecast_period ?? item.period ?? "").trim().toLowerCase();
      return itemPeriod === period;
    });
    return matches.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  }, [prlData?.items, watchUniq, watchPeriod]);

  useEffect(() => {
    if (!addOpen || !watchUniq) return;
    const meta = bomMetaByUniq.get(watchUniq);
    if (meta?.cycleTime && meta.cycleTime > 0) {
      addForm.setFieldsValue({ cycleTime: meta.cycleTime });
      return;
    }
    if (apiEnabled && meta?.bomId) {
      triggerBomFull(meta.bomId)
        .unwrap()
        .then((response) => {
          const routes = (((response as any)?.data?.process_routes ?? []) as any[]);
          let cycle = 0;
          for (const route of routes) {
            const value = Number(route?.cycle_time_sec ?? 0);
            if (value > 0) {
              cycle = value;
              break;
            }
          }
          if (cycle > 0) addForm.setFieldsValue({ cycleTime: cycle });
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchUniq, addOpen]);

  useEffect(() => {
    if (!addOpen) {
      setAutoCalc(null);
      return;
    }
    const cycle = Number(watchCycle ?? 0);
    const workingDays = Number(paramWorkingDays ?? 0);
    if (!watchUniq || cycle <= 0 || workingDays <= 0) {
      setAutoCalc(null);
      return;
    }
    const reference = prlReference;
    const dailyRequirement = workingDays > 0 ? reference / workingDays : 0;
    const cycleTimeMin = cycle / 60;
    const fallbackMoving: MovementType =
      dailyRequirement >= paramFastMovingThreshold
        ? "Fast Moving"
        : cycleTimeMin >= paramPatternCycleThresholdMinutes
          ? "Slow Moving"
          : "Normal";
    const fallback: AutoCalcResult = {
      prlReference: reference,
      workingDays,
      dailyRequirement,
      cycleTimeMin,
      patternValue: Math.max(1, Math.round(cycleTimeMin) || 1),
      minOutput: Math.round(dailyRequirement),
      movingType: fallbackMoving,
    };
    let cancelled = false;
    if (apiEnabled) {
      triggerCalc({ cycle_time_sec: cycle, prl_reference: reference, working_days: workingDays })
        .unwrap()
        .then((result) => {
          if (cancelled) return;
          setAutoCalc({
            prlReference: reference,
            workingDays,
            dailyRequirement: result.daily_requirement || dailyRequirement,
            cycleTimeMin: result.cycle_time_min || cycleTimeMin,
            patternValue: result.pattern_value,
            minOutput: result.min_output,
            movingType: toUiMovingType(result.moving_type),
          });
        })
        .catch(() => {
          if (!cancelled) setAutoCalc(fallback);
        });
    } else {
      setAutoCalc(fallback);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpen, watchUniq, watchCycle, prlReference, paramWorkingDays, paramFastMovingThreshold, paramPatternCycleThresholdMinutes, apiEnabled]);

  const rows = useMemo<MachinePatternRow[]>(() => {
    if (!apiEnabled) return mockRows;
    return (patternList?.items ?? []).map((item) => ({
      key: String(item.id),
      id: String(item.id),
      uniqCode: String(item.uniq_code ?? ""),
      machineId: Number(item.machine_id ?? 0),
      machineName: machineNameById.get(Number(item.machine_id ?? 0)) ?? `Machine #${item.machine_id}`,
      cycleTime: Number(item.cycle_time ?? 0),
      patternValue: Number(item.pattern_value ?? 0),
      workingDays: Number(item.working_days ?? 0),
      movingType: toUiMovingType(item.moving_type),
      minOutput: Number(item.min_output ?? 0),
      prlReference: Number(item.prl_reference ?? 0),
      status: toUiStatus(item.status),
    }));
  }, [apiEnabled, machineNameById, patternList?.items]);

  const totalPatterns = apiEnabled ? Number(summary?.total_pattern ?? rows.length) : rows.length;
  const fastMoving = apiEnabled ? Number(summary?.fast_moving ?? 0) : rows.filter((row) => row.movingType === "Fast Moving").length;
  const slowMoving = apiEnabled ? Number(summary?.slow_moving ?? 0) : rows.filter((row) => row.movingType === "Slow Moving").length;
  const avgPattern = apiEnabled
    ? Number(summary?.avg_pattern ?? 0)
    : rows.length
      ? rows.reduce((sum, row) => sum + row.patternValue, 0) / rows.length
      : 0;

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => (movementFilter === "All" ? true : row.movingType === movementFilter))
      .filter((row) => {
        if (!query) return true;
        return [row.uniqCode, row.machineName, row.movingType].join(" ").toLowerCase().includes(query);
      });
  }, [movementFilter, rows, search]);
const periodOptions = useMemo(() => {
    const records = globalWorkingDaysData ?? [];
    const seen = new Set<string>();
    const opts: Array<{ label: string; value: string }> = [];
    for (const record of records) {
      const period = String(record.period ?? "").trim();
      if (!period || seen.has(period.toLowerCase())) continue;
      seen.add(period.toLowerCase());
      const wd = Number(record.working_days ?? 0);
      opts.push({ label: wd > 0 ? `${period} (${wd} working days)` : period, value: period });
    }
    return opts;
  }, [globalWorkingDaysData]);
  const movementOptions: Array<{ label: string; value: MovementType }> = [
    { label: "Fast Moving", value: "Fast Moving" },
    { label: "Slow Moving", value: "Slow Moving" },
    { label: "Normal", value: "Normal" },
  ];

  const columns: ColumnsType<MachinePatternRow> = [
    {
      title: "Uniq Code",
      dataIndex: "uniqCode",
      key: "uniqCode",
      width: 130,
      fixed: "left",
      render: (value: string, record) => (
        <button
          type="button"
          className="font-medium text-blue-600 hover:text-blue-700"
          onClick={() => {
            setActiveRow(record);
            setViewOpen(true);
          }}
        >
          {value}
        </button>
      ),
    },
    { title: "Machine Name", dataIndex: "machineName", key: "machineName", width: 220 },
    { title: "Cycle Time", dataIndex: "cycleTime", key: "cycleTime", width: 120 },
    { title: "Pattern Value", dataIndex: "patternValue", key: "patternValue", width: 130 },
    { title: "Working Days", dataIndex: "workingDays", key: "workingDays", width: 120 },
    {
      title: "Moving Type",
      dataIndex: "movingType",
      key: "movingType",
      width: 140,
      render: (value: MovementType) => (
        <Tag
          color={value === "Fast Moving" ? "green" : value === "Slow Moving" ? "purple" : "gold"}
          className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
        >
          {value}
        </Tag>
      ),
    },
    {
      title: "Min Output",
      dataIndex: "minOutput",
      key: "minOutput",
      width: 120,
      render: (value: number) => formatNumber(value),
    },
    {
      title: "PRL Reference",
      dataIndex: "prlReference",
      key: "prlReference",
      width: 140,
      render: (value: number) => formatNumber(value),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: StatusType) => (
        <Tag color={value === "Active" ? "blue" : "default"} className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold">
          {value}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      fixed: "right",
      render: (_value: unknown, record) => (
        <div className="flex items-center justify-end gap-2">
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              className="!rounded-lg"
              onClick={() => {
                setActiveRow(record);
                editForm.setFieldsValue({
                  uniqCode: record.uniqCode,
                  machineId: record.machineId,
                  cycleTime: record.cycleTime,
                  patternValue: record.patternValue,
                  workingDays: record.workingDays,
                  movingType: record.movingType,
                  minOutput: record.minOutput,
                  prlReference: record.prlReference,
                  status: record.status,
                });
                setEditOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="View">
            <Button
              size="small"
              icon={<EyeOutlined />}
              className="!rounded-lg"
              onClick={() => {
                setActiveRow(record);
                setViewOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              className="!rounded-lg"
              onClick={() => {
                setActiveRow(record);
                setDeleteOpen(true);
              }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const handleExport = () => {
    message.info("Export coming soon");
  };

  const openPatternDetail = (row: MachinePatternRow) => {
    setActiveRow(row);
    setViewOpen(true);
  };

  const handleAddSubmit = async () => {
    try {
      const values = await addForm.validateFields();
      const cycle = Number(values.cycleTime);
      const workingDays = Number(paramWorkingDays);
      const calc = autoCalc;
      const machineId = Number(values.machineId);
      const patternValue = Number(calc?.patternValue ?? 0);
      const minOutput = Number(calc?.minOutput ?? 0);
      const reference = Number(calc?.prlReference ?? prlReference);
      const movingType: MovementType = calc?.movingType ?? "Normal";

      if (!apiEnabled) {
        openPatternDetail({
          key: `mock-${Date.now()}`,
          id: `mock-${Date.now()}`,
          uniqCode: values.uniqCode,
          machineId,
          machineName: machineNameById.get(machineId) ?? `Machine #${machineId}`,
          cycleTime: cycle,
          patternValue,
          workingDays,
          movingType,
          minOutput,
          prlReference: reference,
          status: "Active",
        });
        message.success("Pattern added (mock)");
        setAddOpen(false);
        addForm.resetFields();
        setAutoCalc(null);
        return;
      }

      const created = await createMachinePattern({
        uniq_code: values.uniqCode.trim(),
        machine_id: machineId,
        cycle_time: cycle,
        pattern_value: patternValue,
        working_days: workingDays,
        moving_type: movingType,
     
        min_output: minOutput,
        prl_reference: reference,
        status: "Active",
      }).unwrap();

      const createdMachineId = Number(created.machine_id || machineId);
      openPatternDetail({
        key: String(created.id),
        id: String(created.id),
        uniqCode: created.uniq_code || values.uniqCode,
        machineId: createdMachineId,
        machineName: machineNameById.get(createdMachineId) ?? `Machine #${createdMachineId}`,
        cycleTime: Number(created.cycle_time || cycle),
        patternValue: Number(created.pattern_value ?? patternValue),
        workingDays: Number(created.working_days || workingDays),
        movingType: toUiMovingType(created.moving_type || movingType),
        minOutput: Number(created.min_output ?? minOutput),
        prlReference: Number(created.prl_reference ?? reference),
        status: toUiStatus(created.status),
      });

      setAddOpen(false);
      addForm.resetFields();
      setAutoCalc(null);
      message.success("Pattern added");
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(getApiErrorMessage(error, "Failed to add machine pattern"));
    }
  };

  const handleEditSubmit = async () => {
    if (!activeRow) return;

    try {
      const values = await editForm.validateFields();
      if (!apiEnabled) {
        message.success("Pattern updated (mock)");
        setEditOpen(false);
        return;
      }

      await updateMachinePattern({
        id: activeRow.id,
        body: {
          cycle_time: Number(values.cycleTime),
          pattern_value: Number(values.patternValue),
          working_days: Number(values.workingDays),
          moving_type: values.movingType,
          min_output: Number(values.minOutput),
          prl_reference: Number(values.prlReference),
          status: toApiStatus(values.status),
        },
      }).unwrap();

      setEditOpen(false);
      setActiveRow(null);
      message.success("Pattern updated");
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(getApiErrorMessage(error, "Failed to update machine pattern"));
    }
  };

  const handleDelete = async () => {
    if (!activeRow) return;

    try {
      if (!apiEnabled) {
        message.success("Pattern deleted (mock)");
        setDeleteOpen(false);
        setActiveRow(null);
        return;
      }

      await deleteMachinePattern(activeRow.id).unwrap();
      setDeleteOpen(false);
      setActiveRow(null);
      message.success("Pattern deleted");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to delete machine pattern"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="mb-1 text-2xl font-bold text-gray-900">Machine Pattern Management</h1>
              <p className="text-sm text-gray-500">
                Create patterns for each machine and per Uniq bound with parameterized calculation
              </p>
            </div>
            <Button type="primary" className="!rounded-lg" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              Add Pattern
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div>
              <div className="text-xs font-semibold text-blue-600">Total Patterns</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{totalPatterns}</div>
            </div>
            <MdSettings className="text-blue-600" size="22" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div>
              <div className="text-xs font-semibold text-green-600">Fast Moving</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{fastMoving}</div>
            </div>
            <MdTrendingUp className="text-green-600" size="22" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div>
              <div className="text-xs font-semibold text-purple-600">Slow Moving</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{slowMoving}</div>
            </div>
            <MdSettings className="text-purple-600" size="22" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div>
              <div className="text-xs font-semibold text-orange-600">Avg Pattern</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{avgPattern.toFixed(1)}</div>
            </div>
            <MdSettings className="text-orange-600" size="22" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="inline-flex w-fit rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("pattern")}
              className={
                "rounded-md px-4 py-2 text-sm font-medium transition-colors " +
                (activeTab === "pattern" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")
              }
            >
              Pattern Data
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("parameters")}
              className={
                "rounded-md px-4 py-2 text-sm font-medium transition-colors " +
                (activeTab === "parameters" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")
              }
            >
              Parameters
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by Uniq or Machine Name..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="!rounded-lg lg:max-w-md"
            allowClear
          />

          <div className="flex items-center justify-end gap-2">
            <Select
              value={movementFilter}
              onChange={(value) => setMovementFilter(value)}
              options={[
                { label: "All Types", value: "All" },
                { label: "Fast Moving", value: "Fast Moving" },
                { label: "Slow Moving", value: "Slow Moving" },
                { label: "Normal", value: "Normal" },
              ]}
              style={{ width: 160 }}
            />
            <Button className="!rounded-lg" icon={<DownloadOutlined />} onClick={handleExport}>
              Export
            </Button>
          </div>
        </div>

        <div className="mb-4 border-t border-gray-100" />

        {activeTab === "pattern" && (
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <Table<MachinePatternRow>
              columns={columns}
              dataSource={filteredRows}
              rowKey="key"
              size="middle"
              pagination={false}
              scroll={{ x: "max-content" }}
            />
          </div>
        )}

        {activeTab === "parameters" && (
          <div className="max-w-3xl">
            <div className="space-y-4">
              <div>
                <div className="mb-1 text-xs font-semibold text-gray-700">Working Days (Global Parameter)</div>
                <InputNumber min={0} value={paramWorkingDays} onChange={(value) => setParamWorkingDays(value ?? 0)} className="w-full !rounded-lg" />
                <div className="mt-2 text-xs text-gray-500">Number of working days per month</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-gray-700">Fast Moving Threshold (C)</div>
                <InputNumber min={0} value={paramFastMovingThreshold} onChange={(value) => setParamFastMovingThreshold(value ?? 0)} className="w-full !rounded-lg" />
                <div className="mt-2 text-xs text-gray-500">Daily requirement threshold for fast moving classification</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-gray-700">Pattern Cycle Threshold (C) - Minutes</div>
                <InputNumber min={0} value={paramPatternCycleThresholdMinutes} onChange={(value) => setParamPatternCycleThresholdMinutes(value ?? 0)} className="w-full !rounded-lg" />
                <div className="mt-2 text-xs text-gray-500">Cycle time threshold in minutes for pattern calculation</div>
              </div>
            </div>

            <div className="mt-6">
              <Button type="primary" className="!rounded-lg" onClick={() => message.success("Parameters saved")}>
                Save Parameters
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        title={<span className="text-sm font-semibold">Add Machine Pattern</span>}
        open={addOpen}
        onCancel={() => {
          setAddOpen(false);
          addForm.resetFields();
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              className="!rounded-lg"
              onClick={() => {
                setAddOpen(false);
                addForm.resetFields();
              }}
            >
              Cancel
            </Button>
            <Button type="primary" className="!rounded-lg" icon={<PlusOutlined />} onClick={handleAddSubmit} loading={createState.isLoading}>
              Add Pattern
            </Button>
          </div>
        }
      >
        <Form<AddPatternFormValues>
          form={addForm}
          layout="vertical"
          initialValues={{ status: "Active", movingType: "Fast Moving", workingDays: 25 }}
        >
          <Form.Item name="uniqCode" label="Uniq Name (from Bill of Material)" rules={[{ required: true, message: "Required" }]}>
            <Select
              options={uniqOptions}
              placeholder="Select Uniq"
              className="w-full"
              showSearch
              optionFilterProp="label"
              virtual
              listHeight={320}
            />
          </Form.Item>
          <Form.Item name="machineId" label="Machine Name (from Machine Master Data)" rules={[{ required: true, message: "Required" }]}>
            <Select options={machineOptions} placeholder="Select machine" className="w-full" showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="period" label="Period per Month" rules={[{ required: true, message: "Required" }]} extra={effectiveWorkingDays > 0 ? `Working Days: ${effectiveWorkingDays} (from System Settings)` : "Working Days retrieved from System Settings"}>
            <Select options={periodOptions} placeholder="Select period" className="w-full" showSearch optionFilterProp="label" notFoundContent="No periods in System Settings" />
          </Form.Item>
          <Form.Item name="cycleTime" label="Cycle Time (seconds)" rules={[{ required: true, message: "Required" }]} extra="Retrieved from Bill of Material">
            <InputNumber min={0} className="w-full" />
          </Form.Item>

          {autoCalc ? (
            <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Auto-calculated</span>
                <Tag
                  color={autoCalc.movingType === "Fast Moving" ? "green" : autoCalc.movingType === "Slow Moving" ? "purple" : "gold"}
                  className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
                >
                  {autoCalc.movingType}
                </Tag>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-gray-500">PRL Reference</span><span className="font-medium text-gray-900">{formatNumber(autoCalc.prlReference)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Working Days</span><span className="font-medium text-gray-900">{autoCalc.workingDays}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Daily Requirement</span><span className="font-medium text-gray-900">{formatNumber(Math.round(autoCalc.dailyRequirement))}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Cycle Time (min)</span><span className="font-medium text-gray-900">{autoCalc.cycleTimeMin.toFixed(2)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Pattern Value</span><span className="font-medium text-gray-900">{autoCalc.patternValue}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Min Output</span><span className="font-medium text-gray-900">{formatNumber(autoCalc.minOutput)}</span></div>
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
              Pilih Uniq, Machine, Period &amp; Cycle Time — Pattern Value, Min Output, PRL Reference, dan Moving Type dihitung otomatis lalu langsung masuk ke detail dashboard.
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title={<span className="text-sm font-semibold">Edit Pattern</span>}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleEditSubmit}
        okText="Save"
        okButtonProps={{ className: "!rounded-lg", loading: updateState.isLoading }}
        cancelButtonProps={{ className: "!rounded-lg" }}
      >
        <Form<PatternFormValues> form={editForm} layout="vertical">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item name="uniqCode" label="Uniq Code" rules={[{ required: true, message: "Required" }]}> 
              <Input className="!rounded-lg" disabled />
            </Form.Item>
            <Form.Item name="machineId" label="Machine Name" rules={[{ required: true, message: "Required" }]}> 
              <Select options={machineOptions} className="w-full" disabled />
            </Form.Item>
            <Form.Item name="cycleTime" label="Cycle Time" rules={[{ required: true, message: "Required" }]}> 
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="patternValue" label="Pattern Value" rules={[{ required: true, message: "Required" }]}> 
              <InputNumber min={0} step={0.1} className="w-full" />
            </Form.Item>
            <Form.Item name="workingDays" label="Working Days" rules={[{ required: true, message: "Required" }]}> 
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="movingType" label="Moving Type" rules={[{ required: true, message: "Required" }]}> 
              <Select options={movementOptions} className="w-full" />
            </Form.Item>
            <Form.Item name="minOutput" label="Min Output" rules={[{ required: true, message: "Required" }]}> 
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="prlReference" label="PRL Reference" rules={[{ required: true, message: "Required" }]}> 
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </div>
          <Form.Item name="status" label="Status" rules={[{ required: true, message: "Required" }]}> 
            <Select options={[{ label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }]} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span className="text-sm font-semibold">Delete Pattern</span>}
        open={deleteOpen}
        onCancel={() => {
          setDeleteOpen(false);
          setActiveRow(null);
        }}
        onOk={handleDelete}
        okText="Delete"
        okButtonProps={{ danger: true, loading: deleteState.isLoading }}
      >
        <div className="text-sm text-gray-700">
          Delete <span className="font-semibold">{activeRow?.uniqCode}</span> from machine pattern management?
        </div>
      </Modal>

      <Modal
        title={<span className="text-sm font-semibold">Pattern Detail</span>}
        open={viewOpen}
        onCancel={() => setViewOpen(false)}
        footer={<Button className="!rounded-lg" onClick={() => setViewOpen(false)}>Close</Button>}
      >
        {activeRow ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">Uniq Code</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{activeRow.uniqCode}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">Machine Name</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{activeRow.machineName}</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 p-4">
              <div className="mb-3 text-sm font-semibold text-gray-900">Pattern Data</div>
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div className="flex items-center justify-between"><span className="text-gray-500">Cycle Time</span><span className="font-medium text-gray-900">{activeRow.cycleTime}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Pattern Value</span><span className="font-medium text-gray-900">{activeRow.patternValue}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Working Days</span><span className="font-medium text-gray-900">{activeRow.workingDays}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Min Output</span><span className="font-medium text-gray-900">{formatNumber(activeRow.minOutput)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">PRL Reference</span><span className="font-medium text-gray-900">{formatNumber(activeRow.prlReference)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-500">Status</span><span className="font-medium text-gray-900">{activeRow.status}</span></div>
              </div>

              <div className="mt-3">
                <Tag
                  color={activeRow.movingType === "Fast Moving" ? "green" : activeRow.movingType === "Slow Moving" ? "purple" : "gold"}
                  className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
                >
                  {activeRow.movingType}
                </Tag>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No data</div>
        )}
      </Modal>
    </div>
  );
}
