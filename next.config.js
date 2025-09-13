/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  typescript: {
    // We'll properly type everything, but allow builds during development
    ignoreBuildErrors: false,
  },
  eslint: {
    // We'll fix linting issues, but allow builds during development
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig