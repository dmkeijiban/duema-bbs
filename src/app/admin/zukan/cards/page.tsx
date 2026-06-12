import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import CardMemoForm from './CardMemoForm'
import RelatedThreadForm from './RelatedThreadForm'

type CardRow = {
  id: string
  slug: string
  name: string
  rarity: string | null
  zukan_packs: { code: string; name: string; slug: string } | null
}

type MemoRow = { card_id: string; body: string }
type LinkRow = { id: number; card_id: string; thread_id: string; sort_order: number }

export default async function AdminZukanCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pack?: string }>
}) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get('admin_auth')?.value
  if (!verifyAdminCookie(adminToken)) redirect('/admin')

  const sp = await searchParams
  const q = sp.q ?? ''
  const packFilter = sp.pack ?? ''

  const supabase = createAdminClient()

  // Packs for filter dropdown
  const { data: packs } = await supabase
    .from('zukan_packs')
    .select('id, code, name, slug')
    .order('sort_order', { ascending: true })

  // Cards query
  let cardsQuery = supabase
    .from('zukan_cards')
    .select('id, slug, name, rarity, zukan_packs(code, name, slug)')
    .order('sort_order', { ascending: true })
    .limit(100)

  if (q) cardsQuery = cardsQuery.ilike('name', `%${q}%`)
  if (packFilter) cardsQuery = cardsQuery.eq('pack_id', packFilter)

  const { data: cardsData } = await cardsQuery
  const cards = (cardsData ?? []) as unknown as CardRow[]

  // Fetch memos and related thread links for displayed cards
  let memoMap: Record<string, string> = {}
  let linksMap: Record<string, { id: number; thread_id: string; thread_title: string | null; sort_order: number }[]> = {}

  if (cards.length > 0) {
    const cardIds = cards.map(c => c.id)

    const [{ data: memos }, { data: links }] = await Promise.all([
      supabase.from('zukan_card_memos').select('card_id, body').in('card_id', cardIds),
      supabase.from('zukan_related_threads').select('id, card_id, thread_id, sort_order').in('card_id', cardIds).order('sort_order', { ascending: true }),
    ])

    memoMap = Object.fromEntries((memos ?? [] as MemoRow[]).map((m: MemoRow) => [m.card_id, m.body]))

    // Resolve thread titles
    const allThreadIds = [...new Set((links ?? []).map((l: LinkRow) => l.thread_id))]
    let threadTitleMap: Record<string, string> = {}
    if (allThreadIds.length > 0) {
      const { data: threads } = await supabase
        .from('threads')
        .select('id, title')
        .in('id', allThreadIds)
      threadTitleMap = Object.fromEntries((threads ?? []).map((t: { id: string; title: string }) => [t.id, t.title]))
    }

    for (const link of (links ?? [] as LinkRow[])) {
      if (!linksMap[link.card_id]) linksMap[link.card_id] = []
      linksMap[link.card_id].push({
        id: link.id,
        thread_id: link.thread_id,
        thread_title: threadTitleMap[link.thread_id] ?? null,
        sort_order: link.sort_order,
      })
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-6">
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Link href="/admin/zukan" className="text-sm text-blue-700 hover:underline">← 投稿管理へ戻る</Link>
        <h1 className="text-xl font-bold text-gray-900">カードメモ・関連スレ管理</h1>
      </div>

      {/* Filter */}
      <form method="GET" className="mb-5 flex flex-wrap gap-2 items-end rounded border border-gray-200 bg-white px-3 py-3">
        <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
          <label className="text-[10px] font-bold text-gray-500">カード名検索</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="カード名で絞り込み"
            className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-bold text-gray-500">パック</label>
          <select
            name="pack"
            defaultValue={packFilter}
            className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
          >
            <option value="">すべて</option>
            {(packs ?? []).map((p: { id: string; code: string; name: string }) => (
              <option key={p.id} value={p.id}>{p.code} {p.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100">
          絞り込む
        </button>
        <Link href="/admin/zukan/cards" className="text-xs text-gray-500 hover:underline">リセット</Link>
      </form>

      <p className="mb-3 text-xs text-gray-500">{cards.length}件表示（最大100件）</p>

      <div className="space-y-4">
        {cards.length === 0 && (
          <p className="text-sm text-gray-500">カードが見つかりません。</p>
        )}
        {cards.map(card => (
          <div key={card.id} className="rounded border border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
              <div>
                <span className="font-bold text-sm text-gray-900">
                  <Link href={`/zukan/card/${card.slug}`} className="hover:underline text-blue-700">{card.name}</Link>
                </span>
                <span className="ml-2 text-[10px] text-gray-500">
                  {card.zukan_packs?.code} {card.zukan_packs?.name}
                  {card.rarity && ` · ${card.rarity}`}
                </span>
              </div>
            </div>
            <div className="grid gap-4 px-3 py-3 sm:grid-cols-2">
              {/* Card memo */}
              <div>
                <h3 className="mb-2 text-xs font-bold text-gray-700">ひとことメモ</h3>
                <CardMemoForm cardId={card.id} defaultBody={memoMap[card.id] ?? ''} />
              </div>

              {/* Related threads */}
              <div>
                <h3 className="mb-2 text-xs font-bold text-gray-700">関連スレッド</h3>
                <RelatedThreadForm cardId={card.id} links={linksMap[card.id] ?? []} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
