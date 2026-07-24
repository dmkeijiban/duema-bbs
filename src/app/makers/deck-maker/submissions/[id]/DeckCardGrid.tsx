'use client'

import { useEffect, useState } from 'react'
import { shouldShowSpecialSlot } from '@/lib/deck-maker'

type DeckCard = {
  id: string
  printingId?: string | null
  name: string
  imageUrl: string | null
  sourceKey: string | null
  faceSideIndex?: number
  zone?: string
  entryIndex: number
  copy: number
}

type SpecialCard = { id: string; name: string; imageUrl: string | null }

// 'special' is intentionally excluded here: the special slot is a single
// deck-level specialCardId pick, never a cards-array entry (see resolveAutoZone/
// isSpecialSlotCard in @/lib/deck-maker), so it's rendered as its own dedicated
// block from a `specialCard` prop instead of being grouped out of `cards`.
const ZONE_ORDER = ['main', 'gr', 'hyperspatial'] as const
const ZONE_LABELS: Record<string, string> = { main: 'メインデッキ', gr: 'GRゾーン', hyperspatial: '超次元ゾーン' }

function groupByZone(cards: DeckCard[], format: string) {
  if (format !== 'advance') return [{ label: null as string | null, cards }]
  return ZONE_ORDER
    .map(zone => ({ label: ZONE_LABELS[zone], cards: cards.filter(card => (card.zone ?? 'main') === zone) }))
    .filter(section => section.cards.length > 0)
}

function DeckGrid({ cards, enlarged = false, onOpen }: { cards: DeckCard[]; enlarged?: boolean; onOpen?: () => void }) {
  return <div className={`${enlarged ? 'grid grid-cols-8 gap-1 rounded-xl bg-slate-200 p-1 sm:gap-1.5 sm:p-1.5' : 'mt-3 grid grid-cols-8 gap-0.5 rounded-xl bg-slate-200 p-0.5'}`}>
    {cards.map(card => {
      const key = `${card.id}:${card.printingId ?? card.sourceKey ?? 'default'}:${card.faceSideIndex ?? 0}:${card.entryIndex}:${card.copy}`
      const cardArt = card.imageUrl
        ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" />
        : <span className={`flex h-full items-center justify-center p-1 text-center font-bold leading-tight text-white ${enlarged ? 'text-[9px] sm:text-xs' : 'text-[7px]'}`}>{card.name}</span>

      if (enlarged) {
        return <div key={key} className="aspect-[5/7] overflow-hidden rounded-[4px] bg-slate-700" title={`${card.name}${card.sourceKey ? ` / ${card.sourceKey}` : ''}`}>
          {cardArt}
        </div>
      }

      return <button
        key={key}
        type="button"
        onClick={onOpen}
        aria-label="デッキ全体を拡大表示"
        className="aspect-[5/7] cursor-zoom-in overflow-hidden rounded-[3px] bg-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        title="デッキ全体を拡大表示"
      >
        {cardArt}
      </button>
    })}
  </div>
}

function SpecialSlotSection({ specialCard, enlarged }: { specialCard: SpecialCard; enlarged?: boolean }) {
  return (
    <div>
      <p className="mb-1 mt-4 text-xs font-black text-slate-600 first:mt-0">特殊</p>
      <div className={enlarged ? 'w-32' : 'w-20'}>
        <div className="aspect-[5/7] overflow-hidden rounded-[4px] bg-slate-700" title={specialCard.name}>
          {specialCard.imageUrl
            ? <img src={specialCard.imageUrl} alt={specialCard.name} className="h-full w-full object-cover" />
            : <span className="flex h-full items-center justify-center p-1 text-center text-[9px] font-bold leading-tight text-white">{specialCard.name}</span>}
        </div>
      </div>
    </div>
  )
}

function DeckSections({ cards, format, specialCard, enlarged, onOpen }: { cards: DeckCard[]; format: string; specialCard?: SpecialCard | null; enlarged?: boolean; onOpen?: () => void }) {
  const sections = groupByZone(cards, format)
  return <>
    {sections.map((section, index) => (
      <div key={section.label ?? index}>
        {section.label && <p className="mb-1 mt-4 text-xs font-black text-slate-600 first:mt-0">{section.label}（{section.cards.length}枚）</p>}
        <DeckGrid cards={section.cards} enlarged={enlarged} onOpen={onOpen} />
      </div>
    ))}
    {shouldShowSpecialSlot(format, specialCard?.id) && specialCard && <SpecialSlotSection specialCard={specialCard} enlarged={enlarged} />}
  </>
}

export default function DeckCardGrid({ cards, format = 'original', specialCard = null }: { cards: DeckCard[]; format?: string; specialCard?: SpecialCard | null }) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [isOpen])

  return <>
    <DeckSections cards={cards} format={format} specialCard={specialCard} onOpen={() => setIsOpen(true)} />

    {isOpen && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4" onMouseDown={event => { if (event.currentTarget === event.target) setIsOpen(false) }}>
      <section role="dialog" aria-modal="true" aria-label="デッキ全体の拡大表示" className="relative max-h-[calc(100dvh-16px)] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-2 shadow-2xl sm:max-h-[calc(100dvh-32px)] sm:p-4">
        <button type="button" onClick={() => setIsOpen(false)} aria-label="拡大表示を閉じる" className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow">×</button>
        <div className="pr-12">
          <p className="mb-2 text-sm font-black text-slate-900 sm:text-base">デッキ全体{format === 'original' ? '（40枚）' : ''}</p>
        </div>
        <DeckSections cards={cards} format={format} specialCard={specialCard} enlarged />
      </section>
    </div>}
  </>
}
