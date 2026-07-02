import type { SupabaseClient } from '@supabase/supabase-js'

type RateLimitTable = 'threads' | 'posts'
type RateLimitColumn = 'session_id' | 'ip_hash'

type CheckSessionRateLimitOptions = {
  table: RateLimitTable
  sessionId: string
  windowSeconds: number
  minIntervalSeconds: number
  maxInWindow: number
  label: string
}

type CheckValueRateLimitOptions = Omit<CheckSessionRateLimitOptions, 'sessionId'> & {
  column: RateLimitColumn
  value: string
}

type RateLimitRule = {
  windowSeconds: number
  minIntervalSeconds: number
  maxInWindow: number
  label: string
}

type CheckValueRateLimitRulesOptions = Pick<CheckValueRateLimitOptions, 'table' | 'column' | 'value'> & {
  rules: RateLimitRule[]
}

function isMissingColumn(error: { code?: string; message?: string } | null) {
  return error?.code === '42703' || error?.message?.includes('column')
}

function evaluateRateLimit(
  recentItems: Array<{ created_at: string | null }>,
  options: RateLimitRule,
): string | null {
  const now = Date.now()
  const windowStartedAt = now - options.windowSeconds * 1000
  const itemsInWindow = recentItems.filter(item => {
    if (!item.created_at) return false
    return new Date(item.created_at).getTime() >= windowStartedAt
  })
  const latest = itemsInWindow[0]?.created_at

  if (latest) {
    const latestTime = new Date(latest).getTime()
    const waitSeconds = Math.ceil((latestTime + options.minIntervalSeconds * 1000 - now) / 1000)
    if (waitSeconds > 0) {
      return `${options.label}の連投が速すぎます。${waitSeconds}秒ほど待ってからもう一度試してください。`
    }
  }

  if (itemsInWindow.length >= options.maxInWindow) {
    const waitMinutes = Math.max(1, Math.ceil(options.windowSeconds / 60))
    return `${options.label}の投稿数が短時間で多すぎます。${waitMinutes}分ほど待ってからもう一度試してください。`
  }

  return null
}

export async function checkValueRateLimit(
  supabase: SupabaseClient,
  options: CheckValueRateLimitOptions,
): Promise<string | null> {
  const since = new Date(Date.now() - options.windowSeconds * 1000).toISOString()
  const { data, error } = await supabase
    .from(options.table)
    .select('created_at')
    .eq(options.column, options.value)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(options.maxInWindow)

  if (error) {
    if (isMissingColumn(error)) return null
    console.warn(`rate limit check failed for ${options.table}:`, error.message)
    return null
  }

  return evaluateRateLimit(data ?? [], options)
}

export async function checkValueRateLimitRules(
  supabase: SupabaseClient,
  options: CheckValueRateLimitRulesOptions,
): Promise<string | null> {
  const maxWindowSeconds = Math.max(...options.rules.map(rule => rule.windowSeconds))
  const maxInWindow = Math.max(...options.rules.map(rule => rule.maxInWindow))
  const since = new Date(Date.now() - maxWindowSeconds * 1000).toISOString()
  const { data, error } = await supabase
    .from(options.table)
    .select('created_at')
    .eq(options.column, options.value)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(maxInWindow)

  if (error) {
    if (isMissingColumn(error)) return null
    console.warn(`rate limit check failed for ${options.table}:`, error.message)
    return null
  }

  const recentItems = data ?? []
  for (const rule of options.rules) {
    const errorMessage = evaluateRateLimit(recentItems, rule)
    if (errorMessage) return errorMessage
  }

  return null
}

export async function checkSessionRateLimit(
  supabase: SupabaseClient,
  options: CheckSessionRateLimitOptions,
): Promise<string | null> {
  return checkValueRateLimit(supabase, {
    ...options,
    column: 'session_id',
    value: options.sessionId,
  })
}
