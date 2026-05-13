'use client'

import { useEffect } from 'react'
import { capturePostHogEvent } from '@/lib/posthog-events'

interface Props {
  threadId: number
}

export function ThreadViewPing({ threadId }: Props) {
  useEffect(() => {
    const url = `/api/thread/${threadId}/view`

    capturePostHogEvent('thread_view', { thread_id: threadId })

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([], { type: 'application/json' }))
      return
    }

    fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
  }, [threadId])

  return null
}
