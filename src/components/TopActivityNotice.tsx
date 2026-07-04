'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type NotificationSummary = {
  hasNotifications: boolean
}

export function TopActivityNotice() {
  const [hasNotifications, setHasNotifications] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch('/api/mypage/notifications', { cache: 'no-store' })
      .then(res => res.ok ? res.json() as Promise<NotificationSummary> : null)
      .then(data => {
        if (!cancelled) setHasNotifications(Boolean(data?.hasNotifications))
      })
      .catch(() => {
        if (!cancelled) setHasNotifications(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Link
      href="/mypage"
      className={`inline-flex min-h-8 min-w-0 items-center justify-center rounded border px-1.5 py-1 text-center text-[11px] font-bold leading-tight whitespace-nowrap transition-colors md:min-h-0 md:px-2.5 md:text-xs ${
        hasNotifications
          ? 'border-green-700 bg-white text-green-800 hover:bg-green-50'
          : 'border-green-600/50 bg-white/80 text-green-800 hover:bg-green-50'
      }`}
    >
      {hasNotifications ? '🔔 新しいお知らせがあります' : '🔔 新しいお知らせ'}
    </Link>
  )
}
