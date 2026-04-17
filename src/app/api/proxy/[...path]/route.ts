import { NextRequest } from "next/server";

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const getTargetBaseUrl = () => {
  const candidates = [
    process.env.API_PROXY_TARGET,
    process.env.NEXT_PUBLIC_API_PROXY_TARGET,
    process.env.API_URL,
    process.env.BACKEND_URL,
    process.env.NEXT_PUBLIC_BACKEND_URL,
    // Last resort: allow NEXT_PUBLIC_API_URL only when it's an absolute URL (not /api/proxy)
    process.env.NEXT_PUBLIC_API_URL,
  ];

  for (const c of candidates) {
    const raw = (c ?? "").trim();
    if (!raw) continue;
    if (!isAbsoluteHttpUrl(raw)) continue;
    return raw.replace(/\/$/, "");
  }

  return "";
};

const buildTargetUrl = (req: NextRequest, pathSegments: string[]) => {
  const base = getTargetBaseUrl();
  if (!base) {
    throw new Error(
      "Proxy target is not configured. Set API_PROXY_TARGET (server env) to your backend base URL, e.g. https://api.example.com"
    );
  }

  const joined = pathSegments.map((s) => encodeURIComponent(s)).join("/");
  const search = req.nextUrl.search;
  return `${base}/${joined}${search}`;
};

const buildForwardHeaders = (req: NextRequest) => {
  const headers = new Headers();

  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (hopByHopHeaders.has(k)) return;
    headers.set(key, value);
  });

  // Ensure we don't confuse backend about origin.
  headers.delete("origin");
  headers.delete("referer");

  return headers;
};

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  let targetUrl = "";
  try {
    targetUrl = buildTargetUrl(req, path);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Proxy configuration error";
    return new Response(JSON.stringify({ message: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = buildForwardHeaders(req);

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
    redirect: "manual",
    body: hasBody ? await req.arrayBuffer() : undefined,
  };

  const upstream = await fetch(targetUrl, init);

  const resHeaders = new Headers(upstream.headers);
  // Avoid leaking backend CORS headers; not needed for same-origin.
  resHeaders.delete("access-control-allow-origin");
  resHeaders.delete("access-control-allow-credentials");
  resHeaders.delete("access-control-allow-headers");
  resHeaders.delete("access-control-allow-methods");

  // Dev-only debug headers to help diagnose upstream 404s.
  if (process.env.NODE_ENV !== "production") {
    resHeaders.set("x-proxy-target", targetUrl);
    resHeaders.set("x-proxy-upstream-status", String(upstream.status));
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

export const OPTIONS = async () =>
  new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    },
  });
