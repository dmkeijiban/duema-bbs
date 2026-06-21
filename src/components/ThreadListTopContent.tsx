import { Suspense } from 'react'
import Link from 'next/link'
import { RecommendSection, RecommendSectionSkeleton } from '@/components/RecommendSection'
import { TopRankingShowcase, TopRankingShowcaseSkeleton } from '@/components/TopRankingShowcase'

// 'ranking': TOP5ランキング表示（現在）
// 'threads': おすすめスレッド表示（元の動作に戻す場合はここを変更）
const TOP_RECOMMENDATION_MODE: 'ranking' | 'threads' = 'ranking'

function BannerButtons() {
  return (
    <div className="mt-2 flex shrink-0 flex-wrap gap-2 md:mt-0">
      <Link
        href="/login?mode=signup"
        className="inline-block px-3 py-1 text-xs font-medium rounded border"
        style={{ color: '#155724', borderColor: '#155724', background: 'rgba(255,255,255,0.55)' }}
      >
        アカウント作成
      </Link>
      <Link
        href="/zukan"
        className="inline-block px-3 py-1 text-xs font-medium rounded border"
        style={{ color: '#155724', borderColor: '#155724', background: 'rgba(255,255,255,0.55)' }}
      >
        思い出図鑑を見る
      </Link>
    </div>
  )
}

function HomeBannerFallback() {
  return (
    <div
      className="mb-2 flex flex-col gap-2 border px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
      style={{ color: '#155724', background: '#d4edda', borderColor: '#c3e6cb' }}
    >
      <div className="leading-relaxed">
        <p>初めての方は<Link href="/guide" className="underline">スレッドの立て方</Link>をご確認ください。</p>
      </div>
      <BannerButtons />
    </div>
  )
}

function HomeBannerServer() {
  return <HomeBannerFallback />
}

export async function ThreadListTopContent({ showPopularThreads = true }: { showPopularThreads?: boolean }) {
  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2">
      {TOP_RECOMMENDATION_MODE === 'ranking' ? (
        <Suspense fallback={<TopRankingShowcaseSkeleton />}>
          <TopRankingShowcase />
        </Suspense>
      ) : (
        <Suspense fallback={<RecommendSectionSkeleton />}>
          <RecommendSection />
        </Suspense>
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
