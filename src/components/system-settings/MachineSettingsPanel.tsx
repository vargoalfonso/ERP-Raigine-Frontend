"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  useCreateMachineParameterMutation,
  useDeleteMachineParameterMutation,
  useGetMachineParametersQuery,
  useUpdateMachineParameterMutation,
  type MachineParameterRecord,
} from "@/lib/api/machine-parameters/api";
import {
  useDeleteMachinePatternMutation,
  useGetMachinePatternsQuery,
} from "@/lib/api/machine-patterns/api";

type StatusType = "Active" | "Inactive";
type MachineTab = "pattern" | "master";

type MachineMasterRow = {
  id: string;
  machineName: string;
  machineCount: number;
  operatingHours: number;
  status: StatusType;
  createdAt: string;
};

type MachinePatternRow = {
  id: string;
  uniqCode: string;
  machineName: string;
  cycleTime: number;
  patternValue: number;
  workingDays: number;
  minOutput: number;
  prlReference: number;
  status: StatusType;
};

type MachineMasterFormValues = {
  machineName: string;
  machineCount: number;
  operatingHours: number;
  status: StatusType;
};

const normalizeStatus = (value: unknown): StatusType =>
  String(value ?? "Active").trim().toLowerCase().includes("inact") ? "Inactive" : "Active";

const toMachineMasterRow = (record: MachineParameterRecord): MachineMasterRow => ({
  id: String(record.id),
  machineName: String(record.machine_name ?? "-"),
  machineCount: Number(record.machine_count ?? 0),
  operatingHours: Number(record.operating_hours ?? 0),
  status: normalizeStatus(record.status),
  createdAt: record.updated_at || record.created_at || "-",
});

