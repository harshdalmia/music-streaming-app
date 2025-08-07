/** @type {import('next').NextConfig} */
const nextConfig = {
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
}

module.exports = nextConfig