"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Input,
  Select,
  Typography,
  Form,
  Card,
  Button,
  InputNumber,
  DatePicker,
  Table,
  message,
  Radio,
} from "antd";
import type { RadioChangeEvent } from "antd";
import type { FormInstance } from "antd";
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  useCreateRawMaterialMutation,
  useUpdateRawMaterialMutation,
  useGetRawMaterialByIdQuery,
} from "@/lib/api/raw-materials/api";
import {
  CreateRawMaterialRequest,
  UpdateRawMaterialRequest,
  StatusStock,
  SaveAs,
} from "@/lib/api/raw-materials/interface";
import { validateRawMaterialData } from "@/lib/api/raw-materials/utils";

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

interface RawMaterialFormData {
  warehouse_id?: string;
  master_list_supplier_id?: string;
  uniq?: string;
  code?: string;
  name?: string;
  category?: string;
  part_name?: string;
  part_no?: string;
  model?: string;
  kanban_quantity?: number;
  total_kanban?: number;
  stock?: number;
  stock_days?: number;
  safety_stock?: number;
  price?: number;
  order_flag?: boolean;
  notes?: string;
  status?: StatusStock;
  is_buyed?: boolean;
  save_as?: SaveAs;
  unit?: string;
  po_reference?: string;
  received_date?: Dayjs;
  batch_number?: string;
  expiry_date?: Dayjs;
  quality_status?: string;
}
interface FormEntry {
  id: number;
  key: string;
  formRef?: React.MutableRefObject<FormInstance | null>;
}

type IndirectMaterialRow = {
  entryId: number;
  uniq?: string;
  category?: string;
  master_list_supplier_id?: string;
  warehouse_id?: string;
  stock?: number;
  unit?: string;
};

