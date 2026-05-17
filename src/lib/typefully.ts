// Typefully REST API ラッパー
// POST https://api.typefully.com/v1/drafts/

const TYPEFULLY_API_BASE = 'https://api.typefully.com/v1'

export interface TypefullyDraftParams {
  /** スレッドの各ツイート文字列（配列） */
  threadLines: string[]
  /** ISO8601形式のスケジュール日時（省略時は下書きとして保存） */
  scheduleDate?: string
  /** 自動リツイート（Typefully の auto_retweet_enabled 機能） */
  autoRetweetEnabled?: boolean
  /** 自動プラグイン */
  autoPlugEnabled?: boolean
}

export interface TypefullyDraftResult {
  id: string
  share_url: string
}

/** スレッド配列を Typefully API の content 文字列に変換 */
export function threadsToContent(lines: string[]): string {
  return lines.join('\n\n---\n\n')
}

/**
 * Typefully に下書き（またはスケジュール投稿）を作成する
 * @returns 成功時 { id, share_url }、失敗時 { error: string }
 */
export async function createTypefullyDraft(
  params: TypefullyDraftParams,
): Promise<TypefullyDraftResult | { error: string }> {
  const apiKey = process.env.TYPEFULLY_API_KEY
  if (!apiKey) {
    return { error: 'TYPEFULLY_API_KEY が設定されていません' }
  }

  const content = threadsToContent(params.threadLines)

  const body: Record<string, unknown> = {
    content,
    threadify: false,
  }
  if (params.scheduleDate) {
    body['schedule-date'] = params.scheduleDate
  }
  if (params.autoRetweetEnabled !== undefined) {
    body.auto_retweet_enabled = params.autoRetweetEnabled
  }
  if (params.autoPlugEnabled !== undefined) {
    body.auto_plug_enabled = params.autoPlugEnabled
  }

  try {
    const res = await fetch(`${TYPEFULLY_API_BASE}/drafts/`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      return { error: `Typefully API エラー ${res.status}: ${text}` }
    }

    const data = await res.json()
    return {
      id: String(data.id ?? ''),
      share_url: String(data.share_url ?? ''),
    }
  } catch (e) {
    return { error: `Typefully API リクエスト失敗: ${String(e)}` }
  }
}

/**
 * Typefully の下書きを取得する
 */
export async function getTypefullyDraft(
  draftId: string,
): Promise<{ id: string; share_url: string; status: string } | { error: string }> {
  const apiKey = process.env.TYPEFULLY_API_KEY
  if (!apiKey) {
    return { error: 'TYPEFULLY_API_KEY が設定されていません' }
  }

  try {
    const res = await fetch(`${TYPEFULLY_API_BASE}/drafts/${draftId}/`, {
      headers: { 'X-API-KEY': apiKey },
    })

    if (!res.ok) {
      const text = await res.text()
      return { error: `Typefully API エラー ${res.status}: ${text}` }
    }

    const data = await res.json()
    return {
      id: String(data.id ?? ''),
      share_url: String(data.share_url ?? ''),
      status: String(data.status ?? ''),
    }
  } catch (e) {
    return { error: `Typefully API リクエスト失敗: ${String(e)}` }
  }
}
