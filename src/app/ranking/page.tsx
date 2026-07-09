import { Suspense } from 'react'
import { createPublicClient } from '@/lib/supabase-public'
import { ThreadCard } from '@/components/ThreadCard'
import { SITE_URL } from '@/lib/site-config'
import { getCachedUserRankings, getCachedCampaignRanking, getCachedHonorTitleEnabled, UserRankingRow } from '@/lib/cached-queries'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { BottomNav } from '@/components/ThreadSortPage'
import { ThreadListHeader } from '@/components/ThreadListHeader'
import { ThreadListTopContent } from '@/components/ThreadListTopContent'
import { SnsCtaCard } from '@/components/SnsCtaCard'
import { AuthorRankingTabs } from '@/components/AuthorRankingTabs'
import { withFallbackThumbnails } from '@/lib/thumbnail'
import { applyActiveThreadFilter, applyLegacyActiveThreadFilter, isArchiveSchemaMissing } from '@/lib/thread-archive'
import { Thread, Category } from '@/types'
import Link from 'next/link'
import { resolveCampaignState, toDisplayJst } from '@/lib/campaign-ranking'
import { getHonorTitle, type HonorTitle } from '@/lib/honor-title'
import { HonorBadge } from '@/components/HonorBadge'
import {
  filterPublicVisibleUserContent,
  getCachedPublicHiddenUserIds,
  getPublicVisibleUserContentOrFilter,
} from '@/lib/public-visibility'

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

const PAGE_SIZE = 60

