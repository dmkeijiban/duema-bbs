import type { Metadata } from 'next'
import DeckMaker from './DeckMaker'

export const metadata: Metadata = {
  title: 'デッキメーカー｜デュエマ掲示板',
  description: 'カード名から検索して40枚デッキを作り、端末保存・PNG保存できます。',
}

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-100 px-1 py-2 sm:px-3 sm:py-4">
      <DeckMaker />
    </main>
  )
}
