import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/finanzas",
  images: { unoptimized: true },
  trailingSlash: true,
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
};

export default nextConfig;
