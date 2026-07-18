// メーカー企画のイベント計測でクライアント・サーバー双方から使う定数とヘルパー。
// 特定企画に依存しない共通設計（slugを渡して使い回す）。

export const MAKER_EVENT_TYPES = ['tier_created', 'image_saved', 'x_shared', 'aggregate_viewed', 'page_viewed', 'auth_cta_clicked', 'signup_completed', 'submission_after_signup', 'creation_started', 'card_searched', 'card_added', 'card_removed', 'card_reordered', 'selection_completed', 'image_save_started', 'submission_registered', 'submission_updated', 'submission_deleted', 'submissions_viewed', 'draft_restored', 'new_draft_started', 'listing_enabled', 'listing_disabled'] as const
export type MakerEventType = (typeof MAKER_EVENT_TYPES)[number]

// 連打・二重送信の除外窓（秒）。日をまたいだ再利用は除外しない。
export const MAKER_EVENT_DEDUP_SECONDS: Record<MakerEventType, number> = {
  tier_created: 600,
  image_saved: 30,
  x_shared: 30,
  aggregate_viewed: 60,
  page_viewed: 1800,
  auth_cta_clicked: 60,
  signup_completed: 315360000,
  submission_after_signup: 315360000,
  creation_started: 600,
  card_searched: 10,
  card_added: 0,
  card_removed: 0,
  card_reordered: 5,
  selection_completed: 315360000,
  image_save_started: 5,
  submission_registered: 5,
  submission_updated: 5,
  submission_deleted: 5,
  submissions_viewed: 60,
  draft_restored: 60,
  new_draft_started: 5,
  listing_enabled: 5,
  listing_disabled: 5,
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
