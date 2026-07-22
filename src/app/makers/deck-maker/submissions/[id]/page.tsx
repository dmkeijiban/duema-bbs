import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { formatJapanDateTime } from '@/lib/date-time'
import { getMakerAnonymousEditHash } from '@/lib/maker-anonymous-owner'
import { copyPublishedDeck, deletePublishedDeck } from '../../actions'
import DeckMetrics from './DeckMetrics'

export const dynamic = 'force-dynamic'

type DeckCard = { id: string; printingId?: string | null; name: string; imageUrl: string | null; sourceKey: string | null; faceSideIndex?: number; zone?: string; count: number }
type DeckRow = { id: string; user_id: string | null; anonymous_edit_token_hash: string | null; title: string; format: string; deck_data: DeckCard[]; created_at: string; updated_at: string; view_count: number; copy_count: number; key_card_id: string | null }

export default async function PublicDeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const admin = createAdminClient()
  const { data } = await admin.from('deck_submissions')
    .select('id,user_id,anonymous_edit_token_hash,title,format,deck_data,created_at,updated_at,view_count,copy_count,key_card_id')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle()
  if (!data) notFound()
  const deck = data as DeckRow
  const { data: profile } = deck.user_id
    ? await admin.from('profiles').select('display_name,profile_hidden,account_suspended,withdrawn_at').eq('id', deck.user_id).maybeSingle()
    : { data: null }
  if (deck.user_id && (!profile || profile.profile_hidden || profile.account_suspended || profile.withdrawn_at)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const editHash = await getMakerAnonymousEditHash()
  const canEdit = (user && deck.user_id === user.id) || (!user && deck.user_id === null && editHash && deck.anonymous_edit_token_hash === editHash)
  const cards = deck.deck_data.flatMap((card, entryIndex) => Array.from({ length: card.count }, (_, copy) => ({ ...card, entryIndex, copy })))
  const keyCard = deck.deck_data.find(card => card.id === deck.key_card_id) ?? deck.deck_data[0]

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/makers/deck-maker/submissions" className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700 active:opacity-60">← みんなのデッキリスト</Link>
        <article className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6">
          <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
            <div className="relative mx-auto aspect-[5/7] w-full max-w-[180px] overflow-hidden rounded-xl bg-slate-800">
              {keyCard?.imageUrl ? <img src={keyCard.imageUrl} alt={`${deck.title}のキーカード ${keyCard.name}`} className="h-full w-full object-cover object-top" /> : <span className="flex h-full items-center justify-center p-3 text-center text-sm font-bold text-white">{keyCard?.name ?? '画像なし'}</span>}
              <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white">キーカード</span>
            </div>
            <div>
              <p className="text-xs font-bold text-blue-700">{deck.format === 'original' ? 'オリジナル' : 'アドバンス'}</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{deck.title}</h1>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span>{deck.user_id ? String(profile?.display_name || 'デュエマプレイヤー') : '名無しのデュエリスト'}</span>
                <time>{formatJapanDateTime(deck.created_at)}</time>
                <DeckMetrics id={deck.id} initialViews={deck.view_count} copies={deck.copy_count} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <form action={copyPublishedDeck}><input type="hidden" name="id" value={deck.id} /><button className="min-h-11 rounded-xl bg-blue-700 px-5 font-bold text-white">コピーして新規作成</button></form>
                {canEdit && <Link href={`/makers/deck-maker?edit=${deck.id}`} className="flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-5 font-bold text-slate-700">編集</Link>}
                {canEdit && <form action={deletePublishedDeck}><input type="hidden" name="id" value={deck.id} /><button className="min-h-11 rounded-xl border border-red-300 bg-white px-5 font-bold text-red-700">削除</button></form>}
              </div>
            </div>
          </div>

          <h2 className="mt-7 text-lg font-black text-slate-950">デッキ内容（40枚）</h2>
          <div className="mt-3 grid grid-cols-8 gap-0.5 rounded-xl bg-slate-200 p-0.5">
            {cards.map(card => (
              <div key={`${card.id}:${card.printingId ?? card.sourceKey ?? 'default'}:${card.faceSideIndex ?? 0}:${card.entryIndex}:${card.copy}`} className="aspect-[5/7] overflow-hidden rounded-[3px] bg-slate-700" title={`${card.name}${card.sourceKey ? ` / ${card.sourceKey}` : ''}`}>
                {card.imageUrl ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-1 text-center text-[7px] font-bold leading-tight text-white">{card.name}</span>}
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {deck.deck_data.map((card, index) => <div key={`${card.id}:${card.printingId ?? index}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><span className="font-bold text-slate-900">{card.name}</span><span className="ml-2 text-slate-500">×{card.count}</span>{card.sourceKey && <span className="mt-0.5 block text-xs text-slate-500">収録版: {card.sourceKey}{(card.faceSideIndex ?? 0) > 0 ? ` / 面${(card.faceSideIndex ?? 0) + 1}` : ''}</span>}</div>)}
          </div>
        </article>
      </div>
    </main>
  )
}
