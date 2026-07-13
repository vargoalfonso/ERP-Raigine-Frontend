"use client";

import React, { useMemo } from "react";
import { Alert, Button, Card, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  useDeleteProductReturnMutation,
  useGetProductReturnDetailQuery,
  useUpdateProductReturnMutation,
} from "@/lib/api/product-return/api";
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

  const detailQuery = useGetProductReturnDetailQuery(id);
  const [updateProductReturn, { isLoading: decisionLoading }] =
    useUpdateProductReturnMutation();
  const [deleteProductReturn, { isLoading: deleteLoading }] =
    useDeleteProductReturnMutation();

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
      if (typeof c === "string" && c.trim() && Number.isFinite(Number(c)))
        return Number(c);
    }
    return 0;
  };

  const status = useMemo(() => {
    const raw = pickStr(record?.status);
    const v = raw.toUpperCase();
    if (v.includes("APPROV")) return "APPROVED";
    if (v.includes("REJECT")) return "REJECTED";
    if (v.includes("REWORK")) return "REWORK_WO_CREATED";
    if (v.includes("PENDING")) return "PENDING";
    return v || "PENDING";
  }, [record?.status]);

  const statusLabel = useMemo(() => {
    if (status === "APPROVED") return "QC Approved";
    if (status === "REJECTED") return "Rejected";
    if (status === "REWORK_WO_CREATED") return "Rework Created";
    if (status === "PENDING") return "Pending QC";
    return status;
  }, [status]);

  const summary = useMemo(
    () => ({
      returnId:
        pickStr(
          record?.return_id,
          record?.returnId,
          record?.id,
          record?.uuid,
        ) || id,
      date: (() => {
        const d = pickStr(
          record?.date,
          record?.date_received,
          record?.dateReceived,
          record?.created_at,
          record?.createdAt,
        );
        return d && d.length >= 10 ? d.slice(0, 10) : d || "-";
      })(),
      uniq: pickStr(record?.uniq, record?.uniq_id, record?.uniqId) || "-",
      dnNumber: pickStr(record?.dn_number, record?.dnNumber) || "-",
      scrapQty: `${pickNum(record?.quantity_scrap, record?.scrap_qty, record?.scrapQty, record?.scrap_quantity)} Pcs`,
      reworkQty: `${pickNum(record?.quantity_rework, record?.rework_qty, record?.reworkQty, record?.rework_quantity)} Pcs`,
      scrapType:
        pickStr(record?.scrap_type, record?.scrapType) || "Product Return",
      weight:
        `${pickNum(record?.weight)} ${pickStr(record?.uom, record?.unit)}`.trim(),
      uom: pickStr(record?.uom, record?.unit) || "-",
      status: statusLabel,
    }),
    [id, record, statusLabel],
  );

  const rows = useMemo<LineRow[]>(
    () => [
      { key: "1", field: "Return ID", value: summary.returnId },
      { key: "2", field: "Date Received", value: summary.date },
      { key: "3", field: "Uniq", value: summary.uniq },
      { key: "4", field: "DN Number", value: summary.dnNumber },
      { key: "5", field: "Scrap Type", value: summary.scrapType },
      { key: "6", field: "Scrap Qty", value: summary.scrapQty },
      { key: "7", field: "Weight", value: summary.weight },
      { key: "8", field: "UOM", value: summary.uom },
      { key: "9", field: "Rework Qty", value: summary.reworkQty },
      { key: "10", field: "Status", value: summary.status },
    ],
    [summary],
  );

  const columns = useMemo<ColumnsType<LineRow>>(
    () => [
      { title: "Field", dataIndex: "field", key: "field", width: 200 },
      { title: "Value", dataIndex: "value", key: "value" },
    ],
    [],
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button
              className="!rounded-lg"
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push("/product-return")}
            >
              Back
            </Button>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                Product Return
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Detail for {summary.returnId}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "PENDING" ? (
            <>
              <Button
                className="!rounded-lg !border-green-200 !text-green-700"
                loading={decisionLoading}
                onClick={() => {
                  const uniq = pickStr(
                    record?.uniq,
                    record?.uniq_id,
                    record?.uniqId,
                  );
                  const dnNumber = pickStr(record?.dn_number, record?.dnNumber);
                  if (!uniq || !dnNumber) {
                    message.error("Missing uniq or DN number");
                    return;
                  }

                  updateProductReturn({
                    id,
                    body: {
                      uniq,
                      dn_number: dnNumber,
                      quantity_scrap: pickNum(
                        record?.quantity_scrap,
                        record?.scrap_qty,
                        record?.scrapQty,
                        record?.scrap_quantity,
                      ),
                      quantity_rework: pickNum(
                        record?.quantity_rework,
                        record?.rework_qty,
                        record?.reworkQty,
                        record?.rework_quantity,
                      ),
                      status: "APPROVED",
                      date_received:
                        pickStr(
                          record?.date_received,
                          record?.dateReceived,
                          record?.date,
                        ) || undefined,
                      scrap_type:
                        pickStr(record?.scrap_type, record?.scrapType) ||
                        "Product Return",
                      weight: pickNum(record?.weight),
                      uom: pickStr(record?.uom, record?.unit) || undefined,
                    },
                  })
                    .unwrap()
                    .then(() => {
                      message.success("Approved");
                      router.push("/product-return");
                    })
                    .catch((e) =>
                      message.error(getApiErrorMessage(e, "Failed to approve")),
                    );
                }}
              >
                ✓ Approve
              </Button>
              <Button
                danger
                className="!rounded-lg"
                loading={decisionLoading}
                onClick={() => {
                  const uniq = pickStr(
                    record?.uniq,
                    record?.uniq_id,
                    record?.uniqId,
                  );
                  const dnNumber = pickStr(record?.dn_number, record?.dnNumber);
                  if (!uniq || !dnNumber) {
                    message.error("Missing uniq or DN number");
                    return;
                  }

                  updateProductReturn({
                    id,
                    body: {
                      uniq,
                      dn_number: dnNumber,
                      quantity_scrap: pickNum(
                        record?.quantity_scrap,
                        record?.scrap_qty,
                        record?.scrapQty,
                        record?.scrap_quantity,
                      ),
                      quantity_rework: pickNum(
                        record?.quantity_rework,
                        record?.rework_qty,
                        record?.reworkQty,
                        record?.rework_quantity,
                      ),
                      status: "REJECTED",
                      date_received:
                        pickStr(
                          record?.date_received,
                          record?.dateReceived,
                          record?.date,
                        ) || undefined,
                      scrap_type:
                        pickStr(record?.scrap_type, record?.scrapType) ||
                        "Product Return",
                      weight: pickNum(record?.weight),
                      uom: pickStr(record?.uom, record?.unit) || undefined,
                    },
                  })
                    .unwrap()
                    .then(() => {
                      message.success("Rejected");
                      router.push("/product-return");
                    })
                    .catch((e) =>
                      message.error(getApiErrorMessage(e, "Failed to reject")),
                    );
                }}
              >
                × Reject
              </Button>
            </>
          ) : null}

          <Button
            danger
            className="!rounded-lg"
            loading={deleteLoading}
            onClick={() => {
              deleteProductReturn(id)
                .unwrap()
                .then(() => {
                  message.success("Deleted");
                  router.push("/product-return");
                })
                .catch((e) =>
                  message.error(getApiErrorMessage(e, "Failed to delete")),
                );
            }}
          >
            Delete
          </Button>

          <Tag
            color={
              statusLabel === "QC Approved"
                ? "green"
                : statusLabel === "Pending QC"
                  ? "gold"
                  : statusLabel === "Rework Created"
                    ? "blue"
                    : "red"
            }
            className="!rounded-full !px-3 !py-0.5 !text-xs !font-semibold"
          >
            {statusLabel}
          </Tag>
        </div>
      </div>

      {detailQuery.error ? (
        <div className="mb-4">
          <Alert
            type="error"
            showIcon
            message={getApiErrorMessage(
              detailQuery.error,
              "Failed to load detail",
            )}
            className="!rounded-xl"
          />
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
