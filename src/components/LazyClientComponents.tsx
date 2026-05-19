'use client'

/**
 * TBT削減用 lazy ラッパー
 * layout.tsx (Server Component) から ssr:false の dynamic import を使うには
 * Client Component を一枚挟む必要がある（Next.js 16 制約）
 */

import dynamic from 'next/dynamic'
import type { SnsUrls } from '@/lib/sns'

// スクロールリスナーを持つ SnsFloatingBar を初期バンドルから除外
const SnsFloatingBarInner = dynamic(
  () => import('./SnsFloatingBar').then(m => m.SnsFloatingBar),
  { ssr: false }
)

// PostHog クリックブリッジを初期バンドルから除外
const PostHogEventBridgeInner = dynamic(
  () => import('./PostHogEventBridge').then(m => m.PostHogEventBridge),
  { ssr: false }
)

export function LazyFloatingBar({ snsUrls }: { snsUrls: SnsUrls }) {
  return <SnsFloatingBarInner snsUrls={snsUrls} />
}

export function LazyPostHogBridge() {
  return <PostHogEventBridgeInner />
}
