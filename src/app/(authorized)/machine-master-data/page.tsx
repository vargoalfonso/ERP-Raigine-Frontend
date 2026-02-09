"use client";

import { useMemo, useRef, useState } from "react";
import { Button, Input, Modal, Form, Select, Table, Tag, Upload, message, Tooltip, InputNumber, QRCode } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  QrcodeOutlined,
  SearchOutlined,
  UploadOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { MdSettings, MdBuild } from "react-icons/md";

type MachineStatus = "Active" | "Maintenance";

type MachineRow = {
  key: string;
  machineName: string;
  machineNumber: string;
  productionLine: string;
  processName: string;
  capacity: number;
  status: MachineStatus;
};

type MachineFormValues = {
  machineName: string;
  machineNumber: string;
  productionLine: string;
  processName: string;
  capacity: number;
};

const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export default function MachineMasterDataPage() {
  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState<string>("All Lines");

  const [rows, setRows] = useState<MachineRow[]>([
    {
      key: "PM-A1-001",
      machineName: "Press Machine A1",
      machineNumber: "PM-A1-001",
      productionLine: "Line A",
      processName: "Pressing",
      capacity: 1000,
      status: "Active",
    },
    {
      key: "WR-B2-002",
      machineName: "Welding Robot B2",
      machineNumber: "WR-B2-002",
      productionLine: "Line B",
      processName: "Welding",
      capacity: 800,
      status: "Active",
    },
    {
      key: "CNC-C3-003",
      machineName: "CNC Milling C3",
      machineNumber: "CNC-C3-003",
      productionLine: "Line C",
      processName: "Milling",
      capacity: 600,
      status: "Maintenance",
    },
    {
      key: "AS-D4-004",
      machineName: "Assembly Station D4",
      machineNumber: "AS-D4-004",
      productionLine: "Line D",
      processName: "Assembly",
      capacity: 1200,
      status: "Active",
    },
  ]);

  const totalMachines = rows.length;
  const activeMachines = rows.filter((r) => r.status === "Active").length;
  const maintenanceMachines = rows.filter((r) => r.status === "Maintenance").length;
  const totalCapacity = rows.reduce((acc, r) => acc + r.capacity, 0);

  const lineOptions = useMemo(() => {
    const uniq = Array.from(new Set(rows.map((r) => r.productionLine)));
    return [{ label: "All Lines", value: "All Lines" }, ...uniq.map((l) => ({ label: l, value: l }))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (lineFilter === "All Lines" ? true : r.productionLine === lineFilter))
      .filter((r) => {
        if (!q) return true;
        return (
          r.machineName.toLowerCase().includes(q) ||
          r.machineNumber.toLowerCase().includes(q) ||
          r.productionLine.toLowerCase().includes(q) ||
          r.processName.toLowerCase().includes(q)
        );
      });
  }, [rows, search, lineFilter]);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<MachineRow | null>(null);
  const [barcodeRow, setBarcodeRow] = useState<MachineRow | null>(null);
  const [form] = Form.useForm<MachineFormValues>();
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);

  const productionLineOptions = useMemo(
    () => [
      { label: "Line A", value: "Line A" },
      { label: "Line B", value: "Line B" },
      { label: "Line C", value: "Line C" },
      { label: "Line D", value: "Line D" },
    ],
    []
  );

  const processOptions = useMemo(
    () => [
      { label: "Pressing", value: "Pressing" },
      { label: "Welding", value: "Welding" },
      { label: "Milling", value: "Milling" },
      { label: "Assembly", value: "Assembly" },
    ],
    []
  );

  const columns: ColumnsType<MachineRow> = [
    {
      title: "Machine Name",
      dataIndex: "machineName",
      key: "machineName",
      width: 180,
      render: (v: string) => <span className="text-gray-800">{v}</span>,
    },
    {
      title: "Machine Number",
      dataIndex: "machineNumber",
      key: "machineNumber",
      width: 150,
      render: (v: string) => <span className="text-blue-600 font-medium">{v}</span>,
    },
    {
      title: "Production Line",
      dataIndex: "productionLine",
      key: "productionLine",
      width: 130,
    },
    {
      title: "Process Name",
      dataIndex: "processName",
      key: "processName",
      width: 140,
    },
    {
      title: "Capacity",
      dataIndex: "capacity",
      key: "capacity",
      width: 110,
      align: "right",
      render: (v: number) => <span className="text-gray-800">{formatNumber(v)}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (v: MachineStatus) => (
        <Tag
          color={v === "Active" ? "green" : "gold"}
          className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
        >
          {v}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 220,
      fixed: "right",
      render: (_: unknown, record) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="small"
            className="!rounded-lg"
            icon={<QrcodeOutlined />}
            onClick={() => {
              setBarcodeRow(record);
              setBarcodeOpen(true);
            }}
          >
            Print QR
          </Button>
          <Tooltip title="Edit">
            <Button
              size="small"
              className="!rounded-lg"
              icon={<EditOutlined />}
              onClick={() => {
                setActiveRow(record);
                form.setFieldsValue({
                  machineName: record.machineName,
                  machineNumber: record.machineNumber,
                  productionLine: record.productionLine,
                  processName: record.processName,
                  capacity: record.capacity,
                });
                setEditOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              size="small"
              danger
              className="!rounded-lg"
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: "Delete Machine?",
                  content: `Delete ${record.machineNumber}?`,
                  okText: "Delete",
                  okButtonProps: { danger: true },
                  cancelText: "Cancel",
                  onOk: () => {
                    setRows((prev) => prev.filter((r) => r.key !== record.key));
                    message.success("Machine deleted");
                  },
                });
              }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const upsertMachine = async (mode: "add" | "edit") => {
    try {
      const values = await form.validateFields();
      const key = values.machineNumber.trim();
      if (!key) return;

      if (mode === "add" && rows.some((r) => r.machineNumber.toLowerCase() === key.toLowerCase())) {
        message.error("Machine Number already exists");
        return;
      }

      const next: MachineRow = {
        key,
        machineName: values.machineName,
        machineNumber: values.machineNumber,
        productionLine: values.productionLine,
        processName: values.processName,
        capacity: values.capacity,
        status: mode === "add" ? "Active" : (activeRow?.status ?? "Active"),
      };

      setRows((prev) => {
        if (mode === "add") return [next, ...prev];
        if (!activeRow) return prev;
        return prev.map((r) => (r.key === activeRow.key ? next : r));
      });

      if (mode === "add") setAddOpen(false);
      if (mode === "edit") setEditOpen(false);
      setActiveRow(null);
      form.resetFields();
      message.success(mode === "add" ? "Machine added" : "Machine updated");
    } catch {
      // form shows errors
    }
  };

  const handleExport = () => message.info("Export coming soon");

  const handlePrintBarcode = () => {
    if (!barcodeRow) return;

    const canvas = qrWrapperRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    const dataUrl = canvas?.toDataURL("image/png");

    const w = window.open("", "_blank", "width=680,height=880");
    if (!w) {
      message.error("Popup blocked. Please allow popups to print.");
      return;
    }

    const title = "Machine Information Barcode";
    const capacityText = `${formatNumber(barcodeRow.capacity)} units/hour`;

    w.document.open();
    w.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 24px; color: #111827; }
      .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 18px 20px; max-width: 520px; margin: 0 auto; }
      .top-title { font-size: 14px; font-weight: 600; margin: 0 0 14px; }
      .center-title { text-align: center; font-weight: 800; letter-spacing: 0.02em; margin: 6px 0 2px; }
      .center-sub { text-align: center; font-size: 12px; color: #6b7280; margin: 0 0 14px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 10px 0 14px; }
      .label { font-size: 11px; color: #6b7280; margin-bottom: 3px; }
      .value { font-size: 13px; font-weight: 600; }
      .divider { height: 1px; background: #e5e7eb; margin: 12px 0; }
      .qr { display: flex; justify-content: center; align-items: center; padding: 12px 0 6px; }
      .qr img { width: 180px; height: 180px; image-rendering: pixelated; }
      .bottom-code { text-align: center; font-size: 12px; color: #111827; margin-top: 6px; font-weight: 600; }
      @media print {
        body { padding: 0; }
        .card { border: none; }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="top-title">${title}</div>
      <div class="center-title">MACHINE INFORMATION</div>
      <div class="center-sub">${barcodeRow.machineNumber}</div>
      <div class="grid">
        <div>
          <div class="label">Machine Name</div>
          <div class="value">${barcodeRow.machineName}</div>
        </div>
        <div>
          <div class="label">Production Line</div>
          <div class="value">${barcodeRow.productionLine}</div>
        </div>
        <div>
          <div class="label">Process</div>
          <div class="value">${barcodeRow.processName}</div>
        </div>
        <div>
          <div class="label">Capacity</div>
          <div class="value">${capacityText}</div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="qr">
        ${dataUrl ? `<img src="${dataUrl}" alt="QR" />` : `<div style="width:180px;height:180px;border:2px solid #111827"></div>`}
      </div>
      <div class="bottom-code">${barcodeRow.machineNumber}</div>
    </div>
  </body>
</html>`);
    w.document.close();
    w.focus();

    setTimeout(() => {
      w.print();
      w.close();
    }, 250);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Machine Master Data</h1>
              <p className="text-sm text-gray-500">Manage machine master list and generate machine information barcodes</p>
            </div>
            <div className="flex items-center gap-2">
              <Upload
                beforeUpload={(file) => {
                  const ok = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
                  if (!ok) {
                    message.error("Please upload an Excel file (.xlsx/.xls)");
                    return Upload.LIST_IGNORE;
                  }
                  message.success("Excel uploaded (mock)");
                  return false;
                }}
                showUploadList={false}
              >
                <Button className="!rounded-lg" icon={<UploadOutlined />}>
                  Upload Excel
                </Button>
              </Upload>
              <Button
                type="primary"
                className="!rounded-lg"
                icon={<PlusOutlined />}
                onClick={() => {
                  form.resetFields();
                  setAddOpen(true);
                }}
              >
                Add Machine
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-blue-600">Total Machines</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{totalMachines}</div>
            </div>
            <MdSettings className="text-blue-600" size="22" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-green-600">Active Machines</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{activeMachines}</div>
            </div>
            <MdBuild className="text-green-600" size="22" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-orange-600">Maintenance</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{maintenanceMachines}</div>
            </div>
            <MdSettings className="text-orange-600" size="22" />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-purple-600">Total Capacity</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(totalCapacity)}</div>
            </div>
            <MdSettings className="text-purple-600" size="22" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Machine Name, Number, Line, or Process..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="!rounded-lg lg:max-w-xl"
            allowClear
          />

          <div className="flex items-center justify-end gap-2">
            <Select value={lineFilter} onChange={setLineFilter} options={lineOptions} style={{ width: 160 }} />
            <Button className="!rounded-lg" icon={<DownloadOutlined />} onClick={handleExport}>
              Export
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100">
          <Table<MachineRow>
            columns={columns}
            dataSource={filteredRows}
            rowKey="key"
            size="middle"
            pagination={false}
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>

      <Modal
        title={<span className="text-sm font-semibold">Add Machine Master Data</span>}
        open={addOpen}
        onCancel={() => {
          setAddOpen(false);
          form.resetFields();
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              className="!rounded-lg"
              onClick={() => {
                setAddOpen(false);
                form.resetFields();
              }}
            >
              Cancel
            </Button>
            <Button type="primary" className="!rounded-lg" icon={<PlusOutlined />} onClick={() => upsertMachine("add")}>
              Add Machine
            </Button>
          </div>
        }
      >
        <Form<MachineFormValues> form={form} layout="vertical">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Form.Item name="machineName" label="Machine Name" rules={[{ required: true, message: "Required" }]}>
              <Input className="!rounded-lg" placeholder="e.g Press Machine A1" />
            </Form.Item>
            <Form.Item name="machineNumber" label="Machine Number" rules={[{ required: true, message: "Required" }]}>
              <Input className="!rounded-lg" placeholder="e.g PM-A1-001" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Form.Item name="productionLine" label="Production Line" rules={[{ required: true, message: "Required" }]}>
              <Select
                options={productionLineOptions}
                placeholder="Select production line"
                className="w-full"
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item name="processName" label="Process Name" rules={[{ required: true, message: "Required" }]}>
              <Select
                options={processOptions}
                placeholder="Select process"
                className="w-full"
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </div>

          <Form.Item
            name="capacity"
            label="Machine Capacity (units/hour)"
            rules={[{ required: true, message: "Required" }]}
          >
            <InputNumber min={0} className="w-full !rounded-lg" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span className="text-sm font-semibold">Edit Machine</span>}
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setActiveRow(null);
          form.resetFields();
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              className="!rounded-lg"
              onClick={() => {
                setEditOpen(false);
                setActiveRow(null);
                form.resetFields();
              }}
            >
              Cancel
            </Button>
            <Button type="primary" className="!rounded-lg" onClick={() => upsertMachine("edit")}>
              Save
            </Button>
          </div>
        }
      >
        <Form<MachineFormValues> form={form} layout="vertical">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Form.Item name="machineName" label="Machine Name" rules={[{ required: true, message: "Required" }]}>
              <Input className="!rounded-lg" />
            </Form.Item>
            <Form.Item name="machineNumber" label="Machine Number" rules={[{ required: true, message: "Required" }]}>
              <Input className="!rounded-lg" disabled />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Form.Item name="productionLine" label="Production Line" rules={[{ required: true, message: "Required" }]}>
              <Select options={productionLineOptions} className="w-full" />
            </Form.Item>
            <Form.Item name="processName" label="Process Name" rules={[{ required: true, message: "Required" }]}>
              <Select options={processOptions} className="w-full" />
            </Form.Item>
          </div>

          <Form.Item
            name="capacity"
            label="Machine Capacity (units/hour)"
            rules={[{ required: true, message: "Required" }]}
          >
            <InputNumber min={0} className="w-full !rounded-lg" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span className="text-sm font-semibold">Machine Information Barcode</span>}
        open={barcodeOpen}
        onCancel={() => {
          setBarcodeOpen(false);
          setBarcodeRow(null);
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              className="!rounded-lg"
              onClick={() => {
                setBarcodeOpen(false);
                setBarcodeRow(null);
              }}
            >
              Close
            </Button>
            <Button
              type="primary"
              className="!rounded-lg"
              icon={<PrinterOutlined />}
              onClick={handlePrintBarcode}
              disabled={!barcodeRow}
            >
              Print Barcode
            </Button>
          </div>
        }
        width={620}
      >
        {barcodeRow ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="text-center">
              <div className="text-lg font-extrabold tracking-wide text-gray-900">MACHINE INFORMATION</div>
              <div className="text-xs text-gray-500 mt-1">{barcodeRow.machineNumber}</div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] text-gray-500">Machine Name</div>
                <div className="text-sm font-semibold text-gray-900">{barcodeRow.machineName}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500">Production Line</div>
                <div className="text-sm font-semibold text-gray-900">{barcodeRow.productionLine}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500">Process</div>
                <div className="text-sm font-semibold text-gray-900">{barcodeRow.processName}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500">Capacity</div>
                <div className="text-sm font-semibold text-gray-900">{formatNumber(barcodeRow.capacity)} units/hour</div>
              </div>
            </div>

            <div className="my-5 h-px bg-gray-200" />

            <div className="flex items-center justify-center">
              <div ref={qrWrapperRef} className="rounded-lg border border-gray-200 p-3">
                <QRCode value={barcodeRow.machineNumber} size={180} bordered={false} />
              </div>
            </div>

            <div className="mt-3 text-center text-sm font-semibold text-gray-900">{barcodeRow.machineNumber}</div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No machine selected.</div>
        )}
      </Modal>
    </div>
  );
}
