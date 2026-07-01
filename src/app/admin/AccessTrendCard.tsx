'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Ga4DailyPoint } from '@/lib/admin-dashboard'

function formatNumber(value: number) {
  return value.toLocaleString('ja-JP')
}

function formatDecimal(value: number) {
  return value.toLocaleString('ja-JP', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function formatDateLabel(date: string) {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

function formatDateLong(date: string) {
  const [year, month, day] = date.split('-')
  return `${Number(year)}/${Number(month)}/${Number(day)}`
}

function MetricCard({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-3">
      <p className="text-[11px] font-bold text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      {note && <p className="mt-1 text-[10px] text-gray-400">{note}</p>}
    </div>
  )
}

export function AccessTrendCard({
  days,
  totalViews,
  totalUsers,
  viewsPerUser,
  points,
}: {
  days: 7 | 28 | 90
  totalViews: number
  totalUsers: number
  viewsPerUser: number
  points: Ga4DailyPoint[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [pendingDays, setPendingDays] = useState<7 | 28 | 90 | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(points[points.length - 1]?.date ?? null)
  const selectedPoint = points.find(point => point.date === selectedDate) ?? points[points.length - 1] ?? null

  const chartWidth = 680
  const chartHeight = 180
  const maxViews = Math.max(...points.map(point => point.views), 1)
  const path = points.map((point, index) => {
    const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * chartWidth
    const y = chartHeight - (point.views / maxViews) * chartHeight
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
  const first = points[0]
  const middle = points[Math.floor((points.length - 1) / 2)]
  const latest = points[points.length - 1]

  const changeDays = (value: 7 | 28 | 90) => {
    if (value === days && !isPending) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('analyticsDays', String(value))
    setPendingDays(value)
    startTransition(() => {
      router.push(`/admin?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <section id="access-trend" className={`rounded border border-gray-200 bg-white p-3 transition-opacity ${isPending ? 'opacity-80' : ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-700">アクセス推移</h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            GA4の表示回数（screenPageViews）を日別に表示します。
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <div className="inline-flex w-fit rounded border border-gray-300 bg-gray-50 p-0.5">
            {([7, 28, 90] as const).map(value => {
              const active = days === value
              const loading = isPending && pendingDays === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeDays(value)}
                  disabled={isPending}
                  className={`rounded px-3 py-1 text-xs font-bold transition active:scale-95 disabled:cursor-wait ${
                    active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-blue-700'
                  } ${loading ? 'opacity-70' : ''}`}
                >
                  {loading ? '更新中…' : `${value}日`}
                </button>
              )
            })}
          </div>
          {isPending && (
            <div className="inline-flex items-center gap-1 text-[11px] text-blue-700">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
              グラフを更新中…
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <MetricCard label="期間内の表示回数合計" value={totalViews} />
        <MetricCard label="期間内のユーザー数合計" value={totalUsers} />
        <MetricCard label="1ユーザーあたり表示回数" value={formatDecimal(viewsPerUser)} />
      </div>

      <div className="mt-3 h-64 w-full overflow-hidden sm:h-72">
        <svg viewBox="0 0 760 240" role="img" aria-label="表示回数の日別推移" className="h-full w-full">
          <g transform="translate(56 20)">
            {[0, 0.25, 0.5, 0.75, 1].map(rate => {
              const y = chartHeight * rate
              const value = Math.round(maxViews * (1 - rate))
              return (
                <g key={rate}>
                  <line x1="0" y1={y} x2={chartWidth} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                  <text x="-10" y={y + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                    {formatNumber(value)}
                  </text>
                </g>
              )
            })}
            <path d={path} fill="none" stroke="#1a73e8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => {
              const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * chartWidth
              const y = chartHeight - (point.views / maxViews) * chartHeight
              const selected = selectedPoint?.date === point.date
              const showDot = points.length <= 45 || index % 3 === 0 || index === points.length - 1 || selected
              return (
                <g key={point.date}>
                  {showDot && <circle cx={x} cy={y} r={selected ? 4 : 2.5} fill={selected ? '#dc2626' : '#1a73e8'} />}
                  <circle
                    cx={x}
                    cy={y}
                    r="9"
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={() => setSelectedDate(point.date)}
                    onTouchStart={() => setSelectedDate(point.date)}
                  />
                </g>
              )
            })}
            <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="#d1d5db" strokeWidth="1.5" />
            {[first, middle, latest].filter(Boolean).map((point, index) => {
              const pointIndex = points.findIndex(item => item.date === point.date)
              const x = points.length <= 1 ? 0 : (pointIndex / (points.length - 1)) * chartWidth
              return (
                <text
                  key={`${point.date}-${index}`}
                  x={x}
                  y="208"
                  textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}
                  fontSize="12"
                  fill="#6b7280"
                >
                  {formatDateLabel(point.date)}
                </text>
              )
            })}
          </g>
        </svg>
      </div>

      {selectedPoint && (
        <div className="mt-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <span className="font-bold">{formatDateLong(selectedPoint.date)}</span>
          <span className="ml-3">表示回数: {formatNumber(selectedPoint.views)}</span>
          <span className="ml-3">ユーザー数: {formatNumber(selectedPoint.users)}</span>
        </div>
      )}
    </section>
  )
}
