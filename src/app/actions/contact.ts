'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { Resend } from 'resend'

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

async function hasContactedToday(userId: string | null, sessionId: string | null): Promise<boolean> {
  const admin = createAdminClient()
  const { start, end } = getTodayJstRange()

  if (userId) {
    const { data } = await admin
      .from('contact_messages')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lt('created_at', end)
      .limit(1)
      .maybeSingle()
    if (data?.id) return true
  }

  if (sessionId) {
    const { data } = await admin
      .from('contact_messages')
      .select('id')
      .eq('session_id', sessionId)
      .gte('created_at', start)
      .lt('created_at', end)
      .limit(1)
      .maybeSingle()
    if (data?.id) return true
  }

  return false
}

export async function sendContact(formData: FormData) {
  const subject = (formData.get('subject') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()

  if (!subject) return { error: '件名を選択してください' }
  if (!body || body.length < 10) return { error: '本文を10文字以上入力してください' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id ?? null
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('bbs_session')?.value ?? null

  if (await hasContactedToday(userId, sessionId)) {
    return { error: 'お問い合わせは1日1回までです' }
  }

  // Supabaseに保存
  await supabase.from('contact_messages').insert({
    subject,
    email: email || null,
    body,
    user_id: userId,
    session_id: sessionId,
  })

  // Resendでメール送信
  const apiKey = process.env.RESEND_API_KEY
  const toEmail = process.env.CONTACT_EMAIL

  if (apiKey && toEmail) {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: toEmail,
      subject: `【デュエマ掲示板お問い合わせ】${subject}`,
      text: `件名: ${subject}\n返信先: ${email || '未記入'}\n\n${body}`,
    })
    if (error) {
      console.error('Resend error:', error)
      return { error: `メール送信エラー: ${error.message}` }
    }
  }

  return { success: true }
}
