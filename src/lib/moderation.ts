import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-admin'

type NgWordRow = {
  word: string
}

type BanRow = {
  id: number
}

function normalizeForModeration(text: string) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
}

function isMissingModerationTable(error: { code?: string; message?: string } | null) {
  return error?.code === '42P01' || error?.message?.includes('moderation_')
}

function isMissingColumn(error: { code?: string; message?: string } | null, column: string) {
  return error?.code === '42703' || error?.message?.includes(column)
}

export async function checkNgWords(
  supabase: SupabaseClient,
  fields: string[],
): Promise<string | null> {
  const { data, error } = await supabase
    .from('moderation_ng_words')
    .select('word')
    .eq('is_active', true)

  if (error) {
    if (isMissingModerationTable(error)) return null
    console.error('NG word check error:', error)
    return null
  }

  const text = normalizeForModeration(fields.join('\n'))
  for (const row of (data ?? []) as NgWordRow[]) {
    const word = normalizeForModeration(row.word)
    if (word && text.includes(word)) return row.word
  }

  return null
}

export async function checkSessionBan(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<boolean> {
  if (!sessionId) return false

  const { data, error } = await supabase
    .from('moderation_bans')
    .select('id')
    .eq('ban_type', 'session')
    .eq('ban_value', sessionId)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(1)

  if (error) {
    if (isMissingModerationTable(error)) return false
    console.error('Ban check error:', error)
    return false
  }

  return ((data ?? []) as BanRow[]).length > 0
}

async function hasActiveBan(
  supabase: SupabaseClient,
  banType: 'session' | 'user',
  banValue: string | null | undefined,
): Promise<boolean> {
  const value = banValue?.trim()
  if (!value) return false

  const now = new Date().toISOString()
  const query = () => supabase
    .from('moderation_bans')
    .select('id')
    .eq('ban_type', banType)
    .eq('ban_value', value)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .limit(1)

  let { data, error } = await query()

  if (error && isMissingColumn(error, 'expires_at')) {
    const fallback = await supabase
      .from('moderation_bans')
      .select('id')
      .eq('ban_type', banType)
      .eq('ban_value', value)
      .eq('is_active', true)
      .limit(1)
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    if (isMissingModerationTable(error)) return false
    console.error('[moderation] Posting ban check failed:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      banType,
    })
    return false
  }

  return ((data ?? []) as BanRow[]).length > 0
}

export async function checkPostingBan(params: {
  sessionId?: string | null
  userId?: string | null
}): Promise<boolean> {
  const admin = createAdminClient()
  if (await hasActiveBan(admin, 'session', params.sessionId)) return true
  if (await hasActiveBan(admin, 'user', params.userId)) return true
  return false
}
