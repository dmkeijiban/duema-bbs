import { Suspense, cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchCardBySlug } from '@/lib/zukan'
import type { ZukanCardWithPack } from '@/lib/zukan'
import ZukanImagePreview from '@/components/ZukanImagePreview'
import ShareButtons from './ShareButtons'
import { SITE_URL } from '@/lib/site-config'
import { ZukanCardMemories, ZukanCardMemoriesSkeleton } from './ZukanCardMemories'

const getCardBySlugCached = cache(fetchCardBySlug)

const MOCK_CARD: ZukanCardWithPack = {
  id: '',
  pack_id: '',
  slug: 'bolshack-dragon',
  name: 'ボルシャック・ドラゴン',
  card_type: 'クリーチャー',
  civilization: '火',
  cost: 6,
  mana: 6,
  race: 'アーマード・ドラゴン',
  power: '6000+',
  rarity: 'ベリーレア',
  illustrator: null,
  ability_text: 'パワーアタッカー＋1000。W・ブレイカー。このクリーチャーが攻撃する時、自分の墓地にある火のカード1枚につき、このクリーチャーのパワーはそのターン＋1000される。',
  flavor_text: null,
  image_url: null,
  official_page_url: null,
  official_image_url: null,
  sort_order: 1,
  zukan_packs: { slug: 'dm-01', code: 'DM-01', name: '基本セット' },
}

const CIV_BADGE: Record<string, string> = {
  火: 'bg-red-100 text-red-700',
  水: 'bg-blue-100 text-blue-700',
  自然: 'bg-green-100 text-green-700',
  光: 'bg-yellow-100 text-yellow-700',
  闇: 'bg-gray-200 text-gray-700',
}

function CardThumb({ name }: { name: string }) {
  return (
    <div
      className="flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-[10px] text-gray-400"
      style={{ aspectRatio: '63 / 88' }}
      aria-label={`${name} のカード画像（準備中）`}
    >
      カード画像準備中
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getCardBySlugCached(slug)
  const name =
    result.status === 'found'
      ? result.card.name
      : slug === 'bolshack-dragon'
        ? 'ボルシャック・ドラゴン'
        : slug
  const imageUrl =
    (result.status === 'found' ? result.card.official_image_url : MOCK_CARD.official_image_url) ??
    `${SITE_URL}/default-thumbnail.jpg`
  const description = `${name}の評価や思い出レビューを募集中。デュエマ思い出図鑑で、当時の思い出や今の評価を残せます。`
  const url = `${SITE_URL}/zukan/card/${slug}`
  return {
    title: `${name} | デュエマ思い出図鑑`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${name} | デュエマ思い出図鑑`,
      description,
      url,
      type: 'article',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${name} カード画像` }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: `${name} | デュエマ思い出図鑑`,
      description,
      images: [imageUrl],
    },
  }
}

export default async function ZukanCardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const result = await getCardBySlugCached(slug)

  let card: ZukanCardWithPack
  let isDbReady = false

  if (result.status === 'found') {
    card = result.card
    isDbReady = true
  } else if (result.status === 'not_found') {
    notFound()
  } else {
    if (slug !== 'bolshack-dragon') notFound()
    card = MOCK_CARD
  }

  const pack = card.zukan_packs
  const packHref = pack ? `/zukan/${pack.slug}` : '/zukan'
  const packLabel = pack ? `${pack.code} ${pack.name}` : '図鑑トップ'

  return (
    <div className="mx-auto max-w-screen-xl px-2 pt-2 pb-0">
      <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1 flex-wrap">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <Link href={packHref} className="text-blue-600 hover:underline">{packLabel}</Link>
        <span>{'>'}</span>
        <span>{card.name}</span>
      </nav>

      {!isDbReady && (
        <p className="mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          図鑑データを準備中です。現在はサンプル表示です。
        </p>
      )}

      <header className="mb-5 grid gap-4 border border-gray-300 bg-white p-4 md:grid-cols-[170px_1fr]">
        <div className="mx-auto w-full max-w-[200px] md:max-w-[170px]">
          {card.official_image_url ? (
            <ZukanImagePreview
              src={card.official_image_url}
              alt={`${card.name} カード画像`}
              imageClassName="w-full"
            />
          ) : (
            <CardThumb name={card.name} />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            {card.civilization && (
              <span className={`inline-block rounded px-1.5 text-xs font-bold ${CIV_BADGE[card.civilization] ?? 'bg-gray-100 text-gray-600'}`}>
                {card.civilization}
              </span>
            )}
            {card.rarity && (
              <span className="font-mono text-xs text-gray-400">{card.rarity}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-800">{card.name}</h1>
            <ShareButtons cardName={card.name} />
          </div>
          {pack && (
            <div className="mt-1 text-xs text-gray-500">
              収録：<Link href={packHref} className="text-blue-600 hover:underline">{packLabel}</Link>
            </div>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 sm:grid-cols-4">
            {card.card_type && <div><dt className="font-bold text-gray-500">種別</dt><dd>{card.card_type}</dd></div>}
            {card.civilization && <div><dt className="font-bold text-gray-500">文明</dt><dd>{card.civilization}</dd></div>}
            {card.cost !== null && <div><dt className="font-bold text-gray-500">コスト</dt><dd className="font-mono">{card.cost}</dd></div>}
            {card.mana !== null && <div><dt className="font-bold text-gray-500">マナ</dt><dd className="font-mono">{card.mana}</dd></div>}
            {card.race && <div><dt className="font-bold text-gray-500">種族</dt><dd>{card.race}</dd></div>}
            {card.power && <div><dt className="font-bold text-gray-500">パワー</dt><dd className="font-mono">{card.power}</dd></div>}
            {card.rarity && <div><dt className="font-bold text-gray-500">レアリティ</dt><dd>{card.rarity}</dd></div>}
            {card.illustrator && <div><dt className="font-bold text-gray-500">イラスト</dt><dd>{card.illustrator}</dd></div>}
          </dl>
          {card.ability_text && (
            <p className="mt-3 text-xs leading-relaxed text-gray-700 border-l-2 border-gray-200 pl-2">
              {card.ability_text.replace(/^\s*\|\s*/, '')}
            </p>
          )}
          {card.flavor_text && (
            <p className="mt-2 text-xs leading-relaxed text-gray-400 italic border-l-2 border-gray-100 pl-2">
              {card.flavor_text.replace(/^\s*\|\s*/, '')}
            </p>
          )}
          {card.official_page_url && (
            <div className="mt-3">
              <a
                href={card.official_page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                公式カード詳細 →
              </a>
            </div>
          )}
        </div>
      </header>

      {isDbReady && (
        <Suspense fallback={<ZukanCardMemoriesSkeleton />}>
          <ZukanCardMemories cardId={card.id} slug={slug} />
        </Suspense>
      )}
    </div>
  )
}
