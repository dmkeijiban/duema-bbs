import { Suspense } from 'react'
import { createPublicClient } from '@/lib/supabase-public'
import { ThreadCard } from '@/components/ThreadCard'
import { Pagination } from '@/components/Pagination'
import dynamic from 'next/dynamic'
const InlineNewThread = dynamic(
  () => import('@/components/InlineNewThread').then(m => m.InlineNewThread)
)
import { RecommendSection, RecommendSectionSkeleton } from '@/components/RecommendSection'
import { TopRankingShowcase, TopRankingShowcaseSkeleton } from '@/components/TopRankingShowcase'
import { BottomNav } from '@/components/ThreadSortPage'
import { withFallbackThumbnails } from '@/lib/thumbnail'
import { seededShuffle } from '@/lib/stable-shuffle'
import { Thread, Category } from '@/types'
import Link from 'next/link'
import { NoticeBlock, Notice } from '@/components/NoticeBlock'
import { SnsCtaCard } from '@/components/SnsCtaCard'
import { FeaturedSummaries } from '@/components/FeaturedSummaries'
import {
  getCachedCategories,
  getCachedActiveNotices,
  getCachedThreadList,
  POPULAR_PAGE_SIZE,
} from '@/lib/cached-queries'
import { SITE_URL } from '@/lib/site-config'
import type { Metadata } from 'next'
import { AdBanner } from '@/components/AdBanner'
import { getCategoryIdsForSlug } from '@/lib/categories'
import { ADSENSE_REVIEW_MODE, isAdSenseRiskyThreadTitle, isPrNoticeForAdSenseReview } from '@/lib/adsense-review-mode'
import { GreenCtaBanner } from '@/components/GreenCtaBanner'
import {
  filterPublicVisibleUserContent,
  getCachedPublicHiddenUserIds,
  getPublicVisibleUserContentOrFilter,
} from '@/lib/public-visibility'
import {
  applyActiveThreadFilter,
  applyLegacyActiveThreadFilter,
  isArchiveSchemaMissing,
} from '@/lib/thread-archive'

export const revalidate = 3600
const TOP_THREAD_PAGE_SIZE = 60

// 'ranking': TOP5ランキング表示（現在）
// 'threads': おすすめスレッド表示（元の動作に戻す場合はここを変更）
const HOME_RECOMMENDATION_MODE: 'ranking' | 'threads' = 'ranking'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const params = await searchParams
  if (!params.category) return {}
  const cats = await getCachedCategories()
  const cat = cats.find(c => c.slug === params.category)
  if (!cat) return {}
  const title = `${cat.name} | デュエマ掲示板`
  const description = `デュエマ掲示板の「${cat.name}」カテゴリ。デュエルマスターズに関するスレッドを投稿・閲覧できます。`
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/category/${cat.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/category/${cat.slug}`,
      type: 'website' as const,
      images: [{ url: `${SITE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [`${SITE_URL}/default-thumbnail.jpg`],
    },
  }
}

interface SearchParams {
  category?: string
  page?: string
  sort?: string
  q?: string
  archived?: string
  [key: string]: string | undefined
}

