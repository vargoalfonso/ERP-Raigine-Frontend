import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["antd"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    optimizePackageImports: ["antd"],
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
