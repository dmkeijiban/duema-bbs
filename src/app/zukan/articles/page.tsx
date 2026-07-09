import Link from 'next/link'
import { loadPublishedZukanArticleSummaries, type ZukanArticleTargetType } from '@/lib/zukan-articles'

export const dynamic = 'force-dynamic'

const PAGE_TITLE = 'デュエマ記事一覧 | デュエマ掲示板'
const PAGE_DESCRIPTION = 'デュエル・マスターズのパックやカード、注目テーマをまとめた記事まとめです。'

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
}

function articleTypeLabel(articleType: ZukanArticleTargetType) {
  if (articleType === 'pack_article') return 'パック紹介記事'
  if (articleType === 'card_article') return 'カード紹介記事'
  return '記事'
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(value))
}

export default async function ZukanArticlesPage() {
  const articles = await loadPublishedZukanArticleSummaries()

  return (
    <div className="mx-auto max-w-screen-lg px-2 pt-2 pb-6">
      <nav className="mb-2 flex items-center gap-x-1 text-xs text-gray-500">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <span>記事一覧</span>
      </nav>

      <header className="mb-4 border border-gray-300 bg-white px-4 py-4">
        <h1 className="text-lg font-bold text-gray-800">デュエマ記事一覧</h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          {PAGE_DESCRIPTION}
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        {articles.length > 0 ? articles.map(article => {
          const dateLabel = formatDate(article.updatedAt ?? article.createdAt)
          return (
          <article
            key={article.id ?? article.slug}
            className="flex h-full flex-col border border-gray-300 bg-white px-3 py-3"
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
              <span className="border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-700">
                {articleTypeLabel(article.targetType)}
              </span>
              <span className="text-gray-500">{article.targetName}</span>
            </div>
            <h2 className="mt-1 text-base font-bold text-gray-800">{article.title}</h2>
            {article.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600">{article.description}</p>}
            <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs">
              <span className="text-gray-500">{dateLabel ? `更新 ${dateLabel}` : ''}</span>
              <Link
                href={`/zukan/articles/${article.slug}`}
                className="border border-gray-300 bg-gray-50 px-3 py-1.5 font-bold text-blue-700 hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                読む
              </Link>
            </div>
          </article>
        )}) : (
          <p className="border border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
            公開中の記事はまだありません。
          </p>
        )}
      </section>
    </div>
  )
}