async function ThreadList({ searchParams }: { searchParams: SearchParams }) {
  const sort = searchParams.sort ?? 'recent'
  const searchQ = searchParams.q?.trim()
  const isArchived = sort === 'archived' || searchParams.archived === '1'
  const isRandom = sort === 'random'
  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const supabase = createPublicClient()

  const cats = await getCachedCategories()
  const categoryIds = searchParams.category ? getCategoryIdsForSlug(searchParams.category, cats) : []

  if (isRandom) {
    const hiddenUserIds = await getCachedPublicHiddenUserIds()
    const publicUserFilter = getPublicVisibleUserContentOrFilter(hiddenUserIds)
    let q = supabase
      .from('threads')
      .select('id, title, user_id, image_url, thumbnail_url, post_count, is_archived, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
    q = applyActiveThreadFilter(q)
    if (publicUserFilter) q = q.or(publicUserFilter)
    if (categoryIds.length === 1) q = q.eq('category_id', categoryIds[0])
    if (categoryIds.length > 1) q = q.in('category_id', categoryIds)
    q = q.limit(100)
    const randomResult = await q
    let raw = randomResult.data
    if (isArchiveSchemaMissing(randomResult.error)) {
      let retry = applyLegacyActiveThreadFilter(supabase
        .from('threads')
        .select('id, title, user_id, image_url, thumbnail_url, post_count, is_archived, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
      )
      if (publicUserFilter) retry = retry.or(publicUserFilter)
      if (categoryIds.length === 1) retry = retry.eq('category_id', categoryIds[0])
      if (categoryIds.length > 1) retry = retry.in('category_id', categoryIds)
      const retryResult = await retry.limit(100)
      raw = retryResult.data
    }
    const fetched = raw ? await withFallbackThumbnails(supabase, filterPublicVisibleUserContent(raw, hiddenUserIds)) : []
    const all = seededShuffle(ADSENSE_REVIEW_MODE ? fetched.filter(t => !isAdSenseRiskyThreadTitle(t.title)) : fetched)
    if (all.length === 0) return <ThreadEmpty searchQ={undefined} />
    return (
      <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
        {(all as unknown as (Thread & { categories: Category | null })[]).map((thread) => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}
      </div>
    )
  }

  if (searchQ) {
    const hiddenUserIds = await getCachedPublicHiddenUserIds()
    const publicUserFilter = getPublicVisibleUserContentOrFilter(hiddenUserIds)
    const offset = (page - 1) * TOP_THREAD_PAGE_SIZE
    let countQ = supabase
      .from('threads')
      .select('id', { count: 'exact', head: true })
      .eq('is_archived', isArchived)
      .ilike('title', `%${searchQ}%`)
    let dataQ = supabase
      .from('threads')
      .select('id, title, user_id, image_url, thumbnail_url, post_count, is_archived, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
      .eq('is_archived', isArchived)
      .ilike('title', `%${searchQ}%`)
    if (publicUserFilter) {
      countQ = countQ.or(publicUserFilter)
      dataQ = dataQ.or(publicUserFilter)
    }
    if (categoryIds.length === 1) {
      countQ = countQ.eq('category_id', categoryIds[0])
      dataQ = dataQ.eq('category_id', categoryIds[0])
    } else if (categoryIds.length > 1) {
      countQ = countQ.in('category_id', categoryIds)
      dataQ = dataQ.in('category_id', categoryIds)
    }
    dataQ = dataQ.order('last_posted_at', { ascending: false }).range(offset, offset + TOP_THREAD_PAGE_SIZE - 1)
    const [{ count }, { data: raw }] = await Promise.all([countQ, dataQ])
    const rawThreads = raw ? await withFallbackThumbnails(supabase, filterPublicVisibleUserContent(raw, hiddenUserIds)) : []
    const threads = ADSENSE_REVIEW_MODE ? rawThreads.filter(t => !isAdSenseRiskyThreadTitle(t.title)) : rawThreads
    if (threads.length === 0) return <ThreadEmpty searchQ={searchQ} />
    const totalPages = Math.max(1, Math.ceil((count ?? 0) / TOP_THREAD_PAGE_SIZE))
    return (
      <>
        <div className="mb-2 border border-gray-300 bg-white px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">「{searchQ}」の検索結果</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
            スレッドタイトルから{count}件見つかりました。気になる話題を開いて、続きから参加できます。
          </p>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
          {(threads as unknown as (Thread & { categories: Category | null })[]).map((thread) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
        <div className="mt-3">
          <Pagination currentPage={page} totalPages={totalPages} searchParams={searchParams} />
        </div>
      </>
    )
  }

  const result = await getCachedThreadList(sort, page, categoryIds.length > 0 ? categoryIds : null, isArchived, TOP_THREAD_PAGE_SIZE)
  const allThreads = result.threads as unknown as (Thread & { categories: Category | null })[]
  const threads = ADSENSE_REVIEW_MODE ? allThreads.filter(t => !isAdSenseRiskyThreadTitle(t.title)) : allThreads

  if (threads.length === 0) return <ThreadEmpty searchQ={undefined} />

  const pageSize = sort === 'popular' ? POPULAR_PAGE_SIZE : TOP_THREAD_PAGE_SIZE
  const listName = sort === 'popular' ? '人気スレッド' : sort === 'new' ? '新着スレッド' : '最新スレッド一覧'

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: listName,
            url: SITE_URL,
            numberOfItems: threads.length,
            itemListElement: threads.map((thread, i) => ({
              '@type': 'ListItem',
              position: (page - 1) * pageSize + i + 1,
              name: thread.title,
              url: `${SITE_URL}/thread/${thread.id}`,
            })),
          }),
        }}
      />
      {sort === 'popular' && (
        <div className="mb-2 px-3 py-1.5 border border-gray-300 bg-white flex items-baseline gap-2">
          <span className="font-bold text-sm text-gray-800">📊 人気スレッド</span>
          <span className="text-xs text-gray-600">（過去3日間 / 100位まで）</span>
        </div>
      )}
      <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
        {threads.map((thread, i) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            rank={sort === 'popular' ? i + 1 + (page - 1) * POPULAR_PAGE_SIZE : undefined}
            priority={i === 0}
          />
        ))}
      </div>
      {sort !== 'popular' && (
        <div className="mt-3">
          <Pagination currentPage={page} totalPages={result.totalPages} searchParams={searchParams} />
        </div>
      )}
    </>
  )
}

