"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Modal, Select } from "antd";

type Props = {
  open: boolean;
  title?: React.ReactNode;
  onClose: () => void;
  onScanned: (value: string) => void;
};

type VideoDeviceOption = { label: string; value: string };

export default function ScanQrModal({ open, title, onClose, onScanned }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<VideoDeviceOption[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [starting, setStarting] = useState(false);

  const canScan = useMemo(() => typeof window !== "undefined" && !!navigator?.mediaDevices, []);

  useEffect(() => {
    if (!open) return;

    let stopped = false;
    let stopFn: null | (() => void) = null;

    async function start() {
      setError(null);
      setStarting(true);

      try {
        const mod = await import("@zxing/browser");
        const { BrowserQRCodeReader } = mod;

        // Prompt permissions early so enumerateDevices returns labels.
        const tmpStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        tmpStream.getTracks().forEach((t) => t.stop());

        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        if (stopped) return;

        const videoInputs = mediaDevices
          .filter((d) => d.kind === "videoinput")
          .map((d, idx) => ({
            value: d.deviceId,
            label: d.label || `Camera ${idx + 1}`,
          }));

        setDevices(videoInputs);

        const preferred =
          videoInputs.find((d) => /back|rear|environment/i.test(d.label))?.value ??
          videoInputs[0]?.value;

        const chosen = deviceId ?? preferred;
        setDeviceId(chosen);

        const reader = new BrowserQRCodeReader();

        const videoEl = videoRef.current;
        if (!videoEl) throw new Error("Video element not ready");

        // Start decoding loop.
        const controls = await reader.decodeFromVideoDevice(
          chosen,
          videoEl,
          (result, err) => {
            if (stopped) return;
            if (result) {
              const text = result.getText();
              onScanned(text);
              // Stop camera after success.
              try {
                controls.stop();
              } catch {
                // ignore
              }
              onClose();
            }
            // Ignore NotFoundException spam; show only meaningful errors.
            const errName =
              err instanceof Error
                ? err.name
                : err && typeof err === "object" && "name" in err
                  ? String((err as { name?: unknown }).name ?? "")
                  : "";
            if (err && !errName.includes("NotFound")) {
              // don’t setError continuously
            }
          }
        );

        stopFn = () => {
          try {
            controls.stop();
          } catch {
            // ignore
          }
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to start camera";
        setError(msg);
      } finally {
        setStarting(false);
      }
    }

    start();

    return () => {
      stopped = true;
      if (stopFn) stopFn();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // If user changes camera, restart by closing/opening is simplest.
  // We do a lightweight restart by toggling `open` in parent; here we just keep selection.

  return (
    <Modal
      title={title ?? <span className="text-sm font-semibold">Scan QR</span>}
      open={open}
      onCancel={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button className="!rounded-lg" onClick={onClose}>
            Close
          </Button>
        </div>
      }
      width={720}
    >
      {!canScan ? (
        <Alert type="error" message="Camera scanning is not supported in this browser." />
      ) : (
        <div className="space-y-3">
          {error ? <Alert type="error" message={error} /> : null}

          {devices.length > 1 ? (
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">Camera</div>
              <Select
                value={deviceId}
                onChange={(v) => {
                  setDeviceId(v);
                  // Tell user to re-open for now (keeps implementation stable).
                  setError("Camera changed. Close and open Scan again to apply.");
                }}
                options={devices}
                className="flex-1"
              />
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-black/95 overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-[360px] object-contain"
              muted
              playsInline
              // do not use autoPlay; ZXing manages it
            />
          </div>

          <div className="text-xs text-gray-500">
            {starting ? "Starting camera…" : "Point the camera at the QR code. It will auto-fill after it detects."}
          </div>
        </div>
      )}
    </Modal>
  );
}
