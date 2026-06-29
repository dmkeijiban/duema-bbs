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
    <div className="mb-1.5 flex flex-col gap-1.5 border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-bold leading-relaxed">新しいお知らせがあります</p>
      <Link
        href="/mypage"
        className="inline-flex shrink-0 items-center justify-center rounded border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
      >
        確認する
      </Link>
    </div>
  )
}
