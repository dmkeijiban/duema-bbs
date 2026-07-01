import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createPublicClient } from '@/lib/supabase-public'
import { ThreadCard } from '@/components/ThreadCard'
import { Pagination } from '@/components/Pagination'
import dynamic from 'next/dynamic'
const InlineNewThread = dynamic(
  () => import('@/components/InlineNewThread').then(m => m.InlineNewThread)
)
import { RecommendSection } from '@/components/RecommendSection'
import { BottomNav } from '@/components/ThreadSortPage'
import { withFallbackThumbnails } from '@/lib/thumbnail'
import { seededShuffle } from '@/lib/stable-shuffle'
import { Thread, Category } from '@/types'
import Link from 'next/link'
import { NoticeBlock, Notice } from '@/components/NoticeBlock'
import {
  getCachedCategories,
  getCachedActiveNotices,
  getCachedSetting,
  getCachedThreadList,
  THREAD_PAGE_SIZE,
} from '@/lib/cached-queries'
import {
  CONSOLIDATED_CATEGORIES,
  getCategoryIdsForSlug,
  getDisplayCategoryBySlug,
} from '@/lib/categories'
import {
  filterPublicVisibleUserContent,
  getCachedPublicHiddenUserIds,
  getPublicVisibleUserContentOrFilter,
} from '@/lib/public-visibility'

export const revalidate = 3600

import { SITE_URL } from '@/lib/site-config'
const BASE_URL = SITE_URL

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sort?: string; page?: string }>
}

function getCategoryDescription(category: { name: string; description?: string | null }) {
  return category.description
    ? `${category.description}について語るデュエマ掲示板のカテゴリです。`
    : `デュエルマスターズ（デュエマ）の「${category.name}」について語る掲示板カテゴリです。`
}

