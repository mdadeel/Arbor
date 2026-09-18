/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // bullmq's optional valkey-glide import isn't bundled; keep the whole herd
  // of queue/runtime deps external like the worker process uses them.
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    serverComponentsExternalPackages: ['@prisma/client', 'bullmq', 'ioredis', 'simple-git', '@babel/parser', '@babel/traverse'],
  },
}

export default nextConfig