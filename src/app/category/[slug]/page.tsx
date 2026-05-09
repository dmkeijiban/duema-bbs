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
import { SortTabs } from '@/components/SortTabs'
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

export const revalidate = 60

import { SITE_URL } from '@/lib/site-config'
const BASE_URL = SITE_URL

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sort?: string; page?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const cats = await getCachedCategories()
  const category = cats.find(c => c.slug === slug)
  if (!category) return { title: 'カテゴリが見つかりません' }

  return {
    title: `${category.name} | デュエマ掲示板`,
    description: `デュエルマスターズ掲示板の「${category.name}」カテゴリ。`,
    alternates: {
      canonical: `${BASE_URL}/category/${slug}`,
    },
    openGraph: {
      title: `${category.name} | デュエマ掲示板`,
      description: `デュエルマスターズ掲示板の「${category.name}」カテゴリ。`,
      url: `${BASE_URL}/category/${slug}`,
      type: 'website',
      images: [{ url: `${BASE_URL}/logo.jpg`, width: 500, height: 500, alt: 'デュエマ掲示板' }],
    },
    twitter: {
      card: 'summary' as const,
      title: `${category.name} | デュエマ掲示板`,
      description: `デュエルマスターズ掲示板の「${category.name}」カテゴリ。`,
      images: [`${BASE_URL}/logo.jpg`],
    },
  }
}

async function CategoryThreadList({
  category,
  sort,
  page,
}: {
  category: { id: number; name: string; slug: string }
  sort: string
  page: number
}) {
  const isArchived = sort === 'archived'
  const isRandom = sort === 'random'
  const supabase = createPublicClient()
  const basePath = `/category/${category.slug}`

  // ── ランダム（キャッシュ不適）
  if (isRandom) {
    const { data: raw } = await supabase
      .from('threads')
      .select('id, title, image_url, post_count, is_archived, created_at, last_posted_at, category_id, categories(id,name,slug,color)')
      .eq('is_archived', false)
      .eq('category_id', category.id)
      .limit(100)
    const all = seededShuffle(raw ? await withFallbackThumbnails(supabase, raw) : [])
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
  const result = await getCachedThreadList(sort, page, category.id, isArchived)
  const threads = result.threads as unknown as (Thread & { categories: Category | null })[]

  if (threads.length === 0) return <CategoryThreadEmpty />

  return (
    <>
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
  const basePath = `/category/${slug}`

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

  const category = categories.find(c => c.slug === slug)
  if (!category) notFound()

  const typedNotices = notices as Notice[]
  const topNotices = typedNotices.filter(n => n.position === 'top')
  const midNotices = typedNotices.filter(n => n.position === 'mid')
  const botNotices = typedNotices.filter(n => n.position === 'bot')

  return (
    <div className="w-full px-0 py-0">
      {/* SEO: BreadcrumbList構造化データ（JSON-LD） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "TOP", "item": BASE_URL },
              { "@type": "ListItem", "position": 2, "name": `カテゴリ『${category.name}』`, "item": `${BASE_URL}/category/${slug}` },
            ],
          })
        }}
      />

      <div className="max-w-screen-xl mx-auto px-2 pt-2">
        <Suspense fallback={<RecommendSectionSkeleton />}>
          <RecommendSection />
        </Suspense>

        {topNotices.map(n => <NoticeBlock key={n.id} notice={n} />)}
      </div>

      {/* パンくず */}
      <div className="max-w-screen-xl mx-auto px-2 mb-1">
        <nav className="text-xs text-gray-600 flex items-center gap-x-1" aria-label="パンくずリスト">
          <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
          <span>{'>'}</span>
          <span>カテゴリ：{category.name}</span>
        </nav>
      </div>

      <SortTabs currentSort={sort} currentCategory={slug} categories={categories} basePath={basePath} />

      <div className="max-w-screen-xl mx-auto px-2">
        {midNotices.map(n => <NoticeBlock key={n.id} notice={n} />)}

        <CategoryThreadList category={category} sort={sort} page={page} />

        {botNotices.map(n => <NoticeBlock key={n.id} notice={n} />)}

        <BottomNav />

        <InlineNewThread categories={categories} newThreadRules={newThreadRules} />

        <div className="mb-6" />
      </div>
    </div>
  )
}
