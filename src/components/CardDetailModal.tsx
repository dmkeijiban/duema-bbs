'use client'

import { useEffect, useState, type ReactNode } from 'react'
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
  loading = false,
  count,
  maxReached = false,
  onClose,
  onSelectVersion,
  onChoose,
  chooseLabel = 'このカードを選ぶ',
  onAdd,
  onRemove,
  onMove,
  onAddFilter,
  renderCardArt,
}: CardDetailModalProps) {
  const [visibleCount, setVisibleCount] = useState(count ?? 0)

  useEffect(() => {
    setVisibleCount(count ?? 0)
  }, [card, count])

  if (!card) return null

  const civilizations = card.civilization ?? []
  const canRemove = visibleCount > 0
  const canAdd = !maxReached

  function removeOne() {
    if (!canRemove) return
    setVisibleCount(current => Math.max(0, current - 1))
    onRemove?.(card)
  }

  function addOne() {
    if (!canAdd) return
    setVisibleCount(current => current + 1)
    onAdd?.(card)
  }

  return <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onMouseDown={event => { if (event.currentTarget === event.target) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="shared-card-dialog-title" className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <button type="button" onClick={onClose} aria-label="カード詳細を閉じる" className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow">×</button>
      <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
        <h2 id="shared-card-dialog-title" className="mb-3 pr-12 text-center text-base font-black text-slate-900">{card.name}</h2>
        <div className="mx-auto w-full max-w-[min(330px,calc((100dvh-360px)*5/7))]">{renderCardArt(card, true)}</div>

        {onChoose && <button type="button" onClick={() => onChoose(card)} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-700 px-4 font-black text-white">{chooseLabel}</button>}

        {(onAdd || onRemove) && <div className="mt-3 flex items-center justify-center gap-5">
          <button type="button" onClick={removeOne} disabled={!canRemove} aria-label={`${card.name}を1枚減らす`} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 text-2xl font-bold disabled:text-slate-300">−</button>
          <div className="min-w-20 text-center" aria-live="polite"><span className="text-3xl font-black tabular-nums">{visibleCount}</span></div>
          <button type="button" onClick={addOne} disabled={!canAdd} aria-label={`${card.name}を1枚増やす`} className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-2xl font-bold text-white disabled:bg-slate-400">＋</button>
        </div>}

        {onMove && Boolean(visibleCount) && <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onMove(-1)} className="min-h-10 rounded-lg border border-slate-300 text-sm font-bold text-slate-700">左へ移動</button>
          <button type="button" onClick={() => onMove(1)} className="min-h-10 rounded-lg border border-slate-300 text-sm font-bold text-slate-700">右へ移動</button>
        </div>}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-sm">
          <div><dt className="text-xs font-bold text-slate-500">文明</dt><dd>{civilizations.length ? civilizations.map(value => <button key={value} type="button" onClick={() => onAddFilter?.({ kind: 'civilization', value })} className="mr-1 underline decoration-dotted disabled:no-underline" disabled={!onAddFilter}>{value}</button>) : '—'}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">コスト</dt><dd>{card.cost ?? '—'}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">タイプ</dt><dd>{card.cardType ? <button type="button" onClick={() => onAddFilter?.({ kind: 'cardType', value: card.cardType })} className="underline decoration-dotted disabled:no-underline" disabled={!onAddFilter}>{card.cardType}</button> : '—'}</dd></div>
          <div><dt className="text-xs font-bold text-slate-500">種族</dt><dd>{card.race ? <button type="button" onClick={() => onAddFilter?.({ kind: 'race', value: card.race })} className="underline decoration-dotted disabled:no-underline" disabled={!onAddFilter}>{card.race}</button> : '—'}</dd></div>
          <div className="col-span-2"><dt className="text-xs font-bold text-slate-500">収録弾・カード番号</dt><dd>{card.setName ? <button type="button" onClick={() => onAddFilter?.({ kind: 'setName', value: card.setName })} className="underline decoration-dotted disabled:no-underline" disabled={!onAddFilter}>{card.setName}</button> : '—'}{card.cardNumber ? ` / ${card.cardNumber}` : ''}</dd></div>
          <div className="col-span-2"><dt className="text-xs font-bold text-slate-500">効果</dt><dd className="whitespace-pre-wrap">{card.abilityText || '効果テキスト未登録'}</dd></div>
        </dl>

        <div className="mt-5">
          <p className="mb-2 text-center text-xs font-bold text-slate-600">表裏面・収録版</p>
          {loading && <p className="mb-2 text-center text-xs font-bold text-slate-500">表裏面と収録版を読み込み中…</p>}
          <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2">
            {versions.map(version => {
              const active = printingKey(version) === printingKey(card)
              return <button key={printingKey(version)} type="button" onClick={() => onSelectVersion(version)} aria-pressed={active} className={`w-24 shrink-0 overflow-hidden rounded-lg transition ${active ? 'ring-2 ring-blue-600' : 'opacity-55 ring-1 ring-slate-300 hover:opacity-100'}`}>
                {renderCardArt(version)}
                <span className="block min-h-8 bg-white px-1 py-1 text-[9px] font-bold leading-tight text-slate-800">{version.setName || version.name}</span>
              </button>
            })}
          </div>
        </div>
      </div>
    </section>
  </div>
}
