'use client'

import { useState } from 'react'
import type { SelectMakerAggregateEntry } from '@/lib/maker-submissions'

const RANKING_LIMIT = 100

function ratePercent(selectionCount: number, total: number) {
  if (!total) return '0.0'
  return ((selectionCount / total) * 100).toFixed(1)
}

// SELECT型企画のカード別ランキング表示。初期表示後に展開できる範囲もTOP100までに制限する
export default function SelectMakerAggregateGrid({
  entries,
  total,
  initialCount = 24,
}: {
  entries: SelectMakerAggregateEntry[]
  total: number
  initialCount?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const rankedEntries = entries.slice(0, RANKING_LIMIT)
  const visibleEntries = expanded ? rankedEntries : rankedEntries.slice(0, initialCount)
  const remaining = rankedEntries.length - visibleEntries.length
  return (
    <div>
      <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {visibleEntries.map((entry, index) => (
          <div key={entry.cardId} className="min-w-0">
            <div className="relative aspect-[5/7] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <span className="absolute left-1 top-1 z-10 rounded bg-black/75 px-1.5 py-0.5 text-xs font-black text-white">{entry.rank}位</span>
              {entry.imageUrl
                ? <img src={entry.imageUrl} alt={entry.name} loading={index < initialCount ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-contain" />
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
          TOP100をすべて見る（残り{remaining}枚）
        </button>
      )}
    </div>
  )
}
