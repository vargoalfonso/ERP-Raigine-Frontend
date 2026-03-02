import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  transpilePackages: ["antd"],
  experimental: {
    optimizePackageImports: ["antd"],
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
