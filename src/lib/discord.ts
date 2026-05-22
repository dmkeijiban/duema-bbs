/**
 * Discord Webhook 通知ユーティリティ
 * - サーバーサイド専用（Webhook URLをクライアントに露出させない）
 * - 通知失敗はログに残すだけでスレッド作成をブロックしない
 */

import { SITE_URL } from '@/lib/site-config'
const SITE_ORIGIN = SITE_URL

/** Xスレ化（sync-typefully）の同期結果サマリーを通知 */
interface NotifySyncSummaryOptions {
  created: number
  duplicate: number
  errors: number
  totalDrafts: number
}

export async function notifySyncSummary({
  created,
  duplicate,
  errors,
  totalDrafts,
}: NotifySyncSummaryOptions): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  // 正常（created > 0）でも毎回送る — 無音は失敗と区別できないため
  const isSilentFail = created === 0 && duplicate === 0 && totalDrafts > 0
  const emoji = isSilentFail ? '🚨' : created > 0 ? '✅' : '🔵'
  const alert = isSilentFail
    ? '\n⚠️ 公開済み投稿があるのにスレが1件も作られませんでした。要確認。'
    : ''

  const content =
    `${emoji} [Xスレ化] 同期完了\n` +
    `- 公開済み取得: ${totalDrafts}件\n` +
    `- 新規スレ作成: ${created}件 / 重複スキップ: ${duplicate}件 / エラー: ${errors}件` +
    alert

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    })
    if (!res.ok) {
      console.error('Discord webhook error (sync summary):', res.status, await res.text())
    }
  } catch (err) {
    console.error('Discord webhook fetch failed (sync summary):', err)
  }
}

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