export default function MachineSettingsPanel() {
  const router = useRouter();
  const apiEnabled = Boolean(apiBaseUrl);
  const [messageApi, contextHolder] = message.useMessage();
  const [machineTab, setMachineTab] = useState<MachineTab>("master");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All Types" | StatusType>("All Types");
  const [editingMachine, setEditingMachine] = useState<MachineMasterRow | null>(null);
  const [viewingPattern, setViewingPattern] = useState<MachinePatternRow | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<MachineMasterRow | null>(null);
  const [deletingPattern, setDeletingPattern] = useState<MachinePatternRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [patternViewOpen, setPatternViewOpen] = useState(false);
  const [form] = Form.useForm<MachineMasterFormValues>();

  const machineParametersQuery = useGetMachineParametersQuery({ page: 1, limit: 20 }, { skip: !apiEnabled });
  const machinePatternsQuery = useGetMachinePatternsQuery({ page: 1, limit: 20 }, { skip: !apiEnabled });
  const [createMachineParameter, createState] = useCreateMachineParameterMutation();
  const [updateMachineParameter, updateState] = useUpdateMachineParameterMutation();
  const [deleteMachineParameter, deleteState] = useDeleteMachineParameterMutation();
  const [deleteMachinePattern, deletePatternState] = useDeleteMachinePatternMutation();

  const machineNameById = useMemo(
    () =>
      new Map(
        (machineParametersQuery.data?.items ?? []).map((item) => [Number(item.id), String(item.machine_name ?? `Machine #${String(item.id)}`)])
      ),
    [machineParametersQuery.data?.items]
  );

  const machineMasterRows = useMemo(
    () => (machineParametersQuery.data?.items ?? []).map(toMachineMasterRow),
    [machineParametersQuery.data?.items]
  );

  const machinePatternRows = useMemo<MachinePatternRow[]>(
    () =>
      (machinePatternsQuery.data?.items ?? []).map((item) => ({
        id: String(item.id),
        uniqCode: String(item.uniq_code ?? "-"),
        machineName: machineNameById.get(Number(item.machine_id ?? 0)) ?? `Machine #${String(item.machine_id ?? "-")}`,
        cycleTime: Number(item.cycle_time ?? 0),
        patternValue: Number(item.pattern_value ?? 0),
        workingDays: Number(item.working_days ?? 0),
        minOutput: Number(item.min_output ?? 0),
        prlReference: Number(item.prl_reference ?? 0),
        status: normalizeStatus(item.status),
      })),
    [machineNameById, machinePatternsQuery.data?.items]
  );

  const filteredMachineMasterRows = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return machineMasterRows
      .filter((row) => (statusFilter === "All Types" ? true : row.status === statusFilter))
      .filter((row) => {
        if (!lowered) return true;
        return [row.machineName, String(row.machineCount), String(row.operatingHours)]
          .join(" ")
          .toLowerCase()
          .includes(lowered);
      });
  }, [machineMasterRows, query, statusFilter]);

  const filteredMachinePatternRows = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return machinePatternRows
      .filter((row) => (statusFilter === "All Types" ? true : row.status === statusFilter))
      .filter((row) => {
        if (!lowered) return true;
        return [row.uniqCode, row.machineName].join(" ").toLowerCase().includes(lowered);
      });
  }, [machinePatternRows, query, statusFilter]);

  const machineMasterColumns: ColumnsType<MachineMasterRow> = [
    {
      title: "Machine Name",
      dataIndex: "machineName",
      key: "machineName",
      width: 220,
      render: (value: string) => <span className="font-medium text-gray-900">{value}</span>,
    },
    // { title: "Machine Count", dataIndex: "machineCount", key: "machineCount", width: 140 },
    { title: "Operating Hours", dataIndex: "operatingHours", key: "operatingHours", width: 150 },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: StatusType) => (
        <Tag className={value === "Active" ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-red-50 text-red-700 border-red-100"}>
          {value}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingMachine(row);
              form.setFieldsValue({
                machineName: row.machineName,
                machineCount: row.machineCount,
                operatingHours: row.operatingHours,
                status: row.status,
              });
              setEditOpen(true);
            }}
          />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setDeletingMachine(row)} />
        </div>
      ),
    },
  ];

  const machinePatternColumns: ColumnsType<MachinePatternRow> = [
    { title: "Uniq Code", dataIndex: "uniqCode", key: "uniqCode", width: 140 },
    { title: "Machine Name", dataIndex: "machineName", key: "machineName", width: 220 },
    { title: "Cycle Time", dataIndex: "cycleTime", key: "cycleTime", width: 120 },
    { title: "Pattern Value", dataIndex: "patternValue", key: "patternValue", width: 120 },
    { title: "Working Days", dataIndex: "workingDays", key: "workingDays", width: 120 },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: StatusType) => (
        <Tag className={value === "Active" ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-red-50 text-red-700 border-red-100"}>
          {value}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<EyeOutlined />} onClick={() => { setViewingPattern(row); setPatternViewOpen(true); }} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setDeletingPattern(row)} />
        </div>
      ),
    },
  ];

  const closeMachineEditor = () => {
    setCreateOpen(false);
    setEditOpen(false);
    setEditingMachine(null);
    form.resetFields();
  };

  const submitMachineForm = async (mode: "create" | "edit") => {
    try {
      const values = await form.validateFields();
      if (mode === "edit" && !editingMachine?.id) {
        messageApi.error("Machine id not found");
        return;
      }

      const payload = {
        machine_name: values.machineName.trim(),
        machine_count: Number(values.machineCount ?? 0),
        operating_hours: Number(values.operatingHours ?? 0),
        status: values.status,
      };

      if (mode === "create") {
        await createMachineParameter(payload).unwrap();
        messageApi.success("Machine master created");
      } else {
        await updateMachineParameter({ id: editingMachine!.id, body: payload }).unwrap();
        messageApi.success("Machine master updated");
      }

      closeMachineEditor();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      messageApi.error(getApiErrorMessage(error, mode === "create" ? "Failed to create machine master" : "Failed to update machine master"));
    }
  };

  return (
    <CardShell>
      {contextHolder}
      <div className="px-5 py-4 border-b">
        <div className="mb-3 inline-flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setMachineTab("master");
              setQuery("");
              setStatusFilter("All Types");
            }}
            className={"px-4 py-2 text-sm rounded-md transition-colors " + (machineTab === "master" ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900")}
          >
            Master Machine
          </button>
          <button
            type="button"
            onClick={() => {
              setMachineTab("pattern");
              setQuery("");
              setStatusFilter("All Types");
            }}
            className={"px-4 py-2 text-sm rounded-md transition-colors " + (machineTab === "pattern" ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900")}
          >
            Pattern
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={machineTab === "master" ? "Search by machine name..." : "Search by Uniq or Machine Name..."}
            prefix={<SearchOutlined className="text-gray-400" />}
            className="flex-1 min-w-[260px]"
          />
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as "All Types" | StatusType)}
            style={{ width: 140 }}
            options={[
              { label: "All Types", value: "All Types" },
              { label: "Active", value: "Active" },
              { label: "Inactive", value: "Inactive" },
            ]}
          />
          <Button icon={<PlusOutlined />} type="primary" onClick={() => {
            if (machineTab === "master") {
              form.setFieldsValue({ status: "Active", machineCount: 1, operatingHours: 8 });
              setCreateOpen(true);
              return;
            }
            router.push("/system-settings/machine/pattern/create");
          }}>
            {machineTab === "master" ? "Add Machine" : "Add Pattern"}
          </Button>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-base font-semibold text-gray-900">
              {machineTab === "master" ? "Machine - Master" : "Machine - Pattern"}
            </div>
            <div className="text-sm text-gray-500">
              {machineTab === "master" ? "Manage machine names, counts, and operating hours for the master machine list." : "Define machine pattern configurations using the master machine list."}
            </div>
          </div>
        </div>

        <div className="mt-4 border rounded-xl overflow-hidden">
          {machineTab === "master" ? (
            <Table<MachineMasterRow>
              columns={machineMasterColumns}
              dataSource={apiEnabled ? filteredMachineMasterRows : []}
              rowKey="id"
              loading={apiEnabled && machineParametersQuery.isLoading}
              pagination={false}
              scroll={{ x: "max-content" }}
            />
          ) : (
            <Table<MachinePatternRow>
              columns={machinePatternColumns}
              dataSource={apiEnabled ? filteredMachinePatternRows : []}
              rowKey="id"
              loading={apiEnabled && machinePatternsQuery.isLoading}
              pagination={false}
              scroll={{ x: "max-content" }}
            />
          )}
        </div>
      </div>

      <Modal
        title={<span className="text-sm font-semibold">Add Machine Master</span>}
        open={createOpen}
        onCancel={closeMachineEditor}
        maskClosable={true}
        keyboard={true}
        destroyOnClose={true}
        closable={true}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeMachineEditor}>Cancel</Button>
            <Button type="primary" onClick={() => submitMachineForm("create")} loading={createState.isLoading}>Save</Button>
          </div>
        }
      >
        <Form<MachineMasterFormValues> form={form} layout="vertical">
          <Form.Item name="machineName" label="Machine Name" rules={[{ required: true, message: "Required" }]}>
            <Input placeholder="Standard Production" />
          </Form.Item>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* <Form.Item name="machineCount" label="Machine Count" rules={[{ required: true, message: "Required" }]}>
              <InputNumber className="w-full" min={0} />
            </Form.Item> */}
            <Form.Item name="operatingHours" label="Operating Hours" rules={[{ required: true, message: "Required" }]}>
              <InputNumber className="w-full" min={0} />
            </Form.Item>
          </div>
          <Form.Item name="status" label="Status" rules={[{ required: true, message: "Required" }]}>
            <Select options={[{ label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span className="text-sm font-semibold">Edit Machine Master</span>}
        open={editOpen}
        onCancel={closeMachineEditor}
        maskClosable={true}
        keyboard={true}
        destroyOnClose={true}
        closable={true}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeMachineEditor}>Cancel</Button>
            <Button type="primary" onClick={() => submitMachineForm("edit")} loading={updateState.isLoading}>Save</Button>
          </div>
        }
      >
        <Form<MachineMasterFormValues> form={form} layout="vertical">
          <Form.Item name="machineName" label="Machine Name" rules={[{ required: true, message: "Required" }]}>
            <Input />
          </Form.Item>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* <Form.Item name="machineCount" label="Machine Count" rules={[{ required: true, message: "Required" }]}>
              <InputNumber className="w-full" min={0} />
            </Form.Item> */}
            <Form.Item name="operatingHours" label="Operating Hours" rules={[{ required: true, message: "Required" }]}>
              <InputNumber className="w-full" min={0} />
            </Form.Item>
          </div>
          <Form.Item name="status" label="Status" rules={[{ required: true, message: "Required" }]}>
            <Select options={[{ label: "Active", value: "Active" }, { label: "Inactive", value: "Inactive" }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Delete machine master?"
        open={Boolean(deletingMachine)}
        okText="Delete"
        okButtonProps={{ danger: true, loading: deleteState.isLoading }}
        onCancel={() => setDeletingMachine(null)}
        maskClosable={true}
        keyboard={true}
        destroyOnClose={true}
        closable={true}
        onOk={async () => {
          try {
            if (!deletingMachine?.id) return;
            await deleteMachineParameter(deletingMachine.id).unwrap();
            messageApi.success("Machine master deleted");
            setDeletingMachine(null);
          } catch (error) {
            messageApi.error(getApiErrorMessage(error, "Failed to delete machine master"));
          }
        }}
      >
        Delete <span className="font-semibold">{deletingMachine?.machineName}</span> from machine master?
      </Modal>

      <Modal
        title="Machine Pattern Details"
        open={patternViewOpen}
        onCancel={() => {
          setPatternViewOpen(false);
          setViewingPattern(null);
        }}
        maskClosable={true}
        keyboard={true}
        destroyOnClose={true}
        closable={true}
        footer={<Button onClick={() => { setPatternViewOpen(false); setViewingPattern(null); }}>Close</Button>}
      >
        {viewingPattern ? (
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div><div className="text-gray-500">Uniq Code</div><div className="font-semibold text-gray-900">{viewingPattern.uniqCode}</div></div>
            <div><div className="text-gray-500">Machine Name</div><div className="font-semibold text-gray-900">{viewingPattern.machineName}</div></div>
            <div><div className="text-gray-500">Cycle Time</div><div className="text-gray-900">{viewingPattern.cycleTime}</div></div>
            <div><div className="text-gray-500">Pattern Value</div><div className="text-gray-900">{viewingPattern.patternValue}</div></div>
            <div><div className="text-gray-500">Working Days</div><div className="text-gray-900">{viewingPattern.workingDays}</div></div>
            <div><div className="text-gray-500">Min Output</div><div className="text-gray-900">{viewingPattern.minOutput}</div></div>
            <div><div className="text-gray-500">PRL Reference</div><div className="text-gray-900">{viewingPattern.prlReference}</div></div>
            <div><div className="text-gray-500">Status</div><div className="text-gray-900">{viewingPattern.status}</div></div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Delete machine pattern?"
        open={Boolean(deletingPattern)}
        okText="Delete"
        okButtonProps={{ danger: true, loading: deletePatternState.isLoading }}
        onCancel={() => setDeletingPattern(null)}
        maskClosable={true}
        keyboard={true}
        destroyOnClose={true}
        closable={true}
        onOk={async () => {
          try {
            if (!deletingPattern?.id) return;
            await deleteMachinePattern(deletingPattern.id).unwrap();
            messageApi.success("Machine pattern deleted");
            setDeletingPattern(null);
          } catch (error) {
            messageApi.error(getApiErrorMessage(error, "Failed to delete machine pattern"));
          }
        }}
      >
        Delete <span className="font-semibold">{deletingPattern?.uniqCode}</span> from machine pattern?
      </Modal>
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-blue-50 rounded-t-2xl px-5 py-4 border-b">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-lg font-semibold text-gray-900">System Parameters</div>
            <div className="text-sm text-gray-500">Comprehensive ERP parameter management and configuration</div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
