'use client'

import { useEffect } from 'react'
import { GOODLIFE_WIPE_SCRIPT_URL } from '@/lib/ads'

const SCRIPT_ID = 'goodlife-wipe-ad-script'
const DISMISSED_AT_KEY = 'goodlife_wipe_dismissed_at'
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000
const AD_NODE_TRACKING_MS = 15_000

function wasRecentlyDismissed() {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY))
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS
  } catch {
    return false
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()))
  } catch {
    // localStorageが利用できない環境では、広告側の通常動作を維持する。
  }
}

export function GoodlifeWipeAd({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !window.matchMedia('(max-width: 767px)').matches) return
    if (wasRecentlyDismissed() || document.getElementById(SCRIPT_ID)) return

    const adNodes = new Set<HTMLElement>()
    let trackingFinished = false

    const observer = new MutationObserver(mutations => {
      if (trackingFinished) return

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement) || node.id === SCRIPT_ID) continue
          adNodes.add(node)
          node.querySelectorAll<HTMLElement>('*').forEach(element => adNodes.add(element))
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    const handleClick = (event: MouseEvent) => {
      const path = event.composedPath()
      const clickedAdNode = path.find(
        item => item instanceof HTMLElement && adNodes.has(item),
      ) as HTMLElement | undefined

      if (!clickedAdNode) return

      const trackedAncestors = path.filter(
        item => item instanceof HTMLElement && adNodes.has(item),
      ) as HTMLElement[]

      window.setTimeout(() => {
        const adWasClosed = trackedAncestors.some(element => {
          if (!element.isConnected) return true
          const style = window.getComputedStyle(element)
          return style.display === 'none' || style.visibility === 'hidden'
        })

        if (adWasClosed) rememberDismissal()
      }, 500)
    }

    document.addEventListener('click', handleClick, true)

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.type = 'text/javascript'
    script.charset = 'utf-8'
    script.src = GOODLIFE_WIPE_SCRIPT_URL
    script.async = true
    document.body.appendChild(script)

    const trackingTimer = window.setTimeout(() => {
      trackingFinished = true
      observer.disconnect()
    }, AD_NODE_TRACKING_MS)

    return () => {
      window.clearTimeout(trackingTimer)
      observer.disconnect()
      document.removeEventListener('click', handleClick, true)
      script.remove()
    }
  }, [enabled])

  return null
}