function ThreadEmpty({ searchQ }: { searchQ?: string }) {
  if (searchQ) {
    return (
      <div className="bg-white border border-gray-300 px-4 py-12 text-center">
        <h2 className="text-base font-bold text-gray-800">「{searchQ}」の検索結果がありません</h2>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-gray-600">
          別のカード名・デッキ名・略称で探すと見つかることがあります。まだ話題がなければ、新しいスレッドも立てられます。
        </p>
        <div className="mt-4 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          <Link href="/" className="inline-flex min-h-9 items-center justify-center border border-gray-300 bg-gray-50 px-4 text-sm font-bold text-gray-700 hover:bg-gray-100">
            トップに戻る
          </Link>
          <Link href="/thread/new" className="inline-flex min-h-9 items-center justify-center border border-blue-600 bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">
            スレを立てる
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-16 text-gray-500 bg-white border border-gray-300">
      <p>スレッドがまだありません</p>
      <Link href="/thread/new" className="mt-3 inline-block text-blue-600 hover:underline text-sm">
        最初のスレッドを立てる →
      </Link>
    </div>
  )
}

function HomeBannerFallback() {
  return <GreenCtaBanner />
}

function HomeBannerServer() {
  return <GreenCtaBanner />
}

async function TopNoticesServer() {
  const notices = (await getCachedActiveNotices()) as Notice[]
  const top = notices.filter(n => n.position === 'top' && !isPrNoticeForAdSenseReview(n.header_text))
  if (top.length === 0) return null
  return <>{top.map(n => <NoticeBlock key={n.id} notice={n} />)}</>
}

async function MidNoticesServer() {
  const notices = (await getCachedActiveNotices()) as Notice[]
  const mid = notices.filter(n => n.position === 'mid' && !isPrNoticeForAdSenseReview(n.header_text))
  if (mid.length === 0) return null
  return <>{mid.map(n => <NoticeBlock key={n.id} notice={n} />)}</>
}

async function BotNoticesServer() {
  const notices = (await getCachedActiveNotices()) as Notice[]
  const bot = notices.filter(n => n.position === 'bot' && !isPrNoticeForAdSenseReview(n.header_text))
  if (bot.length === 0) return null
  return <>{bot.map(n => <NoticeBlock key={n.id} notice={n} />)}</>
}

function currentNavFromSort(sort: string) {
  if (sort === 'new') return '/new'
  if (sort === 'popular') return '/ranking'
  if (sort === 'random') return '/random'
  return '/update'
}

async function BottomNavServer({ params }: { params: SearchParams }) {
  const categories = await getCachedCategories()
  const sort = params.sort ?? 'recent'
  return <BottomNav current={currentNavFromSort(sort)} currentCategory={params.category} categories={categories} />
}

async function InlineNewThreadServer() {
  const categories = await getCachedCategories()
  return <InlineNewThread categories={categories} />
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  const isConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http') &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!isConfigured) return <SetupGuide />

  const paramsKey = JSON.stringify(params)

  return (
    <div className="w-full px-0 py-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'DiscussionForum',
                '@id': `${SITE_URL}/#forum`,
                url: SITE_URL,
                name: 'デュエマ掲示板',
                headline: 'デュエマ掲示板 - デュエルマスターズ専門掲示板',
                text: 'デュエル・マスターズに関する話題、デッキ相談、カード評価、雑談を投稿できる掲示板です。',
                isPartOf: { '@id': `${SITE_URL}/#website` },
              },
              {
                '@type': 'WebSite',
                '@id': `${SITE_URL}/#website`,
                url: SITE_URL,
                name: 'デュエマ掲示板',
                potentialAction: {
                  '@type': 'SearchAction',
                  target: `${SITE_URL}/?q={search_term_string}`,
                  'query-input': 'required name=search_term_string',
                },
              },
            ],
          }),
        }}
      />
      <h1 className="sr-only">デュエマ掲示板 - デュエルマスターズ専門掲示板</h1>

      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        {HOME_RECOMMENDATION_MODE === 'ranking' ? (
          <Suspense fallback={<TopRankingShowcaseSkeleton />}>
            <TopRankingShowcase />
          </Suspense>
        ) : (
          <Suspense fallback={<RecommendSectionSkeleton />}>
            <RecommendSection />
          </Suspense>
        )}

        <Suspense fallback={<HomeBannerFallback />}>
          <HomeBannerServer />
        </Suspense>

        <Suspense fallback={null}>
          <TopNoticesServer />
        </Suspense>

        {ADSENSE_REVIEW_MODE && (
          <p className="text-center md:text-left text-xs text-gray-500 px-1 mt-1 mb-1 leading-normal md:whitespace-nowrap">
            <span className="md:hidden">
              デュエマのデッキ相談・カード談義・思い出話を<br />
              気軽に投稿できる掲示板です。
            </span>
            <span className="hidden md:inline">
              デュエマのデッキ相談・カード談義・思い出話を気軽に投稿できる掲示板です。
            </span>
          </p>
        )}

        <Suspense fallback={null}><FeaturedSummaries /></Suspense>
      </div>

      <div className="max-w-screen-xl mx-auto px-2">
        <Suspense fallback={null}>
          <MidNoticesServer />
        </Suspense>

        <Suspense fallback={<ThreadListSkeleton />} key={paramsKey}>
          <ThreadList searchParams={params} />
        </Suspense>

        <Suspense fallback={null}>
          <BottomNavServer params={params} />
        </Suspense>

        <AdBanner slot="5316786416" format="auto" style={{ margin: '8px 0' }} minHeight={0} />

        <Suspense fallback={null}>
          <BotNoticesServer />
        </Suspense>

        <Suspense fallback={null}>
          <InlineNewThreadServer />
        </Suspense>

        <SnsCtaCard />
      </div>
    </div>
  )
}

function SetupGuide() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-4">デュエマ掲示板</h1>
      <p className="text-gray-600 mb-6">
        Supabaseの環境変数が未設定です。
      </p>
      <div className="bg-gray-100 p-4 rounded text-left text-sm">
        <p className="font-bold mb-2">必要な環境変数:</p>
        <code className="block">NEXT_PUBLIC_SUPABASE_URL</code>
        <code className="block">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
      </div>
    </div>
  )
}

function ThreadListSkeleton() {
  return (
    <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300 animate-pulse">
      {[...Array(15)].map((_, i) => (
        <div key={i} className="bg-white border-b border-r border-gray-300 overflow-hidden">
          <div className="md:hidden flex" style={{ height: 52 }}>
            <div className="shrink-0 bg-gray-200" style={{ width: 52, height: 52 }} />
            <div className="px-1.5 py-1 flex-1 flex flex-col gap-1 justify-center">
              <div className="h-2 bg-gray-200 rounded w-full" />
              <div className="h-2 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
          <div className="hidden md:flex" style={{ height: 80 }}>
            <div className="shrink-0 bg-gray-200" style={{ width: 80, height: 80 }} />
            <div className="p-1.5 flex-1 flex flex-col gap-1 justify-center">
              <div className="h-3 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-full" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
