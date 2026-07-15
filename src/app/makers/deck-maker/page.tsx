import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isDeckMakerEnabled } from '@/lib/deck-maker-access'
import DeckMaker from './DeckMaker'

export const metadata: Metadata = {
  title: 'デッキメーカー｜デュエマ掲示板',
  description: 'カード名から検索して40枚デッキを作り、端末保存・PNG保存できます。',
  robots: { index: false, follow: false },
}

export default function Page() {
  if (!isDeckMakerEnabled()) notFound()

  return (
    <main className="min-h-screen bg-slate-100 px-1 py-2 sm:px-3 sm:py-4">
      <DeckMaker />
    </main>
  )
}
