'use client'

import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { GOODLIFE_SCRIPT_URL, type AdSlotName } from '@/lib/ads'

const HOME_MIDDLE_MARKER = 'goodlife-home-middle-row-10'
const RANKING_BEFORE_GREEN_MARKER = 'goodlife-ranking-before-green'

function appendGoodlifeScript(target: HTMLElement) {
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.charset = 'utf-8'
  script.src = GOODLIFE_SCRIPT_URL
  script.async = true
  target.appendChild(script)
}

function GoodlifeAdUnit({
  slot,
  visibilityClass,
  desktopEnabled,
  mobileEnabled,
}: {
  slot: AdSlotName
  visibilityClass: string
  desktopEnabled: boolean
  mobileEnabled: boolean
}) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    if ((isDesktop && !desktopEnabled) || (!isDesktop && !mobileEnabled)) return

    content.replaceChildren()
    appendGoodlifeScript(content)

    return () => {
      content.replaceChildren()
    }
  }, [desktopEnabled, mobileEnabled])

  return (
    <aside
      className={`${visibilityClass} mx-auto my-4 box-border flex min-h-[250px] w-full max-w-full flex-col items-center justify-center overflow-hidden px-3 text-center max-md:my-3`}
      data-ad-provider="goodlife"
      data-ad-slot={slot}
      aria-label="広告"
    >
      <span className="mb-1 block text-[10px] leading-none text-gray-400">広告</span>
      <div ref={contentRef} className="mx-auto flex min-h-[250px] max-w-full items-center justify-center overflow-hidden" />
    </aside>
  )
}

function GoodlifeIsolatedAd({ slot, padded = false }: { slot: string; padded?: boolean }) {
  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;text-align:center;}body>*{margin-left:auto!important;margin-right:auto!important;}</style></head><body><script type="text/javascript" charset="utf-8" src="${GOODLIFE_SCRIPT_URL}"></script></body></html>`

  return (
    <aside
      className={`mx-auto box-border flex min-h-[250px] w-full max-w-full flex-col items-center justify-center overflow-hidden px-3 text-center md:hidden ${padded ? 'py-2' : ''}`}
      data-ad-provider="goodlife"
      data-ad-slot={slot}
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

export function GoodlifeInlineAdClient({
  slot,
  visibilityClass,
  desktopEnabled,
  mobileEnabled,
}: {
  slot: AdSlotName
  visibilityClass: string
  desktopEnabled: boolean
  mobileEnabled: boolean
}) {
  const pathname = usePathname()
  const [middleHost, setMiddleHost] = useState<HTMLDivElement | null>(null)
  const [rankingHost, setRankingHost] = useState<HTMLDivElement | null>(null)
  const footerRouteExcluded = slot === 'footer_inline'
    && (pathname.startsWith('/admin') || pathname.startsWith('/auth') || pathname.startsWith('/login'))

  useEffect(() => {
    // フッター上と同じ許可済みタグを、スマホTOPの10段目（30件目直後）にも表示する。
    // 同一ページ内でフッター広告と競合しないよう、中段は独立したiframe文書内でタグを実行する。
    if (slot !== 'footer_inline' || pathname !== '/' || footerRouteExcluded || !mobileEnabled) {
      setMiddleHost(null)
      return
    }
    if (window.matchMedia('(min-width: 768px)').matches) {
      setMiddleHost(null)
      return
    }

    let createdHost: HTMLDivElement | null = null

    const attach = () => {
      const existing = document.querySelector<HTMLDivElement>(`[data-ad-placement="${HOME_MIDDLE_MARKER}"]`)
      if (existing) {
        setMiddleHost(existing)
        return true
      }

      const grids = Array.from(document.querySelectorAll<HTMLDivElement>('div.grid'))
      const threadGrid = grids.find(grid =>
        grid.classList.contains('grid-cols-3')
        && grid.classList.contains('border-l')
        && grid.classList.contains('border-t')
        && grid.querySelectorAll(':scope > .thread-card').length >= 30,
      )
      if (!threadGrid) return false

      const threadCards = threadGrid.querySelectorAll<HTMLElement>(':scope > .thread-card')
      const anchor = threadCards.item(29)
      if (!anchor) return false

      const host = document.createElement('div')
      host.className = 'col-span-3 border-b border-r border-gray-300 bg-white md:hidden'
      host.dataset.adPlacement = HOME_MIDDLE_MARKER
      host.setAttribute('aria-label', '広告')
      anchor.after(host)
      createdHost = host
      setMiddleHost(host)
      return true
    }

    if (!attach()) {
      const observer = new MutationObserver(() => {
        if (attach()) observer.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })

      return () => {
        observer.disconnect()
        setMiddleHost(null)
        createdHost?.remove()
      }
    }

    return () => {
      setMiddleHost(null)
      createdHost?.remove()
    }
  }, [footerRouteExcluded, mobileEnabled, pathname, slot])

  useEffect(() => {
    if (slot !== 'footer_inline' || pathname !== '/ranking' || footerRouteExcluded || !mobileEnabled) {
      setRankingHost(null)
      return
    }
    if (window.matchMedia('(min-width: 768px)').matches) {
      setRankingHost(null)
      return
    }

    let createdHost: HTMLDivElement | null = null

    const attach = () => {
      const existing = document.querySelector<HTMLDivElement>(`[data-ad-placement="${RANKING_BEFORE_GREEN_MARKER}"]`)
      if (existing) {
        setRankingHost(existing)
        return true
      }

      const candidates = Array.from(document.querySelectorAll<HTMLElement>('main div'))
      const greenBanner = candidates.find(element => {
        const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (!text.startsWith('初めての方はスレッドの立て方')) return false
        return !Array.from(element.children).some(child =>
          (child.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith('初めての方はスレッドの立て方'),
        )
      })
      if (!greenBanner) return false

      const host = document.createElement('div')
      host.className = 'md:hidden'
      host.dataset.adPlacement = RANKING_BEFORE_GREEN_MARKER
      host.setAttribute('aria-label', '広告')
      greenBanner.before(host)
      createdHost = host
      setRankingHost(host)
      return true
    }

    if (!attach()) {
      const observer = new MutationObserver(() => {
        if (attach()) observer.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })

      return () => {
        observer.disconnect()
        setRankingHost(null)
        createdHost?.remove()
      }
    }

    return () => {
      setRankingHost(null)
      createdHost?.remove()
    }
  }, [footerRouteExcluded, mobileEnabled, pathname, slot])

  if (footerRouteExcluded) return null

  return (
    <>
      <GoodlifeAdUnit
        slot={slot}
        visibilityClass={visibilityClass}
        desktopEnabled={desktopEnabled}
        mobileEnabled={mobileEnabled}
      />
      {middleHost && createPortal(<GoodlifeIsolatedAd slot="home_middle_row_10" padded />, middleHost)}
      {rankingHost && createPortal(<GoodlifeIsolatedAd slot="ranking_before_green" />, rankingHost)}
    </>
  )
}
