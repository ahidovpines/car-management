import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  allowedDevOrigins: ['app.ap-cars.com', '*.ap-cars.com'],
};

export default nextConfig;
