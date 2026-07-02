import Link from 'next/link'
import type { Metadata } from 'next'
import { ThreadCard } from '@/components/ThreadCard'
import { getCachedCategories } from '@/lib/cached-queries'
import { getKakologThreads, formatJstDateLabel, toJstDateKey } from '@/lib/kakolog-queries'
import { SITE_URL } from '@/lib/site-config'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '過去ログ | デュエマ掲示板',
  description: 'デュエマ掲示板の過去ログです。日付別・カテゴリ別に古いスレッドを閲覧できます。',
  alternates: { canonical: `${SITE_URL}/kakolog` },
}

export default async function KakologPage() {
  const [threads, categories] = await Promise.all([
    getKakologThreads({ limit: 240 }),
    getCachedCategories(),
  ])
  const dateKeys = Array.from(new Set(threads.map(thread => toJstDateKey(thread.created_at)))).slice(0, 60)

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

      <section className="mb-3 border border-gray-300 bg-white">
        <h2 className="border-b border-gray-200 px-3 py-2 text-sm font-bold text-gray-800">日付別</h2>
        {dateKeys.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-500">過去ログはまだありません。</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 px-3 py-3">
            {dateKeys.map(date => (
              <Link
                key={date}
                href={`/kakolog/${date}`}
                className="rounded border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                {formatJstDateLabel(date)}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-3 border border-gray-300 bg-white">
        <h2 className="border-b border-gray-200 px-3 py-2 text-sm font-bold text-gray-800">カテゴリ別</h2>
        <div className="flex flex-wrap gap-1.5 px-3 py-3">
          {categories.map(category => (
            <Link
              key={category.slug}
              href={`/kakolog/category/${category.slug}`}
              className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800">最近の過去ログ</h2>
        {threads.length === 0 ? (
          <div className="border border-gray-300 bg-white py-16 text-center text-gray-500">
            過去ログはまだありません。
          </div>
        ) : (
          <div className="grid grid-cols-3 border-l border-t border-gray-300 md:grid-cols-5">
            {threads.slice(0, 60).map((thread, index) => (
              <ThreadCard key={thread.id} thread={thread} priority={index === 0} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
