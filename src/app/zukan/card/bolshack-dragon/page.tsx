import Link from 'next/link'

// ⚠️ 静的モック（見た目・導線の確認用）。
// DB / Supabase 接続なし。全データはこのファイル内のプレースホルダー。
// 5項目評価は all-or-none（5項目すべて or 全NULL）の表示確認用ダミー値。

export const metadata = {
  title: 'ボルシャック・ドラゴン 思い出（モック） | デュエマ掲示板',
  robots: { index: false, follow: false },
}

// --- 仮データ ---------------------------------------------------------------

const CARD = {
  name: 'ボルシャック・ドラゴン',
  pack: 'DM-01 基本セット',
  packHref: '/zukan/dm-01',
  civ: '火',
  cost: 6,
  race: 'アーマード・ドラゴン',
  rarity: 'ベリーレア',
}

// 5項目評価（当時の憧れ度 / トラウマ度 / 今見ても好き度 / 名前のかっこよさ / イラストの思い出）
// すべて 5点満点のダミー平均。all-or-none のため 5項目そろって表示される想定。
const RATINGS = [
  { label: '当時の憧れ度', score: 4.8 },
  { label: 'トラウマ度', score: 2.1 },
  { label: '今見ても好き度', score: 4.6 },
  { label: '名前のかっこよさ', score: 4.9 },
  { label: 'イラストの思い出', score: 4.5 },
]

const SHORT_REVIEWS = [
  'これが当たって学校で自慢した',
  '初めての切り札だった',
  '炎のドラゴンといえばコレ',
  'パッケージで一目惚れ',
]

const REVIEWS = [
  { author: 'よっち', body: '小学生のとき、これ1枚で全部解決すると思ってた。今見てもイラストが最高。', when: '2026/06/02' },
  { author: '名無し', body: '友達がこれ出してきて毎回negられた。トラウマというか憧れというか。', when: '2026/05/30' },
]

const THREADS = [
  { title: 'ボルシャック・ドラゴンの思い出を語るスレ', replies: 342, href: '#' },
  { title: '【初代】DM-01世代だけがわかること', replies: 198, href: '#' },
]

export default function BolshackDragonPage() {
  return (
    <div className="max-w-4xl mx-auto px-2 pt-2 pb-10">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <Link href={CARD.packHref} className="text-blue-600 hover:underline">{CARD.pack}</Link>
        <span>{'>'}</span>
        <span>{CARD.name}</span>
      </nav>

      <p className="mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        これは見た目・導線確認用のモックです（仮データ・投稿機能なし）。
      </p>

      {/* カードヘッダー：画像枠 + 基本情報 */}
      <header className="mb-5 grid gap-4 border border-gray-300 bg-white p-4 md:grid-cols-[170px_1fr]">
        <div
          className="mx-auto w-full max-w-[200px] items-center justify-center rounded bg-gradient-to-br from-gray-100 to-gray-200 text-xs text-gray-400 flex md:max-w-[170px]"
          style={{ aspectRatio: '63 / 88' }}
          aria-label={`${CARD.name} のカード画像（準備中）`}
        >
          カード画像準備中
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block rounded bg-red-100 px-1.5 text-xs font-bold text-red-700">{CARD.civ}</span>
            <span className="font-mono text-xs text-gray-400">{CARD.rarity}</span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-gray-800">{CARD.name}</h1>
          <div className="mt-1 text-xs text-gray-500">
            収録：<Link href={CARD.packHref} className="text-blue-600 hover:underline">{CARD.pack}</Link>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 sm:grid-cols-4">
            <div><dt className="font-bold text-gray-500">文明</dt><dd>{CARD.civ}</dd></div>
            <div><dt className="font-bold text-gray-500">コスト</dt><dd className="font-mono">{CARD.cost}</dd></div>
            <div><dt className="font-bold text-gray-500">種族</dt><dd>{CARD.race}</dd></div>
            <div><dt className="font-bold text-gray-500">レアリティ</dt><dd>{CARD.rarity}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-block cursor-default rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white opacity-90">
              レビューを書く
            </span>
            <Link href="#" className="inline-block rounded border border-blue-600 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50">
              掲示板でこのカードを語る
            </Link>
          </div>
          <p className="mt-1 text-xs text-gray-400">（「レビューを書く」はモックのため動作しません）</p>
        </div>
      </header>

      {/* 5項目評価 */}
      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">みんなの思い出評価</h2>
        </div>
        <div className="border border-gray-300 bg-white divide-y divide-gray-100">
          {RATINGS.map((r, i) => (
            <div key={i} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 px-3 py-2.5 sm:grid-cols-[10rem_1fr_3rem]">
              <span className="text-xs font-bold text-gray-700">{r.label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${(r.score / 5) * 100}%` }} />
              </div>
              <span className="text-right font-mono text-xs font-bold text-gray-700">{r.score.toFixed(1)}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">※5項目はすべて入力 or すべて未入力（部分入力なし）の方針。</p>
      </section>

      {/* ひとことメモ */}
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

      {/* レビュー */}
      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">思い出レビュー</h2>
        </div>
        <div className="space-y-2">
          {REVIEWS.map((r, i) => (
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

      {/* 関連スレッド */}
      <section className="mb-2">
        <div className="border border-gray-300 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
            <h2 className="text-sm font-bold text-gray-800">関連スレッド</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {THREADS.map((t, i) => (
              <Link key={i} href={t.href} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                <span className="truncate text-sm font-bold text-blue-700">{t.title}</span>
                <span className="ml-2 whitespace-nowrap font-mono text-xs text-gray-500">{t.replies}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
