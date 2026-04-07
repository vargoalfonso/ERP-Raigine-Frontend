/* eslint-disable @next/next/no-img-element */
"use client";

import Navbar from "@/components/login/Navbar";

import { Button, Card, Form, Input, message, Typography } from "antd";
import { useRouter } from "next/navigation";
import React from "react";
import Cookies from "js-cookie";

interface LoginFormValues {
  email: string;
  password: string;
}

const { Title, Link } = Typography;

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = async (values: LoginFormValues) => {
    // Simpan token dummy
    Cookies.set("Authorization", "DUMMY_TOKEN", { expires: 7 });

    message.success("Login bypassed (DEV MODE)");

    router.push("/dashboard");
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
                className={`w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 cursor-pointer`}
              >
                Login
              </button>
            </Form.Item>
          </Form>
        </Card>
      </main>
    </div>
  );
}
