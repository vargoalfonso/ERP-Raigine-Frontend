"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Input,
  Select,
  Typography,
  Form,
  Card,
  Button,
  InputNumber,
  DatePicker,
  message,
  Radio,
} from "antd";
import type { FormInstance } from "antd";
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { Dayjs } from "dayjs";

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

interface FinishedGoodsFormData {
  product_uniq?: string;
  part_name?: string;
  work_order_reference?: string;
  batch_number?: string;
  quantity_produced?: number;
  quality_status?: string;
  storage_location?: string;
  production_completion_date?: Dayjs;
  production_operator?: string;
  quality_inspector?: string;
  unit_cost?: number;
  production_notes?: string;
}

interface FormEntry {
  id: number;
  key: string;
  formRef?: React.MutableRefObject<FormInstance | null>;
}

// Component untuk render single form
const FinishedGoodsForm = ({
  entryNumber,
  onFinish,
  onRemove,
  showRemove = true,
  initialValues,
  formRef,
}: {
  entryNumber: number;
  onFinish: (values: FinishedGoodsFormData) => Promise<void>;
  onRemove?: () => void;
  showRemove?: boolean;
  initialValues?: FinishedGoodsFormData;
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
  }, [mounted, form, initialValues]);

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
            Add New Finished Goods #${entryNumber}
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
          Add finished goods entry with automatic data population from
          production scan
        </p>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Form.Item
            name="product_uniq"
            label="Product UNIQ"
            rules={[{ required: true, message: "Please enter product UNIQ" }]}
          >
            <Input placeholder="LV7-001" size="large" className="rounded-lg" />
          </Form.Item>

          <Form.Item
            name="part_name"
            label="Part Name"
            rules={[{ required: true, message: "Please enter part name" }]}
          >
            <Input
              placeholder="Engine Mount Assembly"
              size="large"
              className="rounded-lg"
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Form.Item
            name="work_order_reference"
            label="Work Order Reference"
            rules={[
              {
                required: true,
                message: "Please enter work order reference",
              },
            ]}
          >
            <Input
              placeholder="WO-2024-001"
              size="large"
              className="rounded-lg"
            />
          </Form.Item>

          <Form.Item
            name="batch_number"
            label="Batch Number"
            rules={[{ required: true, message: "Please enter batch number" }]}
          >
            <Input
              placeholder="BATCH-20241215-001"
              size="large"
              className="rounded-lg"
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Form.Item
            name="quantity_produced"
            label="Quantity Produced"
            rules={[
              { required: true, message: "Please enter quantity produced" },
            ]}
          >
            <InputNumber
              placeholder="500"
              size="large"
              style={{ width: "100%" }}
              className="w-full rounded-lg"
              min={0}
            />
          </Form.Item>

          <Form.Item
            name="quality_status"
            label="Quality Status"
            rules={[
              { required: true, message: "Please select quality status" },
            ]}
          >
            <Select
              placeholder="Select Status"
              size="large"
              className="rounded-lg"
            >
              <Option value="pass">Pass</Option>
              <Option value="fail">Fail</Option>
              <Option value="pending">Pending</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="storage_location"
            label="Storage Location"
            rules={[
              { required: true, message: "Please select storage location" },
            ]}
          >
            <Select
              placeholder="Select Location"
              size="large"
              className="rounded-lg"
            >
              <Option value="warehouse1">Warehouse 1</Option>
              <Option value="warehouse2">Warehouse 2</Option>
              <Option value="warehouse3">Warehouse 3</Option>
            </Select>
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Form.Item
            name="production_completion_date"
            label="Production Completion Date"
            rules={[
              { required: true, message: "Please select completion date" },
            ]}
          >
            <DatePicker
              size="large"
              className="w-full rounded-lg"
              format="YYYY-MM-DD"
            />
          </Form.Item>

          <Form.Item
            name="production_operator"
            label="Production Operator"
            rules={[
              {
                required: true,
                message: "Please select production operator",
              },
            ]}
          >
            <Select
              placeholder="Select Operator"
              size="large"
              className="rounded-lg"
            >
              <Option value="operator1">Operator 1</Option>
              <Option value="operator2">Operator 2</Option>
              <Option value="operator3">Operator 3</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="quality_inspector"
            label="Quality Inspector"
            rules={[
              { required: true, message: "Please select quality inspector" },
            ]}
          >
            <Select
              placeholder="Select Inspector"
              size="large"
              className="rounded-lg"
            >
              <Option value="inspector1">Inspector 1</Option>
              <Option value="inspector2">Inspector 2</Option>
              <Option value="inspector3">Inspector 3</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="unit_cost"
            label="Unit Cost (IDR)"
            rules={[{ required: true, message: "Please enter unit cost" }]}
          >
            <InputNumber
              placeholder="125000.00"
              size="large"
              className="w-full rounded-lg"
              style={{ width: "100%" }}
              min={0}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
            />
          </Form.Item>
        </div>

        <Form.Item
          name="production_notes"
          label="Production Notes & Quality Remarks"
        >
          <TextArea
            placeholder="Production notes, quality inspection results, defects found, special observations..."
            rows={4}
            className="rounded-lg"
          />
        </Form.Item>
      </Form>

      <form action="">
        <TextArea
          placeholder="Production notes, quality inspection results, defects found, special observations..."
          rows={4}
          className="rounded-lg"
        />
      </form>
    </Card>
  );
};

