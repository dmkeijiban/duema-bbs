import Link from 'next/link'
import { fetchPack, fetchCardsByPack } from '@/lib/zukan'
import type { ZukanPack, ZukanCard } from '@/lib/zukan'

export const metadata = {
  title: 'DM-01 基本セット | デュエマ思い出図鑑',
  description: 'デュエル・マスターズ第1弾「DM-01 基本セット」のカード一覧。ボルシャック・ドラゴンをはじめ、2002年当時の名カードを振り返ろう。',
}

// --- モックフォールバック ---------------------------------------------------

const MOCK_PACK: ZukanPack = {
  id: '',
  slug: 'dm-01',
  code: 'DM-01',
  name: '基本セット',
  released_year: '2002年',
  card_count: 120,
  description: 'デュエル・マスターズの最初の弾。5つの文明とシンプルな能力で構成された原点のセット。',
  is_published: true,
  sort_order: 1,
}

const MOCK_CARDS: ZukanCard[] = [
  { id: '', pack_id: '', slug: 'bolshack-dragon', name: 'ボルシャック・ドラゴン', card_type: 'クリーチャー', civilization: '火', cost: 6, mana: 6, race: 'アーマード・ドラゴン', power: '6000+', rarity: 'VR', illustrator: null, ability_text: null, flavor_text: null, image_url: null, sort_order: 1 },
  { id: '', pack_id: '', slug: 'aqua-hulcus', name: 'アクア・ハルカス', card_type: 'クリーチャー', civilization: '水', cost: 3, mana: 3, race: 'リキッド・ピープル', power: '2000', rarity: 'C', illustrator: null, ability_text: null, flavor_text: null, image_url: null, sort_order: 2 },
  { id: '', pack_id: '', slug: 'gaia-mantis', name: 'ガイア・マンティス', card_type: 'クリーチャー', civilization: '自然', cost: 5, mana: 5, race: 'ビースト・フォーク', power: '5000', rarity: 'UC', illustrator: null, ability_text: null, flavor_text: null, image_url: null, sort_order: 3 },
  { id: '', pack_id: '', slug: 'la-ura-giga', name: 'ラ・ウラ・ギガ', card_type: 'クリーチャー', civilization: '光', cost: 1, mana: 1, race: 'スターノイド', power: '2000', rarity: 'C', illustrator: null, ability_text: null, flavor_text: null, image_url: null, sort_order: 4 },
  { id: '', pack_id: '', slug: 'death-smoke', name: 'デス・スモーク', card_type: '呪文', civilization: '闇', cost: 4, mana: 4, race: null, power: null, rarity: 'UC', illustrator: null, ability_text: null, flavor_text: null, image_url: null, sort_order: 5 },
  { id: '', pack_id: '', slug: 'twin-cannon', name: 'ツイン・キャノン・ワイバーン', card_type: 'クリーチャー', civilization: '火', cost: 7, mana: 7, race: 'アーマード・ワイバーン', power: '6000', rarity: 'UC', illustrator: null, ability_text: null, flavor_text: null, image_url: null, sort_order: 6 },
  { id: '', pack_id: '', slug: 'holy-spark', name: 'ホーリー・スパーク', card_type: '呪文', civilization: '光', cost: 4, mana: 4, race: null, power: null, rarity: 'VR', illustrator: null, ability_text: null, flavor_text: null, image_url: null, sort_order: 7 },
  { id: '', pack_id: '', slug: 'spiral-gate', name: 'スパイラル・ゲート', card_type: '呪文', civilization: '水', cost: 2, mana: 2, race: null, power: null, rarity: 'C', illustrator: null, ability_text: null, flavor_text: null, image_url: null, sort_order: 8 },
]

const PACK_REVIEWS = [
  { author: 'よっち', body: '初めて買ったパック。ボルシャックが当たって叫んだ記憶しかない。', when: '2026/06/01' },
  { author: '名無し', body: 'シールド戦の入門にちょうどよかった。今のカードより素朴で好き。', when: '2026/05/28' },
]

const SHORT_REVIEWS = [
  '小学校の机の中に隠してた',
  'デッキケースが宝物だった',
  'コロコロ片手に開けてた',
  '近所の友達と交換しまくった',
]

