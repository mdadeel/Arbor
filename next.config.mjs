/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The preview host is an isolated subdomain; allow its dev-only asset requests.
  allowedDevOrigins: ['*.e2b.app'],
  // bullmq's optional valkey-glide import isn't bundled; keep the whole herd
  // of queue/runtime deps external like the worker process uses them.
  serverExternalPackages: ['@prisma/client', 'bullmq', 'ioredis', 'simple-git', '@babel/parser', '@babel/traverse'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig