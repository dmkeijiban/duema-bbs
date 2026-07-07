import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchCardsByPack, fetchCardsByPackSortRange, fetchPack } from '@/lib/zukan'
import type { ZukanCard } from '@/lib/zukan'
import ZukanImagePreview from '@/components/ZukanImagePreview'
import ZukanPseudoCard from '@/components/ZukanPseudoCard'
import { ZukanCivilizationBadge, ZukanRainbowBand } from '@/components/ZukanCivilizationBadge'
import PackShareButtons from '../dm-01/PackShareButtons'
import { SITE_URL } from '@/lib/site-config'

const PAGE_SIZE = 60
const SHOW_FEATURED_PACK_CARDS = false

const PACK_CARD_SECTIONS: Record<string, Array<{ key: string; label: string; from: number; to: number }>> = {
  'dm22-rp1': [
    { key: 'base', label: '通常カード', from: 1, to: 84 },
    { key: 'secret', label: 'シークレット', from: 85, to: 116 },
    { key: 'treasure', label: 'トレジャー', from: 117, to: 171 },
  ],
}

const PACK_PAGE_RANGES: Record<string, Array<{ from: number; to: number }>> = {
  'dm22-rp1': [
    { from: 1, to: 60 },
    { from: 61, to: 116 },
    { from: 117, to: 171 },
  ],
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

function PackPlaceholder({ code, name }: { code: string; name: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded border border-orange-200 bg-orange-50 px-3 text-center text-xs font-bold text-orange-700"
      style={{ aspectRatio: '3 / 4' }}
      aria-label={`${code} 商品画像（擬似表示）`}
    >
      <span className="font-mono text-3xl">{code}</span>
      <span className="mt-2 leading-relaxed">{name}</span>
      <span className="mt-2 text-[10px] text-orange-500">商品画像なし</span>
    </div>
  )
}

function sectionForCard(packSlug: string, card: ZukanCard) {
  return PACK_CARD_SECTIONS[packSlug]?.find(section => card.sort_order >= section.from && card.sort_order <= section.to) ?? null
}

function groupCardsBySection(packSlug: string, cards: ZukanCard[]) {
  const sections = PACK_CARD_SECTIONS[packSlug]
  if (!sections) {
    return [{ key: 'all', label: null, cards }]
  }

  return sections
    .map(section => ({
      key: section.key,
      label: section.label,
      cards: cards.filter(card => sectionForCard(packSlug, card)?.key === section.key),
    }))
    .filter(group => group.cards.length > 0)
}

function Pager({
  packSlug,
  page,
  totalPages,
}: {
  packSlug: string
  page: number
  totalPages: number
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 bg-gray-50 px-3 py-2">
      {page > 1 ? (
        <Link href={`/zukan/${packSlug}?page=${page - 1}`} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50">
          ← 前の60件
        </Link>
      ) : (
        <span className="rounded border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-400">← 前の60件</span>
      )}
      <span className="font-mono text-xs text-gray-500">{page} / {totalPages}</span>
      {page < totalPages ? (
        <Link href={`/zukan/${packSlug}?page=${page + 1}`} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50">
          次の60件 →
        </Link>
      ) : (
        <span className="rounded border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-400">次の60件 →</span>
      )}
    </div>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ packSlug: string }>
}) {
  const { packSlug } = await params
  const pack = await fetchPack(packSlug)
  if (!pack?.is_published) {
    return {
      title: '思い出図鑑 | デュエマ掲示板',
    }
  }

  const title = `${pack.code} ${pack.name} | デュエマ思い出図鑑`
  const description = pack.description ?? `${pack.code} ${pack.name}の収録カード一覧。デュエマ思い出図鑑で当時のカードを振り返るページです。`
  const imageUrl = pack.image_url ?? `${SITE_URL}/default-thumbnail.jpg`
  const url = `${SITE_URL}/zukan/${pack.slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website' as const,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${pack.code} ${pack.name} パック画像` }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [imageUrl],
    },
  }
}

export default async function ZukanPackPage({
  params,
  searchParams,
}: {
  params: Promise<{ packSlug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const [{ packSlug }, sp] = await Promise.all([params, searchParams])
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const pack = await fetchPack(packSlug)
  if (!pack?.is_published) notFound()

  const customPageRanges = PACK_PAGE_RANGES[pack.slug] ?? null
  const customPageRange = customPageRanges?.[page - 1] ?? null
  if (customPageRanges && !customPageRange) notFound()

  const cards = customPageRange
    ? await fetchCardsByPackSortRange(pack.id, customPageRange.from, customPageRange.to)
    : await fetchCardsByPack(pack.id, page)
  if (!cards || (page > 1 && cards.length === 0)) notFound()

  const sortedCards = [...cards].sort((a, b) => a.sort_order - b.sort_order)
  const total = pack.card_count ?? sortedCards.length
  const totalPages = customPageRanges?.length ?? Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (page > totalPages) notFound()

  const expectedCardsOnPage = customPageRange
    ? customPageRange.to - customPageRange.from + 1
    : Math.max(0, Math.min(PAGE_SIZE, total - (page - 1) * PAGE_SIZE))
  if (sortedCards.length < expectedCardsOnPage) notFound()

  const from = customPageRange?.from ?? (page - 1) * PAGE_SIZE + 1
  const to = customPageRange?.to ?? Math.min((page - 1) * PAGE_SIZE + sortedCards.length, total)
  const featuredCards = SHOW_FEATURED_PACK_CARDS && page === 1 ? sortedCards.slice(0, 5) : []
  const cardGroups = groupCardsBySection(pack.slug, sortedCards)

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
            <PackPlaceholder code={pack.code} name={pack.name} />
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
          </dl>
          {pack.description && <p className="mt-3 text-sm leading-relaxed text-gray-700">{pack.description}</p>}
          <div className="mt-auto pt-4">
            <div className="mb-2 text-xs font-bold text-gray-700">このページをシェア</div>
            <PackShareButtons packName={`${pack.code} ${pack.name}`} />
          </div>
        </div>
      </header>

      {featuredCards.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border border-gray-300 bg-gray-50 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">{pack.code} {pack.name}の代表カード</h2>
            <Link href="#card-list" className="text-xs text-blue-600 hover:underline">収録カードをもっと見る →</Link>
          </div>
          <div className="flex snap-x gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
            {featuredCards.map(card => (
              <Link key={card.slug} href={`/zukan/card/${card.slug}`} className="relative block w-[46%] flex-shrink-0 snap-start overflow-hidden border border-gray-300 bg-white transition-all duration-100 hover:border-blue-400 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:w-auto [-webkit-tap-highlight-color:transparent]">
                <ZukanRainbowBand civilization={card.civilization} />
                <CardFace card={card} />
                <div className="px-1.5 py-1.5">
                  {card.civilization && <ZukanCivilizationBadge civilization={card.civilization} />}
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
            <span className="ml-1 font-normal text-gray-500 text-xs">全{total}種中 {from}〜{to}件目</span>
          </h2>
        </div>
        <div className="mb-2">
          <Pager packSlug={pack.slug} page={page} totalPages={totalPages} />
        </div>
        <div className="space-y-4">
          {cardGroups.map(group => (
            <div key={group.key}>
              {group.label && (
                <h3 className="mb-2 border-l-4 border-blue-500 bg-blue-50 px-2 py-1 text-xs font-bold text-gray-800">
                  {group.label}
                </h3>
              )}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {group.cards.map(card => (
                  <Link key={card.slug} href={`/zukan/card/${card.slug}`} className="relative block overflow-hidden border border-gray-300 bg-white transition-all duration-100 hover:border-blue-400 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-tap-highlight-color:transparent]">
                    <ZukanRainbowBand civilization={card.civilization} />
                    <CardFace card={card} />
                    <div className="px-1.5 py-1.5">
                      <div className="flex items-center gap-1">
                        {card.civilization && <ZukanCivilizationBadge civilization={card.civilization} />}
                        {card.rarity && <span className="font-mono text-[10px] text-gray-400">{card.rarity}</span>}
                      </div>
                      <div className="mt-0.5 truncate text-xs font-bold text-blue-700">{card.name}</div>
                      {card.card_type && <div className="text-[10px] text-gray-400">{card.card_type}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Pager packSlug={pack.slug} page={page} totalPages={totalPages} />
        </div>
      </section>
    </div>
  )
}
