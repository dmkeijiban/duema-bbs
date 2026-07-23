'use client'

import { useEffect, useRef } from 'react'
import { ADSTIR_APP_ID, ADSTIR_SCRIPT_URL, ADSTIR_SLOTS, type AdstirSlotName } from '@/lib/adstir'

export function AdstirBannerClient({ slot }: { slot: AdstirSlotName }) {
  const { adSpot, width, height } = ADSTIR_SLOTS[slot]
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // PC/タブレット幅では配信しない（既存のmd:768pxブレークポイントに合わせる）
    if (window.matchMedia('(min-width: 768px)').matches) return

    // adstirのタグはdocument.writeで自身を描画するため、ホストページに直接
    // 挿入せずiframe(srcdoc)内で完結させる。タグ自体は公式配布の内容のまま。
    const iframe = document.createElement('iframe')
    iframe.title = '広告'
    iframe.width = String(width)
    iframe.height = String(height)
    iframe.scrolling = 'no'
    iframe.style.border = '0'
    iframe.style.display = 'block'
    iframe.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation',
    )
    iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}</style></head><body>` +
      `<script type="text/javascript">var adstir_vars={ver:"4.0",app_id:"${ADSTIR_APP_ID}",ad_spot:${adSpot},center:false};</script>` +
      `<script type="text/javascript" src="${ADSTIR_SCRIPT_URL}"></script>` +
      `</body></html>`

    container.replaceChildren(iframe)

    return () => {
      container.replaceChildren()
    }
  }, [adSpot, width, height])

  return (
    <div
      className="md:hidden mx-auto my-3 flex w-full max-w-full flex-col items-center justify-center overflow-hidden"
      data-ad-provider="adstir"
      data-ad-slot={slot}
      aria-label="広告"
    >
      <span className="mb-1 block text-[10px] leading-none text-gray-400">広告</span>
      <div ref={containerRef} style={{ width, height, maxWidth: '100%' }} className="mx-auto overflow-hidden" />
    </div>
  )
}