// Component untuk render single form
const RawMaterialForm = ({
  entryNumber,
  onFinish,
  onRemove,
  isEditMode,
  showRemove = true,
  initialValues,
  formRef,
}: {
  entryNumber: number;
  onFinish: (values: RawMaterialFormData) => Promise<void>;
  onRemove?: () => void;
  isEditMode: boolean;
  showRemove?: boolean;
  initialValues?: RawMaterialFormData;
  formRef?: React.MutableRefObject<FormInstance | null>;
}) => {
  const [form] = Form.useForm();
  const [mounted, setMounted] = useState(false);

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Set initial values if provided (only once)
  useEffect(() => {
    if (initialValues && mounted) {
      console.log("Setting initial values for form:", initialValues);
      form.setFieldsValue(initialValues);
    }
  }, [mounted]);

  // Expose form instance to parent component
  useEffect(() => {
    if (formRef) {
      formRef.current = form;
    }
  }, [form, formRef]);

  // Don't render on server side to avoid hydration errors
  if (!mounted) {
    return null;
  }

  return (
    <Card>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <Title level={4} className="!mb-0">
            {isEditMode
              ? `Edit Raw Material #${entryNumber}`
              : `Add New Raw Material #${entryNumber}`}
          </Title>
          <div className="flex items-center gap-2">
            <Text className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm">
              Entry {entryNumber}
            </Text>
            {showRemove && (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={onRemove}
                size="small"
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        <p className="text-gray-500">
          {isEditMode
            ? "Update raw material entry information"
            : "Add raw material entry with automatic safety stock calculation"}
        </p>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        {/* Row 1: Uniq, Type, Source, Warehouse */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item
            label="Uniq"
            name="uniq"
            rules={[{ required: true, message: "Please input uniq!" }]}
          >
            <Select placeholder="LV-001" size="large" allowClear>
              <Option value="LV-001">LV-001</Option>
              <Option value="LV-002">LV-002</Option>
              <Option value="LV-003">LV-003</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Raw Material Type"
            name="category"
            rules={[{ required: true, message: "Please select type!" }]}
          >
            <Select placeholder="Sheet Plate" size="large" allowClear>
              <Option value="Metal">Metal</Option>
              <Option value="Sheet Plate">Sheet Plate</Option>
              <Option value="Plastic">Plastic</Option>
              <Option value="Chemical">Chemical</Option>
              <Option value="Electronics">Electronics</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Raw Material Source"
            name="master_list_supplier_id"
            rules={[{ required: true, message: "Please select source!" }]}
          >
            <Select placeholder="Process" size="large" allowClear>
              <Option value="Process">Process</Option>
              <Option value="Direct">Direct</Option>
              <Option value="Supplier">Supplier</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Warehouse Destination"
            name="warehouse_id"
            rules={[{ required: true, message: "Please select warehouse!" }]}
          >
            <Select placeholder="WH-001" size="large" allowClear>
              <Option value="warehouse1">WH-001</Option>
              <Option value="warehouse2">WH-002</Option>
              <Option value="warehouse3">WH-003</Option>
            </Select>
          </Form.Item>
        </div>

        {/* Row 2: Stock, Unit, Weight */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item
            label="Stock"
            name="stock"
            rules={[{ required: true, message: "Please input stock!" }]}
          >
            <InputNumber
              placeholder="1000"
              size="large"
              style={{ width: "100%" }}
              min={0}
            />
          </Form.Item>

          <Form.Item
            label="Unit of Measurement"
            name="unit"
            rules={[{ required: true, message: "Please select unit!" }]}
          >
            <Select placeholder="pcs" size="large" allowClear>
              <Option value="kg">Kilogram (kg)</Option>
              <Option value="g">Gram (g)</Option>
              <Option value="ltr">Liter (ltr)</Option>
              <Option value="pcs">Pieces (pcs)</Option>
              <Option value="m">Meter (m)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Weight"
            name="price"
            tooltip={{ title: "For RM Type: Wire", color: "blue" }}
          >
            <Input placeholder="Weight" size="large" />
            <div >
            <Text type="secondary" className="text-blue-600">
              For RM Type: Wire
            </Text>
          </div>
          </Form.Item>

          
        </div>
      </Form>
    </Card>
  );
};

export default function CreateRawMaterialPage() {
  return (
    <Suspense fallback={null}>
      <CreateRawMaterialPageContent />
    </Suspense>
  );
}

function CreateRawMaterialPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formEntries, setFormEntries] = useState<FormEntry[]>([]);
  const [indirectRows, setIndirectRows] = useState<IndirectMaterialRow[]>([]);

  // Initialize first form entry
  useEffect(() => {
    if (mounted && formEntries.length === 0) {
      setFormEntries([{ id: 1, key: "form-1", formRef: { current: null } }]);
    }
  }, [mounted, formEntries.length]);

  // API hooks
  const [createRawMaterial] = useCreateRawMaterialMutation();
  const [updateRawMaterial] = useUpdateRawMaterialMutation();

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if this is edit mode
  const isEditMode = searchParams.get("mode") === "edit";
  const itemId = searchParams.get("id");

  // Get data for edit mode
  const { data: existingData, isLoading: isLoadingData } =
    useGetRawMaterialByIdQuery(itemId || "", { skip: !isEditMode || !itemId });

  const getInitialValues = (): RawMaterialFormData | undefined => {
    // Return initial values for edit mode
    if (isEditMode && existingData?.data) {
      const data = existingData.data;
      return {
        warehouse_id: data.warehouse_id,
        master_list_supplier_id: data.master_list_supplier_id,
        code: data.code,
        name: data.name,
        category: data.category,
        stock: data.stock,
        unit: data.unit,
        po_reference: data.po_reference,
        received_date: data.received_date
          ? dayjs(data.received_date)
          : undefined,
        expiry_date: data.expiry_date ? dayjs(data.expiry_date) : undefined,
        kanban_quantity: data.kanban_quantity,
        total_kanban: data.total_kanban,
        stock_days: data.stock_days,
        safety_stock: data.safety_stock,
        price: data.price,
        order_flag: data.order_flag,
        notes: data.notes,
        status: data.status,
        is_buyed: data.is_buyed,
        save_as: data.save_as,
        batch_number: data.batch_number,
        quality_status: data.quality_status,
      };
    }
    return undefined;
  };

  const handleSubmitForm = async (values: RawMaterialFormData) => {
    try {
      console.log("handleSubmitForm called with values:", values);
      console.log("isEditMode:", isEditMode);
      console.log("itemId:", itemId);

      // Validate form data - convert Dayjs objects to strings for validation
      const validationData = {
        ...values,
        received_date: values.received_date
          ? values.received_date.format("YYYY-MM-DD")
          : undefined,
        expiry_date: values.expiry_date
          ? values.expiry_date.format("YYYY-MM-DD")
          : undefined,
      };
      const validation = validateRawMaterialData(validationData);
      if (!validation.isValid) {
        message.error(validation.errors.join(", "));
        return;
      }

      if (isEditMode && itemId) {
        // Update existing raw material
        const updateData: UpdateRawMaterialRequest = {
          warehouse_id: values.warehouse_id,
          master_list_supplier_id: values.master_list_supplier_id,
          code: values.code,
          name: values.name,
          category: values.category,
          stock: values.stock,
          price: values.price,
          unit: values.unit,
          po_reference: values.po_reference,
          received_date: values.received_date
            ? dayjs(values.received_date)
            : undefined,
          batch_number: values.batch_number,
          expiry_date: values.expiry_date
            ? dayjs(values.expiry_date)
            : undefined,
          quality_status: values.quality_status,
          notes: values.notes,
          kanban_quantity: values.kanban_quantity,
          total_kanban: values.total_kanban,
          stock_days: values.stock_days,
          safety_stock: values.safety_stock,
          order_flag: values.order_flag,
          status: values.status,
          is_buyed: values.is_buyed,
          save_as: values.save_as,
          updated_by: "current-user-id", // Replace with actual user ID
        };

        console.log("Sending updateData to API:", updateData);
        console.log("Original existingData:", existingData?.data);
        await updateRawMaterial({ id: itemId, body: updateData }).unwrap();
        message.success("Raw material updated successfully!");
      } else {
        // Create new raw material
        const createData: CreateRawMaterialRequest = {
          code: values.code!,
          name: values.name!,
          category: values.category,
          stock: values.stock,
          price: values.price,
          notes: values.notes,
          unit: values.unit,
          po_reference: values.po_reference,
          received_date: values.received_date
            ? dayjs(values.received_date)
            : undefined,
          warehouse_id: values.warehouse_id,
          master_list_supplier_id: values.master_list_supplier_id,
          batch_number: values.batch_number,
          expiry_date: values.expiry_date
            ? dayjs(values.expiry_date)
            : undefined,
          quality_status: values.quality_status,
          // save_as: values.save_as,
          // created_by: "current-user-id",
        };

        await createRawMaterial(createData).unwrap();
        message.success("Raw material created successfully!");
      }

      // Don't navigate immediately - let handleSubmitAll handle navigation
    } catch (error: unknown) {
      // console.error("Error saving raw material:", error);
      message.error(
        (error as { data?: { message?: string } })?.data?.message ||
          "Failed to save raw material"
      );
    }
  };

  const handleAddAnotherEntry = async () => {
    // When user clicks Add, capture current form values into the right-side list
    const currentEntry = formEntries[formEntries.length - 1];
    const currentForm = currentEntry?.formRef?.current;

    if (!currentEntry || !currentForm) {
      message.error("Form is not ready yet");
      return;
    }

    try {
      await currentForm.validateFields();
      const values = currentForm.getFieldsValue() as RawMaterialFormData;

      setIndirectRows((prev) => {
        const nextRow: IndirectMaterialRow = {
          entryId: currentEntry.id,
          uniq: values.uniq,
          category: values.category,
          master_list_supplier_id: values.master_list_supplier_id,
          warehouse_id: values.warehouse_id,
          stock: values.stock,
          unit: values.unit,
        };

        const exists = prev.some((r) => r.entryId === currentEntry.id);
        if (exists) {
          return prev.map((r) => (r.entryId === currentEntry.id ? nextRow : r));
        }
        return [...prev, nextRow];
      });

      const newId = formEntries.length + 1;
      const newFormRef = { current: null };
      setFormEntries((prev) => [
        ...prev,
        { id: newId, key: `form-${newId}`, formRef: newFormRef },
      ]);
    } catch {
      message.error("Please complete required fields before adding");
    }
  };

  const handleRemoveEntry = (entryId: number) => {
    if (formEntries.length > 1) {
      setFormEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    }
  };

  const handleRemoveIndirectRow = (entryId: number) => {
    setIndirectRows((prev) => prev.filter((r) => r.entryId !== entryId));
    // Keep the UI consistent: removing from the right also removes the matching left form.
    setFormEntries((prev) => prev.filter((entry) => entry.id !== entryId));
  };
  const [mode, setMode] = useState<"manual" | "bulk">("manual");

  const handleModeChange = (e: RadioChangeEvent) => {
    const value = e.target.value as "manual" | "bulk";
    setMode(value);
    if (value === "bulk") {
      // Navigate to bulk upload page
      router.push("/raw-materials/bulk");
    } else {
      message.info("Switched to Manual mode");
    }
  };

  const handleSubmitAll = async () => {
    // Get all form data from each form entry
    setLoading(true);
    try {
      console.log("Submitting all forms...");
      console.log("Number of forms to submit:", formEntries.length);

      // Trigger form submission for each form
      for (const entry of formEntries) {
        if (entry.formRef?.current) {
          try {
            // Validate the form first
            await entry.formRef.current.validateFields();

            // Get current form values (this gets the actual current values from the form)
            const values = entry.formRef.current.getFieldsValue();
            console.log(`Form ${entry.id} current form values:`, values);

            // Submit this form's data
            console.log(`Submitting form ${entry.id} with values:`, values);
            await handleSubmitForm(values);
          } catch (validationError) {
            console.error(
              `Validation failed for form ${entry.id}:`,
              validationError
            );
            message.error(
              `Please complete all required fields in form ${entry.id}`
            );
            setLoading(false);
            return;
          }
        }
      }

      // Navigate back to raw materials list after all forms are submitted
      // router.push("/raw-materials");
    } catch (error) {
      console.error("Error submitting forms:", error);
      message.error("Failed to submit forms");
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = isEditMode ? "Edit Raw Material" : "Add Raw Material";
  const breadcrumbText = isEditMode
    ? "Edit Raw Material Database"
    : "Create Raw Material Database";

  // Don't render until mounted to avoid hydration errors
  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 justify-center pb-32">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="border-r border-gray-300">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push("/raw-materials")}
                className="flex items-center gap-2 "
                type="text"
              >
                Back to Raw Material Database
              </Button>
            </div>
            <div className="">
              <Title level={3} className="!mb-0">
                {pageTitle}
              </Title>
              <Text className="text-gray-500">
                {breadcrumbText} • {formEntries.length}{" "}
                {formEntries.length === 1 ? "entry" : "entries"}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => router.push("/raw-materials")}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={loading}
              onClick={handleSubmitAll}
            >
              {isEditMode ? "Update Raw Material" : "Save Raw Material"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* Left: form */}
          <div>
            {/* Mode selection card */}
            <Card className="mb-6">
              <div className=" items-center ">
                <div>
                  <Title level={5} className="!mb-1">
                    Entry Mode
                  </Title>
                  <Text className="text-gray-600">
                    Choose whether to enter data manually or upload in bulk.
                  </Text>
                </div>
                <div>
                  <Radio.Group
                    onChange={handleModeChange}
                    value={mode}
                    size="large"
                  >
                    <div className="flex flex-col-2 pt-7">
                      <Radio value="manual">Manual</Radio>
                      <Radio value="bulk">Bulk Action</Radio>
                    </div>
                  </Radio.Group>
                </div>
              </div>
            </Card>

            {/* Render multiple forms */}
            {formEntries.map((entry, index) => (
              <div
                key={entry.key}
                className={index !== formEntries.length - 1 ? "mb-12" : ""}
              >
                <RawMaterialForm
                  entryNumber={entry.id}
                  onFinish={async () => {}} // Empty async function to prevent auto-submit
                  onRemove={() => handleRemoveEntry(entry.id)}
                  isEditMode={isEditMode}
                  showRemove={formEntries.length > 1}
                  initialValues={index === 0 ? getInitialValues() : undefined}
                  formRef={entry.formRef}
                />
              </div>
            ))}

            {/* Add Another Entry Button (only show in create mode) */}
            {!isEditMode && (
              <div className="text-center my-6">
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  size="large"
                  onClick={handleAddAnotherEntry}
                  className="w-full max-w-md"
                >
                  Add Another Raw Material
                </Button>
              </div>
            )}
          </div>

          {/* Right: Indirect Material Raw */}
          {!isEditMode && (
            <Card className="h-fit">
              <div className="flex items-start justify-between">
                <div>
                  <Title level={5} className="!mb-1">
                    Indirect Material Raw
                  </Title>
                  <Text className="text-gray-500">
                    Added materials will appear here.
                  </Text>
                </div>
                <div className="text-sm text-gray-500">{indirectRows.length} items</div>
              </div>

              <div className="mt-4">
                <Table<IndirectMaterialRow>
                  size="small"
                  pagination={false}
                  rowKey={(r) => String(r.entryId)}
                  dataSource={indirectRows}
                  locale={{ emptyText: "No materials added" }}
                  columns={[
                    {
                      title: "Uniq",
                      dataIndex: "uniq",
                      key: "uniq",
                      width: 110,
                      render: (v: string | undefined) => (
                        <span className="font-mono text-xs">{v ?? "-"}</span>
                      ),
                    },
                    {
                      title: "Type",
                      dataIndex: "category",
                      key: "category",
                      width: 120,
                      render: (v: string | undefined) => (
                        <span className="text-xs">{v ?? "-"}</span>
                      ),
                    },
                    {
                      title: "Stock",
                      dataIndex: "stock",
                      key: "stock",
                      width: 90,
                      render: (v: number | undefined, r: IndirectMaterialRow) => (
                        <span className="text-xs">{typeof v === "number" ? `${v} ${r.unit ?? ""}` : "-"}</span>
                      ),
                    },
                    {
                      title: "",
                      key: "action",
                      width: 50,
                      render: (_: unknown, r: IndirectMaterialRow) => (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                          onClick={() => handleRemoveIndirectRow(r.entryId)}
                        />
                      ),
                    },
                  ]}
                />
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Footer Summary - Fixed Position */}
      <Card
        className="mt-6"
        style={{
          position: "fixed",
          left: 0,
          bottom: 0,
          width: "100vw",
          maxWidth: "100vw",
          zIndex: 50,
          borderRadius: 0,
          boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
          margin: 0,
          padding: 0,
        }}
        styles={{ body: { padding: "16px 48px" } }}
      >
        <div className="flex items-center justify-between">
          <div>
            <Title level={5} className="!mb-1">
              Summary
            </Title>
            <Text className="text-gray-600">
              {formEntries.length} Raw Material Entry ready to be saved
            </Text>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formEntries.length}
              </div>
              <div className="text-sm text-gray-500">Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">0</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
