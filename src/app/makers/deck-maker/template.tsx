'use client'

import { Fragment, useEffect, useState, type ReactNode } from 'react'
import {
  DECK_STORAGE_KEY,
  entryZone,
  printingKey,
  type DeckCard,
  type DeckEntry,
} from '@/lib/deck-maker'
import { CARD_PRINTING_CHANGE_EVENT } from '@/hooks/use-card-printing-selector'

type PrintingChangeDetail = {
  previousCard?: DeckCard
  nextCard?: DeckCard
}

type StoredDeckDraft = {
  entries?: DeckEntry[]
  [key: string]: unknown
}

export default function DeckMakerTemplate({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const replacePrinting = (event: Event) => {
      const { previousCard, nextCard } = (event as CustomEvent<PrintingChangeDetail>).detail ?? {}
      if (!previousCard || !nextCard || previousCard.id !== nextCard.id) return

      try {
        const stored = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) ?? 'null') as StoredDeckDraft | null
        if (!stored || !Array.isArray(stored.entries)) return

        const previousKey = printingKey(previousCard)
        const nextKey = printingKey(nextCard)
        const currentIndex = stored.entries.findIndex(entry => printingKey(entry) === previousKey)
        if (currentIndex < 0) return

        const currentEntry = stored.entries[currentIndex]
        const zone = entryZone(currentEntry)
        const targetIndex = stored.entries.findIndex((entry, index) =>
          index !== currentIndex && entryZone(entry) === zone && printingKey(entry) === nextKey
        )
        const entries = stored.entries.map(entry => ({ ...entry }))

        if (targetIndex >= 0) {
          entries[targetIndex] = {
            ...entries[targetIndex],
            count: entries[targetIndex].count + 1,
          }
          entries[currentIndex] = {
            ...entries[currentIndex],
            count: entries[currentIndex].count - 1,
          }
          if (entries[currentIndex].count <= 0) entries.splice(currentIndex, 1)
        } else if (currentEntry.count === 1) {
          entries[currentIndex] = {
            ...nextCard,
            count: 1,
            zone,
          }
        } else {
          entries[currentIndex] = {
            ...entries[currentIndex],
            count: entries[currentIndex].count - 1,
          }
          entries.splice(currentIndex + 1, 0, {
            ...nextCard,
            count: 1,
            zone,
          })
        }

        localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify({ ...stored, entries }))
        setRevision(current => current + 1)
      } catch {
        // 保存データが壊れている場合は、通常の収録版プレビュー切替だけを続行する。
      }
    }

    window.addEventListener(CARD_PRINTING_CHANGE_EVENT, replacePrinting)
    return () => window.removeEventListener(CARD_PRINTING_CHANGE_EVENT, replacePrinting)
  }, [])

  return <Fragment key={revision}>{children}</Fragment>
}
