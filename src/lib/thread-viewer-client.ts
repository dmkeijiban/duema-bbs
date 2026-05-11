'use client'

export interface ThreadViewerState {
  sessionId: string
  isAdmin: boolean
  isFavorited: boolean
}

const viewerStateCache = new Map<number, Promise<ThreadViewerState>>()

export function getThreadViewerState(threadId: number) {
  const cached = viewerStateCache.get(threadId)
  if (cached) return cached

  const request = fetch(`/api/thread/${threadId}/viewer`)
    .then(res => {
      if (!res.ok) throw new Error('Failed to load thread viewer state')
      return res.json()
    })
    .then(data => ({
      sessionId: typeof data?.sessionId === 'string' ? data.sessionId : '',
      isAdmin: typeof data?.isAdmin === 'boolean' ? data.isAdmin : false,
      isFavorited: typeof data?.isFavorited === 'boolean' ? data.isFavorited : false,
    }))
    .catch(() => ({ sessionId: '', isAdmin: false, isFavorited: false }))

  viewerStateCache.set(threadId, request)
  return request
}
