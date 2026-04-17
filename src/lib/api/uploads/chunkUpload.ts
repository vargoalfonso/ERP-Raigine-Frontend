import { apiBaseUrl, getCookiesFromBrowser } from "@/lib/api/instance";

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord => Boolean(v) && typeof v === "object";

const pickString = (...values: unknown[]): string => {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

const safeJson = async (res: Response): Promise<unknown> => {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const withAuth = (headers: HeadersInit = {}): HeadersInit => {
  const token = getCookiesFromBrowser("Authorization");
  if (!token) return headers;
  return { ...headers, Authorization: `Bearer ${token}` };
};

export type UploadSession = {
  sessionId: string;
  chunkSize: number;
  raw?: unknown;
};

export type ChunkUploadResult = {
  sessionId: string;
  asset?: string;
  url?: string;
  fileId?: string;
  raw?: unknown;
};

export type CreateUploadSessionArgs = {
  item_id?: string | number;
  asset_type?: string;
  file_name?: string;
  mime_type?: string;
  chunk_size?: number;
};

export const createUploadSession = async (
  file: File,
  args?: CreateUploadSessionArgs
): Promise<UploadSession> => {
  const chunkSize =
    typeof args?.chunk_size === "number" && Number.isFinite(args.chunk_size) && args.chunk_size > 0
      ? args.chunk_size
      : 65536;
  const fileSize = file.size;
  const totalChunks = Math.max(1, Math.ceil(fileSize / chunkSize));

  const body: Record<string, unknown> = {
    file_name: args?.file_name ?? file.name,
    mime_type: args?.mime_type ?? (file.type || "application/octet-stream"),
    file_size: fileSize,
    chunk_size: chunkSize,
    total_chunks: totalChunks,
    asset_type: args?.asset_type ?? "drawing",
  };
  if (args?.item_id !== undefined && args.item_id !== null && String(args.item_id).trim()) {
    const raw = String(args.item_id).trim();
    const asNumber = Number(raw);
    body.item_id = Number.isFinite(asNumber) ? asNumber : raw;
  }

  const res = await fetch(`${apiBaseUrl}/uploads/sessions`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

  const json = await safeJson(res);
  if (!res.ok) {
    throw new Error(
      `Create upload session failed (${res.status}): ${
        typeof json === "string" ? json : ""
      }`
    );
  }

  const data = isRecord(json) && isRecord(json.data) ? json.data : isRecord(json) ? json : null;
  const sessionId = pickString(
    data?.session_id,
    data?.sessionId,
    (data?.data as any)?.session_id,
    (data?.data as any)?.sessionId
  );
  const chunkSizeRaw =
    (data?.chunk_size as unknown) ??
    (data?.chunkSize as unknown) ??
    ((data?.data as any)?.chunk_size as unknown) ??
    ((data?.data as any)?.chunkSize as unknown);
  const effectiveChunkSize =
    typeof chunkSizeRaw === "number" && Number.isFinite(chunkSizeRaw) && chunkSizeRaw > 0
      ? chunkSizeRaw
      : chunkSize;

  if (!sessionId) throw new Error("Upload session id missing from response");

  return { sessionId, chunkSize: effectiveChunkSize, raw: json };
};

export const uploadSessionChunk = async (args: {
  sessionId: string;
  chunkIndex: number;
  chunk: Blob;
  contentType?: string;
}): Promise<void> => {
  const { sessionId, chunkIndex, chunk, contentType } = args;
  const url = `${apiBaseUrl}/uploads/sessions/${encodeURIComponent(sessionId)}/chunks/${chunkIndex}`;
  const headers = withAuth({
    "Content-Type": contentType || "application/octet-stream",
  });

  const tryUpload = async (method: "PUT" | "POST") =>
    fetch(url, {
      method,
      headers,
      body: chunk,
    });

  let res = await tryUpload("PUT");
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await tryUpload("POST");
  }

  if (!res.ok) {
    const json = await safeJson(res);
    throw new Error(
      `Upload chunk failed (${res.status}) at #${chunkIndex}: ${
        typeof json === "string" ? json : ""
      }`
    );
  }
};

export const completeUploadSession = async (args: {
  sessionId: string;
  totalChunks: number;
}): Promise<ChunkUploadResult> => {
  const { sessionId, totalChunks } = args;
  const res = await fetch(
    `${apiBaseUrl}/uploads/sessions/${encodeURIComponent(sessionId)}/complete`,
    {
      method: "POST",
      headers: withAuth({ "Content-Type": "application/json" }),
      body: JSON.stringify({ total_chunks: totalChunks }),
    }
  );

  const json = await safeJson(res);
  if (!res.ok) {
    throw new Error(
      `Complete upload failed (${res.status}): ${
        typeof json === "string" ? json : ""
      }`
    );
  }

  const data = isRecord(json) && isRecord(json.data) ? json.data : isRecord(json) ? json : null;
  const asset = pickString(
    data?.asset,
    data?.file_url,
    data?.url,
    data?.path,
    (data?.data as any)?.asset,
    (data?.data as any)?.file_url,
    (data?.data as any)?.url,
    (data?.data as any)?.path
  );
  const fileId = pickString(data?.file_id, data?.fileId, (data?.data as any)?.file_id);

  return { sessionId, asset: asset || undefined, url: asset || undefined, fileId: fileId || undefined, raw: json };
};

export const uploadFileInChunks = async (
  file: File,
  opts?: { onProgress?: (percent: number) => void; session?: CreateUploadSessionArgs }
) => {
  const chunkSize =
    typeof opts?.session?.chunk_size === "number" &&
    Number.isFinite(opts.session.chunk_size) &&
    opts.session.chunk_size > 0
      ? opts.session.chunk_size
      : 65536;
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
  const sessionArgs = opts?.session ?? {};
  const { sessionId } = await createUploadSession(file, {
    ...sessionArgs,
    chunk_size: sessionArgs.chunk_size ?? chunkSize,
  });
  for (let idx = 0; idx < totalChunks; idx++) {
    const start = idx * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunk = file.slice(start, end);
    await uploadSessionChunk({
      sessionId,
      // Backend contract: 0-based chunk indexing.
      chunkIndex: idx,
      chunk,
      contentType: file.type || "application/octet-stream",
    });
    const percent = Math.round(((idx + 1) / totalChunks) * 100);
    opts?.onProgress?.(percent);
  }

  return completeUploadSession({ sessionId, totalChunks });
};
