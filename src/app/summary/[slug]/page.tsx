import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase-public'
import { RecommendSection } from '@/components/RecommendSection'
import { BottomNav } from '@/components/ThreadSortPage'
import Link from 'next/link'
import { Suspense } from 'react'
import { Metadata } from 'next'

export const revalidate = 3600

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

interface Props {
  params: Promise<{ slug: string }>
}

async function getSummary(slug: string): Promise<Summary | null> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('summaries')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()
  return data as Summary | null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const summary = await getSummary(slug)
  if (!summary) return {}
  return {
    title: `${summary.title} | デュエマ掲示板`,
    description: `${summary.period_start}〜${summary.period_end}の人気スレッドTOP5まとめです。`,
  }
}

const RANK_COLORS = [
  'text-yellow-500',
  'text-gray-400',
  'text-orange-400',
  'text-gray-500',
  'text-gray-500',
]

const RANK_LABELS = ['🥇', '🥈', '🥉', '4位', '5位']

export default async function SummarySlugPage({ params }: Props) {
  const { slug } = await params
  const summary = await getSummary(slug)

  if (!summary) notFound()

  const threads = summary.threads ?? []

  return (
    <div className="w-full px-0 py-0">
      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        <Suspense fallback={null}>
          <RecommendSection />
        </Suspense>

        {/* パンくず */}
        <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1 flex-wrap">
          <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
          <span>{'>'}</span>
          <Link href="/summary" className="text-blue-600 hover:underline">週次・月次まとめ</Link>
          <span>{'>'}</span>
          <span className="truncate">{summary.title}</span>
        </nav>

        {/* ヘッダー */}
        <div className="mb-3 px-3 py-3 border border-gray-300 bg-white">
          <h1 className="font-bold text-base text-gray-800">{summary.title}</h1>
          <p className="text-xs text-gray-400 mt-1">
            集計期間：{summary.period_start} 〜 {summary.period_end}
          </p>
        </div>

        {/* スレッドランキング */}
        {threads.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white border border-gray-300">
            <p>この期間の投稿データがありません</p>
          </div>
        ) : (
          <div className="border border-gray-300 divide-y divide-gray-200 bg-white mb-4">
            {threads.map((thread, i) => (
              <Link
                key={thread.id}
                href={`/thread/${thread.id}`}
                className="flex items-start gap-3 px-3 py-3 hover:bg-gray-50 transition-colors"
              >
                {/* サムネイル */}
                {thread.image_url ? (
                  <img
                    src={thread.image_url}
                    alt={thread.title}
                    className="shrink-0 w-14 h-14 object-cover border border-gray-200"
                  />
                ) : (
                  <div className="shrink-0 w-14 h-14 bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 text-xs">
                    No img
                  </div>
                )}

                {/* テキスト */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-bold text-lg leading-none ${RANK_COLORS[i] ?? 'text-gray-500'}`}>
                      {RANK_LABELS[i] ?? `${i + 1}位`}
                    </span>
                    {thread.category_name && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full text-white shrink-0"
                        style={{ backgroundColor: thread.category_color ?? '#6b7280' }}
                      >
                        {thread.category_name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 font-medium line-clamp-2 leading-snug">
                    {thread.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    この期間の投稿数：<span className="font-semibold text-gray-600">{thread.activity}</span>件
                    ／ 総レス：{thread.post_count}件
                  </p>
                </div>

                <span className="text-xs text-gray-400 shrink-0 pt-0.5">▶</span>
              </Link>
            ))}
          </div>
        )}

        {/* 戻るリンク */}
        <div className="mb-3">
          <Link href="/summary" className="text-xs text-blue-600 hover:underline">
            ← まとめ一覧に戻る
          </Link>
        </div>

        <BottomNav current="/" />
        <div className="mb-6" />
      </div>
    </div>
  )
}
