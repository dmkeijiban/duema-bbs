import { Suspense } from 'react'
import { createPublicClient } from '@/lib/supabase-public'
import { ThreadCard } from '@/components/ThreadCard'
import { SITE_URL } from '@/lib/site-config'
import { getCachedCategories, getCachedUserRankings, UserRankingRow } from '@/lib/cached-queries'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { BottomNav } from '@/components/ThreadSortPage'
import { ThreadListHeader } from '@/components/ThreadListHeader'
import { ThreadListTopContent } from '@/components/ThreadListTopContent'
import {
  fetchCampaignSettings,
  fetchCampaignRankingPublic,
  toDisplayJst,
  PublicCampaignEntry,
} from '@/lib/campaign-ranking'

export const revalidate = 3600

export const metadata = {
  title: '人気スレッドランキング | デュエマ掲示板',
  description: 'デュエマ（デュエルマスターズ）掲示板の人気スレッドランキング。直近3日間のレス数が多いスレッドを順位付きで表示します。',
  alternates: { canonical: `${SITE_URL}/ranking` },
  openGraph: {
    title: '人気スレッドランキング | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板の人気スレッドランキング。直近3日間のレス数が多いスレッドを順位付きで表示します。',
    url: `${SITE_URL}/ranking`,
    type: 'website' as const,
    images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: '人気スレッドランキング | デュエマ掲示板' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: '人気スレッドランキング | デュエマ掲示板',
    description: 'デュエマ（デュエルマスターズ）掲示板の人気スレッドランキング。直近3日間のレス数が多いスレッドを順位付きで表示します。',
    images: [`${SITE_URL}/default-thumbnail.jpg`],
  },
}
import { withFallbackThumbnails } from '@/lib/thumbnail'
import { Thread, Category } from '@/types'
import Link from 'next/link'

const PAGE_SIZE = 100

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
  subtitle,
  topLabel,
  rows,
  variant,
}: {
  title: string
  subtitle: string
  topLabel: string
  rows: UserRankingRow[]
  variant: 'monthly' | 'total'
}) {
  const sectionAccent =
    variant === 'monthly'
      ? 'border-blue-200 bg-blue-50/70 text-blue-800'
      : 'border-purple-200 bg-purple-50/70 text-purple-800'

  return (
    <section className="overflow-hidden border border-gray-300 bg-white">
      <div className={`border-b px-3 py-2 ${sectionAccent}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{title}</h3>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold">
            {variant === 'monthly' ? '今月' : '総合'}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-600">{subtitle}</p>
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

function CampaignRankingAvatar({ entry, rank }: { entry: PublicCampaignEntry; rank: number }) {
  if (entry.avatarUrl) {
    return <ProfileAvatar src={entry.avatarUrl} alt={`${entry.displayName}のアイコン`} size="md" />
  }
  const decoration = rankDecoration[rank - 1]
  const initial = entry.displayName.trim().charAt(0) || '?'
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

function CampaignRankingList({ entries }: { entries: PublicCampaignEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-gray-500">
        まだランキング対象の投稿はありません。
      </div>
    )
  }
  return (
    <div className="space-y-2 p-2">
      {entries.map((entry) => {
        const idx = entry.rank - 1
        return (
          <div
            key={entry.profileSlug}
            className={`grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              rankDecoration[idx]?.card ?? 'border-gray-200 bg-white'
            }`}
          >
            <div className={`text-center font-mono font-black ${rankDecoration[idx]?.rank ?? 'text-gray-500'}`}>
              <span className="block text-lg leading-none">{rankDecoration[idx]?.medal ?? entry.rank}</span>
              {idx < 3 && (
                <span className="mt-1 block text-[10px] leading-none text-gray-500">{entry.rank}位</span>
              )}
            </div>
            <Link href={`/u/${entry.profileSlug}`} aria-label={`${entry.displayName}の投稿者ページ`}>
              <CampaignRankingAvatar entry={entry} rank={entry.rank} />
            </Link>
            <div className="min-w-0">
              <Link href={`/u/${entry.profileSlug}`} className="font-bold text-blue-700 hover:underline">
                {entry.displayName}
              </Link>
              {entry.rank === 1 && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${rankDecoration[0].badge}`}>
                  1位
                </span>
              )}
              <div className="mt-0.5 text-xs text-gray-500">
                <span>スレッド{entry.threadCount}</span>
                <span className="ml-2">コメント{entry.postCount}</span>
                <span className="ml-2">レビュー{entry.reviewCount}</span>
                <span className="ml-2">評価{entry.ratingDays}日</span>
              </div>
            </div>
            <div className="whitespace-nowrap text-right font-mono text-base font-black text-blue-700">
              {entry.totalPoints}pt
            </div>
          </div>
        )
      })}
    </div>
  )
}

