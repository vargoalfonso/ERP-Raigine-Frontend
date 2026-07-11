"use client";

import { useMemo, useState } from "react";
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
import { useGetBomTreeQuery } from "@/lib/api/bom/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  useCreateMachinePatternMutation,
  useDeleteMachinePatternMutation,
  useGetMachinePatternsQuery,
  useGetMachinePatternSummaryQuery,
  useUpdateMachinePatternMutation,
} from "@/lib/api/machine-patterns/api";
import { useGetMachineParametersQuery } from "@/lib/api/machine-parameters/api";

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

  const [addForm] = Form.useForm<PatternFormValues>();
  const [editForm] = Form.useForm<PatternFormValues>();

  const { data: patternList } = useGetMachinePatternsQuery({ page: 1, limit: 20 }, { skip: !apiEnabled });
  const { data: summary } = useGetMachinePatternSummaryQuery(undefined, { skip: !apiEnabled });
  const { data: machineParameters } = useGetMachineParametersQuery({ page: 1, limit: 100 }, { skip: !apiEnabled });
  const { data: bomTreeData } = useGetBomTreeQuery(undefined, { skip: !apiEnabled });
  const [createMachinePattern, createState] = useCreateMachinePatternMutation();
  const [updateMachinePattern, updateState] = useUpdateMachinePatternMutation();
  const [deleteMachinePattern, deleteState] = useDeleteMachinePatternMutation();

  const machines = machineParameters?.items ?? [];

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

    const nodes = (bomTreeData as any)?.data;
    if (Array.isArray(nodes)) walk(nodes);

    return options.sort((a, b) => a.value.localeCompare(b.value));
  }, [bomTreeData]);

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

  const handleAddSubmit = async () => {
    try {
      const values = await addForm.validateFields();
      if (!apiEnabled) {
        message.success("Pattern added (mock)");
        setAddOpen(false);
        addForm.resetFields();
        return;
      }

      await createMachinePattern({
        uniq_code: values.uniqCode.trim(),
        machine_id: Number(values.machineId),
        cycle_time: Number(values.cycleTime),
        pattern_value: Number(values.patternValue),
        working_days: Number(values.workingDays),
        moving_type: values.movingType,
        material_grade: "",
        min_output: Number(values.minOutput),
        prl_reference: Number(values.prlReference),
        status: toApiStatus(values.status),
      }).unwrap();

      setAddOpen(false);
      addForm.resetFields();
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
        <Form<PatternFormValues>
          form={addForm}
          layout="vertical"
          initialValues={{ status: "Active", movingType: "Fast Moving", workingDays: 25 }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item name="uniqCode" label="Uniq Code" rules={[{ required: true, message: "Required" }]}> 
              <Select options={uniqOptions} placeholder="Select uniq code" className="w-full" showSearch optionFilterProp="label" />
            </Form.Item>
            <Form.Item name="machineId" label="Machine Name" rules={[{ required: true, message: "Required" }]}> 
              <Select options={machineOptions} placeholder="Select machine" className="w-full" showSearch optionFilterProp="label" />
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
