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
  const shellRef = useRef<HTMLDivElement>(null)
  const transitionOverlayRef = useRef<HTMLElement | null>(null)
  const transitionTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const clearTransitionOverlay = () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current)
        transitionTimerRef.current = null
      }
      transitionOverlayRef.current?.remove()
      transitionOverlayRef.current = null
    }

    const refreshNow = () => {
      const scrollX = window.scrollX
      const scrollY = window.scrollY
      const shell = shellRef.current

      clearTransitionOverlay()
      if (shell?.firstElementChild instanceof HTMLElement) {
        const overlay = shell.firstElementChild.cloneNode(true) as HTMLElement
        overlay.setAttribute('aria-hidden', 'true')
        overlay.style.position = 'absolute'
        overlay.style.inset = '0'
        overlay.style.zIndex = '30'
        overlay.style.pointerEvents = 'none'
        overlay.style.background = 'rgb(241 245 249)'
        shell.appendChild(overlay)
        transitionOverlayRef.current = overlay
      }

      setRevision(current => current + 1)
      requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY)
        requestAnimationFrame(() => {
          transitionTimerRef.current = window.setTimeout(clearTransitionOverlay, 120)
        })
      })
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
      clearTransitionOverlay()
    }
  }, [])

  return (
    <div ref={shellRef} className="relative min-h-[24rem] bg-slate-100">
      <DeckMaker key={revision} initialDeck={revision === 0 ? initialDeck : undefined} dbDecks={dbDecks} />
    </div>
  )
}
