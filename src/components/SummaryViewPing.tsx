'use client'

import { useEffect, useState } from 'react'
import { capturePostHogEvent } from '@/lib/posthog-events'

interface Props {
  slug: string
  initialViewCount?: number
  commentCount?: number
  className?: string
}

export function SummaryViewPing({ slug, initialViewCount = 0, commentCount, className }: Props) {
  const [viewCount, setViewCount] = useState(initialViewCount)

  useEffect(() => {
    const url = `/api/summary/${encodeURIComponent(slug)}/view`
    capturePostHogEvent('summary_view', { slug })

    fetch(url, { method: 'POST', keepalive: true, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return
        const json = await response.json().catch(() => null)
        if (typeof json?.view_count === 'number') setViewCount(json.view_count)
      })
      .catch(() => {})
  }, [slug])

  if (typeof commentCount === 'number') {
    return (
      <p className={className ?? 'text-xs text-gray-500 mt-2'}>
        コメント {commentCount}件 ／ 閲覧 {viewCount}
      </p>
    )
  }

  return <span className={className}>{viewCount}</span>
}
