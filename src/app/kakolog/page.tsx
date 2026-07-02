import Link from 'next/link'
import type { Metadata } from 'next'
import { ThreadCard } from '@/components/ThreadCard'
import { getKakologThreads } from '@/lib/kakolog-queries'
import { SITE_URL } from '@/lib/site-config'

export const revalidate = 3600

export const metadata: Metadata = {
  title: '過去ログ | デュエマ掲示板',
  description: 'デュエマ掲示板の最近の過去ログです。古い公開スレッドを閲覧できます。',
  alternates: { canonical: `${SITE_URL}/kakolog` },
}

export default async function KakologPage() {
  const threads = await getKakologThreads({ limit: 240 })

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
