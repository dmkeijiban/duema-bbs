import type { SupabaseClient } from '@supabase/supabase-js'

type RateLimitTable = 'threads' | 'posts'

type CheckSessionRateLimitOptions = {
  table: RateLimitTable
  sessionId: string
  windowSeconds: number
  minIntervalSeconds: number
  maxInWindow: number
  label: string
}

export async function checkSessionRateLimit(
  supabase: SupabaseClient,
  options: CheckSessionRateLimitOptions,
): Promise<string | null> {
  const since = new Date(Date.now() - options.windowSeconds * 1000).toISOString()
  const { data, error } = await supabase
    .from(options.table)
    .select('created_at')
    .eq('session_id', options.sessionId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(options.maxInWindow)

  if (error) {
    console.warn(`rate limit check failed for ${options.table}:`, error.message)
    return null
  }

  const recentItems = data ?? []
  const latest = recentItems[0]?.created_at

  if (latest) {
    const latestTime = new Date(latest).getTime()
    const waitSeconds = Math.ceil((latestTime + options.minIntervalSeconds * 1000 - Date.now()) / 1000)
    if (waitSeconds > 0) {
      return `${options.label}の連投が速すぎます。${waitSeconds}秒ほど待ってからもう一度試してください。`
    }
  }

  if (recentItems.length >= options.maxInWindow) {
    const waitMinutes = Math.max(1, Math.ceil(options.windowSeconds / 60))
    return `${options.label}の投稿数が短時間で多すぎます。${waitMinutes}分ほど待ってからもう一度試してください。`
  }

  return null
}
