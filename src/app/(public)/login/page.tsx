/* eslint-disable @next/next/no-img-element */
"use client";

import Navbar from "@/components/login/Navbar";

import { Button, Card, Form, Input, message, Typography } from "antd";
import { useRouter } from "next/navigation";
import React from "react";
import Cookies from "js-cookie";
import { useLoginMutation } from "@/lib/api/auth/api";
import { getApiErrorMessage } from "@/lib/api/error";

interface LoginFormValues {
  email: string;
  password: string;
}

const { Title, Link } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const [login, loginState] = useLoginMutation();
  const [messageApi, contextHolder] = message.useMessage();

  const handleLogin = async (values: LoginFormValues) => {
    try {
      const tokenData = await login({
        email: values.email,
        password: values.password,
      }).unwrap();

      const accessToken = tokenData.access_token?.trim();
      if (!accessToken) throw new Error("Missing access_token from login response");

      const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
      const cookieExpires = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : 7;

      Cookies.set("Authorization", accessToken, {
        expires: cookieExpires,
        path: "/",
        sameSite: "lax",
      });

      messageApi.success("Login success");
      router.push("/dashboard");
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, "Login failed"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {contextHolder}
      {/* Navbar */}
      {/* <Navbar
        text={
          <div className="text-gray-600">Don`t have a rAIgine account?</div>
        }
        button={
          <Button
            variant="outlined"
            className="!text-primary !border-primary"
            onClick={() => router.push("/register")}
          >
            Sign Up
          </Button>
        }
      /> */}

      {/* Main Section */}
      <main className="flex-grow flex items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-md">
          <div className="mb-6">
            <img src="/logo-flat.png" alt="Logo" className="h-10 mb-2" />
            <Title level={3}>Login to rAIgine</Title>
          </div>

          <Form
            layout="vertical"
            requiredMark={false}
            onFinish={handleLogin}
            initialValues={{ email: "", password: "" }}
          >
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { type: "email", message: "Please enter a valid email!" },
              ]}
            >
              <Input
                type="email"
                placeholder="Enter email"
                // Remove value and onChange to let Form handle state
              />
            </Form.Item>

            <Form.Item name="password" label="Password" rules={[]}>
              <Input.Password
                placeholder="Enter password"
                // Remove onChange to let Form handle state
              />
            </Form.Item>

            <div className="flex justify-end mb-4">
              <Link href="/forgot-password" className="!text-primary">
                Forgot password?
              </Link>
            </div>

            <Form.Item>
              <button
                type="submit"
                disabled={loginState.isLoading}
                className={`w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 cursor-pointer`}
              >
                {loginState.isLoading ? "Logging in..." : "Login"}
              </button>
            </Form.Item>
          </Form>
        </Card>
      </main>
    </div>
  );
}
