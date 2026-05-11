'use client'

import { useEffect } from 'react'

interface Props {
  threadId: number
}

export function ThreadViewPing({ threadId }: Props) {
  useEffect(() => {
    const url = `/api/thread/${threadId}/view`

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([], { type: 'application/json' }))
      return
    }

    fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
  }, [threadId])

  return null
}
