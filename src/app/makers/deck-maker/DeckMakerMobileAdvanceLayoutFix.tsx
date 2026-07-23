'use client'

import { useEffect } from 'react'

const ATTRIBUTES = [
  'data-deck-format-toolbar',
  'data-deck-format-label',
  'data-deck-format-toggle',
  'data-deck-cost-sort',
  'data-deck-zone-tabs',
] as const

export default function DeckMakerMobileAdvanceLayoutFix() {
  useEffect(() => {
    const applyLayoutMarkers = () => {
      const sortButton = document.querySelector<HTMLButtonElement>('button[aria-label="コストが小さい順に並べ替え"]')
      const toolbar = sortButton?.parentElement
      if (!sortButton || !toolbar) return

      toolbar.setAttribute('data-deck-format-toolbar', '')
      sortButton.setAttribute('data-deck-cost-sort', '')

      const directChildren = Array.from(toolbar.children) as HTMLElement[]
      const label = directChildren.find(element => element.tagName === 'SPAN')
      const toggle = directChildren.find(element => element !== sortButton && element.tagName === 'DIV' && element.querySelector('button'))
      const zoneTabs = directChildren.find(element => element !== toggle && element.tagName === 'DIV' && element.querySelectorAll('button').length >= 3)

      label?.setAttribute('data-deck-format-label', '')
      toggle?.setAttribute('data-deck-format-toggle', '')
      zoneTabs?.setAttribute('data-deck-zone-tabs', '')
    }

    applyLayoutMarkers()
    const observer = new MutationObserver(applyLayoutMarkers)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      for (const attribute of ATTRIBUTES) {
        document.querySelectorAll(`[${attribute}]`).forEach(element => element.removeAttribute(attribute))
      }
    }
  }, [])

  return <style jsx global>{`
    @media (max-width: 639px) {
      [data-deck-format-toolbar] {
        display: grid !important;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center !important;
        gap: 0.5rem !important;
        min-height: 0 !important;
      }

      [data-deck-format-label] {
        grid-column: 1;
        min-width: max-content;
      }

      [data-deck-format-toggle] {
        grid-column: 2;
        min-width: 0 !important;
        width: 100%;
      }

      [data-deck-format-toggle] > button {
        min-width: 0;
        flex: 1 1 0%;
        padding-left: 0.75rem !important;
        padding-right: 0.75rem !important;
      }

      [data-deck-cost-sort] {
        grid-column: 3;
      }

      [data-deck-zone-tabs] {
        grid-column: 1 / -1;
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        width: 100% !important;
        min-width: 0 !important;
        flex: none !important;
        gap: 0.25rem !important;
      }

      [data-deck-zone-tabs] > button {
        min-width: 0;
        width: 100%;
        padding-left: 0.375rem !important;
        padding-right: 0.375rem !important;
        white-space: normal;
        line-height: 1.2;
      }
    }
  `}</style>
}
