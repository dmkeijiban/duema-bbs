import { notFound } from 'next/navigation'
import { createPublicClient } from '@/lib/supabase-public'
import { RecommendSection } from '@/components/RecommendSection'
import { BottomNav } from '@/components/ThreadSortPage'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { Metadata } from 'next'
import { SummaryBodyRenderer } from '@/components/SummaryBodyRenderer'
import { DEFAULT_THREAD_THUMBNAIL } from '@/lib/thumbnail'
import { SummaryActionBar } from '@/components/SummaryActionBar'
import { SummaryViewPing } from '@/components/SummaryViewPing'
import { SummaryCommentSection, SummaryComment } from '@/components/SummaryCommentSection'
import { summaryTextExcerpt, sanitizeSummaryHtml } from '@/lib/summary-content'

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
  view_count?: number | null
  comment_count?: number | null
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
        ? summaryTextExcerpt(summary.body, 120)
        : `${summary.title}。デュエマ掲示板の注目スレッドをまとめて紹介します。`)
    : `${summary.period_start}〜${summary.period_end}の人気スレッドTOP10まとめ。デュエマ掲示板で盛り上がったスレッドをランキング形式で紹介します。`
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
      images: [{ url: `${BASE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: summary.title }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: summary.title,
      description: desc,
      images: [`${BASE_URL}/default-thumbnail.jpg`],
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

async function getSummaryComments(slug: string): Promise<{ comments: SummaryComment[]; enabled: boolean }> {
  const supabase = createPublicClient()
  try {
    const commentThreadTitle = `[summary-comment] ${slug}`
    const { data: thread } = await supabase
      .from('threads')
      .select('id')
      .eq('title', commentThreadTitle)
      .maybeSingle()

    if (!thread?.id) return { comments: [], enabled: true }

    const { data, error } = await supabase
      .from('posts')
      .select('id, post_number, body, author_name, created_at')
      .eq('thread_id', thread.id)
      .eq('is_deleted', false)
      .order('post_number', { ascending: true })
      .limit(100)
    if (error) return { comments: [], enabled: false }
    const comments = (data ?? []).map(post => ({
      id: post.id,
      comment_number: post.post_number,
      body: post.body,
      author_name: post.author_name,
      created_at: post.created_at,
    })) as SummaryComment[]
    return { comments, enabled: true }
  } catch {
    return { comments: [], enabled: false }
  }
}

export default async function SummarySlugPage({ params }: Props) {
  const { slug } = await params
  const summary = await getSummary(slug)

  if (!summary) notFound()

  const threads = summary.threads ?? []
  const threadIds = threads.map(t => t.id)
  const [livePostCounts, commentsResult] = await Promise.all([
    getLivePostCounts(threadIds),
    summary.type === 'manual' ? getSummaryComments(summary.slug) : Promise.resolve({ comments: [], enabled: false }),
  ])
  const safeBody = sanitizeSummaryHtml(summary.body ?? '')
  const hasBodyImage = /<img\b/i.test(safeBody)
  const description = summary.type === 'manual'
    ? summaryTextExcerpt(safeBody, 160)
    : `${summary.period_start}〜${summary.period_end}の人気スレッドTOP10まとめ。`

  return (
    <div className="w-full px-0 py-0">
      {summary.type === 'manual' && <SummaryViewPing slug={summary.slug} />}
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
            description,
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
        <div className="mb-3 px-4 py-4 md:px-6 md:py-5 border border-gray-300 bg-white">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-extrabold text-2xl md:text-[32px] leading-snug text-gray-900">{summary.title}</h1>
            {summary.type === 'manual' && (
              <div className="shrink-0">
                <SummaryActionBar slug={summary.slug} title={summary.title} />
              </div>
            )}
          </div>
          {summary.type !== 'manual' && (
            <p className="text-xs text-gray-400 mt-1">
              集計期間：{summary.period_start} 〜 {summary.period_end}
            </p>
          )}
          {summary.type === 'manual' && (
            <p className="text-xs text-gray-500 mt-2">
              コメント {commentsResult.comments.length}件 ／ 閲覧 {summary.view_count ?? 0}
            </p>
          )}
        </div>

        {/* 手書き本文（manualのみ） */}
        {summary.type === 'manual' && summary.body && (
          <div className="mb-3 px-4 py-6 md:px-8 md:py-8 border border-gray-300 bg-white">
            {!hasBodyImage && (
              <div className="relative mb-6 mx-auto w-full max-w-2xl aspect-[1200/630] bg-gray-100 border border-gray-200">
                <Image src="/default-thumbnail.jpg" alt="デュエマ掲示板の注目スレッドまとめ" fill className="object-cover" sizes="640px" priority />
              </div>
            )}
            <SummaryBodyRenderer body={safeBody} />
          </div>
        )}

        {summary.type === 'manual' && (
          <>
            <Suspense fallback={null}>
              <RecommendSection title={`${summary.title} ${description}`} />
            </Suspense>
            <SummaryCommentSection
              summaryId={summary.id}
              slug={summary.slug}
              title={summary.title}
              comments={commentsResult.comments}
              enabled={commentsResult.enabled}
            />
          </>
        )}

        {/* スレッドランキング */}
        {summary.type === 'manual' && threads.length === 0 ? null : threads.length === 0 ? (
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
                    src={thread.image_url ?? DEFAULT_THREAD_THUMBNAIL}
                    alt={thread.title}
                    fill
                    className="object-cover"
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
