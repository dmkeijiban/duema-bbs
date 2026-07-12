import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { toggleCard, updateCard } from './actions'

export const metadata: Metadata = { title: '共通カード管理（非公開）', robots: { index: false, follow: false } }
type Params = { q?: string; state?: string; issue?: string; regulation?: string }
export default async function CardsPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  const p = await searchParams, q = p.q?.trim().slice(0, 80) ?? ''
  let cards: Record<string, unknown>[] = [], total = 0, unavailable = false
  try {
    let request = createAdminClient().from('cards').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(100)
    if (q) request = request.ilike('name', `%${q.replace(/[%_]/g, '\\$&')}%`)
    if (p.state === 'active') request = request.eq('is_active', true); if (p.state === 'inactive') request = request.eq('is_active', false)
    if (p.regulation) request = request.eq('regulation', p.regulation)
    if (p.issue === 'image') request = request.is('image_url', null)
    if (p.issue === 'missing') request = request.or('image_url.is.null,card_type.is.null,cost.is.null')
    const result = await request; if (result.error) throw result.error; cards = result.data ?? []; total = result.count ?? 0
  } catch { unavailable = true }
  return <main className="mx-auto max-w-7xl px-3 py-6"><div className="flex flex-wrap justify-between gap-3"><div><Link href="/admin" className="text-sm font-bold text-blue-700">← 管理画面へ</Link><h1 className="mt-2 text-2xl font-black">共通カード管理</h1><p className="text-sm text-gray-500">登録件数: {total}件（最大100件表示）</p></div><Link href="/admin/cards/import" className="h-fit rounded border bg-white px-3 py-2 text-sm font-bold">カード取り込み</Link></div><form className="mt-4 flex flex-wrap gap-2 rounded border bg-gray-50 p-3"><input name="q" defaultValue={q} placeholder="カード名" className="rounded border px-3 py-2 text-sm"/><select name="issue" defaultValue={p.issue ?? ''} className="rounded border px-2"><option value="">不足: すべて</option><option value="image">画像なし</option><option value="missing">情報不足</option></select><select name="state" defaultValue={p.state ?? ''} className="rounded border px-2"><option value="">状態: すべて</option><option value="active">有効</option><option value="inactive">無効</option></select><input name="regulation" defaultValue={p.regulation ?? ''} placeholder="regulation" className="rounded border px-3 py-2 text-sm"/><button className="rounded bg-blue-700 px-4 text-sm font-bold text-white">絞り込み</button></form>{unavailable ? <p className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">Preview専用DBへmigration適用後に利用できます。</p> : <div className="mt-4 space-y-3">{cards.map(card => <details key={String(card.id)} className="rounded border bg-white p-3"><summary className="cursor-pointer font-bold">{String(card.name)} <span className="ml-2 text-xs text-gray-500">{card.is_active ? '有効' : '無効'} / {String(card.regulation)}</span></summary><form action={updateCard} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><input type="hidden" name="id" value={String(card.id)}/><label className="text-xs">カード名<input name="name" defaultValue={String(card.name)} className="mt-1 w-full rounded border p-2"/></label><label className="text-xs">画像URL<input name="image_url" defaultValue={String(card.image_url ?? '')} className="mt-1 w-full rounded border p-2"/></label><label className="text-xs">文明（/ 区切り）<input name="civilization" defaultValue={(card.civilization as string[] ?? []).join('/')} className="mt-1 w-full rounded border p-2"/></label><label className="text-xs">コスト<input name="cost" type="number" min="0" defaultValue={card.cost == null ? '' : String(card.cost)} className="mt-1 w-full rounded border p-2"/></label><label className="text-xs">種類<input name="card_type" defaultValue={String(card.card_type ?? '')} className="mt-1 w-full rounded border p-2"/></label><label className="text-xs">regulation<input name="regulation" defaultValue={String(card.regulation)} className="mt-1 w-full rounded border p-2"/></label><button className="w-fit rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white">更新</button></form><form action={toggleCard} className="mt-2"><input type="hidden" name="id" value={String(card.id)}/><input type="hidden" name="active" value={String(card.is_active)}/><button className="rounded border px-3 py-1.5 text-xs font-bold">{card.is_active ? '無効化' : '有効化'}</button></form></details>)}{cards.length === 0 && <p className="py-12 text-center text-gray-500">該当カードはありません。</p>}</div>}</main>
}
