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

  if (!hasNotifications) return null

  return (
    <Link
      href="/mypage"
      className="inline-flex items-center justify-center rounded border border-green-700 bg-white px-2.5 py-1 text-xs font-bold text-green-800 transition-colors hover:bg-green-50"
    >
      🔔 新しいお知らせ
    </Link>
  )
}
