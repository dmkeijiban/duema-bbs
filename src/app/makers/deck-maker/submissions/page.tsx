import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { formatJapanDateTime } from '@/lib/date-time'

export const dynamic = 'force-dynamic'

type DeckCard = { id: string; name: string; imageUrl: string | null; sourceKey: string | null; count: number }
type DeckRow = { id: string; user_id: string | null; title: string; format: string; deck_data: DeckCard[]; created_at: string }

function DeckGrid({ cards }: { cards: DeckCard[] }) {
  const expanded = cards.flatMap(card => Array.from({ length: card.count }, (_, index) => ({ ...card, copy: index })))
  return (
    <div className="grid grid-cols-8 gap-0.5 overflow-hidden rounded-lg bg-slate-200 p-0.5">
      {expanded.map(card => (
        <div key={`${card.id}:${card.sourceKey ?? 'default'}:${card.copy}`} className="aspect-[5/7] overflow-hidden rounded-[2px] bg-slate-700">
          {card.imageUrl
            ? <img src={card.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            : <span className="flex h-full items-center justify-center p-0.5 text-center text-[5px] font-bold leading-tight text-white">{card.name}</span>}
        </div>
      ))}
    </div>
  )
}

export default async function PublicDeckListPage() {
  const admin = createAdminClient()
  const { data } = await admin.from('deck_submissions')
    .select('id,user_id,title,format,deck_data,created_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(60)
  const decks = (data ?? []) as DeckRow[]
  const userIds = [...new Set(decks.flatMap(deck => deck.user_id ? [deck.user_id] : []))]
  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('id,display_name,profile_hidden,account_suspended,withdrawn_at').in('id', userIds)
    : { data: [] }
  const profileById = new Map((profiles ?? []).map(profile => [profile.id, profile]))
  const visibleDecks = decks.filter(deck => {
    if (!deck.user_id) return true
    const profile = profileById.get(deck.user_id)
    return profile && !profile.profile_hidden && !profile.account_suspended && !profile.withdrawn_at
  })

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/makers/deck-maker" className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700 active:opacity-60">← デッキを作る</Link>
        <div className="mt-2">
          <h1 className="text-2xl font-black text-slate-950">みんなのデッキリスト</h1>
          <p className="mt-1 text-sm text-slate-600">デッキメーカーで公開されたデッキを新着順で表示しています。</p>
        </div>

        {visibleDecks.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {visibleDecks.map(deck => (
              <Link key={deck.id} href={`/makers/deck-maker/submissions/${deck.id}`} className="block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition active:scale-[0.99] active:opacity-70">
                <DeckGrid cards={deck.deck_data} />
                <h2 className="mt-3 line-clamp-2 font-black text-slate-950">{deck.title}</h2>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{deck.user_id ? String(profileById.get(deck.user_id)?.display_name || 'デュエマプレイヤー') : '名無しのデュエリスト'}</span>
                  <time>{formatJapanDateTime(deck.created_at)}</time>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <p className="font-bold text-slate-800">公開されたデッキはまだありません</p>
            <Link href="/makers/deck-maker" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 font-bold text-white active:scale-[0.98]">最初のデッキを作る</Link>
          </div>
        )}
      </div>
    </main>
  )
}
