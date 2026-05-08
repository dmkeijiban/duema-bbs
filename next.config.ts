import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'bbs.animanch.com',
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
    // 大型パッケージのtree-shakingを最適化してバンドルサイズを削減
    optimizePackageImports: ['@tiptap/react', '@tiptap/pm', '@tiptap/starter-kit', '@tiptap/extension-image', '@tiptap/extension-link'],
  },
  compiler: {
    // 本番ビルドでconsole.log除去（console.errorは残す）
    removeConsole: {
      exclude: ['error'],
    },
  },
  async redirects() {
    return [
      {
        // vercel.appドメインからカスタムドメインへ301リダイレクト（SEO重複回避）
        source: '/:path*',
        has: [{ type: 'host', value: 'duema-bbs.vercel.app' }],
        destination: 'https://www.duema-bbs.com/:path*',
        permanent: true,
      },
      {
        // non-wwwからwwwへ301リダイレクト（canonical統一）
        source: '/:path*',
        has: [{ type: 'host', value: 'duema-bbs.com' }],
        destination: 'https://www.duema-bbs.com/:path*',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        // 全ページへのセキュリティヘッダー
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
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

export default withSentryConfig(nextConfig, {
  // Sentry組織・プロジェクトは環境変数 SENTRY_ORG / SENTRY_PROJECT で設定
  silent: !process.env.CI,

  // ソースマップをSentryへアップロード（本番ビルド時）
  widenClientFileUpload: true,

  // Next.js の Server Components のトレースを有効化
  autoInstrumentServerFunctions: true,

  // バンドルサイズ削減：Sentry のデバッグログを除去
  disableLogger: true,

  // ソースマップを本番バンドルに含めない（Sentryへのアップロードのみ）
  sourcemaps: { deleteSourcemapsAfterUpload: true },
})
