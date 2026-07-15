'use client'

import { useState, type PointerEvent } from 'react'
import type { Ga4DailyPoint } from '@/lib/admin-dashboard'

const WIDTH = 1000
const HEIGHT = 240
const PADDING = { top: 24, right: 24, bottom: 42, left: 58 }

function formatNumber(value: number) {
  return value.toLocaleString('ja-JP')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${value}T00:00:00+09:00`))
}

export function TotalPvChart({ points }: { points: Ga4DailyPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const maxViews = Math.max(...points.map(point => point.views), 1)
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const coordinates = points.map((point, index) => ({
    ...point,
    x: PADDING.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: PADDING.top + plotHeight - (point.views / maxViews) * plotHeight,
  }))
  const line = coordinates.map(point => `${point.x},${point.y}`).join(' ')
  const area = coordinates.length > 0
    ? `${PADDING.left},${PADDING.top + plotHeight} ${line} ${PADDING.left + plotWidth},${PADDING.top + plotHeight}`
    : ''
  const dateLabels = coordinates.filter((_, index) => index === 0 || index === coordinates.length - 1 || index % 7 === 0)
  const total = points.reduce((sum, point) => sum + point.views, 0)
  const active = activeIndex === null ? null : coordinates[activeIndex]

  function selectNearestPoint(event: PointerEvent<SVGSVGElement>) {
    if (coordinates.length === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH
    const ratio = Math.max(0, Math.min(1, (svgX - PADDING.left) / plotWidth))
    setActiveIndex(Math.round(ratio * (coordinates.length - 1)))
  }

  return <section className="mb-3 rounded-lg border bg-white p-3">
    <div className="mb-2 flex flex-wrap items-end justify-between gap-1">
      <div>
        <h2 className="text-xs font-bold text-gray-700">過去28日のPV推移</h2>
        <p className="text-[10px] text-gray-400">サイト全体の日別PV合計</p>
      </div>
      <p className="text-sm font-black tabular-nums text-gray-800">合計 {formatNumber(total)} PV</p>
    </div>
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="過去28日の日別PV推移"
        className="h-auto w-full touch-pan-y"
        onPointerMove={selectNearestPoint}
        onPointerDown={selectNearestPoint}
        onPointerLeave={() => setActiveIndex(null)}
      >
        {[0, 0.5, 1].map(rate => {
          const y = PADDING.top + plotHeight * rate
          const value = Math.round(maxViews * (1 - rate))
          return <g key={rate}>
            <line x1={PADDING.left} y1={y} x2={WIDTH - PADDING.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PADDING.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{formatNumber(value)}</text>
          </g>
        })}
        {area && <polygon points={area} fill="#dbeafe" opacity="0.7" />}
        {line && <polyline points={line} fill="none" stroke="#0284c7" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {active && <>
          <line x1={active.x} y1={PADDING.top} x2={active.x} y2={PADDING.top + plotHeight} stroke="#64748b" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx={active.x} cy={active.y} r="6" fill="#0284c7" stroke="white" strokeWidth="3" />
        </>}
        {dateLabels.map(point => <text key={point.date} x={point.x} y={HEIGHT - 12} textAnchor="middle" fontSize="11" fill="#6b7280">{point.date.slice(5).replace('-', '/')}</text>)}
      </svg>
      {active && <div
        className="pointer-events-none absolute z-10 min-w-32 rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg"
        style={{
          left: `${(active.x / WIDTH) * 100}%`,
          top: `${Math.max(0, (active.y / HEIGHT) * 100 - 12)}%`,
          transform: active.x > WIDTH * 0.72 ? 'translate(-100%, -100%)' : active.x < WIDTH * 0.28 ? 'translate(0, -100%)' : 'translate(-50%, -100%)',
        }}
      >
        <p className="whitespace-nowrap text-[11px] text-gray-500">{formatDate(active.date)}</p>
        <p className="mt-1 whitespace-nowrap font-black tabular-nums text-gray-900">総アクセス数 {formatNumber(active.views)} PV</p>
      </div>}
    </div>
  </section>
}
