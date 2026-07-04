import Link from 'next/link'
import type { Metadata } from 'next'
import { BottomNav } from '@/components/ThreadSortPage'
import { Pagination } from '@/components/Pagination'
import { ThreadCard } from '@/components/ThreadCard'
import { getCachedCategories, THREAD_PAGE_SIZE } from '@/lib/cached-queries'
import { formatJstDateLabel, getJstDateRange, getKakologThreadCount, getKakologThreads } from '@/lib/kakolog-queries'
import { SITE_URL } from '@/lib/site-config'

export const revalidate = 3600

type Props = {
  params: Promise<{ date: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params
  const label = formatJstDateLabel(date)
  return {
    title: `${label}の過去ログ | デュエマ掲示板`,
    description: `${label}に作成されたデュエマ掲示板の過去ログスレッド一覧です。`,
    alternates: { canonical: `${SITE_URL}/kakolog/${date}` },
  }
}

export default async function KakologDatePage({ params, searchParams }: Props) {
  const { date } = await params
  const { page: pageString } = await searchParams
  const page = Math.max(1, parseInt(pageString ?? '1') || 1)
  const offset = (page - 1) * THREAD_PAGE_SIZE
  const range = getJstDateRange(date)
  const [threads, totalCount, categories] = await Promise.all([
    range ? getKakologThreads({ ...range, limit: THREAD_PAGE_SIZE, offset }) : Promise.resolve([]),
    range ? getKakologThreadCount(range) : Promise.resolve(0),
    getCachedCategories(),
  ])
  const totalPages = Math.max(1, Math.ceil(totalCount / THREAD_PAGE_SIZE))
  const label = formatJstDateLabel(date)

  return (
    <main className="mx-auto max-w-screen-xl px-2 py-3 text-sm">
      <nav className="mb-2 text-xs text-gray-600">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span className="mx-1">{'>'}</span>
        <Link href="/kakolog" className="text-blue-600 hover:underline">過去ログ</Link>
        <span className="mx-1">{'>'}</span>
        <span>{label}</span>
      </nav>

      <h1 className="mb-2 border border-gray-300 bg-white px-3 py-2 text-base font-bold text-gray-900">
        🕰️ {label}の過去ログ
      </h1>

      {threads.length === 0 ? (
        <div className="border border-gray-300 bg-white py-16 text-center text-gray-500">
          この日の過去ログはありません
        </div>
      ) : (
        <div className="grid grid-cols-3 border-l border-t border-gray-300 md:grid-cols-5">
          {threads.map((thread, index) => (
            <ThreadCard key={thread.id} thread={thread} priority={index === 0} />
          ))}
        </div>
      )}

      <div className="mt-3">
        <Pagination currentPage={page} totalPages={totalPages} basePath={`/kakolog/${date}`} />
      </div>

      <BottomNav current="/kakolog" categories={categories} />
      <div className="mb-6" />
    </main>
  )
}
