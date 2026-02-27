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

export const apiSlice = createApi({
  reducerPath: "api",
  tagTypes: ["MasterSuppliers"],
  refetchOnFocus: true,
  baseQuery: async (args, api, extraOptions) => {
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
