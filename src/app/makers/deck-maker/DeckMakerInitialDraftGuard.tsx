'use client'

import { useLayoutEffect } from 'react'
import { DECK_STORAGE_KEY } from '@/lib/deck-maker'

export default function DeckMakerInitialDraftGuard({ enabled }: { enabled: boolean }) {
  useLayoutEffect(() => {
    if (enabled) localStorage.removeItem(DECK_STORAGE_KEY)
  }, [enabled])

  return null
}
