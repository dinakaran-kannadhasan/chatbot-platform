import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Why transpilePackages?
   * @chatbot/types is a TypeScript source package in our monorepo.
   * Next.js needs to transpile it since it has no compiled output
   * that Next.js can use directly.
   */
  transpilePackages: ["@chatbot/types"],

  /**
   * API proxy — in development, forward /api requests to the
   * Express backend running on port 4000.
   * In production, set NEXT_PUBLIC_API_URL to the deployed API URL.
   */
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
