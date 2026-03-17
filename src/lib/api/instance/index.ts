import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { FetchArgs } from "@reduxjs/toolkit/query";

export const getUserLocation = async () => {
  return new Promise<{ latitude: number; longitude: number }>(
    (resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          (error) => {
            reject(error);
          }
        );
      } else {
        reject(new Error("Geolocation is not supported"));
      }
    }
  );
};

export const getCookiesFromBrowser = (cookieName: string): string | null => {
  const cookies = document.cookie.split("; ");
  const targetCookie = cookies.find((cookie) =>
    cookie.startsWith(`${cookieName}=`)
  );

  return targetCookie ? targetCookie.split("=")[1] : null;
};

export const getDeviceInfo = () => {
  return {
    userAgent: navigator.userAgent,
    deviceInfo: navigator.platform,
  };
};

export const generateHeaders = async ({
  useAuthorization = false,
  contentType = "application/json",
}: {
  useAuthorization?: boolean;
  contentType?: "application/json" | "multipart/form-data";
}) => {
  const location = await getUserLocation().catch(() => ({
    latitude: null,
    longitude: null,
  }));
  const deviceInfo = getDeviceInfo();

  const headers: Record<string, string> = {
    "User-Agent": deviceInfo.userAgent,
    "X-Device-Info": deviceInfo.deviceInfo,
    "X-Longitude": location.longitude?.toString() ?? "",
    "X-Latitude": location.latitude?.toString() ?? "",
    "X-Source-System": "web, mobile",
  };

  if (useAuthorization) {
    const token = getCookiesFromBrowser("Authorization");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  if (contentType !== "multipart/form-data") {
    headers["Content-Type"] = contentType;
  }

  return headers;
};

const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL;
export const apiBaseUrl =
  rawBaseUrl && rawBaseUrl !== "undefined" ? rawBaseUrl.replace(/\/+$/, "") : "";

const API_TIMEOUT_MS = 15_000;

export const apiSlice = createApi({
  reducerPath: "api",
  tagTypes: ["MasterSuppliers", "ProductReturns"],
  // Prevent bursty background refetches on tab focus.
  // Keep explicit refetches and normal cache invalidation.
  refetchOnFocus: false,
  baseQuery: async (
    args:
      | string
      | (FetchArgs & {
          meta?: {
            useAuthorization?: boolean;
            contentType?: "application/json" | "multipart/form-data";
          };
        }),
    api,
    extraOptions
  ) => {
    if (!apiBaseUrl) {
      return {
        error: {
          status: "API_BASE_URL_NOT_CONFIGURED",
          error:
            "Missing NEXT_PUBLIC_API_URL. Set it in Cloud Run env vars (or .env.local for dev).",
        },
      } as const;
    }

    const meta = typeof args === "string" ? undefined : args.meta;
    const { useAuthorization = false, contentType = "application/json" } =
      meta || {};

    const headers = await generateHeaders({ useAuthorization, contentType });

    // Backends are commonly mounted behind a reverse proxy at `/api`.
    // Our endpoint definitions typically start with `/api/...`.
    // If `NEXT_PUBLIC_API_URL` already ends with `/api`, avoid generating `/api/api/...`.
    const normalizeUrl = (url: string) => {
      if (!apiBaseUrl.endsWith("/api")) return url;
      if (url === "/api") return "/";
      if (url.startsWith("/api/")) return url.slice("/api".length);
      return url;
    };

    const normalizedArgs = (() => {
      if (typeof args === "string") return normalizeUrl(args);
      if (args && typeof args === "object" && "url" in args) {
        const maybeUrl = (args as { url?: unknown }).url;
        if (typeof maybeUrl === "string") {
          return { ...args, url: normalizeUrl(maybeUrl) };
        }
      }
      return args;
    })();

    const argsForBaseQuery: string | FetchArgs = (() => {
      if (typeof normalizedArgs === "string") return normalizedArgs;
      const rest = { ...normalizedArgs } as FetchArgs & { meta?: unknown };
      delete (rest as { meta?: unknown }).meta;
      return rest;
    })();

    const result = await fetchBaseQuery({
      baseUrl: apiBaseUrl,
      timeout: API_TIMEOUT_MS,
      headers: {
        ...headers,
      },
    })(argsForBaseQuery, api, extraOptions);

    return result;
  },
  endpoints: () => ({}),
});