async function UserRankingSection({ period }: { period: string }) {
  const [rankings, campaignSettings] = await Promise.all([
    getCachedUserRankings(),
    fetchCampaignSettings(),
  ])

  const { status, title, startIso, endIso, prize, rulesUrl } = campaignSettings
  const showCampaign = ['active', 'ended', 'finalized'].includes(status) && !!startIso && !!endIso

  const validTabs = showCampaign ? ['campaign', 'monthly', 'total'] : ['monthly', 'total']
  const activeTab = validTabs.includes(period) ? period : (showCampaign ? 'campaign' : 'monthly')

  let campaignResult = null
  if (activeTab === 'campaign') {
    campaignResult = await fetchCampaignRankingPublic(startIso, endIso)
  }

  const tabLabel = (t: string) => t === 'campaign' ? 'キャンペーン' : t === 'monthly' ? '今月' : '総合'
  const tabHref = (t: string) => t === activeTab ? '#' : `?type=users&period=${t}`

  return (
    <section className="mt-2 mb-4">
      <div className="mb-2 border border-gray-200 bg-gray-50 px-3 py-2">
        <p className="text-xs leading-relaxed text-gray-500">
          登録後の投稿をもとにした試験運用中のランキングです。集計条件は今後変更される場合があります。
        </p>
      </div>

      {/* Sub-tab bar */}
      <div className="mb-3 flex gap-1 border-b border-gray-200">
        {validTabs.map((t) => (
          <Link
            key={t}
            href={tabHref(t)}
            className={`px-3 py-2 text-xs font-medium leading-none transition-colors ${
              t === activeTab
                ? 'border-b-2 border-blue-500 bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
            }`}
            style={{ minHeight: 32 }}
          >
            {tabLabel(t)}
          </Link>
        ))}
      </div>

      {activeTab === 'campaign' && (
        <>
          {/* Campaign info header */}
          <div className="mb-3 rounded border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs text-gray-700">
            {title && <div className="font-bold text-gray-800">{title}</div>}
            {startIso && endIso && (
              <div className="mt-1">
                期間：{toDisplayJst(startIso)} 〜 {toDisplayJst(endIso)}
              </div>
            )}
            {prize && <div className="mt-0.5">賞品：{prize}</div>}
            {rulesUrl && (
              <div className="mt-0.5">
                <a href={rulesUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  ルール・詳細はこちら
                </a>
              </div>
            )}
            {status !== 'finalized' && (
              <div className="mt-1 text-gray-500">※ 順位は暫定です。最終結果は集計後に確定します。</div>
            )}
          </div>
          {campaignResult?.error ? (
            <div className="px-3 py-6 text-center text-sm text-red-600">集計エラーが発生しました。</div>
          ) : (
            <CampaignRankingList entries={campaignResult?.entries ?? []} />
          )}
        </>
      )}

      {activeTab === 'monthly' && (
        <UserRankingList
          title="今月のランキング"
          subtitle="今月よく投稿している登録ユーザー"
          topLabel="今月1位"
          rows={rankings.monthly}
          variant="monthly"
        />
      )}

      {activeTab === 'total' && (
        <UserRankingList
          title="歴代ランキング"
          subtitle="登録後の投稿をもとにした総合順位"
          topLabel="総合1位"
          rows={rankings.total}
          variant="total"
        />
      )}
    </section>
  )
}

async function RankingList({ page }: { page: number }) {
  const supabase = createPublicClient()
  const recentSince = new Date()
  recentSince.setDate(recentSince.getDate() - 3)
  const since = recentSince.toISOString()
  const offset = (page - 1) * PAGE_SIZE

  // 過去3日間の件数確認
  const { count: recentCount } = await supabase
    .from('threads')
    .select('*', { count: 'exact', head: true })
    .eq('is_archived', false)
    .gte('last_posted_at', since)

  const useRecent = (recentCount ?? 0) >= PAGE_SIZE

  // データ取得
  let dataQuery = supabase
    .from('threads')
    .select('*, categories(id,name,slug,color,description,sort_order)')
    .eq('is_archived', false)
    .order('post_count', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (useRecent) {
    dataQuery = dataQuery.gte('last_posted_at', since)
  }

  const { data: rawThreads } = await dataQuery

  // 総ページ数
  const withImages = rawThreads && rawThreads.length > 0
    ? await withFallbackThumbnails(supabase, rawThreads)
    : []

  if (withImages.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 bg-white border border-gray-300">
        <p>スレッドがまだありません</p>
      </div>
    )
  }

  const typedThreads = withImages as (Thread & { categories: Category | null })[]

  return (
    <>
      {/* SEO: ItemList構造化データ — ランキング順リストをGoogleに伝える */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "人気スレッドランキング（過去3日間）",
            "description": "デュエマ掲示板の過去3日間でレス数が多い人気スレッドランキング",
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
      <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
        {typedThreads.map((thread, i) => (
          <ThreadCard key={thread.id} thread={thread} rank={offset + i + 1} />
        ))}
      </div>
    </>
  )
}

interface Props {
  searchParams: Promise<{ page?: string; tab?: string; type?: string; period?: string }>
}

export default async function RankingPage({ searchParams }: Props) {
  const { page: pageStr, tab: tabStr, type: typeStr, period: periodStr } = await searchParams

  // backward compat: ?tab=X → type=users, period=X
  const activeType: 'threads' | 'users' =
    typeStr === 'users' ? 'users'
    : typeStr === 'threads' ? 'threads'
    : tabStr ? 'users'
    : 'threads'

  // period for user ranking sub-tabs; fall back to ?tab for backward compat
  const period = periodStr ?? tabStr ?? ''

  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
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

      {/* Top-level tab bar */}
      <div className="border-b border-gray-300 bg-white">
        <div className="max-w-screen-xl mx-auto px-2 flex">
          <Link
            href="?type=threads"
            className={`px-4 py-3 text-sm font-bold transition-colors ${
              activeType === 'threads'
                ? 'border-b-2 border-blue-500 text-blue-700'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            📊 スレッドランキング
          </Link>
          <Link
            href="?type=users"
            className={`px-4 py-3 text-sm font-bold transition-colors ${
              activeType === 'users'
                ? 'border-b-2 border-blue-500 text-blue-700'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            👤 投稿者ランキング
          </Link>
        </div>
      </div>

      {activeType === 'threads' && (
        <ThreadListHeader title="人気スレッドランキング" icon="📊" subtitle="（過去3日間）" />
      )}

      <div className="max-w-screen-xl mx-auto px-2">
        {activeType === 'threads' && (
          <Suspense fallback={
            <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300 animate-pulse">
              {[...Array(15)].map((_, i) => (
                <div key={i} className="flex border-b border-r border-gray-300 bg-white" style={{ minHeight: 52 }}>
                  <div className="bg-gray-200 shrink-0" style={{ width: 52, height: 52 }} />
                  <div className="p-1.5 flex-1 space-y-1.5 pt-2">
                    <div className="h-2 bg-gray-200 rounded w-full" />
                    <div className="h-2 bg-gray-200 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          }>
            <RankingList page={page} />
          </Suspense>
        )}

        {activeType === 'users' && (
          <Suspense fallback={null}>
            <UserRankingSection period={period} />
          </Suspense>
        )}

        <BottomNav current="/ranking" categories={categories} />
        <div className="mb-6" />
      </div>
    </div>
  )
}
