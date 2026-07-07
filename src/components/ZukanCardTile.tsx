import Link from 'next/link'
import type { ZukanCard } from '@/lib/zukan'
import ZukanPseudoCard from './ZukanPseudoCard'

const CIV_BADGE: Record<string, string> = {
  火: 'bg-red-100 text-red-700',
  水: 'bg-blue-100 text-blue-700',
  自然: 'bg-green-100 text-green-700',
  光: 'bg-yellow-100 text-yellow-700',
  闇: 'bg-gray-200 text-gray-700',
  ゼロ: 'bg-stone-100 text-stone-700',
}

function cardImageUrl(card: ZukanCard) {
  return card.official_image_url ?? card.image_url
}

function ZukanCardFace({ card }: { card: ZukanCard }) {
  const imageUrl = cardImageUrl(card)

  if (imageUrl) {
    return (
      <div className="bg-gray-100" style={{ aspectRatio: '63 / 88' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${card.name} カード画像`}
          loading="lazy"
          decoding="async"
          className="pointer-events-none h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <ZukanPseudoCard
      name={card.name}
      civilization={card.civilization}
      cost={card.cost}
      cardType={card.card_type}
      power={card.power}
      rarity={card.rarity}
      size="sm"
      className="rounded-none shadow-none"
    />
  )
}

export function ZukanCardTile({
  card,
  variant = 'default',
}: {
  card: ZukanCard
  variant?: 'default' | 'compact'
}) {
  const isCompact = variant === 'compact'

  return (
    <Link
      href={`/zukan/card/${card.slug}`}
      className="block border border-gray-300 bg-white transition-all duration-100 hover:border-blue-400 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-tap-highlight-color:transparent]"
    >
      <ZukanCardFace card={card} />
      <div className={isCompact ? 'px-1.5 py-1.5' : 'px-1.5 py-1.5'}>
        <div className="flex items-center gap-1">
          {card.civilization && (
            <span className={`inline-block rounded px-1 text-[10px] font-bold ${CIV_BADGE[card.civilization] ?? 'bg-gray-100 text-gray-600'}`}>
              {card.civilization}
            </span>
          )}
          {card.rarity && <span className="font-mono text-[10px] text-gray-400">{card.rarity}</span>}
        </div>
        <div className={`mt-0.5 truncate font-bold text-blue-700 ${isCompact ? 'text-[11px]' : 'text-xs'}`}>
          {card.name}
        </div>
        {card.card_type && <div className="truncate text-[10px] text-gray-400">{card.card_type}</div>}
      </div>
    </Link>
  )
}
