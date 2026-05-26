'use client'

import { useEffect } from 'react'
import { capturePostHogEvent } from '@/lib/posthog-events'

interface Props {
  threadId: number
}

const VIEW_THROTTLE_MS = 6 * 60 * 60 * 1000

export function ThreadViewPing({ threadId }: Props) {
  useEffect(() => {
    const url = `/api/thread/${threadId}/view`
    const storageKey = `viewed_thread_${threadId}`

    try {
      const lastViewedAt = Number(window.localStorage.getItem(storageKey) ?? 0)
      if (lastViewedAt && Date.now() - lastViewedAt < VIEW_THROTTLE_MS) return
      window.localStorage.setItem(storageKey, String(Date.now()))
    } catch {
      // If localStorage is blocked, keep the previous best-effort view ping behavior.
    }

    capturePostHogEvent('thread_view', { thread_id: threadId })

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([], { type: 'application/json' }))
      return
    }

    fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
  }, [threadId])

  return null
}
