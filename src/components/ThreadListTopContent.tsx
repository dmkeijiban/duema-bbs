import { Suspense } from 'react'
import Link from 'next/link'
import { RecommendSection, RecommendSectionSkeleton } from '@/components/RecommendSection'
import { GreenCtaBanner } from '@/components/GreenCtaBanner'
import { GoodlifeInlineAd } from '@/components/GoodlifeInlineAd'

function HomeBannerFallback() {
  return <GreenCtaBanner />
}

function HomeBannerServer() {
  return <GreenCtaBanner />
}

export async function ThreadListTopContent({
  showPopularThreads = false,
  showGoodlifeBeforeGreen = false,
}: {
  showPopularThreads?: boolean
  showGoodlifeBeforeGreen?: boolean
}) {
  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2">
      <Suspense fallback={<RecommendSectionSkeleton />}>
        <RecommendSection />
      </Suspense>
      {showGoodlifeBeforeGreen && (
        <GoodlifeInlineAd slot="thread_list_inline" mobileOnly />
      )}
      <Suspense fallback={<HomeBannerFallback />}>
        <HomeBannerServer />
      </Suspense>
      {showPopularThreads && (
        <Link
          href="/ranking"
          className="mb-2 flex items-center justify-between px-3 py-2 border border-blue-200 bg-blue-50 text-sm text-gray-900 hover:bg-blue-100 transition-colors"
        >
          <span>📊 人気ランキングまとめ（週間・総合）</span>
          <span className="text-xs ml-2 shrink-0">一覧へ</span>
        </Link>
      )}
    </div>
  )
}
