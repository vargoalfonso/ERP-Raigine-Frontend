"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Input,
  Modal,
  Form,
  InputNumber,
  Select,
  Table,
  Tag,
  message,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  DownloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { MdSettings, MdTrendingUp } from "react-icons/md";

type MovementType = "Fast Moving" | "Slow Moving";

type MachinePatternRow = {
  key: string;
  uniqName: string;
  machineName: string;
  cycleTimeSec: number;
  prl: number;
  workingDays: number;
  patternCount: number;
  outputPerMachine: number;
  movementType: MovementType;
  safetyStock: number;
};

type PatternFormValues = {
  uniqName: string;
  machineName: string;
  period: string;
};

const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export default function MachinePatternPage() {
  const [activeTab, setActiveTab] = useState<"pattern" | "parameters">("pattern");

  const [paramWorkingDays, setParamWorkingDays] = useState<number>(25);
  const [paramFastMovingThreshold, setParamFastMovingThreshold] = useState<number>(1000);
  const [paramPatternCycleThresholdMinutes, setParamPatternCycleThresholdMinutes] = useState<number>(48);

  const [movementFilter, setMovementFilter] = useState<"All" | MovementType>("All");
  const [search, setSearch] = useState<string>("");

  const [rows, setRows] = useState<MachinePatternRow[]>([
    {
      key: "LV7-001",
      uniqName: "LV7-001",
      machineName: "Press Machine A1",
      cycleTimeSec: 45,
      prl: 50000,
      workingDays: 25,
      patternCount: 2,
      outputPerMachine: 4000,
      movementType: "Fast Moving",
      safetyStock: 8000,
    },
    {
      key: "CR-002",
      uniqName: "CR-002",
      machineName: "Welding Robot B2",
      cycleTimeSec: 60,
      prl: 15000,
      workingDays: 25,
      patternCount: 1,
      outputPerMachine: 600,
      movementType: "Slow Moving",
      safetyStock: 1200,
    },
    {
      key: "LV8-003",
      uniqName: "LV8-003",
      machineName: "CNC Milling C3",
      cycleTimeSec: 30,
      prl: 40000,
      workingDays: 25,
      patternCount: 1,
      outputPerMachine: 1600,
      movementType: "Fast Moving",
      safetyStock: 3200,
    },
  ]);

  const uniqCatalog = useMemo(
    () =>
      [
        {
          uniqName: "LV7-001",
          cycleTimeSec: 45,
          prl: 50000,
          workingDays: 25,
          patternCount: 2,
          outputPerMachine: 4000,
          movementType: "Fast Moving" as const,
          safetyStock: 8000,
        },
        {
          uniqName: "CR-002",
          cycleTimeSec: 60,
          prl: 15000,
          workingDays: 25,
          patternCount: 1,
          outputPerMachine: 600,
          movementType: "Slow Moving" as const,
          safetyStock: 1200,
        },
        {
          uniqName: "LV8-003",
          cycleTimeSec: 30,
          prl: 40000,
          workingDays: 25,
          patternCount: 1,
          outputPerMachine: 1600,
          movementType: "Fast Moving" as const,
          safetyStock: 3200,
        },
      ],
    []
  );

  const machineCatalog = useMemo(
    () => [
      { label: "Press Machine A1", value: "Press Machine A1" },
      { label: "Welding Robot B2", value: "Welding Robot B2" },
      { label: "CNC Milling C3", value: "CNC Milling C3" },
    ],
    []
  );

  const uniqOptions = useMemo(
    () => uniqCatalog.map((u) => ({ label: u.uniqName, value: u.uniqName })),
    [uniqCatalog]
  );

  const periodOptions = useMemo(
    () => [
      { label: "March 2026", value: "March 2026" },
      { label: "April 2026", value: "April 2026" },
      { label: "May 2026", value: "May 2026" },
      { label: "June 2026", value: "June 2026" },
    ],
    []
  );

  const totalPatterns = rows.length;
  const fastMoving = rows.filter((r) => r.movementType === "Fast Moving").length;
  const slowMoving = rows.filter((r) => r.movementType === "Slow Moving").length;
  const avgPattern = useMemo(() => {
    if (rows.length === 0) return 0;
    const sum = rows.reduce((acc, r) => acc + r.patternCount, 0);
    return sum / rows.length;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (movementFilter === "All" ? true : r.movementType === movementFilter))
      .filter((r) => {
        if (!q) return true;
        return (
          r.uniqName.toLowerCase().includes(q) ||
          r.machineName.toLowerCase().includes(q)
        );
      });
  }, [rows, movementFilter, search]);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<MachinePatternRow | null>(null);

  const [addForm] = Form.useForm<PatternFormValues>();
  const [editForm] = Form.useForm<PatternFormValues>();

  const selectedAddUniq = Form.useWatch("uniqName", addForm);
  const addUniqMeta = useMemo(() => {
    if (!selectedAddUniq) return undefined;
    return uniqCatalog.find((u) => u.uniqName === selectedAddUniq);
  }, [selectedAddUniq, uniqCatalog]);

  const columns: ColumnsType<MachinePatternRow> = [
    {
      title: "Uniq Name",
      dataIndex: "uniqName",
      key: "uniqName",
      width: 120,
      fixed: "left",
      render: (v: string, record) => (
        <button
          type="button"
          className="text-blue-600 hover:text-blue-700 font-medium"
          onClick={() => {
            setActiveRow(record);
            setViewOpen(true);
          }}
        >
          {v}
        </button>
      ),
    },
    {
      title: "Machine Name",
      dataIndex: "machineName",
      key: "machineName",
      width: 200,
      render: (v: string) => <span className="text-gray-800">{v}</span>,
    },
    {
      title: "Cycle Time (s)",
      dataIndex: "cycleTimeSec",
      key: "cycleTimeSec",
      width: 120,
      render: (v: number) => <span className="text-gray-800">{v}</span>,
    },
    {
      title: "PRL",
      dataIndex: "prl",
      key: "prl",
      width: 120,
      render: (v: number) => <span className="text-gray-800">{formatNumber(v)}</span>,
    },
    {
      title: "Working Days",
      dataIndex: "workingDays",
      key: "workingDays",
      width: 130,
      render: (v: number) => <span className="text-gray-800">{v}</span>,
    },
    {
      title: "Pattern",
      dataIndex: "patternCount",
      key: "patternCount",
      width: 120,
      render: (v: number) => (
        <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
          {v} pattern{v === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      title: "Output/Machine",
      dataIndex: "outputPerMachine",
      key: "outputPerMachine",
      width: 140,
      render: (v: number) => <span className="text-gray-800">{formatNumber(v)}</span>,
    },
    {
      title: "Movement Type",
      dataIndex: "movementType",
      key: "movementType",
      width: 150,
      render: (v: MovementType) => (
        <Tag
          color={v === "Fast Moving" ? "green" : "purple"}
          className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
        >
          {v}
        </Tag>
      ),
    },
    {
      title: "Safety Stock",
      dataIndex: "safetyStock",
      key: "safetyStock",
      width: 120,
      align: "right",
      render: (v: number) => <span className="text-red-500 font-semibold">{formatNumber(v)}</span>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
      fixed: "right",
      render: (_: unknown, record) => (
        <div className="flex items-center justify-end gap-2">
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              className="!rounded-lg"
              onClick={() => {
                setActiveRow(record);
                editForm.setFieldsValue({
                  uniqName: record.uniqName,
                  machineName: record.machineName,
                  period: "March 2026",
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
      const key = values.uniqName.trim();
      if (!key) {
        message.error("Uniq Name is required");
        return;
      }

      const meta = uniqCatalog.find((u) => u.uniqName === key);
      if (!meta) {
        message.error("Uniq not found in Bill of Material");
        return;
      }

      if (rows.some((r) => r.key.toLowerCase() === key.toLowerCase())) {
        message.error("Uniq Name already exists");
        return;
      }

      const newRow: MachinePatternRow = {
        key,
        uniqName: values.uniqName,
        machineName: values.machineName,
        cycleTimeSec: meta.cycleTimeSec,
        prl: meta.prl,
        workingDays: meta.workingDays,
        patternCount: meta.patternCount,
        outputPerMachine: meta.outputPerMachine,
        movementType: meta.movementType,
        safetyStock: meta.safetyStock,
      };

      setRows((prev) => [newRow, ...prev]);
      setAddOpen(false);
      addForm.resetFields();
      message.success("Pattern added");
    } catch {
      // form shows errors
    }
  };

  const handleEditSubmit = async () => {
    if (!activeRow) return;

    try {
      const values = await editForm.validateFields();

      setRows((prev) =>
        prev.map((r) =>
          r.key === activeRow.key
            ? {
                ...r,
                uniqName: values.uniqName,
                machineName: values.machineName,
              }
            : r
        )
      );

      setEditOpen(false);
      message.success("Pattern updated");
    } catch {
      // form shows errors
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Machine Pattern Management</h1>
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

      {/* KPI Cards */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-blue-600">Total Patterns</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{totalPatterns}</div>
            </div>
            <MdSettings className="text-blue-600" size="22" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-green-600">Fast Moving</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{fastMoving}</div>
            </div>
            <MdTrendingUp className="text-green-600" size="22" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-purple-600">Slow Moving</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{slowMoving}</div>
            </div>
            <MdSettings className="text-purple-600" size="22" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-orange-600">Avg Pattern</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{avgPattern.toFixed(1)}</div>
            </div>
            <MdSettings className="text-orange-600" size="22" />
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        {/* Tabs */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="inline-flex rounded-lg bg-gray-100 p-1 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("pattern")}
              className={
                "px-4 py-2 text-sm font-medium rounded-md transition-colors " +
                (activeTab === "pattern" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")
              }
            >
              Pattern Data
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("parameters")}
              className={
                "px-4 py-2 text-sm font-medium rounded-md transition-colors " +
                (activeTab === "parameters" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")
              }
            >
              Parameters
            </button>
          </div>
        </div>

        {/* Search + Filters (visible on both tabs, like screenshot) */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Uniq or Machine Name..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="!rounded-lg lg:max-w-md"
            allowClear
          />

          <div className="flex items-center justify-end gap-2">
            <Select
              value={movementFilter}
              onChange={(v) => setMovementFilter(v)}
              options={[
                { label: "All Types", value: "All" },
                { label: "Fast Moving", value: "Fast Moving" },
                { label: "Slow Moving", value: "Slow Moving" },
              ]}
              style={{ width: 160 }}
            />
            <Button className="!rounded-lg" icon={<DownloadOutlined />} onClick={handleExport}>
              Export
            </Button>
          </div>
        </div>

        <div className="border-t border-gray-100 mb-4" />

        {activeTab === "pattern" && (
          <>
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
          </>
        )}

        {activeTab === "parameters" && (
          <div className="max-w-3xl">
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Working Days (Global Parameter)</div>
                <InputNumber
                  min={0}
                  value={paramWorkingDays}
                  onChange={(v) => setParamWorkingDays(v ?? 0)}
                  className="w-full !rounded-lg"
                />
                <div className="text-xs text-gray-500 mt-2">Number of working days per month</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Fast Moving Threshold (C)</div>
                <InputNumber
                  min={0}
                  value={paramFastMovingThreshold}
                  onChange={(v) => setParamFastMovingThreshold(v ?? 0)}
                  className="w-full !rounded-lg"
                />
                <div className="text-xs text-gray-500 mt-2">Daily requirement threshold for fast moving classification</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Pattern Cycle Threshold (C) - Minutes</div>
                <InputNumber
                  min={0}
                  value={paramPatternCycleThresholdMinutes}
                  onChange={(v) => setParamPatternCycleThresholdMinutes(v ?? 0)}
                  className="w-full !rounded-lg"
                />
                <div className="text-xs text-gray-500 mt-2">Cycle time threshold in minutes for pattern calculation</div>
              </div>
            </div>

            <div className="mt-6">
              <Button
                type="primary"
                className="!rounded-lg"
                onClick={() => message.success("Parameters saved")}
              >
                Save Parameters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal
        title={<span className="text-sm font-semibold">Add Machine Pattern</span>}
        open={addOpen}
        onCancel={() => {
          setAddOpen(false);
          addForm.resetFields();
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button className="!rounded-lg" onClick={() => {
              setAddOpen(false);
              addForm.resetFields();
            }}>
              Cancel
            </Button>
            <Button type="primary" className="!rounded-lg" icon={<PlusOutlined />} onClick={handleAddSubmit}>
              Add Pattern
            </Button>
          </div>
        }
      >
        <Form<PatternFormValues>
          form={addForm}
          layout="vertical"
          initialValues={{ period: "March 2026" }}
        >
          <div className="space-y-3">
            <Form.Item
              name="uniqName"
              label="Uniq Name (from Bill of Material)"
              rules={[{ required: true, message: "Required" }]}
            >
              <Select
                options={uniqOptions}
                placeholder="Select Uniq"
                className="w-full"
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item
              name="machineName"
              label="Machine Name (from Machine Master Data)"
              rules={[{ required: true, message: "Required" }]}
            >
              <Select
                options={machineCatalog}
                placeholder="Select machine"
                className="w-full"
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item name="period" label="Period per Month" rules={[{ required: true, message: "Required" }]}>
              <Select options={periodOptions} placeholder="e.g March 2026" className="w-full" />
            </Form.Item>

            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Cycle Time (seconds)</div>
              <InputNumber
                value={addUniqMeta?.cycleTimeSec ?? 0}
                className="w-full !rounded-lg"
                disabled
              />
              <div className="text-xs text-gray-500 mt-2">Retrieved from Bill of Material</div>
            </div>

            <div className="pt-2 border-t border-gray-100" />
          </div>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={<span className="text-sm font-semibold">Edit Pattern</span>}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleEditSubmit}
        okText="Save"
        okButtonProps={{ className: "!rounded-lg" }}
        cancelButtonProps={{ className: "!rounded-lg" }}
      >
        <Form<PatternFormValues> form={editForm} layout="vertical">
          <div className="space-y-3">
            <Form.Item name="uniqName" label="Uniq Name" rules={[{ required: true, message: "Required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item name="machineName" label="Machine Name" rules={[{ required: true, message: "Required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item name="period" label="Period per Month" rules={[{ required: true, message: "Required" }]}>
              <Select options={periodOptions} className="w-full" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* View Modal */}
      <Modal
        title={<span className="text-sm font-semibold">Pattern Detail</span>}
        open={viewOpen}
        onCancel={() => setViewOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button className="!rounded-lg" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {activeRow ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">Uniq Name</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{activeRow.uniqName}</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">Machine Name</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{activeRow.machineName}</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 p-4">
              <div className="text-sm font-semibold text-gray-900 mb-3">Pattern Data</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Cycle Time (s)</span>
                  <span className="text-gray-900 font-medium">{activeRow.cycleTimeSec}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">PRL</span>
                  <span className="text-gray-900 font-medium">{formatNumber(activeRow.prl)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Working Days</span>
                  <span className="text-gray-900 font-medium">{activeRow.workingDays}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Patterns</span>
                  <span className="text-gray-900 font-medium">{activeRow.patternCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Output/Machine</span>
                  <span className="text-gray-900 font-medium">{formatNumber(activeRow.outputPerMachine)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Safety Stock</span>
                  <span className="text-red-500 font-semibold">{formatNumber(activeRow.safetyStock)}</span>
                </div>
              </div>

              <div className="mt-3">
                <Tag
                  color={activeRow.movementType === "Fast Moving" ? "green" : "purple"}
                  className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
                >
                  {activeRow.movementType}
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
