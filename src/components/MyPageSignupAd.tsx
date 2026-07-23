'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { AdstirBannerClient } from '@/components/AdstirBannerClient'

const HOST_MARKER = 'mypage-signup-notice-ad'

export function MyPageSignupAd() {
  const pathname = usePathname()
  const [host, setHost] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (pathname !== '/mypage') {
      setHost(null)
      return
    }

    const insert = () => {
      const existing = document.querySelector<HTMLDivElement>(`[data-ad-placement="${HOST_MARKER}"]`)
      if (existing) {
        setHost(existing)
        return true
      }

      const loginLink = document.querySelector<HTMLAnchorElement>('a[href="/login"]')
      const signupBanner = loginLink?.closest<HTMLDivElement>('div.rounded.border.border-blue-200.bg-blue-50')
      if (!signupBanner) return false

      const next = signupBanner.nextElementSibling
      const noticeHeading = next?.querySelector('h2')?.textContent ?? ''
      if (!noticeHeading.includes('お知らせ') && !noticeHeading.includes('新しいお知らせ')) return false

      const container = document.createElement('div')
      container.dataset.adPlacement = HOST_MARKER
      signupBanner.after(container)
      setHost(container)
      return true
    }

    if (insert()) return

    const observer = new MutationObserver(() => {
      if (insert()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [pathname])

  if (!host) return null

  return createPortal(
    <AdstirBannerClient slot="sp_list_top" className="my-0" />,
    host,
  )
}
