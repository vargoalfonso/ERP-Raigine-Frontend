"use client";

import { Suspense, useEffect, useState } from "react";
import { Button, Checkbox, Divider, Form, Input, message } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { apiBaseUrl } from "@/lib/api/instance";
import { getApiErrorMessage } from "@/lib/api/error";

type ResolvedProfile = {
  fullName: string;
  email: string;
};

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordPageContent />
    </Suspense>
  );
}

function SetPasswordPageContent() {
  const [form] = Form.useForm();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isResolvingProfile, setIsResolvingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  const extractProfile = (payload: unknown): ResolvedProfile => {
    if (!payload || typeof payload !== "object") {
      return { fullName: "", email: "" };
    }

    const record = payload as Record<string, unknown>;
    const nested =
      record.data && typeof record.data === "object"
        ? (record.data as Record<string, unknown>)
        : null;
    const nestedUser =
      nested?.user && typeof nested.user === "object"
        ? (nested.user as Record<string, unknown>)
        : null;

    const fullNameCandidates = [
      record.fullname,
      record.full_name,
      record.fullName,
      record.name,
      nested?.fullname,
      nested?.full_name,
      nested?.fullName,
      nested?.name,
      nestedUser?.fullname,
      nestedUser?.full_name,
      nestedUser?.fullName,
      nestedUser?.name,
    ];

    const emailCandidates = [
      record.email,
      nested?.email,
      nestedUser?.email,
      nested?.user_email,
    ];

    let fullName = "";
    let email = "";

    for (const candidate of fullNameCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        fullName = candidate.trim();
        break;
      }
    }

    for (const candidate of emailCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        email = candidate.trim();
        break;
      }
    }

    return { fullName, email };
  };

  const resolveRegisteredProfile = async (token: string) => {
    if (!token || !apiBaseUrl) return;

    setIsResolvingProfile(true);

    try {
      const response = await fetch(`${apiBaseUrl}/get-token/${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw errJson || new Error("Failed to resolve token profile");
      }

      const payload = await response.json().catch(() => null);
      const { fullName, email } = extractProfile(payload);
      const [emailLocal = "", emailDomain = ""] = email.split("@");

      form.setFieldsValue({
        full_name: fullName,
        email,
        email_local: emailLocal,
        email_domain: emailDomain,
      });
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to load registration data"));
    } finally {
      setIsResolvingProfile(false);
    }
  };

  useEffect(() => {
    const token = searchParams.get("token") ?? "";
    form.setFieldsValue({ token });
    void resolveRegisteredProfile(token);
  }, [form, searchParams]);

  const onFinish = async (values: {
    token?: string;
    password?: string;
    confirm_password?: string;
  }) => {
    try {
      setIsSubmitting(true);

      const token = String(values.token ?? "").trim();
      const password = String(values.password ?? "").trim();
      const password_confirm = String(values.confirm_password ?? "").trim();

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
        body: JSON.stringify({ token, password, confirm_password: password_confirm }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw errJson || new Error("Failed to set password");
      }

      message.success("Password set successfully. Please login.");
      router.push("/login");
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to set password"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailLocal = Form.useWatch("email_local", form) ?? "";
  const emailDomain = Form.useWatch("email_domain", form) ?? "";
  const emailFull = Form.useWatch("email", form) ?? "";

  return (
    <div className="min-h-screen bg-[#f7f7f7] flex flex-col">
      <header className="border-b border-[#e9e9e9] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between">
          <img src="/logo-flat.png" alt="rAIgine" className="h-8 w-auto" />
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>Already have rAIgine account?</span>
            <Button
              className="!rounded-md !border-[#2f66f6] !text-[#2f66f6] hover:!border-[#1d4ed8] hover:!text-[#1d4ed8]"
              onClick={() => router.push("/login")}
            >
              Log In
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[470px] rounded-2xl border border-[#ececec] bg-white px-9 py-8 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
          <img src="/logo-flat.png" alt="rAIgine" className="mb-5 h-10 w-auto" />
          <h1 className="mb-7 text-[28px] font-semibold leading-tight text-[#222]">
            Create your Account
          </h1>

          <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              name="full_name"
              label={<span className="text-[13px] text-[#2f2f2f]">Full Name</span>}
            >
              <Input
                className="!h-[42px] !rounded-md"
                placeholder={isResolvingProfile ? "Loading name" : "Registered full name"}
                disabled
                maxLength={25}
                
              />
            </Form.Item>

            <Form.Item name="email" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="email_domain" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="token" hidden rules={[{ required: true }]}>
              <Input />
            </Form.Item>

            <Form.Item label={<span className="text-[13px] text-[#2f2f2f]">Email</span>}>
              {emailLocal && emailDomain ? (
                <Input
                  className="!h-[42px] !rounded-md"
                  value={emailLocal}
                  placeholder="Registered email"
                  disabled
                  addonAfter={
                    <span className="min-w-[92px] text-left text-gray-400">
                      {emailDomain ? `@${emailDomain}` : "@raigine.com"}
                    </span>
                  }
                />
              ) : (
                <Input
                  className="!h-[42px] !rounded-md"
                  value={emailFull}
                  placeholder="Registered email"
                  disabled
                />
              )}
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className="text-[13px] text-[#2f2f2f]">Password</span>}
              rules={[{ required: true, message: "Enter password" }]}
            >
              <Input.Password className="!h-[42px] !rounded-md" placeholder="Enter password" />
            </Form.Item>

            <Form.Item
              name="confirm_password"
              label={<span className="text-[13px] text-[#2f2f2f]">Confirm Password</span>}
              dependencies={["password"]}
              rules={[
                { required: true, message: "Confirm password" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }

                    return Promise.reject(new Error("Password confirmation does not match"));
                  },
                }),
              ]}
            >
              <Input.Password className="!h-[42px] !rounded-md" placeholder="Enter password" />
            </Form.Item>

            <div className="mb-5 mt-1 flex items-start gap-2 text-sm text-[#555]">
              <Checkbox
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                By signing up, you agree to rAIgine{" "}
                <button type="button" className="text-[#2f66f6]">
                  Privacy Policy
                </button>
              </span>
            </div>

            <Divider plain className="!my-5 !text-gray-400">
              Or sign up with
            </Divider>

            <Button
              className="!mb-5 !h-[42px] !w-full !rounded-md !border-[#d9d9d9] !text-[15px] !font-medium"
              disabled
            >
              Continue with Google
            </Button>

            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              disabled={!acceptedTerms || isResolvingProfile}
              className="!h-[44px] !w-full !rounded-md !border-0 !bg-[#2f66f6] !text-[15px] !font-medium hover:!bg-[#1d4ed8] disabled:!bg-[#e5e5e5] disabled:!text-[#a8a8a8]"
            >
              Create Account
            </Button>
          </Form>
        </div>
      </main>
    </div>
  );
}
