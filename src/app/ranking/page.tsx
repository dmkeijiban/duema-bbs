import { Suspense } from 'react'
import { createPublicClient } from '@/lib/supabase-public'
import { ThreadCard } from '@/components/ThreadCard'
import { SITE_URL } from '@/lib/site-config'
import { getCachedCategories, getCachedUserRankings, UserRankingRow } from '@/lib/cached-queries'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { BottomNav } from '@/components/ThreadSortPage'
import { ThreadListHeader } from '@/components/ThreadListHeader'
import { ThreadListTopContent } from '@/components/ThreadListTopContent'
import { withFallbackThumbnails } from '@/lib/thumbnail'
import { Thread, Category } from '@/types'
import Link from 'next/link'

export const revalidate = 3600

export const metadata = {
  title: '人気スレッドランキング | デュエマ掲示板',
  description: 'デュエマ（デュエルマスターズ）掲示板の人気スレッドランキング。今日・今週・総合でレス数が多いスレッドを順位付きで表示します。',
  alternates: { canonical: `${SITE_URL}/ranking` },
  openGraph: {
    title: '人気スレッドランキング | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板の人気スレッドランキング。今日・今週・総合でレス数が多いスレッドを順位付きで表示します。',
    url: `${SITE_URL}/ranking`,
    type: 'website' as const,
    images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: '人気スレッドランキング | デュエマ掲示板' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: '人気スレッドランキング | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板の人気スレッドランキング。今日・今週・総合でレス数が多いスレッドを順位付きで表示します。',
    images: [`${SITE_URL}/default-thumbnail.jpg`],
  },
}

type ThreadPeriod = 'today' | 'week' | 'all'

const PAGE_SIZE = 50

const rankDecoration = [
  {
    medal: '🥇',
    card: 'border-yellow-300 bg-yellow-50/80 shadow-sm',
    rank: 'text-yellow-700',
    badge: 'bg-yellow-500 text-white',
    avatar: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  },
  {
    medal: '🥈',
    card: 'border-gray-300 bg-gray-50/90',
    rank: 'text-gray-600',
    badge: 'bg-gray-500 text-white',
    avatar: 'bg-gray-100 text-gray-600 ring-gray-200',
  },
  {
    medal: '🥉',
    card: 'border-orange-300 bg-orange-50/80',
    rank: 'text-orange-700',
    badge: 'bg-orange-500 text-white',
    avatar: 'bg-orange-100 text-orange-700 ring-orange-200',
  },
]

function RankingAvatar({ row, rank }: { row: UserRankingRow; rank: number }) {
  if (row.avatar_url) {
    return <ProfileAvatar src={row.avatar_url} alt={`${row.display_name}のアイコン`} size="md" />
  }

  const decoration = rankDecoration[rank - 1]
  const initial = row.display_name.trim().charAt(0) || '?'

  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ${
        decoration?.avatar ?? 'bg-blue-50 text-blue-700 ring-blue-100'
      }`}
      aria-hidden="true"
    >
      {initial}
    </span>
  )
}

function UserRankingList({
  title,
  periodLabel,
  topLabel,
  rows,
}: {
  title: string
  periodLabel: string
  topLabel: string
  rows: UserRankingRow[]
}) {
  return (
    <section className="overflow-hidden border border-gray-300 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          <span className="rounded-full border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-[11px] font-bold text-yellow-700">
            {periodLabel}
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-6 text-center text-sm text-gray-500">
          まだランキング対象者はいません
        </div>
      ) : (
        <div className="space-y-2 p-2">
          {rows.map((row, index) => (
            <div
              key={row.profile_slug}
              className={`grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                rankDecoration[index]?.card ?? 'border-gray-200 bg-white'
              }`}
            >
              <div className={`text-center font-mono font-black ${rankDecoration[index]?.rank ?? 'text-gray-500'}`}>
                <span className="block text-lg leading-none">{rankDecoration[index]?.medal ?? index + 1}</span>
                {index < 3 && (
                  <span className="mt-1 block text-[10px] leading-none text-gray-500">
                    {index + 1}位
                  </span>
                )}
              </div>
              <Link href={`/u/${row.profile_slug}`} aria-label={`${row.display_name}の投稿者ページ`}>
                <RankingAvatar row={row} rank={index + 1} />
              </Link>
              <div className="min-w-0">
                <Link
                  href={`/u/${row.profile_slug}`}
                  className="font-bold text-blue-700 hover:underline"
                >
                  {row.display_name}
                </Link>
                {index === 0 && (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${rankDecoration[0].badge}`}>
                    {topLabel}
                  </span>
                )}
                <div className="mt-0.5 text-xs text-gray-500">
                  <span>コメント{row.post_count}件</span>
                  <span className="ml-2">スレッド{row.thread_count}件</span>
                  <span className="ml-2 font-mono text-gray-400">@{row.profile_slug}</span>
                </div>
              </div>
              <div className="whitespace-nowrap text-right font-mono text-base font-black text-blue-700">
                {row.points}pt
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

