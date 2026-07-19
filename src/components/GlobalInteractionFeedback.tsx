'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  '[role="button"]:not([aria-disabled="true"])',
  'input[type="submit"]:not([disabled])',
  'input[type="button"]:not([disabled])',
].join(',')

function clearPending(element: HTMLElement) {
  delete element.dataset.interactionPending
  element.removeAttribute('aria-busy')
}

export function GlobalInteractionFeedback() {
  const pathname = usePathname()

  useEffect(() => {
    document
      .querySelectorAll<HTMLElement>('[data-interaction-pending="true"]')
      .forEach(clearPending)
  }, [pathname])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const interactive = target.closest<HTMLElement>(INTERACTIVE_SELECTOR)
      if (!interactive) return
      if (interactive.dataset.disableInteractionFeedback === 'true') return

      const link = interactive instanceof HTMLAnchorElement ? interactive : null
      if (link?.target === '_blank' || link?.hasAttribute('download')) return
      if (link?.hash && link.pathname === window.location.pathname && link.search === window.location.search) return

      interactive.dataset.interactionPending = 'true'
      interactive.setAttribute('aria-busy', 'true')

      const isNavigation = Boolean(link?.href)
      window.setTimeout(() => clearPending(interactive), isNavigation ? 10000 : 1200)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return null
}
