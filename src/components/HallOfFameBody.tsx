import Link from 'next/link'
import { HALL_OF_FAME_ENTRIES, OFFICIAL_REGULATION_URL } from '@/lib/hall-of-fame'

// 殿堂・プレミアム殿堂図鑑の本文（見出し＋施行日一覧＋公式リンク）。
// /zukan のタブ表示と、互換用の /zukan/hall-of-fame 単独ページの両方で再利用する。
export function HallOfFameBody() {
  return (
    <>
      {/* タイトル */}
      <header className="mb-4 border border-gray-300 bg-white px-4 py-4">
        <h1 className="text-lg font-bold text-gray-800">殿堂・プレミアム殿堂図鑑</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          環境を変えたカード、制限・禁止の歴史、今なお語られる伝説の一枚を振り返る図鑑です。
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
              className="block border border-gray-300 bg-white px-4 py-3 transition-all duration-100 hover:border-blue-400 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 [-webkit-tap-highlight-color:transparent]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-sm font-bold text-blue-700">{entry.dateLabel}</div>
                <span className="shrink-0 text-xs text-blue-500">→</span>
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
    </>
  )
}
