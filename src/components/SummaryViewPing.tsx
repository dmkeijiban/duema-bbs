'use client'

import { useEffect } from 'react'
import { capturePostHogEvent } from '@/lib/posthog-events'

interface Props {
  slug: string
}

export function SummaryViewPing({ slug }: Props) {
  useEffect(() => {
    const url = `/api/summary/${encodeURIComponent(slug)}/view`
    capturePostHogEvent('summary_view', { slug })

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([], { type: 'application/json' }))
      return
    }

    fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
  }, [slug])

  return null
}
