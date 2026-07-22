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
    .select('id,user_id,title,format,deck_data,created_at', { count: 'exact' })
    .eq('is_public', true)
    .eq('format', 'original')
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

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/makers/deck-maker" className="inline-flex min-h-11 items-center text-sm font-bold text-blue-700 active:opacity-60">← デッキを作る</Link>
        <div className="mt-2">
          <h1 className="text-2xl font-black text-slate-950">みんなのデッキリスト</h1>
          <p className="mt-1 text-sm text-slate-600">オリジナルの公開デッキを新着順で表示しています。</p>
        </div>

        <form className="mt-5 flex gap-2" action="/makers/deck-maker/submissions">
          <input name="q" defaultValue={query} maxLength={60} placeholder="デッキ名で検索" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none focus:border-blue-600" />
          <button className="min-h-12 rounded-xl bg-blue-700 px-5 font-bold text-white active:bg-blue-900">検索</button>
        </form>

        {visibleDecks.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {visibleDecks.map(deck => (
              <PublicDeckCard key={deck.id} deck={deck} authorName={deck.user_id ? String(profileById.get(deck.user_id)?.display_name || 'デュエマプレイヤー') : '名無しのデュエリスト'} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <p className="font-bold text-slate-800">{query ? '条件に一致するデッキはありません' : '公開されたデッキはまだありません'}</p>
            {query ? <Link href="/makers/deck-maker/submissions" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-blue-700">検索をクリア</Link> : <Link href="/makers/deck-maker" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 font-bold text-white">最初のデッキを作る</Link>}
          </div>
        )}

        <div className="mt-7"><Pagination currentPage={page} totalPages={totalPages} basePath="/makers/deck-maker/submissions" searchParams={{ q: query || undefined }} /></div>

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
