import { Suspense } from 'react'
import { createPublicClient } from '@/lib/supabase-public'
import { ThreadRow } from '@/components/ThreadRow'
import { RecommendSection, RecommendSectionSkeleton } from '@/components/RecommendSection'
import { Pagination } from '@/components/Pagination'
import { SortTabs } from '@/components/SortTabs'
import { getCachedCategories } from '@/lib/cached-queries'
import { withFallbackThumbnails } from '@/lib/thumbnail'
import { seededShuffle } from '@/lib/stable-shuffle'
import { Thread, Category } from '@/types'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site-config'

const PAGE_SIZE = 50

export const NAV_LINKS = [
  { label: '↺ 更新順一覧', href: '/update' },
  { label: '⏱ 新着一覧',   href: '/new' },
  { label: '📊 ランキング', href: '/ranking' },
  { label: '🎲 ランダム',   href: '/random' },
  { label: '📁 カテゴリ', href: '/' },
]

interface Props {
  sort: 'recent' | 'new' | 'archived' | 'random'
  title: string
  icon: string
  page?: number
}

async function ThreadList({ sort, page = 1 }: { sort: string; page: number }) {
  const supabase = createPublicClient()
  const isArchived = sort === 'archived'
  const basePath = sort === 'recent' ? '/update' : sort === 'new' ? '/new' : sort === 'random' ? '/random' : '/archived'

  // ランダムは毎回シャッフルするためページネーション不要（常にPAGE_SIZE件ランダム表示）
  if (sort === 'random') {
    const { data: rawThreads } = await supabase
      .from('threads')
      .select('*, categories(id,name,slug,color,description,sort_order)')
      .eq('is_archived', false)
      .limit(500)
    const all = rawThreads ? await withFallbackThumbnails(supabase, rawThreads) : []
    const threads = seededShuffle(all).slice(0, PAGE_SIZE) as (Thread & { categories: Category | null })[]
    if (threads.length === 0) {
      return (
        <div className="text-center py-16 text-gray-500 bg-white border border-gray-300">
          スレッドがまだありません
        </div>
      )
    }
    return (
      <>
        {/* SEO: ItemList構造化データ — ランダムスレッド一覧をGoogleに伝える */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: 'ランダムスレッド',
              url: `${SITE_URL}/random`,
              numberOfItems: threads.length,
              itemListElement: threads.map((thread, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: thread.title,
                url: `${SITE_URL}/thread/${thread.id}`,
              })),
            }),
          }}
        />
        <div className="border border-gray-300 bg-white">
          {threads.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} />
          ))}
        </div>
      </>
    )
  }

  // 総件数取得
  const { count } = await supabase
    .from('threads')
    .select('*', { count: 'exact', head: true })
    .eq('is_archived', isArchived)
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('threads')
    .select('*, categories(id,name,slug,color,description,sort_order)')
    .eq('is_archived', isArchived)

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('last_posted_at', { ascending: false })
  }

  query = query.range(offset, offset + PAGE_SIZE - 1)
  const { data: rawThreads } = await query
  const threads = rawThreads ? await withFallbackThumbnails(supabase, rawThreads) : []

  if (threads.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 bg-white border border-gray-300">
        スレッドがまだありません
      </div>
    )
  }

  // 過去ログはグリッド、それ以外は横長リスト
  if (sort === 'archived') {
    const { ThreadCard } = await import('@/components/ThreadCard')
    return (
      <>
        <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
          {(threads as (Thread & { categories: Category | null })[]).map((thread, index) => (
            <ThreadCard key={thread.id} thread={thread} priority={index === 0} />
          ))}
        </div>
        <Pagination currentPage={page} totalPages={totalPages} basePath={basePath} />
      </>
    )
  }

  const listName = sort === 'new' ? '新着スレッド一覧' : '更新順スレッド一覧'
  const typedThreads = threads as (Thread & { categories: Category | null })[]

  return (
    <>
      {/* SEO: ItemList構造化データ — スレッド一覧をGoogleに伝える */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: listName,
            url: `${SITE_URL}${basePath}`,
            numberOfItems: typedThreads.length,
            itemListElement: typedThreads.map((thread, i) => ({
              '@type': 'ListItem',
              position: offset + i + 1,
              name: thread.title,
              url: `${SITE_URL}/thread/${thread.id}`,
            })),
          }),
        }}
      />
      <div className="border border-gray-300 bg-white">
        {typedThreads.map((thread) => (
          <ThreadRow key={thread.id} thread={thread} />
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath={basePath} />
    </>
  )
}

function SkeletonList() {
  return (
    <div className="border border-gray-300 bg-white animate-pulse">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="flex items-center border-b border-gray-200 gap-2 pr-3" style={{ height: 52 }}>
          <div className="bg-gray-200 shrink-0" style={{ width: 52, height: 52 }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-gray-200 rounded w-3/4" />
            <div className="h-2 bg-gray-100 rounded w-1/2" />
          </div>
          <div className="bg-gray-100 rounded h-2 w-10 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function BottomNav({ current }: { current?: string }) {
  const currentSort =
    current === '/new'
      ? 'new'
      : current === '/ranking'
        ? 'popular'
        : current === '/random'
          ? 'random'
          : 'recent'

  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-5">
      {NAV_LINKS.map((btn) => (
        <Link
          key={btn.href}
          href={btn.href}
          className={
            current === btn.href || (btn.href === '/update' && currentSort === 'recent')
              ? 'flex min-h-9 items-center justify-center rounded border border-blue-600 bg-blue-600 px-2 text-center text-xs font-bold text-white shadow-sm md:text-sm'
              : 'flex min-h-9 items-center justify-center rounded border border-blue-100 bg-white px-2 text-center text-xs font-medium text-blue-700 hover:bg-blue-50 md:text-sm'
          }
        >
          {btn.label}
        </Link>
      ))}
    </div>
  )
}

export async function ThreadSortPage({ sort, title, icon, page = 1 }: Props) {
  const categories = await getCachedCategories()

  return (
    <div className="w-full px-0 py-0">
      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        <Suspense fallback={<RecommendSectionSkeleton />}>
          <RecommendSection />
        </Suspense>

        <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
          <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
          <span>{'>'}</span>
          <span>{title}</span>
        </nav>

        <div className="mb-2 px-3 py-1.5 border border-gray-300 bg-white flex items-baseline gap-2">
          <h1 className="font-bold text-sm text-gray-800">{icon} {title}</h1>
        </div>
      </div>

      <SortTabs
        currentSort={sort}
        categories={categories}
        recentHref="/update"
        newHref="/new"
        rankingHref="/ranking"
        randomHref="/random"
      />

      <div className="max-w-screen-xl mx-auto px-2">
        <Suspense fallback={<SkeletonList />}>
          <ThreadList sort={sort} page={page} />
        </Suspense>
        <div className="mb-6" />
      </div>
    </div>
  )
}
