import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  transpilePackages: ["antd"],
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
