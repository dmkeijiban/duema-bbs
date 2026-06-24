'use server'

import { cookies } from 'next/headers'
import { Resend } from 'resend'
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
  const label = itemType === 'thread' ? 'スレッド' : 'コメント'
  const itemBodyExcerpt = itemBody.slice(0, 200)
  const safeReason = reason.trim().slice(0, 500)

  const { data: report, error: insertError } = await admin
    .from('reports')
    .insert({
      item_type: itemType,
      item_id: itemId,
      reason: safeReason || null,
      item_body_excerpt: itemBodyExcerpt,
      reporter_user_id: userId,
      reporter_session_id: sessionId,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Failed to save report:', insertError.message)
    return { error: '通報の保存に失敗しました' }
  }

  const apiKey = process.env.RESEND_API_KEY
  const toEmail = process.env.CONTACT_EMAIL
  if (apiKey && toEmail) {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: toEmail,
      subject: `【通報】デュエマ掲示板 ${label}ID:${itemId}`,
      text: [
        `通報ID: ${report.id}`,
        `通報対象: ${label} (ID: ${itemId})`,
        userId ? `通報者user_id: ${userId}` : null,
        sessionId ? `通報者session_id: ${sessionId}` : null,
        '',
        '内容（先頭200文字）:',
        itemBodyExcerpt,
        '',
        '通報理由:',
        safeReason || '（理由なし）',
        '',
        '管理画面:',
        '/admin/reports',
      ].filter(Boolean).join('\n'),
    })

    if (error) {
      console.error('Failed to send report mail:', error.message)
    }
  }

  return { success: true }
}
