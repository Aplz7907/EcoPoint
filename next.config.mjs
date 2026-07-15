/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Route handlers receive full-resolution phone photos.
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
