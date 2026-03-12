import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@pippit/core', '@libsql/client', 'drizzle-orm'],
}

export default nextConfig
