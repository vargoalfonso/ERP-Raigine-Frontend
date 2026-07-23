"use client";

import React from "react";
import { Modal, QRCode, Spin } from "antd";
import { BarcodeOutlined } from "@ant-design/icons";

type Props = {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  title?: string;
  dn: string;
  wo: string;
  packing: string;
  currentQty: number;
  targetQty: number;
  stdQty: number;
  progress: number;
  formatNumber?: (value: number) => string;
};

export default function PackingInfoModal({
  open,
  onClose,
  loading = false,
  title = "Barcode DN / WO / Packing",
  dn,
  wo,
  packing,
  currentQty,
  targetQty,
  stdQty,
  progress,
  formatNumber = (value: number) => value.toLocaleString("en-US"),
}: Props) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} centered title={title}>
      {loading ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-2">
          <QRCode
            value={`DN:${dn} | WO:${wo} | PACKING:${packing}`}
            size={140}
          />

          <div className="w-full rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Qty saat ini</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(currentQty)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-gray-600">Qty seharusnya (packing)</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(targetQty)}
              </span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {progress}% tercapai
              {stdQty > 0
                ? ` \u2022 Standar per packing: ${formatNumber(stdQty)}`
                : ""}
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-3">
            <div>
              <p className="m-0 flex items-center gap-1 text-sm text-gray-400">
                <BarcodeOutlined /> DN Number
              </p>
              <p className="m-0 font-semibold">{dn}</p>
            </div>
            <div>
              <p className="m-0 text-sm text-gray-400">WO Number</p>
              <p className="m-0 font-semibold">{wo}</p>
            </div>
            <div>
              <p className="m-0 flex items-center gap-1 text-sm text-gray-400">
                <BarcodeOutlined /> Packing List
              </p>
              <p className="m-0 font-semibold">{packing}</p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
