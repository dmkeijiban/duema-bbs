'use client'

import { useEffect, useRef, useState } from 'react'
import type { DeckEntry, DeckFormat } from '@/lib/deck-maker'
import DeckMaker from './DeckMaker'
import { DECK_DRAFT_REFRESH_EVENT } from './template'

type SavedDeck = {
  id: string
  name: string
  entries: DeckEntry[]
  createdAt: string
  updatedAt: string
  submissionId?: string
  keyCardId?: string | null
  keyCardPrintingId?: string | null
  format?: DeckFormat
}

type InitialDeck = {
  name: string
  entries: DeckEntry[]
  submissionId?: string
  format?: DeckFormat
  keyCardId?: string | null
  keyCardPrintingId?: string | null
}

const CARD_OPERATION_DIALOG_SELECTOR = '[role="dialog"][aria-label$="のカード操作"]'

export default function DeckMakerClientShell({ initialDeck, dbDecks }: { initialDeck?: InitialDeck; dbDecks: SavedDeck[] }) {
  const [revision, setRevision] = useState(0)
  const deferredRefreshObserver = useRef<MutationObserver | null>(null)

  useEffect(() => {
    const refreshNow = () => {
      const scrollX = window.scrollX
      const scrollY = window.scrollY
      setRevision(current => current + 1)
      requestAnimationFrame(() => window.scrollTo(scrollX, scrollY))
    }

    const refresh = () => {
      if (!document.querySelector(CARD_OPERATION_DIALOG_SELECTOR)) {
        refreshNow()
        return
      }

      if (deferredRefreshObserver.current) return

      deferredRefreshObserver.current = new MutationObserver(() => {
        if (document.querySelector(CARD_OPERATION_DIALOG_SELECTOR)) return
        deferredRefreshObserver.current?.disconnect()
        deferredRefreshObserver.current = null
        refreshNow()
      })
      deferredRefreshObserver.current.observe(document.body, { childList: true, subtree: true })
    }

    window.addEventListener(DECK_DRAFT_REFRESH_EVENT, refresh)
    return () => {
      window.removeEventListener(DECK_DRAFT_REFRESH_EVENT, refresh)
      deferredRefreshObserver.current?.disconnect()
      deferredRefreshObserver.current = null
    }
  }, [])

  return <DeckMaker key={revision} initialDeck={revision === 0 ? initialDeck : undefined} dbDecks={dbDecks} />
}
