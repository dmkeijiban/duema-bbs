'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { AdstirBannerClient } from '@/components/AdstirBannerClient'

const TOP_MARKER = 'nine-selection-tabs-ad'
const MOBILE_ONLY_HOST_CLASS = 'mt-3 sm:hidden'

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

export function NineSelectionListAds() {
  const pathname = usePathname()
  const [topHost, setTopHost] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    setTopHost(null)
    if (!isNineSelectionSubmissionsPage(pathname)) return

    let insertedTop: HTMLDivElement | null = null

    const insert = () => {
      const tabWrapper = findVisibleTabWrapper()
      const tabText = tabWrapper?.textContent ?? ''
      if (!tabWrapper || !tabText.includes('集計結果') || !tabText.includes('みんなの9選') || !tabText.includes('自分の9選')) return false

      const existingTop = document.querySelector<HTMLDivElement>(`[data-ad-placement="${TOP_MARKER}"]`)
      if (existingTop) {
        existingTop.className = MOBILE_ONLY_HOST_CLASS
        setTopHost(existingTop)
      } else {
        const host = document.createElement('div')
        host.dataset.adPlacement = TOP_MARKER
        host.className = MOBILE_ONLY_HOST_CLASS
        tabWrapper.after(host)
        insertedTop = host
        setTopHost(host)
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
      }
    }

    return () => {
      insertedTop?.remove()
    }
  }, [pathname])

  return topHost
    ? createPortal(<AdstirBannerClient slot="sp_list_top" className="my-0" />, topHost)
    : null
}
