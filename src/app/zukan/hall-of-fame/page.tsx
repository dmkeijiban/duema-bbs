import Link from 'next/link'
import { HALL_OF_FAME_ENTRIES, OFFICIAL_REGULATION_URL } from '@/lib/hall-of-fame'
import { SITE_URL } from '@/lib/site-config'

const TITLE = '殿堂・プレミアム殿堂図鑑 | デュエマ思い出図鑑'
const DESCRIPTION =
  '過去に環境へ大きな影響を与えた殿堂・プレミアム殿堂カードを振り返る、思い出図鑑内の特集ページです。'
const PAGE_URL = `${SITE_URL}/zukan/hall-of-fame`
const PAGE_IMAGE = `${SITE_URL}/default-thumbnail.jpg`

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: 'website' as const,
    images: [{ url: PAGE_IMAGE, width: 1200, height: 630, alt: '殿堂・プレミアム殿堂図鑑' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: TITLE,
    description: DESCRIPTION,
    images: [PAGE_IMAGE],
  },
}

export default function HallOfFameTopPage() {
  return (
    <div className="max-w-screen-xl mx-auto px-2 pt-2 pb-0">
      {/* パンくず */}
      <nav className="text-xs text-gray-500 mb-2 flex items-center gap-x-1">
        <Link href="/" className="text-blue-600 hover:underline">TOP</Link>
        <span>{'>'}</span>
        <Link href="/zukan" className="text-blue-600 hover:underline">思い出図鑑</Link>
        <span>{'>'}</span>
        <span>殿堂・プレミアム殿堂図鑑</span>
      </nav>

      {/* タイトル */}
      <header className="mb-4 border border-gray-300 bg-gradient-to-br from-purple-50 to-indigo-50 px-4 py-4">
        <h1 className="text-lg font-bold text-indigo-900">殿堂・プレミアム殿堂図鑑</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          このページは公式の殿堂レギュレーション一覧ではなく、過去に環境へ大きな影響を与えた殿堂カードを振り返る、思い出図鑑内の特集ページです。
        </p>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          最新の公式レギュレーションは
          <a
            href={OFFICIAL_REGULATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            公式サイト
          </a>
          をご確認ください。
        </p>
      </header>

      {/* 施行日一覧 */}
      <section className="mb-5">
        <div className="mb-2 border border-gray-300 bg-gray-50 px-3 py-2">
          <h2 className="text-sm font-bold text-gray-800">施行日から振り返る</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {HALL_OF_FAME_ENTRIES.map(entry => (
            <Link
              key={entry.slug}
              href={`/zukan/hall-of-fame/${entry.slug}`}
              className="block border border-gray-300 bg-white px-4 py-3 transition-all duration-100 hover:border-indigo-400 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 [-webkit-tap-highlight-color:transparent]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-indigo-900">{entry.dateLabel}</div>
                  <div className="mt-1 text-xs text-gray-600">
                    {entry.cards.length}枚の殿堂入りカードを振り返る
                  </div>
                </div>
                <span className="shrink-0 text-xs text-indigo-600">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 公式リンク */}
      <section className="mb-5 border border-gray-300 bg-white px-4 py-3">
        <p className="text-xs leading-relaxed text-gray-600">
          殿堂レギュレーションは随時更新されます。最新の正式な一覧は
          <a
            href={OFFICIAL_REGULATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            タカラトミー公式の殿堂・プレミアム殿堂レギュレーションページ
          </a>
          をご覧ください。
        </p>
      </section>

      {/* 戻り導線 */}
      <nav className="mb-2 flex flex-wrap gap-2 text-xs">
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
