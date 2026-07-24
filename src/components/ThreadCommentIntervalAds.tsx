'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ADSTIR_APP_ID, ADSTIR_SCRIPT_URL, ADSTIR_SLOTS } from '@/lib/adstir'
import { GOODLIFE_SCRIPT_URL } from '@/lib/ads'

const TARGET_POST_NUMBERS = [9, 19, 29, 39, 49, 59, 69, 79, 89, 99] as const
const MARKER_PREFIX = 'thread-comment-interval-ad-'

function createAdstirIframe() {
  const { adSpot, width, height } = ADSTIR_SLOTS.sp_list_top
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

function createGoodlifeIframe() {
  const iframe = document.createElement('iframe')
  iframe.title = '広告'
  iframe.width = '300'
  iframe.height = '250'
  iframe.scrolling = 'no'
  iframe.style.border = '0'
  iframe.style.display = 'block'
  iframe.style.marginInline = 'auto'
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation',
  )
  iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;text-align:center;}body>*{margin-left:auto!important;margin-right:auto!important;}</style></head><body><script type="text/javascript" charset="utf-8" src="${GOODLIFE_SCRIPT_URL}"></script></body></html>`
  return iframe
}

function createHost(postNumber: number, useGoodlife: boolean) {
  const host = document.createElement('div')
  host.className = 'md:hidden border-b border-gray-200 bg-white py-3'
  host.dataset.adPlacement = `${MARKER_PREFIX}${postNumber}`
  host.dataset.adProvider = useGoodlife ? 'goodlife' : 'adstir'
  host.dataset.adSlot = useGoodlife ? 'thread_comment_interval' : 'sp_list_top'
  host.setAttribute('aria-label', '広告')

  const label = document.createElement('span')
  label.className = 'mb-1 block text-center text-[10px] leading-none text-gray-400'
  label.textContent = '広告'

  const content = document.createElement('div')
  content.className = 'mx-auto flex w-full max-w-full items-center justify-center overflow-hidden'
  content.appendChild(useGoodlife ? createGoodlifeIframe() : createAdstirIframe())

  host.append(label, content)
  return host
}

export function ThreadCommentIntervalAds({ adstirEnabled }: { adstirEnabled: boolean }) {
  const pathname = usePathname()

  useEffect(() => {
    const isThreadPage = /^\/thread\/\d+(?:\/p\/\d+)?\/?$/.test(pathname)
    if (!isThreadPage || window.matchMedia('(min-width: 768px)').matches) return

    const insertedHosts: HTMLElement[] = []

    const insert = () => {
      let allHandled = true

      TARGET_POST_NUMBERS.forEach((postNumber, index) => {
        const marker = `${MARKER_PREFIX}${postNumber}`
        if (document.querySelector(`[data-ad-placement="${marker}"]`)) return

        const post = document.getElementById(`post-${postNumber}`)
        if (!post) {
          allHandled = false
          return
        }

        const useGoodlife = index % 2 === 1
        if (!useGoodlife && !adstirEnabled) return

        const host = createHost(postNumber, useGoodlife)
        post.after(host)
        insertedHosts.push(host)
      })

      return allHandled
    }

    insert()
    const observer = new MutationObserver(insert)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      insertedHosts.forEach(host => host.remove())
      document.querySelectorAll(`[data-ad-placement^="${MARKER_PREFIX}"]`).forEach(node => node.remove())
    }
  }, [adstirEnabled, pathname])

  return null
}
