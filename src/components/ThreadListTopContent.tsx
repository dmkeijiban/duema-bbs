import { Suspense } from 'react'
import Link from 'next/link'
import { RecommendSection, RecommendSectionSkeleton } from '@/components/RecommendSection'
import { GreenCtaBanner } from '@/components/GreenCtaBanner'
import { RankingGoodlifeAd } from '@/components/RankingGoodlifeAd'

function HomeBannerFallback() {
  return <GreenCtaBanner />
}

function HomeBannerServer() {
  return <GreenCtaBanner />
}

export async function ThreadListTopContent({ showPopularThreads = false }: { showPopularThreads?: boolean }) {
  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2">
      <Suspense fallback={<RecommendSectionSkeleton />}>
        <RecommendSection />
      </Suspense>
      <RankingGoodlifeAd />
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
