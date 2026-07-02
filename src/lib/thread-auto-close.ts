export const AUTO_CLOSE_POST_COUNT = 100
export const THREAD_COMMENT_CLOSE_DAYS = 30

export const AUTO_CLOSE_MESSAGE =
  'このスレッドはコメント数が100件に達したため、書き込みを終了しました。'
export const THREAD_COMMENT_CLOSED_MESSAGE =
  'このスレッドはコメント受付を終了しました'

type AutoCloseThread = {
  title?: string | null
  body?: string | null
  post_count?: number | null
  comment_locked?: boolean | null
  created_at?: string | null
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

function isOlderThanCommentWindow(createdAt: string | null | undefined, now = new Date()) {
  if (!createdAt) return false
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return false
  const closeAt = date.getTime() + THREAD_COMMENT_CLOSE_DAYS * 24 * 60 * 60 * 1000
  return now.getTime() >= closeAt
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
  if (isMemoryZukanMidnightThread(thread)) return false
  return (thread.post_count ?? 0) >= AUTO_CLOSE_POST_COUNT
}

export function isThreadCommentClosed(thread: AutoCloseThread, now = new Date()) {
  if (thread.comment_locked === true) return true
  if (isMemoryZukanMidnightThread(thread)) return false
  if (isOlderThanCommentWindow(thread.created_at, now)) return true
  return isThreadAutoClosed(thread)
}

export function canCommentToThread(thread: AutoCloseThread, now = new Date()) {
  return !isThreadCommentClosed(thread, now)
}

export function getThreadCommentClosedMessage(thread: AutoCloseThread, now = new Date()) {
  if (!isThreadCommentClosed(thread, now)) return null
  if (thread.comment_locked === true) return THREAD_COMMENT_CLOSED_MESSAGE
  if (isThreadAutoClosed(thread)) return AUTO_CLOSE_MESSAGE
  return THREAD_COMMENT_CLOSED_MESSAGE
}
