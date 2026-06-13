'use client'

import { capturePostHogEvent } from '@/lib/posthog-events'

export interface ThreadViewerState {
  sessionId: string
  currentUserId: string
  isAdmin: boolean
  isFavorited: boolean
}

const VIEW_THROTTLE_MS = 24 * 60 * 60 * 1000
const viewerStateCache = new Map<number, Promise<ThreadViewerState>>()

function shouldCountThreadView(threadId: number) {
  const storageKey = `viewed_thread_${threadId}`

  try {
    const lastViewedAt = Number(window.localStorage.getItem(storageKey) ?? 0)
    if (lastViewedAt && Date.now() - lastViewedAt < VIEW_THROTTLE_MS) return false
    window.localStorage.setItem(storageKey, String(Date.now()))
    return true
  } catch {
    return true
  }
}

export function getThreadViewerState(threadId: number) {
  const cached = viewerStateCache.get(threadId)
  if (cached) return cached

  const countView = shouldCountThreadView(threadId)
  if (countView) capturePostHogEvent('thread_view', { thread_id: threadId })

  const request = fetch(`/api/thread/${threadId}/viewer${countView ? '?view=1' : ''}`)
    .then(res => {
      if (!res.ok) throw new Error('Failed to load thread viewer state')
      return res.json()
    })
    .then(data => ({
      sessionId: typeof data?.sessionId === 'string' ? data.sessionId : '',
      currentUserId: typeof data?.currentUserId === 'string' ? data.currentUserId : '',
      isAdmin: typeof data?.isAdmin === 'boolean' ? data.isAdmin : false,
      isFavorited: typeof data?.isFavorited === 'boolean' ? data.isFavorited : false,
    }))
    .catch(() => ({ sessionId: '', currentUserId: '', isAdmin: false, isFavorited: false }))

  viewerStateCache.set(threadId, request)
  return request
}
