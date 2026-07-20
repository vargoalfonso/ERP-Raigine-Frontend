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
