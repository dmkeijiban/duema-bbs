import Link from 'next/link'
import type { Metadata } from 'next'
import { BottomNav } from '@/components/ThreadSortPage'
import { Pagination } from '@/components/Pagination'
import { ThreadCard } from '@/components/ThreadCard'
import { getCachedCategories, THREAD_PAGE_SIZE } from '@/lib/cached-queries'
import { getCategoryIdsForSlug, getConsolidatedCategories } from '@/lib/categories'
import {
  formatJstDateLabel,
  formatJstMonthLabel,
  getJstMonthRange,
  getKakologIndexThreads,
  getKakologThreadCount,
  getKakologThreads,
  toJstDateKey,
  toJstMonthKey,
  type KakologIndexThread,
} from '@/lib/kakolog-queries'
import { getThreadArchiveBaseAt } from '@/lib/thread-archive'
import { SITE_URL } from '@/lib/site-config'
import type { Category } from '@/types'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '過去ログ | デュエマ掲示板',
  description: 'デュエマ掲示板の最近の過去ログです。古い公開スレッドを閲覧できます。',
  alternates: { canonical: `${SITE_URL}/kakolog` },
}

function getMonthLinks(threads: KakologIndexThread[]) {
  const counts = new Map<string, number>()
  for (const thread of threads) {
    const baseAt = getThreadArchiveBaseAt(thread)
    if (!baseAt) continue
    const key = toJstMonthKey(baseAt)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts, ([month, count]) => ({
    month,
    count,
    label: formatJstMonthLabel(month),
  })).sort((a, b) => b.month.localeCompare(a.month))
}

function getDateLinksForMonth(threads: KakologIndexThread[], month: string) {
  const counts = new Map<string, number>()
  for (const thread of threads) {
    const baseAt = getThreadArchiveBaseAt(thread)
    if (!baseAt || toJstMonthKey(baseAt) !== month) continue
    const key = toJstDateKey(baseAt)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts, ([date, count]) => ({
    date,
    count,
    label: formatJstDateLabel(date),
  })).sort((a, b) => b.date.localeCompare(a.date))
}

function getCategoryLinks(threads: KakologIndexThread[], categories: Category[]) {
  const countsByCategoryId = new Map<number, number>()
  for (const thread of threads) {
    if (thread.category_id === null) continue
    countsByCategoryId.set(thread.category_id, (countsByCategoryId.get(thread.category_id) ?? 0) + 1)
  }

  const links = getConsolidatedCategories(categories).map(category => {
    const categoryIds = getCategoryIdsForSlug(category.slug, categories)
    const count = categoryIds.reduce((total, id) => total + (countsByCategoryId.get(id) ?? 0), 0)
    return {
      slug: category.slug,
      name: category.name,
      count,
      href: `/kakolog/category/${category.slug}`,
    }
  })

  return [
    {
      slug: 'all',
      name: 'すべて',
      count: threads.length,
      href: '/kakolog',
    },
    ...links,
  ]
}

type Props = {
  searchParams: Promise<{ page?: string; month?: string }>
}