// Main component
export default function CreateFinishedGoodsPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formEntries, setFormEntries] = useState<FormEntry[]>([
    { id: 1, key: "form-1", formRef: { current: null } },
  ]);

  // New state: mode = "manual" | "bulk"
  const [mode, setMode] = useState<"manual" | "bulk">("manual");

  const handleAddAnotherEntry = () => {
    const newId = Math.max(...formEntries.map((entry) => entry.id)) + 1;
    const newEntry: FormEntry = {
      id: newId,
      key: `form-${newId}`,
      formRef: { current: null },
    };
    setFormEntries([...formEntries, newEntry]);
  };

  const handleRemoveEntry = (id: number) => {
    if (formEntries.length > 1) {
      setFormEntries(formEntries.filter((entry) => entry.id !== id));
    }
  };

  const validateAllForms = async (): Promise<FinishedGoodsFormData[]> => {
    const validatedData: FinishedGoodsFormData[] = [];

    for (const entry of formEntries) {
      if (entry.formRef?.current) {
        try {
          const values = await entry.formRef.current.validateFields();
          validatedData.push(values);
        } catch (error) {
          message.error(`Please complete Entry ${entry.id} before submitting`);
          throw error;
        }
      }
    }

    return validatedData;
  };

  const handleSubmitAll = async () => {
    try {
      setIsSubmitting(true);
      const allFormData = await validateAllForms();

      console.log("All form data:", allFormData);

      message.success(
        `Successfully created ${allFormData.length} finished goods entries!`
      );

      // Navigate back to finished goods list
      router.push("/finished-goods");
    } catch {
      message.error("Failed to submit. Please check your data and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/finished-goods");
  };

  // Handler for mode change
  const handleModeChange = (e: any) => {
    const value = e.target.value as "manual" | "bulk";
    setMode(value);
    if (value === "bulk") {
      // navigate to bulk page (adjust path if you have a different route)
      router.push("/finished-goods/bulk");
    } else {
      // manual: stay on this page (no navigation)
      message.info("Switched to Manual mode");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header - Fixed Position */}
      <div
        className="bg-white shadow-sm "
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
              onClick={handleCancel}
              className="flex items-center gap-2"
            >
              Back to Finished Goods
            </Button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <Title level={3} className="!mb-1">
                Create Finished Goods
              </Title>
              <Text className="text-gray-600">
                Add new finished goods entries to the inventory system
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button size="large" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSubmitAll}
              loading={isSubmitting}
              className="flex items-center gap-2"
            >
              Save All Entries
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-1 justify-center items-start mt-20">
        <div className="w-full max-w-6xl">
          {/* NEW: Mode selection card */}
          <Card className="mb-6">
            <div className=" items-center justify-between">
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
                  <div className=" flex-col pt-7">
                    <Radio value="manual" >Manual</Radio>
                    <Radio value="bulk" >Bulk Action</Radio>
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
              <FinishedGoodsForm
                entryNumber={entry.id}
                onFinish={async () => {}} // Empty async function to prevent auto-submit
                onRemove={() => handleRemoveEntry(entry.id)}
                showRemove={formEntries.length > 1}
                formRef={entry.formRef}
              />
            </div>
          ))}

          {/* Add Another Entry Button */}
          <div className="text-center my-6">
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              size="large"
              onClick={handleAddAnotherEntry}
              className="w-full max-w-md"
            >
              Add Another Finished Goods
            </Button>
          </div>
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
              {formEntries.length} Finished Goods Entry ready to be saved
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
