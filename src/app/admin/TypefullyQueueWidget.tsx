/**
 * TypefullyQueueWidget — サーバーコンポーネント
 * Typefully REST API で予約済み下書き一覧を取得して管理画面に表示する。
 *
 * REST API: GET https://api.typefully.com/v1/drafts/?filter=scheduled
 * ヘッダー: X-API-KEY: Bearer <TYPEFULLY_API_KEY>
 */

interface TypefullyDraft {
  id: number
  preview?: string
  scheduled_date?: string | null
  draft_title?: string
  private_url?: string
  status?: string
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
    const res = await fetch('https://api.typefully.com/v1/drafts/?filter=scheduled&limit=50', {
      method: 'GET',
      headers: {
        'X-API-KEY': `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `HTTP ${res.status}`, rawSample: text.slice(0, 200) }
    }

    let data: { drafts?: TypefullyDraft[]; data?: TypefullyDraft[] }
    try {
      data = await res.json()
    } catch {
      const text = await res.text()
      return { ok: false, error: 'JSON パース失敗', rawSample: text.slice(0, 200) }
    }

    // Typefully REST API は { drafts: [...] } または配列を返す場合がある
    const drafts: TypefullyDraft[] = data.drafts ?? data.data ?? (Array.isArray(data) ? (data as TypefullyDraft[]) : [])
    return { ok: true, drafts }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/** ISO UTC → JST 表示 "M/D HH:MM" */
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
            .env.local の TYPEFULLY_API_KEY / TYPEFULLY_SOCIAL_SET_ID を確認してください。
          </p>
        </div>
      ) : !result.drafts || result.drafts.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">予約済みの投稿はありません（Typefully キューが空です）</p>
      ) : (
        <div className="space-y-1">
          {result.drafts.slice(0, 14).map((draft) => {
            const text = draft.preview ?? '（本文なし）'
            const preview = text.replace(/\n/g, ' ').slice(0, 70) + (text.length > 70 ? '…' : '')
            const href = draft.private_url ?? 'https://app.typefully.com/'
            return (
              <a
                key={draft.id}
                href={href}
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
