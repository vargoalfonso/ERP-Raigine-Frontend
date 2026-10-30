"use client";

import { Button, Tooltip } from "antd";
import { DownloadOutlined } from "@ant-design/icons";

type Props = {
  onClick: () => void;
  /** True bila filter tanggal aktif -> export mencakup seluruh data pada rentang tersebut. */
  hasDateRange: boolean;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Tombol export Excel yang mengikuti filter tanggal pada halaman inventory. */
export default function ExportExcelButton({
  onClick,
  hasDateRange,
  loading,
  disabled,
  className,
}: Props) {
  return (
    <Tooltip
      title={
        hasDateRange
          ? "Export semua data pada rentang tanggal yang dipilih"
          : "Export data yang sedang ditampilkan. Pilih rentang tanggal untuk export semua data pada periode tertentu."
      }
    >
      <Button
        icon={<DownloadOutlined />}
        onClick={onClick}
        loading={loading}
        disabled={disabled}
        className={className}
      >
        {hasDateRange ? "Export by Date" : "Export"}
      </Button>
    </Tooltip>
  );
}
