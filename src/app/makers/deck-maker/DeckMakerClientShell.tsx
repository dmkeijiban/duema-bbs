'use client'

import { useEffect, useState } from 'react'
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

export default function DeckMakerClientShell({ initialDeck, dbDecks }: { initialDeck?: InitialDeck; dbDecks: SavedDeck[] }) {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const refresh = () => {
      const scrollX = window.scrollX
      const scrollY = window.scrollY
      setRevision(current => current + 1)
      requestAnimationFrame(() => window.scrollTo(scrollX, scrollY))
    }

    window.addEventListener(DECK_DRAFT_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(DECK_DRAFT_REFRESH_EVENT, refresh)
  }, [])

  return <DeckMaker key={revision} initialDeck={revision === 0 ? initialDeck : undefined} dbDecks={dbDecks} />
}