// ---------------------------------------------------------------------------

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
      画像準備中
    </div>
  )
}

function cardHref(card: ZukanCard): string {
  // bolshack-dragon だけ実装済みリンク、他は準備中
  if (card.slug === 'bolshack-dragon') return '/zukan/card/bolshack-dragon'
  return '#'
}

export default async function ZukanDm01Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  const dbPack = await fetchPack('dm-01')
  const pack = dbPack ?? MOCK_PACK

  const dbCards = dbPack ? await fetchCardsByPack(dbPack.id, page) : null
  const cards = dbCards ?? (page === 1 ? MOCK_CARDS : [])
  const isDbReady = dbPack !== null

  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2 pb-10">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <span>{pack.code} {pack.name}</span>
      </nav>

      {!isDbReady && (
        <p className="mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          図鑑データを準備中です。現在はサンプル表示です。
        </p>
      )}

      {/* 商品ヘッダー */}
      <header className="mb-5 grid gap-4 border border-gray-300 bg-white p-4 md:grid-cols-[200px_1fr]">
        <div
          className="mx-auto w-full max-w-[200px] items-center justify-center rounded bg-gradient-to-br from-gray-100 to-gray-200 text-xs text-gray-400 flex"
          style={{ aspectRatio: '3 / 4' }}
          aria-label="DM-01 商品画像（準備中）"
        >
          商品画像準備中
        </div>
        <div>
          <div className="font-mono text-xs font-bold text-blue-700">{pack.code}</div>
          <h1 className="mt-0.5 text-lg font-bold text-gray-800">{pack.code} {pack.name}</h1>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
            {pack.released_year && (
              <div><dt className="inline font-bold">発売：</dt><dd className="inline">{pack.released_year}</dd></div>
            )}
            {pack.card_count && (
              <div><dt className="inline font-bold">収録：</dt><dd className="inline">{pack.card_count}種</dd></div>
            )}
          </dl>
          {pack.description && (
            <p className="mt-3 text-sm leading-relaxed text-gray-700">{pack.description}</p>
          )}
          <div className="mt-4">
            <span className="inline-block cursor-default rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white opacity-60">
              このパックの思い出を書く（準備中）
            </span>
          </div>
        </div>
      </header>

      {/* このパックの思い出レビュー（モック固定） */}
      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">このパックの思い出レビュー</h2>
        </div>
        <div className="space-y-2">
          {PACK_REVIEWS.map((r, i) => (
            <div key={i} className="border border-gray-300 bg-white px-3 py-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-gray-700">{r.author}</span>
                <span className="text-xs text-gray-400">{r.when}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-gray-700">{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ひとことメモ（モック固定） */}
      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">ひとことメモ</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {SHORT_REVIEWS.map((s, i) => (
            <span key={i} className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700">
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* 収録カード */}
      <section className="mb-5">
        <div className="mb-2 flex items-baseline justify-between border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">
            収録カード
            {page > 1 && <span className="ml-1 font-normal text-gray-500">（{page}ページ目）</span>}
          </h2>
          <div className="flex gap-2 text-xs">
            {page > 1 && (
              <Link href={`/zukan/dm-01?page=${page - 1}`} className="text-blue-600 hover:underline">
                ← 前の60件
              </Link>
            )}
            {cards.length === 60 && (
              <Link href={`/zukan/dm-01?page=${page + 1}`} className="text-blue-600 hover:underline">
                次の60件 →
              </Link>
            )}
          </div>
        </div>
        {cards.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400">このページにはカードがありません。</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {cards.map(card => (
              <Link
                key={card.slug}
                href={cardHref(card)}
                className="block border border-gray-300 bg-white hover:border-blue-400"
              >
                <CardThumb name={card.name} />
                <div className="px-1.5 py-1.5">
                  <div className="flex items-center gap-1">
                    {card.civilization && (
                      <span className={`inline-block rounded px-1 text-[10px] font-bold ${CIV_BADGE[card.civilization] ?? 'bg-gray-100 text-gray-600'}`}>
                        {card.civilization}
                      </span>
                    )}
                    {card.rarity && (
                      <span className="font-mono text-[10px] text-gray-400">{card.rarity}</span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs font-bold text-gray-800">{card.name}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
