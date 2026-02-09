"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Drawer, Form, Input, InputNumber, Modal, Select, Table, Tag, message } from "antd";
import {
  DownloadOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScanOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnType } from "antd/es/table";
import StatsCard from "@/components/StatsCard";
import { BsBoxSeam } from "react-icons/bs";
import { HiOutlineArchiveBox } from "react-icons/hi2";
import { LuChartColumn } from "react-icons/lu";
import { FaRegEdit, FaRegTrashAlt } from "react-icons/fa";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  useDeleteWorkInProgressMutation,
  useGetAllWorkInProgressQuery,
  useUpdateWorkInProgressMutation,
} from "@/lib/api/work-in-progress/api";
import type { WorkInProgressRecord } from "@/lib/api/work-in-progress/interface";

type WipRecord = {
  id: string;
  process: "Assembly" | "Machining" | "Quality Check";
  uniq: string;
  partNumber: string;
  partName: string;
  model: string;
  woNumber: string;
  stock: number;
  kanbanCode: string;
  type: "Child Part" | "Warehouse FG";
  stockToCompleteKanban: number;
  kanban: number;
};

const dummyWipData: WipRecord[] = [
  {
    id: "1",
    process: "Assembly",
    uniq: "LV7-001",
    partNumber: "EMA7-001",
    partName: "Engine Mount Assembly",
    model: "Camry 2024",
    woNumber: "WO-001-2024",
    stock: 200,
    kanbanCode: "KBN-001-2024",
    type: "Child Part",
    stockToCompleteKanban: 250,
    kanban: 5,
  },
  {
    id: "2",
    process: "Machining",
    uniq: "LV7-001",
    partNumber: "EMA7-001",
    partName: "Engine Mount Assembly",
    model: "Camry 2024",
    woNumber: "WO-001-2024",
    stock: 200,
    kanbanCode: "KBN-001-2024",
    type: "Child Part",
    stockToCompleteKanban: 250,
    kanban: 5,
  },
  {
    id: "3",
    process: "Quality Check",
    uniq: "LV8-002",
    partNumber: "SA8-002",
    partName: "Suspension Arm",
    model: "Camry 2024",
    woNumber: "WO-002-2024",
    stock: 200,
    kanbanCode: "KBN-002-2024",
    type: "Warehouse FG",
    stockToCompleteKanban: 25,
    kanban: 2,
  },
  {
    id: "4",
    process: "Assembly",
    uniq: "LW0-003",
    partNumber: "BC0-003",
    partName: "Brake Caliper",
    model: "Camry 2024",
    woNumber: "WO-003-2024",
    stock: 200,
    kanbanCode: "KBN-003-2024",
    type: "Warehouse FG",
    stockToCompleteKanban: 25,
    kanban: 2,
  },
  {
    id: "5",
    process: "Quality Check",
    uniq: "MB6-004",
    partNumber: "CM6-004",
    partName: "Control Module",
    model: "Camry 2024",
    woNumber: "WO-004-2024",
    stock: 200,
    kanbanCode: "KBN-004-2024",
    type: "Warehouse FG",
    stockToCompleteKanban: 29,
    kanban: 2,
  },
];

type WipEditFormValues = {
  uniq?: string;
  woNumber?: string;
  kanbanCode?: string;
  type?: WipRecord["type"];
  process?: WipRecord["process"];
  stock?: number;
  stockToCompleteKanban?: number;
};

