'use client'

import { useEffect, useState } from 'react'
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
  const [zoomedEntry, setZoomedEntry] = useState<SelectMakerAggregateEntry | null>(null)
  const rankedEntries = entries.slice(0, RANKING_LIMIT)
  const visibleEntries = expanded ? rankedEntries : rankedEntries.slice(0, initialCount)
  const remaining = rankedEntries.length - visibleEntries.length

  useEffect(() => {
    if (!zoomedEntry) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomedEntry(null)
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [zoomedEntry])

  return (
    <div>
      <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {visibleEntries.map((entry, index) => (
          <div key={entry.cardId} className="min-w-0">
            <button
              type="button"
              onClick={() => setZoomedEntry(entry)}
              aria-label={`${entry.name}を拡大表示`}
              className="relative block aspect-[5/7] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left transition active:scale-[0.98] active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <span className="absolute left-1 top-1 z-10 rounded bg-black/75 px-1.5 py-0.5 text-xs font-black text-white">{entry.rank}位</span>
              {entry.imageUrl
                ? <img src={entry.imageUrl} alt={entry.name} loading={index < initialCount ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-contain" />
                : <span className="flex h-full items-center justify-center p-1 text-center text-xs text-slate-500">{entry.name}</span>}
            </button>
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
          className="mt-5 flex min-h-11 w-full items-center justify-center rounded-lg border border-blue-700 bg-white px-4 font-bold text-blue-700 transition hover:bg-blue-50 active:scale-[0.99] active:bg-blue-100"
        >
          TOP100をすべて見る（残り{remaining}枚）
        </button>
      )}

      {zoomedEntry && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3"
          onMouseDown={event => {
            if (event.currentTarget === event.target) setZoomedEntry(null)
          }}
        >
          <section role="dialog" aria-modal="true" aria-label={`${zoomedEntry.name}の拡大表示`} className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0 pr-3">
                <p className="text-sm font-black text-blue-700">{zoomedEntry.rank}位</p>
                <h2 className="truncate font-black text-slate-900">{zoomedEntry.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setZoomedEntry(null)}
                aria-label="拡大表示を閉じる"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl text-slate-700 transition hover:bg-slate-100 active:scale-90 active:bg-slate-200"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-950 p-3 sm:p-5">
              <div className="mx-auto aspect-[5/7] w-full max-w-sm overflow-hidden rounded-lg bg-slate-900">
                {zoomedEntry.imageUrl
                  ? <img src={zoomedEntry.imageUrl} alt={zoomedEntry.name} className="h-full w-full object-contain" />
                  : <div className="flex h-full items-center justify-center p-5 text-center font-bold text-white">{zoomedEntry.name}</div>}
              </div>
            </div>
            <div className="border-t border-slate-200 bg-white px-4 py-3 text-sm">
              <span className="font-black text-blue-700">{zoomedEntry.selectionCount}人</span>
              <span className="ml-2 text-slate-600">{ratePercent(zoomedEntry.selectionCount, total)}%</span>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
