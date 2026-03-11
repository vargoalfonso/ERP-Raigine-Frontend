import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: ["antd"],
  experimental: {
    optimizePackageImports: ["antd"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=(), payment=()",
          },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  // Prevent Next.js from picking an incorrect workspace root when multiple lockfiles exist.
  outputFileTracingRoot: configDir,
  eslint: {
    // Speeds up `next build` significantly on large repos.
    // Keep linting available via `npm run lint`.
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/404",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
