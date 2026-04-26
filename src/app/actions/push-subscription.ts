'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { sendPushNotification } from '@/lib/web-push'

export interface PushSubJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** ブラウザから取得した PushSubscription を DB に保存 */
export async function saveSubscription(
  threadId: number,
  sub: PushSubJSON,
): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      thread_id: threadId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: 'thread_id,endpoint' },
  )
  if (error) {
    console.error('saveSubscription error:', error)
    return { error: '購読の登録に失敗しました' }
  }
  return {}
}

/** 購読解除（endpoint で一意識別） */
export async function deleteSubscription(
  endpoint: string,
): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
  if (error) {
    console.error('deleteSubscription error:', error)
    return { error: '購読解除に失敗しました' }
  }
  return {}
}

/**
 * スレッドへの新規投稿を購読者全員に通知する
 * excludeEndpoint: 投稿者自身のエンドポイント（自分には送らない）
 */
export async function sendPushNotifications(
  threadId: number,
  threadTitle: string,
  postNumber: number,
  excludeEndpoint?: string,
): Promise<void> {
  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('thread_id', threadId)

  if (!subs || subs.length === 0) return

  const payload = {
    title: `【${threadTitle}】`,
    body: `レス ${postNumber} が投稿されました`,
    url: `/thread/${threadId}`,
    tag: `thread-${threadId}`,
  }

  const goneEndpoints: string[] = []

  await Promise.allSettled(
    subs
      .filter((s) => s.endpoint !== excludeEndpoint)
      .map(async (s) => {
        const result = await sendPushNotification(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          payload,
        )
        if (result.gone) goneEndpoints.push(s.endpoint)
      }),
  )

  // 410 Gone になったエンドポイントをまとめて削除
  if (goneEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', goneEndpoints)
  }
}
