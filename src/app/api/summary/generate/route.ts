import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'
export const maxDuration = 60

// Supabase anon クライアント（summariesテーブルはanonでINSERT可）
function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function getLastWeekRange(): { start: Date; end: Date; slug: string; title: string } {
  const now = new Date()
  // UTC月曜日を起点に計算
  const day = now.getUTCDay() // 0=Sun, 1=Mon, ...
  const daysToLastMonday = day === 0 ? 13 : day + 6
  const lastMonday = new Date(now)
  lastMonday.setUTCDate(now.getUTCDate() - daysToLastMonday)
  lastMonday.setUTCHours(0, 0, 0, 0)

  const lastSunday = new Date(lastMonday)
  lastSunday.setUTCDate(lastMonday.getUTCDate() + 6)
  lastSunday.setUTCHours(23, 59, 59, 999)

  const pad = (n: number) => String(n).padStart(2, '0')
  const mm = pad(lastMonday.getUTCMonth() + 1)
  const dd = pad(lastMonday.getUTCDate())
  const yyyy = lastMonday.getUTCFullYear()
  const slug = `weekly-${yyyy}-${mm}-${dd}`

  const endMm = pad(lastSunday.getUTCMonth() + 1)
  const endDd = pad(lastSunday.getUTCDate())
  const title = `先週の人気スレッドTOP5（${mm}/${dd}〜${endMm}/${endDd}）`

  return { start: lastMonday, end: lastSunday, slug, title }
}

function getLastMonthRange(): { start: Date; end: Date; slug: string; title: string } {
  const now = new Date()
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 1)

  const yyyy = firstOfLastMonth.getUTCFullYear()
  const mm = String(firstOfLastMonth.getUTCMonth() + 1).padStart(2, '0')
  const slug = `monthly-${yyyy}-${mm}`
  const title = `${yyyy}年${mm}月の人気スレッドTOP5`

  return { start: firstOfLastMonth, end: lastOfLastMonth, slug, title }
}

export async function GET(req: NextRequest) {
  // CRON_SECRET による認証
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const typeParam = req.nextUrl.searchParams.get('type') ?? 'weekly'
  const isMonthly = typeParam === 'monthly'

  const { start, end, slug, title } = isMonthly
    ? getLastMonthRange()
    : getLastWeekRange()

  const supabase = createAnonClient()

  // 既存チェック（重複INSERT防止）
  const { data: existing } = await supabase
    .from('summaries')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, skipped: true, slug })
  }

  // 対象期間のpostsを取得（thread_idのみ）
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('thread_id')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())

  if (postsError) {
    console.error('posts fetch error:', postsError)
    return NextResponse.json({ error: postsError.message }, { status: 500 })
  }

  // スレッドごとの投稿数集計
  const countMap: Record<number, number> = {}
  for (const p of posts ?? []) {
    if (p.thread_id) {
      countMap[p.thread_id] = (countMap[p.thread_id] ?? 0) + 1
    }
  }

  if (Object.keys(countMap).length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no posts in range', slug })
  }

  // 上位5スレッドのIDを取得
  const top5Ids = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => Number(id))

  // スレッド詳細取得
  const { data: threads, error: threadError } = await supabase
    .from('threads')
    .select('id, title, post_count, image_url, category_id, categories(name, color)')
    .in('id', top5Ids)

  if (threadError) {
    console.error('threads fetch error:', threadError)
    return NextResponse.json({ error: threadError.message }, { status: 500 })
  }

  // top5Ids の順序に並べ直してランク付け
  const threadsJson = top5Ids.map((id, i) => {
    const t = (threads ?? []).find(th => th.id === id)
    if (!t) return null
    const cats = t.categories as unknown as { name: string; color: string } | null
    return {
      id: t.id,
      title: t.title,
      post_count: t.post_count,
      activity: countMap[id] ?? 0,
      image_url: t.image_url ?? null,
      category_name: cats?.name ?? null,
      category_color: cats?.color ?? null,
      rank: i + 1,
    }
  }).filter(Boolean)

  // summaries INSERT
  const periodStart = start.toISOString().slice(0, 10)
  const periodEnd = end.toISOString().slice(0, 10)

  const { error: insertError } = await supabase
    .from('summaries')
    .insert({
      type: isMonthly ? 'monthly' : 'weekly',
      slug,
      title,
      period_start: periodStart,
      period_end: periodEnd,
      threads: threadsJson,
      published: true,
    })

  if (insertError) {
    console.error('insert error:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  revalidatePath('/summary')

  return NextResponse.json({ ok: true, slug, title, threadCount: threadsJson.length })
}
