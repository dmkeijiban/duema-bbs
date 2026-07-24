'use client'

/**
 * TBT削減用 lazy ラッパー
 * layout.tsx (Server Component) から ssr:false の dynamic import を使うには
 * Client Component を一枚挟む必要がある（Next.js 16 制約）
 */

import dynamic from 'next/dynamic'
import type { SnsUrls } from '@/lib/sns'
import { GlobalInteractionFeedback } from './GlobalInteractionFeedback'
import { MyPageSignupAd } from './MyPageSignupAd'
import { FixedAndRankingTopAd } from './FixedAndRankingTopAd'
import { NineSelectionListAds } from './NineSelectionListAds'

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

const DesktopFloatingActionsInner = dynamic(
  () => import('./DesktopFloatingActions').then(m => m.DesktopFloatingActions),
  { ssr: false }
)

export function LazyFloatingBar({ snsUrls }: { snsUrls: SnsUrls }) {
  return <SnsFloatingBarInner snsUrls={snsUrls} />
}

export function LazyPostHogBridge({ adstirListTop, adstirListMiddle }: { adstirListTop: boolean; adstirListMiddle: boolean }) {
  return (
    <>
      <GlobalInteractionFeedback />
      <MyPageSignupAd />
      <FixedAndRankingTopAd enableListTop={adstirListTop} enableListMiddle={adstirListMiddle} />
      <NineSelectionListAds enabled={adstirListTop} />
      <PostHogEventBridgeInner />
    </>
  )
}

export function LazyDesktopFloatingActions() {
  return <DesktopFloatingActionsInner />
}
