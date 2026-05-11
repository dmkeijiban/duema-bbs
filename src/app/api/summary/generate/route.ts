import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const maxDuration = 60

type SummaryType = 'weekly' | 'monthly'

type ThreadRow = {
  id: number
  title: string
  post_count: number
  image_url: string | null
  categories: { name: string | null; color: string | null } | null
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function getLastWeekRange() {
  const now = new Date()
  const day = now.getUTCDay()
  const daysToLastMonday = day === 0 ? 13 : day + 6
  const start = new Date(now)
  start.setUTCDate(now.getUTCDate() - daysToLastMonday)
  start.setUTCHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)

  const startMonth = pad(start.getUTCMonth() + 1)
  const startDay = pad(start.getUTCDate())
  const endMonth = pad(end.getUTCMonth() + 1)
  const endDay = pad(end.getUTCDate())

  return {
    start,
    end,
    slug: `weekly-${start.getUTCFullYear()}-${startMonth}-${startDay}`,
    title: `先週の人気スレッドTOP5（${startMonth}/${startDay}〜${endMonth}/${endDay}）`,
  }
}

function getLastMonthRange() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 1)
  const year = start.getUTCFullYear()
  const month = pad(start.getUTCMonth() + 1)

  return {
    start,
    end,
    slug: `monthly-${year}-${month}`,
    title: `${year}年${month}月の人気スレッドTOP5`,
  }
}

function getRange(type: SummaryType) {
  return type === 'monthly' ? getLastMonthRange() : getLastWeekRange()
}

async function getTopThreadIdsByActivity(
  supabase: ReturnType<typeof createAdminClient>,
  start: Date,
  end: Date,
) {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('thread_id')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .eq('is_deleted', false)

  if (error) throw new Error(error.message)

  const countMap: Record<number, number> = {}
  for (const post of posts ?? []) {
    if (post.thread_id) countMap[post.thread_id] = (countMap[post.thread_id] ?? 0) + 1
  }

  const topIds = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => Number(id))

  return { topIds, countMap }
}

async function getFallbackPopularThreadIds(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from('threads')
    .select('id')
    .eq('is_archived', false)
    .order('post_count', { ascending: false })
    .limit(5)

  if (error) throw new Error(error.message)
  return (data ?? []).map(thread => thread.id as number)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const typeParam = req.nextUrl.searchParams.get('type')
  const type: SummaryType = typeParam === 'monthly' ? 'monthly' : 'weekly'
  const { start, end, slug, title } = getRange(type)
  const supabase = createAdminClient()

  const { data: existing, error: existingError } = await supabase
    .from('summaries')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (existing) return NextResponse.json({ ok: true, skipped: true, slug })

  const { topIds: activityTopIds, countMap } = await getTopThreadIdsByActivity(supabase, start, end)
  const usedFallback = activityTopIds.length < 3
  const topIds = usedFallback ? await getFallbackPopularThreadIds(supabase) : activityTopIds

  if (topIds.length === 0) {
    return NextResponse.json({ error: 'No threads found for summary' }, { status: 500 })
  }

  const { data: threads, error: threadError } = await supabase
    .from('threads')
    .select('id, title, post_count, image_url, categories(name, color)')
    .in('id', topIds)

  if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 })

  const threadRows = (threads ?? []) as unknown as ThreadRow[]
  const threadsJson = topIds
    .map((id, index) => {
      const thread = threadRows.find(item => item.id === id)
      if (!thread) return null

      return {
        id: thread.id,
        title: thread.title,
        post_count: thread.post_count,
        activity: countMap[id] ?? 0,
        image_url: thread.image_url ?? null,
        category_name: thread.categories?.name ?? null,
        category_color: thread.categories?.color ?? null,
        rank: index + 1,
      }
    })
    .filter(Boolean)

  const { error: insertError } = await supabase.from('summaries').insert({
    type,
    slug,
    title,
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
    threads: threadsJson,
    published: true,
  })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  revalidateTag('summaries', { expire: 0 })
  revalidatePath('/summary')
  revalidatePath('/')

  return NextResponse.json({
    ok: true,
    slug,
    title,
    threadCount: threadsJson.length,
    usedFallback,
  })
}
