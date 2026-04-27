/**
 * Discord Webhook 通知ユーティリティ
 * - サーバーサイド専用（Webhook URLをクライアントに露出させない）
 * - 通知失敗はログに残すだけでスレッド作成をブロックしない
 */

const SITE_ORIGIN = 'https://duema-bbs.vercel.app'

interface NotifyNewThreadOptions {
  threadId: number
  title: string
  categoryName: string | null
}

export async function notifyNewThread({
  threadId,
  title,
  categoryName,
}: NotifyNewThreadOptions): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return // 環境変数未設定ならスキップ

  const threadUrl = `${SITE_ORIGIN}/thread/${threadId}`
  const categoryLine = categoryName ? `カテゴリ: ${categoryName}\n` : ''

  const content = `【新規スレ】\n${title}\n${categoryLine}${threadUrl}`

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        // @everyone / @here が文字列に含まれていても Discordが反応しないようにする
        allowed_mentions: { parse: [] },
      }),
    })
    if (!res.ok) {
      console.error('Discord webhook error:', res.status, await res.text())
    }
  } catch (err) {
    console.error('Discord webhook fetch failed:', err)
  }
}
