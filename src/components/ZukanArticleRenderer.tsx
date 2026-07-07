import Link from 'next/link'
import type { ZukanArticle } from '@/lib/zukan-articles'
import type { ZukanCard, ZukanPack } from '@/lib/zukan'
import ZukanImagePreview from './ZukanImagePreview'

function cardIdentifier(card: ZukanCard) {
  return [card.id, card.slug]
}

function findCard(cards: ZukanCard[], identifier?: string) {
  if (!identifier) return null
  return cards.find(card => cardIdentifier(card).includes(identifier)) ?? null
}

function cardImageUrl(card: ZukanCard) {
  return card.official_image_url ?? card.image_url
}

function ArticleCardImage({ card }: { card: ZukanCard }) {
  const imageUrl = cardImageUrl(card)
  if (!imageUrl) return null

  return (
    <Link
      href={`/zukan/card/${card.slug}`}
      className="block bg-white [-webkit-tap-highlight-color:transparent]"
      aria-label={`${card.name} の図鑑ページへ`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`${card.name} カード画像`}
        loading="lazy"
        decoding="async"
        className="h-auto w-full"
      />
    </Link>
  )
}

export function ZukanArticleRenderer({
  article,
  pack,
  cards,
}: {
  article: ZukanArticle
  pack: ZukanPack
  cards: ZukanCard[]
}) {
  return (
    <section className="mb-6 border border-gray-300 bg-white" aria-labelledby="zukan-article-title">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
        <h1 id="zukan-article-title" className="mt-0.5 text-base font-bold text-gray-800">
          {article.title}
        </h1>
        {article.description && <p className="mt-1 text-xs leading-relaxed text-gray-600">{article.description}</p>}
      </div>

      <div className="space-y-4 px-3 py-4">
        {article.blocks.map((block, index) => {
          if (block.type === 'heading') {
            const className = block.level === 3
              ? 'border-l-4 border-gray-300 pl-2 text-sm font-bold text-gray-800'
              : 'border-l-4 border-blue-500 bg-blue-50 px-2 py-1 text-sm font-bold text-gray-800'
            return <h2 key={index} className={className}>{block.text}</h2>
          }

          if (block.type === 'paragraph') {
            return <p key={index} className="text-sm leading-7 text-gray-800">{block.text}</p>
          }

          if (block.type === 'packHero') {
            return (
              <figure key={index} className="mx-auto max-w-[260px]">
                {pack.image_url ? (
                  <ZukanImagePreview src={pack.image_url} alt={`${pack.code} ${pack.name} パック画像`} aspectRatio="3 / 4" />
                ) : (
                  <div className="flex flex-col items-center justify-center border border-gray-200 bg-gray-50 text-center text-xs font-bold text-gray-500" style={{ aspectRatio: '3 / 4' }}>
                    <span className="font-mono text-2xl">{pack.code}</span>
                    <span className="mt-1">{pack.name}</span>
                  </div>
                )}
                {block.caption && <figcaption className="mt-1 text-center text-xs text-gray-500">{block.caption}</figcaption>}
              </figure>
            )
          }

          if (block.type === 'card') {
            const identifier = block.id ?? block.slug ?? ''
            const card = findCard(cards, identifier)
            if (!card || !cardImageUrl(card)) return null

            return <figure key={index} className="mx-auto max-w-[190px]"><ArticleCardImage card={card} /></figure>
          }

          if (block.type === 'cardGrid') {
            const identifiers = [...(block.ids ?? []), ...(block.slugs ?? [])].slice(0, 6)
            const gridCards = identifiers
              .map(identifier => findCard(cards, identifier))
              .filter((card): card is ZukanCard => !!card && !!cardImageUrl(card))
            if (gridCards.length === 0) return null

            return (
              <div key={index}>
                {block.title && <h2 className="mb-2 text-sm font-bold text-gray-800">{block.title}</h2>}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {gridCards.map(card => (
                    <div key={card.id} className="min-w-0">
                      <ArticleCardImage card={card} />
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          if (block.type === 'note') {
            return null
          }

          if (block.type === 'relatedLinks') {
            return (
              <div key={index} className="border border-gray-200 bg-gray-50 px-3 py-2">
                <h2 className="text-xs font-bold text-gray-800">{block.title ?? '関連リンク'}</h2>
                <ul className="mt-1 space-y-1 text-xs">
                  {block.links.map(link => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-blue-600 hover:underline">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          }

          return null
        })}
      </div>
    </section>
  )
}
