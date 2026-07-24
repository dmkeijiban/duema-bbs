'use client'

import { useEffect } from 'react'

export default function DeckMakerNewDeckUx() {
  useEffect(() => {
    let openedRequestedLibrary = false
    const applyLabels = () => {
      const newDeckButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label="デッキをリセット"], button[aria-label="新しいデッキを作る"]'))
        .find(button => !button.closest('[role="alertdialog"]'))
      if (newDeckButton) {
        if (newDeckButton.dataset.newDeckButton !== 'true') newDeckButton.dataset.newDeckButton = 'true'
        if (newDeckButton.getAttribute('aria-label') !== '新しいデッキを作る') newDeckButton.setAttribute('aria-label', '新しいデッキを作る')
      }

      const heading = document.getElementById('reset-dialog-title')
      if (heading && heading.dataset.newDeckHeading !== 'true') heading.dataset.newDeckHeading = 'true'

      const description = document.getElementById('reset-dialog-description')
      if (description && description.dataset.newDeckDescription !== 'true') description.dataset.newDeckDescription = 'true'

      const confirmButton = document.querySelector<HTMLButtonElement>('[role="alertdialog"] button[aria-label="デッキをすべて削除"], [role="alertdialog"] button[aria-label="新しいデッキを作る"]')
      if (confirmButton) {
        if (confirmButton.dataset.newDeckConfirm !== 'true') confirmButton.dataset.newDeckConfirm = 'true'
        if (confirmButton.getAttribute('aria-label') !== '新しいデッキを作る') confirmButton.setAttribute('aria-label', '新しいデッキを作る')
      }

      if (!openedRequestedLibrary && new URLSearchParams(window.location.search).get('open') === 'my-decks') {
        const myDecksButton = document.querySelector<HTMLButtonElement>('button[aria-label="マイデッキを開く"]')
        if (myDecksButton) {
          openedRequestedLibrary = true
          myDecksButton.click()
          window.history.replaceState(null, '', window.location.pathname)
        }
      }
    }

    applyLabels()
    const observer = new MutationObserver(applyLabels)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return <style jsx global>{`
    button[data-new-deck-button='true'] {
      width: auto !important;
      min-width: 0 !important;
      height: 2.25rem !important;
      padding: 0 0.75rem !important;
      border: 1px solid rgb(147 197 253) !important;
      color: rgb(29 78 216) !important;
      background: white !important;
      font-size: 0 !important;
      font-weight: 700 !important;
      white-space: nowrap !important;
    }
    button[data-new-deck-button='true']:hover { background: rgb(239 246 255) !important; }
    button[data-new-deck-button='true'] svg { display: none !important; }
    button[data-new-deck-button='true']::after {
      content: '新しく作る';
      font-size: 0.75rem;
    }
    [data-new-deck-heading='true'],
    [data-new-deck-description='true'],
    button[data-new-deck-confirm='true'] { font-size: 0 !important; }
    [data-new-deck-heading='true']::after {
      content: '新しいデッキを作りますか？';
      font-size: 1.125rem;
    }
    [data-new-deck-description='true']::after {
      content: '現在編集中の内容を閉じて、空のデッキを作成します。保存していない変更は失われます。';
      font-size: 0.875rem;
      line-height: 1.625;
    }
    button[data-new-deck-confirm='true'] {
      background: rgb(29 78 216) !important;
    }
    button[data-new-deck-confirm='true']::after {
      content: '新しく作る';
      font-size: 1rem;
    }
  `}</style>
}
