import Link from 'next/link'
import type { Metadata } from 'next'
import { BottomNav } from '@/components/ThreadSortPage'
import { Pagination } from '@/components/Pagination'
import { ThreadCard } from '@/components/ThreadCard'
import { getCachedCategories, THREAD_PAGE_SIZE } from '@/lib/cached-queries'
import { formatJstDateLabel, getKakologThreads, toJstDateKey } from '@/lib/kakolog-queries'
import { SITE_URL } from '@/lib/site-config'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '過去ログ | デュエマ掲示板',
  description: 'デュエマ掲示板の最近の過去ログです。古い公開スレッドを閲覧できます。',
  alternates: { canonical: `${SITE_URL}/kakolog` },
}

function getDateLinks(threads: Awaited<ReturnType<typeof getKakologThreads>>) {
  const counts = new Map<string, number>()
  for (const thread of threads) {
    const key = toJstDateKey(thread.created_at)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts, ([date, count]) => ({
    date,
    count,
    label: formatJstDateLabel(date),
  })).slice(0, 8)
}

function getCategoryLinks(threads: Awaited<ReturnType<typeof getKakologThreads>>) {
  const counts = new Map<string, { name: string; count: number }>()
  for (const thread of threads) {
    const category = thread.categories
    if (!category?.slug) continue
    const current = counts.get(category.slug)
    counts.set(category.slug, {
      name: category.name,
      count: (current?.count ?? 0) + 1,
    })
  }
  return Array.from(counts, ([slug, item]) => ({
    slug,
    ...item,
  })).slice(0, 8)
}

type Props = {
  searchParams: Promise<{ page?: string }>
}

export default async function KakologPage({ searchParams }: Props) {
  const { page: pageString } = await searchParams
  const page = Math.max(1, parseInt(pageString ?? '1') || 1)
  const [threads, categories] = await Promise.all([
    getKakologThreads({ limit: 240 }),
    getCachedCategories(),
  ])
  const dateLinks = getDateLinks(threads)
  const categoryLinks = getCategoryLinks(threads)
  const totalPages = Math.max(1, Math.ceil(threads.length / THREAD_PAGE_SIZE))
  const offset = (page - 1) * THREAD_PAGE_SIZE
  const pageThreads = threads.slice(offset, offset + THREAD_PAGE_SIZE)

  return (
    <main className="mx-auto max-w-screen-xl px-2 py-3 text-sm">
      <nav className="mb-2 text-xs text-gray-600">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span className="mx-1">{'>'}</span>
        <span>過去ログ</span>
      </nav>

      <h1 className="mb-2 border border-gray-300 bg-white px-3 py-2 text-base font-bold text-gray-900">
        🕰️ 過去ログ
      </h1>

      <section className="mb-2 border border-gray-300 bg-white px-3 py-2">
        <p className="text-xs leading-relaxed text-gray-700">
          過去ログでは、30日を超えた公開スレッドを閲覧できます。最近のログから探すほか、日付別・カテゴリ別にもたどれます。
        </p>
      </section>

      <section>
        <h2 className="mb-2 border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800">最近の過去ログ</h2>
        {pageThreads.length === 0 ? (
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
            {pageThreads.map((thread, index) => (
              <ThreadCard key={thread.id} thread={thread} priority={index === 0} />
            ))}
          </div>
        )}
        <div className="mt-3">
          <Pagination currentPage={page} totalPages={totalPages} basePath="/kakolog" />
        </div>
      </section>

      {(dateLinks.length > 0 || categoryLinks.length > 0) && (
        <section className="mt-3 border border-gray-300 bg-white">
          <div className="border-b border-gray-200 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">もっと探す</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">日付別・カテゴリ別の過去ログリンクです。</p>
          </div>

          {dateLinks.length > 0 && (
            <div className="border-b border-gray-100 px-3 py-3">
              <h3 className="mb-2 text-xs font-bold text-gray-700">日付別</h3>
              <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                {dateLinks.map(item => (
                  <Link
                    key={item.date}
                    href={`/kakolog/${item.date}`}
                    className="min-w-0 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-center text-xs text-blue-700 hover:border-blue-400 hover:bg-blue-50 sm:text-left"
                  >
                    <span className="whitespace-nowrap">{item.label}（{item.count}）</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {categoryLinks.length > 0 && (
            <div className="px-3 py-3">
              <h3 className="mb-2 text-xs font-bold text-gray-700">カテゴリ別</h3>
              <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                {categoryLinks.map(item => (
                  <Link
                    key={item.slug}
                    href={`/kakolog/category/${item.slug}`}
                    className="min-w-0 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-center text-xs text-blue-700 hover:border-blue-400 hover:bg-blue-50 sm:text-left"
                  >
                    <span className="whitespace-nowrap">{item.name}（{item.count}）</span>
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
