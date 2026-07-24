'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { ADSTIR_APP_ID, ADSTIR_SCRIPT_URL, ADSTIR_SLOTS, type AdstirSlotName } from '@/lib/adstir'

const LIST_BOTTOM_MARKER = 'adstir-list-bottom-before-nav'
const LIST_PAGE_PATHS = new Set(['/update', '/new', '/ranking', '/random', '/kakolog'])

function createAdstirIframe(adSpot: number, width: number, height: number) {
  const iframe = document.createElement('iframe')
  iframe.title = '広告'
  iframe.width = String(width)
  iframe.height = String(height)
  iframe.scrolling = 'no'
  iframe.style.border = '0'
  iframe.style.display = 'block'
  iframe.style.marginInline = 'auto'
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation',
  )
  iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;text-align:center;}body>*{margin-left:auto!important;margin-right:auto!important;}</style></head><body>` +
    `<script type="text/javascript">var adstir_vars={ver:"4.0",app_id:"${ADSTIR_APP_ID}",ad_spot:${adSpot},center:true};</script>` +
    `<script type="text/javascript" src="${ADSTIR_SCRIPT_URL}"></script>` +
    `</body></html>`
  return iframe
}

function createAdHost(marker: string, slotName: string, adSpot: number, width: number, height: number) {
  const host = document.createElement('div')
  host.className = 'md:hidden mx-auto flex w-full max-w-full flex-col items-center justify-center overflow-hidden bg-white'
  host.dataset.adPlacement = marker
  host.dataset.adProvider = 'adstir'
  host.dataset.adSlot = slotName
  host.setAttribute('aria-label', '広告')

  const label = document.createElement('span')
  label.className = 'mb-[2px] block text-[10px] leading-none text-gray-400'
  label.textContent = '広告'

  const content = document.createElement('div')
  content.className = 'mx-auto overflow-hidden'
  content.style.width = `${width}px`
  content.style.height = `${height}px`
  content.style.maxWidth = '100%'
  content.appendChild(createAdstirIframe(adSpot, width, height))

  host.append(label, content)
  return host
}

export function AdstirBannerClient({
  slot,
  className = '',
  allowOnListPage = false,
}: {
  slot: AdstirSlotName
  className?: string
  allowOnListPage?: boolean
}) {
  const pathname = usePathname()
  const { adSpot, width, height } = ADSTIR_SLOTS[slot]
  const containerRef = useRef<HTMLDivElement>(null)
  const hidePrimaryListTop = slot === 'sp_list_top' && LIST_PAGE_PATHS.has(pathname) && !allowOnListPage
  const hideHomeListMiddle = slot === 'sp_list_middle' && pathname === '/'
  const hidePrimarySlot = hidePrimaryListTop || hideHomeListMiddle

  useEffect(() => {
    if (hidePrimarySlot) return

    const container = containerRef.current
    if (!container) return
    // PC/タブレット幅では配信しない（既存のmd:768pxブレークポイントに合わせる）
    if (window.matchMedia('(min-width: 768px)').matches) return

    // adstirのタグはdocument.writeで自身を描画するため、ホストページに直接
    // 挿入せずiframe(srcdoc)内で完結させる。タグ自体は公式配布の内容のまま。
    container.replaceChildren(createAdstirIframe(adSpot, width, height))

    return () => {
      container.replaceChildren()
    }
  }, [adSpot, height, hidePrimarySlot, width])

  useEffect(() => {
    // 一覧上部と同じ320×100枠を、一覧末尾のページ送りと共通ナビの間にも表示する。
    if (slot !== 'sp_list_top' || window.matchMedia('(min-width: 768px)').matches) return

    let insertedHost: HTMLDivElement | null = null

    const insert = () => {
      if (document.querySelector(`[data-ad-placement="${LIST_BOTTOM_MARKER}"]`)) return true

      const nav = document.querySelector<HTMLElement>('nav[aria-label="共通スレッド一覧ナビ"]')
      if (!nav) return false

      const host = createAdHost(LIST_BOTTOM_MARKER, 'sp_list_top_bottom', adSpot, width, height)
      host.classList.add('my-3')
      nav.before(host)
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
  }, [adSpot, height, pathname, slot, width])

  if (hidePrimarySlot) return null

  return (
    <div
      className={`md:hidden mx-auto my-3 flex w-full max-w-full flex-col items-center justify-center overflow-hidden ${className}`}
      data-ad-provider="adstir"
      data-ad-slot={slot}
      aria-label="広告"
    >
      <span className="mb-[2px] block text-[10px] leading-none text-gray-400">広告</span>
      <div ref={containerRef} style={{ width, height, maxWidth: '100%' }} className="mx-auto overflow-hidden" />
    </div>
  )
}
