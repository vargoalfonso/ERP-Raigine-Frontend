import { NextRequest, NextResponse } from "next/server";

const excludedPaths = [
  "/login",
  "/set-password",
  "/register",
  "/forgot-password",
  "/not-active",
  "register/success",
];

const securityHeaders: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: http:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Cross-Origin-Opener-Policy": "same-origin",
};

const withSecurityHeaders = (response: NextResponse) => {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  if (excludedPaths.includes(pathname)) {
    return withSecurityHeaders(NextResponse.next());
  }

  const token = req.cookies.get("Authorization")?.value;
  if (!token) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", req.url)));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!api|_next|register|forgot-password|login|set-password|public|.*\\.png$|.*\\.jpeg$|.*\\.svg$).*)",
  ],
};
