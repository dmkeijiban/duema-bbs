import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { CARD_INCOMPLETE_OR_FILTER, getCardMissingFields } from '@/lib/card-completeness'
import { createAdminClient } from '@/lib/supabase-admin'
import { toggleCard, updateCard } from './actions'

export const metadata: Metadata = { title: '共通カード管理（非公開）', robots: { index: false, follow: false } }
type Params = { q?: string; state?: string; issue?: string; regulation?: string }

type CardRow = {
  id: string
  name: string
  image_url: string | null
  civilization: string[] | null
  cost: number | null
  card_type: string | null
  regulation: string
  is_active: boolean
  source_kind: string | null
  source_key: string | null
}

export default async function CardsPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  const p = await searchParams
  const q = p.q?.trim().slice(0, 80) ?? ''
  const issue = p.issue ?? 'missing'
  let cards: CardRow[] = []
  let total = 0
  let incompleteTotal = 0
  let filteredTotal = 0
  let unavailable = false

  try {
    const admin = createAdminClient()
    const [totalResult, incompleteResult] = await Promise.all([
      admin.from('cards').select('id', { count: 'exact', head: true }),
      admin.from('cards').select('id', { count: 'exact', head: true }).or(CARD_INCOMPLETE_OR_FILTER),
    ])
    if (totalResult.error) throw totalResult.error
    if (incompleteResult.error) throw incompleteResult.error
    total = totalResult.count ?? 0
    incompleteTotal = incompleteResult.count ?? 0

    let request = admin
      .from('cards')
      .select('id,name,image_url,civilization,cost,card_type,regulation,is_active,source_kind,source_key', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(100)
    if (q) request = request.ilike('name', `%${q.replace(/[%_]/g, '\\$&')}%`)
    if (p.state === 'active') request = request.eq('is_active', true)
    if (p.state === 'inactive') request = request.eq('is_active', false)
    if (p.regulation) request = request.eq('regulation', p.regulation)
    if (p.issue === 'image') request = request.is('image_url', null)
    if (issue === 'missing') request = request.or(CARD_INCOMPLETE_OR_FILTER)
    const result = await request
    if (result.error) throw result.error
    cards = (result.data ?? []) as CardRow[]
    filteredTotal = result.count ?? 0
  } catch {
    unavailable = true
  }

  return (
    <main className="mx-auto max-w-7xl px-3 py-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm font-bold text-blue-700">← 管理画面へ</Link>
          <h1 className="mt-2 text-2xl font-black">共通カード管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tier表・デッキメーカー・思い出図鑑で共通利用する非公開のカード置き場です。
          </p>
        </div>
        <Link href="/admin/cards/import" className="h-fit rounded border bg-white px-3 py-2 text-sm font-bold">
          カード取り込み
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded border bg-white p-3">
          <p className="text-xs text-gray-500">全カード</p>
          <p className="text-2xl font-black">{total}<span className="ml-1 text-sm font-normal">件</span></p>
        </div>
        <div className="rounded border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-800">未完成カード</p>
          <p className="text-2xl font-black text-amber-900">{incompleteTotal}<span className="ml-1 text-sm font-normal">件</span></p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        画像・文明・コスト・種類のいずれかがないカードは、登録経路に関係なく自動的に未完成と判定されます。
      </p>

      <form className="mt-4 flex flex-wrap gap-2 rounded border bg-gray-50 p-3">
        <input name="q" defaultValue={q} placeholder="カード名" className="rounded border px-3 py-2 text-sm" />
        <select name="issue" defaultValue={issue} className="rounded border px-2">
          <option value="missing">未完成のみ</option>
          <option value="image">画像なし</option>
          <option value="">すべて</option>
        </select>
        <select name="state" defaultValue={p.state ?? ''} className="rounded border px-2">
          <option value="">状態: すべて</option>
          <option value="active">有効</option>
          <option value="inactive">無効</option>
        </select>
        <input name="regulation" defaultValue={p.regulation ?? ''} placeholder="regulation" className="rounded border px-3 py-2 text-sm" />
        <button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white">絞り込み</button>
      </form>

      {unavailable ? (
        <p className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">カード情報を取得できませんでした。</p>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-500">該当: {filteredTotal}件（最大100件表示）</p>
          {cards.map(card => {
            const missingFields = getCardMissingFields(card)
            return (
              <details key={card.id} className="rounded border bg-white p-3">
                <summary className="cursor-pointer font-bold">
                  {card.name}
                  {missingFields.length > 0 ? (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">不足: {missingFields.join('・')}</span>
                  ) : (
                    <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">最低限完了</span>
                  )}
                  <span className="ml-2 text-xs text-gray-500">{card.is_active ? '有効' : '無効'} / {card.regulation}</span>
                </summary>
                <form action={updateCard} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <input type="hidden" name="id" value={card.id} />
                  <label className="text-xs">カード名<input name="name" defaultValue={card.name} className="mt-1 w-full rounded border p-2" /></label>
                  <label className="text-xs">画像URL<input name="image_url" defaultValue={card.image_url ?? ''} className="mt-1 w-full rounded border p-2" /></label>
                  <label className="text-xs">文明（/ 区切り）<input name="civilization" defaultValue={(card.civilization ?? []).join('/')} className="mt-1 w-full rounded border p-2" /></label>
                  <label className="text-xs">コスト<input name="cost" type="number" min="0" defaultValue={card.cost ?? ''} className="mt-1 w-full rounded border p-2" /></label>
                  <label className="text-xs">種類<input name="card_type" defaultValue={card.card_type ?? ''} className="mt-1 w-full rounded border p-2" /></label>
                  <label className="text-xs">regulation<input name="regulation" defaultValue={card.regulation} className="mt-1 w-full rounded border p-2" /></label>
                  <label className="text-xs">取得元種別<input value={card.source_kind ?? ''} readOnly className="mt-1 w-full rounded border bg-gray-50 p-2 text-gray-500" /></label>
                  <label className="text-xs">取得元ID<input value={card.source_key ?? ''} readOnly className="mt-1 w-full rounded border bg-gray-50 p-2 text-gray-500" /></label>
                  <button className="w-fit rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white">更新</button>
                </form>
                <form action={toggleCard} className="mt-2">
                  <input type="hidden" name="id" value={card.id} />
                  <input type="hidden" name="active" value={String(card.is_active)} />
                  <button className="rounded border px-3 py-1.5 text-xs font-bold">{card.is_active ? '無効化' : '有効化'}</button>
                </form>
              </details>
            )
          })}
          {cards.length === 0 && <p className="py-12 text-center text-gray-500">該当カードはありません。</p>}
        </div>
      )}
    </main>
  )
}
