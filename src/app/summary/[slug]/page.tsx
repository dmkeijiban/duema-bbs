import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase-public'
import { RecommendSection } from '@/components/RecommendSection'
import { BottomNav } from '@/components/ThreadSortPage'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { Metadata } from 'next'
import { SummaryBodyRenderer } from '@/components/SummaryBodyRenderer'

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
  type: 'weekly' | 'monthly' | 'manual'
  slug: string
  title: string
  period_start: string
  period_end: string
  threads: SummaryThread[]
  created_at: string
  body: string | null
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

import { SITE_URL } from '@/lib/site-config'
const BASE_URL = SITE_URL

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const summary = await getSummary(slug)
  if (!summary) return {}
  const desc = summary.type === 'manual'
    ? (summary.body
        ? summary.body.replace(/\n/g, ' ').slice(0, 120)
        : `${summary.title}。デュエマ掲示板の注目スレッドをまとめて紹介します。`)
    : `${summary.period_start}〜${summary.period_end}の人気スレッドTOP5まとめ。デュエマ掲示板で盛り上がったスレッドをランキング形式で紹介します。`
  const url = `${BASE_URL}/summary/${slug}`
  return {
    title: `${summary.title} | デュエマ掲示板`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: summary.title,
      description: desc,
      url,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: summary.title,
      description: desc,
    },
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

async function getLivePostCounts(threadIds: number[]): Promise<Map<number, number>> {
  if (threadIds.length === 0) return new Map()
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('threads')
    .select('id, post_count')
    .in('id', threadIds)
  const map = new Map<number, number>()
  if (data) {
    for (const row of data) {
      map.set(row.id, row.post_count ?? 0)
    }
  }
  return map
}

export default async function SummarySlugPage({ params }: Props) {
  const { slug } = await params
  const summary = await getSummary(slug)

  if (!summary) notFound()

  const threads = summary.threads ?? []
  const threadIds = threads.map(t => t.id)
  const livePostCounts = await getLivePostCounts(threadIds)
  const hasBodyImage = /<img\b/i.test(summary.body ?? '')

  return (
    <div className="w-full px-0 py-0">
      {/* SEO: Article + ItemList 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: summary.title,
            url: `${BASE_URL}/summary/${summary.slug}`,
            datePublished: summary.created_at,
            description: summary.type === 'manual'
              ? (summary.body ? summary.body.replace(/\n/g, ' ').slice(0, 120) : `${summary.title}。デュエマ掲示板の注目スレッドまとめ。`)
              : `${summary.period_start}〜${summary.period_end}の人気スレッドTOP5まとめ。`,
            publisher: {
              '@type': 'Organization',
              name: 'デュエマ掲示板',
              url: BASE_URL,
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: summary.title,
            numberOfItems: threads.length,
            itemListElement: threads.map((t, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: t.title,
              url: `${BASE_URL}/thread/${t.id}`,
            })),
          }),
        }}
      />
      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        <Suspense fallback={null}>
          <RecommendSection />
        </Suspense>

        {/* パンくず */}
        <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1 flex-wrap">
          <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
          <span>{'>'}</span>
          <Link href="/summary" className="text-blue-600 hover:underline">まとめ一覧</Link>
          <span>{'>'}</span>
          <span className="truncate">{summary.title}</span>
        </nav>

        {/* ヘッダー */}
        <div className="mb-3 px-3 py-3 border border-gray-300 bg-white">
          <h1 className="font-bold text-base text-gray-800">{summary.title}</h1>
          {summary.type !== 'manual' && (
            <p className="text-xs text-gray-400 mt-1">
              集計期間：{summary.period_start} 〜 {summary.period_end}
            </p>
          )}
        </div>

        {/* 手書き本文（manualのみ） */}
        {summary.type === 'manual' && summary.body && (
          <div className="mb-3 px-4 py-4 border border-gray-300 bg-white">
            {!hasBodyImage && (
              <div className="relative mb-4 w-full max-w-xl aspect-[1200/630] bg-gray-100 border border-gray-200">
                <Image src="/default-thumbnail.jpg" alt="デュエマ掲示板の注目スレッドまとめ" fill className="object-cover" sizes="640px" priority />
              </div>
            )}
            <SummaryBodyRenderer body={summary.body} />
          </div>
        )}

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
                <div className="relative shrink-0 w-14 h-14 bg-gray-100 border border-gray-200 overflow-hidden">
                  <Image
                    src={thread.image_url ?? '/default-thumbnail.jpg'}
                    alt={thread.title}
                    fill
                    className={thread.image_url ? 'object-cover' : 'object-contain'}
                    sizes="56px"
                  />
                </div>

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
                    {summary.type !== 'manual' && (
                      <>この期間の投稿数：<span className="font-semibold text-gray-600">{thread.activity}</span>件 ／ </>
                    )}
                    総レス：{livePostCounts.get(thread.id) ?? thread.post_count}件
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
