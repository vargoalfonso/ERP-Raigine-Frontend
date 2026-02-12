import { apiSlice } from "@/lib/api/instance";
import { ApiResponse, DataObject } from "@/types";
import { AuthResponse, LoginStatusType } from "./interface";

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
        body: credentials,
      }),
      transformResponse: (response: unknown) => {
        const r = response as Partial<{ token: string; user: AuthResponse["user"] }>;

        return {
          message: "OK",
          status: "success",
          data: {
            token: r?.token ?? "",
            user: (r?.user as AuthResponse["user"]) ?? ({} as AuthResponse["user"]),
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
