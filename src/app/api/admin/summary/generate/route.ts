import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { verifyAdminCookie } from '@/lib/admin-auth'

export const runtime = 'nodejs'

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const isAdmin = verifyAdminCookie(cookieStore.get('admin_auth')?.value)
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type = 'weekly' } = await req.json().catch(() => ({}))

  const supabase = createAnonClient()
  const now = new Date()

  let start: Date, end: Date, slug: string, title: string

  if (type === 'monthly') {
    const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 1)
    start = firstOfLastMonth
    end = lastOfLastMonth
    const yyyy = firstOfLastMonth.getUTCFullYear()
    const mm = String(firstOfLastMonth.getUTCMonth() + 1).padStart(2, '0')
    slug = `monthly-${yyyy}-${mm}`
    title = `${yyyy}年${mm}月の人気スレッドTOP5`
  } else {
    // 先週
    const day = now.getUTCDay()
    const daysToLastMonday = day === 0 ? 13 : day + 6
    const lastMonday = new Date(now)
    lastMonday.setUTCDate(now.getUTCDate() - daysToLastMonday)
    lastMonday.setUTCHours(0, 0, 0, 0)
    const lastSunday = new Date(lastMonday)
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6)
    lastSunday.setUTCHours(23, 59, 59, 999)
    start = lastMonday
    end = lastSunday
    const pad = (n: number) => String(n).padStart(2, '0')
    const mm = pad(lastMonday.getUTCMonth() + 1)
    const dd = pad(lastMonday.getUTCDate())
    const em = pad(lastSunday.getUTCMonth() + 1)
    const ed = pad(lastSunday.getUTCDate())
    slug = `weekly-${lastMonday.getUTCFullYear()}-${mm}-${dd}`
    title = `先週の人気スレッドTOP5（${mm}/${dd}〜${em}/${ed}）`
  }

  // 既存チェック（スキップ時もキャッシュをリフレッシュ）
  const { data: existing } = await supabase.from('summaries').select('id').eq('slug', slug).maybeSingle()
  if (existing) {
    revalidateTag('summaries', { expire: 0 })
    revalidatePath('/category', 'layout')
    return NextResponse.json({ ok: true, skipped: true, slug })
  }

  // 期間内の投稿を集計
  const { data: posts } = await supabase
    .from('posts')
    .select('thread_id')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())

  const countMap: Record<number, number> = {}
  for (const p of posts ?? []) {
    if (p.thread_id) countMap[p.thread_id] = (countMap[p.thread_id] ?? 0) + 1
  }

  // データが少なければ全期間のpost_countで代用
  let top5Ids: number[]
  if (Object.keys(countMap).length < 3) {
    const { data: topThreads } = await supabase
      .from('threads')
      .select('id')
      .eq('is_archived', false)
      .order('post_count', { ascending: false })
      .limit(5)
    top5Ids = (topThreads ?? []).map(t => t.id)
    for (const id of top5Ids) if (!countMap[id]) countMap[id] = 0
  } else {
    top5Ids = Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => Number(id))
  }

  if (top5Ids.length === 0) return NextResponse.json({ error: 'スレッドがありません' }, { status: 400 })

  const { data: threads } = await supabase
    .from('threads')
    .select('id, title, post_count, image_url, categories(name, color)')
    .in('id', top5Ids)

  const threadsJson = top5Ids.map((id, i) => {
    const t = (threads ?? []).find(th => th.id === id)
    if (!t) return null
    const cats = t.categories as unknown as { name: string; color: string } | null
    return {
      id: t.id, title: t.title, post_count: t.post_count,
      activity: countMap[id] ?? 0, image_url: t.image_url ?? null,
      category_name: cats?.name ?? null, category_color: cats?.color ?? null, rank: i + 1,
    }
  }).filter(Boolean)

  const { error } = await supabase.from('summaries').insert({
    type, slug, title,
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
    threads: threadsJson, published: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/summary')
  revalidatePath('/category', 'layout')

  return NextResponse.json({ ok: true, slug, title, threadCount: threadsJson.length })
}
