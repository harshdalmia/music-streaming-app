import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  eslint: {
    // Ignore lint errors during build (for deployment)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore TypeScript errors during build (for deployment)
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['img.youtube.com'],
  },
  // Handle static exports if needed
  output: 'standalone',
};

export default nextConfig;
