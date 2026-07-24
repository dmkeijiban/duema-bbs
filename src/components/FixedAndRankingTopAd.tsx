'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { AdstirBannerClient } from '@/components/AdstirBannerClient'

const TOP_HOST_MARKER = 'fixed-ranking-top-ad'
const BOTTOM_HOST_MARKER = 'ranking-bottom-nav-ad'

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

function findRankingHeaderAnchor() {
  return document.querySelector<HTMLElement>('body > header')
}

function findRankingBottomNavAnchor() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('main nav, main div'))
  return candidates.find(element => {
    const text = normalizedText(element)
    if (!text.includes('更新順一覧') || !text.includes('ランキング')) return false
    if (!text.includes('ランダム') || !text.includes('過去ログ')) return false

    return !Array.from(element.children).some(child => {
      const childText = normalizedText(child)
      return childText.includes('更新順一覧')
        && childText.includes('ランキング')
        && childText.includes('ランダム')
        && childText.includes('過去ログ')
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

export function FixedAndRankingTopAd({ enableListTop, enableListMiddle }: { enableListTop: boolean; enableListMiddle: boolean }) {
  const pathname = usePathname()
  const [topHost, setTopHost] = useState<HTMLDivElement | null>(null)
  const [bottomHost, setBottomHost] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    setTopHost(null)
    setBottomHost(null)

    const insertedHosts: HTMLDivElement[] = []

    const ensureHost = (
      marker: string,
      anchor: HTMLElement | null,
      position: 'before' | 'after',
      className: string,
      setHost: (host: HTMLDivElement) => void,
    ) => {
      const existing = document.querySelector<HTMLDivElement>(`[data-ad-placement="${marker}"]`)
      if (existing) {
        setHost(existing)
        return true
      }
      if (!anchor) return false

      const container = document.createElement('div')
      container.dataset.adPlacement = marker
      container.className = className

      if (position === 'before') anchor.before(container)
      else anchor.after(container)

      insertedHosts.push(container)
      setHost(container)
      return true
    }

    if (!enableListTop && !enableListMiddle) return

    const insert = () => {
      if (pathname === '/ranking') {
        const topReady = !enableListTop || ensureHost(
          TOP_HOST_MARKER,
          findRankingHeaderAnchor(),
          'after',
          'my-2',
          setTopHost,
        )
        const bottomReady = !enableListMiddle || ensureHost(
          BOTTOM_HOST_MARKER,
          findRankingBottomNavAnchor(),
          'before',
          'my-2',
          setBottomHost,
        )
        return topReady && bottomReady
      }

      if (!enableListTop) return true

      return ensureHost(
        TOP_HOST_MARKER,
        findFixedPageBreadcrumb(pathname),
        'after',
        'my-3',
        setTopHost,
      )
    }

    if (insert()) {
      return () => insertedHosts.forEach(host => host.remove())
    }

    const observer = new MutationObserver(() => {
      if (insert()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      insertedHosts.forEach(host => host.remove())
    }
  }, [pathname, enableListTop, enableListMiddle])

  return (
    <>
      {topHost && createPortal(
        <AdstirBannerClient slot="sp_list_top" className="my-0" allowOnListPage />,
        topHost,
      )}
      {bottomHost && createPortal(
        <AdstirBannerClient slot="sp_list_middle" className="my-0" />,
        bottomHost,
      )}
    </>
  )
}
