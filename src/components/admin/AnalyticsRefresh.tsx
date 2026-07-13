'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const INTERVAL = 300_000

export function AnalyticsRefresh({ updatedAt }: { updatedAt: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [lastUpdated, setLastUpdated] = useState(updatedAt)
  const lastRefresh = useRef(Date.parse(updatedAt))
  const refreshing = useRef(false)
  const refresh = useCallback(() => {
    if (refreshing.current) return
    refreshing.current = true
    startTransition(() => {
      router.refresh()
      lastRefresh.current = Date.now()
      setLastUpdated(new Date().toISOString())
    })
  }, [router])
  useEffect(() => {
    if (!pending) refreshing.current = false
  }, [pending])
  useEffect(() => {
    const tick = () => { if (!document.hidden && Date.now() - lastRefresh.current >= INTERVAL) refresh() }
    const timer = window.setInterval(tick, INTERVAL)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [refresh])
  return <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
    <button type="button" onClick={refresh} disabled={pending} className="rounded border border-gray-300 bg-white px-3 py-1.5 font-bold text-gray-700 disabled:opacity-60">{pending ? '更新中…' : '最新情報に更新'}</button>
    <span>最終更新: {new Intl.DateTimeFormat('ja-JP',{ timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit' }).format(new Date(lastUpdated))}</span>
    <span>表示中のみ5分ごと</span>
  </div>
}
