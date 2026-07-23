"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Button, Modal } from "antd";
import type { ButtonProps } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { openPrintCard, type PrintCardOptions } from "@/lib/utils/printCard";

/**
 * A row-action button (typically a barcode/QR icon) that first opens an in-app
 * detail popup showing the item's information. The user can then click
 * "Print" inside the popup to open the standardized print card window.
 *
 * Provide either `options` (sync) or `loadOptions` (async, e.g. when a QR code
 * must be generated on demand before showing the preview).
 */
export type PrintButtonProps = {
  options?: PrintCardOptions;
  loadOptions?: () => Promise<PrintCardOptions | null | undefined>;
  icon?: ReactNode;
  title?: string;
  className?: string;
  size?: ButtonProps["size"];
  type?: ButtonProps["type"];
};

const formatValue = (value: PrintCardOptions["fields"][number]["value"]) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

export default function PrintButton({
  options,
  loadOptions,
  icon,
  title,
  className,
  size,
  type,
}: PrintButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<PrintCardOptions | null>(null);

  const handleClick = async (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (loadOptions) {
      setLoading(true);
      try {
        const opts = await loadOptions();
        if (opts) {
          setCurrent(opts);
          setOpen(true);
        }
      } catch {
        // errors are surfaced by the caller
      } finally {
        setLoading(false);
      }
      return;
    }
    if (options) {
      setCurrent(options);
      setOpen(true);
    }
  };

  return (
    <>
      <Button
        type={type}
        size={size}
        className={className}
        icon={icon ?? <PrinterOutlined />}
        title={title}
        loading={loading}
        onClick={handleClick}
      />
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        centered
        title={current?.documentTitle ?? "Detail"}
      >
        {current ? (
          <div className="pt-1">
            <div className="text-center text-lg font-extrabold tracking-wide">
              {current.heading}
            </div>
            {current.subheading ? (
              <div className="text-center text-xs text-gray-500 mb-3">
                {current.subheading}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 mb-1">
              {current.fields.map((f, i) => (
                <div key={i} className={f.full ? "col-span-2" : ""}>
                  <div className="text-[11px] text-gray-500">{f.label}</div>
                  <div className="text-sm font-semibold break-words">
                    {formatValue(f.value)}
                  </div>
                </div>
              ))}
            </div>

            {current.progress ? (
              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Qty saat ini</span>
                  <span className="font-semibold text-gray-900">
                    {current.progress.currentQty.toLocaleString("en-US")}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Qty seharusnya (packing)
                  </span>
                  <span className="font-semibold text-gray-900">
                    {current.progress.targetQty.toLocaleString("en-US")}
                  </span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${current.progress.percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {current.progress.percent}% tercapai
                  {current.progress.stdQty && current.progress.stdQty > 0
                    ? ` \u2022 Standar per packing: ${current.progress.stdQty.toLocaleString("en-US")}`
                    : ""}
                </p>
              </div>
            ) : null}

            {current.deliveryNotes?.length ? (
              <div className="mt-4">
                <div className="text-sm font-semibold mb-2">
                  Delivery Note History
                </div>

                <table className="w-full border border-gray-200 border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-200 p-2 text-left">
                        DN Number
                      </th>
                      <th className="border border-gray-200 p-2 text-left">
                        Packing Number
                      </th>
                      <th className="border border-gray-200 p-2 text-center">
                        Qty
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {current.deliveryNotes.map((dn, index) => (
                      <tr key={index}>
                        <td className="border border-gray-200 p-2">
                          {dn.dn_number}
                        </td>
                        <td className="border border-gray-200 p-2">
                          {dn.packing_number}
                        </td>
                        <td className="border border-gray-200 p-2 text-center">
                          {dn.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {current.qrDataUrl ? (
              <>
                <div className="h-px bg-gray-200 my-3" />
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.qrDataUrl}
                    alt="QR"
                    className="w-40 h-40 object-contain"
                  />
                </div>
              </>
            ) : null}
            {current.bottomCode ? (
              <div className="text-center text-xs font-semibold mt-2">
                {current.bottomCode}
              </div>
            ) : null}
            <div className="flex justify-end gap-2 mt-5">
              <Button onClick={() => setOpen(false)}>Close</Button>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={() => openPrintCard(current)}
              >
                Print
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
