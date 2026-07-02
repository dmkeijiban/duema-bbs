'use client'

import { useEffect } from 'react'

const SCROLL_Y_KEY = 'duema-admin-scroll-y'
const SCROLL_TARGET_KEY = 'duema-admin-scroll-target'

function saveCurrentScroll(target?: string | null) {
  sessionStorage.setItem(SCROLL_Y_KEY, String(window.scrollY))
  if (target) {
    sessionStorage.setItem(SCROLL_TARGET_KEY, target)
  } else {
    sessionStorage.removeItem(SCROLL_TARGET_KEY)
  }
}

export function AdminScrollManager() {
  useEffect(() => {
    const restore = () => {
      const target = sessionStorage.getItem(SCROLL_TARGET_KEY)
      const savedY = sessionStorage.getItem(SCROLL_Y_KEY)
      sessionStorage.removeItem(SCROLL_TARGET_KEY)
      sessionStorage.removeItem(SCROLL_Y_KEY)

      if (target === 'thread-list') {
        document.querySelector('[data-admin-thread-list-start]')?.scrollIntoView({
          block: 'start',
        })
        return
      }

      if (savedY) {
        const y = Number(savedY)
        if (Number.isFinite(y)) {
          window.scrollTo({ top: y, left: 0 })
        }
      }
    }

    requestAnimationFrame(restore)
    const timeoutId = window.setTimeout(restore, 80)

    const handleClick = (event: MouseEvent) => {
      const element = (event.target as Element | null)?.closest<HTMLElement>('[data-admin-scroll]')
      if (!element) return
      saveCurrentScroll(element.dataset.adminScroll)
    }

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null
      if (!form) return
      saveCurrentScroll(form.dataset.adminScroll)
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('submit', handleSubmit, true)

    return () => {
      window.clearTimeout(timeoutId)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('submit', handleSubmit, true)
    }
  })

  return null
}
