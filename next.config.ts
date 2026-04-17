import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
};

export default nextConfig;
