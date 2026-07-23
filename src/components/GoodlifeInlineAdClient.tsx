'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { GOODLIFE_SCRIPT_URL, type AdSlotName } from '@/lib/ads'

const HOME_MIDDLE_MARKER = 'goodlife-home-middle-row-10'

function appendGoodlifeScript(target: HTMLElement) {
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.charset = 'utf-8'
  script.src = GOODLIFE_SCRIPT_URL
  script.async = true
  target.appendChild(script)
}

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
    appendGoodlifeScript(content)

    return () => {
      content.replaceChildren()
    }
  }, [desktopEnabled, footerRouteExcluded, mobileEnabled])

  useEffect(() => {
    // フッター上と同じ許可済みタグを、スマホTOPの10段目（30件目直後）にも表示する。
    if (slot !== 'footer_inline' || pathname !== '/' || footerRouteExcluded || !mobileEnabled) return
    if (window.matchMedia('(min-width: 768px)').matches) return

    let insertedHost: HTMLDivElement | null = null

    const insert = () => {
      if (document.querySelector(`[data-ad-placement="${HOME_MIDDLE_MARKER}"]`)) return true

      const grids = Array.from(document.querySelectorAll<HTMLDivElement>('div.grid'))
      const threadGrid = grids.find(grid =>
        grid.classList.contains('grid-cols-3')
        && grid.classList.contains('border-l')
        && grid.classList.contains('border-t')
        && grid.children.length >= 30,
      )
      if (!threadGrid) return false

      const anchor = threadGrid.children.item(29)
      if (!anchor) return false

      const host = document.createElement('div')
      host.className = 'col-span-3 border-b border-r border-gray-300 bg-white md:hidden'
      host.dataset.adPlacement = HOME_MIDDLE_MARKER
      host.setAttribute('aria-label', '広告')

      const aside = document.createElement('aside')
      aside.className = 'mx-auto my-3 box-border flex min-h-[250px] w-full max-w-full flex-col items-center justify-center overflow-hidden px-3 text-center'
      aside.dataset.adProvider = 'goodlife'
      aside.dataset.adSlot = 'home_middle_row_10'

      const label = document.createElement('span')
      label.className = 'mb-1 block text-[10px] leading-none text-gray-400'
      label.textContent = '広告'

      const content = document.createElement('div')
      content.className = 'mx-auto flex min-h-[250px] max-w-full items-center justify-center overflow-hidden'

      aside.append(label, content)
      host.appendChild(aside)
      anchor.after(host)
      appendGoodlifeScript(content)
      insertedHost = host
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
  }, [footerRouteExcluded, mobileEnabled, pathname, slot])

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
