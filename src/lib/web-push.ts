import webpush from 'web-push'

export interface PushSubscriptionData {
  endpoint: string
  p256dh: string
  auth: string
}

function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
}

export async function sendPushNotification(
  sub: PushSubscriptionData,
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<{ ok: boolean; gone?: boolean }> {
  initVapid()
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    )
    return { ok: true }
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    // 410 Gone = 登録解除済み → DBから削除すべき
    if (statusCode === 410 || statusCode === 404) {
      return { ok: false, gone: true }
    }
    console.error('Push send error:', err)
    return { ok: false }
  }
}
