"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Spin, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  useGetQcDashboardProductionQcDetailQuery,
  type QcDashboardProductionQcIssue,
} from "@/lib/api/qc-dashboard/api";

const statusColor = (status: string) => {
  const s = status.toLowerCase();
  if (s === "passed") return "green";
  if (s === "not_passed") return "red";
  return "default";
};

const sourceLabel = (source: string) => {
  switch (source) {
    case "ng_reason":
      return "Reason NG (Round 3)";
    case "scrap_reason":
      return "Reason Scrap (Round 3)";
    case "issue":
      return "Issue (Round 1-2)";
    case "process":
      return "Defect Process";
    case "scrap":
      return "Scrap";
    default:
      return source || "-";
  }
};

const issueQty = (r: QcDashboardProductionQcIssue) =>
  r.qty || r.qty_defect || r.qty_scrap || 0;

export default function ProductionQcDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params?.qcLogId)
    ? params?.qcLogId[0]
    : params?.qcLogId;
  const qcLogId = Number(rawId);

  const { data, isLoading, isError, error } =
    useGetQcDashboardProductionQcDetailQuery(qcLogId, {
      skip: !Number.isFinite(qcLogId) || qcLogId <= 0,
    });

  const item = data?.data?.item;
  const issues = item?.issues ?? [];

  const columns: ColumnsType<QcDashboardProductionQcIssue> = [
    {
      title: "Sumber",
      dataIndex: "source",
      key: "source",
      render: (v) => sourceLabel(String(v ?? "")),
    },
    {
      title: "Issue / Reason",
      key: "reason",
      render: (_v, r) => r.reason_text || r.reason_code || "-",
    },
    {
      title: "Qty",
      key: "qty",
      align: "right",
      render: (_v, r) => issueQty(r),
    },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          Kembali
        </Button>
        <h1 className="m-0 text-lg font-semibold">Detail Production QC</h1>
      </div>

      {isError ? (
        <Alert
          type="error"
          showIcon
          message="Gagal memuat detail Production QC"
          description={String((error as { message?: string })?.message ?? "")}
          className="mb-4"
        />
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spin />
        </div>
      ) : item ? (
        <div className="space-y-4">
          <Card>
            <Descriptions
              column={{ xs: 1, sm: 2, lg: 3 }}
              size="small"
              title="Ringkasan"
            >
              <Descriptions.Item label="Report Date">
                {item.report_date || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="WO Number">
                {item.wo_number || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="UNIQ">
                {item.uniq_code || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Kanban">
                {item.kanban_number || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Items Checked">
                {item.items_checked}
              </Descriptions.Item>
              <Descriptions.Item label="Defect">
                {item.qty_defect}
              </Descriptions.Item>
              <Descriptions.Item label="Scrap">
                {item.qty_scrap}
              </Descriptions.Item>
              <Descriptions.Item label="Quality %">
                {item.quality_rate_percent}%
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColor(String(item.status ?? ""))}>
                  {item.status || "-"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={
              <div className="flex items-center gap-2">
                <span>Issue (if any)</span>
                {issues.length > 0 ? (
                  <Tooltip
                    title={
                      <div className="space-y-1">
                        {issues.map((it, i) => (
                          <div key={i}>
                            {sourceLabel(it.source)}
                            {it.reason_text ? `: ${it.reason_text}` : ""} (Qty:{" "}
                            {issueQty(it)})
                          </div>
                        ))}
                      </div>
                    }
                  >
                    <Tag className="cursor-help" color="orange">
                      {issues.length} item — hover
                    </Tag>
                  </Tooltip>
                ) : (
                  <Tag>0 item</Tag>
                )}
              </div>
            }
          >
            {issues.length > 0 ? (
              <Table
                rowKey={(_r, idx) => String(idx)}
                columns={columns}
                dataSource={issues}
                pagination={false}
                size="small"
              />
            ) : (
              <div className="text-sm text-gray-500">
                Tidak ada Issue/Reason yang diinput pada round ini.
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Alert type="info" showIcon message="Data tidak ditemukan" />
      )}
    </div>
  );
}
