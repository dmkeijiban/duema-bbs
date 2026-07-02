'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

interface ReportParams {
  itemType: 'post' | 'thread'
  itemId: number
  reason: string
  itemBody: string
}

function getTodayJstRange() {
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = jstNow.getUTCFullYear()
  const m = jstNow.getUTCMonth()
  const d = jstNow.getUTCDate()
  const startUtc = new Date(Date.UTC(y, m, d, -9, 0, 0, 0))
  const endUtc = new Date(Date.UTC(y, m, d + 1, -9, 0, 0, 0))
  return { start: startUtc.toISOString(), end: endUtc.toISOString() }
}

async function isMutedReporter(userId: string | null, sessionId: string | null) {
  const admin = createAdminClient()

  if (userId) {
    const { data } = await admin
      .from('report_mutes')
      .select('id')
      .eq('is_active', true)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (data?.id) return true
  }

  if (sessionId) {
    const { data } = await admin
      .from('report_mutes')
      .select('id')
      .eq('is_active', true)
      .eq('session_id', sessionId)
      .limit(1)
      .maybeSingle()
    if (data?.id) return true
  }

  return false
}

async function hasReportedToday(userId: string | null, sessionId: string | null) {
  const admin = createAdminClient()
  const { start, end } = getTodayJstRange()

  if (userId) {
    const { data } = await admin
      .from('reports')
      .select('id')
      .eq('reporter_user_id', userId)
      .gte('created_at', start)
      .lt('created_at', end)
      .limit(1)
      .maybeSingle()
    if (data?.id) return true
  }

  if (sessionId) {
    const { data } = await admin
      .from('reports')
      .select('id')
      .eq('reporter_session_id', sessionId)
      .gte('created_at', start)
      .lt('created_at', end)
      .limit(1)
      .maybeSingle()
    if (data?.id) return true
  }

  return false
}

export async function reportItem({ itemType, itemId, reason, itemBody }: ReportParams) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id ?? null
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('bbs_session')?.value ?? null

  if (await isMutedReporter(userId, sessionId)) {
    return { error: '通報を受け付けできませんでした' }
  }

  if (await hasReportedToday(userId, sessionId)) {
    return { error: '通報は1日1回までです' }
  }

  const admin = createAdminClient()
  const itemBodyExcerpt = itemBody.slice(0, 200)
  const safeReason = reason.trim().slice(0, 500)

  const { error: insertError } = await admin
    .from('reports')
    .insert({
      item_type: itemType,
      item_id: itemId,
      reason: safeReason || null,
      item_body_excerpt: itemBodyExcerpt,
      reporter_user_id: userId,
      reporter_session_id: sessionId,
    })

  if (insertError) {
    console.error('Failed to save report:', insertError.message)
    return { error: '通報の保存に失敗しました' }
  }

  return { success: true }
}
