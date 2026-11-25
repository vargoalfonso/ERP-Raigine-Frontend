"use client";

import { Card, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import {
  type BomUsageRow,
  useGetBomUsageQuery,
} from "@/lib/api/supplier-items/api";

type Props = {
  /** Uniq (child part) yang sedang dipilih / akan didaftarkan ke supplier. */
  uniqCodes: string[];
  className?: string;
};

const MAX_CODES = 200;

/**
 * Traceability: menampilkan FG / parent tempat tiap uniq dipakai pada BOM
 * current, supaya saat mengisi Master Supplier terlihat part ini dipakai di
 * produk mana. Data murni turunan dari BOM (read-only), tidak ada input baru.
 */
export default function BomUsagePanel({ uniqCodes, className }: Props) {
  const codes = useMemo(
    () =>
      Array.from(
        new Set(uniqCodes.map((c) => c.trim()).filter((c) => c.length > 0)),
      ).slice(0, MAX_CODES),
    [uniqCodes],
  );

  const { data = [], isFetching, isError } = useGetBomUsageQuery(
    { uniq_codes: codes.join(",") },
    { skip: codes.length === 0 },
  );

  const fgCount = useMemo(
    () => new Set(data.filter((r) => r.level > 0).map((r) => r.fg_uniq_code)).size,
    [data],
  );

  const columns: ColumnsType<BomUsageRow> = [
    {
      title: "Uniq (Child Part)",
      dataIndex: "child_uniq_code",
      key: "child",
      render: (value: string, row) => (
        <div>
          <div className="font-semibold">{value}</div>
          <div className="text-xs text-gray-500">{row.child_part_name ?? ""}</div>
        </div>
      ),
    },
    {
      title: "Parent langsung",
      key: "parent",
      render: (_: unknown, row) =>
        row.level === 0 ? (
          <Tag color="blue">FG / root BOM</Tag>
        ) : row.parent_uniq_code ? (
          <div>
            <div>{row.parent_uniq_code}</div>
            <div className="text-xs text-gray-500">
              {row.parent_part_name ?? ""}
            </div>
          </div>
        ) : (
          "-"
        ),
    },
    {
      title: "FG Uniq",
      dataIndex: "fg_uniq_code",
      key: "fg",
      render: (value: string) => <span className="font-semibold">{value}</span>,
    },
    {
      title: "FG Part No",
      dataIndex: "fg_part_number",
      key: "fg_pn",
      render: (value?: string | null) => value || "-",
    },
    {
      title: "FG Part Name",
      dataIndex: "fg_part_name",
      key: "fg_name",
      render: (value?: string | null) => value || "-",
    },
    {
      title: "Model",
      dataIndex: "fg_model",
      key: "model",
      render: (value?: string | null) => value || "-",
    },
    {
      title: "Lvl",
      dataIndex: "level",
      key: "level",
      width: 56,
      align: "center",
    },
    {
      title: "QPU",
      dataIndex: "qty_per_uniq",
      key: "qpu",
      width: 80,
      align: "right",
      render: (value: number) =>
        Number.isFinite(value) ? Number(value.toFixed(4)) : "-",
    },
  ];

  return (
    <Card
      className={`rounded-2xl border border-[#dfe8f5] shadow-sm ${className ?? ""}`}
    >
      <div className="mb-4">
        <Typography.Title level={5} className="!mb-1">
          FG / Child Part (Traceability)
        </Typography.Title>
        <Typography.Text type="secondary">
          Produk (FG) yang memakai uniq ini pada BOM aktif. Data diambil otomatis
          dari BOM.
        </Typography.Text>
      </div>

      {codes.length === 0 ? (
        <Typography.Text type="secondary">
          Pilih uniq / material terlebih dahulu untuk melihat FG yang memakainya.
        </Typography.Text>
      ) : isError ? (
        <Typography.Text type="danger">
          Gagal memuat data penggunaan BOM.
        </Typography.Text>
      ) : (
        <>
          <Table<BomUsageRow>
            size="small"
            loading={isFetching}
            columns={columns}
            dataSource={data}
            rowKey={(row, idx) =>
              `${row.child_uniq_code}|${row.fg_uniq_code}|${row.parent_uniq_code ?? ""}|${row.level}|${idx ?? 0}`
            }
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: "max-content" }}
            locale={{
              emptyText:
                "Uniq ini belum dipakai di BOM aktif manapun (tidak ada FG terkait).",
            }}
          />
          {data.length > 0 ? (
            <div className="mt-2 text-xs text-gray-500">
              {codes.length} uniq dipakai di {fgCount} FG
              {data.some((r) => r.level === 0)
                ? " (termasuk uniq yang merupakan FG itu sendiri)"
                : ""}
              .
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
