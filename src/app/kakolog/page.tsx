import Link from 'next/link'
import type { Metadata } from 'next'
import { BottomNav } from '@/components/ThreadSortPage'
import { ThreadCard } from '@/components/ThreadCard'
import { getCachedCategories } from '@/lib/cached-queries'
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

export default async function KakologPage() {
  const [threads, categories] = await Promise.all([
    getKakologThreads({ limit: 240 }),
    getCachedCategories(),
  ])
  const dateLinks = getDateLinks(threads)
  const categoryLinks = getCategoryLinks(threads)

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
        {(dateLinks.length > 0 || categoryLinks.length > 0) && (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {dateLinks.length > 0 && (
              <div>
                <h2 className="mb-1 text-xs font-bold text-gray-800">日付別に見る</h2>
                <div className="flex flex-wrap gap-1.5">
                  {dateLinks.map(item => (
                    <Link
                      key={item.date}
                      href={`/kakolog/${item.date}`}
                      className="inline-flex min-h-7 items-center border border-gray-300 bg-gray-50 px-2 text-xs text-gray-700 hover:bg-gray-100"
                    >
                      {item.label}
                      <span className="ml-1 text-gray-500">({item.count})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {categoryLinks.length > 0 && (
              <div>
                <h2 className="mb-1 text-xs font-bold text-gray-800">カテゴリ別に見る</h2>
                <div className="flex flex-wrap gap-1.5">
                  {categoryLinks.map(item => (
                    <Link
                      key={item.slug}
                      href={`/kakolog/category/${item.slug}`}
                      className="inline-flex min-h-7 items-center border border-gray-300 bg-gray-50 px-2 text-xs text-gray-700 hover:bg-gray-100"
                    >
                      {item.name}
                      <span className="ml-1 text-gray-500">({item.count})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800">最近の過去ログ</h2>
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
            {threads.slice(0, 60).map((thread, index) => (
              <ThreadCard key={thread.id} thread={thread} priority={index === 0} />
            ))}
          </div>
        )}
      </section>

      <BottomNav current="/kakolog" categories={categories} />
      <div className="mb-6" />
    </main>
  )
}
