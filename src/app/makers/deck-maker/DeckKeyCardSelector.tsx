'use client'

import { useEffect, useMemo, useState } from 'react'
import { DECK_STORAGE_KEY, printingKey, type DeckEntry } from '@/lib/deck-maker'

const KEY_CARD_COOKIE = 'duema_deck_key_card'

type KeyCardValue = { cardId: string; printingId: string | null }

function readDeckEntries(): DeckEntry[] {
  try {
    const stored = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) ?? 'null') as { entries?: DeckEntry[] } | null
    return Array.isArray(stored?.entries) ? stored.entries.filter(entry => entry && entry.count > 0) : []
  } catch {
    return []
  }
}

function writeSelection(value: KeyCardValue | null) {
  const maxAge = value ? 60 * 60 * 24 * 30 : 0
  const payload = value ? encodeURIComponent(JSON.stringify(value)) : ''
  document.cookie = `${KEY_CARD_COOKIE}=${payload}; path=/; max-age=${maxAge}; samesite=lax`
}

export default function DeckKeyCardSelector({ initialCardId = null, initialPrintingId = null }: { initialCardId?: string | null; initialPrintingId?: string | null }) {
  const [entries, setEntries] = useState<DeckEntry[]>([])
  const [open, setOpen] = useState(false)
  const [selection, setSelection] = useState<KeyCardValue | null>(initialCardId ? { cardId: initialCardId, printingId: initialPrintingId } : null)

  useEffect(() => {
    const sync = () => setEntries(readDeckEntries())
    sync()
    const timer = window.setInterval(sync, 400)
    return () => window.clearInterval(timer)
  }, [])

  const selectableCards = useMemo(() => {
    const unique = new Map<string, DeckEntry>()
    for (const entry of entries) unique.set(printingKey(entry), entry)
    return [...unique.values()]
  }, [entries])

  const selectedCard = selectableCards.find(card => card.id === selection?.cardId && (!selection.printingId || card.printingId === selection.printingId))

  useEffect(() => {
    if (selection && selectableCards.length && !selectedCard) {
      setSelection(null)
      writeSelection(null)
    }
  }, [selectableCards, selectedCard, selection])

  function select(card: DeckEntry) {
    const next = { cardId: card.id, printingId: card.printingId ?? null }
    setSelection(next)
    writeSelection(next)
    setOpen(false)
  }

  return <>
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
      {selectedCard?.imageUrl && <img src={selectedCard.imageUrl} alt="" className="h-12 w-9 rounded object-cover object-top" />}
      <button type="button" onClick={() => setOpen(true)} disabled={!selectableCards.length} className="min-h-11 rounded-xl bg-amber-500 px-4 text-sm font-black text-slate-950 disabled:bg-slate-200 disabled:text-slate-400">
        {selectedCard ? 'キーカードを変更' : 'キーカードを選ぶ'}
      </button>
    </div>

    {open && <div role="presentation" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3" onMouseDown={event => { if (event.currentTarget === event.target) setOpen(false) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="key-card-title" className="flex max-h-[calc(100dvh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div><h2 id="key-card-title" className="text-lg font-black text-slate-950">キーカードを選ぶ</h2><p className="text-xs text-slate-500">一覧とデッキ詳細の代表画像に使われます。</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="閉じる" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-slate-100">×</button>
        </div>
        <div className="min-h-0 overflow-auto p-3">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {selectableCards.map(card => {
              const active = card.id === selection?.cardId && (card.printingId ?? null) === selection.printingId
              return <button key={printingKey(card)} type="button" onClick={() => select(card)} aria-pressed={active} className={`overflow-hidden rounded-lg bg-slate-800 ${active ? 'ring-4 ring-amber-400' : 'hover:ring-2 hover:ring-blue-500'}`}>
                {card.imageUrl ? <img src={card.imageUrl} alt={card.name} className="aspect-[5/7] h-full w-full object-cover object-top" /> : <span className="flex aspect-[5/7] items-center justify-center p-1 text-[9px] font-bold text-white">{card.name}</span>}
              </button>
            })}
          </div>
        </div>
      </section>
    </div>}
  </>
}
