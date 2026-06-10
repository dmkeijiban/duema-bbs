import Link from 'next/link'

// ⚠️ 静的モック（見た目・導線の確認用）。
// DB / Supabase 接続なし。全データはこのファイル内のプレースホルダー。
// 商品概要は自前の仮テキスト（wiki 丸コピーしていない）。公式画像は未取得。

export const metadata = {
  title: 'DM-01 基本セット 思い出ページ（モック） | デュエマ掲示板',
  robots: { index: false, follow: false },
}

// --- 仮データ ---------------------------------------------------------------

const CARDS = [
  { slug: 'bolshack-dragon', name: 'ボルシャック・ドラゴン', civ: '火', rarity: 'VR', href: '/zukan/card/bolshack-dragon' },
  { slug: 'aqua-hulcus', name: 'アクア・ハルカス', civ: '水', rarity: 'C', href: '#' },
  { slug: 'gaia-mantis', name: 'ガイア・マンティス', civ: '自然', rarity: 'UC', href: '#' },
  { slug: 'la-ura-giga', name: 'ラ・ウラ・ギガ', civ: '光', rarity: 'C', href: '#' },
  { slug: 'death-smoke', name: 'デス・スモーク', civ: '闇', rarity: 'UC', href: '#' },
  { slug: 'twin-cannon', name: 'ツイン・キャノン', civ: '火', rarity: 'C', href: '#' },
  { slug: 'holy-awe', name: 'ホーリー・スパーク', civ: '光', rarity: 'VR', href: '#' },
  { slug: 'corile', name: 'スパイラル・ゲート', civ: '水', rarity: 'C', href: '#' },
]

const POPULAR = [
  { name: 'ボルシャック・ドラゴン', count: 128, href: '/zukan/card/bolshack-dragon' },
  { name: 'ホーリー・スパーク', count: 64, href: '#' },
  { name: 'アクア・ハルカス', count: 52, href: '#' },
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

export default function ZukanDm01Page() {
  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2 pb-10">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <span>DM-01 基本セット</span>
      </nav>

      <p className="mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        これは見た目・導線確認用のモックです（仮データ・投稿機能なし）。
      </p>

      {/* 商品ヘッダー：画像枠 + 概要 */}
      <header className="mb-5 grid gap-4 border border-gray-300 bg-white p-4 md:grid-cols-[200px_1fr]">
        <div
          className="mx-auto w-full max-w-[200px] items-center justify-center rounded bg-gradient-to-br from-gray-100 to-gray-200 text-xs text-gray-400 flex"
          style={{ aspectRatio: '3 / 4' }}
          aria-label="DM-01 商品画像（準備中）"
        >
          商品画像準備中
        </div>
        <div>
          <div className="font-mono text-xs font-bold text-blue-700">DM-01</div>
          <h1 className="mt-0.5 text-lg font-bold text-gray-800">DM-01 基本セット</h1>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
            <div><dt className="inline font-bold">発売：</dt><dd className="inline">2002年5月（仮）</dd></div>
            <div><dt className="inline font-bold">収録：</dt><dd className="inline">110種（仮）</dd></div>
          </dl>
          <p className="mt-3 text-sm leading-relaxed text-gray-700">
            デュエル・マスターズの最初の弾。5つの文明とシンプルな能力で構成されていて、
            今あらためて見ると「ここから全部始まったんだな」と感じる原点のセットです。
            （※これは仮の紹介文です）
          </p>
          <div className="mt-4">
            <span className="inline-block cursor-default rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white opacity-90">
              このパックの思い出を書く
            </span>
            <span className="ml-2 text-xs text-gray-400">（モックのため動作しません）</span>
          </div>
        </div>
      </header>

      {/* このパックの思い出レビュー */}
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

      {/* 一口メモ */}
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
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">収録カード</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {CARDS.map(card => (
            <Link
              key={card.slug}
              href={card.href}
              className="block border border-gray-300 bg-white hover:border-blue-400"
            >
              <CardThumb name={card.name} />
              <div className="px-1.5 py-1.5">
                <div className="flex items-center gap-1">
                  <span className={`inline-block rounded px-1 text-[10px] font-bold ${CIV_BADGE[card.civ] ?? 'bg-gray-100 text-gray-600'}`}>
                    {card.civ}
                  </span>
                  <span className="font-mono text-[10px] text-gray-400">{card.rarity}</span>
                </div>
                <div className="mt-1 truncate text-xs font-bold text-gray-800">{card.name}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 人気カード */}
      <section className="mb-2">
        <div className="border border-gray-300 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">このパックの人気カード</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {POPULAR.map((row, i) => (
              <Link key={i} href={row.href} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                <div className="grid grid-cols-[1.5rem_1fr] items-center gap-2 min-w-0">
                  <span className="text-center font-mono text-xs font-bold text-gray-400">{i + 1}</span>
                  <span className="truncate text-sm font-bold text-blue-700">{row.name}</span>
                </div>
                <span className="ml-2 whitespace-nowrap font-mono text-xs font-bold text-gray-700">{row.count}件</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