export async function generateStaticParams() {
  const cats = await getCachedCategories()
  const slugs = new Set([
    ...cats.map(c => c.slug),
    ...CONSOLIDATED_CATEGORIES.map(c => c.slug),
  ])
  return [...slugs].map(slug => ({ slug }))
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const cats = await getCachedCategories()
  const category = getDisplayCategoryBySlug(slug, cats)
  if (!category) return { title: 'カテゴリが見つかりません' }

  const desc = getCategoryDescription(category)

  return {
    title: `${category.name}のスレッド一覧 | デュエマ掲示板`,
    description: desc,
    alternates: {
      canonical: `${BASE_URL}/category/${slug}`,
    },
    openGraph: {
      title: `${category.name}のスレッド一覧 | デュエマ掲示板`,
      description: desc,
      url: `${BASE_URL}/category/${slug}`,
      type: 'website',
      images: [{ url: `${BASE_URL}/default-thumbnail.jpg`, width: 1200, height: 630, alt: `${category.name}のスレッド一覧 | デュエマ掲示板` }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: `${category.name}のスレッド一覧 | デュエマ掲示板`,
      description: desc,
      images: [`${BASE_URL}/default-thumbnail.jpg`],
    },
  }
}

async function CategoryThreadList({
  category,
  categoryIds,
  sort,
  page,
}: {
  category: { id: number; name: string; slug: string }
  categoryIds: number[]
  sort: string
  page: number
}) {
  const isArchived = sort === 'archived'
  const isRandom = sort === 'random'
  const supabase = createPublicClient()
  const basePath = `/category/${category.slug}`

  // ── ランダム（キャッシュ不適）
  if (isRandom) {
    const hiddenUserIds = await getCachedPublicHiddenUserIds()
    const publicUserFilter = getPublicVisibleUserContentOrFilter(hiddenUserIds)
    let randomQuery = supabase
      .from('threads')
      .select('id, title, user_id, image_url, post_count, is_archived, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
      .eq('is_archived', false)
      .in('category_id', categoryIds)

    if (publicUserFilter) randomQuery = randomQuery.or(publicUserFilter)

    const { data: raw } = await randomQuery
      .limit(100)
    const all = seededShuffle(raw ? await withFallbackThumbnails(supabase, filterPublicVisibleUserContent(raw, hiddenUserIds)) : [])
    if (all.length === 0) return <CategoryThreadEmpty />
    return (
      <div className="grid grid-cols-3 md:grid-cols-5 border-l border-t border-gray-300">
        {(all as unknown as (Thread & { categories: Category | null })[]).map(thread => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}
      </div>
    )
  }

  // ── 標準クエリ（キャッシュ済み・60s）
  const result = await getCachedThreadList(sort, page, categoryIds, isArchived)
  const threads = result.threads as unknown as (Thread & { categories: Category | null })[]

  if (threads.length === 0) return <CategoryThreadEmpty />

  const listName = sort === 'popular' ? `人気スレッド（${category.name}）` : `${category.name} スレッド一覧`

  return (
    <>
      {/* SEO: ItemList構造化データ — カテゴリ内スレッド一覧をGoogleに伝える */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            '@id': `${BASE_URL}/category/${category.slug}#itemlist`,
            name: listName,
            url: `${BASE_URL}/category/${category.slug}`,
            numberOfItems: threads.length,
            itemListElement: threads.map((thread, i) => ({
              '@type': 'ListItem',
              position: (page - 1) * THREAD_PAGE_SIZE + i + 1,
              name: thread.title,
              url: `${BASE_URL}/thread/${thread.id}`,
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
            rank={sort === 'popular' ? i + 1 + (page - 1) * THREAD_PAGE_SIZE : undefined}
            priority={i === 0}
          />
        ))}
      </div>
      <div className="mt-3">
        <Pagination
          currentPage={page}
          totalPages={result.totalPages}
          searchParams={{ sort }}
          basePath={basePath}
        />
      </div>
    </>
  )
}

function CategoryThreadEmpty() {
  return (
    <div className="text-center py-16 text-gray-500 bg-white border border-gray-300">
      <p>このカテゴリにはまだスレッドがありません</p>
      <Link href="/thread/new" className="mt-3 inline-block text-blue-600 hover:underline text-sm">
        最初のスレッドを立てる →
      </Link>
    </div>
  )
}

function RecommendSectionSkeleton() {
  return (
    <div className="mb-2 border border-gray-300 bg-white animate-pulse">
      <div className="px-3 py-1.5 border-b border-gray-300 flex items-center gap-1.5">
        <div className="h-5 bg-gray-200 rounded w-16" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 border-l border-t border-gray-300">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex border-b border-r border-gray-300 overflow-hidden">
            <div className="shrink-0 bg-gray-200 w-11 h-11 md:w-16 md:h-16" />
            <div className="flex-1 px-1 py-0.5 flex flex-col gap-1 justify-center">
              <div className="h-2 bg-gray-200 rounded w-full" />
              <div className="h-2 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, { sort: sortParam, page: pageStr }] = await Promise.all([params, searchParams])

  const sort = sortParam ?? 'recent'
  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)

  const [categories, notices, newThreadRules] = await Promise.all([
    getCachedCategories(),
    getCachedActiveNotices(),
    getCachedSetting('new_thread_rules', `1.似たスレッドがないか確認してください。
2.フライング・リーク情報は禁止です。
3.タイトルでのネタバレを避けてください。
4.画像は権利を侵害しない物を添付してください。
5.ミスで立てたスレは必ず削除を押してください。
6.他人が不快になるようなタイトルは避けてください。
7.スレッド作成は承認制とする場合があります。
8.不適切と判断した場合は削除・ブロックする事があります。`),
  ])

  const category = getDisplayCategoryBySlug(slug, categories)
  const categoryIds = getCategoryIdsForSlug(slug, categories)
  if (!category || categoryIds.length === 0) notFound()

  const typedNotices = notices as Notice[]
  const topNotices = typedNotices.filter(n => n.position === 'top')
  const midNotices = typedNotices.filter(n => n.position === 'mid')
  const botNotices = typedNotices.filter(n => n.position === 'bot')
  const categoryDescription = getCategoryDescription(category)

  return (
    <div className="w-full px-0 py-0">
      {/* SEO: BreadcrumbList + DiscussionForum構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "@id": `${BASE_URL}/category/${slug}#breadcrumb`,
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "TOP", "item": BASE_URL },
                { "@type": "ListItem", "position": 2, "name": `カテゴリ『${category.name}』`, "item": `${BASE_URL}/category/${slug}` },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "DiscussionForum",
              "@id": `${BASE_URL}/category/${slug}#forum`,
              "name": `${category.name} | デュエマ掲示板`,
              "description": categoryDescription,
              "url": `${BASE_URL}/category/${slug}`,
              "inLanguage": "ja",
              "isPartOf": { "@id": `${BASE_URL}/#website` },
              "publisher": { "@id": `${BASE_URL}/#organization` },
              "breadcrumb": { "@id": `${BASE_URL}/category/${slug}#breadcrumb` },
            },
          ])
        }}
      />

      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        <Suspense fallback={<RecommendSectionSkeleton />}>
          <RecommendSection />
        </Suspense>

        {topNotices.map(n => <NoticeBlock key={n.id} notice={n} />)}
      </div>

      {/* パンくず + H1 */}
      <div className="max-w-screen-xl mx-auto px-2 mb-1">
        <nav className="text-xs text-gray-600 flex items-center gap-x-1" aria-label="パンくずリスト">
          <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
          <span>{'>'}</span>
          <span>カテゴリ：{category.name}</span>
        </nav>
        <h1 className="text-sm font-bold text-gray-900 mt-0.5">{category.name} のスレッド一覧</h1>
        <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{categoryDescription}</p>
      </div>

      <div className="max-w-screen-xl mx-auto px-2">
        {midNotices.map(n => <NoticeBlock key={n.id} notice={n} />)}

        <CategoryThreadList category={category} categoryIds={categoryIds} sort={sort} page={page} />

        <BottomNav current="/category" currentCategory={slug} categories={categories} />

        {botNotices.map(n => <NoticeBlock key={n.id} notice={n} />)}

        <InlineNewThread categories={categories} newThreadRules={newThreadRules} />

        <div className="mb-6" />
      </div>
    </div>
  )
}
