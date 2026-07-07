'use client'

import { capturePostHogEvent } from '@/lib/posthog-events'

export interface ThreadViewerState {
  sessionId: string
  currentUserId: string
  isAdmin: boolean
  isFavorited: boolean
  adminRateLimitToken: string | null
}

function getJstDateKey() {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return jstNow.toISOString().slice(0, 10)
}

function shouldCountThreadView(threadId: number) {
  const storageKey = `viewed_thread_${threadId}_date`
  const todayKey = getJstDateKey()

  try {
    const lastViewedDate = window.localStorage.getItem(storageKey)
    if (lastViewedDate === todayKey) return false
    window.localStorage.setItem(storageKey, todayKey)
    return true
  } catch {
    return true
  }
}

export function getThreadViewerState(threadId: number) {
  const countView = shouldCountThreadView(threadId)
  if (countView) capturePostHogEvent('thread_view', { thread_id: threadId })

  return fetch(`/api/thread/${threadId}/viewer${countView ? '?view=1' : ''}`, { cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error('Failed to load thread viewer state')
      return res.json()
    })
    .then(data => ({
      sessionId: typeof data?.sessionId === 'string' ? data.sessionId : '',
      currentUserId: typeof data?.currentUserId === 'string' ? data.currentUserId : '',
      isAdmin: typeof data?.isAdmin === 'boolean' ? data.isAdmin : false,
      isFavorited: typeof data?.isFavorited === 'boolean' ? data.isFavorited : false,
      adminRateLimitToken: typeof data?.adminRateLimitToken === 'string' ? data.adminRateLimitToken : null,
    }))
    .catch(() => ({
      sessionId: '',
      currentUserId: '',
      isAdmin: false,
      isFavorited: false,
      adminRateLimitToken: null,
    }))
}
