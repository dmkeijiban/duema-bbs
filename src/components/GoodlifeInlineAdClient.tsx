'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GOODLIFE_SCRIPT_URL, type AdSlotName } from '@/lib/ads'

const CREATIVE_SELECTOR = 'iframe, img[src], ins, object, embed, video, canvas, [id], [class]'

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
  const contentRef = useRef<HTMLDivElement>(null)
  const [hasCreative, setHasCreative] = useState(false)

  const detectCreative = useCallback(() => {
    const content = contentRef.current
    if (!content) return false

    const creative = Array.from(content.querySelectorAll<HTMLElement>(CREATIVE_SELECTOR)).find(element => {
      if (element.tagName === 'SCRIPT') return false
      const rect = element.getBoundingClientRect()
      const width = rect.width || Number(element.getAttribute('width')) || 0
      const height = rect.height || Number(element.getAttribute('height')) || 0
      return width > 1 && height > 1
    })
    if (!creative) return false

    setHasCreative(true)
    return true
  }, [])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    if ((isDesktop && !desktopEnabled) || (!isDesktop && !mobileEnabled)) return

    content.replaceChildren()

    const observer = new MutationObserver(() => {
      if (detectCreative()) observer.disconnect()
    })
    observer.observe(content, { childList: true, subtree: true, attributes: true })

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.charset = 'utf-8'
    script.src = GOODLIFE_SCRIPT_URL
    script.async = true
    script.addEventListener('load', detectCreative)
    content.appendChild(script)

    return () => {
      observer.disconnect()
      script.removeEventListener('load', detectCreative)
      content.replaceChildren()
    }
  }, [desktopEnabled, detectCreative, mobileEnabled])

  return (
    <aside
      className={hasCreative
        ? `${visibilityClass} goodlife-ad-visible mx-auto my-4 box-border flex w-full max-w-full flex-col items-center justify-center overflow-hidden px-0 text-center max-md:my-3 max-md:pl-3 max-md:pr-14`
        : 'goodlife-ad-pending pointer-events-none absolute h-0 w-full overflow-hidden invisible'
      }
      data-ad-provider="goodlife"
      data-ad-slot={slot}
      data-ad-rendered={hasCreative ? 'true' : 'false'}
      aria-hidden={hasCreative ? undefined : true}
      aria-label={hasCreative ? '広告' : undefined}
    >
      {hasCreative && <span className="mb-1 block text-[10px] leading-none text-gray-400">広告</span>}
      <div ref={contentRef} className="mx-auto max-w-full overflow-hidden" />
    </aside>
  )
}
