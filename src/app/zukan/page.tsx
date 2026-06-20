import Link from 'next/link'
import { fetchPublishedPacks, fetchCardsBySlugs, fetchCardReviewHighlights } from '@/lib/zukan'
import type { ZukanPack, ZukanCard, ZukanCardReviewHighlight } from '@/lib/zukan'
import { SITE_URL } from '@/lib/site-config'

const ZUKAN_TOP_TITLE = 'デュエマ思い出図鑑 | デュエマ掲示板'
const ZUKAN_TOP_DESCRIPTION = 'デュエル・マスターズの歴代カード・パックを懐かしむ思い出図鑑。ボルシャック・ドラゴンをはじめ往年の名カードを振り返ろう。'
const ZUKAN_TOP_URL = `${SITE_URL}/zukan`
const ZUKAN_TOP_IMAGE = `${SITE_URL}/default-thumbnail.jpg`

export const metadata = {
  title: ZUKAN_TOP_TITLE,
  description: ZUKAN_TOP_DESCRIPTION,
  alternates: { canonical: ZUKAN_TOP_URL },
  openGraph: {
    title: ZUKAN_TOP_TITLE,
    description: ZUKAN_TOP_DESCRIPTION,
    url: ZUKAN_TOP_URL,
    type: 'website' as const,
    images: [{ url: ZUKAN_TOP_IMAGE, width: 1200, height: 630, alt: 'デュエマ思い出図鑑' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: ZUKAN_TOP_TITLE,
    description: ZUKAN_TOP_DESCRIPTION,
    images: [ZUKAN_TOP_IMAGE],
  },
}

// モックフォールバック（DBテーブル未作成時に使用）
const MOCK_PACKS: ZukanPack[] = [
  { id: '', slug: 'dm-01', code: 'DM-01', name: '基本セット', released_year: '2002年', card_count: null, description: null, is_published: true, sort_order: 1, image_url: null },
  { id: '', slug: 'dm-02', code: 'DM-02', name: '進化獣降臨', released_year: '2002年', card_count: null, description: null, is_published: true, sort_order: 2, image_url: null },
  { id: '', slug: 'dm-03', code: 'DM-03', name: '闇旋風サイクロン', released_year: '2002年', card_count: null, description: null, is_published: true, sort_order: 3, image_url: null },
  { id: '', slug: 'dm-04', code: 'DM-04', name: '闘魂編 第1弾', released_year: '2003年', card_count: null, description: null, is_published: true, sort_order: 4, image_url: null },
]

const CIV_BADGE: Record<string, string> = {
  火: 'bg-red-100 text-red-700',
  水: 'bg-blue-100 text-blue-700',
  自然: 'bg-green-100 text-green-700',
  光: 'bg-yellow-100 text-yellow-700',
  闇: 'bg-gray-200 text-gray-700',
}

const CIV_BG: Record<string, string> = {
  火: 'from-red-100 to-red-200',
  水: 'from-blue-100 to-blue-200',
  自然: 'from-green-100 to-green-200',
  光: 'from-yellow-50 to-yellow-200',
  闇: 'from-gray-200 to-gray-300',
}

const CIV_TEXT: Record<string, string> = {
  火: 'text-red-400',
  水: 'text-blue-400',
  自然: 'text-green-400',
  光: 'text-yellow-500',
  闇: 'text-gray-400',
}

function CardThumb({
  name,
  civilization,
  imageUrl,
}: {
  name: string
  civilization?: string | null
  imageUrl?: string | null
}) {
  if (imageUrl) {
    return (
      <div className="bg-gray-100" style={{ aspectRatio: '63 / 88' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${name} カード画像`}
          loading="lazy"
          decoding="async"
          className="pointer-events-none h-full w-full object-cover"
        />
      </div>
    )
  }
  const bg = civilization ? (CIV_BG[civilization] ?? 'from-gray-100 to-gray-200') : 'from-gray-100 to-gray-200'
  const tc = civilization ? (CIV_TEXT[civilization] ?? 'text-gray-400') : 'text-gray-400'
  return (
    <div
      className={`flex flex-col items-center justify-center bg-gradient-to-br ${bg} text-[9px] font-bold ${tc}`}
      style={{ aspectRatio: '63 / 88' }}
      aria-label={`${name} のカード画像（準備中）`}
    >
      <span className="text-base">{civilization ?? '？'}</span>
      <span className="mt-0.5">画像準備中</span>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(value))
}

function PackListCard({ pack }: { pack: ZukanPack }) {
  const href = pack.slug === 'dm-01' ? '/zukan/dm-01' : '#'
  const isLinked = pack.slug === 'dm-01'

  const body = (
    <div className="flex h-full overflow-hidden border border-gray-300 bg-white transition-all duration-100">
      <div className="w-20 shrink-0 bg-orange-50 sm:w-24">
        {pack.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pack.image_url}
            alt={`${pack.code} ${pack.name} パック画像`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain p-1.5"
          />
        ) : (
          <div className="flex h-full min-h-[72px] items-center justify-center text-[10px] font-bold text-orange-300">
            準備中
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-3 py-2">
        <div className="font-mono text-xs font-bold text-blue-700">{pack.code}</div>
        <div className="mt-0.5 text-sm font-bold leading-snug text-gray-800">{pack.name}</div>
        <dl className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-gray-600">
          {pack.released_year && (
            <div><dt className="inline font-bold">発売：</dt><dd className="inline">{pack.released_year}</dd></div>
          )}
          {pack.card_count && (
            <div><dt className="inline font-bold">収録：</dt><dd className="inline">全{pack.card_count}種</dd></div>
          )}
        </dl>
      </div>
    </div>
  )

  return isLinked ? (
    <Link
      href={href}
      className="block h-full cursor-pointer hover:border-blue-400 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-tap-highlight-color:transparent]"
    >
      {body}
    </Link>
  ) : (
    <div className="h-full opacity-70">{body}</div>
  )
}

function ReviewHighlightSection({
  title,
  emptyText,
  cards,
}: {
  title: string
  emptyText: string
  cards: ZukanCardReviewHighlight[]
}) {
  return (
    <section className="border border-gray-300 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      </div>
      {cards.length === 0 ? (
        <p className="px-3 py-4 text-xs text-gray-400">{emptyText}</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {cards.map(card => (
            <Link
              key={card.id}
              href={`/zukan/card/${card.slug}`}
              className="grid grid-cols-[54px_minmax(0,1fr)_auto] gap-2 px-3 py-2.5 transition-colors hover:bg-blue-50/50"
            >
              <CardThumb name={card.name} civilization={card.civilization} imageUrl={card.official_image_url} />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-blue-700">{card.name}</div>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500">
                  {card.civilization && <span>{card.civilization}</span>}
                  <span>思い出{card.review_count}件</span>
                  <span>最新 {formatDate(card.latest_reviewed_at)}</span>
                </div>
              </div>
              <span className="self-center text-xs text-blue-500">→</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

const DM01_PREVIEW_DEFS = [
  { slug: 'bolshack-dragon', name: 'ボルシャック・ドラゴン', civ: '火' },
  { slug: 'aqua-hulcus',     name: 'アクア・ハルカス',       civ: '水' },
  { slug: 'holy-spark',      name: 'ホーリー・スパーク',     civ: '光' },
  { slug: 'demon-hand',      name: 'デーモン・ハンド',       civ: '闇' },
  { slug: 'natural-trap',    name: 'ナチュラル・トラップ',   civ: '自然' },
]

export default async function ZukanTopPage() {
  const [dbPacks, reviewHighlights] = await Promise.all([
    fetchPublishedPacks(),
    fetchCardReviewHighlights(),
  ])
  const packs = dbPacks ?? MOCK_PACKS
  const isDbReady = dbPacks !== null

  const dm01Pack = dbPacks?.find(p => p.slug === 'dm-01') ?? null
  const dm01Cards = dm01Pack
    ? await fetchCardsBySlugs(dm01Pack.id, DM01_PREVIEW_DEFS.map(d => d.slug))
    : null
  const cardMap = new Map<string, ZukanCard>((dm01Cards ?? []).map(c => [c.slug, c]))

  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2 pb-10">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <span>思い出図鑑</span>
      </nav>

      {!isDbReady && (
        <p className="mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          図鑑データを準備中です。もうしばらくお待ちください。
        </p>
      )}

      {/* タイトル */}
      <header className="mb-4 border border-gray-300 bg-white px-4 py-4">
        <h1 className="text-lg font-bold text-gray-800">デュエマ思い出図鑑</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          パックを開けた記憶、憧れたカード、対戦で忘れられない一枚。みんなの思い出で作る図鑑です。
        </p>
      </header>

      {/* パック一覧 */}
      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">パックから探す</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {packs.map(pack => (
            <PackListCard key={pack.slug} pack={pack} />
          ))}
        </div>
      </section>

      {/* DM-01 のカード */}
      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">DM-01 基本セットの代表カード</h2>
          <Link href="/zukan/dm-01" className="text-xs text-blue-600 hover:underline shrink-0">
            収録カードをもっと見る
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 md:grid-cols-5">
          {DM01_PREVIEW_DEFS.map(def => {
            const dbCard = cardMap.get(def.slug) ?? null
            const href = dbCard ? `/zukan/card/${def.slug}` : '#'
            const cardClass = `w-[44%] flex-shrink-0 sm:w-auto border border-gray-300 bg-white ${dbCard ? 'block cursor-pointer transition-all duration-100 hover:border-blue-400 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-tap-highlight-color:transparent]' : 'opacity-60'}`
            const cardBody = (
              <>
                <CardThumb
                  name={dbCard?.name ?? def.name}
                  civilization={dbCard?.civilization ?? def.civ}
                  imageUrl={dbCard?.official_image_url}
                />
                <div className="px-1.5 py-1.5">
                  <span className={`inline-block rounded px-1 text-[10px] font-bold ${CIV_BADGE[def.civ] ?? 'bg-gray-100 text-gray-600'}`}>
                    {def.civ}
                  </span>
                  <div className={`mt-1 truncate text-xs font-bold ${dbCard ? 'text-blue-700' : 'text-gray-800'}`}>
                    {dbCard?.name ?? def.name}
                  </div>
                </div>
              </>
            )

            return dbCard ? (
              <Link key={def.slug} href={href} className={cardClass}>
                {cardBody}
              </Link>
            ) : (
              <div key={def.slug} className={cardClass}>
                {cardBody}
              </div>
            )
          })}
        </div>
      </section>

      {/* 下段2カラム */}
      <div className="grid gap-3 md:grid-cols-2">
        <ReviewHighlightSection
          title="最近思い出が投稿されたカード"
          emptyText="まだ思い出が投稿されたカードはありません"
          cards={reviewHighlights?.recent ?? []}
        />
        <ReviewHighlightSection
          title="思い出が多いカード"
          emptyText="まだ思い出は投稿されていません"
          cards={reviewHighlights?.mostReviewed ?? []}
        />
      </div>
    </div>
  )
}
