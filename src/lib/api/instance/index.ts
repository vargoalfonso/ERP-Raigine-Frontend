import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

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
    "X-Longitude": location.latitude?.toString() ?? "",
    "X-Latitude": location.longitude?.toString() ?? "",
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
export const apiBaseUrl = rawBaseUrl && rawBaseUrl !== "undefined" ? rawBaseUrl : "";

const API_TIMEOUT_MS = 15_000;

export const apiSlice = createApi({
  reducerPath: "api",
  tagTypes: ["MasterSuppliers"],
  // Prevent bursty background refetches on tab focus.
  // Keep explicit refetches and normal cache invalidation.
  refetchOnFocus: false,
  baseQuery: async (args, api, extraOptions) => {
    if (!apiBaseUrl) {
      return {
        error: {
          status: "API_BASE_URL_NOT_CONFIGURED",
          error:
            "Missing NEXT_PUBLIC_API_URL. Set it in Cloud Run env vars (or .env.local for dev).",
        },
      } as const;
    }

    const { useAuthorization = false, contentType = "application/json" } =
      args.meta || {};

    const headers = await generateHeaders({ useAuthorization, contentType });

    const result = await fetchBaseQuery({
      baseUrl: apiBaseUrl,
      timeout: API_TIMEOUT_MS,
      headers: {
        ...headers,
      },
    })(args, api, extraOptions);

    return result;
  },
  endpoints: () => ({}),
});
