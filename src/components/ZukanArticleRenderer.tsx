import Link from 'next/link'
import type { ZukanArticle } from '@/lib/zukan-articles'
import type { ZukanCard, ZukanPack } from '@/lib/zukan'
import ZukanImagePreview from './ZukanImagePreview'
import { ZukanCardTile } from './ZukanCardTile'

function cardIdentifier(card: ZukanCard) {
  return [card.id, card.slug]
}

function findCard(cards: ZukanCard[], identifier?: string) {
  if (!identifier) return null
  return cards.find(card => cardIdentifier(card).includes(identifier)) ?? null
}

function MissingCard({ identifier }: { identifier: string }) {
  return (
    <div className="border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-xs text-gray-400">
      記事内カードを準備中です: {identifier}
    </div>
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
        <div className="text-[11px] font-bold text-blue-700">運営者作成記事</div>
        <h2 id="zukan-article-title" className="mt-0.5 text-base font-bold text-gray-800">
          {article.title}
        </h2>
        {article.description && <p className="mt-1 text-xs leading-relaxed text-gray-600">{article.description}</p>}
      </div>

      <div className="space-y-4 px-3 py-4">
        {article.blocks.map((block, index) => {
          if (block.type === 'heading') {
            const className = block.level === 3
              ? 'border-l-4 border-gray-300 pl-2 text-sm font-bold text-gray-800'
              : 'border-l-4 border-blue-500 bg-blue-50 px-2 py-1 text-sm font-bold text-gray-800'
            return <h3 key={index} className={className}>{block.text}</h3>
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
            return (
              <figure key={index} className="mx-auto max-w-[190px]">
                {card ? <ZukanCardTile card={card} variant="compact" /> : <MissingCard identifier={identifier} />}
                {block.caption && <figcaption className="mt-1 text-center text-xs leading-relaxed text-gray-500">{block.caption}</figcaption>}
              </figure>
            )
          }

          if (block.type === 'cardGrid') {
            const identifiers = [...(block.ids ?? []), ...(block.slugs ?? [])].slice(0, 6)
            const gridCards = identifiers.map(identifier => ({ identifier, card: findCard(cards, identifier) }))

            return (
              <div key={index}>
                {block.title && <h3 className="mb-2 text-sm font-bold text-gray-800">{block.title}</h3>}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {gridCards.map(({ identifier, card }) => (
                    <div key={identifier} className="min-w-0">
                      {card ? <ZukanCardTile card={card} variant="compact" /> : <MissingCard identifier={identifier} />}
                    </div>
                  ))}
                </div>
                {block.caption && <p className="mt-2 text-xs leading-relaxed text-gray-500">{block.caption}</p>}
              </div>
            )
          }

          if (block.type === 'note') {
            return (
              <p key={index} className="border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                {block.text}
              </p>
            )
          }

          if (block.type === 'relatedLinks') {
            return (
              <div key={index} className="border border-gray-200 bg-gray-50 px-3 py-2">
                <h3 className="text-xs font-bold text-gray-800">{block.title ?? '関連リンク'}</h3>
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
