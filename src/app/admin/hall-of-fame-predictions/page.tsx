import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { HallOfFamePredictionBuilder, type PredictionCandidate } from './HallOfFamePredictionBuilder'

// Keep this prototype private until the shared card foundation is fully verified.
export const metadata: Metadata = { title: '殿堂・プレ殿予想（非公開） | デュエマ掲示板', robots: { index: false, follow: false } }
const PAGE_SIZE = 60

type SearchParams = { q?: string; page?: string; sort?: string }
export default async function PrivateHallOfFamePredictionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)) redirect('/admin')
  const params = await searchParams
  const q = params.q?.trim().slice(0, 80) ?? ''
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const sort = ['name', 'created', 'cost'].includes(params.sort ?? '') ? params.sort! : 'name'
  let candidates: PredictionCandidate[] = [], total = 0, unavailable = false
  try {
    let request = createAdminClient().from('cards').select('id,name,image_url,civilization,cost,card_type,regulation,created_at', { count: 'exact' }).eq('is_active', true)
    if (q) request = request.ilike('name', `%${q.replace(/[%_]/g, '\\$&')}%`)
    request = sort === 'created' ? request.order('created_at', { ascending: false }) : sort === 'cost' ? request.order('cost', { ascending: true, nullsFirst: false }).order('name') : request.order('name')
    const { data, count, error } = await request.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    if (error) throw error
    total = count ?? 0
    candidates = (data ?? []).map(card => ({ id: card.id, name: card.name, imageUrl: card.image_url, civilization: card.civilization ?? [], cost: card.cost, cardType: card.card_type, regulation: card.regulation }))
  } catch { unavailable = true }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return <main className="min-h-screen bg-gray-50 px-3 py-5 sm:px-5 sm:py-8"><div className="mx-auto max-w-7xl"><Link href="/admin" className="text-xs font-bold text-blue-700">← 管理画面へ戻る</Link><div className="mt-3 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-black">殿堂・プレ殿予想</h1><p className="mt-1 text-sm text-gray-500">cardsマスターの有効カードから予想を作成します</p></div><span className="rounded-full border bg-white px-3 py-1 text-xs font-bold">管理者限定・非公開</span></div><form className="mt-5 flex flex-wrap gap-2 rounded border bg-white p-3"><input name="q" defaultValue={q} placeholder="カード名をサーバー検索" className="min-w-64 flex-1 rounded border px-3 py-2 text-sm"/><select name="sort" defaultValue={sort} className="rounded border px-3 py-2 text-sm"><option value="name">名前順</option><option value="created">登録順</option><option value="cost">コスト順</option></select><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white">検索</button></form>{unavailable && <p className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">cardsテーブルはまだ利用できません。Preview専用DBの準備後に候補が表示されます。</p>}<div className="mt-4"><HallOfFamePredictionBuilder candidates={candidates} totalCandidates={total} /></div>{pages > 1 && <nav className="mt-4 flex justify-center gap-2 text-sm">{page > 1 && <Link className="rounded border bg-white px-3 py-2" href={`?q=${encodeURIComponent(q)}&sort=${sort}&page=${page-1}`}>前へ</Link>}<span className="px-3 py-2">{page} / {pages}</span>{page < pages && <Link className="rounded border bg-white px-3 py-2" href={`?q=${encodeURIComponent(q)}&sort=${sort}&page=${page+1}`}>次へ</Link>}</nav>}</div></main>
}
