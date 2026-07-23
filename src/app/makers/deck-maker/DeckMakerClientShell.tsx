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

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> }
}

export default function DeckMakerClientShell({ initialDeck, dbDecks }: { initialDeck?: InitialDeck; dbDecks: SavedDeck[] }) {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const refresh = () => {
      const update = () => setRevision(current => current + 1)
      const transitionDocument = document as ViewTransitionDocument
      if (transitionDocument.startViewTransition) transitionDocument.startViewTransition(update)
      else update()
    }

    window.addEventListener(DECK_DRAFT_REFRESH_EVENT, refresh)
    return () => window.removeEventListener(DECK_DRAFT_REFRESH_EVENT, refresh)
  }, [])

  return <>
    <DeckMaker key={revision} initialDeck={revision === 0 ? initialDeck : undefined} dbDecks={dbDecks} />
    <style jsx global>{`
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation-duration: 90ms;
        animation-timing-function: ease-out;
      }
    `}</style>
  </>
}
