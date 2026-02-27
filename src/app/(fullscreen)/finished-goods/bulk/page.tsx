"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Typography,
  Upload,
  Button,
  Space,
  Table,
  InputNumber,
  message,
  Divider,
  Radio,
} from "antd";
import type { RadioChangeEvent } from "antd";
import {
  UploadOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import type {
  RcFile,
  UploadChangeParam,
  UploadFile,
} from "antd/es/upload/interface";
import { generateNextWorkOrderNumber } from "@/lib/utils/workOrder";

const { Title, Text } = Typography;
const { Dragger } = Upload;

type RowData = {
  key: string;
  uniq: string;
  part_number: string;
  part_name: string;
  model: string;
  stock: number;
  wo_number: string;
  warehouse: string;
};

export default function BulkFinishedGoodsPage() {
  const router = useRouter();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [loadingSave, setLoadingSave] = useState(false);
  const [mode, setMode] = useState<"manual" | "bulk">("bulk");
  const sampleRows: RowData[] = [
  {
    key: "1",
    model: "Vaso",
    stock: 24,
    wo_number: "Jakarta",
    uniq: "123",
    part_number: "1233",
    part_name: "1234",
    warehouse: "12345"
  },
  {
   key: "1",
    model: "Vaso",
    stock: 24,
    wo_number: "Jakarta",
    uniq: "123",
    part_number: "1233",
    part_name: "1234",
    warehouse: "12345"
  },
  {
 key: "1",
    model: "Vaso",
    stock: 24,
    wo_number: "Jakarta",
    uniq: "123",
    part_number: "1233",
    part_name: "1234",
    warehouse: "12345"
  },
  {
  key: "1",
    model: "Vaso",
    stock: 24,
    wo_number: "Jakarta",
    uniq: "123",
    part_number: "1233",
    part_name: "1234",
    warehouse: "12345"
  },
  {
   key: "1",
    model: "Vaso",
    stock: 24,
    wo_number: "Jakarta",
    uniq: "123",
    part_number: "1233",
    part_name: "1234",
    warehouse: "12345"
  }
  
];

  useEffect(() => {
    /* otomatis isi saat pertama buka biar gampang testing */
    // Ensure WO numbers use the standard format.
    const seed = generateNextWorkOrderNumber();
    const m = seed.match(/^(WO-[0-9]{6}-)([0-9]{3})$/);
    const prefix = m?.[1];
    const base = m ? Number(m[2]) : 1;
    setRows(
      sampleRows.map((r, idx) => {
        const nextWo = prefix
          ? `${prefix}${String(base + idx).padStart(3, "0")}`
          : generateNextWorkOrderNumber();
        return {
          ...r,
          wo_number: nextWo,
        };
      })
    );
  }, []);
  // Columns for preview table
  const columns = [
    {
      title: "Uniq",
      dataIndex: "uniq",
      key: "uniq",
    },
    {
      title: "Part Number",
      dataIndex: "part_number",
      key: "part_number",
    },
    {
      title: "Part Name",
      dataIndex: "part_name",
      key: "part_name",
    },
    {
      title: "Model",
      dataIndex: "model",
      key: "model",
    },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      render: (value: number, record: RowData) => (
        <InputNumber
          min={0}
          value={value}
          onChange={(v) => handleStockChange(record.key, v ?? 0)}
        />
      ),
    },
    {
      title: "WO Number",
      dataIndex: "wo_number",
      key: "wo_number",
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse",
      key: "warehouse",
    },
  ];

  const handleStockChange = (key: string, value: number) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, stock: value } : r))
    );
  };
  

  // Compute summary counts
  const entriesCount = rows.length;
  const completeCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.uniq &&
          r.part_number &&
          r.part_name &&
          typeof r.stock === "number" &&
          r.wo_number &&
          r.warehouse
      ).length,
    [rows]
  );

  // Create CSV template and download
  const handleDownloadTemplate = () => {
    const header = [
      "uniq",
      "part_number",
      "part_name",
      "model",
      "stock",
      "wo_number",
      "warehouse",
    ];
    const sample = [
      "LV-001",
      "SP-001-A",
      "Steel Plate",
      "Camry 2024",
      "250",
      "WO-ddmmyy-001",
      "WH-FG-202",
    ];
    const csv = [header.join(","), sample.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finished_goods_template.csv";
    a.click();
    URL.revokeObjectURL(url);
    message.success("Template downloaded");
  };

  // Parse CSV simple parser
  const parseCSV = async (file: RcFile) =>
    new Promise<RowData[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || "");
        try {
          const lines = text.split(/\r\n|\n/).filter(Boolean);
          if (!lines.length) return resolve([]);
          const headers = lines[0]
            .split(",")
            .map((h) => h.trim().toLowerCase());
          const dataLines = lines.slice(1);
          const parsed: RowData[] = dataLines.map((line, idx) => {
            const cols = line.split(",").map((c) => c.trim());
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => {
              obj[h] = cols[i] ?? "";
            });
            return {
              key: `${Date.now()}-${idx}`,
              uniq: obj["uniq"] ?? "",
              part_number: obj["part_number"] ?? "",
              part_name: obj["part_name"] ?? "",
              model: obj["model"] ?? "",
              stock: Number(obj["stock"] ?? 0),
              wo_number: (obj["wo_number"] ?? "").trim() || generateNextWorkOrderNumber(),
              warehouse: obj["warehouse"] ?? "",
            };
          });
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });

  // Handler for Upload component change
  const onUploadChange = async (info: UploadChangeParam<UploadFile>) => {
    const newFileList = info.fileList.slice(-1); // only keep latest
    setFileList(newFileList);

    const latest = info.file;
    const file = latest.originFileObj as RcFile | undefined;
    if (!file) {
      setRows([]);
      return;
    }

    // If CSV, parse. If xlsx/xls, show mock data and notify user to install `xlsx` for real preview.
    if (file.name.toLowerCase().endsWith(".csv")) {
      try {
        const parsed = await parseCSV(file);
        setRows(parsed);
        message.success(`Parsed ${parsed.length} rows from CSV`);
      } catch {
        message.error("Failed to parse CSV file");
        setRows([]);
      }
    } else if (file.name.toLowerCase().match(/\.xlsx?$|\.xls$/)) {
      message.info(
        "Excel upload detected. Preview limited in this demo. Install `xlsx` library for full preview."
      );
      // Provide mock sample rows (replace with real parser when adding sheetjs)
      const sample = Array.from({ length: 4 }).map((_, idx) => ({
        key: `sample-${idx}`,
        uniq: `LV-00${idx + 1}`,
        part_number: "SP-001-A",
        part_name: "Steel Plate",
        model: "Camry 2024",
        stock: 250,
        wo_number: "WO-2024-001",
        warehouse: "WH-FG-202",
      }));
      setRows(sample);
    } else {
      message.warning("Unsupported file type. Please upload CSV or Excel.");
      setRows([]);
    }
  };

  const beforeUpload = (file: RcFile) => {
    // accept csv or xlsx/xls
    const allowed = /\.(csv|xlsx?|xls)$/i.test(file.name);
    if (!allowed) {
      message.error("Only CSV or Excel files are accepted");
    }
    // prevent auto upload by returning false (we handle manually)
    return false;
  };

  // Save action (simulate)
  const handleSave = async () => {
    if (!rows.length) {
      message.warning("No data to save");
      return;
    }
    setLoadingSave(true);
    try {
      // TODO: call API to save rows
      await new Promise((res) => setTimeout(res, 800)); // simulate
      message.success(`Saved ${rows.length} finished goods entries`);
      router.push("/finished-goods");
    } catch {
      message.error("Failed to save data");
    } finally {
      setLoadingSave(false);
    }
  };

  const handleBack = () => {
    router.push("/finished-goods/create");
  };

  const handleModeChange = (e: RadioChangeEvent) => {
    const value = e.target.value as "manual" | "bulk";
    setMode(value);
    if (value === "bulk") {
      // navigate to bulk page (adjust path if you have a different route)
      router.push("/finished-goods/bulk");
    } else {
      // manual: stay on this page (no navigation)
      router.push("/finished-goods/create");
      message.info("Switched to Manual mode");
    }
  };

  return (
    <div className="min-h-screen bg-white pb-32">
      <div
        className="bg-white shadow-sm"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          zIndex: 50,
          padding: "16px 48px",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
            >
              Back to Create
            </Button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <Title level={3} className="!mb-1">
                Finished Goods
              </Title>
              <Text className="text-gray-600">Bulk Upload</Text>
            </div>
          </div>
          <div>
            <Space>
              <Button onClick={handleBack}>Cancel</Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={loadingSave}
              >
                Save Finished Goods
              </Button>
            </Space>
          </div>
        </div>
      </div>

      <div className="p-6 flex flex-1 justify-center items-start mt-20">
        <div className="w-full max-w-6xl space-y-6">
          {/* Step 1 */}
          <Card>
            <Title level={4}>Step 1: Select Your Input Method</Title>
            <Text>
              Choose whether to enter data manually or upload in bulk.
            </Text>
            <div className="mt-4">
              <div>
                <Radio.Group
                  onChange={handleModeChange}
                  value={mode}
                  size="large"
                >
                  <div className=" flex-col pt-7">
                    <Radio value="manual">Manual</Radio>
                    <Radio value="bulk">Bulk Action</Radio>
                  </div>
                </Radio.Group>
              </div>
            </div>
          </Card>

          {/* Step 2 - Upload */}
          <Card className="w-full rounded-xl mt-10 ">
            <div className="flex items-start justify-between ">
              <Title level={4}>Step 2: Input Data</Title>
              <div className="flex flex-col items-end">
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadTemplate}
                  size="large"
                >
                  Download Template
                </Button>
              </div>
            </div>
            <div className="w-full flex flex-col">
              <Text>
                Bulk Upload. You&apos;ve chosen to upload data directly from
                CSV/Excel.
              </Text>
              <div className="mt-4 bg-white w-full">
                <Dragger
                  className="w-full"
                  multiple={false}
                  accept=".csv, .xlsx, .xls"
                  beforeUpload={beforeUpload}
                  customRequest={() => {}}
                  fileList={fileList}
                  onChange={onUploadChange}
                  showUploadList={{ showRemoveIcon: true }}
                  onRemove={() => {
                    setRows([]);
                    setFileList([]);
                  }}
                  style={{
                    width: "100%",
                    maxWidth: "100%",
                    display: "block",
                  }}
                >
                  <p className="ant-upload-drag-icon ">
                    <UploadOutlined className="!text-gray-400 text-3xl" />
                  </p>
                  <Title level={5}>Upload Excel/CSV File</Title>
                  <Text>Drag and drop your file here, or click to browse</Text>
                  <div style={{ marginTop: 12 }}>
                    <Button type="primary" icon={<UploadOutlined />}>
                      Choose File
                    </Button>
                  </div>
                </Dragger>
              </div>
            </div>
          </Card>

          {/* Step 3 - Preview */}
          <Card>
            <Title level={4}>Step 3: Review Uploaded Data</Title>
            <Text>
              Please validate the data from your upload before proceeding.
              Ensure all entries are correct and complete.
            </Text>

            <Divider />

            <div style={{ overflowX: "auto" }}className="w-full">
              <Table<RowData>
                columns={columns}
                dataSource={rows}
                pagination={false}
                rowKey="key"
                locale={{ emptyText: "No uploaded data yet" }}

                

              />
            </div>
          </Card>
        </div>
      </div>

      {/* Footer Summary - Fixed */}
      <div className="p-6 flex flex-1 justify-center items-start ">
        <div className="w-full max-w-6xl space-y-6">
          <Card
            className="mt-6"
            style={{
              borderRadius: 0,
              boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
              margin: 0,
              padding: 0,
            }}
            bodyStyle={{ padding: "16px 48px" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <Text strong>Summary</Text>
                <div>
                  <Text>{entriesCount} Finished Goods ready to be saved</Text>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {entriesCount}
                  </div>
                  <div className="text-sm text-gray-500">Entries</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {completeCount}
                  </div>
                  <div className="text-sm text-gray-500">Complete</div>
                </div>
                <div>
                 
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
