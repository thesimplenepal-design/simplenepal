import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: { optimizePackageImports: [] },
  images: { formats: ['image/avif', 'image/webp'] },
  // Performance budget is enforced in CI (see .github/workflows/budget.yml)
  poweredByHeader: false,
}
export default config
