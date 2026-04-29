import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

let cachedLocationPromise: Promise<{ latitude: number | null; longitude: number | null }> | null = null;

export const getUserLocation = async () => {
  if (cachedLocationPromise) {
    return cachedLocationPromise;
  }

  cachedLocationPromise = new Promise<{ latitude: number | null; longitude: number | null }>(
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
          },
          {
            enableHighAccuracy: false,
            timeout: 2000,
            maximumAge: 5 * 60 * 1000,
          }
        );
      } else {
        reject(new Error("Geolocation is not supported"));
      }
    }
  );

  return cachedLocationPromise.catch((error) => {
    cachedLocationPromise = Promise.resolve({ latitude: null, longitude: null });
    throw error;
  });
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
  contentType?: string;
}) => {
  const location = await getUserLocation().catch(() => ({
    latitude: null,
    longitude: null,
  }));
  const deviceInfo = getDeviceInfo();

  const headers: Record<string, string> = {
    // Browsers disallow setting the User-Agent header. Use a custom header instead.
    "X-User-Agent": deviceInfo.userAgent,
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

  if (contentType && contentType !== "multipart/form-data") {
    headers["Content-Type"] = contentType;
  }

  return headers;
};

const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/proxy";

export const apiBaseUrl = rawApiBaseUrl.replace(/\/$/, "");

export const apiSlice = createApi({
  reducerPath: "api",
  tagTypes: [
    "FinishedGoods",
    "BOM",
    "PoBudget",
    "ProductReturns",
    "SystemSettingsRoles",
    "SystemSettingsDepartments",
    "SystemSettingsAccessControl",
    "SystemSettingsApprovalWorkflow",
    "SystemSettingsKanban",
    "SystemSettingsSafetyStock",
    "SystemSettingsStockdays",
    "SystemSettingsPoSplit",
    "SystemSettingsUom",
    "SystemSettingsTypeParameter",
    "SystemSettingsProcess",
    "SystemSettingsGlobalParameters",
  ],
  refetchOnFocus: false,
  baseQuery: async (args, api, extraOptions) => {
    if (!apiBaseUrl) {
      return {
        error: {
          status: "FETCH_ERROR",
          error: "NEXT_PUBLIC_API_URL is not configured",
        },
      };
    }

    const { useAuthorization = false, contentType = "application/json" } =
      args.meta || {};

    const headers = await generateHeaders({ useAuthorization, contentType });

    const result = await fetchBaseQuery({
      baseUrl: apiBaseUrl,
      headers: {
        ...headers,
      },
    })(args, api, extraOptions);

    return result;
  },
  endpoints: () => ({}),
});
