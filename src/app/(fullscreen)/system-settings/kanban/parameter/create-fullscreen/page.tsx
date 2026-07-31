"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Form, InputNumber, Select, Table, Tag, message } from "antd";

import { useGetBomListQuery } from "@/lib/api/bom/api";
import { getApiErrorMessage } from "@/lib/api/error";
import { useCreateKanbanStandardMutation } from "@/lib/api/system-settings/api";

type KanbanRow = {
  uniq: string;
  partName: string;
  kanbanQty: number;
  isParent: boolean;
};

// Recursively collect a node and all its descendants into a flat list.
function collectRows(node: any, isParent: boolean): KanbanRow[] {
  const result: KanbanRow[] = [];
  const uniq = String(node?.uniq_code ?? node?.uniq ?? "").trim();
  const partName = typeof node?.part_name === "string" ? node.part_name : "";
  if (uniq) result.push({ uniq, partName, kanbanQty: 0, isParent });
  if (Array.isArray(node?.children)) {
    for (const child of node.children) {
      result.push(...collectRows(child, false));
    }
  }
  return result;
}

export default function KanbanParameterCreateFullscreenPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [rows, setRows] = useState<KanbanRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const { data: bomListApiData, isLoading: isBomLoading } = useGetBomListQuery(
    { page: 1, limit: 1000 },
    { skip: !apiEnabled },
  );
  const [createKanbanStandard] = useCreateKanbanStandardMutation();

  // Normalize BOM tree data into a top-level array of parent nodes.
  const bomTreeNodes = useMemo<any[]>(() => {
    const raw = (bomListApiData as any)?.data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object") return [raw];
    return [];
  }, [bomListApiData]);

  // Dropdown: only top-level (parent) BOM nodes.
  const parentOptions = useMemo(() => {
    return bomTreeNodes
      .map((n: any) => {
        const uniq = String(n?.uniq_code ?? n?.uniq ?? "").trim();
        const partName = typeof n?.part_name === "string" ? n.part_name : "";
        return {
          value: uniq,
          label: partName ? `${uniq} — ${partName}` : uniq,
        };
      })
      .filter((o) => Boolean(o.value))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [bomTreeNodes]);

  // Watch the selected parent field.
  const selectedParentUniq = Form.useWatch("parent_uniq", form) as string | undefined;

  // When parent selection changes → rebuild the rows list.
  useEffect(() => {
    if (!selectedParentUniq) {
      setRows([]);
      return;
    }
    const parentNode = bomTreeNodes.find(
      (n: any) => String(n?.uniq_code ?? n?.uniq ?? "").trim() === selectedParentUniq,
    );
    if (!parentNode) {
      setRows([]);
      return;
    }
    setRows(collectRows(parentNode, true));
  }, [selectedParentUniq, bomTreeNodes]);

  const updateQty = (uniq: string, qty: number) => {
    setRows((prev) =>
      prev.map((r) => (r.uniq === uniq ? { ...r, kanbanQty: qty } : r)),
    );
  };

  const onSubmit = async () => {
    if (!rows.length) {
      message.warning("Pilih parent BOM terlebih dahulu");
      return;
    }
    const invalidRow = rows.find((r) => !r.kanbanQty || r.kanbanQty <= 0);
    if (invalidRow) {
      message.error(`Kanban Qty untuk "${invalidRow.uniq}" wajib diisi (> 0)`);
      return;
    }

    setSubmitting(true);
    try {
      let successCount = 0;
      const errors: string[] = [];
      for (const row of rows) {
        try {
          await createKanbanStandard({
            item_uniq_code: row.uniq,
            item_name: row.partName || row.uniq,
            kanban_qty: row.kanbanQty,
            min_stock: 0,
            max_stock: 0,
          }).unwrap();
          successCount++;
        } catch (err) {
          errors.push(`${row.uniq}: ${getApiErrorMessage(err, "error")}`);
        }
      }

      if (errors.length === 0) {
        message.success(`${successCount} kanban parameter berhasil dibuat`);
        router.push("/system-settings");
      } else if (successCount > 0) {
        message.warning(
          `${successCount} berhasil, ${errors.length} gagal: ${errors.join("; ")}`,
        );
      } else {
        message.error(`Semua gagal: ${errors.join("; ")}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: "UNIQ Code",
      dataIndex: "uniq",
      key: "uniq",
      width: 180,
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
      render: (v: string) => v || "-",
    },
    {
      title: "Type",
      key: "type",
      width: 90,
      render: (_: unknown, row: KanbanRow) =>
        row.isParent ? (
          <Tag color="blue">Parent</Tag>
        ) : (
          <Tag color="default">Child</Tag>
        ),
    },
    {
      title: "Kanban Qty *",
      key: "kanbanQty",
      width: 170,
      render: (_: unknown, row: KanbanRow) => (
        <InputNumber
          min={1}
          value={row.kanbanQty > 0 ? row.kanbanQty : undefined}
          placeholder="Wajib diisi"
          onChange={(v) => updateQty(row.uniq, Number(v ?? 0))}
          className="w-full"
        />
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 90,
      render: () => <Tag color="green">ACTIVE</Tag>,
    },
  ];

  return (
    <div className="min-h-screen bg-[#EEF5FF] p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <Card className="rounded-2xl shadow-sm" style={{ padding: 20 }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                Create Kanban Parameter
              </div>
              <div className="text-sm text-gray-500">
                Pilih parent BOM — parent &amp; child otomatis muncul, isi Kanban
                Qty lalu simpan sekaligus
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="!rounded-lg"
                onClick={() => router.push("/system-settings")}
              >
                Back
              </Button>
              <Button
                type="primary"
                className="!rounded-lg"
                loading={submitting}
                disabled={!rows.length}
                onClick={onSubmit}
              >
                Save All{rows.length > 0 ? ` (${rows.length} item)` : ""}
              </Button>
            </div>
          </div>
        </Card>

        {/* Form + table */}
        <Card className="rounded-2xl shadow-sm" style={{ padding: 20 }}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="parent_uniq"
              label="Parent BOM UNIQ"
              rules={[{ required: true, message: "Pilih parent BOM" }]}
            >
              <Select
                showSearch
                loading={isBomLoading}
                placeholder="Pilih parent BOM…"
                options={parentOptions}
                optionFilterProp="label"
                filterOption={(input, opt) =>
                  String(opt?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                className="!rounded-lg"
                style={{ maxWidth: 480 }}
              />
            </Form.Item>
          </Form>

          {rows.length > 0 && (
            <>
              <div className="mb-3 text-sm text-gray-500">
                {rows.length} item ditemukan ({rows.filter((r) => r.isParent).length} parent,{" "}
                {rows.filter((r) => !r.isParent).length} child). Isi Kanban Qty
                untuk setiap item lalu klik <strong>Save All</strong>.
              </div>
              <Table<KanbanRow>
                dataSource={rows}
                columns={columns}
                rowKey="uniq"
                pagination={false}
                size="middle"
                bordered
                rowClassName={(row) =>
                  row.isParent ? "bg-blue-50" : ""
                }
              />
            </>
          )}

          {!rows.length && selectedParentUniq && !isBomLoading && (
            <div className="text-center text-gray-400 py-8">
              BOM node tidak ditemukan untuk UNIQ ini.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
