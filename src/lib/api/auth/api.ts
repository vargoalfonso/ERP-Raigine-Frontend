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
        url: "/auth/login",
        method: "POST",
        meta: {
          useAuthorization: false,
          contentType: "application/json",
        },
        body: credentials,
      }),
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
