import Link from 'next/link'
import { fetchPublishedPacks } from '@/lib/zukan'
import type { ZukanPack } from '@/lib/zukan'

export const metadata = {
  title: 'デュエマ思い出図鑑 | デュエマ掲示板',
  description: 'デュエル・マスターズの歴代カード・パックを懐かしむ思い出図鑑。ボルシャック・ドラゴンをはじめ往年の名カードを振り返ろう。',
}

// モックフォールバック（DBテーブル未作成時に使用）
const MOCK_PACKS: ZukanPack[] = [
  { id: '', slug: 'dm-01', code: 'DM-01', name: '基本セット', released_year: '2002年', card_count: null, description: null, is_published: true, sort_order: 1 },
  { id: '', slug: 'dm-02', code: 'DM-02', name: '進化獣降臨', released_year: '2002年', card_count: null, description: null, is_published: true, sort_order: 2 },
  { id: '', slug: 'dm-03', code: 'DM-03', name: '闇旋風サイクロン', released_year: '2002年', card_count: null, description: null, is_published: true, sort_order: 3 },
  { id: '', slug: 'dm-04', code: 'DM-04', name: '闘魂編 第1弾', released_year: '2003年', card_count: null, description: null, is_published: true, sort_order: 4 },
]

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

// DM-01 プレビュー用モックカード（パックページへの誘導）
const DM01_PREVIEW = [
  { slug: 'bolshack-dragon', name: 'ボルシャック・ドラゴン', civ: '火', href: '/zukan/card/bolshack-dragon' },
  { slug: 'aqua-hulcus', name: 'アクア・ハルカス', civ: '水', href: '#' },
  { slug: 'gaia-mantis', name: 'ガイア・マンティス', civ: '自然', href: '#' },
  { slug: 'la-ura-giga', name: 'ラ・ウラ・ギガ', civ: '光', href: '#' },
  { slug: 'death-smoke', name: 'デス・スモーク', civ: '闇', href: '#' },
  { slug: 'twin-cannon', name: 'ツイン・キャノン', civ: '火', href: '#' },
]

export default async function ZukanTopPage() {
  const dbPacks = await fetchPublishedPacks()
  const packs = dbPacks ?? MOCK_PACKS
  const isDbReady = dbPacks !== null

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
          パックを開けた記憶、憧れたカード、友達に出されて泣いたカード。みんなの思い出で作る図鑑です。
        </p>
      </header>

      {/* パック一覧 */}
      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">パックから探す</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {packs.map(pack => {
            const href = pack.slug === 'dm-01' ? '/zukan/dm-01' : '#'
            return (
              <Link
                key={pack.slug}
                href={href}
                className="block border border-gray-300 bg-white px-3 py-3 hover:border-blue-400 hover:bg-blue-50"
              >
                <div className="font-mono text-xs font-bold text-blue-700">{pack.code}</div>
                <div className="mt-0.5 text-sm font-bold text-gray-800">{pack.name}</div>
                {pack.released_year && (
                  <div className="mt-1 text-xs text-gray-500">{pack.released_year}</div>
                )}
              </Link>
            )
          })}
        </div>
      </section>

      {/* DM-01 のカード（モック固定プレビュー） */}
      <section className="mb-5">
        <div className="mb-2 flex items-baseline justify-between border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">DM-01 基本セットのカード</h2>
          <Link href="/zukan/dm-01" className="text-xs text-blue-600 hover:underline">
            パックページへ
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {DM01_PREVIEW.map(card => (
            <Link
              key={card.slug}
              href={card.href}
              className="block border border-gray-300 bg-white hover:border-blue-400"
            >
              <CardThumb name={card.name} />
              <div className="px-1.5 py-1.5">
                <span className={`inline-block rounded px-1 text-[10px] font-bold ${CIV_BADGE[card.civ] ?? 'bg-gray-100 text-gray-600'}`}>
                  {card.civ}
                </span>
                <div className="mt-1 truncate text-xs font-bold text-gray-800">{card.name}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 下段2カラム：準備中 */}
      <div className="grid gap-3 md:grid-cols-2">
        <section className="border border-gray-300 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">最近レビューされたカード</h2>
          </div>
          <p className="px-3 py-4 text-xs text-gray-400">準備中</p>
        </section>
        <section className="border border-gray-300 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">思い出レビューが多いカード</h2>
          </div>
          <p className="px-3 py-4 text-xs text-gray-400">準備中</p>
        </section>
      </div>
    </div>
  )
}
