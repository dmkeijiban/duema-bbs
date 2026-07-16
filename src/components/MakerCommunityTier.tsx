'use client'

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import type { MakerCard, MakerGroup } from '@/lib/maker'

const IMAGE_PROXY_PATH = '/api/makers/dm26-ex2-card-image'

function makerThumbnailUrl(url: string) {
  return `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(url)}&width=160`
}

export type MakerAggregate = { cardId: string; counts: Record<string, number>; ratingCount: number; averageTier: number | null }

export default function MakerCommunityTier({ cards, groups, aggregates, title = 'みんなのカード評価', mode = 'tier', showAllCards = false }: { cards: MakerCard[]; groups: MakerGroup[]; aggregates: MakerAggregate[]; title?: string; mode?: 'tier' | 'selection'; showAllCards?: boolean }) {
  const [zoomed, setZoomed] = useState<MakerCard | null>(null)
  const byCard = new Map(aggregates.map(item => [item.cardId, item]))
  const visible = (showAllCards ? [...cards] : cards.filter(card => (byCard.get(card.id)?.ratingCount ?? 0) > 0))
  if (mode === 'selection') {
    visible.sort((a, b) => (byCard.get(b.id)?.counts.release ?? 0) - (byCard.get(a.id)?.counts.release ?? 0))
  }
  return <section id="community-tier" className="scroll-mt-4 rounded-xl border bg-white p-4">
    <h2 className="text-lg font-black">{title}</h2>
    {visible.length === 0 ? <p className="mt-4 rounded bg-slate-50 p-4 text-sm text-gray-500">まだ集計できる回答がありません。</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{visible.map(card => {
      const aggregate = byCard.get(card.id) ?? { cardId: card.id, counts: {}, ratingCount: 0, averageTier: null }
      return <article key={card.id} className="flex min-w-0 gap-3 rounded border p-3">
        <button type="button" onClick={() => setZoomed(card)} aria-label={`${card.name}を拡大表示`} className="h-28 w-20 shrink-0 overflow-hidden rounded border bg-slate-100">{card.imageUrl ? <img src={makerThumbnailUrl(card.imageUrl)} alt={card.name} loading="lazy" decoding="async" className="h-full w-full object-contain" /> : card.name}</button>
        <div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-sm font-bold">{card.name}</h3>{card.badge && <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${card.badge.className}`}>{card.badge.label}</span>}<p className="mt-1 text-xs text-gray-500">{mode === 'selection' ? `選択 ${aggregate.counts.release ?? 0}人 / 解除予想率 ${aggregate.averageTier?.toFixed(1) ?? '0.0'}%` : `回答 ${aggregate.ratingCount}件 / 平均 ${aggregate.averageTier?.toFixed(2) ?? '-'}`}</p><div className="mt-2 space-y-1">{groups.map(group => { const count = aggregate.counts[group.key] ?? 0; const percent = aggregate.ratingCount ? Math.round(count / aggregate.ratingCount * 100) : 0; return <div key={group.key} className="grid grid-cols-[24px_1fr_58px] items-center gap-1 text-[11px]"><b>{group.label}</b><div className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-slate-700" style={{ width: `${percent}%` }} /></div><span className="text-right tabular-nums">{mode === 'selection' ? `${count}人 ${percent}%` : `${count}件 ${percent}%`}</span></div> })}</div></div>
      </article>
    })}</div>}
    {zoomed && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setZoomed(null) }}><button type="button" aria-label="拡大画像を閉じる" onClick={() => setZoomed(null)} className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-3xl">×</button>{zoomed.imageUrl ? <img src={zoomed.imageUrl} alt={zoomed.name} className="max-h-[92vh] max-w-[94vw] object-contain" /> : <p className="bg-white p-4">{zoomed.name}</p>}</div>}
  </section>
}
