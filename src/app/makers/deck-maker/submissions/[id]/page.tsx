import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { formatJapanDateTime } from '@/lib/date-time'

export const dynamic = 'force-dynamic'

type DeckCard = { id: string; name: string; imageUrl: string | null; sourceKey: string | null; count: number }
type DeckRow = { id: string; user_id: string | null; title: string; format: string; deck_data: DeckCard[]; created_at: string }

export default async function PublicDeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const admin = createAdminClient()
  const { data } = await admin.from('deck_submissions')
    .select('id,user_id,title,format,deck_data,created_at')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle()
  if (!data) notFound()
  const deck = data as DeckRow
  const { data: profile } = deck.user_id
    ? await admin.from('profiles').select('display_name,profile_hidden,account_suspended,withdrawn_at').eq('id', deck.user_id).maybeSingle()
    : { data: null }
  if (deck.user_id && (!profile || profile.profile_hidden || profile.account_suspended || profile.withdrawn_at)) notFound()
  const cards = deck.deck_data.flatMap(card => Array.from({ length: card.count }, (_, copy) => ({ ...card, copy })))

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/makers/deck-maker/submissions" className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700 active:opacity-60">← みんなのデッキリスト</Link>
        <article className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <h1 className="text-xl font-black text-slate-950 sm:text-2xl">{deck.title}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>{deck.user_id ? String(profile?.display_name || 'デュエマプレイヤー') : '名無しのデュエリスト'}</span>
            <time>{formatJapanDateTime(deck.created_at)}</time>
          </div>
          <div className="mt-4 grid grid-cols-8 gap-0.5 rounded-xl bg-slate-200 p-0.5">
            {cards.map(card => (
              <div key={`${card.id}:${card.sourceKey ?? 'default'}:${card.copy}`} className="aspect-[5/7] overflow-hidden rounded-[3px] bg-slate-700">
                {card.imageUrl
                  ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" />
                  : <span className="flex h-full items-center justify-center p-1 text-center text-[7px] font-bold leading-tight text-white">{card.name}</span>}
              </div>
            ))}
          </div>
          <Link href="/makers/deck-maker" className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-5 font-bold text-white transition active:scale-[0.99] active:bg-blue-900">自分もデッキを作る</Link>
        </article>
      </div>
    </main>
  )
}
