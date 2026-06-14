import { Suspense } from 'react'
import { createPublicClient } from '@/lib/supabase-public'
import { ThreadCard } from '@/components/ThreadCard'
import { SITE_URL } from '@/lib/site-config'
import { getCachedCategories, getCachedUserRankings, UserRankingRow } from '@/lib/cached-queries'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { BottomNav } from '@/components/ThreadSortPage'

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

async function UserRankingSection() {
  const rankings = await getCachedUserRankings()

  return (
    <section className="mt-4 mb-4">
      <div className="mb-2 border border-gray-300 bg-white px-3 py-2">
        <h2 className="text-sm font-bold text-gray-800">投稿者ランキング</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          登録後の投稿をもとにした試験運用中のランキングです。集計条件は今後変更される場合があります。
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <UserRankingList
          title="今月のランキング"
          subtitle="今月よく投稿している登録ユーザー"
          topLabel="今月1位"
          rows={rankings.monthly}
          variant="monthly"
        />
        <UserRankingList
          title="歴代ランキング"
          subtitle="登録後の投稿をもとにした総合順位"
          topLabel="総合1位"
          rows={rankings.total}
          variant="total"
        />
      </div>
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
  searchParams: Promise<{ page?: string }>
}

export default async function RankingPage({ searchParams }: Props) {
  const { page: pageStr } = await searchParams
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

      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        {/* パンくず */}
        <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
          <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
          <span>{'>'}</span>
          <span>人気スレッドランキング</span>
        </nav>

        {/* ランキングヘッダー */}
        <div className="mb-2 px-3 py-2 border border-gray-300 bg-white flex items-baseline gap-2">
          <h1 className="font-bold text-sm text-gray-800">📊 人気スレッドランキング</h1>
          <span className="text-xs text-gray-500">（過去3日間）</span>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-2">
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

        <Suspense fallback={null}>
          <UserRankingSection />
        </Suspense>

        <BottomNav current="/ranking" categories={categories} />
        <div className="mb-6" />
      </div>
    </div>
  )
}
