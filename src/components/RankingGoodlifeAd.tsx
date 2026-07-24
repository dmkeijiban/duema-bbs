'use client'

import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { GOODLIFE_SCRIPT_URL } from '@/lib/ads'

const RANKING_ROW_31_MARKER = 'goodlife-ranking-after-row-31'

function RankingGoodlifeUnit() {
  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;text-align:center;}body>*{margin-left:auto!important;margin-right:auto!important;}</style></head><body><script type="text/javascript" charset="utf-8" src="${GOODLIFE_SCRIPT_URL}"></script></body></html>`

  return (
    <aside
      className="mx-auto box-border flex min-h-[250px] w-full max-w-full flex-col items-center justify-center overflow-hidden px-3 py-2 text-center md:hidden"
      data-ad-provider="goodlife"
      data-ad-slot="ranking_after_row_31"
      aria-label="広告"
    >
      <span className="mb-1 block text-[10px] leading-none text-gray-400">広告</span>
      <iframe
        title="広告"
        srcDoc={srcDoc}
        width="300"
        height="250"
        scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        className="block max-w-full border-0"
      />
    </aside>
  )
}

export function RankingGoodlifeAd() {
  const pathname = usePathname()
  const [host, setHost] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    setHost(null)
    if (pathname !== '/ranking' || window.matchMedia('(min-width: 768px)').matches) return

    let createdHost: HTMLDivElement | null = null

    const attach = () => {
      const existing = document.querySelector<HTMLDivElement>(`[data-ad-placement="${RANKING_ROW_31_MARKER}"]`)
      if (existing) {
        setHost(existing)
        return true
      }

      const grids = Array.from(document.querySelectorAll<HTMLDivElement>('main .grid.grid-cols-3'))
      const rankingGrid = grids.find(grid => grid.querySelectorAll(':scope > .thread-card').length >= 33)
      if (!rankingGrid) return false

      const cards = rankingGrid.querySelectorAll<HTMLElement>(':scope > .thread-card')
      const rowEnd = cards.item(32)
      if (!rowEnd) return false

      const container = document.createElement('div')
      container.className = 'col-span-3 border-b border-r border-gray-300 bg-white md:hidden'
      container.dataset.adPlacement = RANKING_ROW_31_MARKER
      container.setAttribute('aria-label', '広告')
      rowEnd.after(container)
      createdHost = container
      setHost(container)
      return true
    }

    if (attach()) {
      return () => createdHost?.remove()
    }

    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      createdHost?.remove()
    }
  }, [pathname])

  return host ? createPortal(<RankingGoodlifeUnit />, host) : null
}
