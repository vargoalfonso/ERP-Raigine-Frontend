import { NextRequest, NextResponse } from "next/server";

const excludedPaths = [
  "/login",
  "/register",
  "/forgot-password",
  "/not-active",
  "/register/success",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Basic bot/crawler blocking (helps reduce scraping / noisy traffic).
  // Disable by setting BLOCK_BOTS=false in the environment.
  const blockBots = process.env.BLOCK_BOTS !== "false";
  if (blockBots) {
    const ua = req.headers.get("user-agent") || "";
    const botLike =
      /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|twitterbot|linkedinbot|discordbot|whatsapp|telegrambot|skypeuripreview/i.test(
        ua
      );
    if (botLike) {
      return new NextResponse("Forbidden", {
        status: 403,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
  }

  // Safety: disable the debug smoke-test page unless explicitly enabled.
  // This reduces accidental exposure and potential abuse in production.
  if (pathname === "/api-smoke") {
    const smokeEnabled = process.env.ENABLE_API_SMOKE === "true";
    if (!smokeEnabled) {
      return new NextResponse("Not Found", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
  }
  
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
