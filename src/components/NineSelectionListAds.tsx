'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { AdstirBannerClient } from '@/components/AdstirBannerClient'
import { GOODLIFE_SCRIPT_URL } from '@/lib/ads'

const TOP_MARKER = 'nine-selection-tabs-ad'
const BETWEEN_MARKER = 'nine-selection-between-first-second-ad'

function isNineSelectionSubmissionsPage(pathname: string) {
  return /^\/makers\/[^/]+\/submissions\/?$/.test(pathname)
}

function findVisibleTabWrapper() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="tab=ranking"], a[href*="tab=all"], a[href*="tab=mine"]'))
  const candidates = links
    .map(link => link.parentElement)
    .filter((element): element is HTMLElement => Boolean(element))
    .filter(element => element.querySelectorAll('a[href*="tab="]').length >= 3)

  const visible = candidates.find(element => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(element).display !== 'none'
  })
  if (!visible) return null

  const overflowWrapper = visible.closest<HTMLElement>('.overflow-x-auto')
  return overflowWrapper ?? visible
}

function findSubmissionGrid() {
  const marker = document.getElementById('submissions-list')
  if (!marker) return null

  let sibling = marker.nextElementSibling
  while (sibling) {
    if (sibling instanceof HTMLElement && sibling.querySelector(':scope > article')) return sibling
    sibling = sibling.nextElementSibling
  }
  return null
}

function GoodlifeNineSelectionAd() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.charset = 'utf-8'
    script.src = GOODLIFE_SCRIPT_URL
    script.async = true
    container.appendChild(script)

    return () => container.replaceChildren()
  }, [])

  return (
    <aside className="my-3 w-full max-w-full overflow-hidden text-center" data-ad-provider="goodlife" data-ad-slot="nine_selection_between" aria-label="広告">
      <span className="mb-1 block text-[10px] leading-none text-gray-400">広告</span>
      <div ref={containerRef} className="mx-auto max-w-full overflow-hidden" />
    </aside>
  )
}

export function NineSelectionListAds() {
  const pathname = usePathname()
  const [topHost, setTopHost] = useState<HTMLDivElement | null>(null)
  const [betweenHost, setBetweenHost] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    setTopHost(null)
    setBetweenHost(null)
    if (!isNineSelectionSubmissionsPage(pathname)) return

    let insertedTop: HTMLDivElement | null = null
    let insertedBetween: HTMLDivElement | null = null

    const insert = () => {
      const tabWrapper = findVisibleTabWrapper()
      const tabText = tabWrapper?.textContent ?? ''
      if (!tabWrapper || !tabText.includes('集計結果') || !tabText.includes('みんなの9選') || !tabText.includes('自分の9選')) return false

      const existingTop = document.querySelector<HTMLDivElement>(`[data-ad-placement="${TOP_MARKER}"]`)
      if (existingTop) {
        setTopHost(existingTop)
      } else {
        const host = document.createElement('div')
        host.dataset.adPlacement = TOP_MARKER
        host.className = 'mt-3'
        tabWrapper.after(host)
        insertedTop = host
        setTopHost(host)
      }

      const grid = findSubmissionGrid()
      const firstArticle = grid?.querySelector<HTMLElement>(':scope > article')
      if (grid && firstArticle) {
        const existingBetween = document.querySelector<HTMLDivElement>(`[data-ad-placement="${BETWEEN_MARKER}"]`)
        if (existingBetween) {
          setBetweenHost(existingBetween)
        } else {
          const host = document.createElement('div')
          host.dataset.adPlacement = BETWEEN_MARKER
          host.className = 'col-span-full min-w-0'
          firstArticle.after(host)
          insertedBetween = host
          setBetweenHost(host)
        }
      }

      return true
    }

    if (!insert()) {
      const observer = new MutationObserver(() => {
        if (insert()) observer.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
      return () => {
        observer.disconnect()
        insertedTop?.remove()
        insertedBetween?.remove()
      }
    }

    return () => {
      insertedTop?.remove()
      insertedBetween?.remove()
    }
  }, [pathname])

  return (
    <>
      {topHost && createPortal(<AdstirBannerClient slot="sp_list_top" className="my-0" />, topHost)}
      {betweenHost && createPortal(<GoodlifeNineSelectionAd />, betweenHost)}
    </>
  )
}
