'use server'

import { Resend } from 'resend'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

const BASE_URL = 'https://duema-bbs.vercel.app'

/** スレッドへのメール通知を登録する（既登録はスキップ） */
export async function subscribeToThread(threadId: number, email: string): Promise<{ error?: string }> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return { error: 'メールアドレスが不正です' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('email_subscriptions')
    .insert({ thread_id: threadId, email: trimmed })

  // 重複エラーは無視（既に登録済みの場合）
  if (error && error.code !== '23505') {
    console.error('subscribeToThread error:', error)
    return { error: '登録に失敗しました' }
  }
  return {}
}

/**
 * スレッドの全購読者に返信通知メールを送る。
 * posterEmail を指定するとその人には送らない（自分の投稿で通知が来ないように）。
 */
export async function sendNewPostNotifications(
  threadId: number,
  threadTitle: string,
  postNumber: number,
  posterEmail?: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return // RESEND_API_KEY 未設定なら何もしない

  // サービスロールキーで購読者一覧を取得（RLS をバイパス）
  let admin
  try {
    admin = createAdminClient()
  } catch {
    console.error('Admin client unavailable, skipping notifications')
    return
  }

  const { data: subs, error } = await admin
    .from('email_subscriptions')
    .select('email, unsubscribe_token')
    .eq('thread_id', threadId)

  if (error || !subs || subs.length === 0) return

  const resend = new Resend(apiKey)
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@duema-bbs.vercel.app'
  const threadUrl = `${BASE_URL}/thread/${threadId}`

  const targets = posterEmail
    ? subs.filter(s => s.email !== posterEmail.trim().toLowerCase())
    : subs

  // 並列送信（失敗は握りつぶしてスレ投稿をブロックしない）
  await Promise.allSettled(
    targets.map(({ email, unsubscribe_token }) => {
      const unsubUrl = `${BASE_URL}/unsubscribe/${unsubscribe_token}`
      return resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `【デュエマ掲示板】「${threadTitle}」に返信がつきました`,
        text: [
          `「${threadTitle}」に返信（レス${postNumber}）がつきました。`,
          '',
          `▶ スレッドを見る: ${threadUrl}`,
          '',
          '─────────────────────',
          `このメールの配信を停止する: ${unsubUrl}`,
        ].join('\n'),
      })
    }),
  )
}

/** 配信停止トークンで購読を削除する */
export async function unsubscribeByToken(token: string): Promise<{ error?: string }> {
  if (!token) return { error: 'トークンが無効です' }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'サーバーエラーが発生しました' }
  }

  const { error } = await admin
    .from('email_subscriptions')
    .delete()
    .eq('unsubscribe_token', token)

  if (error) {
    console.error('unsubscribeByToken error:', error)
    return { error: '配信停止に失敗しました' }
  }
  return {}
}
