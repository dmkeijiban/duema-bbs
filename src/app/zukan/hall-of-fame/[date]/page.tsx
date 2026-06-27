import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  HALL_OF_FAME_ENTRIES,
  getHallEntry,
  getHallYears,
  getEntriesByYear,
  getEntryThumbnails,
} from '@/lib/hall-of-fame'
import type { HallCard } from '@/lib/hall-of-fame'
import { HallOfFameCardImage } from '@/components/HallOfFameCardImage'
import { SITE_URL } from '@/lib/site-config'

// 4桁の施行年スラッグ（例: 2007）か判定する。年の場合は年別一覧、それ以外は施行日詳細を表示する。
const isYear = (date: string) => /^\d{4}$/.test(date)

export function generateStaticParams() {
  return [
    ...HALL_OF_FAME_ENTRIES.map(entry => ({ date: entry.slug })),
    ...getHallYears().map(year => ({ date: year })),
  ]
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params

  // 施行年ページのメタデータ
  if (isYear(date)) {
    if (getEntriesByYear(date).length === 0) {
      return { title: '殿堂・プレミアム殿堂図鑑 | デュエマ思い出図鑑' }
    }
    const title = `${date}年 殿堂発表 | デュエマ思い出図鑑`
    const description = `${date}年に施行された殿堂・プレミアム殿堂レギュレーションを施行日ごとに振り返ります。`
    const url = `${SITE_URL}/zukan/hall-of-fame/${date}`
    const image = `${SITE_URL}/default-thumbnail.jpg`
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        type: 'website' as const,
        images: [{ url: image, width: 1200, height: 630, alt: `${date}年 殿堂発表` }],
      },
      twitter: {
        card: 'summary_large_image' as const,
        title,
        description,
        images: [image],
      },
    }
  }

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
        {card.images && card.images.length > 0 ? (
          /* コンビ殿堂など複数画像：通常カードと同じ画像サイズのまま横並び。
             収まらない分は画像エリア内だけ横スクロール（PC/スマホ共通、ページ全体ははみ出さない） */
          <div className="min-w-0 border-b border-gray-200 bg-gray-50 p-3 sm:border-b-0 sm:border-r">
            <div className="flex gap-2 overflow-x-auto">
              {card.images.map(img => (
                <div key={img.src} className="w-28 shrink-0 sm:w-24">
                  <HallOfFameCardImage src={img.src} name={img.name} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-b border-gray-200 bg-gray-50 p-3 sm:border-b-0 sm:border-r">
            <div className="mx-auto w-28 sm:w-24">
              <HallOfFameCardImage src={card.imageUrl} name={card.name} />
            </div>
          </div>
        )}

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

// 施行年ページ：その年の施行日カードを縦に並べる。各カードは代表カード画像を最大3枚中央寄せで表示し、施行日詳細へリンクする。
function HallOfFameYearPage({ year }: { year: string }) {
  const entries = getEntriesByYear(year)
  if (entries.length === 0) notFound()

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
        <span>{year}年</span>
      </nav>

      {/* タイトル */}
      <header className="mb-4 border border-gray-300 bg-white px-4 py-4">
        <h1 className="text-lg font-bold text-gray-800">{year}年 殿堂発表</h1>
      </header>

      {/* 施行日カード一覧（1カラム縦並び：上に日付見出し、下に代表カード画像を中央寄せ） */}
      <section className="mb-5">
        <div className="space-y-3">
          {entries.map(entry => {
            const thumbs = getEntryThumbnails(entry)
            return (
              <Link
                key={entry.slug}
                href={`/zukan/hall-of-fame/${entry.slug}`}
                className="block border border-gray-300 bg-white px-4 py-3 transition-all duration-100 hover:border-blue-400 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-tap-highlight-color:transparent]"
              >
                {/* 日付見出し（カード上部） */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 text-sm font-bold text-blue-700">{entry.dateLabel} 殿堂発表</div>
                  <span className="shrink-0 text-xs text-blue-500">→</span>
                </div>

                {/* 代表カード画像（最大3枚・中央寄せ）。枚数（1〜3枚）に関わらず1枚あたりの表示サイズは同一。
                    スマホでも3枚が並んで収まる固定幅にして、ページ全体の横スクロールを発生させない */}
                {thumbs.length > 0 && (
                  <div className="mt-3 flex justify-center gap-2 sm:gap-3">
                    {thumbs.map(thumb => (
                      <div key={thumb.src} className="w-20 shrink-0 sm:w-28 md:w-32">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumb.src}
                          alt={`${thumb.name} カード画像`}
                          loading="lazy"
                          decoding="async"
                          className="block w-full border border-gray-300 object-cover"
                          style={{ aspectRatio: '63 / 88' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            )
          })}
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

export default async function HallOfFameDatePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params

  // 4桁の年スラッグなら施行年ページを表示
  if (isYear(date)) {
    return <HallOfFameYearPage year={date} />
  }

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