async function UserRankingSection({ period }: { period: 'month' | 'all' }) {
  const rankings = await getCachedUserRankings()
  const rows = period === 'month' ? rankings.monthly : rankings.total
  const title = period === 'month' ? '今月のランキング' : '総合ランキング'
  const periodLabel = period === 'month' ? '今月' : '総合'
  const topLabel = period === 'month' ? '今月1位' : '総合1位'

  return (
    <section className="mb-4 mt-4">
      <div className="mb-3 border border-gray-300 bg-white px-3 py-2">
        <h2 className="text-sm font-bold text-gray-800">投稿者ランキング</h2>
      </div>
      {/* 期間サブタブ */}
      <div className="mb-3 flex overflow-hidden border border-gray-300 bg-white">
        <Link
          href="/ranking?type=author&period=month"
          className={`flex-1 border-r border-gray-300 py-2 text-center text-sm font-bold transition-colors ${
            period === 'month'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          今月
        </Link>
        <Link
          href="/ranking?type=author&period=all"
          className={`flex-1 py-2 text-center text-sm font-bold transition-colors ${
            period === 'all'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          総合
        </Link>
      </div>
      <UserRankingList
        title={title}
        periodLabel={periodLabel}
        topLabel={topLabel}
        rows={rows}
      />
    </section>
  )
}

type TypedThread = Thread & { categories: Category | null }

function ThreadRankingMobile({ threads, offset }: { threads: TypedThread[]; offset: number }) {
  const first = threads[0]
  const top10 = threads.slice(1, 10)
  const rest = threads.slice(10)

  return (
    <div className="md:hidden">
      {/* 1位: 横長特別カード */}
      {first && (
        <Link
          href={`/thread/${first.id}`}
          className="mb-2 flex items-center gap-3 border border-yellow-300 bg-yellow-50/80 px-4 py-3 shadow-sm"
        >
          <div className="shrink-0 text-center">
            <div className="text-3xl leading-none">🥇</div>
            <div className="mt-0.5 text-[10px] font-bold text-yellow-700">1位</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-sm font-bold leading-snug text-gray-900">
              {first.title}
            </div>
            <div className="mt-1 text-xs text-gray-500">レス{first.post_count}</div>
          </div>
          {first.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={first.image_url}
              alt=""
              className="h-14 w-14 shrink-0 object-cover"
              width={56}
              height={56}
            />
          )}
        </Link>
      )}

      {/* 2〜10位: カード表示 */}
      {top10.length > 0 && (
        <div className="mb-2 grid grid-cols-3 border-l border-t border-gray-300">
          {top10.map((thread, i) => (
            <ThreadCard key={thread.id} thread={thread} rank={offset + i + 2} />
          ))}
        </div>
      )}

      {/* 11〜50位: 軽量リスト */}
      {rest.length > 0 && (
        <div className="border border-gray-300 bg-white">
          {rest.map((thread, i) => (
            <Link
              key={thread.id}
              href={`/thread/${thread.id}`}
              className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-gray-50"
            >
              <span className="w-8 shrink-0 text-center font-mono text-xs text-gray-400">
                {offset + i + 11}
              </span>
              <span className="line-clamp-1 min-w-0 flex-1 text-xs text-gray-800">
                {thread.title}
              </span>
              <span className="shrink-0 text-xs text-gray-400">
                レス{thread.post_count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

async function RankingList({ page, period }: { page: number; period: ThreadPeriod }) {
  const supabase = createPublicClient()
  const offset = (page - 1) * PAGE_SIZE

  let dataQuery = supabase
    .from('threads')
    .select('*, categories(id,name,slug,color,description,sort_order)')
    .eq('is_archived', false)
    .order('post_count', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (period !== 'all') {
    const since = new Date()
    since.setDate(since.getDate() - (period === 'today' ? 1 : 7))
    dataQuery = dataQuery.gte('last_posted_at', since.toISOString())
  }

  const { data: rawThreads } = await dataQuery

  const withImages = rawThreads && rawThreads.length > 0
    ? await withFallbackThumbnails(supabase, rawThreads)
    : []

  if (withImages.length === 0) {
    return (
      <div className="border border-gray-300 bg-white py-16 text-center text-gray-500">
        <p>スレッドがまだありません</p>
      </div>
    )
  }

  const typedThreads = withImages as TypedThread[]

  return (
    <>
      {/* SEO: ItemList構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "人気スレッドランキング",
            "description": "デュエマ掲示板の人気スレッドランキング",
            "url": `${SITE_URL}/ranking`,
            "numberOfItems": typedThreads.length,
            "itemListElement": typedThreads.map((thread, i) => ({
              "@type": "ListItem",
              "position": offset + i + 1,
              "name": thread.title,
              "url": `${SITE_URL}/thread/${thread.id}`,
            })),
          }),
        }}
      />

      {/* モバイル: 1位カード + 2-10位グリッド + 11-50位リスト */}
      <ThreadRankingMobile threads={typedThreads} offset={offset} />

      {/* デスクトップ: グリッド */}
      <div className="hidden md:grid md:grid-cols-5 border-l border-t border-gray-300">
        {typedThreads.map((thread, i) => (
          <ThreadCard key={thread.id} thread={thread} rank={offset + i + 1} />
        ))}
      </div>
    </>
  )
}

interface Props {
  searchParams: Promise<{ page?: string; type?: string; period?: string }>
}

const THREAD_PERIOD_LABELS: Record<ThreadPeriod, string> = {
  today: '今日',
  week: '今週',
  all: '総合',
}

export default async function RankingPage({ searchParams }: Props) {
  const { page: pageStr, type: typeParam, period: periodParam } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  const activeTab = typeParam === 'author' ? 'author' : 'thread'
  const activePeriod = periodParam === 'all' ? 'all' : 'month'
  const threadPeriod: ThreadPeriod =
    periodParam === 'today' ? 'today' : periodParam === 'all' ? 'all' : 'week'
  const categories = await getCachedCategories()

  return (
    <div className="w-full px-0 py-0">
      {/* SEO: BreadcrumbList + WebPage 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "TOP", "item": SITE_URL },
                { "@type": "ListItem", "position": 2, "name": "人気スレッドランキング", "item": `${SITE_URL}/ranking` },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "@id": `${SITE_URL}/ranking#webpage`,
              "url": `${SITE_URL}/ranking`,
              "name": "人気スレッドランキング | デュエマ掲示板",
              "isPartOf": { "@id": `${SITE_URL}/#website` },
              "publisher": { "@id": `${SITE_URL}/#organization` },
              "inLanguage": "ja",
            },
          ]),
        }}
      />

      <ThreadListTopContent showPopularThreads={false} />

      <ThreadListHeader
        title="人気スレッドランキング"
        icon="📊"
        subtitle={activeTab === 'thread' ? `（${THREAD_PERIOD_LABELS[threadPeriod]}）` : undefined}
      />

      <div className="mx-auto max-w-screen-xl px-2">
        {/* タブナビゲーション */}
        <div className="mb-3 flex overflow-hidden border border-gray-300 bg-white">
          <Link
            href="/ranking?type=thread&period=week"
            className={`flex flex-1 items-center justify-center gap-1.5 border-r border-gray-300 py-2.5 text-sm font-bold transition-colors ${
              activeTab === 'thread'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            📋 スレッドランキング
          </Link>
          <Link
            href="/ranking?type=author&period=month"
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-colors ${
              activeTab === 'author'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            👑 投稿者ランキング
          </Link>
        </div>

        {activeTab === 'thread' ? (
          <>
            {/* 期間サブタブ */}
            <div className="mb-3 flex overflow-hidden border border-gray-300 bg-white">
              {(['today', 'week', 'all'] as const).map((p, i, arr) => (
                <Link
                  key={p}
                  href={`/ranking?type=thread&period=${p}`}
                  className={`flex-1 py-2 text-center text-sm font-bold transition-colors ${
                    i < arr.length - 1 ? 'border-r border-gray-300' : ''
                  } ${
                    threadPeriod === p
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {THREAD_PERIOD_LABELS[p]}
                </Link>
              ))}
            </div>
            <Suspense fallback={
              <div className="animate-pulse">
                <div className="mb-2 h-20 border border-gray-200 bg-gray-100 md:hidden" />
                <div className="mb-2 grid grid-cols-3 border-l border-t border-gray-300 md:hidden">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="flex border-b border-r border-gray-300 bg-white" style={{ minHeight: 52 }}>
                      <div className="bg-gray-200 shrink-0" style={{ width: 52, height: 52 }} />
                      <div className="flex-1 space-y-1.5 p-1.5 pt-2">
                        <div className="h-2 w-full rounded bg-gray-200" />
                        <div className="h-2 w-4/5 rounded bg-gray-200" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden border-l border-t border-gray-300 md:grid md:grid-cols-5">
                  {[...Array(15)].map((_, i) => (
                    <div key={i} className="flex border-b border-r border-gray-300 bg-white" style={{ minHeight: 52 }}>
                      <div className="bg-gray-200 shrink-0" style={{ width: 52, height: 52 }} />
                      <div className="flex-1 space-y-1.5 p-1.5 pt-2">
                        <div className="h-2 w-full rounded bg-gray-200" />
                        <div className="h-2 w-4/5 rounded bg-gray-200" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            }>
              <RankingList page={page} period={threadPeriod} />
            </Suspense>
          </>
        ) : (
          <Suspense fallback={null}>
            <UserRankingSection period={activePeriod} />
          </Suspense>
        )}

        <BottomNav current="/ranking" categories={categories} />
        <div className="mb-6" />
      </div>
    </div>
  )
}
