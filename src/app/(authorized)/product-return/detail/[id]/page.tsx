"use client";

import React, { useMemo } from "react";
import { Alert, Button, Card, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useDecideProductReturnMutation, useGetProductReturnByIdQuery } from "@/lib/api/product-return/api";
import { getApiErrorMessage } from "@/lib/api/error";

type LineRow = {
  key: string;
  field: string;
  value: string;
};

export default function ProductReturnDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);

  const detailQuery = useGetProductReturnByIdQuery(id);
  const [decideProductReturn, { isLoading: decisionLoading }] = useDecideProductReturnMutation();

  const record = detailQuery.data?.data;

  const pickStr = (...candidates: unknown[]): string => {
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c;
    }
    return "";
  };
  const pickNum = (...candidates: unknown[]): number => {
    for (const c of candidates) {
      if (typeof c === "number" && Number.isFinite(c)) return c;
      if (typeof c === "string" && c.trim() && Number.isFinite(Number(c))) return Number(c);
    }
    return 0;
  };

  const status = useMemo(() => {
    const raw = pickStr(record?.status);
    const v = raw.toLowerCase();
    if (v.includes("approve")) return "QC Approved";
    if (v.includes("reject")) return "Rejected";
    if (v.includes("rework")) return "Rework Created";
    return "Pending QC";
  }, [record?.status]);

  const summary = useMemo(
    () => ({
      returnId: pickStr(record?.return_id, record?.returnId, record?.id, record?.uuid) || id,
      date: (() => {
        const d = pickStr(record?.date, record?.date_received, record?.dateReceived, record?.created_at, record?.createdAt);
        return d && d.length >= 10 ? d.slice(0, 10) : d || "-";
      })(),
      partNo: pickStr(record?.part_no, record?.partNo, record?.part_number, record?.partNumber) || "-",
      partName: pickStr(record?.part_name, record?.partName) || "-",
      kanban: pickStr(record?.kanban) || "-",
      scrapQty: `${pickNum(record?.quantity_scrap, record?.scrap_qty, record?.scrapQty, record?.scrap_quantity)} Pcs`,
      reworkQty: `${pickNum(record?.quantity_rework, record?.rework_qty, record?.reworkQty, record?.rework_quantity)} Pcs`,
      submittedBy: pickStr(record?.submitted_by, record?.submittedBy) || "-",
    }),
    [id, record]
  );

  const rows = useMemo<LineRow[]>(
    () => [
      { key: "1", field: "Return ID", value: summary.returnId },
      { key: "2", field: "Date", value: summary.date },
      { key: "3", field: "Part No", value: summary.partNo },
      { key: "4", field: "Part Name", value: summary.partName },
      { key: "5", field: "Kanban", value: summary.kanban },
      { key: "6", field: "Scrap Qty", value: summary.scrapQty },
      { key: "7", field: "Rework Qty", value: summary.reworkQty },
      { key: "8", field: "Submitted By", value: summary.submittedBy },
    ],
    [summary]
  );

  const columns = useMemo<ColumnsType<LineRow>>(
    () => [
      { title: "Field", dataIndex: "field", key: "field", width: 200 },
      { title: "Value", dataIndex: "value", key: "value" },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button className="!rounded-lg" icon={<ArrowLeftOutlined />} onClick={() => router.push("/product-return")}>
              Back
            </Button>
            <div>
              <div className="text-2xl font-bold text-gray-900">Product Return</div>
              <div className="text-sm text-gray-500 mt-1">Detail for {summary.returnId}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "Pending QC" ? (
            <>
              <Button
                className="!rounded-lg !border-green-200 !text-green-700"
                loading={decisionLoading}
                onClick={() => {
                  decideProductReturn({ id, decision: "approve" })
                    .unwrap()
                    .then(() => {
                      message.success("Approved");
                      router.push("/product-return");
                    })
                    .catch((e) => message.error(getApiErrorMessage(e, "Failed to approve")));
                }}
              >
                ✓ Approve
              </Button>
              <Button
                danger
                className="!rounded-lg"
                loading={decisionLoading}
                onClick={() => {
                  decideProductReturn({ id, decision: "reject" })
                    .unwrap()
                    .then(() => {
                      message.success("Rejected");
                      router.push("/product-return");
                    })
                    .catch((e) => message.error(getApiErrorMessage(e, "Failed to reject")));
                }}
              >
                × Reject
              </Button>
            </>
          ) : null}

          <Tag
            color={status === "QC Approved" ? "green" : status === "Pending QC" ? "gold" : status === "Rework Created" ? "blue" : "red"}
            className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
          >
            {status}
          </Tag>
        </div>
      </div>

      {detailQuery.error ? (
        <div className="mb-4">
          <Alert type="error" showIcon message={getApiErrorMessage(detailQuery.error, "Failed to load detail")} className="!rounded-xl" />
        </div>
      ) : null}

      <Card className="!rounded-xl" bordered>
        <Table<LineRow>
          dataSource={rows}
          columns={columns}
          rowKey="key"
          pagination={false}
          size="middle"
          loading={detailQuery.isFetching}
        />
      </Card>
    </div>
  );
}
