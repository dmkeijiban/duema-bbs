'use client'

import { useEffect } from 'react'

interface AdBannerProps {
  slot: string
  format?: 'auto' | 'fluid' | 'rectangle'
  layout?: 'in-article'
  layoutKey?: string
  style?: React.CSSProperties
  minHeight?: number
}

export function AdBanner({ slot, format = 'auto', layout, layoutKey, style, minHeight = 0 }: AdBannerProps) {
  useEffect(() => {
    try {
      // AdSenseはpush()前にins要素をdisplay:noneにするため、
      // offsetWidthによるサイズガードは fluid format を含む全フォーマットでpushをブロックしてしまう。
      // Sentryへの外部スクリプトノイズはbeforeSend（sentry.client.config.ts）でフィルタリングする。
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
    } catch {}
  }, [])

  return (
    <div style={{ minHeight, overflow: 'hidden', ...style }}>
      <ins
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
