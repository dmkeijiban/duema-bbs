'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { GOODLIFE_SCRIPT_URL, type AdSlotName } from '@/lib/ads'

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
  const contentRef = useRef<HTMLDivElement>(null)
  const footerRouteExcluded = slot === 'footer_inline'
    && (pathname.startsWith('/admin') || pathname.startsWith('/auth') || pathname.startsWith('/login'))

  useEffect(() => {
    if (footerRouteExcluded) return

    const content = contentRef.current
    if (!content) return

    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    if ((isDesktop && !desktopEnabled) || (!isDesktop && !mobileEnabled)) return

    content.replaceChildren()

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.charset = 'utf-8'
    script.src = GOODLIFE_SCRIPT_URL
    script.async = true
    content.appendChild(script)

    return () => {
      content.replaceChildren()
    }
  }, [desktopEnabled, footerRouteExcluded, mobileEnabled])

  if (footerRouteExcluded) return null

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
