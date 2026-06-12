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
