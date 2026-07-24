import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'
import { Pagination } from '@/components/Pagination'
import { PublicDeckCard, type PublicDeckCardData } from '@/components/deck/PublicDeckCard'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

function safePage(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function safeQuery(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 60) ?? ''
}

export default async function PublicDeckListPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }) {
  const params = await searchParams
  const page = safePage(params.page)
  const query = safeQuery(params.q)
  const admin = createAdminClient()
  let deckQuery = admin.from('deck_submissions')
    .select('id,user_id,title,format,deck_data,key_card_id,key_card_printing_id,created_at', { count: 'exact' })
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (query) deckQuery = deckQuery.ilike('title', `%${query.replace(/[%_]/g, '\\$&')}%`)
  const { data, count } = await deckQuery
  const decks = (data ?? []) as PublicDeckCardData[]
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
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return <main className="min-h-screen bg-slate-100 px-3 pb-3 pt-1 sm:pb-5 sm:pt-1">
    <div className="mx-auto max-w-6xl">
      <Link href="/makers/deck-maker" className="inline-flex h-8 items-center text-sm font-bold text-blue-700 active:opacity-60">← デッキを作る</Link>
      <div className="mt-1 sm:flex sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-950">みんなのデッキリスト</h1>
          <p className="mt-1 text-sm text-slate-600">公開デッキを新着順で表示しています。</p>
        </div>
        <nav className="mt-4 inline-flex shrink-0 rounded-xl border border-slate-300 bg-white p-1 text-sm font-bold sm:mt-0">
          <Link href="/makers/deck-maker/submissions/ranking" className="rounded-lg px-4 py-2 text-blue-700">集計結果</Link>
          <Link href="/makers/deck-maker/submissions" className="rounded-lg bg-blue-700 px-4 py-2 text-white">みんなのデッキ</Link>
          <Link href="/makers/deck-maker?open=my-decks" className="rounded-lg px-4 py-2 text-blue-700">自分のデッキ</Link>
        </nav>
      </div>

      <form className="mt-5 flex gap-2" action="/makers/deck-maker/submissions">
        <input name="q" defaultValue={query} maxLength={60} placeholder="デッキ名で検索" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none focus:border-blue-600" />
        <button className="min-h-12 rounded-xl bg-blue-700 px-5 font-bold text-white active:bg-blue-900">検索</button>
      </form>

      {visibleDecks.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">
        {visibleDecks.map(deck => <PublicDeckCard key={deck.id} deck={deck} authorName={deck.user_id ? String(profileById.get(deck.user_id)?.display_name || 'デュエマプレイヤー') : '名無しのデュエリスト'} />)}
      </div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
        <p className="font-bold text-slate-800">{query ? '条件に一致するデッキはありません' : '公開されたデッキはまだありません'}</p>
        {query ? <Link href="/makers/deck-maker/submissions" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-blue-700">検索をクリア</Link> : <Link href="/makers/deck-maker" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 font-bold text-white">最初のデッキを作る</Link>}
      </div>}

      <div className="mt-7"><Pagination currentPage={page} totalPages={totalPages} basePath="/makers/deck-maker/submissions" searchParams={{ q: query || undefined }} /></div>
    </div>
  </main>
}
