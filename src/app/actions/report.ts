'use server'

import { Resend } from 'resend'

interface ReportParams {
  itemType: 'post' | 'thread'
  itemId: number
  reason: string
  itemBody: string
}

export async function reportItem({ itemType, itemId, reason, itemBody }: ReportParams) {
  const apiKey = process.env.RESEND_API_KEY
  const toEmail = process.env.CONTACT_EMAIL
  if (!apiKey || !toEmail) return { error: '設定エラー' }

  const resend = new Resend(apiKey)
  const label = itemType === 'thread' ? 'スレッド' : 'レス'

  const { error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: toEmail,
    subject: `【通報】デュエマ掲示板 ${label}ID:${itemId}`,
    text: [
      `通報対象: ${label} (ID: ${itemId})`,
      '',
      '内容（先頭200文字）:',
      itemBody.slice(0, 200),
      '',
      '通報理由:',
      reason || '（理由なし）',
    ].join('\n'),
  })

  if (error) return { error: error.message }
  return { success: true }
}
