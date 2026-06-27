import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HALL_OF_FAME_ENTRIES, getHallEntry } from '@/lib/hall-of-fame'
import type { HallCard } from '@/lib/hall-of-fame'
import { HallOfFameCardImage } from '@/components/HallOfFameCardImage'
import { SITE_URL } from '@/lib/site-config'

export function generateStaticParams() {
  return HALL_OF_FAME_ENTRIES.map(entry => ({ date: entry.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const entry = getHallEntry(date)
  if (!entry) {
    return { title: '殿堂入りカード | デュエマ思い出図鑑' }
  }
  const title = `${entry.title} | デュエマ思い出図鑑`
  const url = `${SITE_URL}/zukan/hall-of-fame/${entry.slug}`
  const image = `${SITE_URL}/default-thumbnail.jpg`
  return {
    title,
    description: entry.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: entry.description,
      url,
      type: 'article' as const,
      images: [{ url: image, width: 1200, height: 630, alt: entry.title }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description: entry.description,
      images: [image],
    },
  }
}

// 規制状態ごとのチップ配色（無制限=グレー / 殿堂入り=オレンジ / プレミアム殿堂・プレミアム殿堂コンビ=赤）
const STATUS_CHIP: Record<string, string> = {
  無制限: 'bg-gray-100 text-gray-700',
  殿堂入り: 'bg-orange-100 text-orange-700',
  プレミアム殿堂: 'bg-red-100 text-red-700',
  プレミアム殿堂コンビ: 'bg-red-100 text-red-700',
}

// 規制変遷ステップを「→」区切りで折り返し可能に表示
function HistoryTrail({ history }: { history: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {history.map((step, i) => (
        <span key={i} className="flex items-center gap-x-1.5">
          <span
            className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[step] ?? 'bg-gray-100 text-gray-700'}`}
          >
            {step}
          </span>
          {i < history.length - 1 && <span className="text-xs text-gray-400">→</span>}
        </span>
      ))}
    </div>
  )
}

function HallCardItem({ card }: { card: HallCard }) {
  return (
    <article className="overflow-hidden border border-gray-300 bg-white">
      <div className="flex flex-col sm:flex-row">
        {/* カード画像（スマホ=上 / PC=左） */}
        <div className="shrink-0 border-b border-gray-200 bg-gray-50 p-3 sm:border-b-0 sm:border-r">
          <div className="mx-auto w-28 sm:w-24">
            <HallOfFameCardImage src={card.imageUrl} name={card.name} />
          </div>
        </div>

        {/* テキスト情報（スマホ=下 / PC=右） */}
        <div className="min-w-0 flex-1 space-y-3 px-4 py-3">
          <h2 className="text-base font-bold text-gray-800">{card.name}</h2>

          {/* その施行日で起きた変更（このページの主役）。大きめ・太字で目立たせる */}
          <p className="text-base font-bold leading-snug text-gray-900 sm:text-lg">{card.initial}</p>

          {/* 規制変遷（補足の履歴）。ラベルは控えめにして主役より目立たせない */}
          <div>
            <div className="mb-1 text-[11px] text-gray-400">規制変遷</div>
            <HistoryTrail history={card.history} />
          </div>
        </div>
      </div>
    </article>
  )
}

export default async function HallOfFameDatePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const entry = getHallEntry(date)
  if (!entry) notFound()

  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2 pb-0">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-2 flex flex-wrap items-center gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <Link href="/zukan/hall-of-fame" className="text-blue-600 hover:underline">殿堂・プレミアム殿堂図鑑</Link>
        <span>{'>'}</span>
        <span>{entry.dateLabel}</span>
      </nav>

      {/* タイトル */}
      <header className="mb-4 border border-gray-300 bg-white px-4 py-4">
        <h1 className="text-lg font-bold text-gray-800">{entry.title}</h1>
      </header>

      {/* カード一覧（画像付きの横長カードを1列で表示） */}
      <section className="mb-5">
        <div className="space-y-3">
          {entry.cards.map(card => (
            <HallCardItem key={card.name} card={card} />
          ))}
        </div>
      </section>

      {/* 戻り導線 */}
      <nav className="mb-2 flex flex-wrap gap-2 text-xs">
        <Link
          href="/zukan/hall-of-fame"
          className="border border-gray-300 bg-white px-3 py-1.5 text-blue-600 hover:border-blue-400 hover:underline"
        >
          ← 殿堂・プレミアム殿堂図鑑へ戻る
        </Link>
        <Link
          href="/zukan"
          className="border border-gray-300 bg-white px-3 py-1.5 text-blue-600 hover:border-blue-400 hover:underline"
        >
          ← 思い出図鑑トップへ戻る
        </Link>
      </nav>
    </div>
  )
}
