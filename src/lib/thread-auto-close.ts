export const AUTO_CLOSE_POST_COUNT = 100
export const THREAD_COMMENT_CLOSE_DAYS = 30
export const THREAD_ARCHIVE_DAYS = THREAD_COMMENT_CLOSE_DAYS

export const AUTO_CLOSE_MESSAGE =
  'このスレッドはコメント数が100件に達したため、書き込みを終了しました。'
export const THREAD_COMMENT_CLOSED_MESSAGE =
  'このスレッドはコメント受付を終了しました'
export const THREAD_AGE_CLOSED_MESSAGE =
  `このスレッドは作成から${THREAD_COMMENT_CLOSE_DAYS}日以上経過したため、コメントの投稿を停止しています。過去ログとして閲覧できます。`

type AutoCloseThread = {
  title?: string | null
  body?: string | null
  post_count?: number | null
  comment_locked?: boolean | null
  auto_lock_exempt?: boolean | null
  created_at?: string | null
  last_posted_at?: string | null
  categories?: {
    name?: string | null
    slug?: string | null
  } | Array<{
    name?: string | null
    slug?: string | null
  }> | null
}

function isCreatedAtMidnightJst(createdAt: string | null | undefined) {
  if (!createdAt) return false
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return false
  return date.getUTCHours() === 15
}

export function getThreadArchiveCutoff(now = new Date()) {
  return new Date(now.getTime() - THREAD_ARCHIVE_DAYS * 24 * 60 * 60 * 1000)
}

export function isOlderThanCommentWindow(createdAt: string | null | undefined, now = new Date()) {
  return isOlderThanCommentWindowFrom(createdAt, now)
}

export function isOlderThanCommentWindowFrom(value: string | null | undefined, now = new Date()) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const closeAt = date.getTime() + THREAD_COMMENT_CLOSE_DAYS * 24 * 60 * 60 * 1000
  return now.getTime() >= closeAt
}

export function getThreadLastResponseAt(thread: AutoCloseThread) {
  return thread.last_posted_at ?? thread.created_at ?? null
}

export function isMemoryZukanMidnightThread(thread: AutoCloseThread) {
  const category = Array.isArray(thread.categories) ? thread.categories[0] : thread.categories
  const text = [
    thread.title,
    thread.body,
    category?.name,
    category?.slug,
  ]
    .filter(Boolean)
    .join('\n')

  const hasMemoryZukanMarker =
    /思い出図鑑|思い出の図鑑|memory[-_ ]?zukan|memories[-_ ]?zukan|zukan/i.test(text)

  return hasMemoryZukanMarker && isCreatedAtMidnightJst(thread.created_at)
}

export function isThreadAutoClosed(thread: AutoCloseThread) {
  if (thread.auto_lock_exempt === true) return false
  if (isMemoryZukanMidnightThread(thread)) return false
  return (thread.post_count ?? 0) >= AUTO_CLOSE_POST_COUNT
}

export function isThreadAgeClosed(thread: AutoCloseThread, now = new Date()) {
  if (thread.auto_lock_exempt === true) return false
  if (isMemoryZukanMidnightThread(thread)) return false
  return isOlderThanCommentWindowFrom(getThreadLastResponseAt(thread), now)
}

export function isThreadAutoArchived(thread: AutoCloseThread, now = new Date()) {
  return isThreadAgeClosed(thread, now)
}

export function isThreadCommentClosed(thread: AutoCloseThread, now = new Date()) {
  if (thread.comment_locked === true) return true
  if (isThreadAgeClosed(thread, now)) return true
  return isThreadAutoClosed(thread)
}

export function canCommentToThread(thread: AutoCloseThread, now = new Date()) {
  return !isThreadCommentClosed(thread, now)
}

export function getThreadCommentClosedMessage(thread: AutoCloseThread, now = new Date()) {
  if (!isThreadCommentClosed(thread, now)) return null
  if (thread.comment_locked === true) return THREAD_COMMENT_CLOSED_MESSAGE
  if (isThreadAgeClosed(thread, now)) return THREAD_AGE_CLOSED_MESSAGE
  if (isThreadAutoClosed(thread)) return AUTO_CLOSE_MESSAGE
  return THREAD_COMMENT_CLOSED_MESSAGE
}