const rankDecoration = [
  {
    medal: '🥇',
    card: 'border-gray-300 bg-white',
    rank: 'text-gray-800',
    badge: 'bg-gray-800 text-white',
    avatar: 'bg-gray-100 text-gray-700 ring-gray-200',
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

function safeRankingSocialUrl(url: string | null | undefined, allowedHosts: string[]) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (!allowedHosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`))) {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

function RankingSocialLinks({
  xUrl,
  youtubeUrl,
}: {
  xUrl: string | null | undefined
  youtubeUrl: string | null | undefined
}) {
  const safeXUrl = safeRankingSocialUrl(xUrl, ['x.com', 'twitter.com'])
  const safeYoutubeUrl = safeRankingSocialUrl(youtubeUrl, [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
  ])

  if (!safeXUrl && !safeYoutubeUrl) return null

  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      {safeXUrl && (
        <a href={safeXUrl} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center rounded border border-gray-900 bg-gray-900 px-2 py-1 text-xs font-bold leading-none text-white hover:bg-gray-700">
          X
        </a>
      )}
      {safeYoutubeUrl && (
        <a href={safeYoutubeUrl} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center rounded border border-red-600 bg-red-600 px-2 py-1 text-xs font-bold leading-none text-white hover:bg-red-700">
          YouTube
        </a>
      )}
    </span>
  )
}

function CompactActivityBreakdown({
  threadCount,
  postCount,
  ratingCount,
  reviewCount,
}: {
  threadCount: number
  postCount: number
  ratingCount: number
  reviewCount: number
}) {
  return (
    <div className="min-w-0 flex flex-wrap items-center gap-x-2 text-xs text-gray-500 md:text-sm">
      <span>スレ{threadCount}</span>
      <span className="text-gray-300">/</span>
      <span>コメ{postCount}</span>
      <span className="text-gray-300">/</span>
      <span>評価{ratingCount}</span>
      <span className="text-gray-300">/</span>
      <span>レビュー{reviewCount}</span>
    </div>
  )
}

function RankingUserMeta({
  name,
  xUrl,
  youtubeUrl,
  href,
  honorTitle,
}: {
  name: string
  xUrl: string | null | undefined
  youtubeUrl: string | null | undefined
  href: string
  honorTitle?: HonorTitle | null
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Link href={href} className="text-sm font-bold text-blue-700 hover:underline">
          {name}
        </Link>
        <HonorBadge title={honorTitle} />
        <RankingSocialLinks xUrl={xUrl} youtubeUrl={youtubeUrl} />
      </div>
    </div>
  )
}

async function CampaignRankingSection() {
  const { settings, ranking: result } = await getCachedCampaignRanking()
  const state = resolveCampaignState(settings)

  // 未設定・無効・開始前は表示しない
  if (state === 'disabled' || state === 'scheduled') return null

  const isEnded = state === 'ended'

  // "2026/06/21 00:00" → "6/21"
  const toShortDate = (displayJst: string) => {
    const m = displayJst.match(/\d{4}\/(\d{2})\/(\d{2})/)
    return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : displayJst
  }

  const shortStartLabel = toShortDate(toDisplayJst(settings.startIso))
  const shortEndLabel = toShortDate(toDisplayJst(settings.endIso))

  return (
    <section className="mb-4 overflow-hidden border border-yellow-300 bg-yellow-50">
      <div className="border-b border-yellow-200 bg-yellow-100 px-3 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="text-[12px] leading-snug text-yellow-900">
            <span className="font-bold">🏆 {settings.title}{isEnded ? ' 結果' : ''}</span>
            <span className="text-yellow-700">｜期間：{shortStartLabel}〜{shortEndLabel}</span>
          </p>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
            isEnded
              ? 'border-gray-300 bg-white text-gray-600'
              : 'border-yellow-300 bg-white text-yellow-700'
          }`}>
            {isEnded ? '終了' : '開催中'}
          </span>
        </div>
      </div>
      {result.error ? (
        <div className="px-3 py-4 text-center text-sm text-red-500">
          集計データを取得できませんでした
        </div>
      ) : result.entries.length === 0 ? (
        <div className="px-3 py-6 text-center text-sm text-yellow-700">
          {isEnded ? 'ランキング対象者はいませんでした' : '期間中のポイントはまだありません'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 p-2 xl:grid-cols-2">
          {result.entries.map((entry) => {
            const deco = rankDecoration[entry.rank - 1]
            return (
              <div
                key={entry.profileSlug}
                className="grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)] items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm md:grid-cols-[2.5rem_2.5rem_minmax(12rem,1fr)_minmax(14rem,auto)]"
              >
                <div className="text-center font-mono font-black text-gray-700">
                  <span className="block text-lg leading-none">
                    {deco?.medal ?? entry.rank}
                  </span>
                  {entry.rank <= 3 && (
                    <span className="mt-1 block text-[10px] leading-none text-gray-500">{entry.rank}位</span>
                  )}
                </div>
                <Link href={`/u/${entry.profileSlug}`} aria-label={`${entry.displayName}の投稿者ページ`}>
                  {entry.avatarUrl ? (
                    <ProfileAvatar src={entry.avatarUrl} alt={`${entry.displayName}のアイコン`} size="md" />
                  ) : (
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 bg-yellow-50 text-yellow-700 ring-yellow-200"
                      aria-hidden="true"
                    >
                      {entry.displayName.trim().charAt(0) || '?'}
                    </span>
                  )}
                </Link>
                <RankingUserMeta
                  name={entry.displayName}
                  href={`/u/${entry.profileSlug}`}
                  xUrl={entry.xUrl}
                  youtubeUrl={entry.youtubeUrl}
                />
                <div className="col-span-3 flex flex-wrap items-center gap-x-6 gap-y-1 md:col-span-1">
                  <CompactActivityBreakdown
                    threadCount={entry.rawThreadCount}
                    postCount={entry.rawPostCount}
                    ratingCount={entry.rawRatingCount}
                    reviewCount={entry.rawReviewCount}
                  />
                  <div className={`ml-auto shrink-0 whitespace-nowrap font-mono text-xl font-black ${isEnded ? 'text-gray-700' : 'text-yellow-700'}`}>
                    {entry.totalPoints}pt
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function UserRankingList({
  title,
  periodLabel,
  rows,
  showHonorTitle = false,
  honorPointsBySlug = {},
}: {
  title: string
  periodLabel: string
  rows: UserRankingRow[]
  showHonorTitle?: boolean
  honorPointsBySlug?: Record<string, number>
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
        <div className="px-4 py-8 text-center">
          <h4 className="text-sm font-bold text-gray-800">まだランキング対象者はいません</h4>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-gray-600">
            アカウント作成後にスレッド投稿、コメント、思い出図鑑の評価・レビューをするとランキング対象になります。
          </p>
          <div className="mt-4 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
            <Link href="/login?mode=signup" className="inline-flex min-h-9 items-center justify-center border border-blue-600 bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">
              アカウント作成
            </Link>
            <Link href="/thread/new" className="inline-flex min-h-9 items-center justify-center border border-gray-300 bg-gray-50 px-4 text-sm font-bold text-gray-700 hover:bg-gray-100">
              スレを立てる
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2 p-2">
          {rows.map((row, index) => (
            <div
              key={row.profile_slug}
              className="grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)] items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm md:grid-cols-[2.5rem_2.5rem_minmax(12rem,1fr)_minmax(14rem,auto)]"
            >
              <div className="text-center font-mono font-black text-gray-700">
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
              <RankingUserMeta
                name={row.display_name}
                href={`/u/${row.profile_slug}`}
                xUrl={row.x_url}
                youtubeUrl={row.youtube_url}
                honorTitle={showHonorTitle ? getHonorTitle(honorPointsBySlug[row.profile_slug] ?? row.points) : null}
              />
              <div className="col-span-3 flex flex-wrap items-center gap-x-6 gap-y-1 md:col-span-1">
                <CompactActivityBreakdown
                  threadCount={row.thread_count}
                  postCount={row.post_count}
                  ratingCount={row.card_rating_count}
                  reviewCount={row.card_review_count + row.pack_review_count}
                />
                <div className="ml-auto shrink-0 whitespace-nowrap font-mono text-xl font-black text-blue-700">
                  {row.points}pt
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

async function UserRankingSection({ period }: { period: 'month' | 'all' }) {
  const [rankings, honorTitleEnabled] = await Promise.all([
    getCachedUserRankings(),
    getCachedHonorTitleEnabled(),
  ])

  // 称号はランキング期間ではなく累計活動ポイントで決める。
  // 月間ランキングの行でも、総合ランキング側の累計ポイントを優先してプロフィール表示と揃える。
  const honorPointsBySlug = Object.fromEntries(
    rankings.total.map(row => [row.profile_slug, row.points])
  )

  const note = (
    <p className="mb-3 border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
      ランキング・称号は、スレッド投稿・コメント・思い出図鑑の評価・思い出レビューなどの活動から集計しています。ランキングは1日1回更新されます。
    </p>
  )

  // 今月・総合の両データはここで一度に取得済み。
  // 期間切り替えはクライアントstate（AuthorRankingTabs）で表示のみ出し分けし、
  // URL遷移を伴わないためタブ切り替え時にスクロールが最上部へ戻らない。
  return (
    <AuthorRankingTabs
      initialPeriod={period}
      note={note}
      monthly={
        <UserRankingList
          title="今月のランキング"
          periodLabel="今月"
          rows={rankings.monthly}
          showHonorTitle={honorTitleEnabled}
          honorPointsBySlug={honorPointsBySlug}
        />
      }
      total={
        <UserRankingList
          title="総合ランキング"
          periodLabel="総合"
          rows={rankings.total}
          showHonorTitle={honorTitleEnabled}
          honorPointsBySlug={honorPointsBySlug}
        />
      }
    />
  )
}

type TypedThread = Thread & { categories: Category | null }

function ThreadRankingMobile({ threads, offset }: { threads: TypedThread[]; offset: number }) {
  return (
    <div className="md:hidden">
      <div className="grid grid-cols-3 border-l border-t border-gray-300">
        {threads.map((thread, i) => (
          <ThreadCard key={thread.id} thread={thread} rank={offset + i + 1} />
        ))}
      </div>
    </div>
  )
}

async function RankingList({ page, period }: { page: number; period: ThreadPeriod }) {
  const supabase = createPublicClient()
  const offset = (page - 1) * PAGE_SIZE
  const hiddenUserIds = await getCachedPublicHiddenUserIds()
  const publicUserFilter = getPublicVisibleUserContentOrFilter(hiddenUserIds)

  let dataQuery = applyActiveThreadFilter(supabase
    .from('threads')
    .select('*, categories(id,name,slug,color,description,sort_order)')
  )

  if (publicUserFilter) dataQuery = dataQuery.or(publicUserFilter)

  if (period !== 'all') {
    const since = new Date()
    since.setDate(since.getDate() - (period === 'today' ? 1 : 7))
    dataQuery = dataQuery.gte('last_posted_at', since.toISOString())
  }

  dataQuery = dataQuery
    .order('post_count', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const result = await dataQuery
  let rawThreads = result.data
  if (isArchiveSchemaMissing(result.error)) {
    let retryQuery = applyLegacyActiveThreadFilter(supabase
      .from('threads')
      .select('*, categories(id,name,slug,color,description,sort_order)')
    )
    if (publicUserFilter) retryQuery = retryQuery.or(publicUserFilter)
    if (period !== 'all') {
      const since = new Date()
      since.setDate(since.getDate() - (period === 'today' ? 1 : 7))
      retryQuery = retryQuery.gte('last_posted_at', since.toISOString())
    }
    const retry = await retryQuery
      .order('post_count', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    rawThreads = retry.data
  }

  const visibleThreads = filterPublicVisibleUserContent(rawThreads, hiddenUserIds)

  const withImages = visibleThreads.length > 0
    ? await withFallbackThumbnails(supabase, visibleThreads)
    : []

  if (withImages.length === 0) {
    return (
      <div className="border border-gray-300 bg-white px-4 py-12 text-center">
        <h2 className="text-base font-bold text-gray-800">ランキング対象のスレッドがまだありません</h2>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-gray-600">
          コメントが集まると人気スレッドとして表示されます。話したいカードやデッキがあれば、まずはスレッドを立ててみてください。
        </p>
        <div className="mt-4 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          <Link href="/thread/new" className="inline-flex min-h-9 items-center justify-center border border-blue-600 bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">
            スレを立てる
          </Link>
          <Link href="/" className="inline-flex min-h-9 items-center justify-center border border-gray-300 bg-gray-50 px-4 text-sm font-bold text-gray-700 hover:bg-gray-100">
            トップへ戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <ThreadRankingMobile threads={withImages} offset={offset} />
      <div className="hidden md:block border-l border-t border-gray-300 bg-white">
        <div className="grid grid-cols-5">
          {withImages.map((thread, i) => (
            <ThreadCard key={thread.id} thread={thread} rank={offset + i + 1} />
          ))}
        </div>
      </div>
    </>
  )
}

function Pagination({ page, period, hasNext }: { page: number; period: ThreadPeriod; hasNext: boolean }) {
  const baseParams = period === 'all' ? '' : `?period=${period}`
  const pageParam = baseParams ? `${baseParams}&page=` : '?page='

  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={`/ranking${page === 2 && baseParams ? baseParams : page === 2 ? '' : `${pageParam}${page - 1}`}`}
          className="inline-flex min-h-9 items-center border border-gray-300 bg-white px-4 text-sm font-bold text-blue-700 hover:bg-gray-50">
          前へ
        </Link>
      ) : (
        <span className="inline-flex min-h-9 items-center border border-gray-200 bg-gray-100 px-4 text-sm font-bold text-gray-400">
          前へ
        </span>
      )}
      <span className="text-xs text-gray-500">{page}ページ</span>
      {hasNext ? (
        <Link href={`/ranking${pageParam}${page + 1}`}
          className="inline-flex min-h-9 items-center border border-gray-300 bg-white px-4 text-sm font-bold text-blue-700 hover:bg-gray-50">
          次へ
        </Link>
      ) : (
        <span className="inline-flex min-h-9 items-center border border-gray-200 bg-gray-100 px-4 text-sm font-bold text-gray-400">
          次へ
        </span>
      )}
    </div>
  )
}

export default async function RankingPage({ searchParams }: { searchParams?: Promise<{ page?: string; period?: string; author?: string; type?: string }> }) {
  const params = await searchParams
  const page = Math.max(1, Number(params?.page || 1))
  const typeParam = params?.type
  const activeTab: 'thread' | 'author' = typeParam === 'author' || typeParam === 'users' ? 'author' : 'thread'
  const periodParam = params?.period
  const period: ThreadPeriod = periodParam === 'today' || periodParam === 'week' || periodParam === 'all' ? periodParam : 'all'
  const authorParam = params?.author
  const authorPeriod: 'month' | 'all' = authorParam === 'all' ? 'all' : 'month'

  return (
    <main className="max-w-screen-xl mx-auto px-3 py-4 md:px-4">
      <ThreadListHeader title="人気ランキング" icon="📊" />
      <ThreadListTopContent />
      <SnsCtaCard />

      {/* ランキング種別タブ */}
      <div className="mb-3 flex overflow-hidden border border-gray-300 bg-white">
        <Link
          href="/ranking?type=threads"
          scroll={false}
          className={`flex flex-1 items-center justify-center gap-1.5 border-r border-gray-300 py-2.5 text-sm font-bold transition-colors ${
            activeTab === 'thread'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          📋 スレッドランキング
        </Link>
        <Link
          href="/ranking?type=users"
          scroll={false}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-colors ${
            activeTab === 'author'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          👑 投稿者ランキング
        </Link>
      </div>

      {activeTab === 'author' ? (
        <section className="mb-6" aria-label="投稿者ランキング">
          <Suspense fallback={<div className="border border-gray-300 bg-white p-4 text-sm text-gray-500">投稿者ランキングを読み込み中...</div>}>
            <UserRankingSection period={authorPeriod} />
          </Suspense>
        </section>
      ) : (
        <section aria-label="人気スレッドランキング">
          <h1 className="mb-3 text-center text-xl font-bold text-gray-900">📊 スレッドランキング</h1>
          <Suspense key={`${period}-${page}`} fallback={<div className="border border-gray-300 bg-white p-6 text-center text-sm text-gray-500">ランキングを読み込み中...</div>}>
            <RankingList page={page} period={period} />
          </Suspense>
          <Pagination page={page} period={period} hasNext={true} />
        </section>
      )}

      <BottomNav />
    </main>
  )
}
