'use client'

import { usePathname } from 'next/navigation'
import { GOODLIFE_SCRIPT_URL } from '@/lib/ads'

export function RankingGoodlifeAd() {
  const pathname = usePathname()
  if (pathname !== '/ranking') return null

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;text-align:center;}body>*{margin-left:auto!important;margin-right:auto!important;}</style></head><body><script type="text/javascript" charset="utf-8" src="${GOODLIFE_SCRIPT_URL}"></script></body></html>`

  return (
    <aside
      className="mx-auto my-3 box-border flex min-h-[250px] w-full max-w-full flex-col items-center justify-center overflow-hidden px-3 text-center md:hidden"
      data-ad-provider="goodlife"
      data-ad-slot="ranking_before_green_direct"
      aria-label="広告"
    >
      <span className="mb-1 block text-[10px] leading-none text-gray-400">広告</span>
      <iframe
        title="広告"
        srcDoc={srcDoc}
        width="300"
        height="250"
        scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        className="block max-w-full border-0"
      />
    </aside>
  )
}
