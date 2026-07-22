import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { Pagination } from '@/components/Pagination'
import { PublicDeckCard, type PublicDeckCardData } from '@/components/deck/PublicDeckCard'
import { RepresentativeButton } from '@/components/RepresentativeButton'
import { createClient } from '@/lib/supabase-server'
import { getRepresentativeId } from '@/lib/user-content-representatives'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12
const STATS_DECK_LIMIT = 1000

type StatsDeck = { deck_data: Array<{ id: string; name: string; imageUrl: string | null; count: number }> }

function buildStats(decks: StatsDeck[], civilizations: Map<string, string[]>) {
  const cards = new Map<string, { id: string; name: string; imageUrl: string | null; deckCount: number }>()
  const civilizationCounts = new Map<string, number>()
  for (const deck of decks) {
    const seen = new Set<string>()
    for (const entry of Array.isArray(deck.deck_data) ? deck.deck_data : []) {
      if (!entry?.id || !Number.isInteger(entry.count) || entry.count < 1) continue
      const current = cards.get(entry.id) ?? { id: entry.id, name: entry.name, imageUrl: entry.imageUrl, deckCount: 0 }
      if (!seen.has(entry.id)) current.deckCount += 1
      seen.add(entry.id)
      cards.set(entry.id, current)
      for (const civilization of civilizations.get(entry.id) ?? []) {
        civilizationCounts.set(civilization, (civilizationCounts.get(civilization) ?? 0) + entry.count)
      }
    }
  }
  return {
    cards: [...cards.values()].sort((a, b) => b.deckCount - a.deckCount || a.name.localeCompare(b.name, 'ja')).slice(0, 10),
    civilizations: [...civilizationCounts.entries()].sort((a, b) => b[1] - a[1]),
  }
}

function safePage(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function safeQuery(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 60) ?? ''
}

