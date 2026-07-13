'use client'

import { useCallback, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { refreshAdminDashboardAction } from './actions'

const REFRESH_INTERVAL_MS = 300_000

export function AdminDashboardRefresh() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(() => {
    startTransition(async () => {
      await refreshAdminDashboardAction()
      router.refresh()
    })
  }, [router])

  useEffect(() => {
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 bg-white px-3 py-2">
      <p className="text-[11px] text-gray-500">GA4・内部指標を5分ごとに自動更新します。</p>
      <button
        type="button"
        onClick={refresh}
        disabled={isPending}
        className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? '更新中…' : '手動更新'}
      </button>
    </div>
  )
}
