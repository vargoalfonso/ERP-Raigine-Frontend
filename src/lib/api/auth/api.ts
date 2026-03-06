import { apiSlice } from "@/lib/api/instance";
import { ApiResponse, DataObject } from "@/types";
import { AuthResponse, LoginStatusType } from "./interface";

const LOGIN_FIELD = (process.env.NEXT_PUBLIC_AUTH_LOGIN_FIELD || "email").trim();

export const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<
      LoginStatusType,
      { email: string; password: string }
    >({
      query: (credentials) => ({
        url: "/api/auth/login",
        method: "POST",
        meta: {
          useAuthorization: false,
          contentType: "application/json",
        },
        body: {
          [LOGIN_FIELD]: credentials.email,
          password: credentials.password,
        } as Record<string, string>,
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{
          token: string;
          user: AuthResponse["user"];
          data: { token?: string; user?: AuthResponse["user"] };
        }>;

        const payload = (r && typeof r === "object" && "data" in r && r.data && typeof r.data === "object"
          ? r.data
          : r) as Partial<{ token: string; user: AuthResponse["user"] }>;

        return {
          message: "OK",
          status: "success",
          data: {
            token: payload?.token ?? "",
            user:
              (payload?.user as AuthResponse["user"]) ?? ({} as AuthResponse["user"]),
          },
        } satisfies LoginStatusType;
      },
    }),
    register: builder.mutation<
      ApiResponse<DataObject<AuthResponse>>,
      { username: string; email: string; password: string }
    >({
      query: (credentials) => ({
        url: "/api/auth/register",
        method: "POST",
        meta: {
          useAuthorization: false,
          contentType: "application/json",
        },
        body: credentials,
      }),
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = authApiSlice;
