// Typefully REST API ラッパー
// POST https://api.typefully.com/v2/social-sets/{social_set_id}/drafts

const TYPEFULLY_API_BASE = 'https://api.typefully.com/v2'

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

interface TypefullyDraftResponse {
  id?: string | number
  private_url?: string | null
  share_url?: string | null
  url?: string | null
}

interface TypefullyErrorResponse {
  error?: unknown
  message?: string
  detail?: string
}

/** スレッド配列を Typefully API の content 文字列に変換 */
export function threadsToContent(lines: string[]): string {
  return lines.join('\n\n---\n\n')
}

function normalizeApiKey(apiKey: string): string {
  return apiKey.replace(/^Bearer\s+/i, '').trim()
}

function formatTypefullyError(status: number, text: string): string {
  if (!text) return `Typefully API error ${status}`

  try {
    const data = JSON.parse(text) as TypefullyErrorResponse
    if (typeof data.message === 'string') {
      return `Typefully API error ${status}: ${data.message}`
    }
    if (typeof data.detail === 'string') {
      return `Typefully API error ${status}: ${data.detail}`
    }
    if (data.error && typeof data.error === 'object') {
      const err = data.error as { message?: unknown; code?: unknown }
      const message = typeof err.message === 'string' ? err.message : JSON.stringify(data.error)
      const code = typeof err.code === 'string' ? ` (${err.code})` : ''
      return `Typefully API error ${status}${code}: ${message}`
    }
  } catch {
    // JSONではないレスポンスは下で短く返す。
  }

  return `Typefully API error ${status}: ${text.slice(0, 500)}`
}

/**
 * Typefully に下書き（またはスケジュール投稿）を作成する。
 * @returns 成功時 { id, share_url }、失敗時 { error: string }
 */
export async function createTypefullyDraft(
  params: TypefullyDraftParams,
): Promise<TypefullyDraftResult | { error: string }> {
  const apiKey = normalizeApiKey(process.env.TYPEFULLY_API_KEY ?? '')
  if (!apiKey) {
    return { error: 'TYPEFULLY_API_KEY が設定されていません' }
  }

  const socialSetId = process.env.TYPEFULLY_SOCIAL_SET_ID?.trim()
  if (!socialSetId) {
    return { error: 'TYPEFULLY_SOCIAL_SET_ID が設定されていません' }
  }

  const body: Record<string, unknown> = {
    platforms: {
      x: {
        enabled: true,
        posts: params.threadLines.map((text) => ({ text })),
      },
    },
  }
  if (params.scheduleDate) {
    body.publish_at = params.scheduleDate
  }

  try {
    const res = await fetch(`${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/drafts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      return { error: formatTypefullyError(res.status, text) }
    }

    const data = (await res.json()) as TypefullyDraftResponse
    return {
      id: String(data.id ?? ''),
      share_url: String(data.private_url ?? data.share_url ?? data.url ?? ''),
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
  const apiKey = normalizeApiKey(process.env.TYPEFULLY_API_KEY ?? '')
  if (!apiKey) {
    return { error: 'TYPEFULLY_API_KEY が設定されていません' }
  }

  const socialSetId = process.env.TYPEFULLY_SOCIAL_SET_ID?.trim()
  if (!socialSetId) {
    return { error: 'TYPEFULLY_SOCIAL_SET_ID が設定されていません' }
  }

  try {
    const res = await fetch(`${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/drafts/${draftId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      const text = await res.text()
      return { error: formatTypefullyError(res.status, text) }
    }

    const data = (await res.json()) as TypefullyDraftResponse & { status?: string }
    return {
      id: String(data.id ?? ''),
      share_url: String(data.private_url ?? data.share_url ?? data.url ?? ''),
      status: String(data.status ?? ''),
    }
  } catch (e) {
    return { error: `Typefully API リクエスト失敗: ${String(e)}` }
  }
}
