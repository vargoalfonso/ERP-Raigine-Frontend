import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd()),
  transpilePackages: ["antd"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ["antd"],
  },
  async redirects() {
    return [
      {
        source: "/404",
        destination: "/login",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const backendOrigin = (process.env.BACKEND_ORIGIN ?? "").replace(/\/$/, "");
    if (!backendOrigin) return [];
    return [
      {
        source: "/uploads/:path*",
        destination: `${backendOrigin}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
