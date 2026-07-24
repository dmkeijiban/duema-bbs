'use client'

import type { DeckEntry, DeckFormat } from '@/lib/deck-maker'
import DeckMaker from './DeckMaker'

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
  specialCardId?: string | null
}

type InitialDeck = {
  name: string
  entries: DeckEntry[]
  submissionId?: string
  format?: DeckFormat
  keyCardId?: string | null
  keyCardPrintingId?: string | null
  specialCardId?: string | null
}

export default function DeckMakerClientShell({ initialDeck, dbDecks }: { initialDeck?: InitialDeck; dbDecks: SavedDeck[] }) {
  return <DeckMaker initialDeck={initialDeck} dbDecks={dbDecks} />
}
