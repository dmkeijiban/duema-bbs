/**
 * TypefullyQueueWidget — サーバーコンポーネント
 * Typefully REST API から予約済み下書き一覧を取得して管理画面に表示する。
 *
 * Typefully REST API: GET https://api.typefully.com/v1/drafts?filter=scheduled
 * ヘッダー: X-API-KEY: Bearer <token>
 */

interface TypefullyDraft {
  id: string
  num_tweets?: number
  scheduled_date?: string | null
  last_tweet_text?: string
  created_at?: string
  // MCP 経由で作成したときの X プラットフォーム情報
  platforms?: {
    x?: {
      posts?: Array<{ text?: string }>
    }
  }
}

async function fetchScheduledDrafts(): Promise<{
  ok: boolean
  drafts?: TypefullyDraft[]
  error?: string
  rawSample?: string
}> {
  const apiKey = process.env.TYPEFULLY_API_KEY
  if (!apiKey) return { ok: false, error: 'TYPEFULLY_API_KEY が未設定です' }

  try {
    const res = await fetch('https://api.typefully.com/v1/drafts?filter=scheduled', {
      headers: {
        'X-API-KEY': `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    })

    const text = await res.text()

    if (!res.ok) {
      return {
        ok: false,
        error: `Typefully API ${res.status} ${res.statusText}`,
        rawSample: text.slice(0, 200),
      }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { ok: false, error: 'レスポンスのJSONパース失敗', rawSample: text.slice(0, 200) }
    }

    // Typefully は配列を直接返す場合と { drafts: [...] } の場合がある
    const drafts: TypefullyDraft[] = Array.isArray(parsed)
      ? (parsed as TypefullyDraft[])
      : ((parsed as Record<string, unknown>)?.drafts as TypefullyDraft[] | undefined) ?? []

    return { ok: true, drafts }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/** ISO → JST 表示 "M/D HH:MM" */
function formatJst(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** 投稿本文の先頭を取得（last_tweet_text もしくは platforms.x.posts[0].text）*/
function getDraftText(draft: TypefullyDraft): string {
  if (draft.last_tweet_text) return draft.last_tweet_text
  const firstPost = draft.platforms?.x?.posts?.[0]
  if (firstPost?.text) return firstPost.text
  return '（本文なし）'
}

export async function TypefullyQueueWidget() {
  const result = await fetchScheduledDrafts()

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
        <h2 className="font-bold text-gray-700">
          🐦 Typefully 予約キュー
          {result.ok && result.drafts && (
            <span className="text-[10px] text-gray-400 ml-1 font-normal">
              （{result.drafts.length} 件）
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <a
            href="https://app.typefully.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Typefully で管理 →
          </a>
        </div>
      </div>

      {!result.ok ? (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
          <p className="font-medium">Typefully 取得エラー: {result.error}</p>
          {result.rawSample && (
            <pre className="mt-1 text-[10px] text-red-500 whitespace-pre-wrap break-all">
              {result.rawSample}
            </pre>
          )}
          <p className="mt-1 text-[10px] text-red-500">
            .env.local の TYPEFULLY_API_KEY を確認してください。
          </p>
        </div>
      ) : !result.drafts || result.drafts.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">予約済みの投稿はありません（Typefully キューが空です）</p>
      ) : (
        <div className="space-y-1">
          {result.drafts.slice(0, 14).map((draft) => {
            const text = getDraftText(draft)
            const preview = text.replace(/\n/g, ' ').slice(0, 70) + (text.length > 70 ? '…' : '')
            return (
              <a
                key={draft.id}
                href={`https://app.typefully.com/drafts/${draft.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-gray-200 p-2 flex items-start gap-2 hover:bg-blue-50 transition-colors"
              >
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 border border-blue-300 text-blue-700 bg-blue-50 font-mono whitespace-nowrap">
                  {draft.scheduled_date ? formatJst(draft.scheduled_date) : '日時未設定'}
                </span>
                <p className="text-xs text-gray-700 flex-1 leading-snug">
                  {preview}
                </p>
                {draft.num_tweets && draft.num_tweets > 1 && (
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {draft.num_tweets}連投
                  </span>
                )}
              </a>
            )
          })}
          {result.drafts.length > 14 && (
            <p className="text-[10px] text-gray-400 text-right">
              他 {result.drafts.length - 14} 件（Typefully で確認）
            </p>
          )}
        </div>
      )}
    </div>
  )
}
