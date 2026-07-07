import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchCardsByIdentifiers, fetchPack } from '@/lib/zukan'
import type { ZukanPack } from '@/lib/zukan'
import { getZukanArticleCardIdentifiers, loadPublishedZukanArticleBySlug } from '@/lib/zukan-articles'
import { ZukanArticleRenderer } from '@/components/ZukanArticleRenderer'

export const dynamic = 'force-dynamic'

const HALL_ARTICLE_PACK: ZukanPack = {
  id: '',
  slug: 'hall-of-fame',
  code: '殿堂',
  name: '殿堂・プレミアム殿堂図鑑',
  released_year: null,
  card_count: null,
  description: null,
  is_published: true,
  sort_order: 0,
  image_url: null,
}

function fallbackPack(slug: string): ZukanPack {
  return {
    ...HALL_ARTICLE_PACK,
    slug,
    code: slug.toUpperCase(),
    name: slug,
  }
}

export default async function ZukanArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = await loadPublishedZukanArticleBySlug(slug)
  if (!article) notFound()

  const pack = article.targetType === 'pack_article'
    ? (await fetchPack(article.targetSlug)) ?? fallbackPack(article.targetSlug)
    : HALL_ARTICLE_PACK
  const cards = await fetchCardsByIdentifiers(getZukanArticleCardIdentifiers(article))

  return (
    <div className="mx-auto max-w-screen-lg px-2 pt-2 pb-6">
      <nav className="mb-2 flex flex-wrap items-center gap-x-1 text-xs text-gray-500">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <Link href="/zukan/articles" className="text-blue-600 hover:underline">図鑑記事</Link>
        <span>{'>'}</span>
        <span>{article.title}</span>
      </nav>

      <ZukanArticleRenderer article={article} pack={pack} cards={cards ?? []} />

      <nav className="flex flex-wrap gap-2 text-xs">
        <Link href="/zukan/articles" className="border border-gray-300 bg-white px-3 py-1.5 text-blue-600 hover:border-blue-400 hover:underline">
          ← 図鑑記事一覧へ戻る
        </Link>
        <Link
          href={article.targetType === 'pack_article' ? `/zukan/${article.targetSlug}` : `/zukan/hall-of-fame/${article.targetSlug}`}
          className="border border-gray-300 bg-white px-3 py-1.5 text-blue-600 hover:border-blue-400 hover:underline"
        >
          対象ページを見る
        </Link>
      </nav>
    </div>
  )
}
