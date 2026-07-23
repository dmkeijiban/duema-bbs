'use client'

import { useEffect } from 'react'

const ATTRIBUTES = [
  'data-deck-format-toolbar',
  'data-deck-format-label',
  'data-deck-format-toggle',
  'data-deck-cost-sort',
  'data-deck-zone-tabs',
  'data-deck-zone-heading',
] as const

export default function DeckMakerMobileAdvanceLayoutFix() {
  useEffect(() => {
    const applyLayoutMarkers = () => {
      const sortButton = document.querySelector<HTMLButtonElement>('button[aria-label="コストが小さい順に並べ替え"]')
      const formatLabel = Array.from(document.querySelectorAll<HTMLElement>('span')).find(element => element.textContent?.trim() === 'フォーマット')
      const toolbar = formatLabel?.parentElement
      const deckHeading = document.getElementById('deck-heading')
      const deckHeadingRow = deckHeading?.parentElement
      if (!sortButton || !toolbar || !deckHeadingRow) return

      toolbar.setAttribute('data-deck-format-toolbar', '')
      formatLabel.setAttribute('data-deck-format-label', '')
      sortButton.setAttribute('data-deck-cost-sort', '')
      deckHeadingRow.setAttribute('data-deck-zone-heading', '')

      const directChildren = Array.from(toolbar.children) as HTMLElement[]
      const toggle = directChildren.find(element => element.tagName === 'DIV' && element.querySelectorAll('button').length === 2)
      const zoneTabs = directChildren.find(element => element !== toggle && element.tagName === 'DIV' && element.querySelectorAll('button').length >= 3)

      toggle?.setAttribute('data-deck-format-toggle', '')
      zoneTabs?.setAttribute('data-deck-zone-tabs', '')

      if (sortButton.parentElement !== deckHeadingRow) deckHeadingRow.appendChild(sortButton)
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
    button[aria-label="デッキをマイデッキに保存"] > svg,
    button[aria-label="マイデッキを開く"] > svg,
    button[aria-label="デッキ画像を出力"] > svg {
      display: none !important;
    }

    button[aria-label="デッキをマイデッキに保存"],
    button[aria-label="マイデッキを開く"],
    button[aria-label="デッキ画像を出力"] {
      gap: 0 !important;
    }

    [data-deck-zone-heading] {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    [data-deck-cost-sort] {
      margin-left: auto;
    }

    @media (max-width: 639px) {
      [data-deck-format-toolbar] {
        display: grid !important;
        grid-template-columns: auto minmax(0, 1fr);
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

      [data-deck-cost-sort] {
        min-height: 2.25rem !important;
        padding-left: 0.75rem !important;
        padding-right: 0.75rem !important;
      }
    }
  `}</style>
}
