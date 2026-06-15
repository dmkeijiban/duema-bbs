import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'

import { createAdminClient } from './supabase-admin'
import { createClient } from './supabase-server'
import { normalizeZukanAnonInput, normalizeZukanDisplayName } from './zukan-display'

const ZUKAN_ANON_COOKIE = 'zukan_anon_key'

export type ZukanPosterContext = {
  userId: string | null
  anonKey: string
  displayName: string
  blockedMessage?: string
}

export type ZukanPosterContextReadOnly = {
  userId: string | null
  anonKey: string | null
  displayName: string
  blockedMessage?: string
}

export async function getZukanPosterContext(
  rawDisplayName: string | null
): Promise<ZukanPosterContext> {
  const cookieStore = await cookies()
  let anonKey = cookieStore.get(ZUKAN_ANON_COOKIE)?.value
  if (!anonKey) {
    anonKey = randomUUID()
    cookieStore.set(ZUKAN_ANON_COOKIE, anonKey, {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  }

  const fallbackName = normalizeZukanAnonInput(rawDisplayName)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { userId: null, anonKey, displayName: fallbackName }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, profile_hidden, account_suspended, withdrawn_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.account_suspended || profile?.withdrawn_at) {
    return {
      userId: null,
      anonKey,
      displayName: fallbackName,
      blockedMessage: 'このアカウントでは投稿できません。',
    }
  }

  if (profile && !profile.profile_hidden) {
    return {
      userId: user.id,
      anonKey,
      displayName: normalizeZukanDisplayName(profile.display_name),
    }
  }

  return { userId: null, anonKey, displayName: fallbackName }
}

export async function getZukanPosterContextReadOnly(
  rawDisplayName: string | null
): Promise<ZukanPosterContextReadOnly> {
  const cookieStore = await cookies()
  const anonKey = cookieStore.get(ZUKAN_ANON_COOKIE)?.value ?? null

  const fallbackName = normalizeZukanAnonInput(rawDisplayName)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { userId: null, anonKey, displayName: fallbackName }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, profile_hidden, account_suspended, withdrawn_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.account_suspended || profile?.withdrawn_at) {
    return {
      userId: null,
      anonKey,
      displayName: fallbackName,
      blockedMessage: 'このアカウントでは投稿できません。',
    }
  }

  if (profile && !profile.profile_hidden) {
    return {
      userId: user.id,
      anonKey,
      displayName: normalizeZukanDisplayName(profile.display_name),
    }
  }

  return { userId: null, anonKey, displayName: fallbackName }
}

export async function hasRecentZukanPost(
  table: 'zukan_pack_reviews' | 'zukan_card_reviews',
  targetColumn: 'pack_id' | 'card_id',
  targetId: string,
  context: ZukanPosterContext,
  seconds = 60
): Promise<boolean> {
  const since = new Date(Date.now() - seconds * 1000).toISOString()
  const admin = createAdminClient()
  let query = admin
    .from(table)
    .select('id')
    .eq(targetColumn, targetId)
    .eq('is_deleted', false)
    .gte('created_at', since)
    .limit(1)

  if (context.userId) {
    query = query.eq('user_id', context.userId)
  } else {
    query = query.eq('anon_key', context.anonKey)
  }

  const { data, error } = await query
  if (error) return false
  return Boolean(data && data.length > 0)
}

const ZUKAN_DAILY_POST_LIMIT = 3

function getJstDayRange(date = new Date()): { start: string; end: string } {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const [year, month, day] = jst.toISOString().slice(0, 10).split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function getZukanDailyPostIssue(
  table: 'zukan_pack_reviews' | 'zukan_card_reviews',
  targetColumn: 'pack_id' | 'card_id',
  targetId: string,
  context: ZukanPosterContext,
  body: string,
): Promise<'limit' | 'duplicate' | null> {
  const { start, end } = getJstDayRange()
  const admin = createAdminClient()
  let query = admin
    .from(table)
    .select('id, body')
    .eq(targetColumn, targetId)
    .eq('is_deleted', false)
    .gte('created_at', start)
    .lt('created_at', end)
    .limit(ZUKAN_DAILY_POST_LIMIT + 1)

  if (context.userId) {
    query = query.eq('user_id', context.userId)
  } else {
    query = query.eq('anon_key', context.anonKey).is('user_id', null)
  }

  const { data, error } = await query
  if (error) return null

  const rows = data ?? []
  if (rows.some(row => String(row.body ?? '').trim() === body.trim())) {
    return 'duplicate'
  }
  return rows.length >= ZUKAN_DAILY_POST_LIMIT ? 'limit' : null
}
