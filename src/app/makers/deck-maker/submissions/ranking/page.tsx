import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { DeckCardRankingGrid, type DeckCardRankingEntry } from '@/components/deck/DeckCardRankingGrid'

export const dynamic = 'force-dynamic'

const STATS_DECK_LIMIT = 1000

type StatsDeck = {
  deck_data: Array<{ id: string; name: string; imageUrl: string | null; count: number }>
}

function buildRanking(decks: StatsDeck[]): DeckCardRankingEntry[] {
  const cards = new Map<string, Omit<DeckCardRankingEntry, 'rank'>>()
  for (const deck of decks) {
    const seen = new Set<string>()
    for (const entry of Array.isArray(deck.deck_data) ? deck.deck_data : []) {
      if (!entry?.id || seen.has(entry.id) || !Number.isInteger(entry.count) || entry.count < 1) continue
      const current = cards.get(entry.id)
      cards.set(entry.id, {
        cardId: entry.id,
        name: current?.name || entry.name,
        imageUrl: current?.imageUrl || entry.imageUrl,
        deckCount: (current?.deckCount ?? 0) + 1,
      })
      seen.add(entry.id)
    }
  }
  return [...cards.values()]
    .sort((a, b) => b.deckCount - a.deckCount || a.name.localeCompare(b.name, 'ja'))
    .slice(0, 100)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

export default async function DeckCardRankingPage() {
  const admin = createAdminClient()
  const { data } = await admin.from('deck_submissions')
    .select('deck_data')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(STATS_DECK_LIMIT)
  const decks = (data ?? []) as StatsDeck[]
  const entries = buildRanking(decks)

  return <main className="min-h-screen bg-slate-100 px-3 pb-3 pt-1 sm:pb-5 sm:pt-1">
    <div className="mx-auto max-w-6xl">
      <Link href="/makers/deck-maker" className="inline-flex h-8 items-center text-sm font-bold text-blue-700">← デッキを作る</Link>
      <div className="mt-1 sm:flex sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-950">採用カードランキング</h1>
          <p className="mt-1 text-sm text-slate-600">みんなのデッキで採用されたカードを、カード単位で集計しています。</p>
        </div>
        <nav className="mt-4 inline-flex shrink-0 rounded-xl border border-slate-300 bg-white p-1 text-sm font-bold sm:mt-0">
          <Link href="/makers/deck-maker/submissions/ranking" className="rounded-lg bg-blue-700 px-4 py-2 text-white">集計結果</Link>
          <Link href="/makers/deck-maker/submissions" className="rounded-lg px-4 py-2 text-blue-700">みんなのデッキ</Link>
          <Link href="/makers/deck-maker/submissions?tab=mine" className="rounded-lg px-4 py-2 text-blue-700">自分のデッキ</Link>
        </nav>
      </div>

      {entries.length ? <section className="mt-5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700">
          <span>公開デッキ <span className="text-blue-700">{decks.length}</span>件</span>
          <span>集計カード <span className="text-blue-700">{entries.length}</span>種類</span>
        </div>
        <div className="mt-4"><DeckCardRankingGrid entries={entries} total={decks.length} /></div>
      </section> : <p className="mt-6 rounded-xl border bg-white p-8 text-center text-slate-500">まだ集計できるデッキがありません。</p>}
    </div>
  </main>
}
