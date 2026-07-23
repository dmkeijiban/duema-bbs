'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { AdstirBannerClient } from '@/components/AdstirBannerClient'

const HOST_MARKER = 'fixed-ranking-top-ad'

const EXCLUDED_FIXED_PAGE_PREFIXES = [
  '/admin',
  '/api',
  '/login',
  '/makers',
  '/mypage',
  '/new',
  '/random',
  '/ranking',
  '/signup',
  '/thread',
  '/u/',
  '/update',
  '/kakolog',
]

function normalizedText(element: Element) {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function findRankingAnchor() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('main section, main div'))
  return candidates.find(element => {
    const text = normalizedText(element)
    if (!text.startsWith('おすすめ')) return false
    if (!text.includes('ランキングはこちら')) return false

    return !Array.from(element.children).some(child => {
      const childText = normalizedText(child)
      return childText.startsWith('おすすめ') && childText.includes('ランキングはこちら')
    })
  }) ?? null
}

function findFixedPageBreadcrumb(pathname: string) {
  if (pathname === '/' || EXCLUDED_FIXED_PAGE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix))) {
    return null
  }

  const candidates = Array.from(document.querySelectorAll<HTMLElement>('main nav, main div, main p'))
  return candidates.find(element => {
    const text = normalizedText(element)
    if (text.length > 100 || !text.startsWith('TOP')) return false
    if (!text.includes('>') && !text.includes('›')) return false

    return !Array.from(element.children).some(child => {
      const childText = normalizedText(child)
      return childText.startsWith('TOP') && (childText.includes('>') || childText.includes('›'))
    })
  }) ?? null
}

export function FixedAndRankingTopAd() {
  const pathname = usePathname()
  const [host, setHost] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    setHost(null)

    let insertedHost: HTMLDivElement | null = null

    const insert = () => {
      const existing = document.querySelector<HTMLDivElement>(`[data-ad-placement="${HOST_MARKER}"]`)
      if (existing) {
        setHost(existing)
        return true
      }

      const anchor = pathname === '/ranking'
        ? findRankingAnchor()
        : findFixedPageBreadcrumb(pathname)
      if (!anchor) return false

      const container = document.createElement('div')
      container.dataset.adPlacement = HOST_MARKER
      container.className = pathname === '/ranking' ? 'my-2' : 'my-3'

      if (pathname === '/ranking') anchor.before(container)
      else anchor.after(container)

      insertedHost = container
      setHost(container)
      return true
    }

    if (insert()) {
      return () => insertedHost?.remove()
    }

    const observer = new MutationObserver(() => {
      if (insert()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      insertedHost?.remove()
    }
  }, [pathname])

  if (!host) return null

  return createPortal(
    <AdstirBannerClient slot="sp_list_top" className="my-0" />,
    host,
  )
}
