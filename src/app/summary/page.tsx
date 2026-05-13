import { createPublicClient } from '@/lib/supabase-public'
import { RecommendSection } from '@/components/RecommendSection'
import { BottomNav } from '@/components/ThreadSortPage'
import Link from 'next/link'
import { Suspense } from 'react'
import { Metadata } from 'next'
import { SITE_URL } from '@/lib/site-config'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'まとめ一覧 | デュエマ掲示板',
  description: 'デュエマ（デュエルマスターズ）掲示板の人気記事まとめ・週間ランキング・月間ランキングの一覧。話題スレッドをまとめてチェックしよう。',
  alternates: { canonical: `${SITE_URL}/summary` },
  openGraph: {
    title: 'まとめ一覧 | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板の人気記事まとめ・週間ランキング・月間ランキングの一覧。話題スレッドをまとめてチェックしよう。',
    url: `${SITE_URL}/summary`,
    type: 'website' as const,
    images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: 'まとめ一覧 | デュエマ掲示板' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: 'まとめ一覧 | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板の人気記事まとめ・週間ランキング・月間ランキングの一覧。話題スレッドをまとめてチェックしよう。',
    images: [`${SITE_URL}/default-thumbnail.jpg`],
  },
}

interface Summary {
  id: number
  type: 'weekly' | 'monthly' | 'manual'
  slug: string
  title: string
  period_start: string
  period_end: string
  created_at: string
}

async function getSummaries(): Promise<Summary[]> {
  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('summaries')
      .select('id, type, slug, title, period_start, period_end, created_at')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(50)

    return (data ?? []) as Summary[]
  } catch (error) {
    console.warn('summary list fetch failed:', error)
    return []
  }
}

function SummaryLinks({ summaries }: { summaries: Summary[] }) {
  return (
    <div className="border border-gray-300 divide-y divide-gray-200 bg-white">
      {summaries.map(summary => (
        <Link
          key={summary.slug}
          href={`/summary/${summary.slug}`}
          className="flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm text-blue-700 font-medium break-words">{summary.title}</p>
            {(summary.period_start || summary.period_end) && (
              <p className="text-xs text-gray-400 mt-0.5">
                {summary.period_start} - {summary.period_end}
              </p>
            )}
          </div>
          <span className="text-xs text-blue-400 ml-2 shrink-0">›</span>
        </Link>
      ))}
    </div>
  )
}

async function SummaryList() {
  const summaries = await getSummaries()

  if (summaries.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 bg-white border border-gray-300">
        <p>まだ公開済みのまとめはありません</p>
        <p className="text-xs mt-2 text-gray-400">人気スレッドのまとめが作成されるとここに表示されます。</p>
      </div>
    )
  }

  const manualSummaries = summaries.filter(summary => summary.type === 'manual')
  const weeklySummaries = summaries.filter(summary => summary.type === 'weekly')
  const monthlySummaries = summaries.filter(summary => summary.type === 'monthly')

  return (
    <>
      {manualSummaries.length > 0 && (
        <section className="mb-4">
          <h2 className="text-sm font-bold text-gray-700 px-2 py-1.5 border border-gray-300 bg-orange-50 mb-2">
            注目まとめ
          </h2>
          <SummaryLinks summaries={manualSummaries} />
        </section>
      )}

      {weeklySummaries.length > 0 && (
        <section className="mb-4">
          <h2 className="text-sm font-bold text-gray-900 px-2 py-1.5 border border-blue-200 bg-blue-50 mb-2">
            週間ランキング
          </h2>
          <SummaryLinks summaries={weeklySummaries} />
        </section>
      )}

      {monthlySummaries.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-700 px-2 py-1.5 border border-gray-300 bg-gray-50 mb-2">
            月間ランキング
          </h2>
          <SummaryLinks summaries={monthlySummaries} />
        </section>
      )}
    </>
  )
}

export default async function SummaryIndexPage() {
  return (
    <div className="w-full px-0 py-0">
      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        <Suspense fallback={null}>
          <RecommendSection />
        </Suspense>

        <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
          <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
          <span>{'>'}</span>
          <span>まとめ一覧</span>
        </nav>

        <div className="mb-3 px-3 py-2 border border-gray-300 bg-white">
          <h1 className="font-bold text-sm text-gray-800">まとめ一覧</h1>
        </div>

        <Suspense fallback={
          <div className="border border-gray-300 bg-white animate-pulse divide-y divide-gray-200">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-3 py-2.5">
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-1.5" />
                <div className="h-2.5 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        }>
          <SummaryList />
        </Suspense>

        <BottomNav current="/" />
        <div className="mb-6" />
      </div>
    </div>
  )
}
