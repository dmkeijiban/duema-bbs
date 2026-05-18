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

const SUMMARY_RANKING_LIMIT = 10
const TOP10_REPAIR_START = '2026-05-01'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function getCompletedWeekStart(weeksAgo = 1) {
  const now = new Date()
  const day = now.getUTCDay()
  const daysToLastMonday = day === 0 ? 13 : day + 6
  const start = new Date(now)
  start.setUTCDate(now.getUTCDate() - daysToLastMonday - (Math.max(1, weeksAgo) - 1) * 7)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

function getWeekRangeFromStart(start: Date) {
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
    title: `先週の人気スレッドTOP10（${startMonth}/${startDay}〜${endMonth}/${endDay}）`,
  }
}

function getLastWeekRange(weeksAgo = 1) {
  return getWeekRangeFromStart(getCompletedWeekStart(weeksAgo))
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
    title: `${year}年${month}月の人気スレッドTOP10`,
  }
}

function parseWeeklyStart(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const start = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return null
  return start
}

function getRange(req: NextRequest, type: SummaryType) {
  if (type === 'monthly') return getLastMonthRange()

  const requestedStart = parseWeeklyStart(req.nextUrl.searchParams.get('start'))
  if (requestedStart) return getWeekRangeFromStart(requestedStart)

  const weeksAgoParam = Number(req.nextUrl.searchParams.get('weeksAgo') ?? '1')
  const weeksAgo = Number.isFinite(weeksAgoParam) ? Math.max(1, Math.min(12, Math.floor(weeksAgoParam))) : 1
  return getLastWeekRange(weeksAgo)
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
    .slice(0, SUMMARY_RANKING_LIMIT)
    .map(([id]) => Number(id))

  return { topIds, countMap }
}

async function getFallbackPopularThreadIds(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase
    .from('threads')
    .select('id')
    .eq('is_archived', false)
    .order('post_count', { ascending: false })
    .limit(SUMMARY_RANKING_LIMIT)

  if (error) throw new Error(error.message)
  return (data ?? []).map(thread => thread.id as number)
}

async function buildThreadsJson(
  supabase: ReturnType<typeof createAdminClient>,
  topIds: number[],
  countMap: Record<number, number>,
) {
  const { data: threads, error: threadError } = await supabase
    .from('threads')
    .select('id, title, post_count, image_url, categories(name, color)')
    .in('id', topIds)

  if (threadError) throw new Error(threadError.message)

  const threadRows = (threads ?? []) as unknown as ThreadRow[]
  return topIds
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
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const typeParam = req.nextUrl.searchParams.get('type')
  const type: SummaryType = typeParam === 'monthly' ? 'monthly' : 'weekly'
  const { start, end, slug, title } = getRange(req, type)
  const supabase = createAdminClient()

  const { data: existing, error: existingError } = await supabase
    .from('summaries')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

  const { topIds: activityTopIds, countMap } = await getTopThreadIdsByActivity(supabase, start, end)
  const usedFallback = activityTopIds.length < 3
  const topIds = usedFallback ? await getFallbackPopularThreadIds(supabase) : activityTopIds

  if (topIds.length === 0) {
    return NextResponse.json({ error: 'No threads found for summary' }, { status: 500 })
  }

  const threadsJson = await buildThreadsJson(supabase, topIds, countMap)
  const periodStart = start.toISOString().slice(0, 10)
  const periodEnd = end.toISOString().slice(0, 10)

  if (existing) {
    const shouldRepairTop10 = type === 'weekly' && periodEnd >= TOP10_REPAIR_START
    if (!shouldRepairTop10) {
      return NextResponse.json({ ok: true, skipped: true, slug })
    }

    const { error: updateError } = await supabase
      .from('summaries')
      .update({
        title,
        period_start: periodStart,
        period_end: periodEnd,
        threads: threadsJson,
        published: true,
      })
      .eq('id', existing.id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    revalidateTag('summaries', { expire: 0 })
    revalidatePath('/summary')
    revalidatePath(`/summary/${slug}`)
    revalidatePath('/')

    return NextResponse.json({
      ok: true,
      updated: true,
      slug,
      title,
      threadCount: threadsJson.length,
      usedFallback,
    })
  }

  const { error: insertError } = await supabase.from('summaries').insert({
    type,
    slug,
    title,
    period_start: periodStart,
    period_end: periodEnd,
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
