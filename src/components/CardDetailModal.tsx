'use client'

import { useRef, type ReactNode } from 'react'
import { printingKey, type DeckCard } from '@/lib/deck-maker'
import type { CardSearchFilter } from '@/hooks/use-card-catalog-search'

type CardDetailModalProps = {
  card: DeckCard | null
  versions: DeckCard[]
  loading?: boolean
  count?: number
  maxReached?: boolean
  onClose: () => void
  onSelectVersion: (card: DeckCard) => void
  onChoose?: (card: DeckCard) => void
  chooseLabel?: string
  onAdd?: (card: DeckCard) => void
  onRemove?: (card: DeckCard) => void
  onMove?: (offset: -1 | 1) => void
  onAddFilter?: (filter: CardSearchFilter) => void
  renderCardArt: (card: DeckCard, full?: boolean) => ReactNode
}

export function CardDetailModal({
  card,
  versions,
  count,
  maxReached = false,
  onClose,
  onSelectVersion,
  onChoose,
  chooseLabel = 'このカードを選ぶ',
  onAdd,
  onRemove,
  renderCardArt,
}: CardDetailModalProps) {
  const versionScroller = useRef<HTMLDivElement | null>(null)
  const versionDrag = useRef({ active: false, pointerId: -1, startX: 0, scrollLeft: 0, dragging: false })
  const suppressVersionClick = useRef(false)

  if (!card) return null

  const displayCount = count ?? 0
  const canRemove = displayCount > 0
  const canAdd = !maxReached && displayCount < 4

  function startVersionDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || !versionScroller.current) return
    versionDrag.current = { active: true, pointerId: event.pointerId, startX: event.clientX, scrollLeft: versionScroller.current.scrollLeft, dragging: false }
  }

  function moveVersionDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = versionDrag.current
    if (!drag.active || drag.pointerId !== event.pointerId || !versionScroller.current) return
    const distance = event.clientX - drag.startX
    if (!drag.dragging && Math.abs(distance) <= 4) return
    if (!drag.dragging) {
      drag.dragging = true
      suppressVersionClick.current = true
      versionScroller.current.setPointerCapture(event.pointerId)
    }
    event.preventDefault()
    versionScroller.current.scrollLeft = drag.scrollLeft - distance
  }

  function endVersionDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = versionDrag.current
    if (!drag.active || drag.pointerId !== event.pointerId) return
    const wasDragging = drag.dragging
    versionDrag.current = { active: false, pointerId: -1, startX: 0, scrollLeft: 0, dragging: false }
    if (wasDragging && versionScroller.current?.hasPointerCapture(event.pointerId)) versionScroller.current.releasePointerCapture(event.pointerId)
    if (wasDragging) window.setTimeout(() => { suppressVersionClick.current = false }, 0)
  }

  return <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-3" onMouseDown={event => { if (event.currentTarget === event.target) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label={`${card.name}のカード操作`} className="relative flex h-[calc(100dvh-16px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-24px)]">
      <button type="button" onClick={onClose} aria-label="カード操作を閉じる" className="absolute right-2 top-2 z-10 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow active:scale-95">×</button>
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden px-3 pb-2 pt-3 sm:px-5 sm:pt-4">
        <h2 className="sr-only">{card.name}</h2>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="w-[min(330px,calc((100dvh-330px)*5/7))] max-w-full">{renderCardArt(card, true)}</div>
        </div>

        {(onAdd || onRemove) && <div className="relative z-[1] mt-2 flex shrink-0 items-center justify-center gap-5 bg-white">
          <button type="button" data-disable-interaction-feedback="true" onPointerDown={event => event.preventDefault()} onClick={() => canRemove && onRemove?.(card)} disabled={!canRemove} aria-label={`${card.name}を1枚減らす`} className="flex h-14 w-14 touch-manipulation select-none items-center justify-center rounded-xl border border-slate-300 text-3xl font-bold transition-transform active:scale-90 disabled:text-slate-300 disabled:active:scale-100">−</button>
          <div className="min-w-20 text-center" aria-live="polite"><span className="text-3xl font-black tabular-nums">{displayCount}</span></div>
          <button type="button" data-disable-interaction-feedback="true" onPointerDown={event => event.preventDefault()} onClick={() => canAdd && onAdd?.(card)} disabled={!canAdd} aria-label={`${card.name}を1枚増やす`} className="flex h-14 w-14 touch-manipulation select-none items-center justify-center rounded-xl bg-emerald-700 text-3xl font-bold text-white transition-transform active:scale-90 disabled:bg-slate-400 disabled:active:scale-100">＋</button>
        </div>}

        {onChoose && <button type="button" onClick={() => onChoose(card)} className="mt-2 min-h-10 w-full shrink-0 rounded-xl bg-emerald-700 px-4 font-black text-white">{chooseLabel}</button>}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-3 pb-2 pt-2 sm:px-5 sm:pb-3">
        <div ref={versionScroller} className="flex cursor-grab touch-pan-x select-none gap-2 overflow-x-auto overscroll-x-contain pb-1 active:cursor-grabbing" onPointerDown={startVersionDrag} onPointerMove={moveVersionDrag} onPointerUp={endVersionDrag} onPointerCancel={endVersionDrag}>
          {versions.map(version => {
            const active = printingKey(version) === printingKey(card)
            return <button key={printingKey(version)} type="button" draggable={false} data-disable-interaction-feedback="true" onClick={() => {
              if (suppressVersionClick.current) return
              onSelectVersion(version)
            }} aria-pressed={active} className={`w-20 shrink-0 touch-manipulation overflow-hidden rounded-lg ring-1 ring-slate-300 transition sm:w-24 ${active ? 'ring-2 ring-blue-600' : 'hover:ring-2 hover:ring-slate-500'}`}>
              {renderCardArt(version)}
            </button>
          })}
        </div>
      </div>
    </section>
  </div>
}