export default function WorkInProgressPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [searchValue, setSearchValue] = useState("");
  const [tab, setTab] = useState("wip");
  const [processFilter, setProcessFilter] = useState<string>("all");

  const useApi = Boolean(apiBaseUrl);
  const [currentPage] = useState(1);
  const [pageSize] = useState(50);
  const {
    data: wipResponse,
    isFetching: wipFetching,
    isSuccess: wipSuccess,
    refetch: refetchWip,
  } = useGetAllWorkInProgressQuery(
    { currentPage, pageSize },
    { skip: !useApi }
  );
  const [updateWip] = useUpdateWorkInProgressMutation();
  const [deleteWip] = useDeleteWorkInProgressMutation();

  const [wipData, setWipData] = useState<WipRecord[]>(dummyWipData);

  const [editOpen, setEditOpen] = useState(false);
  const [editingWip, setEditingWip] = useState<WipRecord | null>(null);
  const [editForm] = Form.useForm<WipEditFormValues>();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingWip, setDeletingWip] = useState<WipRecord | null>(null);

  const uniqTargets = useMemo(() => {
    return new Map<string, number>([
      ["LV7-001", 250],
      ["LV8-002", 250],
      ["LW0-003", 250],
      ["MB6-004", 250],
    ]);
  }, []);

  const mapApiProcess = (value: string | undefined): WipRecord["process"] => {
    const v = (value ?? "").toLowerCase();
    if (v.includes("machin")) return "Machining";
    if (v.includes("quality") || v.includes("qc")) return "Quality Check";
    return "Assembly";
  };

  const mapApiToUi = (row: WorkInProgressRecord): WipRecord => {
    const uniq = row.product_uniq ?? row.master_list?.uniq_code ?? "-";
    const partNumber = row.master_list?.part_no ?? "-";
    const partName = row.part_name ?? row.master_list?.part_name ?? "-";
    const model = row.master_list?.model ?? "-";
    const woNumber = row.work_order?.wo_number ?? row.work_order_reference ?? "-";
    const stock = Number(row.quantity_in_process ?? 0);
    const kanbanCode = row.batch_number ?? "-";
    const process = mapApiProcess(row.current_process);
    const target = uniqTargets.get(uniq) ?? row.master_list?.kanban_quantity ?? 250;
    const stockToCompleteKanban = Math.max(0, Number(target) - stock);
    const kanban = Math.max(0, Math.ceil(Number(target || 0) / 50));

    return {
      id: row.id,
      process,
      uniq,
      partNumber,
      partName,
      model,
      woNumber,
      stock,
      kanbanCode,
      type: "Child Part",
      stockToCompleteKanban,
      kanban,
    };
  };

  const displayedWipData = useMemo(() => {
    if (useApi && wipSuccess) {
      return (wipResponse?.data ?? []).map(mapApiToUi);
    }
    return wipData;
  }, [useApi, wipData, wipResponse?.data, wipSuccess]);

  const updateAutoFill = () => {
    const uniq = editForm.getFieldValue("uniq");
    const stock = editForm.getFieldValue("stock");
    const target = uniq ? uniqTargets.get(uniq) ?? 250 : 250;
    const next = Math.max(0, target - (Number(stock) || 0));
    editForm.setFieldValue("stockToCompleteKanban", next);
  };

  const openWipDetail = (record: WipRecord) => {
    router.push(
      `/work-in-progress/detail?id=${encodeURIComponent(record.id)}&uniq=${encodeURIComponent(record.uniq)}`
    );
  };

  const openEditDrawer = (record: WipRecord) => {
    setEditingWip(record);
    editForm.setFieldsValue({
      uniq: record.uniq,
      woNumber: record.woNumber,
      kanbanCode: record.kanbanCode,
      type: record.type,
      process: record.process,
      stock: record.stock,
      stockToCompleteKanban: record.stockToCompleteKanban,
    });
    setEditOpen(true);
  };

  const closeEditDrawer = () => {
    setEditOpen(false);
    setEditingWip(null);
    editForm.resetFields();
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      if (!editingWip) return;

      if (useApi && wipSuccess) {
        await updateWip({
          id: editingWip.id,
          product_uniq: values.uniq ?? editingWip.uniq,
          work_order_reference: values.woNumber ?? editingWip.woNumber,
          batch_number: values.kanbanCode ?? editingWip.kanbanCode,
          current_process: values.process ?? editingWip.process,
          quantity_in_process: Number(values.stock ?? editingWip.stock),
        }).unwrap();
        await refetchWip();
      } else {
        setWipData((prev) =>
          prev.map((row) => {
            if (row.id !== editingWip.id) return row;
            return {
              ...row,
              uniq: values.uniq ?? row.uniq,
              woNumber: values.woNumber ?? row.woNumber,
              kanbanCode: values.kanbanCode ?? row.kanbanCode,
              type: (values.type ?? row.type) as WipRecord["type"],
              process: (values.process ?? row.process) as WipRecord["process"],
              stock: Number(values.stock ?? row.stock),
              stockToCompleteKanban: Number(
                values.stockToCompleteKanban ?? row.stockToCompleteKanban
              ),
            };
          })
        );
      }

      messageApi.success("Saved");
      closeEditDrawer();
    } catch {
      // validation errors shown by antd
    }
  };

  const openDeleteModal = (record: WipRecord) => {
    setDeletingWip(record);
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteOpen(false);
    setDeletingWip(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingWip) return;
    try {
      if (useApi && wipSuccess) {
        await deleteWip(deletingWip.id).unwrap();
        await refetchWip();
      } else {
        setWipData((prev) => prev.filter((row) => row.id !== deletingWip.id));
      }
      if (editingWip?.id === deletingWip.id) {
        closeEditDrawer();
      }
      messageApi.success("Deleted");
      closeDeleteModal();
    } catch {
      messageApi.error("Failed to delete");
    }
  };

  const filteredData = displayedWipData.filter((row) => {
    const matchesSearch =
      !searchValue ||
      [
        row.process,
        row.uniq,
        row.partNumber,
        row.partName,
        row.model,
        row.woNumber,
        row.kanbanCode,
        row.type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchValue.toLowerCase());

    const matchesProcess =
      processFilter === "all" || row.process === processFilter;

    return matchesSearch && matchesProcess;
  });

  const columns: ColumnType<WipRecord>[] = [
    {
      title: "Process",
      key: "process",
      width: 120,
      render: (_: unknown, record: WipRecord) => (
        <span className="inline-flex rounded-full bg-[#F1F5F9] px-3 py-1 text-xs text-gray-700">
          {record.process}
        </span>
      ),
    },
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
      width: 110,
    },
    {
      title: "Part Number",
      dataIndex: "partNumber",
      key: "partNumber",
      width: 130,
    },
    {
      title: "Part Info",
      key: "partInfo",
      width: 230,
      render: (_: unknown, record: WipRecord) => (
        <div>
          <div className="font-semibold text-gray-900">{record.partName}</div>
          <div className="text-xs text-gray-400">{record.model}</div>
        </div>
      ),
    },
    {
      title: "WO Number",
      key: "woNumber",
      width: 140,
      render: (_: unknown, record: WipRecord) => (
        <span className="inline-flex rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
          {record.woNumber}
        </span>
      ),
    },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      width: 100,
    },
    {
      title: "Kanban",
      key: "kanbanCode",
      width: 140,
      render: (_: unknown, record: WipRecord) => (
        <span className="inline-flex rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
          {record.kanbanCode}
        </span>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 140,
    },
    {
      title: "Stock to Complete Kanban",
      key: "stockToCompleteKanban",
      dataIndex: "stockToCompleteKanban",
      width: 120,
    },
    {
      title: "Kanban",
      dataIndex: "kanban",
      key: "kanban",
      width: 140,
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, record: WipRecord) => (
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            className="text-blue-600 hover:text-blue-800"
            onClick={() => openWipDetail(record)}
          />
          <Button
            type="text"
            icon={<FaRegEdit />}
            size="small"
            className="text-green-600 hover:text-green-800"
            onClick={() => openEditDrawer(record)}
          />
          <Button
            type="text"
            icon={<FaRegTrashAlt color="red" />}
            size="small"
            className="text-red-600 hover:text-gray-800"
            onClick={() => openDeleteModal(record)}
          />
          <Button
            type="text"
            icon={<ReloadOutlined />}
            size="small"
            className="text-gray-600 hover:text-gray-800"
            onClick={() => {
              if (useApi) {
                refetchWip();
                return;
              }
              messageApi.info("Using mock data");
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {contextHolder}

      <Modal
        title="Delete WIP item?"
        open={deleteOpen}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={handleConfirmDelete}
        onCancel={closeDeleteModal}
      >
        <p>
          This will remove <span className="font-semibold">{deletingWip?.uniq}</span> from the list.
        </p>
      </Modal>

      <Drawer
        title={<div className="font-semibold">Edit</div>}
        placement="right"
        width={380}
        open={editOpen}
        onClose={closeEditDrawer}
        closeIcon={<span className="text-gray-500">×</span>}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button onClick={closeEditDrawer}>Cancel</Button>
            <Button type="primary" onClick={handleSaveEdit}>
              Save
            </Button>
          </div>
        }
      >
        <Form
          form={editForm}
          layout="vertical"
          requiredMark={false}
          onValuesChange={() => updateAutoFill()}
        >
          <Form.Item
            label="Uniq"
            name="uniq"
            rules={[{ required: true, message: "Uniq is required" }]}
          >
            <Select
              placeholder="Select Uniq"
              options={[
                { label: "LV7-001", value: "LV7-001" },
                { label: "LV8-002", value: "LV8-002" },
                { label: "LW0-003", value: "LW0-003" },
                { label: "MB6-004", value: "MB6-004" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Work Order Number"
            name="woNumber"
            rules={[{ required: true, message: "Work Order Number is required" }]}
          >
            <Select
              placeholder="Select Work Order"
              options={[
                { label: "WO-001-2024", value: "WO-001-2024" },
                { label: "WO-002-2024", value: "WO-002-2024" },
                { label: "WO-003-2024", value: "WO-003-2024" },
                { label: "WO-004-2024", value: "WO-004-2024" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Packing Number"
            name="kanbanCode"
            rules={[{ required: true, message: "Packing Number is required" }]}
          >
            <Input placeholder="Packing Number" />
          </Form.Item>

          <Form.Item
            label="WIP Type"
            name="type"
            rules={[{ required: true, message: "WIP Type is required" }]}
          >
            <Select
              placeholder="Select Type"
              options={[
                { label: "Child Part", value: "Child Part" },
                { label: "Warehouse FG", value: "Warehouse FG" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Process"
            name="process"
            rules={[{ required: true, message: "Process is required" }]}
          >
            <Select
              placeholder="Select Process"
              options={[
                { label: "Assembly", value: "Assembly" },
                { label: "Machining", value: "Machining" },
                { label: "Quality Check", value: "Quality Check" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Stock Process"
            name="stock"
            rules={[{ required: true, message: "Stock Process is required" }]}
          >
            <InputNumber className="w-full" min={0} placeholder="250" />
          </Form.Item>

          <Form.Item
            label="Stock to Complete Kanban"
            name="stockToCompleteKanban"
            rules={[{ required: true, message: "Stock to Complete is required" }]}
          >
            <InputNumber className="w-full" min={0} placeholder="50" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-semibold text-gray-900">Work In-Progress Database</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <span>Tuesday, September 23, 2025</span>
            <span className="text-gray-300">•</span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>System Online</span>
            </span>
          </div>
        </div>

        <Button className="rounded-xl">Admin PPIC</Button>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">Work In-Progress Database</div>
            <div className="text-sm text-gray-500">
              Track WIP by Uniq, Packing Number, Type and Process with real-time aging and station visibility
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button icon={<ScanOutlined />} className="flex items-center gap-2">
              Scan WIP
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="flex items-center gap-2"
              onClick={() => router.push("/work-in-progress/create")}
            >
              Add WIP
            </Button>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Active WIP"
          value={3}
          icon={<BsBoxSeam size={22} />}
          bgColor=""
          textColor="text-blue-600"
        />
        <StatsCard
          title="Total Quantity"
          value={105}
          icon={<LuChartColumn size={22} />}
          bgColor=""
          textColor="text-green-600"
        />
        <StatsCard
          title="Avg Aging"
          value="4.3h"
          icon={<HiOutlineArchiveBox size={22} />}
          bgColor=""
          textColor="text-orange-600"
        />
        <StatsCard
          title="Active Stations"
          value={3}
          icon={<LuChartColumn size={22} />}
          bgColor=""
          textColor="text-purple-600"
        />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 space-y-4">
          <div className="inline-grid grid-cols-2 p-[2px] bg-[#F1F5F9] rounded-lg">
            <button
              type="button"
              onClick={() => setTab("wip")}
              className={`${tab === "wip" ? "bg-white" : ""} rounded-xl text-sm px-4 py-2`}
            >
              WIP Tracking
            </button>
            <button
              type="button"
              onClick={() => setTab("station")}
              className={`${tab === "station" ? "bg-white" : ""} rounded-xl text-sm px-4 py-2`}
            >
              Station Visibility
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by Uniq or Machine Name..."
              prefix={<SearchOutlined className="text-gray-400" />}
              className="max-w-[420px]"
              allowClear
            />

            <Button icon={<DownloadOutlined />} className="flex items-center gap-2">
              Export
            </Button>
          </div>

          <div className="h-px bg-gray-100" />

          {tab === "wip" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">
                  Real-time WIP Tracking
                </div>
                <Select
                  value={processFilter}
                  onChange={setProcessFilter}
                  style={{ width: 200 }}
                  options={[
                    { label: "All Process", value: "all" },
                    { label: "Assembly", value: "Assembly" },
                    { label: "Machining", value: "Machining" },
                    { label: "Quality Check", value: "Quality Check" },
                  ]}
                />
              </div>

              <div className="overflow-x-auto">
                <Table<WipRecord>
                  columns={columns}
                  dataSource={filteredData}
                  rowKey="id"
                  pagination={false}
                  bordered
                  scroll={{ x: "max-content" }}
                  loading={useApi ? wipFetching : false}
                />
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-gray-500">No station data</div>
          )}
        </div>
      </div>
    </div>
  );
}
