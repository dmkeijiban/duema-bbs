// メーカー企画のイベント計測でクライアント・サーバー双方から使う定数とヘルパー。
// 特定企画に依存しない共通設計（slugを渡して使い回す）。

export const MAKER_EVENT_TYPES = ['tier_created', 'image_saved', 'x_shared', 'aggregate_viewed'] as const
export type MakerEventType = (typeof MAKER_EVENT_TYPES)[number]

// 連打・二重送信の除外窓（秒）。日をまたいだ再利用は除外しない。
export const MAKER_EVENT_DEDUP_SECONDS: Record<MakerEventType, number> = {
  tier_created: 600,
  image_saved: 30,
  x_shared: 30,
  aggregate_viewed: 60,
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,80}$/

export function isValidMakerEventType(value: unknown): value is MakerEventType {
  return typeof value === 'string' && (MAKER_EVENT_TYPES as readonly string[]).includes(value)
}

export function isValidMakerSlug(value: unknown): value is string {
  return typeof value === 'string' && SLUG_PATTERN.test(value)
}

export function isValidAnonymousId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

const ANONYMOUS_ID_STORAGE_KEY = 'maker-anon-id:v1'
let inMemoryAnonymousId: string | null = null

// 未ログイン利用者の端末識別用ID。localStorageが使えない場合はページ表示中のみ有効なIDを使う。
export function getMakerAnonymousId(): string | null {
  if (typeof window === 'undefined' || typeof crypto === 'undefined' || !crypto.randomUUID) return null

  try {
    const stored = localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY)
    if (stored && isValidAnonymousId(stored)) return stored
    const created = crypto.randomUUID()
    localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, created)
    return created
  } catch {
    if (!inMemoryAnonymousId) inMemoryAnonymousId = crypto.randomUUID()
    return inMemoryAnonymousId
  }
}
