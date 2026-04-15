'use server'

import { createClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

export async function sendContact(formData: FormData) {
  const subject = (formData.get('subject') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()

  if (!subject) return { error: '件名を選択してください' }
  if (!body || body.length < 10) return { error: '本文を10文字以上入力してください' }

  // Supabaseに保存
  const supabase = await createClient()
  await supabase.from('contact_messages').insert({ subject, email: email || null, body })

  // Resendでメール送信
  const apiKey = process.env.RESEND_API_KEY
  const toEmail = process.env.CONTACT_EMAIL

  if (apiKey && toEmail) {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: toEmail,
      subject: `【デュエマ掲示板お問い合わせ】${subject}`,
      text: `件名: ${subject}\n返信先: ${email || '未記入'}\n\n${body}`,
    })
    if (error) {
      console.error('Resend error:', error)
      return { error: `メール送信エラー: ${error.message}` }
    }
    console.log('Resend OK:', data?.id)
  }

  return { success: true }
}
