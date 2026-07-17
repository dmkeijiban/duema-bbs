import type { Metadata } from 'next'
import DeckMaker from './DeckMaker'

const PAGE_URL = 'https://www.duema-bbs.com/makers/deck-maker'

export const metadata: Metadata = {
  title: 'デッキメーカー｜デュエマ掲示板',
  description: 'デュエル・マスターズのカードを検索して、40枚のデッキを作成できます。デッキ保存・画像出力にも対応。',
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    siteName: 'デュエマ掲示板',
    locale: 'ja_JP',
    title: 'デッキメーカー｜デュエマ掲示板',
    description: 'カードを検索して、自分だけの40枚デッキを作成できます。',
  },
  robots: { index: true, follow: true },
}

export default function DeckMakerPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-1 py-2 sm:px-3 sm:py-4">
      <DeckMaker />
    </main>
  )
}
