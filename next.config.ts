import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "fdec9a91-ae6d-4bef-8f1b-f135574571cd-00-19lypgjwt5f0n.worf.replit.dev",
    "127.0.0.1",
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
