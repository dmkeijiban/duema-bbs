'use client'

import { useEffect } from 'react'

const PLACEHOLDER_SELECTOR = '[aria-label$=" のカード画像（準備中）"]'
const PLACEHOLDER_SUFFIX = ' のカード画像（準備中）'
const MAX_NAMES = 200

function getCardName(element: Element): string | null {
  const label = element.getAttribute('aria-label')
  if (!label?.endsWith(PLACEHOLDER_SUFFIX)) return null
  const name = label.slice(0, -PLACEHOLDER_SUFFIX.length).trim()
  return name || null
}

function applyImage(element: Element, name: string, imageUrl: string) {
  if (!(element instanceof HTMLElement) || element.dataset.zukanImageFallbackApplied === 'true') return

  const image = document.createElement('img')
  image.src = imageUrl
  image.alt = `${name} カード画像`
  image.loading = 'lazy'
  image.decoding = 'async'
  image.className = 'pointer-events-none h-full w-full object-cover'

  element.replaceChildren(image)
  element.className = 'bg-gray-100'
  element.setAttribute('aria-label', `${name} のカード画像`)
  element.dataset.zukanImageFallbackApplied = 'true'
}

export function ZukanImageFallbackHydrator() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    const hydrate = async () => {
      timer = null
      const placeholders = Array.from(document.querySelectorAll(PLACEHOLDER_SELECTOR))
        .filter(element => element.getAttribute('data-zukan-image-fallback-checked') !== 'true')

      if (placeholders.length === 0) return

      const elementsByName = new Map<string, Element[]>()
      for (const element of placeholders) {
        const name = getCardName(element)
        element.setAttribute('data-zukan-image-fallback-checked', 'true')
        if (!name) continue
        const current = elementsByName.get(name) ?? []
        current.push(element)
        elementsByName.set(name, current)
        if (elementsByName.size >= MAX_NAMES) break
      }

      const names = Array.from(elementsByName.keys())
      if (names.length === 0) return

      try {
        const response = await fetch('/api/zukan/image-fallbacks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names }),
        })
        if (!response.ok || stopped) return

        const payload = await response.json() as { images?: Record<string, unknown> }
        for (const [name, value] of Object.entries(payload.images ?? {})) {
          if (typeof value !== 'string' || value.length === 0) continue
          for (const element of elementsByName.get(name) ?? []) {
            applyImage(element, name, value)
          }
        }
      } catch {
        // 画像補完に失敗しても既存の「画像準備中」表示を維持する。
      }
    }

    const scheduleHydrate = () => {
      if (timer || stopped) return
      timer = setTimeout(() => void hydrate(), 50)
    }

    scheduleHydrate()
    const observer = new MutationObserver(scheduleHydrate)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      stopped = true
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [])

  return null
}
