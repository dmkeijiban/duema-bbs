'use client'

import { useEffect } from 'react'
import { capturePostHogEvent } from '@/lib/posthog-events'

interface Props {
  slug: string
  initialViewCount?: number
  commentCount?: number
  className?: string
}

export function SummaryViewPing({ slug, initialViewCount = 0, commentCount, className }: Props) {
  useEffect(() => {
    capturePostHogEvent('summary_view', { slug })
  }, [slug])

  if (typeof commentCount === 'number') {
    return (
      <p className={className ?? 'text-xs text-gray-500 mt-2'}>
        コメント {commentCount}件 ／ 閲覧 {initialViewCount}
      </p>
    )
  }

  return <span className={className}>{initialViewCount}</span>
}
