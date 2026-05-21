"use client";

import { useEffect } from "react";
import { Button, Form, Input, message } from "antd";
import { useSearchParams, useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";

export default function SetPasswordPage() {
  const [form] = Form.useForm();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token") ?? "";
    form.setFieldsValue({ token });
  }, [searchParams, form]);

  const onFinish = async (values: any) => {
    try {
      const token = String(values.token ?? "").trim();
      const password = String(values.password ?? "").trim();
      const confirm_password = String(values.confirm_password ?? "").trim();

      if (!token) {
        message.error("Token is required");
        return;
      }

      if (!password) {
        message.error("Password is required");
        return;
      }

      const res = await fetch(`${apiBaseUrl}/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirm_password }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw errJson || new Error("Failed to set password");
      }

      message.success("Password set successfully. Please login.");
      router.push("/login");
    } catch (err) {
      message.error(getApiErrorMessage(err, "Failed to set password"));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold mb-3">Set your password</h2>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="token" label="Token" rules={[{ required: true }]}>
            <Input className="!rounded-lg" placeholder="Token from email" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password className="!rounded-lg" placeholder="Enter password" />
          </Form.Item>
          <Form.Item name="confirm_password" label="Confirm Password" rules={[{ required: true }]}>
            <Input.Password className="!rounded-lg" placeholder="Confirm password" />
          </Form.Item>
          <div className="flex items-center justify-end">
            <Button type="primary" htmlType="submit" className="!rounded-lg">
              Set Password
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
