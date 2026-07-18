'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { GAM_SLOTS, GPT_SCRIPT_URL, type GamSlotName } from '@/lib/gam'

type GptSlot = {
  addService: (service: unknown) => GptSlot
  defineSizeMapping: (mapping: unknown) => GptSlot
  getSlotElementId: () => string
}

type SlotRenderEndedEvent = { slot: GptSlot; isEmpty: boolean }

type GptSizeMappingBuilder = {
  addSize: (viewport: [number, number], sizes: [number, number][]) => GptSizeMappingBuilder
  build: () => unknown
}

type GptPubAds = {
  enableLazyLoad: (config: { fetchMarginPercent: number; renderMarginPercent: number; mobileScaling: number }) => void
  addEventListener: (event: 'slotRenderEnded', listener: (event: SlotRenderEndedEvent) => void) => void
  removeEventListener: (event: 'slotRenderEnded', listener: (event: SlotRenderEndedEvent) => void) => void
  getSlots: () => GptSlot[]
}

type Googletag = {
  cmd: Array<() => void>
  pubads: () => GptPubAds
  sizeMapping: () => GptSizeMappingBuilder
  defineSlot: (path: string, sizes: [number, number][], divId: string) => GptSlot | null
  display: (divId: string) => void
  destroySlots: (slots?: GptSlot[]) => boolean
  enableServices: () => void
}

// gpt.js は1ページで1回だけ読み込む（複数スロットがマウントされても共有）
let gptScriptRequested = false

function ensureGptLoaded(): Googletag {
  const win = window as unknown as { googletag?: Googletag }
  if (!win.googletag) {
    win.googletag = { cmd: [] } as unknown as Googletag
  } else if (!win.googletag.cmd) {
    win.googletag.cmd = []
  }

  if (!gptScriptRequested && !document.querySelector(`script[src="${GPT_SCRIPT_URL}"]`)) {
    const script = document.createElement('script')
    script.src = GPT_SCRIPT_URL
    script.async = true
    document.head.appendChild(script)
  }
  gptScriptRequested = true
  return win.googletag
}

// lazy load 設定と enableServices はページ読み込み中に1回だけ実行する
// （自動リフレッシュは使わない）
let gptInitialized = false

function initGptOnce(googletag: Googletag) {
  if (gptInitialized) return
  gptInitialized = true
  googletag.cmd.push(() => {
    googletag.pubads().enableLazyLoad({
      fetchMarginPercent: 100,
      renderMarginPercent: 25,
      mobileScaling: 2,
    })
    googletag.enableServices()
  })
}

function dedupeSizes(sizes: [number, number][]): [number, number][] {
  const seen = new Set<string>()
  return sizes.filter(([w, h]) => {
    const key = `${w}x${h}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function GamAdClient({
  slot,
  visibilityClass,
  desktopEnabled,
  mobileEnabled,
  minHeightClass,
}: {
  slot: GamSlotName
  visibilityClass: string
  desktopEnabled: boolean
  mobileEnabled: boolean
  minHeightClass: string
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const config = GAM_SLOTS[slot]
  const routeExcluded = pathname.startsWith('/admin')
    || pathname.startsWith('/auth')
    || pathname.startsWith('/login')

  useEffect(() => {
    if (routeExcluded) return

    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    if ((isDesktop && !desktopEnabled) || (!isDesktop && !mobileEnabled)) return

    const googletag = ensureGptLoaded()
    initGptOnce(googletag)

    let definedSlot: GptSlot | null = null
    let renderListener: ((event: SlotRenderEndedEvent) => void) | null = null

    googletag.cmd.push(() => {
      // ルート遷移で cleanup 前に再マウントされた場合の重複defineSlot保険
      const existing = googletag.pubads().getSlots()
        .find(gptSlot => gptSlot.getSlotElementId() === config.divId)
      if (existing) googletag.destroySlots([existing])

      const mapping = googletag.sizeMapping()
        .addSize([768, 0], config.desktopSizes)
        .addSize([0, 0], config.mobileSizes)
        .build()

      const gptSlot = googletag.defineSlot(
        config.path,
        dedupeSizes([...config.desktopSizes, ...config.mobileSizes]),
        config.divId,
      )
      if (!gptSlot) return

      gptSlot.defineSizeMapping(mapping)
      gptSlot.addService(googletag.pubads())
      definedSlot = gptSlot

      renderListener = event => {
        if (event.slot !== gptSlot) return
        // 空配信（バックフィル不成立）時は枠ごと畳んで空白を残さない
        setCollapsed(event.isEmpty)
      }
      googletag.pubads().addEventListener('slotRenderEnded', renderListener)

      googletag.display(config.divId)
    })

    return () => {
      googletag.cmd.push(() => {
        if (renderListener) googletag.pubads().removeEventListener('slotRenderEnded', renderListener)
        if (definedSlot) googletag.destroySlots([definedSlot])
      })
    }
  }, [config, desktopEnabled, mobileEnabled, routeExcluded])

  if (routeExcluded) return null

  return (
    <aside
      className={`${visibilityClass} mx-auto my-4 box-border flex ${minHeightClass} w-full max-w-full flex-col items-center justify-center overflow-hidden px-3 text-center max-md:my-3`}
      style={collapsed ? { display: 'none' } : undefined}
      data-ad-provider="gam"
      data-ad-slot={slot}
      aria-label="広告"
    >
      <span className="mb-1 block text-[10px] leading-none text-gray-400">広告</span>
      <div id={config.divId} className={`mx-auto ${minHeightClass} max-w-full overflow-hidden`} />
    </aside>
  )
}
