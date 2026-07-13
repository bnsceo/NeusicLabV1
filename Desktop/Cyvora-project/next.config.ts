import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  experimental: {
    cpus: 1,
  },
  typescript: {
    // Type checking runs explicitly before next build. This avoids the isolated
    // Next.js type-check worker hanging on native SQLite environments.
    ignoreBuildErrors: process.env.CYVORA_NEXT_SKIP_TYPECHECK === '1',
  },
};

export default nextConfig;
