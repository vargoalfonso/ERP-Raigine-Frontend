"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Divider,
  InputNumber,
  Modal,
  Radio,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type {
  RcFile,
  UploadChangeParam,
  UploadFile,
} from "antd/es/upload/interface";

import { useBulkCreateFinishedGoodsMutation } from "@/lib/api/finished-goods/api";
import { useListWarehousesQuery } from "@/lib/api/warehouse/api";
import {
  buildRows,
  decodeCsvBuffer,
  findDuplicateGroups,
  mergeDuplicates,
  parseDelimited,
  validateRow,
  type Cell,
  type DuplicateMode,
  type UploadRow,
} from "@/lib/api/raw-materials/bulkUpload";

const { Title, Text } = Typography;
const { Dragger } = Upload;

const ACCEPTED = /\.(csv|xlsx|xls)$/i;

export default function BulkFinishedGoodsPage() {
  const router = useRouter();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dupMode, setDupMode] = useState<DuplicateMode | undefined>(undefined);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [mode, setMode] = useState<"manual" | "bulk">("bulk");

  const [bulkCreate, { isLoading: saving }] = useBulkCreateFinishedGoodsMutation();
  const { data: warehouseData, isSuccess: warehousesLoaded } =
    useListWarehousesQuery(undefined);

  // Finished-goods warehouses only (same rule as the manual create form).
  // null = list not available / no FG warehouse found, so the check is skipped.
  const warehouseNames = useMemo(() => {
    if (!warehousesLoaded) return null;
    const map = new Map<string, string>();
    for (const w of warehouseData ?? []) {
      const rec = w as unknown as Record<string, unknown>;
      const type = String(rec.type_warehouse ?? "").trim().toLowerCase();
      if (type && !type.includes("finished") && !type.includes("fg")) continue;
      const name = String(rec.warehouse_name ?? "").trim();
      if (name) map.set(name.toLowerCase(), name);
    }
    return map.size ? map : null;
  }, [warehouseData, warehousesLoaded]);

  const issuesOf = useCallback(
    (r: UploadRow): string[] => {
      const list = [...r.errors];
      if (
        warehouseNames &&
        r.warehouse &&
        !warehouseNames.has(r.warehouse.toLowerCase())
      ) {
        list.push(`Warehouse "${r.warehouse}" is not a finished goods warehouse`);
      }
      return list;
    },
    [warehouseNames],
  );

  // ---- derived state ------------------------------------------------------
  const dupGroups = useMemo(() => findDuplicateGroups(rows), [rows]);
  const dupKeys = useMemo(
    () => new Set(Array.from(dupGroups.values()).flat().map((r) => r.key)),
    [dupGroups],
  );
  const problemRows = useMemo(
    () => rows.filter((r) => issuesOf(r).length > 0),
    [rows, issuesOf],
  );
  const needsDupChoice = dupGroups.size > 0 && dupMode === undefined;
  const finalRows = useMemo(
    () => (needsDupChoice ? [] : mergeDuplicates(rows, dupMode ?? "sum")),
    [rows, dupMode, needsDupChoice],
  );
  const totalStock = useMemo(
    () => finalRows.reduce((sum, r) => sum + (r.stock ?? 0), 0),
    [finalRows],
  );
  const extraDupRows = useMemo(
    () =>
      Array.from(dupGroups.values()).reduce((s, list) => s + list.length - 1, 0),
    [dupGroups],
  );
  const canSave =
    rows.length > 0 && problemRows.length === 0 && !needsDupChoice && !saving;

  const tableData = useMemo(
    () =>
      onlyProblems
        ? rows.filter((r) => dupKeys.has(r.key) || issuesOf(r).length > 0)
        : rows,
    [onlyProblems, rows, dupKeys, issuesOf],
  );

  // ---- table --------------------------------------------------------------
  const handleStockChange = (key: string, value: number | null) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = {
          ...r,
          stock: value,
          stock_raw: value === null ? "" : String(value),
        };
        return { ...next, errors: validateRow(next) };
      }),
    );
  };

  const columns: ColumnsType<UploadRow> = [
    { title: "Row", dataIndex: "line", key: "line", width: 64 },
    { title: "Uniq", dataIndex: "uniq", key: "uniq" },
    {
      title: "Part Number",
      dataIndex: "part_number",
      key: "part_number",
      render: (v: string) => v || "-",
    },
    { title: "Part Name", dataIndex: "part_name", key: "part_name" },
    {
      title: "Model",
      dataIndex: "model",
      key: "model",
      render: (v: string) => v || "-",
    },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      render: (value: number | null, record) => (
        <InputNumber
          min={0}
          value={value}
          status={value === null ? "error" : undefined}
          onChange={(v) => handleStockChange(record.key, v)}
        />
      ),
    },
    {
      title: "WO Number",
      dataIndex: "wo_number",
      key: "wo_number",
      render: (v: string) => v || "-",
    },
    { title: "Warehouse", dataIndex: "warehouse", key: "warehouse" },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, record) => {
        const issues = issuesOf(record);
        const isDup = dupKeys.has(record.key);
        if (!issues.length && !isDup) return <Tag color="success">OK</Tag>;
        return (
          <Space size={[0, 4]} wrap>
            {issues.map((text) => (
              <Tag key={text} color="error">
                {text}
              </Tag>
            ))}
            {isDup && <Tag color="warning">Duplicate uniq</Tag>}
          </Space>
        );
      },
    },
  ];

  // ---- template -----------------------------------------------------------
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
      "0W3",
      "95512-23020",
      "EDGE WIRE",
      "660/650A",
      "800",
      "WO-2024-001",
      "FG-WH-MRP3",
    ];
    // BOM so Excel opens the file as UTF-8 (keeps "Ø").
    const csv = "\uFEFF" + [header.join(";"), sample.join(";")].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finished_goods_template.csv";
    a.click();
    URL.revokeObjectURL(url);
    message.success("Template downloaded");
  };

  // ---- file handling ------------------------------------------------------
  const readMatrix = async (file: File): Promise<Cell[][]> => {
    const buffer = await file.arrayBuffer();
    if (/\.csv$/i.test(file.name)) {
      return parseDelimited(decodeCsvBuffer(buffer));
    }
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Cell[]>(sheet, {
      header: 1,
      raw: true,
      defval: "",
    });
  };

  const resetData = () => {
    setRows([]);
    setParseError(null);
    setDupMode(undefined);
    setOnlyProblems(false);
  };

  const onUploadChange = async (info: UploadChangeParam<UploadFile>) => {
    setFileList(info.fileList.slice(-1));
    const file = (info.file.originFileObj ?? info.file) as unknown as File;
    if (!(file instanceof Blob) || info.file.status === "removed") return;

    resetData();
    try {
      const { rows: parsed, missingColumns } = buildRows(await readMatrix(file));
      if (missingColumns.length) {
        setParseError(
          `Required column(s) not found: ${missingColumns.join(", ")}. ` +
            `Expected header: uniq, part_number, part_name, model, stock, wo_number, warehouse.`,
        );
        return;
      }
      if (!parsed.length) {
        setParseError("The file has no data rows.");
        return;
      }
      setRows(parsed);
      message.success(`Read ${parsed.length} rows`);
    } catch {
      setParseError("Failed to read the file. Please check the format.");
    }
  };

  const beforeUpload = (file: RcFile) => {
    if (!ACCEPTED.test(file.name)) {
      message.error("Only CSV or Excel files are accepted");
      return Upload.LIST_IGNORE;
    }
    return false; // we read the file ourselves, no auto upload
  };

  // ---- save ---------------------------------------------------------------
  const doImport = async () => {
    const items = finalRows.map((r) => ({
      uniq_code: r.uniq,
      warehouse_location:
        warehouseNames?.get(r.warehouse.toLowerCase()) ?? r.warehouse,
      stock_qty: r.stock ?? 0,
      wo_number: r.wo_number || undefined,
      // Used by the backend only when the part info can't be found from the
      // latest work order / master item.
      part_number: r.part_number || undefined,
      part_name: r.part_name || undefined,
      model: r.model || undefined,
    }));
    try {
      const res = await bulkCreate({ items }).unwrap();
      const failedRows = res.results.filter((x) => x.status === "failed");
      if (!failedRows.length) {
        message.success(`Imported ${res.created} finished goods`);
        router.push("/finished-goods");
        return;
      }
      Modal.warning({
        title: `${res.created} imported, ${res.failed} failed`,
        width: 560,
        okText: res.created > 0 ? "Go to Finished Goods" : "Close",
        content: (
          <div className="space-y-2">
            <div>These rows were not saved:</div>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {failedRows.slice(0, 50).map((x) => (
                <div key={`${x.index}-${x.uniq_code}`}>
                  <b>{x.uniq_code}</b>: {x.error ?? "unknown error"}
                </div>
              ))}
              {failedRows.length > 50 && (
                <div>…and {failedRows.length - 50} more</div>
              )}
            </div>
          </div>
        ),
        onOk: () => {
          if (res.created > 0) router.push("/finished-goods");
        },
      });
    } catch (error: unknown) {
      message.error(
        (error as { data?: { message?: string } })?.data?.message ||
          "Failed to import finished goods",
      );
    }
  };

  const handleSave = () => {
    if (!canSave) return;
    Modal.confirm({
      title: "Import to Finished Goods Inventory?",
      width: 520,
      okText: "Import",
      content: (
        <div className="space-y-2">
          <div>
            <b>{finalRows.length}</b> items, total stock{" "}
            <b>{totalStock.toLocaleString("id-ID")}</b>.
          </div>
          <Alert
            type="warning"
            showIcon
            message="If a uniq already exists in Finished Goods, its stock is REPLACED by the stock in this file (not added), and its warehouse and WO number are updated. Rows with stock 0 set the stock to 0."
          />
        </div>
      ),
      onOk: doImport,
    });
  };

  const handleBack = () => router.push("/finished-goods/create");

  const handleModeChange = (value: "manual" | "bulk") => {
    setMode(value);
    if (value === "manual") router.push("/finished-goods/create");
  };

  const dupPreview = Array.from(dupGroups.entries()).slice(0, 6);

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
          <Space>
            <Button onClick={handleBack}>Cancel</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!canSave}
            >
              Save Finished Goods
            </Button>
          </Space>
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
              <Radio.Group
                onChange={(e) => handleModeChange(e.target.value)}
                value={mode}
                size="large"
              >
                <div className="flex-col pt-7">
                  <Radio value="manual">Manual</Radio>
                  <Radio value="bulk">Bulk Action</Radio>
                </div>
              </Radio.Group>
            </div>
          </Card>

          {/* Step 2 */}
          <Card className="w-full rounded-xl mt-10">
            <div className="flex items-start justify-between">
              <Title level={4}>Step 2: Input Data</Title>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
                size="large"
              >
                Download Template
              </Button>
            </div>
            <div className="w-full flex flex-col">
              <Text>
                Upload a CSV (comma, semicolon or tab separated) or Excel file
                with the columns: uniq, part_number, part_name, model, stock,
                wo_number, warehouse.
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
                    resetData();
                    setFileList([]);
                  }}
                  style={{ width: "100%", maxWidth: "100%", display: "block" }}
                >
                  <p className="ant-upload-drag-icon">
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

          {/* Step 3 */}
          <Card>
            <Title level={4}>Step 3: Review Uploaded Data</Title>
            <Text>
              Please validate the data before saving. A Part Number / Model of
              &quot;0&quot; is treated as empty. Part Number, Part Name and
              Model are taken from the latest work order or master item first;
              the values in your file are used only when those are not found.
              A WO Number in the file overrides the latest work order.
            </Text>

            <div className="mt-4 space-y-3">
              {parseError && <Alert type="error" showIcon message={parseError} />}

              {problemRows.length > 0 && (
                <Alert
                  type="error"
                  showIcon
                  message={`${problemRows.length} row(s) have problems and must be fixed before saving.`}
                  description="Fix them in your file and upload again (Stock can also be edited directly in the table)."
                />
              )}

              {dupGroups.size > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message={`${dupGroups.size} uniq code(s) appear more than once (${extraDupRows} extra rows).`}
                  description={
                    <div className="space-y-2">
                      <div>
                        Inventory keeps one row per uniq, so the repeated rows
                        must be combined. Choose how to combine their stock:
                      </div>
                      <Radio.Group
                        value={dupMode}
                        onChange={(e) => setDupMode(e.target.value)}
                      >
                        <Space direction="vertical">
                          <Radio value="sum">Add up the stock of all rows</Radio>
                          <Radio value="max">
                            Keep the largest stock only (use if the rows are
                            repeated copies)
                          </Radio>
                        </Space>
                      </Radio.Group>
                      <div className="text-gray-600">
                        {dupPreview.map(([uniq, list]) => (
                          <div key={uniq}>
                            {uniq}: {list.map((r) => r.stock ?? "?").join(", ")}
                          </div>
                        ))}
                        {dupGroups.size > dupPreview.length && (
                          <div>…and {dupGroups.size - dupPreview.length} more</div>
                        )}
                      </div>
                    </div>
                  }
                />
              )}
            </div>

            <Divider />

            <div className="mb-3">
              <Checkbox
                checked={onlyProblems}
                onChange={(e) => setOnlyProblems(e.target.checked)}
              >
                Show only rows with problems or duplicates
              </Checkbox>
            </div>

            <div style={{ overflowX: "auto" }} className="w-full">
              <Table<UploadRow>
                columns={columns}
                dataSource={tableData}
                rowKey="key"
                pagination={{ pageSize: 50, showSizeChanger: true }}
                locale={{ emptyText: "No uploaded data yet" }}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Summary */}
      <div className="p-6 flex flex-1 justify-center items-start">
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
                  <Text>
                    {needsDupChoice
                      ? "Choose how to combine duplicate uniq codes to continue"
                      : `${finalRows.length} Finished Goods ready to be saved`}
                  </Text>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {rows.length}
                  </div>
                  <div className="text-sm text-gray-500">Rows in file</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {needsDupChoice ? "-" : finalRows.length}
                  </div>
                  <div className="text-sm text-gray-500">Unique items</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700">
                    {needsDupChoice ? "-" : totalStock.toLocaleString("id-ID")}
                  </div>
                  <div className="text-sm text-gray-500">Total stock</div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-2xl font-bold ${
                      problemRows.length ? "text-red-600" : "text-gray-400"
                    }`}
                  >
                    {problemRows.length}
                  </div>
                  <div className="text-sm text-gray-500">Problems</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