export default async function KakologPage({ searchParams }: Props) {
  const { page: pageString, month: monthString } = await searchParams
  const page = Math.max(1, parseInt(pageString ?? '1') || 1)
  const offset = (page - 1) * THREAD_PAGE_SIZE
  const monthRange = monthString ? getJstMonthRange(monthString) : null
  const selectedMonth = monthRange ? monthString : undefined
  const kakologFilter = monthRange
    ? { startIso: monthRange.startIso, endIso: monthRange.endIso }
    : {}
  const [threads, totalCount, indexThreads, categories] = await Promise.all([
    getKakologThreads({ ...kakologFilter, limit: THREAD_PAGE_SIZE, offset }),
    getKakologThreadCount(kakologFilter),
    getKakologIndexThreads(),
    getCachedCategories(),
  ])
  const monthLinks = getMonthLinks(indexThreads)
  const dateLinks = selectedMonth ? getDateLinksForMonth(indexThreads, selectedMonth) : []
  const categoryLinks = getCategoryLinks(indexThreads, categories as Category[])
  const totalPages = Math.max(1, Math.ceil(totalCount / THREAD_PAGE_SIZE))

  return (
    <main className="mx-auto max-w-screen-xl px-2 py-3 text-sm">
      <nav className="mb-2 text-xs text-gray-600">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span className="mx-1">{'>'}</span>
        <span>過去ログ</span>
      </nav>

      <section className="mb-2 border border-gray-300 bg-white px-3 py-2">
        <h1 className="text-base font-bold text-gray-900">
          🕰️ 過去ログ
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-gray-700">
          過去ログでは、これまでに投稿されたスレッドを日付やカテゴリから探せます。
        </p>
        {selectedMonth && (
          <p className="mt-1 text-xs font-bold text-blue-700">
            {formatJstMonthLabel(selectedMonth)}の過去ログ：{totalCount}件
          </p>
        )}
      </section>

      <section>
        {threads.length === 0 ? (
          <div className="border border-gray-300 bg-white px-4 py-12 text-center">
            <h3 className="text-base font-bold text-gray-800">過去ログはまだありません</h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-gray-600">
              30日を超えた公開スレッドが増えると、ここから日付別・カテゴリ別に振り返れるようになります。
            </p>
            <div className="mt-4 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
              <Link href="/update" className="inline-flex min-h-9 items-center justify-center border border-blue-600 bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">
                最新スレッドへ
              </Link>
              <Link href="/" className="inline-flex min-h-9 items-center justify-center border border-gray-300 bg-gray-50 px-4 text-sm font-bold text-gray-700 hover:bg-gray-100">
                トップへ戻る
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 border-l border-t border-gray-300 md:grid-cols-5">
            {threads.map((thread, index) => (
              <ThreadCard key={thread.id} thread={thread} priority={index === 0} />
            ))}
          </div>
        )}
        <div className="mt-3">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/kakolog"
            searchParams={selectedMonth ? { month: selectedMonth } : undefined}
          />
        </div>
      </section>

      {(monthLinks.length > 0 || categoryLinks.length > 0) && (
        <section className="mt-3 border border-gray-300 bg-white">
          <div className="border-b border-gray-200 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">もっと探す</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">月別・日付別・カテゴリ別の過去ログリンクです。</p>
          </div>

          {monthLinks.length > 0 && (
            <div className="border-b border-gray-100 px-3 py-3">
              <h3 className="mb-2 text-xs font-bold text-gray-700">月別アーカイブ</h3>
              <div className="grid grid-cols-2 gap-1.5 md:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                {monthLinks.map(item => (
                  <Link
                    key={item.month}
                    href={`/kakolog?month=${item.month}`}
                    className={`flex min-w-0 items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-xs text-blue-700 hover:border-blue-400 hover:bg-blue-50 ${
                      selectedMonth === item.month ? 'border-blue-500 bg-blue-50 font-bold' : 'border-gray-300 bg-white'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span className="shrink-0 text-gray-500">{item.count}件</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {selectedMonth && dateLinks.length > 0 && (
            <div className="border-b border-gray-100 px-3 py-3">
              <h3 className="mb-2 text-xs font-bold text-gray-700">{formatJstMonthLabel(selectedMonth)}の日付別</h3>
              <div className="grid grid-cols-2 gap-1.5 md:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                {dateLinks.map(item => (
                  <Link
                    key={item.date}
                    href={`/kakolog/${item.date}`}
                    className="flex min-w-0 items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-blue-700 hover:border-blue-400 hover:bg-blue-50"
                  >
                    <span className="truncate">{item.label}</span>
                    <span className="shrink-0 text-gray-500">{item.count}件</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {categoryLinks.length > 0 && (
            <div className="px-3 py-3">
              <h3 className="mb-2 text-xs font-bold text-gray-700">カテゴリ別</h3>
              <div className="grid grid-cols-2 gap-1.5 md:[grid-template-columns:repeat(5,minmax(0,1fr))]">
                {categoryLinks.map(item => (
                  <Link
                    key={item.slug}
                    href={item.href}
                    className="flex min-w-0 items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-blue-700 hover:border-blue-400 hover:bg-blue-50"
                  >
                    <span className="min-w-0 break-words leading-snug">{item.name}</span>
                    <span className="shrink-0 text-gray-500">{item.count}件</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <BottomNav current="/kakolog" categories={categories} />
      <div className="mb-6" />
    </main>
  )
}
