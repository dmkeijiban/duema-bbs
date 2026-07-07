import Link from 'next/link'
import { loadPublishedZukanArticles } from '@/lib/zukan-articles'

export const dynamic = 'force-dynamic'

function targetLabel(articleType: string, targetSlug: string) {
  if (articleType === 'card_article') return `カード紹介記事 / ${targetSlug}`
  if (articleType === 'hall_of_fame_article') return `殿堂図鑑 / ${targetSlug}`
  return `パック紹介記事 / ${targetSlug}`
}

export default async function ZukanArticlesPage() {
  const articles = await loadPublishedZukanArticles()

  return (
    <div className="mx-auto max-w-screen-lg px-2 pt-2 pb-6">
      <nav className="mb-2 flex items-center gap-x-1 text-xs text-gray-500">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <span>図鑑記事</span>
      </nav>

      <header className="mb-4 border border-gray-300 bg-white px-4 py-4">
        <h1 className="text-lg font-bold text-gray-800">図鑑記事</h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          パックやカードを振り返る、運営者作成の読み物です。
        </p>
      </header>

      <section className="space-y-2">
        {articles.length > 0 ? articles.map(article => (
          <Link
            key={article.id ?? article.slug}
            href={`/zukan/articles/${article.slug}`}
            className="block border border-gray-300 bg-white px-3 py-3 transition-all duration-100 hover:border-blue-400 hover:bg-blue-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <div className="text-[11px] font-bold text-blue-700">
              {targetLabel(article.targetType, article.targetSlug)}
            </div>
            <h2 className="mt-1 text-base font-bold text-gray-800">{article.title}</h2>
            {article.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600">{article.description}</p>}
          </Link>
        )) : (
          <p className="border border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
            公開中の記事はまだありません。
          </p>
        )}
      </section>
    </div>
  )
}
