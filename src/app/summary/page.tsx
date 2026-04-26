import { createPublicClient } from '@/lib/supabase-public'
import { RecommendSection } from '@/components/RecommendSection'
import { BottomNav } from '@/components/ThreadSortPage'
import Link from 'next/link'
import { Suspense } from 'react'
import { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '週次・月次まとめ | デュエマ掲示板',
  description: '毎週・毎月の人気スレッドTOP5まとめ一覧です。',
}

interface Summary {
  id: number
  type: 'weekly' | 'monthly'
  slug: string
  title: string
  period_start: string
  period_end: string
  threads: SummaryThread[]
  created_at: string
}

interface SummaryThread {
  id: number
  title: string
  post_count: number
  activity: number
  image_url: string | null
  category_name: string | null
  category_color: string | null
  rank: number
}

async function SummaryList() {
  const supabase = createPublicClient()
  const { data: summaries } = await supabase
    .from('summaries')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!summaries || summaries.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 bg-white border border-gray-300">
        <p>まだまとめがありません</p>
        <p className="text-xs mt-2 text-gray-400">毎週月曜日に先週の人気スレッドTOP5が自動生成されます</p>
      </div>
    )
  }

  const weeklySummaries = (summaries as Summary[]).filter(s => s.type === 'weekly')
  const monthlySummaries = (summaries as Summary[]).filter(s => s.type === 'monthly')

  return (
    <>
      {weeklySummaries.length > 0 && (
        <section className="mb-4">
          <h2 className="text-sm font-bold text-gray-700 px-2 py-1.5 border border-gray-300 bg-gray-50 mb-2">
            📅 週次まとめ
          </h2>
          <div className="border border-gray-300 divide-y divide-gray-200 bg-white">
            {weeklySummaries.map(s => (
              <Link
                key={s.slug}
                href={`/summary/${s.slug}`}
                className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm text-gray-800 font-medium">{s.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.period_start} 〜 {s.period_end}
                  </p>
                </div>
                <span className="text-xs text-gray-400 ml-2 shrink-0">▶</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {monthlySummaries.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-700 px-2 py-1.5 border border-gray-300 bg-gray-50 mb-2">
            🗓️ 月次まとめ
          </h2>
          <div className="border border-gray-300 divide-y divide-gray-200 bg-white">
            {monthlySummaries.map(s => (
              <Link
                key={s.slug}
                href={`/summary/${s.slug}`}
                className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm text-gray-800 font-medium">{s.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.period_start} 〜 {s.period_end}
                  </p>
                </div>
                <span className="text-xs text-gray-400 ml-2 shrink-0">▶</span>
              </Link>
            ))}
          </div>
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

        {/* パンくず */}
        <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
          <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
          <span>{'>'}</span>
          <span>週次・月次まとめ</span>
        </nav>

        {/* ヘッダー */}
        <div className="mb-3 px-3 py-2 border border-gray-300 bg-white">
          <h1 className="font-bold text-sm text-gray-800">📊 週次・月次まとめ</h1>
          <p className="text-xs text-gray-500 mt-0.5">毎週月曜日に先週の人気スレッドTOP5が自動生成されます</p>
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
