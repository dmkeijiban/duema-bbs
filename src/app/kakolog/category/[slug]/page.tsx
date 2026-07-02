import Link from 'next/link'
import type { Metadata } from 'next'
import { ThreadCard } from '@/components/ThreadCard'
import { getCachedCategories } from '@/lib/cached-queries'
import { getCategoryIdsForSlug, getDisplayCategoryBySlug } from '@/lib/categories'
import { getKakologThreads } from '@/lib/kakolog-queries'
import { SITE_URL } from '@/lib/site-config'

export const revalidate = 3600

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const categories = await getCachedCategories()
  const category = getDisplayCategoryBySlug(slug, categories)
  const name = category?.name ?? slug
  return {
    title: `${name}の過去ログ | デュエマ掲示板`,
    description: `デュエマ掲示板の「${name}」カテゴリの過去ログスレッド一覧です。`,
    alternates: { canonical: `${SITE_URL}/kakolog/category/${slug}` },
  }
}

export default async function KakologCategoryPage({ params }: Props) {
  const { slug } = await params
  const categories = await getCachedCategories()
  const category = getDisplayCategoryBySlug(slug, categories)
  const categoryIds = getCategoryIdsForSlug(slug, categories)
  const threads = categoryIds.length > 0
    ? await getKakologThreads({ categoryIds, limit: 160 })
    : []
  const name = category?.name ?? slug

  return (
    <main className="mx-auto max-w-screen-xl px-2 py-3 text-sm">
      <nav className="mb-2 text-xs text-gray-600">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span className="mx-1">{'>'}</span>
        <Link href="/kakolog" className="text-blue-600 hover:underline">過去ログ</Link>
        <span className="mx-1">{'>'}</span>
        <span>{name}</span>
      </nav>

      <h1 className="mb-2 border border-gray-300 bg-white px-3 py-2 text-base font-bold text-gray-900">
        🕰️ {name}の過去ログ
      </h1>

      {threads.length === 0 ? (
        <div className="border border-gray-300 bg-white py-16 text-center text-gray-500">
          このカテゴリの過去ログはありません
        </div>
      ) : (
        <div className="grid grid-cols-3 border-l border-t border-gray-300 md:grid-cols-5">
          {threads.map((thread, index) => (
            <ThreadCard key={thread.id} thread={thread} priority={index === 0} />
          ))}
        </div>
      )}
    </main>
  )
}
