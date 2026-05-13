'use client'

import { useEffect } from 'react'
import { capturePostHogEvent } from '@/lib/posthog-events'

function findAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  return target.closest('a')
}

export function PostHogEventBridge() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const anchor = findAnchor(event.target)
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      if (href.startsWith('/summary/') && href !== '/summary/') {
        capturePostHogEvent('summary_link_click', {
          href,
          from_path: window.location.pathname,
        })
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return null
}
