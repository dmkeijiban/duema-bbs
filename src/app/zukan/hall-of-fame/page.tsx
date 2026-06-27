import Link from 'next/link'
import { HallOfFameBody } from '@/components/HallOfFameBody'
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

// /zukan?tab=hall-of-fame と同じ本文を表示する互換用・直接アクセス用ページ。
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

      <HallOfFameBody />

      {/* 戻り導線 */}
      <nav className="mb-2 flex flex-wrap gap-2 text-xs">
        <Link
          href="/zukan?tab=hall-of-fame"
          className="border border-gray-300 bg-white px-3 py-1.5 text-blue-600 hover:border-blue-400 hover:underline"
        >
          ← 思い出図鑑トップ（殿堂タブ）へ戻る
        </Link>
      </nav>
    </div>
  )
}
