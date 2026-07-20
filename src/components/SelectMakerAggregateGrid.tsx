'use client'

import { useState } from 'react'
import type { SelectMakerAggregateEntry } from '@/lib/maker-submissions'

function ratePercent(selectionCount: number, total: number) {
  if (!total) return '0.0'
  return ((selectionCount / total) * 100).toFixed(1)
}

function proxiedCardImageUrl(imageUrl: string) {
  return `/api/makers/dm26-ex2-card-image?url=${encodeURIComponent(imageUrl)}`
}

// SELECT型企画のカード別ランキング表示。上位initialCount件を表示し「全部見る」で全件展開する
export default function SelectMakerAggregateGrid({
  entries,
  total,
  initialCount = 20,
}: {
  entries: SelectMakerAggregateEntry[]
  total: number
  initialCount?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const visibleEntries = expanded ? entries : entries.slice(0, initialCount)
  const remaining = entries.length - visibleEntries.length
  return (
    <div>
      <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {visibleEntries.map((entry, index) => (
          <div key={entry.cardId} className="min-w-0">
            <div className="relative aspect-[5/7] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <span className="absolute left-1 top-1 z-10 rounded bg-black/75 px-1.5 py-0.5 text-xs font-black text-white">{entry.rank}位</span>
              {entry.imageUrl
                ? <img src={proxiedCardImageUrl(entry.imageUrl)} alt={entry.name} loading={index < initialCount ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-contain" />
                : <span className="flex h-full items-center justify-center p-1 text-center text-xs text-slate-500">{entry.name}</span>}
            </div>
            <p className="mt-1 line-clamp-2 break-words text-xs font-bold text-slate-900">{entry.name}</p>
            <p className="mt-0.5 text-xs text-gray-600">
              <span className="font-black text-blue-700">{entry.selectionCount}人</span>
              <span className="ml-1">{ratePercent(entry.selectionCount, total)}%</span>
            </p>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-5 flex min-h-11 w-full items-center justify-center rounded-lg border border-blue-700 bg-white px-4 font-bold text-blue-700 hover:bg-blue-50"
        >
          全部見る（残り{remaining}枚）
        </button>
      )}
    </div>
  )
}
