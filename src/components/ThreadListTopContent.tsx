import { Suspense } from 'react'
import Link from 'next/link'
import { RecommendSection, RecommendSectionSkeleton } from '@/components/RecommendSection'

function BannerButtons() {
  return (
    <div className="flex shrink-0 flex-wrap gap-1.5">
      <Link
        href="/login?mode=signup"
        className="inline-flex items-center justify-center rounded border border-green-700 bg-white px-2.5 py-1 text-xs font-bold text-green-800 transition-colors hover:bg-green-50"
      >
        アカウント作成
      </Link>
      <Link
        href="/zukan"
        className="inline-flex items-center justify-center rounded border border-green-700 bg-white px-2.5 py-1 text-xs font-bold text-green-800 transition-colors hover:bg-green-50"
      >
        思い出図鑑
      </Link>
    </div>
  )
}

function HomeBannerFallback() {
  return (
    <div
      className="mb-1.5 flex flex-col gap-1.5 border px-3 py-1.5 text-sm text-green-900 md:flex-row md:items-center md:justify-between"
      style={{ color: '#155724', background: '#d4edda', borderColor: '#c3e6cb' }}
    >
      <p className="font-bold leading-relaxed">
        初めての方は
        <Link href="/guide" className="underline underline-offset-2 hover:opacity-80">
          スレッドの立て方
        </Link>
        をご確認ください。
      </p>
      <BannerButtons />
    </div>
  )
}

function HomeBannerServer() {
  return <HomeBannerFallback />
}

export async function ThreadListTopContent({ showPopularThreads = false }: { showPopularThreads?: boolean }) {
  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2">
      <Suspense fallback={<RecommendSectionSkeleton />}>
        <RecommendSection />
      </Suspense>
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
