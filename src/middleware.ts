import { NextRequest, NextResponse } from "next/server";

const excludedPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/not-active",
  "register/success",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  if (excludedPaths.includes(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get("Authorization")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next|register|forgot-password|login|public|.*\\.png$|.*\\.jpeg$|.*\\.svg$).*)",
  ],
};
