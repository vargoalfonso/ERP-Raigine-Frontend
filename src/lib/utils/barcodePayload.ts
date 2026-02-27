export type DnBarcodeVersion = 1;

export type DnHeaderBarcodePayload = {
  v: DnBarcodeVersion;
  t: "dn";
  dnNumber: string;
  period?: string;
  supplier?: string;
  totalPo?: number;
  totalIncoming?: number;
  dnCreated?: number;
  dnIncoming?: number;
};

export type DnItemBarcodePayload = {
  v: DnBarcodeVersion;
  t: "dnItem";
  dnNumber: string;
  uniq: string;
  materialInfo?: {
    code?: string;
    name?: string;
    model?: string;
  };
  totalQty?: number;
  remainingQty?: number;
  uom?: string;
  orderQty?: number;
  packingNumber?: string;
  pcsPerKanban?: number;
  dateIncoming?: string; // ISO or display string
};

export type BarcodePayload = DnHeaderBarcodePayload | DnItemBarcodePayload;

const PREFIX = "MRP-ERP";
const VERSION = 1;

function base64UrlEncode(text: string): string {
  // btoa/atob expect latin1; wrap for unicode safety.
  const b64 = btoa(unescape(encodeURIComponent(text)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(base64url: string): string {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(padLen);
  const text = atob(padded);
  return decodeURIComponent(escape(text));
}

export function encodeBarcodePayload(payload: BarcodePayload): string {
  const json = JSON.stringify(payload);
  return `${PREFIX}:${VERSION}:${base64UrlEncode(json)}`;
}

export type DecodeBarcodeResult =
  | { ok: true; payload: BarcodePayload; raw: string }
  | { ok: false; error: string; raw: string };

export function decodeBarcodePayload(raw: string): DecodeBarcodeResult {
  const input = (raw ?? "").trim();
  if (!input) return { ok: false, error: "Empty barcode", raw: raw ?? "" };

  // Accept raw JSON too.
  if (input.startsWith("{") && input.endsWith("}")) {
    try {
      const parsed = JSON.parse(input) as unknown;
      return coercePayload(parsed, raw);
    } catch {
      return { ok: false, error: "Invalid JSON barcode", raw };
    }
  }

  const parts = input.split(":");
  if (parts.length >= 3 && parts[0] === PREFIX) {
    const versionStr = parts[1];
    const dataPart = parts.slice(2).join(":");

    if (versionStr !== String(VERSION)) {
      return { ok: false, error: `Unsupported barcode version: ${versionStr}`, raw };
    }

    try {
      const json = base64UrlDecode(dataPart);
      const parsed = JSON.parse(json) as unknown;
      return coercePayload(parsed, raw);
    } catch {
      return { ok: false, error: "Invalid barcode payload", raw };
    }
  }

  // Fallback: if someone scans a plain UNIQ or DN number.
  // Heuristic: LV-xxx => treat as dnItem uniq.
  if (/^[A-Za-z]{2}-\d{3,}$/.test(input)) {
    const payload: DnItemBarcodePayload = { v: VERSION, t: "dnItem", dnNumber: "", uniq: input };
    return { ok: true, payload, raw };
  }

  // Heuristic: DN-xxx => treat as dn header.
  if (/^DN-/.test(input)) {
    const payload: DnHeaderBarcodePayload = { v: VERSION, t: "dn", dnNumber: input };
    return { ok: true, payload, raw };
  }

  return { ok: false, error: "Unrecognized barcode format", raw };
}

function coercePayload(parsed: unknown, raw: string): DecodeBarcodeResult {
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "Barcode payload is not an object", raw };

  const p = parsed as Record<string, unknown>;
  if (p.v !== VERSION) return { ok: false, error: "Unsupported barcode version", raw };
  if (p.t !== "dn" && p.t !== "dnItem") return { ok: false, error: "Unsupported barcode type", raw };

  if (p.t === "dn") {
    if (typeof p.dnNumber !== "string" || !p.dnNumber) return { ok: false, error: "Missing dnNumber", raw };
    return { ok: true, payload: p as DnHeaderBarcodePayload, raw };
  }

  if (typeof p.dnNumber !== "string") return { ok: false, error: "Missing dnNumber", raw };
  if (typeof p.uniq !== "string" || !p.uniq) return { ok: false, error: "Missing uniq", raw };
  return { ok: true, payload: p as DnItemBarcodePayload, raw };
}