export default async function PublicDeckListPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; tab?: string | string[] }> }) {
  const params = await searchParams
  const page = safePage(params.page)
  const query = safeQuery(params.q)
  const tab = (Array.isArray(params.tab) ? params.tab[0] : params.tab) === 'mine' ? 'mine' : 'all'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (tab === 'mine' && !user) redirect(`/login?next=${encodeURIComponent('/makers/deck-maker/submissions?tab=mine')}`)
  const admin = createAdminClient()
  const { data: statsDeckRows } = await admin.from('deck_submissions')
    .select('deck_data')
    .eq('is_public', true)
    .eq('format', 'original')
    .order('created_at', { ascending: false })
    .limit(STATS_DECK_LIMIT)
  const statsDecks = (statsDeckRows ?? []) as StatsDeck[]
  const statsCardIds = [...new Set(statsDecks.flatMap(deck => (Array.isArray(deck.deck_data) ? deck.deck_data : []).map(card => card.id).filter(Boolean)))]
  const { data: statsCards } = statsCardIds.length
    ? await admin.from('cards').select('id,civilization').in('id', statsCardIds)
    : { data: [] }
  const stats = buildStats(statsDecks, new Map((statsCards ?? []).map(card => [card.id, card.civilization ?? []])))
  let deckQuery = admin.from('deck_submissions')
    .select('id,user_id,title,format,deck_data,created_at', { count: 'exact' })
    .eq('is_public', true)
    .eq('format', 'original')
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  deckQuery = tab === 'mine' && user ? deckQuery.eq('user_id', user.id) : deckQuery.eq('is_public', true)
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
  const savedRepresentativeId = tab === 'mine' && user ? await getRepresentativeId(user.id, 'deck') : null

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/makers/deck-maker" className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700 active:opacity-60">← デッキを作る</Link>
        <div className="mt-2">
          <h1 className="text-2xl font-black text-slate-950">{tab === 'mine' ? '自分のデッキ' : 'みんなのデッキリスト'}</h1>
          <p className="mt-1 text-sm text-slate-600">{tab === 'mine' ? 'あなたが保存したデッキを新着順で表示しています。' : 'オリジナルの公開デッキを新着順で表示しています。'}</p>
        </div>

        <nav className="mt-4 inline-flex rounded-xl border border-slate-300 bg-white p-1 text-sm font-bold">
          <Link href="/makers/deck-maker/submissions" className={`rounded-lg px-4 py-2 ${tab === 'all' ? 'bg-blue-700 text-white' : 'text-slate-700'}`}>みんなのデッキ</Link>
          <Link href="/makers/deck-maker/submissions?tab=mine" className={`rounded-lg px-4 py-2 ${tab === 'mine' ? 'bg-blue-700 text-white' : 'text-slate-700'}`}>自分のデッキ</Link>
        </nav>

        <form className="mt-5 flex gap-2" action="/makers/deck-maker/submissions">
          {tab === 'mine' && <input type="hidden" name="tab" value="mine" />}
          <input name="q" defaultValue={query} maxLength={60} placeholder="デッキ名で検索" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none focus:border-blue-600" />
          <button className="min-h-12 rounded-xl bg-blue-700 px-5 font-bold text-white active:bg-blue-900">検索</button>
        </form>

        {visibleDecks.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {visibleDecks.map(deck => <article key={deck.id}>
              <PublicDeckCard deck={deck} authorName={deck.user_id ? String(profileById.get(deck.user_id)?.display_name || 'デュエマプレイヤー') : '名無しのデュエリスト'} />
              {tab === 'mine' && user && <div className="mt-2"><RepresentativeButton contentType="deck" contentId={deck.id} selected={savedRepresentativeId === deck.id} /></div>}
            </article>)}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <p className="font-bold text-slate-800">{query ? '条件に一致するデッキはありません' : '公開されたデッキはまだありません'}</p>
            {query ? <Link href={tab === 'mine' ? '/makers/deck-maker/submissions?tab=mine' : '/makers/deck-maker/submissions'} className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-blue-700">検索をクリア</Link> : <Link href="/makers/deck-maker" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 font-bold text-white">最初のデッキを作る</Link>}
          </div>
        )}

        <div className="mt-7"><Pagination currentPage={page} totalPages={totalPages} basePath="/makers/deck-maker/submissions" searchParams={{ q: query || undefined, tab: tab === 'mine' ? 'mine' : undefined }} /></div>

        {tab === 'all' && <section className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black text-slate-950">採用カードランキング</h2>
            <p className="mt-1 text-xs text-slate-500">公開中のオリジナルデッキ最大{STATS_DECK_LIMIT}件を、同じデッキ内は採用枚数にかかわらず1件として集計</p>
            {stats.cards.length ? <ol className="mt-4 divide-y divide-slate-100">
              {stats.cards.map((card, index) => <li key={card.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 py-3 text-sm">
                <span className="font-black text-slate-400">{index + 1}</span>
                <span className="min-w-0 truncate font-bold text-slate-900">{card.name}</span>
                <span className="text-right text-xs text-slate-600"><b className="text-sm text-blue-700">{card.deckCount}</b>デッキ</span>
              </li>)}
            </ol> : <p className="mt-5 text-sm text-slate-500">集計できるデッキがまだありません。</p>}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black text-slate-950">文明分布</h2>
            <p className="mt-1 text-xs text-slate-500">多色カードは各文明へ1枚ずつ加算</p>
            {stats.civilizations.length ? <div className="mt-5 space-y-3">
              {stats.civilizations.map(([civilization, count]) => {
                const max = stats.civilizations[0]?.[1] ?? 1
                return <div key={civilization}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-bold">{civilization}</span><span>{count}枚</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(3, count / max * 100)}%` }} /></div>
                </div>
              })}
            </div> : <p className="mt-5 text-sm text-slate-500">文明データを集計中です。</p>}
          </div>
        </section>}

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="text-xl font-black text-slate-950">みんなのデッキリストについて</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">デッキメーカーで40枚完成したデッキを保存すると、ここに新着順で掲載されます。気になるデッキを開いて、採用カードや収録版を確認できます。</p>
          <h2 className="mt-7 text-xl font-black text-slate-950">よくある質問</h2>
          <dl className="mt-3 divide-y divide-slate-200">
            <div className="py-4"><dt className="font-bold text-slate-900">どのフォーマットが表示されますか？</dt><dd className="mt-1 text-sm leading-6 text-slate-600">現在はオリジナルのみです。アドバンスは対応後に追加します。</dd></div>
            <div className="py-4"><dt className="font-bold text-slate-900">並び順は変えられますか？</dt><dd className="mt-1 text-sm leading-6 text-slate-600">新着順固定です。デッキ名検索で絞り込めます。</dd></div>
            <div className="py-4"><dt className="font-bold text-slate-900">公開後に変更できますか？</dt><dd className="mt-1 text-sm leading-6 text-slate-600">保存した本人は、デッキメーカーから同じデッキを保存し直すと内容を更新できます。</dd></div>
          </dl>
        </section>
      </div>
    </main>
  )
}
