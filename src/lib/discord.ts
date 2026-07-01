/**
 * Discord Webhook 通知ユーティリティ
 * - サーバーサイド専用（Webhook URLをクライアントに露出させない）
 * - 通知失敗はログに残すだけでスレッド作成をブロックしない
 */

import { SITE_URL } from '@/lib/site-config'
const SITE_ORIGIN = SITE_URL

export async function notifyDiscordMessage(content: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    })
    if (!res.ok) {
      console.error('Discord webhook error (generic):', res.status, await res.text())
    }
  } catch (err) {
    console.error('Discord webhook fetch failed (generic):', err)
  }
}

/** Xスレ化（sync-typefully）の同期結果サマリーを通知 */
interface NotifySyncSummaryOptions {
  created: number
  duplicate: number
  errors: number
  totalDrafts: number
  /** MAX_NEW_PER_RUN の上限に達してスキップされた件数 */
  skippedByLimit?: number
  /** X_THREAD_SYNC_START_AT より前の投稿でスキップされた件数 */
  skippedOld?: number
  /** dry-run モードで実行した場合 true */
  dryRun?: boolean
  /** 実行時刻（JST） */
  executedAt?: string
}

export async function notifySyncSummary({
  created,
  duplicate,
  errors,
  totalDrafts,
  skippedByLimit = 0,
  skippedOld = 0,
  dryRun = false,
  executedAt,
}: NotifySyncSummaryOptions): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  // 作成成功時は notifyNewThread が個別通知を送るため、二重通知を避ける。
  // エラーのみの実行や dry-run は、状況確認用にサマリーを送る。
  if (!dryRun) {
    if (created > 0) return
    if (errors === 0) return
  }

  const content = dryRun
    ? `🧪 [DRY RUN] ${created}件作成予定\n- 重複: ${duplicate}件\n- エラー: ${errors}件\n- 取得: ${totalDrafts}件\n- 上限超過: ${skippedByLimit}件\n- 旧投稿スキップ: ${skippedOld}件\n- 実行時刻: ${executedAt ?? '-'}`
    : `⚠️ Xスレ化でエラーが発生しました\n- エラー: ${errors}件\n- 重複: ${duplicate}件\n- 取得: ${totalDrafts}件\n- 実行時刻: ${executedAt ?? '-'}`

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

/** Typefully から取得した公開済み投稿が0件だった場合の詳細通知 */
export async function notifyDraftsEmpty({
  endpoint,
  limit,
  executedAt,
}: {
  endpoint: string
  limit: number
  executedAt: string
}): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  // APIキー等の機密情報をURLから除去
  const safeEndpoint = endpoint.replace(/key=[^&]+/gi, 'key=***').slice(0, 120)

  const content =
    `🚨 Typefully 公開済み投稿が0件\n` +
    `- 実行時刻: ${executedAt}\n` +
    `- エンドポイント: ${safeEndpoint}\n` +
    `- limit: ${limit}\n` +
    `- 認証方式: Authorization: Bearer\n` +
    `⚠️ Typefullyに公開済み投稿がないか、認証エラーの可能性があります。` +
    `\nhttps://app.typefully.com/schedule で確認してください。`

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    })
    if (!res.ok) {
      console.error('Discord webhook error (drafts empty):', res.status, await res.text())
    }
  } catch (err) {
    console.error('Discord webhook fetch failed (drafts empty):', err)
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
