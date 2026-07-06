import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchPack, fetchCardsByPack } from '@/lib/zukan'
import type { ZukanCard } from '@/lib/zukan'
import { DM02_PACK, DM02_REP_CARD_SLUGS } from '@/lib/zukan-dm02'
import ZukanImagePreview from '@/components/ZukanImagePreview'
import ZukanPseudoCard from '@/components/ZukanPseudoCard'
import PackShareButtons from '../dm-01/PackShareButtons'
import { SITE_URL } from '@/lib/site-config'

const EXPECTED_DM02_CARD_COUNT = 60

// DM-02もパック詳細では収録カード一覧を主導線にする。
// 代表カード枠を復活する場合は、DM-01以外の全体方針を決めてからONにする。
const SHOW_DM02_FEATURED_CARDS = false

export async function generateMetadata() {
  const dbPack = await fetchPack('dm-02')
  const pack = dbPack?.is_published ? dbPack : null
  const name = pack?.name ?? DM02_PACK.name
  const code = pack?.code ?? DM02_PACK.code
  const description = pack?.description ?? DM02_PACK.description ?? 'DM-02 第2弾「進化獣降臨」の収録カード一覧。進化クリーチャーが登場した初期デュエマの重要セットを振り返るページです。'
  const imageUrl = (pack?.image_url ?? DM02_PACK.image_url) ?? `${SITE_URL}/default-thumbnail.jpg`
  const title = `${code} ${name} | デュエマ思い出図鑑`
  const url = `${SITE_URL}/zukan/dm-02`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website' as const,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${code} ${name} パック画像` }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [imageUrl],
    },
  }
}

const CIV_BADGE: Record<string, string> = {
  火: 'bg-red-100 text-red-700',
  水: 'bg-blue-100 text-blue-700',
  自然: 'bg-green-100 text-green-700',
  光: 'bg-yellow-100 text-yellow-700',
  闇: 'bg-gray-200 text-gray-700',
}

function cardImageUrl(card: ZukanCard) {
  return card.official_image_url ?? card.image_url
}

function CardFace({ card }: { card: ZukanCard }) {
  const imageUrl = cardImageUrl(card)

  if (imageUrl) {
    return (
      <div className="bg-gray-100" style={{ aspectRatio: '63 / 88' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={`${card.name} カード画像`} loading="lazy" decoding="async" className="pointer-events-none h-full w-full object-cover" />
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

export default async function ZukanDm02Page() {
  const dbPack = await fetchPack('dm-02')
  if (!dbPack?.is_published) {
    notFound()
  }

  const cards = await fetchCardsByPack(dbPack.id, 1)
  const expectedCount = dbPack.card_count ?? EXPECTED_DM02_CARD_COUNT
  if (!cards || cards.length < expectedCount || cards.length < EXPECTED_DM02_CARD_COUNT) {
    notFound()
  }

  const pack = dbPack
  const sortedCards = [...cards].sort((a, b) => a.sort_order - b.sort_order)
  const repCards = SHOW_DM02_FEATURED_CARDS
    ? DM02_REP_CARD_SLUGS
      .map(slug => sortedCards.find(card => card.slug === slug))
      .filter((card): card is ZukanCard => !!card)
    : []

  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2 pb-0">
      <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <span>{pack.code} {pack.name}</span>
      </nav>

      <header className="mb-5 grid gap-4 border border-gray-300 bg-white p-4 md:grid-cols-[200px_1fr]">
        <div className="mx-auto w-full max-w-[200px]">
          {pack.image_url ? (
            <ZukanImagePreview src={pack.image_url} alt={`${pack.code} ${pack.name} パック画像`} aspectRatio="3 / 4" />
          ) : (
            <div className="flex flex-col items-center justify-center rounded border border-green-200 bg-green-50 text-xs font-bold text-green-700" style={{ aspectRatio: '3 / 4' }} aria-label="DM-02 商品画像（擬似表示）">
              <span className="text-3xl">DM-02</span>
              <span className="mt-1">進化獣降臨</span>
              <span className="mt-2 text-[10px] text-green-500">商品画像なし</span>
            </div>
          )}
        </div>
        <div className="flex min-h-full flex-col">
          <div className="font-mono text-xs font-bold text-blue-700">{pack.code}</div>
          <h1 className="mt-0.5 text-lg font-bold text-gray-800">{pack.code} {pack.name}</h1>
          <dl className="mt-2 text-sm text-gray-700 space-y-1">
            <div className="flex flex-wrap gap-x-6">
              {pack.released_year && <div><dt className="inline font-bold">発売：</dt><dd className="inline">{pack.released_year}</dd></div>}
              {pack.card_count && <div><dt className="inline font-bold">収録：</dt><dd className="inline">{pack.card_count}種</dd></div>}
            </div>
            <div><dt className="inline font-bold">パック内容：</dt><dd className="inline">5枚入り 150円（税抜）</dd></div>
          </dl>
          {pack.description && <p className="mt-3 text-sm leading-relaxed text-gray-700">{pack.description}</p>}
          <div className="mt-auto pt-4">
            <div className="mb-2 text-xs font-bold text-gray-700">このページをシェア</div>
            <PackShareButtons packName={`${pack.code} ${pack.name}`} />
          </div>
        </div>
      </header>

      {repCards.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border border-gray-300 bg-gray-50 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">{pack.code} {pack.name}の代表カード</h2>
            <Link href="#card-list" className="text-xs text-blue-600 hover:underline">収録カードをもっと見る →</Link>
          </div>
          <div className="flex snap-x gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
            {repCards.map(card => (
              <Link key={card.slug} href={`/zukan/card/${card.slug}`} className="block w-[46%] flex-shrink-0 snap-start border border-gray-300 bg-white transition-all duration-100 hover:border-blue-400 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:w-auto [-webkit-tap-highlight-color:transparent]">
                <CardFace card={card} />
                <div className="px-1.5 py-1.5">
                  {card.civilization && <span className={`inline-block rounded px-1 text-[10px] font-bold ${CIV_BADGE[card.civilization] ?? 'bg-gray-100 text-gray-600'}`}>{card.civilization}</span>}
                  <div className="mt-1 truncate text-xs font-bold text-blue-700">{card.name}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="card-list" className="mb-6">
        <div className="mb-2 flex items-center justify-between border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">
            収録カード
            <span className="ml-1 font-normal text-gray-500 text-xs">全{cards.length}種中 1〜{cards.length}件目</span>
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {sortedCards.map(card => (
            <Link key={card.slug} href={`/zukan/card/${card.slug}`} className="block border border-gray-300 bg-white transition-all duration-100 hover:border-blue-400 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-tap-highlight-color:transparent]">
              <CardFace card={card} />
              <div className="px-1.5 py-1.5">
                <div className="flex items-center gap-1">
                  {card.civilization && <span className={`inline-block rounded px-1 text-[10px] font-bold ${CIV_BADGE[card.civilization] ?? 'bg-gray-100 text-gray-600'}`}>{card.civilization}</span>}
                  {card.rarity && <span className="font-mono text-[10px] text-gray-400">{card.rarity}</span>}
                </div>
                <div className="mt-0.5 truncate text-xs font-bold text-blue-700">{card.name}</div>
                {card.card_type && <div className="text-[10px] text-gray-400">{card.card_type}</div>}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
