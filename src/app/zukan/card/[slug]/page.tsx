import { Suspense, cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchCardBySlug, fetchCardsByPack, fetchPack } from '@/lib/zukan'
import type { ZukanCardWithPack } from '@/lib/zukan'
import ZukanImagePreview from '@/components/ZukanImagePreview'
import ZukanPseudoCard from '@/components/ZukanPseudoCard'
import ShareButtons from './ShareButtons'
import { SITE_URL } from '@/lib/site-config'
import { ZukanCardMemories, ZukanCardMemoriesSkeleton } from './ZukanCardMemories'
import { getMultiFaceSupplement, getProxiedZukanCardImageUrl, type ZukanCardFace } from '@/lib/zukan-card-faces'
import { getTwinPactSpellFace, splitTwinPactAbilityText } from '@/lib/zukan-twin-pact'

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

const EXPECTED_DM02_CARD_COUNT = 60

async function isDm02PackReady(card: ZukanCardWithPack) {
  if (card.zukan_packs?.slug !== 'dm-02') return true

  const pack = await fetchPack('dm-02')
  if (!pack?.is_published || pack.id !== card.pack_id) return false

  const cards = await fetchCardsByPack(pack.id, 1)
  const expectedCount = pack.card_count ?? EXPECTED_DM02_CARD_COUNT
  return !!cards && cards.length >= expectedCount && cards.length >= EXPECTED_DM02_CARD_COUNT
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
    (getMultiFaceSupplement(slug) ? `${SITE_URL}${getProxiedZukanCardImageUrl(getMultiFaceSupplement(slug)!.frontImageUrl)}` :
      (result.status === 'found' ? result.card.official_image_url : MOCK_CARD.official_image_url)) ??
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

type DisplayFace = Pick<ZukanCardFace, 'name' | 'cardType' | 'civilization' | 'cost' | 'mana' | 'race' | 'power' | 'rarity' | 'illustrator' | 'abilityText' | 'flavorText' | 'imageUrl' | 'officialPageUrl'>

function CardFacePanel({ face, label, showShare = false }: { face: DisplayFace; label?: string; showShare?: boolean }) {
  return (
    <section className="grid gap-4 md:grid-cols-[170px_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[200px] md:max-w-[170px]">
        <ZukanImagePreview
          src={getProxiedZukanCardImageUrl(face.imageUrl)}
          alt={`${face.name} カード画像`}
          imageClassName="w-full object-contain"
          aspectRatio={face.imageUrl.endsWith('b.jpg') ? '650 / 465' : '63 / 88'}
        />
      </div>
      <div className="min-w-0">
        {label && <p className="mb-1 text-xs font-bold text-gray-500">{label}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {face.civilization && <span className={`inline-block rounded px-1.5 text-xs font-bold ${CIV_BADGE[face.civilization] ?? 'bg-gray-100 text-gray-600'}`}>{face.civilization}</span>}
          {face.rarity && <span className="font-mono text-xs text-gray-400">{face.rarity}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="break-words text-xl font-bold text-gray-800">{face.name}</h2>
          {showShare && <ShareButtons cardName={face.name} />}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 sm:grid-cols-4">
          <div><dt className="font-bold text-gray-500">種別</dt><dd>{face.cardType || '—'}</dd></div>
          <div><dt className="font-bold text-gray-500">文明</dt><dd>{face.civilization || '—'}</dd></div>
          <div><dt className="font-bold text-gray-500">コスト</dt><dd className="font-mono">{face.cost ?? '—'}</dd></div>
          <div><dt className="font-bold text-gray-500">マナ</dt><dd className="font-mono">{face.mana ?? '—'}</dd></div>
          <div><dt className="font-bold text-gray-500">種族</dt><dd>{face.race || '—'}</dd></div>
          <div><dt className="font-bold text-gray-500">パワー</dt><dd className="font-mono">{face.power || '—'}</dd></div>
          <div><dt className="font-bold text-gray-500">レアリティ</dt><dd>{face.rarity || '—'}</dd></div>
          <div><dt className="font-bold text-gray-500">イラスト</dt><dd>{face.illustrator || '—'}</dd></div>
        </dl>
        {face.abilityText && <p className="mt-3 whitespace-pre-line break-words border-l-2 border-gray-200 pl-2 text-xs leading-relaxed text-gray-700">{face.abilityText.replace(/^\s*\|\s*/, '')}</p>}
        {face.flavorText && <p className="mt-2 whitespace-pre-line break-words border-l-2 border-gray-100 pl-2 text-xs italic leading-relaxed text-gray-400">{face.flavorText.replace(/^\s*\|\s*/, '')}</p>}
        <div className="mt-3"><a href={face.officialPageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">公式カード詳細 →</a></div>
      </div>
    </section>
  )
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
    if (!(await isDm02PackReady(card))) notFound()
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
  const multiFace = getMultiFaceSupplement(slug)
  const { creatureAbilityText } = splitTwinPactAbilityText(card.ability_text)
  const twinPactSpellFace = getTwinPactSpellFace(slug, card.ability_text)
  const frontImageUrl = multiFace?.frontImageUrl ?? card.official_image_url
  const frontFace: DisplayFace | null = frontImageUrl ? {
    name: card.name, cardType: card.card_type ?? '', civilization: card.civilization ?? '', cost: card.cost,
    mana: card.mana, race: card.race, power: card.power, rarity: card.rarity, illustrator: card.illustrator,
    abilityText: card.ability_text, flavorText: card.flavor_text, imageUrl: frontImageUrl,
    officialPageUrl: card.official_page_url ?? multiFace?.officialPageUrl ?? '',
  } : null

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

      <header className="mb-5 border border-gray-300 bg-white p-4">
        {frontFace ? (
          <div className="space-y-6 divide-y divide-gray-200 [&>section+section]:pt-6">
            <CardFacePanel face={frontFace} label={multiFace ? '表面' : undefined} showShare />
            {multiFace && <CardFacePanel face={multiFace.back} label="裏面" />}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[170px_1fr]">
            <div className="mx-auto w-full max-w-[200px] md:max-w-[170px]">
            <ZukanPseudoCard
              name={card.name}
              civilization={card.civilization}
              cost={card.cost}
              cardType={card.card_type}
              power={card.power}
              rarity={card.rarity}
            />
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
            <div className="mt-2 text-xs text-gray-500">
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
          {creatureAbilityText && (
            <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-gray-700 border-l-2 border-gray-200 pl-2">
              {creatureAbilityText.replace(/^\s*\|\s*/, '')}
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
          </div>
        )}
        {twinPactSpellFace && (
          <div className="mt-4 border-t border-gray-200 pt-3">
            <p className="text-xs font-bold text-gray-500">呪文面</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-gray-800">{twinPactSpellFace.name}</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-xs font-bold text-gray-700">
                コスト {twinPactSpellFace.cost}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line border-l-2 border-gray-200 pl-2 text-xs leading-relaxed text-gray-700">
              {twinPactSpellFace.abilityText}
            </p>
          </div>
        )}
      </header>

      {isDbReady && (
        <Suspense fallback={<ZukanCardMemoriesSkeleton />}>
          <ZukanCardMemories cardId={card.id} slug={slug} />
        </Suspense>
      )}
    </div>
  )
}
