/* eslint-disable @next/next/no-img-element */
"use client";

import { Card, Form, Input, message, Typography } from "antd";
import { useRouter } from "next/navigation";
import React from "react";
import Cookies from "js-cookie";
import { apiBaseUrl } from "@/lib/api/instance";
import { useLoginMutation } from "@/lib/api/auth/api";

interface LoginFormValues {
  email: string;
  password: string;
}

const { Title, Link } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();
  const apiEnabled = Boolean(apiBaseUrl);

  const handleLogin = async (values: LoginFormValues) => {
    if (!apiEnabled) {
      Cookies.set("Authorization", "DUMMY_TOKEN", { expires: 7, path: "/", sameSite: "lax" });
      message.success("Login bypassed (DEV MODE - API disabled)");
      router.push("/dashboard");
      return;
    }

    try {
      const res = await login({ email: values.email, password: values.password }).unwrap();
      const token = res?.data?.token;
      if (!token) {
        message.error("Login success but token missing");
        return;
      }

      Cookies.set("Authorization", token, { expires: 7, path: "/", sameSite: "lax" });
      message.success("Login success");
      router.push("/dashboard");
    } catch {
      message.error("Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
                disabled={isLoading}
                className={`w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 cursor-pointer`}
              >
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </Form.Item>
          </Form>
        </Card>
      </main>
    </div>
  );
}
