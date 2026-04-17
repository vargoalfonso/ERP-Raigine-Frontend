import { apiSlice } from "@/lib/api/instance";
import { ApiResponse, DataObject } from "@/types";
import { AuthResponse, LoginStatusType, LoginTokenData } from "./interface";

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord => typeof v === "object" && v !== null;

const parseLoginTokenData = (response: unknown): LoginTokenData => {
  const fallback: LoginTokenData = { access_token: "" };

  if (!isRecord(response)) return fallback;
  const data = response.data;
  if (!isRecord(data)) return fallback;

  const accessToken = data.access_token;
  if (typeof accessToken !== "string" || !accessToken.trim()) return fallback;

  const expiresAt = data.expires_at;
  const tokenType = data.token_type;

  return {
    access_token: accessToken,
    ...(typeof expiresAt === "string" ? { expires_at: expiresAt } : {}),
    ...(typeof tokenType === "string" ? { token_type: tokenType } : {}),
  };
};

export const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginTokenData, { email: string; password: string }>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        meta: {
          useAuthorization: false,
          contentType: "application/json",
        },
        body: credentials,
      }),
      transformResponse: (response: unknown) => parseLoginTokenData(response as LoginStatusType),
    }),
    logout: builder.mutation<ApiResponse<DataObject<null>>, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
    }),
    register: builder.mutation<
      ApiResponse<DataObject<AuthResponse>>,
      { email: string; password: string }
    >({
      query: (credentials) => ({
        url: "/auth/register",
        method: "POST",
        body: credentials,
      }),
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useRegisterMutation } =
  authApiSlice;
