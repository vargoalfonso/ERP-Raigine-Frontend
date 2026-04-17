import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["antd"],
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
