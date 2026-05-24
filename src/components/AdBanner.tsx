'use client'

import { useEffect, useRef } from 'react'

interface AdBannerProps {
  slot: string
  format?: 'auto' | 'fluid' | 'rectangle'
  layout?: 'in-article'
  layoutKey?: string
  style?: React.CSSProperties
  minHeight?: number
}

export function AdBanner({ slot, format = 'auto', layout, layoutKey, style, minHeight = 0 }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null)

  useEffect(() => {
    try {
      const el = adRef.current
      // 要素が非表示（幅0）の場合はpushしない。
      // ※ heightはチェックしない: fluid format は初期 offsetHeight=0 のため除外すると広告が表示されない
      if (el && el.offsetWidth > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
      }
    } catch {}
  }, [])

  return (
    <div style={{ minHeight, overflow: 'hidden', ...style }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', textAlign: layout === 'in-article' ? 'center' : undefined }}
        data-ad-client="ca-pub-1546271448425321"
        data-ad-slot={slot}
        data-ad-format={format}
        data-ad-layout={layout}
        data-ad-layout-key={layoutKey}
        data-full-width-responsive="true"
      />
    </div>
  )
}
