import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    // 掲示板サムネは52-80px、バナーは~300px幅程度なので
    // 不要な大サイズ生成を抑えてキャッシュ効率を上げる
    deviceSizes: [640, 828, 1080, 1200],
    imageSizes: [52, 80, 128, 256, 384, 480],
    formats: ['image/webp'],
    minimumCacheTTL: 2592000, // 30日（デフォルト60秒→大幅延長）
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        // Next.jsの静的アセット（JS/CSS/フォント）は不変なので1年キャッシュ
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // next/imageの最適化済み画像を30日キャッシュ
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ]
  },
}

export default nextConfig
