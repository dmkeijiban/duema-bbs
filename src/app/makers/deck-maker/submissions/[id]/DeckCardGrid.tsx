'use client'

import { useEffect, useState } from 'react'

type DeckCard = {
  id: string
  printingId?: string | null
  name: string
  imageUrl: string | null
  sourceKey: string | null
  faceSideIndex?: number
  entryIndex: number
  copy: number
}

export default function DeckCardGrid({ cards }: { cards: DeckCard[] }) {
  const [selected, setSelected] = useState<DeckCard | null>(null)

  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [selected])

  return <>
    <div className="mt-3 grid grid-cols-8 gap-0.5 rounded-xl bg-slate-200 p-0.5">
      {cards.map(card => (
        <button
          key={`${card.id}:${card.printingId ?? card.sourceKey ?? 'default'}:${card.faceSideIndex ?? 0}:${card.entryIndex}:${card.copy}`}
          type="button"
          onClick={() => setSelected(card)}
          aria-label={`${card.name}を拡大表示`}
          className="aspect-[5/7] overflow-hidden rounded-[3px] bg-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          title={`${card.name}${card.sourceKey ? ` / ${card.sourceKey}` : ''}`}
        >
          {card.imageUrl ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-1 text-center text-[7px] font-bold leading-tight text-white">{card.name}</span>}
        </button>
      ))}
    </div>

    {selected && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setSelected(null) }}>
      <section role="dialog" aria-modal="true" aria-label={`${selected.name}の拡大表示`} className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-md items-center justify-center overflow-auto rounded-2xl bg-white p-3 shadow-2xl sm:p-5">
        <button type="button" onClick={() => setSelected(null)} aria-label="拡大表示を閉じる" className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow">×</button>
        {selected.imageUrl ? <img src={selected.imageUrl} alt={selected.name} className="max-h-[calc(100dvh-48px)] w-auto max-w-full rounded-xl object-contain" /> : <div className="flex aspect-[5/7] w-full max-w-sm items-center justify-center rounded-xl bg-slate-800 p-4 text-center font-bold text-white">{selected.name}</div>}
      </section>
    </div>}
  </>
}
